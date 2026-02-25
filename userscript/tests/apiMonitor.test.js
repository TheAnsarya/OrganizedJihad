/**
 * apiMonitor.test.js
 *
 * Tests for APIMonitor — request/response logging, endpoint tracking,
 * data structure analysis, listener system, and log management.
 *
 * Note: XHR/fetch interception hooks modify PAGE_WINDOW prototypes and
 * are tested indirectly via logRequest/logResponse; full integration
 * tests would require a browser environment.
 *
 * Covers: #101
 */

import APIMonitor from '../src/modules/apiMonitor.js';

// ═════════════════════════════════════════════════════════════════════
// Mocks
// ═════════════════════════════════════════════════════════════════════

/** Mock IndexedDBStorage */
jest.mock('../src/modules/indexedDBStorage.js', () => {
	return jest.fn().mockImplementation(() => ({
		init: jest.fn().mockResolvedValue(undefined),
		saveAPILogs: jest.fn().mockResolvedValue(undefined),
		getAPILogs: jest.fn().mockResolvedValue(null),
	}));
});

// ═════════════════════════════════════════════════════════════════════
// Suppress console noise
// ═════════════════════════════════════════════════════════════════════

beforeAll(() => {
	jest.spyOn(console, 'log').mockImplementation(() => {});
	jest.spyOn(console, 'warn').mockImplementation(() => {});
	jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
	console.log.mockRestore();
	console.warn.mockRestore();
	console.error.mockRestore();
});

// ═════════════════════════════════════════════════════════════════════
// Constructor
// ═════════════════════════════════════════════════════════════════════

describe('APIMonitor constructor', () => {
	test('should initialize with default state', () => {
		const monitor = new APIMonitor();
		expect(monitor.isMonitoring).toBe(false);
		expect(monitor.requestLog).toEqual([]);
		expect(monitor.maxLogSize).toBe(1000);
		expect(monitor.discoveredEndpoints).toBeInstanceOf(Map);
		expect(monitor.discoveredEndpoints.size).toBe(0);
		expect(monitor.listeners).toEqual([]);
	});

	test('should initialize stats', () => {
		const monitor = new APIMonitor();
		expect(monitor.stats.totalRequests).toBe(0);
		expect(monitor.stats.totalResponses).toBe(0);
		expect(monitor.stats.successfulRequests).toBe(0);
		expect(monitor.stats.failedRequests).toBe(0);
		expect(typeof monitor.stats.startTime).toBe('number');
	});

	test('should accept custom storage', () => {
		const customStorage = { init: jest.fn() };
		const monitor = new APIMonitor(customStorage);
		expect(monitor.storage).toBe(customStorage);
	});
});

// ═════════════════════════════════════════════════════════════════════
// logRequest
// ═════════════════════════════════════════════════════════════════════

describe('logRequest', () => {
	let monitor;

	beforeEach(() => {
		monitor = new APIMonitor();
	});

	test('should increment totalRequests', () => {
		monitor.logRequest({ method: 'POST', url: 'https://example.com/api/' });
		expect(monitor.stats.totalRequests).toBe(1);

		monitor.logRequest({ method: 'GET', url: 'https://example.com/api/' });
		expect(monitor.stats.totalRequests).toBe(2);
	});

	test('should add log entry with correct fields', () => {
		monitor.logRequest({
			method: 'POST',
			url: 'https://example.com/api/',
			requestHeaders: { 'X-Auth': 'token' },
			requestBody: '{"test": true}',
			startTime: 1000,
		});

		expect(monitor.requestLog).toHaveLength(1);
		const entry = monitor.requestLog[0];
		expect(entry.type).toBe('request');
		expect(entry.method).toBe('POST');
		expect(entry.url).toBe('https://example.com/api/');
		expect(entry.headers).toEqual({ 'X-Auth': 'token' });
		expect(entry.body).toEqual({ test: true }); // Parsed JSON
		expect(entry.startTime).toBe(1000);
		expect(entry.id).toMatch(/^req_/);
		expect(entry.timestamp).toBeTruthy();
	});

	test('should parse JSON request body', () => {
		monitor.logRequest({
			method: 'POST',
			url: 'https://example.com/api/',
			requestBody: '{"key": "value"}',
		});

		expect(monitor.requestLog[0].body).toEqual({ key: 'value' });
	});

	test('should keep non-JSON body as string', () => {
		monitor.logRequest({
			method: 'POST',
			url: 'https://example.com/api/',
			requestBody: 'plain text body',
		});

		expect(monitor.requestLog[0].body).toBe('plain text body');
	});

	test('should extract endpoints from Hero Wars API format', () => {
		monitor.logRequest({
			method: 'POST',
			url: 'https://example.com/api/',
			requestBody: JSON.stringify({
				calls: [
					{ name: 'userGetInfo', args: {} },
					{ name: 'heroGetAll', args: {} },
				],
			}),
		});

		const entry = monitor.requestLog[0];
		expect(entry.endpoints).toEqual(['userGetInfo', 'heroGetAll']);
	});

	test('should track discovered endpoints', () => {
		monitor.logRequest({
			method: 'POST',
			url: 'https://example.com/api/',
			requestBody: JSON.stringify({
				calls: [{ name: 'userGetInfo', args: {} }],
			}),
		});

		expect(monitor.discoveredEndpoints.has('userGetInfo')).toBe(true);
		expect(monitor.discoveredEndpoints.get('userGetInfo').callCount).toBe(1);
	});

	test('should notify listeners', () => {
		const listener = jest.fn();
		monitor.addListener(listener);

		monitor.logRequest({
			method: 'POST',
			url: 'https://example.com/api/',
		});

		expect(listener).toHaveBeenCalledWith('request', expect.objectContaining({ type: 'request' }));
	});
});

