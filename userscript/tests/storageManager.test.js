/**
 * StorageManager Tests
 * Tests for storage abstraction layer (GM API / localStorage fallback)
 */

import StorageManager from '../src/modules/storageManager.js';

describe('StorageManager', () => {
	let storageManager;

	beforeEach(() => {
		// Clear all mocks before each test
		jest.clearAllMocks();
		storageManager = new StorageManager();
	});

	describe('Initialization', () => {
		test('should initialize with GM API when available', () => {
			expect(storageManager.useGM).toBe(true);
		});

		test('should detect storage type correctly', () => {
			const storageType = storageManager.getStorageType();
			expect(['GM', 'localStorage']).toContain(storageType);
		});
	});

	describe('GM API Operations', () => {
		test('should get value using GM.getValue', async () => {
			const testValue = { playerId: 12345, playerName: 'TestPlayer' };
			global.GM.getValue.mockReturnValue(JSON.stringify(testValue));

			const result = await storageManager.get('testKey');
			
			expect(global.GM.getValue).toHaveBeenCalledWith('testKey', null);
			expect(result).toEqual(testValue);
		});

		test('should set value using GM.setValue', async () => {
			const testValue = { playerId: 12345, playerName: 'TestPlayer' };

			await storageManager.set('testKey', testValue);
			
			expect(global.GM.setValue).toHaveBeenCalledWith('testKey', JSON.stringify(testValue));
		});

		test('should delete value using GM.deleteValue', async () => {
			await storageManager.delete('testKey');
			
			expect(global.GM.deleteValue).toHaveBeenCalledWith('testKey');
		});

		test('should list all keys using GM.listValues', async () => {
			global.GM.listValues.mockReturnValue(['key1', 'key2', 'key3']);

			const keys = await storageManager.listKeys();
			
			expect(global.GM.listValues).toHaveBeenCalled();
			expect(keys).toEqual(['key1', 'key2', 'key3']);
		});

		test('should return default value when key does not exist', async () => {
			global.GM.getValue.mockReturnValue(null);

			const result = await storageManager.get('nonexistent', { default: 'value' });
			
			expect(result).toEqual({ default: 'value' });
		});
	});

	describe('Data Serialization', () => {
		test('should handle complex objects', async () => {
			const complexObject = {
				player: {
					id: 12345,
					name: 'TestPlayer',
					heroes: [
						{ id: 1, name: 'Galahad', level: 120 },
						{ id: 2, name: 'Astaroth', level: 115 },
					],
				},
				timestamp: Date.now(),
			};

			await storageManager.set('complex', complexObject);
			global.GM.getValue.mockReturnValue(JSON.stringify(complexObject));
			
			const retrieved = await storageManager.get('complex');
			expect(retrieved).toEqual(complexObject);
		});

		test('should handle arrays', async () => {
			const testArray = [1, 2, 3, 4, 5];

			await storageManager.set('array', testArray);
			global.GM.getValue.mockReturnValue(JSON.stringify(testArray));
			
			const retrieved = await storageManager.get('array');
			expect(retrieved).toEqual(testArray);
		});

		test('should handle primitive values', async () => {
			const testString = 'test string';
			const testNumber = 42;
			const testBoolean = true;

			await storageManager.set('string', testString);
			await storageManager.set('number', testNumber);
			await storageManager.set('boolean', testBoolean);

			global.GM.getValue.mockReturnValueOnce(JSON.stringify(testString));
			global.GM.getValue.mockReturnValueOnce(JSON.stringify(testNumber));
			global.GM.getValue.mockReturnValueOnce(JSON.stringify(testBoolean));

			expect(await storageManager.get('string')).toBe(testString);
			expect(await storageManager.get('number')).toBe(testNumber);
			expect(await storageManager.get('boolean')).toBe(testBoolean);
		});
	});

	describe('Error Handling', () => {
		test('should handle JSON parse errors gracefully', async () => {
			global.GM.getValue.mockReturnValue('invalid json {');

			const result = await storageManager.get('badJson', 'default');
			
			expect(result).toBe('default');
		});

		test('should handle storage errors', async () => {
			global.GM.setValue.mockImplementation(() => {
				throw new Error('Storage full');
			});

			await expect(storageManager.set('key', 'value')).rejects.toThrow();
		});
	});

	describe('Bulk Operations', () => {
		test('should clear all stored data', async () => {
			global.GM.listValues.mockReturnValue(['key1', 'key2', 'key3']);

			await storageManager.clear();
			
			expect(global.GM.deleteValue).toHaveBeenCalledTimes(3);
			expect(global.GM.deleteValue).toHaveBeenCalledWith('key1');
			expect(global.GM.deleteValue).toHaveBeenCalledWith('key2');
			expect(global.GM.deleteValue).toHaveBeenCalledWith('key3');
		});

		test('should get all stored data', async () => {
			const mockData = {
				key1: { value: 'data1' },
				key2: { value: 'data2' },
				key3: { value: 'data3' },
			};

			global.GM.listValues.mockReturnValue(['key1', 'key2', 'key3']);
			global.GM.getValue
				.mockReturnValueOnce(JSON.stringify(mockData.key1))
				.mockReturnValueOnce(JSON.stringify(mockData.key2))
				.mockReturnValueOnce(JSON.stringify(mockData.key3));

			const allData = await storageManager.getAll();
			
			expect(allData).toEqual(mockData);
		});
	});
});
