import {
	dispatchTitaniteTransactions,
	executeGuildDungeonParticipationTracking,
	executeGuildRaidParticipationTracking,
	executeGuildWarParticipationTracking,
	persistParticipationRecords,
} from '../src/modules/trackers/GameTrackerGuildParticipationExecutionHelpers.js';

describe('GameTrackerGuildParticipationExecutionHelpers', () => {
	test('persistParticipationRecords writes each record to target store', async () => {
		const storage = {
			add: jest.fn(async () => {}),
		};
		const rows = [{ playerId: 1 }, { playerId: 2 }];

		await persistParticipationRecords(storage, 'guildWarParticipations', rows);

		expect(storage.add).toHaveBeenNthCalledWith(1, 'guildWarParticipations', rows[0]);
		expect(storage.add).toHaveBeenNthCalledWith(2, 'guildWarParticipations', rows[1]);
	});

	test('dispatchTitaniteTransactions calls tracker transaction method for each intent', async () => {
		const tracker = {
			trackTitaniteTransaction: jest.fn(async () => {}),
		};
		const intents = [
			{ playerId: 1, playerName: 'A', guildId: 10, transactionType: 'earned', amount: 5, source: 'raid', description: 'Hydra Level 2' },
			{ playerId: 2, playerName: 'B', guildId: 10, transactionType: 'earned', amount: 7, source: 'dungeon', description: 'elemental Stage 12' },
		];

		await dispatchTitaniteTransactions(tracker, intents);

		expect(tracker.trackTitaniteTransaction).toHaveBeenNthCalledWith(1, 1, 'A', 10, 'earned', 5, 'raid', 'Hydra Level 2');
		expect(tracker.trackTitaniteTransaction).toHaveBeenNthCalledWith(2, 2, 'B', 10, 'earned', 7, 'dungeon', 'elemental Stage 12');
	});

	test('executeGuildWarParticipationTracking persists records and returns participant count', async () => {
		const tracker = {
			storage: {
				add: jest.fn(async () => {}),
			},
		};
		const count = await executeGuildWarParticipationTracking(tracker, {
			war: {
				participants: {
					101: { name: 'One', attacks: 1 },
					102: { name: 'Two', attacks: 0 },
				},
			},
		}, 88);

		expect(count).toBe(2);
		expect(tracker.storage.add).toHaveBeenCalledTimes(2);
		expect(tracker.storage.add).toHaveBeenCalledWith('guildWarParticipations', expect.objectContaining({ guildId: 88 }));
	});

	test('executeGuildRaidParticipationTracking persists records and dispatches titanite intents', async () => {
		const tracker = {
			storage: {
				add: jest.fn(async () => {}),
			},
			trackTitaniteTransaction: jest.fn(async () => {}),
		};
		const count = await executeGuildRaidParticipationTracking(tracker, {
			raid: {
				bossType: 'hydra',
				difficulty: 4,
				participants: {
					201: { name: 'Raider', reward: { titanite: 11 } },
					202: { name: 'Scout' },
				},
			},
		}, 99);

		expect(count).toBe(2);
		expect(tracker.storage.add).toHaveBeenCalledTimes(2);
		expect(tracker.trackTitaniteTransaction).toHaveBeenCalledTimes(1);
		expect(tracker.trackTitaniteTransaction).toHaveBeenCalledWith(201, 'Raider', 99, 'earned', 11, 'raid', 'hydra Level 4');
	});

	test('executeGuildDungeonParticipationTracking persists records and dispatches titanite intents', async () => {
		const tracker = {
			storage: {
				add: jest.fn(async () => {}),
			},
			trackTitaniteTransaction: jest.fn(async () => {}),
		};
		const count = await executeGuildDungeonParticipationTracking(tracker, {
			dungeon: {
				dungeonType: 'elemental',
				participants: {
					301: { name: 'Delver', titaniteEarned: 17, maxStage: 21 },
					302: { name: 'Watcher' },
				},
			},
		}, 111);

		expect(count).toBe(2);
		expect(tracker.storage.add).toHaveBeenCalledTimes(2);
		expect(tracker.trackTitaniteTransaction).toHaveBeenCalledTimes(1);
		expect(tracker.trackTitaniteTransaction).toHaveBeenCalledWith(301, 'Delver', 111, 'earned', 17, 'dungeon', 'elemental Stage 21');
	});
});
