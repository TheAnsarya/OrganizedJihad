/**
 * Tests for heroCompression module (#43)
 *
 * Validates compression/decompression of hero and titan snapshot batches,
 * backward compatibility with legacy individual records, and round-trip
 * data integrity.
 */

import {
	BASE_HERO,
	BASE_TITAN,
	compressHeroBatch,
	compressTitanBatch,
	decompressHeroBatch,
	decompressTitanBatch,
	decompressHeroStore,
	decompressTitanStore,
} from '../src/modules/heroCompression.js';

// ── Test data helpers ───────────────────────────────────────────────────────

/** Build a full hero record with all fields populated */
function makeHero(overrides = {}) {
	return {
		heroId: 1,
		heroName: 'Galahad',
		level: 120,
		stars: 6,
		color: 17,
		power: 450000,
		skins: 5,
		skillLevel1: 120,
		skillLevel2: 120,
		skillLevel3: 120,
		skillLevel4: 120,
		artifactWeapon: 6,
		artifactBook: 6,
		artifactRing: 6,
		rawSkills: '{"101":120,"102":120,"103":120,"104":120}',
		rawSkins: '{"201":60,"202":60,"203":60,"204":60,"205":60}',
		artifactLevels: '[100,100,100]',
		runes: '[43750,43750,43750,43750,43750]',
		titanGiftLevel: 30,
		ascensions: '{"1":[1,1,1]}',
		petId: 5,
		playerId: 'player_123',
		timestamp: '2025-01-23T12:00:00.000Z',
		...overrides,
	};
}

/** Build a hero record with all default/zero values (only identity differs) */
function makeDefaultHero(overrides = {}) {
	return {
		heroId: 99,
		heroName: 'NewHero',
		level: 0,
		stars: 0,
		color: 0,
		power: 0,
		skins: 0,
		skillLevel1: 0,
		skillLevel2: 0,
		skillLevel3: 0,
		skillLevel4: 0,
		artifactWeapon: 0,
		artifactBook: 0,
		artifactRing: 0,
		rawSkills: '{}',
		rawSkins: '{}',
		artifactLevels: '[]',
		runes: '[]',
		titanGiftLevel: 0,
		ascensions: '{}',
		petId: 0,
		playerId: 'player_123',
		timestamp: '2025-01-23T12:00:00.000Z',
		...overrides,
	};
}

/** Build a full titan record */
function makeTitan(overrides = {}) {
	return {
		titanId: 10,
		titanName: 'Hyperion',
		level: 120,
		stars: 6,
		power: 300000,
		skillLevel: 120,
		artifactData: '{"weapon":{"level":100}}',
		summonStars: 6,
		element: 'fire',
		skinLevel: 60,
		playerId: 'player_123',
		timestamp: '2025-01-23T12:00:00.000Z',
		...overrides,
	};
}

// ── compressHeroBatch ───────────────────────────────────────────────────────

describe('compressHeroBatch', () => {
	it('should return null for empty array', () => {
		expect(compressHeroBatch([])).toBeNull();
	});

	it('should return null for non-array input', () => {
		expect(compressHeroBatch(null)).toBeNull();
		expect(compressHeroBatch(undefined)).toBeNull();
		expect(compressHeroBatch('string')).toBeNull();
	});

	it('should extract shared playerId and timestamp into header', () => {
		const heroes = [makeHero({ heroId: 1 }), makeHero({ heroId: 2 })];
		const batch = compressHeroBatch(heroes);

		expect(batch._compressed).toBe(1);
		expect(batch.playerId).toBe('player_123');
		expect(batch.timestamp).toBe('2025-01-23T12:00:00.000Z');
		expect(batch.heroes).toHaveLength(2);
	});

	it('should always include identity fields (heroId, heroName)', () => {
		const heroes = [makeDefaultHero()];
		const batch = compressHeroBatch(heroes);

		expect(batch.heroes[0].heroId).toBe(99);
		expect(batch.heroes[0].heroName).toBe('NewHero');
	});

	it('should omit fields that match BASE_HERO defaults', () => {
		const heroes = [makeDefaultHero()];
		const batch = compressHeroBatch(heroes);
		const delta = batch.heroes[0];

		// Default-value fields should be omitted from the delta
		expect(delta.level).toBeUndefined();
		expect(delta.stars).toBeUndefined();
		expect(delta.color).toBeUndefined();
		expect(delta.power).toBeUndefined();
		expect(delta.skins).toBeUndefined();
		expect(delta.skillLevel1).toBeUndefined();
		expect(delta.rawSkills).toBeUndefined();
		expect(delta.petId).toBeUndefined();
	});

	it('should include fields that differ from BASE_HERO defaults', () => {
		const heroes = [makeHero()];
		const batch = compressHeroBatch(heroes);
		const delta = batch.heroes[0];

		// All non-default fields should be present
		expect(delta.level).toBe(120);
		expect(delta.stars).toBe(6);
		expect(delta.color).toBe(17);
		expect(delta.power).toBe(450000);
		expect(delta.skins).toBe(5);
		expect(delta.titanGiftLevel).toBe(30);
		expect(delta.petId).toBe(5);
	});

	it('should NOT include playerId/timestamp in individual hero deltas', () => {
		const heroes = [makeHero()];
		const batch = compressHeroBatch(heroes);
		const delta = batch.heroes[0];

		// These are in the batch header, not per-hero
		expect(delta.playerId).toBeUndefined();
		expect(delta.timestamp).toBeUndefined();
	});
});

