using OrganizedJihad.Api.Models;

namespace OrganizedJihad.Api.Services.ProjectedItemCatalog;

/// <summary>
/// Interface for providing deterministic projected-item catalog metadata.
/// </summary>
public interface IProjectedItemCatalogProvider {
	/// <summary>
	/// Builds projected-item catalog metadata and alias mappings.
	/// </summary>
	ProjectedItemCatalogResponse BuildCatalog();
}
