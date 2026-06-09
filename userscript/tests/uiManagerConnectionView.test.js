import UIManager from '../src/modules/uiManager.js';
import { clearApiServerCallLog, recordApiServerCall } from '../src/modules/helpers/apiServerCallLog.js';

describe('uiManager Connection view', () => {
	beforeEach(() => {
		clearApiServerCallLog();
	});

	const makePrefStorage = (seed = {}) => ({
		get: jest.fn((key, fallback) => (Object.prototype.hasOwnProperty.call(seed, key) ? seed[key] : fallback)),
		set: jest.fn(),
		remove: jest.fn(),
		delete: jest.fn(),
	});

	it('should show observability links and include local API server call stream only', async () => {
		recordApiServerCall({
			method: 'GET',
			url: 'http://localhost:5124/api/sync/health',
			status: 200,
			statusText: 'OK',
			ok: true,
			latencyMs: 7,
		});

		recordApiServerCall({
			method: 'POST',
			url: 'https://api.hero-wars.com/game/start',
			status: 200,
			statusText: 'OK',
			ok: true,
			latencyMs: 3,
		});

		const manager = new UIManager(
			makePrefStorage({ apiBaseUrl: 'http://localhost:5124' }),
			{ getMetadata: jest.fn(async () => ({})), setMetadata: jest.fn(async () => undefined) },
			{ _apiCallLog: [{ status: 'ok', callNames: ['battleStart'] }], on: jest.fn() },
			{},
			{},
			{}
		);

		manager._probeConnectionEndpoint = jest.fn(async (path) => ({
			ok: true,
			status: 200,
			statusText: 'OK',
			latencyMs: 5,
			url: `http://localhost:5124${path}`,
			data: { status: 'ok' },
			error: '',
		}));

		const html = await manager.renderConnection();

		expect(html).toContain('Open Swagger');
		expect(html).toContain('Open OpenAPI JSON');
		expect(html).toContain('Open Server Logs');
		expect(html).toContain('Local API Server Telemetry');
		expect(html).toContain('Open Runtime Versions');
		expect(html).toContain('/api/sync/health');
		expect(html).not.toContain('battleStart');
		expect(html).not.toContain('api.hero-wars.com');
	});
});
