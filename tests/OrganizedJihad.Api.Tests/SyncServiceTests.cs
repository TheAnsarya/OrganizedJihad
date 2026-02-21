using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using OrganizedJihad.Api.Models;
using OrganizedJihad.Api.Services;
using OrganizedJihad.Data;
using OrganizedJihad.Data.Models;
using System.Text.Json;

namespace OrganizedJihad.Api.Tests;

/// <summary>
/// Unit tests for the SyncService class.
/// Tests import methods, deduplication logic, query methods, and statistics computation.
///
/// Uses InMemory database provider with a unique database per test to ensure isolation.
/// Mock ILogger is used since we don't need to verify logging behavior.
///
/// References:
/// - EF Core InMemory Testing: https://learn.microsoft.com/en-us/ef/core/providers/in-memory/
/// - xUnit: https://xunit.net/
/// - FluentAssertions: https://fluentassertions.com/
/// - Moq: https://github.com/devlooped/moq
/// </summary>
public class SyncServiceTests : IDisposable {
	private readonly IDbContextFactory<GameDatabaseContext> _contextFactory;
	private readonly SyncService _service;
	private readonly string _dbName;

	/// <summary>
	/// Sets up the test fixture with a unique InMemory database and SyncService instance.
	/// </summary>
	public SyncServiceTests() {
		_dbName = Guid.NewGuid().ToString();

		// Create a factory that produces contexts pointing to the same InMemory database
		var options = new DbContextOptionsBuilder<GameDatabaseContext>()
			.UseInMemoryDatabase(databaseName: _dbName)
			.ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
			.Options;

		// Simple factory wrapper for InMemory contexts
		_contextFactory = new TestDbContextFactory(options);

		var logger = new Mock<ILogger<SyncService>>();
		_service = new SyncService(_contextFactory, logger.Object);
	}

	public void Dispose() {
		// InMemory databases are cleaned up automatically when no references remain
	}

	// ==========================================================================
	// Hero Upgrade Query Tests
	// ==========================================================================

	/// <summary>
	/// Verifies that GetHeroUpgradeHistoryAsync returns all upgrade types when no filter is specified.
	/// </summary>
	[Fact]
	public async Task GetHeroUpgradeHistory_Should_Return_All_Types_Without_Filter() {
		// Arrange - seed one record for each upgrade type
		await using var context = await _contextFactory.CreateDbContextAsync();

		context.HeroLevelUpgrades.Add(new HeroLevelUpgrade {
			Timestamp = DateTime.UtcNow, HeroId = 1, HeroName = "Galahad",
			PlayerId = 100, PowerAfter = 50000, LevelBefore = 99, LevelAfter = 100
		});
		context.HeroStarUpgrades.Add(new HeroStarUpgrade {
			Timestamp = DateTime.UtcNow, HeroId = 1, HeroName = "Galahad",
			PlayerId = 100, PowerAfter = 51000, StarsBefore = 5, StarsAfter = 6
		});
		context.HeroSkillUpgrades.Add(new HeroSkillUpgrade {
			Timestamp = DateTime.UtcNow, HeroId = 1, HeroName = "Galahad",
			PlayerId = 100, PowerAfter = 52000, SkillSlot = 1, SkillName = "Fury"
		});

		await context.SaveChangesAsync();

		// Act
		var result = await _service.GetHeroUpgradeHistoryAsync() as Dictionary<string, object>;

		// Assert - should contain all 7 type keys
		result.Should().NotBeNull();
		result!.Should().ContainKey("levelUpgrades");
		result.Should().ContainKey("starUpgrades");
		result.Should().ContainKey("colorUpgrades");
		result.Should().ContainKey("skillUpgrades");
		result.Should().ContainKey("artifactUpgrades");
		result.Should().ContainKey("glyphUpgrades");
		result.Should().ContainKey("skinUpgrades");

		// Verify populated types have data
		(result!["levelUpgrades"] as IList<HeroLevelUpgrade>).Should().HaveCount(1);
		(result["starUpgrades"] as IList<HeroStarUpgrade>).Should().HaveCount(1);
		(result["skillUpgrades"] as IList<HeroSkillUpgrade>).Should().HaveCount(1);
	}