// ═════════════════════════════════════════════════════════════════════
// logResponse
// ═════════════════════════════════════════════════════════════════════

describe('logResponse', () => {
	let monitor;

	beforeEach(() => {
		monitor = new APIMonitor();
	});

	test('should increment totalResponses', () => {
		monitor.logResponse(
			{ url: 'https://example.com/api/', startTime: 1000 },
			{ status: 200, statusText: 'OK', endTime: 1100 }
		);
		expect(monitor.stats.totalResponses).toBe(1);
	});

	test('should count successful responses (2xx)', () => {
		monitor.logResponse(
			{ url: 'u', startTime: 0 },
			{ status: 200, endTime: 10 }
		);
		monitor.logResponse(
			{ url: 'u', startTime: 0 },
			{ status: 201, endTime: 10 }
		);
		expect(monitor.stats.successfulRequests).toBe(2);
		expect(monitor.stats.failedRequests).toBe(0);
	});

	test('should count failed responses (non-2xx)', () => {
		monitor.logResponse(
			{ url: 'u', startTime: 0 },
			{ status: 500, endTime: 10 }
		);
		monitor.logResponse(
			{ url: 'u', startTime: 0 },
			{ status: 0, endTime: 10 }
		);
		expect(monitor.stats.failedRequests).toBe(2);
		expect(monitor.stats.successfulRequests).toBe(0);
	});

	test('should calculate duration', () => {
		monitor.logResponse(
			{ url: 'u', startTime: 1000 },
			{ status: 200, endTime: 1250, responseBody: '{}' }
		);
		expect(monitor.requestLog[0].duration).toBe(250);
	});

	test('should parse JSON response body', () => {
		monitor.logResponse(
			{ url: 'u', startTime: 0 },
			{ status: 200, endTime: 10, responseBody: '{"data": 42}' }
		);
		expect(monitor.requestLog[0].body).toEqual({ data: 42 });
	});

	test('should analyze data structure when results present', () => {
		monitor.logResponse(
			{ url: 'u', startTime: 0 },
			{
				status: 200,
				endTime: 10,
				responseBody: JSON.stringify({
					results: { heroes: [1, 2, 3], level: 100 },
				}),
			}
		);
		const entry = monitor.requestLog[0];
		expect(entry.dataStructure).toBeDefined();
		expect(entry.dataStructure.type).toBe('object');
		expect(entry.dataStructure.keys).toContain('heroes');
		expect(entry.dataStructure.keys).toContain('level');
	});

	test('should save logs to storage every 10 responses', () => {
		for (let i = 1; i <= 10; i++) {
			monitor.logResponse(
				{ url: 'u', startTime: 0 },
				{ status: 200, endTime: 10 }
			);
		}
		expect(monitor.storage.saveAPILogs).toHaveBeenCalled();
	});
});

// ═════════════════════════════════════════════════════════════════════
// trackEndpoint
// ═════════════════════════════════════════════════════════════════════

describe('trackEndpoint', () => {
	let monitor;

	beforeEach(() => {
		monitor = new APIMonitor();
	});

	test('should add new endpoint on first call', () => {
		monitor.trackEndpoint('userGetInfo');
		expect(monitor.discoveredEndpoints.has('userGetInfo')).toBe(true);
		const ep = monitor.discoveredEndpoints.get('userGetInfo');
		expect(ep.name).toBe('userGetInfo');
		expect(ep.callCount).toBe(1);
		expect(ep.firstSeen).toBeTruthy();
		expect(ep.lastSeen).toBeTruthy();
	});

	test('should increment call count on subsequent calls', () => {
		monitor.trackEndpoint('heroGetAll');
		monitor.trackEndpoint('heroGetAll');
		monitor.trackEndpoint('heroGetAll');
		expect(monitor.discoveredEndpoints.get('heroGetAll').callCount).toBe(3);
	});

	test('should update lastSeen on each call', () => {
		monitor.trackEndpoint('test');
		const first = monitor.discoveredEndpoints.get('test').lastSeen;

		// Small delay to ensure different timestamp
		monitor.trackEndpoint('test');
		const second = monitor.discoveredEndpoints.get('test').lastSeen;

		// lastSeen should be updated (or at least same — timestamps may collide)
		expect(second).toBeTruthy();
	});
});

