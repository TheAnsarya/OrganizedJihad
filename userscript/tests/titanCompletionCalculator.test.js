/**
 * TitanCompletionCalculator Tests
 *
 * Tests for the titan completion percentage calculation system.
 * Covers per-system scores, weighted overall, edge cases,
 * artifact scoring, and static helper methods.
 *
 * Mirrors the structure of heroCompletionCalculator.test.js for consistency.
 */

import TitanCompletionCalculator from '../src/modules/helpers/TitanCompletionCalculator.js';

const Calc = TitanCompletionCalculator;

describe('TitanCompletionCalculator', () => {
	// ─── Fully Maxed Titan ───────────────────────────────────────────────

	describe('Fully maxed titan', () => {
		const maxedTitan = {
			titanId: 4001,
			titanName: 'Hyperion',
			level: 130,
			stars: 6,
			power: 120000,
			skillLevel: 130,
			skinLevel: 60,
			summonStars: 6,
			element: 'light',
			artifactData: JSON.stringify({
				1: { level: 130, star: 6 },
				2: { level: 130, star: 6 },
				3: { level: 130, star: 6 },
			}),
		};

		test('should return 100% overall for a fully maxed titan', () => {
			const result = Calc.calculateCompletion(maxedTitan);
			expect(result.overall).toBeCloseTo(100, 0);
		});

		test('should return 100% for every individual system', () => {
			const result = Calc.calculateCompletion(maxedTitan);
			expect(result.systems.level).toBeCloseTo(100, 1);
			expect(result.systems.stars).toBeCloseTo(100, 1);
			expect(result.systems.skill).toBeCloseTo(100, 1);
			expect(result.systems.artifacts).toBeCloseTo(100, 1);
			expect(result.systems.skins).toBeCloseTo(100, 1);
		});
	});

	// ─── Empty / Zero Inputs ─────────────────────────────────────────────

	describe('Empty / zero inputs', () => {
		test('should return 0% for null', () => {
			const result = Calc.calculateCompletion(null);
			expect(result.overall).toBe(0);
			expect(result.systems).toEqual({});
		});

		test('should return 0% for undefined', () => {
			const result = Calc.calculateCompletion(undefined);
			expect(result.overall).toBe(0);
		});

		test('should return 0% for empty object', () => {
			const result = Calc.calculateCompletion({});
			expect(result.overall).toBe(0);
		});

		test('should return 0% for titan with all zeros', () => {
			const result = Calc.calculateCompletion({
				level: 0, stars: 0, skillLevel: 0,
				skinLevel: 0, summonStars: 0, artifactData: '{}',
			});
			expect(result.overall).toBe(0);
		});
	});

	// ─── Partially Upgraded Titan ────────────────────────────────────────

	describe('Partially upgraded titan', () => {
		test('should produce expected weighted overall', () => {
			const titan = {
				level: 65,       // 50%
				stars: 3,        // 50%
				skillLevel: 65,  // 50%
				skinLevel: 30,   // 50%
				summonStars: 3,  // 50%
				artifactData: JSON.stringify({
					1: { level: 65, star: 3 },
				}),
			};
			const result = Calc.calculateCompletion(titan);
			// Level: 50% * 0.25 = 12.5
			// Stars: 50% * 0.25 = 12.5
			// Skill: 50% * 0.15 = 7.5
			// Artifacts: ~50% * 0.25 = ~12.5
			// Skins: 50% * 0.10 = 5.0
			// Total: ~50%
			expect(result.overall).toBeGreaterThan(45);
			expect(result.overall).toBeLessThan(55);
		});

		test('should handle titan with only level and stars set', () => {
			const result = Calc.calculateCompletion({ level: 130, stars: 6 });
			// Level: 100% * 0.25 = 25
			// Stars: 100% * 0.25 = 25
			// Rest: 0
			// Total: 50%
			expect(result.overall).toBeCloseTo(50, 0);
		});
	});

	// ─── System Details ──────────────────────────────────────────────────

	describe('System details', () => {
		test('should include current and max in systemDetails', () => {
			const result = Calc.calculateCompletion({ level: 100, stars: 4 });
			expect(result.systemDetails.level.current).toBe(100);
			expect(result.systemDetails.level.max).toBe(130);
			expect(result.systemDetails.stars.current).toBe(4);
			expect(result.systemDetails.stars.max).toBe(6);
		});
	});

	// ─── Artifact / Totem Scoring ────────────────────────────────────────

	describe('Artifact scoring', () => {
		test('should score object-format artifacts with level and star', () => {
			const titan = {
				artifactData: JSON.stringify({
					1: { level: 100, star: 5 },
					2: { level: 80, star: 4 },
					3: { level: 60, star: 3 },
				}),
			};
			const result = Calc.calculateCompletion(titan);
			// Per artifact: (level/130 + star/6) / 2
			// Art1: (100/130 + 5/6)/2 ≈ 0.801
			// Art2: (80/130 + 4/6)/2  ≈ 0.641
			// Art3: (60/130 + 3/6)/2  ≈ 0.481
			// avg ≈ 0.641 → 64.1%
			expect(result.systems.artifacts).toBeGreaterThan(60);
			expect(result.systems.artifacts).toBeLessThan(70);
		});

		test('should score array-format artifacts', () => {
			const titan = {
				artifactData: JSON.stringify([
					{ level: 130, star: 6 },
					{ level: 130, star: 6 },
				]),
			};
			const result = Calc.calculateCompletion(titan);
			expect(result.systems.artifacts).toBeCloseTo(100, 0);
		});

		test('should return 0 for empty artifact data', () => {
			const result = Calc.calculateCompletion({ artifactData: '{}' });
			expect(result.systems.artifacts).toBe(0);
		});

		test('should handle missing artifactData gracefully', () => {
			const result = Calc.calculateCompletion({ level: 50 });
			expect(result.systems.artifacts).toBe(0);
		});
	});

	// ─── Star field naming ───────────────────────────────────────────────

	describe('Star field naming', () => {
		test('should accept "star" (singular) as field name', () => {
			const result = Calc.calculateCompletion({ star: 6 });
			expect(result.systems.stars).toBeCloseTo(100, 1);
		});

		test('should accept "stars" (plural) as field name', () => {
			const result = Calc.calculateCompletion({ stars: 6 });
			expect(result.systems.stars).toBeCloseTo(100, 1);
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

		test('should handle null/undefined', () => {
			expect(Calc.formatPercent(null)).toBe('0.00%');
			expect(Calc.formatPercent(undefined)).toBe('0.00%');
		});
	});

	// ─── colorClass ──────────────────────────────────────────────────────

	describe('colorClass', () => {
		test('should return correct color thresholds', () => {
			expect(Calc.colorClass(100)).toBe('cyan');
			expect(Calc.colorClass(75)).toBe('green');
			expect(Calc.colorClass(50)).toBe('yellow');
			expect(Calc.colorClass(25)).toBe('orange');
			expect(Calc.colorClass(10)).toBe('red');
			expect(Calc.colorClass(0)).toBe('red');
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

		test('should clamp value to 0-100', () => {
			const html = Calc.renderBar(150);
			expect(html).toContain('width:100%');
		});
	});

	// ─── formatElement ───────────────────────────────────────────────────

	describe('formatElement', () => {
		test('should return emoji + capitalized element name', () => {
			expect(Calc.formatElement('fire')).toContain('Fire');
			expect(Calc.formatElement('water')).toContain('Water');
			expect(Calc.formatElement('earth')).toContain('Earth');
			expect(Calc.formatElement('dark')).toContain('Dark');
			expect(Calc.formatElement('light')).toContain('Light');
		});

		test('should handle unknown element', () => {
			const result = Calc.formatElement('plasma');
			expect(result).toContain('Plasma');
			expect(result).toContain('\u2753'); // ❓
		});

		test('should handle null/empty', () => {
			expect(Calc.formatElement(null)).toBeDefined();
			expect(Calc.formatElement('')).toBeDefined();
		});
	});

	// ─── Edge Cases ──────────────────────────────────────────────────────

	describe('Edge cases', () => {
		test('should clamp values exceeding max', () => {
			const result = Calc.calculateCompletion({
				level: 200, stars: 10, skillLevel: 200,
				artifactData: JSON.stringify([
					{ level: 200, star: 10 },
					{ level: 200, star: 10 },
					{ level: 200, star: 10 },
				]),
				skinLevel: 100, summonStars: 10,
			});
			// Each system score should cap at 100, overall caps at 100
			expect(result.overall).toBeCloseTo(100, 0);
			expect(result.systems.level).toBeCloseTo(100, 1);
			expect(result.systems.stars).toBeCloseTo(100, 1);
		});

		test('should handle invalid JSON in artifactData', () => {
			const result = Calc.calculateCompletion({
				level: 50,
				artifactData: 'not-json{{{',
			});
			// Should not crash, just score artifacts as 0
			expect(result.systems.artifacts).toBe(0);
			expect(result.systems.level).toBeGreaterThan(0);
		});

		test('should handle artifact data as direct object (not JSON string)', () => {
			const result = Calc.calculateCompletion({
				artifactData: { 1: { level: 130, star: 6 } },
			});
			expect(result.systems.artifacts).toBeCloseTo(100, 0);
		});
	});

	// ─── Weights ─────────────────────────────────────────────────────────

	describe('Weights', () => {
		test('weights should sum to 1.0', () => {
			const total = Object.values(Calc.WEIGHTS).reduce((s, w) => s + w, 0);
			expect(total).toBeCloseTo(1.0, 5);
		});

		test('should have 5 weighted systems', () => {
			expect(Object.keys(Calc.WEIGHTS)).toHaveLength(5);
		});
	});

	// ─── System Labels and Icons ─────────────────────────────────────────

	describe('System labels and icons', () => {
		test('should have labels for all weighted systems', () => {
			for (const key of Object.keys(Calc.WEIGHTS)) {
				expect(Calc.SYSTEM_LABELS[key]).toBeDefined();
				expect(Calc.SYSTEM_ICONS[key]).toBeDefined();
			}
		});
	});
});
