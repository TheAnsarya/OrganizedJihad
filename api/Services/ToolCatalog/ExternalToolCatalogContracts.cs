using OrganizedJihad.Api.Models;

namespace OrganizedJihad.Api.Services.ToolCatalog;

/// <summary>
/// Interface for providing curated external Hero Wars tool catalog metadata.
/// </summary>
public interface IExternalToolCatalogProvider {
	/// <summary>
	/// Builds curated tool catalog response with filtering and sorting.
	/// </summary>
	ToolCatalogResponse BuildCatalog(
		double? minConfidence = null,
		bool includeStale = true,
		string? category = null,
		string? verificationStatus = null,
		string? sort = null
	);

	/// <summary>
	/// Builds filter/sort metadata for tool catalog clients.
	/// </summary>
	ToolCatalogFilterMetadataResponse BuildFilterMetadata();
}
