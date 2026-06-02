/**
 * Userscript API connection helpers.
 * Centralizes local API base URL config so overlays and dashboard widgets
 * stay aligned with tray-host/API settings.
 */

/** @const {string} Default local API base URL */
export const DEFAULT_API_BASE_URL = 'http://localhost:5124';

/**
 * Normalize API base URL into a safe absolute http(s) URL without trailing slash.
 *
 * @param {string} value - Raw URL input
 * @returns {string} Normalized base URL
 */
export function normalizeApiBaseUrl(value) {
	const raw = String(value || '').trim();
	if (!raw) return DEFAULT_API_BASE_URL;

	let candidate = raw;
	if (!/^https?:\/\//i.test(candidate)) {
		candidate = `http://${candidate}`;
	}

	try {
		const parsed = new URL(candidate);
		if (!/^https?:$/i.test(parsed.protocol)) {
			return DEFAULT_API_BASE_URL;
		}

		return `${parsed.protocol}//${parsed.host}`;
	} catch {
		return DEFAULT_API_BASE_URL;
	}
}

/**
 * Resolve configured API base URL from preference storage.
 *
 * @param {import('../storageManager.js').default|null|undefined} prefStorage - Preference storage wrapper
 * @returns {string} Normalized API base URL
 */
export function getConfiguredApiBaseUrl(prefStorage) {
	const stored = prefStorage?.get?.('apiBaseUrl', DEFAULT_API_BASE_URL) || DEFAULT_API_BASE_URL;
	return normalizeApiBaseUrl(stored);
}

/**
 * Build a full absolute URL from configured base URL + API path.
 *
 * @param {import('../storageManager.js').default|null|undefined} prefStorage - Preference storage wrapper
 * @param {string} path - Absolute path (for example: /api/sync/health)
 * @returns {string} Absolute URL
 */
export function buildConfiguredApiUrl(prefStorage, path) {
	const baseUrl = getConfiguredApiBaseUrl(prefStorage);
	if (!path) return baseUrl;
	if (/^https?:\/\//i.test(path)) return path;
	return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
}
