using System;
using System.ComponentModel.DataAnnotations;

namespace OrganizedJihad.Api.Data.Models;

/// <summary>
/// Represents a snapshot of player state at a specific time.
/// Tracks resources, progression, and team composition.
/// </summary>
public class PlayerSnapshot {
	[Key]
	public int Id { get; set; }

	/// <summary>
	/// Unique player identifier from Hero Wars
	/// </summary>
	public long PlayerId { get; set; }

	/// <summary>
	/// Player's username
	/// </summary>
	[MaxLength(100)]
	public string PlayerName { get; set; } = string.Empty;

	/// <summary>
	/// When this snapshot was captured
	/// </summary>
	public DateTime Timestamp { get; set; }

	/// <summary>
	/// Player level
	/// </summary>
	public int Level { get; set; }

	/// <summary>
	/// Team power (sum of all heroes)
	/// </summary>
	public int TeamPower { get; set; }

	/// <summary>
	/// Current gold amount
	/// </summary>
	public long Gold { get; set; }

	/// <summary>
	/// Current emeralds (premium currency)
	/// </summary>
	public int Emeralds { get; set; }

	/// <summary>
	/// Arena coins
	/// </summary>
	public int ArenaCoins { get; set; }

	/// <summary>
	/// Grand Arena coins
	/// </summary>
	public int GrandArenaCoins { get; set; }

	/// <summary>
	/// Titan Arena coins
	/// </summary>
	public int TitanArenaCoins { get; set; }

	/// <summary>
	/// Guild coins
	/// </summary>
	public int GuildCoins { get; set; }

	/// <summary>
	/// Hero experience potions
	/// </summary>
	public int HeroExpPotions { get; set; }

	/// <summary>
	/// Titan experience potions
	/// </summary>
	public int TitanExpPotions { get; set; }

	/// <summary>
	/// Current arena rank
	/// </summary>
	public int? ArenaRank { get; set; }

	/// <summary>
	/// Current grand arena rank
	/// </summary>
	public int? GrandArenaRank { get; set; }

	/// <summary>
	/// Current titan arena rank
	/// </summary>
	public int? TitanArenaRank { get; set; }

	/// <summary>
	/// Guild name
	/// </summary>
	[MaxLength(100)]
	public string? GuildName { get; set; }

	/// <summary>
	/// Compressed team composition data (JSON)
	/// Format: Array of {heroId, level, stars, power, artifacts, skins}
	/// </summary>
	public string? TeamComposition { get; set; }

	/// <summary>
	/// Compressed titan team data (JSON)
	/// </summary>
	public string? TitanTeam { get; set; }
}
