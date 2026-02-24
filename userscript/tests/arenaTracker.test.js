/**
 * ArenaTracker Tests
 *
 * Tests for arena enemy tracking, battle result recording,
 * rank caching, and opponent callback invocations.
 */

import ArenaTracker from '../src/modules/trackers/ArenaTracker.js';

/**
 * Create a mock storage instance with spied methods
 */
function mockStorage() {
	const meta = {};
	return {
		add: jest.fn(),
		setMetadata: jest.fn(async (key, val) => { meta[key] = val; }),
		getMetadata: jest.fn(async (key, def) => meta[key] ?? def),
		_meta: meta,
	};
}

/**
 * Create mock GameDataHelpers
 */
function mockHelpers() {
	return {
		calculateTeamPower: jest.fn((team) => {
			if (!team) return 0;
			const heroes = Array.isArray(team) ? team : Object.values(team);
			return heroes.reduce((s, h) => s + (h?.power || 0), 0);
		}),
		compressHeroTeam: jest.fn((team) => {
			if (!team) return [];
			const heroes = Array.isArray(team) ? team : Object.values(team);
			return heroes.map((h) => [h?.id || 0, h?.level || 0, h?.star || 0, h?.color || 0, h?.power || 0]);
		}),
		calculateMultiTeamPower: jest.fn((teams) => {
			if (!teams) return 0;
			return teams.reduce((s, t) => {
				const heroes = Array.isArray(t.heroes || t) ? (t.heroes || t) : Object.values(t.heroes || t);
				return s + heroes.reduce((ss, h) => ss + (h?.power || 0), 0);
			}, 0);
		}),
	};
}

// ─── trackArenaEnemies ───────────────────────────────────────────────

describe('trackArenaEnemies', () => {
	test('should store enemies list to metadata', async () => {
		const storage = mockStorage();
		const helpers = mockHelpers();
		const tracker = new ArenaTracker(storage, helpers);

		await tracker.trackArenaEnemies({
			enemies: [
				{ userId: 1, name: 'Alice', level: 120, heroes: [{ id: 10, power: 5000 }] },
			],
			user: { arenaRank: 42 },
		});

		expect(storage.setMetadata).toHaveBeenCalledWith('arenaEnemies', expect.any(Array));
		const enemies = storage.setMetadata.mock.calls[0][1];
		expect(enemies).toHaveLength(1);
		expect(enemies[0].userId).toBe(1);
		expect(enemies[0].name).toBe('Alice');
		expect(tracker.lastKnownArenaRank).toBe(42);
	});

	test('should skip if no enemies data', async () => {
		const storage = mockStorage();
		const tracker = new ArenaTracker(storage, mockHelpers());
		await tracker.trackArenaEnemies({});
		expect(storage.setMetadata).not.toHaveBeenCalled();
	});

	test('should append to encounter history', async () => {
		const storage = mockStorage();
		const tracker = new ArenaTracker(storage, mockHelpers());

		await tracker.trackArenaEnemies({
			enemies: [{ userId: 1, name: 'A', level: 1, heroes: [] }],
		});

		expect(storage.setMetadata).toHaveBeenCalledWith(
			'arenaEncounterHistory',
			expect.arrayContaining([expect.objectContaining({ encounter: 'available' })]),
		);
	});
});

// ─── trackArenaBattle ────────────────────────────────────────────────

describe('trackArenaBattle', () => {
	test('should store battle record with correct type', async () => {
		const storage = mockStorage();
		const tracker = new ArenaTracker(storage, mockHelpers());

		await tracker.trackArenaBattle(
			{ enemyUserId: 99 },
			{
				result: { win: true },
				attackers: [{ id: 1, power: 10000 }],
				defenders: [{ id: 2, power: 8000 }],
				reward: { gold: 100 },
			},
			null,
		);

		expect(storage.add).toHaveBeenCalledWith('battles', expect.objectContaining({
			battleType: 'Arena',
			opponentId: 99,
			isWin: true,
			playerPower: 10000,
			opponentPower: 8000,
		}));
	});

	test('should invoke opponent callback', async () => {
		const storage = mockStorage();
		const tracker = new ArenaTracker(storage, mockHelpers());
		const callback = jest.fn();

		await tracker.trackArenaBattle(
			{ enemyUserId: 5 },
			{ result: { win: false } },
			callback,
		);

		expect(callback).toHaveBeenCalledWith(5, 'Arena', false);
	});

	test('should not throw when callback is null', async () => {
		const storage = mockStorage();
		const tracker = new ArenaTracker(storage, mockHelpers());
		await expect(
			tracker.trackArenaBattle({ enemyUserId: 1 }, { result: {} }, null),
		).resolves.not.toThrow();
	});
});

// ─── trackTitanArenaEnemies ──────────────────────────────────────────

