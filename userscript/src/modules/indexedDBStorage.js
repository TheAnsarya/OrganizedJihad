/**
 * IndexedDBStorage Module
 * Handles data persistence using IndexedDB for browser extension compatibility
 * Much more scalable than GM_setValue or localStorage (can store gigabytes vs ~10MB)
 *
 * Database Structure:
 * - snapshots: Player state snapshots
 * - battles: All battle records (arena, grand, titan, guild war, raid boss)
 * - chests: Chest opening records
 * - opponents: Opponent intelligence tracking
 * - goals: User-defined goals
 * - events: Calendar events
 * - metadata: Sync timestamps and other metadata
 *
 * NEW in v2 (Phase 7 - Comprehensive Tracking):
 * - heroes: Historical snapshots of hero roster (19 properties per hero)
 * - titans: Historical snapshots of titan roster (12 properties per titan)
 * - pets: Historical snapshots of pet collection (8 properties per pet)
 * - inventory: Complete inventory snapshots with denormalized counts
 * - questCompletions: Daily/weekly/event quest tracking
 * - missionProgress: Campaign progression (mutable)
 * - shopPurchases: Shop transaction history
 * - towerProgress: Tower climbing progress (mutable)
 * - expeditionBattles: PvE boss fight records
 * - resourceTransactions: Economic activity tracking
 * - guildActivities: Guild participation records
 *
 * NEW in v3 (Phase 8 - Upgrade & Activity Event Tracking):
 * - heroUpgrades: Hero upgrade events (level, star, color, skill, artifact, glyph, skin)
 * - titanUpgrades: Titan upgrade events (level, star, skill, artifact, skin)
 * - dailyQuestCompletions: Individual daily quest completion tracking
 * - guildQuestCompletions: Guild-specific quest completion tracking
 * - loginRewards: Daily login reward claims
 * - inventoryItemUsages: Consumable item usage events
 * - equipmentChanges: Hero equipment slot modifications
 *
 * NEW in v4 (Phase 9 - Live Activity Feed):
 * - activityEvents: Color-coded live event log (capped at 500 entries)
 */

class IndexedDBStorage {
	constructor() {
		this.dbName = 'OrganizedJihad';
		this.version = 7; // v7: Added activityEvents store for live activity feed
		this.db = null;
		/** @type {Promise<IDBDatabase>} Resolves once the DB is open and upgraded. */
		this.initPromise = this._openDatabase();
	}

	/**
	 * Public init() — idempotent.
	 * Multiple callers (index.js, gameTracker.init, apiMonitor.init) can all
	 * call this safely; they all share the single initPromise created in the
	 * constructor.
	 *
	 * @returns {Promise<IDBDatabase>}
	 */
	async init() {
		return this.initPromise;
	}

