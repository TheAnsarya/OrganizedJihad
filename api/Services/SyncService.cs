using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using OrganizedJihad.Api.Models;
using OrganizedJihad.Api.Services.ProjectedItemCatalog;
using OrganizedJihad.Api.Services.Simulation;
using OrganizedJihad.Api.Services.TeamRecommendation;
using OrganizedJihad.Api.Services.ToolCatalog;
using OrganizedJihad.Data;
using OrganizedJihad.Data.Models;
using System;
using System.Text.Json;
using System.Threading.Tasks;

namespace OrganizedJihad.Api.Services;

/// <summary>
/// Service for synchronizing game data from the browser userscript to the local database.
/// Handles all business logic for data import, validation, and persistence.
///
/// Responsibilities:
/// - Import and process battle records from all arena types
/// - Track player snapshots and progression over time
/// - Record chest openings, guild activities, and raid boss attacks
/// - Manage goals and calendar events
/// - Generate database statistics
///
/// Design Pattern: Service Layer
/// Uses DbContextFactory for thread-safe database access in a web API.
///
/// References:
/// - Service Layer Pattern: https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/microservice-application-layer-implementation-web-api
/// - EF Core DbContextFactory: https://learn.microsoft.com/en-us/ef/core/dbcontext-configuration/#using-a-dbcontext-factory
/// - Transactions in EF Core: https://learn.microsoft.com/en-us/ef/core/saving/transactions
/// </summary>
public class SyncService {
	private static readonly IReadOnlyList<int> SupportedCalibrationTrendWindowDays = [7, 30, 90];

	private readonly IDbContextFactory<GameDatabaseContext> _contextFactory;
	private readonly ILogger<SyncService> _logger;
	private readonly IBattleSimulator _battleSimulator;
	private readonly IReadOnlyList<IExternalRecommendationSignalProvider> _externalSignalProviders;
	private readonly IProjectedItemCatalogProvider _projectedItemCatalogProvider;
	private readonly IExternalToolCatalogProvider _externalToolCatalogProvider;
	private readonly ITeamRecommendationStateStore _teamRecommendationStateStore;

	/// <summary>
	/// Initializes a new instance of the SyncService.
	/// </summary>
	/// <param name="contextFactory">Factory for creating database contexts</param>
	/// <param name="logger">Logger for diagnostic information</param>
	public SyncService(
		IDbContextFactory<GameDatabaseContext> contextFactory,
		ILogger<SyncService> logger) {
		_contextFactory = contextFactory;
		_logger = logger;
		_battleSimulator = new MonteCarloBattleSimulator(new BaselineBattleFeatureExtractor());
		_externalSignalProviders = [new CuratedToolCatalogSignalProvider()];
		_projectedItemCatalogProvider = new SeededProjectedItemCatalogProvider();
		_externalToolCatalogProvider = new CuratedExternalToolCatalogProvider();
		_teamRecommendationStateStore = new TeamRecommendationSyncMetadataStateStore();
	}

	/// <summary>
	/// Initializes a new instance of the SyncService with explicit catalog provider seams.
	/// </summary>
	/// <param name="contextFactory">Factory for creating database contexts</param>
	/// <param name="logger">Logger for diagnostic information</param>
	/// <param name="projectedItemCatalogProvider">Projected item catalog provider seam</param>
	public SyncService(
		IDbContextFactory<GameDatabaseContext> contextFactory,
		ILogger<SyncService> logger,
		IProjectedItemCatalogProvider projectedItemCatalogProvider) {
		_contextFactory = contextFactory;
		_logger = logger;
		_battleSimulator = new MonteCarloBattleSimulator(new BaselineBattleFeatureExtractor());
		_externalSignalProviders = [new CuratedToolCatalogSignalProvider()];
		_projectedItemCatalogProvider = projectedItemCatalogProvider;
		_externalToolCatalogProvider = new CuratedExternalToolCatalogProvider();
		_teamRecommendationStateStore = new TeamRecommendationSyncMetadataStateStore();
	}

	/// <summary>
	/// Initializes a new instance of the SyncService with explicit metadata provider seams.
	/// </summary>
	/// <param name="contextFactory">Factory for creating database contexts</param>
	/// <param name="logger">Logger for diagnostic information</param>
	/// <param name="projectedItemCatalogProvider">Projected item catalog provider seam</param>
	/// <param name="externalToolCatalogProvider">External tool catalog provider seam</param>
	public SyncService(
		IDbContextFactory<GameDatabaseContext> contextFactory,
		ILogger<SyncService> logger,
		IProjectedItemCatalogProvider projectedItemCatalogProvider,
		IExternalToolCatalogProvider externalToolCatalogProvider) {
		_contextFactory = contextFactory;
		_logger = logger;
		_battleSimulator = new MonteCarloBattleSimulator(new BaselineBattleFeatureExtractor());
		_externalSignalProviders = [new CuratedToolCatalogSignalProvider()];
		_projectedItemCatalogProvider = projectedItemCatalogProvider;
		_externalToolCatalogProvider = externalToolCatalogProvider;
		_teamRecommendationStateStore = new TeamRecommendationSyncMetadataStateStore();
	}

	/// <summary>
	/// Initializes a new instance of the SyncService with explicit Team Recommendation state-store seam.
	/// </summary>
	/// <param name="contextFactory">Factory for creating database contexts</param>
	/// <param name="logger">Logger for diagnostic information</param>
	/// <param name="projectedItemCatalogProvider">Projected item catalog provider seam</param>
	/// <param name="externalToolCatalogProvider">External tool catalog provider seam</param>
	/// <param name="teamRecommendationStateStore">Team Recommendation state persistence seam</param>
	public SyncService(
		IDbContextFactory<GameDatabaseContext> contextFactory,
		ILogger<SyncService> logger,
		IProjectedItemCatalogProvider projectedItemCatalogProvider,
		IExternalToolCatalogProvider externalToolCatalogProvider,
		ITeamRecommendationStateStore teamRecommendationStateStore) {
		_contextFactory = contextFactory;
		_logger = logger;
		_battleSimulator = new MonteCarloBattleSimulator(new BaselineBattleFeatureExtractor());
		_externalSignalProviders = [new CuratedToolCatalogSignalProvider()];
		_projectedItemCatalogProvider = projectedItemCatalogProvider;
		_externalToolCatalogProvider = externalToolCatalogProvider;
		_teamRecommendationStateStore = teamRecommendationStateStore;
	}

	/// <summary>
	/// Imports a complete batch of game data from the browser userscript.
	/// </summary>
	/// <param name="data">Complete game data snapshot including all entity types</param>
	/// <returns>Counts of imported records for each entity type</returns>
	/// <remarks>
	/// This method orchestrates the entire import process:
	/// 1. Creates a database transaction for atomicity
	/// 2. Imports player snapshot (current state)
	/// 3. Imports battle records from all arena types
	/// 4. Imports heroes and titans data
	/// 5. Imports guild-related data
	/// 6. Imports events, goals, and other tracking data
	/// 7. Commits transaction or rolls back on error
	///
	/// Uses transaction to ensure data consistency - if any import fails,
	/// all changes are rolled back to prevent partial data corruption.
	///
	/// https://learn.microsoft.com/en-us/ef/core/saving/transactions
	/// </remarks>
	/// <exception cref="DbUpdateException">Thrown when database update fails</exception>
	/// <exception cref="InvalidOperationException">Thrown when data validation fails</exception>
	public async Task<ImportCounts> ImportBrowserDataAsync(BrowserSyncData data) {
		_logger.LogInformation("Starting browser data import");
		var counts = new ImportCounts();

		try {
			// Create database context for this operation
			await using var context = await _contextFactory.CreateDbContextAsync();

			// Begin transaction to ensure all-or-nothing import
			// https://learn.microsoft.com/en-us/ef/core/saving/transactions
			await using var transaction = await context.Database.BeginTransactionAsync();

			try {
				// Import current player snapshot (state at time of sync)
				if (data.CurrentSnapshot != null) {
					context.PlayerSnapshots.Add(data.CurrentSnapshot);
					counts.PlayerSnapshots = 1;
				}

				// Import arena battles (standard PvP)
				if (data.ArenaBattles != null) {
					counts.ArenaBattles = await ImportArenaBattlesAsync(context, data.ArenaBattles);
				}

				// Import grand arena battles (tournament PvP)
				if (data.GrandArenaBattles != null) {
					counts.GrandArenaBattles = await ImportGrandArenaBattlesAsync(context, data.GrandArenaBattles);
				}

				// Import titan arena battles
				if (data.TitanArenaBattles != null) {
					counts.TitanArenaBattles = await ImportTitanArenaBattlesAsync(context, data.TitanArenaBattles);
				}

				// Import guild war battles
				if (data.GuildWarBattles != null) {
					counts.GuildWarBattles = await ImportGuildWarBattlesAsync(context, data.GuildWarBattles);
				}

				// Import raid boss attacks
				if (data.RaidBossAttacks != null) {
					counts.RaidBossAttacks = await ImportRaidBossAttacksAsync(context, data.RaidBossAttacks);
				}

				var chestOpeningIdMap = new Dictionary<int, int>();

				// Import chest openings
				if (data.ChestOpenings != null) {
					var chestImport = await ImportChestOpeningsAsync(context, data.ChestOpenings);
					counts.ChestOpenings = chestImport.Imported;
					chestOpeningIdMap = chestImport.OpeningIdMap;
				}

				if (data.ConsumableRewards != null && data.ConsumableRewards.Count > 0) {
					counts.ConsumableRewards = await ImportConsumableRewardsAsync(
						context,
						data.ConsumableRewards,
						chestOpeningIdMap
					);
				}

				// Import/update opponents
				if (data.Opponents != null) {
					counts.Opponents = await ImportOpponentsAsync(context, data.Opponents);
				}

				// Import goals
				if (data.Goals != null) {
					counts.Goals = await ImportGoalsAsync(context, data.Goals);
				}

				// Import calendar events
				if (data.CalendarEvents != null) {
					counts.CalendarEvents = await ImportCalendarEventsAsync(context, data.CalendarEvents);
				}

				// === Import Hero, Titan, and Pet Rosters ===

				// Import heroes
				if (data.Heroes != null) {
					counts.Heroes = await ImportHeroesAsync(context, data.Heroes);
				}

				// Import titans
				if (data.Titans != null) {
					counts.Titans = await ImportTitansAsync(context, data.Titans);
				}

				// Import pets
				if (data.Pets != null) {
					counts.Pets = await ImportPetsAsync(context, data.Pets);
				}

				// Import current inventory snapshot
				if (data.CurrentInventory != null) {
					context.InventorySnapshots.Add(data.CurrentInventory);
					counts.InventorySnapshots = 1;
				}

				// === Import Activity and Progress Tracking ===

				// Import quest completions
				if (data.QuestCompletions != null) {
					counts.QuestCompletions = await ImportQuestCompletionsAsync(context, data.QuestCompletions);
				}

				// Import/update mission progress
				if (data.MissionProgress != null) {
					counts.MissionProgress = await ImportMissionProgressAsync(context, data.MissionProgress);
				}

				// Import shop purchases
				if (data.ShopPurchases != null) {
					counts.ShopPurchases = await ImportShopPurchasesAsync(context, data.ShopPurchases);
				}

				// Import/update tower progress
				if (data.TowerProgress != null) {
					counts.TowerProgress = await ImportTowerProgressAsync(context, data.TowerProgress);
				}

				// Import expedition battles
				if (data.ExpeditionBattles != null) {
					counts.ExpeditionBattles = await ImportExpeditionBattlesAsync(context, data.ExpeditionBattles);
				}

				// Import resource transactions
				if (data.ResourceTransactions != null) {
					counts.ResourceTransactions = await ImportResourceTransactionsAsync(context, data.ResourceTransactions);
				}

				// Import guild activities
				if (data.GuildActivities != null) {
					counts.GuildActivities = await ImportGuildActivitiesAsync(context, data.GuildActivities);
				}

				// Import mailbox messages
				if (data.MailMessages != null) {
					counts.MailMessages = await ImportMailMessagesAsync(context, data.MailMessages);
				}

				// Import mailbox reward claim rows
				if (data.MailRewards != null) {
					counts.MailRewards = await ImportMailRewardsAsync(context, data.MailRewards);
				}

				// Import airship gift claim rows
				if (data.AirshipGifts != null) {
					counts.AirshipGifts = await ImportAirshipGiftsAsync(context, data.AirshipGifts);
				}

				// === Import Hero Upgrade Events ===

				if (data.HeroLevelUpgrades != null) {
					counts.HeroLevelUpgrades = await ImportHeroUpgradesAsync(context.HeroLevelUpgrades, data.HeroLevelUpgrades);
				}

				if (data.HeroStarUpgrades != null) {
					counts.HeroStarUpgrades = await ImportHeroUpgradesAsync(context.HeroStarUpgrades, data.HeroStarUpgrades);
				}

				if (data.HeroColorUpgrades != null) {
					counts.HeroColorUpgrades = await ImportHeroUpgradesAsync(context.HeroColorUpgrades, data.HeroColorUpgrades);
				}

				if (data.HeroSkillUpgrades != null) {
					counts.HeroSkillUpgrades = await ImportHeroUpgradesAsync(context.HeroSkillUpgrades, data.HeroSkillUpgrades);
				}

				if (data.HeroArtifactUpgrades != null) {
					counts.HeroArtifactUpgrades = await ImportHeroUpgradesAsync(context.HeroArtifactUpgrades, data.HeroArtifactUpgrades);
				}

				if (data.HeroGlyphUpgrades != null) {
					counts.HeroGlyphUpgrades = await ImportHeroUpgradesAsync(context.HeroGlyphUpgrades, data.HeroGlyphUpgrades);
				}

				if (data.HeroSkinUpgrades != null) {
					counts.HeroSkinUpgrades = await ImportHeroUpgradesAsync(context.HeroSkinUpgrades, data.HeroSkinUpgrades);
				}

				// === Import Titan Upgrade Events ===

				if (data.TitanLevelUpgrades != null) {
					counts.TitanLevelUpgrades = await ImportTitanUpgradesAsync(context.TitanLevelUpgrades, data.TitanLevelUpgrades);
				}

				if (data.TitanStarUpgrades != null) {
					counts.TitanStarUpgrades = await ImportTitanUpgradesAsync(context.TitanStarUpgrades, data.TitanStarUpgrades);
				}

				if (data.TitanSkillUpgrades != null) {
					counts.TitanSkillUpgrades = await ImportTitanUpgradesAsync(context.TitanSkillUpgrades, data.TitanSkillUpgrades);
				}

				if (data.TitanArtifactUpgrades != null) {
					counts.TitanArtifactUpgrades = await ImportTitanUpgradesAsync(context.TitanArtifactUpgrades, data.TitanArtifactUpgrades);
				}

				if (data.TitanSkinUpgrades != null) {
					counts.TitanSkinUpgrades = await ImportTitanUpgradesAsync(context.TitanSkinUpgrades, data.TitanSkinUpgrades);
				}

				// === Import Daily Activity Tracking ===

				if (data.DailyQuestCompletions != null) {
					counts.DailyQuestCompletions = await ImportDailyQuestCompletionsAsync(context, data.DailyQuestCompletions);
				}

				if (data.GuildQuestCompletions != null) {
					counts.GuildQuestCompletions = await ImportGuildQuestCompletionsAsync(context, data.GuildQuestCompletions);
				}

				if (data.LoginRewards != null) {
					counts.LoginRewards = await ImportLoginRewardsAsync(context, data.LoginRewards);
				}

				if (data.DailyActivitySummaries != null) {
					counts.DailyActivitySummaries = await ImportDailyActivitySummariesAsync(context, data.DailyActivitySummaries);
				}

				// === Import Inventory Tracking ===

				if (data.InventoryItemUsages != null) {
					counts.InventoryItemUsages = await ImportInventoryItemUsagesAsync(context, data.InventoryItemUsages);
				}

				if (data.EquipmentChanges != null) {
					counts.EquipmentChanges = await ImportEquipmentChangesAsync(context, data.EquipmentChanges);
				}

				// Update sync metadata
				await UpdateSyncMetadataAsync(context, "last_sync_timestamp", DateTime.UtcNow.ToString("O"));

				await transaction.CommitAsync();

				_logger.LogInformation(
					"Import completed successfully. Snapshots: {Snapshots}, Arena: {Arena}, Grand: {Grand}, Titan: {Titan}, " +
					"GuildWar: {GuildWar}, Raid: {Raid}, Chests: {Chests}, Opponents: {Opponents}, Goals: {Goals}, Events: {Events}",
					counts.PlayerSnapshots, counts.ArenaBattles, counts.GrandArenaBattles,
					counts.TitanArenaBattles, counts.GuildWarBattles, counts.RaidBossAttacks,
					counts.ChestOpenings, counts.Opponents, counts.Goals, counts.CalendarEvents);
			} catch (Exception ex) {
				await transaction.RollbackAsync();
				_logger.LogError(ex, "Error during import transaction");
				throw;
			}
		} catch (Exception ex) {
			_logger.LogError(ex, "Error importing browser data");
			throw;
		}

		return counts;
	}

