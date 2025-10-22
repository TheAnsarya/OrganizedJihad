using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace OrganizedJihad.Api.Data.Models;

/// <summary>
/// Represents a chest opening event
/// </summary>
public class ChestOpening
{
	[Key]
	public int Id { get; set; }

	public DateTime Timestamp { get; set; }

	/// <summary>
	/// Type of chest opened (e.g., "heroic", "gold", "titan")
	/// </summary>
	[MaxLength(50)]
	public string ChestType { get; set; } = string.Empty;

	/// <summary>
	/// How the chest was opened (e.g., "keys", "emeralds", "event")
	/// </summary>
	[MaxLength(50)]
	public string? OpenMethod { get; set; }

	/// <summary>
	/// Number of chests opened in this batch
	/// </summary>
	public int Quantity { get; set; } = 1;

	/// <summary>
	/// Total value estimate of drops
	/// </summary>
	public int? TotalValue { get; set; }

	/// <summary>
	/// Individual items dropped from this chest
	/// </summary>
	public ICollection<ChestDrop> Drops { get; set; } = new List<ChestDrop>();
}

/// <summary>
/// Represents a single item dropped from a chest
/// </summary>
public class ChestDrop
{
	[Key]
	public int Id { get; set; }

	/// <summary>
	/// Foreign key to parent ChestOpening
	/// </summary>
	public int ChestOpeningId { get; set; }

	/// <summary>
	/// Parent chest opening record
	/// </summary>
	public ChestOpening ChestOpening { get; set; } = null!;

	/// <summary>
	/// Item identifier from game
	/// </summary>
	[MaxLength(50)]
	public string ItemId { get; set; } = string.Empty;

	/// <summary>
	/// Human-readable item name
	/// </summary>
	[MaxLength(100)]
	public string ItemName { get; set; } = string.Empty;

	/// <summary>
	/// Quantity of this item received
	/// </summary>
	public int Quantity { get; set; }

	/// <summary>
	/// Rarity level (e.g., "common", "rare", "epic", "legendary")
	/// </summary>
	[MaxLength(20)]
	public string? Rarity { get; set; }

	/// <summary>
	/// Item type category (e.g., "hero_soul_stone", "artifact_fragment", "resource")
	/// </summary>
	[MaxLength(50)]
	public string? ItemType { get; set; }

	/// <summary>
	/// Estimated value in game currency
	/// </summary>
	public int? EstimatedValue { get; set; }
}
