/**
 * GameTrackerResponseDispatchHelpers.js
 *
 * Shared helpers for processAPIResponse result ordering, dispatch,
 * payload projection, and status synthesis.
 */

/**
 * Build dependency-aware ordered result list from raw API results.
 *
 * @param {Array<{ident: string, result?: {response?: any}}>} responseResults
 * @param {Object<string, string>} callMap
 * @param {(methodNames: string[]) => string[]} sortMethods
 * @returns {{sortedResults: any[], methodOrder: string[], uniqueMethods: string[], sortedMethods: string[]}}
 */
export function buildSortedResults(responseResults, callMap, sortMethods) {
	const resultsByIdent = new Map();
	for (const result of responseResults) {
		resultsByIdent.set(result.ident, result);
	}

	const identOrder = responseResults.map((result) => result.ident);
	const methodOrder = identOrder.map((ident) => callMap[ident]).filter(Boolean);
	const uniqueMethods = [...new Set(methodOrder)];
	const sortedMethods = sortMethods(uniqueMethods);

	const sortedResults = [];
	for (const method of sortedMethods) {
		for (const ident of identOrder) {
			if (callMap[ident] === method && resultsByIdent.has(ident)) {
				sortedResults.push(resultsByIdent.get(ident));
				resultsByIdent.delete(ident);
			}
		}
	}

	for (const ident of identOrder) {
		if (resultsByIdent.has(ident)) {
			sortedResults.push(resultsByIdent.get(ident));
		}
	}

	return {
		sortedResults,
		methodOrder,
		uniqueMethods,
		sortedMethods,
	};
}

/**
 * Dispatch sorted API results through tracker handler registry.
 *
 * @param {any} tracker
 * @param {Array<{ident: string, result?: {response?: any}}>} sortedResults
 * @param {Object<string, string>} callMap
 * @param {Object<string, any>} callArgs
 * @returns {Promise<{dispatched: string[], unhandled: string[], errors: string[]}>}
 */
export async function dispatchSortedResults(tracker, sortedResults, callMap, callArgs) {
	const dispatched = [];
	const unhandled = [];
	const errors = [];

	for (const result of sortedResults) {
		const callName = callMap[result.ident];
		const args = callArgs[result.ident];
		const responseData = result.result?.response;

		if (!responseData) {
			if (callName) {
				unhandled.push(callName + '(no data)');
			}
			continue;
		}

		const handlers = tracker._handlerRegistry.get(callName);
		if (!handlers || handlers.length === 0) {
			if (callName) {
				unhandled.push(callName);
			}
			continue;
		}

		for (const entry of handlers) {
			if (entry.category && !tracker._trackingPrefs[entry.category]) {
				continue;
			}

			try {
				await entry.handler.call(tracker, callName, args, responseData);
				if (!dispatched.includes(callName)) {
					dispatched.push(callName);
				}
			} catch (error) {
				console.error(`[OrganizedJihad] Error in handler "${entry.label}" for ${callName}:`, error);
				errors.push(`${callName}/${entry.label}: ${error?.message || String(error)}`);
				await tracker._logError(`processAPIResponse:${callName}:${entry.label}`, error);
			}
		}
	}

	return { dispatched, unhandled, errors };
}

/**
 * Update API sample map for a call when the call has no prior sample.
 *
 * @param {any} tracker
 * @param {string} callName
 * @param {any} args
 * @param {any} responseData
 */
export function maybeCaptureApiSample(tracker, callName, args, responseData) {
	if (!callName || !responseData || tracker._apiSamples.has(callName)) {
		return;
	}

	try {
		const responseString = JSON.stringify(responseData);
		const sampleEntry = responseString.length <= tracker._apiSampleMaxResponseSize
			? {
				args: JSON.parse(JSON.stringify(args || {})),
				response: JSON.parse(responseString),
				capturedAt: new Date().toISOString(),
				responseSize: responseString.length,
			}
			: {
				args: JSON.parse(JSON.stringify(args || {})),
				response: `[too large: ${responseString.length} bytes — increase _apiSampleMaxResponseSize to capture]`,
				capturedAt: new Date().toISOString(),
				responseSize: responseString.length,
			};

		tracker._apiSamples.set(callName, sampleEntry);
		if (tracker._apiSamples.size > tracker._apiSampleMaxMethods) {
			const oldestKey = tracker._apiSamples.keys().next().value;
			tracker._apiSamples.delete(oldestKey);
		}
	} catch {
		// Ignore unstringifiable responses.
	}
}

/**
 * Build API log payload projection for sorted results.
 *
 * @param {any} tracker
 * @param {Array<{ident: string, result?: {response?: any}}>} sortedResults
 * @param {Object<string, string>} callMap
 * @param {Object<string, any>} callArgs
 * @returns {Object<string, {args: any, response: any}>}
 */
export function buildApiPayload(tracker, sortedResults, callMap, callArgs) {
	const payload = {};

	for (const result of sortedResults) {
		const callName = callMap[result.ident];
		if (!callName) {
			continue;
		}

		const args = callArgs[result.ident];
		const responseData = result.result?.response;
		maybeCaptureApiSample(tracker, callName, args, responseData);

		try {
			const argsString = JSON.stringify(args);
			const responseString = JSON.stringify(responseData);
			payload[callName] = {
				args: argsString.length > 2000 ? JSON.parse(argsString.substring(0, 2000) + '..."') : args,
				response: responseString.length > 5000 ? `[truncated: ${responseString.length} bytes]` : responseData,
			};
		} catch {
			payload[callName] = {
				args,
				response: '[unstringifiable]',
			};
		}
	}

	return payload;
}

/**
 * Build status and detail strings for API log entries.
 *
 * @param {string[]} dispatched
 * @param {string[]} unhandled
 * @param {string[]} errors
 * @returns {{status: 'ok'|'error'|'no-match', detail: string}}
 */
export function buildDispatchStatus(dispatched, unhandled, errors) {
	const status = errors.length > 0 ? 'error' : (dispatched.length > 0 ? 'ok' : 'no-match');
	const detail = dispatched.length > 0
		? `Dispatched: ${dispatched.join(', ')}` + (unhandled.length > 0 ? ` | Unhandled: ${unhandled.join(', ')}` : '')
		: `Unhandled: ${unhandled.join(', ') || 'none'}`;

	return { status, detail };
}
