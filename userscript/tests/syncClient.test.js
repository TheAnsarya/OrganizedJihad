/**
 * syncClient.test.js
 *
 * Tests for SyncClient — API communication, payload packing,
 * retry logic, and auto-sync scheduling.
 *
 * Covers: #100
 */

import SyncClient from '../src/modules/syncClient.js';

// ═════════════════════════════════════════════════════════════════════
// Mocks
// ═════════════════════════════════════════════════════════════════════

/** Mock heroCompression — decompress functions are identity by default */
jest.mock('../src/modules/heroCompression.js', () => ({
	decompressHeroStore: jest.fn((records) => records),
	decompressTitanStore: jest.fn((records) => records),
}));

/** Create a mock IndexedDB storage with configurable store data */
function createMockStorage(overrides = {}) {
	const stores = {
		snapshots: [],
		battles: [],
		chests: [],
		opponents: [],
		goals: [],
		events: [],
		heroes: [],
		titans: [],
		pets: [],
		inventory: [],
		questCompletions: [],
		missionProgress: [],
		shopPurchases: [],
		towerProgress: [],
		expeditionBattles: [],
		resourceTransactions: [],
		guildActivities: [],
		heroUpgrades: [],
		titanUpgrades: [],
		dailyQuestCompletions: [],
		guildQuestCompletions: [],
		loginRewards: [],
		inventoryItemUsages: [],
		equipmentChanges: [],
		...overrides,
	};

	return {
		getAll: jest.fn((storeName) => Promise.resolve(stores[storeName] || [])),
		// getByIndexRange returns the same data as getAll for mock purposes;
		// real filtering is tested in indexedDBStorage tests. (#135/#140)
		getByIndexRange: jest.fn((storeName) => Promise.resolve(stores[storeName] || [])),
		getMetadata: jest.fn(() => Promise.resolve(null)),
		setMetadata: jest.fn(() => Promise.resolve()),
	};
}

// ═════════════════════════════════════════════════════════════════════
// Suppress console noise in tests
// ═════════════════════════════════════════════════════════════════════

beforeAll(() => {
	jest.spyOn(console, 'log').mockImplementation(() => {});
	jest.spyOn(console, 'warn').mockImplementation(() => {});
	jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
	console.log.mockRestore();
	console.warn.mockRestore();
	console.error.mockRestore();
});

// ═════════════════════════════════════════════════════════════════════
// Constructor
// ═════════════════════════════════════════════════════════════════════

describe('SyncClient constructor', () => {
	test('should use default API URL', () => {
		const client = new SyncClient();
		expect(client.apiUrl).toBe('http://localhost:5124');
		expect(client.syncEndpoint).toBe('http://localhost:5124/api/sync/import');
		expect(client.healthEndpoint).toBe('http://localhost:5124/api/sync/health');
		expect(client.lastSyncEndpoint).toBe('http://localhost:5124/api/sync/last-sync');
		expect(client.statsEndpoint).toBe('http://localhost:5124/api/sync/stats');
	});

	test('should accept custom API URL', () => {
		const client = new SyncClient('http://example.com:9000');
		expect(client.apiUrl).toBe('http://example.com:9000');
		expect(client.syncEndpoint).toBe('http://example.com:9000/api/sync/import');
	});
});

// ═════════════════════════════════════════════════════════════════════
// checkHealth
// ═════════════════════════════════════════════════════════════════════

describe('checkHealth', () => {
	let client;

	beforeEach(() => {
		client = new SyncClient();
		global.fetch = jest.fn();
	});

	afterEach(() => {
		delete global.fetch;
	});

	test('should return true when API responds OK', async () => {
		global.fetch.mockResolvedValue({ ok: true });
		const result = await client.checkHealth();
		expect(result).toBe(true);
		expect(global.fetch).toHaveBeenCalledWith(client.healthEndpoint, {
			method: 'GET',
			headers: { 'Content-Type': 'application/json' },
		});
	});

	test('should return false when API responds with error', async () => {
		global.fetch.mockResolvedValue({ ok: false, status: 500 });
		const result = await client.checkHealth();
		expect(result).toBe(false);
	});

	test('should return false when fetch throws', async () => {
		global.fetch.mockRejectedValue(new Error('Network error'));
		const result = await client.checkHealth();
		expect(result).toBe(false);
	});
});

