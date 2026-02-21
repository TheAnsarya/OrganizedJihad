using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Data;
using OrganizedJihad.Data.Models;

namespace OrganizedJihad.Data.Tests;

/// <summary>
/// Tests for hero upgrade entity models (HeroLevelUpgrade, HeroStarUpgrade, etc.)
/// Verifies CRUD operations, audit fields, and DbContext configuration.
/// </summary>
public class HeroUpgradeTests : IDisposable {
	private readonly GameDatabaseContext _context;

	public HeroUpgradeTests() {
		var options = new DbContextOptionsBuilder<GameDatabaseContext>()
			.UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
			.Options;

		_context = new GameDatabaseContext(options);
	}

	public void Dispose() {
		_context.Dispose();
	}

	[Fact]
	public async Task Should_Add_HeroLevelUpgrade() {
		// Arrange
		var upgrade = new HeroLevelUpgrade {
			Timestamp = DateTime.UtcNow,
			HeroId = 1,
			HeroName = "Galahad",
			PlayerId = 12345,
			PowerAfter = 50000,
			LevelBefore = 99,
			LevelAfter = 100,
			ExperienceSpent = 10000,
			GoldSpent = 5000
		};

		// Act
		_context.HeroLevelUpgrades.Add(upgrade);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.HeroLevelUpgrades.FirstOrDefaultAsync(u => u.HeroId == 1);
		saved.Should().NotBeNull();
		saved!.LevelBefore.Should().Be(99);
		saved.LevelAfter.Should().Be(100);
		saved.ExperienceSpent.Should().Be(10000);
		saved.GoldSpent.Should().Be(5000);
		saved.HeroName.Should().Be("Galahad");
	}

	[Fact]
	public async Task Should_Add_HeroStarUpgrade() {
		// Arrange
		var upgrade = new HeroStarUpgrade {
			Timestamp = DateTime.UtcNow,
			HeroId = 2,
			HeroName = "Astaroth",
			PlayerId = 12345,
			PowerAfter = 60000,
			StarsBefore = 5,
			StarsAfter = 6,
			SoulStonesConsumed = 300,
			GoldSpent = 100000
		};

		// Act
		_context.HeroStarUpgrades.Add(upgrade);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.HeroStarUpgrades.FirstOrDefaultAsync(u => u.HeroId == 2);
		saved.Should().NotBeNull();
		saved!.StarsBefore.Should().Be(5);
		saved.StarsAfter.Should().Be(6);
		saved.SoulStonesConsumed.Should().Be(300);
	}

	[Fact]
	public async Task Should_Add_HeroColorUpgrade() {
		// Arrange
		var upgrade = new HeroColorUpgrade {
			Timestamp = DateTime.UtcNow,
			HeroId = 3,
			HeroName = "Karkh",
			PlayerId = 12345,
			PowerAfter = 70000,
			ColorBefore = 10,
			ColorAfter = 11,
			ColorNameBefore = "Orange+4",
			ColorNameAfter = "Red",
			EquipmentConsumed = "[{\"id\": \"item_1\", \"name\": \"Dragon Shield\"}]"
		};

		// Act
		_context.HeroColorUpgrades.Add(upgrade);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.HeroColorUpgrades.FirstOrDefaultAsync(u => u.HeroId == 3);
		saved.Should().NotBeNull();
		saved!.ColorNameBefore.Should().Be("Orange+4");
		saved.ColorNameAfter.Should().Be("Red");
		saved.EquipmentConsumed.Should().Contain("Dragon Shield");
	}

	[Fact]
	public async Task Should_Add_HeroSkillUpgrade() {
		// Arrange
		var upgrade = new HeroSkillUpgrade {
			Timestamp = DateTime.UtcNow,
			HeroId = 1,
			HeroName = "Galahad",
			PlayerId = 12345,
			PowerAfter = 51000,
			SkillSlot = 1,
			SkillName = "Righteous Fury",
			SkillLevelBefore = 50,
			SkillLevelAfter = 51,
			GoldSpent = 25000
		};

		// Act
		_context.HeroSkillUpgrades.Add(upgrade);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.HeroSkillUpgrades.FirstOrDefaultAsync(u => u.SkillName == "Righteous Fury");
		saved.Should().NotBeNull();
		saved!.SkillSlot.Should().Be(1);
		saved.SkillLevelBefore.Should().Be(50);
		saved.SkillLevelAfter.Should().Be(51);
	}

