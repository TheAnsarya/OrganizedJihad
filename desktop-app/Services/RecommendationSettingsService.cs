using Microsoft.Maui.Storage;

namespace OrganizedJihad.Desktop.Services;

/// <summary>
/// Provides persisted configuration values used by recommendation features.
/// </summary>
public class RecommendationSettingsService {
	private const string RecommendationApiBaseUrlPreferenceKey = "recommendationApiBaseUrl";
	private const string DefaultRecommendationApiBaseUrl = "http://localhost:5124";

	/// <summary>
	/// Gets the configured recommendation API base URL.
	/// </summary>
	public string GetRecommendationApiBaseUrl() {
		var configured = Preferences.Default.Get(RecommendationApiBaseUrlPreferenceKey, DefaultRecommendationApiBaseUrl);
		configured = (configured ?? string.Empty).Trim();
		return string.IsNullOrWhiteSpace(configured)
			? DefaultRecommendationApiBaseUrl
			: configured.TrimEnd('/');
	}

	/// <summary>
	/// Stores a recommendation API base URL and returns the normalized value.
	/// </summary>
	public string SaveRecommendationApiBaseUrl(string? baseUrl) {
		var normalized = (baseUrl ?? string.Empty).Trim();
		if (string.IsNullOrWhiteSpace(normalized)) {
			normalized = DefaultRecommendationApiBaseUrl;
		}

		normalized = normalized.TrimEnd('/');
		Preferences.Default.Set(RecommendationApiBaseUrlPreferenceKey, normalized);
		return normalized;
	}
}
