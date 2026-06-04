import { trackGuildActivityHelper, trackResourceTransactionHelper } from '../src/modules/trackers/GameTrackerEconomyTrackingHelpers.js';
import {
	trackBatchQuestFarmHelper,
	trackDailyBonusInfoHelper,
	trackDailyQuestFarmHelper,
	trackLoginRewardHelper,
	trackQuestsDataHelper,
} from '../src/modules/trackers/GameTrackerQuestTrackingHelpers.js';
import { trackInventoryItemUsageHelper } from '../src/modules/trackers/GameTrackerInventoryTrackingHelpers.js';
import * as compatibility from '../src/modules/trackers/GameTrackerActivityEconomyHelpers.js';

describe('GameTracker Activity Domain Modules', () => {
	let tracker;
	let storage;

	beforeEach(() => {
		storage = {
			add: jest.fn(async () => {}),
			setMetadata: jest.fn(async () => {}),
			getMetadata: jest.fn(async (key) => {
				if (key === 'currentPlayerId') {
					return 'player-x';
				}
				if (key === 'currentGuildId') {
					return 42;
				}
				return null;
			}),
		};
		tracker = {
			storage,
			_getPlayerId: jest.fn(async () => 'player-x'),
		};
	});

	test('compatibility module re-exports expected helper functions', () => {
		expect(typeof compatibility.trackResourceTransactionHelper).toBe('function');
		expect(typeof compatibility.trackQuestsDataHelper).toBe('function');
		expect(typeof compatibility.trackInventoryItemUsageHelper).toBe('function');
	});

	test('economy helpers write expected stores', async () => {
		await trackResourceTransactionHelper(tracker, 'gold', 5, 'quest', 'q1');
		await trackGuildActivityHelper(tracker, 'join', { guildId: 'g-1', guildName: 'Guild One' });
		expect(storage.add).toHaveBeenCalledWith('resourceTransactions', expect.objectContaining({ resourceType: 'gold' }));
		expect(storage.add).toHaveBeenCalledWith('guildActivities', expect.objectContaining({ activityType: 'join' }));
	});

	test('quest helpers write summary/rows and batch delegation', async () => {
		await trackQuestsDataHelper(tracker, [{ id: 10001, state: 2 }, { id: 20000001, state: 1 }]);
		await trackDailyQuestFarmHelper(tracker, { questId: 10007 }, { reward: { activityPoints: 1 } });
		await trackBatchQuestFarmHelper(tracker, { questIds: [10008, 10009] }, { reward: {} });
		await trackLoginRewardHelper(tracker, { vip: false }, { day: 2, loginCount: 4 });
		await trackDailyBonusInfoHelper(tracker, { day: 2, loginCount: 4 });

		expect(storage.setMetadata).toHaveBeenCalledWith('questSummary', expect.any(Object));
		expect(storage.add).toHaveBeenCalledWith('dailyQuestCompletions', expect.any(Object));
		expect(storage.add).toHaveBeenCalledWith('loginRewards', expect.any(Object));
		expect(storage.setMetadata).toHaveBeenCalledWith('dailyBonusDay', 2);
	});

	test('inventory helper writes inventory usage store', async () => {
		await trackInventoryItemUsageHelper(tracker, { libId: 99, amount: 3, heroId: 1 }, {}, 'potion', 'hero_level');
		expect(storage.add).toHaveBeenCalledWith('inventoryItemUsages', expect.objectContaining({ itemId: '99', quantityUsed: 3 }));
	});
});
