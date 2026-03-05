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
 *
 * NEW in v5 (Phase 10 - Consumable Reward Tracking):
 * - consumableRewards: Individual drop records from chests/loot boxes for
 *   drop-rate analysis. Each record links to a parent chest opening and
 *   records the item type, item ID, quantity, and source.
 *
 * NEW in v11 (Phase 14 - Adventure Guide / Battle Tracking Overhaul #131):
 * - adventureGuide: Per-node winning team recommendations built from
 *   battle history. Keyed by nodeId (mission ID), stores an array of
 *   team compositions that have beaten each node.
 */

class IndexedDBStorage {
	constructor() {
		this.dbName = 'OrganizedJihad';
		this.version = 11; // v11: Added adventureGuide store for node recommendations (#131)
		this.db = null;
		/**
		 * True when the browser has closed the connection (via db.onclose) or
		 * another tab triggered a version change (via db.onversionchange).
		 * CRUD methods check this flag and transparently reconnect.
		 * @type {boolean}
		 */
		this._dbClosed = false;
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
	 * Re-open the database after an unexpected close or version-change event.
	 * Replaces `initPromise` so that in-flight and future CRUD calls
	 * transparently wait for the new connection.
	 *
	 * @returns {Promise<IDBDatabase>}
	 * @private
	 */
	_reconnect() {
		console.log('[IndexedDBStorage] Reconnecting to IndexedDB…');
		this.initPromise = this._openDatabase();
		return this.initPromise;
	}

	/**
	 * Ensure a live database connection is available before creating a
	 * transaction. If the connection was closed (by the browser or by a
	 * version-change from another tab), this transparently reconnects.
	 *
	 * Every CRUD method should `await this._ensureDb()` instead of the
	 * bare `await this.initPromise`.
	 *
	 * @returns {Promise<IDBDatabase>}
	 * @private
	 */
	async _ensureDb() {
		await this.initPromise;
		if (this._dbClosed) {
			return this._reconnect();
		}
		return this.db;
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
				this._dbClosed = false;

				// --- Defensive handlers for connection loss (#129) ---

				/**
				 * Fired when the browser unexpectedly closes the connection
				 * (e.g. the storage backend is reclaimed, or the profile is
				 * deleted). Mark closed so _ensureDb() will reconnect on the
				 * next CRUD call.
				 */
				this.db.onclose = () => {
					console.warn('[IndexedDBStorage] Database connection closed unexpectedly — will reconnect on next operation');
					this._dbClosed = true;
				};

				/**
				 * Fired when another tab (or this tab after a page reload)
				 * opens the same database with a higher version number. The
				 * spec requires us to close our connection so the upgrade can
				 * proceed. The next CRUD call will transparently reconnect
				 * at the new version.
				 */
				this.db.onversionchange = () => {
					console.warn('[IndexedDBStorage] Database version change detected (another tab upgraded) — closing connection');
					this.db.close();
					this._dbClosed = true;
				};

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

				// === Phase 10: Consumable Reward / Drop-Rate Tracking ===

				// Individual reward drops from chests, loot boxes, artifact chests, etc.
				// Each record represents one item received from a consumable opening.
				// Enables drop-rate calculation: (dropCount for item / total openings) * 100
				if (!db.objectStoreNames.contains('consumableRewards')) {
					const rewardStore = db.createObjectStore('consumableRewards', { keyPath: 'id', autoIncrement: true });
					rewardStore.createIndex('timestamp', 'timestamp', { unique: false });
					rewardStore.createIndex('sourceType', 'sourceType', { unique: false }); // 'artifactChest', 'titanArtifactChest', 'petChest', 'lootBox', 'towerChest', 'outlandChest', 'genericChest'
					rewardStore.createIndex('sourceId', 'sourceId', { unique: false });   // chestId or consumable libId
					rewardStore.createIndex('itemType', 'itemType', { unique: false });   // 'consumable', 'gear', 'gold', 'starmoney', 'fragmentHero', 'fragmentTitan', 'coin', 'petCard', etc.
					rewardStore.createIndex('itemId', 'itemId', { unique: false });       // Specific item ID within the type
					rewardStore.createIndex('openingId', 'openingId', { unique: false }); // FK to chests store id
				}

				// === Phase 11: Dedicated Error Log Store (#28) ===

				// Structured error records with context, stack traces, and
				// timestamps. Replaces the old metadata-based error log which
				// was limited to 50 entries in a single JSON blob. The dedicated
				// store enables indexed queries, proper purge via retention
				// policies, and larger capacity (200 entries).
				if (!db.objectStoreNames.contains('errorLog')) {
					const errorStore = db.createObjectStore('errorLog', { keyPath: 'id', autoIncrement: true });
					errorStore.createIndex('timestamp', 'timestamp', { unique: false });
					errorStore.createIndex('context', 'context', { unique: false });
				}

				// === Phase 12: Mail Reward Tracking (#94) ===

				// Mail items collected from in-game mailbox.
				// Tracks each mail message and its attached rewards/items when
				// read or collected. Enables reward source analysis and resource
				// tracking from mail-based distributions (events, compensation,
				// daily login bonuses delivered via mail, etc.).
				if (!db.objectStoreNames.contains('mailRewards')) {
					const mailStore = db.createObjectStore('mailRewards', { keyPath: 'id', autoIncrement: true });
					mailStore.createIndex('timestamp', 'timestamp', { unique: false });
					mailStore.createIndex('mailId', 'mailId', { unique: false });
					mailStore.createIndex('mailType', 'mailType', { unique: false });
					mailStore.createIndex('playerId', 'playerId', { unique: false });
				}

				// === Phase 14: Adventure Guide — Node Recommendations (#131) ===

				// Stores successful team compositions per adventure node (mission ID).
				// When we win a battle with battleType 'Adventure', we record the
				// player's team and the enemy team for that node. Over time this
				// builds a database of "teams that work" for each adventure node.
				if (!db.objectStoreNames.contains('adventureGuide')) {
					const guideStore = db.createObjectStore('adventureGuide', { keyPath: 'id', autoIncrement: true });
					guideStore.createIndex('nodeId', 'nodeId', { unique: false });
					guideStore.createIndex('timestamp', 'timestamp', { unique: false });
					guideStore.createIndex('isWin', 'isWin', { unique: false });
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
		await this._ensureDb();
		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction([storeName], 'readwrite');
			const store = transaction.objectStore(storeName);
			const request = store.add(data);

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Add multiple records in a single IDB transaction.
	 * Much faster than calling `add()` per record because it avoids
	 * per-record transaction overhead. ConstraintErrors on individual
	 * writes are silently skipped (prevents duplicates without aborting). (#141)
	 *
	 * @param {string} storeName - Object store name
	 * @param {Array<object>} records - Array of records to insert
	 * @returns {Promise<number[]>} - Array of generated keys (0 for skipped records)
	 */
	async addBatch(storeName, records) {
		if (!records || records.length === 0) return [];
		await this._ensureDb();
		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction([storeName], 'readwrite');
			const store = transaction.objectStore(storeName);
			const keys = new Array(records.length).fill(0);

			for (let i = 0; i < records.length; i++) {
				const req = store.add(records[i]);
				const idx = i;
				req.onsuccess = () => { keys[idx] = req.result; };
				req.onerror = (e) => {
					// Prevent any individual add() error from aborting
					// the entire transaction — committed writes survive. (#151)
					e.preventDefault();
					if (req.error?.name !== 'ConstraintError') {
						console.warn(`[OJ] addBatch: non-duplicate error on record ${idx}:`, req.error);
					}
				};
			}

			transaction.oncomplete = () => resolve(keys);
			transaction.onerror = () => reject(transaction.error);
		});
	}

	/**
	 * Put multiple records (upsert) in a single IDB transaction. (#141)
	 *
	 * @param {string} storeName - Object store name
	 * @param {Array<object>} records - Array of records to upsert
	 * @returns {Promise<number[]>} - Array of generated/existing keys
	 */
	async putBatch(storeName, records) {
		if (!records || records.length === 0) return [];
		await this._ensureDb();
		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction([storeName], 'readwrite');
			const store = transaction.objectStore(storeName);
			const keys = new Array(records.length).fill(0);

			for (let i = 0; i < records.length; i++) {
				const req = store.put(records[i]);
				const idx = i;
				req.onsuccess = () => { keys[idx] = req.result; };
			}

			transaction.oncomplete = () => resolve(keys);
			transaction.onerror = () => reject(transaction.error);
		});
	}

	/**
	 * Update or insert a record (upsert)
	 * @param {string} storeName - Object store name
	 * @param {object} data - Data to put
	 * @returns {Promise<number>} - ID of updated record
	 */
	async put(storeName, data) {
		await this._ensureDb();
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
		await this._ensureDb();
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
		await this._ensureDb();
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
		await this._ensureDb();
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
	 * Query records using an index with an {@link IDBKeyRange} bound.
	 *
	 * This is far more efficient than `getAll()` + `.filter()` because
	 * IndexedDB only materialises matching rows — no full-table scan.
	 *
	 * @param {string} storeName  - Object store name
	 * @param {string} indexName  - Index name (must exist on the store)
	 * @param {object} [opts]     - Range options
	 * @param {any}    [opts.lower]      - Lower bound value (inclusive by default)
	 * @param {any}    [opts.upper]      - Upper bound value (inclusive by default)
	 * @param {boolean} [opts.lowerOpen=false] - Exclude lower bound
	 * @param {boolean} [opts.upperOpen=false] - Exclude upper bound
	 * @returns {Promise<Array>} - Matching records within the range
	 */
	async getByIndexRange(storeName, indexName, opts = {}) {
		await this._ensureDb();
		const { lower, upper, lowerOpen = false, upperOpen = false } = opts;

		let range = null;
		if (lower !== undefined && upper !== undefined) {
			range = IDBKeyRange.bound(lower, upper, lowerOpen, upperOpen);
		} else if (lower !== undefined) {
			range = IDBKeyRange.lowerBound(lower, lowerOpen);
		} else if (upper !== undefined) {
			range = IDBKeyRange.upperBound(upper, upperOpen);
		}

		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction([storeName], 'readonly');
			const store = transaction.objectStore(storeName);
			const index = store.index(indexName);
			const request = index.getAll(range);

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
		await this._ensureDb();
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
	 * Cap a store at `maxRecords` by deleting the oldest entries (by index
	 * order) in a **single** IDB transaction.  Uses `count()` first to
	 * short-circuit when the store is already within bounds, so no full-
	 * table scan is needed on the hot path.
	 *
	 * Much cheaper than `getAll()` + sort + per-record `delete()`.
	 *
	 * @param {string} storeName  - Object store name
	 * @param {string} indexName  - Index to sort by (ascending oldest→newest)
	 * @param {number} maxRecords - Maximum records to keep
	 * @returns {Promise<number>} Number of records deleted
	 */
	async pruneOldest(storeName, indexName, maxRecords) {
		await this._ensureDb();

		const total = await this.count(storeName);
		const excess = total - maxRecords;
		if (excess <= 0) return 0;

		return new Promise((resolve, reject) => {
			const tx = this.db.transaction([storeName], 'readwrite');
			const store = tx.objectStore(storeName);
			const index = store.index(indexName);
			const request = index.openCursor(null, 'next'); // ascending (oldest first)
			let deleted = 0;

			request.onsuccess = (event) => {
				const cursor = event.target.result;
				if (!cursor || deleted >= excess) {
					resolve(deleted);
					return;
				}
				cursor.delete();
				deleted++;
				cursor.continue();
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
		await this._ensureDb();
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
		await this._ensureDb();
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
		await this._ensureDb();
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
		await this._ensureDb();
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
	 * Get battle statistics using an IndexedDB cursor to avoid loading
	 * every record into memory at once (fixes #150).
	 *
	 * An optional time boundary limits the scan to recent records,
	 * keeping both CPU and memory use proportional to the window size
	 * rather than total store size.
	 *
	 * @param {object}  [opts]              - Options
	 * @param {string}  [opts.since]        - ISO-8601 lower bound on timestamp (inclusive)
	 * @param {string}  [opts.until]        - ISO-8601 upper bound on timestamp (inclusive)
	 * @returns {Promise<object>} - Battle stats (total, wins, losses, byType)
	 */
	async getBattleStats(opts = {}) {
		await this._ensureDb();

		const { since, until } = opts;

		// Build an optional IDBKeyRange on the 'timestamp' index
		let range = null;
		if (since && until) {
			range = IDBKeyRange.bound(since, until);
		} else if (since) {
			range = IDBKeyRange.lowerBound(since);
		} else if (until) {
			range = IDBKeyRange.upperBound(until);
		}

		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction(['battles'], 'readonly');
			const store = transaction.objectStore('battles');
			// When a time range is specified, walk the 'timestamp' index;
			// otherwise iterate the raw store (no index needed).
			const source = range ? store.index('timestamp') : store;
			const request = source.openCursor(range);

			const stats = {
				total: 0,
				wins: 0,
				losses: 0,
				byType: {},
			};

			request.onsuccess = (event) => {
				const cursor = event.target.result;
				if (cursor) {
					const battle = cursor.value;
					stats.total++;
					if (battle.isWin) {
						stats.wins++;
					} else {
						stats.losses++;
					}

					const type = battle.battleType;
					if (!stats.byType[type]) {
						stats.byType[type] = { total: 0, wins: 0, losses: 0 };
					}
					stats.byType[type].total++;
					if (battle.isWin) {
						stats.byType[type].wins++;
					} else {
						stats.byType[type].losses++;
					}

					cursor.continue();
				} else {
					// Cursor exhausted — return accumulated stats
					resolve(stats);
				}
			};

			request.onerror = () => reject(request.error);
		});
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
			await this._ensureDb();

			// Delegate to put() which already uses proper Promise wrapping (#84)
			await this.put('metadata', {
				key: 'apiMonitorLogs',
				value: logData,
				timestamp: Date.now(),
			});
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
			await this._ensureDb();

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
			await this._ensureDb();

			// Use proper Promise wrapping for IDB transaction (#84)
			return new Promise((resolve, reject) => {
				const transaction = this.db.transaction(['apiLogs'], 'readwrite');
				const apiLogsStore = transaction.objectStore('apiLogs');

				for (const entry of logEntries) {
					apiLogsStore.add({
						...entry,
						savedAt: Date.now(),
					});
				}

				transaction.oncomplete = () => resolve();
				transaction.onerror = () => reject(transaction.error);
			});
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
			await this._ensureDb();

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
	 * Clear old API log entries to prevent database bloat.
	 * Keeps only the most recent entries. Delegates to {@link pruneOldest}
	 * for efficient cursor-based deletion instead of loading all records.
	 *
	 * @param {number} keepCount - Number of entries to keep (default: 5000)
	 * @returns {Promise<number>} Number of entries deleted
	 */
	async clearOldAPILogs(keepCount = 5000) {
		try {
			return await this.pruneOldest('apiLogs', 'timestamp', keepCount);
		} catch (error) {
			console.error('[IndexedDBStorage] Failed to clear old API logs:', error);
			return 0;
		}
	}

	// =====================================================================
	// Automatic Data Purge (#45)
	// =====================================================================

	/**
	 * Default retention periods (in days) per store type.
	 * Can be overridden via the `retentionOverrides` parameter.
	 *
	 * @static
	 * @type {Object<string, number>}
	 */
	static DEFAULT_RETENTION = {
		// Battles, replays, expeditions — 90 days
		battles: 90,
		expeditionBattles: 90,

		// Snapshots — 30 days
		snapshots: 30,
		heroes: 30,
		titans: 30,
		pets: 30,
		inventory: 30,
		guildMemberSnapshots: 30,

		// Activity logs — 30 days
		chatMessages: 30,
		activityEvents: 30,
		resourceTransactions: 30,
		guildActivities: 30,
		questCompletions: 30,
		shopPurchases: 30,
		chests: 30,
		consumableRewards: 30,
		dailyQuestCompletions: 30,
		guildQuestCompletions: 30,
		loginRewards: 30,
		inventoryItemUsages: 30,
		equipmentChanges: 30,
		heroUpgrades: 90,
		titanUpgrades: 90,
		guildWarParticipations: 90,
		guildRaidParticipations: 90,
		guildDungeonParticipations: 90,
		titaniteTransactions: 30,

		// API logs — 7 days
		apiLogs: 7,

		// Error log — 30 days
		errorLog: 30,
	};

	/**
	 * Purge records older than the configured retention period from all stores.
	 *
	 * Iterates each store that has a `timestamp` index, opens a cursor over
	 * records older than the cutoff, and deletes them. Returns a summary
	 * of how many records were removed per store.
	 *
	 * @param {Object<string, number>} [retentionOverrides] - Per-store retention
	 *   overrides in days. Keys are store names, values are day counts.
	 * @returns {Promise<Object<string, number>>} Map of storeName → deletedCount
	 */
	async purgeOldRecords(retentionOverrides = {}) {
		await this._ensureDb();
		const retention = { ...IndexedDBStorage.DEFAULT_RETENTION, ...retentionOverrides };
		const summary = {};
		const now = Date.now();

		for (const [storeName, days] of Object.entries(retention)) {
			if (!this.db.objectStoreNames.contains(storeName)) continue;

			const cutoffMs = now - days * 24 * 60 * 60 * 1000;
			const cutoffISO = new Date(cutoffMs).toISOString();

			try {
				const deleted = await this._purgeStoreBefore(storeName, cutoffMs, cutoffISO);
				if (deleted > 0) {
					summary[storeName] = deleted;
				}
			} catch (error) {
				console.error(`[IndexedDBStorage] purge failed for ${storeName}:`, error);
			}
		}

		const total = Object.values(summary).reduce((a, b) => a + b, 0);
		if (total > 0) {
			console.log(`[IndexedDBStorage] Purged ${total} old record(s):`, summary);
		}
		return summary;
	}

	/**
	 * Delete all records in a store whose timestamp is older than the cutoff.
	 *
	 * Uses the `timestamp` index when available for more efficient cursor
	 * traversal (#P3). Falls back to full-cursor scan for stores without
	 * a timestamp index.
	 *
	 * @param {string} storeName - Object store name
	 * @param {number} cutoffMs - Cutoff as epoch-ms
	 * @param {string} cutoffISO - Cutoff as ISO string (for string comparison)
	 * @returns {Promise<number>} Number of deleted records
	 * @private
	 */
	async _purgeStoreBefore(storeName, cutoffMs, cutoffISO) {
		return new Promise((resolve, reject) => {
			const tx = this.db.transaction([storeName], 'readwrite');
			const store = tx.objectStore(storeName);
			let deleted = 0;

			// Use the timestamp index when available so the cursor iterates
			// in timestamp order and we can stop early once we pass the cutoff.
			const hasTimestampIdx = store.indexNames.contains('timestamp');
			const request = hasTimestampIdx
				? store.index('timestamp').openCursor()
				: store.openCursor();

			request.onsuccess = (event) => {
				const cursor = event.target.result;
				if (!cursor) {
					resolve(deleted);
					return;
				}

				// Determine the timestamp — either from the index key (fast)
				// or from the record value (fallback for non-indexed stores).
				const ts = hasTimestampIdx ? cursor.key : (cursor.value.timestamp ?? cursor.value.savedAt);

				let isOld = false;
				if (typeof ts === 'number') {
					isOld = ts < cutoffMs;
				} else if (typeof ts === 'string') {
					isOld = ts < cutoffISO;
				}

				if (isOld) {
					cursor.delete();
					deleted++;
					cursor.continue();
				} else if (hasTimestampIdx) {
					// Indexed cursors iterate in key order.  For homogeneous
					// timestamp types (all strings or all numbers), once we
					// see a timestamp >= cutoff the rest are also newer, so
					// we can stop.  For mixed stores we must continue scanning.
					// In practice every store uses a single format, so this
					// early-exit is safe.
					resolve(deleted);
				} else {
					cursor.continue();
				}
			};

			request.onerror = () => reject(request.error);
			tx.onerror = () => reject(tx.error);
		});
	}

	/**
	 * Get current storage usage statistics.
	 * Returns record counts per store for display in debug/settings UI.
	 *
	 * @returns {Promise<Object<string, number>>} Map of storeName → recordCount
	 */
	async getStorageStats() {
		await this._ensureDb();
		const stats = {};
		const storeNames = Array.from(this.db.objectStoreNames);

		for (const name of storeNames) {
			try {
				stats[name] = await this.count(name);
			} catch {
				stats[name] = -1;
			}
		}

		return stats;
	}

	/**
	 * Export all data from all IndexedDB stores as a raw dump.
	 * Each store's records are returned as an array under its name.
	 *
	 * @param {string[]} [storeNames] - Specific stores to export (default: all)
	 * @returns {Promise<Object>} { storeName: [...records], _meta: { exportedAt, version } }
	 */
	async exportAllStores(storeNames) {
		await this._ensureDb();
		const names = storeNames || Array.from(this.db.objectStoreNames);
		const result = {
			_meta: {
				exportedAt: new Date().toISOString(),
				version: this.db.version,
				storeCount: names.length,
			},
		};

		for (const name of names) {
			try {
				result[name] = await this.getAll(name);
			} catch (err) {
				console.warn(`[OrganizedJihad] Failed to export store "${name}":`, err);
				result[name] = [];
			}
		}

		return result;
	}

	/**
	 * Import data into IndexedDB stores from a raw dump.
	 * Skips records that already exist (by key) to avoid duplicates.
	 *
	 * @param {Object} data - Object with store names as keys and record arrays as values
	 * @param {Object} [options] - Import options
	 * @param {boolean} [options.overwrite=false] - If true, overwrite existing records via put()
	 * @returns {Promise<Object>} Summary { imported: { storeName: count }, errors: [...] }
	 */
	async importStores(data, options = {}) {
		await this._ensureDb();
		const { overwrite = false } = options;
		const validStores = Array.from(this.db.objectStoreNames);
		const summary = { imported: {}, skipped: {}, errors: [] };

		for (const [storeName, records] of Object.entries(data)) {
			if (storeName === '_meta') continue;
			if (!validStores.includes(storeName)) {
				summary.errors.push(`Unknown store: ${storeName}`);
				continue;
			}
			if (!Array.isArray(records)) {
				summary.errors.push(`Invalid data for store: ${storeName} (expected array)`);
				continue;
			}

			let imported = 0;
			let skipped = 0;

			// Batch all writes into a single readwrite transaction per store (#P2).
			// This avoids opening N separate transactions for N records and
			// dramatically improves import throughput.
			try {
				await new Promise((resolve, reject) => {
					const tx = this.db.transaction(storeName, 'readwrite');
					const store = tx.objectStore(storeName);

					for (const record of records) {
						const req = overwrite
							? store.put(record)
							: store.add(record);

						req.onsuccess = () => { imported++; };
						req.onerror = (e) => {
							if (req.error?.name === 'ConstraintError') {
								skipped++;
								e.preventDefault(); // Don't abort the whole tx
							} else {
								summary.errors.push(`${storeName}: ${req.error?.message || 'write failed'}`);
								e.preventDefault(); // Continue with remaining records
							}
						};
					}

					tx.oncomplete = () => resolve();
					tx.onerror = () => reject(tx.error);
					tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
				});
			} catch (err) {
				summary.errors.push(`${storeName}: tx error — ${err?.message || String(err)}`);
			}

			summary.imported[storeName] = imported;
			summary.skipped[storeName] = skipped;
		}

		return summary;
	}

	/**
	 * Get list of all object store names.
	 *
	 * @returns {Promise<string[]>} Array of store names
	 */
	async getStoreNames() {
		await this._ensureDb();
		return Array.from(this.db.objectStoreNames);
	}
}

export default IndexedDBStorage;
