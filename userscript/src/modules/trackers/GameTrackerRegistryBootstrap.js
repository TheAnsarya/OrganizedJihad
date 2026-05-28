import { registerChatHandlers, registerCorePlayerHandlers, registerMailHandlers } from './GameTrackerCoreRegistry.js';
import {
	registerBattleHandlers,
	registerGuildAndSocialHandlers,
	registerQuestRewardHandlers,
	registerUpgradeHandlers,
} from './GameTrackerGameplayRegistry.js';
import { registerPhase11MetadataHandlers } from './GameTrackerPhase11Registry.js';
import { registerPhase12Handlers, registerPhase13Handlers } from './GameTrackerExtendedRegistry.js';

/**
 * Ordered default registrar list for GameTracker handler bootstrap.
 *
 * @type {Array<(tracker: any) => void>}
 */
export const DEFAULT_TRACKER_REGISTRARS = [
	registerCorePlayerHandlers,
	registerBattleHandlers,
	registerQuestRewardHandlers,
	registerGuildAndSocialHandlers,
	registerUpgradeHandlers,
	registerChatHandlers,
	registerMailHandlers,
	registerPhase11MetadataHandlers,
	registerPhase12Handlers,
	registerPhase13Handlers,
];

/**
 * Apply the default (or injected) registrar list to a tracker instance.
 *
 * @param {any} tracker
 * @param {Array<(tracker: any) => void>} registrars
 */
export function applyDefaultTrackerRegistrars(tracker, registrars = DEFAULT_TRACKER_REGISTRARS) {
	for (const registrar of registrars) {
		registrar(tracker);
	}
}