	/// <summary>
	/// Verifies that hero upgrades can be filtered by heroId.
	/// </summary>
	[Fact]
	public async Task GetHeroUpgradeHistory_Should_Filter_By_HeroId() {
		// Arrange
		await using var context = await _contextFactory.CreateDbContextAsync();

		context.HeroLevelUpgrades.AddRange(
			new HeroLevelUpgrade { Timestamp = DateTime.UtcNow, HeroId = 10, HeroName = "Galahad", PlayerId = 1, PowerAfter = 50000, LevelBefore = 1, LevelAfter = 2 },
			new HeroLevelUpgrade { Timestamp = DateTime.UtcNow, HeroId = 20, HeroName = "Karkh", PlayerId = 1, PowerAfter = 60000, LevelBefore = 1, LevelAfter = 2 }
		);
		await context.SaveChangesAsync();

		// Act - filter to hero 10 only
		var result = await _service.GetHeroUpgradeHistoryAsync(heroId: 10, upgradeType: "level") as Dictionary<string, object>;

		// Assert
		var levels = result!["levelUpgrades"] as IList<HeroLevelUpgrade>;
		levels.Should().HaveCount(1);
		levels![0].HeroName.Should().Be("Galahad");
	}

	/// <summary>
	/// Verifies that hero upgrades can be filtered by upgrade type.
	/// </summary>
	[Fact]
	public async Task GetHeroUpgradeHistory_Should_Filter_By_Type() {
		// Arrange
		await using var context = await _contextFactory.CreateDbContextAsync();

		context.HeroLevelUpgrades.Add(new HeroLevelUpgrade {
			Timestamp = DateTime.UtcNow, HeroId = 1, HeroName = "Galahad",
			PlayerId = 100, PowerAfter = 50000, LevelBefore = 1, LevelAfter = 2
		});
		context.HeroStarUpgrades.Add(new HeroStarUpgrade {
			Timestamp = DateTime.UtcNow, HeroId = 1, HeroName = "Galahad",
			PlayerId = 100, PowerAfter = 51000, StarsBefore = 5, StarsAfter = 6
		});
		await context.SaveChangesAsync();

		// Act - filter to "star" type only
		var result = await _service.GetHeroUpgradeHistoryAsync(upgradeType: "star") as Dictionary<string, object>;

		// Assert - should only contain starUpgrades key
		result.Should().NotBeNull();
		result!.Should().ContainKey("starUpgrades");
		result.Should().NotContainKey("levelUpgrades");
	}

	// ==========================================================================
	// Titan Upgrade Query Tests
	// ==========================================================================

	/// <summary>
	/// Verifies that GetTitanUpgradeHistoryAsync returns all upgrade types when no filter is specified.
	/// </summary>
	[Fact]
	public async Task GetTitanUpgradeHistory_Should_Return_All_Types_Without_Filter() {
		// Arrange
		await using var context = await _contextFactory.CreateDbContextAsync();

		context.TitanLevelUpgrades.Add(new TitanLevelUpgrade {
			Timestamp = DateTime.UtcNow, TitanId = 1, TitanName = "Hyperion",
			PlayerId = 100, PowerAfter = 30000, LevelBefore = 50, LevelAfter = 51
		});
		await context.SaveChangesAsync();

		// Act
		var result = await _service.GetTitanUpgradeHistoryAsync() as Dictionary<string, object>;

		// Assert - should contain all 5 type keys
		result.Should().NotBeNull();
		result!.Should().ContainKey("levelUpgrades");
		result.Should().ContainKey("starUpgrades");
		result.Should().ContainKey("skillUpgrades");
		result.Should().ContainKey("artifactUpgrades");
		result.Should().ContainKey("skinUpgrades");
	}

