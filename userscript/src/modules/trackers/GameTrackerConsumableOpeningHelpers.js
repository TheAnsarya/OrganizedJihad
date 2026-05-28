/**
 * GameTrackerConsumableOpeningHelpers
 *
 * Helper seams for consumable/chest opening tracking pipelines.
 */

/**
 * Build chest opening store record.
 *
 * @param {string} sourceType - opening source type
 * @param {string} sourceId - source/chest identifier
 * @param {number} quantity - opened quantity
 * @param {Array<Object>} drops - normalized drops
 * @param {number} timestamp - epoch ms timestamp
 * @returns {Object} chest store row
 */
export function buildChestOpeningRecord(sourceType, sourceId, quantity, drops, timestamp) {
	return {
		chestType: sourceType,
		sourceId,
		quantity,
		dropCount: drops.length,
		timestamp,
	};
}

/**
 * Build batch reward drop records.
 *
 * @param {Array<Object>} drops - normalized drop rows
 * @param {number} timestamp - epoch ms timestamp
 * @param {string} sourceType - source type
 * @param {string} sourceId - source/chest id
 * @param {number} openingId - linked opening ID fallback-safe
 * @returns {Array<Object>} reward store rows
 */
export function buildConsumableDropRecords(drops, timestamp, sourceType, sourceId, openingId) {
	return drops.map((drop) => ({
		timestamp,
		sourceType,
		sourceId,
		itemType: drop.itemType,
		itemId: String(drop.itemId),
		quantity: drop.quantity,
		openingId: openingId || 0,
	}));
}

/**
 * Build chest history entry for metadata mirror.
 *
 * @param {string} sourceId - source/chest id
 * @param {string} sourceType - source type
 * @param {number} quantity - opened quantity
 * @param {Array<Object>} drops - normalized drops
 * @param {number} timestamp - epoch ms timestamp
 * @returns {Object} history metadata row
 */
export function buildChestHistoryEntry(sourceId, sourceType, quantity, drops, timestamp) {
	return {
		chestId: sourceId,
		chestType: sourceType,
		quantity,
		rewards: drops,
		timestamp,
	};
}

/**
 * Append chest history entry with cap.
 *
 * @param {Array<Object>} chestHistory - previous history
 * @param {Object} historyEntry - new history row
 * @param {number} maxEntries - max history cap
 * @returns {Array<Object>} bounded history
 */
export function appendChestHistory(chestHistory, historyEntry, maxEntries = 1000) {
	const next = [...chestHistory, historyEntry];
	if (next.length > maxEntries) {
		next.shift();
	}
	return next;
}

/**
 * Resolve display label for source type.
 *
 * @param {string} sourceType - source type key
 * @returns {string} human-readable label
 */
export function sourceTypeLabel(sourceType) {
	const labels = {
		genericChest: 'Chest',
		artifactChest: 'Artifact Chest',
		titanArtifactChest: 'Titan Artifact Chest',
		petChest: 'Pet Chest',
		lootBox: 'Loot Box',
		towerChest: 'Tower Chest',
		outlandChest: 'Outland Chest',
	};
	return labels[sourceType] || sourceType;
}

/**
 * Apply chest drop-rate aggregation updates and return updated map.
 *
 * @param {Object} dropRates - existing drop-rate metadata map
 * @param {Object} chestRecord - record with chestType/chestId/quantity/rewards
 * @returns {Object} updated drop-rate map
 */
export function applyChestDropRateUpdates(dropRates, chestRecord) {
	const next = { ...dropRates };
	const chestKey = `${chestRecord.chestType}_${chestRecord.chestId}`;

	if (!next[chestKey]) {
		next[chestKey] = {
			chestType: chestRecord.chestType,
			chestId: chestRecord.chestId,
			openCount: 0,
			itemDrops: {},
		};
	}

	next[chestKey].openCount += chestRecord.quantity;

	if (Array.isArray(chestRecord.rewards)) {
		for (const drop of chestRecord.rewards) {
			const itemKey = `${drop.itemType}_${drop.itemId}`;
			if (!next[chestKey].itemDrops[itemKey]) {
				next[chestKey].itemDrops[itemKey] = {
					type: drop.itemType,
					id: drop.itemId,
					name: drop.itemName || itemKey,
					dropCount: 0,
					totalAmount: 0,
				};
			}
			next[chestKey].itemDrops[itemKey].dropCount += 1;
			next[chestKey].itemDrops[itemKey].totalAmount += drop.quantity || 1;
		}
	}

	return next;
}

/**
 * Build resource transaction intents from normalized chest drops.
 *
 * @param {Array<Object>} drops - normalized drops
 * @param {string} chestName - derived chest name/source detail
 * @returns {Array<Object>} resource transaction intents
 */
export function buildChestResourceTransactionIntents(drops, chestName) {
	const intents = [];

	for (const drop of drops) {
		if (drop.itemType === 'gold') {
			intents.push({ resourceType: 'gold', amount: drop.quantity, source: 'chest', sourceDetail: chestName });
		} else if (drop.itemType === 'starmoney') {
			intents.push({ resourceType: 'emeralds', amount: drop.quantity, source: 'chest', sourceDetail: chestName });
		} else if (drop.itemType === 'coin') {
			const coinNames = { '3': 'arena_coins', '4': 'outland_coins', '5': 'tower_coins', '7': 'skull_coins' };
			const resName = coinNames[drop.itemId] || `coin_${drop.itemId}`;
			intents.push({ resourceType: resName, amount: drop.quantity, source: 'chest', sourceDetail: chestName });
		}
	}

	return intents;
}
