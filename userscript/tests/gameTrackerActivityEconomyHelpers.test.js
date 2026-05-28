import {
	trackBatchQuestFarmHelper,
	trackDailyBonusInfoHelper,
	trackDailyQuestFarmHelper,
	trackGuildActivityHelper,
	trackInventoryItemUsageHelper,
	trackLoginRewardHelper,
	trackQuestsDataHelper,
	trackResourceTransactionHelper,
} from '../src/modules/trackers/GameTrackerActivityEconomyHelpers.js';

describe('GameTrackerActivityEconomyHelpers', () => {
	let tracker;
	let storage;

	beforeEach(() => {
		storage = {
			add: jest.fn(async () => {}),
			setMetadata: jest.fn(async () => {}),
			getMetadata: jest.fn(async (key) => {
				if (key === 'currentPlayerId') {
					return 'p1';
				}
				if (key === 'currentGuildId') {
					return 123;
				}
				return null;
			}),
		};
		tracker = {
			storage,
			_getPlayerId: jest.fn(async () => 'p1'),
		};
	});

	test('trackResourceTransactionHelper writes resourceTransactions record', async () => {
		await trackResourceTransactionHelper(tracker, 'gold', 100, 'battle', 'arena');
		expect(storage.add).toHaveBeenCalledWith('resourceTransactions', expect.objectContaining({
			resourceType: 'gold',
			amount: 100,
			source: 'battle',
			playerId: 'p1',
		}));
	});

	test('trackGuildActivityHelper writes guildActivities record', async () => {
		await trackGuildActivityHelper(tracker, 'join', { guildId: 'g1', guildName: 'Guild 1' });
		expect(storage.add).toHaveBeenCalledWith('guildActivities', expect.objectContaining({
			activityType: 'join',
			guildId: 'g1',
			guildName: 'Guild 1',
		}));
	});

	test('trackQuestsDataHelper writes quest summary and quests data metadata', async () => {
		await trackQuestsDataHelper(tracker, [{ id: 10001, state: 2, progress: 1 }, { id: 20000001, state: 1 }]);
		expect(storage.setMetadata).toHaveBeenCalledWith('questSummary', expect.objectContaining({
			dailyTotal: 1,
			guildTotal: 1,
		}));
		expect(storage.setMetadata).toHaveBeenCalledWith('questsData', expect.any(Array));
	});

	test('trackDailyQuestFarmHelper routes daily and guild quests to separate stores', async () => {
		await trackDailyQuestFarmHelper(tracker, { questId: 10005 }, { reward: { activityPoints: 10 } });
		await trackDailyQuestFarmHelper(tracker, { questId: 20000042 }, { reward: { guildActivityPoints: 50 } });
		expect(storage.add).toHaveBeenCalledWith('dailyQuestCompletions', expect.objectContaining({ questId: '10005' }));
		expect(storage.add).toHaveBeenCalledWith('guildQuestCompletions', expect.objectContaining({ questId: '20000042' }));
	});

	test('trackBatchQuestFarmHelper expands batch into quest farm events', async () => {
		await trackBatchQuestFarmHelper(tracker, { questIds: [10001, 10002] }, { reward: {} });
		const dailyCalls = storage.add.mock.calls.filter((call) => call[0] === 'dailyQuestCompletions');
		expect(dailyCalls).toHaveLength(2);
	});

	test('trackLoginRewardHelper and trackDailyBonusInfoHelper write login/daily bonus data', async () => {
		await trackLoginRewardHelper(tracker, { vip: true }, { day: 7, loginCount: 9, reward: { gold: 1 } });
		await trackDailyBonusInfoHelper(tracker, { day: 7, loginCount: 9 });
		expect(storage.add).toHaveBeenCalledWith('loginRewards', expect.objectContaining({
			dayNumber: 7,
			isVipBonus: true,
		}));
		expect(storage.setMetadata).toHaveBeenCalledWith('dailyBonusDay', 7);
		expect(storage.setMetadata).toHaveBeenCalledWith('dailyBonusStreak', 9);
	});

	test('trackInventoryItemUsageHelper writes inventory usage with target entity', async () => {
		await trackInventoryItemUsageHelper(tracker, { libId: 81, amount: 2, heroId: 1 }, {}, 'potion', 'hero_level');
		expect(storage.add).toHaveBeenCalledWith('inventoryItemUsages', expect.objectContaining({
			itemId: '81',
			quantityUsed: 2,
			category: 'potion',
			usageContext: 'hero_level',
			targetEntity: expect.any(String),
		}));
	});
});