// ═════════════════════════════════════════════════════════════════════
// getLastSync
// ═════════════════════════════════════════════════════════════════════

describe('getLastSync', () => {
	let client;

	beforeEach(() => {
		client = new SyncClient();
		global.fetch = jest.fn();
	});

	afterEach(() => {
		delete global.fetch;
	});

	test('should return timestamp on success', async () => {
		global.fetch.mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ lastSync: '2025-01-01T00:00:00Z' }),
		});
		const result = await client.getLastSync();
		expect(result).toBe('2025-01-01T00:00:00Z');
	});

	test('should return null on HTTP error', async () => {
		global.fetch.mockResolvedValue({
			ok: false,
			status: 404,
			statusText: 'Not Found',
		});
		const result = await client.getLastSync();
		expect(result).toBeNull();
	});

	test('should return null when fetch throws', async () => {
		global.fetch.mockRejectedValue(new Error('Network error'));
		const result = await client.getLastSync();
		expect(result).toBeNull();
	});
});

// ═════════════════════════════════════════════════════════════════════
// getStats
// ═════════════════════════════════════════════════════════════════════

describe('getStats', () => {
	let client;

	beforeEach(() => {
		client = new SyncClient();
		global.fetch = jest.fn();
	});

	afterEach(() => {
		delete global.fetch;
	});

	test('should return stats object on success', async () => {
		const stats = { totalSnapshots: 5, totalBattles: 10 };
		global.fetch.mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(stats),
		});
		const result = await client.getStats();
		expect(result).toEqual(stats);
	});

	test('should return null on HTTP error', async () => {
		global.fetch.mockResolvedValue({
			ok: false,
			status: 500,
			statusText: 'Internal Server Error',
		});
		const result = await client.getStats();
		expect(result).toBeNull();
	});

	test('should return null when fetch throws', async () => {
		global.fetch.mockRejectedValue(new Error('Network error'));
		const result = await client.getStats();
		expect(result).toBeNull();
	});
});

// ═════════════════════════════════════════════════════════════════════
// syncToServer — payload construction
// ═════════════════════════════════════════════════════════════════════

