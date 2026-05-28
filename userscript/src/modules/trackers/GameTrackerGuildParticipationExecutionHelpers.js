/**
 * GameTrackerGuildParticipationExecutionHelpers
 *
 * Execution/orchestration helpers for guild participation tracking paths.
 */

import {
	buildGuildDungeonParticipationRecords,
	buildGuildRaidParticipationRecords,
	buildGuildWarParticipationRecords,
} from './GameTrackerGuildParticipationHelpers.js';

/**
 * Persist participation records into the target store.
 *
 * @param {Object} storage - tracker storage adapter
 * @param {string} storeName - IDB store name
 * @param {Array<Object>} records - participation records
 */
export async function persistParticipationRecords(storage, storeName, records) {
	for (const record of records) {
		await storage.add(storeName, record);
	}
}

/**
 * Dispatch titanite transaction intents through tracker method.
 *
 * @param {Object} tracker - gameTracker instance
 * @param {Array<Object>} transactions - transaction intents
 */
export async function dispatchTitaniteTransactions(tracker, transactions) {
	for (const transaction of transactions) {
		await tracker.trackTitaniteTransaction(
			transaction.playerId,
			transaction.playerName,
			transaction.guildId,
			transaction.transactionType,
			transaction.amount,
			transaction.source,
			transaction.description
		);
	}
}

/**
 * Execute guild war participation tracking path.
 *
 * @param {Object} tracker - gameTracker instance
 * @param {Object} data - war payload
 * @param {number} guildId - resolved guild ID
 * @returns {number} participant count
 */
export async function executeGuildWarParticipationTracking(tracker, data, guildId) {
	const trackingPayload = buildGuildWarParticipationRecords(data, guildId);
	await persistParticipationRecords(tracker.storage, 'guildWarParticipations', trackingPayload.records);
	return Object.keys(trackingPayload.participants).length;
}

/**
 * Execute guild raid participation tracking path.
 *
 * @param {Object} tracker - gameTracker instance
 * @param {Object} data - raid payload
 * @param {number} guildId - resolved guild ID
 * @returns {number} participant count
 */
export async function executeGuildRaidParticipationTracking(tracker, data, guildId) {
	const trackingPayload = buildGuildRaidParticipationRecords(data, guildId);
	await persistParticipationRecords(tracker.storage, 'guildRaidParticipations', trackingPayload.records);
	await dispatchTitaniteTransactions(tracker, trackingPayload.titaniteTransactions);
	return Object.keys(trackingPayload.participants).length;
}

/**
 * Execute guild dungeon participation tracking path.
 *
 * @param {Object} tracker - gameTracker instance
 * @param {Object} data - dungeon payload
 * @param {number} guildId - resolved guild ID
 * @returns {number} participant count
 */
export async function executeGuildDungeonParticipationTracking(tracker, data, guildId) {
	const trackingPayload = buildGuildDungeonParticipationRecords(data, guildId);
	await persistParticipationRecords(tracker.storage, 'guildDungeonParticipations', trackingPayload.records);
	await dispatchTitaniteTransactions(tracker, trackingPayload.titaniteTransactions);
	return Object.keys(trackingPayload.participants).length;
}
