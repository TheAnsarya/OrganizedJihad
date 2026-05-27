/**
 * ProjectedItemCatalogResolver
 *
 * Resolves stable display metadata (name/category/icon) for projected
 * requirement items. Runtime inventory metadata is merged when available,
 * but deterministic fallbacks always exist for unknown IDs.
 */
class ProjectedItemCatalogResolver {
	/**
	 * Seeded deterministic entries for high-frequency projected item IDs.
	 * These provide stable labels/icons before runtime metadata exists.
	 *
	 * @type {Record<string, {name: string, category: string, icon?: string}>}
	 */
	static SEEDED_CATALOG = {
		xp_potion_l: { name: 'Large XP Potion', category: 'consumable', icon: '🧪' },
		xp_potion_m: { name: 'Medium XP Potion', category: 'consumable', icon: '🧪' },
		xp_potion_s: { name: 'Small XP Potion', category: 'consumable', icon: '🧪' },
		gold_coin: { name: 'Gold', category: 'resource', icon: '🪙' },
		item_red_fragment: { name: 'Red Fragment', category: 'fragment', icon: '🧩' },
		item_violet_fragment: { name: 'Violet Fragment', category: 'fragment', icon: '🧩' },
		item_orange_fragment: { name: 'Orange Fragment', category: 'fragment', icon: '🧩' },
		item_green_fragment: { name: 'Green Fragment', category: 'fragment', icon: '🧩' },
		item_blue_fragment: { name: 'Blue Fragment', category: 'fragment', icon: '🧩' },
	};

	/**
	 * Build a runtime item metadata map keyed by item ID.
	 *
	 * @param {Array<{itemId: string, name?: string, category?: string}>} items - Parsed inventory items
	 * @returns {Record<string, {name: string, category: string, icon: string}>} Map of runtime metadata
	 */
	static buildRuntimeMetaMap(items = []) {
		if (!Array.isArray(items) || items.length === 0) {
			return {};
		}

		return items.reduce((acc, item) => {
			const itemId = String(item.itemId || '').trim();
			if (!itemId) {
				return acc;
			}

			const category = String(item.category || '').trim();
			acc[itemId] = {
				name: item.name || `Item #${itemId}`,
				category,
				icon: this.iconForItem(category, itemId),
			};
			return acc;
		}, {});
	}

	/**
	 * Resolve final display metadata for an item ID.
	 *
	 * @param {string} itemId - Raw item ID
	 * @param {Record<string, {name?: string, category?: string, icon?: string}>} runtimeMetaMap - Runtime metadata map
	 * @returns {{itemId: string, name: string, category: string, icon: string}} Resolved item metadata
	 */
	static resolveItemMeta(itemId, runtimeMetaMap = {}) {
		const normalizedId = String(itemId || 'unknown_item').trim() || 'unknown_item';
		const runtimeMeta = runtimeMetaMap[normalizedId] || {};
		const seededMeta = this.SEEDED_CATALOG[normalizedId] || {};
		const category = String(runtimeMeta.category || seededMeta.category || '').trim();

		const name = runtimeMeta.name || seededMeta.name || this.prettifyItemId(normalizedId);
		const icon = runtimeMeta.icon || seededMeta.icon || this.iconForItem(category, normalizedId);

		return {
			itemId: normalizedId,
			name,
			category,
			icon,
		};
	}

	/**
	 * Convert raw item IDs to a readable fallback label.
	 *
	 * @param {string} itemId - Raw item ID
	 * @returns {string} Human-readable fallback label
	 */
	static prettifyItemId(itemId) {
		if (!itemId) {
			return 'Unknown Item';
		}

		const normalizedId = String(itemId)
			.replace(/^(item|gear|consumable|fragment|artifact)_/i, '');

		const fromSnake = normalizedId
			.replace(/[_-]+/g, ' ')
			.replace(/\b\w/g, (c) => c.toUpperCase())
			.trim();

		if (fromSnake) {
			return fromSnake;
		}

		return `Item ${itemId}`;
	}

	/**
	 * Resolve a deterministic display icon for item category / ID.
	 *
	 * @param {string} category - Parsed category (if known)
	 * @param {string} itemId - Raw item ID
	 * @returns {string} Icon glyph
	 */
	static iconForItem(category, itemId) {
		const categoryIcons = {
			hero_soul_stones: '💎',
			titan_soul_stones: '💠',
			pet_soul_stones: '🐾',
			equipment: '🛡️',
			consumable: '🧪',
			fragment: '🧩',
			scroll: '📜',
			artifact: '🏺',
			resource: '📦',
		};

		if (category && categoryIcons[category]) {
			return categoryIcons[category];
		}

		const id = String(itemId || '').toLowerCase();
		if (id.includes('fragment') || id.includes('stone')) return '🧩';
		if (id.includes('potion') || id.includes('consumable')) return '🧪';
		if (id.includes('scroll')) return '📜';
		if (id.includes('artifact')) return '🏺';
		if (id.includes('gold') || id.includes('coin')) return '🪙';
		if (id.includes('gear') || id.includes('item_')) return '🛡️';

		return '📦';
	}
}

export default ProjectedItemCatalogResolver;