	private async Task<int> ImportPlayerSnapshotsAsync(GameDatabaseContext context, PlayerSnapshot[] snapshots) {
		int imported = 0;
		foreach (var snapshot in snapshots) {
			// Check if snapshot already exists (by PlayerId + Timestamp)
			var exists = await context.PlayerSnapshots
				.AnyAsync(s => s.PlayerId == snapshot.PlayerId && s.Timestamp == snapshot.Timestamp);

			if (!exists) {
				context.PlayerSnapshots.Add(snapshot);
				imported++;
			}
		}

		await context.SaveChangesAsync();
		return imported;
	}

	private async Task<int> ImportArenaBattlesAsync(GameDatabaseContext context, List<ArenaBattle> battles) {
		int imported = 0;
		foreach (var battle in battles) {
			// Check for duplicate (by timestamp + opponent)
			var exists = await context.ArenaBattles
				.AnyAsync(b => b.Timestamp == battle.Timestamp && b.OpponentId == battle.OpponentId);

			if (!exists) {
				context.ArenaBattles.Add(battle);
				imported++;
			}
		}

		await context.SaveChangesAsync();
		return imported;
	}

	private async Task<int> ImportGrandArenaBattlesAsync(GameDatabaseContext context, List<GrandArenaBattle> battles) {
		int imported = 0;
		foreach (var battle in battles) {
			var exists = await context.GrandArenaBattles
				.AnyAsync(b => b.Timestamp == battle.Timestamp && b.OpponentId == battle.OpponentId);

			if (!exists) {
				context.GrandArenaBattles.Add(battle);
				imported++;
			}
		}

		await context.SaveChangesAsync();
		return imported;
	}

	private async Task<int> ImportTitanArenaBattlesAsync(GameDatabaseContext context, List<TitanArenaBattle> battles) {
		int imported = 0;
		foreach (var battle in battles) {
			var exists = await context.TitanArenaBattles
				.AnyAsync(b => b.Timestamp == battle.Timestamp && b.OpponentId == battle.OpponentId);

			if (!exists) {
				context.TitanArenaBattles.Add(battle);
				imported++;
			}
		}

		await context.SaveChangesAsync();
		return imported;
	}

	private async Task<int> ImportGuildWarBattlesAsync(GameDatabaseContext context, List<GuildWarBattle> battles) {
		int imported = 0;
		foreach (var battle in battles) {
			var exists = await context.GuildWarBattles
				.AnyAsync(b => b.Timestamp == battle.Timestamp && b.WarId == battle.WarId);

			if (!exists) {
				context.GuildWarBattles.Add(battle);
				imported++;
			}
		}

		await context.SaveChangesAsync();
		return imported;
	}

	private async Task<int> ImportRaidBossAttacksAsync(GameDatabaseContext context, List<RaidBossAttack> attacks) {
		int imported = 0;
		foreach (var attack in attacks) {
			var exists = await context.RaidBossAttacks
				.AnyAsync(a => a.Timestamp == attack.Timestamp && a.BossName == attack.BossName);

			if (!exists) {
				context.RaidBossAttacks.Add(attack);
				imported++;
			}
		}

		await context.SaveChangesAsync();
		return imported;
	}

	private async Task<(int Imported, Dictionary<int, int> OpeningIdMap)> ImportChestOpeningsAsync(
		GameDatabaseContext context,
		List<ChestOpening> openings
	) {
		int imported = 0;
		var openingIdMap = new Dictionary<int, int>();

		foreach (var opening in openings) {
			var existing = await context.ChestOpenings
				.Include(c => c.Drops)
				.FirstOrDefaultAsync(c =>
					c.Timestamp == opening.Timestamp &&
					c.ChestType == opening.ChestType &&
					c.Quantity == opening.Quantity &&
					c.OpenMethod == opening.OpenMethod
				);

			if (existing == null) {
				if (string.IsNullOrWhiteSpace(opening.ChestType)) {
					opening.ChestType = "unknown";
				}

				if (string.IsNullOrWhiteSpace(opening.OpenMethod)) {
					opening.OpenMethod = "tracked";
				}

				context.ChestOpenings.Add(opening);
				await context.SaveChangesAsync();
				imported++;
				existing = opening;
			} else if (opening.Drops != null && opening.Drops.Count > 0) {
				await MergeChestDropsAsync(context, existing, opening.Drops);
			}

			if (opening.Id > 0) {
				openingIdMap[opening.Id] = existing.Id;
			}
		}

		return (imported, openingIdMap);
	}

	private async Task<int> ImportConsumableRewardsAsync(
		GameDatabaseContext context,
		List<ConsumableRewardSyncRecord> rewards,
		Dictionary<int, int> openingIdMap
	) {
		int imported = 0;

		foreach (var reward in rewards) {
			int? chestOpeningId = null;

			if (reward.OpeningId > 0 && openingIdMap.TryGetValue(reward.OpeningId, out var mappedId)) {
				chestOpeningId = mappedId;
			}

			if (!chestOpeningId.HasValue) {
				chestOpeningId = await context.ChestOpenings
					.AsNoTracking()
					.Where(c =>
						c.Timestamp == reward.Timestamp &&
						c.ChestType == reward.SourceType
					)
					.Select(c => (int?)c.Id)
					.FirstOrDefaultAsync();
			}

			if (!chestOpeningId.HasValue) {
				continue;
			}

			var itemId = string.IsNullOrWhiteSpace(reward.ItemId) ? "unknown" : reward.ItemId;
			var itemType = string.IsNullOrWhiteSpace(reward.ItemType) ? "unknown" : reward.ItemType;
			var quantity = reward.Quantity <= 0 ? 1 : reward.Quantity;

			var exists = await context.ChestDrops
				.AnyAsync(d =>
					d.ChestOpeningId == chestOpeningId.Value &&
					d.ItemId == itemId &&
					d.ItemType == itemType &&
					d.Quantity == quantity
				);

			if (exists) {
				continue;
			}

			context.ChestDrops.Add(new ChestDrop {
				ChestOpeningId = chestOpeningId.Value,
				ItemId = itemId,
				ItemType = itemType,
				ItemName = $"{itemType}:{itemId}",
				Quantity = quantity,
			});
			imported++;
		}

		if (imported > 0) {
			await context.SaveChangesAsync();
		}

		return imported;
	}

	private static async Task MergeChestDropsAsync(
		GameDatabaseContext context,
		ChestOpening opening,
		ICollection<ChestDrop> incomingDrops
	) {
		if (incomingDrops.Count == 0) {
			return;
		}

		foreach (var incoming in incomingDrops) {
			var itemId = string.IsNullOrWhiteSpace(incoming.ItemId) ? "unknown" : incoming.ItemId;
			var itemType = string.IsNullOrWhiteSpace(incoming.ItemType) ? "unknown" : incoming.ItemType;
			var quantity = incoming.Quantity <= 0 ? 1 : incoming.Quantity;

			var exists = opening.Drops.Any(d =>
				d.ItemId == itemId &&
				d.ItemType == itemType &&
				d.Quantity == quantity &&
				d.Rarity == incoming.Rarity
			);

			if (exists) {
				continue;
			}

			context.ChestDrops.Add(new ChestDrop {
				ChestOpeningId = opening.Id,
				ItemId = itemId,
				ItemType = itemType,
				ItemName = string.IsNullOrWhiteSpace(incoming.ItemName) ? $"{itemType}:{itemId}" : incoming.ItemName,
				Quantity = quantity,
				Rarity = incoming.Rarity,
				EstimatedValue = incoming.EstimatedValue,
			});
		}

		await context.SaveChangesAsync();
	}

	private async Task<int> ImportOpponentsAsync(GameDatabaseContext context, List<Opponent> opponents) {
		int imported = 0;
		foreach (var opponent in opponents) {
			var existing = await context.Opponents
				.FirstOrDefaultAsync(o => o.OpponentId == opponent.OpponentId);

			if (existing == null) {
				context.Opponents.Add(opponent);
				imported++;
			} else {
				// Update existing opponent stats
				existing.OpponentName = opponent.OpponentName;
				existing.LastKnownPower = opponent.LastKnownPower;
				existing.LastKnownRank = opponent.LastKnownRank;
				existing.GuildName = opponent.GuildName;
				existing.TotalWins = opponent.TotalWins;
				existing.TotalLosses = opponent.TotalLosses;
				existing.ArenaWins = opponent.ArenaWins;
				existing.ArenaLosses = opponent.ArenaLosses;
				existing.GrandArenaWins = opponent.GrandArenaWins;
				existing.GrandArenaLosses = opponent.GrandArenaLosses;
				existing.TitanArenaWins = opponent.TitanArenaWins;
				existing.TitanArenaLosses = opponent.TitanArenaLosses;
				existing.LastSeen = opponent.LastSeen;
				existing.LastKnownTeam = opponent.LastKnownTeam;
			}
		}

		await context.SaveChangesAsync();
		return imported;
	}

	/// <summary>
	/// Imports or updates goals from the browser.
	/// Goals are user-created and can be modified, so we use upsert logic.
	/// If a goal with the same Id exists, update it; otherwise, create a new one.
	/// </summary>
	/// <param name="context">Database context for EF Core operations</param>
	/// <param name="goals">List of goals to import from browser sync</param>
	/// <returns>Number of goals imported (new records only, not updates)</returns>
	private async Task<int> ImportGoalsAsync(GameDatabaseContext context, List<Goal> goals) {
		int imported = 0;

		foreach (var goal in goals) {
			// Check if goal already exists by Id (if provided and > 0) or by Title + CreatedAt
			Goal? existing = null;

			if (goal.Id > 0) {
				// If the goal has an Id from the browser, try to find it
				existing = await context.Goals.FirstOrDefaultAsync(g => g.Id == goal.Id);
			}

			// Try to find by Title + CreatedAt to avoid duplicates
			existing ??= await context.Goals
				.FirstOrDefaultAsync(g => g.Title == goal.Title && g.CreatedAt == goal.CreatedAt);

			if (existing == null) {
				// New goal - add it
				context.Goals.Add(goal);
				imported++;
			} else {
				// Update existing goal with latest data from browser
				// This allows users to modify goals in the browser and sync changes
				existing.Title = goal.Title;
				existing.Description = goal.Description;
				existing.Type = goal.Type;
				existing.Category = goal.Category;
				existing.TargetValue = goal.TargetValue;
				existing.CurrentValue = goal.CurrentValue;
				existing.Unit = goal.Unit;
				existing.IsCompleted = goal.IsCompleted;
				existing.TargetDate = goal.TargetDate;
				existing.CompletedAt = goal.CompletedAt;
				existing.Priority = goal.Priority;
				existing.Notes = goal.Notes;
				// Don't update CreatedAt - preserve original creation time
			}
		}

		await context.SaveChangesAsync();
		return imported;
	}

