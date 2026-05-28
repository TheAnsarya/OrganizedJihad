/**
 * GameTrackerGameplayRegistry.js
 *
 * Extracted handler-registration groups for battle, guild, upgrades,
 * and economy/quest gameplay flows previously registered inline in GameTracker.
 */

/**
 * Register battle flow handlers.
 *
 * @param {import('../gameTracker.js').default} tracker GameTracker instance
 */
export function registerBattleHandlers(tracker) {
	tracker.registerHandler('missionEnd', async (callName, args, data) => {
		await tracker.trackMissionProgress(args, data);
		await tracker.trackBattleResult(callName, args, data);
	}, 'trackMission', { category: 'battles' });

	tracker.registerHandler('towerEnd', async (callName, args, data) => {
		await tracker.trackTowerProgress(args, data);
		await tracker.trackBattleResult(callName, args, data);
	}, 'trackTower', { category: 'battles' });

	tracker.registerHandler('bossEnd', async (callName, args, data) => {
		await tracker.trackBattleResult(callName, args, data);
	}, 'trackBossEnd', { category: 'battles' });

	tracker.registerHandler('arenaGetEnemies', async (_call, _args, data) => {
		await tracker.trackArenaEnemies(data);
	}, 'trackArenaEnemies', { category: 'battles' });

	tracker.registerHandler(['arenaAttack', 'arenaEnd'], async (_call, args, data) => {
		await tracker.trackArenaBattle(args, data);
	}, 'trackArenaBattle', { category: 'battles' });

	tracker.registerHandler('titanArenaGetEnemies', async (_call, _args, data) => {
		await tracker.trackTitanArenaEnemies(data);
	}, 'trackTitanArenaEnemies', { category: 'battles' });

	tracker.registerHandler('titanArenaAttack', async (_call, args, data) => {
		await tracker.trackTitanArenaBattle(args, data);
	}, 'trackTitanArenaBattle', { category: 'battles' });

	tracker.registerHandler('grandArenaGetEnemies', async (_call, _args, data) => {
		await tracker.trackGrandArenaEnemies(data);
	}, 'trackGrandArenaEnemies', { category: 'battles' });

	tracker.registerHandler('grandArenaAttack', async (_call, args, data) => {
		await tracker.trackGrandArenaBattle(args, data);
	}, 'trackGrandArenaBattle', { category: 'battles' });

	tracker.registerHandler('clanWarAttack', async (_call, args, data) => {
		await tracker.trackGuildWarBattle(args, data);
	}, 'trackGuildWarBattle', { category: 'battles' });

	tracker.registerHandler('clanWarGetBattleResults', async (_call, args, data) => {
		await tracker.trackCrossServerWarResults(args, data);
	}, 'trackCrossServerWarResults', { category: 'battles' });

	tracker.registerHandler('arenaGetReplay', async (callName, args, data) => {
		await tracker.trackArenaReplay(callName, args, data);
	}, 'trackArenaReplay', { category: 'battles' });

	tracker.registerHandler('grandGetReplay', async (callName, args, data) => {
		await tracker.trackArenaReplay(callName, args, data);
	}, 'trackGrandArenaReplay', { category: 'battles' });

	tracker.registerHandler('arenaFindEnemies', async (_call, _args, data) => {
		await tracker.trackArenaEnemies(data);
	}, 'trackArenaFindEnemies', { category: 'battles' });

	tracker.registerHandler(['adventureGetReplay', 'bossGetReplay'], async (callName, args, data) => {
		await tracker.trackAdventureReplay(callName, args, data);
	}, 'trackAdventureReplay', { category: 'battles' });

	tracker.registerHandler('battleGetReplay', async (_call, args, data) => {
		const replay = data.replay || data;
		const ident = args.ident || args.type || '';
		if (ident.includes('boss') || ident.includes('adventure')) {
			await tracker.trackAdventureReplay('battleGetReplay', args, replay);
		} else if (ident.includes('grand')) {
			await tracker.trackArenaReplay('grandGetReplay', args, replay);
		} else {
			await tracker.trackArenaReplay('arenaGetReplay', args, replay);
		}
	}, 'trackBattleGetReplay', { category: 'battles' });

	tracker.registerHandler('bossRaidAttack', async (_call, args, data) => {
		await tracker.trackRaidBossAttack(args, data);
	}, 'trackRaidBossAttack', { category: 'battles' });

	tracker.registerHandler('expeditionGetState', async (_call, _args, data) => {
		await tracker.trackExpeditionState(data);
	}, 'trackExpeditionState', { category: 'battles' });

	tracker.registerHandler('expeditionBattle', async (_call, args, data) => {
		await tracker.trackExpeditionBattle(args, data);
	}, 'trackExpeditionBattle', { category: 'battles' });

	tracker.registerHandler('titanArenaEnd', async (_call, args, data) => {
		await tracker.trackTitanArenaBattle(args, data);
	}, 'trackTitanArenaEnd', { category: 'battles' });

	tracker.registerHandler('grandArenaEnd', async (_call, args, data) => {
		await tracker.trackGrandArenaBattle(args, data);
	}, 'trackGrandArenaEnd', { category: 'battles' });

	tracker.registerHandler('adventureEnd', async (callName, args, data) => {
		await tracker.trackBattleResult(callName, args, data);
	}, 'trackAdventureEnd', { category: 'battles' });

	tracker.registerHandler(['dungeonBattle', 'dungeonEnd'], async (callName, args, data) => {
		await tracker.trackBattleResult(callName, args, data);
	}, 'trackDungeonBattle', { category: 'battles' });

	tracker.registerHandler(['titanDungeonBattle', 'titanDungeonEnd'], async (callName, args, data) => {
		await tracker.trackBattleResult(callName, args, data);
	}, 'trackTitanDungeonBattle', { category: 'battles' });

	tracker.registerHandler('adventureGetAll', async (_call, _args, data) => {
		await tracker._trackGenericEvent('adventure', 'adventureState', {}, data);
	}, 'trackAdventureState', { category: 'battles' });

	tracker.registerHandler('clanDungeonBattle', async (callName, args, data) => {
		await tracker.trackBattleResult(callName, args, data);
	}, 'trackClanDungeonBattle', { category: 'battles' });

	tracker.registerHandler(['clashGetInfo', 'clashBattle', 'clashEnd'], async (callName, args, data) => {
		if (callName.includes('Battle') || callName.includes('End')) {
			await tracker.trackBattleResult(callName, args, data);
		} else {
			await tracker._trackGenericEvent('clash', 'clashInfo', args, data);
		}
	}, 'trackClash', { category: 'battles' });

	tracker.registerHandler(['tournamentGetInfo', 'tournamentBattle', 'tournamentEnd'], async (callName, args, data) => {
		if (callName.includes('Battle') || callName.includes('End')) {
			await tracker.trackBattleResult(callName, args, data);
		} else {
			await tracker._trackGenericEvent('tournament', 'tournamentInfo', args, data);
		}
	}, 'trackTournament', { category: 'battles' });
}

