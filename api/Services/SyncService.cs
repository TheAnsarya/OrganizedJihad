using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using OrganizedJihad.Api.Models;
using OrganizedJihad.Api.Services.Simulation;
using OrganizedJihad.Api.Services.TeamRecommendation;
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
	private const string TeamRecommendationCalibrationMetadataKey = "team_recommendation_calibration_v1";
	private const string TeamRecommendationTrendPreferencesMetadataKey = "team_recommendation_trend_preferences_v1";
	private static readonly IReadOnlyList<int> SupportedCalibrationTrendWindowDays = [7, 30, 90];
	private static readonly IReadOnlyDictionary<string, string> ProjectedItemCatalogAliases = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
		["xp_potion_large"] = "xp_potion_l",
		["xp_potion_medium"] = "xp_potion_m",
		["xp_potion_small"] = "xp_potion_s",
		["red_fragment"] = "item_red_fragment",
		["orange_fragment"] = "item_orange_fragment",
		["violet_fragment"] = "item_violet_fragment",
		["green_fragment"] = "item_green_fragment",
		["blue_fragment"] = "item_blue_fragment",
		["gold"] = "gold_coin",
		["coin_gold"] = "gold_coin",
	};
	private static readonly IReadOnlyList<ProjectedItemCatalogEntry> ProjectedItemCatalogSeed = [
		new() { ItemId = "xp_potion_l", DisplayName = "Large XP Potion", Category = "consumable", Icon = "🧪" },
		new() { ItemId = "xp_potion_m", DisplayName = "Medium XP Potion", Category = "consumable", Icon = "🧪" },
		new() { ItemId = "xp_potion_s", DisplayName = "Small XP Potion", Category = "consumable", Icon = "🧪" },
		new() { ItemId = "gold_coin", DisplayName = "Gold", Category = "resource", Icon = "🪙" },
		new() { ItemId = "stamina_potion", DisplayName = "Stamina Potion", Category = "consumable", Icon = "🧪" },
		new() { ItemId = "skin_stone", DisplayName = "Skin Stone", Category = "resource", Icon = "📦" },
		new() { ItemId = "rune_stone", DisplayName = "Rune Stone", Category = "resource", Icon = "📦" },
		new() { ItemId = "artifact_essence", DisplayName = "Artifact Essence", Category = "artifact", Icon = "🏺" },
		new() { ItemId = "artifact_scroll", DisplayName = "Artifact Scroll", Category = "artifact", Icon = "🏺" },
		new() { ItemId = "item_artifact_fragment", DisplayName = "Artifact Fragment", Category = "fragment", Icon = "🧩" },
		new() { ItemId = "item_red_fragment", DisplayName = "Red Fragment", Category = "fragment", Icon = "🧩" },
		new() { ItemId = "item_violet_fragment", DisplayName = "Violet Fragment", Category = "fragment", Icon = "🧩" },
		new() { ItemId = "item_orange_fragment", DisplayName = "Orange Fragment", Category = "fragment", Icon = "🧩" },
		new() { ItemId = "item_green_fragment", DisplayName = "Green Fragment", Category = "fragment", Icon = "🧩" },
		new() { ItemId = "item_blue_fragment", DisplayName = "Blue Fragment", Category = "fragment", Icon = "🧩" },
	];

	private readonly IDbContextFactory<GameDatabaseContext> _contextFactory;
	private readonly ILogger<SyncService> _logger;
	private readonly IBattleSimulator _battleSimulator;
	private readonly IReadOnlyList<IExternalRecommendationSignalProvider> _externalSignalProviders;

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

		var normalizedType = (battleType ?? "arena").Trim().ToLowerInvariant();
		if (normalizedType != "arena" && normalizedType != "grandarena" && normalizedType != "titanarena") {
			normalizedType = "arena";
		}

		powerWindow = Math.Clamp(powerWindow, 10000, 500000);
		minSamples = Math.Clamp(minSamples, 1, 100);
		limit = Math.Clamp(limit, 1, 20);

		var samples = normalizedType switch {
			"grandarena" => await context.GrandArenaBattles
				.AsNoTracking()
				.Select(b => new BattleSample(
					NormalizeTeamKey(b.AttackTeam),
					b.IsWin,
					b.OpponentId,
					b.OpponentPower,
					b.Timestamp
				))
				.ToListAsync(),
			"titanarena" => await context.TitanArenaBattles
				.AsNoTracking()
				.Select(b => new BattleSample(
					NormalizeTeamKey(b.OurTitanTeam),
					b.IsWin,
					b.OpponentId,
					b.OpponentPower,
					b.Timestamp
				))
				.ToListAsync(),
			_ => await context.ArenaBattles
				.AsNoTracking()
				.Select(b => new BattleSample(
					NormalizeTeamKey(b.OurTeam),
					b.IsWin,
					b.OpponentId,
					b.OpponentPower,
					b.Timestamp
				))
				.ToListAsync(),
		};

		if (opponentId.HasValue) {
			samples = samples
				.Where(s => s.OpponentId == opponentId.Value)
				.ToList();
		}

		if (opponentPower.HasValue) {
			var minPower = Math.Max(0, opponentPower.Value - powerWindow);
			var maxPower = opponentPower.Value + powerWindow;
			samples = samples
				.Where(s => s.OpponentPower >= minPower && s.OpponentPower <= maxPower)
				.ToList();
		}

		var sampleCount = samples.Count;
		var baselineWinRate = sampleCount == 0
			? 0d
			: (double)samples.Count(s => s.IsWin) / sampleCount;

		var now = DateTime.UtcNow;
		var recommendations = samples
			.Where(s => !string.IsNullOrWhiteSpace(s.TeamKey) && s.TeamKey != "[unknown]")
			.GroupBy(s => s.TeamKey)
			.Select(group => {
				var groupSamples = group.ToList();
				var battles = groupSamples.Count;
				var wins = groupSamples.Count(s => s.IsWin);
				var losses = battles - wins;
				var winRate = battles == 0 ? 0d : (double)wins / battles;

				var weightedSamples = groupSamples.Select(s => {
					var ageDays = Math.Max(0d, (now - s.Timestamp).TotalDays);
					var weight = Math.Exp(-ageDays / 30d);
					return new { sample = s, weight };
				}).ToList();

				var totalWeight = weightedSamples.Sum(x => x.weight);
				var weightedWins = weightedSamples
					.Where(x => x.sample.IsWin)
					.Sum(x => x.weight);
				var weightedWinRate = totalWeight <= 0d ? 0d : weightedWins / totalWeight;

				var confidence = Math.Min(1d, battles / 20d);

				var avgOpponentPower = (int)Math.Round(groupSamples.Average(s => s.OpponentPower));
				var lastSeen = groupSamples.Max(s => s.Timestamp);

				var simulation = _battleSimulator.Simulate(new BattleSimulationInput {
					BattleType = normalizedType,
					HistoricalWinRate = winRate,
					WeightedWinRate = weightedWinRate,
					SampleCount = battles,
					TeamPower = avgOpponentPower,
					OpponentPower = opponentPower ?? avgOpponentPower,
				}, runs: 2000);

				var score = (simulation.EstimatedWinProbability * 0.75d) + (confidence * 0.25d);

				return new BattleRecommendationCandidate {
					TeamKey = group.Key,
					TeamPreview = BuildTeamPreview(group.Key),
					Battles = battles,
					Wins = wins,
					Losses = losses,
					WinRate = Math.Round(winRate, 4),
					WeightedWinRate = Math.Round(weightedWinRate, 4),
					Confidence = Math.Round(confidence, 4),
					Score = Math.Round(score, 4),
					SimulatedWinProbability = Math.Round(simulation.EstimatedWinProbability, 4),
					SimulationRuns = simulation.Runs,
					SimulationConfidenceLow = Math.Round(simulation.ConfidenceLow, 4),
					SimulationConfidenceHigh = Math.Round(simulation.ConfidenceHigh, 4),
					AverageOpponentPower = avgOpponentPower,
					LastSeen = lastSeen,
					Rationale = $"{wins}/{battles} wins, weighted {weightedWinRate:P1}, simulated {simulation.EstimatedWinProbability:P1}, confidence {confidence:P0}"
				};
			})
			.Where(r => r.Battles >= minSamples)
			.OrderByDescending(r => r.Score)
			.ThenByDescending(r => r.Battles)
			.Take(limit)
			.ToList();

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
		int? preferredTrendWindowDays = null
	) {
		var normalizedMode = NormalizeTeamRecommendationMode(mode);
		var normalizedObjective = NormalizeTeamObjective(objective);
		var profile = TeamRecommendationProfileCatalog.Resolve(normalizedMode, normalizedObjective);
		var externalSignals = GetExternalSignals(normalizedMode, normalizedObjective);
		var externalModeWeight = CuratedToolCatalogSignalProvider.GetModeExternalSignalWeight(normalizedMode);
		var safeLimit = Math.Clamp(limit, 1, 10);

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
		var resourcePressure = ComputeResourcePressureScore(latestSnapshot, latestInventory);
		var calibrationScale = await GetModeFrictionCalibrationScaleAsync(context, normalizedMode, preferredTrendWindowDays);

		var heroNameSet = latestHeroes
			.Select(h => h.HeroName)
			.Where(n => !string.IsNullOrWhiteSpace(n))
			.ToHashSet(StringComparer.OrdinalIgnoreCase);

		var cards = new List<TeamRecommendationCard>();

		if (normalizedMode is "arena" or "grandarena") {
			var historical = await GetBattleRecommendationsAsync(
				normalizedMode,
				opponentId: null,
				opponentPower: null,
				powerWindow: 100000,
				minSamples: Math.Max(1, minSamples),
				limit: safeLimit * 2
			);

			foreach (var rec in historical.Recommendations) {
				var readiness = ComputeReadinessFromTeamPreview(rec.TeamPreview, heroNameSet);
				var confidence = Math.Clamp((rec.Confidence + rec.SimulationConfidenceHigh - rec.SimulationConfidenceLow) / 2d, 0d, 1d);
				var baseScore = ComputeFinalTeamScore(rec.SimulatedWinProbability, readiness, confidence, profile);
				var sourceScale = 0.70;
				var frictionPenalty = ComputeRosterFrictionPenalty(resourcePressure, readiness, normalizedMode, normalizedObjective, sourceScale, calibrationScale);
				var frictionAdjustedScore = Math.Clamp(baseScore - frictionPenalty, 0d, 1d);
				var finalScore = ApplyExternalSignalBonus(frictionAdjustedScore, externalSignals, externalModeWeight, sourceScale);

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
					Provenance = BuildProvenance("history", profile, rec.SimulatedWinProbability, readiness, confidence, baseScore, frictionAdjustedScore, finalScore, sourceScale, frictionPenalty, resourcePressure, calibrationScale, externalModeWeight, externalSignals),
				});
			}
		}

		var syntheticCards = BuildSyntheticRecommendationCards(
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
	/// Returns metadata for Team Recommendation Engine mode/objective profiles.
	/// </summary>
	public async Task<TeamRecommendationProfileMetadataResponse> GetTeamRecommendationProfileMetadataAsync() {
		await using var context = await _contextFactory.CreateDbContextAsync();
		var preferenceState = await LoadTeamRecommendationTrendPreferenceStateAsync(context);

		var modes = TeamRecommendationProfileCatalog.BuildModeOptions()
			.Select(option => new TeamRecommendationModeOption {
				Value = option.Value,
				Label = option.Label,
				PreferredTrendWindowDays = TeamRecommendationCalibrationStateMath.ResolveModePreferredTrendWindowDays(option.Value, preferenceState, SupportedCalibrationTrendWindowDays),
				IsUserPreference = preferenceState.ModeTrendWindowDays.ContainsKey(option.Value),
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
		var preferenceState = await LoadTeamRecommendationTrendPreferenceStateAsync(context);

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
		var normalizedMode = NormalizeTeamRecommendationMode(mode);
		if (!TeamRecommendationCalibrationStateMath.IsSupportedCalibrationTrendWindow(preferredTrendWindowDays, SupportedCalibrationTrendWindowDays)) {
			throw new ArgumentOutOfRangeException(nameof(preferredTrendWindowDays), "Supported values: 7, 30, 90.");
		}

		await using var context = await _contextFactory.CreateDbContextAsync();
		var preferenceState = await LoadTeamRecommendationTrendPreferenceStateAsync(context);
		preferenceState.ModeTrendWindowDays[normalizedMode] = preferredTrendWindowDays;
		preferenceState.UpdatedAtUtc = DateTime.UtcNow;

		var serialized = JsonSerializer.Serialize(preferenceState);
		await UpdateSyncMetadataAsync(context, TeamRecommendationTrendPreferencesMetadataKey, serialized);

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
		var normalizedMode = NormalizeTeamRecommendationMode(mode);
		var normalizedObjective = NormalizeTeamObjective(objective);
		var safeLookbackDays = Math.Clamp(lookbackDays, 1, 120);
		var safeLimit = Math.Clamp(limit, 1, 10);

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
				NormalizedKey = NormalizeTeamSignature(sample.TeamKey),
				sample.IsWin,
			})
			.Where(sample => !string.IsNullOrWhiteSpace(sample.NormalizedKey))
			.GroupBy(sample => sample.NormalizedKey!, StringComparer.OrdinalIgnoreCase)
			.ToDictionary(group => group.Key, group => group.Select(item => item.IsWin).ToList(), StringComparer.OrdinalIgnoreCase);

		var cards = new List<TeamRecommendationBacktestCard>();
		foreach (var rec in recommendations.Recommendations) {
			var normalizedPreview = NormalizeTeamSignature(rec.TeamPreview);
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

		await UpdateTeamRecommendationCalibrationStateAsync(context, response);
		return response;
	}

	/// <summary>
	/// Returns current calibration state and suggested friction scale for a mode.
	/// </summary>
	public async Task<TeamRecommendationCalibrationResponse> GetTeamRecommendationCalibrationAsync(string mode = "arena", int? preferredTrendWindowDays = null) {
		var normalizedMode = NormalizeTeamRecommendationMode(mode);
		await using var context = await _contextFactory.CreateDbContextAsync();
		var state = await LoadTeamRecommendationCalibrationStateAsync(context);
		var preferenceState = await LoadTeamRecommendationTrendPreferenceStateAsync(context);

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
			SuggestedFrictionScale = Math.Round(TeamRecommendationCalibrationStateMath.ResolveSuggestedScaleFromModeState(modeState, resolvedTrendWindowDays, nowUtc), 6),
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
		var reviewedAtRecent = new DateTime(2026, 5, 26, 0, 0, 0, DateTimeKind.Utc);
		var reviewedAtStale = new DateTime(2025, 12, 1, 0, 0, 0, DateTimeKind.Utc);

		var tools = new List<ToolCatalogEntry> {
			new ToolCatalogEntry {
				Name = "Hero Wars Simulator (Chrome Extension)",
				Url = "https://chromewebstore.google.com/detail/hero-wars-simulator/oolajlfdlkcekemoilmmhkajgneokggb",
				Category = "simulator",
				Capabilities = "Battle calculation/simulation for arena, guild war, raid, and cross-server contexts.",
				Caveats = "Third-party service; treat as reference only. Do not copy proprietary implementation code.",
				LastReviewedUtc = reviewedAtRecent,
				ConfidenceScore = 0.80,
			},
			new ToolCatalogEntry {
				Name = "HW-Simulator",
				Url = "https://www.hw-simulator.com/",
				Category = "simulator",
				Capabilities = "Simulator-focused site with extension ecosystem and feature plans.",
				Caveats = "Backend-dependent tool; availability and assumptions may change.",
				LastReviewedUtc = reviewedAtRecent,
				ConfidenceScore = 0.76,
			},
			new ToolCatalogEntry {
				Name = "HW Assistant",
				Url = "https://hw-assist.com/",
				Category = "extension",
				Capabilities = "Automation/assistant extension with logs and workflow helpers.",
				Caveats = "Automation tooling may conflict with personal policy/risk tolerance.",
				LastReviewedUtc = reviewedAtRecent,
				ConfidenceScore = 0.70,
			},
			new ToolCatalogEntry {
				Name = "Hero Wars Hub",
				Url = "https://herowarshub.com/",
				Category = "calculator",
				Capabilities = "Tooling and guides including Mysterious Island simulator resources.",
				Caveats = "Community-maintained content; verify against current game patches.",
				LastReviewedUtc = reviewedAtRecent,
				ConfidenceScore = 0.74,
			},
			new ToolCatalogEntry {
				Name = "Hero Wars Calculator Hub",
				Url = "https://www.hwcalculator.com/",
				Category = "calculator",
				Capabilities = "Resource planning calculators for evolution, artifacts, and upgrades.",
				Caveats = "Treat outputs as planning aids; cross-check in-game values before committing resources.",
				LastReviewedUtc = reviewedAtRecent,
				ConfidenceScore = 0.78,
			},
			new ToolCatalogEntry {
				Name = "Hero Wars Central",
				Url = "https://www.herowarscentral.com/",
				Category = "guides",
				Capabilities = "Event guides, team suggestions, and strategy writeups.",
				Caveats = "Content opinions vary; use as directional signal with local telemetry confirmation.",
				LastReviewedUtc = reviewedAtStale,
				ConfidenceScore = 0.72,
			},
		};

		var now = DateTime.UtcNow;
		foreach (var tool in tools) {
			tool.VerificationStatus = ComputeVerificationStatus(tool, now);
		}

		if (minConfidence.HasValue) {
			var threshold = Math.Clamp(minConfidence.Value, 0d, 1d);
			tools = tools.Where(t => t.ConfidenceScore >= threshold).ToList();
		}

		if (!includeStale) {
			tools = tools.Where(t => !string.Equals(t.VerificationStatus, "stale", StringComparison.OrdinalIgnoreCase)).ToList();
		}

		if (!string.IsNullOrWhiteSpace(category)) {
			var categoryFilter = category.Trim();
			tools = tools.Where(t => string.Equals(t.Category, categoryFilter, StringComparison.OrdinalIgnoreCase)).ToList();
		}

		if (!string.IsNullOrWhiteSpace(verificationStatus)) {
			var statusFilter = verificationStatus.Trim();
			tools = tools.Where(t => string.Equals(t.VerificationStatus, statusFilter, StringComparison.OrdinalIgnoreCase)).ToList();
		}

		var normalizedSort = (sort ?? "confidence").Trim().ToLowerInvariant();
		tools = normalizedSort switch {
			"name" => tools.OrderBy(t => t.Name).ToList(),
			"reviewed" => tools.OrderByDescending(t => t.LastReviewedUtc).ToList(),
			_ => tools.OrderByDescending(t => t.ConfidenceScore).ThenBy(t => t.Name).ToList(),
		};

		return new ToolCatalogResponse {
			GeneratedAtUtc = now,
			Tools = tools,
		};
	}

	/// <summary>
	/// Returns supported filter/sort metadata for the external tool catalog endpoint.
	/// </summary>
	public ToolCatalogFilterMetadataResponse GetExternalToolCatalogFilterMetadata() {
		var now = DateTime.UtcNow;
		var catalog = GetExternalToolCatalog(includeStale: true, sort: "name");

		var categories = catalog.Tools
			.Select(t => t.Category)
			.Where(c => !string.IsNullOrWhiteSpace(c))
			.Distinct(StringComparer.OrdinalIgnoreCase)
			.OrderBy(c => c)
			.ToList();

		var statuses = catalog.Tools
			.Select(t => t.VerificationStatus)
			.Where(s => !string.IsNullOrWhiteSpace(s))
			.Distinct(StringComparer.OrdinalIgnoreCase)
			.OrderBy(s => s)
			.ToList();

		return new ToolCatalogFilterMetadataResponse {
			GeneratedAtUtc = now,
			Categories = categories,
			VerificationStatuses = statuses,
			SortOptions = ["confidence", "reviewed", "name"],
			DefaultMinConfidence = 0.65,
			DefaultIncludeStale = false,
			DefaultSort = "confidence",
		};
	}

	/// <summary>
	/// Returns deterministic projected-item display metadata and alias mappings.
	/// </summary>
	public ProjectedItemCatalogResponse GetProjectedItemCatalog() {
		var items = ProjectedItemCatalogSeed
			.Select(entry => new ProjectedItemCatalogEntry {
				ItemId = entry.ItemId,
				DisplayName = entry.DisplayName,
				Category = entry.Category,
				Icon = entry.Icon,
			})
			.OrderBy(entry => entry.ItemId)
			.ToList();

		var aliases = ProjectedItemCatalogAliases
			.OrderBy(pair => pair.Key)
			.ToDictionary(pair => pair.Key, pair => pair.Value, StringComparer.OrdinalIgnoreCase);

		return new ProjectedItemCatalogResponse {
			GeneratedAtUtc = DateTime.UtcNow,
			Items = items,
			Aliases = aliases,
		};
	}

	private static string ComputeVerificationStatus(ToolCatalogEntry entry, DateTime nowUtc) {
		var ageDays = (nowUtc - entry.LastReviewedUtc).TotalDays;
		if (entry.LastReviewedUtc == default || ageDays > 90) {
			return "stale";
		}

		if (entry.ConfidenceScore >= 0.75) {
			return "verified";
		}

		if (entry.ConfidenceScore >= 0.60) {
			return "partial";
		}

		return "unverified";
	}

	private static string NormalizeTeamRecommendationMode(string? mode) {
		var normalized = (mode ?? "arena").Trim().ToLowerInvariant();
		return normalized switch {
			"arena" => "arena",
			"grandarena" or "grand_arena" or "grand-arena" => "grandarena",
			"guildwar" or "guild_war" or "guild-war" or "gw" => "guildwar",
			"cow" or "clashofworlds" or "clash_of_worlds" or "clash-of-worlds" => "cow",
			"campaign" => "campaign",
			"adventure" => "adventure",
			_ => "arena",
		};
	}

	private static string NormalizeTeamObjective(string? objective) {
		var normalized = (objective ?? "balanced").Trim().ToLowerInvariant();
		return normalized switch {
			"offense" => "offense",
			"defense" => "defense",
			"speed" => "speed",
			"sustain" => "sustain",
			_ => "balanced",
		};
	}

	private static double ComputeReadinessFromTeamPreview(string? teamPreview, HashSet<string> availableNames) {
		if (string.IsNullOrWhiteSpace(teamPreview) || availableNames.Count == 0) {
			return 0.5;
		}

		var tokens = teamPreview
			.Split([',', '|', ';', '/'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
			.Where(t => !string.IsNullOrWhiteSpace(t))
			.ToList();

		if (tokens.Count == 0) {
			return 0.5;
		}

		var matches = tokens.Count(t => availableNames.Contains(t));
		return Math.Clamp((double)matches / tokens.Count, 0d, 1d);
	}

	private static double ComputeFinalTeamScore(double winProbability, double readiness, double confidence, TeamRecommendationScoringProfile profile) {
		return Math.Clamp(
			(winProbability * profile.WinWeight) +
			(readiness * profile.ReadinessWeight) +
			(confidence * profile.ConfidenceWeight),
			0d,
			1d
		);
	}

	private static List<TeamRecommendationCard> BuildSyntheticRecommendationCards(
		string mode,
		string objective,
		TeamRecommendationScoringProfile profile,
		double externalModeWeight,
		IReadOnlyList<ExternalRecommendationSignal> externalSignals,
		double resourcePressure,
		double calibrationScale,
		IReadOnlyList<Hero> heroes,
		IReadOnlyList<Titan> titans,
		int limit
	) {
		var cards = new List<TeamRecommendationCard>();
		if (limit <= 0) {
			return cards;
		}

		var normalizedObjective = NormalizeTeamObjective(objective);

		if (mode == "cow") {
			var rankedTitans = titans
				.OrderByDescending(t =>
					(t.Power / 120000d) +
					(ComputeTitanMaturityScore(t) * 0.75d) +
					(normalizedObjective == "offense" ? (t.SkillLevel / 120d) * 0.25d : 0d) +
					(normalizedObjective is "defense" or "sustain" ? (t.Stars / 6d) * 0.20d : 0d))
				.ToList();

			var primaryTitans = rankedTitans.Take(5).ToList();
			if (primaryTitans.Count > 0) {
				var titanReadiness = ComputeTeamReadinessFromTitans(primaryTitans);
				var titanDepth = Math.Clamp((double)rankedTitans.Count / 10d, 0d, 1d);
				var titanConfidence = Math.Clamp(0.42 + (titanDepth * 0.24), 0d, 1d);
				var titanWin = normalizedObjective switch {
					"offense" => 0.66,
					"defense" => 0.59,
					"speed" => 0.63,
					"sustain" => 0.61,
					_ => 0.62,
				};

				cards.Add(CreateSyntheticCard(
					teamPreview: string.Join(", ", primaryTitans.Select(t => t.TitanName).Where(n => !string.IsNullOrWhiteSpace(n))),
					mode: mode,
					objective: normalizedObjective,
					profile: profile,
					externalModeWeight: externalModeWeight,
					externalSignals: externalSignals,
					resourcePressure: resourcePressure,
					calibrationScale: calibrationScale,
					winProbability: titanWin,
					readiness: titanReadiness,
					confidence: titanConfidence,
					sourceScale: 0.88,
					rationale: $"CoW titan lineup ranked for {normalizedObjective} using titan power, maturity, and roster depth.",
					source: "synthetic"
				));
			}

			var reserveTitans = rankedTitans.Skip(3).Take(5).ToList();
			if (reserveTitans.Count == 5) {
				var reserveReadiness = ComputeTeamReadinessFromTitans(reserveTitans);
				cards.Add(CreateSyntheticCard(
					teamPreview: string.Join(", ", reserveTitans.Select(t => t.TitanName).Where(n => !string.IsNullOrWhiteSpace(n))),
					mode: mode,
					objective: normalizedObjective,
					profile: profile,
					externalModeWeight: externalModeWeight,
					externalSignals: externalSignals,
					resourcePressure: resourcePressure,
					calibrationScale: calibrationScale,
					winProbability: 0.56,
					readiness: reserveReadiness,
					confidence: 0.44,
					sourceScale: 0.82,
					rationale: "CoW reserve titan lineup for rotation or counter-slot coverage.",
					source: "synthetic"
				));
			}
		}

		var rankedHeroes = RankHeroesForModeAndObjective(heroes, mode, normalizedObjective).ToList();
		if (rankedHeroes.Count == 0) {
			return cards;
		}

		if (mode == "grandarena") {
			var teamA = rankedHeroes.Take(5).ToList();
			var teamB = rankedHeroes.Skip(5).Take(5).ToList();
			var teamC = rankedHeroes.Skip(10).Take(5).ToList();

			var teams = new[] { teamA, teamB, teamC }
				.Where(t => t.Count > 0)
				.Select(t => string.Join(", ", t.Select(h => h.HeroName).Where(n => !string.IsNullOrWhiteSpace(n))))
				.Where(t => !string.IsNullOrWhiteSpace(t))
				.ToList();

			if (teams.Count > 0) {
				var draftPool = rankedHeroes.Take(15).ToList();
				var readiness = ComputeTeamReadinessFromHeroes(draftPool);
				var depth = Math.Clamp((double)rankedHeroes.Count / 15d, 0d, 1d);
				var confidence = Math.Clamp(0.36 + (depth * 0.28), 0d, 1d);
				var win = normalizedObjective switch {
					"offense" => 0.62,
					"defense" => 0.57,
					"speed" => 0.60,
					"sustain" => 0.58,
					_ => 0.59,
				};

				cards.Add(CreateSyntheticCard(
					teamPreview: string.Join(" | ", teams),
					mode: mode,
					objective: normalizedObjective,
					profile: profile,
					externalModeWeight: externalModeWeight,
					externalSignals: externalSignals,
					resourcePressure: resourcePressure,
					calibrationScale: calibrationScale,
					winProbability: win,
					readiness: readiness,
					confidence: confidence,
					sourceScale: 0.84,
					rationale: $"Grand Arena squads assembled for {normalizedObjective} with roster depth-aware confidence.",
					source: "synthetic"
				));
			}
		}

		var primaryTeam = rankedHeroes.Take(5).ToList();
		if (primaryTeam.Count > 0) {
			var readiness = ComputeTeamReadinessFromHeroes(primaryTeam);
			var primaryWin = (mode, normalizedObjective) switch {
				("campaign", "offense") => 0.72,
				("campaign", "sustain") => 0.68,
				("campaign", _) => 0.70,
				("adventure", "offense") => 0.68,
				("adventure", "sustain") => 0.69,
				("adventure", _) => 0.66,
				("guildwar", "defense") => 0.61,
				("guildwar", "offense") => 0.60,
				("guildwar", _) => 0.57,
				("arena", "offense") => 0.64,
				("arena", "speed") => 0.63,
				("arena", _) => 0.62,
				_ => 0.61,
			};
			var depth = Math.Clamp((double)rankedHeroes.Count / (mode == "grandarena" ? 15d : 10d), 0d, 1d);
			var primaryConfidence = Math.Clamp(0.34 + (depth * 0.30), 0d, 1d);

			cards.Add(CreateSyntheticCard(
				teamPreview: string.Join(", ", primaryTeam.Select(h => h.HeroName).Where(n => !string.IsNullOrWhiteSpace(n))),
				mode: mode,
				objective: normalizedObjective,
				profile: profile,
				externalModeWeight: externalModeWeight,
				externalSignals: externalSignals,
				resourcePressure: resourcePressure,
				calibrationScale: calibrationScale,
				winProbability: primaryWin,
				readiness: readiness,
				confidence: primaryConfidence,
				sourceScale: 0.78,
				rationale: $"{mode} primary lineup tuned for {normalizedObjective} using weighted roster maturity.",
				source: "synthetic"
			));
		}

		var secondaryTeam = rankedHeroes.Skip(mode == "campaign" ? 2 : 4).Take(5).ToList();
		if (secondaryTeam.Count > 0) {
			var secondaryReadiness = ComputeTeamReadinessFromHeroes(secondaryTeam);
			var secondaryWin = (mode, normalizedObjective) switch {
				("guildwar", "defense") => 0.58,
				("campaign", "sustain") => 0.60,
				("adventure", "sustain") => 0.59,
				("arena", "speed") => 0.56,
				_ => 0.55,
			};

			cards.Add(CreateSyntheticCard(
				teamPreview: string.Join(", ", secondaryTeam.Select(h => h.HeroName).Where(n => !string.IsNullOrWhiteSpace(n))),
				mode: mode,
				objective: normalizedObjective,
				profile: profile,
				externalModeWeight: externalModeWeight,
				externalSignals: externalSignals,
				resourcePressure: resourcePressure,
				calibrationScale: calibrationScale,
				winProbability: secondaryWin,
				readiness: secondaryReadiness,
				confidence: 0.40,
				sourceScale: 0.72,
				rationale: $"{mode} alternate lineup to preserve the main core while covering {normalizedObjective} fallback scenarios.",
				source: "synthetic"
			));
		}

		if (mode is "guildwar" or "campaign" or "adventure") {
			var sustainRanked = RankHeroesForModeAndObjective(heroes, mode, "sustain").Take(5).ToList();
			if (sustainRanked.Count == 5) {
				cards.Add(CreateSyntheticCard(
					teamPreview: string.Join(", ", sustainRanked.Select(h => h.HeroName).Where(n => !string.IsNullOrWhiteSpace(n))),
					mode: mode,
					objective: normalizedObjective,
					profile: profile,
					externalModeWeight: externalModeWeight,
					externalSignals: externalSignals,
					resourcePressure: resourcePressure,
					calibrationScale: calibrationScale,
					winProbability: mode == "guildwar" ? 0.56 : 0.63,
					readiness: ComputeTeamReadinessFromHeroes(sustainRanked),
					confidence: 0.47,
					sourceScale: 0.74,
					rationale: $"{mode} sustain-leaning lineup for long-fight stability and attrition resilience.",
					source: "synthetic"
				));
			}
		}

		return cards.Take(limit).ToList();
	}

	private IReadOnlyList<ExternalRecommendationSignal> GetExternalSignals(string mode, string objective) {
		return _externalSignalProviders
			.SelectMany(provider => provider.GetSignals(mode, objective))
			.GroupBy(signal => signal.SourceName, StringComparer.OrdinalIgnoreCase)
			.Select(group => group.OrderByDescending(s => s.Confidence).First())
			.OrderByDescending(signal => signal.Confidence)
			.ToList();
	}

	private static List<TeamRecommendationProvenance> BuildProvenance(
		string sourceType,
		TeamRecommendationScoringProfile profile,
		double winProbability,
		double readiness,
		double confidence,
		double baseScore,
		double frictionAdjustedScore,
		double finalScore,
		double sourceScale,
		double frictionPenalty,
		double resourcePressure,
		double calibrationScale,
		double externalModeWeight,
		IReadOnlyList<ExternalRecommendationSignal> externalSignals
	) {
		var records = new List<TeamRecommendationProvenance> {
			new TeamRecommendationProvenance {
				SourceType = "profile",
				SourceName = profile.ProfileName,
				Confidence = 1d,
				Detail = $"Weights => win {profile.WinWeight:F2}, readiness {profile.ReadinessWeight:F2}, confidence {profile.ConfidenceWeight:F2}.",
				Contribution = new TeamRecommendationContribution {
					WinWeight = Math.Round(profile.WinWeight, 6),
					ReadinessWeight = Math.Round(profile.ReadinessWeight, 6),
					ConfidenceWeight = Math.Round(profile.ConfidenceWeight, 6),
				},
			},
			new TeamRecommendationProvenance {
				SourceType = sourceType,
				SourceName = sourceType switch {
					"history" => "Historical battle outcomes",
					"simulator" => "Monte Carlo simulator",
					_ => "Current roster state",
				},
				Confidence = Math.Clamp(confidence, 0d, 1d),
				Detail = $"Components => win {winProbability:F2}, readiness {readiness:F2}, confidence {confidence:F2}; score {baseScore:F3} -> {frictionAdjustedScore:F3} -> {finalScore:F3} (friction {frictionPenalty:F3}, pressure {resourcePressure:F2}).",
				Contribution = new TeamRecommendationContribution {
					WinProbability = Math.Round(Math.Clamp(winProbability, 0d, 1d), 6),
					Readiness = Math.Round(Math.Clamp(readiness, 0d, 1d), 6),
					Confidence = Math.Round(Math.Clamp(confidence, 0d, 1d), 6),
					WinWeight = Math.Round(profile.WinWeight, 6),
					ReadinessWeight = Math.Round(profile.ReadinessWeight, 6),
					ConfidenceWeight = Math.Round(profile.ConfidenceWeight, 6),
					BaseScore = Math.Round(Math.Clamp(baseScore, 0d, 1d), 6),
					FrictionPenalty = Math.Round(Math.Clamp(frictionPenalty, 0d, 1d), 6),
					ResourcePressure = Math.Round(Math.Clamp(resourcePressure, 0d, 1d), 6),
					CalibrationScale = Math.Round(Math.Clamp(calibrationScale, 0.65d, 1.45d), 6),
					FinalScore = Math.Round(Math.Clamp(finalScore, 0d, 1d), 6),
					ExternalBonus = Math.Round(Math.Max(0d, finalScore - frictionAdjustedScore), 6),
					SourceScale = Math.Round(Math.Clamp(sourceScale, 0d, 1d), 6),
					ExternalModeWeight = Math.Round(Math.Clamp(externalModeWeight, 0d, 1d), 6),
				},
			}
		};

		var topSignals = externalSignals.Take(3).ToList();
		var normalizedSourceScale = Math.Clamp(sourceScale, 0d, 1d);
		var normalizedModeWeight = Math.Clamp(externalModeWeight, 0d, 1d);
		var normalizedResourcePressure = Math.Clamp(resourcePressure, 0d, 1d);
		var normalizedFrictionPenalty = Math.Clamp(frictionPenalty, 0d, 1d);
		var normalizedCalibrationScale = Math.Clamp(calibrationScale, 0.65d, 1.45d);
		var perSignalBonusDenominator = topSignals.Count == 0
			? 1d
			: topSignals.Sum(signal => Math.Clamp(signal.Confidence, 0d, 1d));

		records.AddRange(topSignals.Select(signal => {
			var normalizedSignalConfidence = Math.Clamp(signal.Confidence, 0d, 1d);
			var signalRatio = perSignalBonusDenominator <= 0d
				? 0d
				: normalizedSignalConfidence / perSignalBonusDenominator;
			var signalBonus = Math.Max(0d, finalScore - frictionAdjustedScore) * signalRatio;

			return new TeamRecommendationProvenance {
				SourceType = signal.SourceType,
				SourceName = signal.SourceName,
				SourceUrl = signal.SourceUrl,
				Confidence = normalizedSignalConfidence,
				Detail = $"{signal.Detail} Mode external weight {externalModeWeight:F2}.",
				Contribution = new TeamRecommendationContribution {
					SourceConfidence = Math.Round(normalizedSignalConfidence, 6),
					ExternalModeWeight = Math.Round(normalizedModeWeight, 6),
					SourceScale = Math.Round(normalizedSourceScale, 6),
					FrictionPenalty = Math.Round(normalizedFrictionPenalty, 6),
					ResourcePressure = Math.Round(normalizedResourcePressure, 6),
					CalibrationScale = Math.Round(normalizedCalibrationScale, 6),
					ExternalBonus = Math.Round(signalBonus, 6),
					BaseScore = Math.Round(Math.Clamp(baseScore, 0d, 1d), 6),
					FinalScore = Math.Round(Math.Clamp(finalScore, 0d, 1d), 6),
				},
			};
		}));

		return records;
	}

	private static double ApplyExternalSignalBonus(
		double baseScore,
		IReadOnlyList<ExternalRecommendationSignal> externalSignals,
		double modeWeight,
		double sourceScale
	) {
		if (externalSignals.Count == 0 || modeWeight <= 0d) {
			return Math.Clamp(baseScore, 0d, 1d);
		}

		var aggregate = externalSignals
			.Take(3)
			.Average(signal => Math.Clamp(signal.Confidence, 0d, 1d));

		var bonus = aggregate * Math.Clamp(modeWeight, 0d, 1d) * Math.Clamp(sourceScale, 0d, 1d);
		return Math.Clamp(baseScore + bonus, 0d, 1d);
	}

	private static TeamRecommendationCard CreateSyntheticCard(
		string teamPreview,
		string mode,
		string objective,
		TeamRecommendationScoringProfile profile,
		double externalModeWeight,
		IReadOnlyList<ExternalRecommendationSignal> externalSignals,
		double resourcePressure,
		double calibrationScale,
		double winProbability,
		double readiness,
		double confidence,
		double sourceScale,
		string rationale,
		string source
	) {
		var normalizedWin = Math.Clamp(winProbability, 0d, 1d);
		var normalizedReadiness = Math.Clamp(readiness, 0d, 1d);
		var normalizedConfidence = Math.Clamp(confidence, 0d, 1d);
		var baseScore = ComputeFinalTeamScore(normalizedWin, normalizedReadiness, normalizedConfidence, profile);
		var frictionPenalty = ComputeRosterFrictionPenalty(resourcePressure, normalizedReadiness, mode, objective, sourceScale, calibrationScale);
		var frictionAdjustedScore = Math.Clamp(baseScore - frictionPenalty, 0d, 1d);
		var finalScore = ApplyExternalSignalBonus(frictionAdjustedScore, externalSignals, externalModeWeight, sourceScale);

		return new TeamRecommendationCard {
			Source = source,
			TeamPreview = teamPreview,
			ContextTag = objective,
			ModeProfile = profile.ProfileName,
			EstimatedWinProbability = normalizedWin,
			ReadinessScore = normalizedReadiness,
			ConfidenceScore = normalizedConfidence,
			FinalScore = finalScore,
			Rationale = $"{rationale} Resource friction penalty {(frictionPenalty * 100):F1}%.",
			Provenance = BuildProvenance("roster", profile, normalizedWin, normalizedReadiness, normalizedConfidence, baseScore, frictionAdjustedScore, finalScore, sourceScale, frictionPenalty, resourcePressure, calibrationScale, externalModeWeight, externalSignals),
		};
	}

	private static double ComputeRosterFrictionPenalty(
		double resourcePressure,
		double readiness,
		string mode,
		string objective,
		double sourceScale,
		double calibrationScale
	) {
		var normalizedPressure = Math.Clamp(resourcePressure, 0d, 1d);
		var normalizedReadiness = Math.Clamp(readiness, 0d, 1d);
		var normalizedScale = Math.Clamp(sourceScale, 0d, 1d);

		var modeMultiplier = NormalizeTeamRecommendationMode(mode) switch {
			"campaign" => 0.78,
			"adventure" => 0.82,
			"guildwar" => 0.95,
			"cow" => 0.92,
			"grandarena" => 1.00,
			_ => 0.90,
		};

		var objectiveMultiplier = NormalizeTeamObjective(objective) switch {
			"offense" => 1.08,
			"speed" => 1.04,
			"defense" => 0.96,
			"sustain" => 0.93,
			_ => 1.00,
		};

		var readinessRelief = 1d - (normalizedReadiness * 0.72d);
		var normalizedCalibrationScale = Math.Clamp(calibrationScale, 0.65d, 1.45d);
		var penalty = normalizedPressure * readinessRelief * modeMultiplier * objectiveMultiplier * normalizedCalibrationScale * (0.06d + (normalizedScale * 0.14d));
		return Math.Clamp(penalty, 0d, 0.30d);
	}

	private async Task<double> GetModeFrictionCalibrationScaleAsync(GameDatabaseContext context, string mode, int? preferredTrendWindowDays = null) {
		var state = await LoadTeamRecommendationCalibrationStateAsync(context);
		var preferenceState = await LoadTeamRecommendationTrendPreferenceStateAsync(context);
		if (state.Modes.TryGetValue(mode, out var modeState) && modeState.Samples > 0) {
			var resolvedTrendWindowDays = TeamRecommendationCalibrationStateMath.ResolvePreferredCalibrationTrendWindowDays(modeState, preferenceState, mode, preferredTrendWindowDays, SupportedCalibrationTrendWindowDays);
			return TeamRecommendationCalibrationStateMath.ResolveSuggestedScaleFromModeState(modeState, resolvedTrendWindowDays, DateTime.UtcNow);
		}

		return 1d;
	}

	private async Task<TeamRecommendationTrendPreferenceState> LoadTeamRecommendationTrendPreferenceStateAsync(GameDatabaseContext context) {
		var metadata = await context.SyncMetadata
			.AsNoTracking()
			.FirstOrDefaultAsync(m => m.Key == TeamRecommendationTrendPreferencesMetadataKey);

		if (metadata == null || string.IsNullOrWhiteSpace(metadata.Value)) {
			return new TeamRecommendationTrendPreferenceState();
		}

		try {
			var parsed = JsonSerializer.Deserialize<TeamRecommendationTrendPreferenceState>(metadata.Value);
			if (parsed?.ModeTrendWindowDays == null) {
				return new TeamRecommendationTrendPreferenceState();
			}

			return parsed;
		} catch {
			return new TeamRecommendationTrendPreferenceState();
		}
	}

	private async Task<TeamRecommendationCalibrationState> LoadTeamRecommendationCalibrationStateAsync(GameDatabaseContext context) {
		var metadata = await context.SyncMetadata
			.AsNoTracking()
			.FirstOrDefaultAsync(m => m.Key == TeamRecommendationCalibrationMetadataKey);

		if (metadata == null || string.IsNullOrWhiteSpace(metadata.Value)) {
			return new TeamRecommendationCalibrationState();
		}

		try {
			var parsed = JsonSerializer.Deserialize<TeamRecommendationCalibrationState>(metadata.Value);
			if (parsed?.Modes == null) {
				return new TeamRecommendationCalibrationState();
			}

			return parsed;
		} catch {
			return new TeamRecommendationCalibrationState();
		}
	}

	private async Task UpdateTeamRecommendationCalibrationStateAsync(GameDatabaseContext context, TeamRecommendationBacktestResponse backtest) {
		if (backtest.MatchedTeamCount <= 0) {
			return;
		}

		var state = await LoadTeamRecommendationCalibrationStateAsync(context);
		var preferenceState = await LoadTeamRecommendationTrendPreferenceStateAsync(context);
		if (!state.Modes.TryGetValue(backtest.Mode, out var modeState)) {
			modeState = new TeamRecommendationCalibrationModeState();
			state.Modes[backtest.Mode] = modeState;
		}

		TeamRecommendationCalibrationStateMath.ApplyBacktestObservation(
			modeState,
			preferenceState,
			backtest,
			DateTime.UtcNow,
			SupportedCalibrationTrendWindowDays
		);

		state.UpdatedAtUtc = DateTime.UtcNow;
		var serialized = JsonSerializer.Serialize(state);
		await UpdateSyncMetadataAsync(context, TeamRecommendationCalibrationMetadataKey, serialized);
	}

	private static double ComputeResourcePressureScore(PlayerSnapshot? snapshot, InventorySnapshot? inventory) {
		var goldPressure = 1d - Math.Clamp((snapshot?.Gold ?? 0L) / 2_500_000d, 0d, 1d);
		var emeraldPressure = 1d - Math.Clamp((snapshot?.Emeralds ?? 0) / 3_500d, 0d, 1d);
		var consumablePressure = 1d - Math.Clamp((inventory?.TotalConsumables ?? 0) / 900d, 0d, 1d);
		var evolutionPressure = 1d - Math.Clamp((inventory?.TotalEvolutionItems ?? 0) / 750d, 0d, 1d);
		var heroSoulPressure = 1d - Math.Clamp((inventory?.TotalHeroSoulStones ?? 0) / 1500d, 0d, 1d);
		var titanSoulPressure = 1d - Math.Clamp((inventory?.TotalTitanSoulStones ?? 0) / 800d, 0d, 1d);

		var weighted =
			(goldPressure * 0.22d) +
			(emeraldPressure * 0.24d) +
			(consumablePressure * 0.14d) +
			(evolutionPressure * 0.14d) +
			(heroSoulPressure * 0.14d) +
			(titanSoulPressure * 0.12d);

		return Math.Clamp(weighted, 0d, 1d);
	}

	private static IReadOnlyList<Hero> RankHeroesForModeAndObjective(
		IReadOnlyList<Hero> heroes,
		string mode,
		string objective
	) {
		var normalizedMode = NormalizeTeamRecommendationMode(mode);
		var normalizedObjective = NormalizeTeamObjective(objective);

		return heroes
			.Where(h => !string.IsNullOrWhiteSpace(h.HeroName))
			.OrderByDescending(hero => {
				var maturity = ComputeHeroMaturityScore(hero);
				var basePower = Math.Clamp(hero.Power / 140000d, 0d, 1.2d);
				var objectiveBias = normalizedObjective switch {
					"offense" => ((hero.Power / 140000d) * 0.45d) + ((hero.SkillLevel1 + hero.SkillLevel2 + hero.SkillLevel3 + hero.SkillLevel4) / 600d) * 0.20d,
					"defense" => ((hero.Color / 20d) * 0.35d) + ((hero.Stars / 6d) * 0.20d),
					"speed" => ((hero.Level / 130d) * 0.35d) + ((hero.SkillLevel1 / 150d) * 0.20d),
					"sustain" => ((hero.Stars / 6d) * 0.35d) + ((hero.ArtifactBook + hero.ArtifactRing) / 12d) * 0.22d,
					_ => (hero.Power / 140000d) * 0.30d,
				};

				var modeBias = normalizedMode switch {
					"campaign" => ((hero.Level / 130d) * 0.14d) + ((hero.Stars / 6d) * 0.06d),
					"adventure" => ((hero.Color / 20d) * 0.10d) + ((hero.Stars / 6d) * 0.08d),
					"guildwar" => ((hero.Power / 140000d) * 0.08d) + ((hero.Color / 20d) * 0.08d),
					"grandarena" => ((hero.Power / 140000d) * 0.06d) + ((hero.Stars / 6d) * 0.08d),
					_ => 0d,
				};

				return basePower + (maturity * 0.60d) + objectiveBias + modeBias;
			})
			.ThenByDescending(h => h.Power)
			.ThenByDescending(h => h.Color)
			.ThenByDescending(h => h.Stars)
			.ToList();
	}

	private static double ComputeHeroMaturityScore(Hero hero) {
		if (hero is null) {
			return 0d;
		}

		var levelScore = Math.Clamp(hero.Level / 130d, 0d, 1d);
		var starScore = Math.Clamp(hero.Stars / 6d, 0d, 1d);
		var colorScore = Math.Clamp(hero.Color / 20d, 0d, 1d);
		var artifactScore = Math.Clamp((hero.ArtifactWeapon + hero.ArtifactBook + hero.ArtifactRing) / 18d, 0d, 1d);
		return Math.Clamp((levelScore * 0.30d) + (starScore * 0.25d) + (colorScore * 0.25d) + (artifactScore * 0.20d), 0d, 1d);
	}

	private static double ComputeTitanMaturityScore(Titan titan) {
		if (titan is null) {
			return 0d;
		}

		var levelScore = Math.Clamp(titan.Level / 120d, 0d, 1d);
		var starScore = Math.Clamp(titan.Stars / 6d, 0d, 1d);
		var summonScore = Math.Clamp(titan.SummonStars / 6d, 0d, 1d);
		var skinScore = Math.Clamp(titan.SkinLevel / 60d, 0d, 1d);
		return Math.Clamp((levelScore * 0.30d) + (starScore * 0.28d) + (summonScore * 0.22d) + (skinScore * 0.20d), 0d, 1d);
	}

	private static double ComputeTeamReadinessFromHeroes(IReadOnlyList<Hero> team) {
		if (team.Count == 0) {
			return 0d;
		}

		return Math.Clamp(team.Average(ComputeHeroMaturityScore), 0d, 1d);
	}

	private static double ComputeTeamReadinessFromTitans(IReadOnlyList<Titan> team) {
		if (team.Count == 0) {
			return 0d;
		}

		return Math.Clamp(team.Average(ComputeTitanMaturityScore), 0d, 1d);
	}

	private static string NormalizeTeamKey(string? teamKey) {
		if (string.IsNullOrWhiteSpace(teamKey)) {
			return "[unknown]";
		}

		var trimmed = teamKey.Trim();
		return trimmed.Length <= 1024
			? trimmed
			: trimmed[..1024];
	}

	private static string NormalizeTeamSignature(string? teamPreview) {
		if (string.IsNullOrWhiteSpace(teamPreview)) {
			return string.Empty;
		}

		var canonical = teamPreview
			.Trim()
			.Replace(" | ", ",", StringComparison.Ordinal)
			.Replace("|", ",", StringComparison.Ordinal)
			.Replace(";", ",", StringComparison.Ordinal)
			.Replace("/", ",", StringComparison.Ordinal)
			.Replace(" ", string.Empty, StringComparison.Ordinal)
			.ToLowerInvariant();

		while (canonical.Contains(",,")) {
			canonical = canonical.Replace(",,", ",", StringComparison.Ordinal);
		}

		return canonical.Trim(',');
	}

	private static string BuildTeamPreview(string teamKey) {
		if (string.IsNullOrWhiteSpace(teamKey)) {
			return "Unknown team";
		}

		var compact = teamKey.Replace("\r", string.Empty).Replace("\n", string.Empty);
		return compact.Length <= 180
			? compact
			: $"{compact[..177]}...";
	}

	private sealed record BattleSample(
		string TeamKey,
		bool IsWin,
		long OpponentId,
		int OpponentPower,
		DateTime Timestamp
	);

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