	/// <summary>
	/// Imports or updates calendar events from the browser.
	/// Events are user-created and can be modified, so we use upsert logic.
	/// If an event with the same Id exists, update it; otherwise, create a new one.
	/// </summary>
	/// <param name="context">Database context for EF Core operations</param>
	/// <param name="events">List of calendar events to import from browser sync</param>
	/// <returns>Number of events imported (new records only, not updates)</returns>
	private async Task<int> ImportCalendarEventsAsync(GameDatabaseContext context, List<CalendarEvent> events) {
		int imported = 0;

		foreach (var calendarEvent in events) {
			// Check if event already exists by Id (if provided and > 0) or by Title + EventDate
			CalendarEvent? existing = null;

			if (calendarEvent.Id > 0) {
				// If the event has an Id from the browser, try to find it
				existing = await context.CalendarEvents
					.FirstOrDefaultAsync(e => e.Id == calendarEvent.Id);
			}

			// Try to find by Title + EventDate to avoid duplicates
			existing ??= await context.CalendarEvents
				.FirstOrDefaultAsync(e => e.Title == calendarEvent.Title && e.EventDate == calendarEvent.EventDate);

			if (existing == null) {
				// New event - add it
				context.CalendarEvents.Add(calendarEvent);
				imported++;
			} else {
				// Update existing event with latest data from browser
				// This allows users to modify events in the browser and sync changes
				existing.Title = calendarEvent.Title;
				existing.Description = calendarEvent.Description;
				existing.Type = calendarEvent.Type;
				existing.EventDate = calendarEvent.EventDate;
				existing.DurationMinutes = calendarEvent.DurationMinutes;
				existing.EnableReminders = calendarEvent.EnableReminders;
				existing.ReminderMinutesBefore = calendarEvent.ReminderMinutesBefore;
				existing.IsCompleted = calendarEvent.IsCompleted;
				existing.IsRecurring = calendarEvent.IsRecurring;
				existing.RecurrencePattern = calendarEvent.RecurrencePattern;
				existing.Notes = calendarEvent.Notes;
				// Don't update CreatedAt - preserve original creation time
			}
		}

		await context.SaveChangesAsync();
		return imported;
	}

	private async Task UpdateSyncMetadataAsync(GameDatabaseContext context, string key, string value) {
		var metadata = await context.SyncMetadata.FirstOrDefaultAsync(m => m.Key == key);
		if (metadata == null) {
			metadata = new SyncMetadata {
				Key = key,
				Value = value,
				UpdatedAt = DateTime.UtcNow
			};
			context.SyncMetadata.Add(metadata);
		} else {
			metadata.Value = value;
			metadata.UpdatedAt = DateTime.UtcNow;
		}

		await context.SaveChangesAsync();
	}

	public async Task<DateTime?> GetLastSyncTimestampAsync() {
		await using var context = await _contextFactory.CreateDbContextAsync();
		var metadata = await context.SyncMetadata
			.FirstOrDefaultAsync(m => m.Key == "last_sync_timestamp");

		if (metadata != null && DateTime.TryParse(metadata.Value, out var timestamp)) {
			return timestamp;
		}

		return null;
	}

	// === Hero, Titan, and Pet Import Methods ===

	private async Task<int> ImportHeroesAsync(GameDatabaseContext context, List<Hero> heroes) {
		// Heroes are immutable snapshots - always insert new records
		context.Heroes.AddRange(heroes);
		await context.SaveChangesAsync();
		return heroes.Count;
	}

	private async Task<int> ImportTitansAsync(GameDatabaseContext context, List<Titan> titans) {
		// Titans are immutable snapshots - always insert new records
		context.Titans.AddRange(titans);
		await context.SaveChangesAsync();
		return titans.Count;
	}

	private async Task<int> ImportPetsAsync(GameDatabaseContext context, List<Pet> pets) {
		// Pets are immutable snapshots - always insert new records
		context.Pets.AddRange(pets);
		await context.SaveChangesAsync();
		return pets.Count;
	}

	// === Activity and Progress Import Methods ===

	private async Task<int> ImportQuestCompletionsAsync(GameDatabaseContext context, List<QuestCompletion> quests) {
		int imported = 0;
		foreach (var quest in quests) {
			// Check for duplicate (by PlayerId + QuestId + CompletedAt)
			var exists = await context.QuestCompletions
				.AnyAsync(q => q.PlayerId == quest.PlayerId &&
							   q.QuestId == quest.QuestId &&
							   q.CompletedAt == quest.CompletedAt);

			if (!exists) {
				context.QuestCompletions.Add(quest);
				imported++;
			}
		}

		await context.SaveChangesAsync();
		return imported;
	}

	private async Task<int> ImportMissionProgressAsync(GameDatabaseContext context, List<MissionProgress> missions) {
		int imported = 0;

		foreach (var mission in missions) {
			// Mission progress is mutable - upsert by PlayerId + MissionId
			var existing = await context.MissionProgress
				.FirstOrDefaultAsync(m => m.PlayerId == mission.PlayerId && m.MissionId == mission.MissionId);

			if (existing == null) {
				context.MissionProgress.Add(mission);
				imported++;
			} else {
				// Update with latest progress
				existing.Stars = mission.Stars;
				existing.HighestLevel = mission.HighestLevel;
				existing.LastCompleted = mission.LastCompleted;
				existing.CompletionCount = mission.CompletionCount;
			}
		}

		await context.SaveChangesAsync();
		return imported;
	}

	private async Task<int> ImportShopPurchasesAsync(GameDatabaseContext context, List<ShopPurchase> purchases) {
		int imported = 0;
		foreach (var purchase in purchases) {
			// Check for duplicate (by PlayerId + PurchasedAt + ItemId)
			var exists = await context.ShopPurchases
				.AnyAsync(p => p.PlayerId == purchase.PlayerId &&
							   p.PurchasedAt == purchase.PurchasedAt &&
							   p.ItemId == purchase.ItemId);

			if (!exists) {
				context.ShopPurchases.Add(purchase);
				imported++;
			}
		}

		await context.SaveChangesAsync();
		return imported;
	}

	private async Task<int> ImportTowerProgressAsync(GameDatabaseContext context, List<TowerProgress> towers) {
		int imported = 0;

		foreach (var tower in towers) {
			// Tower progress is mutable - upsert by PlayerId + TowerType
			var existing = await context.TowerProgress
				.FirstOrDefaultAsync(t => t.PlayerId == tower.PlayerId && t.TowerType == tower.TowerType);

			if (existing == null) {
				context.TowerProgress.Add(tower);
				imported++;
			} else {
				// Update with latest progress
				existing.HighestFloor = tower.HighestFloor;
				existing.LastUpdate = tower.LastUpdate;
				existing.FloorData = tower.FloorData;
			}
		}

		await context.SaveChangesAsync();
		return imported;
	}

	private async Task<int> ImportExpeditionBattlesAsync(GameDatabaseContext context, List<ExpeditionBattle> battles) {
		int imported = 0;
		foreach (var battle in battles) {
			// Check for duplicate (by PlayerId + Timestamp + ExpeditionId)
			var exists = await context.ExpeditionBattles
				.AnyAsync(b => b.PlayerId == battle.PlayerId &&
							   b.Timestamp == battle.Timestamp &&
							   b.ExpeditionId == battle.ExpeditionId);

			if (!exists) {
				context.ExpeditionBattles.Add(battle);
				imported++;
			}
		}

		await context.SaveChangesAsync();
		return imported;
	}

	private async Task<int> ImportResourceTransactionsAsync(GameDatabaseContext context, List<ResourceTransaction> transactions) {
		// Resource transactions are immutable - always insert new records
		// They represent economic events that happened
		context.ResourceTransactions.AddRange(transactions);
		await context.SaveChangesAsync();
		return transactions.Count;
	}

	private async Task<int> ImportGuildActivitiesAsync(GameDatabaseContext context, List<GuildActivity> activities) {
		int imported = 0;
		foreach (var activity in activities) {
			// Check for duplicate (by PlayerId + Timestamp + ActivityType)
			var exists = await context.GuildActivities
				.AnyAsync(a => a.PlayerId == activity.PlayerId &&
							   a.Timestamp == activity.Timestamp &&
							   a.ActivityType == activity.ActivityType);

			if (!exists) {
				context.GuildActivities.Add(activity);
				imported++;
			}
		}

		await context.SaveChangesAsync();
		return imported;
	}

	private async Task<int> ImportMailMessagesAsync(GameDatabaseContext context, List<MailMessage> messages) {
		int imported = 0;
		foreach (var message in messages) {
			var exists = await context.MailMessages
				.AnyAsync(m => m.PlayerId == message.PlayerId &&
							   m.MailId == message.MailId &&
							   m.ReceivedAt == message.ReceivedAt);

			if (!exists) {
				context.MailMessages.Add(message);
				imported++;
			}
		}

		await context.SaveChangesAsync();
		return imported;
	}

	private async Task<int> ImportMailRewardsAsync(GameDatabaseContext context, List<MailReward> rewards) {
		int imported = 0;
		foreach (var reward in rewards) {
			var exists = await context.MailRewards
				.AnyAsync(r => r.PlayerId == reward.PlayerId &&
							   r.MailId == reward.MailId &&
							   r.RewardType == reward.RewardType &&
							   r.RewardId == reward.RewardId &&
							   r.Timestamp == reward.Timestamp);

			if (!exists) {
				context.MailRewards.Add(reward);
				imported++;
			}
		}

		await context.SaveChangesAsync();
		return imported;
	}

	private async Task<int> ImportAirshipGiftsAsync(GameDatabaseContext context, List<AirshipGift> gifts) {
		int imported = 0;
		foreach (var gift in gifts) {
			var exists = await context.AirshipGifts
				.AnyAsync(g => g.PlayerId == gift.PlayerId &&
							   g.GiftId == gift.GiftId &&
							   g.Timestamp == gift.Timestamp);

			if (!exists) {
				context.AirshipGifts.Add(gift);
				imported++;
			}
		}

		await context.SaveChangesAsync();
		return imported;
	}

	// === Hero Upgrade Import Methods ===

	/// <summary>
	/// Generic import method for hero upgrade events.
	/// Hero upgrades are immutable event records with deduplication by HeroId + Timestamp.
	/// </summary>
	/// <typeparam name="T">The specific hero upgrade type (inherits HeroUpgradeBase)</typeparam>
	/// <param name="dbSet">The DbSet for the upgrade type</param>
	/// <param name="upgrades">List of upgrade events to import</param>
	/// <returns>Number of records imported (excluding duplicates)</returns>
	private async Task<int> ImportHeroUpgradesAsync<T>(DbSet<T> dbSet, List<T> upgrades) where T : HeroUpgradeBase {
		int imported = 0;
		foreach (var upgrade in upgrades) {
			// Deduplicate by HeroId + Timestamp (same hero can't upgrade twice at the exact same instant)
			var exists = await dbSet
				.AnyAsync(u => u.HeroId == upgrade.HeroId && u.Timestamp == upgrade.Timestamp);

			if (!exists) {
				dbSet.Add(upgrade);
				imported++;
			}
		}

		// SaveChanges is handled by the caller via transaction
		return imported;
	}

	// === Titan Upgrade Import Methods ===

	/// <summary>
	/// Generic import method for titan upgrade events.
	/// Titan upgrades are immutable event records with deduplication by TitanId + Timestamp.
	/// </summary>
	/// <typeparam name="T">The specific titan upgrade type (inherits TitanUpgradeBase)</typeparam>
	/// <param name="dbSet">The DbSet for the upgrade type</param>
	/// <param name="upgrades">List of upgrade events to import</param>
	/// <returns>Number of records imported (excluding duplicates)</returns>
	private async Task<int> ImportTitanUpgradesAsync<T>(DbSet<T> dbSet, List<T> upgrades) where T : TitanUpgradeBase {
		int imported = 0;
		foreach (var upgrade in upgrades) {
			// Deduplicate by TitanId + Timestamp
			var exists = await dbSet
				.AnyAsync(u => u.TitanId == upgrade.TitanId && u.Timestamp == upgrade.Timestamp);

			if (!exists) {
				dbSet.Add(upgrade);
				imported++;
			}
		}

		return imported;
	}

	// === Daily Activity Import Methods ===

	/// <summary>
	/// Imports daily quest completion events with deduplication.
	/// Deduplicates by PlayerId + QuestId + CompletedAt.
	/// </summary>
	private async Task<int> ImportDailyQuestCompletionsAsync(GameDatabaseContext context, List<DailyQuestCompletion> quests) {
		int imported = 0;
		foreach (var quest in quests) {
			var exists = await context.DailyQuestCompletions
				.AnyAsync(q => q.PlayerId == quest.PlayerId &&
							   q.QuestId == quest.QuestId &&
							   q.CompletedAt == quest.CompletedAt);

			if (!exists) {
				context.DailyQuestCompletions.Add(quest);
				imported++;
			}
		}

		await context.SaveChangesAsync();
		return imported;
	}

	/// <summary>
	/// Imports guild quest completion events with deduplication.
	/// Deduplicates by PlayerId + QuestId + CompletedAt.
	/// </summary>
	private async Task<int> ImportGuildQuestCompletionsAsync(GameDatabaseContext context, List<GuildQuestCompletion> quests) {
		int imported = 0;
		foreach (var quest in quests) {
			var exists = await context.GuildQuestCompletions
				.AnyAsync(q => q.PlayerId == quest.PlayerId &&
							   q.QuestId == quest.QuestId &&
							   q.CompletedAt == quest.CompletedAt);

			if (!exists) {
				context.GuildQuestCompletions.Add(quest);
				imported++;
			}
		}

		await context.SaveChangesAsync();
		return imported;
	}