// ── decompressHeroBatch ─────────────────────────────────────────────────────

describe('decompressHeroBatch', () => {
	it('should return empty array for null/undefined/missing _compressed', () => {
		expect(decompressHeroBatch(null)).toEqual([]);
		expect(decompressHeroBatch(undefined)).toEqual([]);
		expect(decompressHeroBatch({})).toEqual([]);
		expect(decompressHeroBatch({ heroes: [] })).toEqual([]);
	});

	it('should restore all BASE_HERO defaults for a minimal delta', () => {
		const batch = {
			_compressed: 1,
			playerId: 'p1',
			timestamp: '2025-01-23T00:00:00Z',
			heroes: [{ heroId: 1, heroName: 'Test' }],
		};
		const result = decompressHeroBatch(batch);

		expect(result).toHaveLength(1);
		expect(result[0].heroId).toBe(1);
		expect(result[0].heroName).toBe('Test');
		expect(result[0].level).toBe(0);
		expect(result[0].stars).toBe(0);
		expect(result[0].rawSkills).toBe('{}');
		expect(result[0].runes).toBe('[]');
		expect(result[0].playerId).toBe('p1');
		expect(result[0].timestamp).toBe('2025-01-23T00:00:00Z');
	});

	it('should override defaults with delta values', () => {
		const batch = {
			_compressed: 1,
			playerId: 'p1',
			timestamp: '2025-01-23T00:00:00Z',
			heroes: [{ heroId: 1, heroName: 'Galahad', level: 120, stars: 6, petId: 5 }],
		};
		const result = decompressHeroBatch(batch);

		expect(result[0].level).toBe(120);
		expect(result[0].stars).toBe(6);
		expect(result[0].petId).toBe(5);
		// Non-overridden fields should be default
		expect(result[0].color).toBe(0);
		expect(result[0].power).toBe(0);
	});
});

// ── Round-trip: compress → decompress ───────────────────────────────────────

describe('Hero compression round-trip', () => {
	it('should perfectly round-trip a fully-populated hero batch', () => {
		const original = [
			makeHero({ heroId: 1, heroName: 'Galahad' }),
			makeHero({ heroId: 2, heroName: 'Keira', power: 380000 }),
			makeDefaultHero({ heroId: 99, heroName: 'NewHero' }),
		];

		const batch = compressHeroBatch(original);
		const restored = decompressHeroBatch(batch);

		expect(restored).toHaveLength(3);

		// Check each hero has the same data after round-trip
		for (let i = 0; i < original.length; i++) {
			const orig = original[i];
			const rest = restored[i];

			// Identity
			expect(rest.heroId).toBe(orig.heroId);
			expect(rest.heroName).toBe(orig.heroName);

			// Shared header fields
			expect(rest.playerId).toBe(orig.playerId);
			expect(rest.timestamp).toBe(orig.timestamp);

			// All BASE_HERO fields
			for (const key of Object.keys(BASE_HERO)) {
				expect(rest[key]).toBe(orig[key]);
			}
		}
	});

	it('should produce a smaller batch than storing individual records', () => {
		const heroes = [];
		for (let i = 1; i <= 100; i++) {
			heroes.push(makeDefaultHero({ heroId: i, heroName: `Hero_${i}` }));
		}

		const individualSize = JSON.stringify(heroes).length;
		const batchSize = JSON.stringify(compressHeroBatch(heroes)).length;

		// Compressed batch should be significantly smaller
		// (100 heroes with all defaults → only identity fields + header)
		expect(batchSize).toBeLessThan(individualSize);
	});
});

// ── compressTitanBatch / decompressTitanBatch ───────────────────────────────

describe('compressTitanBatch', () => {
	it('should return null for empty array', () => {
		expect(compressTitanBatch([])).toBeNull();
	});

	it('should compress titan batch with shared header', () => {
		const titans = [makeTitan({ titanId: 10 }), makeTitan({ titanId: 11 })];
		const batch = compressTitanBatch(titans);

		expect(batch._compressed).toBe(1);
		expect(batch.playerId).toBe('player_123');
		expect(batch.titans).toHaveLength(2);
	});

	it('should omit default titan fields', () => {
		const titans = [{
			titanId: 99,
			titanName: 'NewTitan',
			level: 0,
			stars: 0,
			power: 0,
			skillLevel: 0,
			artifactData: '{}',
			summonStars: 0,
			element: 'unknown',
			skinLevel: 0,
			playerId: 'p1',
			timestamp: '2025-01-23T00:00:00Z',
		}];
		const batch = compressTitanBatch(titans);
		const delta = batch.titans[0];

		// Identity always present
		expect(delta.titanId).toBe(99);
		expect(delta.titanName).toBe('NewTitan');

		// All defaults omitted
		expect(delta.level).toBeUndefined();
		expect(delta.skillLevel).toBeUndefined();
		expect(delta.artifactData).toBeUndefined();
	});
});

