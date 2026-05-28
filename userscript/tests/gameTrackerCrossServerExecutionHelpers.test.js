import { persistCrossServerWarBattles } from '../src/modules/trackers/GameTrackerCrossServerExecutionHelpers.js';

describe('GameTrackerCrossServerExecutionHelpers', () => {
	test('persists non-duplicate cross-server battles', async () => {
		const tracker = {
			calculateTeamPower: jest.fn((team) => team.length),
			compressHeroTeam: jest.fn((team) => team),
			_isBattleDuplicate: jest.fn(() => false),
			storage: {
				add: jest.fn(async () => {}),
			},
		};

		await persistCrossServerWarBattles(tracker, { defenderId: 10, fortId: 7, warId: 'cow-1' }, [
			{ attackers: [{ id: 1 }], defenders: [{ id: 2 }], reward: { gold: 1 } },
			{ attackers: [{ id: 3 }], defenders: [{ id: 4 }], reward: { gold: 2 } },
		]);

		expect(tracker.storage.add).toHaveBeenCalledTimes(2);
		expect(tracker.storage.add).toHaveBeenNthCalledWith(1, 'battles', expect.objectContaining({
			battleType: 'CrossServerWar',
			opponentId: 10,
			fortId: 7,
			warId: 'cow-1',
		}));
	});

	test('skips duplicate cross-server battles', async () => {
		const tracker = {
			calculateTeamPower: jest.fn((team) => team.length),
			compressHeroTeam: jest.fn((team) => team),
			_isBattleDuplicate: jest.fn(() => true),
			storage: {
				add: jest.fn(async () => {}),
			},
		};
		const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

		await persistCrossServerWarBattles(tracker, { defenderId: 10 }, [{ attackers: [], defenders: [] }]);

		expect(tracker.storage.add).not.toHaveBeenCalled();
		expect(logSpy).toHaveBeenCalledWith('[OrganizedJihad] Skipping duplicate CrossServerWar battle');
		logSpy.mockRestore();
	});
});
