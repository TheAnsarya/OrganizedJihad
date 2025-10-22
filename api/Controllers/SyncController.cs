using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Api.Data;
using OrganizedJihad.Api.Models;
using OrganizedJihad.Api.Services;

namespace OrganizedJihad.Api.Controllers;

/// <summary>
/// API controller for synchronizing game data from the browser userscript.
/// Provides endpoints for data import and retrieval.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class SyncController : ControllerBase {
	private readonly SyncService _syncService;
	private readonly IDbContextFactory<GameDatabaseContext> _contextFactory;
	private readonly ILogger<SyncController> _logger;

	public SyncController(
		SyncService syncService,
		IDbContextFactory<GameDatabaseContext> contextFactory,
		ILogger<SyncController> logger) {
		_syncService = syncService;
		_contextFactory = contextFactory;
		_logger = logger;
	}

	/// <summary>
	/// Health check endpoint to verify API is running.
	/// GET: api/sync/health
	/// </summary>
	[HttpGet("health")]
	public IActionResult HealthCheck() {
		return Ok(new {
			status = "healthy",
			timestamp = DateTime.UtcNow,
			version = "1.0.0"
		});
	}

	/// <summary>
	/// Main sync endpoint - receives data from browser userscript.
	/// POST: api/sync/import
	/// </summary>
	[HttpPost("import")]
	public async Task<ActionResult<SyncResponse>> ImportData([FromBody] BrowserSyncData data) {
		try {
			_logger.LogInformation("Receiving sync data from browser at {Time}", DateTime.UtcNow);

			var counts = await _syncService.ImportBrowserDataAsync(data);

			var response = new SyncResponse {
				Success = true,
				Message = "Data imported successfully",
				SyncTimestamp = DateTime.UtcNow,
				ImportedCounts = counts
			};

			_logger.LogInformation("Sync completed: {TotalRecords} total records imported",
				counts.PlayerSnapshots + counts.ArenaBattles + counts.GrandArenaBattles +
				counts.TitanArenaBattles + counts.GuildWarBattles + counts.RaidBossAttacks +
				counts.ChestOpenings + counts.Opponents + counts.Goals + counts.CalendarEvents);

			return Ok(response);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error during data import");
			return StatusCode(500, new SyncResponse {
				Success = false,
				Message = $"Import failed: {ex.Message}",
				SyncTimestamp = DateTime.UtcNow
			});
		}
	}

	/// <summary>
	/// Get the timestamp of the last successful sync.
	/// GET: api/sync/last-sync
	/// </summary>
	[HttpGet("last-sync")]
	public async Task<ActionResult<DateTime?>> GetLastSync() {
		try {
			var lastSync = await _syncService.GetLastSyncTimestampAsync();
			return Ok(new { lastSync });
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving last sync timestamp");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	/// <summary>
	/// Get database statistics (record counts, date ranges, etc.).
	/// GET: api/sync/stats
	/// </summary>
	[HttpGet("stats")]
	public async Task<ActionResult<DatabaseStats>> GetStats() {
		try {
			var stats = await _syncService.GetDatabaseStatsAsync();
			return Ok(stats);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving database stats");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	/// <summary>
	/// Get recent player snapshots.
	/// GET: api/sync/snapshots?limit=10
	/// </summary>
	[HttpGet("snapshots")]
	public async Task<IActionResult> GetSnapshots([FromQuery] int limit = 10) {
		try {
			await using var context = await _contextFactory.CreateDbContextAsync();
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
	/// Get recent battles across all arena types.
	/// GET: api/sync/battles?limit=20
	/// </summary>
	[HttpGet("battles")]
	public async Task<IActionResult> GetBattles([FromQuery] int limit = 20) {
		try {
			await using var context = await _contextFactory.CreateDbContextAsync();

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
	/// Get all tracked opponents.
	/// GET: api/sync/opponents
	/// </summary>
	[HttpGet("opponents")]
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
}