/**
 * Register quest/reward/economy handlers.
 *
 * @param {import('../gameTracker.js').default} tracker GameTracker instance
 */
export function registerQuestRewardHandlers(tracker) {
	tracker.registerHandler('chestOpen', async (_call, args, data) => {
		await tracker.trackChestOpening(args, data);
	}, 'trackChestOpening', { category: 'chests' });

	tracker.registerHandler('shopBuy', async (_call, args, data) => {
		await tracker.trackShopPurchase(args, data);
	}, 'trackShopPurchase', { category: 'chests' });

	tracker.registerHandler('questComplete', async (_call, args, data) => {
		await tracker.trackQuestComplete(args, data);
	}, 'trackQuestComplete', { category: 'quests' });

	tracker.registerHandler('questGetAll', async (_call, _args, data) => {
		await tracker.trackQuestsData(data);
	}, 'trackQuestsData', { category: 'quests' });

	tracker.registerHandler('questFarm', async (_call, args, data) => {
		await tracker.trackDailyQuestFarm(args, data);
	}, 'trackDailyQuestFarm', { category: 'quests' });

	tracker.registerHandler('quest_questsFarm', async (_call, args, data) => {
		await tracker.trackBatchQuestFarm(args, data);
	}, 'trackBatchQuestFarm', { category: 'quests' });

	tracker.registerHandler('dailyBonusFarm', async (_call, args, data) => {
		await tracker.trackLoginReward(args, data);
	}, 'trackLoginReward', { category: 'quests' });

	tracker.registerHandler('dailyBonusGetInfo', async (_call, _args, data) => {
		await tracker.trackDailyBonusInfo(data);
	}, 'trackDailyBonusInfo', { category: 'quests' });

	tracker.registerHandler('artifactChestOpen', async (_call, args, data) => {
		await tracker.trackConsumableOpening(args, data, 'artifactChest');
	}, 'consumable:artifactChest', { category: 'chests' });

	tracker.registerHandler('titanArtifactChestOpen', async (_call, args, data) => {
		await tracker.trackConsumableOpening(args, data, 'titanArtifactChest');
	}, 'consumable:titanArtifactChest', { category: 'chests' });

	tracker.registerHandler('pet_chestOpen', async (_call, args, data) => {
		await tracker.trackConsumableOpening(args, data, 'petChest');
	}, 'consumable:petChest', { category: 'chests' });

	tracker.registerHandler('consumableUseLootBox', async (_call, args, data) => {
		await tracker.trackConsumableOpening(args, data, 'lootBox');
	}, 'consumable:lootBox', { category: 'chests' });

	tracker.registerHandler('towerOpenChest', async (_call, args, data) => {
		await tracker.trackConsumableOpening(args, data, 'towerChest');
	}, 'consumable:towerChest', { category: 'chests' });

	tracker.registerHandler('bossOpenChest', async (_call, args, data) => {
		await tracker.trackConsumableOpening(args, data, 'outlandChest');
	}, 'consumable:outlandChest', { category: 'chests' });

	tracker.registerHandler('offerBuy', async (_call, args, data) => {
		await tracker._trackGenericEvent('economy', 'offerBuy', args, data);
		if (data.reward) {
			const rewards = data.reward;
			if (rewards.gold) await tracker.trackResourceTransaction('gold', rewards.gold, 'offer', 'shop');
			if (rewards.starmoney) await tracker.trackResourceTransaction('emeralds', rewards.starmoney, 'offer', 'shop');
		}
	}, 'trackOfferBuy', { category: 'chests' });

	tracker.registerHandler(['campaignFarm', 'missionFarm'], async (_call, args, data) => {
		await tracker._trackGenericEvent('economy', 'campaignFarm', args, data);
		if (data.reward) {
			const rewards = data.reward;
			if (rewards.gold) await tracker.trackResourceTransaction('gold', rewards.gold, 'farm', 'campaign');
			if (rewards.starmoney) await tracker.trackResourceTransaction('emeralds', rewards.starmoney, 'farm', 'campaign');
		}
	}, 'trackCampaignFarm', { category: 'quests' });

	tracker.registerHandler(['eventGetInfo', 'eventGetAll'], async (_call, _args, data) => {
		await tracker._trackGenericEvent('event', 'eventInfo', {}, data);
	}, 'trackEventInfo', { category: 'quests' });

	tracker.registerHandler('eventFarm', async (_call, args, data) => {
		await tracker._trackGenericEvent('event', 'eventFarm', args, data);
		if (data.reward) {
			const rewards = data.reward;
			if (rewards.gold) await tracker.trackResourceTransaction('gold', rewards.gold, 'event', 'event');
			if (rewards.starmoney) await tracker.trackResourceTransaction('emeralds', rewards.starmoney, 'event', 'event');
		}
	}, 'trackEventFarm', { category: 'quests' });

	tracker.registerHandler(['seasonGetInfo', 'seasonGetAll'], async (_call, _args, data) => {
		await tracker._trackGenericEvent('event', 'seasonInfo', {}, data);
	}, 'trackSeasonInfo', { category: 'quests' });

	tracker.registerHandler('seasonFarm', async (_call, args, data) => {
		await tracker._trackGenericEvent('event', 'seasonFarm', args, data);
		if (data.reward) {
			const rewards = data.reward;
			if (rewards.gold) await tracker.trackResourceTransaction('gold', rewards.gold, 'season', 'season');
			if (rewards.starmoney) await tracker.trackResourceTransaction('emeralds', rewards.starmoney, 'season', 'season');
		}
	}, 'trackSeasonFarm', { category: 'quests' });

	tracker.registerHandler('skinChestOpen', async (_call, args, data) => {
		await tracker.trackConsumableOpening(args, data, 'skinChest');
	}, 'consumable:skinChest', { category: 'chests' });

	tracker.registerHandler('runeChestOpen', async (_call, args, data) => {
		await tracker.trackConsumableOpening(args, data, 'runeChest');
	}, 'consumable:runeChest', { category: 'chests' });

	tracker.registerHandler('gachaOpen', async (_call, args, data) => {
		await tracker.trackConsumableOpening(args, data, 'gacha');
	}, 'consumable:gacha', { category: 'chests' });

	tracker.registerHandler('seerFarm', async (_call, args, data) => {
		await tracker._trackGenericEvent('economy', 'seerFarm', args, data);
		if (data.reward) {
			const rewards = data.reward;
			if (rewards.gold) await tracker.trackResourceTransaction('gold', rewards.gold, 'seer', 'seer');
			if (rewards.starmoney) await tracker.trackResourceTransaction('emeralds', rewards.starmoney, 'seer', 'seer');
		}
	}, 'trackSeerFarm', { category: 'quests' });
}

