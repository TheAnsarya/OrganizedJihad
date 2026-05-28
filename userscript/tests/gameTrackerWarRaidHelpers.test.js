import {
	appendBoundedHistory,
	buildCrossServerWarBattleRecord,
	buildCrossServerWarInfoMetadata,
	buildGuildWarInfoMetadata,
	buildRaidBossAttackHistoryRecord,
	buildRaidBossBattleRecord,
	buildRaidBossDamageSummary,
	buildRaidBossInfoMetadata,
	resolveCrossServerBattleResults,
} from '../src/modules/trackers/GameTrackerWarRaidHelpers.js';

describe('GameTrackerWarRaidHelpers', () => {
	test('buildGuildWarInfoMetadata preserves expected payload shape', () => {
		const metadata = buildGuildWarInfoMetadata({
			warId: 'war-9',
			enemyClanId: 77,
			enemyClanName: 'Nemesis',
			myScore: 120,
			enemyScore: 100,
			defenders: { a: 1 },
			attackers: { b: 2 },
		});

		expect(metadata).toEqual(expect.objectContaining({
			warId: 'war-9',
			enemyGuildId: 77,
			enemyGuildName: 'Nemesis',
			myGuildScore: 120,
			enemyScore: 100,
			defenders: { a: 1 },
			attackers: { b: 2 },
		}));
		expect(typeof metadata.timestamp).toBe('number');
	});

	test('buildRaidBossInfoMetadata normalizes values and defaults', () => {
		const metadata = buildRaidBossInfoMetadata({
			boss: { level: 140 },
			stats: { currentBoss: '2', points: '16606', bossKilled: [1] },
			userStats: { damage: '1234', points: '800', usedHeroes: [10] },
			attempts: 2,
			bossAttempts: 5,
			coins: 800,
			nodes: { 1: {}, 2: {} },
		});

		expect(metadata).toEqual(expect.objectContaining({
			bossLevel: 140,
			currentBoss: '2',
			clanPoints: '16606',
			bossKilled: [1],
			myDamage: 1234,
			myPoints: 800,
			usedHeroes: [10],
			attemptsUsed: 2,
			attemptsMax: 5,
			coins: 800,
			nodeCount: 2,
		}));
	});

	test('buildRaidBossAttackHistoryRecord and battle record preserve payload shape', () => {
		const compressHeroTeam = (team) => team.map((unit) => ({ id: unit.id }));
		const args = { bossId: 5 };
		const data = { damage: 987, attackers: [{ id: 1 }], reward: { gold: 10 } };

		const historyRecord = buildRaidBossAttackHistoryRecord(args, data, compressHeroTeam);
		const battleRecord = buildRaidBossBattleRecord(args, data, compressHeroTeam, '2026-05-28T00:00:00.000Z');

		expect(historyRecord).toEqual(expect.objectContaining({
			bossId: 5,
			damage: 987,
			myTeam: [{ id: 1 }],
			reward: { gold: 10 },
		}));
		expect(typeof historyRecord.timestamp).toBe('number');

		expect(battleRecord).toEqual({
			battleType: 'RaidBoss',
			isWin: true,
			damage: 987,
			playerHeroes: JSON.stringify([{ id: 1 }]),
			opponentHeroes: null,
			rewards: JSON.stringify({ gold: 10 }),
			mission: 5,
			timestamp: '2026-05-28T00:00:00.000Z',
		});
	});

	test('appendBoundedHistory enforces cap and preserves newest rows', () => {
		const start = [{ id: 1 }, { id: 2 }];
		const bounded = appendBoundedHistory(start, { id: 3 }, 2);
		expect(bounded).toEqual([{ id: 2 }, { id: 3 }]);
	});

	test('cross-server helpers normalize metadata, results list, and battle rows', () => {
		const metadata = buildCrossServerWarInfoMetadata({
			id: 'cow-1',
			enemy: { id: 44, name: 'Enemy', serverId: 909 },
			score: 50,
			enemyScore: 40,
			phase: 'active',
		});
		expect(metadata).toEqual(expect.objectContaining({
			warId: 'cow-1',
			isCrossServer: true,
			enemyGuildId: 44,
			enemyGuildName: 'Enemy',
			enemyServer: 909,
			myScore: 50,
			enemyScore: 40,
			state: 'active',
		}));

		expect(resolveCrossServerBattleResults({ battles: [{ id: 1 }] })).toEqual([{ id: 1 }]);
		expect(resolveCrossServerBattleResults({ results: [{ id: 2 }] })).toEqual([{ id: 2 }]);
		expect(resolveCrossServerBattleResults({ id: 3 })).toEqual([{ id: 3 }]);

		const battle = buildCrossServerWarBattleRecord(
			{ defenderId: 999, fortId: 7, warId: 'cow-1' },
			{ defenders: [{ id: 3 }], attackers: [{ id: 1 }], reward: { emerald: 1 } },
			(team) => team.length,
			(team) => team
		);
		expect(battle).toEqual(expect.objectContaining({
			battleType: 'CrossServerWar',
			opponentId: 999,
			playerPower: 1,
			opponentPower: 1,
			playerHeroes: JSON.stringify([{ id: 1 }]),
			opponentHeroes: JSON.stringify([{ id: 3 }]),
			rewards: JSON.stringify({ emerald: 1 }),
			fortId: 7,
			warId: 'cow-1',
		}));
	});

	test('buildRaidBossDamageSummary computes total and average', () => {
		expect(buildRaidBossDamageSummary([])).toEqual({ totalDamage: 0, averageDamage: 0 });
		expect(buildRaidBossDamageSummary([{ damage: 10 }, { damage: 20 }, { damage: 30 }])).toEqual({
			totalDamage: 60,
			averageDamage: 20,
		});
	});
});
