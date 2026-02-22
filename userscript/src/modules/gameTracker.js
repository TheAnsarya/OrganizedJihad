/**
 * gameTracker.js
 *
 * Tracks and extracts game data from Hero Wars API requests
 * Uses XMLHttpRequest/fetch proxying to intercept and monitor game communication
 * WITHOUT modifying data (read-only tracking for legitimate progress monitoring)
 *
 * Key Features:
 * - Request/response interception for data capture
 * - Player stats extraction from API calls (userGetInfo)
 * - Hero roster tracking from heroGetAll responses
 * - Resource monitoring from inventoryGet
 * - Battle results capture from battle API calls
 *
 * Technical Implementation:
 * Inspired by HeroWarsHelper's request proxying pattern:
 * https://greasyfork.org/en/scripts/450693-herowarshelper
 *
 * WARNING: This module does NOT modify game data or requests.
 * It only observes and logs information for tracking purposes.
 *
 * @module gameTracker
 */

import IndexedDBStorage from './indexedDBStorage.js';
import UpgradeTracker from './trackers/UpgradeTracker.js';

/**
 * Game data tracking via API interception
 * Monitors Hero Wars API requests for legitimate data tracking
 *
 * @class GameTracker
 */
class GameTracker {
	constructor(storage) {
		this.storage = storage || new IndexedDBStorage();
		this.isTracking = false;
		this.lastUpdate = Date.now();
		this.originalXHR = null;
		this.originalFetch = null;
		this.apiUrl = '';
		this.requestHistory = {};

		// Dedicated trackers for complex event categories
		this.upgradeTracker = new UpgradeTracker(this.storage);

		// Cache current rank values to use when player data lacks specific rank info
		// These get updated whenever we see rank data in any API response
		this.lastKnownArenaRank = 0;
		this.lastKnownGrandArenaRank = 0;
		this.lastKnownTitanArenaRank = 0;

		// ── Deduplication fingerprints ──────────────────────────────────────
		// Prevents writing identical snapshots on repeated API calls.
		// Each fingerprint is a JSON string derived from the data's key fields;
		// if the fingerprint matches the previous write, the snapshot is skipped.

		/** @type {string|null} Last fingerprint of hero roster for dedup */
		this._lastHeroHash = null;
		/** @type {string|null} Last fingerprint of titan roster for dedup */
		this._lastTitanHash = null;
		/** @type {string|null} Last fingerprint of pet roster for dedup */
		this._lastPetHash = null;
		/** @type {string|null} Last fingerprint of player key fields for dedup */
		this._lastPlayerKey = null;
		/** @type {string|null} Last fingerprint of inventory totals for dedup */
		this._lastInventoryHash = null;

		// ── Error tracking ─────────────────────────────────────────────────
		/** @type {number} Count of errors encountered during this session */
		this.errorCount = 0;
		/**
		 * Optional callback invoked whenever a tracker error is logged.
		 * Set by the host (index.js) to update the status badge.
		 *
		 * @type {((count: number) => void)|null}
		 */
		this.onError = null;

		// ── Event emitter ──────────────────────────────────────────────────
		// Simple pub-sub for live activity feed (Issue #24).
		// Listeners subscribe via on(event, handler) and are notified with _emit().
		/** @type {Map<string, Set<Function>>} */
		this._eventListeners = new Map();
	}

	/**
	 * Compute a lightweight fingerprint for deduplication.
	 * Produces a JSON string from the data's key fields. Comparing two
	 * fingerprints is ~100× cheaper than re-writing to IndexedDB.
	 *
	 * @param {*} data - Any JSON-serialisable value
	 * @returns {string} Deterministic JSON string
	 * @private
	 */
	_computeDataFingerprint(data) {
		return JSON.stringify(data);
	}

	// =====================================================================
	// Event Emitter (Issue #24 — Live Activity Feed)
	// =====================================================================

	/**
	 * Subscribe to a named event.
	 *
	 * @param {string} event  - Event name (e.g. 'activity', 'error')
	 * @param {Function} handler - Callback receiving the event payload
	 */
	on(event, handler) {
		if (!this._eventListeners.has(event)) {
			this._eventListeners.set(event, new Set());
		}
		this._eventListeners.get(event).add(handler);
	}

	/**
	 * Unsubscribe from a named event.
	 *
	 * @param {string} event  - Event name
	 * @param {Function} handler - The exact handler reference passed to on()
	 */
	off(event, handler) {
		const listeners = this._eventListeners.get(event);
		if (listeners) {
			listeners.delete(handler);
		}
	}

	/**
	 * Emit a named event to all subscribers. Errors in handlers are swallowed.
	 *
	 * @param {string} event - Event name
	 * @param {*} payload - Data to pass to handlers
	 * @private
	 */
	_emit(event, payload) {
		const listeners = this._eventListeners.get(event);
		if (!listeners) return;
		for (const handler of listeners) {
			try {
				handler(payload);
			} catch {
				// Listener blew up — don't let it cascade
			}
		}
	}

	/**
	 * Log a live activity event to IndexedDB and emit it to subscribers.
	 *
	 * Event types:
	 *   - 'battle'   : Arena / Grand Arena / Titan Arena / Guild War (green=win, red=loss)
	 *   - 'resource'  : Gold, emeralds, energy changes
	 *   - 'hero'      : Hero data captured, upgrades detected
	 *   - 'chest'     : Chest openings
	 *   - 'info'      : General tracking events (snapshot, player data)
	 *   - 'upgrade'   : Hero/Titan upgrades
	 *   - 'error'     : Errors encountered
	 *
	 * The store is capped at 500 entries — oldest are pruned on write.
	 *
	 * @param {string} eventType - One of the types listed above
	 * @param {string} message   - Human-readable description
	 * @param {object} [extra]   - Optional extra data for the event detail
	 * @returns {Promise<void>}
	 * @private
	 */
	async _logActivity(eventType, message, extra = {}) {
		const entry = {
			eventType,
			message,
			timestamp: Date.now(),
			...extra,
		};

		// Emit to live listeners immediately (before IDB write)
		this._emit('activity', entry);

		try {
			await this.storage.add('activityEvents', entry);

			// Cap at 500 entries — prune oldest
			const all = await this.storage.getAll('activityEvents');
			if (all.length > 500) {
				const toDelete = all
					.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
					.slice(0, all.length - 500);
				for (const old of toDelete) {
					await this.storage.delete('activityEvents', old.id);
				}
			}
		} catch {
			// Activity logging is best-effort — don't bubble up
		}
	}

	/**
	 * Log a tracker error to IndexedDB (last 50 kept) and notify the host.
	 * This is intentionally defensive — if the error-logging itself fails,
	 * we silently swallow rather than creating a cascade.
	 *
	 * @param {string} context - Human-readable location where the error occurred
	 * @param {Error|string} error - The caught error
	 * @returns {Promise<void>}
	 * @private
	 */
	async _logError(context, error) {
		this.errorCount++;

		// Notify host (index.js) so it can update the UI badge
		if (typeof this.onError === 'function') {
			try {
				this.onError(this.errorCount);
			} catch {
				// Badge callback blew up — ignore
			}
		}

		try {
			const errorLog = await this.storage.getMetadata('errorLog', []);
			errorLog.push({
				context,
				message: error?.message || String(error),
				stack: error?.stack?.substring(0, 500) || null,
				timestamp: Date.now(),
			});

			// Keep only the 50 most-recent errors
			if (errorLog.length > 50) {
				errorLog.splice(0, errorLog.length - 50);
			}

			await this.storage.setMetadata('errorLog', errorLog);
		} catch {
			// Error logging itself failed — nothing more we can do
		}

		// Emit to activity feed (best-effort, separate try/catch)
		try {
			this._emit('activity', {
				eventType: 'error',
				message: `Error in ${context}: ${error?.message || String(error)}`,
				timestamp: Date.now(),
			});
		} catch { /* empty */ }
	}

	/**
	 * Initialize game tracking by proxying API requests
	 * Sets up interception of XMLHttpRequest and fetch calls
	 *
	 * Pattern learned from HeroWarsHelper script's request interception:
	 * - Proxy XMLHttpRequest.prototype.send
	 * - Proxy XMLHttpRequest.prototype.onreadystatechange
	 * - Intercept responses in readyState === 4
	 *
	 * Reference: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
	 *
	 * @returns {Promise<void>}
	 */
	async init() {
		try {
			await this.storage.init();
			this.proxyAPIRequests();
			this.isTracking = true;
			console.log('[OrganizedJihad] GameTracker initialized - monitoring Hero Wars API');
		} catch (error) {
			console.error('[OrganizedJihad] Failed to initialize GameTracker:', error);
		}
	}

	/**
	 * Proxy XMLHttpRequest to intercept Hero Wars API calls
	 *
	 * Implementation pattern from HeroWarsHelper:
	 * 1. Save original XHR methods
	 * 2. Override open() to detect API URL pattern
	 * 3. Override send() to capture request data
	 * 4. Override onreadystatechange to capture responses
	 *
	 * Hero Wars API pattern: *.nextersglobal.com/api/
	 * Request format: JSON with "calls" array containing API method calls
	 *
	 * @private
	 */
	proxyAPIRequests() {
		const self = this;

		// Store original methods
		this.originalXHR = {
			open: XMLHttpRequest.prototype.open,
			send: XMLHttpRequest.prototype.send,
			setRequestHeader: XMLHttpRequest.prototype.setRequestHeader,
		};

		/**
		 * Proxy XMLHttpRequest.open() to detect API calls
		 * Hero Wars uses POST requests to *.nextersglobal.com/api/
		 */
		XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
			this._ojTracking = {
				method,
				url,
				timestamp: Date.now(),
				requestId: `${Date.now()}_${Math.random()}`,
			};

			// Detect Hero Wars API URL pattern
			if (method === 'POST' && url.includes('.nextersglobal.com/api/') && /api\/$/.test(url)) {
				this._ojTracking.isHeroWarsAPI = true;
				if (!self.apiUrl) {
					self.apiUrl = url;
					console.log('[OrganizedJihad] Detected Hero Wars API URL:', url);
				}
			}

			return self.originalXHR.open.call(this, method, url, async, user, password);
		};

