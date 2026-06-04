/**
 * GameTrackerGenericTrackingHelpers.js
 *
 * Shared generic tracking helper seam used by GameTracker.
 */

/**
 * Track a generic upgrade event.
 *
 * @param {import('../gameTracker.js').default} tracker GameTracker instance
 * @param {string} entityType Type of entity (hero, titan, pet)
 * @param {string} upgradeType Type of upgrade (levelUp, evolve, etc.)
 * @param {Object} args API request arguments
 * @param {Object} data API response data
 * @returns {Promise<void>}
 */
export async function trackGenericUpgrade(tracker, entityType, upgradeType, args, data) {
	const entityId = args.heroId || args.titanId || args.petId || args.id || 0;
	const label = `${entityType} ${upgradeType}`;
	await tracker._logActivity('upgrade', `${label} #${entityId}`, {
		entityType,
		upgradeType,
		entityId,
	});
}

/**
 * Track a generic game event.
 *
 * @param {import('../gameTracker.js').default} tracker GameTracker instance
 * @param {string} category Event category
 * @param {string} eventType Specific event type
 * @param {Object} args API request arguments
 * @param {Object} data API response data
 * @returns {Promise<void>}
 */
export async function trackGenericEvent(tracker, category, eventType, args, data) {
	await tracker._logActivity(category, eventType, {
		category,
		eventType,
		hasReward: !!data.reward,
	});
}
