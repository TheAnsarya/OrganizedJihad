/**
 * HeroMaterialRequirementsCalculator tests.
 */

import HeroMaterialRequirementsCalculator from '../src/modules/helpers/HeroMaterialRequirementsCalculator.js';

describe('HeroMaterialRequirementsCalculator', () => {
	test('projects level and color requirements from tracked signals', () => {
		const result = HeroMaterialRequirementsCalculator.calculateProjectedRequirements({
			heroes: [
				{ heroId: 1, heroName: 'Astaroth', level: 120, color: 15 },
				{ heroId: 2, heroName: 'Keira', level: 110, color: 14 },
			],
			heroUpgrades: [
				{ upgradeType: 'level', levelBefore: 100, levelAfter: 110 },
				{ upgradeType: 'level', levelBefore: 110, levelAfter: 120 },
				{ upgradeType: 'color', colorRankBefore: 13, colorRankAfter: 14 },
				{ upgradeType: 'color', colorRankBefore: 14, colorRankAfter: 15 },
			],
			equipmentChanges: [
				{ heroColorRank: 15, materialsConsumed: JSON.stringify({ item_red_fragment: 12, item_violet_dust: 8 }) },
				{ heroColorRank: 16, materialsConsumed: JSON.stringify({ item_red_fragment: 10 }) },
			],
			inventoryItemUsages: [
				{ usageContext: 'hero_level', itemId: 'xp_potion_l', quantityUsed: 200 },
				{ usageContext: 'hero_level', itemId: 'gold_coin', quantityUsed: 1000 },
				{ usageContext: 'hero_evolve', itemId: 'item_red_fragment', quantityUsed: 4 },
			],
				inventoryData: {
					consumable: {
						xp_potion_l: 140,
						gold_coin: 200,
						item_red_fragment: 6,
					},
				},
			targetLevel: 130,
			targetColorRank: 19,
			topItemLimit: 10,
		});

		expect(result.heroCount).toBe(2);
		expect(result.totalLevelDeficit).toBe(30);
		expect(result.totalColorDeficit).toBe(9);
		expect(result.items.length).toBeGreaterThan(0);
		expect(result.items.some((i) => i.itemId === 'xp_potion_l')).toBe(true);
		expect(result.items.some((i) => i.itemId === 'item_red_fragment')).toBe(true);
			expect(result.totalShortageItems).toBeGreaterThan(0);
		expect(result.confidenceScore).toBeGreaterThan(0);
	});

		test('computes owned and shortage per item from inventory data', () => {
			const result = HeroMaterialRequirementsCalculator.calculateProjectedRequirements({
				heroes: [{ heroId: 1, level: 120, color: 15 }],
				heroUpgrades: [
					{ upgradeType: 'level', levelBefore: 100, levelAfter: 110 },
					{ upgradeType: 'color', colorRankBefore: 14, colorRankAfter: 15 },
				],
				equipmentChanges: [
					{ heroColorRank: 16, materialsConsumed: JSON.stringify({ item_red_fragment: 10 }) },
				],
				inventoryItemUsages: [
					{ usageContext: 'hero_level', itemId: 'xp_potion_l', quantityUsed: 100 },
				],
				inventoryData: {
					consumable: {
						xp_potion_l: 200,
						item_red_fragment: 1,
					},
				},
				targetLevel: 130,
				targetColorRank: 19,
				topItemLimit: 10,
			});

			const xp = result.items.find((i) => i.itemId === 'xp_potion_l');
			const red = result.items.find((i) => i.itemId === 'item_red_fragment');

			expect(xp).toBeDefined();
			expect(xp.ownedQuantity).toBe(200);
			expect(xp.shortageQuantity).toBe(0);
			expect(red).toBeDefined();
			expect(red.ownedQuantity).toBe(1);
			expect(red.shortageQuantity).toBeGreaterThan(0);
			expect(result.totalOwnedForProjectedItems).toBeGreaterThan(0);
			expect(result.totalShortageItems).toBeGreaterThan(0);
		});

		test('keeps totalProjectedItems as full total beyond topItemLimit', () => {
			const result = HeroMaterialRequirementsCalculator.calculateProjectedRequirements({
				heroes: [{ heroId: 1, level: 100, color: 10 }],
				heroUpgrades: [
					{ upgradeType: 'level', levelBefore: 90, levelAfter: 100 },
					{ upgradeType: 'color', colorRankBefore: 9, colorRankAfter: 10 },
				],
				equipmentChanges: [
					{ heroColorRank: 11, materialsConsumed: JSON.stringify({ item_a: 5, item_b: 3 }) },
				],
				inventoryItemUsages: [
					{ usageContext: 'hero_level', itemId: 'xp_potion_l', quantityUsed: 30 },
				],
				targetLevel: 130,
				targetColorRank: 19,
				topItemLimit: 1,
			});

			expect(result.items).toHaveLength(1);
			expect(result.distinctItems).toBeGreaterThan(1);
			expect(result.totalProjectedItems).toBeGreaterThan(result.items[0].quantity);
		});

		test('builds deterministic tier summaries for color progression', () => {
			const result = HeroMaterialRequirementsCalculator.calculateProjectedRequirements({
				heroes: [{ heroId: 1, level: 120, color: 10 }],
				heroUpgrades: [
					{ upgradeType: 'color', colorRankBefore: 9, colorRankAfter: 10 },
				],
				equipmentChanges: [
					{ heroColorRank: 11, materialsConsumed: JSON.stringify({ orange_fragment: 5 }) },
					{ heroColorRank: 15, materialsConsumed: JSON.stringify({ red_fragment: 7 }) },
				],
				targetLevel: 130,
				targetColorRank: 19,
				topTierItemLimit: 5,
			});

			expect(Array.isArray(result.tierSummaries)).toBe(true);
			expect(result.tierSummaries.map((t) => t.tierName)).toEqual([
				'Grey',
				'Green',
				'Blue',
				'Violet',
				'Orange',
				'Red+',
			]);

			const orangeTier = result.tierSummaries.find((t) => t.tierName === 'Orange');
			const redTier = result.tierSummaries.find((t) => t.tierName === 'Red+');
			expect(orangeTier.totalProjectedItems).toBeGreaterThan(0);
			expect(redTier.totalProjectedItems).toBeGreaterThan(0);
			expect(redTier.items.some((i) => i.itemId === 'red_fragment')).toBe(true);
		});

		test('computes owned and shortage values in tier summaries', () => {
			const result = HeroMaterialRequirementsCalculator.calculateProjectedRequirements({
				heroes: [{ heroId: 1, level: 120, color: 14 }],
				heroUpgrades: [
					{ upgradeType: 'color', colorRankBefore: 13, colorRankAfter: 14 },
				],
				equipmentChanges: [
					{ heroColorRank: 15, materialsConsumed: JSON.stringify({ red_fragment: 10 }) },
				],
				inventoryData: {
					consumable: {
						red_fragment: 3,
					},
				},
				targetColorRank: 19,
				topTierItemLimit: 5,
			});

			const redTier = result.tierSummaries.find((t) => t.tierName === 'Red+');
			expect(redTier).toBeDefined();
			expect(redTier.totalProjectedItems).toBeGreaterThan(0);
			expect(redTier.totalOwnedForProjectedItems).toBeGreaterThan(0);
			expect(redTier.totalShortageItems).toBeGreaterThan(0);
		});

	test('falls back cleanly with sparse signals', () => {
		const result = HeroMaterialRequirementsCalculator.calculateProjectedRequirements({
			heroes: [{ heroId: 1, level: 100, color: 10 }],
			heroUpgrades: [],
			equipmentChanges: [],
			inventoryItemUsages: [],
			targetLevel: 130,
			targetColorRank: 19,
		});

		expect(result.totalLevelDeficit).toBe(30);
		expect(result.totalColorDeficit).toBe(9);
		expect(result.items).toHaveLength(0);
		expect(result.confidenceScore).toBe(0);
	});

	test('normalizes duplicate heroes by heroId', () => {
		const result = HeroMaterialRequirementsCalculator.calculateProjectedRequirements({
			heroes: [
				{ heroId: 7, level: 90, color: 8 },
				{ heroId: 7, level: 100, color: 10 },
			],
			targetLevel: 130,
			targetColorRank: 19,
		});

		expect(result.heroCount).toBe(1);
	});
});
