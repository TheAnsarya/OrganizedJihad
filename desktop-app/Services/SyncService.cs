using System;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using OrganizedJihad.Data;
using OrganizedJihad.Data.Models;

namespace OrganizedJihad.Desktop.Services;

/// <summary>
/// Service for synchronizing data from the browser userscript to the local database.
/// Handles importing battle records, snapshots, chest openings, and other tracked data.
/// </summary>
public class SyncService
{
	private readonly IDbContextFactory<GameDatabaseContext> _contextFactory;
	private readonly ILogger<SyncService> _logger;

	public SyncService(
		IDbContextFactory<GameDatabaseContext> contextFactory,
		ILogger<SyncService> logger)
	{
		_contextFactory = contextFactory;
		_logger = logger;
	}

	/// <summary>
	/// Imports a batch of data from the browser.
	/// Expected format: JSON with arrays for each data type.
	/// </summary>
	public async Task<ImportResult> ImportBrowserDataAsync(string jsonData)
	{
		_logger.LogInformation("Starting browser data import");
		var result = new ImportResult();

		try
		{
			var data = JsonSerializer.Deserialize<BrowserSyncData>(jsonData, new JsonSerializerOptions
			{
				PropertyNameCaseInsensitive = true
			});

			if (data == null)
			{
				result.Success = false;
				result.ErrorMessage = "Failed to deserialize JSON data";
				return result;
			}

			await using var context = await _contextFactory.CreateDbContextAsync();
			await using var transaction = await context.Database.BeginTransactionAsync();

			try
			{
				// Import player snapshots
				if (data.PlayerSnapshots != null)
				{
					result.SnapshotsImported = await ImportPlayerSnapshotsAsync(context, data.PlayerSnapshots);
				}

				// Import arena battles
				if (data.ArenaBattles != null)
				{
					result.ArenaBattlesImported = await ImportArenaBattlesAsync(context, data.ArenaBattles);
				}

				// Import grand arena battles
				if (data.GrandArenaBattles != null)
				{
					result.GrandArenaBattlesImported = await ImportGrandArenaBattlesAsync(context, data.GrandArenaBattles);
				}

				// Import titan arena battles
				if (data.TitanArenaBattles != null)
				{
					result.TitanArenaBattlesImported = await ImportTitanArenaBattlesAsync(context, data.TitanArenaBattles);
				}

				// Import guild war battles
				if (data.GuildWarBattles != null)
				{
					result.GuildWarBattlesImported = await ImportGuildWarBattlesAsync(context, data.GuildWarBattles);
				}

				// Import raid boss attacks
				if (data.RaidBossAttacks != null)
				{
					result.RaidBossAttacksImported = await ImportRaidBossAttacksAsync(context, data.RaidBossAttacks);
				}

				// Import chest openings
				if (data.ChestOpenings != null)
				{
					result.ChestOpeningsImported = await ImportChestOpeningsAsync(context, data.ChestOpenings);
				}

				// Import/update opponents
				if (data.Opponents != null)
				{
					result.OpponentsImported = await ImportOpponentsAsync(context, data.Opponents);
				}

				// Update sync metadata
				await UpdateSyncMetadataAsync(context, "last_sync_timestamp", DateTime.UtcNow.ToString("O"));

				await transaction.CommitAsync();
				result.Success = true;

				_logger.LogInformation(
					"Import completed successfully. Snapshots: {Snapshots}, Arena: {Arena}, Grand: {Grand}, Titan: {Titan}, " +
					"GuildWar: {GuildWar}, Raid: {Raid}, Chests: {Chests}, Opponents: {Opponents}",
					result.SnapshotsImported, result.ArenaBattlesImported, result.GrandArenaBattlesImported,
					result.TitanArenaBattlesImported, result.GuildWarBattlesImported, result.RaidBossAttacksImported,
					result.ChestOpeningsImported, result.OpponentsImported);
			}
			catch (Exception ex)
			{
				await transaction.RollbackAsync();
				_logger.LogError(ex, "Error during import transaction");
				result.Success = false;
				result.ErrorMessage = ex.Message;
			}
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error importing browser data");
			result.Success = false;
			result.ErrorMessage = ex.Message;
		}

		return result;
	}

