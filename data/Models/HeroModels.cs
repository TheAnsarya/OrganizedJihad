using OrganizedJihad.Data.Entities;

namespace OrganizedJihad.Data.Models;

/// <summary>
/// Represents a hero in the player's roster with full details.
/// Tracks hero progression over time including level, stars, skills, and artifacts.
/// This is immutable historical data - each sync creates a new snapshot.
/// </summary>
public class Hero : CreationAuditableEntity {
	/// <summary>
	/// Primary key (auto-increment)
	/// </summary>
	public int Id { get; set; }

	/// <summary>
	/// Game's internal hero ID (e.g., 1 = Astaroth, 2 = Aurora, etc.)
	/// </summary>
	public long HeroId { get; set; }

	/// <summary>
	/// Hero name (e.g., "Astaroth", "K'arkh")
	/// </summary>
	public string HeroName { get; set; } = string.Empty;

	/// <summary>
	/// Current hero level (1-150)
	/// </summary>
	public int Level { get; set; }

	/// <summary>
	/// Absolute star count (0-7 stars typically)
	/// </summary>
	public int Stars { get; set; }

	/// <summary>
	/// Hero color/rank (0=gray, 1=green, 2=blue, 3=blue+1, 4=blue+2, 5=violet, 6=violet+1, etc.)
	/// </summary>
	public int Color { get; set; }

	/// <summary>
	/// Total hero power
	/// </summary>
	public int Power { get; set; }

	/// <summary>
	/// Skin level (0 = no skin, higher = upgraded skin)
	/// </summary>
	public int Skins { get; set; }

	/// <summary>
	/// Timestamp when this hero snapshot was captured
	/// </summary>
	public DateTime Timestamp { get; set; }

	/// <summary>
	/// Foreign key - which player owns this hero
	/// </summary>
	public long PlayerId { get; set; }

	// === Skills ===

	/// <summary>
	/// First skill level (1-150)
	/// </summary>
	public int SkillLevel1 { get; set; }

	/// <summary>
	/// Second skill level (1-150)
	/// </summary>
	public int SkillLevel2 { get; set; }

	/// <summary>
	/// Third skill level (1-150)
	/// </summary>
	public int SkillLevel3 { get; set; }

	/// <summary>
	/// Fourth skill level (1-150)
	/// </summary>
	public int SkillLevel4 { get; set; }

	// === Artifacts ===

	/// <summary>
	/// Weapon artifact level (0-6 stars typically)
	/// </summary>
	public int ArtifactWeapon { get; set; }

	/// <summary>
	/// Book artifact level (0-6 stars)
	/// </summary>
	public int ArtifactBook { get; set; }

	/// <summary>
	/// Ring artifact level (0-6 stars)
	/// </summary>
	public int ArtifactRing { get; set; }

	// === Glyphs ===

	/// <summary>
	/// Glyph data stored as JSON
	/// Example: {"strength": 5, "intelligence": 3, "agility": 4, "health": 2}
	/// </summary>
	public string? GlyphData { get; set; }
}

/// <summary>
/// Represents the player's inventory of items and resources.
/// Tracks consumables, evolution items, soul stones, and other collectibles.
/// This is a snapshot - each sync creates a new inventory record.
/// </summary>
public class InventorySnapshot : CreationAuditableEntity {
	/// <summary>
	/// Primary key (auto-increment)
	/// </summary>
	public int Id { get; set; }

	/// <summary>
	/// Timestamp when this inventory snapshot was captured
	/// </summary>
	public DateTime Timestamp { get; set; }

	/// <summary>
	/// Foreign key - which player owns this inventory
	/// </summary>
	public long PlayerId { get; set; }

	/// <summary>
	/// Complete inventory data stored as JSON
	/// Example structure:
	/// {
	///   "hero_soul_stones": { "1": 150, "2": 200 },  // HeroId: Quantity
	///   "titan_soul_stones": { "1": 50, "2": 75 },
	///   "pet_soul_stones": { "1": 30, "2": 45 },
	///   "evolution_items": { "item_1": 100, "item_2": 50 },
	///   "consumables": { "energy": 500, "xp_potion": 10 },
	///   "chests": { "heroic_chest": 5, "titan_chest": 3 }
	/// }
	/// </summary>
	public string InventoryData { get; set; } = string.Empty;

	/// <summary>
	/// Summary counts for quick queries (denormalized for performance)
	/// </summary>
	public int TotalHeroSoulStones { get; set; }

	public int TotalTitanSoulStones { get; set; }
	public int TotalPetSoulStones { get; set; }
	public int TotalEvolutionItems { get; set; }
	public int TotalConsumables { get; set; }
	public int TotalChests { get; set; }
}
