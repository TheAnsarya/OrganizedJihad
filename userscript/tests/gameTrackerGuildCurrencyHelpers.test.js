import {
	buildTitaniteTransactionRecord,
	getStoredGuildIdHelper,
	trackTitaniteTransactionHelper,
} from '../src/modules/trackers/GameTrackerGuildCurrencyHelpers.js';

describe('GameTrackerGuildCurrencyHelpers', () => {
	test('getStoredGuildIdHelper returns stored id with zero fallback', async () => {
		const storageWithId = {
			getMetadata: jest.fn(async () => ({ id: 77 })),
		};
		const storageWithoutId = {
			getMetadata: jest.fn(async () => ({})),
		};

		await expect(getStoredGuildIdHelper(storageWithId)).resolves.toBe(77);
		await expect(getStoredGuildIdHelper(storageWithoutId)).resolves.toBe(0);
	});

	test('buildTitaniteTransactionRecord keeps payload shape parity', () => {
		const record = buildTitaniteTransactionRecord(1, 'Player', 2, 'earned', 25, 'raid', 'Hydra Level 3');
		expect(record).toEqual(expect.objectContaining({
			playerId: 1,
			playerName: 'Player',
			guildId: 2,
			transactionType: 'earned',
			amount: 25,
			source: 'raid',
			purchaseDescription: 'Hydra Level 3',
			balanceAfter: null,
		}));
		expect(record.timestamp instanceof Date).toBe(true);
	});

	test('trackTitaniteTransactionHelper writes store and emits parity log', async () => {
		const tracker = {
			storage: {
				add: jest.fn(async () => {}),
			},
		};
		const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

		await trackTitaniteTransactionHelper(tracker, 3, 'Member', 9, 'earned', 10, 'dungeon', 'elemental Stage 20');

		expect(tracker.storage.add).toHaveBeenCalledWith('titaniteTransactions', expect.objectContaining({
			playerId: 3,
			playerName: 'Member',
			guildId: 9,
			transactionType: 'earned',
			amount: 10,
			source: 'dungeon',
			purchaseDescription: 'elemental Stage 20',
		}));
		expect(logSpy).toHaveBeenCalledWith('[OrganizedJihad] Tracked titanite earned: 10 from dungeon');
		logSpy.mockRestore();
	});
});
