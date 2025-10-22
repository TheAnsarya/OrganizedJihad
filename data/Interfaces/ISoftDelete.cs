namespace OrganizedJihad.Data.Interfaces;

/// <summary>
/// Interface for entities that support soft delete functionality.
/// Soft delete marks records as deleted without physically removing them from the database.
///
/// Benefits:
/// - Maintains referential integrity
/// - Enables audit trail of deleted records
/// - Allows undelete/restore functionality
/// - Preserves historical data for analytics
///
/// Examples:
/// - User-managed data (Goal, CalendarEvent)
/// - Records that may need to be restored
/// - Data with legal retention requirements
///
/// Pattern: Soft Delete with Query Filters
/// https://learn.microsoft.com/en-us/ef/core/querying/filters
/// https://www.thereformedprogrammer.net/ef-core-in-depth-soft-deleting-data-with-global-query-filters/
/// </summary>
public interface ISoftDelete {
	/// <summary>
	/// Indicates whether the record has been soft deleted.
	/// When true, the record is excluded from normal queries via global query filter.
	/// </summary>
	bool IsDeleted { get; set; }

	/// <summary>
	/// UTC timestamp when the record was soft deleted.
	/// Null if the record has never been deleted.
	/// </summary>
	DateTime? DateDeleted { get; set; }

	/// <summary>
	/// Identifier of the user/system that deleted this record.
	/// Null if the record has never been deleted.
	/// </summary>
	string? DeletedBy { get; set; }
}
