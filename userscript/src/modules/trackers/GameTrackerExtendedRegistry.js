/**
 * GameTrackerExtendedRegistry.js
 *
 * Extracted Phase 12 and Phase 13 handler-registration groups.
 */

/**
 * Register Phase 12 handlers.
 *
 * @param {import('../gameTracker.js').default} tracker GameTracker instance
 */
export function registerPhase12Handlers(tracker) {
	tracker.registerHandler('clanGetWeeklyStat', async (_call, _args, data) => {
		const members = data.stat || [];
		const summary = members.map((m) => ({
			userId: m.id,
			activity: m.activity || [],
			dungeonActivity: m.dungeonActivity || [],
			adventureStat: m.adventureStat || [],
			clanWarStat: m.clanWarStat || [],
			prestigeStat: m.prestigeStat || [],
			clanGifts: m.clanGifts || [],
		}));
		await tracker.storage.setMetadata('guildWeeklyStat', {
			memberCount: summary.length,
			members: summary,
			lastUpdate: Date.now(),
		});
		console.log(`[OrganizedJihad] Guild weekly stats: ${summary.length} members`);
	}, 'trackGuildWeeklyStat', { category: 'guild' });

	tracker.registerHandler('clanGetLog', async (_call, _args, data) => {
		const history = data.history || [];
		if (history.length > 0) {
			const existing = (await tracker.storage.getMetadata('guildLog', null)) || {};
			const allEntries = [...(existing.entries || [])];
			const seenIds = new Set(allEntries.map((e) => e.id));
			let newCount = 0;
			for (const entry of history) {
				if (!seenIds.has(entry.id)) {
					allEntries.push({
						id: entry.id,
						userId: entry.userId,
						event: entry.event,
						ctime: entry.ctime,
						details: entry.details || null,
					});
					newCount++;
				}
			}
			const trimmed = allEntries.slice(-500);
			await tracker.storage.setMetadata('guildLog', {
				entries: trimmed,
				totalTracked: trimmed.length,
				lastUpdate: Date.now(),
			});
			if (newCount > 0) {
				console.log(`[OrganizedJihad] Guild log: ${newCount} new entries (${trimmed.length} total)`);
			}
		}
	}, 'trackGuildLog', { category: 'guild' });

	tracker.registerHandler('clanWarGetDefence', async (_call, _args, data) => {
		const slots = data.slots || {};
		const teams = data.teams || {};
		const defenseData = {
			slotCount: Object.keys(slots).length,
			slots,
			teamCount: Object.keys(teams).length,
			lastUpdate: Date.now(),
		};
		await tracker.storage.setMetadata('guildWarDefense', defenseData);
		console.log(`[OrganizedJihad] GW Defense: ${defenseData.slotCount} slots, ${defenseData.teamCount} teams`);
	}, 'trackGuildWarDefense', { category: 'guild' });

	tracker.registerHandler('clanWarGetWarlordInfo', async (_call, _args, data) => {
		const warInfo = data.warInfo || {};
		const defence = data.defence || {};
		await tracker.storage.setMetadata('guildWarWarlord', {
			season: warInfo.season || 0,
			day: warInfo.day || 0,
			endTime: warInfo.endTime || 0,
			nextWarTime: warInfo.nextWarTime || 0,
			nextLockTime: warInfo.nextLockTime || 0,
			defenseSlots: Object.keys(defence.slots || {}).length,
			defenseTeams: Object.keys(defence.teams || {}).length,
			lastUpdate: Date.now(),
		});
		console.log(`[OrganizedJihad] GW Warlord: season ${warInfo.season}, day ${warInfo.day}`);
	}, 'trackGuildWarWarlord', { category: 'guild' });

	tracker.registerHandler('clanWarGetLeagueInfo', async (_call, _args, data) => {
		const clanData = data.clanData || {};
		await tracker.storage.setMetadata('guildWarLeague', {
			leagueId: clanData.leagueId || 0,
			position: clanData.position || 0,
			points: clanData.points || 0,
			prevLeague: clanData.prevLeague || 0,
			prevPosition: clanData.prevPosition || 0,
			prevPoints: clanData.prevPoints || 0,
			clanPlace: data.clanPlace || 0,
			lastUpdate: Date.now(),
		});
		console.log(`[OrganizedJihad] GW League: pos #${clanData.position}, ${clanData.points} pts, league ${clanData.leagueId}`);
	}, 'trackGuildWarLeague', { category: 'guild' });

	tracker.registerHandler('clanGetOnline', async (_call, _args, data) => {
		const users = data.users || {};
		await tracker.storage.setMetadata('guildOnline', {
			onlineCount: Object.keys(users).length,
			users,
			lastUpdate: Date.now(),
		});
	}, 'trackGuildOnline', { category: 'guild' });

	tracker.registerHandler('topGet', async (_call, args, data) => {
		const topType = args.type || 'unknown';
		const top = data.top || [];
		const myPlace = data.place || 0;
		const myScore = data.score || 0;
		const existing = (await tracker.storage.getMetadata('leaderboards', null)) || {};
		existing[topType] = {
			myPlace,
			myScore,
			topEntries: top.slice(0, 20).map((t) => ({
				place: t.place,
				itemId: t.itemId,
				score: t.score,
			})),
			lastUpdate: Date.now(),
		};
		await tracker.storage.setMetadata('leaderboards', existing);
		console.log(`[OrganizedJihad] Leaderboard (${topType}): rank #${myPlace}, score ${myScore}`);
	}, 'trackLeaderboard', { category: 'player' });

	tracker.registerHandler('heroRating_getInfo', async (_call, _args, data) => {
		await tracker.storage.setMetadata('heroRating', {
			userRating: data.userRating || {},
			communityRating: data.rating || {},
			lastUpdate: Date.now(),
		});
	}, 'trackHeroRating', { category: 'player' });

	tracker.registerHandler('questGetEvents', async (_call, _args, data) => {
		const events = Array.isArray(data) ? data : [];
		const eventSummary = events.map((e) => ({
			id: e.id,
			startTime: e.startTime || 0,
			endTime: e.endTime || 0,
			originalId: e.originalId || 0,
			chainCount: (e.questChains || []).length,
		}));
		await tracker.storage.setMetadata('eventQuests', {
			events: eventSummary,
			activeCount: eventSummary.length,
			lastUpdate: Date.now(),
		});
		console.log(`[OrganizedJihad] Event quests: ${eventSummary.length} active events`);
	}, 'trackEventQuests', { category: 'events' });

	tracker.registerHandler('specialOffer_getAll', async (_call, _args, data) => {
		const offers = Array.isArray(data) ? data : [];
		const offerSummary = offers.map((o) => ({
			id: o.id,
			type: o.type || o.offerType || 'unknown',
			endTime: o.endTime || 0,
			billingCount: (o.billings || []).length,
		}));
		await tracker.storage.setMetadata('specialOffers', {
			offers: offerSummary,
			activeCount: offerSummary.length,
			lastUpdate: Date.now(),
		});
	}, 'trackSpecialOffers', { category: 'economy' });

	tracker.registerHandler('crossClanWar_getAttackMap', async (_call, _args, data) => {
		await tracker.storage.setMetadata('cowAttackMap', {
			...data,
			lastUpdate: Date.now(),
		});
	}, 'trackCowAttackMap', { category: 'guild' });

	tracker.registerHandler('crossClanWar_getDefencePlan', async (_call, _args, data) => {
		await tracker.storage.setMetadata('cowDefensePlan', {
			...data,
			lastUpdate: Date.now(),
		});
	}, 'trackCowDefensePlan', { category: 'guild' });

	tracker.registerHandler('crossClanWar_getSettings', async (_call, _args, data) => {
		await tracker.storage.setMetadata('cowSettings', {
			...data,
			lastUpdate: Date.now(),
		});
	}, 'trackCowSettings', { category: 'guild' });

	tracker.registerHandler('subscriptionGetInfo', async (_call, _args, data) => {
		await tracker.storage.setMetadata('subscriptionInfo', {
			...data,
			lastUpdate: Date.now(),
		});
	}, 'trackSubscription', { category: 'economy' });

	tracker.registerHandler('clan_prestigeGetInfo', async (_call, _args, data) => {
		await tracker.storage.setMetadata('guildPrestige', {
			...data,
			lastUpdate: Date.now(),
		});
	}, 'trackGuildPrestige', { category: 'guild' });

	tracker.registerHandler('clanRaid_ratingInfo', async (_call, _args, data) => {
		await tracker.storage.setMetadata('raidRating', {
			...data,
			lastUpdate: Date.now(),
		});
	}, 'trackRaidRating', { category: 'guild' });

	tracker.registerHandler('clanRaidSubscription_getInfo', async (_call, _args, data) => {
		await tracker.storage.setMetadata('raidSubscription', {
			...data,
			lastUpdate: Date.now(),
		});
	}, 'trackRaidSubscription', { category: 'guild' });

	tracker.registerHandler('towerGetState', async (_call, _args, data) => {
		await tracker.storage.setMetadata('towerState', {
			floor: data.floor || data.floorNumber || 0,
			teamHealth: data.teamHealth || {},
			...data,
			lastUpdate: Date.now(),
		});
	}, 'trackTowerState', { category: 'player' });

	tracker.registerHandler('titanGetSummoningCircle', async (_call, _args, data) => {
		await tracker.storage.setMetadata('titanSummonCircle', {
			...data,
			lastUpdate: Date.now(),
		});
	}, 'trackTitanSummonCircle', { category: 'player' });

	tracker.registerHandler('titanUseSummonCircle', async (_call, _args, data) => {
		await tracker._logActivity('summon', 'Titan summoning circle used');
		await tracker.storage.setMetadata('titanSummonCircle', {
			...data,
			lastUpdate: Date.now(),
		});
	}, 'trackTitanSummonUse', { category: 'player' });

	tracker.registerHandler(['artifactGetChestLevel', 'titanArtifactGetChest'], async (_call, _args, data) => {
		await tracker.storage.setMetadata('artifactChestLevel', {
			...data,
			lastUpdate: Date.now(),
		});
	}, 'trackArtifactChestLevel', { category: 'player' });

	tracker.registerHandler('teamGetFavor', async (_call, _args, data) => {
		await tracker.storage.setMetadata('teamFavor', {
			data,
			lastUpdate: Date.now(),
		});
	}, 'trackTeamFavor', { category: 'player' });

	tracker.registerHandler('team_getBanners', async (_call, _args, data) => {
		await tracker.storage.setMetadata('teamBanners', {
			data,
			lastUpdate: Date.now(),
		});
	}, 'trackTeamBanners', { category: 'player' });

	tracker.registerHandler('powerTournament_getState', async (_call, _args, data) => {
		await tracker.storage.setMetadata('powerTournament', {
			...data,
			lastUpdate: Date.now(),
		});
	}, 'trackPowerTournament', { category: 'events' });

	tracker.registerHandler('hallOfFameGetTrophies', async (_call, _args, data) => {
		await tracker.storage.setMetadata('hallOfFame', {
			data,
			lastUpdate: Date.now(),
		});
	}, 'trackHallOfFame', { category: 'player' });

	tracker.registerHandler('seasonAdventure_getInfo', async (_call, _args, data) => {
		await tracker.storage.setMetadata('seasonAdventure', {
			...data,
			lastUpdate: Date.now(),
		});
	}, 'trackSeasonAdventure', { category: 'events' });

	tracker.registerHandler('adventureSolo_getActiveData', async (_call, _args, data) => {
		await tracker.storage.setMetadata('soloAdventure', {
			hasActive: data.hasActive || false,
			adventureId: data.adventureId || 0,
			endTime: data.endTime || 0,
			turns: data.turns || 0,
			hasRewards: data.hasRewards || false,
			lastUpdate: Date.now(),
		});
	}, 'trackSoloAdventure', { category: 'events' });

	tracker.registerHandler('inventoryExchangeTitanStones', async (_call, args, _data) => {
		await tracker._logActivity('exchange', 'Titan stones exchanged', {
			args,
		});
	}, 'trackTitanStoneExchange', { category: 'economy' });

	tracker.registerHandler('zeppelinGiftGet', async (_call, _args, data) => {
		await tracker._logActivity('reward', 'Zeppelin gift collected', {
			reward: data.reward || data,
		});
	}, 'trackZeppelinGift', { category: 'economy' });

	tracker.registerHandler('settingsGetAll', async (_call, _args, data) => {
		await tracker.storage.setMetadata('gameSettings', {
			data,
			lastUpdate: Date.now(),
		});
	}, 'trackSettings', { category: 'player' });

	tracker.registerHandler('dailyBonusGetInfo', async (_call, _args, data) => {
		await tracker.storage.setMetadata('dailyBonusInfo', {
			day: data.day || 0,
			rewardType: data.rewardType || 0,
			isAvailable: data.isAvailable || false,
			...data,
			lastUpdate: Date.now(),
		});
	}, 'trackDailyBonusInfo', { category: 'player' });

	tracker.registerHandler('socialQuestGetInfo', async (_call, _args, data) => {
		await tracker.storage.setMetadata('socialQuest', {
			...data,
			lastUpdate: Date.now(),
		});
	}, 'trackSocialQuest', { category: 'social' });

	tracker.registerHandler('chatGetInfo', async (_call, _args, data) => {
		await tracker.storage.setMetadata('chatInfo', {
			...data,
			lastUpdate: Date.now(),
		});
	}, 'trackChatInfo', { category: 'social' });

	tracker.registerHandler('banner_getAll', async (_call, _args, data) => {
		await tracker.storage.setMetadata('banners', {
			data,
			lastUpdate: Date.now(),
		});
	}, 'trackBanners', { category: 'player' });

	tracker.registerHandler('campaignStoryGetList', async (_call, _args, data) => {
		await tracker.storage.setMetadata('campaignStory', {
			data,
			lastUpdate: Date.now(),
		});
	}, 'trackCampaignStory', { category: 'player' });

	tracker.registerHandler('eventPicker_getInfo', async (_call, _args, data) => {
		await tracker.storage.setMetadata('eventPicker', {
			...data,
			lastUpdate: Date.now(),
		});
	}, 'trackEventPicker', { category: 'events' });

	tracker.registerHandler('newYear_getInfo', async (_call, _args, data) => {
		await tracker.storage.setMetadata('newYearEvent', {
			...data,
			lastUpdate: Date.now(),
		});
	}, 'trackNewYearEvent', { category: 'events' });

	tracker.registerHandler('shopGet', async (_call, args, data) => {
		const shopId = args.shopId || data.id || 'unknown';
		const slots = data.slots || {};
		const slotArr = Object.values(slots);
		const bought = slotArr.filter((s) => s.bought === true || s.bought === 1).length;
		const existing = (await tracker.storage.getMetadata('shopData', null)) || {};
		const shops = existing.shops || {};
		shops[shopId] = {
			id: data.id || parseInt(shopId, 10),
			totalSlots: slotArr.length,
			boughtCount: bought,
			availableCount: slotArr.length - bought,
			refreshTime: data.refreshTime || 0,
			availableUntil: data.availableUntil || 0,
			level: data.level || 0,
		};
		await tracker.storage.setMetadata('shopData', {
			shops,
			shopCount: Object.keys(shops).length,
			lastUpdate: Date.now(),
		});
	}, 'trackShopDetails', { category: 'economy' });

	tracker.registerHandler(['billingGetAll', 'billingGetLast'], async (_call, _args, data) => {
		await tracker.storage.setMetadata('billingCatalog', {
			data,
			lastUpdate: Date.now(),
		});
	}, 'trackBilling', { category: 'economy' });

	tracker.registerHandler('bundleGetAllAvailableId', async (_call, _args, data) => {
		await tracker.storage.setMetadata('bundles', {
			data,
			lastUpdate: Date.now(),
		});
	}, 'trackBundles', { category: 'economy' });

	tracker.registerHandler('coopBundle_getInfo', async (_call, _args, data) => {
		await tracker.storage.setMetadata('coopBundle', {
			...data,
			lastUpdate: Date.now(),
		});
	}, 'trackCoopBundle', { category: 'economy' });

	tracker.registerHandler('clanGetAvailableDailyGifts', async (_call, _args, data) => {
		await tracker.storage.setMetadata('guildDailyGifts', {
			data,
			lastUpdate: Date.now(),
		});
	}, 'trackGuildDailyGifts', { category: 'guild' });

	tracker.registerHandler('clanInvites_getUserInbox', async (_call, _args, data) => {
		await tracker.storage.setMetadata('guildInvites', {
			data,
			lastUpdate: Date.now(),
		});
	}, 'trackGuildInvites', { category: 'guild' });

	tracker.registerHandler('clanGetActivityRewardTable', async (_call, _args, data) => {
		await tracker.storage.setMetadata('guildActivityRewards', {
			data,
			lastUpdate: Date.now(),
		});
	}, 'trackGuildActivityRewards', { category: 'guild' });

	tracker.registerHandler('friendSendHearts', async () => {
		await tracker._logActivity('social', 'Hearts sent to friends');
	}, 'trackFriendSendHearts', { category: 'social' });

	tracker.registerHandler('friendGetHearts', async () => {
		await tracker._logActivity('social', 'Hearts received from friends');
	}, 'trackFriendGetHearts', { category: 'social' });
}

