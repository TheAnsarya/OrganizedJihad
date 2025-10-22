/**
 * ArenaTracker.js
 *
 * Specialized tracker for all arena-related activities in Hero Wars
 * Handles Arena, Grand Arena, and Titan Arena battles and enemy tracking
 *
 * Separation of Concerns:
 * - Arena enemy listing and matchmaking data
 * - Arena battle results (regular, grand, titan)
 * - Rank extraction and caching
 *
 * Arena API Documentation: https://community.hero-wars.com/discussion/arena-api
 *
 * @module trackers/ArenaTracker
 */

import storageManager from '../storageManager.js';

/**
 * Arena-specific tracking functionality
 * Extracted from gameTracker.js for better separation of concerns
 *
 * @class ArenaTracker
 */
class ArenaTracker {
	/**
	 * Initialize arena tracker with storage and helper references
	 *
	 * @param {Object} storage - IndexedDB storage instance
	 * @param {Object} helpers - Game data helper functions (calculateTeamPower, compressHeroTeam, etc.)
	 */
	constructor(storage, helpers) {
		this.storage = storage;
		this.helpers = helpers;

		// Cache current rank values to use when player data lacks specific rank info
		// These get updated whenever we see rank data in any API response
		this.lastKnownArenaRank = 0;
		this.lastKnownGrandArenaRank = 0;
		this.lastKnownTitanArenaRank = 0;
	}

	/**
	 * Track arena enemies for matchmaking analysis
	 *
	 * @param {Object} data - Arena enemies data
	 * @returns {Promise<void>}
	 */
	async trackArenaEnemies(data) {
		if (!data.enemies) return;

		// Extract and cache player's current arena rank if present
		// Arena API calls include user rank: https://community.hero-wars.com/discussion/arena-api
		if (data.user?.arenaRank) {
			this.lastKnownArenaRank = data.user.arenaRank;
		}

		const timestamp = Date.now();
		const enemies = data.enemies.map((enemy) => ({
			userId: enemy.userId,
			name: enemy.name,
			level: enemy.level,
			power: this.helpers.calculateTeamPower(enemy.heroes),
			heroes: this.helpers.compressHeroTeam(enemy.heroes),
			timestamp,
		}));

		// Store current arena enemies
		await storageManager.set('arenaEnemies', enemies);

		// Track historical arena encounters
		const encounterHistory = (await storageManager.get('arenaEncounterHistory', [])).concat(
			enemies.map((e) => ({ ...e, encounter: 'available' }))
		);

		// Keep last 500 encounters
		if (encounterHistory.length > 500) {
			encounterHistory.splice(0, encounterHistory.length - 500);
		}

		await storageManager.set('arenaEncounterHistory', encounterHistory);
	}

	/**
	 * Track arena battle results with opponent and team composition
	 * Stores in battles IndexedDB store with battleType='Arena'
	 *
	 * @param {Object} args - Battle request arguments
	 * @param {Object} data - Battle result data
	 * @param {Function} updateOpponentCallback - Callback to update opponent records
	 * @returns {Promise<void>}
	 */
	async trackArenaBattle(args, data, updateOpponentCallback) {
		const battle = {
			battleType: 'Arena',
			opponentId: args.enemyUserId,
			opponentName: null, // Will be filled from opponents tracking
			isWin: data.result?.win || false,
			playerPower: data.attackers ? this.helpers.calculateTeamPower(data.attackers) : 0,
			opponentPower: data.defenders ? this.helpers.calculateTeamPower(data.defenders) : 0,
			playerHeroes: data.attackers ? JSON.stringify(this.helpers.compressHeroTeam(data.attackers)) : null,
			opponentHeroes: data.defenders ? JSON.stringify(this.helpers.compressHeroTeam(data.defenders)) : null,
			rewards: data.reward ? JSON.stringify(data.reward) : null,
			timestamp: new Date().toISOString(),
		};

		await this.storage.add('battles', battle);

		// Update opponent record
		if (updateOpponentCallback) {
			await updateOpponentCallback(args.enemyUserId, 'Arena', battle.isWin);
		}
	}

	/**
	 * Track Titan Arena enemies for titan-specific matchmaking
	 *
	 * @param {Object} data - Titan Arena enemies data
	 * @returns {Promise<void>}
	 */
	async trackTitanArenaEnemies(data) {
		if (!data.enemies) return;

		// Extract and cache player's current Titan Arena rank if present
		// Titan Arena structure includes user.titanArenaRank
		if (data.user?.titanArenaRank) {
			this.lastKnownTitanArenaRank = data.user.titanArenaRank;
		}

		const timestamp = Date.now();
		const enemies = data.enemies.map((enemy) => ({
			userId: enemy.userId,
			name: enemy.name,
			level: enemy.level,
			power: this.helpers.calculateTeamPower(enemy.titans),
			titans: this.helpers.compressHeroTeam(enemy.titans),
			timestamp,
		}));

		await storageManager.set('titanArenaEnemies', enemies);
	}

