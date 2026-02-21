using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Api.Models;
using OrganizedJihad.Api.Services;
using OrganizedJihad.Data;

namespace OrganizedJihad.Api.Controllers;

/// <summary>
/// API controller for synchronizing game data from the browser userscript.
/// Provides endpoints for data import and retrieval of Hero Wars game statistics.
///
/// Endpoints:
/// - POST /api/sync/import - Main sync endpoint for browser data
/// - GET /api/sync/health - Health check
/// - GET /api/sync/last-sync - Get last sync timestamp
/// - GET /api/sync/stats - Get database statistics
/// - GET /api/sync/snapshots - Get recent player snapshots
/// - GET /api/sync/battles - Get recent battle history
/// - GET /api/sync/opponents - Get all tracked opponents
/// - GET /api/sync/hero-upgrades - Get hero upgrade history
/// - GET /api/sync/titan-upgrades - Get titan upgrade history
/// - GET /api/sync/daily-activity - Get daily activity data
/// - GET /api/sync/inventory - Get inventory usage history
///
/// References:
/// - ASP.NET Core Controllers: https://learn.microsoft.com/en-us/aspnet/core/web-api/
/// - Model Binding: https://learn.microsoft.com/en-us/aspnet/core/mvc/models/model-binding
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class SyncController : ControllerBase {
	private readonly SyncService _syncService;
	private readonly IDbContextFactory<GameDatabaseContext> _contextFactory;
	private readonly ILogger<SyncController> _logger;

	/// <summary>
	/// Initializes a new instance of the SyncController.
	/// </summary>
	/// <param name="syncService">Service for importing and processing browser data</param>
	/// <param name="contextFactory">Factory for creating database contexts (thread-safe pattern)</param>
	/// <param name="logger">Logger for diagnostic information</param>
	/// <remarks>
	/// Uses dependency injection to receive required services.
	/// https://learn.microsoft.com/en-us/aspnet/core/fundamentals/dependency-injection
	/// </remarks>
	public SyncController(
		SyncService syncService,
		IDbContextFactory<GameDatabaseContext> contextFactory,
		ILogger<SyncController> logger) {
		_syncService = syncService;
		_contextFactory = contextFactory;
		_logger = logger;
	}

	/// <summary>
	/// Health check endpoint to verify API is running and responsive.
	/// </summary>
	/// <returns>JSON object with status, timestamp, and version information</returns>
	/// <response code="200">API is healthy and running</response>
	/// <remarks>
	/// GET: api/sync/health
	///
	/// This endpoint can be used by monitoring tools or the browser userscript
	/// to verify the API is available before attempting data synchronization.
	///
	/// Example response:
	/// <code>
	/// {
	///   "status": "healthy",
	///   "timestamp": "2025-10-22T12:34:56Z",
	///   "version": "1.0.0"
	/// }
	/// </code>
	/// </remarks>
	[HttpGet("health")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	public IActionResult HealthCheck() {
		return Ok(new {
			status = "healthy",
			timestamp = DateTime.UtcNow,
			version = "1.0.0"
		});
	}

	/// <summary>
	/// Main sync endpoint - receives and imports game data from browser userscript.
	/// </summary>
	/// <param name="data">Complete game data snapshot from the browser</param>
	/// <returns>Sync response with import statistics</returns>
	/// <response code="200">Data imported successfully</response>
	/// <response code="500">Import failed due to server error</response>
	/// <remarks>
	/// POST: api/sync/import
	///
	/// This is the primary endpoint used by the TamperMonkey userscript to sync
	/// game data from the browser to the local database. It processes all game
	/// entities including player stats, battles, heroes, titans, and events.
	///
	/// The import process:
	/// 1. Validates incoming data structure
	/// 2. Creates database transaction for consistency
	/// 3. Processes each entity type sequentially
	/// 4. Returns counts of imported records
	///
	/// Content-Type: application/json
	///
	/// https://learn.microsoft.com/en-us/aspnet/core/web-api/action-return-types
	/// </remarks>
	[HttpPost("import")]
	[ProducesResponseType(typeof(SyncResponse), StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(SyncResponse), StatusCodes.Status500InternalServerError)]
	public async Task<ActionResult<SyncResponse>> ImportData([FromBody] BrowserSyncData data) {
		try {
			_logger.LogInformation("Receiving sync data from browser at {Time}", DateTime.UtcNow);

			// Import data using the sync service (handles all business logic)
			var counts = await _syncService.ImportBrowserDataAsync(data);

			// Build success response with import statistics
			var response = new SyncResponse {
				Success = true,
				Message = "Data imported successfully",
				SyncTimestamp = DateTime.UtcNow,
				ImportedCounts = counts
			};

			// Calculate total records for logging
			var totalRecords = counts.PlayerSnapshots + counts.ArenaBattles + counts.GrandArenaBattles +
				counts.TitanArenaBattles + counts.GuildWarBattles + counts.RaidBossAttacks +
				counts.ChestOpenings + counts.Opponents + counts.Goals + counts.CalendarEvents;

			_logger.LogInformation("Sync completed: {TotalRecords} total records imported", totalRecords);

			return Ok(response);
		} catch (Exception ex) {
			// Log the full exception for debugging
			_logger.LogError(ex, "Error during data import");

			// Return user-friendly error response
			return StatusCode(500, new SyncResponse {
				Success = false,
				Message = $"Import failed: {ex.Message}",
				SyncTimestamp = DateTime.UtcNow
			});
		}
	}

	/// <summary>
	/// Get the timestamp of the last successful sync operation.
	/// </summary>
	/// <returns>Timestamp of most recent player snapshot, or null if no syncs have occurred</returns>
	/// <response code="200">Returns last sync timestamp or null</response>
	/// <remarks>
	/// GET: api/sync/last-sync
	///
	/// Queries the PlayerSnapshots table to find the most recent data point.
	/// This helps the userscript determine if data is stale or needs refresh.
	/// </remarks>
	[HttpGet("last-sync")]
	[ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
	public async Task<ActionResult<DateTime?>> GetLastSync() {
		try {
			// Query the most recent player snapshot timestamp
			var lastSync = await _syncService.GetLastSyncTimestampAsync();
			return Ok(new { lastSync });
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving last sync timestamp");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	/// <summary>
	/// Get comprehensive database statistics including record counts and date ranges.
	/// </summary>
	/// <returns>Statistics object with counts for all major entity types</returns>
	/// <response code="200">Returns database statistics</response>
	/// <response code="500">Error occurred while querying database</response>
	/// <remarks>
	/// GET: api/sync/stats
	///
	/// Provides a quick overview of the database contents including:
	/// - Total counts for each entity type (snapshots, battles, heroes, etc.)
	/// - Date ranges for time-series data
	/// - Latest sync information
	///
	/// Useful for dashboard displays or debugging data import issues.
	/// </remarks>
	[HttpGet("stats")]
	[ProducesResponseType(typeof(DatabaseStats), StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<ActionResult<DatabaseStats>> GetStats() {
		try {
			// Aggregate statistics across all tables
			var stats = await _syncService.GetDatabaseStatsAsync();
			return Ok(stats);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving database stats");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	/// <summary>
	/// Get recent player snapshots with optional limit.
	/// </summary>
	/// <param name="limit">Maximum number of snapshots to return (default: 10)</param>
	/// <returns>List of player snapshots ordered by most recent first</returns>
	/// <response code="200">Returns list of snapshots</response>
	/// <response code="500">Error occurred while querying database</response>
	/// <remarks>
	/// GET: api/sync/snapshots?limit=10
	///
	/// Player snapshots represent the player's state at a specific point in time,
	/// including level, team power, and other key statistics.
	///
	/// Ordered by timestamp descending (newest first).
	///
	/// https://learn.microsoft.com/en-us/ef/core/querying/
	/// </remarks>
	[HttpGet("snapshots")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetSnapshots([FromQuery] int limit = 10) {
		try {
			// Create a new database context for this request
			await using var context = await _contextFactory.CreateDbContextAsync();

			// Query snapshots with ordering and limit
			var snapshots = await context.PlayerSnapshots
				.OrderByDescending(s => s.Timestamp)
				.Take(limit)
				.ToListAsync();

			return Ok(snapshots);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving snapshots");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	/// <summary>
	/// Get recent battles across all arena types (Arena, Grand Arena, Titan Arena).
	/// </summary>
	/// <param name="limit">Maximum number of battles per arena type (default: 20)</param>
	/// <returns>Object containing battle arrays for each arena type</returns>
	/// <response code="200">Returns battles grouped by arena type</response>
	/// <response code="500">Error occurred while querying database</response>
	/// <remarks>
	/// GET: api/sync/battles?limit=20
	///
	/// Retrieves recent battle history from multiple arena types:
	/// - Arena: Standard PvP battles
	/// - Grand Arena: Special tournament battles
	/// - Titan Arena: Titan-based PvP battles
	///
	/// Each arena type returns up to 'limit' battles, ordered by most recent.
	///
	/// Example response:
	/// <code>
	/// {
	///   "arena": [...],
	///   "grandArena": [...],
	///   "titanArena": [...]
	/// }
	/// </code>
	/// </remarks>
	[HttpGet("battles")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetBattles([FromQuery] int limit = 20) {
		try {
			await using var context = await _contextFactory.CreateDbContextAsync();

			// Query each arena type separately (parallel execution would be possible but adds complexity)
			var arenaBattles = await context.ArenaBattles
				.OrderByDescending(b => b.Timestamp)
				.Take(limit)
				.ToListAsync();

			var grandBattles = await context.GrandArenaBattles
				.OrderByDescending(b => b.Timestamp)
				.Take(limit)
				.ToListAsync();

			var titanBattles = await context.TitanArenaBattles
				.OrderByDescending(b => b.Timestamp)
				.Take(limit)
				.ToListAsync();

			// Return grouped results
			return Ok(new {
				arena = arenaBattles,
				grandArena = grandBattles,
				titanArena = titanBattles
			});
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving battles");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	/// <summary>
	/// Get all tracked opponents from all arena types.
	/// </summary>
	/// <returns>List of all unique opponents encountered</returns>
	/// <response code="200">Returns list of opponents</response>
	/// <response code="500">Error occurred while querying database</response>
	/// <remarks>
	/// GET: api/sync/opponents
	///
	/// Returns all opponents that have been encountered in any arena type.
	/// Useful for tracking rival players and analyzing matchup history.
	///
	/// Opponents are unique by OpponentId across all arena types.
	/// </remarks>
	[HttpGet("opponents")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetOpponents() {
		try {
			await using var context = await _contextFactory.CreateDbContextAsync();
			var opponents = await context.Opponents
				.OrderByDescending(o => o.LastSeen)
				.ToListAsync();

			return Ok(opponents);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving opponents");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	/// <summary>
	/// Get hero upgrade history with optional filtering by hero and upgrade type.
	/// </summary>
	/// <param name="heroId">Optional hero ID to filter results to a specific hero</param>
	/// <param name="type">
	/// Optional upgrade type filter: "level", "star", "color", "skill", "artifact", "glyph", "skin".
	/// If omitted, returns all upgrade types.
	/// </param>
	/// <param name="limit">Maximum number of results per upgrade type (default: 50)</param>
	/// <returns>Object containing arrays of upgrade records grouped by type</returns>
	/// <response code="200">Returns hero upgrade history</response>
	/// <response code="500">Error occurred while querying database</response>
	/// <remarks>
	/// GET: api/sync/hero-upgrades?heroId=1&amp;type=level&amp;limit=50
	///
	/// Returns hero upgrade events ordered by most recent first.
	/// When no type filter is specified, returns all upgrade types in separate arrays.
	///
	/// Example response:
	/// <code>
	/// {
	///   "levelUpgrades": [...],
	///   "starUpgrades": [...],
	///   "colorUpgrades": [...]
	/// }
	/// </code>
	/// </remarks>
	[HttpGet("hero-upgrades")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetHeroUpgrades(
		[FromQuery] long? heroId = null,
		[FromQuery] string? type = null,
		[FromQuery] int limit = 50) {
		try {
			var result = await _syncService.GetHeroUpgradeHistoryAsync(heroId, type, limit);
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving hero upgrades");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	/// <summary>
	/// Get titan upgrade history with optional filtering by titan and upgrade type.
	/// </summary>
	/// <param name="titanId">Optional titan ID to filter results to a specific titan</param>
	/// <param name="type">
	/// Optional upgrade type filter: "level", "star", "skill", "artifact", "skin".
	/// If omitted, returns all upgrade types.
	/// </param>
	/// <param name="limit">Maximum number of results per upgrade type (default: 50)</param>
	/// <returns>Object containing arrays of upgrade records grouped by type</returns>
	/// <response code="200">Returns titan upgrade history</response>
	/// <response code="500">Error occurred while querying database</response>
	/// <remarks>
	/// GET: api/sync/titan-upgrades?titanId=1&amp;type=level&amp;limit=50
	///
	/// Returns titan upgrade events ordered by most recent first.
	/// </remarks>
	[HttpGet("titan-upgrades")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetTitanUpgrades(
		[FromQuery] long? titanId = null,
		[FromQuery] string? type = null,
		[FromQuery] int limit = 50) {
		try {
			var result = await _syncService.GetTitanUpgradeHistoryAsync(titanId, type, limit);
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving titan upgrades");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	/// <summary>
	/// Get daily activity data including quest completions, login rewards, and summaries.
	/// </summary>
	/// <param name="date">Optional date filter (format: yyyy-MM-dd). Returns data for that specific day.</param>
	/// <param name="playerId">Optional player ID filter</param>
	/// <param name="limit">Maximum number of results per category (default: 30)</param>
	/// <returns>Object containing daily activity data grouped by type</returns>
	/// <response code="200">Returns daily activity data</response>
	/// <response code="500">Error occurred while querying database</response>
	/// <remarks>
	/// GET: api/sync/daily-activity?date=2025-01-23&amp;playerId=12345&amp;limit=30
	///
	/// Returns daily quests, guild quests, login rewards, and activity summaries.
	/// When date is specified, returns data for that specific day only.
	/// Otherwise returns the most recent entries.
	///
	/// Example response:
	/// <code>
	/// {
	///   "dailyQuests": [...],
	///   "guildQuests": [...],
	///   "loginRewards": [...],
	///   "summaries": [...]
	/// }
	/// </code>
	/// </remarks>
	[HttpGet("daily-activity")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetDailyActivity(
		[FromQuery] DateTime? date = null,
		[FromQuery] long? playerId = null,
		[FromQuery] int limit = 30) {
		try {
			var result = await _syncService.GetDailyActivityAsync(date, playerId, limit);
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving daily activity");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	/// <summary>
	/// Get inventory usage history and equipment changes.
	/// </summary>
	/// <param name="category">
	/// Optional item category filter: "potion", "fragment", "scroll", "gear", "consumable", "material", "key".
	/// If omitted, returns all categories.
	/// </param>
	/// <param name="limit">Maximum number of results (default: 50)</param>
	/// <returns>Object containing item usage and equipment change arrays</returns>
	/// <response code="200">Returns inventory history</response>
	/// <response code="500">Error occurred while querying database</response>
	/// <remarks>
	/// GET: api/sync/inventory?category=potion&amp;limit=50
	///
	/// Returns both inventory item usage events and equipment changes.
	/// Category filter only applies to item usages, not equipment changes.
	///
	/// Example response:
	/// <code>
	/// {
	///   "itemUsages": [...],
	///   "equipmentChanges": [...]
	/// }
	/// </code>
	/// </remarks>
	[HttpGet("inventory")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetInventory(
		[FromQuery] string? category = null,
		[FromQuery] int limit = 50) {
		try {
			var result = await _syncService.GetInventoryHistoryAsync(category, limit);
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving inventory history");
			return StatusCode(500, new { error = ex.Message });
		}
	}
}
