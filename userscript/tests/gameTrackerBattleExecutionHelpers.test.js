import {
	executeGuildWarBattleTracking,
	executeRaidBossAttackTracking,
} from '../src/modules/trackers/GameTrackerBattleExecutionHelpers.js';

describe('GameTrackerBattleExecutionHelpers', () => {
	test('executeGuildWarBattleTracking writes history, battle, activity, and reward intents', async () => {
		const tracker = {
			compressHeroTeam: jest.fn((team) => team),
			calculateTeamPower: jest.fn((team) => team.length),
			_isBattleDuplicate: jest.fn(() => false),
			_logActivity: jest.fn(async () => {}),
			trackGuildActivity: jest.fn(async () => {}),
			trackResourceTransaction: jest.fn(async () => {}),
			storage: {
				getMetadata: jest.fn(async (key) => {
					if (key === 'currentGuildWar') return { warId: 'war-1', enemyGuildName: 'Nemesis' };
					if (key === 'guildWarBattleHistory') return [];
					if (key === 'guildData') return { id: 22, name: 'GuildX' };
					return {};
				}),
				setMetadata: jest.fn(async () => {}),
				add: jest.fn(async () => {}),
			},
		};

		await executeGuildWarBattleTracking(tracker, { defenderId: 10, fortId: 5 }, {
			result: { win: true },
			attackers: [{ id: 1 }],
			defenders: [{ id: 2 }],
			reward: { gold: 100, guildWarToken: 7 },
			damage: 123,
		});

		expect(tracker.storage.setMetadata).toHaveBeenCalledWith('guildWarBattleHistory', expect.any(Array));
		expect(tracker.storage.add).toHaveBeenCalledWith('battles', expect.objectContaining({ battleType: 'GuildWar' }));
		expect(tracker._logActivity).toHaveBeenCalledWith('battle', 'Guild War WIN at fort #5', { isWin: true });
		expect(tracker.trackGuildActivity).toHaveBeenCalledWith('war', expect.objectContaining({ guildId: 22, fortId: 5 }));
		expect(tracker.trackResourceTransaction).toHaveBeenCalledWith('gold', 100, 'battle', 'guild_war');
		expect(tracker.trackResourceTransaction).toHaveBeenCalledWith('guild_war_coins', 7, 'battle', 'guild_war');
	});

	test('executeGuildWarBattleTracking skips duplicate battle writes', async () => {
		const tracker = {
			compressHeroTeam: jest.fn((team) => team),
			calculateTeamPower: jest.fn((team) => team.length),
			_isBattleDuplicate: jest.fn(() => true),
			_logActivity: jest.fn(async () => {}),
			trackGuildActivity: jest.fn(async () => {}),
			trackResourceTransaction: jest.fn(async () => {}),
			storage: {
				getMetadata: jest.fn(async (key) => {
					if (key === 'currentGuildWar') return { warId: 'war-1', enemyGuildName: 'Nemesis' };
					if (key === 'guildWarBattleHistory') return [];
					if (key === 'guildData') return { id: 1, name: 'G' };
					return {};
				}),
				setMetadata: jest.fn(async () => {}),
				add: jest.fn(async () => {}),
			},
		};

		await executeGuildWarBattleTracking(tracker, { defenderId: 10, fortId: 5 }, { result: { win: false }, reward: {} });
		expect(tracker.storage.add).not.toHaveBeenCalled();
	});

	test('executeRaidBossAttackTracking writes history, battle, activity, and reward intents', async () => {
		const tracker = {
			compressHeroTeam: jest.fn((team) => team),
			_isBattleDuplicate: jest.fn(() => false),
			trackGuildActivity: jest.fn(async () => {}),
			trackResourceTransaction: jest.fn(async () => {}),
			storage: {
				getMetadata: jest.fn(async (key) => {
					if (key === 'raidBossAttackHistory') return [];
					if (key === 'guildData') return { id: 22, name: 'GuildX' };
					return {};
				}),
				setMetadata: jest.fn(async () => {}),
				add: jest.fn(async () => {}),
			},
		};

		await executeRaidBossAttackTracking(tracker, { bossId: 3 }, {
			damage: 555,
			attackers: [{ id: 1 }],
			reward: { gold: 8, clanToken: 4 },
		});

		expect(tracker.storage.setMetadata).toHaveBeenCalledWith('raidBossAttackHistory', expect.any(Array));
		expect(tracker.storage.add).toHaveBeenCalledWith('battles', expect.objectContaining({ battleType: 'RaidBoss' }));
		expect(tracker.trackGuildActivity).toHaveBeenCalledWith('raid', expect.objectContaining({ guildId: 22, bossId: 3, damage: 555 }));
		expect(tracker.trackResourceTransaction).toHaveBeenCalledWith('gold', 8, 'battle', 'guild_raid');
		expect(tracker.trackResourceTransaction).toHaveBeenCalledWith('guild_coins', 4, 'battle', 'guild_raid');
	});
});
