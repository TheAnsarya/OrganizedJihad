/**
 * Scale-focused regression tests for hero compression payloads.
 */

import {
	compressHeroBatch,
	decompressHeroBatch,
} from '../src/modules/heroCompression.js';

function buildHero(index) {
	return {
		heroId: index + 1,
		heroName: `Hero_${index + 1}`,
		level: index % 2 === 0 ? 120 : 0,
		stars: index % 3 === 0 ? 6 : 0,
		color: index % 4 === 0 ? 17 : 0,
		power: index % 2 === 0 ? 220000 + index : 0,
		skins: 0,
		skillLevel1: index % 2 === 0 ? 120 : 0,
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
		playerId: 'scale_player',
		timestamp: '2026-06-05T00:00:00.000Z',
	};
}

describe('heroCompression scale behavior', () => {
	it('should round-trip a large hero batch', () => {
		const heroes = Array.from({ length: 1000 }, (_, index) => buildHero(index));

		const batch = compressHeroBatch(heroes);
		const restored = decompressHeroBatch(batch);

		expect(batch).not.toBeNull();
		expect(batch.heroes).toHaveLength(1000);
		expect(restored).toHaveLength(1000);
		expect(restored[0].heroId).toBe(1);
		expect(restored[999].heroId).toBe(1000);
		expect(restored[500].playerId).toBe('scale_player');
	});

	it('should keep compressed payload smaller than raw payload for sparse data', () => {
		const heroes = Array.from({ length: 1000 }, (_, index) => buildHero(index));
		const batch = compressHeroBatch(heroes);

		const rawBytes = Buffer.byteLength(JSON.stringify(heroes), 'utf8');
		const compressedBytes = Buffer.byteLength(JSON.stringify(batch), 'utf8');

		expect(compressedBytes).toBeLessThan(rawBytes);
	});
});
