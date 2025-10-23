/**
 * IndexedDBStorage Tests
 * Tests for browser-side IndexedDB storage operations
 */

import { IndexedDBStorage } from '../../src/modules/indexedDBStorage.js';

describe('IndexedDBStorage', () => {
	let storage;

	beforeEach(async () => {
		// Create a fresh storage instance for each test
		storage = new IndexedDBStorage();
		await storage.init();
	});

	afterEach(async () => {
		// Clean up after each test
		if (storage && storage.db) {
			storage.db.close();
		}
		// Delete the database
		const deleteRequest = indexedDB.deleteDatabase('OrganizedJihadDB');
		await new Promise((resolve) => {
			deleteRequest.onsuccess = resolve;
			deleteRequest.onerror = resolve;
		});
	});

	describe('Initialization', () => {
		test('should initialize database successfully', async () => {
			expect(storage.db).toBeDefined();
			expect(storage.db.name).toBe('OrganizedJihadDB');
			expect(storage.db.version).toBe(4);
		});

		test('should create all required object stores', async () => {
			const storeNames = Array.from(storage.db.objectStoreNames);
			
			// Core stores
			expect(storeNames).toContain('playerData');
			expect(storeNames).toContain('heroes');
			expect(storeNames).toContain('titans');
			expect(storeNames).toContain('pets');
			
			// Activity tracking stores
			expect(storeNames).toContain('battleHistory');
			expect(storeNames).toContain('resourceHistory');
			expect(storeNames).toContain('questProgress');
			
			// Chat stores
			expect(storeNames).toContain('chatMessages');
			
			// Guild member tracking stores
			expect(storeNames).toContain('guildMembers');
			expect(storeNames).toContain('guildMemberSnapshots');
			expect(storeNames).toContain('guildWarParticipations');
			expect(storeNames).toContain('guildRaidParticipations');
			expect(storeNames).toContain('guildDungeonParticipations');
			expect(storeNames).toContain('titaniteTransactions');
		});
	});

	describe('CRUD Operations', () => {
		test('should add data to a store', async () => {
			const testData = {
				playerId: 12345,
				playerName: 'TestPlayer',
				level: 50,
			};

			const key = await storage.add('playerData', testData);
			expect(key).toBeDefined();
			expect(typeof key).toBe('number');
		});

		test('should retrieve data by key', async () => {
			const testData = {
				playerId: 12345,
				playerName: 'TestPlayer',
				level: 50,
			};

			const key = await storage.add('playerData', testData);
			const retrieved = await storage.get('playerData', key);
			
			expect(retrieved).toBeDefined();
			expect(retrieved.playerId).toBe(testData.playerId);
			expect(retrieved.playerName).toBe(testData.playerName);
			expect(retrieved.level).toBe(testData.level);
		});

		test('should update existing data', async () => {
			const testData = {
				playerId: 12345,
				playerName: 'TestPlayer',
				level: 50,
			};

			const key = await storage.add('playerData', testData);
			
			// Update the data
			const updatedData = { ...testData, id: key, level: 60 };
			await storage.put('playerData', updatedData);
			
			const retrieved = await storage.get('playerData', key);
			expect(retrieved.level).toBe(60);
		});

		test('should delete data by key', async () => {
			const testData = {
				playerId: 12345,
				playerName: 'TestPlayer',
				level: 50,
			};

			const key = await storage.add('playerData', testData);
			await storage.delete('playerData', key);
			
			const retrieved = await storage.get('playerData', key);
			expect(retrieved).toBeUndefined();
		});

		test('should retrieve all data from a store', async () => {
			const testData1 = { playerId: 1, playerName: 'Player1', level: 50 };
			const testData2 = { playerId: 2, playerName: 'Player2', level: 60 };
			const testData3 = { playerId: 3, playerName: 'Player3', level: 70 };

			await storage.add('playerData', testData1);
			await storage.add('playerData', testData2);
			await storage.add('playerData', testData3);

			const allData = await storage.getAll('playerData');
			expect(allData).toHaveLength(3);
		});
	});

	describe('Index Queries', () => {
		test('should query by index', async () => {
			const hero1 = { heroId: 1, heroName: 'Galahad', level: 120 };
			const hero2 = { heroId: 2, heroName: 'Astaroth', level: 120 };
			const hero3 = { heroId: 3, heroName: 'Karkh', level: 100 };

			await storage.add('heroes', hero1);
			await storage.add('heroes', hero2);
			await storage.add('heroes', hero3);

			const level120Heroes = await storage.getAllByIndex('heroes', 'level', 120);
			expect(level120Heroes).toHaveLength(2);
		});
	});

	describe('Guild Member Upsert', () => {
		test('should insert new guild member', async () => {
			const member = {
				playerId: 99999,
				playerName: 'NewMember',
				guildId: 1,
				level: 80,
				teamPower: 500000,
			};

			await storage.put('guildMembers', member);
			const retrieved = await storage.get('guildMembers', 99999);
			
			expect(retrieved).toBeDefined();
			expect(retrieved.playerName).toBe('NewMember');
			expect(retrieved.level).toBe(80);
		});

		test('should update existing guild member', async () => {
			const member = {
				playerId: 99999,
				playerName: 'ExistingMember',
				guildId: 1,
				level: 80,
				teamPower: 500000,
			};

			// Insert
			await storage.put('guildMembers', member);
			
			// Update
			const updatedMember = { ...member, level: 90, teamPower: 600000 };
			await storage.put('guildMembers', updatedMember);
			
			const retrieved = await storage.get('guildMembers', 99999);
			expect(retrieved.level).toBe(90);
			expect(retrieved.teamPower).toBe(600000);
			
			// Should only have one record
			const allMembers = await storage.getAll('guildMembers');
			expect(allMembers).toHaveLength(1);
		});
	});

	describe('Error Handling', () => {
		test('should throw error for invalid store name', async () => {
			await expect(storage.add('invalidStore', {})).rejects.toThrow();
		});

		test('should handle transaction errors gracefully', async () => {
			// Try to add data without required fields
			await expect(storage.add('playerData', null)).rejects.toThrow();
		});
	});

	describe('Bulk Operations', () => {
		test('should clear all data from a store', async () => {
			await storage.add('playerData', { playerId: 1, playerName: 'Player1' });
			await storage.add('playerData', { playerId: 2, playerName: 'Player2' });
			await storage.add('playerData', { playerId: 3, playerName: 'Player3' });

			await storage.clear('playerData');
			
			const allData = await storage.getAll('playerData');
			expect(allData).toHaveLength(0);
		});
	});
});
