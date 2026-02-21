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

	// === Titan Upgrade Benchmarks ===

	/// <summary>
	/// Benchmark: Batch insert titan level upgrades with deduplication.
	/// Mirrors ImportTitanUpgradesAsync dedup pattern (TitanId + Timestamp).
	/// </summary>
	[Benchmark(Description = "Insert 50 TitanLevelUpgrades with dedup")]
	public async Task InsertTitanLevelUpgradesWithDedup() {
		await using var context = new GameDatabaseContext(_options);

		for (int i = 0; i < 50; i++) {
			var upgrade = new TitanLevelUpgrade {
				Timestamp = DateTime.UtcNow.AddMinutes(-i),
				TitanId = 1,
				TitanName = "Hyperion",
				PlayerId = 12345,
				PowerAfter = 30000 + (i * 50),
				LevelBefore = 50 + i,
				LevelAfter = 51 + i,
				PotionsSpent = 10,
				GoldSpent = 2000
			};

			var exists = await context.TitanLevelUpgrades
				.AnyAsync(u => u.TitanId == upgrade.TitanId && u.Timestamp == upgrade.Timestamp);

			if (!exists) {
				context.TitanLevelUpgrades.Add(upgrade);
			}
		}

		await context.SaveChangesAsync();
	}

	/// <summary>
	/// Benchmark: Insert titan star upgrades (fewer records, more expensive each).
	/// </summary>
	[Benchmark(Description = "Insert 10 TitanStarUpgrades with dedup")]
	public async Task InsertTitanStarUpgradesWithDedup() {
		await using var context = new GameDatabaseContext(_options);

		for (int i = 0; i < 10; i++) {
			var upgrade = new TitanStarUpgrade {
				Timestamp = DateTime.UtcNow.AddMinutes(-i),
				TitanId = i + 1,
				TitanName = $"Titan_{i}",
				PlayerId = 12345,
				PowerAfter = 40000 + (i * 1000),
				StarsBefore = 4,
				StarsAfter = 5,
				SoulStonesConsumed = 200
			};

			var exists = await context.TitanStarUpgrades
				.AnyAsync(u => u.TitanId == upgrade.TitanId && u.Timestamp == upgrade.Timestamp);

			if (!exists) {
				context.TitanStarUpgrades.Add(upgrade);
			}
		}

		await context.SaveChangesAsync();
	}

	// === Daily/Guild Quest Benchmarks ===

	/// <summary>
	/// Benchmark: Insert daily quest completions with deduplication.
	/// Dedup key: PlayerId + QuestId + CompletedAt.
	/// </summary>
	[Benchmark(Description = "Insert 20 DailyQuestCompletions with dedup")]
	public async Task InsertDailyQuestCompletionsWithDedup() {
		await using var context = new GameDatabaseContext(_options);

		for (int i = 0; i < 20; i++) {
			var quest = new DailyQuestCompletion {
				CompletedAt = DateTime.UtcNow.AddMinutes(-i),
				QuestDate = DateTime.Today,
				QuestId = $"daily_quest_{i}",
				QuestName = $"Daily Quest {i}",
				PlayerId = 12345,
				ActivityPoints = 20
			};

			var exists = await context.DailyQuestCompletions
				.AnyAsync(q => q.PlayerId == quest.PlayerId &&
							   q.QuestId == quest.QuestId &&
							   q.CompletedAt == quest.CompletedAt);

			if (!exists) {
				context.DailyQuestCompletions.Add(quest);
			}
		}

		await context.SaveChangesAsync();
	}

	/// <summary>
	/// Benchmark: Insert guild quest completions with deduplication.
	/// Dedup key: PlayerId + QuestId + CompletedAt.
	/// </summary>
	[Benchmark(Description = "Insert 10 GuildQuestCompletions with dedup")]
	public async Task InsertGuildQuestCompletionsWithDedup() {
		await using var context = new GameDatabaseContext(_options);

		for (int i = 0; i < 10; i++) {
			var quest = new GuildQuestCompletion {
				CompletedAt = DateTime.UtcNow.AddMinutes(-i),
				QuestDate = DateTime.Today,
				QuestId = $"guild_quest_{i}",
				QuestName = $"Guild Quest {i}",
				PlayerId = 12345,
				GuildId = 100,
				GuildActivityPoints = 30
			};

			var exists = await context.GuildQuestCompletions
				.AnyAsync(q => q.PlayerId == quest.PlayerId &&
							   q.QuestId == quest.QuestId &&
							   q.CompletedAt == quest.CompletedAt);

			if (!exists) {
				context.GuildQuestCompletions.Add(quest);
			}
		}

		await context.SaveChangesAsync();
	}

	// === Login Reward Benchmarks ===

	/// <summary>
	/// Benchmark: Insert login rewards with deduplication.
	/// Dedup key: PlayerId + ClaimedAt.
	/// </summary>
	[Benchmark(Description = "Insert 30 LoginRewards with dedup")]
	public async Task InsertLoginRewardsWithDedup() {
		await using var context = new GameDatabaseContext(_options);

		for (int i = 0; i < 30; i++) {
			var reward = new LoginReward {
				ClaimedAt = DateTime.UtcNow.AddDays(-i),
				DayNumber = i + 1,
				StreakLength = Math.Min(i + 1, 30),
				IsVipBonus = i % 7 == 0,
				PlayerId = 12345
			};

			var exists = await context.LoginRewards
				.AnyAsync(r => r.PlayerId == reward.PlayerId &&
							   r.ClaimedAt == reward.ClaimedAt);

			if (!exists) {
				context.LoginRewards.Add(reward);
			}
		}

		await context.SaveChangesAsync();
	}

	// === Inventory Benchmarks ===

	/// <summary>
	/// Benchmark: Insert inventory item usages with deduplication.
	/// Dedup key: PlayerId + ItemId + Timestamp.
	/// </summary>
	[Benchmark(Description = "Insert 50 InventoryItemUsages with dedup")]
	public async Task InsertInventoryItemUsagesWithDedup() {
		await using var context = new GameDatabaseContext(_options);

		for (int i = 0; i < 50; i++) {
			var usage = new InventoryItemUsage {
				Timestamp = DateTime.UtcNow.AddMinutes(-i),
				ItemId = $"potion_{i % 5}",
				ItemName = $"XP Potion {i % 5}",
				Category = "potion",
				QuantityUsed = 1 + (i % 10),
				PlayerId = 12345
			};

			var exists = await context.InventoryItemUsages
				.AnyAsync(u => u.PlayerId == usage.PlayerId &&
							   u.ItemId == usage.ItemId &&
							   u.Timestamp == usage.Timestamp);

			if (!exists) {
				context.InventoryItemUsages.Add(usage);
			}
		}

		await context.SaveChangesAsync();
	}

	/// <summary>
	/// Benchmark: Insert equipment changes with deduplication.
	/// Dedup key: HeroId + SlotIndex + Timestamp.
	/// </summary>
	[Benchmark(Description = "Insert 30 EquipmentChanges with dedup")]
	public async Task InsertEquipmentChangesWithDedup() {
		await using var context = new GameDatabaseContext(_options);

		for (int i = 0; i < 30; i++) {
			var change = new EquipmentChange {
				Timestamp = DateTime.UtcNow.AddMinutes(-i),
				HeroId = (i % 5) + 1,
				HeroName = $"Hero_{(i % 5) + 1}",
				SlotIndex = i % 6,
				ChangeType = "equipped",
				PlayerId = 12345
			};

			var exists = await context.EquipmentChanges
				.AnyAsync(c => c.HeroId == change.HeroId &&
							   c.SlotIndex == change.SlotIndex &&
							   c.Timestamp == change.Timestamp);

			if (!exists) {
				context.EquipmentChanges.Add(change);
			}
		}

		await context.SaveChangesAsync();
	}

	// === Phase 8 Query Benchmarks ===

	/// <summary>
	/// Benchmark: Query titan upgrade history with filtering.
	/// Mirrors GetTitanUpgradeHistoryAsync with titanId + upgradeType filters.
	/// </summary>
	[Benchmark(Description = "Query TitanUpgradeHistory filtered")]
	public async Task QueryTitanUpgradeHistory() {
		await using var context = new GameDatabaseContext(_options);

		// Seed data
		var upgrades = Enumerable.Range(0, 100).Select(i => new TitanLevelUpgrade {
			Timestamp = DateTime.UtcNow.AddMinutes(-i),
			TitanId = (i % 3) + 1,
			TitanName = $"Titan_{(i % 3) + 1}",
			PlayerId = 12345,
			PowerAfter = 30000 + i,
			LevelBefore = i,
			LevelAfter = i + 1
		}).ToList();
		context.TitanLevelUpgrades.AddRange(upgrades);
		await context.SaveChangesAsync();

		// Query with filter
		_ = await context.TitanLevelUpgrades
			.AsNoTracking()
			.Where(u => u.TitanId == 1)
			.OrderByDescending(u => u.Timestamp)
			.Take(50)
			.ToListAsync();
	}

	/// <summary>
	/// Benchmark: Query daily activity data with date filter.
	/// Mirrors GetDailyActivityAsync with date + playerId filters.
	/// </summary>
	[Benchmark(Description = "Query DailyActivity by date")]
	public async Task QueryDailyActivityByDate() {
		await using var context = new GameDatabaseContext(_options);

		// Seed data
		var quests = Enumerable.Range(0, 50).Select(i => new DailyQuestCompletion {
			CompletedAt = DateTime.UtcNow.AddDays(-i / 5),
			QuestDate = DateTime.Today.AddDays(-i / 5),
			QuestId = $"quest_{i}",
			QuestName = $"Quest {i}",
			PlayerId = 12345,
			ActivityPoints = 20
		}).ToList();
		context.DailyQuestCompletions.AddRange(quests);
		await context.SaveChangesAsync();

		// Query today's quests
		var today = DateTime.Today;
		_ = await context.DailyQuestCompletions
			.AsNoTracking()
			.Where(q => q.QuestDate == today && q.PlayerId == 12345)
			.OrderByDescending(q => q.CompletedAt)
			.Take(30)
			.ToListAsync();
	}

	/// <summary>
	/// Benchmark: Query inventory history with category filter.
	/// Mirrors GetInventoryHistoryAsync with category filter.
	/// </summary>
	[Benchmark(Description = "Query InventoryHistory by category")]
	public async Task QueryInventoryHistoryByCategory() {
		await using var context = new GameDatabaseContext(_options);

		// Seed data with mixed categories
		var usages = Enumerable.Range(0, 100).Select(i => new InventoryItemUsage {
			Timestamp = DateTime.UtcNow.AddMinutes(-i),
			ItemId = $"item_{i}",
			ItemName = $"Item {i}",
			Category = i % 3 == 0 ? "potion" : (i % 3 == 1 ? "scroll" : "fragment"),
			QuantityUsed = 1 + (i % 5),
			PlayerId = 12345
		}).ToList();
		context.InventoryItemUsages.AddRange(usages);
		await context.SaveChangesAsync();

		// Query potions only
		_ = await context.InventoryItemUsages
			.AsNoTracking()
			.Where(u => u.Category == "potion")
			.OrderByDescending(u => u.Timestamp)
			.Take(50)
			.ToListAsync();
	}
}
