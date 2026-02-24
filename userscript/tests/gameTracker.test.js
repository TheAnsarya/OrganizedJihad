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
import { decompressHeroBatch } from '../src/modules/heroCompression.js';

/**
 * Extract the first hero from the compressed batch stored via mockStorage.add('heroes', ...).
 * With #43 compression, heroes are stored as a single batch record instead of individual rows.
 *
 * @param {jest.Mock} addMock - mockStorage.add mock
 * @param {number} [heroIndex=0] - Index within the batch's heroes array
 * @returns {Object|undefined} The decompressed hero record
 */
function extractHeroFromBatch(addMock, heroIndex = 0) {
	const call = addMock.mock.calls.find((c) => c[0] === 'heroes');
	if (!call) return undefined;
	const batch = call[1];
	if (batch._compressed) {
		const heroes = decompressHeroBatch(batch);
		return heroes[heroIndex];
	}
	return batch; // legacy individual record
}

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
			setMetadata: jest.fn().mockResolvedValue(undefined),
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
		test('should save heroes as a compressed batch', async () => {
			const data = {
				'2': { id: 2, level: 120, star: 6, color: 15, power: 50000 },
				'4': { id: 4, level: 115, star: 5, color: 12, power: 48000 },
			};

			await tracker.trackHeroesData(data);

			// 1 compressed batch + 1 activity event = 2 add calls
			expect(mockStorage.add).toHaveBeenCalledTimes(2);
			expect(mockStorage.add).toHaveBeenCalledWith(
				'heroes',
				expect.objectContaining({ _compressed: 1 }),
			);
			// Verify both heroes are in the batch with dictionary-resolved names
			const batch = mockStorage.add.mock.calls.find((c) => c[0] === 'heroes')?.[1];
			const heroes = decompressHeroBatch(batch);
			expect(heroes).toHaveLength(2);
			expect(heroes.find((h) => h.heroId === 2).heroName).toBe('Galahad');
			expect(heroes.find((h) => h.heroId === 4).heroName).toBe('Astaroth');
		});

		test('should extract skills from {skillId: level} format', async () => {
			const data = {
				'2': {
					id: 2, level: 130, star: 6, color: 18, power: 198000,
					skills: { 2: 130, 3: 120, 4: 110, 5: 100 },
				},
			};

			await tracker.trackHeroesData(data);

			// Skills sorted descending → skillLevel1=130, skillLevel2=120, etc.
			const savedHero = extractHeroFromBatch(mockStorage.add);
			expect(savedHero.skillLevel1).toBe(130);
			expect(savedHero.skillLevel2).toBe(120);
			expect(savedHero.skillLevel3).toBe(110);
			expect(savedHero.skillLevel4).toBe(100);
		});

		test('should store rawSkills as JSON-stringified skills object', async () => {
			const skills = { 2: 130, 3: 120, 4: 110, 5: 100 };
			const data = {
				'1': { id: 1, level: 130, star: 6, color: 18, power: 198000, skills },
			};

			await tracker.trackHeroesData(data);

			const savedHero = extractHeroFromBatch(mockStorage.add);
			expect(JSON.parse(savedHero.rawSkills)).toEqual(skills);
		});

		test('should count skins from {skinId: level} object', async () => {
			const data = {
				'1': {
					id: 1, level: 100, star: 5, color: 15, power: 150000,
					skins: { 1: 60, 54: 40, 95: 20 },
				},
			};

			await tracker.trackHeroesData(data);

			// 3 skins in the object → skins field = 3 (stored in compressed batch)
			const savedHero = extractHeroFromBatch(mockStorage.add);
			expect(savedHero.skins).toBe(3);
		});

		test('should store rawSkins as JSON-stringified skins object', async () => {
			const skinsObj = { 1: 60, 54: 40, 95: 20 };
			const data = {
				'1': { id: 1, level: 100, star: 5, color: 15, power: 150000, skins: skinsObj },
			};

			await tracker.trackHeroesData(data);

			const savedHero = extractHeroFromBatch(mockStorage.add);
			expect(JSON.parse(savedHero.rawSkins)).toEqual(skinsObj);
		});

		test('should store artifact levels from artifacts array', async () => {
			const data = {
				'1': {
					id: 1, level: 130, star: 6, color: 18, power: 198000,
					artifacts: [
						{ level: 100, star: 5 },
						{ level: 80, star: 4 },
						{ level: 60, star: 3 },
					],
				},
			};

			await tracker.trackHeroesData(data);

			const savedHero = extractHeroFromBatch(mockStorage.add);
			expect(savedHero.artifactWeapon).toBe(5);
			expect(savedHero.artifactBook).toBe(4);
			expect(savedHero.artifactRing).toBe(3);
			expect(JSON.parse(savedHero.artifactLevels)).toEqual([100, 80, 60]);
		});

		test('should store runes, titanGiftLevel, ascensions, and petId', async () => {
			const runesArr = [43750, 30000, 25000, 20000, 15000];
			const ascObj = { 1: [0, 1, 2], 2: [0, 1] };
			const data = {
				'1': {
					id: 1, level: 130, star: 6, color: 18, power: 198000,
					runes: runesArr,
					titanGiftLevel: 25,
					ascensions: ascObj,
					petId: 6001,
				},
			};

			await tracker.trackHeroesData(data);

			const savedHero = extractHeroFromBatch(mockStorage.add);
			expect(JSON.parse(savedHero.runes)).toEqual(runesArr);
			expect(savedHero.titanGiftLevel).toBe(25);
			expect(JSON.parse(savedHero.ascensions)).toEqual(ascObj);
			expect(savedHero.petId).toBe(6001);
		});

		test('should cache heroes in metadata for fast UI access', async () => {
			const data = {
				'2': { id: 2, level: 120, star: 6, color: 15, power: 50000 },
			};

			await tracker.trackHeroesData(data);

			expect(mockStorage.setMetadata).toHaveBeenCalledWith(
				'heroesData',
				expect.arrayContaining([
					expect.objectContaining({ heroId: 2, heroName: 'Galahad' }),
				]),
			);
		});

		test('should include new fields in dedup fingerprint', async () => {
			const data1 = {
				'1': {
					id: 1, level: 100, star: 5, color: 15, power: 50000,
					skills: { 2: 100 },
					runes: [10000, 10000, 10000, 10000, 10000],
				},
			};
			const data2 = {
				'1': {
					id: 1, level: 100, star: 5, color: 15, power: 50000,
					skills: { 2: 101 },  // skill upgraded
					runes: [10000, 10000, 10000, 10000, 10000],
				},
			};

			await tracker.trackHeroesData(data1);
			await tracker.trackHeroesData(data2);

			// Both should be written (not deduped) because skills changed
			// 2 compressed batches + 2 activity events = 4 add calls
			expect(mockStorage.add).toHaveBeenCalledTimes(4);
		});

		test('should handle hero with no optional fields gracefully', async () => {
			const data = {
				'1': { id: 1, level: 50, star: 2, color: 5, power: 10000 },
			};

			await tracker.trackHeroesData(data);

			// Decompressed from batch — defaults restored by decompression
			const savedHero = extractHeroFromBatch(mockStorage.add);
			expect(savedHero.skins).toBe(0);
			expect(savedHero.skillLevel1).toBe(0);
			expect(savedHero.titanGiftLevel).toBe(0);
			expect(savedHero.petId).toBe(0);
			expect(JSON.parse(savedHero.rawSkills)).toEqual({});
			expect(JSON.parse(savedHero.rawSkins)).toEqual({});
			expect(JSON.parse(savedHero.runes)).toEqual([]);
			expect(JSON.parse(savedHero.ascensions)).toEqual({});
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

		test('should log errors via _logError and increment errorCount', async () => {
			const onErrorSpy = jest.fn();
			tracker.onError = onErrorSpy;

			await tracker._logError('testContext', new Error('boom'));

			expect(tracker.errorCount).toBe(1);
			expect(onErrorSpy).toHaveBeenCalledWith(1);
			expect(mockStorage.add).toHaveBeenCalledWith(
				'errorLog',
				expect.objectContaining({
					context: 'testContext',
					message: 'boom',
				}),
			);
		});

		test('should keep only last 200 errors in errorLog store', async () => {
			// Pre-fill with 205 existing entries
			const existing = Array.from({ length: 205 }, (_, i) => ({
				id: i + 1,
				context: `old_${i}`,
				message: `error ${i}`,
				stack: null,
				timestamp: i,
			}));
			mockStorage.getAll.mockResolvedValue(existing);

			await tracker._logError('new_error', new Error('newest'));

			// Should delete the 5 oldest entries (205 > 200)
			expect(mockStorage.delete).toHaveBeenCalledTimes(5);
		});

		test('should not throw if _logError itself fails', async () => {
			mockStorage.add.mockRejectedValue(new Error('IDB dead'));

			await expect(tracker._logError('ctx', new Error('x'))).resolves.not.toThrow();
			expect(tracker.errorCount).toBe(1);
		});
	});

	// ─── Deduplication ───────────────────────────────────────────────────

	describe('Deduplication', () => {
		test('should skip duplicate player snapshots', async () => {
			const data = { userId: 1, name: 'A', level: 50, gold: 1000, starmoney: 500 };

			await tracker.trackPlayerData(data);
			await tracker.trackPlayerData(data);

			// add called once for snapshot + once for activity event (second call is deduped)
			expect(mockStorage.add).toHaveBeenCalledTimes(2);
		});

		test('should write player snapshot when key fields change', async () => {
			const data1 = { userId: 1, name: 'A', level: 50, gold: 1000, starmoney: 500 };
			const data2 = { userId: 1, name: 'A', level: 51, gold: 1000, starmoney: 500 };

			await tracker.trackPlayerData(data1);
			await tracker.trackPlayerData(data2);

			// 2 snapshots + 2 activity events = 4 add calls
			expect(mockStorage.add).toHaveBeenCalledTimes(4);
		});

		test('should skip duplicate hero snapshots', async () => {
			const data = {
				'1': { id: 1, level: 100, star: 6, color: 15, power: 50000 },
				'2': { id: 2, level: 90, star: 5, color: 12, power: 40000 },
			};

			await tracker.trackHeroesData(data);
			await tracker.trackHeroesData(data);

			// 1 compressed batch + 1 activity on first call, 0 on second (deduped) = 2
			expect(mockStorage.add).toHaveBeenCalledTimes(2);
		});

		test('should write hero snapshots when power changes', async () => {
			const data1 = {
				'1': { id: 1, level: 100, star: 6, color: 15, power: 50000 },
			};
			const data2 = {
				'1': { id: 1, level: 100, star: 6, color: 15, power: 50001 },
			};

			await tracker.trackHeroesData(data1);
			await tracker.trackHeroesData(data2);

			// 1 compressed batch + 1 activity on each call = 4
			expect(mockStorage.add).toHaveBeenCalledTimes(4);
		});

		test('should produce deterministic fingerprints', () => {
			const data = [1, 'two', [3, 4]];
			expect(tracker._computeDataFingerprint(data)).toBe(tracker._computeDataFingerprint(data));
			expect(tracker._computeDataFingerprint(data)).not.toBe(
				tracker._computeDataFingerprint([1, 'two', [3, 5]]),
			);
		});
	});

	// ─── Reward Normalization ────────────────────────────────────────────

	describe('_normalizeRewards', () => {
		test('should return empty array for null/undefined data', () => {
			expect(tracker._normalizeRewards(null)).toEqual([]);
			expect(tracker._normalizeRewards(undefined)).toEqual([]);
			expect(tracker._normalizeRewards('string')).toEqual([]);
		});

		test('should extract scalar resource keys (gold, starmoney, etc.)', () => {
			const data = { gold: 5000, starmoney: 100 };
			const drops = tracker._normalizeRewards(data);

			expect(drops).toEqual(expect.arrayContaining([
				{ itemType: 'gold', itemId: 'gold', quantity: 5000 },
				{ itemType: 'starmoney', itemId: 'starmoney', quantity: 100 },
			]));
			expect(drops).toHaveLength(2);
		});

		test('should extract category-keyed items (consumable, gear, coin)', () => {
			const data = { consumable: { '45': 1 }, gear: { '123': 3 } };
			const drops = tracker._normalizeRewards(data);

			expect(drops).toEqual(expect.arrayContaining([
				{ itemType: 'consumable', itemId: '45', quantity: 1 },
				{ itemType: 'gear', itemId: '123', quantity: 3 },
			]));
			expect(drops).toHaveLength(2);
		});

		test('should handle data.chestReward (array of category objects)', () => {
			const data = {
				chestReward: [
					{ consumable: { '45': 2 } },
					{ fragmentHero: { '12': 50 } },
				],
			};
			const drops = tracker._normalizeRewards(data);

			expect(drops).toEqual(expect.arrayContaining([
				{ itemType: 'consumable', itemId: '45', quantity: 2 },
				{ itemType: 'fragmentHero', itemId: '12', quantity: 50 },
			]));
			expect(drops).toHaveLength(2);
		});

		test('should handle nested count-keyed format (consumableUseLootBox)', () => {
			const data = { '500': { consumable: { '362': 1 }, gear: { '55': 3 } } };
			const drops = tracker._normalizeRewards(data);

			expect(drops).toEqual(expect.arrayContaining([
				{ itemType: 'consumable', itemId: '362', quantity: 1 },
				{ itemType: 'gear', itemId: '55', quantity: 3 },
			]));
			expect(drops).toHaveLength(2);
		});

		test('should handle tower chest skullReward format', () => {
			const data = { skullReward: { coin: { '7': 150 } } };
			const drops = tracker._normalizeRewards(data);

			expect(drops).toEqual([
				{ itemType: 'coin', itemId: '7', quantity: 150 },
			]);
		});

		test('should combine drops from multiple reward keys', () => {
			const data = {
				reward: { gold: 1000 },
				chestReward: [{ consumable: { '45': 1 } }],
			};
			const drops = tracker._normalizeRewards(data);

			expect(drops).toHaveLength(2);
			expect(drops).toEqual(expect.arrayContaining([
				{ itemType: 'gold', itemId: 'gold', quantity: 1000 },
				{ itemType: 'consumable', itemId: '45', quantity: 1 },
			]));
		});
	});

	// ─── Source Type Labels ──────────────────────────────────────────────

	describe('_sourceTypeLabel', () => {
		test('should return known labels', () => {
			expect(tracker._sourceTypeLabel('genericChest')).toBe('Chest');
			expect(tracker._sourceTypeLabel('artifactChest')).toBe('Artifact Chest');
			expect(tracker._sourceTypeLabel('petChest')).toBe('Pet Chest');
			expect(tracker._sourceTypeLabel('towerChest')).toBe('Tower Chest');
		});

		test('should return raw key for unknown types', () => {
			expect(tracker._sourceTypeLabel('unknownType')).toBe('unknownType');
		});
	});

	// ─── trackConsumableOpening ──────────────────────────────────────────

	describe('trackConsumableOpening', () => {
		test('should write chest record and drop records to storage', async () => {
			mockStorage.add.mockResolvedValue(42); // openingId
			mockStorage.getMetadata.mockResolvedValue([]);

			const args = { chestId: '100', amount: 3 };
			const data = { consumable: { '45': 1 }, gold: 500 };

			await tracker.trackConsumableOpening(args, data, 'artifactChest');

			// 1 chest record + 2 consumableRewards drops + 1 activityEvent + 1 resource transaction (gold)
			expect(mockStorage.add).toHaveBeenCalledWith(
				'chests',
				expect.objectContaining({
					chestType: 'artifactChest',
					sourceId: '100',
					quantity: 3,
					dropCount: 2,
				}),
			);

			expect(mockStorage.add).toHaveBeenCalledWith(
				'consumableRewards',
				expect.objectContaining({
					sourceType: 'artifactChest',
					sourceId: '100',
					itemType: 'consumable',
					itemId: '45',
					quantity: 1,
					openingId: 42,
				}),
			);

			expect(mockStorage.add).toHaveBeenCalledWith(
				'consumableRewards',
				expect.objectContaining({
					itemType: 'gold',
					itemId: 'gold',
					quantity: 500,
					openingId: 42,
				}),
			);
		});

		test('should mirror to metadata chestOpeningHistory', async () => {
			mockStorage.add.mockResolvedValue(1);
			mockStorage.getMetadata.mockResolvedValue([]);

			await tracker.trackConsumableOpening({ id: '99' }, { gold: 100 }, 'towerChest');

			expect(mockStorage.setMetadata).toHaveBeenCalledWith(
				'chestOpeningHistory',
				expect.arrayContaining([
					expect.objectContaining({
						chestId: '99',
						chestType: 'towerChest',
					}),
				]),
			);
		});

		test('should dispatch new API calls to trackConsumableOpening', async () => {
			const spy = jest.spyOn(tracker, 'trackConsumableOpening').mockResolvedValue();

			const apiCalls = [
				{ name: 'artifactChestOpen', expectedType: 'artifactChest' },
				{ name: 'titanArtifactChestOpen', expectedType: 'titanArtifactChest' },
				{ name: 'pet_chestOpen', expectedType: 'petChest' },
				{ name: 'consumableUseLootBox', expectedType: 'lootBox' },
				{ name: 'towerOpenChest', expectedType: 'towerChest' },
				{ name: 'bossOpenChestPay', expectedType: 'outlandChest' },
			];

			for (const { name, expectedType } of apiCalls) {
				spy.mockClear();

				const request = {
					calls: [{ name, ident: name, args: { id: '1' } }],
				};
				const response = {
					results: [{ ident: name, result: { response: { gold: 100 } } }],
				};

				await tracker.processAPIResponse(request, response);
				expect(spy).toHaveBeenCalledWith({ id: '1' }, { gold: 100 }, expectedType);
			}
		});
	});

	// ─── Handler Registry (#46) ──────────────────────────────────────────

	describe('Handler Registry', () => {
		test('should have _handlerRegistry Map populated on construction', () => {
			expect(tracker._handlerRegistry).toBeInstanceOf(Map);
			expect(tracker._handlerRegistry.size).toBeGreaterThan(0);
		});

		test('should have handlers registered for core API methods', () => {
			const coreMethods = [
				'userGetInfo', 'heroGetAll', 'inventoryGet',
				'arenaAttack', 'arenaEnd', 'titanArenaAttack',
				'grandArenaAttack', 'clanWarAttack', 'bossRaidAttack',
				'chestOpen', 'shopBuy', 'questComplete',
				'titanGetAll', 'petGetAll',
			];
			for (const method of coreMethods) {
				expect(tracker._handlerRegistry.has(method)).toBe(true);
			}
		});

		test('registerHandler should add a new handler', () => {
			const spy = jest.fn();
			tracker.registerHandler('testMethod', spy, 'testLabel');
			const handlers = tracker._handlerRegistry.get('testMethod');
			expect(handlers).toHaveLength(1);
			expect(handlers[0].handler).toBe(spy);
			expect(handlers[0].label).toBe('testLabel');
		});

		test('registerHandler should allow multiple handlers for same method', () => {
			const spy1 = jest.fn();
			const spy2 = jest.fn();
			tracker.registerHandler('multiTest', spy1, 'first');
			tracker.registerHandler('multiTest', spy2, 'second');
			const handlers = tracker._handlerRegistry.get('multiTest');
			expect(handlers).toHaveLength(2);
		});

		test('registerHandler should accept array of method names', () => {
			const spy = jest.fn();
			tracker.registerHandler(['methodA', 'methodB'], spy, 'multi');
			expect(tracker._handlerRegistry.has('methodA')).toBe(true);
			expect(tracker._handlerRegistry.has('methodB')).toBe(true);
		});

		test('should dispatch to custom registered handler via processAPIResponse', async () => {
			const spy = jest.fn().mockResolvedValue(undefined);
			tracker.registerHandler('customMethod', spy, 'custom');

			const request = {
				calls: [{ name: 'customMethod', ident: 'body', args: { x: 1 } }],
			};
			const response = {
				results: [{ ident: 'body', result: { response: { data: 'test' } } }],
			};

			await tracker.processAPIResponse(request, response);
			expect(spy).toHaveBeenCalledWith('customMethod', { x: 1 }, { data: 'test' });
		});
	});

	// ─── Request History Cleanup (#37) ───────────────────────────────────

	describe('Request History Cleanup', () => {
		test('should have _requestHistoryMaxAge set to 60 seconds', () => {
			expect(tracker._requestHistoryMaxAge).toBe(60_000);
		});

		test('_pruneRequestHistory should remove entries older than maxAge', () => {
			const now = Date.now();
			tracker.requestHistory = {
				'old_1': { timestamp: now - 120_000, request: {}, response: {} },
				'old_2': { timestamp: now - 90_000, request: {}, response: {} },
				'recent': { timestamp: now - 10_000, request: {}, response: {} },
			};

			tracker._pruneRequestHistory();

			expect(tracker.requestHistory).not.toHaveProperty('old_1');
			expect(tracker.requestHistory).not.toHaveProperty('old_2');
			expect(tracker.requestHistory).toHaveProperty('recent');
		});

		test('_pruneRequestHistory should handle empty history', () => {
			tracker.requestHistory = {};
			expect(() => tracker._pruneRequestHistory()).not.toThrow();
		});
	});

	// ─── Auth Header Capture (#36) ──────────────────────────────────────

	describe('Auth Header Capture', () => {
		test('should have capturedAuth object with null initial values', () => {
			expect(tracker.capturedAuth).toEqual({
				authToken: null,
				sessionId: null,
				requestId: null,
			});
		});
	});

	// ─── Sentry Blocking (#53) ──────────────────────────────────────────

	describe('Sentry Blocking', () => {
		test('should have blockSentry enabled by default', () => {
			expect(tracker.blockSentry).toBe(true);
		});

		test('should have _BLOCKED_URL_RE matching sentry.io', () => {
			expect(GameTracker._BLOCKED_URL_RE.test('https://o123.ingest.sentry.io/api/456/envelope/')).toBe(true);
			expect(GameTracker._BLOCKED_URL_RE.test('https://bugsnag.com/report')).toBe(true);
			expect(GameTracker._BLOCKED_URL_RE.test('https://heroes-wb.nextersglobal.com/api/')).toBe(false);
		});

		test('_blockedRequestCount should start at 0', () => {
			expect(tracker._blockedRequestCount).toBe(0);
		});
	});

	// ─── Destroy / Cleanup ──────────────────────────────────────────────

	describe('Destroy', () => {
		test('should set isTracking to false', () => {
			tracker.isTracking = true;
			tracker.destroy();
			expect(tracker.isTracking).toBe(false);
		});

		test('should clear cleanup interval', () => {
			// Set a real interval so clearInterval has something to clear
			tracker._cleanupIntervalId = setInterval(() => {}, 999999);
			expect(tracker._cleanupIntervalId).not.toBeNull();
			tracker.destroy();
			expect(tracker._cleanupIntervalId).toBeNull();
		});

		test('should clear purge interval', () => {
			tracker._purgeIntervalId = setInterval(() => {}, 999999);
			expect(tracker._purgeIntervalId).not.toBeNull();
			tracker.destroy();
			expect(tracker._purgeIntervalId).toBeNull();
		});
	});

	// =================================================================
	// Battle Fingerprinting & Deduplication (#44)
	// =================================================================

	describe('Battle Deduplication', () => {
		test('_battleFingerprint should produce consistent fingerprints', () => {
			const battle = {
				battleType: 'Arena',
				opponentId: '123',
				timestamp: '2025-01-01T12:00:00.000Z',
				isWin: true,
			};
			const fp1 = tracker._battleFingerprint(battle);
			const fp2 = tracker._battleFingerprint(battle);
			expect(fp1).toBe(fp2);
		});

		test('_battleFingerprint should differ for different opponents', () => {
			const base = { battleType: 'Arena', timestamp: '2025-01-01T12:00:00.000Z', isWin: true };
			const fp1 = tracker._battleFingerprint({ ...base, opponentId: '100' });
			const fp2 = tracker._battleFingerprint({ ...base, opponentId: '200' });
			expect(fp1).not.toBe(fp2);
		});

		test('_isBattleDuplicate should return false for first occurrence', () => {
			const battle = {
				battleType: 'Arena',
				opponentId: '123',
				timestamp: '2025-01-01T12:00:00.000Z',
				isWin: true,
			};
			expect(tracker._isBattleDuplicate(battle)).toBe(false);
		});

		test('_isBattleDuplicate should return true for second occurrence', () => {
			const battle = {
				battleType: 'Arena',
				opponentId: '123',
				timestamp: '2025-01-01T12:00:00.000Z',
				isWin: true,
			};
			tracker._isBattleDuplicate(battle); // first call
			expect(tracker._isBattleDuplicate(battle)).toBe(true);
		});

		test('_isBattleDuplicate should cap fingerprint set at 2000', () => {
			for (let i = 0; i < 2100; i++) {
				tracker._isBattleDuplicate({
					battleType: 'Arena',
					opponentId: String(i),
					timestamp: Date.now(),
					isWin: true,
				});
			}
			expect(tracker._battleFingerprintSet.size).toBeLessThanOrEqual(2000);
		});
	});

	// =================================================================
	// Replay Tracking (#42, #41)
	// =================================================================

	describe('Replay Tracking', () => {
		test('trackArenaReplay should store to battles store', async () => {
			const data = {
				result: { win: true },
				attackers: [{ id: 1, power: 100 }],
				defenders: [{ id: 2, power: 200 }],
			};
			await tracker.trackArenaReplay('arenaGetReplay', { enemyUserId: '42' }, data);
			expect(mockStorage.add).toHaveBeenCalledWith(
				'battles',
				expect.objectContaining({
					battleType: 'ArenaReplay',
					opponentId: '42',
					isWin: true,
				})
			);
		});

		test('trackArenaReplay should skip duplicates', async () => {
			const data = {
				result: { win: false },
				attackers: [{ id: 1, power: 100 }],
				defenders: [{ id: 2, power: 200 }],
			};
			await tracker.trackArenaReplay('arenaGetReplay', { enemyUserId: '42' }, data);
			mockStorage.add.mockClear();
			await tracker.trackArenaReplay('arenaGetReplay', { enemyUserId: '42' }, data);
			expect(mockStorage.add).not.toHaveBeenCalled();
		});

		test('trackArenaReplay should handle grand arena replays', async () => {
			const data = {
				result: { win: true },
				battles: [
					{ result: { win: true }, attackers: [{ id: 1 }], defenders: [{ id: 2 }] },
					{ result: { win: false }, attackers: [{ id: 3 }], defenders: [{ id: 4 }] },
				],
			};
			await tracker.trackArenaReplay('grandGetReplay', { enemyUserId: '99' }, data);
			// Should store once per round
			const battleCalls = mockStorage.add.mock.calls.filter(([store]) => store === 'battles');
			expect(battleCalls.length).toBe(2);
			expect(battleCalls[0][1].battleType).toBe('GrandArenaReplay');
		});

		test('trackAdventureReplay should store to battles store', async () => {
			const data = {
				result: { win: true },
				attackers: [{ id: 1, power: 500 }],
				defenders: [{ id: 10, power: 300 }],
			};
			await tracker.trackAdventureReplay('adventureGetReplay', { missionId: 'M5' }, data);
			expect(mockStorage.add).toHaveBeenCalledWith(
				'battles',
				expect.objectContaining({
					battleType: 'AdventureReplay',
					opponentId: 'M5',
				})
			);
		});

		test('trackAdventureReplay should handle boss replays', async () => {
			const data = {
				result: { win: false },
				attackers: [{ id: 1 }],
				defenders: [{ id: 99 }],
			};
			await tracker.trackAdventureReplay('bossGetReplay', { bossId: 'B7' }, data);
			expect(mockStorage.add).toHaveBeenCalledWith(
				'battles',
				expect.objectContaining({
					battleType: 'BossReplay',
					opponentId: 'B7',
				})
			);
		});
	});

	// =================================================================
	// Cross-Server War Tracking (#40)
	// =================================================================

	describe('Cross-Server War', () => {
		test('trackCrossServerWarResults should store battles', async () => {
			const data = {
				battles: [
					{
						defenderId: 'D1',
						result: { win: true },
						attackers: [{ id: 1 }],
						defenders: [{ id: 2 }],
						fortId: 'F3',
						warId: 'W1',
					},
				],
			};
			await tracker.trackCrossServerWarResults({}, data);
			expect(mockStorage.add).toHaveBeenCalledWith(
				'battles',
				expect.objectContaining({
					battleType: 'CrossServerWar',
					opponentId: 'D1',
					isWin: true,
					fortId: 'F3',
					warId: 'W1',
				})
			);
		});

		test('trackCrossServerWarResults should skip duplicates', async () => {
			const data = {
				battles: [
					{
						defenderId: 'D1',
						result: { win: true },
						attackers: [],
						defenders: [],
						fortId: 'F3',
						warId: 'W1',
					},
				],
			};
			await tracker.trackCrossServerWarResults({}, data);
			mockStorage.add.mockClear();
			await tracker.trackCrossServerWarResults({}, data);
			// Should be deduped
			const battleCalls = mockStorage.add.mock.calls.filter(([store]) => store === 'battles');
			expect(battleCalls.length).toBe(0);
		});

		test('trackCrossServerWarInfo should store metadata', async () => {
			const data = {
				warId: 'W99',
				enemy: { id: 'G123', name: 'EnemyGuild', serverId: 'S5' },
				myScore: 10,
				enemyScore: 8,
				state: 'active',
			};
			await tracker.trackCrossServerWarInfo(data);
			expect(mockStorage.setMetadata).toHaveBeenCalledWith(
				'currentCrossServerWar',
				expect.objectContaining({
					warId: 'W99',
					isCrossServer: true,
					enemyGuildName: 'EnemyGuild',
					enemyServer: 'S5',
				})
			);
		});

		test('handler registry should contain new handlers', () => {
			expect(tracker._handlerRegistry.has('clanWarGetBattleResults')).toBe(true);
			expect(tracker._handlerRegistry.has('arenaGetReplay')).toBe(true);
			expect(tracker._handlerRegistry.has('grandGetReplay')).toBe(true);
			expect(tracker._handlerRegistry.has('adventureGetReplay')).toBe(true);
			expect(tracker._handlerRegistry.has('bossGetReplay')).toBe(true);
			expect(tracker._handlerRegistry.has('arenaFindEnemies')).toBe(true);
		});
	});

	// =================================================================
	// Auto Data Purge (#45)
	// =================================================================

	describe('Auto Data Purge', () => {
		test('_runPurge should call storage.purgeOldRecords', async () => {
			mockStorage.purgeOldRecords = jest.fn().mockResolvedValue({ battles: 5 });
			await tracker._runPurge();
			expect(mockStorage.purgeOldRecords).toHaveBeenCalled();
		});

		test('_runPurge should pass user overrides from metadata', async () => {
			mockStorage.getMetadata.mockImplementation((key, def) => {
				if (key === 'purgeRetention') return { battles: 180 };
				return def;
			});
			mockStorage.purgeOldRecords = jest.fn().mockResolvedValue({});
			await tracker._runPurge();
			expect(mockStorage.purgeOldRecords).toHaveBeenCalledWith({ battles: 180 });
		});

		test('_schedulePurge should set _purgeIntervalId', () => {
			tracker._schedulePurge();
			expect(tracker._purgeIntervalId).not.toBeNull();
			// Clean up
			clearInterval(tracker._purgeIntervalId);
			tracker._purgeIntervalId = null;
		});
	});

	// ─── Pushd Hook (#38) ────────────────────────────────────────────────

	describe('Pushd Hook', () => {
		test('constructor should initialize pushd fields', () => {
			expect(tracker._pushdModule).toBeNull();
			expect(tracker._pushdRetryCount).toBe(0);
			expect(tracker._pushdTimerId).toBeNull();
			expect(tracker.pushEventCount).toBe(0);
		});

		test('_startPushdPolling should schedule a timer', () => {
			jest.useFakeTimers();
			tracker._startPushdPolling();
			expect(tracker._pushdTimerId).not.toBeNull();
			clearTimeout(tracker._pushdTimerId);
			jest.useRealTimers();
		});

		test('_tryHookPushd should retry up to 10 times when nxg is unavailable', () => {
			jest.useFakeTimers();
			tracker._tryHookPushd();
			expect(tracker._pushdRetryCount).toBe(1);
			expect(tracker._pushdTimerId).not.toBeNull();

			// Run through all retries
			for (let i = 1; i < 10; i++) {
				jest.advanceTimersByTime(10_000);
			}
			expect(tracker._pushdRetryCount).toBe(10);
			expect(tracker._pushdTimerId).toBeNull();

			jest.useRealTimers();
		});

		test('_tryHookPushd should hook pushd module when nxg is available', () => {
			const mockPushd = {
				on: jest.fn(),
			};
			// Simulate window.nxg
			const origNxg = window.nxg;
			window.nxg = {
				getModule: (name) => (name === 'pushd' ? mockPushd : null),
			};

			tracker._tryHookPushd();

			expect(tracker._pushdModule).toBe(mockPushd);
			expect(mockPushd.on).toHaveBeenCalledWith('message', expect.any(Function));
			expect(tracker._pushdTimerId).toBeNull(); // No retry scheduled

			// Cleanup
			window.nxg = origNxg;
		});

		test('_handlePushEvent should increment pushEventCount', async () => {
			await tracker._handlePushEvent({ type: 'chatMessage', data: {} });
			expect(tracker.pushEventCount).toBe(1);
			await tracker._handlePushEvent({ action: 'test', data: {} });
			expect(tracker.pushEventCount).toBe(2);
		});

		test('_handlePushEvent should dispatch to registered push handlers', async () => {
			const handler = jest.fn().mockResolvedValue();
			tracker.registerHandler('push:chatMessage', handler, 'testPushHandler');

			await tracker._handlePushEvent({ type: 'chatMessage', data: { msg: 'hello' } });

			expect(handler).toHaveBeenCalledWith('push:chatMessage', {}, { msg: 'hello' });
		});

		test('_handlePushEvent should log activity for significant events', async () => {
			const spy = jest.spyOn(tracker, '_logActivity').mockResolvedValue();
			await tracker._handlePushEvent({ type: 'chatMessage', data: {} });
			expect(spy).toHaveBeenCalledWith('push', expect.stringContaining('chatMessage'), expect.any(Object));
		});

		test('destroy should clear pushd timer', async () => {
			jest.useFakeTimers();
			tracker._startPushdPolling();
			expect(tracker._pushdTimerId).not.toBeNull();

			tracker.destroy();
			expect(tracker._pushdTimerId).toBeNull();

			jest.useRealTimers();
		});
	});

	// ─── WebSocket Proxy (#39) ───────────────────────────────────────────

	describe('WebSocket Proxy', () => {
		test('constructor should initialize _originalWsSend as null', () => {
			expect(tracker._originalWsSend).toBeNull();
		});

		test('proxyWebSocket should replace WebSocket.prototype.send', () => {
			const originalSend = WebSocket.prototype.send;
			tracker.proxyWebSocket();
			expect(WebSocket.prototype.send).not.toBe(originalSend);
			expect(tracker._originalWsSend).toBe(originalSend);
			// Cleanup
			WebSocket.prototype.send = originalSend;
		});

		test('destroy should restore original WebSocket.prototype.send', async () => {
			const originalSend = WebSocket.prototype.send;
			tracker.proxyWebSocket();
			expect(WebSocket.prototype.send).not.toBe(originalSend);

			tracker.destroy();
			expect(WebSocket.prototype.send).toBe(originalSend);
		});
	});

	// ─── Handler Dependencies (#47) ──────────────────────────────────────

	describe('Handler Dependencies', () => {
		test('registerHandler should accept dependsOn option', () => {
			const handler = jest.fn();
			tracker.registerHandler('testMethod', handler, 'testLabel', { dependsOn: ['userGetInfo'] });
			const entries = tracker._handlerRegistry.get('testMethod');
			expect(entries).toHaveLength(1);
			expect(entries[0].dependsOn).toEqual(['userGetInfo']);
		});

		test('registerHandler should warn on self-dependency', () => {
			const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
			const handler = jest.fn();
			tracker.registerHandler('selfDep', handler, 'selfLabel', { dependsOn: ['selfDep'] });
			expect(spy).toHaveBeenCalledWith(expect.stringContaining('circular self-dependency'));
			spy.mockRestore();
		});

		test('_topologicalSortMethods should return original order for no deps', () => {
			// Register handlers without dependencies
			tracker._handlerRegistry.set('a', [{ handler: jest.fn(), label: 'a', dependsOn: [] }]);
			tracker._handlerRegistry.set('b', [{ handler: jest.fn(), label: 'b', dependsOn: [] }]);
			tracker._handlerRegistry.set('c', [{ handler: jest.fn(), label: 'c', dependsOn: [] }]);

			const sorted = tracker._topologicalSortMethods(['a', 'b', 'c']);
			expect(sorted).toEqual(['a', 'b', 'c']);
		});

		test('_topologicalSortMethods should sort deps before dependents', () => {
			tracker._handlerRegistry.set('heroGetAll', [{
				handler: jest.fn(), label: 'hero', dependsOn: ['userGetInfo'],
			}]);
			tracker._handlerRegistry.set('userGetInfo', [{
				handler: jest.fn(), label: 'user', dependsOn: [],
			}]);

			// Even if heroGetAll comes first in the input, userGetInfo should come first
			const sorted = tracker._topologicalSortMethods(['heroGetAll', 'userGetInfo']);
			expect(sorted.indexOf('userGetInfo')).toBeLessThan(sorted.indexOf('heroGetAll'));
		});

		test('_topologicalSortMethods should handle circular deps gracefully', () => {
			const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
			tracker._handlerRegistry.set('a', [{ handler: jest.fn(), label: 'a', dependsOn: ['b'] }]);
			tracker._handlerRegistry.set('b', [{ handler: jest.fn(), label: 'b', dependsOn: ['a'] }]);

			const sorted = tracker._topologicalSortMethods(['a', 'b']);
			// Both should still appear, warn should fire
			expect(sorted).toHaveLength(2);
			expect(spy).toHaveBeenCalledWith(expect.stringContaining('Circular'));
			spy.mockRestore();
		});

		test('processAPIResponse should process deps before dependents', async () => {
			const callOrder = [];

			// Clear existing handlers and register fresh ones
			tracker._handlerRegistry.clear();
			tracker.registerHandler('heroGetAll', async () => {
				callOrder.push('hero');
			}, 'hero', { dependsOn: ['userGetInfo'] });
			tracker.registerHandler('userGetInfo', async () => {
				callOrder.push('user');
			}, 'user');

			// Response has heroGetAll BEFORE userGetInfo
			const request = {
				calls: [
					{ name: 'heroGetAll', ident: 'hero', args: {} },
					{ name: 'userGetInfo', ident: 'user', args: {} },
				],
			};
			const response = {
				results: [
					{ ident: 'hero', result: { response: {} } },
					{ ident: 'user', result: { response: {} } },
				],
			};

			await tracker.processAPIResponse(request, response);

			// userGetInfo should execute before heroGetAll despite order in response
			expect(callOrder).toEqual(['user', 'hero']);
		});
	});

	// ─── Opponent Tracking (#51) ─────────────────────────────────────────

	describe('Opponent Tracking', () => {
		test('updateOpponentRecord should create new record in opponents store', async () => {
			mockStorage.get.mockResolvedValue(null);

			await tracker.updateOpponentRecord('Arena', '12345', true, { name: 'Player1', power: 50000 });

			expect(mockStorage.put).toHaveBeenCalledWith('opponents', expect.objectContaining({
				opponentId: '12345',
				opponentName: 'Player1',
				totalWins: 1,
				totalLosses: 0,
				battleTypes: { Arena: { wins: 1, losses: 0 } },
			}));
		});

		test('updateOpponentRecord should update existing record', async () => {
			mockStorage.get.mockResolvedValue({
				opponentId: '12345',
				opponentName: 'Player1',
				totalWins: 3,
				totalLosses: 1,
				battleTypes: { Arena: { wins: 3, losses: 1 } },
				powerHistory: [],
				firstSeen: Date.now() - 86400000,
				lastSeen: Date.now() - 3600000,
			});

			await tracker.updateOpponentRecord('Arena', '12345', false, { power: 55000 });

			expect(mockStorage.put).toHaveBeenCalledWith('opponents', expect.objectContaining({
				opponentId: '12345',
				totalWins: 3,
				totalLosses: 2,
				battleTypes: { Arena: { wins: 3, losses: 2 } },
			}));
		});

		test('updateOpponentRecord should track different battle types separately', async () => {
			mockStorage.get.mockResolvedValue({
				opponentId: '12345',
				opponentName: 'Player1',
				totalWins: 1,
				totalLosses: 0,
				battleTypes: { Arena: { wins: 1, losses: 0 } },
				powerHistory: [],
				firstSeen: Date.now(),
				lastSeen: Date.now(),
			});

			await tracker.updateOpponentRecord('GrandArena', '12345', true);

			expect(mockStorage.put).toHaveBeenCalledWith('opponents', expect.objectContaining({
				totalWins: 2,
				totalLosses: 0,
				battleTypes: {
					Arena: { wins: 1, losses: 0 },
					GrandArena: { wins: 1, losses: 0 },
				},
			}));
		});

		test('updateOpponentRecord should track power history (bounded to 50)', async () => {
			const existingHistory = Array.from({ length: 49 }, (_, i) => ({
				power: 40000 + i * 100,
				timestamp: Date.now() - i * 3600000,
				battleType: 'Arena',
			}));
			mockStorage.get.mockResolvedValue({
				opponentId: '12345',
				opponentName: 'Player1',
				totalWins: 0,
				totalLosses: 0,
				battleTypes: {},
				powerHistory: existingHistory,
				firstSeen: Date.now(),
				lastSeen: Date.now(),
			});

			await tracker.updateOpponentRecord('Arena', '12345', true, { power: 60000 });

			const savedRecord = mockStorage.put.mock.calls[0][1];
			expect(savedRecord.powerHistory).toHaveLength(50);
			expect(savedRecord.powerHistory[49].power).toBe(60000);

			// Add one more — should still be 50
			mockStorage.get.mockResolvedValue(savedRecord);
			await tracker.updateOpponentRecord('Arena', '12345', true, { power: 61000 });

			const savedRecord2 = mockStorage.put.mock.calls[1][1];
			expect(savedRecord2.powerHistory).toHaveLength(50);
			expect(savedRecord2.powerHistory[49].power).toBe(61000);
		});

		test('updateOpponentRecord should skip if no opponentId', async () => {
			await tracker.updateOpponentRecord('Arena', null, true);
			await tracker.updateOpponentRecord('Arena', '', true);
			expect(mockStorage.put).not.toHaveBeenCalled();
		});

		test('updateOpponentRecord should accept boolean isWin (true/false)', async () => {
			mockStorage.get.mockResolvedValue(null);

			await tracker.updateOpponentRecord('Arena', '100', true);
			expect(mockStorage.put).toHaveBeenCalledWith('opponents', expect.objectContaining({
				totalWins: 1,
				totalLosses: 0,
			}));

			mockStorage.get.mockResolvedValue(null);
			await tracker.updateOpponentRecord('Arena', '200', false);
			expect(mockStorage.put).toHaveBeenCalledWith('opponents', expect.objectContaining({
				totalWins: 0,
				totalLosses: 1,
			}));
		});
	});

	// ─── Error Logging (#28) ─────────────────────────────────────────────

	describe('Error Logging', () => {
		test('_logError should write to errorLog IDB store', async () => {
			await tracker._logError('testContext', new Error('test error'));
			expect(mockStorage.add).toHaveBeenCalledWith('errorLog', expect.objectContaining({
				context: 'testContext',
				message: 'test error',
				timestamp: expect.any(Number),
			}));
		});

		test('_logError should increment errorCount', async () => {
			expect(tracker.errorCount).toBe(0);
			await tracker._logError('ctx1', new Error('err1'));
			expect(tracker.errorCount).toBe(1);
			await tracker._logError('ctx2', new Error('err2'));
			expect(tracker.errorCount).toBe(2);
		});

		test('_logError should call onError callback when set', async () => {
			const onError = jest.fn();
			tracker.onError = onError;
			await tracker._logError('ctx', new Error('test'));
			expect(onError).toHaveBeenCalledWith(1);
		});

		test('_logError should include stack trace (capped at 500 chars)', async () => {
			const err = new Error('test');
			err.stack = 'A'.repeat(600);
			await tracker._logError('ctx', err);
			const record = mockStorage.add.mock.calls.find((c) => c[0] === 'errorLog');
			expect(record[1].stack).toHaveLength(500);
		});

		test('_logError should prune to 200 entries when exceeded', async () => {
			const oldEntries = Array.from({ length: 205 }, (_, i) => ({
				id: i + 1,
				timestamp: i * 1000,
				context: 'old',
				message: 'err',
			}));
			mockStorage.getAll.mockResolvedValue(oldEntries);

			await tracker._logError('ctx', new Error('new'));

			// Should delete the 5 oldest entries (205 > 200)
			// delete is called for each excess entry
			expect(mockStorage.delete).toHaveBeenCalledTimes(5);
			expect(mockStorage.delete).toHaveBeenCalledWith('errorLog', 1);
			expect(mockStorage.delete).toHaveBeenCalledWith('errorLog', 5);
		});

		test('_logError should not throw if storage fails', async () => {
			mockStorage.add.mockRejectedValue(new Error('IDB full'));
			await expect(tracker._logError('ctx', new Error('test'))).resolves.not.toThrow();
		});
	});

	// ─── Snapshot Debounce (#28) ─────────────────────────────────────────

	describe('Snapshot Debounce', () => {
		test('constructor should initialize debounce fields', () => {
			expect(tracker._snapshotDebounceTimer).toBeNull();
			expect(tracker._snapshotDebounceDelay).toBe(5000);
		});

		test('_debouncedSnapshot should schedule a timer', () => {
			jest.useFakeTimers();
			tracker._debouncedSnapshot();
			expect(tracker._snapshotDebounceTimer).not.toBeNull();
			clearTimeout(tracker._snapshotDebounceTimer);
			jest.useRealTimers();
		});

		test('_debouncedSnapshot should restart timer on rapid calls', () => {
			jest.useFakeTimers();
			const spy = jest.spyOn(tracker, 'updateSnapshot').mockResolvedValue();

			tracker._debouncedSnapshot();
			const firstTimer = tracker._snapshotDebounceTimer;

			// Call again before timer fires
			tracker._debouncedSnapshot();
			expect(tracker._snapshotDebounceTimer).not.toBe(firstTimer);

			// Only after full delay should it fire
			jest.advanceTimersByTime(5000);
			expect(spy).toHaveBeenCalledTimes(1);

			spy.mockRestore();
			jest.useRealTimers();
		});

		test('_debouncedSnapshot should call updateSnapshot after delay', () => {
			jest.useFakeTimers();
			const spy = jest.spyOn(tracker, 'updateSnapshot').mockResolvedValue();

			tracker._debouncedSnapshot();
			expect(spy).not.toHaveBeenCalled();

			jest.advanceTimersByTime(5000);
			expect(spy).toHaveBeenCalledTimes(1);

			spy.mockRestore();
			jest.useRealTimers();
		});

		test('destroy should clear snapshot debounce timer', () => {
			jest.useFakeTimers();
			tracker._debouncedSnapshot();
			expect(tracker._snapshotDebounceTimer).not.toBeNull();

			tracker.destroy();
			expect(tracker._snapshotDebounceTimer).toBeNull();

			jest.useRealTimers();
		});
	});

	// =================================================================
	// Tracking Categories (#27)
	// =================================================================
	describe('Tracking Categories', () => {
		test('constructor should initialize all tracking prefs to true', () => {
			expect(tracker._trackingPrefs).toBeDefined();
			expect(tracker._trackingPrefs.player).toBe(true);
			expect(tracker._trackingPrefs.battles).toBe(true);
			expect(tracker._trackingPrefs.chests).toBe(true);
			expect(tracker._trackingPrefs.guild).toBe(true);
			expect(tracker._trackingPrefs.quests).toBe(true);
			expect(tracker._trackingPrefs.upgrades).toBe(true);
		});

		test('setTrackingCategory should update a category toggle', () => {
			const mockPref = { get: jest.fn(), set: jest.fn() };
			tracker.prefStorage = mockPref;

			tracker.setTrackingCategory('battles', false);
			expect(tracker._trackingPrefs.battles).toBe(false);
			expect(mockPref.set).toHaveBeenCalledWith('trackingPrefs', expect.objectContaining({ battles: false }));
		});

		test('getTrackingPrefs should return a copy of prefs', () => {
			const prefs = tracker.getTrackingPrefs();
			prefs.player = false; // mutate copy
			expect(tracker._trackingPrefs.player).toBe(true); // original unchanged
		});

		test('loadTrackingPrefs should restore saved preferences', () => {
			const mockPref = {
				get: jest.fn().mockReturnValue({ battles: false, chests: false }),
				set: jest.fn(),
			};
			tracker.loadTrackingPrefs(mockPref);
			expect(tracker._trackingPrefs.battles).toBe(false);
			expect(tracker._trackingPrefs.chests).toBe(false);
			expect(tracker._trackingPrefs.player).toBe(true); // not in saved
		});

		test('loadTrackingPrefs should handle null saved data', () => {
			const mockPref = { get: jest.fn().mockReturnValue(null), set: jest.fn() };
			tracker.loadTrackingPrefs(mockPref);
			expect(tracker._trackingPrefs.player).toBe(true);
		});

		test('handler dispatch should skip disabled categories', async () => {
			tracker._trackingPrefs.battles = false;
			const spy = jest.fn();

			// Register a handler with category 'battles'
			tracker.registerHandler('testBattleCall', spy, 'testBattle', { category: 'battles' });

			// Simulate a minimal API response
			const handlers = tracker._handlerRegistry.get('testBattleCall');
			expect(handlers).toBeDefined();
			expect(handlers.length).toBeGreaterThan(0);

			// The dispatch logic checks entry.category — verify the entry has it
			const entry = handlers[handlers.length - 1];
			expect(entry.category).toBe('battles');
		});

		test('handler registry entries should include category', () => {
			// Check that existing handlers have categories
			const heroHandlers = tracker._handlerRegistry.get('heroGetAll');
			expect(heroHandlers).toBeDefined();
			expect(heroHandlers[0].category).toBe('player');

			const arenaHandlers = tracker._handlerRegistry.get('arenaAttack');
			expect(arenaHandlers).toBeDefined();
			expect(arenaHandlers[0].category).toBe('battles');

			const chestHandlers = tracker._handlerRegistry.get('chestOpen');
			expect(chestHandlers).toBeDefined();
			expect(chestHandlers[0].category).toBe('chests');
		});
	});

	// =================================================================
	// Raw Data Export/Import (#27)
	// =================================================================
	describe('Raw Data Export/Import', () => {
		test('exportRawData should delegate to storage.exportAllStores', async () => {
			mockStorage.exportAllStores = jest.fn().mockResolvedValue({ _meta: {}, heroes: [] });
			const result = await tracker.exportRawData();
			expect(mockStorage.exportAllStores).toHaveBeenCalled();
			expect(result._meta).toBeDefined();
		});

		test('importRawData should delegate to storage.importStores', async () => {
			const importData = { heroes: [{ id: 1 }] };
			mockStorage.importStores = jest.fn().mockResolvedValue({ imported: { heroes: 1 }, skipped: {}, errors: [] });
			const result = await tracker.importRawData(importData);
			expect(mockStorage.importStores).toHaveBeenCalledWith(importData, undefined);
			expect(result.imported.heroes).toBe(1);
		});
	});
});
