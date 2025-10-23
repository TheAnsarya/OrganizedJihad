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
 */

class IndexedDBStorage {
	constructor() {
		this.dbName = 'OrganizedJihad';
		this.version = 4; // Incremented for new stores: guild member tracking
		this.db = null;
		this.initPromise = this.init();
	}

	/**
	 * Initialize IndexedDB
	 * @returns {Promise<IDBDatabase>}
	 */
	async init() {
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
}

export default IndexedDBStorage;
