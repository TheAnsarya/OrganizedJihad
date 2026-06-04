/**
 * GameTrackerProgressionTrackingHelpers
 *
 * Helpers for mission/tower progression orchestration.
 */

/**
 * Best-effort loader for an existing progression row.
 * Returns null when lookup fails or record is missing.
 *
 * @param {Object} storage - tracker storage adapter
 * @param {string} storeName - store name
 * @param {string} key - row key
 * @returns {Promise<Object|null>} existing row or null
 */
export async function getExistingProgressRecord(storage, storeName, key) {
	try {
		return await storage.get(storeName, key);
	} catch {
		return null;
	}
}

/**
 * Build mission progress key.
 *
 * @param {Object} args - mission args
 * @returns {string} mission progress key
 */
export function buildMissionProgressId(args) {
	return `${args.missionId || args.id}_${args.isHeroic ? 'heroic' : 'normal'}`;
}

/**
 * Build mission progress row.
 *
 * @param {Object} args - mission args
 * @param {Object} data - mission response data
 * @param {Object|null} existing - existing progress row
 * @param {string|number} playerId - current player id
 * @param {string} lastCompleted - ISO timestamp
 * @returns {Object} mission progress row
 */
export function buildMissionProgressRecord(args, data, existing, playerId, lastCompleted) {
	const newStars = data.stars || 0;
	const currentStars = existing?.stars || 0;

	return {
		missionId: buildMissionProgressId(args),
		missionName: args.missionName || data.missionName || `Mission_${args.missionId}`,
		stars: Math.max(newStars, currentStars),
		highestLevel: args.level || existing?.highestLevel || 1,
		isHeroic: args.isHeroic || false,
		lastCompleted,
		completionCount: (existing?.completionCount || 0) + 1,
		playerId,
	};
}

/**
 * Build mission progress log line.
 *
 * @param {Object} progress - mission progress row
 * @returns {string} log line
 */
export function buildMissionProgressLogMessage(progress) {
	return `[OrganizedJihad] Mission progress updated: ${progress.missionName} - ${progress.stars} stars`;
}

/**
 * Resolve tower type key from arguments.
 *
 * @param {Object} args - tower args
 * @returns {string} tower type
 */
export function resolveTowerType(args) {
	return args.towerType || args.type || 'regular';
}

/**
 * Build tower progress row.
 *
 * @param {Object} data - tower response data
 * @param {Object} existing - existing tower progress row
 * @param {string|number} playerId - current player id
 * @param {string} towerType - tower type key
 * @param {number} newFloor - latest floor value
 * @param {string} lastUpdate - ISO timestamp
 * @returns {Object} tower progress row
 */
export function buildTowerProgressRecord(data, existing, playerId, towerType, newFloor, lastUpdate) {
	const currentFloor = existing?.highestFloor || 0;

	return {
		towerType,
		highestFloor: Math.max(newFloor, currentFloor),
		lastUpdate,
		floorData: JSON.stringify(data.floorDetails || {}),
		playerId,
	};
}

/**
 * Build tower progress log line.
 *
 * @param {Object} progress - tower progress row
 * @returns {string} log line
 */
export function buildTowerProgressLogMessage(progress) {
	return `[OrganizedJihad] Tower progress updated: ${progress.towerType} - floor ${progress.highestFloor}`;
}

/**
 * Execute resource transaction intents in sequence.
 *
 * @param {Object} tracker - game tracker instance
 * @param {Array<Object>} intents - transaction intents
 */
export async function executeResourceTransactionIntents(tracker, intents) {
	for (const intent of intents) {
		await tracker.trackResourceTransaction(intent.resourceType, intent.amount, intent.source, intent.sourceDetail);
	}
}
