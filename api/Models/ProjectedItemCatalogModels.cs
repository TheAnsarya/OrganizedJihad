namespace OrganizedJihad.Api.Models;

/// <summary>
/// Deterministic projected-item catalog payload for cross-client parity.
/// </summary>
public class ProjectedItemCatalogResponse {
	/// <summary>
	/// UTC time when payload was generated.
	/// </summary>
	public DateTime GeneratedAtUtc { get; set; }

	/// <summary>
	/// Canonical projected item catalog entries.
	/// </summary>
	public List<ProjectedItemCatalogEntry> Items { get; set; } = [];

	/// <summary>
	/// Item ID alias map (variant ID -> canonical ID).
	/// </summary>
	public Dictionary<string, string> Aliases { get; set; } = [];
}

/// <summary>
/// Canonical projected-item display metadata.
/// </summary>
public class ProjectedItemCatalogEntry {
	/// <summary>
	/// Canonical item ID key.
	/// </summary>
	public string ItemId { get; set; } = string.Empty;

	/// <summary>
	/// Human-readable item display name.
	/// </summary>
	public string DisplayName { get; set; } = string.Empty;

	/// <summary>
	/// Item category token.
	/// </summary>
	public string Category { get; set; } = string.Empty;

	/// <summary>
	/// Deterministic icon token/glyph.
	/// </summary>
	public string Icon { get; set; } = string.Empty;
}
