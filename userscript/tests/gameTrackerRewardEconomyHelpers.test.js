import {
	buildExpeditionBattleRecord,
	buildExpeditionResourceRewardIntents,
	buildExpeditionStateMetadata,
	buildMissionResourceRewardIntents,
	buildQuestCompletionRecord,
	buildQuestResourceRewardIntents,
	buildShopPurchaseRecord,
	buildShopResourceSpendIntents,
	buildTowerResourceRewardIntents,
	extractDropsIntoArray,
	normalizeRewardsPayload,
	resolveRewardPayload,
	resolveRewardSources,
} from '../src/modules/trackers/GameTrackerRewardEconomyHelpers.js';

describe('GameTrackerRewardEconomyHelpers', () => {
	test('resolveRewardSources includes known keys and fallback', () => {
		expect(resolveRewardSources({ chestReward: { gold: 1 }, reward: { gold: 2 } })).toEqual([
			{ gold: 1 },
			{ gold: 2 },
		]);
		expect(resolveRewardSources({ foo: { bar: 1 } })).toEqual([{ foo: { bar: 1 } }]);
		expect(resolveRewardSources(null)).toEqual([]);
	});

	test('extractDropsIntoArray supports scalar/category/numeric-wrapper formats', () => {
		const drops = [];
		extractDropsIntoArray({ gold: 500, consumable: { 45: 1 } }, drops);
		expect(drops).toEqual([
			{ itemType: 'gold', itemId: 'gold', quantity: 500 },
			{ itemType: 'consumable', itemId: '45', quantity: 1 },
		]);

		const nested = [];
		extractDropsIntoArray({ 500: { gear: { 55: 3 } } }, nested);
		expect(nested).toEqual([{ itemType: 'gear', itemId: '55', quantity: 3 }]);
	});

	test('normalizeRewardsPayload flattens mixed reward sources', () => {
		const result = normalizeRewardsPayload({
			reward: [{ consumable: { 1: 2 } }],
			skullReward: { coin: { 7: 150 } },
		});

		expect(result).toEqual([
			{ itemType: 'consumable', itemId: '1', quantity: 2 },
			{ itemType: 'coin', itemId: '7', quantity: 150 },
		]);
	});

	test('buildShopPurchaseRecord preserves existing shape defaults', () => {
		const record = buildShopPurchaseRecord({ shopId: 'arena', itemId: 2, cost: { gold: 300 } }, {}, 'p1', 'iso');
		expect(record).toEqual({
			purchasedAt: 'iso',
			shopType: 'arena',
			itemId: 2,
			itemName: 'Item_2',
			quantity: 1,
			costType: 'gold',
			costAmount: 300,
			playerId: 'p1',
		});
	});

	test('buildShopResourceSpendIntents maps all known shop costs', () => {
		const intents = buildShopResourceSpendIntents({
			gold: 100,
			starmoney: 5,
			arenaToken: 10,
			guildWarToken: 11,
			titanPotion: 12,
		}, 'gold', 100, 'arena_shop');

		expect(intents).toEqual([
			{ resourceType: 'gold', amount: -100, source: 'shop', sourceDetail: 'arena_shop' },
			{ resourceType: 'emeralds', amount: -5, source: 'shop', sourceDetail: 'arena_shop' },
			{ resourceType: 'arena_coins', amount: -10, source: 'shop', sourceDetail: 'arena_shop' },
			{ resourceType: 'guild_war_coins', amount: -11, source: 'shop', sourceDetail: 'arena_shop' },
			{ resourceType: 'titan_potion', amount: -12, source: 'shop', sourceDetail: 'arena_shop' },
		]);
	});

	test('quest helpers build record and reward intents', () => {
		const record = buildQuestCompletionRecord({ questId: 77 }, { reward: { gold: 100 } }, 'p1', 'done');
		expect(record).toEqual(expect.objectContaining({
			questId: 77,
			questType: 'daily',
			rewardData: JSON.stringify({ gold: 100 }),
		}));

		expect(buildQuestResourceRewardIntents({ gold: 10, starmoney: 2, arenaToken: 3, guildWarToken: 4, titanPotion: 5 }, 'Quest_77')).toEqual([
			{ resourceType: 'gold', amount: 10, source: 'quest', sourceDetail: 'Quest_77' },
			{ resourceType: 'emeralds', amount: 2, source: 'quest', sourceDetail: 'Quest_77' },
			{ resourceType: 'arena_coins', amount: 3, source: 'quest', sourceDetail: 'Quest_77' },
			{ resourceType: 'guild_war_coins', amount: 4, source: 'quest', sourceDetail: 'Quest_77' },
			{ resourceType: 'titan_potion', amount: 5, source: 'quest', sourceDetail: 'Quest_77' },
		]);
	});

	test('expedition helpers build state, battle row, and reward intents', () => {
		expect(buildExpeditionStateMetadata({ currentNode: 3, progress: 40, rewards: [1] }, 99)).toEqual({
			currentNode: 3,
			progress: 40,
			rewards: [1],
			timestamp: 99,
		});

		const battle = buildExpeditionBattleRecord({ expeditionId: 7, bossId: 9 }, { reward: { gold: 50 } }, 'p2', 'ts');
		expect(battle).toEqual(expect.objectContaining({
			timestamp: 'ts',
			expeditionId: 7,
			bossId: 9,
			bossName: 'Boss_9',
			rewardData: JSON.stringify({ gold: 50 }),
			playerId: 'p2',
		}));

		expect(buildExpeditionResourceRewardIntents({ gold: 10, starmoney: 1 }, '7')).toEqual([
			{ resourceType: 'gold', amount: 10, source: 'battle', sourceDetail: 'expedition_7' },
			{ resourceType: 'emeralds', amount: 1, source: 'battle', sourceDetail: 'expedition_7' },
		]);
	});

	test('mission/tower reward intent builders preserve source detail format', () => {
		expect(buildMissionResourceRewardIntents({ gold: 4, starmoney: 1 }, 'M_1')).toEqual([
			{ resourceType: 'gold', amount: 4, source: 'battle', sourceDetail: 'mission_M_1' },
			{ resourceType: 'emeralds', amount: 1, source: 'battle', sourceDetail: 'mission_M_1' },
		]);

		expect(buildTowerResourceRewardIntents({ gold: 8, starmoney: 2 }, 'regular', 33)).toEqual([
			{ resourceType: 'gold', amount: 8, source: 'battle', sourceDetail: 'regular_tower_floor_33' },
			{ resourceType: 'emeralds', amount: 2, source: 'battle', sourceDetail: 'regular_tower_floor_33' },
		]);
	});

	test('resolveRewardPayload prefers reward over rewards and defaults empty object', () => {
		expect(resolveRewardPayload({ reward: { gold: 1 }, rewards: { gold: 9 } })).toEqual({ gold: 1 });
		expect(resolveRewardPayload({ rewards: { gold: 3 } })).toEqual({ gold: 3 });
		expect(resolveRewardPayload({})).toEqual({});
	});
});
