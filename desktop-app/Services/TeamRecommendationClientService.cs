using System.Net.Http.Json;

namespace OrganizedJihad.Desktop.Services;

/// <summary>
/// Provides typed desktop access to Team Recommendation API endpoints.
/// </summary>
public class TeamRecommendationClientService {
	private readonly RecommendationSettingsService _recommendationSettings;

	public TeamRecommendationClientService(RecommendationSettingsService recommendationSettings) {
		_recommendationSettings = recommendationSettings;
	}

	/// <summary>
	/// Loads persisted mode trend preferences.
	/// </summary>
	public async Task<TeamRecommendationPreferencesFetchResult> GetTrendPreferencesAsync() {
		try {
			var baseUrl = _recommendationSettings.GetRecommendationApiBaseUrl().TrimEnd('/');
			using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
			var payload = await client.GetFromJsonAsync<TeamRecommendationTrendPreferenceResponseModel>($"{baseUrl}/api/sync/teams/recommendations/preferences");

			if (payload is null) {
				return TeamRecommendationPreferencesFetchResult.Failure("Team Recommendation preferences endpoint returned no payload.");
			}

			payload.Modes = payload.Modes
				.Where(m => !string.IsNullOrWhiteSpace(m.Mode))
				.OrderBy(m => m.Mode)
				.ToList();

			return TeamRecommendationPreferencesFetchResult.Success(payload);
		} catch (Exception ex) {
			return TeamRecommendationPreferencesFetchResult.Failure($"Team Recommendation preferences unavailable: {ex.Message}");
		}
	}

	/// <summary>
	/// Saves the preferred trend window for a mode.
	/// </summary>
	public async Task<TeamRecommendationOperationResult> SaveTrendPreferenceAsync(string mode, int preferredTrendWindowDays) {
		if (string.IsNullOrWhiteSpace(mode)) {
			return TeamRecommendationOperationResult.Failure("Mode is required.");
		}

		if (preferredTrendWindowDays is not (7 or 30 or 90)) {
			return TeamRecommendationOperationResult.Failure("Supported trend windows are 7, 30, and 90 days.");
		}

		try {
			var baseUrl = _recommendationSettings.GetRecommendationApiBaseUrl().TrimEnd('/');
			using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
			var response = await client.PutAsJsonAsync(
				$"{baseUrl}/api/sync/teams/recommendations/preferences",
				new TeamRecommendationTrendPreferenceUpdateRequestModel {
					Mode = mode,
					PreferredTrendWindowDays = preferredTrendWindowDays,
				});

			if (!response.IsSuccessStatusCode) {
				return TeamRecommendationOperationResult.Failure($"Failed to save preference for {mode}: HTTP {(int)response.StatusCode}");
			}

			return TeamRecommendationOperationResult.Success($"Saved trend window preference for {mode}: {preferredTrendWindowDays}d");
		} catch (Exception ex) {
			return TeamRecommendationOperationResult.Failure($"Save failed for {mode}: {ex.Message}");
		}
	}

	/// <summary>
	/// Loads calibration metrics for a mode.
	/// </summary>
	public async Task<TeamRecommendationCalibrationFetchResult> GetCalibrationAsync(string mode) {
		if (string.IsNullOrWhiteSpace(mode)) {
			return TeamRecommendationCalibrationFetchResult.Failure("Calibration mode is required.");
		}

		try {
			var baseUrl = _recommendationSettings.GetRecommendationApiBaseUrl().TrimEnd('/');
			using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
			var payload = await client.GetFromJsonAsync<TeamRecommendationCalibrationResponseModel>($"{baseUrl}/api/sync/teams/recommendations/calibration?mode={Uri.EscapeDataString(mode)}");
			if (payload is null) {
				return TeamRecommendationCalibrationFetchResult.Failure($"Calibration endpoint returned no payload for {mode}.");
			}

			return TeamRecommendationCalibrationFetchResult.Success(payload);
		} catch (Exception ex) {
			return TeamRecommendationCalibrationFetchResult.Failure($"Calibration unavailable for {mode}: {ex.Message}");
		}
	}
}