	/// <summary>
	/// Imports login reward claims with deduplication.
	/// Deduplicates by PlayerId + ClaimedAt (one reward per login time).
	/// </summary>
	private async Task<int> ImportLoginRewardsAsync(GameDatabaseContext context, List<LoginReward> rewards) {
		int imported = 0;
		foreach (var reward in rewards) {
			var exists = await context.LoginRewards
				.AnyAsync(r => r.PlayerId == reward.PlayerId &&
							   r.ClaimedAt == reward.ClaimedAt);

			if (!exists) {
				context.LoginRewards.Add(reward);
				imported++;
			}
		}

		await context.SaveChangesAsync();
		return imported;
	}

	/// <summary>
	/// Imports daily activity summaries with upsert logic.
	/// One summary per player per day - updates if exists, inserts if new.
	/// </summary>
	private async Task<int> ImportDailyActivitySummariesAsync(GameDatabaseContext context, List<DailyActivitySummary> summaries) {
		int imported = 0;
		foreach (var summary in summaries) {
			var existing = await context.DailyActivitySummaries
				.FirstOrDefaultAsync(s => s.PlayerId == summary.PlayerId &&
										  s.SummaryDate == summary.SummaryDate);

			if (existing == null) {
				context.DailyActivitySummaries.Add(summary);
				imported++;
			} else {
				// Upsert - update with latest data
				existing.TotalActivityPoints = summary.TotalActivityPoints;
				existing.DailyQuestsCompleted = summary.DailyQuestsCompleted;
				existing.GuildQuestsCompleted = summary.GuildQuestsCompleted;
				existing.ArenaBattlesFought = summary.ArenaBattlesFought;
				existing.GrandArenaBattlesFought = summary.GrandArenaBattlesFought;
				existing.TowerFloorsCleared = summary.TowerFloorsCleared;
				existing.CampaignMissionsCompleted = summary.CampaignMissionsCompleted;
				existing.OutlandBossesFought = summary.OutlandBossesFought;
				existing.GoldEarned = summary.GoldEarned;
				existing.GoldSpent = summary.GoldSpent;
				existing.EmeraldsEarned = summary.EmeraldsEarned;
				existing.EmeraldsSpent = summary.EmeraldsSpent;
				existing.DailyChestClaimed = summary.DailyChestClaimed;
			}
		}

		await context.SaveChangesAsync();
		return imported;
	}

	// === Inventory Import Methods ===

	/// <summary>
	/// Imports inventory item usage events with deduplication.
	/// Deduplicates by PlayerId + ItemId + Timestamp.
	/// </summary>
	private async Task<int> ImportInventoryItemUsagesAsync(GameDatabaseContext context, List<InventoryItemUsage> usages) {
		int imported = 0;
		foreach (var usage in usages) {
			var exists = await context.InventoryItemUsages
				.AnyAsync(u => u.PlayerId == usage.PlayerId &&
							   u.ItemId == usage.ItemId &&
							   u.Timestamp == usage.Timestamp);

			if (!exists) {
				context.InventoryItemUsages.Add(usage);
				imported++;
			}
		}

		await context.SaveChangesAsync();
		return imported;
	}

	/// <summary>
	/// Imports equipment change events with deduplication.
	/// Deduplicates by HeroId + SlotIndex + Timestamp.
	/// </summary>
	private async Task<int> ImportEquipmentChangesAsync(GameDatabaseContext context, List<EquipmentChange> changes) {
		int imported = 0;
		foreach (var change in changes) {
			var exists = await context.EquipmentChanges
				.AnyAsync(c => c.HeroId == change.HeroId &&
							   c.SlotIndex == change.SlotIndex &&
							   c.Timestamp == change.Timestamp);

			if (!exists) {
				context.EquipmentChanges.Add(change);
				imported++;
			}
		}

		await context.SaveChangesAsync();
		return imported;
	}

	/// <summary>
	/// Gets hero upgrade history for a specific hero or all heroes, filtered by upgrade type.
	/// </summary>
	/// <param name="heroId">Optional hero ID filter. If null, returns all heroes.</param>
	/// <param name="upgradeType">
	/// Optional upgrade type filter: "level", "star", "color", "skill", "artifact", "glyph", "skin".
	/// If null, returns all types.
	/// </param>
	/// <param name="limit">Maximum number of results per type (default 50).</param>
	/// <returns>Object containing arrays of each upgrade type.</returns>
	/// <remarks>
	/// Uses AsNoTracking() for read-only performance optimization.
	/// Results are ordered by Timestamp descending (newest first).
	/// https://learn.microsoft.com/en-us/ef/core/querying/tracking#no-tracking-queries
	/// </remarks>
	public async Task<object> GetHeroUpgradeHistoryAsync(long? heroId = null, string? upgradeType = null, int limit = 50) {
		await using var context = await _contextFactory.CreateDbContextAsync();
		var result = new Dictionary<string, object>();

		// Helper to apply common filters and ordering to any hero upgrade query
		async Task<List<T>> QueryUpgrades<T>(IQueryable<T> query) where T : HeroUpgradeBase {
			if (heroId.HasValue) {
				query = query.Where(u => u.HeroId == heroId.Value);
			}

			return await query
				.AsNoTracking()
				.OrderByDescending(u => u.Timestamp)
				.Take(limit)
				.ToListAsync();
		}

		// Include each upgrade type based on filter (or all if no filter specified)
		if (upgradeType is null or "level") {
			result["levelUpgrades"] = await QueryUpgrades(context.HeroLevelUpgrades);
		}

		if (upgradeType is null or "star") {
			result["starUpgrades"] = await QueryUpgrades(context.HeroStarUpgrades);
		}

		if (upgradeType is null or "color") {
			result["colorUpgrades"] = await QueryUpgrades(context.HeroColorUpgrades);
		}

		if (upgradeType is null or "skill") {
			result["skillUpgrades"] = await QueryUpgrades(context.HeroSkillUpgrades);
		}

		if (upgradeType is null or "artifact") {
			result["artifactUpgrades"] = await QueryUpgrades(context.HeroArtifactUpgrades);
		}

		if (upgradeType is null or "glyph") {
			result["glyphUpgrades"] = await QueryUpgrades(context.HeroGlyphUpgrades);
		}

		if (upgradeType is null or "skin") {
			result["skinUpgrades"] = await QueryUpgrades(context.HeroSkinUpgrades);
		}

		return result;
	}

	/// <summary>
	/// Gets titan upgrade history for a specific titan or all titans, filtered by upgrade type.
	/// </summary>
	/// <param name="titanId">Optional titan ID filter. If null, returns all titans.</param>
	/// <param name="upgradeType">
	/// Optional upgrade type filter: "level", "star", "skill", "artifact", "skin".
	/// If null, returns all types.
	/// </param>
	/// <param name="limit">Maximum number of results per type (default 50).</param>
	/// <returns>Object containing arrays of each upgrade type.</returns>
	/// <remarks>
	/// Uses AsNoTracking() for read-only performance optimization.
	/// Results are ordered by Timestamp descending (newest first).
	/// </remarks>
	public async Task<object> GetTitanUpgradeHistoryAsync(long? titanId = null, string? upgradeType = null, int limit = 50) {
		await using var context = await _contextFactory.CreateDbContextAsync();
		var result = new Dictionary<string, object>();

		// Helper to apply common filters and ordering to any titan upgrade query
		async Task<List<T>> QueryUpgrades<T>(IQueryable<T> query) where T : TitanUpgradeBase {
			if (titanId.HasValue) {
				query = query.Where(u => u.TitanId == titanId.Value);
			}

			return await query
				.AsNoTracking()
				.OrderByDescending(u => u.Timestamp)
				.Take(limit)
				.ToListAsync();
		}

		// Include each upgrade type based on filter
		if (upgradeType is null or "level") {
			result["levelUpgrades"] = await QueryUpgrades(context.TitanLevelUpgrades);
		}

		if (upgradeType is null or "star") {
			result["starUpgrades"] = await QueryUpgrades(context.TitanStarUpgrades);
		}

		if (upgradeType is null or "skill") {
			result["skillUpgrades"] = await QueryUpgrades(context.TitanSkillUpgrades);
		}

		if (upgradeType is null or "artifact") {
			result["artifactUpgrades"] = await QueryUpgrades(context.TitanArtifactUpgrades);
		}

		if (upgradeType is null or "skin") {
			result["skinUpgrades"] = await QueryUpgrades(context.TitanSkinUpgrades);
		}

		return result;
	}

	/// <summary>
	/// Gets daily activity data including summaries, quest completions, and login rewards.
	/// </summary>
	/// <param name="date">Optional date filter. If null, returns recent data.</param>
	/// <param name="playerId">Optional player ID filter.</param>
	/// <param name="limit">Maximum number of results per category (default 30).</param>
	/// <returns>Object containing daily activity data grouped by type.</returns>
	/// <remarks>
	/// When a date is specified, returns data for that specific day.
	/// Otherwise, returns the most recent entries up to the limit.
	/// </remarks>
	public async Task<object> GetDailyActivityAsync(DateTime? date = null, long? playerId = null, int limit = 30) {
		await using var context = await _contextFactory.CreateDbContextAsync();

		// Build daily quest query with optional filters
		var dailyQuestsQuery = context.DailyQuestCompletions.AsNoTracking().AsQueryable();
		var guildQuestsQuery = context.GuildQuestCompletions.AsNoTracking().AsQueryable();
		var loginRewardsQuery = context.LoginRewards.AsNoTracking().AsQueryable();
		var summariesQuery = context.DailyActivitySummaries.AsNoTracking().AsQueryable();

		// Apply date filter if specified
		if (date.HasValue) {
			var targetDate = date.Value.Date;
			dailyQuestsQuery = dailyQuestsQuery.Where(q => q.QuestDate == targetDate);
			guildQuestsQuery = guildQuestsQuery.Where(q => q.QuestDate == targetDate);
			loginRewardsQuery = loginRewardsQuery.Where(r => r.ClaimedAt.Date == targetDate);
			summariesQuery = summariesQuery.Where(s => s.SummaryDate == targetDate);
		}

		// Apply player ID filter if specified
		if (playerId.HasValue) {
			dailyQuestsQuery = dailyQuestsQuery.Where(q => q.PlayerId == playerId.Value);
			guildQuestsQuery = guildQuestsQuery.Where(q => q.PlayerId == playerId.Value);
			loginRewardsQuery = loginRewardsQuery.Where(r => r.PlayerId == playerId.Value);
			summariesQuery = summariesQuery.Where(s => s.PlayerId == playerId.Value);
		}

		return new {
			dailyQuests = await dailyQuestsQuery
				.OrderByDescending(q => q.CompletedAt)
				.Take(limit)
				.ToListAsync(),
			guildQuests = await guildQuestsQuery
				.OrderByDescending(q => q.CompletedAt)
				.Take(limit)
				.ToListAsync(),
			loginRewards = await loginRewardsQuery
				.OrderByDescending(r => r.ClaimedAt)
				.Take(limit)
				.ToListAsync(),
			summaries = await summariesQuery
				.OrderByDescending(s => s.SummaryDate)
				.Take(limit)
				.ToListAsync()
		};
	}

	/// <summary>
	/// Gets inventory usage history filtered by category, item, or date range.
	/// </summary>
	/// <param name="category">Optional item category filter (e.g., "potion", "fragment", "scroll").</param>
	/// <param name="limit">Maximum number of results (default 50).</param>
	/// <returns>Object containing inventory usage and equipment change arrays.</returns>
	/// <remarks>
	/// Provides both item usage events and equipment change logs.
	/// Results ordered by timestamp descending.
	/// </remarks>
	public async Task<object> GetInventoryHistoryAsync(string? category = null, int limit = 50) {
		await using var context = await _contextFactory.CreateDbContextAsync();

		// Build inventory item usage query
		var usageQuery = context.InventoryItemUsages.AsNoTracking().AsQueryable();

		// Apply category filter if specified
		if (!string.IsNullOrWhiteSpace(category)) {
			usageQuery = usageQuery.Where(u => u.Category == category);
		}

		// Query equipment changes separately (always unfiltered by category)
		var equipmentChanges = await context.EquipmentChanges
			.AsNoTracking()
			.OrderByDescending(c => c.Timestamp)
			.Take(limit)
			.ToListAsync();

		return new {
			itemUsages = await usageQuery
				.OrderByDescending(u => u.Timestamp)
				.Take(limit)
				.ToListAsync(),
			equipmentChanges
		};
	}

	// ========================================
	// Phase 9: Older Entity Query Methods
	// ========================================

	/// <summary>
	/// Gets hero snapshots with optional filtering by hero ID and player ID.
	/// Returns snapshots ordered by most recent first.
	/// </summary>
	/// <param name="heroId">Optional hero ID to filter by</param>
	/// <param name="playerId">Optional player ID to filter by</param>
	/// <param name="limit">Maximum number of results (default: 50)</param>
	/// <returns>List of hero snapshots</returns>
	public async Task<object> GetHeroesAsync(long? heroId = null, long? playerId = null, int limit = 50) {
		await using var context = await _contextFactory.CreateDbContextAsync();

		var query = context.Heroes.AsNoTracking().AsQueryable();

		if (heroId.HasValue) {
			query = query.Where(h => h.HeroId == heroId.Value);
		}

		if (playerId.HasValue) {
			query = query.Where(h => h.PlayerId == playerId.Value);
		}

		var heroes = await query
			.OrderByDescending(h => h.Timestamp)
			.Take(limit)
			.ToListAsync();

		return new { heroes, count = heroes.Count };
	}