	/// <summary>
	/// Verifies that titan upgrades can be filtered by titanId.
	/// </summary>
	[Fact]
	public async Task GetTitanUpgradeHistory_Should_Filter_By_TitanId() {
		// Arrange
		await using var context = await _contextFactory.CreateDbContextAsync();

		context.TitanLevelUpgrades.AddRange(
			new TitanLevelUpgrade { Timestamp = DateTime.UtcNow, TitanId = 10, TitanName = "Hyperion", PlayerId = 1, PowerAfter = 30000, LevelBefore = 1, LevelAfter = 2 },
			new TitanLevelUpgrade { Timestamp = DateTime.UtcNow, TitanId = 20, TitanName = "Araji", PlayerId = 1, PowerAfter = 25000, LevelBefore = 1, LevelAfter = 2 }
		);
		await context.SaveChangesAsync();

		// Act
		var result = await _service.GetTitanUpgradeHistoryAsync(titanId: 10, upgradeType: "level") as Dictionary<string, object>;

		// Assert
		var levels = result!["levelUpgrades"] as IList<TitanLevelUpgrade>;
		levels.Should().HaveCount(1);
		levels![0].TitanName.Should().Be("Hyperion");
	}

	// ==========================================================================
	// Daily Activity Query Tests
	// ==========================================================================

	/// <summary>
	/// Verifies that GetDailyActivityAsync returns all activity categories.
	/// </summary>
	[Fact]
	public async Task GetDailyActivity_Should_Return_All_Categories() {
		// Arrange
		await using var context = await _contextFactory.CreateDbContextAsync();

		context.DailyQuestCompletions.Add(new DailyQuestCompletion {
			CompletedAt = DateTime.UtcNow, QuestDate = DateTime.Today,
			QuestId = "q1", QuestName = "Test Quest", PlayerId = 100
		});
		context.LoginRewards.Add(new LoginReward {
			ClaimedAt = DateTime.UtcNow, DayNumber = 1, StreakLength = 1, PlayerId = 100
		});
		await context.SaveChangesAsync();

		// Act
		var result = await _service.GetDailyActivityAsync();

		// Assert - use reflection to verify the anonymous type has all expected properties
		var resultType = result.GetType();
		resultType.GetProperty("dailyQuests").Should().NotBeNull();
		resultType.GetProperty("guildQuests").Should().NotBeNull();
		resultType.GetProperty("loginRewards").Should().NotBeNull();
		resultType.GetProperty("summaries").Should().NotBeNull();
	}

	/// <summary>
	/// Verifies that daily activity can be filtered by date.
	/// </summary>
	[Fact]
	public async Task GetDailyActivity_Should_Filter_By_Date() {
		// Arrange
		await using var context = await _contextFactory.CreateDbContextAsync();
		var today = DateTime.Today;
		var yesterday = today.AddDays(-1);

		context.DailyQuestCompletions.AddRange(
			new DailyQuestCompletion { CompletedAt = today.AddHours(10), QuestDate = today, QuestId = "q1", QuestName = "Today", PlayerId = 1 },
			new DailyQuestCompletion { CompletedAt = yesterday.AddHours(10), QuestDate = yesterday, QuestId = "q2", QuestName = "Yesterday", PlayerId = 1 }
		);
		await context.SaveChangesAsync();

		// Act - filter to today only
		var result = await _service.GetDailyActivityAsync(date: today);

		// Assert - use reflection to access anonymous type properties
		var resultType = result.GetType();
		var dailyQuests = resultType.GetProperty("dailyQuests")!.GetValue(result) as IList<DailyQuestCompletion>;

		dailyQuests.Should().NotBeNull();
		dailyQuests!.Should().HaveCount(1);
		dailyQuests[0].QuestName.Should().Be("Today");
	}

	// ==========================================================================
	// Inventory Query Tests
	// ==========================================================================