	private async Task<int> ImportPlayerSnapshotsAsync(GameDatabaseContext context, PlayerSnapshot[] snapshots)
	{
		int imported = 0;
		foreach (var snapshot in snapshots)
		{
			// Check if snapshot already exists (by PlayerId + Timestamp)
			var exists = await context.PlayerSnapshots
				.AnyAsync(s => s.PlayerId == snapshot.PlayerId && s.Timestamp == snapshot.Timestamp);

			if (!exists)
			{
				context.PlayerSnapshots.Add(snapshot);
				imported++;
			}
		}
		await context.SaveChangesAsync();
		return imported;
	}

	private async Task<int> ImportArenaBattlesAsync(GameDatabaseContext context, ArenaBattle[] battles)
	{
		int imported = 0;
		foreach (var battle in battles)
		{
			// Check for duplicate (by timestamp + opponent)
			var exists = await context.ArenaBattles
				.AnyAsync(b => b.Timestamp == battle.Timestamp && b.OpponentId == battle.OpponentId);

			if (!exists)
			{
				context.ArenaBattles.Add(battle);
				imported++;
			}
		}
		await context.SaveChangesAsync();
		return imported;
	}

	private async Task<int> ImportGrandArenaBattlesAsync(GameDatabaseContext context, GrandArenaBattle[] battles)
	{
		int imported = 0;
		foreach (var battle in battles)
		{
			var exists = await context.GrandArenaBattles
				.AnyAsync(b => b.Timestamp == battle.Timestamp && b.OpponentId == battle.OpponentId);

			if (!exists)
			{
				context.GrandArenaBattles.Add(battle);
				imported++;
			}
		}
		await context.SaveChangesAsync();
		return imported;
	}

	private async Task<int> ImportTitanArenaBattlesAsync(GameDatabaseContext context, TitanArenaBattle[] battles)
	{
		int imported = 0;
		foreach (var battle in battles)
		{
			var exists = await context.TitanArenaBattles
				.AnyAsync(b => b.Timestamp == battle.Timestamp && b.OpponentId == battle.OpponentId);

			if (!exists)
			{
				context.TitanArenaBattles.Add(battle);
				imported++;
			}
		}
		await context.SaveChangesAsync();
		return imported;
	}

	private async Task<int> ImportGuildWarBattlesAsync(GameDatabaseContext context, GuildWarBattle[] battles)
	{
		int imported = 0;
		foreach (var battle in battles)
		{
			var exists = await context.GuildWarBattles
				.AnyAsync(b => b.Timestamp == battle.Timestamp && b.WarId == battle.WarId);

			if (!exists)
			{
				context.GuildWarBattles.Add(battle);
				imported++;
			}
		}
		await context.SaveChangesAsync();
		return imported;
	}

	private async Task<int> ImportRaidBossAttacksAsync(GameDatabaseContext context, RaidBossAttack[] attacks)
	{
		int imported = 0;
		foreach (var attack in attacks)
		{
			var exists = await context.RaidBossAttacks
				.AnyAsync(a => a.Timestamp == attack.Timestamp && a.BossName == attack.BossName);

			if (!exists)
			{
				context.RaidBossAttacks.Add(attack);
				imported++;
			}
		}
		await context.SaveChangesAsync();
		return imported;
	}

	private async Task<int> ImportChestOpeningsAsync(GameDatabaseContext context, ChestOpening[] openings)
	{
		int imported = 0;
		foreach (var opening in openings)
		{
			var exists = await context.ChestOpenings
				.AnyAsync(c => c.Timestamp == opening.Timestamp && c.ChestType == opening.ChestType);

			if (!exists)
			{
				context.ChestOpenings.Add(opening);
				imported++;
			}
		}
		await context.SaveChangesAsync();
		return imported;
	}

