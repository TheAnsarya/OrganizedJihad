using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Order;
using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Api.Models.Ui;
using OrganizedJihad.Data;
using OrganizedJihad.Data.Models;
using System.Text;

namespace OrganizedJihad.Benchmarks;

/// <summary>
/// Benchmarks for automated daily report aggregation and export paths.
/// </summary>
[MemoryDiagnoser]
[Orderer(SummaryOrderPolicy.FastestToSlowest)]
[RankColumn]
public class AutomatedDailyReportBenchmarks {
	private DbContextOptions<GameDatabaseContext> _options = null!;
	private ApiUiDailyReportResponse _report = null!;

	[GlobalSetup]
	public async Task Setup() {
		_options = new DbContextOptionsBuilder<GameDatabaseContext>()
			.UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
			.Options;

		await using var db = new GameDatabaseContext(_options);
		var now = DateTime.UtcNow;

		db.PlayerSnapshots.AddRange(Enumerable.Range(0, 250).Select(i => new PlayerSnapshot {
			PlayerId = 1000 + i,
			PlayerName = $"Player_{i}",
			Timestamp = now.AddMinutes(-i),
			Level = 120,
			TeamPower = 1000000 + i,
			DateCreated = now,
		}));

		db.ArenaBattles.AddRange(Enumerable.Range(0, 1000).Select(i => new ArenaBattle {
			Timestamp = now.AddMinutes(-i),
			OpponentId = 2000 + i,
			OpponentName = $"Opponent_{i}",
			IsWin = i % 2 == 0,
			RankBefore = 300,
			RankAfter = 299,
			DateCreated = now,
		}));

		db.ResourceTransactions.AddRange(Enumerable.Range(0, 1200).Select(i => new ResourceTransaction {
			Timestamp = now.AddMinutes(-i),
			ResourceType = "gold",
			Amount = 100 + i,
			Source = "benchmark",
			DateCreated = now,
		}));

		db.QuestCompletions.AddRange(Enumerable.Range(0, 600).Select(i => new QuestCompletion {
			CompletedAt = now.AddMinutes(-i),
			QuestType = "daily",
			QuestId = $"quest_{i}",
			QuestName = $"Quest {i}",
			PlayerId = 12345,
			DateCreated = now,
		}));

		db.ChestOpenings.AddRange(Enumerable.Range(0, 300).Select(i => new ChestOpening {
			Timestamp = now.AddMinutes(-i),
			ChestType = "heroic",
			DateCreated = now,
		}));

		await db.SaveChangesAsync();

		_report = new ApiUiDailyReportResponse(
			DateUtc: now.Date,
			CheckedUtc: now,
			LastSyncUtc: now,
			PlayerSnapshots: 250,
			BattlesTracked: 1000,
			ArenaBattles: 1000,
			GrandArenaBattles: 0,
			TitanArenaBattles: 0,
			GuildWarBattles: 0,
			RaidBossAttacks: 0,
			ExpeditionBattles: 0,
			ChestOpenings: 300,
			QuestCompletions: 600,
			ShopPurchases: 0,
			ResourceTransactions: 1200,
			HeroUpgrades: 0,
			TitanUpgrades: 0,
			InventoryItemUsages: 0,
			ChatMessages: 0);
	}

	/// <summary>
	/// Benchmark daily report aggregation query-shape over seeded data.
	/// </summary>
	[Benchmark(Description = "Aggregate daily report counts")]
	public async Task<int> AggregateDailyReportCounts() {
		await using var db = new GameDatabaseContext(_options);
		var dayStart = DateTime.UtcNow.Date;
		var dayEnd = dayStart.AddDays(1);

		var snapshots = await db.PlayerSnapshots.AsNoTracking().CountAsync(x => x.DateCreated >= dayStart && x.DateCreated < dayEnd);
		var arenaBattles = await db.ArenaBattles.AsNoTracking().CountAsync(x => x.DateCreated >= dayStart && x.DateCreated < dayEnd);
		var resources = await db.ResourceTransactions.AsNoTracking().CountAsync(x => x.DateCreated >= dayStart && x.DateCreated < dayEnd);
		var quests = await db.QuestCompletions.AsNoTracking().CountAsync(x => x.DateCreated >= dayStart && x.DateCreated < dayEnd);
		var chests = await db.ChestOpenings.AsNoTracking().CountAsync(x => x.DateCreated >= dayStart && x.DateCreated < dayEnd);

		return snapshots + arenaBattles + resources + quests + chests;
	}

	/// <summary>
	/// Benchmark CSV export string construction for a generated report payload.
	/// </summary>
	[Benchmark(Description = "Build daily report CSV payload")]
	public int BuildDailyReportCsvPayload() {
		var csv = BuildCsv(_report);
		return csv.Length;
	}

	private static string BuildCsv(ApiUiDailyReportResponse report) {
		var sb = new StringBuilder();
		sb.AppendLine("metric,value");
		sb.AppendLine($"dateUtc,{report.DateUtc:yyyy-MM-dd}");
		sb.AppendLine($"checkedUtc,{report.CheckedUtc:u}");
		sb.AppendLine($"lastSyncUtc,{(report.LastSyncUtc is null ? string.Empty : report.LastSyncUtc.Value.ToString("u"))}");
		sb.AppendLine($"playerSnapshots,{report.PlayerSnapshots}");
		sb.AppendLine($"battlesTracked,{report.BattlesTracked}");
		sb.AppendLine($"resourceTransactions,{report.ResourceTransactions}");
		sb.AppendLine($"questCompletions,{report.QuestCompletions}");
		sb.AppendLine($"chestOpenings,{report.ChestOpenings}");
		return sb.ToString();
	}
}
