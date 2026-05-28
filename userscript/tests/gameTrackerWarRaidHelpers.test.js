import {
	applyResourceTransactionIntents,
	appendBoundedHistory,
	buildCrossServerWarBattleRecord,
	buildCrossServerWarInfoMetadata,
	buildGuildWarDataResponse,
	buildGuildWarActivityPayload,
	buildGuildWarBattleHistoryRecord,
	buildGuildWarBattleStoreRecord,
	buildGuildWarInfoMetadata,
	buildGuildWarRewardIntents,
	buildRaidBossDataResponse,
	buildRaidBossAttackHistoryRecord,
	buildRaidBossActivityPayload,
	buildRaidBossBattleRecord,
	buildRaidBossDamageSummary,
	buildRaidBossInfoMetadata,
	buildRaidBossRewardIntents,
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

	test('guild-war side-effect builders preserve payload parity', () => {
		const compressHeroTeam = (team) => team.map((unit) => ({ id: unit.id }));
		const currentWar = { warId: 'w-1', enemyGuildName: 'Nemesis' };
		const args = { defenderId: 123, fortId: 7 };
		const data = { attackers: [{ id: 1 }], defenders: [{ id: 2 }], reward: { gold: 100, guildWarToken: 5, starmoney: 1 }, damage: 999 };

		const historyRecord = buildGuildWarBattleHistoryRecord(args, data, currentWar, compressHeroTeam, true);
		expect(historyRecord).toEqual(expect.objectContaining({
			type: 'guildWar',
			defenderId: 123,
			fortId: 7,
			warId: 'w-1',
			enemyGuildName: 'Nemesis',
			result: 'victory',
			myTeam: [{ id: 1 }],
			enemyTeam: [{ id: 2 }],
			reward: { gold: 100, guildWarToken: 5, starmoney: 1 },
		}));

		const activityPayload = buildGuildWarActivityPayload({ id: 11, name: 'Guild A' }, args, historyRecord, data);
		expect(activityPayload).toEqual({
			guildId: 11,
			guildName: 'Guild A',
			fortId: 7,
			result: 'victory',
			damage: 999,
		});

		expect(buildGuildWarRewardIntents({ gold: 100, guildWarToken: 5, starmoney: 1 })).toEqual([
			{ resourceType: 'gold', amount: 100, source: 'battle', sourceDetail: 'guild_war' },
			{ resourceType: 'guild_war_coins', amount: 5, source: 'battle', sourceDetail: 'guild_war' },
			{ resourceType: 'emeralds', amount: 1, source: 'battle', sourceDetail: 'guild_war' },
		]);

		const storeRow = buildGuildWarBattleStoreRecord(
			args,
			data,
			currentWar,
			(team) => team.length,
			compressHeroTeam,
			true,
			'2026-05-28T00:00:00.000Z'
		);
		expect(storeRow).toEqual(expect.objectContaining({
			battleType: 'GuildWar',
			opponentId: 123,
			opponentName: 'Nemesis',
			isWin: true,
			playerPower: 1,
			opponentPower: 1,
			mission: 7,
			warId: 'w-1',
			timestamp: '2026-05-28T00:00:00.000Z',
		}));
	});

	test('raid side-effect builders preserve payload parity and token fallback', () => {
		const args = { bossId: 4 };
		const data = { damage: 321, reward: { gold: 10, clanToken: 3, starmoney: 2 } };
		const payload = buildRaidBossActivityPayload({ id: 15, name: 'Guild B' }, args, data);

		expect(payload).toEqual({
			guildId: 15,
			guildName: 'Guild B',
			bossId: 4,
			damage: 321,
		});

		expect(buildRaidBossRewardIntents({ gold: 10, clanToken: 3, starmoney: 2 })).toEqual([
			{ resourceType: 'gold', amount: 10, source: 'battle', sourceDetail: 'guild_raid' },
			{ resourceType: 'guild_coins', amount: 3, source: 'battle', sourceDetail: 'guild_raid' },
			{ resourceType: 'emeralds', amount: 2, source: 'battle', sourceDetail: 'guild_raid' },
		]);
	});

	test('applyResourceTransactionIntents replays intents through tracker', async () => {
		const tracker = {
			trackResourceTransaction: jest.fn(async () => {}),
		};
		const intents = [
			{ resourceType: 'gold', amount: 1, source: 'battle', sourceDetail: 'guild_war' },
			{ resourceType: 'emeralds', amount: 2, source: 'battle', sourceDetail: 'guild_raid' },
		];

		await applyResourceTransactionIntents(tracker, intents);

		expect(tracker.trackResourceTransaction).toHaveBeenNthCalledWith(1, 'gold', 1, 'battle', 'guild_war');
		expect(tracker.trackResourceTransaction).toHaveBeenNthCalledWith(2, 'emeralds', 2, 'battle', 'guild_raid');
	});

	test('getter response builders return parity object shapes', () => {
		const guildWarPayload = buildGuildWarDataResponse({ id: 'w1' }, [{ id: 1 }], { wins: 5 });
		expect(guildWarPayload).toEqual({
			currentWar: { id: 'w1' },
			history: [{ id: 1 }],
			stats: { wins: 5 },
		});

		const raidPayload = buildRaidBossDataResponse({ id: 'b1' }, [{ damage: 10 }], { totalDamage: 10, averageDamage: 10 });
		expect(raidPayload).toEqual({
			currentBoss: { id: 'b1' },
			history: [{ damage: 10 }],
			totalDamage: 10,
			averageDamage: 10,
		});
	});
});
