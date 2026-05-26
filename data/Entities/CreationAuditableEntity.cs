using OrganizedJihad.Data.Interfaces;

namespace OrganizedJihad.Data.Entities;

/// <summary>
/// Abstract base class for entities that track creation audit information only.
/// Implements ICreationAuditableEntity for immutable records.
///
/// Use this base class for:
/// - Game data snapshots that never change after capture
/// - Historical battle records
/// - Chest opening records
/// - Any data that is write-once, read-many
///
/// Audit fields are automatically populated by EF Core SaveChanges interceptor.
///
/// Pattern: Creation Audit Only
/// https://learn.microsoft.com/en-us/ef/core/saving/basic#auditing
/// </summary>
public abstract class CreationAuditableEntity : ICreationAuditableEntity {
	/// <summary>
	/// UTC timestamp when the entity was created in the database.
	/// Automatically populated on SaveChanges via EF Core interceptor.
	/// </summary>
	public DateTime DateCreated { get; set; }

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
}
