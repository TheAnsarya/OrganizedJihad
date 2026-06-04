/**
 * GameTrackerBattleExecutionHelpers
 *
 * Execution helpers for guild-war and raid battle tracking wrappers.
 */

import {
	appendBoundedHistory,
	applyResourceTransactionIntents,
	buildGuildWarActivityPayload,
	buildGuildWarBattleHistoryRecord,
	buildGuildWarBattleStoreRecord,
	buildGuildWarRewardIntents,
	buildRaidBossActivityPayload,
	buildRaidBossAttackHistoryRecord,
	buildRaidBossBattleRecord,
	buildRaidBossRewardIntents,
} from './GameTrackerWarRaidHelpers.js';

/**
 * Execute guild-war battle tracking side effects in parity order.
 *
 * @param {Object} tracker - gameTracker instance
 * @param {Object} args - battle request arguments
 * @param {Object} data - battle response payload
 */
export async function executeGuildWarBattleTracking(tracker, args, data) {
	const isWin = data.result?.win || false;
	const timestamp = new Date().toISOString();
	const currentWar = await tracker.storage.getMetadata('currentGuildWar', {});

	const battleRecord = buildGuildWarBattleHistoryRecord(
		args,
		data,
		currentWar,
		tracker.compressHeroTeam.bind(tracker),
		isWin
	);

	const guildWarHistory = await tracker.storage.getMetadata('guildWarBattleHistory', []);
	const nextGuildWarHistory = appendBoundedHistory(guildWarHistory, battleRecord, 500);
	await tracker.storage.setMetadata('guildWarBattleHistory', nextGuildWarHistory);

	const battle = buildGuildWarBattleStoreRecord(
		args,
		data,
		currentWar,
		tracker.calculateTeamPower.bind(tracker),
		tracker.compressHeroTeam.bind(tracker),
		isWin,
		timestamp
	);

	if (!tracker._isBattleDuplicate(battle)) {
		await tracker.storage.add('battles', battle);
	}

	await tracker._logActivity('battle', `Guild War ${isWin ? 'WIN' : 'LOSS'} at fort #${args.fortId || '?'}`, { isWin });

	const guildData = await tracker.storage.getMetadata('guildData', {});
	await tracker.trackGuildActivity('war', buildGuildWarActivityPayload(guildData, args, battleRecord, data));

	const rewards = data.reward || {};
	await applyResourceTransactionIntents(tracker, buildGuildWarRewardIntents(rewards));
}

/**
 * Execute raid-boss attack tracking side effects in parity order.
 *
 * @param {Object} tracker - gameTracker instance
 * @param {Object} args - attack request arguments
 * @param {Object} data - attack response payload
 */
export async function executeRaidBossAttackTracking(tracker, args, data) {
	const timestamp = new Date().toISOString();
	const attackRecord = buildRaidBossAttackHistoryRecord(args, data, tracker.compressHeroTeam.bind(tracker));
	const raidHistory = await tracker.storage.getMetadata('raidBossAttackHistory', []);
	const nextRaidHistory = appendBoundedHistory(raidHistory, attackRecord, 500);
	await tracker.storage.setMetadata('raidBossAttackHistory', nextRaidHistory);

	const battle = buildRaidBossBattleRecord(args, data, tracker.compressHeroTeam.bind(tracker), timestamp);
	if (!tracker._isBattleDuplicate(battle)) {
		await tracker.storage.add('battles', battle);
	}

	const guildData = await tracker.storage.getMetadata('guildData', {});
	await tracker.trackGuildActivity('raid', buildRaidBossActivityPayload(guildData, args, data));

	const rewards = data.reward || {};
	await applyResourceTransactionIntents(tracker, buildRaidBossRewardIntents(rewards));
}
