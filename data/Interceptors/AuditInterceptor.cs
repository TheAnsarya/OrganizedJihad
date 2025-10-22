using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using OrganizedJihad.Data.Interfaces;

namespace OrganizedJihad.Data.Interceptors;

/// <summary>
/// EF Core SaveChanges interceptor that automatically populates audit fields.
/// Detects entity state changes and updates audit properties based on implemented interfaces.
///
/// Handles:
/// - ICreationAuditableEntity: Sets DateCreated and CreatedBy on insert
/// - IAuditableEntity: Sets DateCreated/CreatedBy on insert, DateModified/ModifiedBy on update
/// - ISoftDelete: Sets IsDeleted, DateDeleted, DeletedBy when entity is deleted
///
/// Pattern: SaveChanges Interceptors
/// https://learn.microsoft.com/en-us/ef/core/logging-events-diagnostics/interceptors#savechanges-interception
/// https://www.thereformedprogrammer.net/ef-core-in-depth-tips-and-techniques-for-logging-and-unit-testing-part-3/
/// </summary>
public class AuditInterceptor : SaveChangesInterceptor {
	private readonly string _currentUser;

	/// <summary>
	/// Initialize audit interceptor with current user context.
	/// </summary>
	/// <param name="currentUser">Identifier for current user/system performing the operation.
	/// Examples: "Browser", "DesktopApp", "System", or specific user identifier</param>
	public AuditInterceptor(string currentUser = "System") {
		_currentUser = currentUser;
	}

	/// <summary>
	/// Intercept before SaveChanges to populate audit fields.
	/// Called synchronously before EF Core saves changes to the database.
	/// </summary>
	/// <param name="eventData">Event data with access to DbContext</param>
	/// <param name="result">Interception result</param>
	/// <returns>Modified interception result</returns>
	public override InterceptionResult<int> SavingChanges(
		DbContextEventData eventData,
		InterceptionResult<int> result) {
		UpdateAuditFields(eventData.Context);
		return base.SavingChanges(eventData, result);
	}

	/// <summary>
	/// Intercept before SaveChangesAsync to populate audit fields.
	/// Called asynchronously before EF Core saves changes to the database.
	/// </summary>
	/// <param name="eventData">Event data with access to DbContext</param>
	/// <param name="result">Interception result</param>
	/// <param name="cancellationToken">Cancellation token</param>
	/// <returns>Modified interception result</returns>
	public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
		DbContextEventData eventData,
		InterceptionResult<int> result,
		CancellationToken cancellationToken = default) {
		UpdateAuditFields(eventData.Context);
		return base.SavingChangesAsync(eventData, result, cancellationToken);
	}

	/// <summary>
	/// Update audit fields for all tracked entities based on their state.
	/// Processes Added, Modified, and Deleted entities.
	/// </summary>
	/// <param name="context">DbContext with change tracker</param>
	private void UpdateAuditFields(DbContext? context) {
		if (context == null) return;

		var now = DateTime.UtcNow;

		// Get all entities being tracked by EF Core
		var entries = context.ChangeTracker.Entries();

		foreach (var entry in entries) {
			// Handle soft delete: Convert Delete to Update with IsDeleted flag
			// This prevents physical deletion and preserves data integrity
			if (entry.State == EntityState.Deleted && entry.Entity is ISoftDelete softDelete) {
				entry.State = EntityState.Modified;
				softDelete.IsDeleted = true;
				softDelete.DateDeleted = now;
				softDelete.DeletedBy = _currentUser;
			}

			// Handle creation audit for new entities
			// Applies to both ICreationAuditableEntity and IAuditableEntity
			if (entry.State == EntityState.Added) {
				if (entry.Entity is ICreationAuditableEntity creationAuditable) {
					creationAuditable.DateCreated = now;
					creationAuditable.CreatedBy = _currentUser;
				}

				// For entities with full audit trail, also set modification fields on creation
				if (entry.Entity is IAuditableEntity auditable) {
					auditable.DateModified = now;
					auditable.ModifiedBy = _currentUser;
				}
			}

			// Handle modification audit for updated entities
			// Only applies to IAuditableEntity (includes SoftDeletableEntity)
			if (entry.State == EntityState.Modified) {
				if (entry.Entity is IAuditableEntity auditable) {
					auditable.DateModified = now;
					auditable.ModifiedBy = _currentUser;

					// Ensure DateCreated is never modified after initial creation
					// Mark as unmodified if it was changed
					var createdProperty = entry.Property(nameof(IAuditableEntity.DateCreated));
					if (createdProperty.IsModified) {
						createdProperty.IsModified = false;
					}

					var createdByProperty = entry.Property(nameof(IAuditableEntity.CreatedBy));
					if (createdByProperty.IsModified) {
						createdByProperty.IsModified = false;
					}
				}
			}
		}
	}
}
