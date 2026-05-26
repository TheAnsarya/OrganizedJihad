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
/// - GET /api/sync/battles/recommendations - Get ranked battle team recommendations
/// - GET /api/sync/opponents - Get all tracked opponents
/// - GET /api/sync/hero-upgrades - Get hero upgrade history
/// - GET /api/sync/titan-upgrades - Get titan upgrade history
/// - GET /api/sync/daily-activity - Get daily activity data
/// - GET /api/sync/inventory - Get inventory usage history
/// - GET /api/sync/heroes - Get hero snapshots
/// - GET /api/sync/titans - Get titan snapshots
/// - GET /api/sync/pets - Get pet snapshots
/// - GET /api/sync/guild-war-battles - Get guild war battles
/// - GET /api/sync/raid-boss-attacks - Get raid boss attacks
/// - GET /api/sync/chests - Get chest openings with drops
/// - GET /api/sync/guild-members - Get guild member roster
/// - GET /api/sync/resources - Get resource transactions
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
	/// Get ranked battle recommendations from historical results.
	/// </summary>
	/// <param name="battleType">Battle type: arena, grandarena, titanarena</param>
	/// <param name="opponentId">Optional opponent ID filter</param>
	/// <param name="opponentPower">Optional opponent power center value</param>
	/// <param name="powerWindow">Power range (+/-) used with opponentPower (default: 100000)</param>
	/// <param name="minSamples">Minimum battles required per candidate team (default: 2)</param>
	/// <param name="limit">Maximum teams to return (default: 5)</param>
	/// <returns>Ranked candidate teams with win-rate metrics and confidence</returns>
	/// <response code="200">Returns recommendation payload</response>
	/// <response code="500">Error occurred while generating recommendations</response>
	/// <remarks>
	/// GET: api/sync/battles/recommendations?battleType=arena&amp;opponentPower=500000&amp;limit=5
	///
	/// Uses historical battle outcomes and ranks team candidates by a composite
	/// score built from recency-weighted win rate and sample confidence.
	/// </remarks>
	[HttpGet("battles/recommendations")]
	[ProducesResponseType(typeof(BattleRecommendationResponse), StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetBattleRecommendations(
		[FromQuery] string battleType = "arena",
		[FromQuery] long? opponentId = null,
		[FromQuery] int? opponentPower = null,
		[FromQuery] int powerWindow = 100000,
		[FromQuery] int minSamples = 2,
		[FromQuery] int limit = 5) {
		try {
			var result = await _syncService.GetBattleRecommendationsAsync(
				battleType,
				opponentId,
				opponentPower,
				powerWindow,
				minSamples,
				limit
			);

			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving battle recommendations");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	/// <summary>
	/// Get Team Recommendation Engine output for a gameplay mode.
	/// </summary>
	/// <param name="mode">Mode: arena, grandarena, guildwar, cow, campaign, adventure</param>
	/// <param name="objective">Objective: balanced, offense, defense, speed, sustain</param>
	/// <param name="limit">Maximum teams to return (default: 3)</param>
	/// <param name="minSamples">Minimum historical samples required for history-derived teams (default: 2)</param>
	/// <param name="preferredTrendWindowDays">Optional calibration trend window override (7, 30, 90)</param>
	/// <returns>Ranked recommendations with readiness and confidence metrics</returns>
	[HttpGet("teams/recommendations")]
	[ProducesResponseType(typeof(TeamRecommendationEngineResponse), StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetTeamRecommendations(
		[FromQuery] string mode = "arena",
		[FromQuery] string objective = "balanced",
		[FromQuery] int limit = 3,
		[FromQuery] int minSamples = 2,
		[FromQuery] int? preferredTrendWindowDays = null
	) {
		try {
			var result = await _syncService.GetTeamRecommendationsAsync(mode, objective, limit, minSamples, preferredTrendWindowDays);
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving team recommendations for mode {Mode}", mode);
			return StatusCode(500, new { error = ex.Message });
		}
	}

	/// <summary>
	/// Get Team Recommendation Engine profile metadata for mode/objective controls.
	/// </summary>
	/// <returns>Mode/objective options with profile weights and defaults</returns>
	[HttpGet("teams/recommendations/profiles")]
	[ProducesResponseType(typeof(TeamRecommendationProfileMetadataResponse), StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetTeamRecommendationProfiles() {
		try {
			var result = await _syncService.GetTeamRecommendationProfileMetadataAsync();
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving team recommendation profile metadata");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	/// <summary>
	/// Get persisted Team Recommendation trend-window preferences by mode.
	/// </summary>
	/// <returns>Mode trend preferences with supported window options</returns>
	[HttpGet("teams/recommendations/preferences")]
	[ProducesResponseType(typeof(TeamRecommendationTrendPreferenceResponse), StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetTeamRecommendationPreferences() {
		try {
			var result = await _syncService.GetTeamRecommendationTrendPreferencesAsync();
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving team recommendation trend preferences");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	/// <summary>
	/// Save Team Recommendation preferred trend window for a mode.
	/// </summary>
	/// <param name="request">Mode and preferred trend window payload</param>
	/// <returns>Updated mode trend preferences</returns>
	[HttpPut("teams/recommendations/preferences")]
	[ProducesResponseType(typeof(TeamRecommendationTrendPreferenceResponse), StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> SaveTeamRecommendationPreferences([FromBody] TeamRecommendationTrendPreferenceUpdateRequest request) {
		if (request == null) {
			return BadRequest(new { error = "Request payload is required." });
		}

		if (request.PreferredTrendWindowDays is not (7 or 30 or 90)) {
			return BadRequest(new { error = "preferredTrendWindowDays must be one of: 7, 30, 90." });
		}

		try {
			var result = await _syncService.SetTeamRecommendationTrendPreferenceAsync(request.Mode, request.PreferredTrendWindowDays);
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error saving team recommendation trend preference for mode {Mode}", request.Mode);
			return StatusCode(500, new { error = ex.Message });
		}
	}

	/// <summary>
	/// Backtest Team Recommendation Engine calibration against historical battle outcomes.
	/// </summary>
	/// <param name="mode">Mode: arena or grandarena (currently supported)</param>
	/// <param name="objective">Objective: balanced, offense, defense, speed, sustain</param>
	/// <param name="lookbackDays">Historical window in days (1-120)</param>
	/// <param name="limit">Recommendation cards to evaluate (1-10)</param>
	/// <param name="minSamples">Minimum samples for recommendation generation</param>
	/// <returns>Calibration summary and per-team backtest metrics</returns>
	[HttpGet("teams/recommendations/backtest")]
	[ProducesResponseType(typeof(TeamRecommendationBacktestResponse), StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetTeamRecommendationBacktest(
		[FromQuery] string mode = "arena",
		[FromQuery] string objective = "balanced",
		[FromQuery] int lookbackDays = 14,
		[FromQuery] int limit = 3,
		[FromQuery] int minSamples = 2
	) {
		try {
			var result = await _syncService.GetTeamRecommendationBacktestAsync(mode, objective, lookbackDays, limit, minSamples);
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error running team recommendation backtest for mode {Mode}", mode);
			return StatusCode(500, new { error = ex.Message });
		}
	}

	/// <summary>
	/// Get persisted calibration metadata for Team Recommendation friction scaling.
	/// </summary>
	/// <param name="mode">Mode: arena, grandarena, guildwar, cow, campaign, adventure</param>
	/// <param name="preferredTrendWindowDays">Optional preferred trend window override (7, 30, 90)</param>
	/// <returns>Mode calibration state and suggested friction scale</returns>
	[HttpGet("teams/recommendations/calibration")]
	[ProducesResponseType(typeof(TeamRecommendationCalibrationResponse), StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetTeamRecommendationCalibration([FromQuery] string mode = "arena", [FromQuery] int? preferredTrendWindowDays = null) {
		try {
			var result = await _syncService.GetTeamRecommendationCalibrationAsync(mode, preferredTrendWindowDays);
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving team recommendation calibration metadata for mode {Mode}", mode);
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
	/// Get a curated catalog of external Hero Wars tools for research and operator workflows.
	/// </summary>
	/// <returns>External tool metadata catalog</returns>
	/// <response code="200">Returns tool catalog payload</response>
	/// <response code="500">Error occurred while building tool catalog</response>
	/// <remarks>
	/// GET: api/sync/tools/catalog
	///
	/// This endpoint returns metadata references only and does not include copied third-party code.
	/// </remarks>
	[HttpGet("tools/catalog")]
	[ProducesResponseType(typeof(ToolCatalogResponse), StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public IActionResult GetToolCatalog(
		[FromQuery] double? minConfidence = null,
		[FromQuery] bool includeStale = true,
		[FromQuery] string? category = null,
		[FromQuery] string? verificationStatus = null,
		[FromQuery] string? sort = null
	) {
		try {
			var result = _syncService.GetExternalToolCatalog(
				minConfidence,
				includeStale,
				category,
				verificationStatus,
				sort
			);
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving external tool catalog");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	/// <summary>
	/// Get supported filter/sort metadata for the external tool catalog endpoint.
	/// </summary>
	/// <returns>Tool catalog filter metadata</returns>
	/// <response code="200">Returns supported categories, statuses, and sort options</response>
	/// <response code="500">Error occurred while building filter metadata</response>
	[HttpGet("tools/catalog/filters")]
	[ProducesResponseType(typeof(ToolCatalogFilterMetadataResponse), StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public IActionResult GetToolCatalogFilters() {
		try {
			var result = _syncService.GetExternalToolCatalogFilterMetadata();
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving external tool catalog filter metadata");
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

	// ========================================
	// Phase 9: Older Entity Query Endpoints
	// ========================================

	/// <summary>
	/// Get hero snapshots with optional filtering by hero ID and player ID.
	/// </summary>
	/// <param name="heroId">Optional hero ID to filter to a specific hero</param>
	/// <param name="playerId">Optional player ID filter</param>
	/// <param name="limit">Maximum number of results (default: 50)</param>
	/// <returns>Object containing hero snapshot array and count</returns>
	/// <response code="200">Returns hero snapshots</response>
	/// <response code="500">Error occurred while querying database</response>
	/// <remarks>
	/// GET: api/sync/heroes?heroId=1&amp;playerId=12345&amp;limit=50
	///
	/// Returns hero roster snapshots showing hero state over time.
	/// Ordered by timestamp descending (newest first).
	/// </remarks>
	[HttpGet("heroes")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetHeroes(
		[FromQuery] long? heroId = null,
		[FromQuery] long? playerId = null,
		[FromQuery] int limit = 50) {
		try {
			var result = await _syncService.GetHeroesAsync(heroId, playerId, limit);
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving heroes");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	/// <summary>
	/// Get titan snapshots with optional filtering by titan ID and player ID.
	/// </summary>
	/// <param name="titanId">Optional titan ID to filter to a specific titan</param>
	/// <param name="playerId">Optional player ID filter</param>
	/// <param name="limit">Maximum number of results (default: 50)</param>
	/// <returns>Object containing titan snapshot array and count</returns>
	/// <response code="200">Returns titan snapshots</response>
	/// <response code="500">Error occurred while querying database</response>
	/// <remarks>
	/// GET: api/sync/titans?titanId=1&amp;playerId=12345&amp;limit=50
	///
	/// Returns titan roster snapshots showing titan state over time.
	/// Ordered by timestamp descending (newest first).
	/// </remarks>
	[HttpGet("titans")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetTitans(
		[FromQuery] long? titanId = null,
		[FromQuery] long? playerId = null,
		[FromQuery] int limit = 50) {
		try {
			var result = await _syncService.GetTitansAsync(titanId, playerId, limit);
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving titans");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	/// <summary>
	/// Get pet snapshots with optional filtering by pet ID and player ID.
	/// </summary>
	/// <param name="petId">Optional pet ID to filter to a specific pet</param>
	/// <param name="playerId">Optional player ID filter</param>
	/// <param name="limit">Maximum number of results (default: 50)</param>
	/// <returns>Object containing pet snapshot array and count</returns>
	/// <response code="200">Returns pet snapshots</response>
	/// <response code="500">Error occurred while querying database</response>
	/// <remarks>
	/// GET: api/sync/pets?petId=1&amp;playerId=12345&amp;limit=50
	///
	/// Returns pet roster snapshots showing pet state over time.
	/// Ordered by timestamp descending (newest first).
	/// </remarks>
	[HttpGet("pets")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetPets(
		[FromQuery] long? petId = null,
		[FromQuery] long? playerId = null,
		[FromQuery] int limit = 50) {
		try {
			var result = await _syncService.GetPetsAsync(petId, playerId, limit);
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving pets");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	/// <summary>
	/// Get guild war battle history with optional filtering by war ID.
	/// </summary>
	/// <param name="warId">Optional war ID to filter results to a specific war</param>
	/// <param name="limit">Maximum number of results (default: 50)</param>
	/// <returns>Object containing guild war battle array and count</returns>
	/// <response code="200">Returns guild war battles</response>
	/// <response code="500">Error occurred while querying database</response>
	/// <remarks>
	/// GET: api/sync/guild-war-battles?warId=war_123&amp;limit=50
	///
	/// Returns guild war battle history.
	/// Ordered by timestamp descending (newest first).
	/// </remarks>
	[HttpGet("guild-war-battles")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetGuildWarBattles(
		[FromQuery] string? warId = null,
		[FromQuery] int limit = 50) {
		try {
			var result = await _syncService.GetGuildWarBattlesAsync(warId, limit);
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving guild war battles");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	/// <summary>
	/// Get raid boss attack history.
	/// </summary>
	/// <param name="limit">Maximum number of results (default: 50)</param>
	/// <returns>Object containing raid boss attack array and count</returns>
	/// <response code="200">Returns raid boss attacks</response>
	/// <response code="500">Error occurred while querying database</response>
	/// <remarks>
	/// GET: api/sync/raid-boss-attacks?limit=50
	///
	/// Returns raid boss attack history with damage dealt, teams used, and rewards.
	/// Ordered by timestamp descending (newest first).
	/// </remarks>
	[HttpGet("raid-boss-attacks")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetRaidBossAttacks([FromQuery] int limit = 50) {
		try {
			var result = await _syncService.GetRaidBossAttacksAsync(limit);
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving raid boss attacks");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	/// <summary>
	/// Get chest opening history with drops and optional chest type filter.
	/// </summary>
	/// <param name="chestType">Optional chest type filter (e.g., "legendary", "heroic")</param>
	/// <param name="limit">Maximum number of results (default: 50)</param>
	/// <returns>Object containing chest opening array with associated drops and count</returns>
	/// <response code="200">Returns chest openings with drops</response>
	/// <response code="500">Error occurred while querying database</response>
	/// <remarks>
	/// GET: api/sync/chests?chestType=legendary&amp;limit=50
	///
	/// Returns chest opening events with their individual drops.
	/// Ordered by timestamp descending (newest first).
	/// </remarks>
	[HttpGet("chests")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetChests(
		[FromQuery] string? chestType = null,
		[FromQuery] int limit = 50) {
		try {
			var result = await _syncService.GetChestOpeningsAsync(chestType, limit);
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving chest openings");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	/// <summary>
	/// Get guild member roster with optional guild ID filter.
	/// </summary>
	/// <param name="guildId">Optional guild ID to filter by</param>
	/// <param name="includeInactive">Include inactive/departed members (default: false)</param>
	/// <param name="limit">Maximum number of results (default: 100)</param>
	/// <returns>Object containing guild member array and count</returns>
	/// <response code="200">Returns guild members</response>
	/// <response code="500">Error occurred while querying database</response>
	/// <remarks>
	/// GET: api/sync/guild-members?guildId=100&amp;includeInactive=true&amp;limit=100
	///
	/// Returns guild members ordered by team power descending.
	/// By default only returns active members.
	/// </remarks>
	[HttpGet("guild-members")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetGuildMembers(
		[FromQuery] long? guildId = null,
		[FromQuery] bool includeInactive = false,
		[FromQuery] int limit = 100) {
		try {
			var result = await _syncService.GetGuildMembersAsync(guildId, includeInactive, limit);
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving guild members");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	/// <summary>
	/// Get resource transaction history with optional resource type filter.
	/// </summary>
	/// <param name="resourceType">Optional resource type filter (e.g., "gold", "emeralds")</param>
	/// <param name="limit">Maximum number of results (default: 100)</param>
	/// <returns>Object containing resource transaction array and count</returns>
	/// <response code="200">Returns resource transactions</response>
	/// <response code="500">Error occurred while querying database</response>
	/// <remarks>
	/// GET: api/sync/resources?resourceType=gold&amp;limit=100
	///
	/// Returns resource gain/spend events with source tracking.
	/// Ordered by timestamp descending (newest first).
	/// </remarks>
	[HttpGet("resources")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetResources(
		[FromQuery] string? resourceType = null,
		[FromQuery] int limit = 100) {
		try {
			var result = await _syncService.GetResourceTransactionsAsync(resourceType, limit);
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving resource transactions");
			return StatusCode(500, new { error = ex.Message });
		}
	}
}