	/**
	 * Track Titan Arena battle results
	 * Stores in battles IndexedDB store with battleType='TitanArena'
	 *
	 * @param {Object} args - Battle request arguments
	 * @param {Object} data - Battle result data
	 * @param {Function} updateOpponentCallback - Callback to update opponent records
	 * @returns {Promise<void>}
	 */
	async trackTitanArenaBattle(args, data, updateOpponentCallback) {
		const battle = {
			battleType: 'TitanArena',
			opponentId: args.enemyUserId,
			opponentName: null,
			isWin: data.result?.win || false,
			playerPower: data.attackers ? this.helpers.calculateTeamPower(data.attackers) : 0,
			opponentPower: data.defenders ? this.helpers.calculateTeamPower(data.defenders) : 0,
			playerHeroes: data.attackers ? JSON.stringify(this.helpers.compressHeroTeam(data.attackers)) : null,
			opponentHeroes: data.defenders ? JSON.stringify(this.helpers.compressHeroTeam(data.defenders)) : null,
			rewards: data.reward ? JSON.stringify(data.reward) : null,
			timestamp: new Date().toISOString(),
		};

		await this.storage.add('battles', battle);

		// Update opponent record
		if (updateOpponentCallback) {
			await updateOpponentCallback(args.enemyUserId, 'TitanArena', battle.isWin);
		}
	}

	/**
	 * Track Grand Arena enemies (3v3 team format)
	 * Grand Arena has multiple teams per player
	 *
	 * @param {Object} data - Grand Arena enemies data
	 * @returns {Promise<void>}
	 */
	async trackGrandArenaEnemies(data) {
		if (!data.enemies) return;

		// Extract and cache player's current Grand Arena rank if present
		if (data.user?.grandArenaRank) {
			this.lastKnownGrandArenaRank = data.user.grandArenaRank;
		}

		const timestamp = Date.now();
		const enemies = data.enemies.map((enemy) => ({
			userId: enemy.userId,
			name: enemy.name,
			level: enemy.level,
			teams: enemy.teams
				? enemy.teams.map((team) => ({
						power: this.helpers.calculateTeamPower(team.heroes),
						heroes: this.helpers.compressHeroTeam(team.heroes),
					}))
				: [],
			timestamp,
		}));

		await storageManager.set('grandArenaEnemies', enemies);
	}

	/**
	 * Track Grand Arena battle results (3 teams vs 3 teams)
	 * Stores in battles IndexedDB store with battleType='GrandArena'
	 *
	 * @param {Object} args - Battle request arguments
	 * @param {Object} data - Battle result data
	 * @param {Function} updateOpponentCallback - Callback to update opponent records
	 * @returns {Promise<void>}
	 */
	async trackGrandArenaBattle(args, data, updateOpponentCallback) {
		const battle = {
			battleType: 'GrandArena',
			opponentId: args.enemyUserId,
			opponentName: null,
			isWin: data.result?.win || false,
			// Grand Arena has multiple rounds, store all team data
			playerPower: data.attackerTeams ? this.helpers.calculateMultiTeamPower(data.attackerTeams) : 0,
			opponentPower: data.defenderTeams ? this.helpers.calculateMultiTeamPower(data.defenderTeams) : 0,
			playerHeroes: data.attackerTeams ? JSON.stringify(data.attackerTeams.map((t) => this.helpers.compressHeroTeam(t.heroes))) : null,
			opponentHeroes: data.defenderTeams ? JSON.stringify(data.defenderTeams.map((t) => this.helpers.compressHeroTeam(t.heroes))) : null,
			rewards: data.reward ? JSON.stringify(data.reward) : null,
			timestamp: new Date().toISOString(),
		};

		await this.storage.add('battles', battle);

		// Update opponent record
		if (updateOpponentCallback) {
			await updateOpponentCallback(args.enemyUserId, 'GrandArena', battle.isWin);
		}
	}

	/**
	 * Get cached arena ranks for use in player snapshots
	 * Returns the most recently observed rank values
	 *
	 * @returns {Object} Object containing all cached arena ranks
	 */
	getRanks() {
		return {
			arenaRank: this.lastKnownArenaRank,
			grandArenaRank: this.lastKnownGrandArenaRank,
			titanArenaRank: this.lastKnownTitanArenaRank,
		};
	}
}

export default ArenaTracker;