describe('syncToServer', () => {
	let client;

	beforeEach(() => {
		client = new SyncClient();
		global.fetch = jest.fn();
	});

	afterEach(() => {
		delete global.fetch;
	});

	test('should build a complete sync payload from storage', async () => {
		const storage = createMockStorage({
			snapshots: [
				{ timestamp: '2025-01-01T00:00:00Z', level: 100 },
				{ timestamp: '2025-01-02T00:00:00Z', level: 101 },
			],
			battles: [
				{ battleType: 'Arena', result: 'win' },
				{ battleType: 'GrandArena', result: 'loss' },
				{ battleType: 'TitanArena', result: 'win' },
				{ battleType: 'GuildWar', result: 'win' },
				{ battleType: 'RaidBoss', damage: 5000 },
			],
			chests: [{ chestType: 'daily' }],
			heroes: [{ id: 1, name: 'Aurora' }],
			titans: [{ id: 4000, name: 'Sigurd' }],
			pets: [{ id: 6000, name: 'Fenris' }],
			heroUpgrades: [
				{ upgradeType: 'level', heroId: 1 },
				{ upgradeType: 'star', heroId: 1 },
				{ upgradeType: 'color', heroId: 2 },
				{ upgradeType: 'skill', heroId: 3 },
				{ upgradeType: 'artifact', heroId: 4 },
				{ upgradeType: 'glyph', heroId: 5 },
				{ upgradeType: 'skin', heroId: 6 },
			],
			titanUpgrades: [
				{ upgradeType: 'level', titanId: 4000 },
				{ upgradeType: 'star', titanId: 4001 },
				{ upgradeType: 'skill', titanId: 4010 },
				{ upgradeType: 'artifact', titanId: 4020 },
				{ upgradeType: 'skin', titanId: 4030 },
			],
		});

		const apiResult = { syncTimestamp: '2025-01-02T12:00:00Z', imported: 42 };
		global.fetch.mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(apiResult),
		});

		const result = await client.syncToServer(storage);

		// Verify fetch was called with correct endpoint
		expect(global.fetch).toHaveBeenCalledWith(
			client.syncEndpoint,
			expect.objectContaining({
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			})
		);

		// Parse the body that was sent
		const body = JSON.parse(global.fetch.mock.calls[0][1].body);

		// Should pick the most recent snapshot
		expect(body.currentSnapshot).toEqual({ timestamp: '2025-01-02T00:00:00Z', level: 101 });

		// Should separate battles by type
		expect(body.arenaBattles).toHaveLength(1);
		expect(body.grandArenaBattles).toHaveLength(1);
		expect(body.titanArenaBattles).toHaveLength(1);
		expect(body.guildWarBattles).toHaveLength(1);
		expect(body.raidBossAttacks).toHaveLength(1);

		// Other entities
		expect(body.chestOpenings).toHaveLength(1);
		expect(body.heroes).toHaveLength(1);
		expect(body.titans).toHaveLength(1);
		expect(body.pets).toHaveLength(1);

		// Hero upgrades split by type
		expect(body.heroLevelUpgrades).toHaveLength(1);
		expect(body.heroStarUpgrades).toHaveLength(1);
		expect(body.heroColorUpgrades).toHaveLength(1);
		expect(body.heroSkillUpgrades).toHaveLength(1);
		expect(body.heroArtifactUpgrades).toHaveLength(1);
		expect(body.heroGlyphUpgrades).toHaveLength(1);
		expect(body.heroSkinUpgrades).toHaveLength(1);

		// Titan upgrades split by type
		expect(body.titanLevelUpgrades).toHaveLength(1);
		expect(body.titanStarUpgrades).toHaveLength(1);
		expect(body.titanSkillUpgrades).toHaveLength(1);
		expect(body.titanArtifactUpgrades).toHaveLength(1);
		expect(body.titanSkinUpgrades).toHaveLength(1);

		// Should update local metadata (API returns camelCase `syncTimestamp`)
		expect(storage.setMetadata).toHaveBeenCalledWith('lastSync', apiResult.syncTimestamp);

		// Should write success syncStatus (#130)
		const syncStatusCall = storage.setMetadata.mock.calls.find(
			([key]) => key === 'syncStatus'
		);
		expect(syncStatusCall).toBeDefined();
		expect(syncStatusCall[1].ok).toBe(true);
		expect(syncStatusCall[1].timestamp).toBeDefined();

		expect(result).toEqual(apiResult);
	});

	test('should set currentSnapshot to null when no snapshots exist', async () => {
		const storage = createMockStorage();
		global.fetch.mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ syncTimestamp: 'now' }),
		});

		await client.syncToServer(storage);

		const body = JSON.parse(global.fetch.mock.calls[0][1].body);
		expect(body.currentSnapshot).toBeNull();
		expect(body.currentInventory).toBeNull();
	});

	test('should pick latest inventory snapshot', async () => {
		const storage = createMockStorage({
			inventory: [
				{ timestamp: '2025-01-01T00:00:00Z', items: ['a'] },
				{ timestamp: '2025-01-03T00:00:00Z', items: ['a', 'b'] },
				{ timestamp: '2025-01-02T00:00:00Z', items: ['a', 'c'] },
			],
		});
		global.fetch.mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ syncTimestamp: 'now' }),
		});

		await client.syncToServer(storage);

		const body = JSON.parse(global.fetch.mock.calls[0][1].body);
		expect(body.currentInventory.items).toEqual(['a', 'b']);
	});

	test('should throw on HTTP error', async () => {
		const storage = createMockStorage();
		global.fetch.mockResolvedValue({
			ok: false,
			status: 500,
			text: () => Promise.resolve('Internal Server Error'),
		});

		await expect(client.syncToServer(storage)).rejects.toThrow('HTTP 500');
	});

	test('should throw when fetch rejects', async () => {
		const storage = createMockStorage();
		global.fetch.mockRejectedValue(new Error('Network down'));

		await expect(client.syncToServer(storage)).rejects.toThrow('Network down');
	});

	test('should use getAll for first sync when no lastSync exists (#135)', async () => {
		const storage = createMockStorage({
			snapshots: [{ timestamp: '2025-01-01T00:00:00Z', level: 100 }],
		});
		// getMetadata returns null → first sync → should call getAll not getByIndexRange
		storage.getMetadata.mockResolvedValue(null);

		global.fetch.mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ syncTimestamp: '2025-01-01T12:00:00Z' }),
		});

		await client.syncToServer(storage);

		// getAll should be called for stores on first sync
		expect(storage.getAll).toHaveBeenCalled();
		// getByIndexRange should NOT be called when there's no lastSync
		expect(storage.getByIndexRange).not.toHaveBeenCalled();
	});

	test('should use getByIndexRange for incremental sync when lastSync exists (#135)', async () => {
		const lastSyncTs = '2025-01-01T00:00:00Z';
		const storage = createMockStorage({
			snapshots: [{ timestamp: '2025-01-02T00:00:00Z', level: 101 }],
		});
		storage.getMetadata.mockResolvedValue(lastSyncTs);

		global.fetch.mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ syncTimestamp: '2025-01-02T12:00:00Z' }),
		});

		await client.syncToServer(storage);

		// getByIndexRange should be called for timestamped stores
		expect(storage.getByIndexRange).toHaveBeenCalled();

		// Should have been called with the lastSync as lower bound
		const rangeCall = storage.getByIndexRange.mock.calls.find(
			([store]) => store === 'snapshots'
		);
		expect(rangeCall).toBeDefined();
		expect(rangeCall[1]).toBe('timestamp');
		expect(rangeCall[2]).toEqual({ lower: lastSyncTs, lowerOpen: true });
	});

	test('should pass epoch lower bound for chests store (#140)', async () => {
		const lastSyncTs = '2025-01-15T12:00:00Z';
		const lastSyncEpoch = new Date(lastSyncTs).getTime();
		const storage = createMockStorage({
			chests: [{ chestType: 'daily', timestamp: Date.now() }],
		});
		storage.getMetadata.mockResolvedValue(lastSyncTs);

		global.fetch.mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ syncTimestamp: '2025-01-15T13:00:00Z' }),
		});

		await client.syncToServer(storage);

		const chestsCall = storage.getByIndexRange.mock.calls.find(
			([store]) => store === 'chests'
		);
		expect(chestsCall).toBeDefined();
		expect(chestsCall[1]).toBe('timestamp');
		// Chests use epoch (numeric) lower bound
		expect(chestsCall[2]).toEqual({ lower: lastSyncEpoch, lowerOpen: true });
	});

	test('should still use getAll for mutable stores even with lastSync (#135)', async () => {
		const storage = createMockStorage({
			opponents: [{ id: 1, name: 'Rival' }],
			goals: [{ id: 1, target: 'level 120' }],
			events: [{ id: 1, eventName: 'Holiday' }],
			missionProgress: [{ missionId: 1, stars: 3 }],
			towerProgress: [{ floor: 50 }],
		});
		storage.getMetadata.mockResolvedValue('2025-01-01T00:00:00Z');

		global.fetch.mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ syncTimestamp: '2025-01-02T00:00:00Z' }),
		});

		await client.syncToServer(storage);

		// Mutable stores should always use getAll, never getByIndexRange
		const rangeStores = storage.getByIndexRange.mock.calls.map(([store]) => store);
		expect(rangeStores).not.toContain('opponents');
		expect(rangeStores).not.toContain('goals');
		expect(rangeStores).not.toContain('events');
		expect(rangeStores).not.toContain('missionProgress');
		expect(rangeStores).not.toContain('towerProgress');

		// But they SHOULD use getAll
		const allStores = storage.getAll.mock.calls.map(([store]) => store);
		expect(allStores).toContain('opponents');
		expect(allStores).toContain('goals');
		expect(allStores).toContain('events');
		expect(allStores).toContain('missionProgress');
		expect(allStores).toContain('towerProgress');
	});

	test('should persist syncTimestamp from API response (not timestamp) (#140)', async () => {
		const storage = createMockStorage();
		const apiTimestamp = '2025-06-15T10:30:00Z';
		global.fetch.mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({
				syncTimestamp: apiTimestamp,
				importedCounts: { snapshots: 1 },
			}),
		});

		await client.syncToServer(storage);

		// Should store the API's syncTimestamp (camelCase from ASP.NET)
		expect(storage.setMetadata).toHaveBeenCalledWith('lastSync', apiTimestamp);
	});
});

