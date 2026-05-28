export const CORE_CONTRACT_METHODS = {
	player: ['userGetInfo', 'heroGetAll', 'inventoryGet'],
	chat: ['chatGetDialog', 'chatGetNewMessages', 'chatSendMessage'],
	mail: ['mailGetAll', 'mailFarm', 'mailCollect'],
};

export const GAMEPLAY_CONTRACT_METHODS = {
	battle: [
		'missionEnd', 'towerEnd', 'bossEnd',
		'arenaAttack', 'arenaEnd', 'arenaGetReplay',
		'titanArenaAttack', 'grandArenaAttack',
		'clanWarAttack', 'bossRaidAttack',
		'expeditionBattle', 'battleGetReplay',
		'clashGetInfo', 'tournamentGetInfo',
	],
	questReward: [
		'chestOpen', 'shopBuy', 'questComplete', 'questGetAll',
		'questFarm', 'quest_questsFarm', 'dailyBonusFarm', 'dailyBonusGetInfo',
		'artifactChestOpen', 'titanArtifactChestOpen', 'pet_chestOpen',
		'eventGetInfo', 'eventFarm', 'seasonGetInfo', 'seasonFarm',
		'skinChestOpen', 'runeChestOpen', 'gachaOpen', 'seerFarm',
	],
	guildSocial: [
		'clanGetInfo', 'clanWarGetInfo', 'clanWarUserGetInfo',
		'clanWarGetBriefInfo', 'crossClanWar_getInfo', 'clanRaid_getInfo',
		'dungeonGetState', 'titanDungeonGetInfo',
		'friendSendGift', 'friendGetGift', 'friendSendHearts', 'friendGetHearts',
	],
	upgrades: [
		'titanGetAll', 'pet_getAll',
		'heroUpgradeSkill', 'heroArtifactLevelUp', 'heroSkinUpgrade',
		'heroEnchantRune', 'consumableUseHeroXp', 'heroLevelUp',
		'heroEvolve', 'heroPromote', 'heroColorEvolve', 'heroEquip', 'heroAscension',
		'titanArtifactLevelUp', 'titanUsePotions', 'titanEvolve', 'titanStarUp',
		'titanUpgradeSkill', 'titanSkinUpgrade',
		'pet_levelUp', 'pet_evolve',
		'titanEnchantRune', 'titanSpiritUpgrade',
		'heroAbsoluteStarMission', 'heroGiftOfElements',
	],
};

export const PHASE_CONTRACT_METHODS = {
	phase11: [
		'arenaGetAll', 'missionGetAll', 'titanArenaGetStatus',
		'battlePass_getInfo', 'crossClanWar_getBriefInfo', 'clanGetActivityStat',
		'gacha_getInfo', 'teamGetAll', 'shopGetAll',
		'chatGetAll', 'chatGetTalks', 'roleAscension_getAll', 'titanSpirit_getAll',
	],
	phase12: [
		'clanGetWeeklyStat', 'clanGetLog',
		'clanWarGetDefence', 'clanWarGetWarlordInfo', 'clanWarGetLeagueInfo',
		'topGet', 'questGetEvents', 'specialOffer_getAll',
		'crossClanWar_getAttackMap', 'crossClanWar_getDefencePlan', 'crossClanWar_getSettings',
		'towerGetState', 'teamGetFavor', 'team_getBanners',
		'shopGet', 'billingGetAll', 'billingGetLast',
		'clanGetAvailableDailyGifts', 'clanInvites_getUserInbox', 'clanGetActivityRewardTable',
	],
	phase13: [
		'bossGetAll', 'towerGetInfo', 'expeditionGet', 'invasion_getInfo',
		'workshopBuff_getInfo', 'battlePass_getSpecial', 'battlePass_farmReward',
		'pet_getChest', 'adventure_getActiveData', 'adventure_getPassed', 'adventure_find',
		'chatsGetAll', 'userGetAvailableAvatarFrames', 'userGetAvailableAvatars', 'userGetAvailableStickers',
		'telegramQuestGetInfo', 'rewardedVideo_boxyGetInfo', 'saleShowcase_rewardInfo',
		'getTime', 'registration', 'tutorialGetInfo', 'splitGetAll', 'stashClient',
		'freebieHaveGroup', 'mechanicAvailability', 'mechanicsBan_getInfo',
		'playable_getAvailable', 'userMergeGetStatus',
	],
};

export const INTENTIONAL_OVERLAPS = {
	phase12ToPhase13: ['adventureSolo_getActiveData'],
	phase11ToPhase12: ['dailyBonusGetInfo'],
};
