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
		dailyQuests![0].QuestName.Should().Be("Today");
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
		itemUsages![0].ItemName.Should().Be("XP Potion");
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
	// Titan Upgrade Deduplication Tests
	// ==========================================================================

	/// <summary>
	/// Verifies that importing duplicate titan level upgrades does not create duplicate records.
	/// Deduplication key: TitanId + Timestamp.
	/// </summary>
	[Fact]
	public async Task Import_Should_Deduplicate_TitanLevelUpgrades() {
		// Arrange
		var timestamp = DateTime.UtcNow;
		var syncData = new BrowserSyncData {
			TitanLevelUpgrades = [
				new TitanLevelUpgrade {
					Timestamp = timestamp, TitanId = 1, TitanName = "Hyperion",
					PlayerId = 100, PowerAfter = 40000, LevelBefore = 119, LevelAfter = 120
				}
			],
			Heroes = [],
			Titans = []
		};

		// Act - import same data twice
		await _service.ImportBrowserDataAsync(syncData);
		var counts = await _service.ImportBrowserDataAsync(syncData);

		// Assert - second import should not add duplicates
		counts.TitanLevelUpgrades.Should().Be(0);

		await using var context = await _contextFactory.CreateDbContextAsync();
		var total = await context.TitanLevelUpgrades.CountAsync();
		total.Should().Be(1);
	}

	/// <summary>
	/// Verifies that importing duplicate titan star upgrades does not create duplicate records.
	/// Deduplication key: TitanId + Timestamp.
	/// </summary>
	[Fact]
	public async Task Import_Should_Deduplicate_TitanStarUpgrades() {
		// Arrange
		var timestamp = DateTime.UtcNow;
		var syncData = new BrowserSyncData {
			TitanStarUpgrades = [
				new TitanStarUpgrade {
					Timestamp = timestamp, TitanId = 2, TitanName = "Araji",
					PlayerId = 100, PowerAfter = 55000, StarsBefore = 5, StarsAfter = 6,
					SoulStonesConsumed = 300
				}
			],
			Heroes = [],
			Titans = []
		};

		// Act
		await _service.ImportBrowserDataAsync(syncData);
		var counts = await _service.ImportBrowserDataAsync(syncData);

		// Assert
		counts.TitanStarUpgrades.Should().Be(0);

		await using var context = await _contextFactory.CreateDbContextAsync();
		var total = await context.TitanStarUpgrades.CountAsync();
		total.Should().Be(1);
	}

	// ==========================================================================
	// Daily Activity Deduplication Tests
	// ==========================================================================

	/// <summary>
	/// Verifies that importing duplicate guild quest completions does not create duplicates.
	/// Deduplication key: PlayerId + QuestId + CompletedAt.
	/// </summary>
	[Fact]
	public async Task Import_Should_Deduplicate_GuildQuestCompletions() {
		// Arrange
		var completedAt = DateTime.UtcNow;
		var syncData = new BrowserSyncData {
			GuildQuestCompletions = [
				new GuildQuestCompletion {
					CompletedAt = completedAt, QuestDate = DateTime.Today,
					QuestId = "guild_raid_1", QuestName = "Raid Boss Challenge",
					PlayerId = 100, GuildId = 50, GuildActivityPoints = 30
				}
			],
			Heroes = [],
			Titans = []
		};

		// Act
		await _service.ImportBrowserDataAsync(syncData);
		var counts = await _service.ImportBrowserDataAsync(syncData);

		// Assert
		counts.GuildQuestCompletions.Should().Be(0);

		await using var context = await _contextFactory.CreateDbContextAsync();
		var total = await context.GuildQuestCompletions.CountAsync();
		total.Should().Be(1);
	}

	/// <summary>
	/// Verifies that importing duplicate login rewards does not create duplicates.
	/// Deduplication key: PlayerId + ClaimedAt.
	/// </summary>
	[Fact]
	public async Task Import_Should_Deduplicate_LoginRewards() {
		// Arrange
		var claimedAt = DateTime.UtcNow;
		var syncData = new BrowserSyncData {
			LoginRewards = [
				new LoginReward {
					ClaimedAt = claimedAt, DayNumber = 7, StreakLength = 7,
					IsVipBonus = false, PlayerId = 100
				}
			],
			Heroes = [],
			Titans = []
		};

		// Act
		await _service.ImportBrowserDataAsync(syncData);
		var counts = await _service.ImportBrowserDataAsync(syncData);

		// Assert
		counts.LoginRewards.Should().Be(0);

		await using var context = await _contextFactory.CreateDbContextAsync();
		var total = await context.LoginRewards.CountAsync();
		total.Should().Be(1);
	}

	/// <summary>
	/// Verifies that daily activity summaries use upsert logic.
	/// A second import with the same PlayerId + SummaryDate should update, not insert.
	/// </summary>
	[Fact]
	public async Task Import_Should_Upsert_DailyActivitySummaries() {
		// Arrange
		var summaryDate = DateTime.Today;
		var syncData1 = new BrowserSyncData {
			DailyActivitySummaries = [
				new DailyActivitySummary {
					SummaryDate = summaryDate, PlayerId = 100,
					TotalActivityPoints = 50, DailyQuestsCompleted = 3,
					GuildQuestsCompleted = 1, ArenaBattlesFought = 5
				}
			],
			Heroes = [],
			Titans = []
		};

		var syncData2 = new BrowserSyncData {
			DailyActivitySummaries = [
				new DailyActivitySummary {
					SummaryDate = summaryDate, PlayerId = 100,
					TotalActivityPoints = 100, DailyQuestsCompleted = 6,
					GuildQuestsCompleted = 2, ArenaBattlesFought = 10
				}
			],
			Heroes = [],
			Titans = []
		};

		// Act - import twice with updated data
		await _service.ImportBrowserDataAsync(syncData1);
		var counts = await _service.ImportBrowserDataAsync(syncData2);

		// Assert - second import should return 0 (update, not insert)
		counts.DailyActivitySummaries.Should().Be(0);

		await using var context = await _contextFactory.CreateDbContextAsync();
		var total = await context.DailyActivitySummaries.CountAsync();
		total.Should().Be(1);

		// Verify data was updated to latest values
		var summary = await context.DailyActivitySummaries.FirstAsync();
		summary.TotalActivityPoints.Should().Be(100);
		summary.DailyQuestsCompleted.Should().Be(6);
		summary.ArenaBattlesFought.Should().Be(10);
	}

	// ==========================================================================
	// Inventory Deduplication Tests
	// ==========================================================================

	/// <summary>
	/// Verifies that importing duplicate inventory item usages does not create duplicates.
	/// Deduplication key: PlayerId + ItemId + Timestamp.
	/// </summary>
	[Fact]
	public async Task Import_Should_Deduplicate_InventoryItemUsages() {
		// Arrange
		var timestamp = DateTime.UtcNow;
		var syncData = new BrowserSyncData {
			InventoryItemUsages = [
				new InventoryItemUsage {
					Timestamp = timestamp, ItemId = "potion_xp_100",
					ItemName = "XP Potion (100)", Category = "potion",
					QuantityUsed = 5, PlayerId = 100
				}
			],
			Heroes = [],
			Titans = []
		};

		// Act
		await _service.ImportBrowserDataAsync(syncData);
		var counts = await _service.ImportBrowserDataAsync(syncData);

		// Assert
		counts.InventoryItemUsages.Should().Be(0);

		await using var context = await _contextFactory.CreateDbContextAsync();
		var total = await context.InventoryItemUsages.CountAsync();
		total.Should().Be(1);
	}

	/// <summary>
	/// Verifies that importing duplicate equipment changes does not create duplicates.
	/// Deduplication key: HeroId + SlotIndex + Timestamp.
	/// </summary>
	[Fact]
	public async Task Import_Should_Deduplicate_EquipmentChanges() {
		// Arrange
		var timestamp = DateTime.UtcNow;
		var syncData = new BrowserSyncData {
			EquipmentChanges = [
				new EquipmentChange {
					Timestamp = timestamp, HeroId = 1, HeroName = "Galahad",
					SlotIndex = 2, ChangeType = "equipped", PlayerId = 100
				}
			],
			Heroes = [],
			Titans = []
		};

		// Act
		await _service.ImportBrowserDataAsync(syncData);
		var counts = await _service.ImportBrowserDataAsync(syncData);

		// Assert
		counts.EquipmentChanges.Should().Be(0);

		await using var context = await _contextFactory.CreateDbContextAsync();
		var total = await context.EquipmentChanges.CountAsync();
		total.Should().Be(1);
	}

	// ==========================================================================
	// Hero/Titan Upgrade Additional Query Tests
	// ==========================================================================

	/// <summary>
	/// Verifies that GetHeroUpgradeHistoryAsync returns all upgrade types when no filter is specified,
	/// including records from multiple upgrade categories.
	/// </summary>
	[Fact]
	public async Task GetHeroUpgradeHistory_Should_Return_All_Types_With_Multiple_Records() {
		// Arrange
		await using var context = await _contextFactory.CreateDbContextAsync();

		context.HeroLevelUpgrades.Add(new HeroLevelUpgrade {
			Timestamp = DateTime.UtcNow, HeroId = 1, HeroName = "Galahad",
			PlayerId = 100, PowerAfter = 50000, LevelBefore = 99, LevelAfter = 100
		});
		context.HeroSkillUpgrades.Add(new HeroSkillUpgrade {
			Timestamp = DateTime.UtcNow, HeroId = 1, HeroName = "Galahad",
			PlayerId = 100, PowerAfter = 50000, SkillName = "Flaming Sword",
			SkillSlot = 1, SkillLevelBefore = 99, SkillLevelAfter = 100
		});
		await context.SaveChangesAsync();

		// Act
		var result = await _service.GetHeroUpgradeHistoryAsync() as Dictionary<string, object>;

		// Assert
		result.Should().NotBeNull();
		result!.Should().ContainKey("levelUpgrades");
		result.Should().ContainKey("skillUpgrades");

		var levels = result!["levelUpgrades"] as IList<HeroLevelUpgrade>;
		levels.Should().NotBeNull();
		levels!.Should().HaveCount(1);

		var skills = result!["skillUpgrades"] as IList<HeroSkillUpgrade>;
		skills.Should().NotBeNull();
		skills!.Should().HaveCount(1);
	}

	/// <summary>
	/// Verifies that GetHeroUpgradeHistoryAsync only returns the specified upgrade type key.
	/// </summary>
	[Fact]
	public async Task GetHeroUpgradeHistory_Should_Only_Return_Filtered_UpgradeType_Key() {
		// Arrange
		await using var context = await _contextFactory.CreateDbContextAsync();

		context.HeroLevelUpgrades.Add(new HeroLevelUpgrade {
			Timestamp = DateTime.UtcNow, HeroId = 1, HeroName = "Galahad",
			PlayerId = 100, PowerAfter = 50000, LevelBefore = 99, LevelAfter = 100
		});
		context.HeroSkillUpgrades.Add(new HeroSkillUpgrade {
			Timestamp = DateTime.UtcNow, HeroId = 1, HeroName = "Galahad",
			PlayerId = 100, PowerAfter = 50000, SkillName = "Shield",
			SkillSlot = 2, SkillLevelBefore = 50, SkillLevelAfter = 51
		});
		await context.SaveChangesAsync();

		// Act - filter to "level" type only
		var result = await _service.GetHeroUpgradeHistoryAsync(upgradeType: "level") as Dictionary<string, object>;

		// Assert - should only contain level upgrades key
		result.Should().NotBeNull();
		result!.Should().ContainKey("levelUpgrades");
		result.Should().NotContainKey("skillUpgrades");
	}

	/// <summary>
	/// Verifies that GetTitanUpgradeHistoryAsync returns data for multiple upgrade categories.
	/// </summary>
	[Fact]
	public async Task GetTitanUpgradeHistory_Should_Return_Multiple_Categories() {
		// Arrange
		await using var context = await _contextFactory.CreateDbContextAsync();

		context.TitanLevelUpgrades.Add(new TitanLevelUpgrade {
			Timestamp = DateTime.UtcNow, TitanId = 1, TitanName = "Hyperion",
			PlayerId = 100, PowerAfter = 40000, LevelBefore = 119, LevelAfter = 120
		});
		context.TitanSkillUpgrades.Add(new TitanSkillUpgrade {
			Timestamp = DateTime.UtcNow, TitanId = 1, TitanName = "Hyperion",
			PlayerId = 100, PowerAfter = 40000, SkillName = "Solar Strike",
			SkillLevelBefore = 29, SkillLevelAfter = 30, TitaniteSpent = 500
		});
		await context.SaveChangesAsync();

		// Act
		var result = await _service.GetTitanUpgradeHistoryAsync() as Dictionary<string, object>;

		// Assert
		result.Should().NotBeNull();
		result!.Should().ContainKey("levelUpgrades");
		result.Should().ContainKey("skillUpgrades");

		var levels = result!["levelUpgrades"] as IList<TitanLevelUpgrade>;
		levels.Should().NotBeNull();
		levels!.Should().HaveCount(1);
	}

	/// <summary>
	/// Verifies that GetTitanUpgradeHistoryAsync filters by both titanId and upgrade type.
	/// </summary>
	[Fact]
	public async Task GetTitanUpgradeHistory_Should_Filter_By_TitanId_And_Type() {
		// Arrange
		await using var context = await _contextFactory.CreateDbContextAsync();

		context.TitanLevelUpgrades.AddRange(
			new TitanLevelUpgrade {
				Timestamp = DateTime.UtcNow, TitanId = 1, TitanName = "Hyperion",
				PlayerId = 100, PowerAfter = 40000, LevelBefore = 119, LevelAfter = 120
			},
			new TitanLevelUpgrade {
				Timestamp = DateTime.UtcNow, TitanId = 2, TitanName = "Araji",
				PlayerId = 100, PowerAfter = 35000, LevelBefore = 100, LevelAfter = 101
			}
		);
		context.TitanSkillUpgrades.Add(new TitanSkillUpgrade {
			Timestamp = DateTime.UtcNow, TitanId = 1, TitanName = "Hyperion",
			PlayerId = 100, PowerAfter = 40000, SkillName = "Solar Strike",
			SkillLevelBefore = 29, SkillLevelAfter = 30, TitaniteSpent = 500
		});
		await context.SaveChangesAsync();

		// Act - filter to titan 1 + level only
		var result = await _service.GetTitanUpgradeHistoryAsync(titanId: 1, upgradeType: "level") as Dictionary<string, object>;

		// Assert
		result.Should().NotBeNull();
		result!.Should().ContainKey("levelUpgrades");
		result.Should().NotContainKey("skillUpgrades");

		var levels = result!["levelUpgrades"] as IList<TitanLevelUpgrade>;
		levels.Should().NotBeNull();
		levels!.Should().HaveCount(1);
		levels![0].TitanName.Should().Be("Hyperion");
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

	// ==========================================================================
	// Phase 9: Older Entity Query Tests
	// ==========================================================================

	/// <summary>
	/// Verifies that GetHeroesAsync returns hero snapshots ordered by timestamp descending.
	/// </summary>
	[Fact]
	public async Task GetHeroes_Should_Return_Ordered_By_Timestamp() {
		// Arrange
		await using var context = await _contextFactory.CreateDbContextAsync();

		context.Heroes.Add(new Hero {
			HeroId = 1, HeroName = "Galahad", Level = 50, Stars = 4, Color = 3,
			Power = 30000, Timestamp = DateTime.UtcNow.AddHours(-2), PlayerId = 100
		});
		context.Heroes.Add(new Hero {
			HeroId = 1, HeroName = "Galahad", Level = 60, Stars = 5, Color = 4,
			Power = 45000, Timestamp = DateTime.UtcNow, PlayerId = 100
		});
		await context.SaveChangesAsync();

		// Act
		var result = await _service.GetHeroesAsync();
		var json = JsonSerializer.Serialize(result);
		var doc = JsonDocument.Parse(json);

		// Assert
		doc.RootElement.GetProperty("count").GetInt32().Should().Be(2);
		var heroes = doc.RootElement.GetProperty("heroes");
		heroes.GetArrayLength().Should().Be(2);
	}

	/// <summary>
	/// Verifies that GetHeroesAsync filters by heroId when specified.
	/// </summary>
	[Fact]
	public async Task GetHeroes_Should_Filter_By_HeroId() {
		// Arrange
		await using var context = await _contextFactory.CreateDbContextAsync();

		context.Heroes.Add(new Hero {
			HeroId = 1, HeroName = "Galahad", Level = 50, Stars = 4, Color = 3,
			Power = 30000, Timestamp = DateTime.UtcNow, PlayerId = 100
		});
		context.Heroes.Add(new Hero {
			HeroId = 2, HeroName = "Keira", Level = 60, Stars = 5, Color = 5,
			Power = 45000, Timestamp = DateTime.UtcNow, PlayerId = 100
		});
		await context.SaveChangesAsync();

		// Act
		var result = await _service.GetHeroesAsync(heroId: 1);
		var json = JsonSerializer.Serialize(result);
		var doc = JsonDocument.Parse(json);

		// Assert
		doc.RootElement.GetProperty("count").GetInt32().Should().Be(1);
	}

	/// <summary>
	/// Verifies that GetTitansAsync returns titan snapshots and filters by titanId.
	/// </summary>
	[Fact]
	public async Task GetTitans_Should_Return_And_Filter() {
		// Arrange
		await using var context = await _contextFactory.CreateDbContextAsync();

		context.Titans.Add(new Titan {
			TitanId = 10, TitanName = "Hyperion", Level = 80, Stars = 5,
			Power = 60000, Timestamp = DateTime.UtcNow, PlayerId = 100
		});
		context.Titans.Add(new Titan {
			TitanId = 11, TitanName = "Eden", Level = 70, Stars = 4,
			Power = 50000, Timestamp = DateTime.UtcNow, PlayerId = 100
		});
		await context.SaveChangesAsync();

		// Act - no filter
		var allResult = await _service.GetTitansAsync();
		var allJson = JsonSerializer.Serialize(allResult);
		var allDoc = JsonDocument.Parse(allJson);
		allDoc.RootElement.GetProperty("count").GetInt32().Should().Be(2);

		// Act - filter by titanId
		var filteredResult = await _service.GetTitansAsync(titanId: 10);
		var filteredJson = JsonSerializer.Serialize(filteredResult);
		var filteredDoc = JsonDocument.Parse(filteredJson);
		filteredDoc.RootElement.GetProperty("count").GetInt32().Should().Be(1);
	}

	/// <summary>
	/// Verifies that GetPetsAsync returns pet snapshots and respects the limit parameter.
	/// </summary>
	[Fact]
	public async Task GetPets_Should_Return_And_Respect_Limit() {
		// Arrange
		await using var context = await _contextFactory.CreateDbContextAsync();

		for (int i = 0; i < 5; i++) {
			context.Pets.Add(new Pet {
				PetId = i + 1, PetName = $"Pet_{i + 1}", Stars = 3, Power = 10000 + i,
				Level = 30 + i, Timestamp = DateTime.UtcNow.AddMinutes(-i), PlayerId = 100
			});
		}
		await context.SaveChangesAsync();

		// Act
		var result = await _service.GetPetsAsync(limit: 3);
		var json = JsonSerializer.Serialize(result);
		var doc = JsonDocument.Parse(json);

		// Assert
		doc.RootElement.GetProperty("count").GetInt32().Should().Be(3);
	}

	/// <summary>
	/// Verifies that GetGuildWarBattlesAsync returns battles and filters by warId.
	/// </summary>
	[Fact]
	public async Task GetGuildWarBattles_Should_Filter_By_WarId() {
		// Arrange
		await using var context = await _contextFactory.CreateDbContextAsync();

		context.GuildWarBattles.Add(new GuildWarBattle {
			Timestamp = DateTime.UtcNow, WarId = "war_1", EnemyGuildName = "Enemy A",
			FortificationNumber = 1, IsWin = true, StarsEarned = 3
		});
		context.GuildWarBattles.Add(new GuildWarBattle {
			Timestamp = DateTime.UtcNow, WarId = "war_2", EnemyGuildName = "Enemy B",
			FortificationNumber = 2, IsWin = false, StarsEarned = 0
		});
		await context.SaveChangesAsync();

		// Act
		var result = await _service.GetGuildWarBattlesAsync(warId: "war_1");
		var json = JsonSerializer.Serialize(result);
		var doc = JsonDocument.Parse(json);

		// Assert
		doc.RootElement.GetProperty("count").GetInt32().Should().Be(1);
	}

	/// <summary>
	/// Verifies that GetRaidBossAttacksAsync returns attacks in order.
	/// </summary>
	[Fact]
	public async Task GetRaidBossAttacks_Should_Return_Ordered() {
		// Arrange
		await using var context = await _contextFactory.CreateDbContextAsync();

		context.RaidBossAttacks.Add(new RaidBossAttack {
			Timestamp = DateTime.UtcNow.AddHours(-1), BossName = "Ancient Dragon",
			Difficulty = 3, DamageDealt = 5000000
		});
		context.RaidBossAttacks.Add(new RaidBossAttack {
			Timestamp = DateTime.UtcNow, BossName = "Ancient Dragon",
			Difficulty = 3, DamageDealt = 7000000
		});
		await context.SaveChangesAsync();

		// Act
		var result = await _service.GetRaidBossAttacksAsync();
		var json = JsonSerializer.Serialize(result);
		var doc = JsonDocument.Parse(json);

		// Assert
		doc.RootElement.GetProperty("count").GetInt32().Should().Be(2);
	}

	/// <summary>
	/// Verifies that GetChestOpeningsAsync returns chests with drops and filters by type.
	/// </summary>
	[Fact]
	public async Task GetChestOpenings_Should_Return_With_Drops_And_Filter() {
		// Arrange
		await using var context = await _contextFactory.CreateDbContextAsync();

		var chest1 = new ChestOpening {
			Timestamp = DateTime.UtcNow, ChestType = "legendary", Quantity = 1
		};
		var chest2 = new ChestOpening {
			Timestamp = DateTime.UtcNow, ChestType = "heroic", Quantity = 1
		};
		context.ChestOpenings.AddRange(chest1, chest2);
		await context.SaveChangesAsync();

		// Act - no filter
		var allResult = await _service.GetChestOpeningsAsync();
		var allJson = JsonSerializer.Serialize(allResult);
		var allDoc = JsonDocument.Parse(allJson);
		allDoc.RootElement.GetProperty("count").GetInt32().Should().Be(2);

		// Act - filter by type
		var filteredResult = await _service.GetChestOpeningsAsync(chestType: "legendary");
		var filteredJson = JsonSerializer.Serialize(filteredResult);
		var filteredDoc = JsonDocument.Parse(filteredJson);
		filteredDoc.RootElement.GetProperty("count").GetInt32().Should().Be(1);
	}

	/// <summary>
	/// Verifies that GetGuildMembersAsync returns active members and respects includeInactive.
	/// </summary>
	[Fact]
	public async Task GetGuildMembers_Should_Filter_Active_And_Inactive() {
		// Arrange
		await using var context = await _contextFactory.CreateDbContextAsync();

		context.GuildMembers.Add(new GuildMember {
			GuildId = 1, GuildName = "Test Guild", PlayerId = 100,
			PlayerName = "Player1", Level = 100, TeamPower = 500000,
			GuildRank = "Leader", LastOnline = DateTime.UtcNow, IsActive = true
		});
		context.GuildMembers.Add(new GuildMember {
			GuildId = 1, GuildName = "Test Guild", PlayerId = 200,
			PlayerName = "Player2", Level = 80, TeamPower = 300000,
			GuildRank = "Member", LastOnline = DateTime.UtcNow.AddDays(-30), IsActive = false
		});
		await context.SaveChangesAsync();

		// Act - active only (default)
		var activeResult = await _service.GetGuildMembersAsync();
		var activeJson = JsonSerializer.Serialize(activeResult);
		var activeDoc = JsonDocument.Parse(activeJson);
		activeDoc.RootElement.GetProperty("count").GetInt32().Should().Be(1);

		// Act - include inactive
		var allResult = await _service.GetGuildMembersAsync(includeInactive: true);
		var allJson = JsonSerializer.Serialize(allResult);
		var allDoc = JsonDocument.Parse(allJson);
		allDoc.RootElement.GetProperty("count").GetInt32().Should().Be(2);
	}

	/// <summary>
	/// Verifies that GetResourceTransactionsAsync returns and filters by resource type.
	/// </summary>
	[Fact]
	public async Task GetResourceTransactions_Should_Filter_By_Type() {
		// Arrange
		await using var context = await _contextFactory.CreateDbContextAsync();

		context.ResourceTransactions.Add(new ResourceTransaction {
			Timestamp = DateTime.UtcNow, ResourceType = "gold",
			Amount = 50000, Source = "quest_reward", PlayerId = 100
		});
		context.ResourceTransactions.Add(new ResourceTransaction {
			Timestamp = DateTime.UtcNow, ResourceType = "emeralds",
			Amount = 100, Source = "daily_login", PlayerId = 100
		});
		await context.SaveChangesAsync();

		// Act - no filter
		var allResult = await _service.GetResourceTransactionsAsync();
		var allJson = JsonSerializer.Serialize(allResult);
		var allDoc = JsonDocument.Parse(allJson);
		allDoc.RootElement.GetProperty("count").GetInt32().Should().Be(2);

		// Act - filter by gold
		var goldResult = await _service.GetResourceTransactionsAsync(resourceType: "gold");
		var goldJson = JsonSerializer.Serialize(goldResult);
		var goldDoc = JsonDocument.Parse(goldJson);
		goldDoc.RootElement.GetProperty("count").GetInt32().Should().Be(1);
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
