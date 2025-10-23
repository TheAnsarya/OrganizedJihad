using OrganizedJihad.Data.Entities;

namespace OrganizedJihad.Data.Models;

/// <summary>
/// Represents a pet in the player's roster with full details.
/// Tracks pet progression over time including stars and power.
/// This is immutable historical data - each sync creates a new snapshot.
/// </summary>
public class Pet : CreationAuditableEntity {
	/// <summary>
	/// Primary key (auto-increment)
	/// </summary>
	public int Id { get; set; }

	/// <summary>
	/// Game's internal pet ID
	/// </summary>
	public long PetId { get; set; }

	/// <summary>
	/// Pet name (e.g., "Albus", "Oliver", "Fenris")
	/// </summary>
	public string PetName { get; set; } = string.Empty;

	/// <summary>
	/// Absolute star count (0-6 stars typically)
	/// </summary>
	public int Stars { get; set; }

	/// <summary>
	/// Total pet power
	/// </summary>
	public int Power { get; set; }

	/// <summary>
	/// Pet level (if applicable in game version)
	/// </summary>
	public int Level { get; set; }

	/// <summary>
	/// Timestamp when this pet snapshot was captured
	/// </summary>
	public DateTime Timestamp { get; set; }

	/// <summary>
	/// Foreign key - which player owns this pet
	/// </summary>
	public long PlayerId { get; set; }

	/// <summary>
	/// Pet's element/patronage (links to which heroes the pet supports)
	/// Stored as JSON: ["hero_1", "hero_2", "hero_3"]
	/// </summary>
	public string? PatronageData { get; set; }
}