// ═════════════════════════════════════════════════════════════════════
// syncWithRetry
// ═════════════════════════════════════════════════════════════════════

describe('syncWithRetry', () => {
	let client;
	let origSetTimeout;

	beforeEach(() => {
		client = new SyncClient();
		// Replace setTimeout with immediate invocation to skip backoff delays
		origSetTimeout = global.setTimeout;
		global.setTimeout = (fn) => origSetTimeout(fn, 0);
	});

	afterEach(() => {
		global.setTimeout = origSetTimeout;
	});

	test('should return on first success', async () => {
		const expected = { ok: true };
		client.syncToServer = jest.fn().mockResolvedValue(expected);
		const storage = createMockStorage();

		const result = await client.syncWithRetry(storage, 3);

		expect(result).toEqual(expected);
		expect(client.syncToServer).toHaveBeenCalledTimes(1);
	});

	test('should retry and succeed on 2nd attempt', async () => {
		client.syncToServer = jest
			.fn()
			.mockRejectedValueOnce(new Error('fail'))
			.mockResolvedValueOnce({ ok: true });
		const storage = createMockStorage();

		const result = await client.syncWithRetry(storage, 3);

		expect(result).toEqual({ ok: true });
		expect(client.syncToServer).toHaveBeenCalledTimes(2);
	});

	test('should throw after exhausting all retries', async () => {
		client.syncToServer = jest.fn().mockRejectedValue(new Error('persistent failure'));
		const storage = createMockStorage();

		await expect(client.syncWithRetry(storage, 3)).rejects.toThrow(
			'Sync failed after 3 attempts'
		);
		expect(client.syncToServer).toHaveBeenCalledTimes(3);
	});

	test('should persist failure syncStatus metadata after retries exhausted (#130)', async () => {
		client.syncToServer = jest.fn().mockRejectedValue(new Error('network down'));
		const storage = createMockStorage();

		await expect(client.syncWithRetry(storage, 2)).rejects.toThrow(
			'Sync failed after 2 attempts'
		);

		// Verify setMetadata was called with syncStatus
		const syncStatusCall = storage.setMetadata.mock.calls.find(
			([key]) => key === 'syncStatus'
		);
		expect(syncStatusCall).toBeDefined();
		expect(syncStatusCall[1].ok).toBe(false);
		expect(syncStatusCall[1].message).toBe('network down');
		expect(syncStatusCall[1].attempts).toBe(2);
		expect(syncStatusCall[1].timestamp).toBeDefined();
	});

	test('should default to 3 retries', async () => {
		client.syncToServer = jest.fn().mockRejectedValue(new Error('fail'));
		const storage = createMockStorage();

		await expect(client.syncWithRetry(storage)).rejects.toThrow(
			'Sync failed after 3 attempts'
		);
		expect(client.syncToServer).toHaveBeenCalledTimes(3);
	});
});

