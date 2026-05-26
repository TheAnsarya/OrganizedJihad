namespace OrganizedJihad.Data.Interfaces;

/// <summary>
/// Interface for entities that track creation audit information only.
/// Used for immutable records that are never modified after creation.
///
/// Examples:
/// - Game data snapshots (PlayerSnapshot)
/// - Battle records (ArenaBattle, GrandArenaBattle, etc.)
/// - Chest openings (ChestOpening, ChestDrop)
/// - Historical event records
///
/// Pattern: Creation Audit Only
/// https://learn.microsoft.com/en-us/ef/core/saving/basic#auditing
/// </summary>
public interface ICreationAuditableEntity {
	/// <summary>
	/// UTC timestamp when the entity was created in the database.
	/// Automatically populated on SaveChanges via EF Core interceptor.
	/// </summary>
	DateTime DateCreated { get; set; }

	/// <summary>
	/// Identifier of the user/system that created this record.
	/// For browser sync: "Browser"
	/// For desktop app: User identifier
	/// For system processes: "System"
	/// </summary>
	string? CreatedBy { get; set; }
}
