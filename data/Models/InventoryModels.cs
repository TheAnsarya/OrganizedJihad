using OrganizedJihad.Data.Entities;
using System;
using System.ComponentModel.DataAnnotations;

namespace OrganizedJihad.Data.Models;

/// <summary>
/// Tracks individual inventory item consumption events.
/// Recorded when a player uses a consumable item (potions, fragments, scrolls, etc.).
/// Reference: https://hw-mobile.fandom.com/wiki/Items
/// </summary>
public class InventoryItemUsage : CreationAuditableEntity {
	/// <summary>Primary key.</summary>
	[Key]
	public int Id { get; set; }

	/// <summary>When the item was used.</summary>
	public DateTime Timestamp { get; set; }

	/// <summary>The game's internal item ID.</summary>
	[MaxLength(100)]
	public string ItemId { get; set; } = string.Empty;

	/// <summary>Display name of the item.</summary>
	[MaxLength(200)]
	public string ItemName { get; set; } = string.Empty;

	/// <summary>
	/// Category of the item: "potion", "fragment", "scroll", "gear", "consumable", "material", "key".
	/// </summary>
	[MaxLength(50)]
	public string Category { get; set; } = string.Empty;

	/// <summary>Quantity consumed in this event.</summary>
	public int QuantityUsed { get; set; }

	/// <summary>Remaining quantity after usage.</summary>
	public int QuantityRemaining { get; set; }

	/// <summary>
	/// Context in which the item was used: "hero_level", "hero_evolve", "artifact", "craft", "gift", "quest", "manual".
	/// </summary>
	[MaxLength(50)]
	public string? UsageContext { get; set; }

	/// <summary>
	/// Target entity the item was used on (e.g., hero name if used to level a hero).
	/// </summary>
	[MaxLength(200)]
	public string? TargetEntity { get; set; }

	/// <summary>The player who used the item.</summary>
	public long PlayerId { get; set; }
}

/// <summary>
/// Tracks equipment changes on heroes (equipping, upgrading, evolving gear slots).
/// Recorded when a hero's equipment slots are modified.
/// Reference: https://hw-mobile.fandom.com/wiki/Equipment
/// </summary>
public class EquipmentChange : CreationAuditableEntity {
	/// <summary>Primary key.</summary>
	[Key]
	public int Id { get; set; }

	/// <summary>When the equipment change occurred.</summary>
	public DateTime Timestamp { get; set; }

	/// <summary>The game's internal hero ID.</summary>
	public long HeroId { get; set; }

	/// <summary>Display name of the hero.</summary>
	[MaxLength(100)]
	public string HeroName { get; set; } = string.Empty;

	/// <summary>
	/// Which equipment slot was modified (0-5 for the six slots).
	/// </summary>
	public int SlotIndex { get; set; }

	/// <summary>Item ID of the equipment that was placed/upgraded.</summary>
	[MaxLength(100)]
	public string? EquipmentItemId { get; set; }

	/// <summary>Display name of the equipment.</summary>
	[MaxLength(200)]
	public string? EquipmentName { get; set; }

	/// <summary>
	/// Type of change: "equipped", "upgraded", "consumed" (for color evolution).
	/// </summary>
	[MaxLength(20)]
	public string ChangeType { get; set; } = string.Empty;

	/// <summary>
	/// Hero's color/rank at the time of the change. Correlates with equipment tier.
	/// </summary>
	public int HeroColorRank { get; set; }

	/// <summary>
	/// JSON of materials consumed for this equipment change (if upgrade or craft).
	/// </summary>
	public string? MaterialsConsumed { get; set; }

	/// <summary>The player who owns this hero.</summary>
	public long PlayerId { get; set; }
}
