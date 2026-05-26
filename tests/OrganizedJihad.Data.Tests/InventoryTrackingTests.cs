using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Data;
using OrganizedJihad.Data.Models;

namespace OrganizedJihad.Data.Tests;

/// <summary>
/// Tests for inventory tracking entity models (InventoryItemUsage, EquipmentChange).
/// Verifies CRUD operations, audit fields, and query patterns.
/// </summary>
public class InventoryTrackingTests : IDisposable {
	private readonly GameDatabaseContext _context;

	public InventoryTrackingTests() {
		var options = new DbContextOptionsBuilder<GameDatabaseContext>()
			.UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
			.Options;

		_context = new GameDatabaseContext(options);
	}

	public void Dispose() {
		_context.Dispose();
	}

	[Fact]
	public async Task Should_Add_InventoryItemUsage() {
		// Arrange
		var usage = new InventoryItemUsage {
			Timestamp = DateTime.UtcNow,
			ItemId = "potion_hero_xp_large",
			ItemName = "Large Hero XP Potion",
			Category = "potion",
			QuantityUsed = 10,
			QuantityRemaining = 50,
			UsageContext = "hero_level",
			TargetEntity = "Galahad",
			PlayerId = 12345
		};

		// Act
		_context.InventoryItemUsages.Add(usage);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.InventoryItemUsages
			.FirstOrDefaultAsync(u => u.ItemId == "potion_hero_xp_large");
		saved.Should().NotBeNull();
		saved!.ItemName.Should().Be("Large Hero XP Potion");
		saved.QuantityUsed.Should().Be(10);
		saved.QuantityRemaining.Should().Be(50);
		saved.UsageContext.Should().Be("hero_level");
		saved.TargetEntity.Should().Be("Galahad");
	}

	[Fact]
	public async Task Should_Add_EquipmentChange() {
		// Arrange
		var change = new EquipmentChange {
			Timestamp = DateTime.UtcNow,
			HeroId = 1,
			HeroName = "Galahad",
			SlotIndex = 3,
			EquipmentItemId = "item_dragon_shield",
			EquipmentName = "Dragon Shield",
			ChangeType = "equipped",
			HeroColorRank = 11,
			PlayerId = 12345
		};

		// Act
		_context.EquipmentChanges.Add(change);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.EquipmentChanges
			.FirstOrDefaultAsync(c => c.HeroId == 1 && c.SlotIndex == 3);
		saved.Should().NotBeNull();
		saved!.EquipmentName.Should().Be("Dragon Shield");
		saved.ChangeType.Should().Be("equipped");
		saved.HeroColorRank.Should().Be(11);
	}

	[Fact]
	public async Task Should_Query_ItemUsage_By_Category() {
		// Arrange
		var usages = new List<InventoryItemUsage> {
			new() { Timestamp = DateTime.UtcNow, ItemId = "potion_1", ItemName = "XP Potion", Category = "potion", QuantityUsed = 1, PlayerId = 1 },
			new() { Timestamp = DateTime.UtcNow, ItemId = "potion_2", ItemName = "Stamina Potion", Category = "potion", QuantityUsed = 2, PlayerId = 1 },
			new() { Timestamp = DateTime.UtcNow, ItemId = "scroll_1", ItemName = "Awakening Scroll", Category = "scroll", QuantityUsed = 1, PlayerId = 1 },
			new() { Timestamp = DateTime.UtcNow, ItemId = "fragment_1", ItemName = "Hero Fragment", Category = "fragment", QuantityUsed = 50, PlayerId = 1 }
		};

		_context.InventoryItemUsages.AddRange(usages);
		await _context.SaveChangesAsync();

		// Act
		var potionUsages = await _context.InventoryItemUsages
			.Where(u => u.Category == "potion")
			.ToListAsync();

		// Assert
		potionUsages.Should().HaveCount(2);
	}

	[Fact]
	public async Task Should_Query_EquipmentChanges_By_Hero() {
		// Arrange
		var changes = new List<EquipmentChange> {
			new() { Timestamp = DateTime.UtcNow.AddHours(-2), HeroId = 1, HeroName = "Galahad", SlotIndex = 0, ChangeType = "equipped", PlayerId = 1 },
			new() { Timestamp = DateTime.UtcNow.AddHours(-1), HeroId = 1, HeroName = "Galahad", SlotIndex = 1, ChangeType = "equipped", PlayerId = 1 },
			new() { Timestamp = DateTime.UtcNow, HeroId = 2, HeroName = "Astaroth", SlotIndex = 0, ChangeType = "equipped", PlayerId = 1 }
		};

		_context.EquipmentChanges.AddRange(changes);
		await _context.SaveChangesAsync();

		// Act
		var galahadChanges = await _context.EquipmentChanges
			.Where(c => c.HeroId == 1)
			.OrderBy(c => c.Timestamp)
			.ToListAsync();

		// Assert
		galahadChanges.Should().HaveCount(2);
	}

	[Fact]
	public async Task Should_Track_Audit_Fields_On_InventoryItemUsage() {
		// Arrange
		var usage = new InventoryItemUsage {
			Timestamp = DateTime.UtcNow,
			ItemId = "audit_test",
			ItemName = "Audit Test Item",
			Category = "consumable",
			QuantityUsed = 1,
			PlayerId = 12345
		};

		// Act
		_context.InventoryItemUsages.Add(usage);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.InventoryItemUsages.FindAsync(usage.Id);
		saved.Should().NotBeNull();
		saved!.DateCreated.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
	}

	[Fact]
	public async Task Should_Track_Equipment_Evolution_Consumption() {
		// Arrange - equipment consumed during color evolution
		var change = new EquipmentChange {
			Timestamp = DateTime.UtcNow,
			HeroId = 1,
			HeroName = "Galahad",
			SlotIndex = 2,
			EquipmentItemId = "item_shield_fragment",
			EquipmentName = "Shield Fragment",
			ChangeType = "consumed",
			HeroColorRank = 10,
			MaterialsConsumed = "[{\"id\": \"material_iron\", \"qty\": 50}]",
			PlayerId = 12345
		};

		// Act
		_context.EquipmentChanges.Add(change);
		await _context.SaveChangesAsync();

		// Assert
		var saved = await _context.EquipmentChanges.FirstAsync(c => c.ChangeType == "consumed");
		saved.MaterialsConsumed.Should().Contain("material_iron");
	}
}
