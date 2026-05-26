namespace OrganizedJihad.Api.Models;

/// <summary>
/// Catalog payload for external Hero Wars tools discovered during research.
/// </summary>
public class ToolCatalogResponse {
	/// <summary>
	/// UTC time when this catalog was generated.
	/// </summary>
	public DateTime GeneratedAtUtc { get; set; }

	/// <summary>
	/// Catalog entries.
	/// </summary>
	public List<ToolCatalogEntry> Tools { get; set; } = [];
}

/// <summary>
/// Single external tool metadata entry.
/// </summary>
public class ToolCatalogEntry {
	/// <summary>
	/// Human-readable name.
	/// </summary>
	public string Name { get; set; } = string.Empty;

	/// <summary>
	/// Primary tool URL.
	/// </summary>
	public string Url { get; set; } = string.Empty;

	/// <summary>
	/// Category label (simulator, calculator, guides, extension).
	/// </summary>
	public string Category { get; set; } = string.Empty;

	/// <summary>
	/// Capability summary.
	/// </summary>
	public string Capabilities { get; set; } = string.Empty;

	/// <summary>
	/// Notes and caveats (legal/quality/operational).
	/// </summary>
	public string Caveats { get; set; } = string.Empty;

	/// <summary>
	/// UTC timestamp when this source was last reviewed in-project.
	/// </summary>
	public DateTime LastReviewedUtc { get; set; }

	/// <summary>
	/// Confidence score in this source's current reliability (0..1).
	/// </summary>
	public double ConfidenceScore { get; set; }

	/// <summary>
	/// Verification status label (verified, stale, unverified, partial).
	/// </summary>
	public string VerificationStatus { get; set; } = string.Empty;
}

/// <summary>
/// Supported filter/sort metadata for the external tool catalog endpoint.
/// </summary>
public class ToolCatalogFilterMetadataResponse {
	/// <summary>
	/// UTC time when metadata was generated.
	/// </summary>
	public DateTime GeneratedAtUtc { get; set; }

	/// <summary>
	/// Supported category values for query filtering.
	/// </summary>
	public List<string> Categories { get; set; } = [];

	/// <summary>
	/// Supported verification status values for query filtering.
	/// </summary>
	public List<string> VerificationStatuses { get; set; } = [];

	/// <summary>
	/// Supported sort values for query ordering.
	/// </summary>
	public List<string> SortOptions { get; set; } = [];

	/// <summary>
	/// Default minimum confidence used by thin clients.
	/// </summary>
	public double DefaultMinConfidence { get; set; }

	/// <summary>
	/// Default stale-entry inclusion policy used by thin clients.
	/// </summary>
	public bool DefaultIncludeStale { get; set; }

	/// <summary>
	/// Default sort mode used by thin clients.
	/// </summary>
	public string DefaultSort { get; set; } = string.Empty;
}
