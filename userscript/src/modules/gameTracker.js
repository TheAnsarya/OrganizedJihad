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

import storageManager from './storageManager.js';

/**
 * Game data tracking via API interception
 * Monitors Hero Wars API requests for legitimate data tracking
 *
 * @class GameTracker
 */
class GameTracker {
	constructor() {
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
	 * Common API calls we track:
	 * - userGetInfo: Player level, VIP, resources, guild
	 * - heroGetAll: Hero roster with stats
	 * - inventoryGet: Items, consumables, fragments
	 * - missionEnd, towerEnd, etc: Battle results
	 *
	 * @param {Object} request - The request data with "calls" array
	 * @param {Object} response - The response data with "results" array
	 * @private
	 */
	async processAPIResponse(request, response) {
		if (!request?.calls || !response?.results) return;

		// Map requests to responses by ident
		const callMap = {};
		request.calls.forEach((call) => {
			callMap[call.ident] = call.name;
		});

		// Process each result
		for (const result of response.results) {
			const callName = callMap[result.ident];
			const responseData = result.result?.response;

			if (!responseData) continue;

			try {
				switch (callName) {
					case 'userGetInfo':
						await this.trackPlayerData(responseData);
						break;
					case 'heroGetAll':
						await this.trackHeroesData(responseData);
						break;
					case 'inventoryGet':
						await this.trackInventoryData(responseData);
						break;
					case 'missionEnd':
					case 'towerEnd':
					case 'arenaEnd':
					case 'bossEnd':
						await this.trackBattleResult(callName, responseData);
						break;
					case 'questGetAll':
						await this.trackQuestsData(responseData);
						break;
					case 'clanGetInfo':
						await this.trackGuildData(responseData);
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
	 *
	 * @param {Object} data - Response from userGetInfo
	 * @private
	 */
	async trackPlayerData(data) {
		const playerData = {
			userId: data.userId,
			name: data.name || 'Unknown',
			level: data.level || 0,
			vipLevel: data.vipLevel || 0,
			gold: data.gold || 0,
			starmoney: data.starmoney || 0, // Emeralds
			clanId: data.clanId || null,
			clanTitle: data.clanTitle || 'No Guild',
			stamina: data.refillable?.find((r) => r.id === 1)?.amount || 0,
			lastUpdate: Date.now(),
		};

		await storageManager.set('playerData', playerData);
		console.log('[OrganizedJihad] Player data updated:', playerData.name, 'Level', playerData.level);
	}

	/**
	 * Track heroes from heroGetAll API call
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

		await storageManager.set('heroesData', heroes);
		console.log(`[OrganizedJihad] Heroes updated: ${heroes.length} heroes tracked`);
	}

	/**
	 * Track inventory from inventoryGet API call
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
			lastUpdate: Date.now(),
		};

		await storageManager.set('inventoryData', inventory);
	}

	/**
	 * Track battle results from various battle end API calls
	 *
	 * @param {string} battleType - Type of battle (missionEnd, towerEnd, etc)
	 * @param {Object} data - Battle result data
	 * @private
	 */
	async trackBattleResult(battleType, data) {
		const battleRecord = {
			type: battleType.replace('End', ''),
			result: data.result?.win ? 'victory' : 'defeat',
			reward: data.reward || {},
			timestamp: Date.now(),
		};

		const battleHistory = await storageManager.get('battleHistory', []);
		battleHistory.push(battleRecord);

		// Keep last 100 battles
		if (battleHistory.length > 100) {
			battleHistory.shift();
		}

		await storageManager.set('battleHistory', battleHistory);
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