	[Fact]
	public async Task Should_Add_HeroArtifactUpgrade() {
		// Arrange
		var upgrade = new HeroArtifactUpgrade {
			Timestamp = DateTime.UtcNow,
			HeroId = 1,
			HeroName = "Galahad",
			PlayerId = 12345,
			PowerAfter = 52000,
			ArtifactType = "Weapon",
			ArtifactName = "Blade of Dawn",
			LevelBefore = 80,
			LevelAfter = 81,
			ResourcesConsumed = "{\"artifact_essence\": 500}"
		};

		// Act
		_context.HeroArtifactUpgrades.Add(upgrade);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.HeroArtifactUpgrades.FirstOrDefaultAsync(u => u.ArtifactType == "Weapon");
		saved.Should().NotBeNull();
		saved!.ArtifactName.Should().Be("Blade of Dawn");
		saved.LevelBefore.Should().Be(80);
	}

	[Fact]
	public async Task Should_Add_HeroGlyphUpgrade() {
		// Arrange
		var upgrade = new HeroGlyphUpgrade {
			Timestamp = DateTime.UtcNow,
			HeroId = 1,
			HeroName = "Galahad",
			PlayerId = 12345,
			PowerAfter = 53000,
			GlyphType = "Strength",
			GlyphLevelBefore = 30,
			GlyphLevelAfter = 31,
			GoldSpent = 50000
		};

		// Act
		_context.HeroGlyphUpgrades.Add(upgrade);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.HeroGlyphUpgrades.FirstOrDefaultAsync(u => u.GlyphType == "Strength");
		saved.Should().NotBeNull();
		saved!.GlyphLevelBefore.Should().Be(30);
		saved.GlyphLevelAfter.Should().Be(31);
	}

	[Fact]
	public async Task Should_Add_HeroSkinUpgrade() {
		// Arrange
		var upgrade = new HeroSkinUpgrade {
			Timestamp = DateTime.UtcNow,
			HeroId = 1,
			HeroName = "Galahad",
			PlayerId = 12345,
			PowerAfter = 54000,
			SkinName = "Romantic",
			SkinId = "skin_romantic_galahad",
			IsNewUnlock = true,
			LevelBefore = 0,
			LevelAfter = 1,
			SkinStonesConsumed = 50
		};

		// Act
		_context.HeroSkinUpgrades.Add(upgrade);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.HeroSkinUpgrades.FirstOrDefaultAsync(u => u.SkinName == "Romantic");
		saved.Should().NotBeNull();
		saved!.IsNewUnlock.Should().BeTrue();
		saved.SkinStonesConsumed.Should().Be(50);
	}

	[Fact]
	public async Task Should_Track_Audit_Fields_On_HeroUpgrade() {
		// Arrange
		var upgrade = new HeroLevelUpgrade {
			Timestamp = DateTime.UtcNow,
			HeroId = 1,
			HeroName = "Galahad",
			PlayerId = 12345,
			PowerAfter = 50000,
			LevelBefore = 1,
			LevelAfter = 2,
			ExperienceSpent = 100,
			GoldSpent = 50
		};

		// Act
		_context.HeroLevelUpgrades.Add(upgrade);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.HeroLevelUpgrades.FindAsync(upgrade.Id);
		saved.Should().NotBeNull();
		saved!.DateCreated.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
	}

	[Fact]
	public async Task Should_Query_Hero_Upgrades_By_HeroId() {
		// Arrange - multiple upgrades for same hero
		var upgrades = new List<HeroLevelUpgrade> {
			new() { Timestamp = DateTime.UtcNow.AddHours(-2), HeroId = 10, HeroName = "Galahad", PlayerId = 1, PowerAfter = 50000, LevelBefore = 98, LevelAfter = 99 },
			new() { Timestamp = DateTime.UtcNow.AddHours(-1), HeroId = 10, HeroName = "Galahad", PlayerId = 1, PowerAfter = 51000, LevelBefore = 99, LevelAfter = 100 },
			new() { Timestamp = DateTime.UtcNow, HeroId = 20, HeroName = "Karkh", PlayerId = 1, PowerAfter = 60000, LevelBefore = 50, LevelAfter = 51 }
		};

		_context.HeroLevelUpgrades.AddRange(upgrades);
		await _context.SaveChangesAsync();

		// Act
		var galahadUpgrades = await _context.HeroLevelUpgrades
			.Where(u => u.HeroId == 10)
			.OrderByDescending(u => u.Timestamp)
			.ToListAsync();

		// Assert
		galahadUpgrades.Should().HaveCount(2);
		galahadUpgrades.First().LevelAfter.Should().Be(100);
	}
}