	/// <summary>
	/// Gets titan snapshots with optional filtering by titan ID and player ID.
	/// Returns snapshots ordered by most recent first.
	/// </summary>
	/// <param name="titanId">Optional titan ID to filter by</param>
	/// <param name="playerId">Optional player ID to filter by</param>
	/// <param name="limit">Maximum number of results (default: 50)</param>
	/// <returns>List of titan snapshots</returns>
	public async Task<object> GetTitansAsync(long? titanId = null, long? playerId = null, int limit = 50) {
		await using var context = await _contextFactory.CreateDbContextAsync();

		var query = context.Titans.AsNoTracking().AsQueryable();

		if (titanId.HasValue) {
			query = query.Where(t => t.TitanId == titanId.Value);
		}

		if (playerId.HasValue) {
			query = query.Where(t => t.PlayerId == playerId.Value);
		}

		var titans = await query
			.OrderByDescending(t => t.Timestamp)
			.Take(limit)
			.ToListAsync();

		return new { titans, count = titans.Count };
	}

	/// <summary>
	/// Gets pet snapshots with optional filtering by pet ID and player ID.
	/// Returns snapshots ordered by most recent first.
	/// </summary>
	/// <param name="petId">Optional pet ID to filter by</param>
	/// <param name="playerId">Optional player ID to filter by</param>
	/// <param name="limit">Maximum number of results (default: 50)</param>
	/// <returns>List of pet snapshots</returns>
	public async Task<object> GetPetsAsync(long? petId = null, long? playerId = null, int limit = 50) {
		await using var context = await _contextFactory.CreateDbContextAsync();

		var query = context.Pets.AsNoTracking().AsQueryable();

		if (petId.HasValue) {
			query = query.Where(p => p.PetId == petId.Value);
		}

		if (playerId.HasValue) {
			query = query.Where(p => p.PlayerId == playerId.Value);
		}

		var pets = await query
			.OrderByDescending(p => p.Timestamp)
			.Take(limit)
			.ToListAsync();

		return new { pets, count = pets.Count };
	}

	/// <summary>
	/// Gets guild war battles with optional filtering by war ID.
	/// Returns battles ordered by most recent first.
	/// </summary>
	/// <param name="warId">Optional war ID to filter by</param>
	/// <param name="limit">Maximum number of results (default: 50)</param>
	/// <returns>List of guild war battles</returns>
	public async Task<object> GetGuildWarBattlesAsync(string? warId = null, int limit = 50) {
		await using var context = await _contextFactory.CreateDbContextAsync();

		var query = context.GuildWarBattles.AsNoTracking().AsQueryable();

		if (!string.IsNullOrEmpty(warId)) {
			query = query.Where(b => b.WarId == warId);
		}

		var battles = await query
			.OrderByDescending(b => b.Timestamp)
			.Take(limit)
			.ToListAsync();

		return new { battles, count = battles.Count };
	}

	/// <summary>
	/// Gets raid boss attacks ordered by most recent first.
	/// </summary>
	/// <param name="limit">Maximum number of results (default: 50)</param>
	/// <returns>List of raid boss attacks</returns>
	public async Task<object> GetRaidBossAttacksAsync(int limit = 50) {
		await using var context = await _contextFactory.CreateDbContextAsync();

		var attacks = await context.RaidBossAttacks
			.AsNoTracking()
			.OrderByDescending(a => a.Timestamp)
			.Take(limit)
			.ToListAsync();

		return new { attacks, count = attacks.Count };
	}

	/// <summary>
	/// Gets chest openings with their drops, ordered by most recent first.
	/// </summary>
	/// <param name="chestType">Optional chest type to filter by</param>
	/// <param name="limit">Maximum number of results (default: 50)</param>
	/// <returns>List of chest openings with associated drops</returns>
	public async Task<object> GetChestOpeningsAsync(string? chestType = null, int limit = 50) {
		await using var context = await _contextFactory.CreateDbContextAsync();

		var query = context.ChestOpenings
			.AsNoTracking()
			.Include(c => c.Drops)
			.AsQueryable();

		if (!string.IsNullOrEmpty(chestType)) {
			query = query.Where(c => c.ChestType == chestType);
		}

		var chests = await query
			.OrderByDescending(c => c.Timestamp)
			.Take(limit)
			.ToListAsync();

		return new { chests, count = chests.Count };
	}

	/// <summary>
	/// Gets guild members with optional filtering by guild ID.
	/// Returns active members ordered by team power descending.
	/// </summary>
	/// <param name="guildId">Optional guild ID to filter by</param>
	/// <param name="includeInactive">Include inactive members (default: false)</param>
	/// <param name="limit">Maximum number of results (default: 100)</param>
	/// <returns>List of guild members</returns>
	public async Task<object> GetGuildMembersAsync(long? guildId = null, bool includeInactive = false, int limit = 100) {
		await using var context = await _contextFactory.CreateDbContextAsync();

		var query = context.GuildMembers.AsNoTracking().AsQueryable();

		if (guildId.HasValue) {
			query = query.Where(m => m.GuildId == guildId.Value);
		}

		if (!includeInactive) {
			query = query.Where(m => m.IsActive);
		}

		var members = await query
			.OrderByDescending(m => m.TeamPower)
			.Take(limit)
			.ToListAsync();

		return new { members, count = members.Count };
	}

	/// <summary>
	/// Gets resource transactions with optional filtering by resource type.
	/// Returns transactions ordered by most recent first.
	/// </summary>
	/// <param name="resourceType">Optional resource type to filter by (e.g., "gold", "emeralds")</param>
	/// <param name="limit">Maximum number of results (default: 100)</param>
	/// <returns>List of resource transactions</returns>
	public async Task<object> GetResourceTransactionsAsync(string? resourceType = null, int limit = 100) {
		await using var context = await _contextFactory.CreateDbContextAsync();

		var query = context.ResourceTransactions.AsNoTracking().AsQueryable();

		if (!string.IsNullOrEmpty(resourceType)) {
			query = query.Where(r => r.ResourceType == resourceType);
		}

		var transactions = await query
			.OrderByDescending(r => r.Timestamp)
			.Take(limit)
			.ToListAsync();

		return new { transactions, count = transactions.Count };
	}

	/// <summary>
	/// Builds recommendation candidates from historical battles.
	/// Uses recency-weighted win rate and sample-volume confidence for ranking.
	/// </summary>
	/// <param name="battleType">Battle type: arena, grandarena, titanarena</param>
	/// <param name="opponentId">Optional opponent ID filter</param>
	/// <param name="opponentPower">Optional opponent power center value</param>
	/// <param name="powerWindow">Power range (+/-) around opponentPower</param>
	/// <param name="minSamples">Minimum battles required per team candidate</param>
	/// <param name="limit">Maximum number of candidates to return</param>
	/// <returns>Ranked recommendation response</returns>
	public async Task<BattleRecommendationResponse> GetBattleRecommendationsAsync(
		string battleType = "arena",
		long? opponentId = null,
		int? opponentPower = null,
		int powerWindow = 100000,
		int minSamples = 2,
		int limit = 5) {
		await using var context = await _contextFactory.CreateDbContextAsync();

		var normalizedType = BattleRecommendationMath.NormalizeBattleType(battleType);
		powerWindow = BattleRecommendationMath.ResolvePowerWindow(powerWindow);
		minSamples = BattleRecommendationMath.ResolveMinSamples(minSamples);
		limit = BattleRecommendationMath.ResolveRecommendationLimit(limit);

		var samples = normalizedType switch {
			"grandarena" => await context.GrandArenaBattles
				.AsNoTracking()
				.Select(b => new BattleRecommendationMath.TeamRecommendationBattleSample(
					BattleRecommendationMath.NormalizeTeamKey(b.AttackTeam),
					b.IsWin,
					b.OpponentId,
					b.OpponentPower,
					b.Timestamp
				))
				.ToListAsync(),
			"titanarena" => await context.TitanArenaBattles
				.AsNoTracking()
				.Select(b => new BattleRecommendationMath.TeamRecommendationBattleSample(
					BattleRecommendationMath.NormalizeTeamKey(b.OurTitanTeam),
					b.IsWin,
					b.OpponentId,
					b.OpponentPower,
					b.Timestamp
				))
				.ToListAsync(),
			_ => await context.ArenaBattles
				.AsNoTracking()
				.Select(b => new BattleRecommendationMath.TeamRecommendationBattleSample(
					BattleRecommendationMath.NormalizeTeamKey(b.OurTeam),
					b.IsWin,
					b.OpponentId,
					b.OpponentPower,
					b.Timestamp
				))
				.ToListAsync(),
		};

		samples = BattleRecommendationMath.ApplyOpponentFilters(samples, opponentId, opponentPower, powerWindow);
		var sampleCount = samples.Count;
		var baselineWinRate = BattleRecommendationMath.ComputeBaselineWinRate(samples);

		var now = DateTime.UtcNow;
		var recommendations = BattleRecommendationMath.BuildCandidates(samples, normalizedType, _battleSimulator, opponentPower, minSamples, limit, now);
		string? note = null;

		if (recommendations.Count == 0) {
			var engineFallback = await GetTeamRecommendationsAsync(
				mode: normalizedType,
				objective: "balanced",
				limit: limit,
				minSamples: Math.Max(1, minSamples),
				preferredTrendWindowDays: null,
				includeHistorical: false
			);

			recommendations = engineFallback.Recommendations
				.Where(card => !string.IsNullOrWhiteSpace(card.TeamPreview))
				.Take(limit)
				.Select(card => {
					var simulated = card.SimulatedWinProbability ?? card.EstimatedWinProbability;
					var confidenceHalfWindow = Math.Max(0.03, (1d - Math.Clamp(card.ConfidenceScore, 0d, 1d)) * 0.10);
					return new BattleRecommendationCandidate {
						TeamKey = BattleRecommendationMath.NormalizeTeamKey(card.TeamPreview),
						TeamPreview = card.TeamPreview,
						Battles = 0,
						Wins = 0,
						Losses = 0,
						WinRate = Math.Round(Math.Clamp(card.EstimatedWinProbability, 0d, 1d), 4),
						WeightedWinRate = Math.Round(Math.Clamp(card.EstimatedWinProbability, 0d, 1d), 4),
						Confidence = Math.Round(Math.Clamp(card.ConfidenceScore, 0d, 1d), 4),
						Score = Math.Round(Math.Clamp(card.FinalScore, 0d, 1d), 4),
						SimulatedWinProbability = Math.Round(Math.Clamp(simulated, 0d, 1d), 4),
						SimulationRuns = card.SimulationRuns ?? 0,
						SimulationConfidenceLow = Math.Round(Math.Clamp(simulated - confidenceHalfWindow, 0d, 1d), 4),
						SimulationConfidenceHigh = Math.Round(Math.Clamp(simulated + confidenceHalfWindow, 0d, 1d), 4),
						AverageOpponentPower = opponentPower ?? card.OpponentPowerUsed ?? 0,
						LastSeen = now,
						Rationale = string.IsNullOrWhiteSpace(card.Rationale)
							? "Engine/external fallback recommendation generated from synced roster and curated counter-signal sources."
							: card.Rationale,
					};
				})
				.ToList();

			if (recommendations.Count > 0) {
				note = "Sparse historical battle samples. Returning engine/external counter-signal fallback recommendations.";
			}
		}

		return new BattleRecommendationResponse {
			BattleType = normalizedType,
			OpponentId = opponentId,
			OpponentPower = opponentPower,
			PowerWindow = powerWindow,
			MinSamples = minSamples,
			Limit = limit,
			SampleCount = sampleCount,
			BaselineWinRate = Math.Round(baselineWinRate, 4),
			Recommendations = recommendations,
			Note = note,
			GeneratedAtUtc = now
		};
	}