		/**
		 * Proxy XMLHttpRequest.send() to capture request data
		 * Hero Wars requests are JSON strings with format:
		 * {
		 *   "calls": [
		 *     {"name": "userGetInfo", "args": {}, "ident": "body"},
		 *     {"name": "heroGetAll", "args": {}, "ident": "heroGetAll"}
		 *   ]
		 * }
		 */
		XMLHttpRequest.prototype.send = function (data) {
			if (this._ojTracking?.isHeroWarsAPI && data) {
				try {
					// Parse request data
					const requestData = typeof data === 'string' ? JSON.parse(data) : data;
					this._ojTracking.requestData = requestData;

					// Store request for later processing
					self.requestHistory[this._ojTracking.requestId] = {
						request: requestData,
						response: null,
						timestamp: this._ojTracking.timestamp,
					};
				} catch (error) {
					console.warn('[OrganizedJihad] Failed to parse request data:', error);
				}

				// Proxy the onreadystatechange to capture response
				const originalOnReadyStateChange = this.onreadystatechange;
				this.onreadystatechange = function () {
					// Capture response when request completes
					if (this.readyState === 4 && this.status === 200) {
						try {
							const responseData = JSON.parse(this.responseText);
							const requestId = this._ojTracking.requestId;

							if (self.requestHistory[requestId]) {
								self.requestHistory[requestId].response = responseData;
								// Process the captured data
								self.processAPIResponse(self.requestHistory[requestId].request, responseData);
							}
						} catch (error) {
							console.warn('[OrganizedJihad] Failed to parse response:', error);
						}
					}

					// Call original handler
					if (originalOnReadyStateChange) {
						return originalOnReadyStateChange.apply(this, arguments);
					}
				};
			}

			return self.originalXHR.send.call(this, data);
		};
	}

	/**
	 * Process captured API response data
	 * Extracts relevant information based on API call types
	 *
	 * Hero Wars API response format:
	 * {
	 *   "results": [
	 *     {"ident": "body", "result": {"response": {...actual data...}}}
	 *   ]
	 * }
	 *
	 * Comprehensive API calls we track:
	 * - userGetInfo: Player level, VIP, resources, guild
	 * - heroGetAll: Hero roster with stats, equipment, skins
	 * - inventoryGet: Items, consumables, fragments, chests
	 * - missionEnd, towerEnd, etc: Battle results with teams
	 * - arenaAttack, arenaGetEnemies: Arena opponents and results
	 * - titanArenaAttack, titanArenaGetEnemies: Titan arena battles
	 * - grandArenaAttack: Grand arena battles
	 * - clanWarAttack, clanWarGetInfo: Guild war data
	 * - bossRaid: Guild raid boss attacks
	 * - shopBuy, shopRefresh: Shop purchases and inventory
	 * - chestOpen: Chest opening results for drop rate analysis
	 * - questComplete: Quest rewards tracking
	 * - expeditionGetState, expeditionBattle: Expedition progress
	 *
	 * @param {Object} request - The request data with "calls" array
	 * @param {Object} response - The response data with "results" array
	 * @private
	 */
	async processAPIResponse(request, response) {
		if (!request?.calls || !response?.results) return;

		// Map requests to responses by ident
		const callMap = {};
		const callArgs = {};
		request.calls.forEach((call) => {
			callMap[call.ident] = call.name;
			callArgs[call.ident] = call.args || {};
		});

		// Process each result
		for (const result of response.results) {
			const callName = callMap[result.ident];
			const args = callArgs[result.ident];
			const responseData = result.result?.response;

			if (!responseData) continue;

			try {
				switch (callName) {
					// Core player data
					case 'userGetInfo':
						await this.trackPlayerData(responseData);
						break;
					case 'heroGetAll':
						await this.trackHeroesData(responseData);
						break;
					case 'inventoryGet':
						await this.trackInventoryData(responseData);
						break;

					// Battle systems
					case 'missionEnd':
						await this.trackMissionProgress(args, responseData);
						await this.trackBattleResult(callName, args, responseData); // Still track as battle
						break;
					case 'towerEnd':
						await this.trackTowerProgress(args, responseData);
						await this.trackBattleResult(callName, args, responseData); // Still track as battle
						break;
					case 'bossEnd':
						await this.trackBattleResult(callName, args, responseData);
						break;

					// Arena tracking
					case 'arenaGetEnemies':
						await this.trackArenaEnemies(responseData);
						break;
					case 'arenaAttack':
					case 'arenaEnd':
						await this.trackArenaBattle(args, responseData);
						break;

					// Titan Arena
					case 'titanArenaGetEnemies':
						await this.trackTitanArenaEnemies(responseData);
						break;
					case 'titanArenaAttack':
						await this.trackTitanArenaBattle(args, responseData);
						break;

					// Grand Arena
					case 'grandArenaGetEnemies':
						await this.trackGrandArenaEnemies(responseData);
						break;
					case 'grandArenaAttack':
						await this.trackGrandArenaBattle(args, responseData);
						break;

					// Guild War
					case 'clanWarAttack':
						await this.trackGuildWarBattle(args, responseData);
						break;

					// Guild Raid
					case 'bossRaidAttack':
						await this.trackRaidBossAttack(args, responseData);
						break;

					// Loot and rewards
					case 'chestOpen':
						await this.trackChestOpening(args, responseData);
						break;
					case 'shopBuy':
						await this.trackShopPurchase(args, responseData);
						break;
					case 'questComplete':
						await this.trackQuestComplete(args, responseData);
						break;

					// Other data
					case 'questGetAll':
						await this.trackQuestsData(responseData);
						break;
					case 'clanGetInfo':
						await this.trackGuildData(responseData);
						await this.trackGuildMembers(responseData); // Track fellow guild members
						break;
					case 'clanWarGetInfo':
					case 'clanWarUserGetInfo':
						await this.trackGuildWarInfo(responseData);
						await this.trackGuildWarParticipation(responseData); // Track member participation
						break;
					case 'bossRaidGetInfo':
						await this.trackRaidBossInfo(responseData);
						await this.trackGuildRaidParticipation(responseData); // Track member raid stats
						break;
					case 'dungeonGetState':
					case 'titanDungeonGetInfo':
						await this.trackGuildDungeonParticipation(responseData); // Track dungeon progress
						break;
					case 'expeditionGetState':
						await this.trackExpeditionState(responseData);
						break;
					case 'expeditionBattle':
						await this.trackExpeditionBattle(args, responseData);
						break;
					case 'titanGetAll':
						await this.trackTitansData(responseData);
						break;
					case 'petGetAll':
						await this.trackPetsData(responseData);
						break;

					// Chat and communication
					case 'chatGetDialog':
					case 'chatGetNewMessages':
						await this.trackChatMessages(args, responseData, callName);
						break;
					case 'chatSendMessage':
						await this.trackOutgoingMessage(args, responseData);
						break;

					// === Phase 8: Hero Upgrade Events ===
					// Reference: data/Models/HeroUpgradeModels.cs
					case 'heroUpgradeSkill':
						await this.upgradeTracker.trackHeroSkillUpgrade(args, responseData, await this._getPlayerId());
						break;
					case 'heroArtifactLevelUp':
						await this.upgradeTracker.trackHeroArtifactUpgrade(args, responseData, await this._getPlayerId());
						break;
					case 'heroSkinUpgrade':
						await this.upgradeTracker.trackHeroSkinUpgrade(args, responseData, await this._getPlayerId());
						break;
					case 'heroEnchantRune':
						await this.upgradeTracker.trackHeroGlyphUpgrade(args, responseData, await this._getPlayerId());
						break;
					case 'consumableUseHeroXp':
						await this.upgradeTracker.trackHeroLevelUpgrade(args, responseData, await this._getPlayerId());
						// Also track as inventory item usage (XP potion consumed)
						await this.trackInventoryItemUsage(args, responseData, 'potion', 'hero_level');
						break;
					case 'heroLevelUp':
						await this.upgradeTracker.trackHeroGoldLevelUpgrade(args, responseData, await this._getPlayerId());
						break;
					case 'heroEvolve':
					case 'heroPromote':
						await this.upgradeTracker.trackHeroStarUpgrade(args, responseData, await this._getPlayerId());
						break;
					case 'heroColorEvolve':
						await this.upgradeTracker.trackHeroColorUpgrade(args, responseData, await this._getPlayerId());
						break;
					case 'heroEquip':
						await this.upgradeTracker.trackEquipmentChange(args, responseData, await this._getPlayerId(), 'equipped');
						break;

					// === Phase 8: Titan Upgrade Events ===
					// Reference: data/Models/TitanUpgradeModels.cs
					case 'titanArtifactLevelUp':
						await this.upgradeTracker.trackTitanArtifactUpgrade(args, responseData, await this._getPlayerId());
						break;
					case 'titanUsePotions':
						await this.upgradeTracker.trackTitanLevelUpgrade(args, responseData, await this._getPlayerId());
						break;
					case 'titanEvolve':
					case 'titanStarUp':
						await this.upgradeTracker.trackTitanStarUpgrade(args, responseData, await this._getPlayerId());
						break;
					case 'titanUpgradeSkill':
						await this.upgradeTracker.trackTitanSkillUpgrade(args, responseData, await this._getPlayerId());
						break;
					case 'titanSkinUpgrade':
						await this.upgradeTracker.trackTitanSkinUpgrade(args, responseData, await this._getPlayerId());
						break;

					// === Phase 8: Daily Activity Events ===
					// Reference: data/Models/DailyActivityModels.cs
					case 'questFarm':
						await this.trackDailyQuestFarm(args, responseData);
						break;
					case 'quest_questsFarm':
						await this.trackBatchQuestFarm(args, responseData);
						break;
					case 'dailyBonusFarm':
						await this.trackLoginReward(args, responseData);
						break;
					case 'dailyBonusGetInfo':
						await this.trackDailyBonusInfo(responseData);
						break;

					// === Phase 10: Consumable Reward / Drop-Rate Tracking ===
					// Track rewards from opening all chest/consumable types so we can
					// compute empirical drop-rate percentages per item per source.
					case 'artifactChestOpen':
						await this.trackConsumableOpening(args, responseData, 'artifactChest');
						break;
					case 'titanArtifactChestOpen':
						await this.trackConsumableOpening(args, responseData, 'titanArtifactChest');
						break;
					case 'pet_chestOpen':
						await this.trackConsumableOpening(args, responseData, 'petChest');
						break;
					case 'consumableUseLootBox':
						await this.trackConsumableOpening(args, responseData, 'lootBox');
						break;
					case 'towerOpenChest':
						await this.trackConsumableOpening(args, responseData, 'towerChest');
						break;
					case 'bossOpenChestPay':
						await this.trackConsumableOpening(args, responseData, 'outlandChest');
						break;
				}
			} catch (error) {
				console.error(`[OrganizedJihad] Error processing ${callName}:`, error);
				await this._logError(`processAPIResponse:${callName}`, error);
			}
		}

		// Trigger periodic data snapshot
		try {
			await this.updateSnapshot();
		} catch (error) {
			console.error('[OrganizedJihad] Error in updateSnapshot:', error);
			await this._logError('updateSnapshot', error);
		}
	}

	/**
	 * Track player data from userGetInfo API call
	 * Now saves as a snapshot in IndexedDB
	 *
	 * @param {Object} data - Response from userGetInfo
	 * @private
	 */
	async trackPlayerData(data) {
		// Extract rank data from cached values or current response
		// Hero Wars API includes rank in various places depending on the call
		// See: https://community.hero-wars.com/discussion/arena-ranking-system
		const arenaRank = data.arenaRank || this.lastKnownArenaRank || 0;
		const grandArenaRank = data.grandArenaRank || this.lastKnownGrandArenaRank || 0;
		const titanArenaRank = data.titanArenaRank || this.lastKnownTitanArenaRank || 0;

		// ── Deduplication: skip if key fields unchanged since last call ───
		// userGetInfo fires on nearly every API batch, so this prevents
		// writing an identical snapshot row every few seconds.
		const playerKey = this._computeDataFingerprint([
			data.userId, data.level, data.vipLevel, data.power,
			data.gold, data.starmoney, data.clanId,
			arenaRank, grandArenaRank, titanArenaRank,
		]);
		if (playerKey === this._lastPlayerKey) {
			return; // Identical to previous snapshot — skip write
		}
		this._lastPlayerKey = playerKey;

		// Also cache the player ID for other tracker methods
		if (data.userId) {
			await this.storage.setMetadata('currentPlayerId', data.userId);
		}

		const snapshot = {
			playerId: data.userId,
			playerName: data.name || 'Unknown',
			level: data.level || 0,
			vipLevel: data.vipLevel || 0,
			teamPower: data.power || 0,
			gold: data.gold || 0,
			emeralds: data.starmoney || 0,
			guildName: data.clanTitle || null,
			guildId: data.clanId || null,
			arenaRank: arenaRank,
			grandArenaRank: grandArenaRank,
			titanArenaRank: titanArenaRank,
			titaniteDungeon: null, // Dungeon data comes from separate API call
			timestamp: new Date().toISOString(),
			rawData: JSON.stringify(data), // Store full data for future reference
		};

		await this.storage.add('snapshots', snapshot);
		console.log('[OrganizedJihad] Player snapshot saved:', snapshot.playerName, 'Level', snapshot.level);

		// Live activity event
		await this._logActivity('info', `Player snapshot: ${snapshot.playerName} (Lv${snapshot.level}, ${snapshot.gold?.toLocaleString()} gold, ${snapshot.emeralds?.toLocaleString()} emeralds)`);
	}

	/**
	 * Track heroes from heroGetAll API call
	 * Stores complete hero snapshots in IndexedDB (matches C# Hero entity)
	 *
	 * Entity Structure (19 properties):
	 * - Identity: HeroId, HeroName
	 * - Stats: Level, Stars, Color (rank), Power, Skins
	 * - Skills: SkillLevel1-4 (individual levels)
	 * - Artifacts: ArtifactWeapon, ArtifactBook, ArtifactRing (individual star levels)
	 * - Advanced: GlyphData (JSON)
	 * - Tracking: PlayerId, Timestamp
	 *
	 * @param {Object} data - Response from heroGetAll (object with hero IDs as keys)
	 * @private
	 */
	async trackHeroesData(data) {
		const playerId = (await this.storage.getMetadata('currentPlayerId')) || 'unknown';
		const timestamp = new Date().toISOString();

		// ── Deduplication: skip if hero roster hasn't changed ────────────
		// heroGetAll fires frequently; writing 50+ rows each time is
		// expensive when nothing has actually been upgraded.
		const heroFingerprint = this._computeDataFingerprint(
			Object.values(data).map((h) => [h.id, h.level, h.star, h.color, h.power])
		);
		if (heroFingerprint === this._lastHeroHash) {
			console.log('[OrganizedJihad] Heroes unchanged — skipping snapshot');
			return;
		}
		this._lastHeroHash = heroFingerprint;

		const heroes = Object.values(data).map((hero) => ({
			heroId: hero.id,
			heroName: hero.name || `Hero_${hero.id}`,
			level: hero.level || 0,
			stars: hero.star || 0,
			color: hero.color || 0, // Rank/promotion (0=gray, 1=green, 2=blue, 3=blue+1, 4=blue+2, 5=violet, 6=violet+1, etc.)
			power: hero.power || 0,
			skins: hero.skins || 0, // Total skins unlocked
			// Individual skill levels (Hero Wars has 4 skills per hero)
			skillLevel1: hero.skills?.skill1?.level || hero.skills?.[0]?.level || 0,
			skillLevel2: hero.skills?.skill2?.level || hero.skills?.[1]?.level || 0,
			skillLevel3: hero.skills?.skill3?.level || hero.skills?.[2]?.level || 0,
			skillLevel4: hero.skills?.skill4?.level || hero.skills?.[3]?.level || 0,
			// Individual artifact star levels (0-6 stars each)
			artifactWeapon: hero.artifacts?.[0]?.star || hero.artifacts?.[0]?.level || 0,
			artifactBook: hero.artifacts?.[1]?.star || hero.artifacts?.[1]?.level || 0,
			artifactRing: hero.artifacts?.[2]?.star || hero.artifacts?.[2]?.level || 0,
			// Glyph data (complex nested structure - store as JSON)
			glyphData: JSON.stringify(hero.glyphs || {}),
			playerId: playerId,
			timestamp: timestamp,
		}));

		// Store each hero snapshot in IndexedDB heroes store
		for (const hero of heroes) {
			await this.storage.add('heroes', hero);
		}

		console.log(`[OrganizedJihad] Heroes tracked: ${heroes.length} heroes stored as snapshots`);

		// Live activity event
		const topHero = heroes.reduce((best, h) => (h.power > (best?.power || 0) ? h : best), null);
		await this._logActivity('hero', `Hero roster captured: ${heroes.length} heroes (top: ${topHero?.heroName || '?'} at ${topHero?.power?.toLocaleString() || 0} power)`);
	}

	/**
	 * Track inventory from inventoryGet API call
	 * Stores complete inventory snapshot in IndexedDB (matches C# InventorySnapshot entity)
	 *
	 * Entity Structure (9 properties):
	 * - InventoryData: Complete JSON structure
	 * - Denormalized counts: TotalHeroSoulStones, TotalTitanSoulStones, TotalPetSoulStones,
	 *   TotalEvolutionItems, TotalConsumables, TotalChests
	 * - Tracking: PlayerId, Timestamp
	 *
	 * @param {Object} data - Response from inventoryGet
	 * @private
	 */
	async trackInventoryData(data) {
		const playerId = (await this.storage.getMetadata('currentPlayerId')) || 'unknown';
		const timestamp = new Date().toISOString();

		// Calculate denormalized totals for performance
		const fragmentHero = data.fragmentHero || {};
		const fragmentTitan = data.fragmentTitan || {};
		const fragmentPet = data.fragmentPet || {};
		const consumable = data.consumable || {};
		const gear = data.gear || {};

		const totalHeroSoulStones = Object.values(fragmentHero).reduce((sum, count) => sum + (count || 0), 0);
		const totalTitanSoulStones = Object.values(fragmentTitan).reduce((sum, count) => sum + (count || 0), 0);
		const totalPetSoulStones = Object.values(fragmentPet).reduce((sum, count) => sum + (count || 0), 0);
		const totalEvolutionItems = Object.values(gear).reduce((sum, count) => sum + (count || 0), 0);
		const totalConsumables = Object.values(consumable).reduce((sum, count) => sum + (count || 0), 0);

		// Count chests (usually in consumable with specific IDs)
		const chestIds = Object.keys(consumable).filter((key) => key.includes('chest') || key.includes('box'));
		const totalChests = chestIds.reduce((sum, id) => sum + (consumable[id] || 0), 0);

		// ── Deduplication: skip if inventory totals haven't changed ──────
		const inventoryFingerprint = this._computeDataFingerprint([
			totalHeroSoulStones, totalTitanSoulStones, totalPetSoulStones,
			totalEvolutionItems, totalConsumables, totalChests,
		]);
		if (inventoryFingerprint === this._lastInventoryHash) {
			console.log('[OrganizedJihad] Inventory unchanged — skipping snapshot');
			return;
		}
		this._lastInventoryHash = inventoryFingerprint;

		const inventorySnapshot = {
			inventoryData: JSON.stringify(data), // Store complete raw data
			totalHeroSoulStones,
			totalTitanSoulStones,
			totalPetSoulStones,
			totalEvolutionItems,
			totalConsumables,
			totalChests,
			playerId: playerId,
			timestamp: timestamp,
		};

		// Store snapshot in IndexedDB inventory store
		await this.storage.add('inventory', inventorySnapshot);

		console.log(
			`[OrganizedJihad] Inventory tracked: ${totalHeroSoulStones} hero souls, ${totalTitanSoulStones} titan souls, ${totalPetSoulStones} pet souls, ${totalConsumables} consumables`
		);

		// Live activity event
		const totalItems = totalHeroSoulStones + totalTitanSoulStones + totalPetSoulStones + totalConsumables;
		await this._logActivity('info', `Inventory snapshot: ${totalItems.toLocaleString()} items tracked`);
	}

	/**
	 * Track titans from titanGetAll API call
	 * Stores complete titan snapshots in IndexedDB (matches C# Titan entity)
	 *
	 * Entity Structure (12 properties):
	 * - Identity: TitanId, TitanName
	 * - Stats: Level, Stars, Power, Element (fire/water/earth), SkinLevel
	 * - Skills: SkillLevel (single main skill)
	 * - Artifacts: ArtifactData (JSON - titans have different artifact system)
	 * - Special: SummonStars
	 * - Tracking: PlayerId, Timestamp
	 *
	 * @param {Object} data - Response from titanGetAll (object with titan IDs as keys)
	 * @private
	 */
	async trackTitansData(data) {
		const playerId = (await this.storage.getMetadata('currentPlayerId')) || 'unknown';
		const timestamp = new Date().toISOString();

		const titans = Object.values(data).map((titan) => ({
			titanId: titan.id,
			titanName: titan.name || `Titan_${titan.id}`,
			level: titan.level || 0,
			stars: titan.star || 0,
			power: titan.power || 0,
			skillLevel: titan.skill?.level || titan.skillLevel || 0, // Titans have one main skill
			artifactData: JSON.stringify(titan.artifacts || {}), // Titan artifacts are different from heroes
			summonStars: titan.summonStars || 0, // Special titan mechanic
			element: titan.element || titan.type || 'unknown', // fire, water, earth
			skinLevel: titan.skinLevel || 0,
			playerId: playerId,
			timestamp: timestamp,
		}));

		// Store each titan snapshot in IndexedDB titans store
		for (const titan of titans) {
			await this.storage.add('titans', titan);
		}

		console.log(`[OrganizedJihad] Titans tracked: ${titans.length} titans stored as snapshots`);
	}

	/**
	 * Track pets from petGetAll API call
	 * Stores complete pet snapshots in IndexedDB (matches C# Pet entity)
	 *
	 * Entity Structure (8 properties):
	 * - Identity: PetId, PetName
	 * - Stats: Stars, Power, Level
	 * - Special: PatronageData (JSON - which heroes the pet supports)
	 * - Tracking: PlayerId, Timestamp
	 *
	 * @param {Object} data - Response from petGetAll (object with pet IDs as keys)
	 * @private
	 */
	async trackPetsData(data) {
		const playerId = (await this.storage.getMetadata('currentPlayerId')) || 'unknown';
		const timestamp = new Date().toISOString();

		const pets = Object.values(data).map((pet) => ({
			petId: pet.id,
			petName: pet.name || `Pet_${pet.id}`,
			stars: pet.star || 0,
			power: pet.power || 0,
			level: pet.level || 0,
			patronageData: JSON.stringify(pet.patronage || {}), // Which heroes this pet supports
			playerId: playerId,
			timestamp: timestamp,
		}));

		// Store each pet snapshot in IndexedDB pets store
		for (const pet of pets) {
			await this.storage.add('pets', pet);
		}

		console.log(`[OrganizedJihad] Pets tracked: ${pets.length} pets stored as snapshots`);
	}

	/**
	 * Track battle results from various battle end API calls
	 *
	 * @param {string} battleType - Type of battle (missionEnd, towerEnd, etc)
	 * @param {Object} args - Battle request arguments
	 * @param {Object} data - Battle result data
	 * @private
	 */
	async trackBattleResult(battleType, args, data) {
		const battleRecord = {
			type: battleType.replace('End', ''),
			result: data.result?.win ? 'victory' : 'defeat',
			reward: data.reward || {},
			timestamp: Date.now(),
			mission: args.mission || args.id || 'unknown',
		};

		const battleHistory = await this.storage.getMetadata('battleHistory', []);
		battleHistory.push(battleRecord);

		// Keep last 1000 battles
		if (battleHistory.length > 1000) {
			battleHistory.shift();
		}

		await this.storage.setMetadata('battleHistory', battleHistory);
	}

	/**
	 * Track arena enemies for matchmaking analysis
	 *
	 * @param {Object} data - Arena enemies data
	 * @private
	 */
	async trackArenaEnemies(data) {
		if (!data.enemies) return;

		// Extract and cache player's current arena rank if present
		// Arena API calls include user rank: https://community.hero-wars.com/discussion/arena-api
		if (data.user?.arenaRank) {
			this.lastKnownArenaRank = data.user.arenaRank;
		}

		const timestamp = Date.now();
		const enemies = data.enemies.map((enemy) => ({
			userId: enemy.userId,
			name: enemy.name,
			level: enemy.level,
			power: this.calculateTeamPower(enemy.heroes),
			heroes: this.compressHeroTeam(enemy.heroes),
			timestamp,
		}));

		// Store current arena enemies
		await this.storage.setMetadata('arenaEnemies', enemies);

		// Track historical arena encounters
		const encounterHistory = (await this.storage.getMetadata('arenaEncounterHistory', [])).concat(
			enemies.map((e) => ({ ...e, encounter: 'available' }))
		);

		// Keep last 500 encounters
		if (encounterHistory.length > 500) {
			encounterHistory.splice(0, encounterHistory.length - 500);
		}

		await this.storage.setMetadata('arenaEncounterHistory', encounterHistory);
	}

	/**
	 * Track arena battle results with opponent and team composition
	 * Stores in battles IndexedDB store with battleType='Arena'
	 *
	 * @param {Object} args - Battle request arguments
	 * @param {Object} data - Battle result data
	 * @private
	 */
	async trackArenaBattle(args, data) {
		const battle = {
			battleType: 'Arena',
			opponentId: args.enemyUserId,
			opponentName: null, // Will be filled from opponents tracking
			isWin: data.result?.win || false,
			playerPower: data.attackers ? this.calculateTeamPower(data.attackers) : 0,
			opponentPower: data.defenders ? this.calculateTeamPower(data.defenders) : 0,
			playerHeroes: data.attackers ? JSON.stringify(this.compressHeroTeam(data.attackers)) : null,
			opponentHeroes: data.defenders ? JSON.stringify(this.compressHeroTeam(data.defenders)) : null,
			rewards: data.reward ? JSON.stringify(data.reward) : null,
			timestamp: new Date().toISOString(),
		};

		await this.storage.add('battles', battle);

		// Live activity event
		await this._logActivity('battle', `Arena ${battle.isWin ? 'WIN' : 'LOSS'} vs opponent #${battle.opponentId || '?'}`, { isWin: battle.isWin });

		// Update opponent record
		await this.updateOpponentRecord(args.enemyUserId, 'Arena', battle.isWin);

		// Track resource rewards from arena battle
		// Hero Wars arena rewards: gold, arena tokens, and sometimes emeralds
		// See: https://community.hero-wars.com/discussion/arena-rewards-system
		const rewards = data.reward || {};
		if (rewards.gold) {
			await this.trackResourceTransaction('gold', rewards.gold, 'battle', 'arena');
		}
		if (rewards.arenaToken) {
			await this.trackResourceTransaction('arena_coins', rewards.arenaToken, 'battle', 'arena');
		}
		if (rewards.starmoney) {
			await this.trackResourceTransaction('emeralds', rewards.starmoney, 'battle', 'arena');
		}
	}

	/**
	 * Track Titan Arena enemies
	 *
	 * @param {Object} data - Titan arena enemies data
	 * @private
	 */
	async trackTitanArenaEnemies(data) {
		if (!data.enemies) return;

		// Extract and cache player's current Titan Arena rank if present
		// Titan Arena structure includes user.titanArenaRank
		if (data.user?.titanArenaRank) {
			this.lastKnownTitanArenaRank = data.user.titanArenaRank;
		}

		const timestamp = Date.now();
		const enemies = data.enemies.map((enemy) => ({
			userId: enemy.userId,
			name: enemy.name,
			level: enemy.level,
			power: this.calculateTeamPower(enemy.titans),
			titans: this.compressHeroTeam(enemy.titans),
			timestamp,
		}));

		await this.storage.setMetadata('titanArenaEnemies', enemies);
	}

	/**
	 * Track Titan Arena battle results
	 * Stores in battles IndexedDB store with battleType='TitanArena'
	 *
	 * @param {Object} args - Battle request arguments
	 * @param {Object} data - Battle result data
	 * @private
	 */
	async trackTitanArenaBattle(args, data) {
		const battle = {
			battleType: 'TitanArena',
			opponentId: args.enemyUserId,
			opponentName: null,
			isWin: data.result?.win || false,
			playerPower: data.attackers ? this.calculateTeamPower(data.attackers) : 0,
			opponentPower: data.defenders ? this.calculateTeamPower(data.defenders) : 0,
			playerHeroes: data.attackers ? JSON.stringify(this.compressHeroTeam(data.attackers)) : null,
			opponentHeroes: data.defenders ? JSON.stringify(this.compressHeroTeam(data.defenders)) : null,
			rewards: data.reward ? JSON.stringify(data.reward) : null,
			timestamp: new Date().toISOString(),
		};

		await this.storage.add('battles', battle);
		await this.updateOpponentRecord(args.enemyUserId, 'TitanArena', battle.isWin);

		// Live activity event
		await this._logActivity('battle', `Titan Arena ${battle.isWin ? 'WIN' : 'LOSS'} vs opponent #${battle.opponentId || '?'}`, { isWin: battle.isWin });

		// Track resource rewards from titan arena battle
		// Titan Arena rewards: gold, titan tokens/potions
		const rewards = data.reward || {};
		if (rewards.gold) {
			await this.trackResourceTransaction('gold', rewards.gold, 'battle', 'titan_arena');
		}
		if (rewards.titanPotion) {
			await this.trackResourceTransaction('titan_potion', rewards.titanPotion, 'battle', 'titan_arena');
		}
		if (rewards.starmoney) {
			await this.trackResourceTransaction('emeralds', rewards.starmoney, 'battle', 'titan_arena');
		}
	}

	/**
	 * Track Grand Arena enemies
	 *
	 * @param {Object} data - Grand arena enemies data
	 * @private
	 */
	async trackGrandArenaEnemies(data) {
		if (!data.enemies) return;

		// Extract and cache player's current Grand Arena rank if present
		// Grand Arena uses similar API structure with user.grandArenaRank
		if (data.user?.grandArenaRank) {
			this.lastKnownGrandArenaRank = data.user.grandArenaRank;
		}

		const timestamp = Date.now();
		const enemies = data.enemies.map((enemy) => ({
			userId: enemy.userId,
			name: enemy.name,
			level: enemy.level,
			teams: enemy.teams
				? enemy.teams.map((team) => ({
						power: this.calculateTeamPower(team.heroes),
						heroes: this.compressHeroTeam(team.heroes),
					}))
				: [],
			timestamp,
		}));

		await this.storage.setMetadata('grandArenaEnemies', enemies);
	}

	/**
	 * Track Grand Arena battle results (3 teams vs 3 teams)
	 * Stores in battles IndexedDB store with battleType='GrandArena'
	 *
	 * @param {Object} args - Battle request arguments
	 * @param {Object} data - Battle result data
	 * @private
	 */
	async trackGrandArenaBattle(args, data) {
		const battle = {
			battleType: 'GrandArena',
			opponentId: args.enemyUserId,
			opponentName: null,
			isWin: data.result?.win || false,
			playerPower: 0, // Grand arena has multiple teams
			opponentPower: 0,
			playerHeroes: data.battles
				? JSON.stringify(data.battles.map((b) => this.compressHeroTeam(b.attackers)))
				: null,
			opponentHeroes: data.battles
				? JSON.stringify(data.battles.map((b) => this.compressHeroTeam(b.defenders)))
				: null,
			rewards: data.reward ? JSON.stringify(data.reward) : null,
			timestamp: new Date().toISOString(),
		};

		await this.storage.add('battles', battle);
		await this.updateOpponentRecord(args.enemyUserId, 'GrandArena', battle.isWin);

		// Live activity event
		await this._logActivity('battle', `Grand Arena ${battle.isWin ? 'WIN' : 'LOSS'} vs opponent #${battle.opponentId || '?'}`, { isWin: battle.isWin });

		// Track resource rewards from grand arena battle
		// Grand Arena rewards: gold, trophies, sometimes emeralds
		const rewards = data.reward || {};
		if (rewards.gold) {
			await this.trackResourceTransaction('gold', rewards.gold, 'battle', 'grand_arena');
		}
		if (rewards.grandArenaTrophy) {
			await this.trackResourceTransaction(
				'grand_arena_trophies',
				rewards.grandArenaTrophy,
				'battle',
				'grand_arena'
			);
		}
		if (rewards.starmoney) {
			await this.trackResourceTransaction('emeralds', rewards.starmoney, 'battle', 'grand_arena');
		}
	}

	/**
	 * Track Guild War information
	 *
	 * @param {Object} data - Guild war data
	 * @private
	 */
	async trackGuildWarInfo(data) {
		const warData = {
			warId: data.warId || data.war?.id,
			enemyGuildId: data.enemyClanId || data.enemyClan?.id,
			enemyGuildName: data.enemyClanName || data.enemyClan?.name,
			myGuildScore: data.myScore || 0,
			enemyScore: data.enemyScore || 0,
			defenders: data.defenders || {},
			attackers: data.attackers || {},
			timestamp: Date.now(),
		};

		await this.storage.setMetadata('currentGuildWar', warData);
	}

	/**
	 * Track Guild War battle results
	 *
	 * @param {Object} args - Battle request arguments
	 * @param {Object} data - Battle result data
	 * @private
	 */
	async trackGuildWarBattle(args, data) {
		const battleRecord = {
			type: 'guildWar',
			defenderId: args.defenderId,
			fortId: args.fortId,
			result: data.result?.win ? 'victory' : 'defeat',
			myTeam: data.attackers ? this.compressHeroTeam(data.attackers) : null,
			enemyTeam: data.defenders ? this.compressHeroTeam(data.defenders) : null,
			reward: data.reward || {},
			timestamp: Date.now(),
		};

		const guildWarHistory = await this.storage.getMetadata('guildWarBattleHistory', []);
		guildWarHistory.push(battleRecord);

		if (guildWarHistory.length > 500) {
			guildWarHistory.shift();
		}

		await this.storage.setMetadata('guildWarBattleHistory', guildWarHistory);

		// Live activity event
		const isWin = data.result?.win || false;
		await this._logActivity('battle', `Guild War ${isWin ? 'WIN' : 'LOSS'} at fort #${args.fortId || '?'}`, { isWin });

		// Track guild activity for guild war participation
		// Hero Wars guild wars are major guild events
		// See: https://community.hero-wars.com/discussion/guild-war-guide
		const guildData = await this.storage.getMetadata('guildData', {});
		await this.trackGuildActivity('war', {
			guildId: guildData.id || 'unknown',
			guildName: guildData.name || 'Unknown Guild',
			fortId: args.fortId,
			result: battleRecord.result,
			damage: data.damage || 0,
		});

		// Track resource rewards from guild war
		const rewards = data.reward || {};
		if (rewards.gold) {
			await this.trackResourceTransaction('gold', rewards.gold, 'battle', 'guild_war');
		}
		if (rewards.guildWarToken) {
			await this.trackResourceTransaction('guild_war_coins', rewards.guildWarToken, 'battle', 'guild_war');
		}
		if (rewards.starmoney) {
			await this.trackResourceTransaction('emeralds', rewards.starmoney, 'battle', 'guild_war');
		}
	}

	/**
	 * Track Raid Boss information
	 *
	 * @param {Object} data - Raid boss data
	 * @private
	 */
	async trackRaidBossInfo(data) {
		const bossData = {
			bossId: data.bossId || data.boss?.id,
			bossLevel: data.bossLevel || data.boss?.level,
			bossHealth: data.bossHealth || data.boss?.health,
			maxHealth: data.maxHealth || data.boss?.maxHealth,
			myDamage: data.myDamage || 0,
			totalDamage: data.totalDamage || 0,
			timestamp: Date.now(),
		};

		await this.storage.setMetadata('currentRaidBoss', bossData);
	}

	/**
	 * Track Raid Boss attacks for damage analysis
	 *
	 * @param {Object} args - Attack request arguments
	 * @param {Object} data - Attack result data
	 * @private
	 */
	async trackRaidBossAttack(args, data) {
		const attackRecord = {
			bossId: args.bossId,
			damage: data.damage || 0,
			myTeam: data.attackers ? this.compressHeroTeam(data.attackers) : null,
			reward: data.reward || {},
			timestamp: Date.now(),
		};

		const raidHistory = await this.storage.getMetadata('raidBossAttackHistory', []);
		raidHistory.push(attackRecord);

		if (raidHistory.length > 500) {
			raidHistory.shift();
		}

		await this.storage.setMetadata('raidBossAttackHistory', raidHistory);

		// Track guild activity for raid boss attacks
		// Guild raids are cooperative PvE events
		// See: https://community.hero-wars.com/discussion/guild-raid-boss-guide
		const guildData = await this.storage.getMetadata('guildData', {});
		await this.trackGuildActivity('raid', {
			guildId: guildData.id || 'unknown',
			guildName: guildData.name || 'Unknown Guild',
			bossId: args.bossId,
			damage: data.damage || 0,
		});

		// Track resource rewards from raid boss
		const rewards = data.reward || {};
		if (rewards.gold) {
			await this.trackResourceTransaction('gold', rewards.gold, 'battle', 'guild_raid');
		}
		if (rewards.guildToken || rewards.clanToken) {
			await this.trackResourceTransaction(
				'guild_coins',
				rewards.guildToken || rewards.clanToken,
				'battle',
				'guild_raid'
			);
		}
		if (rewards.starmoney) {
			await this.trackResourceTransaction('emeralds', rewards.starmoney, 'battle', 'guild_raid');
		}
	}

	/**
	 * Track chest openings for drop rate analysis.
	 * Writes to both the `chests` IDB store AND metadata cache.
	 * Individual drops are recorded in `consumableRewards`.
	 * THIS IS KEY FOR UNDERSTANDING LOOT PROBABILITIES
	 *
	 * @param {Object} args - Chest opening arguments
	 * @param {Object} data - Chest rewards data
	 * @private
	 */
	async trackChestOpening(args, data) {
		await this.trackConsumableOpening(args, data, 'genericChest');
	}

	/**
	 * Unified handler for all consumable/chest opening types.
	 * Records the opening in the `chests` IDB store, extracts individual
	 * drops to `consumableRewards`, updates aggregated drop-rate metadata,
	 * and tracks known resource rewards as resource transactions.
	 *
	 * Supported sourceTypes:
	 *   genericChest, artifactChest, titanArtifactChest, petChest,
	 *   lootBox, towerChest, outlandChest
	 *
	 * @param {Object} args         - Request arguments (chestId, id, libId, amount, etc.)
	 * @param {Object} data         - Response data containing rewards
	 * @param {string} sourceType   - Consumable category key
	 * @private
	 */
	async trackConsumableOpening(args, data, sourceType) {
		const timestamp = Date.now();
		const sourceId = String(args.chestId || args.id || args.libId || 'unknown');
		const quantity = args.amount || 1;

		// Normalise the rewards from the varied game API formats
		const drops = this._normalizeRewards(data);

		// ── 1. Write to chests IDB store ────────────────────────────────
		const chestRecord = {
			chestType: sourceType,
			sourceId,
			quantity,
			dropCount: drops.length,
			timestamp,
		};

		let openingId = null;
		try {
			openingId = await this.storage.add('chests', chestRecord);
		} catch (err) {
			console.warn('[OrganizedJihad] Failed to write chest record:', err);
		}

		// ── 2. Write individual drops to consumableRewards ──────────────
		for (const drop of drops) {
			try {
				await this.storage.add('consumableRewards', {
					timestamp,
					sourceType,
					sourceId,
					itemType: drop.itemType,
					itemId: String(drop.itemId),
					quantity: drop.quantity,
					openingId: openingId || 0,
				});
			} catch (err) {
				console.warn('[OrganizedJihad] Failed to write drop record:', err);
			}
		}

		// ── 3. Mirror to metadata cache (for backward compat) ───────────
		try {
			const chestHistory = await this.storage.getMetadata('chestOpeningHistory', []);
			chestHistory.push({
				chestId: sourceId,
				chestType: sourceType,
				quantity,
				rewards: drops,
				timestamp,
			});
			if (chestHistory.length > 1000) chestHistory.shift();
			await this.storage.setMetadata('chestOpeningHistory', chestHistory);
		} catch { /* non-critical */ }

		// ── 4. Live activity event ──────────────────────────────────────
		const typeLabel = this._sourceTypeLabel(sourceType);
		await this._logActivity('chest', `${typeLabel} opened: ${sourceId} (${quantity}x, ${drops.length} drops)`);

		// ── 5. Update aggregated drop-rate statistics ────────────────────
		await this.updateChestDropRates({
			chestType: sourceType,
			chestId: sourceId,
			quantity,
			rewards: drops,
		});

		// ── 6. Track resource rewards as resource transactions ──────────
		const chestName = `${sourceType}_${sourceId}`;
		for (const drop of drops) {
			if (drop.itemType === 'gold') {
				await this.trackResourceTransaction('gold', drop.quantity, 'chest', chestName);
			} else if (drop.itemType === 'starmoney') {
				await this.trackResourceTransaction('emeralds', drop.quantity, 'chest', chestName);
			} else if (drop.itemType === 'coin') {
				// Coin subtypes: 3 = arena, 4 = outland, 5 = tower, 7 = skull
				const coinNames = { '3': 'arena_coins', '4': 'outland_coins', '5': 'tower_coins', '7': 'skull_coins' };
				const resName = coinNames[drop.itemId] || `coin_${drop.itemId}`;
				await this.trackResourceTransaction(resName, drop.quantity, 'chest', chestName);
			}
		}
	}

	/**
	 * Normalise game API reward data into a flat array of drop records.
	 *
	 * The game uses several reward formats depending on the API call:
	 *
	 * 1. **Category-keyed object** (most common):
	 *    `{ consumable: {45: 1}, gold: 500, gear: {123: 2} }`
	 *
	 * 2. **Array of category-keyed objects** (artifact/titan chests):
	 *    `[{consumable: {45: 1}}, {fragmentHero: {12: 50}}]`
	 *    Also used as `data.chestReward`, `data.reward`, `data.rewards`
	 *
	 * 3. **Nested count-keyed** (consumableUseLootBox):
	 *    `{ 500: { consumable: {362: 1}, gear: {55: 3} } }`
	 *    The outer key is the gold reward count.
	 *
	 * 4. **Tower chest** (towerOpenChest):
	 *    `{ skullReward: { coin: {7: 150} } }`
	 *
	 * Returns a flat array: `[{ itemType, itemId, quantity }, ...]`
	 *
	 * @param {Object} data - Raw response data
	 * @returns {Array<{itemType: string, itemId: string, quantity: number}>}
	 * @private
	 */
	_normalizeRewards(data) {
		if (!data || typeof data !== 'object') return [];

		const drops = [];

		// Determine where the rewards live in the response
		const sources = [];
		if (data.chestReward) sources.push(data.chestReward);
		if (data.reward) sources.push(data.reward);
		if (data.rewards) sources.push(data.rewards);
		if (data.skullReward) sources.push(data.skullReward);

		// If none of the known keys match, treat the whole response as rewards
		if (sources.length === 0) sources.push(data);

		for (const src of sources) {
			this._extractDrops(src, drops);
		}

		return drops;
	}

	/**
	 * Recursively extract drop records from a reward structure.
	 * Handles objects, arrays, and nested count-keyed formats.
	 *
	 * Known category keys: consumable, gear, coin, gold, starmoney,
	 * fragmentHero, fragmentTitan, petCard, titanCard, scroll,
	 * artifact, titanArtifact, skinStone, titanSkinStone
	 *
	 * @param {any} source - Reward data (object, array, or primitive)
	 * @param {Array} drops - Accumulator array
	 * @private
	 */
	_extractDrops(source, drops) {
		if (!source || typeof source !== 'object') return;

		// Array → extract each element
		if (Array.isArray(source)) {
			for (const item of source) {
				this._extractDrops(item, drops);
			}
			return;
		}

		// Known scalar resource keys (value is the quantity directly)
		const scalarKeys = new Set(['gold', 'starmoney', 'experience', 'stamina', 'titanExp']);

		// Known category keys (value is { itemId: quantity, ... })
		const categoryKeys = new Set([
			'consumable', 'gear', 'coin', 'fragmentHero', 'fragmentTitan',
			'petCard', 'titanCard', 'scroll', 'artifact', 'titanArtifact',
			'skinStone', 'titanSkinStone', 'heroSoulStone', 'titanSoulStone',
		]);

		let hasKnownKey = false;

		for (const [key, value] of Object.entries(source)) {
			if (scalarKeys.has(key) && typeof value === 'number') {
				drops.push({ itemType: key, itemId: key, quantity: value });
				hasKnownKey = true;
			} else if (categoryKeys.has(key) && typeof value === 'object' && value !== null) {
				hasKnownKey = true;
				for (const [itemId, qty] of Object.entries(value)) {
					drops.push({
						itemType: key,
						itemId: String(itemId),
						quantity: typeof qty === 'number' ? qty : 1,
					});
				}
			}
		}

		// If no known keys matched, this might be a count-keyed wrapper like
		// { 500: { consumable: {...} } } — recurse into numeric-keyed values.
		if (!hasKnownKey) {
			for (const [key, value] of Object.entries(source)) {
				if (typeof value === 'object' && value !== null && /^\d+$/.test(key)) {
					this._extractDrops(value, drops);
				}
			}
		}
	}

	/**
	 * Return a human-readable label for a consumable source type.
	 *
	 * @param {string} sourceType - Source type key
	 * @returns {string} Display label
	 * @private
	 */
	_sourceTypeLabel(sourceType) {
		const labels = {
			genericChest: 'Chest',
			artifactChest: 'Artifact Chest',
			titanArtifactChest: 'Titan Artifact Chest',
			petChest: 'Pet Chest',
			lootBox: 'Loot Box',
			towerChest: 'Tower Chest',
			outlandChest: 'Outland Chest',
		};
		return labels[sourceType] || sourceType;
	}

	/**
	 * Update aggregated chest drop rate statistics in metadata.
	 * Tracks per-chest-type open counts and per-item drop counts/totals.
	 *
	 * @param {Object} chestRecord - Record with chestType, chestId, quantity, rewards[]
	 * @private
	 */
	async updateChestDropRates(chestRecord) {
		const dropRates = await this.storage.getMetadata('chestDropRates', {});
		const chestKey = `${chestRecord.chestType}_${chestRecord.chestId}`;

		if (!dropRates[chestKey]) {
			dropRates[chestKey] = {
				chestType: chestRecord.chestType,
				chestId: chestRecord.chestId,
				openCount: 0,
				itemDrops: {},
			};
		}

		dropRates[chestKey].openCount += chestRecord.quantity;

		// Count each normalised drop
		if (Array.isArray(chestRecord.rewards)) {
			for (const drop of chestRecord.rewards) {
				const itemKey = `${drop.itemType}_${drop.itemId}`;
				if (!dropRates[chestKey].itemDrops[itemKey]) {
					dropRates[chestKey].itemDrops[itemKey] = {
						type: drop.itemType,
						id: drop.itemId,
						name: drop.itemName || itemKey,
						dropCount: 0,
						totalAmount: 0,
					};
				}
				dropRates[chestKey].itemDrops[itemKey].dropCount += 1;
				dropRates[chestKey].itemDrops[itemKey].totalAmount += drop.quantity || 1;
			}
		}

		await this.storage.setMetadata('chestDropRates', dropRates);
	}

	/**
	 * Track shop purchases for spending analysis
	 *
	 * @param {Object} args - Purchase arguments
	 * @param {Object} data - Purchase result data
	 * @private
	 */
	async trackShopPurchase(args, data) {
		const playerId = (await this.storage.getMetadata('currentPlayerId')) || 'unknown';
		const purchasedAt = new Date().toISOString();

		const purchase = {
			purchasedAt: purchasedAt,
			shopType: args.shopType || args.shopId || 'unknown', // arena, guild, tower, merchant, etc.
			itemId: args.itemId || 'unknown',
			itemName: data.itemName || args.itemName || `Item_${args.itemId}`,
			quantity: args.quantity || args.count || 1,
			costType: args.costType || Object.keys(args.cost || {})[0] || 'unknown', // gold, emeralds, trophies, etc.
			costAmount: args.costAmount || Object.values(args.cost || {})[0] || 0,
			playerId: playerId,
		};

		await this.storage.add('shopPurchases', purchase);
		console.log(`[OrganizedJihad] Shop purchase tracked: ${purchase.itemName} from ${purchase.shopType}`);

		// Track resource cost as negative transaction (spending)
		// Hero Wars shop costs can be gold, emeralds, arena coins, guild war coins, etc.
		// See: https://community.hero-wars.com/discussion/shop-currency-guide
		const cost = args.cost || {};
		const shopName = `${purchase.shopType}_shop`;

		if (cost.gold || (purchase.costType === 'gold' && purchase.costAmount > 0)) {
			await this.trackResourceTransaction('gold', -(cost.gold || purchase.costAmount), 'shop', shopName);
		}
		if (cost.starmoney || (purchase.costType === 'emeralds' && purchase.costAmount > 0)) {
			await this.trackResourceTransaction('emeralds', -(cost.starmoney || purchase.costAmount), 'shop', shopName);
		}
		if (cost.arenaToken || (purchase.costType === 'arena_coins' && purchase.costAmount > 0)) {
			await this.trackResourceTransaction(
				'arena_coins',
				-(cost.arenaToken || purchase.costAmount),
				'shop',
				shopName
			);
		}
		if (cost.guildWarToken || (purchase.costType === 'guild_war_coins' && purchase.costAmount > 0)) {
			await this.trackResourceTransaction(
				'guild_war_coins',
				-(cost.guildWarToken || purchase.costAmount),
				'shop',
				shopName
			);
		}
		if (cost.titanPotion || (purchase.costType === 'titan_potion' && purchase.costAmount > 0)) {
			await this.trackResourceTransaction(
				'titan_potion',
				-(cost.titanPotion || purchase.costAmount),
				'shop',
				shopName
			);
		}
	}

	/**
	 * Track quest completions
	 * Stores quest completion records in IndexedDB (matches C# QuestCompletion entity)
	 *
	 * Entity Structure (7 properties):
	 * - CompletedAt, QuestType (daily/weekly/event), QuestId, QuestName, RewardData (JSON), PlayerId
	 *
	 * @param {Object} args - Quest completion arguments
	 * @param {Object} data - Quest reward data
	 * @private
	 */
	async trackQuestComplete(args, data) {
		const playerId = (await this.storage.getMetadata('currentPlayerId')) || 'unknown';
		const completedAt = new Date().toISOString();

		const quest = {
			completedAt: completedAt,
			questType: args.questType || 'daily', // daily, weekly, event
			questId: args.questId || 'unknown',
			questName: args.questName || data.questName || `Quest_${args.questId}`,
			rewardData: JSON.stringify(data.reward || data.rewards || {}),
			playerId: playerId,
		};

		await this.storage.add('questCompletions', quest);
		console.log(`[OrganizedJihad] Quest completed: ${quest.questName} (${quest.questType})`);

		// Track resource rewards from quest completion
		// Hero Wars quest rewards format: {gold: 1000, starmoney: 50, exp: 100, ...}
		// See: https://community.hero-wars.com/discussion/quest-rewards-guide
		const rewards = data.reward || data.rewards || {};
		if (rewards.gold) {
			await this.trackResourceTransaction('gold', rewards.gold, 'quest', quest.questName);
		}
		if (rewards.starmoney) {
			await this.trackResourceTransaction('emeralds', rewards.starmoney, 'quest', quest.questName);
		}
		if (rewards.arenaToken) {
			await this.trackResourceTransaction('arena_coins', rewards.arenaToken, 'quest', quest.questName);
		}
		if (rewards.guildWarToken) {
			await this.trackResourceTransaction('guild_war_coins', rewards.guildWarToken, 'quest', quest.questName);
		}
		if (rewards.titanPotion) {
			await this.trackResourceTransaction('titan_potion', rewards.titanPotion, 'quest', quest.questName);
		}
	}

	/**
	 * Track expedition state
	 *
	 * @param {Object} data - Expedition data
	 * @private
	 */
	async trackExpeditionState(data) {
		const expeditionData = {
			currentNode: data.currentNode || 0,
			progress: data.progress || 0,
			rewards: data.rewards || [],
			timestamp: Date.now(),
		};

		await this.storage.setMetadata('expeditionState', expeditionData);
	}

	/**
	 * Track expedition battles (PvE boss fights)
	 * Stores expedition battle records in IndexedDB (matches C# ExpeditionBattle entity)
	 *
	 * Entity Structure (10 properties):
	 * - Timestamp, ExpeditionId, BossId, BossName, IsWin, TeamComposition (JSON),
	 *   DamageDealt, RewardData (JSON), PlayerId
	 *
	 * @param {Object} args - Battle arguments
	 * @param {Object} data - Battle result data
	 * @private
	 */
	async trackExpeditionBattle(args, data) {
		const playerId = (await this.storage.getMetadata('currentPlayerId')) || 'unknown';
		const timestamp = new Date().toISOString();

		const battle = {
			timestamp: timestamp,
			expeditionId: args.expeditionId || args.nodeId || 'unknown',
			bossId: args.bossId || data.bossId || 'unknown',
			bossName: data.bossName || `Boss_${args.bossId}`,
			isWin: data.result?.win || data.win || false,
			teamComposition: JSON.stringify(data.attackers || data.myTeam || {}),
			damageDealt: data.damageDealt || data.damage || 0,
			rewardData: JSON.stringify(data.reward || data.rewards || {}),
			playerId: playerId,
		};

		await this.storage.add('expeditionBattles', battle);
		console.log(
			`[OrganizedJihad] Expedition battle tracked: ${battle.bossName} - ${battle.isWin ? 'Win' : 'Loss'}`
		);

		// Track resource rewards from expedition battles
		// Expeditions reward gold, items, and sometimes emeralds
		const rewards = data.reward || data.rewards || {};
		if (rewards.gold) {
			await this.trackResourceTransaction('gold', rewards.gold, 'battle', `expedition_${battle.expeditionId}`);
		}
		if (rewards.starmoney) {
			await this.trackResourceTransaction(
				'emeralds',
				rewards.starmoney,
				'battle',
				`expedition_${battle.expeditionId}`
			);
		}
	}

	/**
	 * Track mission progress from missionEnd API call
	 * Stores/updates mission progress in IndexedDB (matches C# MissionProgress entity - MUTABLE)
	 *
	 * Entity Structure (9 properties):
	 * - MissionId (key), MissionName, Stars (0-3), HighestLevel, IsHeroic,
	 *   LastCompleted, CompletionCount, PlayerId
	 *
	 * @param {Object} args - Mission arguments
	 * @param {Object} data - Mission result data
	 * @private
	 */
	async trackMissionProgress(args, data) {
		const playerId = (await this.storage.getMetadata('currentPlayerId')) || 'unknown';
		const missionId = `${args.missionId || args.id}_${args.isHeroic ? 'heroic' : 'normal'}`;

		// Try to get existing progress
		let existing = null;
		try {
			existing = await this.storage.get('missionProgress', missionId);
		} catch (e) {
			// Doesn't exist yet
		}

		const newStars = data.stars || 0;
		const currentStars = existing?.stars || 0;

		const progress = {
			missionId: missionId,
			missionName: args.missionName || data.missionName || `Mission_${args.missionId}`,
			stars: Math.max(newStars, currentStars), // Keep highest stars
			highestLevel: args.level || existing?.highestLevel || 1,
			isHeroic: args.isHeroic || false,
			lastCompleted: new Date().toISOString(),
			completionCount: (existing?.completionCount || 0) + 1,
			playerId: playerId,
		};

		await this.storage.put('missionProgress', progress);
		console.log(`[OrganizedJihad] Mission progress updated: ${progress.missionName} - ${progress.stars} stars`);

		// Track resource rewards from mission completion
		// Campaign missions reward gold, experience, and sometimes items
		// See: https://community.hero-wars.com/discussion/campaign-rewards
		const rewards = data.reward || data.rewards || {};
		if (rewards.gold) {
			await this.trackResourceTransaction('gold', rewards.gold, 'battle', `mission_${progress.missionName}`);
		}
		if (rewards.starmoney) {
			await this.trackResourceTransaction(
				'emeralds',
				rewards.starmoney,
				'battle',
				`mission_${progress.missionName}`
			);
		}
	}

	/**
	 * Track tower progress from towerEnd or tower state API calls
	 * Stores/updates tower progress in IndexedDB (matches C# TowerProgress entity - MUTABLE)
	 *
	 * Entity Structure (6 properties):
	 * - TowerType (key), HighestFloor, LastUpdate, FloorData (JSON), PlayerId
	 *
	 * @param {Object} args - Tower arguments
	 * @param {Object} data - Tower result data
	 * @private
	 */
	async trackTowerProgress(args, data) {
		const playerId = (await this.storage.getMetadata('currentPlayerId')) || 'unknown';
		const towerType = args.towerType || args.type || 'regular'; // regular, outland, guild

		// Try to get existing progress
		let existing = null;
		try {
			existing = await this.storage.get('towerProgress', towerType);
		} catch (e) {
			// Doesn't exist yet
		}

		const newFloor = data.floor || args.floor || 1;
		const currentFloor = existing?.highestFloor || 0;

		const progress = {
			towerType: towerType,
			highestFloor: Math.max(newFloor, currentFloor), // Keep highest floor reached
			lastUpdate: new Date().toISOString(),
			floorData: JSON.stringify(data.floorDetails || {}),
			playerId: playerId,
		};

		await this.storage.put('towerProgress', progress);
		console.log(`[OrganizedJihad] Tower progress updated: ${progress.towerType} - floor ${progress.highestFloor}`);

		// Track resource rewards from tower floor completion
		// Tower rewards vary by floor: gold, items, sometimes emeralds
		// See: https://community.hero-wars.com/discussion/tower-rewards
		const rewards = data.reward || data.rewards || {};
		if (rewards.gold) {
			await this.trackResourceTransaction('gold', rewards.gold, 'battle', `${towerType}_tower_floor_${newFloor}`);
		}
		if (rewards.starmoney) {
			await this.trackResourceTransaction(
				'emeralds',
				rewards.starmoney,
				'battle',
				`${towerType}_tower_floor_${newFloor}`
			);
		}
	}

	/**
	 * Track resource transactions (gold, emeralds, tokens, etc.)
	 * Stores resource change events in IndexedDB (matches C# ResourceTransaction entity)
	 *
	 * Entity Structure (7 properties):
	 * - Timestamp, ResourceType (gold/emeralds/tokens), Amount (+ gain, - loss),
	 *   Source (battle/shop/quest/chest), SourceDetail, PlayerId
	 *
	 * @param {string} resourceType - Type of resource changed
	 * @param {number} amount - Amount changed (positive = gain, negative = loss)
	 * @param {string} source - Source of change (battle/shop/quest/chest)
	 * @param {string} sourceDetail - Detailed source info
	 * @private
	 */
	async trackResourceTransaction(resourceType, amount, source, sourceDetail = '') {
		const playerId = (await this.storage.getMetadata('currentPlayerId')) || 'unknown';
		const timestamp = new Date().toISOString();

		const transaction = {
			timestamp: timestamp,
			resourceType: resourceType, // gold, emeralds, arena_coins, guild_war_coins, titan_potion, etc.
			amount: amount, // Positive for gains, negative for spending
			source: source, // battle, shop, quest, chest, levelup, etc.
			sourceDetail: sourceDetail, // Additional context
			playerId: playerId,
		};

		await this.storage.add('resourceTransactions', transaction);
		console.log(
			`[OrganizedJihad] Resource transaction: ${amount > 0 ? '+' : ''}${amount} ${resourceType} from ${source}`
		);
	}

	/**
	 * Track guild activities (donations, raids, wars, etc.)
	 * Stores guild activity records in IndexedDB (matches C# GuildActivity entity)
	 *
	 * Entity Structure (7 properties):
	 * - Timestamp, GuildId, GuildName, ActivityType (join/leave/donation/raid/war),
	 *   ActivityData (JSON), PlayerId
	 *
	 * @param {string} activityType - Type of guild activity
	 * @param {Object} data - Activity data
	 * @private
	 */
	async trackGuildActivity(activityType, data) {
		const playerId = (await this.storage.getMetadata('currentPlayerId')) || 'unknown';
		const timestamp = new Date().toISOString();

		const activity = {
			timestamp: timestamp,
			guildId: data.guildId || 'unknown',
			guildName: data.guildName || `Guild_${data.guildId}`,
			activityType: activityType, // join, leave, donation, raid, war, chat, etc.
			activityData: JSON.stringify(data),
			playerId: playerId,
		};

		await this.storage.add('guildActivities', activity);
		console.log(`[OrganizedJihad] Guild activity tracked: ${activity.activityType} in ${activity.guildName}`);
	}

	/**
	 * Track titans data (metadata summary — called from titanGetAll)
	 * NOTE: The earlier IDB-store version of this method is overridden by
	 * this definition (same method name, last-wins in ES6 classes).
	 *
	 * @param {Object} data - Titans data
	 * @private
	 */
	async trackTitansData(data) {
		const titans = Object.values(data).map((titan) => ({
			id: titan.id,
			level: titan.level || 0,
			stars: titan.star || 0,
			power: titan.power || 0,
			skills: titan.skills || {},
			artifacts: titan.artifacts || [],
		}));

		// ── Deduplication: skip if titan roster hasn't changed ───────────
		const titanFingerprint = this._computeDataFingerprint(
			titans.map((t) => [t.id, t.level, t.stars, t.power])
		);
		if (titanFingerprint === this._lastTitanHash) {
			return;
		}
		this._lastTitanHash = titanFingerprint;

		await this.storage.setMetadata('titansData', titans);
	}

	/**
	 * Track pets data (metadata summary — called from petGetAll)
	 * NOTE: The earlier IDB-store version of this method is overridden by
	 * this definition (same method name, last-wins in ES6 classes).
	 *
	 * @param {Object} data - Pets data
	 * @private
	 */
	async trackPetsData(data) {
		const pets = Object.values(data).map((pet) => ({
			id: pet.id,
			level: pet.level || 0,
			stars: pet.star || 0,
			power: pet.power || 0,
		}));

		// ── Deduplication: skip if pet roster hasn't changed ─────────────
		const petFingerprint = this._computeDataFingerprint(
			pets.map((p) => [p.id, p.level, p.stars, p.power])
		);
		if (petFingerprint === this._lastPetHash) {
			return;
		}
		this._lastPetHash = petFingerprint;

		await this.storage.setMetadata('petsData', pets);
	}

	/**
	 * Update win/loss record against specific opponents
	 *
	 * @param {string} battleType - Type of battle (arena, titanArena, etc)
	 * @param {string} opponentId - Opponent user ID
	 * @param {string} result - 'victory' or 'defeat'
	 * @private
	 */
	async updateOpponentRecord(battleType, opponentId, result) {
		const opponentRecords = await this.storage.getMetadata('opponentRecords', {});
		const key = `${battleType}_${opponentId}`;

		if (!opponentRecords[key]) {
			opponentRecords[key] = {
				battleType,
				opponentId,
				wins: 0,
				losses: 0,
				lastBattle: Date.now(),
			};
		}

		if (result === 'victory') {
			opponentRecords[key].wins++;
		} else {
			opponentRecords[key].losses++;
		}

		opponentRecords[key].lastBattle = Date.now();

		await this.storage.setMetadata('opponentRecords', opponentRecords);
	}

	/**
	 * Calculate total team power
	 *
	 * @param {Object} team - Team object with heroes
	 * @returns {number} Total power
	 * @private
	 */
	calculateTeamPower(team) {
		if (!team) return 0;
		return Object.values(team).reduce((sum, hero) => sum + (hero.power || 0), 0);
	}

	/**
	 * Compress hero team data for storage efficiency
	 * Based on Hero Wars Assistant's compression algorithm
	 *
	 * @param {Object} team - Team object with heroes
	 * @returns {Array} Compressed team data
	 * @private
	 */
	compressHeroTeam(team) {
		if (!team) return [];
		return Object.values(team).map((hero) => [
			hero.id,
			hero.level || 0,
			hero.star || 0,
			hero.color || 0,
			hero.power || 0,
		]);
	}

	/**
	 * Compress battle replay data
	 *
	 * @param {Object} replay - Full replay data
	 * @returns {Object} Compressed replay
	 * @private
	 */
	compressReplay(replay) {
		return {
			result: replay.result,
			attackers: this.compressHeroTeam(replay.attackers),
			defenders: this.compressHeroTeam(replay.defenders),
			// Omit full battle progress to save space
		};
	}

	/**
	 * Track quests from questGetAll API call
	 *
	 * @param {Array} data - Array of quest objects
	 * @private
	 */
	async trackQuestsData(data) {
		const quests = data.map((quest) => ({
			id: quest.id,
			state: quest.state, // 0=locked, 1=available, 2=ready to collect
			progress: quest.progress || 0,
			lastUpdate: Date.now(),
		}));

		await this.storage.setMetadata('questsData', quests);
	}

	/**
	 * Track guild data from clanGetInfo API call
	 *
	 * @param {Object} data - Response from clanGetInfo
	 * @private
	 */
	async trackGuildData(data) {
		const oldGuildData = await this.storage.getMetadata('guildData', {});

		const guildData = {
			id: data.clan?.id || null,
			name: data.clan?.name || 'No Guild',
			level: data.clan?.level || 0,
			members: Object.keys(data.clan?.members || {}).length,
			lastUpdate: Date.now(),
		};

		await this.storage.setMetadata('guildData', guildData);

		// Track guild join/leave events by detecting guild ID changes
		// Hero Wars allows players to leave and join guilds
		// See: https://community.hero-wars.com/discussion/guild-management
		if (oldGuildData.id !== guildData.id) {
			if (guildData.id && !oldGuildData.id) {
				// Joined a guild
				await this.trackGuildActivity('join', {
					guildId: guildData.id,
					guildName: guildData.name,
					guildLevel: guildData.level,
					memberCount: guildData.members,
				});
			} else if (!guildData.id && oldGuildData.id) {
				// Left a guild
				await this.trackGuildActivity('leave', {
					guildId: oldGuildData.id,
					guildName: oldGuildData.name,
				});
			} else if (guildData.id && oldGuildData.id) {
				// Changed guilds (leave old, join new)
				await this.trackGuildActivity('leave', {
					guildId: oldGuildData.id,
					guildName: oldGuildData.name,
				});
				await this.trackGuildActivity('join', {
					guildId: guildData.id,
					guildName: guildData.name,
					guildLevel: guildData.level,
					memberCount: guildData.members,
				});
			}
		}
	}

	/**
	 * Track chat messages from guild, private, adventure, and AoC chats
	 * Captures incoming messages from chatGetDialog and chatGetNewMessages API calls
	 *
	 * Hero Wars chat system supports:
	 * - Guild chat: Communication within guild
	 * - Private messages: 1-on-1 conversations
	 * - Adventure chat: Party communication during dungeon/adventure runs
	 * - AoC (Altar of Chaos) chat: Team communication during AoC battles
	 *
	 * Reference: https://hw-mobile.fandom.com/wiki/Chat
	 *
	 * @param {Object} args - Original API call arguments (contains chat type, conversation ID)
	 * @param {Object} data - Response data containing message array
	 * @param {string} callName - API method name (chatGetDialog or chatGetNewMessages)
	 * @private
	 */
	async trackChatMessages(args, data, callName) {
		try {
			// Extract chat type from args
			// chatType can be: 'guild', 'private', 'adventure', 'aoc'
			const chatType = args.type || args.chatType || 'unknown';
			const conversationId = String(args.dialogId || args.conversationId || args.chatId || '');

			// Get current player ID for determining message direction
			const playerData = await this.storage.getMetadata('playerData', {});
			const currentPlayerId = playerData.player?.id || 0;

			// Get guild data for guild name context
			const guildData = await this.storage.getMetadata('guildData', {});

			// Extract messages array
			// Hero Wars chat API typically returns { messages: [...], users: {...} }
			const messages = data.messages || data.messageList || [];
			const users = data.users || {}; // User info lookup table

			// Process each message
			for (const msg of messages) {
				// Skip if message already tracked (use server message ID to detect duplicates)
				const serverId = String(msg.id || msg.messageId || '');
				if (!serverId) continue;

				// Determine if message is outgoing (sent by player) or incoming
				const senderId = msg.senderId || msg.fromUserId || msg.userId || 0;
				const isOutgoing = senderId === currentPlayerId;

				// Get sender info from users lookup or message data
				const senderInfo = users[senderId] || msg.sender || {};
				const senderName = senderInfo.name || msg.senderName || 'Unknown';

				// Get recipient info (for private messages)
				const recipientId = msg.recipientId || msg.toUserId || null;
				const recipientInfo = recipientId ? users[recipientId] || {} : null;
				const recipientName = recipientInfo?.name || msg.recipientName || null;

				// Extract message text and metadata
				const messageText = msg.text || msg.message || msg.content || '';
				const messageMetadata = {
					hasAttachment: msg.hasAttachment || false,
					itemLinks: msg.itemLinks || [],
					mentions: msg.mentions || [],
					reactions: msg.reactions || [],
					edited: msg.edited || false,
					editedAt: msg.editedAt || null,
				};

				// Build chat message record
				// Matches ChatMessage entity model in database
				const chatMessage = {
					timestamp: new Date(msg.timestamp || msg.time || Date.now()),
					chatType: chatType,
					conversationId: conversationId,
					senderId: senderId,
					senderName: senderName,
					recipientId: recipientId,
					recipientName: recipientName,
					messageText: messageText,
					messageMetadata: JSON.stringify(messageMetadata),
					isOutgoing: isOutgoing,
					guildName: chatType === 'guild' ? guildData.name : null,
					partyName: chatType === 'adventure' || chatType === 'aoc' ? args.partyName || null : null,
					serverMessageId: serverId,
					playerLevel: playerData.player?.level || null,
				};

				// Store in IndexedDB
				// Use 'chatMessages' store (matches existing pattern for other tracking)
				await this.storage.add('chatMessages', chatMessage);

				console.log(`[OrganizedJihad] Tracked ${chatType} chat message from ${senderName}`);
			}

			// Update chat activity summary for the day
			await this.updateChatActivitySummary(chatType, conversationId, messages.length, currentPlayerId);
		} catch (error) {
			console.error('[OrganizedJihad] Error tracking chat messages:', error);
		}
	}

	/**
	 * Track outgoing messages sent by the player
	 * Captures messages from chatSendMessage API call
	 *
	 * @param {Object} args - API call arguments (contains message data)
	 * @param {Object} data - Response data (may contain message ID from server)
	 * @private
	 */
	async trackOutgoingMessage(args, data) {
		try {
			// Extract message details from args
			const chatType = args.type || args.chatType || 'unknown';
			const conversationId = String(args.dialogId || args.conversationId || args.chatId || '');
			const messageText = args.text || args.message || '';

			// Get player data
			const playerData = await this.storage.getMetadata('playerData', {});
			const playerId = playerData.player?.id || 0;
			const playerName = playerData.player?.name || 'Unknown';

			// Get guild data for context
			const guildData = await this.storage.getMetadata('guildData', {});

			// Build outgoing message record
			// Note: Server message ID comes from response data
			const serverId = String(data.messageId || data.id || Date.now());

			const chatMessage = {
				timestamp: new Date(),
				chatType: chatType,
				conversationId: conversationId,
				senderId: playerId,
				senderName: playerName,
				recipientId: args.recipientId || null,
				recipientName: args.recipientName || null,
				messageText: messageText,
				messageMetadata: JSON.stringify({
					hasAttachment: false,
					itemLinks: args.itemLinks || [],
					mentions: args.mentions || [],
				}),
				isOutgoing: true, // Always true for chatSendMessage
				guildName: chatType === 'guild' ? guildData.name : null,
				partyName: chatType === 'adventure' || chatType === 'aoc' ? args.partyName || null : null,
				serverMessageId: serverId,
				playerLevel: playerData.player?.level || null,
			};

			// Store in IndexedDB
			await this.storage.add('chatMessages', chatMessage);

			console.log(`[OrganizedJihad] Tracked outgoing ${chatType} chat message`);

			// Update activity summary
			await this.updateChatActivitySummary(chatType, conversationId, 1, playerId);
		} catch (error) {
			console.error('[OrganizedJihad] Error tracking outgoing message:', error);
		}
	}

	/**
	 * Update daily chat activity summary statistics
	 * Aggregates message counts by chat type and date
	 *
	 * @param {string} chatType - Type of chat (guild, private, adventure, aoc)
	 * @param {string} conversationId - Conversation/chat identifier
	 * @param {number} messageCount - Number of messages in this batch
	 * @param {number} currentPlayerId - Current player's user ID
	 * @private
	 */
	async updateChatActivitySummary(chatType, conversationId, messageCount, currentPlayerId) {
		try {
			// Get today's date (YYYY-MM-DD format)
			const today = new Date().toISOString().split('T')[0];

			// Retrieve existing summary or create new one
			const summaryKey = `chatActivity_${chatType}_${today}`;
			const existingSummary = await this.storage.getMetadata(summaryKey, null);

			// Get messages to count sent vs received
			const todayStart = new Date(today).getTime();
			const todayEnd = todayStart + 86400000; // +24 hours

			// Query messages for today (simplified - in real implementation would use IndexedDB query)
			// For now, just increment counts based on message batch
			const messagesSent = existingSummary?.messagesSent || 0;
			const messagesReceived = existingSummary?.messagesReceived || 0;

			const summary = {
				summaryDate: new Date(today),
				chatType: chatType,
				messagesSent: messagesSent + messageCount, // Approximate, improve with actual query
				messagesReceived: messagesReceived,
				uniqueContacts: existingSummary?.uniqueContacts || 1,
				conversationId: conversationId,
				groupName: existingSummary?.groupName || null,
			};

			await this.storage.setMetadata(summaryKey, summary);
		} catch (error) {
			console.error('[OrganizedJihad] Error updating chat activity summary:', error);
		}
	}

	/**
	 * Track guild members roster and statistics
	 * Captures member list, levels, power, contribution, activity status
	 *
	 * Hero Wars clanGetInfo API returns full guild roster with member details:
	 * - Member list with IDs, names, levels, team power
	 * - Guild ranks (leader, officer, member)
	 * - Contribution points (titanite donations, activity)
	 * - Last online timestamps
	 * - Arena/Grand Arena/Titan Arena ranks
	 * - Prestige points
	 *
	 * Reference: https://hw-mobile.fandom.com/wiki/Guild
	 *
	 * @param {Object} data - Response from clanGetInfo API
	 * @private
	 */
	async trackGuildMembers(data) {
		try {
			if (!data.clan || !data.clan.members) {
				console.warn('[OrganizedJihad] No guild member data found in clanGetInfo');
				return;
			}

			const guildId = data.clan.id || 0;
			const guildName = data.clan.name || 'Unknown Guild';
			const members = data.clan.members || {};

			// Get current player ID to identify self
			const playerData = await this.storage.getMetadata('playerData', {});
			const currentPlayerId = playerData.player?.id || 0;

			// Track each guild member
			for (const [memberId, memberInfo] of Object.entries(members)) {
				// Skip tracking self (already tracked in playerData)
				if (parseInt(memberId) === currentPlayerId) continue;

				// Build guild member record
				// Matches GuildMember entity model in database
				const guildMember = {
					guildId: guildId,
					guildName: guildName,
					playerId: parseInt(memberId),
					playerName: memberInfo.name || 'Unknown',
					level: memberInfo.level || 0,
					teamPower: memberInfo.power || memberInfo.teamPower || 0,
					guildRank: memberInfo.rank || memberInfo.role || 'member',
					vipLevel: memberInfo.vipLevel || null,
					lastOnline: new Date(memberInfo.lastOnlineTime || Date.now()),
					isOnline: memberInfo.isOnline || false,
					joinedAt: memberInfo.joinedAt ? new Date(memberInfo.joinedAt) : null,
					currentContribution: memberInfo.contribution || memberInfo.weeklyContribution || 0,
					totalContribution: memberInfo.totalContribution || memberInfo.lifetimeContribution || 0,
					arenaRank: memberInfo.arenaRank || null,
					grandArenaRank: memberInfo.grandArenaRank || null,
					titanArenaRank: memberInfo.titanArenaRank || null,
					prestige: memberInfo.prestige || 0,
					isActive: true,
					heroRoster: memberInfo.heroes ? JSON.stringify(memberInfo.heroes) : null,
					titanRoster: memberInfo.titans ? JSON.stringify(memberInfo.titans) : null,
				};

				// Store/update in IndexedDB
				// Use 'guildMembers' store (upsert by playerId)
				await this.storage.put('guildMembers', guildMember);

				// Create historical snapshot for trend tracking
				const snapshot = {
					timestamp: new Date(),
					playerId: guildMember.playerId,
					playerName: guildMember.playerName,
					guildId: guildId,
					level: guildMember.level,
					teamPower: guildMember.teamPower,
					guildRank: guildMember.guildRank,
					contribution: guildMember.currentContribution,
					totalContribution: guildMember.totalContribution,
					prestige: guildMember.prestige,
					isOnline: guildMember.isOnline,
					lastOnline: guildMember.lastOnline,
				};

				await this.storage.add('guildMemberSnapshots', snapshot);
			}

			console.log(`[OrganizedJihad] Tracked ${Object.keys(members).length} guild members from ${guildName}`);
		} catch (error) {
			console.error('[OrganizedJihad] Error tracking guild members:', error);
		}
	}

	/**
	 * Track Guild War participation for all members
	 * Captures attack counts, damage dealt, fort defense stats
	 *
	 * @param {Object} data - Response from clanWarGetInfo/clanWarUserGetInfo API
	 * @private
	 */
	async trackGuildWarParticipation(data) {
		try {
			if (!data.war || !data.war.participants) {
				console.warn('[OrganizedJihad] No guild war participation data found');
				return;
			}

			const warId = data.war.id || data.war.warId || String(Date.now());
			const warDate = new Date(data.war.startTime || data.war.date || Date.now());
			const guildId = data.clan?.id || await this.getStoredGuildId();
			const participants = data.war.participants || {};

			// Track each member's participation
			for (const [memberId, participantInfo] of Object.entries(participants)) {
				const participation = {
					warId: warId,
					warDate: warDate,
					playerId: parseInt(memberId),
					playerName: participantInfo.name || 'Unknown',
					guildId: guildId,
					attacksMade: participantInfo.attacks || participantInfo.attackCount || 0,
					maxAttacks: participantInfo.maxAttacks || data.war.maxAttacks || 3,
					totalDamage: participantInfo.damage || participantInfo.totalDamage || 0,
					fortsDefended: participantInfo.fortsDefended || 0,
					defensePoints: participantInfo.defensePoints || 0,
					participated: (participantInfo.attacks || 0) > 0,
					warResult: data.war.result || null,
					attackDetails: participantInfo.attackLog ? JSON.stringify(participantInfo.attackLog) : null,
				};

				await this.storage.add('guildWarParticipations', participation);
			}

			console.log(`[OrganizedJihad] Tracked Guild War participation for ${Object.keys(participants).length} members`);
		} catch (error) {
			console.error('[OrganizedJihad] Error tracking guild war participation:', error);
		}
	}

	/**
	 * Track Guild Raid (Boss Raid) participation for all members
	 * Captures boss/minion damage, titanite earned, attack counts
	 *
	 * Reference: https://hw-mobile.fandom.com/wiki/Guild_Raid
	 *
	 * @param {Object} data - Response from bossRaidGetInfo API
	 * @private
	 */
	async trackGuildRaidParticipation(data) {
		try {
			if (!data.raid || !data.raid.participants) {
				console.warn('[OrganizedJihad] No guild raid participation data found');
				return;
			}

			const raidId = data.raid.id || data.raid.raidId || String(Date.now());
			const raidDate = new Date(data.raid.startTime || data.raid.date || Date.now());
			const guildId = data.clan?.id || await this.getStoredGuildId();
			const bossName = data.raid.bossName || data.raid.bossType || 'unknown';
			const bossLevel = data.raid.bossLevel || data.raid.difficulty || 0;
			const participants = data.raid.participants || {};

			// Track each member's raid performance
			for (const [memberId, participantInfo] of Object.entries(participants)) {
				// Calculate total damage (boss + minions)
				const bossDamage = participantInfo.bossDamage || 0;
				const minionDamage = participantInfo.minionDamage || participantInfo.supportDamage || 0;
				const totalDamage = bossDamage + minionDamage;

				const participation = {
					raidId: raidId,
					raidDate: raidDate,
					playerId: parseInt(memberId),
					playerName: participantInfo.name || 'Unknown',
					guildId: guildId,
					bossName: bossName,
					bossLevel: bossLevel,
					bossDamage: bossDamage,
					minionDamage: minionDamage,
					totalDamage: totalDamage,
					attacksMade: participantInfo.attacks || participantInfo.attackCount || 0,
					maxAttacks: participantInfo.maxAttacks || data.raid.maxAttacks || 3,
					participated: totalDamage > 0,
					titaniteEarned: participantInfo.titaniteEarned || participantInfo.reward?.titanite || 0,
					guildRank: data.raid.guildRank || null,
					attackDetails: participantInfo.attackLog ? JSON.stringify(participantInfo.attackLog) : null,
				};

				await this.storage.add('guildRaidParticipations', participation);

				// Track titanite earnings as transaction
				if (participation.titaniteEarned > 0) {
					await this.trackTitaniteTransaction(
						participation.playerId,
						participation.playerName,
						guildId,
						'earned',
						participation.titaniteEarned,
						'raid',
						`${bossName} Level ${bossLevel}`
					);
				}
			}

			console.log(`[OrganizedJihad] Tracked Guild Raid participation for ${Object.keys(participants).length} members`);
		} catch (error) {
			console.error('[OrganizedJihad] Error tracking guild raid participation:', error);
		}
	}

	/**
	 * Track Guild Dungeon (Titan Dungeon) participation
	 * Captures titan charges used, damage dealt, stages completed
	 *
	 * @param {Object} data - Response from dungeonGetState/titanDungeonGetInfo API
	 * @private
	 */
	async trackGuildDungeonParticipation(data) {
		try {
			if (!data.dungeon || !data.dungeon.participants) {
				console.warn('[OrganizedJihad] No guild dungeon participation data found');
				return;
			}

			const dungeonId = data.dungeon.id || data.dungeon.dungeonId || String(Date.now());
			const dungeonDate = new Date(data.dungeon.startTime || data.dungeon.date || Date.now());
			const guildId = data.clan?.id || await this.getStoredGuildId();
			const dungeonType = data.dungeon.type || data.dungeon.dungeonType || 'unknown';
			const participants = data.dungeon.participants || {};

			// Track each member's dungeon progress
			for (const [memberId, participantInfo] of Object.entries(participants)) {
				const participation = {
					dungeonId: dungeonId,
					dungeonDate: dungeonDate,
					playerId: parseInt(memberId),
					playerName: participantInfo.name || 'Unknown',
					guildId: guildId,
					dungeonType: dungeonType,
					titanChargesUsed: participantInfo.chargesUsed || participantInfo.titanCharges || 0,
					maxTitanCharges: participantInfo.maxCharges || data.dungeon.maxCharges || 6,
					battlesFought: participantInfo.battles || participantInfo.battleCount || 0,
					totalDamage: participantInfo.damage || participantInfo.totalDamage || 0,
					highestStage: participantInfo.stage || participantInfo.maxStage || 0,
					participated: (participantInfo.chargesUsed || 0) > 0,
					titaniteEarned: participantInfo.titaniteEarned || participantInfo.reward?.titanite || 0,
					titanTeam: participantInfo.titanTeam ? JSON.stringify(participantInfo.titanTeam) : null,
				};

				await this.storage.add('guildDungeonParticipations', participation);

				// Track titanite earnings as transaction
				if (participation.titaniteEarned > 0) {
					await this.trackTitaniteTransaction(
						participation.playerId,
						participation.playerName,
						guildId,
						'earned',
						participation.titaniteEarned,
						'dungeon',
						`${dungeonType} Stage ${participation.highestStage}`
					);
				}
			}

			console.log(`[OrganizedJihad] Tracked Guild Dungeon participation for ${Object.keys(participants).length} members`);
		} catch (error) {
			console.error('[OrganizedJihad] Error tracking guild dungeon participation:', error);
		}
	}

	/**
	 * Track titanite transaction (donation, earning, spending)
	 * Monitors guild currency flow for economic analysis
	 *
	 * @param {number} playerId - Player ID
	 * @param {string} playerName - Player name
	 * @param {number} guildId - Guild ID
	 * @param {string} transactionType - "donation", "earned", "spent"
	 * @param {number} amount - Amount (positive for gain, negative for spending)
	 * @param {string} source - Source/reason for transaction
	 * @param {string} description - Optional purchase/activity description
	 * @private
	 */
	async trackTitaniteTransaction(playerId, playerName, guildId, transactionType, amount, source, description = null) {
		try {
			const transaction = {
				timestamp: new Date(),
				playerId: playerId,
				playerName: playerName,
				guildId: guildId,
				transactionType: transactionType,
				amount: amount,
				source: source,
				purchaseDescription: description,
				balanceAfter: null, // Could be calculated if we track running balance
			};

			await this.storage.add('titaniteTransactions', transaction);

			console.log(`[OrganizedJihad] Tracked titanite ${transactionType}: ${amount} from ${source}`);
		} catch (error) {
			console.error('[OrganizedJihad] Error tracking titanite transaction:', error);
		}
	}

	/**
	 * Helper: Get stored guild ID from storage
	 * @returns {Promise<number>} Guild ID
	 * @private
	 */
	async getStoredGuildId() {
		const guildData = await this.storage.getMetadata('guildData', {});
		return guildData.id || 0;
	}

	/**
	 * Create periodic snapshot of all tracked data
	 * Updates historical records for trend analysis
	 *
	 * @private
	 */
	async updateSnapshot() {
		const now = Date.now();
		if (now - this.lastUpdate < 60000) return; // 1 minute throttle

		const snapshot = {
			timestamp: now,
			player: await this.storage.getMetadata('playerData', {}),
			heroes: await this.storage.getMetadata('heroesData', []),
			inventory: await this.storage.getMetadata('inventoryData', {}),
			guild: await this.storage.getMetadata('guildData', {}),
		};

		// Save current snapshot
		await this.storage.setMetadata('lastGameData', snapshot);

		// Update historical data
		const history = await this.storage.getMetadata('gameHistory', []);
		history.push({
			timestamp: now,
			level: snapshot.player.level || 0,
			power: snapshot.heroes.reduce((sum, h) => sum + h.power, 0),
			gold: snapshot.player.gold || 0,
			emeralds: snapshot.player.starmoney || 0,
		});

		// Keep last 1000 snapshots
		if (history.length > 1000) {
			history.shift();
		}

		await this.storage.setMetadata('gameHistory', history);
		this.lastUpdate = now;
	}

	/**
	 * Manually trigger data capture
	 * Note: This only returns the last captured data, as we can't
	 * force the game to make API calls
	 *
	 * @returns {Object} Last captured game data
	 */
	async captureCurrentState() {
		return await this.storage.getMetadata('lastGameData', {});
	}

	/**
	 * Get current player statistics
	 * @returns {Object} Player data
	 */
	async getPlayerStats() {
		return await this.storage.getMetadata('playerData', {});
	}

	/**
	 * Get current hero roster
	 * @returns {Array} Array of hero objects
	 */
	async getHeroRoster() {
		return await this.storage.getMetadata('heroesData', []);
	}

	/**
	 * Get resource amounts
	 * @returns {Object} Resource data
	 */
	async getResources() {
		const player = await this.getPlayerStats();
		const inventory = await this.storage.getMetadata('inventoryData', {});

		return {
			gold: player.gold || 0,
			emeralds: player.starmoney || 0,
			energy: player.stamina || 0,
			consumables: inventory.consumable || {},
			coins: inventory.coin || {},
		};
	}

	/**
	 * Get battle history
	 * @returns {Array} Array of battle records
	 */
	async getBattleHistory() {
		return await this.storage.getMetadata('battleHistory', []);
	}

	/**
	 * Get arena battle history with win/loss statistics
	 * @returns {Object} Arena data with history and stats
	 */
	async getArenaData() {
		const history = await this.storage.getMetadata('arenaBattleHistory', []);
		const currentEnemies = await this.storage.getMetadata('arenaEnemies', []);
		const encounters = await this.storage.getMetadata('arenaEncounterHistory', []);

		const stats = this.calculateBattleStats(history);

		return {
			currentEnemies,
			history,
			encounters,
			stats,
		};
	}

	/**
	 * Get titan arena data
	 * @returns {Object} Titan arena data
	 */
	async getTitanArenaData() {
		const history = await this.storage.getMetadata('titanArenaBattleHistory', []);
		const currentEnemies = await this.storage.getMetadata('titanArenaEnemies', []);
		const stats = this.calculateBattleStats(history);

		return {
			currentEnemies,
			history,
			stats,
		};
	}

	/**
	 * Get grand arena data
	 * @returns {Object} Grand arena data
	 */
	async getGrandArenaData() {
		const history = await this.storage.getMetadata('grandArenaBattleHistory', []);
		const currentEnemies = await this.storage.getMetadata('grandArenaEnemies', []);
		const stats = this.calculateBattleStats(history);

		return {
			currentEnemies,
			history,
			stats,
		};
	}

	/**
	 * Get guild war data
	 * @returns {Object} Guild war data with current war and history
	 */
	async getGuildWarData() {
		const currentWar = await this.storage.getMetadata('currentGuildWar', null);
		const history = await this.storage.getMetadata('guildWarBattleHistory', []);
		const stats = this.calculateBattleStats(history);

		return {
			currentWar,
			history,
			stats,
		};
	}

	/**
	 * Get raid boss data
	 * @returns {Object} Raid boss data with current boss and attack history
	 */
	async getRaidBossData() {
		const currentBoss = await this.storage.getMetadata('currentRaidBoss', null);
		const history = await this.storage.getMetadata('raidBossAttackHistory', []);

		const totalDamage = history.reduce((sum, attack) => sum + attack.damage, 0);
		const averageDamage = history.length > 0 ? totalDamage / history.length : 0;

		return {
			currentBoss,
			history,
			totalDamage,
			averageDamage,
		};
	}

	/**
	 * Get chest opening statistics with drop rates
	 * @returns {Object} Chest opening data and calculated drop rates
	 */
	async getChestStatistics() {
		const history = await this.storage.getMetadata('chestOpeningHistory', []);
		const dropRates = await this.storage.getMetadata('chestDropRates', {});

		// Calculate drop probabilities
		const probabilityData = {};
		for (const [chestKey, data] of Object.entries(dropRates)) {
			probabilityData[chestKey] = {
				...data,
				itemProbabilities: {},
			};

			for (const [itemKey, itemData] of Object.entries(data.itemDrops)) {
				probabilityData[chestKey].itemProbabilities[itemKey] = {
					...itemData,
					dropRate: ((itemData.dropCount / data.openCount) * 100).toFixed(2) + '%',
					averageAmount: (itemData.totalAmount / itemData.dropCount).toFixed(2),
				};
			}
		}

		return {
			history,
			dropRates: probabilityData,
		};
	}

	/**
	 * Get opponent records (win/loss against specific players)
	 * @returns {Object} Opponent records by battle type
	 */
	async getOpponentRecords() {
		return await this.storage.getMetadata('opponentRecords', {});
	}

	/**
	 * Get expedition data
	 * @returns {Object} Expedition state and battle history
	 */
	async getExpeditionData() {
		const state = await this.storage.getMetadata('expeditionState', null);
		const history = await this.storage.getMetadata('expeditionBattleHistory', []);
		const stats = this.calculateBattleStats(history);

		return {
			state,
			history,
			stats,
		};
	}

	/**
	 * Get titans roster
	 * @returns {Array} Array of titan objects
	 */
	async getTitansRoster() {
		return await this.storage.getMetadata('titansData', []);
	}

	/**
	 * Get pets roster
	 * @returns {Array} Array of pet objects
	 */
	async getPetsRoster() {
		return await this.storage.getMetadata('petsData', []);
	}

	/**
	 * Get shop purchase history
	 * @returns {Array} Purchase history
	 */
	async getShopPurchaseHistory() {
		return await this.storage.getMetadata('shopPurchaseHistory', []);
	}

	/**
	 * Get quest completion history
	 * @returns {Array} Quest completion history
	 */
	async getQuestHistory() {
		return await this.storage.getMetadata('questCompletionHistory', []);
	}

	/**
	 * Get comprehensive historical data comparison
	 * Shows current vs historical state with trends
	 *
	 * @returns {Object} Historical comparison data
	 */
	async getHistoricalComparison() {
		const history = await this.storage.getMetadata('gameHistory', []);
		const current = await this.captureCurrentState();

		if (history.length === 0) {
			return {
				current,
				trends: null,
				message: 'Not enough historical data yet',
			};
		}

		// Get data from 1 day, 7 days, and 30 days ago
		const now = Date.now();
		const oneDayAgo = history.find((h) => now - h.timestamp >= 86400000); // 24 hours
		const sevenDaysAgo = history.find((h) => now - h.timestamp >= 604800000); // 7 days
		const thirtyDaysAgo = history.find((h) => now - h.timestamp >= 2592000000); // 30 days

		const trends = {
			level: {
				current: current.player?.level || 0,
				oneDayAgo: oneDayAgo?.level || 0,
				sevenDaysAgo: sevenDaysAgo?.level || 0,
				thirtyDaysAgo: thirtyDaysAgo?.level || 0,
			},
			power: {
				current: current.heroes?.reduce((sum, h) => sum + h.power, 0) || 0,
				oneDayAgo: oneDayAgo?.power || 0,
				sevenDaysAgo: sevenDaysAgo?.power || 0,
				thirtyDaysAgo: thirtyDaysAgo?.power || 0,
			},
			gold: {
				current: current.player?.gold || 0,
				oneDayAgo: oneDayAgo?.gold || 0,
				sevenDaysAgo: sevenDaysAgo?.gold || 0,
				thirtyDaysAgo: thirtyDaysAgo?.gold || 0,
			},
			emeralds: {
				current: current.player?.starmoney || 0,
				oneDayAgo: oneDayAgo?.emeralds || 0,
				sevenDaysAgo: sevenDaysAgo?.emeralds || 0,
				thirtyDaysAgo: thirtyDaysAgo?.emeralds || 0,
			},
		};

		return {
			current,
			trends,
			history,
		};
	}

	/**
	 * Calculate battle statistics from history
	 *
	 * @param {Array} history - Battle history array
	 * @returns {Object} Battle statistics
	 * @private
	 */
	calculateBattleStats(history) {
		const wins = history.filter((b) => b.result === 'victory').length;
		const losses = history.filter((b) => b.result === 'defeat').length;
		const total = history.length;
		const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0';

		return {
			total,
			wins,
			losses,
			winRate: winRate + '%',
		};
	}

	/**
	 * Export all tracked data for analysis or backup
	 * @returns {Object} All tracked game data
	 */
	async exportAllData() {
		return {
			player: await this.getPlayerStats(),
			heroes: await this.getHeroRoster(),
			titans: await this.getTitansRoster(),
			pets: await this.getPetsRoster(),
			resources: await this.getResources(),
			battleHistory: await this.getBattleHistory(),
			arena: await this.getArenaData(),
			titanArena: await this.getTitanArenaData(),
			grandArena: await this.getGrandArenaData(),
			guildWar: await this.getGuildWarData(),
			raidBoss: await this.getRaidBossData(),
			chests: await this.getChestStatistics(),
			opponents: await this.getOpponentRecords(),
			expedition: await this.getExpeditionData(),
			shopPurchases: await this.getShopPurchaseHistory(),
			quests: await this.getQuestHistory(),
			historical: await this.getHistoricalComparison(),
			exportedAt: new Date().toISOString(),
		};
	}

	// ========================================================================
	// Phase 8: Daily Activity & Inventory Tracking Methods
	// ========================================================================

	/**
	 * Get the current player ID from metadata cache.
	 * Used by upgrade tracking methods that need the player ID.
	 *
	 * @returns {Promise<string|number>} Player ID or 'unknown'
	 * @private
	 */
	async _getPlayerId() {
		return (await this.storage.getMetadata('currentPlayerId')) || 'unknown';
	}

	/**
	 * Track a single daily quest farm (reward collection).
	 * API call: questFarm({questId})
	 *
	 * Daily quests have IDs in the 10000-10999 range.
	 * Guild quests may have different ID ranges.
	 *
	 * Reference: data/Models/DailyActivityModels.cs
	 *
	 * @param {Object} args - Request arguments {questId: number}
	 * @param {Object} responseData - Response with quest reward data
	 * @returns {Promise<void>}
	 * @private
	 */
	async trackDailyQuestFarm(args, responseData) {
		const playerId = await this._getPlayerId();
		const timestamp = new Date().toISOString();
		const questId = String(args.questId || args.id || 0);
		const questIdNum = parseInt(questId, 10);

		// Determine if this is a daily quest (10001-10999) or guild quest
		const isDailyQuest = questIdNum >= 10000 && questIdNum < 11000;

		if (isDailyQuest) {
			// Store as daily quest completion
			const record = {
				completedAt: timestamp,
				questDate: new Date().toISOString().split('T')[0], // Date-only portion
				questId,
				questName: `Daily Quest ${questId}`,
				category: null, // Would need quest name mapping
				activityPoints: responseData?.reward?.activityPoints || 0,
				rewardData: JSON.stringify(responseData?.reward || responseData || {}),
				playerId,
			};

			await this.storage.add('dailyQuestCompletions', record);
			console.log(`[OrganizedJihad] Daily quest farmed: ${questId}`);
		} else {
			// Store as guild quest completion
			const guildId = (await this.storage.getMetadata('currentGuildId')) || 0;
			const record = {
				completedAt: timestamp,
				questDate: new Date().toISOString().split('T')[0],
				questId,
				questName: `Guild Quest ${questId}`,
				difficulty: null,
				guildActivityPoints: responseData?.reward?.guildActivityPoints || 0,
				rewardData: JSON.stringify(responseData?.reward || responseData || {}),
				playerId,
				guildId,
			};

			await this.storage.add('guildQuestCompletions', record);
			console.log(`[OrganizedJihad] Guild quest farmed: ${questId}`);
		}
	}

	/**
	 * Track batch quest farming (multiple quests at once).
	 * API call: quest_questsFarm({questIds: [...]})
	 *
	 * Used primarily for battle pass quests and batch daily completions.
	 *
	 * @param {Object} args - Request arguments {questIds: number[]}
	 * @param {Object} responseData - Response with quest reward data
	 * @returns {Promise<void>}
	 * @private
	 */
	async trackBatchQuestFarm(args, responseData) {
		const questIds = args.questIds || [];

		// Process each quest ID as a separate farm event
		for (const questId of questIds) {
			await this.trackDailyQuestFarm({ questId }, responseData);
		}

		console.log(`[OrganizedJihad] Batch quest farm: ${questIds.length} quests`);
	}

	/**
	 * Track daily login reward collection.
	 * API call: dailyBonusFarm({vip})
	 *
	 * Matches C# LoginReward entity in data/Models/DailyActivityModels.cs
	 *
	 * @param {Object} args - Request arguments {vip: boolean}
	 * @param {Object} responseData - Response with reward data
	 * @returns {Promise<void>}
	 * @private
	 */
	async trackLoginReward(args, responseData) {
		const playerId = await this._getPlayerId();
		const timestamp = new Date().toISOString();
		const isVip = args.vip || false;

		const record = {
			claimedAt: timestamp,
			dayNumber: responseData?.day || responseData?.dayCount || 0,
			streakLength: responseData?.loginCount || responseData?.streak || 0,
			isVipBonus: isVip,
			rewardData: JSON.stringify(responseData?.reward || responseData || {}),
			playerId,
		};

		await this.storage.add('loginRewards', record);
		console.log(`[OrganizedJihad] Login reward claimed: day ${record.dayNumber}, VIP: ${isVip}`);
	}

	/**
	 * Track daily bonus info for reference (cache streak/day info).
	 * API call: dailyBonusGetInfo
	 *
	 * Stores the current day number and streak length in metadata
	 * for use by subsequent dailyBonusFarm calls.
	 *
	 * @param {Object} responseData - Response with daily bonus state
	 * @returns {Promise<void>}
	 * @private
	 */
	async trackDailyBonusInfo(responseData) {
		// Cache the daily bonus info for use when farming
		if (responseData?.day || responseData?.dayCount) {
			await this.storage.setMetadata('dailyBonusDay', responseData.day || responseData.dayCount);
		}
		if (responseData?.loginCount || responseData?.streak) {
			await this.storage.setMetadata('dailyBonusStreak', responseData.loginCount || responseData.streak);
		}

		console.log('[OrganizedJihad] Daily bonus info cached');
	}

	/**
	 * Track inventory item usage when consumables are spent.
	 * Called from upgrade event handlers (e.g., XP potion usage) and other
	 * consumable-spending API calls.
	 *
	 * Matches C# InventoryItemUsage entity in data/Models/InventoryModels.cs
	 *
	 * @param {Object} args - Request arguments with item info
	 * @param {Object} responseData - Response data
	 * @param {string} category - Item category: 'potion', 'fragment', 'scroll', etc.
	 * @param {string} usageContext - Usage context: 'hero_level', 'artifact', etc.
	 * @returns {Promise<void>}
	 * @private
	 */
	async trackInventoryItemUsage(args, responseData, category, usageContext) {
		const playerId = await this._getPlayerId();
		const timestamp = new Date().toISOString();

		const record = {
			timestamp,
			itemId: String(args.libId || args.itemId || 'unknown'),
			itemName: `Item_${args.libId || args.itemId || 'unknown'}`, // Name lookup not available
			category,
			quantityUsed: args.amount || 1,
			quantityRemaining: 0, // Not always available in response
			usageContext,
			targetEntity: args.heroId ? `Hero_${args.heroId}` : (args.titanId ? `Titan_${args.titanId}` : null),
			playerId,
		};

		await this.storage.add('inventoryItemUsages', record);
		console.log(`[OrganizedJihad] Inventory item used: ${record.itemId} x${record.quantityUsed} for ${usageContext}`);
	}

	/**
	 * Stop tracking and restore original methods
	 */
	destroy() {
		if (this.originalXHR) {
			XMLHttpRequest.prototype.open = this.originalXHR.open;
			XMLHttpRequest.prototype.send = this.originalXHR.send;
			XMLHttpRequest.prototype.setRequestHeader = this.originalXHR.setRequestHeader;
		}

		this.isTracking = false;
		console.log('[OrganizedJihad] GameTracker destroyed - API monitoring stopped');
	}
}

export default GameTracker;
