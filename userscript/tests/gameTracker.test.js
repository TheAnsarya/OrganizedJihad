/**
 * GameTracker Tests
 * Tests for Hero Wars API interception and data extraction.
 *
 * Actual GameTracker API:
 *   - constructor(storage)  — storage is an IndexedDBStorage instance
 *   - init()                — calls storage.init() + proxyAPIRequests()
 *   - processAPIResponse(request, response) — main dispatcher
 *   - trackPlayerData(data) — saves snapshot from userGetInfo
 *   - trackHeroesData(data) — saves hero snapshots from heroGetAll
 *   - trackBattleResult(type, args, data) — saves battle records
 *   - trackArenaBattle / trackTitanArenaBattle / trackGrandArenaBattle
 *   - ... many more track* methods
 *
 * storage is an IndexedDBStorage with methods: add, put, get, getAll, getByIndex, getMetadata
 */

import GameTracker from '../src/modules/gameTracker.js';

describe('GameTracker', () => {
	let tracker;
	let mockStorage;

	beforeEach(() => {
		jest.clearAllMocks();

		// Mock an IndexedDBStorage-compatible object
		mockStorage = {
			init: jest.fn().mockResolvedValue(true),
			initPromise: Promise.resolve(true),
			add: jest.fn().mockResolvedValue(1),
			put: jest.fn().mockResolvedValue(1),
			get: jest.fn().mockResolvedValue(undefined),
			getAll: jest.fn().mockResolvedValue([]),
			getByIndex: jest.fn().mockResolvedValue([]),
			getMetadata: jest.fn().mockResolvedValue(null),
			delete: jest.fn().mockResolvedValue(undefined),
			clear: jest.fn().mockResolvedValue(undefined),
		};

		tracker = new GameTracker(mockStorage);
	});

	// ─── Initialization ──────────────────────────────────────────────────

	describe('Initialization', () => {
		test('should store the provided storage reference', () => {
			expect(tracker.storage).toBe(mockStorage);
		});

		test('should start in non-tracking state', () => {
			expect(tracker.isTracking).toBe(false);
		});

		test('init() should call storage.init and set isTracking to true', async () => {
			await tracker.init();
			expect(mockStorage.init).toHaveBeenCalled();
			expect(tracker.isTracking).toBe(true);
		});
	});

	// ─── processAPIResponse ──────────────────────────────────────────────

	describe('processAPIResponse', () => {
		test('should silently return on null/undefined request or response', async () => {
			await expect(tracker.processAPIResponse(null, null)).resolves.not.toThrow();
			await expect(tracker.processAPIResponse({}, {})).resolves.not.toThrow();
			await expect(tracker.processAPIResponse({ calls: [] }, { results: [] })).resolves.not.toThrow();
		});

		test('should dispatch userGetInfo to trackPlayerData', async () => {
			const spy = jest.spyOn(tracker, 'trackPlayerData').mockResolvedValue();

			const request = {
				calls: [{ name: 'userGetInfo', ident: 'body', args: {} }],
			};
			const response = {
				results: [{ ident: 'body', result: { response: { userId: 123, name: 'Player', level: 50 } } }],
			};

			await tracker.processAPIResponse(request, response);
			expect(spy).toHaveBeenCalledWith({ userId: 123, name: 'Player', level: 50 });
		});

		test('should dispatch heroGetAll to trackHeroesData', async () => {
			const spy = jest.spyOn(tracker, 'trackHeroesData').mockResolvedValue();

			const request = {
				calls: [{ name: 'heroGetAll', ident: 'heroGetAll', args: {} }],
			};
			const response = {
				results: [{ ident: 'heroGetAll', result: { response: { '1': { id: 1 } } } }],
			};

			await tracker.processAPIResponse(request, response);
			expect(spy).toHaveBeenCalledWith({ '1': { id: 1 } });
		});

		test('should skip results without response data', async () => {
			const spy = jest.spyOn(tracker, 'trackPlayerData').mockResolvedValue();

			const request = {
				calls: [{ name: 'userGetInfo', ident: 'body', args: {} }],
			};
			const response = {
				results: [{ ident: 'body', result: {} }], // no nested response
			};

			await tracker.processAPIResponse(request, response);
			expect(spy).not.toHaveBeenCalled();
		});
	});

	// ─── trackPlayerData ─────────────────────────────────────────────────

	describe('trackPlayerData', () => {
		test('should save a player snapshot to snapshots store', async () => {
			const data = {
				userId: 12345,
				name: 'TestPlayer',
				level: 120,
				vipLevel: 15,
				power: 1500000,
				gold: 5000000,
				starmoney: 99999,
				clanTitle: 'MyGuild',
				clanId: 888,
			};

			await tracker.trackPlayerData(data);

			expect(mockStorage.add).toHaveBeenCalledWith(
				'snapshots',
				expect.objectContaining({
					playerId: 12345,
					playerName: 'TestPlayer',
					level: 120,
					vipLevel: 15,
					teamPower: 1500000,
					gold: 5000000,
					emeralds: 99999,
					guildName: 'MyGuild',
					guildId: 888,
				}),
			);
		});

		test('should handle missing optional fields gracefully', async () => {
			const data = { userId: 1 };
			await tracker.trackPlayerData(data);

			expect(mockStorage.add).toHaveBeenCalledWith(
				'snapshots',
				expect.objectContaining({
					playerId: 1,
					playerName: 'Unknown',
					level: 0,
				}),
			);
		});
	});

	// ─── trackHeroesData ─────────────────────────────────────────────────

	describe('trackHeroesData', () => {
		test('should save each hero as a separate snapshot', async () => {
			const data = {
				'101': { id: 101, name: 'Galahad', level: 120, star: 6, color: 15, power: 50000 },
				'102': { id: 102, name: 'Astaroth', level: 115, star: 5, color: 12, power: 48000 },
			};

			await tracker.trackHeroesData(data);

			expect(mockStorage.add).toHaveBeenCalledTimes(2);
			expect(mockStorage.add).toHaveBeenCalledWith(
				'heroes',
				expect.objectContaining({ heroId: 101, heroName: 'Galahad', level: 120 }),
			);
			expect(mockStorage.add).toHaveBeenCalledWith(
				'heroes',
				expect.objectContaining({ heroId: 102, heroName: 'Astaroth', level: 115 }),
			);
		});
	});

	// ─── Error Handling ──────────────────────────────────────────────────

	describe('Error Handling', () => {
		test('should not throw on null data to trackPlayerData', async () => {
			// trackPlayerData accesses data.arenaRank etc., so null will throw
			// internally — but the caller (processAPIResponse) catches it.
			// Here we verify processAPIResponse doesn't propagate the error.
			const request = {
				calls: [{ name: 'userGetInfo', ident: 'body', args: {} }],
			};
			const response = {
				results: [{ ident: 'body', result: { response: null } }],
			};

			// null response → result.result.response is null → skip
			await expect(tracker.processAPIResponse(request, response)).resolves.not.toThrow();
		});

		test('should not throw when storage.add fails', async () => {
			mockStorage.add.mockRejectedValue(new Error('Storage error'));

			const request = {
				calls: [{ name: 'userGetInfo', ident: 'u', args: {} }],
			};
			const response = {
				results: [{ ident: 'u', result: { response: { userId: 1, name: 'X', level: 1 } } }],
			};

			// processAPIResponse has try/catch around each case
			await expect(tracker.processAPIResponse(request, response)).resolves.not.toThrow();
		});
	});
});