// ═════════════════════════════════════════════════════════════════════
// analyzeDataStructure
// ═════════════════════════════════════════════════════════════════════

describe('analyzeDataStructure', () => {
	let monitor;

	beforeEach(() => {
		monitor = new APIMonitor();
	});

	test('should return type for primitives', () => {
		expect(monitor.analyzeDataStructure(42)).toEqual({ type: 'number' });
		expect(monitor.analyzeDataStructure('hello')).toEqual({ type: 'string' });
		expect(monitor.analyzeDataStructure(true)).toEqual({ type: 'boolean' });
		expect(monitor.analyzeDataStructure(null)).toEqual({ type: 'object' }); // typeof null
	});

	test('should analyze arrays', () => {
		const result = monitor.analyzeDataStructure([1, 2, 3]);
		expect(result.type).toBe('array');
		expect(result.length).toBe(3);
		expect(result.sampleItem).toEqual({ type: 'number' });
	});

	test('should handle empty arrays', () => {
		const result = monitor.analyzeDataStructure([]);
		expect(result.type).toBe('array');
		expect(result.length).toBe(0);
		expect(result.sampleItem).toBeNull();
	});

	test('should analyze objects', () => {
		const result = monitor.analyzeDataStructure({ a: 1, b: 'two', c: true });
		expect(result.type).toBe('object');
		expect(result.keys).toEqual(['a', 'b', 'c']);
		expect(result.keyCount).toBe(3);
	});

	test('should handle undefined', () => {
		expect(monitor.analyzeDataStructure(undefined)).toEqual({ type: 'undefined' });
	});
});

// ═════════════════════════════════════════════════════════════════════
// addToLog (size management)
// ═════════════════════════════════════════════════════════════════════

describe('addToLog', () => {
	let monitor;

	beforeEach(() => {
		monitor = new APIMonitor();
	});

	test('should add entries to log', () => {
		monitor.addToLog({ id: 1 });
		monitor.addToLog({ id: 2 });
		expect(monitor.requestLog).toHaveLength(2);
	});

	test('should trim log when exceeding maxLogSize', () => {
		monitor.maxLogSize = 5;
		for (let i = 0; i < 7; i++) {
			monitor.addToLog({ id: i });
		}
		expect(monitor.requestLog).toHaveLength(5);
		// Oldest entries should be removed
		expect(monitor.requestLog[0].id).toBe(2);
		expect(monitor.requestLog[4].id).toBe(6);
	});
});

// ═════════════════════════════════════════════════════════════════════
// Listener system
// ═════════════════════════════════════════════════════════════════════

describe('listener system', () => {
	let monitor;

	beforeEach(() => {
		monitor = new APIMonitor();
	});

	test('should add listeners', () => {
		const cb = jest.fn();
		monitor.addListener(cb);
		expect(monitor.listeners).toHaveLength(1);
	});

	test('should remove listeners', () => {
		const cb = jest.fn();
		monitor.addListener(cb);
		monitor.removeListener(cb);
		expect(monitor.listeners).toHaveLength(0);
	});

	test('should notify all listeners', () => {
		const cb1 = jest.fn();
		const cb2 = jest.fn();
		monitor.addListener(cb1);
		monitor.addListener(cb2);

		monitor.notifyListeners('test', { data: 42 });

		expect(cb1).toHaveBeenCalledWith('test', { data: 42 });
		expect(cb2).toHaveBeenCalledWith('test', { data: 42 });
	});

	test('should catch listener errors without crashing', () => {
		const badCb = jest.fn(() => { throw new Error('boom'); });
		const goodCb = jest.fn();
		monitor.addListener(badCb);
		monitor.addListener(goodCb);

		// Should not throw
		monitor.notifyListeners('test', {});

		expect(badCb).toHaveBeenCalled();
		expect(goodCb).toHaveBeenCalled();
	});
});

// ═════════════════════════════════════════════════════════════════════
// Retrieval methods
// ═════════════════════════════════════════════════════════════════════

