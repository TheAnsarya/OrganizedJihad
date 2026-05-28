import {
	buildGuildDungeonParticipationRecords,
	buildGuildRaidParticipationRecords,
	buildGuildWarParticipationRecords,
} from '../src/modules/trackers/GameTrackerGuildParticipationHelpers.js';

describe('GameTrackerGuildParticipationHelpers', () => {
	test('buildGuildWarParticipationRecords maps war fields and defaults', () => {
		const payload = buildGuildWarParticipationRecords({
			war: {
				id: 'war-1',
				startTime: '2026-01-01T00:00:00Z',
				maxAttacks: 2,
				result: 'win',
				participants: {
					101: {
						name: 'Warrior',
						attacks: 2,
						damage: 12345,
						fortsDefended: 1,
						defensePoints: 55,
						attackLog: [{ target: 'fort_a' }],
					},
					102: {
						name: 'Idle',
						attackCount: 0,
					},
				},
			},
		}, 500);

		expect(Object.keys(payload.participants)).toHaveLength(2);
		expect(payload.records).toHaveLength(2);
		expect(payload.records[0]).toEqual(expect.objectContaining({
			warId: 'war-1',
			playerId: 101,
			guildId: 500,
			attacksMade: 2,
			maxAttacks: 2,
			participated: true,
			warResult: 'win',
			attackDetails: JSON.stringify([{ target: 'fort_a' }]),
		}));
		expect(payload.records[1]).toEqual(expect.objectContaining({
			playerId: 102,
			attacksMade: 0,
			maxAttacks: 2,
			totalDamage: 0,
			participated: false,
		}));
	});

	test('buildGuildRaidParticipationRecords maps damage and titanite transactions', () => {
		const payload = buildGuildRaidParticipationRecords({
			raid: {
				raidId: 'raid-7',
				date: '2026-01-02T00:00:00Z',
				bossType: 'hydra',
				difficulty: 3,
				guildRank: 'alpha',
				participants: {
					201: {
						name: 'Raider',
						bossDamage: 100,
						supportDamage: 50,
						attackCount: 1,
						reward: { titanite: 10 },
					},
					202: {
						name: 'Scout',
						attacks: 1,
					},
				},
			},
		}, 600);

		expect(payload.records).toHaveLength(2);
		expect(payload.records[0]).toEqual(expect.objectContaining({
			raidId: 'raid-7',
			playerId: 201,
			guildId: 600,
			bossName: 'hydra',
			bossLevel: 3,
			bossDamage: 100,
			minionDamage: 50,
			totalDamage: 150,
			participated: true,
			titaniteEarned: 10,
			guildRank: 'alpha',
		}));
		expect(payload.records[1]).toEqual(expect.objectContaining({
			playerId: 202,
			totalDamage: 0,
			participated: false,
			titaniteEarned: 0,
		}));
		expect(payload.titaniteTransactions).toEqual([
			expect.objectContaining({
				playerId: 201,
				guildId: 600,
				transactionType: 'earned',
				amount: 10,
				source: 'raid',
				description: 'hydra Level 3',
			}),
		]);
	});

	test('buildGuildDungeonParticipationRecords maps dungeon fields and titanite transactions', () => {
		const payload = buildGuildDungeonParticipationRecords({
			dungeon: {
				dungeonId: 'd-1',
				date: '2026-01-03T00:00:00Z',
				dungeonType: 'elemental',
				maxCharges: 8,
				participants: {
					301: {
						name: 'Delver',
						titanCharges: 4,
						battleCount: 6,
						totalDamage: 900,
						maxStage: 20,
						titaniteEarned: 25,
						titanTeam: [{ id: 401 }],
					},
					302: {
						name: 'Watcher',
						chargesUsed: 0,
					},
				},
			},
		}, 700);

		expect(payload.records).toHaveLength(2);
		expect(payload.records[0]).toEqual(expect.objectContaining({
			dungeonId: 'd-1',
			playerId: 301,
			guildId: 700,
			dungeonType: 'elemental',
			titanChargesUsed: 4,
			maxTitanCharges: 8,
			battlesFought: 6,
			totalDamage: 900,
			highestStage: 20,
			participated: false,
			titaniteEarned: 25,
			titanTeam: JSON.stringify([{ id: 401 }]),
		}));
		expect(payload.records[1]).toEqual(expect.objectContaining({
			playerId: 302,
			titanChargesUsed: 0,
			participated: false,
		}));
		expect(payload.titaniteTransactions).toEqual([
			expect.objectContaining({
				playerId: 301,
				guildId: 700,
				transactionType: 'earned',
				amount: 25,
				source: 'dungeon',
				description: 'elemental Stage 20',
			}),
		]);
	});
});