// ═════════════════════════════════════════════════════════════════════
// startAutoSync
// ═════════════════════════════════════════════════════════════════════

describe('startAutoSync', () => {
	let client;

	beforeEach(() => {
		client = new SyncClient();
		jest.useFakeTimers();
		client.syncWithRetry = jest.fn().mockResolvedValue({ ok: true });
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	test('should trigger immediate sync and return interval ID', () => {
		const storage = createMockStorage();
		const intervalId = client.startAutoSync(storage, 10);

		expect(typeof intervalId).toBe('number');
		// Immediate sync should have been called
		expect(client.syncWithRetry).toHaveBeenCalledWith(storage);

		clearInterval(intervalId);
	});

	test('should default to 15-minute interval', () => {
		const storage = createMockStorage();
		const intervalId = client.startAutoSync(storage);

		// Initial call
		expect(client.syncWithRetry).toHaveBeenCalledTimes(1);

		// Advance 15 minutes
		jest.advanceTimersByTime(15 * 60 * 1000);
		expect(client.syncWithRetry).toHaveBeenCalledTimes(2);

		clearInterval(intervalId);
	});

	test('should keep syncing on each interval tick', () => {
		const storage = createMockStorage();
		const intervalId = client.startAutoSync(storage, 5);

		// Initial call
		expect(client.syncWithRetry).toHaveBeenCalledTimes(1);

		// 5 min
		jest.advanceTimersByTime(5 * 60 * 1000);
		expect(client.syncWithRetry).toHaveBeenCalledTimes(2);

		// 10 min
		jest.advanceTimersByTime(5 * 60 * 1000);
		expect(client.syncWithRetry).toHaveBeenCalledTimes(3);

		clearInterval(intervalId);
	});
});