	/// <summary>
	/// Verifies that GetInventoryHistoryAsync returns both item usages and equipment changes.
	/// </summary>
	[Fact]
	public async Task GetInventoryHistory_Should_Return_UsagesAndChanges() {
		// Arrange
		await using var context = await _contextFactory.CreateDbContextAsync();

		context.InventoryItemUsages.Add(new InventoryItemUsage {
			Timestamp = DateTime.UtcNow, ItemId = "potion_1", ItemName = "XP Potion",
			Category = "potion", QuantityUsed = 5, PlayerId = 100
		});
		context.EquipmentChanges.Add(new EquipmentChange {
			Timestamp = DateTime.UtcNow, HeroId = 1, HeroName = "Galahad",
			SlotIndex = 0, ChangeType = "equipped", PlayerId = 100
		});
		await context.SaveChangesAsync();

		// Act
		var result = await _service.GetInventoryHistoryAsync();

		// Assert - use reflection to access anonymous type properties
		var resultType = result.GetType();
		var itemUsages = resultType.GetProperty("itemUsages")!.GetValue(result) as IList<InventoryItemUsage>;
		var equipmentChanges = resultType.GetProperty("equipmentChanges")!.GetValue(result) as IList<EquipmentChange>;

		itemUsages.Should().NotBeNull();
		itemUsages!.Should().HaveCount(1);
		equipmentChanges.Should().NotBeNull();
		equipmentChanges!.Should().HaveCount(1);
	}

	/// <summary>
	/// Verifies that inventory query can filter by category.
	/// </summary>
	[Fact]
	public async Task GetInventoryHistory_Should_Filter_By_Category() {
		// Arrange
		await using var context = await _contextFactory.CreateDbContextAsync();

		context.InventoryItemUsages.AddRange(
			new InventoryItemUsage { Timestamp = DateTime.UtcNow, ItemId = "potion_1", ItemName = "XP Potion", Category = "potion", QuantityUsed = 1, PlayerId = 1 },
			new InventoryItemUsage { Timestamp = DateTime.UtcNow, ItemId = "scroll_1", ItemName = "Awakening", Category = "scroll", QuantityUsed = 1, PlayerId = 1 }
		);
		await context.SaveChangesAsync();

		// Act - filter to potions only
		var result = await _service.GetInventoryHistoryAsync(category: "potion");

		// Assert - use reflection to access anonymous type properties
		var resultType = result.GetType();
		var itemUsages = resultType.GetProperty("itemUsages")!.GetValue(result) as IList<InventoryItemUsage>;

		itemUsages.Should().NotBeNull();
		itemUsages!.Should().HaveCount(1);
		itemUsages[0].ItemName.Should().Be("XP Potion");
	}

	// ==========================================================================
	// Import Deduplication Tests
	// ==========================================================================

	/// <summary>
	/// Verifies that importing duplicate hero upgrades does not create duplicate records.
	/// </summary>
	[Fact]
	public async Task Import_Should_Deduplicate_HeroUpgrades() {
		// Arrange - import data with hero level upgrades
		var timestamp = DateTime.UtcNow;
		var syncData = new BrowserSyncData {
			HeroLevelUpgrades = [
				new HeroLevelUpgrade {
					Timestamp = timestamp, HeroId = 1, HeroName = "Galahad",
					PlayerId = 100, PowerAfter = 50000, LevelBefore = 99, LevelAfter = 100
				}
			],
			Heroes = [],
			Titans = []
		};

		// Act - import same data twice
		await _service.ImportBrowserDataAsync(syncData);
		var counts = await _service.ImportBrowserDataAsync(syncData);

		// Assert - second import should not add duplicates
		counts.HeroLevelUpgrades.Should().Be(0);

		await using var context = await _contextFactory.CreateDbContextAsync();
		var total = await context.HeroLevelUpgrades.CountAsync();
		total.Should().Be(1);
	}

