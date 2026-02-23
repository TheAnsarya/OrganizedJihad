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
		test('should save each hero as a separate snapshot', async () => {
			const data = {
				'101': { id: 101, name: 'Galahad', level: 120, star: 6, color: 15, power: 50000 },
				'102': { id: 102, name: 'Astaroth', level: 115, star: 5, color: 12, power: 48000 },
			};

			await tracker.trackHeroesData(data);

			// 2 heroes + 1 activity event = 3 add calls
			expect(mockStorage.add).toHaveBeenCalledTimes(3);
			expect(mockStorage.add).toHaveBeenCalledWith(
				'heroes',
				expect.objectContaining({ heroId: 101, heroName: 'Galahad', level: 120 }),
			);
			expect(mockStorage.add).toHaveBeenCalledWith(
				'heroes',
				expect.objectContaining({ heroId: 102, heroName: 'Astaroth', level: 115 }),
			);
		});

		test('should extract skills from {skillId: level} format', async () => {
			const data = {
				'1': {
					id: 1, name: 'Galahad', level: 130, star: 6, color: 18, power: 198000,
					skills: { 2: 130, 3: 120, 4: 110, 5: 100 },
				},
			};

			await tracker.trackHeroesData(data);

			// Skills sorted descending → skillLevel1=130, skillLevel2=120, etc.
			expect(mockStorage.add).toHaveBeenCalledWith(
				'heroes',
				expect.objectContaining({
					skillLevel1: 130,
					skillLevel2: 120,
					skillLevel3: 110,
					skillLevel4: 100,
				}),
			);
		});

		test('should store rawSkills as JSON-stringified skills object', async () => {
			const skills = { 2: 130, 3: 120, 4: 110, 5: 100 };
			const data = {
				'1': { id: 1, level: 130, star: 6, color: 18, power: 198000, skills },
			};

			await tracker.trackHeroesData(data);

			const savedHero = mockStorage.add.mock.calls.find(
				(c) => c[0] === 'heroes'
			)?.[1];
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

			// 3 skins in the object → skins field = 3
			expect(mockStorage.add).toHaveBeenCalledWith(
				'heroes',
				expect.objectContaining({ skins: 3 }),
			);
		});

		test('should store rawSkins as JSON-stringified skins object', async () => {
			const skinsObj = { 1: 60, 54: 40, 95: 20 };
			const data = {
				'1': { id: 1, level: 100, star: 5, color: 15, power: 150000, skins: skinsObj },
			};

			await tracker.trackHeroesData(data);

			const savedHero = mockStorage.add.mock.calls.find(
				(c) => c[0] === 'heroes'
			)?.[1];
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

			const savedHero = mockStorage.add.mock.calls.find(
				(c) => c[0] === 'heroes'
			)?.[1];
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

			const savedHero = mockStorage.add.mock.calls.find(
				(c) => c[0] === 'heroes'
			)?.[1];
			expect(JSON.parse(savedHero.runes)).toEqual(runesArr);
			expect(savedHero.titanGiftLevel).toBe(25);
			expect(JSON.parse(savedHero.ascensions)).toEqual(ascObj);
			expect(savedHero.petId).toBe(6001);
		});

		test('should cache heroes in metadata for fast UI access', async () => {
			const data = {
				'1': { id: 1, name: 'Galahad', level: 120, star: 6, color: 15, power: 50000 },
			};

			await tracker.trackHeroesData(data);

			expect(mockStorage.setMetadata).toHaveBeenCalledWith(
				'heroesData',
				expect.arrayContaining([
					expect.objectContaining({ heroId: 1, heroName: 'Galahad' }),
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
			// 2 hero snapshots + 2 activity events = 4 add calls
			expect(mockStorage.add).toHaveBeenCalledTimes(4);
		});

		test('should handle hero with no optional fields gracefully', async () => {
			const data = {
				'1': { id: 1, level: 50, star: 2, color: 5, power: 10000 },
			};

			await tracker.trackHeroesData(data);

			const savedHero = mockStorage.add.mock.calls.find(
				(c) => c[0] === 'heroes'
			)?.[1];
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

			// getMetadata needs to return an array for the errorLog key
			mockStorage.getMetadata.mockResolvedValue([]);

			await tracker._logError('testContext', new Error('boom'));

			expect(tracker.errorCount).toBe(1);
			expect(onErrorSpy).toHaveBeenCalledWith(1);
			expect(mockStorage.setMetadata).toHaveBeenCalledWith(
				'errorLog',
				expect.arrayContaining([
					expect.objectContaining({
						context: 'testContext',
						message: 'boom',
					}),
				]),
			);
		});

		test('should keep only last 50 errors in log', async () => {
			// Pre-fill with 55 existing entries
			const existing = Array.from({ length: 55 }, (_, i) => ({
				context: `old_${i}`,
				message: `error ${i}`,
				stack: null,
				timestamp: i,
			}));
			mockStorage.getMetadata.mockResolvedValue(existing);

			await tracker._logError('new_error', new Error('newest'));

			const savedLog = mockStorage.setMetadata.mock.calls[0][1];
			expect(savedLog.length).toBe(50);
			expect(savedLog[savedLog.length - 1].context).toBe('new_error');
		});

		test('should not throw if _logError itself fails', async () => {
			mockStorage.getMetadata.mockRejectedValue(new Error('IDB dead'));

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

			// 2 heroes + 1 activity on first call, 0 on second (deduped) = 3
			expect(mockStorage.add).toHaveBeenCalledTimes(3);
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

			// 1 hero + 1 activity on each call = 4
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
	});
});
