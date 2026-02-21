using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Data;
using OrganizedJihad.Data.Models;

namespace OrganizedJihad.Data.Tests;

/// <summary>
/// Tests for daily activity entity models (DailyQuestCompletion, GuildQuestCompletion,
/// LoginReward, DailyActivitySummary).
/// Verifies CRUD operations, audit fields, and query patterns.
/// </summary>
public class DailyActivityTests : IDisposable {
	private readonly GameDatabaseContext _context;

	public DailyActivityTests() {
		var options = new DbContextOptionsBuilder<GameDatabaseContext>()
			.UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
			.Options;

		_context = new GameDatabaseContext(options);
	}

	public void Dispose() {
		_context.Dispose();
	}

	[Fact]
	public async Task Should_Add_DailyQuestCompletion() {
		// Arrange
		var quest = new DailyQuestCompletion {
			CompletedAt = DateTime.UtcNow,
			QuestDate = DateTime.Today,
			QuestId = "daily_arena_3",
			QuestName = "Win 3 Arena Battles",
			Category = "Arena",
			ActivityPoints = 20,
			RewardData = "{\"gold\": 5000}",
			PlayerId = 12345
		};

		// Act
		_context.DailyQuestCompletions.Add(quest);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.DailyQuestCompletions.FirstOrDefaultAsync(q => q.QuestId == "daily_arena_3");
		saved.Should().NotBeNull();
		saved!.QuestName.Should().Be("Win 3 Arena Battles");
		saved.ActivityPoints.Should().Be(20);
		saved.Category.Should().Be("Arena");
	}

	[Fact]
	public async Task Should_Add_GuildQuestCompletion() {
		// Arrange
		var quest = new GuildQuestCompletion {
			CompletedAt = DateTime.UtcNow,
			QuestDate = DateTime.Today,
			QuestId = "guild_donate_gold",
			QuestName = "Donate Gold to Guild",
			Difficulty = "hard",
			GuildActivityPoints = 50,
			RewardData = "{\"guild_coins\": 100}",
			PlayerId = 12345,
			GuildId = 1
		};

		// Act
		_context.GuildQuestCompletions.Add(quest);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.GuildQuestCompletions.FirstOrDefaultAsync(q => q.QuestId == "guild_donate_gold");
		saved.Should().NotBeNull();
		saved!.GuildActivityPoints.Should().Be(50);
		saved.Difficulty.Should().Be("hard");
		saved.GuildId.Should().Be(1);
	}

	[Fact]
	public async Task Should_Add_LoginReward() {
		// Arrange
		var reward = new LoginReward {
			ClaimedAt = DateTime.UtcNow,
			DayNumber = 7,
			StreakLength = 7,
			IsVipBonus = true,
			RewardData = "{\"emeralds\": 100, \"energy\": 50}",
			PlayerId = 12345
		};

		// Act
		_context.LoginRewards.Add(reward);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.LoginRewards.FirstOrDefaultAsync(r => r.DayNumber == 7);
		saved.Should().NotBeNull();
		saved!.StreakLength.Should().Be(7);
		saved.IsVipBonus.Should().BeTrue();
	}

	[Fact]
	public async Task Should_Add_DailyActivitySummary() {
		// Arrange
		var summary = new DailyActivitySummary {
			SummaryDate = DateTime.Today,
			TotalActivityPoints = 100,
			DailyQuestsCompleted = 8,
			GuildQuestsCompleted = 3,
			ArenaBattlesFought = 5,
			GrandArenaBattlesFought = 3,
			TowerFloorsCleared = 50,
			CampaignMissionsCompleted = 10,
			OutlandBossesFought = 3,
			GoldEarned = 500000,
			GoldSpent = 200000,
			EmeraldsEarned = 150,
			EmeraldsSpent = 50,
			DailyChestClaimed = true,
			PlayerId = 12345
		};

		// Act
		_context.DailyActivitySummaries.Add(summary);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.DailyActivitySummaries
			.FirstOrDefaultAsync(s => s.PlayerId == 12345 && s.SummaryDate == DateTime.Today);
		saved.Should().NotBeNull();
		saved!.DailyQuestsCompleted.Should().Be(8);
		saved.GoldEarned.Should().Be(500000);
		saved.DailyChestClaimed.Should().BeTrue();
	}

	[Fact]
	public async Task Should_Query_DailyQuests_By_Date() {
		// Arrange
		var today = DateTime.Today;
		var yesterday = today.AddDays(-1);

		var quests = new List<DailyQuestCompletion> {
			new() { CompletedAt = today.AddHours(10), QuestDate = today, QuestId = "q1", QuestName = "Quest 1", PlayerId = 1 },
			new() { CompletedAt = today.AddHours(12), QuestDate = today, QuestId = "q2", QuestName = "Quest 2", PlayerId = 1 },
			new() { CompletedAt = yesterday.AddHours(10), QuestDate = yesterday, QuestId = "q1", QuestName = "Quest 1", PlayerId = 1 }
		};

		_context.DailyQuestCompletions.AddRange(quests);
		await _context.SaveChangesAsync();

		// Act
		var todayQuests = await _context.DailyQuestCompletions
			.Where(q => q.QuestDate == today)
			.ToListAsync();

		// Assert
		todayQuests.Should().HaveCount(2);
	}

	[Fact]
	public async Task Should_Track_Audit_Fields_On_DailyQuest() {
		// Arrange
		var quest = new DailyQuestCompletion {
			CompletedAt = DateTime.UtcNow,
			QuestDate = DateTime.Today,
			QuestId = "test_audit",
			QuestName = "Audit Test",
			PlayerId = 12345
		};

		// Act
		_context.DailyQuestCompletions.Add(quest);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.DailyQuestCompletions.FindAsync(quest.Id);
		saved.Should().NotBeNull();
		saved!.DateCreated.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
	}

	[Fact]
	public async Task Should_Query_LoginRewards_By_Player() {
		// Arrange
		var rewards = new List<LoginReward> {
			new() { ClaimedAt = DateTime.UtcNow.AddDays(-2), DayNumber = 1, StreakLength = 1, PlayerId = 100 },
			new() { ClaimedAt = DateTime.UtcNow.AddDays(-1), DayNumber = 2, StreakLength = 2, PlayerId = 100 },
			new() { ClaimedAt = DateTime.UtcNow, DayNumber = 3, StreakLength = 3, PlayerId = 100 },
			new() { ClaimedAt = DateTime.UtcNow, DayNumber = 1, StreakLength = 1, PlayerId = 200 }
		};

		_context.LoginRewards.AddRange(rewards);
		await _context.SaveChangesAsync();

		// Act
		var player100Rewards = await _context.LoginRewards
			.Where(r => r.PlayerId == 100)
			.OrderBy(r => r.DayNumber)
			.ToListAsync();

		// Assert
		player100Rewards.Should().HaveCount(3);
		player100Rewards.Last().StreakLength.Should().Be(3);
	}
}
