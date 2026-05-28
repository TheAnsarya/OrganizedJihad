import {
	registerChatHandlers,
	registerCorePlayerHandlers,
	registerMailHandlers,
} from '../src/modules/trackers/GameTrackerCoreRegistry.js';
import {
	registerBattleHandlers,
	registerGuildAndSocialHandlers,
	registerQuestRewardHandlers,
	registerUpgradeHandlers,
} from '../src/modules/trackers/GameTrackerGameplayRegistry.js';
import { registerPhase11MetadataHandlers } from '../src/modules/trackers/GameTrackerPhase11Registry.js';
import {
	registerPhase12Handlers,
	registerPhase13Handlers,
	SYSTEM_NOOP_REGISTRATIONS,
} from '../src/modules/trackers/GameTrackerExtendedRegistry.js';
import { trackGenericEvent, trackGenericUpgrade } from '../src/modules/trackers/GameTrackerGenericTrackingHelpers.js';

function createRegistrationHarness() {
	const registrations = [];
	const tracker = {
		registerHandler: (methods, handler, label, options = {}) => {
			const methodList = Array.isArray(methods) ? methods : [methods];
			for (const method of methodList) {
				registrations.push({ method, handler, label, options });
			}
		},
	};

	return {
		tracker,
		registrations,
		methods: () => new Set(registrations.map((r) => r.method)),
	};
}

function expectMethodsPresent(methodSet, expectedMethods) {
	for (const method of expectedMethods) {
		expect(methodSet.has(method)).toBe(true);
	}
}

