/**
 * Economy-focused tracking helpers extracted from GameTracker.
 */

/**
 * Track a resource transaction event.
 *
 * @param {any} tracker
 * @param {string} resourceType
 * @param {number} amount
 * @param {string} source
 * @param {string} sourceDetail
 */
export async function trackResourceTransactionHelper(tracker, resourceType, amount, source, sourceDetail = '') {
	const playerId = (await tracker.storage.getMetadata('currentPlayerId')) || 'unknown';
	const timestamp = new Date().toISOString();

	const transaction = {
		timestamp,
		resourceType,
		amount,
		source,
		sourceDetail,
		playerId,
	};

	await tracker.storage.add('resourceTransactions', transaction);
	console.log(`[OrganizedJihad] Resource transaction: ${amount > 0 ? '+' : ''}${amount} ${resourceType} from ${source}`);
}

/**
 * Track a guild activity event.
 *
 * @param {any} tracker
 * @param {string} activityType
 * @param {Object} data
 */
export async function trackGuildActivityHelper(tracker, activityType, data) {
	const playerId = (await tracker.storage.getMetadata('currentPlayerId')) || 'unknown';
	const timestamp = new Date().toISOString();

	const activity = {
		timestamp,
		guildId: data.guildId || 'unknown',
		guildName: data.guildName || `Guild_${data.guildId}`,
		activityType,
		activityData: JSON.stringify(data),
		playerId,
	};

	await tracker.storage.add('guildActivities', activity);
	console.log(`[OrganizedJihad] Guild activity tracked: ${activity.activityType} in ${activity.guildName}`);
}
