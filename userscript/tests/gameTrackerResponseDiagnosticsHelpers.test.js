import {
	buildDispatchConsoleMessages,
	buildUnexpectedFormatDiagnostics,
	safeJsonSnippet,
	safeObjectKeys,
} from '../src/modules/trackers/GameTrackerResponseDiagnosticsHelpers.js';

describe('GameTrackerResponseDiagnosticsHelpers', () => {
	test('safeObjectKeys returns null fallback for null', () => {
		expect(safeObjectKeys(null)).toBe('(null)');
	});

	test('safeObjectKeys renders key list', () => {
		expect(safeObjectKeys({ a: 1, b: 2 })).toBe('a, b');
	});

	test('safeJsonSnippet renders null fallback and unstringifiable fallback', () => {
		expect(safeJsonSnippet(null)).toBe('(null)');
		const circular = {};
		circular.self = circular;
		expect(safeJsonSnippet(circular)).toContain('(unstringifiable: object)');
	});

	test('buildUnexpectedFormatDiagnostics builds warning payload and log payload', () => {
		const result = buildUnexpectedFormatDiagnostics({ calls: [] }, { results: [] }, 'example.com', 'https://x');
		expect(result.detail).toContain('No .calls/.results');
		expect(result.errorDetail).toContain('req: ');
		expect(result.warningContext.page).toBe('example.com');
		expect(result.apiLogPayload.status).toBe('skipped');
		expect(result.apiLogPayload.callNames).toEqual([]);
	});

	test('buildDispatchConsoleMessages formats success/no-match/error variants', () => {
		expect(buildDispatchConsoleMessages(['a'], ['b'], [], ['a', 'b']).successMessage).toContain('Dispatched: a');
		expect(buildDispatchConsoleMessages([], ['b'], [], ['a', 'b']).noMatchMessage).toContain('No handlers matched');
		expect(buildDispatchConsoleMessages(['a'], [], ['boom'], ['a']).errorMessage).toContain('Handler errors: boom');
	});
});
