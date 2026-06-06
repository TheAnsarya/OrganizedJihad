using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Api.Models;
using OrganizedJihad.Api.Services;
using OrganizedJihad.Data;

namespace OrganizedJihad.Api.Controllers;

/// <summary>
/// API controller responsible for read/query and recommendation endpoints.
/// </summary>
[ApiController]
[Route("api/sync")]
public class SyncQueryController : ControllerBase {
	private readonly SyncService _syncService;
	private readonly IDbContextFactory<GameDatabaseContext> _contextFactory;
	private readonly ILogger<SyncQueryController> _logger;

	/// <summary>
	/// Initializes a new instance of the SyncQueryController.
	/// </summary>
	public SyncQueryController(
		SyncService syncService,
		IDbContextFactory<GameDatabaseContext> contextFactory,
		ILogger<SyncQueryController> logger) {
		_syncService = syncService;
		_contextFactory = contextFactory;
		_logger = logger;
	}

	[HttpGet("last-sync")]
	[ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
	public async Task<ActionResult<DateTime?>> GetLastSync() {
		try {
			var lastSync = await _syncService.GetLastSyncTimestampAsync();
			return Ok(new { lastSync });
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving last sync timestamp");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	[HttpGet("stats")]
	[ProducesResponseType(typeof(DatabaseStats), StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<ActionResult<DatabaseStats>> GetStats() {
		try {
			var stats = await _syncService.GetDatabaseStatsAsync();
			return Ok(stats);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving database stats");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	[HttpGet("tracking/coverage")]
	[ProducesResponseType(typeof(TrackingCoverageResponse), StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<ActionResult<TrackingCoverageResponse>> GetTrackingCoverage() {
		try {
			await using var context = await _contextFactory.CreateDbContextAsync();

			var domainEntities = new Dictionary<string, Dictionary<string, int>> {
				["combat"] = new Dictionary<string, int> {
					["arenaBattles"] = await context.ArenaBattles.AsNoTracking().CountAsync(),
					["grandArenaBattles"] = await context.GrandArenaBattles.AsNoTracking().CountAsync(),
					["titanArenaBattles"] = await context.TitanArenaBattles.AsNoTracking().CountAsync(),
					["guildWarBattles"] = await context.GuildWarBattles.AsNoTracking().CountAsync(),
					["raidBossAttacks"] = await context.RaidBossAttacks.AsNoTracking().CountAsync(),
					["expeditionBattles"] = await context.ExpeditionBattles.AsNoTracking().CountAsync()
				},
				["roster"] = new Dictionary<string, int> {
					["playerSnapshots"] = await context.PlayerSnapshots.AsNoTracking().CountAsync(),
					["heroes"] = await context.Heroes.AsNoTracking().CountAsync(),
					["titans"] = await context.Titans.AsNoTracking().CountAsync(),
					["pets"] = await context.Pets.AsNoTracking().CountAsync(),
					["inventorySnapshots"] = await context.InventorySnapshots.AsNoTracking().CountAsync()
				},
				["economy"] = new Dictionary<string, int> {
					["resourceTransactions"] = await context.ResourceTransactions.AsNoTracking().CountAsync(),
					["shopPurchases"] = await context.ShopPurchases.AsNoTracking().CountAsync(),
					["chestOpenings"] = await context.ChestOpenings.AsNoTracking().CountAsync(),
					["chestDrops"] = await context.ChestDrops.AsNoTracking().CountAsync(),
					["inventoryItemUsages"] = await context.InventoryItemUsages.AsNoTracking().CountAsync(),
					["equipmentChanges"] = await context.EquipmentChanges.AsNoTracking().CountAsync(),
					["titaniteTransactions"] = await context.TitaniteTransactions.AsNoTracking().CountAsync()
				},
				["guild"] = new Dictionary<string, int> {
					["guildActivities"] = await context.GuildActivities.AsNoTracking().CountAsync(),
					["guildMembers"] = await context.GuildMembers.AsNoTracking().CountAsync(),
					["guildMemberSnapshots"] = await context.GuildMemberSnapshots.AsNoTracking().CountAsync(),
					["guildWarParticipations"] = await context.GuildWarParticipations.AsNoTracking().CountAsync(),
					["guildRaidParticipations"] = await context.GuildRaidParticipations.AsNoTracking().CountAsync(),
					["guildDungeonParticipations"] = await context.GuildDungeonParticipations.AsNoTracking().CountAsync()
				},
				["activity"] = new Dictionary<string, int> {
					["questCompletions"] = await context.QuestCompletions.AsNoTracking().CountAsync(),
					["dailyQuestCompletions"] = await context.DailyQuestCompletions.AsNoTracking().CountAsync(),
					["guildQuestCompletions"] = await context.GuildQuestCompletions.AsNoTracking().CountAsync(),
					["missionProgress"] = await context.MissionProgress.AsNoTracking().CountAsync(),
					["towerProgress"] = await context.TowerProgress.AsNoTracking().CountAsync(),
					["loginRewards"] = await context.LoginRewards.AsNoTracking().CountAsync(),
					["dailyActivitySummaries"] = await context.DailyActivitySummaries.AsNoTracking().CountAsync(),
					["calendarEvents"] = await context.CalendarEvents.AsNoTracking().CountAsync(),
					["goals"] = await context.Goals.AsNoTracking().CountAsync()
				},
				["communication"] = new Dictionary<string, int> {
					["chatMessages"] = await context.ChatMessages.AsNoTracking().CountAsync(),
					["chatActivitySummaries"] = await context.ChatActivitySummaries.AsNoTracking().CountAsync(),
					["mailMessages"] = await context.MailMessages.AsNoTracking().CountAsync(),
					["mailRewards"] = await context.MailRewards.AsNoTracking().CountAsync()
				},
				["airship"] = new Dictionary<string, int> {
					["airshipGifts"] = await context.AirshipGifts.AsNoTracking().CountAsync()
				},
				["upgrades"] = new Dictionary<string, int> {
					["heroLevelUpgrades"] = await context.HeroLevelUpgrades.AsNoTracking().CountAsync(),
					["heroStarUpgrades"] = await context.HeroStarUpgrades.AsNoTracking().CountAsync(),
					["heroColorUpgrades"] = await context.HeroColorUpgrades.AsNoTracking().CountAsync(),
					["heroSkillUpgrades"] = await context.HeroSkillUpgrades.AsNoTracking().CountAsync(),
					["heroArtifactUpgrades"] = await context.HeroArtifactUpgrades.AsNoTracking().CountAsync(),
					["heroGlyphUpgrades"] = await context.HeroGlyphUpgrades.AsNoTracking().CountAsync(),
					["heroSkinUpgrades"] = await context.HeroSkinUpgrades.AsNoTracking().CountAsync(),
					["titanLevelUpgrades"] = await context.TitanLevelUpgrades.AsNoTracking().CountAsync(),
					["titanStarUpgrades"] = await context.TitanStarUpgrades.AsNoTracking().CountAsync(),
					["titanSkillUpgrades"] = await context.TitanSkillUpgrades.AsNoTracking().CountAsync(),
					["titanArtifactUpgrades"] = await context.TitanArtifactUpgrades.AsNoTracking().CountAsync(),
					["titanSkinUpgrades"] = await context.TitanSkinUpgrades.AsNoTracking().CountAsync()
				},
				["metadata"] = new Dictionary<string, int> {
					["opponents"] = await context.Opponents.AsNoTracking().CountAsync(),
					["syncMetadata"] = await context.SyncMetadata.AsNoTracking().CountAsync()
				}
			};

			var domainTotals = domainEntities.ToDictionary(entry => entry.Key, entry => entry.Value.Values.Sum());

			var response = new TrackingCoverageResponse {
				GeneratedAtUtc = DateTime.UtcNow,
				DomainEntities = domainEntities,
				DomainTotals = domainTotals,
				GrandTotal = domainTotals.Values.Sum(),
				RecommendationEndpoints = new List<string> {
					"GET /api/sync/battles/recommendations",
					"GET /api/sync/teams/recommendations",
					"GET /api/sync/teams/recommendations/arena/simulate",
					"GET /api/sync/teams/recommendations/profiles",
					"GET /api/sync/teams/recommendations/preferences",
					"PUT /api/sync/teams/recommendations/preferences",
					"GET /api/sync/teams/recommendations/backtest",
					"GET /api/sync/teams/recommendations/calibration",
					"GET /api/sync/teams/recommendations/operations-summary"
				},
				KnownCoverageGaps = new List<string> {
					"tower-of-eternity-dedicated-model"
				}
			};

			return Ok(response);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving tracking coverage");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	[HttpGet("snapshots")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
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

	[HttpGet("battles")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
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

	[HttpGet("teams/recommendations")]
	[ProducesResponseType(typeof(TeamRecommendationEngineResponse), StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetTeamRecommendations(
		[FromQuery] string mode = "arena",
		[FromQuery] string objective = "balanced",
		[FromQuery] int limit = 3,
		[FromQuery] int minSamples = 2,
		[FromQuery] int? preferredTrendWindowDays = null
	) {
		if (preferredTrendWindowDays.HasValue && preferredTrendWindowDays.Value is not (7 or 30 or 90)) {
			return BadRequest(new { error = "preferredTrendWindowDays must be one of: 7, 30, 90." });
		}

		try {
			var result = await _syncService.GetTeamRecommendationsAsync(mode, objective, limit, minSamples, preferredTrendWindowDays);
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving team recommendations for mode {Mode}", mode);
			return StatusCode(500, new { error = ex.Message });
		}
	}

	[HttpGet("teams/recommendations/arena/simulate")]
	[ProducesResponseType(typeof(ArenaTeamRecommendationSimulationResponse), StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetArenaTeamRecommendationSimulation(
		[FromQuery] string objective = "balanced",
		[FromQuery] int limit = 3,
		[FromQuery] int minSamples = 2,
		[FromQuery] long? opponentId = null,
		[FromQuery] int? opponentPower = null,
		[FromQuery] int powerWindow = 100000,
		[FromQuery] int? preferredTrendWindowDays = null
	) {
		if (preferredTrendWindowDays.HasValue && preferredTrendWindowDays.Value is not (7 or 30 or 90)) {
			return BadRequest(new { error = "preferredTrendWindowDays must be one of: 7, 30, 90." });
		}

		try {
			var result = await _syncService.GetArenaTeamRecommendationSimulationAsync(
				objective,
				limit,
				minSamples,
				opponentId,
				opponentPower,
				powerWindow,
				preferredTrendWindowDays
			);
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving arena team recommendation simulation payload");
			return StatusCode(500, new { error = ex.Message });
		}
	}

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
		} catch (ArgumentException ex) {
			return BadRequest(new { error = ex.Message });
		} catch (Exception ex) {
			_logger.LogError(ex, "Error saving team recommendation trend preference for mode {Mode}", request.Mode);
			return StatusCode(500, new { error = ex.Message });
		}
	}

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

	[HttpGet("teams/recommendations/calibration")]
	[ProducesResponseType(typeof(TeamRecommendationCalibrationResponse), StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetTeamRecommendationCalibration([FromQuery] string mode = "arena", [FromQuery] int? preferredTrendWindowDays = null) {
		if (preferredTrendWindowDays.HasValue && preferredTrendWindowDays.Value is not (7 or 30 or 90)) {
			return BadRequest(new { error = "preferredTrendWindowDays must be one of: 7, 30, 90." });
		}

		try {
			var result = await _syncService.GetTeamRecommendationCalibrationAsync(mode, preferredTrendWindowDays);
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving team recommendation calibration metadata for mode {Mode}", mode);
			return StatusCode(500, new { error = ex.Message });
		}
	}

	[HttpGet("teams/recommendations/operations-summary")]
	[ProducesResponseType(typeof(TeamRecommendationOperationsSummaryResponse), StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetTeamRecommendationOperationsSummary([FromQuery] int? preferredTrendWindowDays = null) {
		if (preferredTrendWindowDays.HasValue && preferredTrendWindowDays.Value is not (7 or 30 or 90)) {
			return BadRequest(new { error = "preferredTrendWindowDays must be one of: 7, 30, 90." });
		}

		try {
			var result = await _syncService.GetTeamRecommendationOperationsSummaryAsync(preferredTrendWindowDays);
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving team recommendation operations summary");
			return StatusCode(500, new { error = ex.Message });
		}
	}

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

	[HttpGet("projections/item-catalog")]
	[ProducesResponseType(typeof(ProjectedItemCatalogResponse), StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public IActionResult GetProjectedItemCatalog() {
		try {
			var result = _syncService.GetProjectedItemCatalog();
			return Ok(result);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving projected item catalog metadata");
			return StatusCode(500, new { error = ex.Message });
		}
	}

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

	[HttpGet("mission-progress")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetMissionProgress(
		[FromQuery] string? missionId = null,
		[FromQuery] long? playerId = null,
		[FromQuery] int limit = 100) {
		try {
			await using var context = await _contextFactory.CreateDbContextAsync();

			var query = context.MissionProgress.AsNoTracking().AsQueryable();

			if (!string.IsNullOrWhiteSpace(missionId)) {
				query = query.Where(m => m.MissionId == missionId);
			}

			if (playerId.HasValue) {
				query = query.Where(m => m.PlayerId == playerId.Value);
			}

			var items = await query
				.OrderByDescending(m => m.LastCompleted)
				.Take(limit)
				.ToListAsync();

			return Ok(items);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving mission progress");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	[HttpGet("shop-purchases")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetShopPurchases(
		[FromQuery] string? shopType = null,
		[FromQuery] long? playerId = null,
		[FromQuery] int limit = 100) {
		try {
			await using var context = await _contextFactory.CreateDbContextAsync();

			var query = context.ShopPurchases.AsNoTracking().AsQueryable();

			if (!string.IsNullOrWhiteSpace(shopType)) {
				query = query.Where(s => s.ShopType == shopType);
			}

			if (playerId.HasValue) {
				query = query.Where(s => s.PlayerId == playerId.Value);
			}

			var items = await query
				.OrderByDescending(s => s.PurchasedAt)
				.Take(limit)
				.ToListAsync();

			return Ok(items);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving shop purchases");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	[HttpGet("tower-progress")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetTowerProgress(
		[FromQuery] string? towerType = null,
		[FromQuery] long? playerId = null,
		[FromQuery] int limit = 100) {
		try {
			await using var context = await _contextFactory.CreateDbContextAsync();

			var query = context.TowerProgress.AsNoTracking().AsQueryable();

			if (!string.IsNullOrWhiteSpace(towerType)) {
				query = query.Where(t => t.TowerType == towerType);
			}

			if (playerId.HasValue) {
				query = query.Where(t => t.PlayerId == playerId.Value);
			}

			var items = await query
				.OrderByDescending(t => t.LastUpdate)
				.Take(limit)
				.ToListAsync();

			return Ok(items);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving tower progress");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	[HttpGet("guild-activities")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetGuildActivities(
		[FromQuery] long? guildId = null,
		[FromQuery] string? activityType = null,
		[FromQuery] int limit = 100) {
		try {
			await using var context = await _contextFactory.CreateDbContextAsync();

			var query = context.GuildActivities.AsNoTracking().AsQueryable();

			if (guildId.HasValue) {
				query = query.Where(g => g.GuildId == guildId.Value);
			}

			if (!string.IsNullOrWhiteSpace(activityType)) {
				query = query.Where(g => g.ActivityType == activityType);
			}

			var items = await query
				.OrderByDescending(g => g.Timestamp)
				.Take(limit)
				.ToListAsync();

			return Ok(items);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving guild activities");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	[HttpGet("chat-messages")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetChatMessages(
		[FromQuery] string? chatType = null,
		[FromQuery] string? conversationId = null,
		[FromQuery] int limit = 100) {
		try {
			await using var context = await _contextFactory.CreateDbContextAsync();

			var query = context.ChatMessages.AsNoTracking().AsQueryable();

			if (!string.IsNullOrWhiteSpace(chatType)) {
				query = query.Where(c => c.ChatType == chatType);
			}

			if (!string.IsNullOrWhiteSpace(conversationId)) {
				query = query.Where(c => c.ConversationId == conversationId);
			}

			var items = await query
				.OrderByDescending(c => c.Timestamp)
				.Take(limit)
				.ToListAsync();

			return Ok(items);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving chat messages");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	[HttpGet("mail")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetMail(
		[FromQuery] long? playerId = null,
		[FromQuery] string? mailId = null,
		[FromQuery] int limit = 100) {
		try {
			await using var context = await _contextFactory.CreateDbContextAsync();

			var query = context.MailMessages.AsNoTracking().AsQueryable();

			if (playerId.HasValue) {
				query = query.Where(m => m.PlayerId == playerId.Value);
			}

			if (!string.IsNullOrWhiteSpace(mailId)) {
				query = query.Where(m => m.MailId == mailId);
			}

			var items = await query
				.OrderByDescending(m => m.ReceivedAt)
				.Take(limit)
				.ToListAsync();

			return Ok(items);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving mail messages");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	[HttpGet("mail/rewards")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetMailRewards(
		[FromQuery] long? playerId = null,
		[FromQuery] string? mailId = null,
		[FromQuery] string? rewardType = null,
		[FromQuery] int limit = 100) {
		try {
			await using var context = await _contextFactory.CreateDbContextAsync();

			var query = context.MailRewards.AsNoTracking().AsQueryable();

			if (playerId.HasValue) {
				query = query.Where(r => r.PlayerId == playerId.Value);
			}

			if (!string.IsNullOrWhiteSpace(mailId)) {
				query = query.Where(r => r.MailId == mailId);
			}

			if (!string.IsNullOrWhiteSpace(rewardType)) {
				query = query.Where(r => r.RewardType == rewardType);
			}

			var items = await query
				.OrderByDescending(r => r.Timestamp)
				.Take(limit)
				.ToListAsync();

			return Ok(items);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving mail rewards");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	[HttpGet("airship")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetAirshipGifts(
		[FromQuery] long? playerId = null,
		[FromQuery] string? giftId = null,
		[FromQuery] string? sourceType = null,
		[FromQuery] int limit = 100) {
		try {
			await using var context = await _contextFactory.CreateDbContextAsync();

			var query = context.AirshipGifts.AsNoTracking().AsQueryable();

			if (playerId.HasValue) {
				query = query.Where(g => g.PlayerId == playerId.Value);
			}

			if (!string.IsNullOrWhiteSpace(giftId)) {
				query = query.Where(g => g.GiftId == giftId);
			}

			if (!string.IsNullOrWhiteSpace(sourceType)) {
				query = query.Where(g => g.SourceType == sourceType);
			}

			var items = await query
				.OrderByDescending(g => g.Timestamp)
				.Take(limit)
				.ToListAsync();

			return Ok(items);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving airship gifts");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	[HttpGet("expeditions")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetExpeditions(
		[FromQuery] string? expeditionId = null,
		[FromQuery] long? playerId = null,
		[FromQuery] int limit = 100) {
		try {
			await using var context = await _contextFactory.CreateDbContextAsync();

			var query = context.ExpeditionBattles.AsNoTracking().AsQueryable();

			if (!string.IsNullOrWhiteSpace(expeditionId)) {
				query = query.Where(e => e.ExpeditionId == expeditionId);
			}

			if (playerId.HasValue) {
				query = query.Where(e => e.PlayerId == playerId.Value);
			}

			var items = await query
				.OrderByDescending(e => e.Timestamp)
				.Take(limit)
				.ToListAsync();

			return Ok(items);
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving expedition battles");
			return StatusCode(500, new { error = ex.Message });
		}
	}

	[HttpGet("guild-participation")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
	public async Task<IActionResult> GetGuildParticipation(
		[FromQuery] long? guildId = null,
		[FromQuery] long? playerId = null,
		[FromQuery] int limit = 100) {
		try {
			await using var context = await _contextFactory.CreateDbContextAsync();

			var warQuery = context.GuildWarParticipations.AsNoTracking().AsQueryable();
			var raidQuery = context.GuildRaidParticipations.AsNoTracking().AsQueryable();
			var dungeonQuery = context.GuildDungeonParticipations.AsNoTracking().AsQueryable();
			var titaniteQuery = context.TitaniteTransactions.AsNoTracking().AsQueryable();

			if (guildId.HasValue) {
				warQuery = warQuery.Where(item => item.GuildId == guildId.Value);
				raidQuery = raidQuery.Where(item => item.GuildId == guildId.Value);
				dungeonQuery = dungeonQuery.Where(item => item.GuildId == guildId.Value);
				titaniteQuery = titaniteQuery.Where(item => item.GuildId == guildId.Value);
			}

			if (playerId.HasValue) {
				warQuery = warQuery.Where(item => item.PlayerId == playerId.Value);
				raidQuery = raidQuery.Where(item => item.PlayerId == playerId.Value);
				dungeonQuery = dungeonQuery.Where(item => item.PlayerId == playerId.Value);
				titaniteQuery = titaniteQuery.Where(item => item.PlayerId == playerId.Value);
			}

			var war = await warQuery.OrderByDescending(item => item.WarDate).Take(limit).ToListAsync();
			var raid = await raidQuery.OrderByDescending(item => item.RaidDate).Take(limit).ToListAsync();
			var dungeon = await dungeonQuery.OrderByDescending(item => item.DungeonDate).Take(limit).ToListAsync();
			var titanite = await titaniteQuery.OrderByDescending(item => item.Timestamp).Take(limit).ToListAsync();

			return Ok(new {
				guildWar = war,
				guildRaid = raid,
				guildDungeon = dungeon,
				titanite
			});
		} catch (Exception ex) {
			_logger.LogError(ex, "Error retrieving guild participation");
			return StatusCode(500, new { error = ex.Message });
		}
	}
}