/**
 * Register Phase 13 handlers.
 *
 * @param {import('../gameTracker.js').default} tracker GameTracker instance
 */
export function registerPhase13Handlers(tracker) {
	tracker.registerHandler('bossGetAll', async (_call, _args, data) => {
		const bosses = Array.isArray(data) ? data : [];
		await tracker.storage.setMetadata('outlandBosses', {
			bosses: bosses.map((b) => ({
				id: b.id,
				bossLevel: b.bossLevel ?? 0,
				chestNum: b.chestNum ?? 0,
				chestId: b.chestId ?? 0,
			})),
			bossCount: bosses.length,
			totalChests: bosses.reduce((sum, b) => sum + (b.chestNum ?? 0), 0),
			lastUpdate: Date.now(),
		});
	}, 'trackOutlandBosses', { category: 'pve' });

	tracker.registerHandler('towerGetInfo', async (_call, _args, data) => {
		await tracker.storage.setMetadata('towerState', {
			floorNumber: Number(data.floorNumber) || 0,
			floorType: data.floorType || 'unknown',
			points: Number(data.points) || 0,
			maySkipFloor: Number(data.maySkipFloor) || 0,
			teamLevel: Number(data.teamLevel) || 0,
			lastUpdate: Date.now(),
		});
	}, 'trackTowerState', { category: 'pve' });

	tracker.registerHandler('expeditionGet', async (_call, _args, data) => {
		const slots = typeof data === 'object' && data !== null ? Object.values(data) : [];
		const active = slots.filter((s) => s.status === 1 || s.status === 2);
		const complete = slots.filter((s) => s.status === 3);
		await tracker.storage.setMetadata('expeditionSlots', {
			slots: slots.map((s) => ({
				id: s.id,
				slotId: s.slotId,
				status: s.status,
				duration: s.duration ?? 0,
				endTime: s.endTime ?? 0,
			})),
			totalSlots: slots.length,
			activeCount: active.length,
			completeCount: complete.length,
			lastUpdate: Date.now(),
		});
	}, 'trackExpeditionSlots', { category: 'pve' });

	tracker.registerHandler('invasion_getInfo', async (_call, _args, data) => {
		await tracker.storage.setMetadata('invasionData', {
			id: data.id ?? null,
			bestPlace: data.bestPlace ?? 0,
			farmedRewards: Array.isArray(data.farmedRewards) ? data.farmedRewards.length : 0,
			actions: Array.isArray(data.actions) ? data.actions.map((a) => ({
				type: a.type,
				startDate: a.startDate,
				endDate: a.endDate,
			})) : [],
			lastUpdate: Date.now(),
		});
	}, 'trackInvasionInfo', { category: 'events' });

	tracker.registerHandler('workshopBuff_getInfo', async (_call, _args, data) => {
		const buffs = Array.isArray(data) ? data : [];
		await tracker.storage.setMetadata('workshopBuffs', {
			buffs: buffs.map((b) => ({
				id: b.id,
				type: b.type ?? 'unknown',
				amount: b.amount ?? 0,
				level: b.level ?? 0,
				inUse: b.inUse ?? false,
			})),
			totalBuffs: buffs.length,
			activeBuffs: buffs.filter((b) => b.inUse).length,
			lastUpdate: Date.now(),
		});
	}, 'trackWorkshopBuffs', { category: 'pve' });

	tracker.registerHandler('battlePass_getSpecial', async (_call, _args, data) => {
		const passes = typeof data === 'object' && data !== null ? Object.values(data) : [];
		const active = passes.filter((p) => {
			const now = Math.floor(Date.now() / 1000);
			return p.endDate && p.endDate > now;
		});
		await tracker.storage.setMetadata('battlePassSpecial', {
			passes: active.map((p) => ({
				id: p.id,
				exp: p.exp ?? 0,
				ticket: p.ticket ?? 0,
				startDate: p.startDate,
				endDate: p.endDate,
			})),
			activeCount: active.length,
			lastUpdate: Date.now(),
		});
	}, 'trackBattlePassSpecial', { category: 'events' });

	tracker.registerHandler('battlePass_farmReward', async (_call, _args, data) => {
		const rewards = Object.entries(data || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
		await tracker._logActivity('reward', `Battle Pass reward claimed: ${rewards}`);
	}, 'trackBattlePassFarmReward', { category: 'economy' });

	tracker.registerHandler('pet_getChest', async (_call, _args, data) => {
		await tracker.storage.setMetadata('petChest', {
			starmoneySpent: Number(data.starmoneySpent) || 0,
			dailyPetId: data.dailyPetId || null,
			lastUpdate: Date.now(),
		});
	}, 'trackPetChest', { category: 'pets' });

	tracker.registerHandler('adventure_getActiveData', async (_call, _args, data) => {
		await tracker.storage.setMetadata('adventureActive', {
			hasActive: data.hasActive ?? false,
			hasRewards: data.hasRewards ?? false,
			lastChatTime: data.lastChatTime ?? null,
			lastUpdate: Date.now(),
		});
	}, 'trackAdventureActive', { category: 'pve' });

	tracker.registerHandler('adventure_getPassed', async (_call, _args, data) => {
		const entries = typeof data === 'object' && data !== null ? Object.entries(data) : [];
		const totalPassed = entries.reduce((sum, [, count]) => sum + (Number(count) || 0), 0);
		await tracker.storage.setMetadata('adventurePassed', {
			adventureMap: data,
			totalAdventures: entries.length,
			totalCompletions: totalPassed,
			lastUpdate: Date.now(),
		});
	}, 'trackAdventurePassed', { category: 'pve' });

	tracker.registerHandler('adventure_find', async (_call, _args, data) => {
		const lobbies = Array.isArray(data.lobbies) ? data.lobbies : [];
		await tracker.storage.setMetadata('adventureLobbies', {
			lobbyCount: lobbies.length,
			userCount: Array.isArray(data.users) ? data.users.length : 0,
			lastUpdate: Date.now(),
		});
	}, 'trackAdventureLobbies', { category: 'pve' });

	tracker.registerHandler('adventureSolo_getActiveData', async (_call, _args, data) => {
		await tracker.storage.setMetadata('adventureSoloActive', {
			hasActive: data.hasActive ?? false,
			lastUpdate: Date.now(),
		});
	}, 'trackAdventureSoloActive', { category: 'pve' });

	tracker.registerHandler('chatsGetAll', async (_call, _args, data) => {
		const channels = typeof data === 'object' && data !== null ? Object.keys(data) : [];
		const messageCounts = {};
		for (const ch of channels) {
			const chat = data[ch]?.chat;
			messageCounts[ch] = Array.isArray(chat) ? chat.length : 0;
		}
		await tracker.storage.setMetadata('chatSummary', {
			channels,
			messageCounts,
			totalMessages: Object.values(messageCounts).reduce((s, c) => s + c, 0),
			lastUpdate: Date.now(),
		});
	}, 'trackChatSummary', { category: 'social' });

	tracker.registerHandler('titanArenaCheckForgotten', async (_call, _args, data) => {
		if (data?.result) {
			await tracker._logActivity('reminder', 'Forgotten Titan Arena battle detected');
		}
	}, 'trackTitanArenaForgotten', { category: 'battles' });

	tracker.registerHandler('titanArenaGetChestReward', async (_call, _args, data) => {
		const rewards = Array.isArray(data) ? data : [];
		if (rewards.length > 0) {
			await tracker._logActivity('reward', `Titan Arena chest: ${rewards.length} reward(s)`);
		}
	}, 'trackTitanArenaChestReward', { category: 'battles' });

	tracker.registerHandler('userGetAvailableAvatarFrames', async (_call, _args, data) => {
		const frames = data?.frames ? Object.keys(data.frames) : [];
		await tracker.storage.setMetadata('avatarFrames', {
			count: frames.length,
			frameIds: frames.map(Number),
			lastUpdate: Date.now(),
		});
	}, 'trackAvatarFrames', { category: 'cosmetics' });

	tracker.registerHandler('userGetAvailableAvatars', async (_call, _args, data) => {
		const avatars = Array.isArray(data) ? data : [];
		await tracker.storage.setMetadata('avatars', {
			count: avatars.length,
			avatarIds: avatars,
			lastUpdate: Date.now(),
		});
	}, 'trackAvatars', { category: 'cosmetics' });

	tracker.registerHandler('userGetAvailableStickers', async (_call, _args, data) => {
		const stickers = Array.isArray(data) ? data : [];
		await tracker.storage.setMetadata('stickers', {
			count: stickers.length,
			stickerIds: stickers,
			lastUpdate: Date.now(),
		});
	}, 'trackStickers', { category: 'cosmetics' });

	tracker.registerHandler('telegramQuestGetInfo', async (_call, _args, data) => {
		const entries = typeof data === 'object' && data !== null ? Object.entries(data) : [];
		const completed = entries.filter(([, v]) => v === '1' || v === true).length;
		await tracker.storage.setMetadata('telegramQuests', {
			quests: data,
			totalQuests: entries.length,
			completedQuests: completed,
			lastUpdate: Date.now(),
		});
	}, 'trackTelegramQuests', { category: 'social' });

	tracker.registerHandler('rewardedVideo_boxyGetInfo', async (_call, _args, data) => {
		const rewards = Array.isArray(data?.rewards) ? data.rewards : [];
		const farmed = rewards.filter((r) => r.farmed).length;
		await tracker.storage.setMetadata('boxyRewards', {
			totalSlots: rewards.length,
			farmedSlots: farmed,
			remainingSlots: rewards.length - farmed,
			lastUpdate: Date.now(),
		});
	}, 'trackBoxyRewards', { category: 'economy' });

	tracker.registerHandler('saleShowcase_rewardInfo', async (_call, _args, data) => {
		await tracker.storage.setMetadata('saleShowcase', {
			nextRefill: data.nextRefill ?? null,
			hasReward: data.reward != null,
			lastUpdate: Date.now(),
		});
	}, 'trackSaleShowcase', { category: 'economy' });

	tracker.registerHandler('getTime', async () => {
		// No-op: server timestamp
	}, 'ignoreGetTime', { category: 'system' });

	tracker.registerHandler('registration', async () => {
		// No-op: session registration
	}, 'ignoreRegistration', { category: 'system' });

	tracker.registerHandler('tutorialGetInfo', async () => {
		// No-op: tutorial flags
	}, 'ignoreTutorialInfo', { category: 'system' });

	tracker.registerHandler('splitGetAll', async () => {
		// No-op: A/B test splits
	}, 'ignoreSplitGetAll', { category: 'system' });

	tracker.registerHandler('stashClient', async () => {
		// No-op: client stash flags
	}, 'ignoreStashClient', { category: 'system' });

	tracker.registerHandler('freebieHaveGroup', async () => {
		// No-op: freebie group flag
	}, 'ignoreFreebieHaveGroup', { category: 'system' });

	tracker.registerHandler('mechanicAvailability', async () => {
		// No-op: feature flags
	}, 'ignoreMechanicAvailability', { category: 'system' });

	tracker.registerHandler('mechanicsBan_getInfo', async () => {
		// No-op: mechanics ban list
	}, 'ignoreMechanicsBan', { category: 'system' });

	tracker.registerHandler('playable_getAvailable', async () => {
		// No-op: playable character list
	}, 'ignorePlayableAvailable', { category: 'system' });

	tracker.registerHandler('userMergeGetStatus', async () => {
		// No-op: merge status
	}, 'ignoreUserMergeStatus', { category: 'system' });
}
