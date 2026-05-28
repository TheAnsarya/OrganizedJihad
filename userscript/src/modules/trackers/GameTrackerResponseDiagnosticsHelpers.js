/**
 * GameTrackerResponseDiagnosticsHelpers.js
 *
 * Helpers for malformed response diagnostics and dispatch console output.
 */

/**
 * Safely render object keys as a comma-separated string.
 *
 * @param {any} value
 * @returns {string}
 */
export function safeObjectKeys(value) {
	if (!value) {
		return '(null)';
	}
	try {
		return Object.keys(value).join(', ');
	} catch {
		return '(null)';
	}
}

/**
 * Safely render a short JSON snippet for diagnostics.
 *
 * @param {any} value
 * @returns {string}
 */
export function safeJsonSnippet(value) {
	if (!value) {
		return '(null)';
	}
	try {
		return JSON.stringify(value)?.substring(0, 200) || '(null)';
	} catch {
		return `(unstringifiable: ${typeof value})`;
	}
}

/**
 * Build diagnostics metadata for unexpected API payload shape.
 *
 * @param {any} request
 * @param {any} response
 * @param {string} pageHost
 * @param {string} url
 * @returns {{detail: string, errorDetail: string, warningContext: {requestKeys: string, responseKeys: string, requestSnippet: string, responseSnippet: string, page: string}, apiLogPayload: {callNames: string[], status: string, detail: string, error: string, url: string}}}
 */
export function buildUnexpectedFormatDiagnostics(request, response, pageHost, url) {
	const requestKeys = safeObjectKeys(request);
	const responseKeys = safeObjectKeys(response);
	const requestSnippet = safeJsonSnippet(request);
	const responseSnippet = safeJsonSnippet(response);
	const detail = `No .calls/.results | req keys=[${requestKeys}] res keys=[${responseKeys}]`;
	const errorDetail = `req: ${requestSnippet} | res: ${responseSnippet}`;

	return {
		detail,
		errorDetail,
		warningContext: {
			requestKeys,
			responseKeys,
			requestSnippet,
			responseSnippet,
			page: pageHost,
		},
		apiLogPayload: {
			callNames: [],
			status: 'skipped',
			detail,
			error: errorDetail,
			url,
		},
	};
}

/**
 * Build dispatch console messages for success/no-match/error paths.
 *
 * @param {string[]} dispatched
 * @param {string[]} unhandled
 * @param {string[]} errors
 * @param {string[]} allCallNames
 * @returns {{successMessage: string|null, noMatchMessage: string|null, errorMessage: string|null}}
 */
export function buildDispatchConsoleMessages(dispatched, unhandled, errors, allCallNames) {
	const successMessage = dispatched.length > 0
		? `%c[OJ]%c ✓ Dispatched: ${dispatched.join(', ')}` + (unhandled.length > 0 ? ` | Skipped: ${unhandled.length}` : '')
		: null;
	const noMatchMessage = dispatched.length === 0
		? `%c[OJ]%c ○ No handlers matched: ${allCallNames.join(', ')}`
		: null;
	const errorMessage = errors.length > 0
		? `%c[OJ]%c ✗ Handler errors: ${errors.join('; ')}`
		: null;

	return {
		successMessage,
		noMatchMessage,
		errorMessage,
	};
}
