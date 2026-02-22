/**
 * IndexedDBStorage Tests
 * Tests for browser-side IndexedDB storage operations.
 *
 * Uses fake-indexeddb (imported in tests/setup.js via 'fake-indexeddb/auto')
 * to provide an in-memory IndexedDB implementation.
 *
 * Actual IndexedDBStorage key facts:
 *   - DB name: 'OrganizedJihad'
 *   - Version: 6
 *   - 25+ object stores (snapshots, battles, heroes, titans, etc.)
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
			expect(storage.db.version).toBe(7);
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

		test('init() should be idempotent (calling multiple times returns same db)', async () => {
			const db1 = await storage.init();
			const db2 = await storage.init();
			expect(db1).toBe(db2);
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
});
