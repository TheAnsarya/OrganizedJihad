using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Api.Models.Ui;
using OrganizedJihad.Data;
using OrganizedJihad.Data.Models;
using System.Globalization;
using System.Text;
using System.Text.Json;

namespace OrganizedJihad.Api.Services.Ui;

/// <summary>
/// Builds, stores, and exports daily report payloads.
/// </summary>
public sealed class ApiUiDailyReportService {
	private const string LatestDailyReportMetadataKey = "ui_daily_report_latest_v1";
	private const string DailyReportHistoryPrefix = "ui_daily_report_history_";
	private readonly IDbContextFactory<GameDatabaseContext> _contextFactory;

	/// <summary>
	/// Initializes a new instance of the daily report service.
	/// </summary>
	public ApiUiDailyReportService(IDbContextFactory<GameDatabaseContext> contextFactory) {
		_contextFactory = contextFactory;
	}

	/// <summary>
	/// Builds an on-demand daily report for current UTC day.
	/// </summary>
	public async Task<ApiUiDailyReportResponse> BuildDailyReportAsync(CancellationToken cancellationToken = default) {
		await using var dbContext = await _contextFactory.CreateDbContextAsync(cancellationToken);
		var nowUtc = DateTime.UtcNow;
		var dayStartUtc = nowUtc.Date;
		var dayEndUtc = dayStartUtc.AddDays(1);

		var playerSnapshots = await dbContext.PlayerSnapshots.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken);
		var arenaBattles = await dbContext.ArenaBattles.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken);
		var grandArenaBattles = await dbContext.GrandArenaBattles.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken);
		var titanArenaBattles = await dbContext.TitanArenaBattles.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken);
		var guildWarBattles = await dbContext.GuildWarBattles.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken);
		var raidBossAttacks = await dbContext.RaidBossAttacks.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken);
		var expeditionBattles = await dbContext.ExpeditionBattles.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken);
		var chestOpenings = await dbContext.ChestOpenings.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken);
		var questCompletions = await dbContext.QuestCompletions.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken);
		var dailyQuestCompletions = await dbContext.DailyQuestCompletions.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken);
		var guildQuestCompletions = await dbContext.GuildQuestCompletions.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken);
		var shopPurchases = await dbContext.ShopPurchases.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken);
		var resourceTransactions = await dbContext.ResourceTransactions.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken);

		var heroUpgrades =
			await dbContext.HeroLevelUpgrades.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken)
			+ await dbContext.HeroStarUpgrades.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken)
			+ await dbContext.HeroColorUpgrades.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken)
			+ await dbContext.HeroSkillUpgrades.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken)
			+ await dbContext.HeroArtifactUpgrades.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken)
			+ await dbContext.HeroGlyphUpgrades.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken)
			+ await dbContext.HeroSkinUpgrades.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken);

		var titanUpgrades =
			await dbContext.TitanLevelUpgrades.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken)
			+ await dbContext.TitanStarUpgrades.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken)
			+ await dbContext.TitanSkillUpgrades.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken)
			+ await dbContext.TitanArtifactUpgrades.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken)
			+ await dbContext.TitanSkinUpgrades.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken);

		var inventoryItemUsages = await dbContext.InventoryItemUsages.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken);
		var chatMessages = await dbContext.ChatMessages.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc, cancellationToken);
		var syncTimestampRaw = await dbContext.SyncMetadata.AsNoTracking().Where(item => item.Key == "last_sync_timestamp").Select(item => item.Value).FirstOrDefaultAsync(cancellationToken);

		DateTime? lastSyncUtc = null;
		if (!string.IsNullOrWhiteSpace(syncTimestampRaw) && DateTime.TryParse(syncTimestampRaw, out var parsedSyncUtc)) {
			lastSyncUtc = DateTime.SpecifyKind(parsedSyncUtc, DateTimeKind.Utc);
		}

		var battlesTracked = arenaBattles + grandArenaBattles + titanArenaBattles + guildWarBattles + raidBossAttacks + expeditionBattles;

		return new ApiUiDailyReportResponse(
			DateUtc: dayStartUtc,
			CheckedUtc: nowUtc,
			LastSyncUtc: lastSyncUtc,
			PlayerSnapshots: playerSnapshots,
			BattlesTracked: battlesTracked,
			ArenaBattles: arenaBattles,
			GrandArenaBattles: grandArenaBattles,
			TitanArenaBattles: titanArenaBattles,
			GuildWarBattles: guildWarBattles,
			RaidBossAttacks: raidBossAttacks,
			ExpeditionBattles: expeditionBattles,
			ChestOpenings: chestOpenings,
			QuestCompletions: questCompletions + dailyQuestCompletions + guildQuestCompletions,
			ShopPurchases: shopPurchases,
			ResourceTransactions: resourceTransactions,
			HeroUpgrades: heroUpgrades,
			TitanUpgrades: titanUpgrades,
			InventoryItemUsages: inventoryItemUsages,
			ChatMessages: chatMessages);
	}

	/// <summary>
	/// Loads latest persisted report from metadata store.
	/// </summary>
	public async Task<ApiUiDailyReportResponse?> LoadLatestDailyReportAsync(CancellationToken cancellationToken = default) {
		await using var dbContext = await _contextFactory.CreateDbContextAsync(cancellationToken);
		var payload = await dbContext.SyncMetadata
			.AsNoTracking()
			.Where(item => item.Key == LatestDailyReportMetadataKey)
			.Select(item => item.Value)
			.FirstOrDefaultAsync(cancellationToken);

		if (string.IsNullOrWhiteSpace(payload)) {
			return null;
		}

		try {
			return JsonSerializer.Deserialize<ApiUiDailyReportResponse>(payload);
		}
		catch (JsonException) {
			return null;
		}
	}

	/// <summary>
	/// Generates a report and persists latest + dated history snapshot.
	/// </summary>
	public async Task<ApiUiDailyReportResponse> GenerateAndPersistDailyReportAsync(int retentionDays, CancellationToken cancellationToken = default) {
		var report = await BuildDailyReportAsync(cancellationToken);
		await PersistLatestAndHistoryAsync(report, retentionDays, cancellationToken);
		return report;
	}

	/// <summary>
	/// Loads generated history snapshots ordered by report date descending.
	/// </summary>
	public async Task<IReadOnlyList<ApiUiDailyReportResponse>> LoadDailyReportHistoryAsync(int limit, CancellationToken cancellationToken = default) {
		var safeLimit = Math.Clamp(limit, 1, 365);
		await using var dbContext = await _contextFactory.CreateDbContextAsync(cancellationToken);
		var rows = await dbContext.SyncMetadata
			.AsNoTracking()
			.Where(item => item.Key.StartsWith(DailyReportHistoryPrefix))
			.OrderByDescending(item => item.Key)
			.Take(safeLimit)
			.ToListAsync(cancellationToken);

		var reports = new List<ApiUiDailyReportResponse>(rows.Count);
		foreach (var row in rows) {
			if (string.IsNullOrWhiteSpace(row.Value)) {
				continue;
			}

			try {
				var report = JsonSerializer.Deserialize<ApiUiDailyReportResponse>(row.Value);
				if (report is not null) {
					reports.Add(report);
				}
			}
			catch (JsonException) {
				// Skip malformed history rows.
			}
		}

		return reports;
	}

	/// <summary>
	/// Builds CSV text payload for a daily report.
	/// </summary>
	public static string BuildDailyReportCsv(ApiUiDailyReportResponse report) {
		var sb = new StringBuilder();
		sb.AppendLine("metric,value");
		sb.AppendLine($"dateUtc,{report.DateUtc:yyyy-MM-dd}");
		sb.AppendLine($"checkedUtc,{report.CheckedUtc:u}");
		sb.AppendLine($"lastSyncUtc,{(report.LastSyncUtc is null ? string.Empty : report.LastSyncUtc.Value.ToString("u"))}");
		sb.AppendLine($"playerSnapshots,{report.PlayerSnapshots}");
		sb.AppendLine($"battlesTracked,{report.BattlesTracked}");
		sb.AppendLine($"arenaBattles,{report.ArenaBattles}");
		sb.AppendLine($"grandArenaBattles,{report.GrandArenaBattles}");
		sb.AppendLine($"titanArenaBattles,{report.TitanArenaBattles}");
		sb.AppendLine($"guildWarBattles,{report.GuildWarBattles}");
		sb.AppendLine($"raidBossAttacks,{report.RaidBossAttacks}");
		sb.AppendLine($"expeditionBattles,{report.ExpeditionBattles}");
		sb.AppendLine($"chestOpenings,{report.ChestOpenings}");
		sb.AppendLine($"questCompletions,{report.QuestCompletions}");
		sb.AppendLine($"shopPurchases,{report.ShopPurchases}");
		sb.AppendLine($"resourceTransactions,{report.ResourceTransactions}");
		sb.AppendLine($"heroUpgrades,{report.HeroUpgrades}");
		sb.AppendLine($"titanUpgrades,{report.TitanUpgrades}");
		sb.AppendLine($"inventoryItemUsages,{report.InventoryItemUsages}");
		sb.AppendLine($"chatMessages,{report.ChatMessages}");
		return sb.ToString();
	}

	private async Task PersistLatestAndHistoryAsync(ApiUiDailyReportResponse report, int retentionDays, CancellationToken cancellationToken) {
		await using var dbContext = await _contextFactory.CreateDbContextAsync(cancellationToken);
		var nowUtc = DateTime.UtcNow;
		var json = JsonSerializer.Serialize(report);

		var latest = await dbContext.SyncMetadata.FirstOrDefaultAsync(item => item.Key == LatestDailyReportMetadataKey, cancellationToken);
		if (latest is null) {
			dbContext.SyncMetadata.Add(new SyncMetadata {
				Key = LatestDailyReportMetadataKey,
				Value = json,
				UpdatedAt = nowUtc,
				Notes = "Latest generated API UI daily report payload",
			});
		} else {
			latest.Value = json;
			latest.UpdatedAt = nowUtc;
			latest.Notes = "Latest generated API UI daily report payload";
		}

		var historyKey = DailyReportHistoryPrefix + report.DateUtc.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
		var history = await dbContext.SyncMetadata.FirstOrDefaultAsync(item => item.Key == historyKey, cancellationToken);
		if (history is null) {
			dbContext.SyncMetadata.Add(new SyncMetadata {
				Key = historyKey,
				Value = json,
				UpdatedAt = nowUtc,
				Notes = "Generated API UI daily report history payload",
			});
		} else {
			history.Value = json;
			history.UpdatedAt = nowUtc;
			history.Notes = "Generated API UI daily report history payload";
		}

		var cutoffDate = nowUtc.Date.AddDays(-Math.Max(1, retentionDays));
		var historyRows = await dbContext.SyncMetadata
			.Where(item => item.Key.StartsWith(DailyReportHistoryPrefix))
			.ToListAsync(cancellationToken);

		foreach (var row in historyRows) {
			var suffix = row.Key.Substring(DailyReportHistoryPrefix.Length);
			if (!DateTime.TryParseExact(suffix, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed)) {
				continue;
			}

			if (parsed.Date < cutoffDate) {
				dbContext.SyncMetadata.Remove(row);
			}
		}

		await dbContext.SaveChangesAsync(cancellationToken);
	}
}