	/**
	 * Open the IndexedDB database (called once from the constructor).
	 * @returns {Promise<IDBDatabase>}
	 * @private
	 */
	_openDatabase() {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, this.version);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				this.db = request.result;
				resolve(this.db);
			};

			request.onupgradeneeded = (event) => {
				const db = event.target.result;

				// Create object stores (tables)
				if (!db.objectStoreNames.contains('snapshots')) {
					const snapshotStore = db.createObjectStore('snapshots', { keyPath: 'id', autoIncrement: true });
					snapshotStore.createIndex('timestamp', 'timestamp', { unique: false });
					snapshotStore.createIndex('playerId', 'playerId', { unique: false });
				}

				if (!db.objectStoreNames.contains('battles')) {
					const battleStore = db.createObjectStore('battles', { keyPath: 'id', autoIncrement: true });
					battleStore.createIndex('timestamp', 'timestamp', { unique: false });
					battleStore.createIndex('battleType', 'battleType', { unique: false });
					battleStore.createIndex('opponentId', 'opponentId', { unique: false });
					battleStore.createIndex('isWin', 'isWin', { unique: false });
				}

				if (!db.objectStoreNames.contains('chests')) {
					const chestStore = db.createObjectStore('chests', { keyPath: 'id', autoIncrement: true });
					chestStore.createIndex('timestamp', 'timestamp', { unique: false });
					chestStore.createIndex('chestType', 'chestType', { unique: false });
				}

				if (!db.objectStoreNames.contains('opponents')) {
					const opponentStore = db.createObjectStore('opponents', { keyPath: 'opponentId' });
					opponentStore.createIndex('opponentName', 'opponentName', { unique: false });
					opponentStore.createIndex('lastSeen', 'lastSeen', { unique: false });
				}

				if (!db.objectStoreNames.contains('goals')) {
					const goalStore = db.createObjectStore('goals', { keyPath: 'id', autoIncrement: true });
					goalStore.createIndex('isCompleted', 'isCompleted', { unique: false });
					goalStore.createIndex('type', 'type', { unique: false });
				}

				if (!db.objectStoreNames.contains('events')) {
					const eventStore = db.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
					eventStore.createIndex('eventDate', 'eventDate', { unique: false });
					eventStore.createIndex('isCompleted', 'isCompleted', { unique: false });
				}

				if (!db.objectStoreNames.contains('metadata')) {
					db.createObjectStore('metadata', { keyPath: 'key' });
				}

				// Heroes: Historical snapshots of hero roster
				if (!db.objectStoreNames.contains('heroes')) {
					const heroStore = db.createObjectStore('heroes', { keyPath: 'id', autoIncrement: true });
					heroStore.createIndex('heroId', 'heroId', { unique: false });
					heroStore.createIndex('playerId', 'playerId', { unique: false });
					heroStore.createIndex('timestamp', 'timestamp', { unique: false });
					heroStore.createIndex('heroName', 'heroName', { unique: false });
				}

				// Titans: Historical snapshots of titan roster
				if (!db.objectStoreNames.contains('titans')) {
					const titanStore = db.createObjectStore('titans', { keyPath: 'id', autoIncrement: true });
					titanStore.createIndex('titanId', 'titanId', { unique: false });
					titanStore.createIndex('playerId', 'playerId', { unique: false });
					titanStore.createIndex('timestamp', 'timestamp', { unique: false });
					titanStore.createIndex('titanName', 'titanName', { unique: false });
				}

				// Pets: Historical snapshots of pet collection
				if (!db.objectStoreNames.contains('pets')) {
					const petStore = db.createObjectStore('pets', { keyPath: 'id', autoIncrement: true });
					petStore.createIndex('petId', 'petId', { unique: false });
					petStore.createIndex('playerId', 'playerId', { unique: false });
					petStore.createIndex('timestamp', 'timestamp', { unique: false });
					petStore.createIndex('petName', 'petName', { unique: false });
				}

				// Inventory: Historical snapshots of complete inventory
				if (!db.objectStoreNames.contains('inventory')) {
					const inventoryStore = db.createObjectStore('inventory', { keyPath: 'id', autoIncrement: true });
					inventoryStore.createIndex('playerId', 'playerId', { unique: false });
					inventoryStore.createIndex('timestamp', 'timestamp', { unique: false });
				}

				// Quest Completions: Daily/weekly quest tracking
				if (!db.objectStoreNames.contains('questCompletions')) {
					const questStore = db.createObjectStore('questCompletions', { keyPath: 'id', autoIncrement: true });
					questStore.createIndex('playerId', 'playerId', { unique: false });
					questStore.createIndex('completedAt', 'completedAt', { unique: false });
					questStore.createIndex('questType', 'questType', { unique: false });
				}

				// Mission Progress: Campaign progression (mutable - updated in place)
				if (!db.objectStoreNames.contains('missionProgress')) {
					const missionStore = db.createObjectStore('missionProgress', { keyPath: 'missionId' });
					missionStore.createIndex('playerId', 'playerId', { unique: false });
					missionStore.createIndex('isHeroic', 'isHeroic', { unique: false });
				}

				// Shop Purchases: Shop transaction tracking
				if (!db.objectStoreNames.contains('shopPurchases')) {
					const shopStore = db.createObjectStore('shopPurchases', { keyPath: 'id', autoIncrement: true });
					shopStore.createIndex('playerId', 'playerId', { unique: false });
					shopStore.createIndex('purchasedAt', 'purchasedAt', { unique: false });
					shopStore.createIndex('shopType', 'shopType', { unique: false });
				}

				// Tower Progress: Tower climbing (mutable - updated in place)
				if (!db.objectStoreNames.contains('towerProgress')) {
					const towerStore = db.createObjectStore('towerProgress', { keyPath: 'towerType' });
					towerStore.createIndex('playerId', 'playerId', { unique: false });
					towerStore.createIndex('lastUpdate', 'lastUpdate', { unique: false });
				}

				// Expedition Battles: PvE boss fights
				if (!db.objectStoreNames.contains('expeditionBattles')) {
					const expeditionStore = db.createObjectStore('expeditionBattles', {
						keyPath: 'id',
						autoIncrement: true,
					});
					expeditionStore.createIndex('playerId', 'playerId', { unique: false });
					expeditionStore.createIndex('timestamp', 'timestamp', { unique: false });
					expeditionStore.createIndex('expeditionId', 'expeditionId', { unique: false });
				}

				// Resource Transactions: Economic tracking
				if (!db.objectStoreNames.contains('resourceTransactions')) {
					const resourceStore = db.createObjectStore('resourceTransactions', {
						keyPath: 'id',
						autoIncrement: true,
					});
					resourceStore.createIndex('playerId', 'playerId', { unique: false });
					resourceStore.createIndex('timestamp', 'timestamp', { unique: false });
					resourceStore.createIndex('resourceType', 'resourceType', { unique: false });
				}

				// Guild Activities: Guild participation tracking
				if (!db.objectStoreNames.contains('guildActivities')) {
					const guildStore = db.createObjectStore('guildActivities', { keyPath: 'id', autoIncrement: true });
					guildStore.createIndex('playerId', 'playerId', { unique: false });
					guildStore.createIndex('timestamp', 'timestamp', { unique: false });
					guildStore.createIndex('activityType', 'activityType', { unique: false });
					guildStore.createIndex('guildId', 'guildId', { unique: false });
				}

				// Chat messages: Guild, private, adventure, and AoC chat tracking
				// Reference: https://hw-mobile.fandom.com/wiki/Chat
				if (!db.objectStoreNames.contains('chatMessages')) {
					const chatStore = db.createObjectStore('chatMessages', { keyPath: 'id', autoIncrement: true });
					chatStore.createIndex('timestamp', 'timestamp', { unique: false });
					chatStore.createIndex('chatType', 'chatType', { unique: false });
					chatStore.createIndex('conversationId', 'conversationId', { unique: false });
					chatStore.createIndex('senderId', 'senderId', { unique: false });
					chatStore.createIndex('isOutgoing', 'isOutgoing', { unique: false });
					chatStore.createIndex('serverMessageId', 'serverMessageId', { unique: false });
				}

				// Guild member roster tracking
				// Reference: https://hw-mobile.fandom.com/wiki/Guild
				if (!db.objectStoreNames.contains('guildMembers')) {
					const memberStore = db.createObjectStore('guildMembers', { keyPath: 'playerId' });
					memberStore.createIndex('guildId', 'guildId', { unique: false });
					memberStore.createIndex('playerName', 'playerName', { unique: false });
					memberStore.createIndex('isActive', 'isActive', { unique: false });
					memberStore.createIndex('lastOnline', 'lastOnline', { unique: false });
					memberStore.createIndex('guildRank', 'guildRank', { unique: false });
				}

				// Guild member historical snapshots
				if (!db.objectStoreNames.contains('guildMemberSnapshots')) {
					const snapshotStore = db.createObjectStore('guildMemberSnapshots', { keyPath: 'id', autoIncrement: true });
					snapshotStore.createIndex('timestamp', 'timestamp', { unique: false });
					snapshotStore.createIndex('playerId', 'playerId', { unique: false });
					snapshotStore.createIndex('guildId', 'guildId', { unique: false });
				}

				// Guild War participation per member
				if (!db.objectStoreNames.contains('guildWarParticipations')) {
					const warStore = db.createObjectStore('guildWarParticipations', { keyPath: 'id', autoIncrement: true });
					warStore.createIndex('warId', 'warId', { unique: false });
					warStore.createIndex('warDate', 'warDate', { unique: false });
					warStore.createIndex('playerId', 'playerId', { unique: false });
					warStore.createIndex('guildId', 'guildId', { unique: false });
					warStore.createIndex('participated', 'participated', { unique: false });
				}

				// Guild Raid participation per member
				if (!db.objectStoreNames.contains('guildRaidParticipations')) {
					const raidStore = db.createObjectStore('guildRaidParticipations', { keyPath: 'id', autoIncrement: true });
					raidStore.createIndex('raidId', 'raidId', { unique: false });
					raidStore.createIndex('raidDate', 'raidDate', { unique: false });
					raidStore.createIndex('playerId', 'playerId', { unique: false });
					raidStore.createIndex('guildId', 'guildId', { unique: false });
					raidStore.createIndex('bossName', 'bossName', { unique: false });
					raidStore.createIndex('participated', 'participated', { unique: false });
				}

				// Guild Dungeon participation per member
				if (!db.objectStoreNames.contains('guildDungeonParticipations')) {
					const dungeonStore = db.createObjectStore('guildDungeonParticipations', { keyPath: 'id', autoIncrement: true });
					dungeonStore.createIndex('dungeonId', 'dungeonId', { unique: false });
					dungeonStore.createIndex('dungeonDate', 'dungeonDate', { unique: false });
					dungeonStore.createIndex('playerId', 'playerId', { unique: false });
					dungeonStore.createIndex('guildId', 'guildId', { unique: false });
					dungeonStore.createIndex('participated', 'participated', { unique: false });
				}

				// Titanite transactions (donations, earnings, spending)
				if (!db.objectStoreNames.contains('titaniteTransactions')) {
					const titaniteStore = db.createObjectStore('titaniteTransactions', { keyPath: 'id', autoIncrement: true });
					titaniteStore.createIndex('timestamp', 'timestamp', { unique: false });
					titaniteStore.createIndex('playerId', 'playerId', { unique: false });
					titaniteStore.createIndex('guildId', 'guildId', { unique: false });
					titaniteStore.createIndex('transactionType', 'transactionType', { unique: false });
					titaniteStore.createIndex('source', 'source', { unique: false });
				}

				// API Logs: Comprehensive API monitoring logs
				// Reference: For API discovery and debugging
				if (!db.objectStoreNames.contains('apiLogs')) {
					const apiLogsStore = db.createObjectStore('apiLogs', { keyPath: 'id', autoIncrement: true });
					apiLogsStore.createIndex('timestamp', 'timestamp', { unique: false });
					apiLogsStore.createIndex('type', 'type', { unique: false }); // 'request' or 'response'
					apiLogsStore.createIndex('url', 'url', { unique: false });
					apiLogsStore.createIndex('status', 'status', { unique: false });
				}

				// === Phase 8: Upgrade & Activity Event Tracking ===

				// Hero Upgrades: Individual hero upgrade events (level, star, color, skill, artifact, glyph, skin)
				// Matches C# HeroUpgradeBase-derived entities in data/Models/HeroUpgradeModels.cs
				if (!db.objectStoreNames.contains('heroUpgrades')) {
					const heroUpgradeStore = db.createObjectStore('heroUpgrades', { keyPath: 'id', autoIncrement: true });
					heroUpgradeStore.createIndex('timestamp', 'timestamp', { unique: false });
					heroUpgradeStore.createIndex('heroId', 'heroId', { unique: false });
					heroUpgradeStore.createIndex('playerId', 'playerId', { unique: false });
					heroUpgradeStore.createIndex('upgradeType', 'upgradeType', { unique: false }); // 'level', 'star', 'color', 'skill', 'artifact', 'glyph', 'skin'
				}

				// Titan Upgrades: Individual titan upgrade events (level, star, skill, artifact, skin)
				// Matches C# TitanUpgradeBase-derived entities in data/Models/TitanUpgradeModels.cs
				if (!db.objectStoreNames.contains('titanUpgrades')) {
					const titanUpgradeStore = db.createObjectStore('titanUpgrades', { keyPath: 'id', autoIncrement: true });
					titanUpgradeStore.createIndex('timestamp', 'timestamp', { unique: false });
					titanUpgradeStore.createIndex('titanId', 'titanId', { unique: false });
					titanUpgradeStore.createIndex('playerId', 'playerId', { unique: false });
					titanUpgradeStore.createIndex('upgradeType', 'upgradeType', { unique: false }); // 'level', 'star', 'skill', 'artifact', 'skin'
				}

				// Daily Quest Completions: Individual daily quest tracking
				// Matches C# DailyQuestCompletion in data/Models/DailyActivityModels.cs
				if (!db.objectStoreNames.contains('dailyQuestCompletions')) {
					const dailyQuestStore = db.createObjectStore('dailyQuestCompletions', { keyPath: 'id', autoIncrement: true });
					dailyQuestStore.createIndex('completedAt', 'completedAt', { unique: false });
					dailyQuestStore.createIndex('questDate', 'questDate', { unique: false });
					dailyQuestStore.createIndex('questId', 'questId', { unique: false });
					dailyQuestStore.createIndex('playerId', 'playerId', { unique: false });
				}

				// Guild Quest Completions: Guild-specific quest tracking
				// Matches C# GuildQuestCompletion in data/Models/DailyActivityModels.cs
				if (!db.objectStoreNames.contains('guildQuestCompletions')) {
					const guildQuestStore = db.createObjectStore('guildQuestCompletions', { keyPath: 'id', autoIncrement: true });
					guildQuestStore.createIndex('completedAt', 'completedAt', { unique: false });
					guildQuestStore.createIndex('questDate', 'questDate', { unique: false });
					guildQuestStore.createIndex('questId', 'questId', { unique: false });
					guildQuestStore.createIndex('playerId', 'playerId', { unique: false });
					guildQuestStore.createIndex('guildId', 'guildId', { unique: false });
				}

				// Login Rewards: Daily login reward claims
				// Matches C# LoginReward in data/Models/DailyActivityModels.cs
				if (!db.objectStoreNames.contains('loginRewards')) {
					const loginStore = db.createObjectStore('loginRewards', { keyPath: 'id', autoIncrement: true });
					loginStore.createIndex('claimedAt', 'claimedAt', { unique: false });
					loginStore.createIndex('playerId', 'playerId', { unique: false });
					loginStore.createIndex('dayNumber', 'dayNumber', { unique: false });
				}

				// Inventory Item Usages: Consumable item usage events
				// Matches C# InventoryItemUsage in data/Models/InventoryModels.cs
				if (!db.objectStoreNames.contains('inventoryItemUsages')) {
					const itemUsageStore = db.createObjectStore('inventoryItemUsages', { keyPath: 'id', autoIncrement: true });
					itemUsageStore.createIndex('timestamp', 'timestamp', { unique: false });
					itemUsageStore.createIndex('playerId', 'playerId', { unique: false });
					itemUsageStore.createIndex('itemId', 'itemId', { unique: false });
					itemUsageStore.createIndex('category', 'category', { unique: false });
				}

				// Equipment Changes: Hero equipment slot modifications
				// Matches C# EquipmentChange in data/Models/InventoryModels.cs
				if (!db.objectStoreNames.contains('equipmentChanges')) {
					const equipChangeStore = db.createObjectStore('equipmentChanges', { keyPath: 'id', autoIncrement: true });
					equipChangeStore.createIndex('timestamp', 'timestamp', { unique: false });
					equipChangeStore.createIndex('heroId', 'heroId', { unique: false });
					equipChangeStore.createIndex('playerId', 'playerId', { unique: false });
					equipChangeStore.createIndex('changeType', 'changeType', { unique: false }); // 'equipped', 'upgraded', 'consumed'
				}

				// === Phase 9: Live Activity Feed ===

				// Activity Events: Color-coded live event log, capped at 500 entries.
				// Each event has a type (battle, resource, hero, chest, info, error),
				// a human-readable message, and a timestamp.
				if (!db.objectStoreNames.contains('activityEvents')) {
					const activityStore = db.createObjectStore('activityEvents', { keyPath: 'id', autoIncrement: true });
					activityStore.createIndex('timestamp', 'timestamp', { unique: false });
					activityStore.createIndex('eventType', 'eventType', { unique: false });
				}
			};
		});
	}

	/**
	 * Add a record to a store
	 * @param {string} storeName - Object store name
	 * @param {object} data - Data to add
	 * @returns {Promise<number>} - ID of added record
	 */
	async add(storeName, data) {
		await this.initPromise;
		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction([storeName], 'readwrite');
			const store = transaction.objectStore(storeName);
			const request = store.add(data);

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Update or insert a record (upsert)
	 * @param {string} storeName - Object store name
	 * @param {object} data - Data to put
	 * @returns {Promise<number>} - ID of updated record
	 */
	async put(storeName, data) {
		await this.initPromise;
		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction([storeName], 'readwrite');
			const store = transaction.objectStore(storeName);
			const request = store.put(data);

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Get a record by key
	 * @param {string} storeName - Object store name
	 * @param {any} key - Record key
	 * @returns {Promise<object>} - Retrieved record
	 */
	async get(storeName, key) {
		await this.initPromise;
		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction([storeName], 'readonly');
			const store = transaction.objectStore(storeName);
			const request = store.get(key);

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Get all records from a store
	 * @param {string} storeName - Object store name
	 * @param {number} limit - Optional limit
	 * @returns {Promise<Array>} - Array of records
	 */
	async getAll(storeName, limit = null) {
		await this.initPromise;
		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction([storeName], 'readonly');
			const store = transaction.objectStore(storeName);
			const request = limit ? store.getAll(null, limit) : store.getAll();

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Query records using an index
	 * @param {string} storeName - Object store name
	 * @param {string} indexName - Index name
	 * @param {any} value - Value to query
	 * @returns {Promise<Array>} - Matching records
	 */
	async getByIndex(storeName, indexName, value) {
		await this.initPromise;
		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction([storeName], 'readonly');
			const store = transaction.objectStore(storeName);
			const index = store.index(indexName);
			const request = index.getAll(value);

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Get a paginated slice of records from a store, optionally via an index.
	 *
	 * Uses a cursor internally so only the requested page is materialised,
	 * keeping memory usage bounded regardless of total store size.
	 *
	 * @param {string} storeName  - Object store name
	 * @param {object} [opts]     - Pagination options
	 * @param {number} [opts.offset=0]    - Records to skip
	 * @param {number} [opts.limit=25]    - Max records to return
	 * @param {string} [opts.indexName]   - Optional index to iterate
	 * @param {string} [opts.direction='prev'] - Cursor direction ('next'|'prev')
	 * @returns {Promise<Array>} - Page of records
	 */
	async getPage(storeName, opts = {}) {
		await this.initPromise;
		const { offset = 0, limit = 25, indexName = null, direction = 'prev' } = opts;

		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction([storeName], 'readonly');
			const store = transaction.objectStore(storeName);
			const source = indexName ? store.index(indexName) : store;
			const request = source.openCursor(null, direction);
			const results = [];
			let skipped = 0;

			request.onsuccess = (event) => {
				const cursor = event.target.result;
				if (!cursor) {
					resolve(results);
					return;
				}
				if (skipped < offset) {
					skipped++;
					cursor.continue();
					return;
				}
				if (results.length < limit) {
					results.push(cursor.value);
					cursor.continue();
				} else {
					resolve(results);
				}
			};
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Delete a record
	 * @param {string} storeName - Object store name
	 * @param {any} key - Record key
	 * @returns {Promise<void>}
	 */
	async delete(storeName, key) {
		await this.initPromise;
		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction([storeName], 'readwrite');
			const store = transaction.objectStore(storeName);
			const request = store.delete(key);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Clear all records from a store
	 * @param {string} storeName - Object store name
	 * @returns {Promise<void>}
	 */
	async clear(storeName) {
		await this.initPromise;
		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction([storeName], 'readwrite');
			const store = transaction.objectStore(storeName);
			const request = store.clear();

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Count records in a store
	 * @param {string} storeName - Object store name
	 * @returns {Promise<number>} - Record count
	 */
	async count(storeName) {
		await this.initPromise;
		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction([storeName], 'readonly');
			const store = transaction.objectStore(storeName);
			const request = store.count();

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Save metadata (like last sync timestamp)
	 * @param {string} key - Metadata key
	 * @param {any} value - Metadata value
	 */
	async setMetadata(key, value) {
		await this.put('metadata', {
			key,
			value,
			updatedAt: new Date().toISOString(),
		});
	}

	/**
	 * Get metadata
	 * @param {string} key - Metadata key
	 * @param {any} defaultValue - Default value
	 */
	async getMetadata(key, defaultValue = null) {
		const record = await this.get('metadata', key);
		return record ? record.value : defaultValue;
	}

	/**
	 * Get recent snapshots
	 * @param {number} limit - Number of snapshots
	 * @returns {Promise<Array>}
	 */
	async getRecentSnapshots(limit = 10) {
		await this.initPromise;
		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction(['snapshots'], 'readonly');
			const store = transaction.objectStore('snapshots');
			const index = store.index('timestamp');
			const request = index.openCursor(null, 'prev'); // Descending order
			const results = [];

			request.onsuccess = (event) => {
				const cursor = event.target.result;
				if (cursor && results.length < limit) {
					results.push(cursor.value);
					cursor.continue();
				} else {
					resolve(results);
				}
			};
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Get battle statistics
	 * @returns {Promise<object>} - Battle stats
	 */
	async getBattleStats() {
		const battles = await this.getAll('battles');
		const stats = {
			total: battles.length,
			wins: battles.filter((b) => b.isWin).length,
			losses: battles.filter((b) => !b.isWin).length,
			byType: {},
		};

		for (const battle of battles) {
			if (!stats.byType[battle.battleType]) {
				stats.byType[battle.battleType] = { total: 0, wins: 0, losses: 0 };
			}
			stats.byType[battle.battleType].total++;
			if (battle.isWin) {
				stats.byType[battle.battleType].wins++;
			} else {
				stats.byType[battle.battleType].losses++;
			}
		}

		return stats;
	}

	/**
	 * Save API monitoring logs to IndexedDB
	 * Used by APIMonitor module for persistent API call tracking
	 *
	 * @param {Object} logData - API log data containing logs, endpoints, and stats
	 * @returns {Promise<void>}
	 */
	async saveAPILogs(logData) {
		try {
			await this.ensureDB();

			const transaction = this.db.transaction(['metadata'], 'readwrite');
			const metadataStore = transaction.objectStore('metadata');

			// Store the log data in metadata store
			await metadataStore.put({
				key: 'apiMonitorLogs',
				value: logData,
				timestamp: Date.now(),
			});

			await transaction.complete;
		} catch (error) {
			console.error('[IndexedDBStorage] Failed to save API logs:', error);
			throw error;
		}
	}

	/**
	 * Get saved API monitoring logs from IndexedDB
	 *
	 * @returns {Promise<Object|null>} Saved API log data or null if not found
	 */
	async getAPILogs() {
		try {
			await this.ensureDB();

			const data = await this.get('metadata', 'apiMonitorLogs');
			return data ? data.value : null;
		} catch (error) {
			console.error('[IndexedDBStorage] Failed to load API logs:', error);
			return null;
		}
	}

	/**
	 * Save individual API log entries to the apiLogs store
	 * Used for bulk storage of API calls
	 *
	 * @param {Array} logEntries - Array of log entries to save
	 * @returns {Promise<void>}
	 */
	async saveAPILogEntries(logEntries) {
		try {
			await this.ensureDB();

			const transaction = this.db.transaction(['apiLogs'], 'readwrite');
			const apiLogsStore = transaction.objectStore('apiLogs');

			for (const entry of logEntries) {
				await apiLogsStore.add({
					...entry,
					savedAt: Date.now(),
				});
			}

			await transaction.complete;
		} catch (error) {
			console.error('[IndexedDBStorage] Failed to save API log entries:', error);
			throw error;
		}
	}

	/**
	 * Get API log entries with optional filtering
	 *
	 * @param {Object} options - Query options
	 * @param {number} options.limit - Maximum number of entries to return
	 * @param {string} options.type - Filter by type ('request' or 'response')
	 * @param {string} options.url - Filter by URL pattern
	 * @returns {Promise<Array>} Array of API log entries
	 */
	async getAPILogEntries(options = {}) {
		try {
			await this.ensureDB();

			const limit = options.limit || 1000;
			let entries = await this.getAll('apiLogs', limit);

			// Apply filters if provided
			if (options.type) {
				entries = entries.filter((e) => e.type === options.type);
			}

			if (options.url) {
				entries = entries.filter((e) => e.url && e.url.includes(options.url));
			}

			return entries;
		} catch (error) {
			console.error('[IndexedDBStorage] Failed to load API log entries:', error);
			return [];
		}
	}

	/**
	 * Clear old API log entries to prevent database bloat
	 * Keeps only the most recent entries
	 *
	 * @param {number} keepCount - Number of entries to keep (default: 5000)
	 * @returns {Promise<number>} Number of entries deleted
	 */
	async clearOldAPILogs(keepCount = 5000) {
		try {
			await this.ensureDB();

			const allEntries = await this.getAll('apiLogs');

			if (allEntries.length <= keepCount) {
				return 0;
			}

			// Sort by timestamp descending and keep only the newest
			allEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
			const entriesToDelete = allEntries.slice(keepCount);

			const transaction = this.db.transaction(['apiLogs'], 'readwrite');
			const apiLogsStore = transaction.objectStore('apiLogs');

			for (const entry of entriesToDelete) {
				await apiLogsStore.delete(entry.id);
			}

			await transaction.complete;

			console.log(`[IndexedDBStorage] Deleted ${entriesToDelete.length} old API log entries`);
			return entriesToDelete.length;
		} catch (error) {
			console.error('[IndexedDBStorage] Failed to clear old API logs:', error);
			return 0;
		}
	}
}

export default IndexedDBStorage;
