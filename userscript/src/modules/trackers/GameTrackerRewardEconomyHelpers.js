/**
 * GameTrackerRewardEconomyHelpers
 *
 * Pure helper seams for reward normalization and economy/pve intent composition.
 */

const SCALAR_KEYS = new Set(['gold', 'starmoney', 'experience', 'stamina', 'titanExp']);

const CATEGORY_KEYS = new Set([
	'consumable',
	'gear',
	'coin',
	'fragmentHero',
	'fragmentTitan',
	'petCard',
	'titanCard',
	'scroll',
	'artifact',
	'titanArtifact',
	'skinStone',
	'titanSkinStone',
	'heroSoulStone',
	'titanSoulStone',
]);

/**
 * Resolve reward payload candidates from known API keys.
 *
 * @param {Object} data - raw response data
 * @returns {Array<any>} ordered reward sources
 */
export function resolveRewardSources(data) {
	if (!data || typeof data !== 'object') {
		return [];
	}

	const sources = [];
	if (data.chestReward) sources.push(data.chestReward);
	if (data.reward) sources.push(data.reward);
	if (data.rewards) sources.push(data.rewards);
	if (data.skullReward) sources.push(data.skullReward);
	if (sources.length === 0) sources.push(data);

	return sources;
}

/**
 * Extract normalized drop rows from a reward source.
 *
 * @param {any} source - reward source (object/array/primitive)
 * @param {Array<Object>} drops - accumulator array
 */
export function extractDropsIntoArray(source, drops) {
	if (!source || typeof source !== 'object') return;

	if (Array.isArray(source)) {
		for (const item of source) {
			extractDropsIntoArray(item, drops);
		}
		return;
	}

	let hasKnownKey = false;
	for (const [key, value] of Object.entries(source)) {
		if (SCALAR_KEYS.has(key) && typeof value === 'number') {
			drops.push({ itemType: key, itemId: key, quantity: value });
			hasKnownKey = true;
		} else if (CATEGORY_KEYS.has(key) && typeof value === 'object' && value !== null) {
			hasKnownKey = true;
			for (const [itemId, qty] of Object.entries(value)) {
				drops.push({
					itemType: key,
					itemId: String(itemId),
					quantity: typeof qty === 'number' ? qty : 1,
				});
			}
		}
	}

	if (!hasKnownKey) {
		for (const [key, value] of Object.entries(source)) {
			if (typeof value === 'object' && value !== null && /^\d+$/.test(key)) {
				extractDropsIntoArray(value, drops);
			}
		}
	}
}

/**
 * Normalize reward payload to flat drop rows.
 *
 * @param {Object} data - raw response payload
 * @returns {Array<{itemType: string, itemId: string, quantity: number}>}
 */
export function normalizeRewardsPayload(data) {
	const drops = [];
	for (const source of resolveRewardSources(data)) {
		extractDropsIntoArray(source, drops);
	}
	return drops;
}

/**
 * Build shop purchase row.
 *
 * @param {Object} args - purchase args
 * @param {Object} data - purchase data
 * @param {string|number} playerId - current player id
 * @param {string} purchasedAt - ISO timestamp
 * @returns {Object} purchase row
 */
export function buildShopPurchaseRecord(args, data, playerId, purchasedAt) {
	return {
		purchasedAt,
		shopType: args.shopType || args.shopId || 'unknown',
		itemId: args.itemId || 'unknown',
		itemName: data.itemName || args.itemName || `Item_${args.itemId}`,
		quantity: args.quantity || args.count || 1,
		costType: args.costType || Object.keys(args.cost || {})[0] || 'unknown',
		costAmount: args.costAmount || Object.values(args.cost || {})[0] || 0,
		playerId,
	};
}

/**
 * Build resource spend intents for shop purchase cost payload.
 *
 * @param {Object} cost - cost object from args
 * @param {string} costType - normalized purchase cost type
 * @param {number} costAmount - normalized purchase cost amount
 * @param {string} shopName - source detail string
 * @returns {Array<Object>} resource transaction intents
 */
export function buildShopResourceSpendIntents(cost, costType, costAmount, shopName) {
	const intents = [];

	if (cost.gold || (costType === 'gold' && costAmount > 0)) {
		intents.push({ resourceType: 'gold', amount: -(cost.gold || costAmount), source: 'shop', sourceDetail: shopName });
	}
	if (cost.starmoney || (costType === 'emeralds' && costAmount > 0)) {
		intents.push({ resourceType: 'emeralds', amount: -(cost.starmoney || costAmount), source: 'shop', sourceDetail: shopName });
	}
	if (cost.arenaToken || (costType === 'arena_coins' && costAmount > 0)) {
		intents.push({
			resourceType: 'arena_coins',
			amount: -(cost.arenaToken || costAmount),
			source: 'shop',
			sourceDetail: shopName,
		});
	}
	if (cost.guildWarToken || (costType === 'guild_war_coins' && costAmount > 0)) {
		intents.push({
			resourceType: 'guild_war_coins',
			amount: -(cost.guildWarToken || costAmount),
			source: 'shop',
			sourceDetail: shopName,
		});
	}
	if (cost.titanPotion || (costType === 'titan_potion' && costAmount > 0)) {
		intents.push({
			resourceType: 'titan_potion',
			amount: -(cost.titanPotion || costAmount),
			source: 'shop',
			sourceDetail: shopName,
		});
	}

	return intents;
}

