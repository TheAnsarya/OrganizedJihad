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
		expect(result.confidenceScore).toBeGreaterThan(0);
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
