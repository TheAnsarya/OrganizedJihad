import {
	buildDispatchErrorDetail,
	DISPATCH_CONSOLE_COLORS,
	emitDispatchConsoleMessages,
	finalizeProcessApiResponseLifecycle,
	pushDispatchApiLogEntry,
	triggerPostDispatchSnapshot,
} from '../src/modules/trackers/GameTrackerResponseLifecycleHelpers.js';

describe('GameTrackerResponseLifecycleHelpers', () => {
	test('buildDispatchErrorDetail joins errors with semicolons', () => {
		expect(buildDispatchErrorDetail(['a', 'b'])).toBe('a; b');
		expect(buildDispatchErrorDetail([])).toBeNull();
	});

	test('pushDispatchApiLogEntry proxies into _pushApiLog with derived error detail', () => {
		const tracker = { _pushApiLog: jest.fn() };
		pushDispatchApiLogEntry(tracker, ['a'], 'ok', 'detail', ['err1', 'err2'], 'u', { p: 1 });
		expect(tracker._pushApiLog).toHaveBeenCalledWith(['a'], 'ok', 'detail', 'err1; err2', 'u', { p: 1 });
	});

	test('emitDispatchConsoleMessages emits styled console messages', () => {
		const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
		const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

		emitDispatchConsoleMessages({
			successMessage: '%c[OJ]%c ok',
			noMatchMessage: '%c[OJ]%c no',
			errorMessage: '%c[OJ]%c err',
		});

		expect(logSpy).toHaveBeenCalledWith('%c[OJ]%c ok', DISPATCH_CONSOLE_COLORS.success, DISPATCH_CONSOLE_COLORS.successDim);
		expect(logSpy).toHaveBeenCalledWith('%c[OJ]%c no', DISPATCH_CONSOLE_COLORS.noMatch, DISPATCH_CONSOLE_COLORS.noMatchDim);
		expect(warnSpy).toHaveBeenCalledWith('%c[OJ]%c err', DISPATCH_CONSOLE_COLORS.error, DISPATCH_CONSOLE_COLORS.errorDim);

		logSpy.mockRestore();
		warnSpy.mockRestore();
	});

	test('triggerPostDispatchSnapshot calls tracker debounce method', () => {
		const tracker = { _debouncedSnapshot: jest.fn() };
		triggerPostDispatchSnapshot(tracker);
		expect(tracker._debouncedSnapshot).toHaveBeenCalled();
	});

	test('finalizeProcessApiResponseLifecycle logs, emits console, and triggers snapshot', () => {
		const tracker = {
			_pushApiLog: jest.fn(),
			_debouncedSnapshot: jest.fn(),
		};
		const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
		const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

		const result = finalizeProcessApiResponseLifecycle(
			tracker,
			['userGetInfo'],
			['userGetInfo'],
			[],
			[],
			{ userGetInfo: { args: {}, response: {} } },
			'https://host/api'
		);

		expect(result.status).toBe('ok');
		expect(tracker._pushApiLog).toHaveBeenCalled();
		expect(tracker._debouncedSnapshot).toHaveBeenCalled();
		expect(logSpy).toHaveBeenCalled();

		logSpy.mockRestore();
		warnSpy.mockRestore();
	});
});
