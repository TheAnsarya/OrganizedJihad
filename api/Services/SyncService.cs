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
/// Service for synchronizing data from the browser userscript to the local database.
/// Handles importing battle records, snapshots, chest openings, and other tracked data.
/// </summary>
public class SyncService {
	private readonly IDbContextFactory<GameDatabaseContext> _contextFactory;
	private readonly ILogger<SyncService> _logger;

	public SyncService(
		IDbContextFactory<GameDatabaseContext> contextFactory,
		ILogger<SyncService> logger) {
		_contextFactory = contextFactory;
		_logger = logger;
	}

	/// <summary>
	/// Imports a batch of data from the browser.
	/// </summary>
	public async Task<ImportCounts> ImportBrowserDataAsync(BrowserSyncData data) {
		_logger.LogInformation("Starting browser data import");
		var counts = new ImportCounts();

		try {
			await using var context = await _contextFactory.CreateDbContextAsync();
			await using var transaction = await context.Database.BeginTransactionAsync();

			try {
				// Import current snapshot
				if (data.CurrentSnapshot != null) {
					context.PlayerSnapshots.Add(data.CurrentSnapshot);
					counts.PlayerSnapshots = 1;
				}

				// Import arena battles
				if (data.ArenaBattles != null) {
					counts.ArenaBattles = await ImportArenaBattlesAsync(context, data.ArenaBattles);
				}

				// Import grand arena battles
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
