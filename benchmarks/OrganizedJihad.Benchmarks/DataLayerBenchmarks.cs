using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Order;
using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Data;
using OrganizedJihad.Data.Models;

namespace OrganizedJihad.Benchmarks;

/// <summary>
/// Performance benchmarks for data layer operations.
/// Measures insertion throughput, query performance, and deduplication overhead.
///
/// Run with: dotnet run --project benchmarks/OrganizedJihad.Benchmarks -c Release -- --filter *DataLayerBenchmarks*
/// Reference: https://benchmarkdotnet.org/articles/guides/getting-started.html
/// </summary>
[MemoryDiagnoser]
[Orderer(SummaryOrderPolicy.FastestToSlowest)]
[RankColumn]
public class DataLayerBenchmarks {
	private DbContextOptions<GameDatabaseContext> _options = null!;

	[GlobalSetup]
	public void Setup() {
		_options = new DbContextOptionsBuilder<GameDatabaseContext>()
			.UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
			.Options;
	}

	// === Snapshot Insertion Benchmarks ===

	/// <summary>
	/// Benchmark: Insert a single player snapshot.
	/// </summary>
	[Benchmark(Description = "Insert single PlayerSnapshot")]
	public async Task InsertSingleSnapshot() {
		await using var context = new GameDatabaseContext(_options);
		context.PlayerSnapshots.Add(new PlayerSnapshot {
			PlayerId = 12345,
			PlayerName = "BenchPlayer",
			Timestamp = DateTime.UtcNow,
			Level = 120,
			TeamPower = 1500000
		});
		await context.SaveChangesAsync();
	}

	/// <summary>
	/// Benchmark: Batch insert 100 player snapshots.
	/// </summary>
	[Benchmark(Description = "Batch insert 100 PlayerSnapshots")]
	public async Task BatchInsert100Snapshots() {
		await using var context = new GameDatabaseContext(_options);
		var snapshots = Enumerable.Range(0, 100).Select(i => new PlayerSnapshot {
			PlayerId = 12345,
			PlayerName = "BenchPlayer",
			Timestamp = DateTime.UtcNow.AddMinutes(-i),
			Level = 120,
			TeamPower = 1500000 + i
		}).ToList();

		context.PlayerSnapshots.AddRange(snapshots);
		await context.SaveChangesAsync();
	}

	// === Battle Record Benchmarks ===

	/// <summary>
	/// Benchmark: Insert arena battles with deduplication check.
	/// </summary>
	[Benchmark(Description = "Insert 50 ArenaBattles with dedup")]
	public async Task InsertBattlesWithDeduplication() {
		await using var context = new GameDatabaseContext(_options);
		int imported = 0;

		for (int i = 0; i < 50; i++) {
			var battle = new ArenaBattle {
				Timestamp = DateTime.UtcNow.AddMinutes(-i),
				OpponentId = 10000 + i,
				OpponentName = $"Opponent_{i}",
				IsWin = i % 2 == 0,
				RankBefore = 100 + i,
				RankAfter = 100 + i - 1
			};

			var exists = await context.ArenaBattles
				.AnyAsync(b => b.Timestamp == battle.Timestamp && b.OpponentId == battle.OpponentId);

			if (!exists) {
				context.ArenaBattles.Add(battle);
				imported++;
			}
		}

		await context.SaveChangesAsync();
	}

	// === Query Performance Benchmarks ===

	/// <summary>
	/// Benchmark: Query with AsNoTracking (read-only).
	/// </summary>
	[Benchmark(Description = "Query 100 snapshots AsNoTracking")]
	public async Task QuerySnapshotsNoTracking() {
		await using var context = new GameDatabaseContext(_options);

		// Seed some data first
		var snapshots = Enumerable.Range(0, 100).Select(i => new PlayerSnapshot {
			PlayerId = 12345,
			PlayerName = "BenchPlayer",
			Timestamp = DateTime.UtcNow.AddMinutes(-i),
			Level = 120,
			TeamPower = 1500000
		}).ToList();
		context.PlayerSnapshots.AddRange(snapshots);
		await context.SaveChangesAsync();

		// Benchmark the query
		_ = await context.PlayerSnapshots
			.AsNoTracking()
			.OrderByDescending(s => s.Timestamp)
			.Take(100)
			.ToListAsync();
	}

	/// <summary>
	/// Benchmark: Query with tracking (default EF Core behavior).
	/// </summary>
	[Benchmark(Description = "Query 100 snapshots with tracking")]
	public async Task QuerySnapshotsWithTracking() {
		await using var context = new GameDatabaseContext(_options);

		// Seed some data first
		var snapshots = Enumerable.Range(0, 100).Select(i => new PlayerSnapshot {
			PlayerId = 12345,
			PlayerName = "BenchPlayer",
			Timestamp = DateTime.UtcNow.AddMinutes(-i),
			Level = 120,
			TeamPower = 1500000
		}).ToList();
		context.PlayerSnapshots.AddRange(snapshots);
		await context.SaveChangesAsync();

		// Benchmark the query
		_ = await context.PlayerSnapshots
			.OrderByDescending(s => s.Timestamp)
			.Take(100)
			.ToListAsync();
	}

	// === Hero Upgrade Benchmarks ===

	/// <summary>
	/// Benchmark: Batch insert hero level upgrades.
	/// </summary>
	[Benchmark(Description = "Insert 50 HeroLevelUpgrades")]
	public async Task InsertHeroLevelUpgrades() {
		await using var context = new GameDatabaseContext(_options);
		var upgrades = Enumerable.Range(0, 50).Select(i => new HeroLevelUpgrade {
			Timestamp = DateTime.UtcNow.AddMinutes(-i),
			HeroId = 1,
			HeroName = "Galahad",
			PlayerId = 12345,
			PowerAfter = 50000 + (i * 100),
			LevelBefore = 70 + i,
			LevelAfter = 71 + i,
			ExperienceSpent = 10000,
			GoldSpent = 5000
		}).ToList();

		context.HeroLevelUpgrades.AddRange(upgrades);
		await context.SaveChangesAsync();
	}

	// === Daily Activity Benchmarks ===

	/// <summary>
	/// Benchmark: Insert daily activity summary with upsert (check-then-insert).
	/// </summary>
	[Benchmark(Description = "Upsert DailyActivitySummary")]
	public async Task UpsertDailyActivitySummary() {
		await using var context = new GameDatabaseContext(_options);

		var summary = new DailyActivitySummary {
			PlayerId = 12345,
			SummaryDate = DateTime.Today,
			TotalActivityPoints = 100,
			DailyQuestsCompleted = 5,
			ArenaBattlesFought = 3,
			GoldEarned = 50000,
			DailyChestClaimed = true
		};

		var existing = await context.DailyActivitySummaries
			.FirstOrDefaultAsync(s => s.PlayerId == summary.PlayerId &&
									  s.SummaryDate == summary.SummaryDate);

		if (existing == null) {
			context.DailyActivitySummaries.Add(summary);
		} else {
			existing.TotalActivityPoints = summary.TotalActivityPoints;
			existing.DailyQuestsCompleted = summary.DailyQuestsCompleted;
		}

		await context.SaveChangesAsync();
	}
}