/// <summary>
/// Result envelope for trend preference fetches.
/// </summary>
public sealed class TeamRecommendationPreferencesFetchResult {
	public bool IsSuccess { get; private init; }
	public string Message { get; private init; } = string.Empty;
	public TeamRecommendationTrendPreferenceResponseModel? Payload { get; private init; }

	public static TeamRecommendationPreferencesFetchResult Success(TeamRecommendationTrendPreferenceResponseModel payload) {
		return new TeamRecommendationPreferencesFetchResult {
			IsSuccess = true,
			Payload = payload,
			Message = $"Loaded {payload.Modes.Count} mode preference entries.",
		};
	}

	public static TeamRecommendationPreferencesFetchResult Failure(string message) {
		return new TeamRecommendationPreferencesFetchResult {
			IsSuccess = false,
			Message = message,
		};
	}
}

/// <summary>
/// Result envelope for calibration fetches.
/// </summary>
public sealed class TeamRecommendationCalibrationFetchResult {
	public bool IsSuccess { get; private init; }
	public string Message { get; private init; } = string.Empty;
	public TeamRecommendationCalibrationResponseModel? Payload { get; private init; }

	public static TeamRecommendationCalibrationFetchResult Success(TeamRecommendationCalibrationResponseModel payload) {
		return new TeamRecommendationCalibrationFetchResult {
			IsSuccess = true,
			Payload = payload,
			Message = $"Loaded calibration for mode {payload.Mode}.",
		};
	}

	public static TeamRecommendationCalibrationFetchResult Failure(string message) {
		return new TeamRecommendationCalibrationFetchResult {
			IsSuccess = false,
			Message = message,
		};
	}
}

/// <summary>
/// Result envelope for write operations.
/// </summary>
public sealed class TeamRecommendationOperationResult {
	public bool IsSuccess { get; private init; }
	public string Message { get; private init; } = string.Empty;

	public static TeamRecommendationOperationResult Success(string message) {
		return new TeamRecommendationOperationResult {
			IsSuccess = true,
			Message = message,
		};
	}

	public static TeamRecommendationOperationResult Failure(string message) {
		return new TeamRecommendationOperationResult {
			IsSuccess = false,
			Message = message,
		};
	}
}

/// <summary>
/// Team recommendation trend preference response payload.
/// </summary>
public sealed class TeamRecommendationTrendPreferenceResponseModel {
	public List<TeamRecommendationModePreferenceModel> Modes { get; set; } = [];
}

/// <summary>
/// Per-mode trend preference model.
/// </summary>
public sealed class TeamRecommendationModePreferenceModel {
	public string Mode { get; set; } = string.Empty;
	public int PreferredTrendWindowDays { get; set; } = 30;
	public List<int> SupportedTrendWindowDays { get; set; } = [7, 30, 90];
}

/// <summary>
/// Request payload for trend preference updates.
/// </summary>
public sealed class TeamRecommendationTrendPreferenceUpdateRequestModel {
	public string Mode { get; set; } = "arena";
	public int PreferredTrendWindowDays { get; set; } = 30;
}

/// <summary>
/// Team recommendation calibration response payload.
/// </summary>
public sealed class TeamRecommendationCalibrationResponseModel {
	public string Mode { get; set; } = "arena";
	public double SuggestedFrictionScale { get; set; }
	public double MeanAbsoluteError { get; set; }
	public double MeanBrierScore { get; set; }
	public double PredictionBias { get; set; }
	public int Samples { get; set; }
	public int PreferredTrendWindowDays { get; set; } = 30;
	public List<TeamRecommendationCalibrationTrendWindowModel> TrendWindows { get; set; } = [];
}

/// <summary>
/// Calibration trend-window model.
/// </summary>
public sealed class TeamRecommendationCalibrationTrendWindowModel {
	public int WindowDays { get; set; }
	public int Samples { get; set; }
	public double MeanAbsoluteError { get; set; }
	public double MeanBrierScore { get; set; }
	public double PredictionBias { get; set; }
	public double SuggestedFrictionScale { get; set; }
}
