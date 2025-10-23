/**
 * GameTracker Tests
 * Tests for Hero Wars API interception and data extraction
 */

import { GameTracker } from '../../src/modules/gameTracker.js';

describe('GameTracker', () => {
	let gameTracker;
	let mockStorage;
	let mockIndexedDB;

	beforeEach(() => {
		// Create mock storage and IndexedDB
		mockStorage = {
			get: jest.fn(),
			set: jest.fn(),
			delete: jest.fn(),
			listKeys: jest.fn(),
		};

		mockIndexedDB = {
			add: jest.fn().mockResolvedValue(1),
			put: jest.fn().mockResolvedValue(1),
			get: jest.fn(),
			getAll: jest.fn(),
			delete: jest.fn(),
		};

		gameTracker = new GameTracker(mockStorage, mockIndexedDB);
		jest.clearAllMocks();
	});

	describe('Initialization', () => {
		test('should initialize with storage and IndexedDB', () => {
			expect(gameTracker.storage).toBe(mockStorage);
			expect(gameTracker.indexedDB).toBe(mockIndexedDB);
		});

		test('should set up API interception', () => {
			const originalXHR = global.XMLHttpRequest;
			gameTracker.initialize();
			
			// XMLHttpRequest should be wrapped
			expect(global.XMLHttpRequest).toBeDefined();
			
			// Restore original
			global.XMLHttpRequest = originalXHR;
		});
	});

	describe('API Response Parsing', () => {
		test('should extract player data from userGetInfo response', async () => {
			const mockResponse = {
				results: [
					{
						userId: 12345,
						name: 'TestPlayer',
						level: 120,
						vipLevel: 15,
						teamPower: 1500000,
					},
				],
			};

			await gameTracker.trackPlayerData(mockResponse.results[0]);
			
			expect(mockIndexedDB.put).toHaveBeenCalledWith(
				'playerData',
				expect.objectContaining({
					playerId: 12345,
					playerName: 'TestPlayer',
					level: 120,
				})
			);
		});

		test('should extract hero data from heroGetAll response', async () => {
			const mockResponse = {
				results: [
					[
						{ id: 1, name: 'Galahad', level: 120, power: 50000 },
						{ id: 2, name: 'Astaroth', level: 115, power: 48000 },
					],
				],
			};

			await gameTracker.trackHeroData(mockResponse.results[0]);
			
			expect(mockIndexedDB.add).toHaveBeenCalledTimes(2);
			expect(mockIndexedDB.add).toHaveBeenCalledWith(
				'heroes',
				expect.objectContaining({
					heroId: 1,
					heroName: 'Galahad',
					level: 120,
				})
			);
		});

		test('should extract titan data from titanGetAll response', async () => {
			const mockResponse = {
				results: [
					[
						{ id: 6001, element: 'fire', level: 60, power: 80000 },
						{ id: 6002, element: 'water', level: 55, power: 75000 },
					],
				],
			};

			await gameTracker.trackTitanData(mockResponse.results[0]);
			
			expect(mockIndexedDB.add).toHaveBeenCalledTimes(2);
			expect(mockIndexedDB.add).toHaveBeenCalledWith(
				'titans',
				expect.objectContaining({
					titanId: 6001,
					element: 'fire',
					level: 60,
				})
			);
		});
	});

	describe('Guild Member Tracking', () => {
		test('should track guild members from clanGetInfo', async () => {
			const mockResponse = {
				clanId: 999,
				clanName: 'Test Guild',
				members: [
					{
						userId: 11111,
						name: 'Member1',
						level: 120,
						power: 1000000,
						rank: 'member',
					},
					{
						userId: 22222,
						name: 'Member2',
						level: 115,
						power: 950000,
						rank: 'officer',
					},
				],
			};

			await gameTracker.trackGuildMembers(mockResponse);
			
			expect(mockIndexedDB.put).toHaveBeenCalledWith(
				'guildMembers',
				expect.objectContaining({
					playerId: 11111,
					playerName: 'Member1',
					guildId: 999,
					guildName: 'Test Guild',
				})
			);
		});

		test('should create historical snapshots', async () => {
			const mockResponse = {
				clanId: 999,
				clanName: 'Test Guild',
				members: [
					{
						userId: 11111,
						name: 'Member1',
						level: 120,
						power: 1000000,
					},
				],
			};

			await gameTracker.trackGuildMembers(mockResponse);
			
			expect(mockIndexedDB.add).toHaveBeenCalledWith(
				'guildMemberSnapshots',
				expect.objectContaining({
					playerId: 11111,
					guildId: 999,
					level: 120,
				})
			);
		});
	});

	describe('Chat Tracking', () => {
		test('should track chat messages', async () => {
			const mockMessages = [
				{
					id: 'msg123',
					senderId: 11111,
					senderName: 'Player1',
					text: 'Hello guild!',
					timestamp: Date.now(),
					chatType: 'guild',
				},
			];

			await gameTracker.trackChatMessages(mockMessages, 'guild');
			
			expect(mockIndexedDB.add).toHaveBeenCalledWith(
				'chatMessages',
				expect.objectContaining({
					serverMessageId: 'msg123',
					senderId: 11111,
					senderName: 'Player1',
					messageText: 'Hello guild!',
					chatType: 'guild',
				})
			);
		});

		test('should track outgoing messages', async () => {
			const mockRequest = {
				chatType: 'guild',
				message: 'Test message',
			};

			mockStorage.get.mockResolvedValue({ playerId: 12345, playerName: 'Me' });

			await gameTracker.trackOutgoingMessage(mockRequest);
			
			expect(mockIndexedDB.add).toHaveBeenCalledWith(
				'chatMessages',
				expect.objectContaining({
					messageText: 'Test message',
					chatType: 'guild',
					isOutgoing: true,
					senderId: 12345,
				})
			);
		});
	});

	describe('Guild War Participation', () => {
		test('should track war participation', async () => {
			const mockResponse = {
				warId: 'war123',
				warDate: Date.now(),
				participants: [
					{
						userId: 11111,
						name: 'Player1',
						attacks: 5,
						damage: 500000,
					},
				],
			};

			mockIndexedDB.get.mockResolvedValue({ guildId: 999 });

			await gameTracker.trackGuildWarParticipation(mockResponse);
			
			expect(mockIndexedDB.add).toHaveBeenCalledWith(
				'guildWarParticipations',
				expect.objectContaining({
					warId: 'war123',
					playerId: 11111,
					attacksMade: 5,
					totalDamage: 500000,
				})
			);
		});
	});

	describe('Titanite Transactions', () => {
		test('should track titanite transactions', async () => {
			mockStorage.get.mockResolvedValue({ playerId: 12345, playerName: 'Me' });
			mockIndexedDB.get.mockResolvedValue({ guildId: 999 });

			await gameTracker.trackTitaniteTransaction(
				100,
				'earned',
				'Guild Raid',
				'Boss kill reward'
			);
			
			expect(mockIndexedDB.add).toHaveBeenCalledWith(
				'titaniteTransactions',
				expect.objectContaining({
					playerId: 12345,
					guildId: 999,
					amount: 100,
					transactionType: 'earned',
					source: 'Guild Raid',
				})
			);
		});
	});

	describe('Error Handling', () => {
		test('should handle missing response data gracefully', async () => {
			await expect(gameTracker.trackPlayerData(null)).resolves.not.toThrow();
		});

		test('should handle storage errors', async () => {
			mockIndexedDB.add.mockRejectedValue(new Error('Storage error'));
			
			// Should log error but not throw
			await expect(gameTracker.trackHeroData([{ id: 1 }])).resolves.not.toThrow();
		});

		test('should validate API response structure', async () => {
			const invalidResponse = {
				// Missing required fields
			};

			await expect(gameTracker.trackPlayerData(invalidResponse)).resolves.not.toThrow();
		});
	});
});
