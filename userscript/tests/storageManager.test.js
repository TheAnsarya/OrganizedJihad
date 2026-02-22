/**
 * StorageManager Tests
 * Tests for the synchronous localStorage / GM_setValue storage wrapper.
 *
 * Actual StorageManager API (synchronous):
 *   - constructor(): sets this.prefix = 'organizedJihad_'
 *   - get(key, defaultValue?): returns parsed JSON or defaultValue
 *   - set(key, value): returns true/false
 *   - delete(key): returns true/false
 *   - listKeys(): returns array of prefixed keys
 *   - clearAll(): deletes all prefixed keys
 *   - exportData(): returns plain object of all stored data
 *   - importData(data): imports key/value pairs
 */

import StorageManager from '../src/modules/storageManager.js';

describe('StorageManager', () => {
	let sm;
	/** @type {Record<string,string>} In-memory backing store for localStorage mock */
	let backingStore;

	beforeEach(() => {
		jest.clearAllMocks();
		backingStore = {};

		// Provide a functional localStorage mock
		const localStorageMock = {
			getItem: jest.fn((k) => (k in backingStore ? backingStore[k] : null)),
			setItem: jest.fn((k, v) => { backingStore[k] = String(v); }),
			removeItem: jest.fn((k) => { delete backingStore[k]; }),
			clear: jest.fn(() => { Object.keys(backingStore).forEach((k) => delete backingStore[k]); }),
			get length() { return Object.keys(backingStore).length; },
			key: jest.fn((i) => Object.keys(backingStore)[i] ?? null),
		};
		Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

		// Ensure GM_ globals are NOT defined so we exercise the localStorage path.
		delete global.GM_getValue;
		delete global.GM_setValue;
		delete global.GM_deleteValue;
		delete global.GM_listValues;

		sm = new StorageManager();
	});

	// ─── Initialization ──────────────────────────────────────────────────

	describe('Initialization', () => {
		test('should have the organizedJihad_ prefix', () => {
			expect(sm.prefix).toBe('organizedJihad_');
		});
	});

	// ─── get / set / delete ──────────────────────────────────────────────

	describe('get / set / delete', () => {
		test('should store and retrieve a value via localStorage', () => {
			const ok = sm.set('player', { id: 1, name: 'Test' });
			expect(ok).toBe(true);

			expect(window.localStorage.setItem).toHaveBeenCalledWith(
				'organizedJihad_player',
				JSON.stringify({ id: 1, name: 'Test' }),
			);

			const result = sm.get('player');
			expect(result).toEqual({ id: 1, name: 'Test' });
		});

		test('should return defaultValue when key does not exist', () => {
			expect(sm.get('missing', 'fallback')).toBe('fallback');
		});

		test('should return null by default when key does not exist', () => {
			expect(sm.get('missing')).toBeNull();
		});

		test('should delete a key and return true', () => {
			sm.set('toDelete', 'val');
			const ok = sm.delete('toDelete');
			expect(ok).toBe(true);
			expect(window.localStorage.removeItem).toHaveBeenCalledWith('organizedJihad_toDelete');
		});

		test('should handle JSON parse errors gracefully', () => {
			// Inject bad JSON directly into backing store
			backingStore['organizedJihad_bad'] = 'not valid json {{{';
			const result = sm.get('bad', 'default');
			expect(result).toBe('default');
		});
	});

	// ─── Complex data types ─────────────────────────────────────────────

	describe('Complex data types', () => {
		test('should handle nested objects', () => {
			const obj = { a: { b: [1, 2, 3] }, c: true };
			sm.set('complex', obj);
			expect(sm.get('complex')).toEqual(obj);
		});

		test('should handle arrays', () => {
			sm.set('arr', [10, 20, 30]);
			expect(sm.get('arr')).toEqual([10, 20, 30]);
		});

		test('should handle primitive values', () => {
			sm.set('str', 'hello');
			sm.set('num', 42);
			sm.set('bool', false);

			expect(sm.get('str')).toBe('hello');
			expect(sm.get('num')).toBe(42);
			expect(sm.get('bool')).toBe(false);
		});
	});

	// ─── listKeys ────────────────────────────────────────────────────────

	describe('listKeys', () => {
		test('should list only keys with the correct prefix', () => {
			sm.set('a', 1);
			sm.set('b', 2);
			backingStore['other_key'] = '"x"'; // non-prefixed key

			const keys = sm.listKeys();
			expect(keys.every((k) => k.startsWith('organizedJihad_'))).toBe(true);
			expect(keys.length).toBe(2);
		});
	});

	// ─── clearAll ────────────────────────────────────────────────────────

	describe('clearAll', () => {
		test('should delete all prefixed keys', () => {
			sm.set('one', 1);
			sm.set('two', 2);
			sm.clearAll();

			expect(sm.get('one')).toBeNull();
			expect(sm.get('two')).toBeNull();
		});
	});

	// ─── exportData / importData ─────────────────────────────────────────

	describe('exportData / importData', () => {
		test('should round-trip data through export and import', () => {
			sm.set('hero', { id: 1 });
			sm.set('level', 50);

			const exported = sm.exportData();
			expect(exported).toBeDefined();

			sm.clearAll();
			sm.importData(exported);

			expect(sm.get('hero')).toEqual({ id: 1 });
			expect(sm.get('level')).toBe(50);
		});
	});

	// ─── GM_ globals branch ─────────────────────────────────────────────

	describe('GM_ global branch', () => {
		afterEach(() => {
			delete global.GM_setValue;
			delete global.GM_getValue;
			delete global.GM_deleteValue;
			delete global.GM_listValues;
		});

		test('should use GM_setValue when available', () => {
			global.GM_setValue = jest.fn();
			global.GM_getValue = jest.fn(() => null);
			global.GM_deleteValue = jest.fn();
			global.GM_listValues = jest.fn(() => []);

			const gmSm = new StorageManager();
			gmSm.set('key', 'val');

			expect(global.GM_setValue).toHaveBeenCalledWith(
				'organizedJihad_key',
				JSON.stringify('val'),
			);
		});

		test('should use GM_getValue when available', () => {
			global.GM_setValue = jest.fn();
			global.GM_getValue = jest.fn(() => JSON.stringify({ foo: 'bar' }));
			global.GM_deleteValue = jest.fn();
			global.GM_listValues = jest.fn(() => []);

			const gmSm = new StorageManager();
			const result = gmSm.get('key');

			expect(global.GM_getValue).toHaveBeenCalled();
			expect(result).toEqual({ foo: 'bar' });
		});
	});
});
