using OrganizedJihad.Data.Interfaces;

namespace OrganizedJihad.Data.Entities;

/// <summary>
/// Abstract base class for entities that support soft delete with full audit trail.
/// Combines IAuditableEntity and ISoftDelete for user-managed data.
///
/// Use this base class for:
/// - User-created goals that can be archived
/// - Calendar events that can be soft-deleted
/// - Any user-managed data that needs undelete functionality
/// - Records requiring legal retention after deletion
///
/// Features:
/// - Full audit trail (creation and modification tracking)
/// - Soft delete support (mark as deleted without physical removal)
/// - Global query filter automatically excludes deleted records
/// - Enables undelete/restore functionality
///
/// Audit and soft delete fields automatically managed by EF Core interceptor.
///
/// Pattern: Soft Delete with Audit Trail
/// https://learn.microsoft.com/en-us/ef/core/querying/filters
/// https://www.thereformedprogrammer.net/ef-core-in-depth-soft-deleting-data-with-global-query-filters/
/// </summary>
public abstract class SoftDeletableEntity : AuditableEntity, ISoftDelete {
	/// <summary>
	/// Indicates whether the record has been soft deleted.
	/// When true, the record is excluded from normal queries via global query filter.
	/// Automatically set to true when entity is deleted via EF Core interceptor.
	/// </summary>
	public bool IsDeleted { get; set; }

	/// <summary>
	/// UTC timestamp when the record was soft deleted.
	/// Automatically populated when entity is deleted via EF Core interceptor.
	/// Null if the record has never been deleted or has been restored.
	/// </summary>
	public DateTime? DateDeleted { get; set; }

	/// <summary>
	/// Identifier of the user/system that deleted this record.
	/// Automatically populated when entity is deleted via EF Core interceptor.
	/// Null if the record has never been deleted or has been restored.
	///
	/// Values:
	/// - "Browser" - Deleted via browser userscript
	/// - "System" - Deleted by system process
	/// - User identifier - Specific user who deleted the record
	/// </summary>
	public string? DeletedBy { get; set; }
}
