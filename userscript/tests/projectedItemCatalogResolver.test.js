/**
 * ProjectedItemCatalogResolver tests.
 */

import ProjectedItemCatalogResolver from '../src/modules/helpers/ProjectedItemCatalogResolver.js';

describe('ProjectedItemCatalogResolver', () => {
	test('buildRuntimeMetaMap includes name/category/icon for parsed inventory items', () => {
		const map = ProjectedItemCatalogResolver.buildRuntimeMetaMap([
			{ itemId: 'xp_potion_l', name: 'Large XP Potion', category: 'consumable' },
		]);

		expect(map.xp_potion_l).toBeDefined();
		expect(map.xp_potion_l.name).toBe('Large XP Potion');
		expect(map.xp_potion_l.category).toBe('consumable');
		expect(map.xp_potion_l.icon).toBe('🧪');
	});

	test('resolveItemMeta prefers runtime metadata when available', () => {
		const runtime = {
			item_red_fragment: {
				name: 'Red Fragment',
				category: 'fragment',
				icon: '🧩',
			},
		};

		const meta = ProjectedItemCatalogResolver.resolveItemMeta('item_red_fragment', runtime);
		expect(meta.name).toBe('Red Fragment');
		expect(meta.category).toBe('fragment');
		expect(meta.icon).toBe('🧩');
	});

	test('resolveItemMeta uses seeded catalog when runtime metadata is missing', () => {
		const meta = ProjectedItemCatalogResolver.resolveItemMeta('xp_potion_l', {});
		expect(meta.name).toBe('Large XP Potion');
		expect(meta.category).toBe('consumable');
		expect(meta.icon).toBe('🧪');
	});

	test('runtime metadata overrides seeded catalog entries', () => {
		const runtime = {
			xp_potion_l: {
				name: 'Custom XP Potion Name',
				category: 'resource',
				icon: '📦',
			},
		};

		const meta = ProjectedItemCatalogResolver.resolveItemMeta('xp_potion_l', runtime);
		expect(meta.name).toBe('Custom XP Potion Name');
		expect(meta.category).toBe('resource');
		expect(meta.icon).toBe('📦');
	});

	test('resolveItemMeta falls back deterministically for unknown IDs', () => {
		const meta = ProjectedItemCatalogResolver.resolveItemMeta('mystery_token_x1', {});
		expect(meta.name).toBe('Mystery Token X1');
		expect(meta.icon).toBe('📦');
	});

	test('iconForItem uses ID pattern fallback when category is absent', () => {
		expect(ProjectedItemCatalogResolver.iconForItem('', 'artifact_crest_01')).toBe('🏺');
		expect(ProjectedItemCatalogResolver.iconForItem('', 'gold_coin')).toBe('🪙');
		expect(ProjectedItemCatalogResolver.iconForItem('', 'item_violet_blade')).toBe('🛡️');
	});
});
