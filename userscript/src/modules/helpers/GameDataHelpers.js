/**
 * GameDataHelpers.js
 *
 * Utility functions for game data processing and compression
 * Extracted from gameTracker.js for better separation of concerns
 *
 * Key Responsibilities:
 * - Team power calculations
 * - Hero data compression for efficient storage
 * - Replay data compression
 * - Multi-team power calculations (for Grand Arena)
 *
 * Compression algorithm inspired by Hero Wars Assistant:
 * https://greasyfork.org/en/scripts/450693-herowarshelper
 *
 * @module helpers/GameDataHelpers
 */

/**
 * Game data processing and compression utilities
 * Pure functions with no side effects for easy testing and reuse
 *
 * @class GameDataHelpers
 */
class GameDataHelpers {
	/**
	 * Calculate total team power from hero roster
	 * Sums the power attribute of all heroes in a team
	 *
	 * @param {Object} team - Team object with heroes (can be object or array)
	 * @returns {number} Total team power
	 */
	static calculateTeamPower(team) {
		if (!team) return 0;

		// Handle both object and array formats
		const heroes = Array.isArray(team) ? team : Object.values(team);

		return heroes.reduce((sum, hero) => {
			return sum + (hero?.power || 0);
		}, 0);
	}

	/**
	 * Calculate total power across multiple teams
	 * Used for Grand Arena battles (3v3 team format)
	 *
	 * @param {Array} teams - Array of team objects
	 * @returns {number} Combined power of all teams
	 */
	static calculateMultiTeamPower(teams) {
		if (!teams || !Array.isArray(teams)) return 0;

		return teams.reduce((sum, team) => {
			return sum + this.calculateTeamPower(team.heroes || team);
		}, 0);
	}

	/**
	 * Compress hero team data for storage efficiency
	 * Reduces full hero objects to essential stats: [id, level, star, color, power]
	 *
	 * Based on Hero Wars Assistant's compression algorithm
	 * https://greasyfork.org/en/scripts/450693-herowarshelper
	 *
	 * @param {Object|Array} team - Team object/array with hero data
	 * @returns {Array} Compressed team data - array of [id, level, star, color, power] arrays
	 *
	 * @example
	 * // Input: { hero1: { id: 5, level: 120, star: 6, color: 4, power: 45000 } }
	 * // Output: [[5, 120, 6, 4, 45000]]
	 */
	static compressHeroTeam(team) {
		if (!team) return [];

		// Handle both object and array formats
		const heroes = Array.isArray(team) ? team : Object.values(team);

		return heroes.map((hero) => [
			hero?.id || 0,
			hero?.level || 0,
			hero?.star || 0,
			hero?.color || 0,
			hero?.power || 0,
		]);
	}

	/**
	 * Decompress hero team data back to readable format
	 * Reverses the compression from compressHeroTeam
	 *
	 * @param {Array} compressedTeam - Compressed team data
	 * @returns {Array} Array of hero objects with named properties
	 *
	 * @example
	 * // Input: [[5, 120, 6, 4, 45000]]
	 * // Output: [{ id: 5, level: 120, star: 6, color: 4, power: 45000 }]
	 */
	static decompressHeroTeam(compressedTeam) {
		if (!compressedTeam || !Array.isArray(compressedTeam)) return [];

		return compressedTeam.map((heroData) => ({
			id: heroData[0],
			level: heroData[1],
			star: heroData[2],
			color: heroData[3],
			power: heroData[4],
		}));
	}

	/**
	 * Compress battle replay data to save storage space
	 * Omits detailed battle progress, keeps only essential outcome data
	 *
	 * @param {Object} replay - Full replay data from API
	 * @returns {Object} Compressed replay with essential data only
	 */
	static compressReplay(replay) {
		if (!replay) return null;

		return {
			result: replay.result,
			attackers: this.compressHeroTeam(replay.attackers),
			defenders: this.compressHeroTeam(replay.defenders),
			// Omit full battle progress (turn-by-turn actions) to save space
			// Only keep win/loss outcome and team compositions
		};
	}

	/**
	 * Calculate hero roster statistics
	 * Provides aggregate stats for dashboard display
	 *
	 * @param {Array} heroes - Array of hero objects
	 * @returns {Object} Hero roster statistics
	 */
	static calculateHeroStats(heroes) {
		if (!heroes || !Array.isArray(heroes)) {
			return {
				totalHeroes: 0,
				totalPower: 0,
				averagePower: 0,
				maxLevel: 0,
				maxStar: 0,
			};
		}

		const totalPower = heroes.reduce((sum, h) => sum + (h.power || 0), 0);
		const maxLevel = Math.max(...heroes.map((h) => h.level || 0));
		const maxStar = Math.max(...heroes.map((h) => h.star || 0));

		return {
			totalHeroes: heroes.length,
			totalPower,
			averagePower: heroes.length > 0 ? Math.round(totalPower / heroes.length) : 0,
			maxLevel,
			maxStar,
		};
	}

	/**
	 * Extract essential player data from API response
	 * Normalizes player data structure for consistent storage
	 *
	 * @param {Object} data - Player data from userGetInfo API call
	 * @returns {Object} Normalized player data
	 */
	static normalizePlayerData(data) {
		return {
			userId: data.userId || data.id || 0,
			name: data.name || 'Unknown',
			level: data.level || 0,
			vipLevel: data.vipLevel || 0,
			power: data.power || 0,
			gold: data.gold || 0,
			emeralds: data.starmoney || 0,
			clanTitle: data.clanTitle || null,
			clanId: data.clanId || null,
		};
	}

	/**
	 * Compress inventory data for efficient storage
	 * Stores only non-zero item counts
	 *
	 * @param {Object} inventory - Full inventory object
	 * @returns {Object} Compressed inventory with only items that exist
	 */
	static compressInventory(inventory) {
		if (!inventory) return {};

		const compressed = {};

		// Only store items with quantity > 0
		for (const [itemId, quantity] of Object.entries(inventory)) {
			if (quantity > 0) {
				compressed[itemId] = quantity;
			}
		}

		return compressed;
	}
}

export default GameDataHelpers;
