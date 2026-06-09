/**
 * Shared cache-first API payload helper.
 */

import { yieldToMainThread } from './cooperativeScheduler.js';

/**
 * Execute HTTP request with fetch-first strategy and Tampermonkey fallback.
 *
 * @param {string} url - Absolute URL
 * @param {{method?:string, headers?:Object, body?:string}} options - Request options
 * @returns {Promise<{ok:boolean,status:number,statusText:string,json:Function,text:Function}>}
 */
async function requestWithFallback(url, options = {}) {
	await yieldToMainThread();
	try {
		return await fetch(url, options);
	} catch (fetchError) {
		try {
			return await requestWithTampermonkey(url, options);
		} catch (gmError) {
			if (String(gmError?.message || '').includes('unavailable')) {
				throw fetchError;
			}
			throw gmError;
		}
	}
}

/**
 * Execute HTTP request via Tampermonkey cross-origin API.
 *
 * @param {string} url - Absolute URL
 * @param {{method?:string, headers?:Object, body?:string}} options - Request options
 * @returns {Promise<{ok:boolean,status:number,statusText:string,json:Function,text:Function}>}
 */
async function requestWithTampermonkey(url, options = {}) {
	const gmRequest = typeof GM_xmlhttpRequest === 'function'
		? GM_xmlhttpRequest
		: (typeof window !== 'undefined' && typeof window.GM_xmlhttpRequest === 'function'
			? window.GM_xmlhttpRequest
			: null);

	if (!gmRequest) {
		throw new Error('GM_xmlhttpRequest unavailable');
	}

	const method = String(options?.method || 'GET').toUpperCase();
	const headers = options?.headers || {};
	const body = options?.body;

	return await new Promise((resolve, reject) => {
		gmRequest({
			method,
			url,
			headers,
			data: body,
			responseType: 'text',
			onload: (response) => {
				const status = Number(response?.status || 0);
				const statusText = String(response?.statusText || '');
				const text = typeof response?.responseText === 'string'
					? response.responseText
					: String(response?.response || '');
				resolve({
					ok: status >= 200 && status < 300,
					status,
					statusText,
					json: async () => JSON.parse(text || '{}'),
					text: async () => text,
				});
			},
			onerror: (error) => reject(new Error(error?.error || error?.message || 'GM request failed')),
			ontimeout: () => reject(new Error('GM request timed out')),
		});
	});
}

/**
 * Resolve API payload with metadata cache fallback.
 *
 * @param {object} params - Fetch params
 * @param {object} params.idbStorage - Metadata storage adapter
 * @param {string} params.cacheKey - Metadata cache key
 * @param {number} params.ttlMs - Cache TTL in milliseconds
 * @param {string} params.requestUrl - Request URL
 * @param {object|null} [params.fallbackPayload=null] - Fallback payload
 * @returns {Promise<object|null>} Payload
 */
export async function getCachedApiPayload(params) {
	const idbStorage = params?.idbStorage;
	const cacheKey = params?.cacheKey;
	const ttlMs = Number(params?.ttlMs || 0);
	const requestUrl = params?.requestUrl;
	const fallbackPayload = params?.fallbackPayload ?? null;
	if (!idbStorage || !cacheKey || !requestUrl) return fallbackPayload;

	const now = Date.now();
	let cached = null;
	try {
		cached = await idbStorage.getMetadata(cacheKey, null);
		if (cached?.timestamp && (now - cached.timestamp) < ttlMs && cached?.payload) {
			return cached.payload;
		}
	} catch {
		cached = null;
	}

	try {
		const response = await requestWithFallback(requestUrl);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		await yieldToMainThread();
		const payload = await response.json();
		await idbStorage.setMetadata(cacheKey, { timestamp: now, payload });
		return payload;
	} catch {
		return cached?.payload || fallbackPayload;
	}
}