/**
 * Register guild and social handlers.
 *
 * @param {import('../gameTracker.js').default} tracker GameTracker instance
 */
export function registerGuildAndSocialHandlers(tracker) {
	tracker.registerHandler('clanGetInfo', async (_call, _args, data) => {
		await tracker.trackGuildData(data);
		await tracker.trackGuildMembers(data);
	}, 'trackGuildData', { category: 'guild' });

	tracker.registerHandler(['clanWarGetInfo', 'clanWarUserGetInfo'], async (_call, _args, data) => {
		await tracker.trackGuildWarInfo(data);
		await tracker.trackGuildWarParticipation(data);
	}, 'trackGuildWarInfo', { category: 'guild' });

	tracker.registerHandler('clanWarGetBriefInfo', async (_call, _args, data) => {
		await tracker.storage.setMetadata('guildWarBrief', {
			triesRemaining: data.tries ?? 0,
			targets: data.targets ?? 0,
			arePointsMax: data.arePointsMax ?? false,
			hasActiveWar: data.hasActiveWar ?? false,
			nextWarTime: data.nextWarTime || 0,
			nearestWarEndTime: data.nearestWarEndTime || 0,
			lastUpdate: Date.now(),
		});
		console.log(`[OrganizedJihad] GW brief: ${data.tries ?? 0} tries remaining, active: ${data.hasActiveWar}`);
	}, 'trackGuildWarBrief', { category: 'guild' });

	tracker.registerHandler('crossClanWar_getInfo', async (_call, _args, data) => {
		const myTries = data.war?.myTries || {};
		await tracker.storage.setMetadata('cowData', {
			heroAttacksRemaining: myTries.heroes ?? 0,
			titanAttacksRemaining: myTries.titans ?? 0,
			heroAttacksMax: 3,
			titanAttacksMax: 2,
			usedHeroes: myTries.usedHeroes || [],
			usedTitans: myTries.usedTitans || [],
			ourPoints: data.war?.points || '0',
			enemyPoints: data.war?.enemyPoints || '0',
			enemyClan: data.war?.enemyClan?.title || null,
			isActive: !!data.war,
			rating: data.rating || '0',
			division: data.division || 0,
			league: data.league || 0,
			lastUpdate: Date.now(),
		});
		console.log(`[OrganizedJihad] CoW: heroes ${3 - (myTries.heroes ?? 3)}/3, titans ${2 - (myTries.titans ?? 2)}/2`);
	}, 'trackCowData', { category: 'guild' });

	tracker.registerHandler('clanRaid_getInfo', async (_call, _args, data) => {
		await tracker.trackRaidBossInfo(data);
		await tracker.trackGuildRaidParticipation(data);
	}, 'trackRaidBossInfo', { category: 'guild' });

	tracker.registerHandler(['dungeonGetState', 'titanDungeonGetInfo'], async (_call, _args, data) => {
		await tracker.trackGuildDungeonParticipation(data);
	}, 'trackGuildDungeon', { category: 'guild' });

	tracker.registerHandler(['friendSendGift', 'friendGetGift', 'friendSendHearts', 'friendGetHearts'], async (_call, args, data) => {
		await tracker._trackGenericEvent('social', 'friendGift', args, data);
		if (data.reward?.starmoney) {
			await tracker.trackResourceTransaction('emeralds', data.reward.starmoney, 'gift', 'friend');
		}
	}, 'trackFriendGift', { category: 'player' });
}

