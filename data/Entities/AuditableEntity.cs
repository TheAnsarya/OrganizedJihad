using OrganizedJihad.Data.Interfaces;

namespace OrganizedJihad.Data.Entities;

/// <summary>
/// Abstract base class for entities that track full audit trail.
/// Implements IAuditableEntity for mutable records that can be updated.
///
/// Use this base class for:
/// - User-managed data that can be edited
/// - Reference data that changes over time
/// - Configuration settings
/// - Any data that requires modification tracking
///
/// Audit fields are automatically populated by EF Core SaveChanges interceptor.
///
/// Pattern: Full Audit Trail
/// https://learn.microsoft.com/en-us/ef/core/saving/basic#auditing
/// </summary>
public abstract class AuditableEntity : IAuditableEntity {
	/// <summary>
	/// UTC timestamp when the entity was first created in the database.
	/// Automatically populated on SaveChanges via EF Core interceptor.
	/// Never modified after initial creation.
	/// </summary>
	public DateTime DateCreated { get; set; }

	/// <summary>
	/// UTC timestamp when the entity was last modified.
	/// Automatically updated on SaveChanges via EF Core interceptor.
	/// Initially set to DateCreated, then updated on each modification.
	/// </summary>
	public DateTime DateModified { get; set; }

	/// <summary>
	/// Identifier of the user/system that created this record.
	/// Automatically populated on SaveChanges via EF Core interceptor.
	///
	/// Values:
	/// - "Browser" - Data synced from browser userscript
	/// - "DesktopApp" - Data created in desktop application
	/// - "System" - Data created by system processes
	/// - User identifier - Specific user who created the record
	/// </summary>
	public string? CreatedBy { get; set; }

	/// <summary>
	/// Identifier of the user/system that last modified this record.
	/// Automatically updated on SaveChanges via EF Core interceptor.
	/// </summary>
	public string? ModifiedBy { get; set; }
}
