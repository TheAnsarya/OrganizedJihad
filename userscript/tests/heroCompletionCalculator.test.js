/**
 * HeroCompletionCalculator Tests
 *
 * Tests for the hero completion percentage calculation system.
 * Covers per-system scores, weighted overall, edge cases,
 * and both tracked (IDB) and raw API hero data formats.
 */

import HeroCompletionCalculator from '../src/modules/helpers/HeroCompletionCalculator.js';

const Calc = HeroCompletionCalculator;

describe('HeroCompletionCalculator', () => {
	// ─── Fully Maxed Hero ────────────────────────────────────────────────

	describe('Fully maxed hero', () => {
		const maxedHero = {
			heroId: 1,
			heroName: 'Galahad',
			level: 130,
			stars: 6,
			color: 18,
			power: 198058,
			skins: 6,
			skillLevel1: 130,
			skillLevel2: 130,
			skillLevel3: 130,
			skillLevel4: 130,
			artifactWeapon: 6,
			artifactBook: 6,
			artifactRing: 6,
			rawSkills: JSON.stringify({ 2: 130, 3: 130, 4: 130, 5: 130 }),
			rawSkins: JSON.stringify({ 1: 60, 54: 60, 95: 60, 154: 60, 250: 60, 325: 60 }),
			artifactLevels: JSON.stringify([130, 130, 130]),
			runes: JSON.stringify([43750, 43750, 43750, 43750, 43750]),
			titanGiftLevel: 30,
			ascensions: JSON.stringify({
				1: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
				2: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
				3: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
				4: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
				5: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
			}),
		};

		test('should return 100% overall for a fully maxed hero', () => {
			const result = Calc.calculateCompletion(maxedHero);
			expect(result.overall).toBeCloseTo(100, 1);
		});

		test('should return 100% for every individual system', () => {
			const result = Calc.calculateCompletion(maxedHero);
			expect(result.systems.level).toBeCloseTo(100, 1);
			expect(result.systems.stars).toBeCloseTo(100, 1);
			expect(result.systems.color).toBeCloseTo(100, 1);
			expect(result.systems.skills).toBeCloseTo(100, 1);
			expect(result.systems.artifacts).toBeCloseTo(100, 1);
			expect(result.systems.runes).toBeCloseTo(100, 1);
			expect(result.systems.skins).toBeCloseTo(100, 1);
			expect(result.systems.titanGift).toBeCloseTo(100, 1);
			expect(result.systems.ascension).toBeCloseTo(100, 1);
		});
	});

	// ─── Empty / Null Hero ───────────────────────────────────────────────

	describe('Empty or null input', () => {
		test('should return 0% for null', () => {
			const result = Calc.calculateCompletion(null);
			expect(result.overall).toBe(0);
		});

		test('should return 0% for empty object', () => {
			const result = Calc.calculateCompletion({});
			expect(result.overall).toBe(0);
		});

		test('should return 0% for hero with all zeros', () => {
			const result = Calc.calculateCompletion({
				level: 0, stars: 0, color: 0,
				rawSkills: '{}', runes: '[]', rawSkins: '{}',
				artifactLevels: '[]', titanGiftLevel: 0, ascensions: '{}',
			});
			expect(result.overall).toBe(0);
		});
	});

	// ─── Partial Hero ────────────────────────────────────────────────────

	describe('Partially upgraded hero', () => {
		const partialHero = {
			level: 65,        // 50%
			stars: 3,         // 50%
			color: 9,         // 50%
			rawSkills: JSON.stringify({ 1: 65, 2: 65, 3: 65, 4: 65 }),  // 50%
			artifactLevels: JSON.stringify([65, 65, 65]),                 // 50%
			artifactWeapon: 3, artifactBook: 3, artifactRing: 3,         // 50%
			runes: JSON.stringify([21875, 21875, 21875, 21875, 21875]),   // 50%
			rawSkins: JSON.stringify({ 1: 30, 2: 30 }),                  // 50%
			titanGiftLevel: 15,  // 50%
			ascensions: JSON.stringify({ 1: [0, 1, 2, 3, 4], 2: [0, 1, 2, 3, 4] }), // 10/52 ≈ 19%
		};

		test('should calculate each system independently', () => {
			const result = Calc.calculateCompletion(partialHero);
			expect(result.systems.level).toBeCloseTo(50, 0);
			expect(result.systems.stars).toBeCloseTo(50, 0);
			expect(result.systems.color).toBeCloseTo(50, 0);
			expect(result.systems.skills).toBeCloseTo(50, 0);
			expect(result.systems.runes).toBeCloseTo(50, 0);
			expect(result.systems.skins).toBeCloseTo(50, 0);
			expect(result.systems.titanGift).toBeCloseTo(50, 0);
		});

		test('should produce weighted overall around 47%', () => {
			const result = Calc.calculateCompletion(partialHero);
			// 7 systems at 50% (weights sum to 0.90) + artifacts at 50% (0.15)
			// + ascension at ~19% (0.05) ≈ 90*0.5 + 5*0.5 + 5*0.19 ≈ 48.46
			expect(result.overall).toBeGreaterThan(40);
			expect(result.overall).toBeLessThan(55);
		});
	});

	// ─── Raw API Hero Format ─────────────────────────────────────────────

	describe('Raw API hero format (non-JSON-stringified)', () => {
		test('should handle skills as direct object', () => {
			const hero = {
				level: 130,
				star: 6,      // note: "star" not "stars"
				color: 18,
				skills: { 2: 130, 3: 130, 4: 130, 5: 130 },
				artifacts: [{ level: 130, star: 6 }, { level: 130, star: 6 }, { level: 130, star: 6 }],
				runes: [43750, 43750, 43750, 43750, 43750],
				skins: { 1: 60, 2: 60, 3: 60 },
				titanGiftLevel: 30,
				ascensions: { 1: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
			};
			const result = Calc.calculateCompletion(hero);
			expect(result.systems.skills).toBeCloseTo(100, 0);
			expect(result.systems.artifacts).toBeCloseTo(100, 0);
			expect(result.systems.runes).toBeCloseTo(100, 0);
			expect(result.systems.skins).toBeCloseTo(100, 0);
		});
	});

	// ─── Skill Level Parsing ─────────────────────────────────────────────

	describe('Skill level parsing', () => {
		test('should fall back to skillLevel1-4 fields when rawSkills is missing', () => {
			const hero = { skillLevel1: 100, skillLevel2: 80, skillLevel3: 60, skillLevel4: 40 };
			const result = Calc.calculateCompletion(hero);
			// avg = 70 / 130 ≈ 53.8%
			expect(result.systems.skills).toBeGreaterThan(50);
			expect(result.systems.skills).toBeLessThan(60);
		});

		test('should ignore ascension skills and only count top 4 core skills (#62)', () => {
			// Cleaver scenario: 4 core skills at 130, plus 2 ascension at 1.
			// Before fix: avg of all 6 = 87, 87/130 = 66.92% (WRONG)
			// After fix: top 4 non-zero sorted descending = [130,130,130,130], avg = 130/130 = 100%
			const hero = {
				rawSkills: JSON.stringify({ 2: 130, 3: 130, 4: 130, 5: 130, 6022: 130, 8268: 1 }),
			};
			const result = Calc.calculateCompletion(hero);
			// Top 4 are all 130 → 100%
			expect(result.systems.skills).toBeCloseTo(100, 0);
		});

		test('should ignore zero-level skills from rawSkills (#62)', () => {
			// Hero with 4 core skills, 2 ascension skills at 0
			const hero = {
				rawSkills: JSON.stringify({ 2: 130, 3: 130, 4: 130, 5: 130, 6022: 0, 8268: 0 }),
			};
			const result = Calc.calculateCompletion(hero);
			expect(result.systems.skills).toBeCloseTo(100, 0);
		});

		test('should ignore ascension skills from direct skills object (#62)', () => {
			const hero = {
				skills: { 2: 130, 3: 130, 4: 130, 5: 130, 6022: 1, 8268: 0 },
			};
			const result = Calc.calculateCompletion(hero);
			expect(result.systems.skills).toBeCloseTo(100, 0);
		});

		test('should handle hero with fewer than 4 skills', () => {
			const hero = {
				rawSkills: JSON.stringify({ 2: 100, 3: 80 }),
			};
			const result = Calc.calculateCompletion(hero);
			// avg(100, 80) / 130 = 90/130 ≈ 69.2%
			expect(result.systems.skills).toBeGreaterThan(65);
			expect(result.systems.skills).toBeLessThan(75);
		});
	});

	// ─── Artifact Scoring ────────────────────────────────────────────────

	describe('Artifact scoring', () => {
		test('should combine artifact levels and stars', () => {
			const hero = {
				artifactLevels: JSON.stringify([100, 80, 60]),
				artifactWeapon: 5, artifactBook: 4, artifactRing: 3,
			};
			const result = Calc.calculateCompletion(hero);
			// Per artifact: (level/130 + star/6) / 2
			// Art1: (100/130 + 5/6)/2 ≈ 0.801
			// Art2: (80/130 + 4/6)/2  ≈ 0.641
			// Art3: (60/130 + 3/6)/2  ≈ 0.481
			// avg ≈ 0.641 → 64.1%
			expect(result.systems.artifacts).toBeGreaterThan(60);
			expect(result.systems.artifacts).toBeLessThan(70);
		});
	});

	// ─── formatPercent ───────────────────────────────────────────────────

	describe('formatPercent', () => {
		test('should format with 2 decimal places by default', () => {
			expect(Calc.formatPercent(62.384)).toBe('62.38%');
			expect(Calc.formatPercent(100)).toBe('100.00%');
			expect(Calc.formatPercent(0)).toBe('0.00%');
		});

		test('should respect custom decimal places', () => {
			expect(Calc.formatPercent(62.384, 1)).toBe('62.4%');
			expect(Calc.formatPercent(62.384, 0)).toBe('62%');
		});
	});

	// ─── colorClass ──────────────────────────────────────────────────────

	describe('colorClass', () => {
		test('should return correct color thresholds', () => {
			expect(Calc.colorClass(0)).toBe('red');
			expect(Calc.colorClass(24)).toBe('red');
			expect(Calc.colorClass(25)).toBe('orange');
			expect(Calc.colorClass(49)).toBe('orange');
			expect(Calc.colorClass(50)).toBe('yellow');
			expect(Calc.colorClass(74)).toBe('yellow');
			expect(Calc.colorClass(75)).toBe('green');
			expect(Calc.colorClass(99)).toBe('green');
			expect(Calc.colorClass(100)).toBe('cyan');
		});
	});

	// ─── renderBar ───────────────────────────────────────────────────────

	describe('renderBar', () => {
		test('should return HTML with correct classes and width', () => {
			const html = Calc.renderBar(75);
			expect(html).toContain('oj-completion-bar');
			expect(html).toContain('oj-completion-green');
			expect(html).toContain('width:75%');
			expect(html).toContain('75.00%');
		});

		test('should clamp to 0-100', () => {
			const html = Calc.renderBar(150);
			expect(html).toContain('width:100%');
		});
	});

	// ─── calculateAll ────────────────────────────────────────────────────

	describe('calculateAll', () => {
		test('should return sorted results by overall descending', () => {
			const heroes = [
				{ heroId: 1, level: 50 },
				{ heroId: 2, level: 130, stars: 6, color: 18 },
				{ heroId: 3, level: 100 },
			];
			const results = Calc.calculateAll(heroes);
			expect(results).toHaveLength(3);
			expect(results[0].hero.heroId).toBe(2);
			expect(results[0].completion.overall).toBeGreaterThan(results[1].completion.overall);
			expect(results[1].completion.overall).toBeGreaterThan(results[2].completion.overall);
		});

		test('should handle null/empty input', () => {
			expect(Calc.calculateAll(null)).toEqual([]);
			expect(Calc.calculateAll([])).toEqual([]);
		});
	});

	// ─── Edge Cases ──────────────────────────────────────────────────────

	describe('Edge cases', () => {
		test('should clamp values exceeding max', () => {
			const hero = { level: 999, stars: 99, color: 99 };
			const result = Calc.calculateCompletion(hero);
			expect(result.systems.level).toBe(100);
			expect(result.systems.stars).toBe(100);
			expect(result.systems.color).toBe(100);
		});

		test('should handle invalid JSON strings gracefully', () => {
			const hero = {
				level: 50,
				rawSkills: 'not valid json',
				runes: '{broken',
				ascensions: 42,
			};
			const result = Calc.calculateCompletion(hero);
			expect(result.systems.level).toBeGreaterThan(0);
			expect(result.systems.skills).toBe(0);
			expect(result.systems.runes).toBe(0);
		});

		test('systemDetails should include current/max info', () => {
			const hero = { level: 65, titanGiftLevel: 15 };
			const result = Calc.calculateCompletion(hero);
			expect(result.systemDetails.level.current).toBe(65);
			expect(result.systemDetails.level.max).toBe(130);
			expect(result.systemDetails.titanGift.current).toBe(15);
			expect(result.systemDetails.titanGift.max).toBe(30);
		});
	});
});
