/**
 * GameDataHelpers Tests
 *
 * Tests for pure utility functions: team power calculations,
 * hero compression/decompression, replay compression,
 * roster stats, player normalisation, and inventory compression.
 */

import Helpers from '../src/modules/helpers/GameDataHelpers.js';

// ─── calculateTeamPower ──────────────────────────────────────────────

describe('calculateTeamPower', () => {
	test('should sum power from object team', () => {
		const team = {
			h1: { id: 1, power: 10000 },
			h2: { id: 2, power: 20000 },
		};
		expect(Helpers.calculateTeamPower(team)).toBe(30000);
	});

	test('should sum power from array team', () => {
		const team = [{ power: 5000 }, { power: 7000 }];
		expect(Helpers.calculateTeamPower(team)).toBe(12000);
	});

	test('should return 0 for null/undefined', () => {
		expect(Helpers.calculateTeamPower(null)).toBe(0);
		expect(Helpers.calculateTeamPower(undefined)).toBe(0);
	});

	test('should handle heroes with missing power', () => {
		expect(Helpers.calculateTeamPower([{ id: 1 }, { power: 100 }])).toBe(100);
	});

	test('should handle empty array', () => {
		expect(Helpers.calculateTeamPower([])).toBe(0);
	});
});

// ─── calculateMultiTeamPower ─────────────────────────────────────────

describe('calculateMultiTeamPower', () => {
	test('should sum power across multiple teams', () => {
		const teams = [
			{ heroes: [{ power: 1000 }, { power: 2000 }] },
			{ heroes: [{ power: 3000 }] },
		];
		expect(Helpers.calculateMultiTeamPower(teams)).toBe(6000);
	});

	test('should handle teams without heroes wrapper', () => {
		const teams = [
			[{ power: 500 }, { power: 500 }],
			[{ power: 1000 }],
		];
		expect(Helpers.calculateMultiTeamPower(teams)).toBe(2000);
	});

	test('should return 0 for null/undefined/non-array', () => {
		expect(Helpers.calculateMultiTeamPower(null)).toBe(0);
		expect(Helpers.calculateMultiTeamPower(undefined)).toBe(0);
		expect(Helpers.calculateMultiTeamPower('string')).toBe(0);
	});

	test('should return 0 for empty array', () => {
		expect(Helpers.calculateMultiTeamPower([])).toBe(0);
	});
});

// ─── compressHeroTeam / decompressHeroTeam ───────────────────────────

describe('compressHeroTeam', () => {
	test('should compress object team to arrays', () => {
		const team = { h1: { id: 5, level: 120, star: 6, color: 4, power: 45000 } };
		expect(Helpers.compressHeroTeam(team)).toEqual([[5, 120, 6, 4, 45000]]);
	});

	test('should compress array team', () => {
		const team = [{ id: 1, level: 10, star: 2, color: 1, power: 500 }];
		expect(Helpers.compressHeroTeam(team)).toEqual([[1, 10, 2, 1, 500]]);
	});

	test('should default missing fields to 0', () => {
		expect(Helpers.compressHeroTeam([{}])).toEqual([[0, 0, 0, 0, 0]]);
	});

	test('should return empty array for null/undefined', () => {
		expect(Helpers.compressHeroTeam(null)).toEqual([]);
		expect(Helpers.compressHeroTeam(undefined)).toEqual([]);
	});
});

describe('decompressHeroTeam', () => {
	test('should restore hero objects from compressed data', () => {
		const compressed = [[5, 120, 6, 4, 45000]];
		expect(Helpers.decompressHeroTeam(compressed)).toEqual([
			{ id: 5, level: 120, star: 6, color: 4, power: 45000 },
		]);
	});

	test('should return empty array for null/undefined/non-array', () => {
		expect(Helpers.decompressHeroTeam(null)).toEqual([]);
		expect(Helpers.decompressHeroTeam(undefined)).toEqual([]);
		expect(Helpers.decompressHeroTeam('string')).toEqual([]);
	});

	test('should roundtrip with compressHeroTeam', () => {
		const original = [
			{ id: 3, level: 80, star: 4, color: 3, power: 25000 },
			{ id: 7, level: 50, star: 2, color: 1, power: 10000 },
		];
		const compressed = Helpers.compressHeroTeam(original);
		const decompressed = Helpers.decompressHeroTeam(compressed);
		expect(decompressed).toEqual(original);
	});
});

