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
					case 'towerEnd':
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
					case 'clanWarGetInfo':
					case 'clanWarUserGetInfo':
						await this.trackGuildWarInfo(responseData);
						break;
					case 'clanWarAttack':
						await this.trackGuildWarBattle(args, responseData);
						break;

					// Guild Raid
					case 'bossRaidGetInfo':
						await this.trackRaidBossInfo(responseData);
						break;
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
				}
			} catch (error) {
				console.error(`[OrganizedJihad] Error processing ${callName}:`, error);
			}
		}

		// Trigger periodic data snapshot
		await this.updateSnapshot();
	}

	/**
	 * Track player data from userGetInfo API call
	 * Now saves as a snapshot in IndexedDB
	 *
	 * @param {Object} data - Response from userGetInfo
	 * @private
	 */
	async trackPlayerData(data) {
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
			arenaRank: 0, // TODO: Extract from arena data
			grandArenaRank: 0, // TODO: Extract from grand arena data
			titanArenaRank: 0, // TODO: Extract from titan arena data
			titaniteDungeon: null, // TODO: Extract from dungeon data
			timestamp: new Date().toISOString(),
			rawData: JSON.stringify(data), // Store full data for future reference
		};

		await this.storage.add('snapshots', snapshot);
		console.log('[OrganizedJihad] Player snapshot saved:', snapshot.playerName, 'Level', snapshot.level);
	}

	/**
	 * Track heroes from heroGetAll API call
	 * Store in metadata for reference
	 *
	 * @param {Object} data - Response from heroGetAll (object with hero IDs as keys)
	 * @private
	 */
	async trackHeroesData(data) {
		const heroes = Object.values(data).map((hero) => ({
			id: hero.id,
			level: hero.level || 0,
			stars: hero.star || 0,
			color: hero.color || 0, // Rank/promotion
			power: hero.power || 0,
			xp: hero.xp || 0,
			skills: hero.skills || {},
			artifacts: hero.artifacts || [],
		}));

		await this.storage.setMetadata('heroesData', heroes);
		console.log(`[OrganizedJihad] Heroes updated: ${heroes.length} heroes tracked`);
	}

	/**
	 * Track inventory from inventoryGet API call
	 * Store in metadata for reference
	 *
	 * @param {Object} data - Response from inventoryGet
	 * @private
	 */
	async trackInventoryData(data) {
		const inventory = {
			consumable: data.consumable || {}, // Items like potions, chests
			gear: data.gear || {}, // Equipment
			fragmentHero: data.fragmentHero || {}, // Soul stones
			coin: data.coin || {}, // Various currency types
			lastUpdate: new Date().toISOString(),
		};

		await this.storage.setMetadata('inventoryData', inventory);
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

		const battleHistory = await storageManager.get('battleHistory', []);
		battleHistory.push(battleRecord);

		// Keep last 1000 battles
		if (battleHistory.length > 1000) {
			battleHistory.shift();
		}

		await storageManager.set('battleHistory', battleHistory);
	}

	/**
	 * Track arena enemies for matchmaking analysis
	 *
	 * @param {Object} data - Arena enemies data
	 * @private
	 */
	async trackArenaEnemies(data) {
		if (!data.enemies) return;

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
		await storageManager.set('arenaEnemies', enemies);

		// Track historical arena encounters
		const encounterHistory = (await storageManager.get('arenaEncounterHistory', [])).concat(
			enemies.map((e) => ({ ...e, encounter: 'available' }))
		);

		// Keep last 500 encounters
		if (encounterHistory.length > 500) {
			encounterHistory.splice(0, encounterHistory.length - 500);
		}

		await storageManager.set('arenaEncounterHistory', encounterHistory);
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

		// Update opponent record
		await this.updateOpponentRecord(args.enemyUserId, 'Arena', battle.isWin);
	}

	/**
	 * Track Titan Arena enemies
	 *
	 * @param {Object} data - Titan arena enemies data
	 * @private
	 */
	async trackTitanArenaEnemies(data) {
		if (!data.enemies) return;

		const timestamp = Date.now();
		const enemies = data.enemies.map((enemy) => ({
			userId: enemy.userId,
			name: enemy.name,
			level: enemy.level,
			power: this.calculateTeamPower(enemy.titans),
			titans: this.compressHeroTeam(enemy.titans),
			timestamp,
		}));

		await storageManager.set('titanArenaEnemies', enemies);
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
	}

	/**
	 * Track Grand Arena enemies
	 *
	 * @param {Object} data - Grand arena enemies data
	 * @private
	 */
	async trackGrandArenaEnemies(data) {
		if (!data.enemies) return;

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

		await storageManager.set('grandArenaEnemies', enemies);
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
			playerHeroes: data.battles ? JSON.stringify(data.battles.map((b) => this.compressHeroTeam(b.attackers))) : null,
			opponentHeroes: data.battles ? JSON.stringify(data.battles.map((b) => this.compressHeroTeam(b.defenders))) : null,
			rewards: data.reward ? JSON.stringify(data.reward) : null,
			timestamp: new Date().toISOString(),
		};

		await this.storage.add('battles', battle);
		await this.updateOpponentRecord(args.enemyUserId, 'GrandArena', battle.isWin);
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

		await storageManager.set('currentGuildWar', warData);
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

		const guildWarHistory = await storageManager.get('guildWarBattleHistory', []);
		guildWarHistory.push(battleRecord);

		if (guildWarHistory.length > 500) {
			guildWarHistory.shift();
		}

		await storageManager.set('guildWarBattleHistory', guildWarHistory);
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

		await storageManager.set('currentRaidBoss', bossData);
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

		const raidHistory = await storageManager.get('raidBossAttackHistory', []);
		raidHistory.push(attackRecord);

		if (raidHistory.length > 500) {
			raidHistory.shift();
		}

		await storageManager.set('raidBossAttackHistory', raidHistory);
	}

	/**
	 * Track chest openings for drop rate analysis
	 * THIS IS KEY FOR UNDERSTANDING LOOT PROBABILITIES
	 *
	 * @param {Object} args - Chest opening arguments
	 * @param {Object} data - Chest rewards data
	 * @private
	 */
	async trackChestOpening(args, data) {
		const chestRecord = {
			chestId: args.chestId || args.id,
			chestType: args.chestType || 'unknown',
			quantity: args.amount || 1,
			rewards: data.reward || data.rewards || [],
			timestamp: Date.now(),
		};

		// Store individual chest opening
		const chestHistory = await storageManager.get('chestOpeningHistory', []);
		chestHistory.push(chestRecord);

		if (chestHistory.length > 1000) {
			chestHistory.shift();
		}

		await storageManager.set('chestOpeningHistory', chestHistory);

		// Update drop rate statistics
		await this.updateChestDropRates(chestRecord);
	}

	/**
	 * Update chest drop rate statistics
	 *
	 * @param {Object} chestRecord - Record of chest opening
	 * @private
	 */
	async updateChestDropRates(chestRecord) {
		const dropRates = await storageManager.get('chestDropRates', {});
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

		// Count each item dropped
		if (Array.isArray(chestRecord.rewards)) {
			chestRecord.rewards.forEach((reward) => {
				const itemKey = `${reward.type}_${reward.id}`;
				if (!dropRates[chestKey].itemDrops[itemKey]) {
					dropRates[chestKey].itemDrops[itemKey] = {
						type: reward.type,
						id: reward.id,
						name: reward.name || itemKey,
						dropCount: 0,
						totalAmount: 0,
					};
				}
				dropRates[chestKey].itemDrops[itemKey].dropCount += 1;
				dropRates[chestKey].itemDrops[itemKey].totalAmount += reward.amount || 1;
			});
		}

		await storageManager.set('chestDropRates', dropRates);
	}

	/**
	 * Track shop purchases for spending analysis
	 *
	 * @param {Object} args - Purchase arguments
	 * @param {Object} data - Purchase result data
	 * @private
	 */
	async trackShopPurchase(args, data) {
		const purchaseRecord = {
			shopId: args.shopId,
			slotId: args.slotId,
			itemId: args.itemId,
			cost: args.cost || {},
			reward: data.reward || {},
			timestamp: Date.now(),
		};

		const purchaseHistory = await storageManager.get('shopPurchaseHistory', []);
		purchaseHistory.push(purchaseRecord);

		if (purchaseHistory.length > 500) {
			purchaseHistory.shift();
		}

		await storageManager.set('shopPurchaseHistory', purchaseHistory);
	}

	/**
	 * Track quest completions
	 *
	 * @param {Object} args - Quest completion arguments
	 * @param {Object} data - Quest reward data
	 * @private
	 */
	async trackQuestComplete(args, data) {
		const questRecord = {
			questId: args.questId,
			reward: data.reward || {},
			timestamp: Date.now(),
		};

		const questHistory = await storageManager.get('questCompletionHistory', []);
		questHistory.push(questRecord);

		if (questHistory.length > 500) {
			questHistory.shift();
		}

		await storageManager.set('questCompletionHistory', questHistory);
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

		await storageManager.set('expeditionState', expeditionData);
	}

	/**
	 * Track expedition battles
	 *
	 * @param {Object} args - Battle arguments
	 * @param {Object} data - Battle result data
	 * @private
	 */
	async trackExpeditionBattle(args, data) {
		const battleRecord = {
			nodeId: args.nodeId,
			result: data.result?.win ? 'victory' : 'defeat',
			myTeam: data.attackers ? this.compressHeroTeam(data.attackers) : null,
			enemyTeam: data.defenders ? this.compressHeroTeam(data.defenders) : null,
			reward: data.reward || {},
			timestamp: Date.now(),
		};

		const expeditionHistory = await storageManager.get('expeditionBattleHistory', []);
		expeditionHistory.push(battleRecord);

		if (expeditionHistory.length > 200) {
			expeditionHistory.shift();
		}

		await storageManager.set('expeditionBattleHistory', expeditionHistory);
	}

	/**
	 * Track titans data
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

		await storageManager.set('titansData', titans);
	}

	/**
	 * Track pets data
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

		await storageManager.set('petsData', pets);
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
		const opponentRecords = await storageManager.get('opponentRecords', {});
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

		await storageManager.set('opponentRecords', opponentRecords);
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

		await storageManager.set('questsData', quests);
	}

	/**
	 * Track guild data from clanGetInfo API call
	 *
	 * @param {Object} data - Response from clanGetInfo
	 * @private
	 */
	async trackGuildData(data) {
		const guildData = {
			id: data.clan?.id || null,
			name: data.clan?.name || 'No Guild',
			level: data.clan?.level || 0,
			members: Object.keys(data.clan?.members || {}).length,
			lastUpdate: Date.now(),
		};

		await storageManager.set('guildData', guildData);
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
			player: await storageManager.get('playerData', {}),
			heroes: await storageManager.get('heroesData', []),
			inventory: await storageManager.get('inventoryData', {}),
			guild: await storageManager.get('guildData', {}),
		};

		// Save current snapshot
		await storageManager.set('lastGameData', snapshot);

		// Update historical data
		const history = await storageManager.get('gameHistory', []);
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

		await storageManager.set('gameHistory', history);
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
		return await storageManager.get('lastGameData', {});
	}

	/**
	 * Get current player statistics
	 * @returns {Object} Player data
	 */
	async getPlayerStats() {
		return await storageManager.get('playerData', {});
	}

	/**
	 * Get current hero roster
	 * @returns {Array} Array of hero objects
	 */
	async getHeroRoster() {
		return await storageManager.get('heroesData', []);
	}

	/**
	 * Get resource amounts
	 * @returns {Object} Resource data
	 */
	async getResources() {
		const player = await this.getPlayerStats();
		const inventory = await storageManager.get('inventoryData', {});

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
		return await storageManager.get('battleHistory', []);
	}

	/**
	 * Get arena battle history with win/loss statistics
	 * @returns {Object} Arena data with history and stats
	 */
	async getArenaData() {
		const history = await storageManager.get('arenaBattleHistory', []);
		const currentEnemies = await storageManager.get('arenaEnemies', []);
		const encounters = await storageManager.get('arenaEncounterHistory', []);

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
		const history = await storageManager.get('titanArenaBattleHistory', []);
		const currentEnemies = await storageManager.get('titanArenaEnemies', []);
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
		const history = await storageManager.get('grandArenaBattleHistory', []);
		const currentEnemies = await storageManager.get('grandArenaEnemies', []);
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
		const currentWar = await storageManager.get('currentGuildWar', null);
		const history = await storageManager.get('guildWarBattleHistory', []);
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
		const currentBoss = await storageManager.get('currentRaidBoss', null);
		const history = await storageManager.get('raidBossAttackHistory', []);

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
		const history = await storageManager.get('chestOpeningHistory', []);
		const dropRates = await storageManager.get('chestDropRates', {});

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
		return await storageManager.get('opponentRecords', {});
	}

	/**
	 * Get expedition data
	 * @returns {Object} Expedition state and battle history
	 */
	async getExpeditionData() {
		const state = await storageManager.get('expeditionState', null);
		const history = await storageManager.get('expeditionBattleHistory', []);
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
		return await storageManager.get('titansData', []);
	}

	/**
	 * Get pets roster
	 * @returns {Array} Array of pet objects
	 */
	async getPetsRoster() {
		return await storageManager.get('petsData', []);
	}

	/**
	 * Get shop purchase history
	 * @returns {Array} Purchase history
	 */
	async getShopPurchaseHistory() {
		return await storageManager.get('shopPurchaseHistory', []);
	}

	/**
	 * Get quest completion history
	 * @returns {Array} Quest completion history
	 */
	async getQuestHistory() {
		return await storageManager.get('questCompletionHistory', []);
	}

	/**
	 * Get comprehensive historical data comparison
	 * Shows current vs historical state with trends
	 *
	 * @returns {Object} Historical comparison data
	 */
	async getHistoricalComparison() {
		const history = await storageManager.get('gameHistory', []);
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

// Export singleton instance
const gameTracker = new GameTracker();
export default gameTracker;
