import UIManager from '../src/modules/uiManager.js';

describe('uiManager Connection view', () => {
	const makePrefStorage = (seed = {}) => ({
		get: jest.fn((key, fallback) => (Object.prototype.hasOwnProperty.call(seed, key) ? seed[key] : fallback)),
		set: jest.fn(),
		remove: jest.fn(),
		delete: jest.fn(),
	});

	it('should show observability links and omit API call stream section', async () => {
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
		expect(html).not.toContain('Recent API Calls (Last 100)');
	});
});