	private async Task<int> ImportOpponentsAsync(GameDatabaseContext context, Opponent[] opponents)
	{
		int imported = 0;
		foreach (var opponent in opponents)
		{
			var existing = await context.Opponents
				.FirstOrDefaultAsync(o => o.OpponentId == opponent.OpponentId);

			if (existing == null)
			{
				context.Opponents.Add(opponent);
				imported++;
			}
			else
			{
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

	private async Task UpdateSyncMetadataAsync(GameDatabaseContext context, string key, string value)
	{
		var metadata = await context.SyncMetadata.FirstOrDefaultAsync(m => m.Key == key);
		if (metadata == null)
		{
			metadata = new SyncMetadata
			{
				Key = key,
				Value = value,
				UpdatedAt = DateTime.UtcNow
			};
			context.SyncMetadata.Add(metadata);
		}
		else
		{
			metadata.Value = value;
			metadata.UpdatedAt = DateTime.UtcNow;
		}
		await context.SaveChangesAsync();
	}

	public async Task<DateTime?> GetLastSyncTimestampAsync()
	{
		await using var context = await _contextFactory.CreateDbContextAsync();
		var metadata = await context.SyncMetadata
			.FirstOrDefaultAsync(m => m.Key == "last_sync_timestamp");

		if (metadata != null && DateTime.TryParse(metadata.Value, out var timestamp))
		{
			return timestamp;
		}
		return null;
	}

	/// <summary>
	/// Gets statistics about the database contents.
	/// </summary>
	public async Task<DatabaseStats> GetDatabaseStatsAsync()
	{
		await using var context = await _contextFactory.CreateDbContextAsync();

		var stats = new DatabaseStats
		{
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
			LastSync = await GetLastSyncTimestampAsync()
		};

		// Calculate oldest and newest records
		if (stats.TotalSnapshots > 0)
		{
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
/// Database statistics
/// </summary>
public class DatabaseStats
{
	public int TotalSnapshots { get; set; }
	public int TotalArenaBattles { get; set; }
	public int TotalGrandArenaBattles { get; set; }
	public int TotalTitanArenaBattles { get; set; }
	public int TotalGuildWarBattles { get; set; }
	public int TotalRaidBossAttacks { get; set; }
	public int TotalChestOpenings { get; set; }
	public int TotalOpponents { get; set; }
	public int TotalGoals { get; set; }
	public int TotalCalendarEvents { get; set; }
	public DateTime? OldestSnapshot { get; set; }
	public DateTime? NewestSnapshot { get; set; }
	public DateTime? LastSync { get; set; }

	public int TotalRecords =>
		TotalSnapshots + TotalArenaBattles + TotalGrandArenaBattles +
		TotalTitanArenaBattles + TotalGuildWarBattles + TotalRaidBossAttacks +
		TotalChestOpenings + TotalOpponents + TotalGoals + TotalCalendarEvents;
}

/// <summary>
/// Container for browser sync data
/// </summary>
public class BrowserSyncData
{
	public PlayerSnapshot[]? PlayerSnapshots { get; set; }
	public ArenaBattle[]? ArenaBattles { get; set; }
	public GrandArenaBattle[]? GrandArenaBattles { get; set; }
	public TitanArenaBattle[]? TitanArenaBattles { get; set; }
	public GuildWarBattle[]? GuildWarBattles { get; set; }
	public RaidBossAttack[]? RaidBossAttacks { get; set; }
	public ChestOpening[]? ChestOpenings { get; set; }
	public Opponent[]? Opponents { get; set; }
}

/// <summary>
/// Result of an import operation
/// </summary>
public class ImportResult
{
	public bool Success { get; set; }
	public string? ErrorMessage { get; set; }
	public int SnapshotsImported { get; set; }
	public int ArenaBattlesImported { get; set; }
	public int GrandArenaBattlesImported { get; set; }
	public int TitanArenaBattlesImported { get; set; }
	public int GuildWarBattlesImported { get; set; }
	public int RaidBossAttacksImported { get; set; }
	public int ChestOpeningsImported { get; set; }
	public int OpponentsImported { get; set; }

	public int TotalImported =>
		SnapshotsImported + ArenaBattlesImported + GrandArenaBattlesImported +
		TitanArenaBattlesImported + GuildWarBattlesImported + RaidBossAttacksImported +
		ChestOpeningsImported + OpponentsImported;
}