/**
 * Register roster and upgrade handlers.
 *
 * @param {import('../gameTracker.js').default} tracker GameTracker instance
 */
export function registerUpgradeHandlers(tracker) {
	tracker.registerHandler('titanGetAll', async (_call, _args, data) => {
		await tracker.trackTitansData(data);
	}, 'trackTitansData', { category: 'player' });

	tracker.registerHandler('pet_getAll', async (_call, _args, data) => {
		await tracker.trackPetsData(data);
	}, 'trackPetsData', { category: 'player' });

	tracker.registerHandler('heroUpgradeSkill', async (_call, args, data) => {
		await tracker.upgradeTracker.trackHeroSkillUpgrade(args, data, await tracker._getPlayerId());
	}, 'heroSkillUpgrade', { category: 'upgrades' });

	tracker.registerHandler('heroArtifactLevelUp', async (_call, args, data) => {
		await tracker.upgradeTracker.trackHeroArtifactUpgrade(args, data, await tracker._getPlayerId());
		if (args.items) {
			for (const [itemId, qty] of Object.entries(args.items)) {
				await tracker.trackInventoryItemUsage(
					{ ...args, itemId, amount: qty },
					data, 'artifact_resource', 'hero_artifact'
				);
			}
		} else {
			await tracker.trackInventoryItemUsage(
				{ ...args, itemId: `artifact_slot_${args.slotId || 0}`, amount: 1 },
				data, 'artifact_resource', 'hero_artifact'
			);
		}
	}, 'heroArtifactUpgrade', { category: 'upgrades' });

	tracker.registerHandler('heroSkinUpgrade', async (_call, args, data) => {
		await tracker.upgradeTracker.trackHeroSkinUpgrade(args, data, await tracker._getPlayerId());
		await tracker.trackInventoryItemUsage(
			{ ...args, itemId: args.skinId, amount: 1 },
			data, 'skin_stone', 'hero_skin'
		);
	}, 'heroSkinUpgrade', { category: 'upgrades' });

	tracker.registerHandler('heroEnchantRune', async (_call, args, data) => {
		await tracker.upgradeTracker.trackHeroGlyphUpgrade(args, data, await tracker._getPlayerId());
		const consumables = args.items?.consumable || {};
		for (const [itemId, qty] of Object.entries(consumables)) {
			await tracker.trackInventoryItemUsage(
				{ ...args, itemId, amount: qty },
				data, 'glyph_essence', 'hero_glyph'
			);
		}
	}, 'heroGlyphUpgrade', { category: 'upgrades' });

	tracker.registerHandler('consumableUseHeroXp', async (_call, args, data) => {
		await tracker.upgradeTracker.trackHeroLevelUpgrade(args, data, await tracker._getPlayerId());
		await tracker.trackInventoryItemUsage(args, data, 'potion', 'hero_level');
	}, 'heroLevelUpgrade', { category: 'upgrades' });

	tracker.registerHandler('heroLevelUp', async (_call, args, data) => {
		await tracker.upgradeTracker.trackHeroGoldLevelUpgrade(args, data, await tracker._getPlayerId());
	}, 'heroGoldLevelUpgrade', { category: 'upgrades' });

	tracker.registerHandler(['heroEvolve', 'heroPromote'], async (_call, args, data) => {
		await tracker.upgradeTracker.trackHeroStarUpgrade(args, data, await tracker._getPlayerId());
	}, 'heroStarUpgrade', { category: 'upgrades' });

	tracker.registerHandler('heroColorEvolve', async (_call, args, data) => {
		await tracker.upgradeTracker.trackHeroColorUpgrade(args, data, await tracker._getPlayerId());
	}, 'heroColorUpgrade', { category: 'upgrades' });

	tracker.registerHandler('heroEquip', async (_call, args, data) => {
		await tracker.upgradeTracker.trackEquipmentChange(args, data, await tracker._getPlayerId(), 'equipped');
	}, 'heroEquip', { category: 'upgrades' });

	tracker.registerHandler('heroAscension', async (_call, args, data) => {
		const materials = args.items || {};
		if (Object.keys(materials).length > 0) {
			for (const [itemId, qty] of Object.entries(materials)) {
				await tracker.trackInventoryItemUsage(
					{ ...args, itemId, amount: qty },
					data, 'ascension_material', 'hero_ascension'
				);
			}
		} else {
			await tracker.trackInventoryItemUsage(args, data, 'ascension_material', 'hero_ascension');
		}
	}, 'heroAscension', { category: 'upgrades' });

	tracker.registerHandler('titanArtifactLevelUp', async (_call, args, data) => {
		await tracker.upgradeTracker.trackTitanArtifactUpgrade(args, data, await tracker._getPlayerId());
	}, 'titanArtifactUpgrade', { category: 'upgrades' });

	tracker.registerHandler('titanUsePotions', async (_call, args, data) => {
		await tracker.upgradeTracker.trackTitanLevelUpgrade(args, data, await tracker._getPlayerId());
		await tracker.trackInventoryItemUsage(args, data, 'potion', 'titan_level');
	}, 'titanLevelUpgrade', { category: 'upgrades' });

	tracker.registerHandler(['titanEvolve', 'titanStarUp'], async (_call, args, data) => {
		await tracker.upgradeTracker.trackTitanStarUpgrade(args, data, await tracker._getPlayerId());
	}, 'titanStarUpgrade', { category: 'upgrades' });

	tracker.registerHandler('titanUpgradeSkill', async (_call, args, data) => {
		await tracker.upgradeTracker.trackTitanSkillUpgrade(args, data, await tracker._getPlayerId());
	}, 'titanSkillUpgrade', { category: 'upgrades' });

	tracker.registerHandler('titanSkinUpgrade', async (_call, args, data) => {
		await tracker.upgradeTracker.trackTitanSkinUpgrade(args, data, await tracker._getPlayerId());
	}, 'titanSkinUpgrade', { category: 'upgrades' });

	tracker.registerHandler('pet_levelUp', async (_call, args, data) => {
		await tracker._trackGenericUpgrade('pet', 'levelUp', args, data);
	}, 'petLevelUp', { category: 'upgrades' });

	tracker.registerHandler('pet_evolve', async (_call, args, data) => {
		await tracker._trackGenericUpgrade('pet', 'evolve', args, data);
	}, 'petEvolve', { category: 'upgrades' });

	tracker.registerHandler('titanEnchantRune', async (_call, args, data) => {
		await tracker.upgradeTracker.trackTitanGlyphUpgrade?.(args, data, await tracker._getPlayerId());
		await tracker._trackGenericUpgrade('titan', 'glyphUpgrade', args, data);
	}, 'titanGlyphUpgrade', { category: 'upgrades' });

	tracker.registerHandler('titanSpiritUpgrade', async (_call, args, data) => {
		await tracker._trackGenericUpgrade('titan', 'spiritUpgrade', args, data);
	}, 'titanSpiritUpgrade', { category: 'upgrades' });

	tracker.registerHandler('heroAbsoluteStarMission', async (_call, args, data) => {
		await tracker._trackGenericEvent('hero', 'absoluteStarMission', args, data);
	}, 'trackAbsoluteStarMission', { category: 'upgrades' });

	tracker.registerHandler('heroGiftOfElements', async (_call, args, data) => {
		await tracker._trackGenericUpgrade('hero', 'giftOfElements', args, data);
	}, 'trackGiftOfElements', { category: 'upgrades' });
}
