using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Data;
using OrganizedJihad.Data.Models;

namespace OrganizedJihad.Data.Tests;

/// <summary>
/// Tests for GameDatabaseContext
/// Verifies database context configuration, entity relationships, and CRUD operations
/// </summary>
public class GameDatabaseContextTests : IDisposable {
	private readonly GameDatabaseContext _context;

	public GameDatabaseContextTests() {
		// Create in-memory database for testing
		var options = new DbContextOptionsBuilder<GameDatabaseContext>()
			.UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
			.Options;

		_context = new GameDatabaseContext(options);
	}

	public void Dispose() {
		_context.Dispose();
	}

	[Fact]
	public void Context_Should_Have_All_DbSets() {
		// Arrange & Act
		var properties = _context.GetType().GetProperties()
			.Where(p => p.PropertyType.IsGenericType &&
						p.PropertyType.GetGenericTypeDefinition() == typeof(DbSet<>))
			.ToList();

		// Assert
		properties.Should().NotBeEmpty();
		properties.Should().HaveCountGreaterOrEqualTo(47); // Total number of DbSets (29 original + 18 new)
	}

	[Fact]
	public async Task Should_Add_PlayerSnapshot() {
		// Arrange
		var playerSnapshot = new PlayerSnapshot {
			PlayerId = 12345,
			PlayerName = "TestPlayer",
			Timestamp = DateTime.UtcNow,
			Level = 120,
			TeamPower = 1500000
		};

		// Act
		_context.PlayerSnapshots.Add(playerSnapshot);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.PlayerSnapshots.FirstOrDefaultAsync(p => p.PlayerId == 12345);
		saved.Should().NotBeNull();
		saved!.PlayerName.Should().Be("TestPlayer");
		saved.Level.Should().Be(120);
	}

	[Fact]
	public async Task Should_Track_Creation_Audit_Fields() {
		// Arrange
		var hero = new Hero {
			HeroId = 1,
			HeroName = "Galahad",
			Level = 120,
			Power = 50000
		};

		// Act
		_context.Heroes.Add(hero);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.Heroes.FindAsync(hero.Id);
		saved.Should().NotBeNull();
		saved!.DateCreated.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
	}

	[Fact]
	public async Task Should_Add_Guild_Member() {
		// Arrange
		var member = new GuildMember {
			PlayerId = 99999,
			PlayerName = "GuildMate",
			GuildId = 1,
			GuildName = "Test Guild",
			Level = 120,
			TeamPower = 1000000,
			GuildRank = "member",
			IsActive = true
		};

		// Act
		_context.GuildMembers.Add(member);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.GuildMembers.FirstOrDefaultAsync(m => m.PlayerId == 99999);
		saved.Should().NotBeNull();
		saved!.PlayerName.Should().Be("GuildMate");
		saved.GuildName.Should().Be("Test Guild");
	}

	[Fact]
	public async Task Should_Update_Guild_Member() {
		// Arrange
		var member = new GuildMember {
			PlayerId = 88888,
			PlayerName = "UpdateTest",
			GuildId = 1,
			GuildName = "Test Guild",
			Level = 100,
			TeamPower = 500000,
			IsActive = true
		};

		_context.GuildMembers.Add(member);
		await _context.SaveChangesAsync();

		// Act
		member.Level = 110;
		member.TeamPower = 600000;
		await _context.SaveChangesAsync();

		// Assert
		var updated = await _context.GuildMembers.FirstOrDefaultAsync(m => m.PlayerId == 88888);
		updated.Should().NotBeNull();
		updated!.Level.Should().Be(110);
		updated.TeamPower.Should().Be(600000);
		updated.DateModified.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
	}

	[Fact]
	public async Task Should_Add_Chat_Message() {
		// Arrange
		var message = new ChatMessage {
			Timestamp = DateTime.UtcNow,
			ChatType = "guild",
			SenderId = 12345,
			SenderName = "Player1",
			MessageText = "Hello guild!",
			IsOutgoing = false
		};

		// Act
		_context.ChatMessages.Add(message);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.ChatMessages.FirstOrDefaultAsync(m => m.SenderId == 12345);
		saved.Should().NotBeNull();
		saved!.MessageText.Should().Be("Hello guild!");
		saved.ChatType.Should().Be("guild");
	}

	[Fact]
	public async Task Should_Add_Guild_War_Participation() {
		// Arrange
		var participation = new GuildWarParticipation {
			WarId = "war123",
			WarDate = DateTime.UtcNow,
			PlayerId = 12345,
			PlayerName = "Warrior",
			GuildId = 1,
			AttacksMade = 5,
			MaxAttacks = 5,
			TotalDamage = 500000,
			Participated = true
		};

		// Act
		_context.GuildWarParticipations.Add(participation);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.GuildWarParticipations.FirstOrDefaultAsync(p => p.WarId == "war123");
		saved.Should().NotBeNull();
		saved!.AttacksMade.Should().Be(5);
		saved.TotalDamage.Should().Be(500000);
	}

	[Fact]
	public async Task Should_Add_Titanite_Transaction() {
		// Arrange
		var transaction = new TitaniteTransaction {
			Timestamp = DateTime.UtcNow,
			PlayerId = 12345,
			PlayerName = "TestPlayer",
			GuildId = 1,
			Amount = 100,
			TransactionType = "earned",
			Source = "Guild Raid"
		};

		// Act
		_context.TitaniteTransactions.Add(transaction);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.TitaniteTransactions
			.FirstOrDefaultAsync(t => t.PlayerId == 12345 && t.Source == "Guild Raid");
		saved.Should().NotBeNull();
		saved!.Amount.Should().Be(100);
		saved.TransactionType.Should().Be("earned");
	}

	[Fact]
	public async Task Should_Query_Guild_Members_By_Guild() {
		// Arrange
		var member1 = new GuildMember { PlayerId = 1, PlayerName = "M1", GuildId = 1, IsActive = true };
		var member2 = new GuildMember { PlayerId = 2, PlayerName = "M2", GuildId = 1, IsActive = true };
		var member3 = new GuildMember { PlayerId = 3, PlayerName = "M3", GuildId = 2, IsActive = true };

		_context.GuildMembers.AddRange(member1, member2, member3);
		await _context.SaveChangesAsync();

		// Act
		var guild1Members = await _context.GuildMembers
			.Where(m => m.GuildId == 1)
			.ToListAsync();

		// Assert
		guild1Members.Should().HaveCount(2);
		guild1Members.Should().Contain(m => m.PlayerId == 1);
		guild1Members.Should().Contain(m => m.PlayerId == 2);
	}

	[Fact]
	public async Task Should_Track_Multiple_Hero_Levels() {
		// Arrange
		var hero1 = new Hero { HeroId = 1, HeroName = "Galahad", Level = 120, Power = 50000 };
		var hero2 = new Hero { HeroId = 2, HeroName = "Astaroth", Level = 115, Power = 48000 };
		var hero3 = new Hero { HeroId = 3, HeroName = "Karkh", Level = 100, Power = 40000 };

		_context.Heroes.AddRange(hero1, hero2, hero3);
		await _context.SaveChangesAsync();

		// Act
		var highLevelHeroes = await _context.Heroes
			.Where(h => h.Level >= 115)
			.ToListAsync();

		// Assert
		highLevelHeroes.Should().HaveCount(2);
	}
}
