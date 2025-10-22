namespace OrganizedJihad.Data.Interfaces;

/// <summary>
/// Interface for entities that track full audit trail including modifications.
/// Used for mutable records that can be updated after creation.
///
/// Examples:
/// - User-managed data (Goal, CalendarEvent)
/// - Reference data that changes over time (Opponent win/loss records)
/// - Configuration settings
///
/// Pattern: Full Audit Trail
/// https://learn.microsoft.com/en-us/ef/core/saving/basic#auditing
/// </summary>
public interface IAuditableEntity {
	/// <summary>
	/// UTC timestamp when the entity was first created in the database.
	/// Automatically populated on SaveChanges via EF Core interceptor.
	/// Never modified after initial creation.
	/// </summary>
	DateTime DateCreated { get; set; }

	/// <summary>
	/// UTC timestamp when the entity was last modified.
	/// Automatically updated on SaveChanges via EF Core interceptor.
	/// Initially set to DateCreated, then updated on each modification.
	/// </summary>
	DateTime DateModified { get; set; }

	/// <summary>
	/// Identifier of the user/system that created this record.
	/// For browser sync: "Browser"
	/// For desktop app: User identifier
	/// For system processes: "System"
	/// </summary>
	string? CreatedBy { get; set; }

	/// <summary>
	/// Identifier of the user/system that last modified this record.
	/// Updated on each modification via EF Core interceptor.
	/// </summary>
	string? ModifiedBy { get; set; }
}