	/// <summary>
	/// Returns mode-aware team recommendations using simulator output and current roster readiness.
	/// </summary>
	public async Task<TeamRecommendationEngineResponse> GetTeamRecommendationsAsync(
		string mode = "arena",
		string objective = "balanced",
		int limit = 3,
		int minSamples = 2,
		int? preferredTrendWindowDays = null,
		bool includeHistorical = true
	) {
		var normalizedMode = TeamRecommendationOrchestrationMath.NormalizeMode(mode);
		var normalizedObjective = TeamRecommendationOrchestrationMath.NormalizeObjective(objective);
		var profile = TeamRecommendationProfileCatalog.Resolve(normalizedMode, normalizedObjective);
		var externalSignals = TeamRecommendationOrchestrationMath.GetExternalSignals(_externalSignalProviders, normalizedMode, normalizedObjective);
		var externalModeWeight = CuratedToolCatalogSignalProvider.GetModeExternalSignalWeight(normalizedMode);
		var safeLimit = TeamRecommendationOrchestrationMath.ResolveRecommendationLimit(limit);

		await using var context = await _contextFactory.CreateDbContextAsync();

		var latestSnapshot = await context.PlayerSnapshots
			.AsNoTracking()
			.OrderByDescending(s => s.Timestamp)
			.FirstOrDefaultAsync();

		var rosterPlayerId = latestSnapshot?.PlayerId;
		if (!rosterPlayerId.HasValue) {
			rosterPlayerId = await context.Heroes.AsNoTracking().OrderByDescending(h => h.Timestamp).Select(h => (long?)h.PlayerId).FirstOrDefaultAsync();
		}

		var recentHeroesQuery = context.Heroes
			.AsNoTracking()
			.OrderByDescending(h => h.Timestamp)
			.Take(2000);

		if (rosterPlayerId.HasValue) {
			recentHeroesQuery = recentHeroesQuery.Where(h => h.PlayerId == rosterPlayerId.Value).OrderByDescending(h => h.Timestamp).Take(2000);
		}

		var recentHeroes = await recentHeroesQuery.ToListAsync();
		var latestHeroes = recentHeroes
			.GroupBy(h => h.HeroId)
			.Select(g => g.OrderByDescending(x => x.Timestamp).ThenByDescending(x => x.Power).First())
			.OrderByDescending(h => h.Power)
			.ToList();

		var recentTitansQuery = context.Titans
			.AsNoTracking()
			.OrderByDescending(t => t.Timestamp)
			.Take(1000);

		if (rosterPlayerId.HasValue) {
			recentTitansQuery = recentTitansQuery.Where(t => t.PlayerId == rosterPlayerId.Value).OrderByDescending(t => t.Timestamp).Take(1000);
		}

		var recentTitans = await recentTitansQuery.ToListAsync();
		var latestTitans = recentTitans
			.GroupBy(t => t.TitanId)
			.Select(g => g.OrderByDescending(x => x.Timestamp).ThenByDescending(x => x.Power).First())
			.OrderByDescending(t => t.Power)
			.ToList();

		var recentPetsQuery = context.Pets
			.AsNoTracking()
			.OrderByDescending(p => p.Timestamp)
			.Take(500);

		if (rosterPlayerId.HasValue) {
			recentPetsQuery = recentPetsQuery.Where(p => p.PlayerId == rosterPlayerId.Value).OrderByDescending(p => p.Timestamp).Take(500);
		}

		var recentPets = await recentPetsQuery.ToListAsync();
		var latestPets = recentPets
			.GroupBy(p => p.PetId)
			.Select(g => g.OrderByDescending(x => x.Timestamp).ThenByDescending(x => x.Power).First())
			.OrderByDescending(p => p.Power)
			.ToList();

		var latestInventoryQuery = context.InventorySnapshots
			.AsNoTracking()
			.OrderByDescending(i => i.Timestamp)
			.Take(250);

		if (rosterPlayerId.HasValue) {
			latestInventoryQuery = latestInventoryQuery
				.Where(i => i.PlayerId == rosterPlayerId.Value)
				.OrderByDescending(i => i.Timestamp)
				.Take(250);
		}

		var latestInventory = await latestInventoryQuery.FirstOrDefaultAsync();
		var resourcePressure = TeamRecommendationScoringMath.ComputeResourcePressureScore(latestSnapshot, latestInventory);
		var calibrationScale = await TeamRecommendationOrchestrationMath.ResolveModeFrictionCalibrationScaleAsync(
			_teamRecommendationStateStore,
			context,
			normalizedMode,
			normalizedObjective,
			preferredTrendWindowDays,
			SupportedCalibrationTrendWindowDays
		);

		var heroNameSet = latestHeroes
			.Select(h => h.HeroName)
			.Where(n => !string.IsNullOrWhiteSpace(n))
			.ToHashSet(StringComparer.OrdinalIgnoreCase);

		var cards = new List<TeamRecommendationCard>();

		if (includeHistorical && (normalizedMode is "arena" or "grandarena")) {
			var historical = await GetBattleRecommendationsAsync(
				normalizedMode,
				opponentId: null,
				opponentPower: null,
				powerWindow: 100000,
				minSamples: Math.Max(1, minSamples),
				limit: safeLimit * 2
			);

			foreach (var rec in historical.Recommendations) {
				var readiness = TeamRecommendationScoringMath.ComputeReadinessFromTeamPreview(rec.TeamPreview, heroNameSet);
				var confidence = Math.Clamp((rec.Confidence + rec.SimulationConfidenceHigh - rec.SimulationConfidenceLow) / 2d, 0d, 1d);
				var baseScore = TeamRecommendationScoringMath.ComputeFinalTeamScore(rec.SimulatedWinProbability, readiness, confidence, profile);
				var sourceScale = 0.70;
				var frictionPenalty = TeamRecommendationScoringMath.ComputeRosterFrictionPenalty(resourcePressure, readiness, normalizedMode, normalizedObjective, sourceScale, calibrationScale);
				var frictionAdjustedScore = Math.Clamp(baseScore - frictionPenalty, 0d, 1d);
				var finalScore = TeamRecommendationScoringMath.ApplyExternalSignalBonus(frictionAdjustedScore, externalSignals, externalModeWeight, sourceScale);

				cards.Add(new TeamRecommendationCard {
					Source = "history",
					TeamPreview = rec.TeamPreview,
					ContextTag = normalizedObjective,
					ModeProfile = profile.ProfileName,
					EstimatedWinProbability = Math.Clamp(rec.SimulatedWinProbability, 0d, 1d),
					ReadinessScore = readiness,
					ConfidenceScore = confidence,
					FinalScore = finalScore,
					Rationale = $"Historical {normalizedMode} sample with simulator estimate {(rec.SimulatedWinProbability * 100):F1}% and readiness {(readiness * 100):F0}%; resource friction penalty {(frictionPenalty * 100):F1}%.",
					Provenance = TeamRecommendationScoringMath.BuildProvenance("history", profile, rec.SimulatedWinProbability, readiness, confidence, baseScore, frictionAdjustedScore, finalScore, sourceScale, frictionPenalty, resourcePressure, calibrationScale, externalModeWeight, externalSignals),
				});
			}
		}

		var syntheticCards = TeamRecommendationScoringMath.BuildSyntheticRecommendationCards(
			normalizedMode,
			normalizedObjective,
			profile,
			externalModeWeight,
			externalSignals,
			resourcePressure,
			calibrationScale,
			latestHeroes,
			latestTitans,
			safeLimit * 2
		);
		cards.AddRange(syntheticCards);

		var ranked = cards
			.Where(c => !string.IsNullOrWhiteSpace(c.TeamPreview))
			.OrderByDescending(c => c.FinalScore)
			.ThenByDescending(c => c.EstimatedWinProbability)
			.ThenByDescending(c => c.ReadinessScore)
			.GroupBy(c => c.TeamPreview, StringComparer.OrdinalIgnoreCase)
			.Select(g => g.First())
			.Take(safeLimit)
			.ToList();

		if (ranked.Count == 0) {
			var rosterFallbackCard = BuildRosterFallbackRecommendationCard(latestHeroes, latestTitans, normalizedMode, normalizedObjective, profile.ProfileName);
			if (rosterFallbackCard != null) {
				ranked.Add(rosterFallbackCard);
			}
		}

		return new TeamRecommendationEngineResponse {
			Mode = normalizedMode,
			Objective = normalizedObjective,
			Limit = safeLimit,
			Roster = new TeamRosterSummary {
				HeroCount = latestHeroes.Count,
				TitanCount = latestTitans.Count,
				PetCount = latestPets.Count,
				TeamPower = latestSnapshot?.TeamPower ?? 0,
				Gold = latestSnapshot?.Gold ?? 0,
				Emeralds = latestSnapshot?.Emeralds ?? 0,
			},
			Recommendations = ranked,
			GeneratedAtUtc = DateTime.UtcNow,
		};
	}

	/// <summary>
	/// Builds a minimum viable roster-based recommendation card when history/synthetic scoring returns no rows.
	/// </summary>
	/// <param name="latestHeroes">Latest known hero roster snapshots</param>
	/// <param name="latestTitans">Latest known titan roster snapshots</param>
	/// <param name="mode">Normalized recommendation mode</param>
	/// <param name="objective">Normalized recommendation objective</param>
	/// <param name="profileName">Active scoring profile name</param>
	/// <returns>Fallback recommendation card or null when no roster names exist</returns>
	private static TeamRecommendationCard? BuildRosterFallbackRecommendationCard(
		IReadOnlyList<Hero> latestHeroes,
		IReadOnlyList<Titan> latestTitans,
		string mode,
		string objective,
		string profileName
	) {
		var heroNames = latestHeroes
			.Select(h => h.HeroName)
			.Where(name => !string.IsNullOrWhiteSpace(name))
			.Select(name => name.Trim())
			.Distinct(StringComparer.OrdinalIgnoreCase)
			.Take(5)
			.ToList();

		if (heroNames.Count > 0) {
			return new TeamRecommendationCard {
				Source = "roster-fallback",
				TeamPreview = string.Join(", ", heroNames),
				ContextTag = objective,
				ModeProfile = profileName,
				EstimatedWinProbability = 0.50,
				ReadinessScore = 0.55,
				ConfidenceScore = 0.30,
				FinalScore = 0.50,
				Rationale = $"Fallback roster recommendation for {mode}. More battle history will improve ranking quality.",
				Provenance = [new TeamRecommendationProvenance {
					SourceType = "roster",
					SourceName = "latest-hero-roster",
					Confidence = 0.30,
					Detail = "Generated from the strongest available synced heroes when historical recommendation candidates were unavailable.",
				}],
			};
		}

		var titanNames = latestTitans
			.Select(t => t.TitanName)
			.Where(name => !string.IsNullOrWhiteSpace(name))
			.Select(name => name.Trim())
			.Distinct(StringComparer.OrdinalIgnoreCase)
			.Take(5)
			.ToList();

		if (titanNames.Count > 0) {
			return new TeamRecommendationCard {
				Source = "roster-fallback",
				TeamPreview = string.Join(", ", titanNames),
				ContextTag = objective,
				ModeProfile = profileName,
				EstimatedWinProbability = 0.50,
				ReadinessScore = 0.50,
				ConfidenceScore = 0.25,
				FinalScore = 0.48,
				Rationale = $"Titan roster fallback recommendation for {mode}. Sync additional battles for calibrated win-rate guidance.",
				Provenance = [new TeamRecommendationProvenance {
					SourceType = "roster",
					SourceName = "latest-titan-roster",
					Confidence = 0.25,
					Detail = "Generated from synced titans because hero candidates were unavailable.",
				}],
			};
		}

		var bootstrapPreview = mode == "titanarena"
			? "Araji, Hyperion, Eden, Nova, Sigurd"
			: "Astaroth, Keira, Nebula, Sebastian, Martha";

		return new TeamRecommendationCard {
			Source = "bootstrap-fallback",
			TeamPreview = bootstrapPreview,
			ContextTag = objective,
			ModeProfile = profileName,
			EstimatedWinProbability = 0.50,
			ReadinessScore = 0.35,
			ConfidenceScore = 0.20,
			FinalScore = 0.45,
			Rationale = $"Bootstrap fallback recommendation for {mode}. Sync heroes/titans and battle history to replace this with calibrated recommendations.",
			Provenance = [new TeamRecommendationProvenance {
				SourceType = "fallback",
				SourceName = "bootstrap-template",
				Confidence = 0.20,
				Detail = "Returned because no synced roster or historical recommendation candidates were available yet.",
			}],
		};
	}