describe('Tracker Registry Modules', () => {
	describe('Core Registry', () => {
		test('registers core player methods', () => {
			const h = createRegistrationHarness();
			registerCorePlayerHandlers(h.tracker);
			expectMethodsPresent(h.methods(), ['userGetInfo', 'heroGetAll', 'inventoryGet']);
		});

		test('registers chat methods', () => {
			const h = createRegistrationHarness();
			registerChatHandlers(h.tracker);
			expectMethodsPresent(h.methods(), ['chatGetDialog', 'chatGetNewMessages', 'chatSendMessage']);
		});

		test('registers mail methods', () => {
			const h = createRegistrationHarness();
			registerMailHandlers(h.tracker);
			expectMethodsPresent(h.methods(), ['mailGetAll', 'mailFarm', 'mailCollect']);
		});
	});

	describe('Gameplay Registry', () => {
		test('registerBattleHandlers includes critical battle methods', () => {
			const h = createRegistrationHarness();
			registerBattleHandlers(h.tracker);
			expectMethodsPresent(h.methods(), [
				'missionEnd', 'towerEnd', 'bossEnd',
				'arenaAttack', 'arenaEnd', 'arenaGetReplay',
				'titanArenaAttack', 'grandArenaAttack',
				'clanWarAttack', 'bossRaidAttack',
				'expeditionBattle', 'battleGetReplay',
				'clashGetInfo', 'tournamentGetInfo',
			]);
		});

		test('registerQuestRewardHandlers includes quest/chest/economy methods', () => {
			const h = createRegistrationHarness();
			registerQuestRewardHandlers(h.tracker);
			expectMethodsPresent(h.methods(), [
				'chestOpen', 'shopBuy', 'questComplete', 'questGetAll',
				'questFarm', 'quest_questsFarm', 'dailyBonusFarm', 'dailyBonusGetInfo',
				'artifactChestOpen', 'titanArtifactChestOpen', 'pet_chestOpen',
				'eventGetInfo', 'eventFarm', 'seasonGetInfo', 'seasonFarm',
				'skinChestOpen', 'runeChestOpen', 'gachaOpen', 'seerFarm',
			]);
		});

		test('registerGuildAndSocialHandlers includes guild and social methods', () => {
			const h = createRegistrationHarness();
			registerGuildAndSocialHandlers(h.tracker);
			expectMethodsPresent(h.methods(), [
				'clanGetInfo', 'clanWarGetInfo', 'clanWarUserGetInfo',
				'clanWarGetBriefInfo', 'crossClanWar_getInfo', 'clanRaid_getInfo',
				'dungeonGetState', 'titanDungeonGetInfo',
				'friendSendGift', 'friendGetGift', 'friendSendHearts', 'friendGetHearts',
			]);
		});

		test('registerUpgradeHandlers includes roster and upgrade methods', () => {
			const h = createRegistrationHarness();
			registerUpgradeHandlers(h.tracker);
			expectMethodsPresent(h.methods(), [
				'titanGetAll', 'pet_getAll',
				'heroUpgradeSkill', 'heroArtifactLevelUp', 'heroSkinUpgrade',
				'heroEnchantRune', 'consumableUseHeroXp', 'heroLevelUp',
				'heroEvolve', 'heroPromote', 'heroColorEvolve', 'heroEquip', 'heroAscension',
				'titanArtifactLevelUp', 'titanUsePotions', 'titanEvolve', 'titanStarUp',
				'titanUpgradeSkill', 'titanSkinUpgrade',
				'pet_levelUp', 'pet_evolve',
				'titanEnchantRune', 'titanSpiritUpgrade',
				'heroAbsoluteStarMission', 'heroGiftOfElements',
			]);
		});
	});

	describe('Phase Registry Coverage', () => {
		test('registerPhase11MetadataHandlers includes key metadata methods', () => {
			const h = createRegistrationHarness();
			registerPhase11MetadataHandlers(h.tracker);
			expectMethodsPresent(h.methods(), [
				'arenaGetAll', 'missionGetAll', 'titanArenaGetStatus',
				'battlePass_getInfo', 'crossClanWar_getBriefInfo', 'clanGetActivityStat',
				'gacha_getInfo', 'teamGetAll', 'shopGetAll',
				'chatGetAll', 'chatGetTalks', 'roleAscension_getAll', 'titanSpirit_getAll',
			]);
		});

		test('registerPhase12Handlers includes long-tail guild/economy/social methods', () => {
			const h = createRegistrationHarness();
			registerPhase12Handlers(h.tracker);
			expectMethodsPresent(h.methods(), [
				'clanGetWeeklyStat', 'clanGetLog',
				'clanWarGetDefence', 'clanWarGetWarlordInfo', 'clanWarGetLeagueInfo',
				'topGet', 'questGetEvents', 'specialOffer_getAll',
				'crossClanWar_getAttackMap', 'crossClanWar_getDefencePlan', 'crossClanWar_getSettings',
				'towerGetState', 'teamGetFavor', 'team_getBanners',
				'shopGet', 'billingGetAll', 'billingGetLast',
				'clanGetAvailableDailyGifts', 'clanInvites_getUserInbox', 'clanGetActivityRewardTable',
			]);
		});

		test('registerPhase13Handlers includes long-tail event/pve/cosmetic/system methods', () => {
			const h = createRegistrationHarness();
			registerPhase13Handlers(h.tracker);
			expectMethodsPresent(h.methods(), [
				'bossGetAll', 'towerGetInfo', 'expeditionGet', 'invasion_getInfo',
				'workshopBuff_getInfo', 'battlePass_getSpecial', 'battlePass_farmReward',
				'pet_getChest', 'adventure_getActiveData', 'adventure_getPassed', 'adventure_find',
				'chatsGetAll', 'userGetAvailableAvatarFrames', 'userGetAvailableAvatars', 'userGetAvailableStickers',
				'telegramQuestGetInfo', 'rewardedVideo_boxyGetInfo', 'saleShowcase_rewardInfo',
				'getTime', 'registration', 'tutorialGetInfo', 'splitGetAll', 'stashClient',
				'freebieHaveGroup', 'mechanicAvailability', 'mechanicsBan_getInfo',
				'playable_getAvailable', 'userMergeGetStatus',
			]);
		});

		test('phase 12 and phase 13 overlaps are only known intentional methods', () => {
			const p12 = createRegistrationHarness();
			registerPhase12Handlers(p12.tracker);
			const p13 = createRegistrationHarness();
			registerPhase13Handlers(p13.tracker);

			const p12Methods = p12.methods();
			const p13Methods = p13.methods();
			const overlap = [...p12Methods].filter((m) => p13Methods.has(m));
			const knownIntentionalOverlap = new Set([
				'adventureSolo_getActiveData',
			]);
			const unexpected = overlap.filter((m) => !knownIntentionalOverlap.has(m));

			expect(unexpected).toEqual([]);
		});

		test('phase 11 and phase 12 overlaps are only known intentional methods', () => {
			const p11 = createRegistrationHarness();
			registerPhase11MetadataHandlers(p11.tracker);
			const p12 = createRegistrationHarness();
			registerPhase12Handlers(p12.tracker);

			const p11Methods = p11.methods();
			const p12Methods = p12.methods();
			const overlap = [...p11Methods].filter((m) => p12Methods.has(m));
			const knownIntentionalOverlap = new Set([
				'dailyBonusGetInfo',
			]);
			const unexpected = overlap.filter((m) => !knownIntentionalOverlap.has(m));

			expect(unexpected).toEqual([]);
		});

		test('phase13 system no-op method set matches descriptor list', () => {
			const h = createRegistrationHarness();
			registerPhase13Handlers(h.tracker);

			const noOpMethods = new Set(SYSTEM_NOOP_REGISTRATIONS.map((r) => r.method));
			const registeredNoOps = h.registrations.filter((r) => noOpMethods.has(r.method));
			const registeredMethods = registeredNoOps.map((r) => r.method).sort();
			const expectedMethods = [...noOpMethods].sort();

			expect(registeredMethods).toEqual(expectedMethods);
			expect(SYSTEM_NOOP_REGISTRATIONS).toHaveLength(10);
		});

		test('phase13 system no-op registrations preserve labels and category', () => {
			const h = createRegistrationHarness();
			registerPhase13Handlers(h.tracker);

			for (const descriptor of SYSTEM_NOOP_REGISTRATIONS) {
				const registration = h.registrations.find((r) => r.method === descriptor.method);
				expect(registration).toBeDefined();
				expect(registration.label).toBe(descriptor.label);
				expect(registration.options.category).toBe('system');
			}
		});
	});
});

describe('GameTrackerGenericTrackingHelpers', () => {
	test('trackGenericUpgrade logs standardized upgrade payload', async () => {
		const tracker = {
			_logActivity: jest.fn().mockResolvedValue(undefined),
		};

		await trackGenericUpgrade(tracker, 'hero', 'levelUp', { heroId: 15 }, {});

		expect(tracker._logActivity).toHaveBeenCalledWith(
			'upgrade',
			'hero levelUp #15',
			{
				entityType: 'hero',
				upgradeType: 'levelUp',
				entityId: 15,
			}
		);
	});

	test('trackGenericEvent logs category, type, and reward flag', async () => {
		const tracker = {
			_logActivity: jest.fn().mockResolvedValue(undefined),
		};

		await trackGenericEvent(tracker, 'economy', 'offerBuy', {}, { reward: { gold: 10 } });

		expect(tracker._logActivity).toHaveBeenCalledWith(
			'economy',
			'offerBuy',
			{
				category: 'economy',
				eventType: 'offerBuy',
				hasReward: true,
			}
		);
	});
});