describe('trackTitanArenaEnemies', () => {
	test('should store titan arena enemies and cache rank', async () => {
		const storage = mockStorage();
		const tracker = new ArenaTracker(storage, mockHelpers());

		await tracker.trackTitanArenaEnemies({
			enemies: [{ userId: 2, name: 'Bob', level: 100, titans: [{ power: 7000 }] }],
			user: { titanArenaRank: 15 },
		});

		expect(storage.setMetadata).toHaveBeenCalledWith('titanArenaEnemies', expect.any(Array));
		expect(tracker.lastKnownTitanArenaRank).toBe(15);
	});

	test('should skip if no enemies', async () => {
		const storage = mockStorage();
		const tracker = new ArenaTracker(storage, mockHelpers());
		await tracker.trackTitanArenaEnemies({});
		expect(storage.setMetadata).not.toHaveBeenCalled();
	});
});

// ─── trackTitanArenaBattle ───────────────────────────────────────────

describe('trackTitanArenaBattle', () => {
	test('should store battle with TitanArena type', async () => {
		const storage = mockStorage();
		const tracker = new ArenaTracker(storage, mockHelpers());

		await tracker.trackTitanArenaBattle(
			{ enemyUserId: 33 },
			{ result: { win: true }, attackers: [{ power: 9000 }] },
			null,
		);

		expect(storage.add).toHaveBeenCalledWith('battles', expect.objectContaining({
			battleType: 'TitanArena',
			isWin: true,
		}));
	});
});

// ─── trackGrandArenaEnemies ──────────────────────────────────────────

describe('trackGrandArenaEnemies', () => {
	test('should store grand arena enemies with teams', async () => {
		const storage = mockStorage();
		const helpers = mockHelpers();
		const tracker = new ArenaTracker(storage, helpers);

		await tracker.trackGrandArenaEnemies({
			enemies: [{
				userId: 4,
				name: 'Carol',
				level: 130,
				teams: [{ heroes: [{ id: 1, power: 5000 }] }],
			}],
			user: { grandArenaRank: 7 },
		});

		expect(storage.setMetadata).toHaveBeenCalledWith('grandArenaEnemies', expect.any(Array));
		const enemies = storage.setMetadata.mock.calls[0][1];
		expect(enemies[0].teams).toHaveLength(1);
		expect(tracker.lastKnownGrandArenaRank).toBe(7);
	});

	test('should handle enemies without teams', async () => {
		const storage = mockStorage();
		const tracker = new ArenaTracker(storage, mockHelpers());

		await tracker.trackGrandArenaEnemies({
			enemies: [{ userId: 5, name: 'Dan', level: 100 }],
		});

		const enemies = storage.setMetadata.mock.calls[0][1];
		expect(enemies[0].teams).toEqual([]);
	});
});

// ─── trackGrandArenaBattle ───────────────────────────────────────────

describe('trackGrandArenaBattle', () => {
	test('should store battle with GrandArena type and multi-team data', async () => {
		const storage = mockStorage();
		const helpers = mockHelpers();
		const tracker = new ArenaTracker(storage, helpers);

		await tracker.trackGrandArenaBattle(
			{ enemyUserId: 77 },
			{
				result: { win: true },
				attackerTeams: [{ heroes: [{ id: 1, power: 3000 }] }],
				defenderTeams: [{ heroes: [{ id: 2, power: 2500 }] }],
				reward: { coins: 50 },
			},
			jest.fn(),
		);

		expect(storage.add).toHaveBeenCalledWith('battles', expect.objectContaining({
			battleType: 'GrandArena',
			isWin: true,
		}));
		expect(helpers.calculateMultiTeamPower).toHaveBeenCalled();
	});
});

// ─── getRanks ────────────────────────────────────────────────────────

describe('getRanks', () => {
	test('should return default zero ranks', () => {
		const tracker = new ArenaTracker(mockStorage(), mockHelpers());
		expect(tracker.getRanks()).toEqual({
			arenaRank: 0,
			grandArenaRank: 0,
			titanArenaRank: 0,
		});
	});

	test('should return updated ranks after tracking', async () => {
		const tracker = new ArenaTracker(mockStorage(), mockHelpers());

		await tracker.trackArenaEnemies({ enemies: [{ userId: 1, name: 'X', level: 1, heroes: [] }], user: { arenaRank: 10 } });
		await tracker.trackGrandArenaEnemies({ enemies: [{ userId: 2, name: 'Y', level: 1 }], user: { grandArenaRank: 20 } });
		await tracker.trackTitanArenaEnemies({ enemies: [{ userId: 3, name: 'Z', level: 1, titans: [] }], user: { titanArenaRank: 30 } });

		expect(tracker.getRanks()).toEqual({
			arenaRank: 10,
			grandArenaRank: 20,
			titanArenaRank: 30,
		});
	});
});
