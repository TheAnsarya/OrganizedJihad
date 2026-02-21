using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Data;
using OrganizedJihad.Data.Models;

namespace OrganizedJihad.Data.Tests;

/// <summary>
/// Tests for titan upgrade entity models (TitanLevelUpgrade, TitanStarUpgrade, etc.)
/// Verifies CRUD operations, audit fields, and DbContext configuration.
/// </summary>
public class TitanUpgradeTests : IDisposable {
	private readonly GameDatabaseContext _context;

	public TitanUpgradeTests() {
		var options = new DbContextOptionsBuilder<GameDatabaseContext>()
			.UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
			.Options;

		_context = new GameDatabaseContext(options);
	}

	public void Dispose() {
		_context.Dispose();
	}

	[Fact]
	public async Task Should_Add_TitanLevelUpgrade() {
		// Arrange
		var upgrade = new TitanLevelUpgrade {
			Timestamp = DateTime.UtcNow,
			TitanId = 1,
			TitanName = "Hyperion",
			PlayerId = 12345,
			PowerAfter = 30000,
			LevelBefore = 50,
			LevelAfter = 51,
			PotionsSpent = 5,
			GoldSpent = 10000
		};

		// Act
		_context.TitanLevelUpgrades.Add(upgrade);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.TitanLevelUpgrades.FirstOrDefaultAsync(u => u.TitanId == 1);
		saved.Should().NotBeNull();
		saved!.TitanName.Should().Be("Hyperion");
		saved.LevelBefore.Should().Be(50);
		saved.PotionsSpent.Should().Be(5);
	}

	[Fact]
	public async Task Should_Add_TitanStarUpgrade() {
		// Arrange
		var upgrade = new TitanStarUpgrade {
			Timestamp = DateTime.UtcNow,
			TitanId = 2,
			TitanName = "Araji",
			PlayerId = 12345,
			PowerAfter = 40000,
			StarsBefore = 4,
			StarsAfter = 5,
			SoulStonesConsumed = 200
		};

		// Act
		_context.TitanStarUpgrades.Add(upgrade);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.TitanStarUpgrades.FirstOrDefaultAsync(u => u.TitanId == 2);
		saved.Should().NotBeNull();
		saved!.StarsBefore.Should().Be(4);
		saved.StarsAfter.Should().Be(5);
		saved.SoulStonesConsumed.Should().Be(200);
	}

	[Fact]
	public async Task Should_Add_TitanSkillUpgrade() {
		// Arrange
		var upgrade = new TitanSkillUpgrade {
			Timestamp = DateTime.UtcNow,
			TitanId = 1,
			TitanName = "Hyperion",
			PlayerId = 12345,
			PowerAfter = 31000,
			SkillName = "Solar Flare",
			SkillLevelBefore = 10,
			SkillLevelAfter = 11,
			TitaniteSpent = 150
		};

		// Act
		_context.TitanSkillUpgrades.Add(upgrade);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.TitanSkillUpgrades.FirstOrDefaultAsync(u => u.SkillName == "Solar Flare");
		saved.Should().NotBeNull();
		saved!.TitaniteSpent.Should().Be(150);
		saved.SkillLevelBefore.Should().Be(10);
	}

	[Fact]
	public async Task Should_Add_TitanArtifactUpgrade() {
		// Arrange
		var upgrade = new TitanArtifactUpgrade {
			Timestamp = DateTime.UtcNow,
			TitanId = 1,
			TitanName = "Hyperion",
			PlayerId = 12345,
			PowerAfter = 32000,
			ArtifactType = "Seal",
			ArtifactName = "Seal of the Sun",
			LevelBefore = 3,
			LevelAfter = 4,
			ResourcesConsumed = "{\"titan_artifact_coins\": 1000}"
		};

		// Act
		_context.TitanArtifactUpgrades.Add(upgrade);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.TitanArtifactUpgrades.FirstOrDefaultAsync(u => u.ArtifactType == "Seal");
		saved.Should().NotBeNull();
		saved!.ArtifactName.Should().Be("Seal of the Sun");
		saved.LevelBefore.Should().Be(3);
	}

	[Fact]
	public async Task Should_Add_TitanSkinUpgrade() {
		// Arrange
		var upgrade = new TitanSkinUpgrade {
			Timestamp = DateTime.UtcNow,
			TitanId = 1,
			TitanName = "Hyperion",
			PlayerId = 12345,
			PowerAfter = 33000,
			SkinName = "Solar Knight",
			SkinId = "skin_solar_hyperion",
			IsNewUnlock = false,
			LevelBefore = 5,
			LevelAfter = 6,
			SkinStonesConsumed = 25
		};

		// Act
		_context.TitanSkinUpgrades.Add(upgrade);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.TitanSkinUpgrades.FirstOrDefaultAsync(u => u.SkinName == "Solar Knight");
		saved.Should().NotBeNull();
		saved!.IsNewUnlock.Should().BeFalse();
		saved.SkinStonesConsumed.Should().Be(25);
	}

	[Fact]
	public async Task Should_Track_Audit_Fields_On_TitanUpgrade() {
		// Arrange
		var upgrade = new TitanLevelUpgrade {
			Timestamp = DateTime.UtcNow,
			TitanId = 1,
			TitanName = "Hyperion",
			PlayerId = 12345,
			PowerAfter = 30000,
			LevelBefore = 1,
			LevelAfter = 2,
			PotionsSpent = 1,
			GoldSpent = 100
		};

		// Act
		_context.TitanLevelUpgrades.Add(upgrade);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.TitanLevelUpgrades.FindAsync(upgrade.Id);
		saved.Should().NotBeNull();
		saved!.DateCreated.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
	}

	[Fact]
	public async Task Should_Query_Titan_Upgrades_By_Player() {
		// Arrange
		var upgrades = new List<TitanLevelUpgrade> {
			new() { Timestamp = DateTime.UtcNow.AddHours(-2), TitanId = 1, TitanName = "Hyperion", PlayerId = 100, PowerAfter = 30000, LevelBefore = 1, LevelAfter = 2 },
			new() { Timestamp = DateTime.UtcNow.AddHours(-1), TitanId = 2, TitanName = "Araji", PlayerId = 100, PowerAfter = 25000, LevelBefore = 1, LevelAfter = 2 },
			new() { Timestamp = DateTime.UtcNow, TitanId = 1, TitanName = "Hyperion", PlayerId = 200, PowerAfter = 35000, LevelBefore = 10, LevelAfter = 11 }
		};

		_context.TitanLevelUpgrades.AddRange(upgrades);
		await _context.SaveChangesAsync();

		// Act
		var player100Upgrades = await _context.TitanLevelUpgrades
			.Where(u => u.PlayerId == 100)
			.ToListAsync();

		// Assert
		player100Upgrades.Should().HaveCount(2);
	}
}
