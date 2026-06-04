/**
 * GameTrackerCrossServerExecutionHelpers
 *
 * Execution/orchestration helpers for cross-server battle result persistence.
 */

import {
	buildCrossServerWarBattleRecord,
} from './GameTrackerWarRaidHelpers.js';

/**
 * Persist cross-server battle rows with dedupe guard.
 *
 * @param {Object} tracker - gameTracker instance
 * @param {Object} args - request arguments
 * @param {Array<Object>} battles - normalized cross-server result rows
 */
export async function persistCrossServerWarBattles(tracker, args, battles) {
	for (const result of battles) {
		const battle = buildCrossServerWarBattleRecord(
			args,
			result,
			tracker.calculateTeamPower.bind(tracker),
			tracker.compressHeroTeam.bind(tracker)
		);

		if (tracker._isBattleDuplicate(battle)) {
			console.log('[OrganizedJihad] Skipping duplicate CrossServerWar battle');
			continue;
		}

		await tracker.storage.add('battles', battle);
	}
}
