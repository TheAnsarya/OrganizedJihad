namespace OrganizedJihad.Api.Models;

/// <summary>
/// Response payload describing persisted tracking coverage grouped by gameplay domain.
/// </summary>
public sealed class TrackingCoverageResponse {
	/// <summary>
	/// UTC timestamp when the coverage snapshot was generated.
	/// </summary>
	public DateTime GeneratedAtUtc { get; set; }

	/// <summary>
	/// Domain name to total persisted row count.
	/// </summary>
	public Dictionary<string, int> DomainTotals { get; set; } = new();

	/// <summary>
	/// Domain name to per-entity persisted row counts.
	/// </summary>
	public Dictionary<string, Dictionary<string, int>> DomainEntities { get; set; } = new();

	/// <summary>
	/// Sum of all entity counts across all domains.
	/// </summary>
	public int GrandTotal { get; set; }

	/// <summary>
	/// Battle/team recommendation endpoints exposed by the API.
	/// </summary>
	public List<string> RecommendationEndpoints { get; set; } = new();

	/// <summary>
	/// Categories that are requested frequently but do not currently have dedicated persisted models.
	/// </summary>
	public List<string> KnownCoverageGaps { get; set; } = new();
}
