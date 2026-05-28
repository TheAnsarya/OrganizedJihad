import { resolveHeroName } from '../heroNames.js';

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

/**
 * Track and summarize quest state data.
 *
 * @param {any} tracker
 * @param {Object[]|null|undefined} data
 */
export async function trackQuestsDataHelper(tracker, data) {
	const quests = Array.isArray(data) ? data : [];
	const dailyQuests = quests.filter((q) => {
		const id = q.id || 0;
		return id >= 10001 && id <= 10999;
	});
	const guildQuests = quests.filter((q) => {
		const id = q.id || 0;
		return id >= 20000000 && id <= 20999999;
	});

	await tracker.storage.setMetadata('questSummary', {
		dailyTotal: dailyQuests.length,
		dailyCompleted: dailyQuests.filter((q) => q.state === 2).length,
		guildTotal: guildQuests.length,
		guildCompleted: guildQuests.filter((q) => q.state === 2).length,
		allTotal: quests.length,
		allCompleted: quests.filter((q) => q.state === 2).length,
		lastUpdate: Date.now(),
	});

	const questsData = quests.map((quest) => ({
		id: quest.id,
		state: quest.state,
		progress: quest.progress || 0,
		lastUpdate: Date.now(),
	}));
	await tracker.storage.setMetadata('questsData', questsData);

	console.log(`[OrganizedJihad] Quests: ${dailyQuests.filter((q) => q.state === 2).length}/${dailyQuests.length} daily, ${guildQuests.filter((q) => q.state === 2).length}/${guildQuests.length} guild`);
}

/**
 * Track a daily or guild quest farm completion.
 *
 * @param {any} tracker
 * @param {Object} args
 * @param {Object} responseData
 */
export async function trackDailyQuestFarmHelper(tracker, args, responseData) {
	const playerId = await tracker._getPlayerId();
	const timestamp = new Date().toISOString();
	const questId = String(args.questId || args.id || 0);
	const questIdNum = parseInt(questId, 10);
	const isDailyQuest = questIdNum >= 10000 && questIdNum < 11000;

	if (isDailyQuest) {
		const record = {
			completedAt: timestamp,
			questDate: new Date().toISOString().split('T')[0],
			questId,
			questName: `Daily Quest ${questId}`,
			category: null,
			activityPoints: responseData?.reward?.activityPoints || 0,
			rewardData: JSON.stringify(responseData?.reward || responseData || {}),
			playerId,
		};

		await tracker.storage.add('dailyQuestCompletions', record);
		console.log(`[OrganizedJihad] Daily quest farmed: ${questId}`);
		return;
	}

	const guildId = (await tracker.storage.getMetadata('currentGuildId')) || 0;
	const record = {
		completedAt: timestamp,
		questDate: new Date().toISOString().split('T')[0],
		questId,
		questName: `Guild Quest ${questId}`,
		difficulty: null,
		guildActivityPoints: responseData?.reward?.guildActivityPoints || 0,
		rewardData: JSON.stringify(responseData?.reward || responseData || {}),
		playerId,
		guildId,
	};

	await tracker.storage.add('guildQuestCompletions', record);
	console.log(`[OrganizedJihad] Guild quest farmed: ${questId}`);
}

/**
 * Track batch quest farming by flattening into quest farm events.
 *
 * @param {any} tracker
 * @param {Object} args
 * @param {Object} responseData
 */
export async function trackBatchQuestFarmHelper(tracker, args, responseData) {
	const questIds = args.questIds || [];
	for (const questId of questIds) {
		await trackDailyQuestFarmHelper(tracker, { questId }, responseData);
	}
	console.log(`[OrganizedJihad] Batch quest farm: ${questIds.length} quests`);
}

/**
 * Track daily login reward collection.
 *
 * @param {any} tracker
 * @param {Object} args
 * @param {Object} responseData
 */
export async function trackLoginRewardHelper(tracker, args, responseData) {
	const playerId = await tracker._getPlayerId();
	const timestamp = new Date().toISOString();
	const isVip = args.vip || false;

	const record = {
		claimedAt: timestamp,
		dayNumber: responseData?.day || responseData?.dayCount || 0,
		streakLength: responseData?.loginCount || responseData?.streak || 0,
		isVipBonus: isVip,
		rewardData: JSON.stringify(responseData?.reward || responseData || {}),
		playerId,
	};

	await tracker.storage.add('loginRewards', record);
	console.log(`[OrganizedJihad] Login reward claimed: day ${record.dayNumber}, VIP: ${isVip}`);
}

/**
 * Track daily bonus info metadata.
 *
 * @param {any} tracker
 * @param {Object} responseData
 */
export async function trackDailyBonusInfoHelper(tracker, responseData) {
	if (responseData?.day || responseData?.dayCount) {
		await tracker.storage.setMetadata('dailyBonusDay', responseData.day || responseData.dayCount);
	}
	if (responseData?.loginCount || responseData?.streak) {
		await tracker.storage.setMetadata('dailyBonusStreak', responseData.loginCount || responseData.streak);
	}

	console.log('[OrganizedJihad] Daily bonus info cached');
}

/**
 * Track inventory item usage events.
 *
 * @param {any} tracker
 * @param {Object} args
 * @param {Object} responseData
 * @param {string} category
 * @param {string} usageContext
 */
export async function trackInventoryItemUsageHelper(tracker, args, responseData, category, usageContext) {
	const playerId = await tracker._getPlayerId();
	const timestamp = new Date().toISOString();
	const itemId = String(args.libId || args.itemId || 'unknown');

	const record = {
		timestamp,
		itemId,
		itemName: `Item_${itemId}`,
		category,
		quantityUsed: args.amount || 1,
		quantityRemaining: 0,
		usageContext,
		targetEntity: args.heroId ? resolveHeroName(args.heroId) : (args.titanId ? resolveHeroName(args.titanId) : null),
		playerId,
	};

	await tracker.storage.add('inventoryItemUsages', record);
	console.log(`[OrganizedJihad] Inventory item used: ${record.itemId} x${record.quantityUsed} for ${usageContext}`);
}
