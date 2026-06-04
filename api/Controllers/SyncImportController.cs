using Microsoft.AspNetCore.Mvc;
using OrganizedJihad.Api.Models;
using OrganizedJihad.Api.Services;

namespace OrganizedJihad.Api.Controllers;

/// <summary>
/// API controller responsible for sync import orchestration endpoints.
/// </summary>
[ApiController]
[Route("api/sync")]
public class SyncImportController : ControllerBase {
	private readonly SyncService _syncService;
	private readonly ILogger<SyncImportController> _logger;

	/// <summary>
	/// Initializes a new instance of the SyncImportController.
	/// </summary>
	public SyncImportController(SyncService syncService, ILogger<SyncImportController> logger) {
		_syncService = syncService;
		_logger = logger;
	}

	/// <summary>
	/// Health check endpoint to verify API is running and responsive.
	/// </summary>
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
	[HttpPost("import")]
	[ProducesResponseType(typeof(SyncResponse), StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(SyncResponse), StatusCodes.Status500InternalServerError)]
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

			var totalRecords = counts.PlayerSnapshots + counts.ArenaBattles + counts.GrandArenaBattles +
				counts.TitanArenaBattles + counts.GuildWarBattles + counts.RaidBossAttacks +
				counts.ChestOpenings + counts.Opponents + counts.Goals + counts.CalendarEvents;

			_logger.LogInformation("Sync completed: {TotalRecords} total records imported", totalRecords);

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
}
