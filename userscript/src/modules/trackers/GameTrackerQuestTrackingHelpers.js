/**
 * Quest and daily activity tracking helpers extracted from GameTracker.
 */

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
