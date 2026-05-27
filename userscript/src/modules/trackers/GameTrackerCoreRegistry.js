/**
 * GameTrackerCoreRegistry.js
 *
 * Extracted handler-registration groups for GameTracker core/player/chat/mail flows.
 */

/**
 * Register core player snapshot handlers.
 *
 * @param {import('../gameTracker.js').default} tracker GameTracker instance
 */
export function registerCorePlayerHandlers(tracker) {
	tracker.registerHandler('userGetInfo', async (_call, _args, data) => {
		await tracker.trackPlayerData(data);
	}, 'trackPlayerData', { category: 'player' });

	tracker.registerHandler('heroGetAll', async (_call, _args, data) => {
		await tracker.trackHeroesData(data);
	}, 'trackHeroesData', { dependsOn: ['userGetInfo'], category: 'player' });

	tracker.registerHandler('inventoryGet', async (_call, _args, data) => {
		await tracker.trackInventoryData(data);
	}, 'trackInventoryData', { dependsOn: ['userGetInfo'], category: 'player' });
}

/**
 * Register chat communication handlers.
 *
 * @param {import('../gameTracker.js').default} tracker GameTracker instance
 */
export function registerChatHandlers(tracker) {
	tracker.registerHandler(['chatGetDialog', 'chatGetNewMessages'], async (callName, args, data) => {
		await tracker.trackChatMessages(args, data, callName);
	}, 'trackChatMessages', { category: 'guild' });

	tracker.registerHandler('chatSendMessage', async (_call, args, data) => {
		await tracker.trackOutgoingMessage(args, data);
	}, 'trackOutgoingMessage', { category: 'guild' });
}

/**
 * Register mail tracking handlers.
 *
 * @param {import('../gameTracker.js').default} tracker GameTracker instance
 */
export function registerMailHandlers(tracker) {
	tracker.registerHandler('mailGetAll', async (_call, _args, data) => {
		await tracker.trackMailList(data);
	}, 'trackMailList', { category: 'player' });

	tracker.registerHandler(['mailFarm', 'mailCollect'], async (callName, args, data) => {
		await tracker.trackMailRewards(callName, args, data);
	}, 'trackMailRewards', { category: 'player' });
}
