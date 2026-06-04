import { buildDispatchStatus } from './GameTrackerResponseDispatchHelpers.js';
import { buildDispatchConsoleMessages } from './GameTrackerResponseDiagnosticsHelpers.js';

/** @type {{success: string, successDim: string, noMatch: string, noMatchDim: string, error: string, errorDim: string}} */
export const DISPATCH_CONSOLE_COLORS = {
	success: 'color:#4CAF50;font-weight:bold',
	successDim: 'color:#8BC34A',
	noMatch: 'color:#FF9800;font-weight:bold',
	noMatchDim: 'color:#FFB74D',
	error: 'color:#F44336;font-weight:bold',
	errorDim: 'color:#EF9A9A',
};

/**
 * Convert dispatch errors array to API-log error detail string.
 *
 * @param {string[]} errors
 * @returns {string|null}
 */
export function buildDispatchErrorDetail(errors) {
	return errors.length > 0 ? errors.join('; ') : null;
}

/**
 * Push dispatch cycle entry to API log buffer.
 *
 * @param {any} tracker
 * @param {string[]} callNames
 * @param {'ok'|'error'|'no-match'} status
 * @param {string} detail
 * @param {string[]|null} errors
 * @param {string} url
 * @param {Object<string, any>} payload
 */
export function pushDispatchApiLogEntry(tracker, callNames, status, detail, errors, url, payload) {
	tracker._pushApiLog(callNames, status, detail, buildDispatchErrorDetail(errors || []), url, payload);
}

/**
 * Emit dispatch summary console messages.
 *
 * @param {{successMessage: string|null, noMatchMessage: string|null, errorMessage: string|null}} messages
 */
export function emitDispatchConsoleMessages(messages) {
	if (messages.successMessage) {
		console.log(messages.successMessage, DISPATCH_CONSOLE_COLORS.success, DISPATCH_CONSOLE_COLORS.successDim);
	}
	if (messages.noMatchMessage) {
		console.log(messages.noMatchMessage, DISPATCH_CONSOLE_COLORS.noMatch, DISPATCH_CONSOLE_COLORS.noMatchDim);
	}
	if (messages.errorMessage) {
		console.warn(messages.errorMessage, DISPATCH_CONSOLE_COLORS.error, DISPATCH_CONSOLE_COLORS.errorDim);
	}
}

/**
 * Trigger post-dispatch snapshot scheduling.
 *
 * @param {any} tracker
 */
export function triggerPostDispatchSnapshot(tracker) {
	tracker._debouncedSnapshot();
}

/**
 * Finalize processAPIResponse dispatch lifecycle (api log + console + snapshot).
 *
 * @param {any} tracker
 * @param {string[]} allCallNames
 * @param {string[]} dispatched
 * @param {string[]} unhandled
 * @param {string[]} errors
 * @param {Object<string, any>} payload
 * @param {string} url
 * @returns {{status: 'ok'|'error'|'no-match', detail: string}}
 */
export function finalizeProcessApiResponseLifecycle(tracker, allCallNames, dispatched, unhandled, errors, payload, url) {
	const { status, detail } = buildDispatchStatus(dispatched, unhandled, errors);
	pushDispatchApiLogEntry(tracker, allCallNames, status, detail, errors, url, payload);

	const messages = buildDispatchConsoleMessages(dispatched, unhandled, errors, allCallNames);
	emitDispatchConsoleMessages(messages);
	triggerPostDispatchSnapshot(tracker);

	return { status, detail };
}
