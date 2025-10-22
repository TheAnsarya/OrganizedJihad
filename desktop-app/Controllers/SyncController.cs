using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using OrganizedJihad.Desktop.Services;
using System.Threading.Tasks;

namespace OrganizedJihad.Desktop.Controllers;

/// <summary>
/// API controller for syncing data from the browser userscript to the desktop app.
/// Runs on localhost:5000 and accepts POST requests with game data.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class SyncController : ControllerBase
{
	private readonly SyncService _syncService;
	private readonly ILogger<SyncController> _logger;

	public SyncController(SyncService syncService, ILogger<SyncController> logger)
	{
		_syncService = syncService;
		_logger = logger;
	}

	/// <summary>
	/// Health check endpoint to verify the API is running.
	/// GET /api/sync/health
	/// </summary>
	[HttpGet("health")]
	public IActionResult Health()
	{
		return Ok(new
		{
			status = "healthy",
			timestamp = DateTime.UtcNow,
			version = "1.0.0"
		});
	}

	/// <summary>
	/// Import data from the browser userscript.
	/// POST /api/sync/import
	/// </summary>
	/// <param name="data">JSON data containing game records</param>
	[HttpPost("import")]
	public async Task<IActionResult> ImportData([FromBody] string data)
	{
		_logger.LogInformation("Received sync request from browser");

		if (string.IsNullOrWhiteSpace(data))
		{
			return BadRequest(new { error = "No data provided" });
		}

		try
		{
			var result = await _syncService.ImportBrowserDataAsync(data);

			if (result.Success)
			{
				_logger.LogInformation(
					"Sync completed successfully. Total imported: {Total}",
					result.TotalImported);

				return Ok(new
				{
					success = true,
					message = "Data imported successfully",
					totalImported = result.TotalImported,
					details = new
					{
						snapshots = result.SnapshotsImported,
						arenaBattles = result.ArenaBattlesImported,
						grandArenaBattles = result.GrandArenaBattlesImported,
						titanArenaBattles = result.TitanArenaBattlesImported,
						guildWarBattles = result.GuildWarBattlesImported,
						raidBossAttacks = result.RaidBossAttacksImported,
						chestOpenings = result.ChestOpeningsImported,
						opponents = result.OpponentsImported
					}
				});
			}
			else
			{
				_logger.LogError("Sync failed: {Error}", result.ErrorMessage);
				return StatusCode(500, new
				{
					success = false,
					error = result.ErrorMessage
				});
			}
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Unexpected error during sync");
			return StatusCode(500, new
			{
				success = false,
				error = "An unexpected error occurred"
			});
		}
	}

	/// <summary>
	/// Get the last sync timestamp.
	/// GET /api/sync/last-sync
	/// </summary>
	[HttpGet("last-sync")]
	public async Task<IActionResult> GetLastSync()
	{
		try
		{
			var lastSync = await _syncService.GetLastSyncTimestampAsync();

			return Ok(new
			{
				lastSync = lastSync,
				hasNeverSynced = lastSync == null
			});
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error retrieving last sync timestamp");
			return StatusCode(500, new { error = "Failed to retrieve last sync time" });
		}
	}

	/// <summary>
	/// Get sync statistics.
	/// GET /api/sync/stats
	/// </summary>
	[HttpGet("stats")]
	public async Task<IActionResult> GetStats()
	{
		try
		{
			var stats = await _syncService.GetDatabaseStatsAsync();

			return Ok(stats);
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error retrieving stats");
			return StatusCode(500, new { error = "Failed to retrieve statistics" });
		}
	}
}
