/**
 * GameTrackerGuildCurrencyHelpers
 *
 * Guild currency helper seams for guild ID lookup and titanite transactions.
 */

/**
 * Resolve stored guild ID from metadata.
 *
 * @param {Object} storage - tracker storage adapter
 * @returns {Promise<number>} Guild ID, or 0 when unknown
 */
export async function getStoredGuildIdHelper(storage) {
	const guildData = await storage.getMetadata('guildData', {});
	return guildData.id || 0;
}

/**
 * Build a normalized titanite transaction record.
 *
 * @param {number} playerId - Player ID
 * @param {string} playerName - Player name
 * @param {number} guildId - Guild ID
 * @param {string} transactionType - donation|earned|spent
 * @param {number} amount - Transaction amount
 * @param {string} source - Transaction source
 * @param {string|null} description - Optional description
 * @returns {Object} transaction row payload
 */
export function buildTitaniteTransactionRecord(playerId, playerName, guildId, transactionType, amount, source, description = null) {
	return {
		timestamp: new Date(),
		playerId: playerId,
		playerName: playerName,
		guildId: guildId,
		transactionType: transactionType,
		amount: amount,
		source: source,
		purchaseDescription: description,
		balanceAfter: null,
	};
}

/**
 * Persist titanite transaction and emit parity log line.
 *
 * @param {Object} tracker - gameTracker instance
 * @param {number} playerId - Player ID
 * @param {string} playerName - Player name
 * @param {number} guildId - Guild ID
 * @param {string} transactionType - donation|earned|spent
 * @param {number} amount - Transaction amount
 * @param {string} source - Transaction source
 * @param {string|null} description - Optional description
 */
export async function trackTitaniteTransactionHelper(
	tracker,
	playerId,
	playerName,
	guildId,
	transactionType,
	amount,
	source,
	description = null
) {
	const transaction = buildTitaniteTransactionRecord(
		playerId,
		playerName,
		guildId,
		transactionType,
		amount,
		source,
		description
	);

	await tracker.storage.add('titaniteTransactions', transaction);
	console.log(`[OrganizedJihad] Tracked titanite ${transactionType}: ${amount} from ${source}`);
}