// ─── compressReplay ──────────────────────────────────────────────────

describe('compressReplay', () => {
	test('should compress replay keeping result and teams', () => {
		const replay = {
			result: { win: true },
			attackers: { h1: { id: 1, level: 100, star: 6, color: 4, power: 40000 } },
			defenders: [{ id: 2, level: 90, star: 5, color: 3, power: 35000 }],
			battleLog: ['action1', 'action2'],
		};
		const result = Helpers.compressReplay(replay);
		expect(result.result).toEqual({ win: true });
		expect(result.attackers).toEqual([[1, 100, 6, 4, 40000]]);
		expect(result.defenders).toEqual([[2, 90, 5, 3, 35000]]);
		expect(result.battleLog).toBeUndefined();
	});

	test('should return null for null input', () => {
		expect(Helpers.compressReplay(null)).toBeNull();
	});
});

// ─── calculateHeroStats ─────────────────────────────────────────────

describe('calculateHeroStats', () => {
	test('should calculate roster statistics', () => {
		const heroes = [
			{ power: 30000, level: 120, star: 6 },
			{ power: 10000, level: 60, star: 3 },
		];
		const stats = Helpers.calculateHeroStats(heroes);
		expect(stats.totalHeroes).toBe(2);
		expect(stats.totalPower).toBe(40000);
		expect(stats.averagePower).toBe(20000);
		expect(stats.maxLevel).toBe(120);
		expect(stats.maxStar).toBe(6);
	});

	test('should return zeros for null/undefined/non-array', () => {
		const empty = Helpers.calculateHeroStats(null);
		expect(empty.totalHeroes).toBe(0);
		expect(empty.totalPower).toBe(0);
		expect(empty.averagePower).toBe(0);
	});

	test('should handle empty array', () => {
		const stats = Helpers.calculateHeroStats([]);
		expect(stats.totalHeroes).toBe(0);
		expect(stats.averagePower).toBe(0);
	});

	test('should handle heroes with missing fields', () => {
		const stats = Helpers.calculateHeroStats([{}, { power: 100, level: 5 }]);
		expect(stats.totalPower).toBe(100);
		expect(stats.maxLevel).toBe(5);
	});
});

// ─── normalizePlayerData ─────────────────────────────────────────────

describe('normalizePlayerData', () => {
	test('should normalize full player data', () => {
		const data = {
			userId: 123,
			name: 'TestPlayer',
			level: 120,
			vipLevel: 15,
			power: 500000,
			gold: 1000000,
			starMoney: 5000,
			stamina: 120,
			clanTitle: 'MyGuild',
			clanId: 42,
		};
		const result = Helpers.normalizePlayerData(data);
		expect(result.userId).toBe(123);
		expect(result.name).toBe('TestPlayer');
		expect(result.emeralds).toBe(5000);
		expect(result.stamina).toBe(120);
		expect(result.clanTitle).toBe('MyGuild');
	});

	test('should use fallback id field', () => {
		expect(Helpers.normalizePlayerData({ id: 99 }).userId).toBe(99);
	});

	test('should default missing fields', () => {
		const result = Helpers.normalizePlayerData({});
		expect(result.userId).toBe(0);
		expect(result.name).toBe('Unknown');
		expect(result.level).toBe(0);
		expect(result.gold).toBe(0);
		expect(result.emeralds).toBe(0);
		expect(result.clanTitle).toBeNull();
		expect(result.clanId).toBeNull();
	});
});

// ─── compressInventory ───────────────────────────────────────────────

describe('compressInventory', () => {
	test('should keep only non-zero items', () => {
		const inv = { item1: 10, item2: 0, item3: 5, item4: 0 };
		const result = Helpers.compressInventory(inv);
		expect(result).toEqual({ item1: 10, item3: 5 });
	});

	test('should return empty object for null/undefined', () => {
		expect(Helpers.compressInventory(null)).toEqual({});
		expect(Helpers.compressInventory(undefined)).toEqual({});
	});

	test('should return empty object when all items are zero', () => {
		expect(Helpers.compressInventory({ a: 0, b: 0 })).toEqual({});
	});

	test('should keep all items when all non-zero', () => {
		const inv = { x: 1, y: 99 };
		expect(Helpers.compressInventory(inv)).toEqual({ x: 1, y: 99 });
	});
});
