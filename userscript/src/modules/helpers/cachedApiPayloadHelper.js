/**
 * Shared cache-first API payload helper.
 */

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
		const response = await fetch(requestUrl);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const payload = await response.json();
		await idbStorage.setMetadata(cacheKey, { timestamp: now, payload });
		return payload;
	} catch {
		return cached?.payload || fallbackPayload;
	}
}
