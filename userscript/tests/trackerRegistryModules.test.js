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
import {
	createRegistrationHarness,
	expectMethodsPresent,
	expectNoDuplicateMethods,
	expectRegistrationMetadataIntegrity,
} from './support/trackerRegistryTestHarness.js';
import {
	CORE_CONTRACT_METHODS,
	GAMEPLAY_CONTRACT_METHODS,
	INTENTIONAL_OVERLAPS,
	PHASE_CONTRACT_METHODS,
} from './support/registryContracts.js';

describe('Tracker Registry Modules', () => {
	describe('Core Registry', () => {
		test('registers core player methods', () => {
			const h = createRegistrationHarness();
			registerCorePlayerHandlers(h.tracker);
			expectMethodsPresent(h.methods(), CORE_CONTRACT_METHODS.player);
			expectNoDuplicateMethods(h.registrations);
			expectRegistrationMetadataIntegrity(h.registrations);
		});

		test('registers chat methods', () => {
			const h = createRegistrationHarness();
			registerChatHandlers(h.tracker);
			expectMethodsPresent(h.methods(), CORE_CONTRACT_METHODS.chat);
			expectNoDuplicateMethods(h.registrations);
			expectRegistrationMetadataIntegrity(h.registrations);
		});

		test('registers mail methods', () => {
			const h = createRegistrationHarness();
			registerMailHandlers(h.tracker);
			expectMethodsPresent(h.methods(), CORE_CONTRACT_METHODS.mail);
			expectNoDuplicateMethods(h.registrations);
			expectRegistrationMetadataIntegrity(h.registrations);
		});
	});

	describe('Gameplay Registry', () => {
		test('registerBattleHandlers includes critical battle methods', () => {
			const h = createRegistrationHarness();
			registerBattleHandlers(h.tracker);
			expectMethodsPresent(h.methods(), GAMEPLAY_CONTRACT_METHODS.battle);
			expectNoDuplicateMethods(h.registrations);
			expectRegistrationMetadataIntegrity(h.registrations);
		});

		test('registerQuestRewardHandlers includes quest/chest/economy methods', () => {
			const h = createRegistrationHarness();
			registerQuestRewardHandlers(h.tracker);
			expectMethodsPresent(h.methods(), GAMEPLAY_CONTRACT_METHODS.questReward);
			expectNoDuplicateMethods(h.registrations);
			expectRegistrationMetadataIntegrity(h.registrations);
		});

		test('registerGuildAndSocialHandlers includes guild and social methods', () => {
			const h = createRegistrationHarness();
			registerGuildAndSocialHandlers(h.tracker);
			expectMethodsPresent(h.methods(), GAMEPLAY_CONTRACT_METHODS.guildSocial);
			expectNoDuplicateMethods(h.registrations);
			expectRegistrationMetadataIntegrity(h.registrations);
		});

		test('registerUpgradeHandlers includes roster and upgrade methods', () => {
			const h = createRegistrationHarness();
			registerUpgradeHandlers(h.tracker);
			expectMethodsPresent(h.methods(), GAMEPLAY_CONTRACT_METHODS.upgrades);
			expectNoDuplicateMethods(h.registrations);
			expectRegistrationMetadataIntegrity(h.registrations);
		});
	});

	describe('Phase Registry Coverage', () => {
		test('registerPhase11MetadataHandlers includes key metadata methods', () => {
			const h = createRegistrationHarness();
			registerPhase11MetadataHandlers(h.tracker);
			expectMethodsPresent(h.methods(), PHASE_CONTRACT_METHODS.phase11);
			expectNoDuplicateMethods(h.registrations);
			expectRegistrationMetadataIntegrity(h.registrations);
		});

		test('registerPhase12Handlers includes long-tail guild/economy/social methods', () => {
			const h = createRegistrationHarness();
			registerPhase12Handlers(h.tracker);
			expectMethodsPresent(h.methods(), PHASE_CONTRACT_METHODS.phase12);
			expectNoDuplicateMethods(h.registrations);
			expectRegistrationMetadataIntegrity(h.registrations);
		});

		test('registerPhase13Handlers includes long-tail event/pve/cosmetic/system methods', () => {
			const h = createRegistrationHarness();
			registerPhase13Handlers(h.tracker);
			expectMethodsPresent(h.methods(), PHASE_CONTRACT_METHODS.phase13);
			expectNoDuplicateMethods(h.registrations);
			expectRegistrationMetadataIntegrity(h.registrations);
		});

		test('phase 12 and phase 13 overlaps are only known intentional methods', () => {
			const p12 = createRegistrationHarness();
			registerPhase12Handlers(p12.tracker);
			const p13 = createRegistrationHarness();
			registerPhase13Handlers(p13.tracker);

			const p12Methods = p12.methods();
			const p13Methods = p13.methods();
			const overlap = [...p12Methods].filter((m) => p13Methods.has(m));
			const knownIntentionalOverlap = new Set(INTENTIONAL_OVERLAPS.phase12ToPhase13);
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
			const knownIntentionalOverlap = new Set(INTENTIONAL_OVERLAPS.phase11ToPhase12);
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
			expect(new Set(SYSTEM_NOOP_REGISTRATIONS.map((r) => r.label)).size).toBe(SYSTEM_NOOP_REGISTRATIONS.length);
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