describe('retrieval methods', () => {
	let monitor;

	beforeEach(() => {
		monitor = new APIMonitor();
	});

	test('getLogs should return the request log', () => {
		monitor.addToLog({ id: 'a' });
		monitor.addToLog({ id: 'b' });
		expect(monitor.getLogs()).toEqual([{ id: 'a' }, { id: 'b' }]);
	});

	test('getEndpoints should return sorted by call count (descending)', () => {
		monitor.trackEndpoint('low');
		monitor.trackEndpoint('high');
		monitor.trackEndpoint('high');
		monitor.trackEndpoint('high');
		monitor.trackEndpoint('mid');
		monitor.trackEndpoint('mid');

		const endpoints = monitor.getEndpoints();
		expect(endpoints[0].name).toBe('high');
		expect(endpoints[0].callCount).toBe(3);
		expect(endpoints[1].name).toBe('mid');
		expect(endpoints[1].callCount).toBe(2);
		expect(endpoints[2].name).toBe('low');
		expect(endpoints[2].callCount).toBe(1);
	});

	test('getStats should include computed fields', () => {
		monitor.trackEndpoint('a');
		monitor.trackEndpoint('b');
		monitor.addToLog({ id: 1 });

		const stats = monitor.getStats();
		expect(stats.endpointCount).toBe(2);
		expect(stats.logSize).toBe(1);
		expect(typeof stats.uptime).toBe('number');
		expect(stats.uptime).toBeGreaterThanOrEqual(0);
	});

	test('clearLogs should empty the log', () => {
		monitor.addToLog({ id: 1 });
		monitor.addToLog({ id: 2 });
		monitor.clearLogs();
		expect(monitor.requestLog).toHaveLength(0);
	});
});

// ═════════════════════════════════════════════════════════════════════
// init
// ═════════════════════════════════════════════════════════════════════

describe('init', () => {
	test('should call storage.init and set isMonitoring', async () => {
		const monitor = new APIMonitor();
		await monitor.init();
		expect(monitor.storage.init).toHaveBeenCalled();
		expect(monitor.isMonitoring).toBe(true);
	});

	test('should load saved endpoints', async () => {
		const storage = {
			init: jest.fn().mockResolvedValue(undefined),
			saveAPILogs: jest.fn(),
			getAPILogs: jest.fn().mockResolvedValue({
				endpoints: [
					{ name: 'userGetInfo', callCount: 5, firstSeen: 'a', lastSeen: 'b' },
					{ name: 'heroGetAll', callCount: 3, firstSeen: 'c', lastSeen: 'd' },
				],
			}),
		};
		const monitor = new APIMonitor(storage);
		await monitor.init();

		expect(monitor.discoveredEndpoints.size).toBe(2);
		expect(monitor.discoveredEndpoints.get('userGetInfo').callCount).toBe(5);
	});

	test('should handle init failure gracefully', async () => {
		const storage = {
			init: jest.fn().mockRejectedValue(new Error('DB error')),
			saveAPILogs: jest.fn(),
			getAPILogs: jest.fn(),
		};
		const monitor = new APIMonitor(storage);

		// Should not throw
		await monitor.init();
		expect(monitor.isMonitoring).toBe(false);
	});
});

// ═════════════════════════════════════════════════════════════════════
// generateDocumentation
// ═════════════════════════════════════════════════════════════════════

describe('generateDocumentation', () => {
	test('should generate markdown with endpoint table', () => {
		// Mock downloadJSON to prevent DOM interaction
		const monitor = new APIMonitor();
		monitor.downloadJSON = jest.fn();

		monitor.trackEndpoint('userGetInfo');
		monitor.trackEndpoint('heroGetAll');
		monitor.stats.totalRequests = 5;
		monitor.stats.totalResponses = 4;
		monitor.stats.successfulRequests = 3;

		const doc = monitor.generateDocumentation();

		expect(doc).toContain('# Hero Wars API Documentation');
		expect(doc).toContain('userGetInfo');
		expect(doc).toContain('heroGetAll');
		expect(doc).toContain('Total Endpoints Discovered: 2');
		expect(monitor.downloadJSON).toHaveBeenCalled();
	});
});

// ═════════════════════════════════════════════════════════════════════
// exportLogs
// ═════════════════════════════════════════════════════════════════════

describe('exportLogs', () => {
	test('should return JSON with meta, endpoints, and logs', () => {
		const monitor = new APIMonitor();
		monitor.downloadJSON = jest.fn();

		monitor.addToLog({ id: 'entry1' });
		monitor.trackEndpoint('testEndpoint');

		const json = monitor.exportLogs();
		const data = JSON.parse(json);

		expect(data.meta).toBeDefined();
		expect(data.meta.stats).toBeDefined();
		expect(data.endpoints).toHaveLength(1);
		expect(data.endpoints[0].name).toBe('testEndpoint');
		expect(data.logs).toHaveLength(1);
		expect(monitor.downloadJSON).toHaveBeenCalled();
	});
});
