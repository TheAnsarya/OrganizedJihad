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

import { decompressHeroStore, decompressTitanStore } from './heroCompression.js';

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
					'Content-Type': 'application/json',
				},
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
					'Content-Type': 'application/json',
				},
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
					'Content-Type': 'application/json',
				},
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
	 * Sync data from browser to API.
	 * Uses incremental sync: only sends records newer than the last
	 * successful sync timestamp, keeping payloads small. (#135, #140)
	 *
	 * Stores with a `timestamp` index use `getByIndexRange()`.
	 * Stores with other time-like indexes (completedAt, purchasedAt, claimedAt)
	 * also use bounded queries. Small mutable stores (opponents, missionProgress,
	 * towerProgress, goals, events) always send all records since they're
	 * upsert-based and tiny.
	 *
	 * @param {IndexedDBStorage} storage - IndexedDB storage instance
	 * @returns {Promise<object>} - Sync result with counts
	 */
	async syncToServer(storage) {
		console.log('[OrganizedJihad] Starting sync to server...');

		try {
			// ── Determine incremental boundary ─────────────────────────
			const lastSync = await storage.getMetadata('lastSync', null);
			const hasLastSync = !!lastSync;
			// Some stores use epoch-ms timestamps (chests), so pre-compute both formats
			const lastSyncEpoch = hasLastSync ? new Date(lastSync).getTime() : 0;

			/**
			 * Helper: fetch records newer than lastSync via an index, or
			 * fall back to getAll() on the very first sync.
			 * @param {string} store - IDB store name
			 * @param {string} indexName - Index to range-query
			 * @param {'iso'|'epoch'} format - Timestamp format used in the store
			 * @returns {Promise<Array>}
			 */
			const getSince = (store, indexName = 'timestamp', format = 'iso') => {
				if (!hasLastSync) return storage.getAll(store);
				const lower = format === 'epoch' ? lastSyncEpoch : lastSync;
				return storage.getByIndexRange(store, indexName, {
					lower,
					lowerOpen: true,
				});
			};

			// ── Gather data — bounded queries where possible ───────────
			const [snapshots, battles, chests, consumableRewards] = await Promise.all([
				getSince('snapshots'),
				getSince('battles'),
				getSince('chests', 'timestamp', 'epoch'), // chests store uses Date.now() (numeric)
				getSince('consumableRewards', 'timestamp', 'epoch'),
			]);

			const toIso = (value) => {
				const asNumber = Number(value);
				if (!Number.isNaN(asNumber) && asNumber > 0) {
					return new Date(asNumber).toISOString();
				}
				const parsed = new Date(value);
				return Number.isNaN(parsed.getTime())
					? new Date().toISOString()
					: parsed.toISOString();
			};

			const normalizedChests = chests.map((c) => ({
				...c,
				timestamp: toIso(c.timestamp),
				chestType: c.chestType || c.sourceType || 'unknown',
				openMethod: c.openMethod || 'tracked',
				quantity: c.quantity || 1,
			}));

			const normalizedConsumableRewards = consumableRewards.map((r) => ({
				timestamp: toIso(r.timestamp),
				sourceType: r.sourceType || 'unknown',
				sourceId: String(r.sourceId || 'unknown'),
				itemType: r.itemType || 'unknown',
				itemId: String(r.itemId || 'unknown'),
				quantity: Number(r.quantity || 0),
				openingId: Number(r.openingId || 0),
			}));

			// Small mutable / non-timestamped stores — always send all
			const [opponents, goals, events] = await Promise.all([
				storage.getAll('opponents'),
				storage.getAll('goals'),
				storage.getAll('events'),
			]);

			// Categorize battles by type in a single pass (#136)
			// Object.groupBy returns { key: [items] } — missing keys default to []
			const battlesByType = Object.groupBy(battles, (b) => b.battleType);
			const arenaBattles = battlesByType.Arena ?? [];
			const grandArenaBattles = battlesByType.GrandArena ?? [];
			const titanArenaBattles = battlesByType.TitanArena ?? [];
			const guildWarBattles = battlesByType.GuildWar ?? [];
			const raidBossAttacks = battlesByType.RaidBoss ?? [];

			// Get the most recent snapshot
			const currentSnapshot =
				snapshots.length > 0
					? snapshots.reduce((latest, current) =>
							new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
						)
					: null;

			// Get all new entity types added in Phase 7
			// Decompress hero/titan compressed batch records (#43)
			const heroesRaw = await getSince('heroes');
			const heroes = decompressHeroStore(heroesRaw);
			const titansRaw = await getSince('titans');
			const titans = decompressTitanStore(titansRaw);
			const pets = await getSince('pets');
			const inventorySnapshots = await getSince('inventory');
			const currentInventory =
				inventorySnapshots.length > 0
					? inventorySnapshots.reduce((latest, current) =>
							new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
						)
					: null;

			// Stores with non-standard time indexes
			const questCompletions = hasLastSync
				? await storage.getByIndexRange('questCompletions', 'completedAt', { lower: lastSync, lowerOpen: true })
				: await storage.getAll('questCompletions');

			// Mutable keyed stores — always send all (tiny)
			const missionProgress = await storage.getAll('missionProgress');
			const towerProgress = await storage.getAll('towerProgress');

			const shopPurchases = hasLastSync
				? await storage.getByIndexRange('shopPurchases', 'purchasedAt', { lower: lastSync, lowerOpen: true })
				: await storage.getAll('shopPurchases');

			const [expeditionBattles, resourceTransactions, guildActivities] = await Promise.all([
				getSince('expeditionBattles'),
				getSince('resourceTransactions'),
				getSince('guildActivities'),
			]);

			// Phase 8: Gather upgrade, daily activity, and inventory tracking data
			// Stores with `timestamp` index use incremental query;
			// stores with `completedAt`/`claimedAt` indexes use those instead.
			const [heroUpgrades, titanUpgrades, inventoryItemUsages, equipmentChanges] =
				await Promise.all([
					getSince('heroUpgrades'),
					getSince('titanUpgrades'),
					getSince('inventoryItemUsages'),
					getSince('equipmentChanges'),
				]);

			const [dailyQuestCompletions, guildQuestCompletions, loginRewards] =
				await Promise.all([
					hasLastSync
						? storage.getByIndexRange('dailyQuestCompletions', 'completedAt', { lower: lastSync, lowerOpen: true })
						: storage.getAll('dailyQuestCompletions'),
					hasLastSync
						? storage.getByIndexRange('guildQuestCompletions', 'completedAt', { lower: lastSync, lowerOpen: true })
						: storage.getAll('guildQuestCompletions'),
					hasLastSync
						? storage.getByIndexRange('loginRewards', 'claimedAt', { lower: lastSync, lowerOpen: true })
						: storage.getAll('loginRewards'),
				]);

			// Categorize hero upgrades by type in a single pass (#136)
			const heroUpByType = Object.groupBy(heroUpgrades, (u) => u.upgradeType);
			const heroLevelUpgrades = heroUpByType.level ?? [];
			const heroStarUpgrades = heroUpByType.star ?? [];
			const heroColorUpgrades = heroUpByType.color ?? [];
			const heroSkillUpgrades = heroUpByType.skill ?? [];
			const heroArtifactUpgrades = heroUpByType.artifact ?? [];
			const heroGlyphUpgrades = heroUpByType.glyph ?? [];
			const heroSkinUpgrades = heroUpByType.skin ?? [];

			// Categorize titan upgrades by type in a single pass (#136)
			const titanUpByType = Object.groupBy(titanUpgrades, (u) => u.upgradeType);
			const titanLevelUpgrades = titanUpByType.level ?? [];
			const titanStarUpgrades = titanUpByType.star ?? [];
			const titanSkillUpgrades = titanUpByType.skill ?? [];
			const titanArtifactUpgrades = titanUpByType.artifact ?? [];
			const titanSkinUpgrades = titanUpByType.skin ?? [];

			// Build sync payload matching API's BrowserSyncData DTO
			const syncData = {
				// Existing entities (Phase 1-6)
				currentSnapshot,
				arenaBattles,
				grandArenaBattles,
				titanArenaBattles,
				guildWarBattles,
				raidBossAttacks,
				chestOpenings: normalizedChests,
				consumableRewards: normalizedConsumableRewards,
				opponents,
				goals,
				calendarEvents: events,
				// Phase 7 - Comprehensive Tracking
				heroes,
				titans,
				pets,
				currentInventory,
				questCompletions,
				missionProgress,
				shopPurchases,
				towerProgress,
				expeditionBattles,
				resourceTransactions,
				guildActivities,
				// Phase 8 - Hero Upgrade Tracking
				heroLevelUpgrades,
				heroStarUpgrades,
				heroColorUpgrades,
				heroSkillUpgrades,
				heroArtifactUpgrades,
				heroGlyphUpgrades,
				heroSkinUpgrades,
				// Phase 8 - Titan Upgrade Tracking
				titanLevelUpgrades,
				titanStarUpgrades,
				titanSkillUpgrades,
				titanArtifactUpgrades,
				titanSkinUpgrades,
				// Phase 8 - Daily Activity Tracking
				dailyQuestCompletions,
				guildQuestCompletions,
				loginRewards,
				// Phase 8 - Inventory Tracking
				inventoryItemUsages,
				equipmentChanges,
			};

			console.log('[OrganizedJihad] Sync payload:', {
				snapshots: currentSnapshot ? 1 : 0,
				arenaBattles: arenaBattles.length,
				grandArenaBattles: grandArenaBattles.length,
				titanArenaBattles: titanArenaBattles.length,
				guildWarBattles: guildWarBattles.length,
				raidBossAttacks: raidBossAttacks.length,
				chestOpenings: normalizedChests.length,
				consumableRewards: normalizedConsumableRewards.length,
				opponents: opponents.length,
				goals: goals.length,
				calendarEvents: events.length,
				// Phase 7 counts
				heroes: heroes.length,
				titans: titans.length,
				pets: pets.length,
				inventory: currentInventory ? 1 : 0,
				questCompletions: questCompletions.length,
				missionProgress: missionProgress.length,
				shopPurchases: shopPurchases.length,
				towerProgress: towerProgress.length,
				expeditionBattles: expeditionBattles.length,
				resourceTransactions: resourceTransactions.length,
				guildActivities: guildActivities.length,
				// Phase 8 counts
				heroUpgrades: heroUpgrades.length,
				titanUpgrades: titanUpgrades.length,
				dailyQuestCompletions: dailyQuestCompletions.length,
				guildQuestCompletions: guildQuestCompletions.length,
				loginRewards: loginRewards.length,
				inventoryItemUsages: inventoryItemUsages.length,
				equipmentChanges: equipmentChanges.length,
			});

			// Send to API
			const response = await fetch(this.syncEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(syncData),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`HTTP ${response.status}: ${errorText}`);
			}

			const result = await response.json();

			// Update last sync timestamp in local storage.
			// API returns camelCase `syncTimestamp` (C# SyncTimestamp via ASP.NET serialization).
			await storage.setMetadata('lastSync', result.syncTimestamp);

			// Persist sync status for the dashboard status panel (#130)
			await storage.setMetadata('syncStatus', {
				ok: true,
				timestamp: new Date().toISOString(),
				message: `Synced ${Object.values(result.importedCounts || {}).reduce((a, b) => a + b, 0)} records`,
			});

			console.log('[OrganizedJihad] Sync completed successfully:', result);
			return result;
		} catch (error) {
			console.error('[OrganizedJihad] Sync failed:', error);
			throw error;
		}
	}

	/**
	 * Auto-sync with retry logic.
	 * On final failure, persists the error to IDB so the dashboard can
	 * show a user-visible indicator instead of silently swallowing it (#130).
	 *
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

		// All retries exhausted — persist failure so the UI can surface it (#130)
		try {
			await storage.setMetadata('syncStatus', {
				ok: false,
				timestamp: new Date().toISOString(),
				message: lastError?.message || 'Unknown error',
				attempts: maxRetries,
			});
		} catch {
			// If even the metadata write fails, nothing more we can do
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
		return setInterval(
			async () => {
				try {
					await this.syncWithRetry(storage);
				} catch (error) {
					console.error('[OrganizedJihad] Auto-sync failed:', error);
				}
			},
			intervalMinutes * 60 * 1000
		);
	}
}

export default SyncClient;