/**
 * Resolve reward payload from known reward keys.
 *
 * @param {Object} data - source data
 * @returns {Object} reward payload object
 */
export function resolveRewardPayload(data) {
	return data.reward || data.rewards || {};
}

/**
 * Build quest completion row.
 *
 * @param {Object} args - quest args
 * @param {Object} data - quest data
 * @param {string|number} playerId - current player id
 * @param {string} completedAt - ISO timestamp
 * @returns {Object} quest row
 */
export function buildQuestCompletionRecord(args, data, playerId, completedAt) {
	const rewards = resolveRewardPayload(data);
	return {
		completedAt,
		questType: args.questType || 'daily',
		questId: args.questId || 'unknown',
		questName: args.questName || data.questName || `Quest_${args.questId}`,
		rewardData: JSON.stringify(rewards),
		playerId,
	};
}

/**
 * Build quest reward resource intents.
 *
 * @param {Object} rewards - reward payload
 * @param {string} questName - quest source detail
 * @returns {Array<Object>} resource transaction intents
 */
export function buildQuestResourceRewardIntents(rewards, questName) {
	const intents = [];
	if (rewards.gold) {
		intents.push({ resourceType: 'gold', amount: rewards.gold, source: 'quest', sourceDetail: questName });
	}
	if (rewards.starmoney) {
		intents.push({ resourceType: 'emeralds', amount: rewards.starmoney, source: 'quest', sourceDetail: questName });
	}
	if (rewards.arenaToken) {
		intents.push({ resourceType: 'arena_coins', amount: rewards.arenaToken, source: 'quest', sourceDetail: questName });
	}
	if (rewards.guildWarToken) {
		intents.push({
			resourceType: 'guild_war_coins',
			amount: rewards.guildWarToken,
			source: 'quest',
			sourceDetail: questName,
		});
	}
	if (rewards.titanPotion) {
		intents.push({ resourceType: 'titan_potion', amount: rewards.titanPotion, source: 'quest', sourceDetail: questName });
	}
	return intents;
}

/**
 * Build expedition state metadata payload.
 *
 * @param {Object} data - expedition data
 * @param {number} timestamp - epoch ms
 * @returns {Object} expedition metadata payload
 */
export function buildExpeditionStateMetadata(data, timestamp) {
	return {
		currentNode: data.currentNode || 0,
		progress: data.progress || 0,
		rewards: data.rewards || [],
		timestamp,
	};
}

/**
 * Build expedition battle row.
 *
 * @param {Object} args - expedition battle args
 * @param {Object} data - expedition battle data
 * @param {string|number} playerId - current player id
 * @param {string} timestamp - ISO timestamp
 * @returns {Object} expedition battle row
 */
export function buildExpeditionBattleRecord(args, data, playerId, timestamp) {
	return {
		timestamp,
		expeditionId: args.expeditionId || args.nodeId || 'unknown',
		bossId: args.bossId || data.bossId || 'unknown',
		bossName: data.bossName || `Boss_${args.bossId}`,
		isWin: data.result?.win || data.win || false,
		teamComposition: JSON.stringify(data.attackers || data.myTeam || {}),
		damageDealt: data.damageDealt || data.damage || 0,
		rewardData: JSON.stringify(resolveRewardPayload(data)),
		playerId,
	};
}

/**
 * Build expedition reward resource intents.
 *
 * @param {Object} rewards - reward payload
 * @param {string} expeditionId - expedition identifier
 * @returns {Array<Object>} resource transaction intents
 */
export function buildExpeditionResourceRewardIntents(rewards, expeditionId) {
	const sourceDetail = `expedition_${expeditionId}`;
	const intents = [];
	if (rewards.gold) {
		intents.push({ resourceType: 'gold', amount: rewards.gold, source: 'battle', sourceDetail });
	}
	if (rewards.starmoney) {
		intents.push({ resourceType: 'emeralds', amount: rewards.starmoney, source: 'battle', sourceDetail });
	}
	return intents;
}

/**
 * Build mission reward resource intents.
 *
 * @param {Object} rewards - reward payload
 * @param {string} missionName - mission display name
 * @returns {Array<Object>} resource transaction intents
 */
export function buildMissionResourceRewardIntents(rewards, missionName) {
	const sourceDetail = `mission_${missionName}`;
	const intents = [];
	if (rewards.gold) {
		intents.push({ resourceType: 'gold', amount: rewards.gold, source: 'battle', sourceDetail });
	}
	if (rewards.starmoney) {
		intents.push({ resourceType: 'emeralds', amount: rewards.starmoney, source: 'battle', sourceDetail });
	}
	return intents;
}

/**
 * Build tower reward resource intents.
 *
 * @param {Object} rewards - reward payload
 * @param {string} towerType - tower type key
 * @param {number} floor - floor index
 * @returns {Array<Object>} resource transaction intents
 */
export function buildTowerResourceRewardIntents(rewards, towerType, floor) {
	const sourceDetail = `${towerType}_tower_floor_${floor}`;
	const intents = [];
	if (rewards.gold) {
		intents.push({ resourceType: 'gold', amount: rewards.gold, source: 'battle', sourceDetail });
	}
	if (rewards.starmoney) {
		intents.push({ resourceType: 'emeralds', amount: rewards.starmoney, source: 'battle', sourceDetail });
	}
	return intents;
}