	/// <summary>
	/// Verifies that importing duplicate daily quest completions does not create duplicate records.
	/// </summary>
	[Fact]
	public async Task Import_Should_Deduplicate_DailyQuests() {
		// Arrange
		var completedAt = DateTime.UtcNow;
		var syncData = new BrowserSyncData {
			DailyQuestCompletions = [
				new DailyQuestCompletion {
					CompletedAt = completedAt, QuestDate = DateTime.Today,
					QuestId = "daily_arena_3", QuestName = "Win 3 Arena",
					PlayerId = 100, ActivityPoints = 20
				}
			],
			Heroes = [],
			Titans = []
		};

		// Act - import same data twice
		await _service.ImportBrowserDataAsync(syncData);
		var counts = await _service.ImportBrowserDataAsync(syncData);

		// Assert
		counts.DailyQuestCompletions.Should().Be(0);

		await using var context = await _contextFactory.CreateDbContextAsync();
		var total = await context.DailyQuestCompletions.CountAsync();
		total.Should().Be(1);
	}

	// ==========================================================================
	// Database Stats Tests
	// ==========================================================================

	/// <summary>
	/// Verifies that GetDatabaseStatsAsync returns accurate counts for new entity types.
	/// </summary>
	[Fact]
	public async Task GetDatabaseStats_Should_Include_New_Entity_Counts() {
		// Arrange - seed one record per new entity type
		await using var context = await _contextFactory.CreateDbContextAsync();

		context.HeroLevelUpgrades.Add(new HeroLevelUpgrade { Timestamp = DateTime.UtcNow, HeroId = 1, HeroName = "G", PlayerId = 1, PowerAfter = 1 });
		context.TitanLevelUpgrades.Add(new TitanLevelUpgrade { Timestamp = DateTime.UtcNow, TitanId = 1, TitanName = "H", PlayerId = 1, PowerAfter = 1 });
		context.DailyQuestCompletions.Add(new DailyQuestCompletion { CompletedAt = DateTime.UtcNow, QuestDate = DateTime.Today, QuestId = "q1", QuestName = "Q", PlayerId = 1 });
		context.InventoryItemUsages.Add(new InventoryItemUsage { Timestamp = DateTime.UtcNow, ItemId = "i1", ItemName = "I", Category = "potion", QuantityUsed = 1, PlayerId = 1 });

		await context.SaveChangesAsync();

		// Act
		var stats = await _service.GetDatabaseStatsAsync();

		// Assert
		stats.TotalHeroLevelUpgrades.Should().Be(1);
		stats.TotalTitanLevelUpgrades.Should().Be(1);
		stats.TotalDailyQuestCompletions.Should().Be(1);
		stats.TotalInventoryItemUsages.Should().Be(1);
	}

	/// <summary>
	/// Verifies that TotalRecords includes all entity counts.
	/// </summary>
	[Fact]
	public async Task GetDatabaseStats_TotalRecords_Should_Sum_All_Entities() {
		// Arrange - empty database
		var stats = await _service.GetDatabaseStatsAsync();

		// Assert - TotalRecords should be 0 for empty database
		stats.TotalRecords.Should().Be(0);
	}
}

/// <summary>
/// Simple IDbContextFactory implementation for testing with InMemory provider.
/// Creates new GameDatabaseContext instances with the same database name.
///
/// References:
/// - IDbContextFactory: https://learn.microsoft.com/en-us/ef/core/dbcontext-configuration/#using-a-dbcontext-factory
/// </summary>
internal class TestDbContextFactory : IDbContextFactory<GameDatabaseContext> {
	private readonly DbContextOptions<GameDatabaseContext> _options;

	public TestDbContextFactory(DbContextOptions<GameDatabaseContext> options) {
		_options = options;
	}

	/// <summary>
	/// Creates a new database context with the configured InMemory options.
	/// </summary>
	public GameDatabaseContext CreateDbContext() {
		return new GameDatabaseContext(_options);
	}
}
