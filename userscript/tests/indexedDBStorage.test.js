/**
 * IndexedDBStorage Tests
 * Tests for browser-side IndexedDB storage operations.
 *
 * Uses fake-indexeddb (imported in tests/setup.js via 'fake-indexeddb/auto')
 * to provide an in-memory IndexedDB implementation.
 *
 * Actual IndexedDBStorage key facts:
 *   - DB name: 'OrganizedJihad'
 *   - Version: 11
 *   - 38 object stores (snapshots, battles, heroes, titans, consumableRewards, errorLog, adventureGuide, etc.)
 *   - Methods: add, put, get, getAll, getByIndex, delete, clear, ensureDB
 *   - init() is idempotent — returns the single initPromise
 */

import IndexedDBStorage from '../src/modules/indexedDBStorage.js';

// Node 16 doesn't have structuredClone — polyfill for fake-indexeddb
if (typeof globalThis.structuredClone === 'undefined') {
	globalThis.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

describe('IndexedDBStorage', () => {
	let storage;

	beforeEach(async () => {
		storage = new IndexedDBStorage();
		await storage.init();
	});

	afterEach(async () => {
		if (storage?.db) {
			storage.db.close();
		}
		// Delete the database so each test starts fresh
		const deleteRequest = indexedDB.deleteDatabase('OrganizedJihad');
		await new Promise((resolve) => {
			deleteRequest.onsuccess = resolve;
			deleteRequest.onerror = resolve;
		});
	});

	// ─── Initialization ──────────────────────────────────────────────────

	describe('Initialization', () => {
		test('should initialize database successfully', async () => {
			expect(storage.db).toBeDefined();
			expect(storage.db.name).toBe('OrganizedJihad');
			expect(storage.db.version).toBe(11);
		});

		test('should create core object stores', async () => {
			const names = Array.from(storage.db.objectStoreNames);

			// Phase 1 stores
			expect(names).toContain('snapshots');
			expect(names).toContain('battles');
			expect(names).toContain('chests');
			expect(names).toContain('opponents');
			expect(names).toContain('goals');
			expect(names).toContain('events');
			expect(names).toContain('metadata');
		});

		test('should create Phase 7 tracking stores', async () => {
			const names = Array.from(storage.db.objectStoreNames);

			expect(names).toContain('heroes');
			expect(names).toContain('titans');
			expect(names).toContain('pets');
			expect(names).toContain('inventory');
			expect(names).toContain('questCompletions');
			expect(names).toContain('missionProgress');
			expect(names).toContain('shopPurchases');
			expect(names).toContain('towerProgress');
			expect(names).toContain('expeditionBattles');
			expect(names).toContain('resourceTransactions');
			expect(names).toContain('guildActivities');
		});

		test('should create guild & chat stores', async () => {
			const names = Array.from(storage.db.objectStoreNames);

			expect(names).toContain('chatMessages');
			expect(names).toContain('guildMembers');
			expect(names).toContain('guildMemberSnapshots');
			expect(names).toContain('guildWarParticipations');
			expect(names).toContain('guildRaidParticipations');
			expect(names).toContain('guildDungeonParticipations');
			expect(names).toContain('titaniteTransactions');
		});

		test('should create Phase 8 upgrade & activity stores', async () => {
			const names = Array.from(storage.db.objectStoreNames);

			expect(names).toContain('apiLogs');
			expect(names).toContain('heroUpgrades');
			expect(names).toContain('titanUpgrades');
			expect(names).toContain('dailyQuestCompletions');
			expect(names).toContain('guildQuestCompletions');
			expect(names).toContain('loginRewards');
			expect(names).toContain('inventoryItemUsages');
			expect(names).toContain('equipmentChanges');
		});

		test('should create Phase 9 activityEvents store', async () => {
			const names = Array.from(storage.db.objectStoreNames);
			expect(names).toContain('activityEvents');
		});

		test('should create Phase 10 consumableRewards store with indexes', async () => {
			const names = Array.from(storage.db.objectStoreNames);
			expect(names).toContain('consumableRewards');

			// Verify the store has the expected indexes
			const tx = storage.db.transaction('consumableRewards', 'readonly');
			const store = tx.objectStore('consumableRewards');
			const indexNames = Array.from(store.indexNames);
			expect(indexNames).toContain('timestamp');
			expect(indexNames).toContain('sourceType');
			expect(indexNames).toContain('sourceId');
			expect(indexNames).toContain('itemType');
			expect(indexNames).toContain('itemId');
			expect(indexNames).toContain('openingId');
		});

		test('should create Phase 11 errorLog store with indexes (#28)', async () => {
			const names = Array.from(storage.db.objectStoreNames);
			expect(names).toContain('errorLog');

			const tx = storage.db.transaction('errorLog', 'readonly');
			const store = tx.objectStore('errorLog');
			const indexNames = Array.from(store.indexNames);
			expect(indexNames).toContain('timestamp');
			expect(indexNames).toContain('context');
		});

		test('init() should be idempotent (calling multiple times returns same db)', async () => {
			const db1 = await storage.init();
			const db2 = await storage.init();
			expect(db1).toBe(db2);
		});

		test('should create Phase 14 adventureGuide store with indexes (#131)', async () => {
			const names = Array.from(storage.db.objectStoreNames);
			expect(names).toContain('adventureGuide');

			const tx = storage.db.transaction('adventureGuide', 'readonly');
			const store = tx.objectStore('adventureGuide');
			const indexNames = Array.from(store.indexNames);
			expect(indexNames).toContain('nodeId');
			expect(indexNames).toContain('timestamp');
			expect(indexNames).toContain('isWin');
		});
	});

	// ─── CRUD Operations ─────────────────────────────────────────────────

	describe('CRUD Operations', () => {
		test('should add data to a store', async () => {
			const key = await storage.add('snapshots', {
				playerId: 12345,
				playerName: 'TestPlayer',
				level: 50,
				timestamp: Date.now(),
			});
			expect(key).toBeDefined();
			expect(typeof key).toBe('number');
		});

		test('should retrieve data by key', async () => {
			const data = { playerId: 12345, playerName: 'TestPlayer', level: 50, timestamp: Date.now() };
			const key = await storage.add('snapshots', data);
			const retrieved = await storage.get('snapshots', key);

			expect(retrieved).toBeDefined();
			expect(retrieved.playerId).toBe(12345);
			expect(retrieved.playerName).toBe('TestPlayer');
		});

		test('should update existing data via put', async () => {
			const data = { playerId: 12345, playerName: 'TestPlayer', level: 50, timestamp: Date.now() };
			const key = await storage.add('snapshots', data);

			const updated = { ...data, id: key, level: 60 };
			await storage.put('snapshots', updated);

			const retrieved = await storage.get('snapshots', key);
			expect(retrieved.level).toBe(60);
		});

		test('should delete data by key', async () => {
			const data = { playerId: 12345, playerName: 'TestPlayer', timestamp: Date.now() };
			const key = await storage.add('snapshots', data);
			await storage.delete('snapshots', key);

			const retrieved = await storage.get('snapshots', key);
			expect(retrieved).toBeUndefined();
		});

		test('should retrieve all data from a store', async () => {
			await storage.add('snapshots', { playerId: 1, timestamp: 1 });
			await storage.add('snapshots', { playerId: 2, timestamp: 2 });
			await storage.add('snapshots', { playerId: 3, timestamp: 3 });

			const all = await storage.getAll('snapshots');
			expect(all).toHaveLength(3);
		});

		test('should respect limit in getAll', async () => {
			await storage.add('snapshots', { playerId: 1, timestamp: 1 });
			await storage.add('snapshots', { playerId: 2, timestamp: 2 });
			await storage.add('snapshots', { playerId: 3, timestamp: 3 });

			const limited = await storage.getAll('snapshots', 2);
			expect(limited).toHaveLength(2);
		});
	});

	// ─── Index Queries ───────────────────────────────────────────────────

	describe('Index Queries', () => {
		test('should query by index', async () => {
			await storage.add('battles', { battleType: 'arena', timestamp: 1, opponentId: 1, isWin: true });
			await storage.add('battles', { battleType: 'arena', timestamp: 2, opponentId: 2, isWin: false });
			await storage.add('battles', { battleType: 'guildWar', timestamp: 3, opponentId: 3, isWin: true });

			const arenaBattles = await storage.getByIndex('battles', 'battleType', 'arena');
			expect(arenaBattles).toHaveLength(2);
		});
	});

	// ─── Guild Member Upsert ─────────────────────────────────────────────

	describe('Guild Member Upsert', () => {
		test('should insert new guild member via put', async () => {
			const member = {
				playerId: 99999,
				playerName: 'NewMember',
				guildId: 1,
				level: 80,
				teamPower: 500000,
			};
			// guildMembers uses keyPath: 'playerId'
			await storage.put('guildMembers', member);
			const retrieved = await storage.get('guildMembers', 99999);

			expect(retrieved).toBeDefined();
			expect(retrieved.playerName).toBe('NewMember');
			expect(retrieved.level).toBe(80);
		});

		test('should update existing guild member via put', async () => {
			const member = {
				playerId: 99999,
				playerName: 'Member',
				guildId: 1,
				level: 80,
				teamPower: 500000,
			};
			await storage.put('guildMembers', member);
			await storage.put('guildMembers', { ...member, level: 90, teamPower: 600000 });

			const retrieved = await storage.get('guildMembers', 99999);
			expect(retrieved.level).toBe(90);
			expect(retrieved.teamPower).toBe(600000);

			const all = await storage.getAll('guildMembers');
			expect(all).toHaveLength(1);
		});
	});

	// ─── Error Handling ──────────────────────────────────────────────────

	describe('Error Handling', () => {
		test('should throw error for invalid store name', async () => {
			await expect(storage.add('nonExistentStore', {})).rejects.toThrow();
		});

		test('should throw on null data add', async () => {
			// fake-indexeddb throws when trying to add null/undefined
			await expect(storage.add('snapshots', null)).rejects.toThrow();
		});
	});

	// ─── Bulk Operations ─────────────────────────────────────────────────

	describe('Bulk Operations', () => {
		test('should clear all data from a store', async () => {
			await storage.add('snapshots', { playerId: 1, timestamp: 1 });
			await storage.add('snapshots', { playerId: 2, timestamp: 2 });

			await storage.clear('snapshots');

			const all = await storage.getAll('snapshots');
			expect(all).toHaveLength(0);
		});
	});

	// ─── Pagination (getPage) ────────────────────────────────────────────

	describe('Pagination', () => {
		beforeEach(async () => {
			// Seed 10 hero records with incrementing timestamps
			for (let i = 1; i <= 10; i++) {
				await storage.add('heroes', {
					heroId: i,
					heroName: `Hero ${i}`,
					playerId: 100,
					timestamp: new Date(2025, 0, i).toISOString(),
					power: i * 100,
				});
			}
		});

		test('should return first page of records', async () => {
			const page = await storage.getPage('heroes', { limit: 3, offset: 0, direction: 'next' });
			expect(page).toHaveLength(3);
		});

		test('should skip records with offset', async () => {
			const page = await storage.getPage('heroes', { limit: 3, offset: 5, direction: 'next' });
			expect(page).toHaveLength(3);
		});

		test('should return remaining records on last page', async () => {
			const page = await storage.getPage('heroes', { limit: 4, offset: 8, direction: 'next' });
			expect(page).toHaveLength(2);
		});

		test('should return empty array when offset exceeds count', async () => {
			const page = await storage.getPage('heroes', { limit: 5, offset: 100, direction: 'next' });
			expect(page).toHaveLength(0);
		});

		test('should default to limit 25 and direction prev', async () => {
			const page = await storage.getPage('heroes');
			// All 10 fit in default page size of 25
			expect(page).toHaveLength(10);
		});
	});

	// ─── Purge Old Records (#45) ─────────────────────────────────────────

	describe('purgeOldRecords', () => {
		test('should delete records older than retention period', async () => {
			const now = Date.now();
			const oldTimestamp = new Date(now - 100 * 24 * 60 * 60 * 1000).toISOString(); // 100 days ago
			const recentTimestamp = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days ago

			await storage.add('battles', { battleType: 'Arena', timestamp: oldTimestamp, isWin: true });
			await storage.add('battles', { battleType: 'Arena', timestamp: recentTimestamp, isWin: false });

			// Default retention for battles is 90 days
			const summary = await storage.purgeOldRecords();
			expect(summary.battles).toBe(1);

			const remaining = await storage.getAll('battles');
			expect(remaining).toHaveLength(1);
			expect(remaining[0].timestamp).toBe(recentTimestamp);
		});

		test('should handle numeric timestamps', async () => {
			const now = Date.now();
			const oldTs = now - 100 * 24 * 60 * 60 * 1000; // 100 days ago
			const newTs = now - 1 * 24 * 60 * 60 * 1000;   // 1 day ago

			await storage.add('activityEvents', { type: 'test', timestamp: oldTs });
			await storage.add('activityEvents', { type: 'test', timestamp: newTs });

			const summary = await storage.purgeOldRecords();
			expect(summary.activityEvents).toBe(1);

			const remaining = await storage.getAll('activityEvents');
			expect(remaining).toHaveLength(1);
		});

		test('should respect retention overrides', async () => {
			const now = Date.now();
			const ts = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago

			await storage.add('battles', { battleType: 'Arena', timestamp: ts, isWin: true });

			// With default 90-day retention, this should NOT be purged
			const summary1 = await storage.purgeOldRecords();
			expect(summary1.battles).toBeUndefined();

			// With override of 5 days, it SHOULD be purged
			const summary2 = await storage.purgeOldRecords({ battles: 5 });
			expect(summary2.battles).toBe(1);
		});

		test('should return empty summary when nothing to purge', async () => {
			const summary = await storage.purgeOldRecords();
			expect(Object.keys(summary)).toHaveLength(0);
		});
	});

	// ─── Storage Stats (#45) ─────────────────────────────────────────────

	describe('getStorageStats', () => {
		test('should return record counts per store', async () => {
			await storage.add('battles', { battleType: 'Arena', timestamp: new Date().toISOString(), isWin: true });
			await storage.add('battles', { battleType: 'Arena', timestamp: new Date().toISOString(), isWin: false });
			await storage.add('snapshots', { playerId: '1', timestamp: new Date().toISOString() });

			const stats = await storage.getStorageStats();
			expect(stats.battles).toBe(2);
			expect(stats.snapshots).toBe(1);
			expect(stats.heroes).toBe(0);
		});

		test('should include all store names', async () => {
			const stats = await storage.getStorageStats();
			expect(stats).toHaveProperty('battles');
			expect(stats).toHaveProperty('snapshots');
			expect(stats).toHaveProperty('heroes');
			expect(stats).toHaveProperty('apiLogs');
		});
	});

	// =================================================================
	// Export / Import (#27)
	// =================================================================
	describe('exportAllStores', () => {
		test('should export all stores with _meta header', async () => {
			await storage.add('battles', {
				timestamp: '2025-01-01', type: 'arena', isWin: true,
				attackTeam: '[]', defenseTeam: '[]',
			});

			const result = await storage.exportAllStores();

			expect(result._meta).toBeDefined();
			expect(result._meta.exportedAt).toBeDefined();
			expect(result._meta.version).toBe(11);
			expect(result.battles).toHaveLength(1);
			expect(result.battles[0].type).toBe('arena');
		});

		test('should export specific stores only', async () => {
			await storage.add('battles', {
				timestamp: '2025-01-01', type: 'arena', isWin: true,
				attackTeam: '[]', defenseTeam: '[]',
			});

			const result = await storage.exportAllStores(['battles']);

			expect(result.battles).toBeDefined();
			expect(result.heroes).toBeUndefined();
			expect(result._meta.storeCount).toBe(1);
		});
	});

	describe('importStores', () => {
		test('should import records into stores', async () => {
			const data = {
				battles: [{
					timestamp: '2025-01-01', type: 'arena', isWin: true,
					attackTeam: '[]', defenseTeam: '[]',
				}],
			};

			const summary = await storage.importStores(data);
			expect(summary.imported.battles).toBe(1);

			const count = await storage.count('battles');
			expect(count).toBe(1);
		});

		test('should skip _meta key during import', async () => {
			const data = {
				_meta: { version: 9 },
				battles: [{
					timestamp: '2025-01-01', type: 'arena', isWin: true,
					attackTeam: '[]', defenseTeam: '[]',
				}],
			};

			const summary = await storage.importStores(data);
			expect(summary.imported._meta).toBeUndefined();
			expect(summary.imported.battles).toBe(1);
		});

		test('should report errors for unknown stores', async () => {
			const data = { nonExistentStore: [{ id: 1 }] };
			const summary = await storage.importStores(data);
			expect(summary.errors).toContain('Unknown store: nonExistentStore');
		});
	});

	describe('getStoreNames', () => {
		test('should return array of all store names', async () => {
			const names = await storage.getStoreNames();
			expect(Array.isArray(names)).toBe(true);
			expect(names).toContain('battles');
			expect(names).toContain('heroes');
			expect(names).toContain('errorLog');
			expect(names).toContain('mailRewards');
			expect(names.length).toBe(38);
		});
	});
});
