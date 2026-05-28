import { resolveHeroName } from '../heroNames.js';

/**
 * Inventory usage tracking helpers extracted from GameTracker.
 */

/**
 * Track inventory item usage events.
 *
 * @param {any} tracker
 * @param {Object} args
 * @param {Object} responseData
 * @param {string} category
 * @param {string} usageContext
 */
export async function trackInventoryItemUsageHelper(tracker, args, responseData, category, usageContext) {
	const playerId = await tracker._getPlayerId();
	const timestamp = new Date().toISOString();
	const itemId = String(args.libId || args.itemId || 'unknown');

	const record = {
		timestamp,
		itemId,
		itemName: `Item_${itemId}`,
		category,
		quantityUsed: args.amount || 1,
		quantityRemaining: 0,
		usageContext,
		targetEntity: args.heroId ? resolveHeroName(args.heroId) : (args.titanId ? resolveHeroName(args.titanId) : null),
		playerId,
	};

	await tracker.storage.add('inventoryItemUsages', record);
	console.log(`[OrganizedJihad] Inventory item used: ${record.itemId} x${record.quantityUsed} for ${usageContext}`);
}
