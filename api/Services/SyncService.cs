using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using OrganizedJihad.Api.Models;
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
	private readonly IDbContextFactory<GameDatabaseContext> _contextFactory;
	private readonly ILogger<SyncService> _logger;

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

				// Import chest openings
				if (data.ChestOpenings != null) {
					counts.ChestOpenings = await ImportChestOpeningsAsync(context, data.ChestOpenings);
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

	private async Task<int> ImportChestOpeningsAsync(GameDatabaseContext context, List<ChestOpening> openings) {
		int imported = 0;
		foreach (var opening in openings) {
			var exists = await context.ChestOpenings
				.AnyAsync(c => c.Timestamp == opening.Timestamp && c.ChestType == opening.ChestType);

			if (!exists) {
				context.ChestOpenings.Add(opening);
				imported++;
			}
		}

		await context.SaveChangesAsync();
		return imported;
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