describe('decompressTitanBatch', () => {
	it('should restore defaults for minimal delta', () => {
		const batch = {
			_compressed: 1,
			playerId: 'p1',
			timestamp: '2025-01-23T00:00:00Z',
			titans: [{ titanId: 10, titanName: 'Hyperion' }],
		};
		const result = decompressTitanBatch(batch);

		expect(result).toHaveLength(1);
		expect(result[0].level).toBe(0);
		expect(result[0].element).toBe('unknown');
		expect(result[0].artifactData).toBe('{}');
		expect(result[0].playerId).toBe('p1');
	});
});

describe('Titan compression round-trip', () => {
	it('should perfectly round-trip a titan batch', () => {
		const original = [
			makeTitan({ titanId: 10, titanName: 'Hyperion' }),
			makeTitan({ titanId: 11, titanName: 'Eden', element: 'earth', power: 200000 }),
		];

		const batch = compressTitanBatch(original);
		const restored = decompressTitanBatch(batch);

		expect(restored).toHaveLength(2);
		for (let i = 0; i < original.length; i++) {
			for (const key of Object.keys(BASE_TITAN)) {
				expect(restored[i][key]).toBe(original[i][key]);
			}
			expect(restored[i].titanId).toBe(original[i].titanId);
			expect(restored[i].titanName).toBe(original[i].titanName);
			expect(restored[i].playerId).toBe(original[i].playerId);
		}
	});
});

// ── decompressHeroStore (mixed-format backward compatibility) ───────────────

describe('decompressHeroStore', () => {
	it('should return empty array for non-array input', () => {
		expect(decompressHeroStore(null)).toEqual([]);
		expect(decompressHeroStore(undefined)).toEqual([]);
		expect(decompressHeroStore('string')).toEqual([]);
	});

	it('should pass through legacy individual hero records unchanged', () => {
		const legacy = [
			{ heroId: 1, heroName: 'Galahad', level: 120, playerId: 'p1', timestamp: 'T1' },
			{ heroId: 2, heroName: 'Keira', level: 100, playerId: 'p1', timestamp: 'T1' },
		];
		const result = decompressHeroStore(legacy);

		expect(result).toHaveLength(2);
		expect(result[0].heroId).toBe(1);
		expect(result[1].heroId).toBe(2);
		// Legacy records are returned as-is (no BASE_HERO merge)
		expect(result[0].level).toBe(120);
	});

	it('should expand compressed batch records', () => {
		const batch = compressHeroBatch([makeHero({ heroId: 1 }), makeHero({ heroId: 2 })]);
		const result = decompressHeroStore([batch]);

		expect(result).toHaveLength(2);
		expect(result[0].heroId).toBe(1);
		expect(result[1].heroId).toBe(2);
		expect(result[0].playerId).toBe('player_123');
	});

	it('should handle a mix of legacy and compressed records', () => {
		const legacy = { heroId: 50, heroName: 'OldHero', level: 80, playerId: 'p1', timestamp: 'T0' };
		const batch = compressHeroBatch([makeHero({ heroId: 1 })]);
		const result = decompressHeroStore([legacy, batch]);

		expect(result).toHaveLength(2);
		expect(result[0].heroId).toBe(50); // legacy
		expect(result[1].heroId).toBe(1);  // decompressed
	});

	it('should skip records without heroId or _compressed flag', () => {
		const junk = [{ foo: 'bar' }, { name: 'no heroId' }];
		const result = decompressHeroStore(junk);
		expect(result).toEqual([]);
	});
});

// ── decompressTitanStore (mixed-format backward compatibility) ──────────────

describe('decompressTitanStore', () => {
	it('should pass through legacy individual titan records', () => {
		const legacy = [
			{ titanId: 10, titanName: 'Hyperion', level: 120, playerId: 'p1', timestamp: 'T1' },
		];
		const result = decompressTitanStore(legacy);

		expect(result).toHaveLength(1);
		expect(result[0].titanId).toBe(10);
	});

	it('should expand compressed titan batch records', () => {
		const batch = compressTitanBatch([makeTitan({ titanId: 10 }), makeTitan({ titanId: 11 })]);
		const result = decompressTitanStore([batch]);

		expect(result).toHaveLength(2);
	});

	it('should handle mixed legacy and compressed', () => {
		const legacy = { titanId: 99, titanName: 'Old', level: 50, playerId: 'p1', timestamp: 'T0' };
		const batch = compressTitanBatch([makeTitan()]);
		const result = decompressTitanStore([legacy, batch]);

		expect(result).toHaveLength(2);
		expect(result[0].titanId).toBe(99);
		expect(result[1].titanId).toBe(10);
	});
});
