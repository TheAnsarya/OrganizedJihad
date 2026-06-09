#!/usr/bin/env node
/**
 * Lightweight userscript benchmark for hero compression throughput.
 * Run: yarn benchmark:compression
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
		playerId: 'bench_player',
		timestamp: '2026-06-05T00:00:00.000Z',
	};
}

function elapsedMs(startNs, endNs) {
	return Number(endNs - startNs) / 1_000_000;
}

const sampleSizes = [200, 1000, 5000];
const iterations = 250;

console.log('Hero Compression Benchmark');
console.log(`Iterations per sample: ${iterations}`);
console.log('');

for (const sampleSize of sampleSizes) {
	const heroes = Array.from({ length: sampleSize }, (_, index) => buildHero(index));

	const compressStart = process.hrtime.bigint();
	for (let i = 0; i < iterations; i++) {
		compressHeroBatch(heroes);
	}
	const compressEnd = process.hrtime.bigint();

	const batch = compressHeroBatch(heroes);
	const decompressStart = process.hrtime.bigint();
	for (let i = 0; i < iterations; i++) {
		decompressHeroBatch(batch);
	}
	const decompressEnd = process.hrtime.bigint();

	const compressMs = elapsedMs(compressStart, compressEnd);
	const decompressMs = elapsedMs(decompressStart, decompressEnd);
	const rawBytes = Buffer.byteLength(JSON.stringify(heroes), 'utf8');
	const compressedBytes = Buffer.byteLength(JSON.stringify(batch), 'utf8');
	const reduction = ((1 - compressedBytes / rawBytes) * 100).toFixed(2);

	console.log(`SampleSize=${sampleSize}`);
	console.log(`  Compress total:   ${compressMs.toFixed(2)} ms (${(compressMs / iterations).toFixed(4)} ms/op)`);
	console.log(`  Decompress total: ${decompressMs.toFixed(2)} ms (${(decompressMs / iterations).toFixed(4)} ms/op)`);
	console.log(`  Size reduction:   ${reduction}% (${compressedBytes}/${rawBytes} bytes)`);
	console.log('');
}
