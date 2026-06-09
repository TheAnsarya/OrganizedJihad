#!/usr/bin/env node
/**
 * Benchmark dispatchSortedResults throughput under cooperative scheduling.
 * Run: yarn benchmark:dispatch
 */

import { dispatchSortedResults } from '../src/modules/trackers/GameTrackerResponseDispatchHelpers.js';

function elapsedMs(startNs, endNs) {
	return Number(endNs - startNs) / 1_000_000;
}

function buildBatch(size) {
	const sortedResults = [];
	const callMap = {};
	const callArgs = {};

	for (let i = 0; i < size; i++) {
		const ident = `id_${i}`;
		sortedResults.push({
			ident,
			result: { response: { index: i, power: i * 3 } },
		});
		callMap[ident] = 'userGetInfo';
		callArgs[ident] = { idx: i };
	}

	return { sortedResults, callMap, callArgs };
}

function buildTracker(yieldEveryCount) {
	const handler = async () => {};

	return {
		_handlerRegistry: new Map([
			['userGetInfo', [{ handler, label: 'bench', dependsOn: [], category: 'player' }]],
		]),
		_trackingPrefs: { player: true },
		_logError: async () => {},
		_cooperativeYieldEvery: yieldEveryCount,
	};
}

const sampleSizes = [100, 500, 1500];
const iterations = 20;

console.log('Dispatch Cooperative Benchmark');
console.log(`Iterations per sample: ${iterations}`);
console.log('');

for (const sampleSize of sampleSizes) {
	const { sortedResults, callMap, callArgs } = buildBatch(sampleSize);

	const noYieldTracker = buildTracker(0);
	const withYieldTracker = buildTracker(6);

	const noYieldStart = process.hrtime.bigint();
	for (let i = 0; i < iterations; i++) {
		await dispatchSortedResults(noYieldTracker, sortedResults, callMap, callArgs);
	}
	const noYieldEnd = process.hrtime.bigint();

	const withYieldStart = process.hrtime.bigint();
	for (let i = 0; i < iterations; i++) {
		await dispatchSortedResults(withYieldTracker, sortedResults, callMap, callArgs);
	}
	const withYieldEnd = process.hrtime.bigint();

	const noYieldMs = elapsedMs(noYieldStart, noYieldEnd);
	const withYieldMs = elapsedMs(withYieldStart, withYieldEnd);

	console.log(`SampleSize=${sampleSize}`);
	console.log(`  No-yield total:   ${noYieldMs.toFixed(2)} ms (${(noYieldMs / iterations).toFixed(4)} ms/op)`);
	console.log(`  Yield(6) total:   ${withYieldMs.toFixed(2)} ms (${(withYieldMs / iterations).toFixed(4)} ms/op)`);
	console.log(`  Overhead:         ${(withYieldMs - noYieldMs).toFixed(2)} ms`);
	console.log('');
}
