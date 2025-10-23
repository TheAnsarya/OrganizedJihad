using OrganizedJihad.Data.Entities;

namespace OrganizedJihad.Data.Models;

/// <summary>
/// Represents a titan in the player's roster with full details.
/// Tracks titan progression over time including level, stars, and artifacts.
/// This is immutable historical data - each sync creates a new snapshot.
/// </summary>
public class Titan : CreationAuditableEntity {
	/// <summary>
	/// Primary key (auto-increment)
	/// </summary>
	public int Id { get; set; }

	/// <summary>
	/// Game's internal titan ID (e.g., 1 = Angus, 2 = Eden, etc.)
	/// </summary>
	public long TitanId { get; set; }

	/// <summary>
	/// Titan name (e.g., "Angus", "Hyperion")
	/// </summary>
	public string TitanName { get; set; } = string.Empty;

	/// <summary>
	/// Current titan level (1-120 typically)
	/// </summary>
	public int Level { get; set; }

	/// <summary>
	/// Absolute star count (0-6 stars typically)
	/// </summary>
	public int Stars { get; set; }

	/// <summary>
	/// Total titan power
	/// </summary>
	public int Power { get; set; }

	/// <summary>
	/// Timestamp when this titan snapshot was captured
	/// </summary>
	public DateTime Timestamp { get; set; }

	/// <summary>
	/// Foreign key - which player owns this titan
	/// </summary>
	public long PlayerId { get; set; }

	// === Skills ===

	/// <summary>
	/// Main skill level (1-150)
	/// </summary>
	public int SkillLevel { get; set; }

	// === Artifacts ===

	/// <summary>
	/// Titan artifact data stored as JSON
	/// Titans have a different artifact system than heroes
	/// Example: {"artifact_1": 10, "artifact_2": 15, "artifact_3": 20}
	/// </summary>
	public string? ArtifactData { get; set; }

	/// <summary>
	/// Summon stars (separate from regular stars in some game versions)
	/// </summary>
	public int SummonStars { get; set; }

	/// <summary>
	/// Titan's element/type (e.g., "fire", "water", "earth")
	/// </summary>
	public string? Element { get; set; }

	/// <summary>
	/// Titan skin level (0 = no skin, higher = upgraded skin)
	/// </summary>
	public int SkinLevel { get; set; }
}
