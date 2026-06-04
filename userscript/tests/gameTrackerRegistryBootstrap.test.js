import {
	applyDefaultTrackerRegistrars,
	DEFAULT_TRACKER_REGISTRARS,
} from '../src/modules/trackers/GameTrackerRegistryBootstrap.js';

describe('GameTrackerRegistryBootstrap', () => {
	test('DEFAULT_TRACKER_REGISTRARS includes expected registrar count', () => {
		expect(Array.isArray(DEFAULT_TRACKER_REGISTRARS)).toBe(true);
		expect(DEFAULT_TRACKER_REGISTRARS).toHaveLength(10);
	});

	test('applyDefaultTrackerRegistrars applies registrars in order', () => {
		const callOrder = [];
		const tracker = {};
		const registrars = [
			() => callOrder.push('first'),
			() => callOrder.push('second'),
			() => callOrder.push('third'),
		];

		applyDefaultTrackerRegistrars(tracker, registrars);
		expect(callOrder).toEqual(['first', 'second', 'third']);
	});

	test('applyDefaultTrackerRegistrars with defaults registers handlers on tracker', () => {
		const tracker = {
			_handlerRegistry: new Map(),
			registerHandler: jest.fn(),
		};

		applyDefaultTrackerRegistrars(tracker);
		expect(tracker.registerHandler).toHaveBeenCalled();
	});
});