	/// <summary>
	/// Returns Arena-first integrated recommendation and simulation payload for userscript consumers.
	/// </summary>
	public async Task<ArenaTeamRecommendationSimulationResponse> GetArenaTeamRecommendationSimulationAsync(
		string objective = "balanced",
		int limit = 3,
		int minSamples = 2,
		long? opponentId = null,
		int? opponentPower = null,
		int powerWindow = 100000,
		int? preferredTrendWindowDays = null
	) {
		var normalizedObjective = TeamRecommendationOrchestrationMath.NormalizeObjective(objective);
		var safeLimit = TeamRecommendationOrchestrationMath.ResolveRecommendationLimit(limit);
		var safeMinSamples = Math.Max(1, minSamples);

		var history = await GetBattleRecommendationsAsync(
			battleType: "arena",
			opponentId: opponentId,
			opponentPower: opponentPower,
			powerWindow: powerWindow,
			minSamples: safeMinSamples,
			limit: safeLimit
		);

		var engine = await GetTeamRecommendationsAsync(
			mode: "arena",
			objective: normalizedObjective,
			limit: safeLimit,
			minSamples: safeMinSamples,
			preferredTrendWindowDays: preferredTrendWindowDays
		);

		await using var context = await _contextFactory.CreateDbContextAsync();

		var latestSnapshot = await context.PlayerSnapshots
			.AsNoTracking()
			.OrderByDescending(s => s.Timestamp)
			.FirstOrDefaultAsync();

		var rosterPlayerId = latestSnapshot?.PlayerId;
		if (!rosterPlayerId.HasValue) {
			rosterPlayerId = await context.Heroes
				.AsNoTracking()
				.OrderByDescending(h => h.Timestamp)
				.Select(h => (long?)h.PlayerId)
				.FirstOrDefaultAsync();
		}

		var heroQuery = context.Heroes
			.AsNoTracking()
			.OrderByDescending(h => h.Timestamp)
			.Take(3000);

		if (rosterPlayerId.HasValue) {
			heroQuery = heroQuery
				.Where(h => h.PlayerId == rosterPlayerId.Value)
				.OrderByDescending(h => h.Timestamp)
				.Take(3000);
		}

		var latestHeroes = await heroQuery.ToListAsync();
		var heroPowerByName = latestHeroes
			.Where(h => !string.IsNullOrWhiteSpace(h.HeroName))
			.GroupBy(h => h.HeroName!, StringComparer.OrdinalIgnoreCase)
			.ToDictionary(
				g => g.Key,
				g => g.OrderByDescending(x => x.Timestamp).ThenByDescending(x => x.Power).First().Power,
				StringComparer.OrdinalIgnoreCase
			);

		var inferredOpponentPower = opponentPower
			?? history.OpponentPower
			?? ResolveAverageOpponentPower(history.Recommendations)
			?? latestSnapshot?.TeamPower
			?? 100000;

		var cards = new List<TeamRecommendationCard>();
		var historyCardsCount = 0;
		var engineCardsCount = 0;

		foreach (var rec in history.Recommendations) {
			var simulation = _battleSimulator.Simulate(new BattleSimulationInput {
				BattleType = "arena",
				HistoricalWinRate = Math.Clamp(rec.WinRate, 0d, 1d),
				WeightedWinRate = Math.Clamp(rec.WeightedWinRate, 0d, 1d),
				SampleCount = Math.Max(1, rec.Battles),
				TeamPower = Math.Max(1, EstimateTeamPowerFromPreview(rec.TeamPreview, heroPowerByName)),
				OpponentPower = Math.Max(1, inferredOpponentPower),
			}, runs: 1400);

			cards.Add(new TeamRecommendationCard {
				Source = "history",
				TeamPreview = rec.TeamPreview,
				ContextTag = normalizedObjective,
				ModeProfile = "arena-history-sim",
				EstimatedWinProbability = Math.Round(Math.Clamp(rec.SimulatedWinProbability, 0d, 1d), 6),
				ReadinessScore = 0.5d,
				ConfidenceScore = Math.Round(Math.Clamp(rec.Confidence, 0d, 1d), 6),
				FinalScore = Math.Round(Math.Clamp(rec.Score, 0d, 1d), 6),
				SimulatedWinProbability = Math.Round(Math.Clamp(simulation.EstimatedWinProbability, 0d, 1d), 6),
				SimulationConfidenceLow = Math.Round(Math.Clamp(simulation.ConfidenceLow, 0d, 1d), 6),
				SimulationConfidenceHigh = Math.Round(Math.Clamp(simulation.ConfidenceHigh, 0d, 1d), 6),
				SimulationRuns = simulation.Runs,
				TeamPowerEstimate = EstimateTeamPowerFromPreview(rec.TeamPreview, heroPowerByName),
				OpponentPowerUsed = inferredOpponentPower,
				Rationale = string.IsNullOrWhiteSpace(rec.Rationale)
					? $"Arena historical recommendation with {rec.Battles} samples, simulation refreshed against target power {inferredOpponentPower:N0}."
					: rec.Rationale,
			});
			historyCardsCount++;
		}

		foreach (var rec in engine.Recommendations) {
			var estimated = Math.Clamp(rec.EstimatedWinProbability, 0d, 1d);
			var simulation = _battleSimulator.Simulate(new BattleSimulationInput {
				BattleType = "arena",
				HistoricalWinRate = estimated,
				WeightedWinRate = estimated,
				SampleCount = Math.Max(1, safeMinSamples),
				TeamPower = Math.Max(1, EstimateTeamPowerFromPreview(rec.TeamPreview, heroPowerByName)),
				OpponentPower = Math.Max(1, inferredOpponentPower),
			}, runs: 1400);

			cards.Add(new TeamRecommendationCard {
				Source = "engine",
				TeamPreview = rec.TeamPreview,
				ContextTag = rec.ContextTag,
				ModeProfile = rec.ModeProfile,
				EstimatedWinProbability = Math.Round(estimated, 6),
				ReadinessScore = Math.Round(Math.Clamp(rec.ReadinessScore, 0d, 1d), 6),
				ConfidenceScore = Math.Round(Math.Clamp(rec.ConfidenceScore, 0d, 1d), 6),
				FinalScore = Math.Round(Math.Clamp(rec.FinalScore, 0d, 1d), 6),
				SimulatedWinProbability = Math.Round(Math.Clamp(simulation.EstimatedWinProbability, 0d, 1d), 6),
				SimulationConfidenceLow = Math.Round(Math.Clamp(simulation.ConfidenceLow, 0d, 1d), 6),
				SimulationConfidenceHigh = Math.Round(Math.Clamp(simulation.ConfidenceHigh, 0d, 1d), 6),
				SimulationRuns = simulation.Runs,
				TeamPowerEstimate = EstimateTeamPowerFromPreview(rec.TeamPreview, heroPowerByName),
				OpponentPowerUsed = inferredOpponentPower,
				Rationale = string.IsNullOrWhiteSpace(rec.Rationale)
					? $"Arena engine recommendation simulated against target power {inferredOpponentPower:N0}."
					: rec.Rationale,
				Provenance = rec.Provenance,
			});
			engineCardsCount++;
		}

		var merged = cards
			.Where(c => !string.IsNullOrWhiteSpace(c.TeamPreview))
			.GroupBy(c => c.TeamPreview, StringComparer.OrdinalIgnoreCase)
			.Select(g => g.OrderByDescending(card => card.FinalScore)
				.ThenByDescending(card => card.SimulatedWinProbability ?? card.EstimatedWinProbability)
				.First())
			.OrderByDescending(card => card.FinalScore)
			.ThenByDescending(card => card.SimulatedWinProbability ?? card.EstimatedWinProbability)
			.Take(safeLimit)
			.ToList();

		return new ArenaTeamRecommendationSimulationResponse {
			Mode = "arena",
			Objective = normalizedObjective,
			OpponentId = opponentId,
			OpponentPower = opponentPower,
			OpponentPowerUsed = inferredOpponentPower,
			PowerWindow = history.PowerWindow,
			MinSamples = history.MinSamples,
			Limit = safeLimit,
			HistorySampleCount = history.SampleCount,
			HistoryRecommendationCount = historyCardsCount,
			EngineRecommendationCount = engineCardsCount,
			Recommendations = merged,
			Note = historyCardsCount == 0 && engineCardsCount > 0
				? "Sparse historical arena data; using engine-backed simulated recommendations."
				: merged.Count == 0
					? "No recommendation candidates available yet. Play more arena battles to train recommendations."
					: null,
			GeneratedAtUtc = DateTime.UtcNow,
		};
	}

	/// <summary>
	/// Returns metadata for Team Recommendation Engine mode/objective profiles.
	/// </summary>
	public async Task<TeamRecommendationProfileMetadataResponse> GetTeamRecommendationProfileMetadataAsync() {
		await using var context = await _contextFactory.CreateDbContextAsync();
		var preferenceState = await _teamRecommendationStateStore.LoadTrendPreferenceStateAsync(context);

		var modes = TeamRecommendationProfileCatalog.BuildModeOptions()
			.Select(option => new TeamRecommendationModeOption {
				Value = option.Value,
				Label = option.Label,
				PreferredTrendWindowDays = TeamRecommendationCalibrationStateMath.ResolveModePreferredTrendWindowDays(option.Value, preferenceState, SupportedCalibrationTrendWindowDays),
				IsUserPreference = TeamRecommendationCalibrationStateMath.HasModeTrendPreference(option.Value, preferenceState),
				SupportedTrendWindowDays = [.. SupportedCalibrationTrendWindowDays],
			})
			.ToList();

		var objectives = TeamRecommendationProfileCatalog.BuildObjectiveOptions()
			.Select(option => new TeamRecommendationObjectiveOption {
				Value = option.Value,
				Label = option.Label,
			})
			.ToList();

		var profiles = TeamRecommendationProfileCatalog.SupportedModes
			.SelectMany(mode => TeamRecommendationProfileCatalog.SupportedObjectives.Select(objective => {
				var resolved = TeamRecommendationProfileCatalog.Resolve(mode, objective);
				return new TeamRecommendationProfileDefinition {
					Mode = mode,
					Objective = objective,
					ProfileName = resolved.ProfileName,
					WinWeight = Math.Round(resolved.WinWeight, 4),
					ReadinessWeight = Math.Round(resolved.ReadinessWeight, 4),
					ConfidenceWeight = Math.Round(resolved.ConfidenceWeight, 4),
				};
			}))
			.ToList();

		var externalWeights = CuratedToolCatalogSignalProvider.ModeExternalSignalWeights
			.Select(pair => new TeamRecommendationExternalSignalModeWeight {
				Mode = pair.Key,
				ExternalSignalWeight = pair.Value,
			})
			.OrderBy(entry => entry.Mode)
			.ToList();

		return new TeamRecommendationProfileMetadataResponse {
			GeneratedAtUtc = DateTime.UtcNow,
			DefaultMode = "arena",
			DefaultObjective = "balanced",
			Modes = modes,
			Objectives = objectives,
			Profiles = profiles,
			ExternalSignalModeWeights = externalWeights,
		};
	}

	/// <summary>
	/// Returns persisted Team Recommendation trend preferences by mode.
	/// </summary>
	public async Task<TeamRecommendationTrendPreferenceResponse> GetTeamRecommendationTrendPreferencesAsync() {
		await using var context = await _contextFactory.CreateDbContextAsync();
		var preferenceState = await _teamRecommendationStateStore.LoadTrendPreferenceStateAsync(context);

		var modes = TeamRecommendationProfileCatalog.SupportedModes
			.Select(mode => new TeamRecommendationModeTrendPreference {
				Mode = mode,
				PreferredTrendWindowDays = TeamRecommendationCalibrationStateMath.ResolveModePreferredTrendWindowDays(mode, preferenceState, SupportedCalibrationTrendWindowDays),
				SupportedTrendWindowDays = [.. SupportedCalibrationTrendWindowDays],
			})
			.OrderBy(entry => entry.Mode)
			.ToList();

		return new TeamRecommendationTrendPreferenceResponse {
			GeneratedAtUtc = DateTime.UtcNow,
			Modes = modes,
		};
	}

	/// <summary>
	/// Saves a preferred Team Recommendation trend window for a mode.
	/// </summary>
	public async Task<TeamRecommendationTrendPreferenceResponse> SetTeamRecommendationTrendPreferenceAsync(string mode, int preferredTrendWindowDays) {
		if (!TeamRecommendationModeNormalization.IsKnownMode(mode)) {
			throw new ArgumentException("Unknown mode. Use a supported mode or alias.", nameof(mode));
		}

		await using var context = await _contextFactory.CreateDbContextAsync();
		var preferenceState = await _teamRecommendationStateStore.LoadTrendPreferenceStateAsync(context);
		TeamRecommendationCalibrationStateMath.SetModeTrendPreference(preferenceState, mode, preferredTrendWindowDays, SupportedCalibrationTrendWindowDays);
		preferenceState.UpdatedAtUtc = DateTime.UtcNow;

		await _teamRecommendationStateStore.SaveTrendPreferenceStateAsync(context, preferenceState);

		return await GetTeamRecommendationTrendPreferencesAsync();
	}

	/// <summary>
	/// Backtests Team Recommendation Engine output against recorded battle outcomes.
	/// Supports Arena and Grand Arena historical calibration.
	/// </summary>
	public async Task<TeamRecommendationBacktestResponse> GetTeamRecommendationBacktestAsync(
		string mode = "arena",
		string objective = "balanced",
		int lookbackDays = 14,
		int limit = 3,
		int minSamples = 2
	) {
		var normalizedMode = TeamRecommendationOrchestrationMath.NormalizeMode(mode);
		var normalizedObjective = TeamRecommendationOrchestrationMath.NormalizeObjective(objective);
		var safeLookbackDays = Math.Clamp(lookbackDays, 1, 120);
		var safeLimit = TeamRecommendationOrchestrationMath.ResolveRecommendationLimit(limit);

		if (normalizedMode is not ("arena" or "grandarena")) {
			return new TeamRecommendationBacktestResponse {
				Mode = normalizedMode,
				Objective = normalizedObjective,
				LookbackDays = safeLookbackDays,
				EvaluatedTeamCount = 0,
				MatchedTeamCount = 0,
				TotalBattleSamples = 0,
				MatchedBattleSamples = 0,
				CalibrationQuality = "unsupported",
				Note = "Backtest currently supports arena and grandarena modes only.",
				GeneratedAtUtc = DateTime.UtcNow,
			};
		}

		var recommendations = await GetTeamRecommendationsAsync(
			normalizedMode,
			normalizedObjective,
			safeLimit,
			Math.Max(1, minSamples)
		);

		await using var context = await _contextFactory.CreateDbContextAsync();
		var cutoffUtc = DateTime.UtcNow.AddDays(-safeLookbackDays);

		var historicalSamples = normalizedMode == "grandarena"
			? await context.GrandArenaBattles
				.AsNoTracking()
				.Where(b => b.Timestamp >= cutoffUtc)
				.Select(b => new { TeamKey = b.AttackTeam, b.IsWin })
				.ToListAsync()
			: await context.ArenaBattles
				.AsNoTracking()
				.Where(b => b.Timestamp >= cutoffUtc)
				.Select(b => new { TeamKey = b.OurTeam, b.IsWin })
				.ToListAsync();

		var grouped = historicalSamples
			.Select(sample => new {
				NormalizedKey = TeamRecommendationScoringMath.NormalizeTeamSignature(sample.TeamKey),
				sample.IsWin,
			})
			.Where(sample => !string.IsNullOrWhiteSpace(sample.NormalizedKey))
			.GroupBy(sample => sample.NormalizedKey!, StringComparer.OrdinalIgnoreCase)
			.ToDictionary(group => group.Key, group => group.Select(item => item.IsWin).ToList(), StringComparer.OrdinalIgnoreCase);

		var cards = new List<TeamRecommendationBacktestCard>();
		foreach (var rec in recommendations.Recommendations) {
			var normalizedPreview = TeamRecommendationScoringMath.NormalizeTeamSignature(rec.TeamPreview);
			grouped.TryGetValue(normalizedPreview, out var matches);
			var matchedSamples = matches?.Count ?? 0;

			double? actualWinRate = null;
			double? absoluteError = null;
			double? brier = null;
			double? drift = null;

			if (matchedSamples > 0 && matches != null) {
				actualWinRate = Math.Clamp(matches.Count(x => x) / (double)matchedSamples, 0d, 1d);
				absoluteError = Math.Abs(actualWinRate.Value - rec.EstimatedWinProbability);
				brier = Math.Pow(rec.EstimatedWinProbability - actualWinRate.Value, 2d);
				drift = actualWinRate.Value - rec.EstimatedWinProbability;
			}

			cards.Add(new TeamRecommendationBacktestCard {
				TeamPreview = rec.TeamPreview,
				PredictedWinProbability = Math.Round(Math.Clamp(rec.EstimatedWinProbability, 0d, 1d), 6),
				ActualWinRate = actualWinRate.HasValue ? Math.Round(actualWinRate.Value, 6) : null,
				MatchedSamples = matchedSamples,
				AbsoluteError = absoluteError.HasValue ? Math.Round(absoluteError.Value, 6) : null,
				BrierScore = brier.HasValue ? Math.Round(brier.Value, 6) : null,
				Drift = drift.HasValue ? Math.Round(drift.Value, 6) : null,
			});
		}

		var matchedCards = cards.Where(c => c.MatchedSamples > 0 && c.ActualWinRate.HasValue).ToList();
		var matchedBattleSamples = matchedCards.Sum(c => c.MatchedSamples);

		var meanPredicted = cards.Count == 0
			? 0d
			: cards.Average(c => c.PredictedWinProbability);

		var meanActual = matchedCards.Count == 0
			? 0d
			: matchedCards.Average(c => c.ActualWinRate ?? 0d);

		var meanAbsoluteError = matchedCards.Count == 0
			? 0d
			: matchedCards.Average(c => c.AbsoluteError ?? 0d);

		var meanBrier = matchedCards.Count == 0
			? 0d
			: matchedCards.Average(c => c.BrierScore ?? 0d);

		var quality = matchedCards.Count == 0
			? "no-data"
			: meanAbsoluteError <= 0.10
				? "good"
				: meanAbsoluteError <= 0.18
					? "fair"
					: "poor";

		var response = new TeamRecommendationBacktestResponse {
			Mode = normalizedMode,
			Objective = normalizedObjective,
			LookbackDays = safeLookbackDays,
			EvaluatedTeamCount = cards.Count,
			MatchedTeamCount = matchedCards.Count,
			TotalBattleSamples = historicalSamples.Count,
			MatchedBattleSamples = matchedBattleSamples,
			MeanPredictedWin = Math.Round(Math.Clamp(meanPredicted, 0d, 1d), 6),
			MeanActualWin = Math.Round(Math.Clamp(meanActual, 0d, 1d), 6),
			MeanAbsoluteError = Math.Round(Math.Clamp(meanAbsoluteError, 0d, 1d), 6),
			MeanBrierScore = Math.Round(Math.Clamp(meanBrier, 0d, 1d), 6),
			CalibrationQuality = quality,
			Note = matchedCards.Count == 0
				? "No matching historical samples for generated recommendation team previews in the selected lookback window."
				: null,
			Teams = cards,
			GeneratedAtUtc = DateTime.UtcNow,
		};

		await TeamRecommendationOrchestrationMath.UpdateCalibrationStateAsync(
			_teamRecommendationStateStore,
			context,
			response,
			SupportedCalibrationTrendWindowDays
		);
		return response;
	}

