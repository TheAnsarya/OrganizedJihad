/**
 * PetCompletionCalculator Tests
 *
 * Tests for pet completion percentage calculation.
 * Verifies scoring, formatting, patronage parsing, and edge cases.
 * Systems: level (0.45), stars (0.35), color (0.20)
 */

import Calc from '../src/modules/helpers/PetCompletionCalculator.js';

describe('PetCompletionCalculator', () => {
	// ─── Fully Maxed Pet ─────────────────────────────────────────────────

	describe('Fully maxed pet', () => {
		test('should return 100% overall for max stats', () => {
			const result = Calc.calculateCompletion({
				level: 130,
				stars: 6,
				color: 10,
			});
			expect(result.overall).toBeCloseTo(100, 1);
		});

		test('should return 100% for every individual system', () => {
			const result = Calc.calculateCompletion({
				level: 130,
				stars: 6,
				color: 10,
			});
			expect(result.systems.level).toBeCloseTo(100, 1);
			expect(result.systems.stars).toBeCloseTo(100, 1);
			expect(result.systems.color).toBeCloseTo(100, 1);
		});
	});

	// ─── Empty / Zero Inputs ─────────────────────────────────────────────

	describe('Empty / zero inputs', () => {
		test('should return 0% for null', () => {
			const result = Calc.calculateCompletion(null);
			expect(result.overall).toBe(0);
			expect(result.systems.level).toBe(0);
			expect(result.systems.stars).toBe(0);
			expect(result.systems.color).toBe(0);
		});

		test('should return 0% for undefined', () => {
			const result = Calc.calculateCompletion(undefined);
			expect(result.overall).toBe(0);
		});

		test('should return 0% for empty object', () => {
			const result = Calc.calculateCompletion({});
			expect(result.overall).toBe(0);
		});

		test('should return 0% for all zeros', () => {
			const result = Calc.calculateCompletion({ level: 0, stars: 0 });
			expect(result.overall).toBe(0);
		});

		test('should return 0% for non-object input', () => {
			expect(Calc.calculateCompletion('string').overall).toBe(0);
			expect(Calc.calculateCompletion(42).overall).toBe(0);
		});
	});

	// ─── Partial Upgrades ────────────────────────────────────────────────

	describe('Partially upgraded pet', () => {
		test('should produce expected weighted overall', () => {
			const result = Calc.calculateCompletion({
				level: 65,  // 50% of 130
				stars: 3,   // 50% of 6
				color: 5,   // 50% of 10
			});
			// level: 50% * 0.45 = 22.5, stars: 50% * 0.35 = 17.5, color: 50% * 0.20 = 10, total: 50%
			expect(result.overall).toBeCloseTo(50, 0);
		});

		test('should handle pet with only level set', () => {
			const result = Calc.calculateCompletion({ level: 130 });
			// level: 100% * 0.45 = 45, stars: 0%, items: 0%
			expect(result.overall).toBeCloseTo(45, 0);
		});

		test('should handle pet with only stars set', () => {
			const result = Calc.calculateCompletion({ stars: 6 });
			// level: 0%, stars: 100% * 0.35 = 35, items: 0%
			expect(result.overall).toBeCloseTo(35, 0);
		});

		test('should handle pet with only color set', () => {
			const result = Calc.calculateCompletion({ color: 10 });
			// level: 0%, stars: 0%, color: 100% * 0.20 = 20
			expect(result.overall).toBeCloseTo(20, 0);
		});
	});

	// ─── System Details ──────────────────────────────────────────────────

	describe('System details', () => {
		test('should include current/max info for each system', () => {
			const result = Calc.calculateCompletion({ level: 50, stars: 3, color: 5 });
			expect(result.systemDetails.level).toEqual({ current: 50, max: 130 });
			expect(result.systemDetails.stars).toEqual({ current: 3, max: 6 });
			expect(result.systemDetails.color).toEqual({ current: 5, max: 10 });
		});
	});

	// ─── Star Field Naming ───────────────────────────────────────────────

	describe('Star field naming', () => {
		test('should accept "stars" (plural) as field name', () => {
			const result = Calc.calculateCompletion({ stars: 4 });
			expect(result.systems.stars).toBeGreaterThan(0);
		});

		test('should accept "star" (singular) as field name', () => {
			const result = Calc.calculateCompletion({ star: 4 });
			expect(result.systems.stars).toBeGreaterThan(0);
		});
	});

	// ─── Formatting Helpers ──────────────────────────────────────────────

	describe('formatPercent', () => {
		test('should format with 2 decimal places by default', () => {
			expect(Calc.formatPercent(85.5)).toBe('85.50%');
		});

		test('should handle 0', () => {
			expect(Calc.formatPercent(0)).toBe('0.00%');
		});

		test('should handle null/undefined', () => {
			expect(Calc.formatPercent(null)).toBe('0.00%');
			expect(Calc.formatPercent(undefined)).toBe('0.00%');
		});

		test('should accept custom decimal places', () => {
			expect(Calc.formatPercent(50.123, 1)).toBe('50.1%');
		});
	});

	describe('colorClass', () => {
		test('should return correct color classes', () => {
			expect(Calc.colorClass(100)).toBe('cyan');
			expect(Calc.colorClass(80)).toBe('green');
			expect(Calc.colorClass(60)).toBe('yellow');
			expect(Calc.colorClass(30)).toBe('orange');
			expect(Calc.colorClass(10)).toBe('red');
		});
	});

	describe('renderBar', () => {
		test('should return HTML with correct classes and width', () => {
			const bar = Calc.renderBar(75);
			expect(bar).toContain('oj-completion-bar');
			expect(bar).toContain('oj-completion-fill');
			expect(bar).toContain('width:75%');
			expect(bar).toContain('oj-completion-green');
		});

		test('should clamp value to 0-100', () => {
			const bar = Calc.renderBar(150);
			expect(bar).toContain('width:100%');
		});
	});

	// ─── Patronage Counting ──────────────────────────────────────────────

	describe('countPatronage', () => {
		test('should count hero patronage assignments from JSON string', () => {
			const data = JSON.stringify({ 1: { heroId: 1 }, 2: { heroId: 2 }, 3: { heroId: 3 } });
			expect(Calc.countPatronage(data)).toBe(3);
		});

		test('should count from object directly', () => {
			expect(Calc.countPatronage({ a: 1, b: 2 })).toBe(2);
		});

		test('should return 0 for empty/null/undefined', () => {
			expect(Calc.countPatronage(null)).toBe(0);
			expect(Calc.countPatronage(undefined)).toBe(0);
			expect(Calc.countPatronage('')).toBe(0);
			expect(Calc.countPatronage('{}')).toBe(0);
		});

		test('should return 0 for invalid JSON', () => {
			expect(Calc.countPatronage('not-json{{{')).toBe(0);
		});
	});

	// ─── Edge Cases ──────────────────────────────────────────────────────

	describe('Edge cases', () => {
		test('should clamp values exceeding max', () => {
			const result = Calc.calculateCompletion({
				level: 200,
				stars: 10,
				color: 20,
			});
			expect(result.overall).toBeCloseTo(100, 0);
			expect(result.systems.level).toBeCloseTo(100, 1);
			expect(result.systems.stars).toBeCloseTo(100, 1);
			expect(result.systems.color).toBeCloseTo(100, 1);
		});
	});

	// ─── Weights Validation ──────────────────────────────────────────────

	describe('Weights', () => {
		test('weights should sum to 1.0', () => {
			const sum = Object.values(Calc.WEIGHTS).reduce((a, b) => a + b, 0);
			expect(sum).toBeCloseTo(1.0, 5);
		});

		test('should have 3 weighted systems', () => {
			expect(Object.keys(Calc.WEIGHTS)).toHaveLength(3);
		});
	});

	// ─── System Labels & Icons ───────────────────────────────────────────

	describe('System labels and icons', () => {
		test('should have labels for all weighted systems', () => {
			for (const key of Object.keys(Calc.WEIGHTS)) {
				expect(Calc.SYSTEM_LABELS[key]).toBeDefined();
				expect(Calc.SYSTEM_ICONS[key]).toBeDefined();
			}
		});
	});
});
