/**
 * heroNames.test.js
 *
 * Tests for the static hero/titan/pet name dictionary and
 * helper functions: resolveHeroName, resolveHeroNameWithFallback,
 * resolveTitanElement.
 *
 * Covers: #99
 */

import HERO_NAMES, {
	resolveHeroName,
	resolveHeroNameWithFallback,
	resolveTitanElement,
} from '../src/modules/heroNames.js';

// ═════════════════════════════════════════════════════════════════════
// HERO_NAMES dictionary
// ═════════════════════════════════════════════════════════════════════

describe('HERO_NAMES dictionary', () => {
	test('should be a non-empty object', () => {
		expect(typeof HERO_NAMES).toBe('object');
		expect(Object.keys(HERO_NAMES).length).toBeGreaterThan(80);
	});

	test('should contain heroes (IDs 1–71)', () => {
		expect(HERO_NAMES[1]).toBe('Aurora');
		expect(HERO_NAMES[2]).toBe('Galahad');
		expect(HERO_NAMES[3]).toBe('Keira');
		expect(HERO_NAMES[45]).toBe('Satori');
		expect(HERO_NAMES[71]).toBe('Rosie');
	});

	test('should contain titans (IDs 4000–4043)', () => {
		expect(HERO_NAMES[4000]).toBe('Sigurd');
		expect(HERO_NAMES[4001]).toBe('Nova');
		expect(HERO_NAMES[4010]).toBe('Moloch');
		expect(HERO_NAMES[4020]).toBe('Angus');
		expect(HERO_NAMES[4030]).toBe('Brustar');
		expect(HERO_NAMES[4040]).toBe('Rigel');
		expect(HERO_NAMES[4043]).toBe('Solaris');
	});

	test('should contain all 21 titans', () => {
		const titanKeys = Object.keys(HERO_NAMES)
			.map(Number)
			.filter((id) => id >= 4000 && id < 5000);
		expect(titanKeys).toHaveLength(21);
	});

	test('should contain pets (IDs 6000–6009)', () => {
		expect(HERO_NAMES[6000]).toBe('Fenris');
		expect(HERO_NAMES[6001]).toBe('Oliver');
		expect(HERO_NAMES[6009]).toBe('Vex');
	});

	test('should contain all 10 pets', () => {
		const petKeys = Object.keys(HERO_NAMES)
			.map(Number)
			.filter((id) => id >= 6000 && id < 7000);
		expect(petKeys).toHaveLength(10);
	});

	test('all values should be non-empty strings', () => {
		for (const [id, name] of Object.entries(HERO_NAMES)) {
			expect(typeof name).toBe('string');
			expect(name.length).toBeGreaterThan(0);
		}
	});

	test('should not have duplicate names', () => {
		const names = Object.values(HERO_NAMES);
		const unique = new Set(names);
		expect(unique.size).toBe(names.length);
	});
});

// ═════════════════════════════════════════════════════════════════════
// resolveHeroName
// ═════════════════════════════════════════════════════════════════════

describe('resolveHeroName', () => {
	test('should resolve known hero IDs', () => {
		expect(resolveHeroName(1)).toBe('Aurora');
		expect(resolveHeroName(4)).toBe('Astaroth');
		expect(resolveHeroName(41)).toBe("K'arkh");
		expect(resolveHeroName(60)).toBe('Mushy & Shroom');
	});

	test('should resolve known titan IDs', () => {
		expect(resolveHeroName(4000)).toBe('Sigurd');
		expect(resolveHeroName(4013)).toBe('Araji');
		expect(resolveHeroName(4043)).toBe('Solaris');
	});

	test('should resolve known pet IDs', () => {
		expect(resolveHeroName(6000)).toBe('Fenris');
		expect(resolveHeroName(6004)).toBe('Cain');
		expect(resolveHeroName(6007)).toBe('Biscuit');
	});

	test('should return fallback for unknown IDs', () => {
		expect(resolveHeroName(9999)).toBe('Hero_9999');
		expect(resolveHeroName(0)).toBe('Hero_0');
		expect(resolveHeroName(100)).toBe('Hero_100');
	});

	test('should return fallback for undefined/null', () => {
		expect(resolveHeroName(undefined)).toBe('Hero_undefined');
		expect(resolveHeroName(null)).toBe('Hero_null');
	});

	test('should handle string IDs via object key coercion', () => {
		// JS object keys are strings; HERO_NAMES[1] === HERO_NAMES['1']
		expect(resolveHeroName('1')).toBe('Aurora');
		expect(resolveHeroName('4000')).toBe('Sigurd');
		expect(resolveHeroName('6000')).toBe('Fenris');
	});
});