	/// <summary>
	/// Returns current calibration state and suggested friction scale for a mode.
	/// </summary>
	public async Task<TeamRecommendationCalibrationResponse> GetTeamRecommendationCalibrationAsync(string mode = "arena", int? preferredTrendWindowDays = null) {
		var normalizedMode = TeamRecommendationOrchestrationMath.NormalizeMode(mode);
		await using var context = await _contextFactory.CreateDbContextAsync();
		var state = await _teamRecommendationStateStore.LoadCalibrationStateAsync(context);
		var preferenceState = await _teamRecommendationStateStore.LoadTrendPreferenceStateAsync(context);

		if (!state.Modes.TryGetValue(normalizedMode, out var modeState)) {
			modeState = new TeamRecommendationCalibrationModeState();
		}

		var nowUtc = DateTime.UtcNow;
		var resolvedTrendWindowDays = TeamRecommendationCalibrationStateMath.ResolvePreferredCalibrationTrendWindowDays(modeState, preferenceState, normalizedMode, preferredTrendWindowDays, SupportedCalibrationTrendWindowDays);
		var trendWindows = TeamRecommendationCalibrationStateMath.BuildCalibrationTrendWindows(modeState, SupportedCalibrationTrendWindowDays, nowUtc);

		return new TeamRecommendationCalibrationResponse {
			Mode = normalizedMode,
			PreferredTrendWindowDays = resolvedTrendWindowDays,
			SupportedTrendWindowDays = [.. SupportedCalibrationTrendWindowDays],
			SuggestedFrictionScale = Math.Round(TeamRecommendationCalibrationStateMath.ResolveSuggestedScaleFromModeState(modeState, resolvedTrendWindowDays, modeState.LastObjective, nowUtc), 6),
			MeanAbsoluteError = Math.Round(Math.Clamp(modeState.MeanAbsoluteError, 0d, 1d), 6),
			MeanBrierScore = Math.Round(Math.Clamp(modeState.MeanBrierScore, 0d, 1d), 6),
			PredictionBias = Math.Round(Math.Clamp(modeState.PredictionBias, -1d, 1d), 6),
			Samples = Math.Max(0, modeState.Samples),
			LastObjective = modeState.LastObjective ?? string.Empty,
			LastUpdatedUtc = modeState.LastUpdatedUtc,
			GeneratedAtUtc = nowUtc,
			TrendWindows = trendWindows,
		};
	}

	/// <summary>
	/// Returns a compact per-mode operations summary derived from calibration state.
	/// </summary>
	public async Task<TeamRecommendationOperationsSummaryResponse> GetTeamRecommendationOperationsSummaryAsync(int? preferredTrendWindowDays = null) {
		var generatedAtUtc = DateTime.UtcNow;
		var effectiveTrendWindowDays = preferredTrendWindowDays is 7 or 30 or 90
			? preferredTrendWindowDays.Value
			: 30;

		var modes = new List<TeamRecommendationModeOperationsSummary>();
		foreach (var mode in TeamRecommendationProfileCatalog.SupportedModes) {
			var calibration = await GetTeamRecommendationCalibrationAsync(mode, effectiveTrendWindowDays);
			var isStale = !calibration.LastUpdatedUtc.HasValue
				|| (generatedAtUtc - calibration.LastUpdatedUtc.Value).TotalDays > 7;
			var (healthStatus, healthLabel) = ResolveOperationsHealthState(
				calibration.MeanAbsoluteError,
				calibration.MeanBrierScore,
				isStale
			);

			modes.Add(new TeamRecommendationModeOperationsSummary {
				Mode = calibration.Mode,
				SuggestedFrictionScale = calibration.SuggestedFrictionScale,
				MeanAbsoluteError = calibration.MeanAbsoluteError,
				MeanBrierScore = calibration.MeanBrierScore,
				PredictionBias = calibration.PredictionBias,
				Samples = calibration.Samples,
				IsStale = isStale,
				HealthStatus = healthStatus,
				HealthLabel = healthLabel,
				LastUpdatedUtc = calibration.LastUpdatedUtc,
			});
		}

		return new TeamRecommendationOperationsSummaryResponse {
			PreferredTrendWindowDays = effectiveTrendWindowDays,
			Modes = modes,
			GeneratedAtUtc = generatedAtUtc,
		};
	}

	private static (string Status, string Label) ResolveOperationsHealthState(double mae, double brier, bool isStale) {
		if (isStale) {
			return ("stale", "Stale");
		}

		if (mae > 0.22 || brier > 0.28) {
			return ("monitor", "Needs Attention");
		}

		return ("healthy", "Healthy");
	}

	private static int EstimateTeamPowerFromPreview(string? teamPreview, IReadOnlyDictionary<string, int> heroPowerByName) {
		var names = ParseTeamPreviewNames(teamPreview);
		if (names.Count == 0) {
			return 100000;
		}

		var total = 0;
		foreach (var name in names) {
			if (heroPowerByName.TryGetValue(name, out var power)) {
				total += power;
			}
		}

		if (total <= 0) {
			return Math.Max(100000, names.Count * 18000);
		}

		return total;
	}

	private static List<string> ParseTeamPreviewNames(string? teamPreview) {
		if (string.IsNullOrWhiteSpace(teamPreview)) {
			return [];
		}

		return teamPreview
			.Split([',', '|', ';', '/'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
			.Where(token => !string.IsNullOrWhiteSpace(token))
			.Select(token => token.Trim())
			.Distinct(StringComparer.OrdinalIgnoreCase)
			.ToList();
	}

	private static int? ResolveAverageOpponentPower(IReadOnlyList<BattleRecommendationCandidate> recommendations) {
		var values = recommendations
			.Select(r => r.AverageOpponentPower)
			.Where(v => v > 0)
			.ToList();

		if (values.Count == 0) {
			return null;
		}

		return (int)Math.Round(values.Average());
	}

	/// <summary>
	/// Returns a curated catalog of external Hero Wars tooling references.
	/// This endpoint is metadata-only and intentionally does not embed third-party code.
	/// </summary>
	public ToolCatalogResponse GetExternalToolCatalog(
		double? minConfidence = null,
		bool includeStale = true,
		string? category = null,
		string? verificationStatus = null,
		string? sort = null
	) {
		return _externalToolCatalogProvider.BuildCatalog(minConfidence, includeStale, category, verificationStatus, sort);
	}

	/// <summary>
	/// Returns supported filter/sort metadata for the external tool catalog endpoint.
	/// </summary>
	public ToolCatalogFilterMetadataResponse GetExternalToolCatalogFilterMetadata() {
		return _externalToolCatalogProvider.BuildFilterMetadata();
	}

	/// <summary>
	/// Returns deterministic projected-item display metadata and alias mappings.
	/// </summary>
	public ProjectedItemCatalogResponse GetProjectedItemCatalog() {
		return _projectedItemCatalogProvider.BuildCatalog();
	}

	/// <summary>
	/// Gets statistics about the database contents.
	/// </summary>
	public async Task<DatabaseStats> GetDatabaseStatsAsync() {
		await using var context = await _contextFactory.CreateDbContextAsync();

		var stats = new DatabaseStats {
			// Player and Battle Data
			TotalSnapshots = await context.PlayerSnapshots.CountAsync(),
			TotalArenaBattles = await context.ArenaBattles.CountAsync(),
			TotalGrandArenaBattles = await context.GrandArenaBattles.CountAsync(),
			TotalTitanArenaBattles = await context.TitanArenaBattles.CountAsync(),
			TotalGuildWarBattles = await context.GuildWarBattles.CountAsync(),
			TotalRaidBossAttacks = await context.RaidBossAttacks.CountAsync(),
			TotalChestOpenings = await context.ChestOpenings.CountAsync(),
			TotalChestDrops = await context.ChestDrops.CountAsync(),
			TotalOpponents = await context.Opponents.CountAsync(),
			TotalGoals = await context.Goals.CountAsync(),
			TotalCalendarEvents = await context.CalendarEvents.CountAsync(),

			// Hero, Titan, and Pet Rosters
			TotalHeroes = await context.Heroes.CountAsync(),
			TotalTitans = await context.Titans.CountAsync(),
			TotalPets = await context.Pets.CountAsync(),
			TotalInventorySnapshots = await context.InventorySnapshots.CountAsync(),

			// Activity and Progress Tracking
			TotalQuestCompletions = await context.QuestCompletions.CountAsync(),
			TotalMissionProgress = await context.MissionProgress.CountAsync(),
			TotalShopPurchases = await context.ShopPurchases.CountAsync(),
			TotalTowerProgress = await context.TowerProgress.CountAsync(),
			TotalExpeditionBattles = await context.ExpeditionBattles.CountAsync(),
			TotalResourceTransactions = await context.ResourceTransactions.CountAsync(),
			TotalGuildActivities = await context.GuildActivities.CountAsync(),
			TotalMailMessages = await context.MailMessages.CountAsync(),
			TotalMailRewards = await context.MailRewards.CountAsync(),
			TotalAirshipGifts = await context.AirshipGifts.CountAsync(),

			// Hero Upgrade Tracking
			TotalHeroLevelUpgrades = await context.HeroLevelUpgrades.CountAsync(),
			TotalHeroStarUpgrades = await context.HeroStarUpgrades.CountAsync(),
			TotalHeroColorUpgrades = await context.HeroColorUpgrades.CountAsync(),
			TotalHeroSkillUpgrades = await context.HeroSkillUpgrades.CountAsync(),
			TotalHeroArtifactUpgrades = await context.HeroArtifactUpgrades.CountAsync(),
			TotalHeroGlyphUpgrades = await context.HeroGlyphUpgrades.CountAsync(),
			TotalHeroSkinUpgrades = await context.HeroSkinUpgrades.CountAsync(),

			// Titan Upgrade Tracking
			TotalTitanLevelUpgrades = await context.TitanLevelUpgrades.CountAsync(),
			TotalTitanStarUpgrades = await context.TitanStarUpgrades.CountAsync(),
			TotalTitanSkillUpgrades = await context.TitanSkillUpgrades.CountAsync(),
			TotalTitanArtifactUpgrades = await context.TitanArtifactUpgrades.CountAsync(),
			TotalTitanSkinUpgrades = await context.TitanSkinUpgrades.CountAsync(),

			// Daily Activity Tracking
			TotalDailyQuestCompletions = await context.DailyQuestCompletions.CountAsync(),
			TotalGuildQuestCompletions = await context.GuildQuestCompletions.CountAsync(),
			TotalLoginRewards = await context.LoginRewards.CountAsync(),
			TotalDailyActivitySummaries = await context.DailyActivitySummaries.CountAsync(),

			// Inventory Tracking
			TotalInventoryItemUsages = await context.InventoryItemUsages.CountAsync(),
			TotalEquipmentChanges = await context.EquipmentChanges.CountAsync(),

			LastSync = await GetLastSyncTimestampAsync()
		};

		// Calculate oldest and newest records
		if (stats.TotalSnapshots > 0) {
			stats.OldestSnapshot = await context.PlayerSnapshots
				.OrderBy(s => s.Timestamp)
				.Select(s => s.Timestamp)
				.FirstOrDefaultAsync();

			stats.NewestSnapshot = await context.PlayerSnapshots
				.OrderByDescending(s => s.Timestamp)
				.Select(s => s.Timestamp)
				.FirstOrDefaultAsync();
		}

		return stats;
	}
}

/// <summary>
