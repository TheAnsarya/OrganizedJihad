/**
 * SyncClient Module
 * Handles synchronization between browser storage and the ASP.NET Core Web API
 * 
 * API Documentation: http://localhost:5124/api/sync
 * Endpoints:
 * - POST /api/sync/import - Import data from browser
 * - GET /api/sync/health - API health check
 * - GET /api/sync/last-sync - Last sync timestamp
 * - GET /api/sync/stats - Database statistics
 */

class SyncClient {
	constructor(apiUrl = 'http://localhost:5124') {
		this.apiUrl = apiUrl;
		this.syncEndpoint = `${apiUrl}/api/sync/import`;
		this.healthEndpoint = `${apiUrl}/api/sync/health`;
		this.lastSyncEndpoint = `${apiUrl}/api/sync/last-sync`;
		this.statsEndpoint = `${apiUrl}/api/sync/stats`;
	}

	/**
	 * Check if API is available
	 * @returns {Promise<boolean>}
	 */
	async checkHealth() {
		try {
			const response = await fetch(this.healthEndpoint, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});
			return response.ok;
		} catch (error) {
			console.error('[OrganizedJihad] API health check failed:', error);
			return false;
		}
	}

	/**
	 * Get last sync timestamp from API
	 * @returns {Promise<string|null>} - ISO timestamp or null
	 */
	async getLastSync() {
		try {
			const response = await fetch(this.lastSyncEndpoint, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			return data.lastSync;
		} catch (error) {
			console.error('[OrganizedJihad] Failed to get last sync:', error);
			return null;
		}
	}

	/**
	 * Get database statistics from API
	 * @returns {Promise<object|null>}
	 */
	async getStats() {
		try {
			const response = await fetch(this.statsEndpoint, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			return await response.json();
		} catch (error) {
			console.error('[OrganizedJihad] Failed to get stats:', error);
			return null;
		}
	}

	/**
	 * Sync data from browser to API
	 * @param {IndexedDBStorage} storage - IndexedDB storage instance
	 * @returns {Promise<object>} - Sync result with counts
	 */
	async syncToServer(storage) {
		console.log('[OrganizedJihad] Starting sync to server...');

		try {
			// Gather all data from IndexedDB
			const [
				snapshots,
				battles,
				chests,
				opponents,
				goals,
				events
			] = await Promise.all([
				storage.getAll('snapshots'),
				storage.getAll('battles'),
				storage.getAll('chests'),
				storage.getAll('opponents'),
				storage.getAll('goals'),
				storage.getAll('events')
			]);

			// Separate battles by type
			const arenaBattles = battles.filter((b) => b.battleType === 'Arena');
			const grandArenaBattles = battles.filter((b) => b.battleType === 'GrandArena');
			const titanArenaBattles = battles.filter((b) => b.battleType === 'TitanArena');
			const guildWarBattles = battles.filter((b) => b.battleType === 'GuildWar');
			const raidBossAttacks = battles.filter((b) => b.battleType === 'RaidBoss');

			// Get the most recent snapshot
			const currentSnapshot = snapshots.length > 0
				? snapshots.reduce((latest, current) =>
					new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
				)
				: null;

			// Build sync payload matching API's BrowserSyncData DTO
			const syncData = {
				currentSnapshot,
				arenaBattles,
				grandArenaBattles,
				titanArenaBattles,
				guildWarBattles,
				raidBossAttacks,
				chestOpenings: chests,
				opponents,
				goals,
				calendarEvents: events
			};

			console.log('[OrganizedJihad] Sync payload:', {
				snapshots: currentSnapshot ? 1 : 0,
				arenaBattles: arenaBattles.length,
				grandArenaBattles: grandArenaBattles.length,
				titanArenaBattles: titanArenaBattles.length,
				guildWarBattles: guildWarBattles.length,
				raidBossAttacks: raidBossAttacks.length,
				chestOpenings: chests.length,
				opponents: opponents.length,
				goals: goals.length,
				calendarEvents: events.length
			});

			// Send to API
			const response = await fetch(this.syncEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(syncData)
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`HTTP ${response.status}: ${errorText}`);
			}

			const result = await response.json();

			// Update last sync timestamp in local storage
			await storage.setMetadata('lastSync', result.timestamp);

			console.log('[OrganizedJihad] Sync completed successfully:', result);
			return result;
		} catch (error) {
			console.error('[OrganizedJihad] Sync failed:', error);
			throw error;
		}
	}

	/**
	 * Auto-sync with retry logic
	 * @param {IndexedDBStorage} storage - IndexedDB storage instance
	 * @param {number} maxRetries - Maximum retry attempts
	 * @returns {Promise<object>} - Sync result
	 */
	async syncWithRetry(storage, maxRetries = 3) {
		let lastError;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				console.log(`[OrganizedJihad] Sync attempt ${attempt}/${maxRetries}`);
				return await this.syncToServer(storage);
			} catch (error) {
				lastError = error;
				console.warn(`[OrganizedJihad] Sync attempt ${attempt} failed:`, error);

				if (attempt < maxRetries) {
					// Exponential backoff: 2^attempt seconds
					const delay = Math.pow(2, attempt) * 1000;
					console.log(`[OrganizedJihad] Retrying in ${delay / 1000}s...`);
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			}
		}

		throw new Error(`Sync failed after ${maxRetries} attempts: ${lastError.message}`);
	}

	/**
	 * Start automatic sync interval
	 * @param {IndexedDBStorage} storage - IndexedDB storage instance
	 * @param {number} intervalMinutes - Sync interval in minutes
	 * @returns {number} - Interval ID (use clearInterval to stop)
	 */
	startAutoSync(storage, intervalMinutes = 15) {
		console.log(`[OrganizedJihad] Auto-sync enabled (every ${intervalMinutes} minutes)`);

		// Sync immediately
		this.syncWithRetry(storage).catch((error) => {
			console.error('[OrganizedJihad] Initial auto-sync failed:', error);
		});

		// Then sync on interval
		return setInterval(async () => {
			try {
				await this.syncWithRetry(storage);
			} catch (error) {
				console.error('[OrganizedJihad] Auto-sync failed:', error);
			}
		}, intervalMinutes * 60 * 1000);
	}
}

export default SyncClient;