// ═════════════════════════════════════════════════════════════════════
// resolveHeroNameWithFallback
// ═════════════════════════════════════════════════════════════════════

describe('resolveHeroNameWithFallback', () => {
	test('should prefer stored name when not a fallback pattern', () => {
		expect(resolveHeroNameWithFallback(1, 'CustomName')).toBe('CustomName');
		expect(resolveHeroNameWithFallback(9999, 'MyHero')).toBe('MyHero');
	});

	test('should fall back to dictionary when stored name is null', () => {
		expect(resolveHeroNameWithFallback(1, null)).toBe('Aurora');
		expect(resolveHeroNameWithFallback(4000, null)).toBe('Sigurd');
	});

	test('should fall back to dictionary when stored name is undefined', () => {
		expect(resolveHeroNameWithFallback(1, undefined)).toBe('Aurora');
	});

	test('should fall back to dictionary when stored name is empty', () => {
		expect(resolveHeroNameWithFallback(1, '')).toBe('Aurora');
	});

	test('should fall back to dictionary when stored name is Hero_NNN pattern', () => {
		expect(resolveHeroNameWithFallback(1, 'Hero_1')).toBe('Aurora');
		expect(resolveHeroNameWithFallback(4000, 'Hero_4000')).toBe('Sigurd');
	});

	test('should return Hero_id when unknown and stored name is fallback', () => {
		expect(resolveHeroNameWithFallback(9999, 'Hero_9999')).toBe('Hero_9999');
		expect(resolveHeroNameWithFallback(9999, null)).toBe('Hero_9999');
	});
});

// ═════════════════════════════════════════════════════════════════════
// resolveTitanElement
// ═════════════════════════════════════════════════════════════════════

describe('resolveTitanElement', () => {
	test('should resolve water titans (40_0_x)', () => {
		expect(resolveTitanElement(4000)).toBe('water');
		expect(resolveTitanElement(4001)).toBe('water');
		expect(resolveTitanElement(4003)).toBe('water');
	});

	test('should resolve fire titans (40_1_x)', () => {
		expect(resolveTitanElement(4010)).toBe('fire');
		expect(resolveTitanElement(4013)).toBe('fire');
	});

	test('should resolve earth titans (40_2_x)', () => {
		expect(resolveTitanElement(4020)).toBe('earth');
		expect(resolveTitanElement(4024)).toBe('earth');
	});

	test('should resolve dark titans (40_3_x)', () => {
		expect(resolveTitanElement(4030)).toBe('dark');
		expect(resolveTitanElement(4033)).toBe('dark');
	});

	test('should resolve light titans (40_4_x)', () => {
		expect(resolveTitanElement(4040)).toBe('light');
		expect(resolveTitanElement(4043)).toBe('light');
	});

	test('should return unknown for short IDs (fewer than 3 digits)', () => {
		expect(resolveTitanElement(1)).toBe('unknown');
		expect(resolveTitanElement(99)).toBe('unknown');
	});

	test('should derive element from 3rd digit regardless of range', () => {
		// The function only reads position [2] of the string — it does
		// NOT validate that the ID belongs to the 4000-series.
		expect(resolveTitanElement(6000)).toBe('water');
		expect(resolveTitanElement(6010)).toBe('fire');
	});
});
