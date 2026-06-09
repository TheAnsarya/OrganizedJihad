import {
	buildApiPayload,
	buildDispatchStatus,
	buildSortedResults,
	dispatchSortedResults,
	maybeCaptureApiSample,
} from '../src/modules/trackers/GameTrackerResponseDispatchHelpers.js';

describe('GameTrackerResponseDispatchHelpers', () => {
	test('buildSortedResults orders by dependency-sorted methods then appends unmapped', () => {
		const results = [
			{ ident: 'hero', result: { response: { ok: 1 } } },
			{ ident: 'user', result: { response: { ok: 1 } } },
			{ ident: 'unknown', result: { response: { ok: 1 } } },
		];
		const callMap = {
			hero: 'heroGetAll',
			user: 'userGetInfo',
		};
		const sortMethods = jest.fn(() => ['userGetInfo', 'heroGetAll']);

		const ordered = buildSortedResults(results, callMap, sortMethods);
		expect(ordered.sortedResults.map((r) => r.ident)).toEqual(['user', 'hero', 'unknown']);
		expect(ordered.uniqueMethods).toEqual(['heroGetAll', 'userGetInfo']);
	});

	test('dispatchSortedResults dispatches handlers and tracks unhandled/errors', async () => {
		const handler = jest.fn(async () => {});
		const failing = jest.fn(async () => {
			throw new Error('boom');
		});
		const tracker = {
			_handlerRegistry: new Map([
				['userGetInfo', [{ handler, label: 'user', dependsOn: [], category: 'player' }]],
				['heroGetAll', [{ handler: failing, label: 'hero', dependsOn: [], category: 'player' }]],
			]),
			_trackingPrefs: { player: true },
			_logError: jest.fn(async () => {}),
		};
		const sortedResults = [
			{ ident: 'user', result: { response: { x: 1 } } },
			{ ident: 'hero', result: { response: { y: 1 } } },
			{ ident: 'missing', result: { response: { z: 1 } } },
			{ ident: 'nodata', result: { response: null } },
		];
		const callMap = { user: 'userGetInfo', hero: 'heroGetAll', missing: 'unknownCall', nodata: 'nodataCall' };
		const callArgs = { user: {}, hero: {}, missing: {}, nodata: {} };

		const result = await dispatchSortedResults(tracker, sortedResults, callMap, callArgs);
		expect(result.dispatched).toEqual(['userGetInfo']);
		expect(result.unhandled).toContain('unknownCall');
		expect(result.unhandled).toContain('nodataCall(no data)');
		expect(result.errors[0]).toContain('heroGetAll/hero');
		expect(tracker._logError).toHaveBeenCalled();
	});

	test('dispatchSortedResults skips disabled categories', async () => {
		const handler = jest.fn(async () => {});
		const tracker = {
			_handlerRegistry: new Map([
				['arenaAttack', [{ handler, label: 'arena', dependsOn: [], category: 'battles' }]],
			]),
			_trackingPrefs: { battles: false },
			_logError: jest.fn(async () => {}),
		};
		const sortedResults = [{ ident: 'a', result: { response: { ok: true } } }];
		const callMap = { a: 'arenaAttack' };
		const callArgs = { a: {} };

		const result = await dispatchSortedResults(tracker, sortedResults, callMap, callArgs);
		expect(handler).not.toHaveBeenCalled();
		expect(result.dispatched).toEqual([]);
	});

	test('dispatchSortedResults performs cooperative yields on large batches', async () => {
		const handler = jest.fn(async () => {});
		const cooperativeYield = jest.fn(async () => {});
		const tracker = {
			_handlerRegistry: new Map([
				['userGetInfo', [{ handler, label: 'user', dependsOn: [], category: 'player' }]],
			]),
			_trackingPrefs: { player: true },
			_logError: jest.fn(async () => {}),
			_cooperativeYieldEvery: 2,
			_cooperativeYield: cooperativeYield,
		};

		const sortedResults = [
			{ ident: 'a', result: { response: { ok: 1 } } },
			{ ident: 'b', result: { response: { ok: 1 } } },
			{ ident: 'c', result: { response: { ok: 1 } } },
			{ ident: 'd', result: { response: { ok: 1 } } },
		];
		const callMap = {
			a: 'userGetInfo',
			b: 'userGetInfo',
			c: 'userGetInfo',
			d: 'userGetInfo',
		};
		const callArgs = { a: {}, b: {}, c: {}, d: {} };

		await dispatchSortedResults(tracker, sortedResults, callMap, callArgs);

		expect(handler).toHaveBeenCalledTimes(4);
		expect(cooperativeYield).toHaveBeenCalledTimes(2);
	});

	test('maybeCaptureApiSample stores sample and evicts oldest when capped', () => {
		const tracker = {
			_apiSamples: new Map([['old', { keep: false }]]),
			_apiSampleMaxResponseSize: 1000,
			_apiSampleMaxMethods: 1,
		};

		maybeCaptureApiSample(tracker, 'newMethod', { a: 1 }, { b: 2 });
		expect(tracker._apiSamples.has('newMethod')).toBe(true);
		expect(tracker._apiSamples.has('old')).toBe(false);
	});

	test('buildApiPayload truncates large response and handles unstringifiable payloads', () => {
		const tracker = {
			_apiSamples: new Map(),
			_apiSampleMaxResponseSize: 10,
			_apiSampleMaxMethods: 10,
		};
		const largeResponse = { payload: 'x'.repeat(6000) };
		const sortedResults = [
			{ ident: 'large', result: { response: largeResponse } },
			{ ident: 'weird', result: { response: { circular: null } } },
		];
		sortedResults[1].result.response.circular = sortedResults[1].result.response;
		const callMap = { large: 'bigCall', weird: 'weirdCall' };
		const callArgs = { large: { x: 1 }, weird: { y: 2 } };

		const payload = buildApiPayload(tracker, sortedResults, callMap, callArgs);
		expect(payload.bigCall.response).toContain('[truncated:');
		expect(payload.weirdCall.response).toBe('[unstringifiable]');
	});

	test('buildDispatchStatus synthesizes ok/no-match/error outcomes', () => {
		expect(buildDispatchStatus(['a'], [], [])).toEqual({ status: 'ok', detail: 'Dispatched: a' });
		expect(buildDispatchStatus([], ['x'], [])).toEqual({ status: 'no-match', detail: 'Unhandled: x' });
		expect(buildDispatchStatus(['a'], ['x'], ['err'])).toEqual({
			status: 'error',
			detail: 'Dispatched: a | Unhandled: x',
		});
	});
});
