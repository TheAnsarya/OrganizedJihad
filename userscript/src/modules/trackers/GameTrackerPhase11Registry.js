/**
 * GameTrackerPhase11Registry.js
 *
 * Extracted Phase 11 handler-registration group for metadata/state surfaces.
 */

/**
 * Register Phase 11 metadata and roster summary handlers.
 *
 * @param {import('../gameTracker.js').default} tracker GameTracker instance
 */
export function registerPhase11MetadataHandlers(tracker) {
	tracker.registerHandler('arenaGetAll', async (_call, _args, data) => {
		await tracker.storage.setMetadata('arenaStats', {
			arenaPlace: parseInt(data.arenaPlace, 10) || 0,
			grandPlace: parseInt(data.grandPlace, 10) || 0,
			arenaPower: parseInt(data.arenaPower, 10) || 0,
			grandPower: parseInt(data.grandPower, 10) || 0,
			totalBattles: data.battles || 0,
			totalWins: data.wins || 0,
			winRate: data.battles > 0 ? ((data.wins / data.battles) * 100).toFixed(1) : '0.0',
			grandCoin: data.grandCoin || 0,
			arenaHeroes: data.arenaHeroes || [],
			grandHeroes: data.grandHeroes || [],
			rewardFlag: data.rewardFlag === '1' || data.rewardFlag === 1,
			lastUpdate: Date.now(),
		});
		console.log(`[OrganizedJihad] Arena stats: rank #${data.arenaPlace}, GA #${data.grandPlace}, ${data.wins}/${data.battles} wins`);
	}, 'trackArenaStats', { category: 'player' });

	tracker.registerHandler('missionGetAll', async (_call, _args, data) => {
		if (!Array.isArray(data)) return;
		const total = data.length;
		const completed = data.filter((m) => m.stars > 0).length;
		const threeStarred = data.filter((m) => m.stars === 3).length;
		const totalStars = data.reduce((sum, m) => sum + (m.stars || 0), 0);
		const maxStars = total * 3;
		await tracker.storage.setMetadata('campaignProgress', {
			totalMissions: total,
			completedMissions: completed,
			threeStarMissions: threeStarred,
			totalStars,
			maxStars,
			starPercent: maxStars > 0 ? ((totalStars / maxStars) * 100).toFixed(1) : '0.0',
			lastUpdate: Date.now(),
		});
		console.log(`[OrganizedJihad] Campaign: ${completed}/${total} missions, ${totalStars}/${maxStars} stars (${threeStarred} ★★★)`);
	}, 'trackCampaignProgress', { category: 'player' });

	tracker.registerHandler('titanArenaGetStatus', async (_call, _args, data) => {
		const defenders = data.defenders ? Object.keys(data.defenders).length : 0;
		const rivals = data.rivals ? Object.keys(data.rivals).length : 0;
		await tracker.storage.setMetadata('titanArenaStats', {
			rank: data.rank || 0,
			tier: parseInt(data.tier, 10) || 0,
			maxTier: data.maxTier || 0,
			dailyScore: data.dailyScore || 0,
			weeklyScore: data.weeklyScore || 0,
			status: data.status || 'unknown',
			canRaid: data.canRaid || false,
			defenderCount: defenders,
			rivalCount: rivals,
			nextDayTs: data.nextDayTs || 0,
			weekEndTs: data.weekEndTs || 0,
			lastUpdate: Date.now(),
		});
		console.log(`[OrganizedJihad] Titan Arena: rank #${data.rank}, tier ${data.tier}, daily ${data.dailyScore}, weekly ${data.weeklyScore}`);
	}, 'trackTitanArenaStats', { category: 'player' });

	tracker.registerHandler('battlePass_getInfo', async (_call, _args, data) => {
		const bp = data.battlePass || data;
		const rewards = bp.rewards || {};
		const totalLevels = Object.keys(rewards).length;
		const freeClaimed = Object.values(rewards).filter((r) => r.free === 1).length;
		const paidClaimed = Object.values(rewards).filter((r) => r.paid === 1).length;
		const currentLevel = totalLevels > 0
			? Math.max(...Object.values(rewards).filter((r) => r.free === 1).map((r) => r.level || 0), 0)
			: 0;
		await tracker.storage.setMetadata('battlePassData', {
			id: bp.id || data.id || 0,
			exp: bp.exp || 0,
			ticket: bp.ticket || 0,
			ticketLabel: bp.ticket === 2 ? 'Gold' : bp.ticket === 1 ? 'Silver' : 'Free',
			totalLevels,
			currentLevel,
			freeClaimed,
			paidClaimed,
			startDate: bp.startDate || 0,
			endDate: bp.endDate || 0,
			quests: bp.quests || [],
			lastUpdate: Date.now(),
		});
		console.log(`[OrganizedJihad] Battle Pass: Lv${currentLevel} (${bp.exp} XP), ${freeClaimed}/${totalLevels} free claimed`);
	}, 'trackBattlePass', { category: 'events' });

	tracker.registerHandler('crossClanWar_getBriefInfo', async (_call, _args, data) => {
		const existing = (await tracker.storage.getMetadata('cowData', null)) || {};
		await tracker.storage.setMetadata('cowData', {
			...existing,
			heroAttacksRemaining: data.heroTries ?? existing.heroAttacksRemaining ?? 0,
			titanAttacksRemaining: data.titanTries ?? existing.titanAttacksRemaining ?? 0,
			heroAttacksMax: 3,
			titanAttacksMax: 2,
			isActive: data.hasActiveWar ?? existing.isActive ?? false,
			status: data.status || existing.status || 'unknown',
			seasonEndTime: data.seasonEndTime || 0,
			nextWarTime: data.nextWarTime || 0,
			currentWarEndTime: data.currentWarEndTime || 0,
			heroTargets: data.heroTargets ?? 0,
			titanTargets: data.titanTargets ?? 0,
			lastUpdate: Date.now(),
		});
		console.log(`[OrganizedJihad] CoW brief: heroes ${data.heroTries}/3, titans ${data.titanTries}/2, active: ${data.hasActiveWar}`);
	}, 'trackCowBrief', { category: 'guild' });

	tracker.registerHandler('clanGetActivityStat', async (_call, _args, data) => {
		await tracker.storage.setMetadata('guildActivityStats', {
			clanActivity: data.clanActivity || 0,
			dungeonActivity: data.dungeonActivity || 0,
			todayActivity: data.stat?.todayActivity || 0,
			todayDungeonActivity: data.stat?.todayDungeonActivity || 0,
			todayItemsActivity: data.stat?.todayItemsActivity || 0,
			activitySum: data.stat?.activitySum || 0,
			dungeonActivitySum: data.stat?.dungeonActivitySum || 0,
			clanWarStat: data.stat?.clanWarStat || 0,
			adventureStat: data.stat?.adventureStat || 0,
			activityForRuneAvailable: data.stat?.activityForRuneAvailable || false,
			lastUpdate: Date.now(),
		});
		console.log(`[OrganizedJihad] Guild activity: ${data.stat?.todayActivity || 0} today, ${data.clanActivity || 0} total`);
	}, 'trackGuildActivity', { category: 'guild' });

	tracker.registerHandler('gacha_getInfo', async (_call, args, data) => {
		const ident = args.ident || 'heroGacha';
		const openings = data.openings || {};
		await tracker.storage.setMetadata(`gacha_${ident}`, {
			ident,
			totalOpenings: openings.count || 0,
			lastPityHit: openings.last || 0,
			nextPity: openings.next || 0,
			pityReward: openings.reward || null,
			pullsUntilPity: (openings.next || 0) - (openings.count || 0),
			wishlist: data.wishlist || [],
			nextRefill: data.nextRefill || 0,
			lastUpdate: Date.now(),
		});
		console.log(`[OrganizedJihad] Gacha (${ident}): ${openings.count} total, next pity at ${openings.next} (${(openings.next || 0) - (openings.count || 0)} pulls away)`);
	}, 'trackGacha', { category: 'player' });

	tracker.registerHandler('teamGetAll', async (_call, _args, data) => {
		const keyTeams = {};
		const importantKeys = [
			'arena', 'mission', 'tower', 'grand',
			'titan_arena', 'titan_arena_def',
			'clanDefence_heroes', 'clanDefence_titans',
			'crossClanDefence_heroes', 'crossClanDefence_titans',
			'clanRaid_nodes', 'boss_10', 'boss_11', 'boss_12',
			'clan_pvp_hero', 'clan_pvp_titan', 'challenge', 'challenge_titan',
			'dungeon_hero', 'dungeon_fire', 'dungeon_water', 'dungeon_earth', 'dungeon_neutral',
			'brawl', 'brawl_titan', 'adventure_hero', 'titan_mission',
			'clan_global_pvp', 'clan_global_pvp_titan',
		];
		for (const key of importantKeys) {
			if (data[key]) keyTeams[key] = data[key];
		}
		await tracker.storage.setMetadata('savedTeams', {
			teams: keyTeams,
			totalSlots: Object.keys(data).length,
			lastUpdate: Date.now(),
		});
		console.log(`[OrganizedJihad] Teams: ${Object.keys(keyTeams).length} key teams / ${Object.keys(data).length} total slots`);
	}, 'trackTeams', { category: 'player' });

	tracker.registerHandler('shopGetAll', async (_call, _args, data) => {
		const shops = {};
		for (const [shopId, shop] of Object.entries(data)) {
			const slots = shop.slots || {};
			const slotArr = Object.values(slots);
			const bought = slotArr.filter((s) => s.bought === true || s.bought === 1).length;
			shops[shopId] = {
				id: shop.id || parseInt(shopId, 10),
				totalSlots: slotArr.length,
				boughtCount: bought,
				availableCount: slotArr.length - bought,
				refreshTime: shop.refreshTime || 0,
				level: shop.level || 0,
			};
		}
		await tracker.storage.setMetadata('shopData', {
			shops,
			shopCount: Object.keys(shops).length,
			lastUpdate: Date.now(),
		});
		console.log(`[OrganizedJihad] Shops: ${Object.keys(shops).length} shops tracked`);
	}, 'trackShops', { category: 'economy' });

	tracker.registerHandler('friendsGetInfo', async (_call, _args, data) => {
		const accounts = data.accounts || [];
		const users = data.users || [];
		if (accounts.length > 0 || users.length > 0) {
			await tracker.storage.setMetadata('friendsData', {
				accountCount: accounts.length,
				userCount: users.length,
				lastUpdate: Date.now(),
			});
		}
	}, 'trackFriends', { category: 'social' });

	tracker.registerHandler('buffs_getInfo', async (_call, _args, data) => {
		await tracker.storage.setMetadata('activeBuffs', {
			buffs: data,
			lastUpdate: Date.now(),
		});
	}, 'trackBuffs', { category: 'player' });

	tracker.registerHandler('ascensionChest_getInfo', async (_call, _args, data) => {
		await tracker.storage.setMetadata('ascensionChestData', {
			...data,
			lastUpdate: Date.now(),
		});
	}, 'trackAscensionChest', { category: 'player' });

	tracker.registerHandler('stronghold_getInfo', async (_call, _args, data) => {
		await tracker.storage.setMetadata('strongholdData', {
			...data,
			lastUpdate: Date.now(),
		});
	}, 'trackStronghold', { category: 'player' });

	tracker.registerHandler('idle_getAll', async (_call, _args, data) => {
		await tracker.storage.setMetadata('idleData', {
			...data,
			lastUpdate: Date.now(),
		});
	}, 'trackIdle', { category: 'economy' });

	tracker.registerHandler('chatGetAll', async (_call, _args, data) => {
		const messages = Array.isArray(data) ? data : (data.messages || []);
		if (messages.length > 0) {
			await tracker._logActivity('chat', `Chat history loaded: ${messages.length} messages`);
		}
	}, 'trackChatAll', { category: 'social' });

	tracker.registerHandler('chatGetTalks', async (_call, _args, data) => {
		const talks = Array.isArray(data) ? data : (data.talks || []);
		await tracker.storage.setMetadata('chatTalks', {
			talkCount: talks.length,
			lastUpdate: Date.now(),
		});
	}, 'trackChatTalks', { category: 'social' });

	tracker.registerHandler('roleAscension_getAll', async (_call, _args, data) => {
		await tracker.storage.setMetadata('ascensionData', {
			data,
			lastUpdate: Date.now(),
		});
	}, 'trackAscensionAll', { category: 'player' });

	tracker.registerHandler('titanSpirit_getAll', async (_call, _args, data) => {
		await tracker.storage.setMetadata('titanSpiritData', {
			data,
			lastUpdate: Date.now(),
		});
	}, 'trackTitanSpirits', { category: 'player' });
}
