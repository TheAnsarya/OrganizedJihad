using System.Net.Http.Json;

namespace OrganizedJihad.Desktop.Services;

/// <summary>
/// Provides access to projected item catalog metadata exposed by the sync API.
/// </summary>
public class ProjectedItemCatalogClientService {
	private readonly RecommendationSettingsService _recommendationSettings;

	public ProjectedItemCatalogClientService(RecommendationSettingsService recommendationSettings) {
		_recommendationSettings = recommendationSettings;
	}

	/// <summary>
	/// Fetches the projected item catalog payload from the configured API host.
	/// </summary>
	public async Task<ProjectedItemCatalogFetchResult> GetProjectedItemCatalogAsync() {
		try {
			var baseUrl = _recommendationSettings.GetRecommendationApiBaseUrl().TrimEnd('/');
			using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
			var payload = await client.GetFromJsonAsync<ProjectedItemCatalogResponseModel>($"{baseUrl}/api/sync/projections/item-catalog");

			if (payload is null) {
				return ProjectedItemCatalogFetchResult.Failure("Projected item catalog endpoint returned no payload.");
			}

			return ProjectedItemCatalogFetchResult.Success(payload);
		} catch (Exception ex) {
			return ProjectedItemCatalogFetchResult.Failure($"Projected item catalog unavailable: {ex.Message}");
		}
	}
}

/// <summary>
/// Result envelope for projected item catalog API fetch operations.
/// </summary>
public sealed class ProjectedItemCatalogFetchResult {
	public bool IsSuccess { get; private init; }
	public string Message { get; private init; } = string.Empty;
	public ProjectedItemCatalogResponseModel? Payload { get; private init; }

	public static ProjectedItemCatalogFetchResult Success(ProjectedItemCatalogResponseModel payload) {
		return new ProjectedItemCatalogFetchResult {
			IsSuccess = true,
			Payload = payload,
			Message = $"Loaded {payload.Items.Count} canonical items and {payload.Aliases.Count} aliases from API.",
		};
	}

	public static ProjectedItemCatalogFetchResult Failure(string message) {
		return new ProjectedItemCatalogFetchResult {
			IsSuccess = false,
			Message = message,
		};
	}
}

/// <summary>
/// API payload for projected item catalog metadata.
/// </summary>
public sealed class ProjectedItemCatalogResponseModel {
	public DateTime GeneratedAtUtc { get; set; }
	public List<ProjectedItemCatalogEntryModel> Items { get; set; } = [];
	public Dictionary<string, string> Aliases { get; set; } = [];
}

/// <summary>
/// Canonical projected item metadata entry.
/// </summary>
public sealed class ProjectedItemCatalogEntryModel {
	public string ItemId { get; set; } = string.Empty;
	public string DisplayName { get; set; } = string.Empty;
	public string Category { get; set; } = string.Empty;
	public string Icon { get; set; } = string.Empty;
}
