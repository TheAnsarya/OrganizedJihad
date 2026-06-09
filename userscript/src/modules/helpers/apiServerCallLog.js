/**
 * In-memory log for userscript -> local API server calls.
 *
 * This log is intentionally separate from game API interception logs so the
 * Connection tab can focus only on local API server connectivity and traffic.
 */

const MAX_API_SERVER_CALLS = 200;
let _nextApiServerCallId = 1;

/** @type {Array<{ts:number,method:string,url:string,path:string,status:number,statusText:string,ok:boolean,latencyMs:number,error:string}>} */
const _apiServerCalls = [];
/** @type {Map<number, {id:number,ts:number,method:string,url:string,path:string}>} */
const _inFlightApiServerCalls = new Map();

/** @type {Set<(entry: object) => void>} */
const _listeners = new Set();

/**
 * Resolve normalized absolute URL string.
 *
 * @param {string} rawUrl
 * @returns {string|null}
 */
function _toAbsoluteUrl(rawUrl) {
	try {
		return new URL(rawUrl, window.location.origin).toString();
	} catch {
		return null;
	}
}

/**
 * Check whether a URL points to the configured local API server origin.
 *
 * @param {string} rawUrl
 * @param {string} apiBaseUrl
 * @returns {boolean}
 */
export function isLocalApiServerUrl(rawUrl, apiBaseUrl) {
	const absoluteUrl = _toAbsoluteUrl(rawUrl);
	if (!absoluteUrl) return false;

	try {
		const target = new URL(absoluteUrl);
		const base = new URL(apiBaseUrl);
		return target.origin === base.origin;
	} catch {
		return false;
	}
}

/**
 * Append a local API server call entry.
 *
 * @param {{method?:string,url?:string,status?:number,statusText?:string,ok?:boolean,latencyMs?:number,error?:string}} entry
 */
export function recordApiServerCall(entry = {}) {
	const resolvedUrl = _toAbsoluteUrl(String(entry.url || ''));
	if (!resolvedUrl) return;

	let path = '/';
	try {
		const parsed = new URL(resolvedUrl);
		path = `${parsed.pathname}${parsed.search || ''}`;
	} catch {
		path = '/';
	}

	const normalized = {
		ts: Date.now(),
		method: String(entry.method || 'GET').toUpperCase(),
		url: resolvedUrl,
		path,
		status: Number(entry.status || 0),
		statusText: String(entry.statusText || ''),
		ok: Boolean(entry.ok),
		latencyMs: Math.max(0, Number(entry.latencyMs || 0)),
		error: String(entry.error || ''),
	};

	_apiServerCalls.push(normalized);
	if (_apiServerCalls.length > MAX_API_SERVER_CALLS) {
		_apiServerCalls.splice(0, _apiServerCalls.length - MAX_API_SERVER_CALLS);
	}

	for (const listener of _listeners) {
		try {
			listener(normalized);
		} catch {
			// best effort
		}
	}
}

/**
 * Mark start of an in-flight local API server call.
 *
 * @param {{method?:string,url?:string}} entry
 * @returns {number|null} Call id when tracked, otherwise null
 */
export function startApiServerCall(entry = {}) {
	const resolvedUrl = _toAbsoluteUrl(String(entry.url || ''));
	if (!resolvedUrl) return null;

	let path = '/';
	try {
		const parsed = new URL(resolvedUrl);
		path = `${parsed.pathname}${parsed.search || ''}`;
	} catch {
		path = '/';
	}

	const id = _nextApiServerCallId++;
	_inFlightApiServerCalls.set(id, {
		id,
		ts: Date.now(),
		method: String(entry.method || 'GET').toUpperCase(),
		url: resolvedUrl,
		path,
	});

	return id;
}

/**
 * Mark finish of an in-flight local API server call.
 *
 * @param {number|null} id
 */
export function finishApiServerCall(id) {
	if (typeof id !== 'number') return;
	_inFlightApiServerCalls.delete(id);
}

/**
 * Get local API server call log in insertion order.
 *
 * @returns {Array<object>}
 */
export function getApiServerCallLog() {
	return _apiServerCalls.slice();
}

/**
 * Get in-flight local API server calls.
 *
 * @returns {Array<{id:number,ts:number,method:string,url:string,path:string}>}
 */
export function getApiServerInFlightCalls() {
	return Array.from(_inFlightApiServerCalls.values());
}

/**
 * Subscribe to local API server call updates.
 *
 * @param {(entry: object) => void} listener
 * @returns {() => void}
 */
export function onApiServerCall(listener) {
	if (typeof listener !== 'function') {
		return () => undefined;
	}

	_listeners.add(listener);
	return () => {
		_listeners.delete(listener);
	};
}

/**
 * Clear local API server call log.
 */
export function clearApiServerCallLog() {
	_apiServerCalls.length = 0;
	_inFlightApiServerCalls.clear();
}
