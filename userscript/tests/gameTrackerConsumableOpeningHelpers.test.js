import {
	appendChestHistory,
	applyChestDropRateUpdates,
	buildChestHistoryEntry,
	buildChestOpeningRecord,
	buildChestResourceTransactionIntents,
	buildConsumableDropRecords,
	sourceTypeLabel,
} from '../src/modules/trackers/GameTrackerConsumableOpeningHelpers.js';

describe('GameTrackerConsumableOpeningHelpers', () => {
	test('buildChestOpeningRecord keeps payload parity', () => {
		const record = buildChestOpeningRecord('artifactChest', '45', 2, [{ itemType: 'gold', itemId: 'gold', quantity: 100 }], 1234);

		expect(record).toEqual({
			chestType: 'artifactChest',
			sourceId: '45',
			quantity: 2,
			dropCount: 1,
			timestamp: 1234,
		});
	});

	test('buildConsumableDropRecords preserves row shape and opening fallback', () => {
		const drops = [{ itemType: 'coin', itemId: 3, quantity: 50 }];

		expect(buildConsumableDropRecords(drops, 2000, 'towerChest', '99', null)).toEqual([
			{
				timestamp: 2000,
				sourceType: 'towerChest',
				sourceId: '99',
				itemType: 'coin',
				itemId: '3',
				quantity: 50,
				openingId: 0,
			},
		]);
	});

	test('history helpers append and cap entries', () => {
		const entry = buildChestHistoryEntry('7', 'petChest', 1, [{ itemType: 'gold', itemId: 'gold', quantity: 10 }], 8888);
		const next = appendChestHistory([{ chestId: 'old' }], entry, 2);

		expect(next).toHaveLength(2);
		expect(next[1]).toEqual(entry);

		const capped = appendChestHistory(next, { chestId: 'new' }, 2);
		expect(capped).toEqual([{ chestId: '7', chestType: 'petChest', quantity: 1, rewards: [{ itemType: 'gold', itemId: 'gold', quantity: 10 }], timestamp: 8888 }, { chestId: 'new' }]);
	});

	test('sourceTypeLabel returns mapped and fallback labels', () => {
		expect(sourceTypeLabel('genericChest')).toBe('Chest');
		expect(sourceTypeLabel('outlandChest')).toBe('Outland Chest');
		expect(sourceTypeLabel('unknown')).toBe('unknown');
	});

	test('applyChestDropRateUpdates aggregates open count and item totals', () => {
		const dropRates = {};
		const updated = applyChestDropRateUpdates(dropRates, {
			chestType: 'artifactChest',
			chestId: '11',
			quantity: 2,
			rewards: [
				{ itemType: 'gold', itemId: 'gold', quantity: 100 },
				{ itemType: 'coin', itemId: '3', quantity: 20 },
			],
		});

		expect(updated.artifactChest_11.openCount).toBe(2);
		expect(updated.artifactChest_11.itemDrops.gold_gold).toEqual(expect.objectContaining({
			type: 'gold',
			id: 'gold',
			dropCount: 1,
			totalAmount: 100,
		}));
		expect(updated.artifactChest_11.itemDrops.coin_3).toEqual(expect.objectContaining({
			type: 'coin',
			id: '3',
			dropCount: 1,
			totalAmount: 20,
		}));
	});

	test('buildChestResourceTransactionIntents maps known rewards to resource transactions', () => {
		const intents = buildChestResourceTransactionIntents([
			{ itemType: 'gold', itemId: 'gold', quantity: 10 },
			{ itemType: 'starmoney', itemId: 'starmoney', quantity: 5 },
			{ itemType: 'coin', itemId: '3', quantity: 7 },
			{ itemType: 'gear', itemId: '9', quantity: 1 },
		], 'artifactChest_88');

		expect(intents).toEqual([
			{ resourceType: 'gold', amount: 10, source: 'chest', sourceDetail: 'artifactChest_88' },
			{ resourceType: 'emeralds', amount: 5, source: 'chest', sourceDetail: 'artifactChest_88' },
			{ resourceType: 'arena_coins', amount: 7, source: 'chest', sourceDetail: 'artifactChest_88' },
		]);
	});
});
