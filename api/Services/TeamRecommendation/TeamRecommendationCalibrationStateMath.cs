using OrganizedJihad.Api.Models;

namespace OrganizedJihad.Api.Services.TeamRecommendation;

/// <summary>
/// Helpers for Team Recommendation calibration state and trend-window math.
/// </summary>
internal static class TeamRecommendationCalibrationStateMath {
	/// <summary>
	/// Resolves the preferred trend window for a mode from explicit override, persisted preferences, mode state, or defaults.
	/// </summary>
	public static int ResolvePreferredCalibrationTrendWindowDays(
		TeamRecommendationCalibrationModeState? modeState,
		TeamRecommendationTrendPreferenceState? preferenceState,
		string mode,
		int? preferredTrendWindowDays,
		IReadOnlyList<int> supportedTrendWindows
	) {
		if (preferredTrendWindowDays.HasValue && IsSupportedCalibrationTrendWindow(preferredTrendWindowDays.Value, supportedTrendWindows)) {
			return preferredTrendWindowDays.Value;
		}

		if (preferenceState != null &&
			preferenceState.ModeTrendWindowDays.TryGetValue(mode, out var preferredByMode) &&
			IsSupportedCalibrationTrendWindow(preferredByMode, supportedTrendWindows)) {
			return preferredByMode;
		}

		if (modeState != null && IsSupportedCalibrationTrendWindow(modeState.PreferredTrendWindowDays, supportedTrendWindows)) {
			return modeState.PreferredTrendWindowDays;
		}

		return TeamRecommendationProfileCatalog.GetDefaultCalibrationTrendWindowDays(mode);
	}

	/// <summary>
	/// Resolves mode preferred trend window with profile fallback.
	/// </summary>
	public static int ResolveModePreferredTrendWindowDays(
		string mode,
		TeamRecommendationTrendPreferenceState preferenceState,
		IReadOnlyList<int> supportedTrendWindows
	) {
		if (preferenceState.ModeTrendWindowDays.TryGetValue(mode, out var preferredWindowDays) && IsSupportedCalibrationTrendWindow(preferredWindowDays, supportedTrendWindows)) {
			return preferredWindowDays;
		}

		return TeamRecommendationProfileCatalog.GetDefaultCalibrationTrendWindowDays(mode);
	}

	/// <summary>
	/// Returns true when trend window is in the supported set.
	/// </summary>
	public static bool IsSupportedCalibrationTrendWindow(int trendWindowDays, IReadOnlyList<int> supportedTrendWindows) {
		return supportedTrendWindows.Contains(trendWindowDays);
	}

	/// <summary>
	/// Resolves suggested friction scale, preferring trend-window calculation when samples exist.
	/// </summary>
	public static double ResolveSuggestedScaleFromModeState(TeamRecommendationCalibrationModeState modeState, int preferredWindowDays, DateTime nowUtc) {
		var preferred = BuildCalibrationTrendWindow(modeState, preferredWindowDays, nowUtc);
		if (preferred.Samples > 0) {
			return Math.Clamp(preferred.SuggestedFrictionScale, 0.65d, 1.45d);
		}

		return Math.Clamp(modeState.SuggestedFrictionScale, 0.65d, 1.45d);
	}

	/// <summary>
	/// Builds trend-window metrics for each requested window.
	/// </summary>
	public static List<TeamRecommendationCalibrationTrendWindow> BuildCalibrationTrendWindows(
		TeamRecommendationCalibrationModeState modeState,
		IReadOnlyList<int> windows,
		DateTime nowUtc
	) {
		var result = new List<TeamRecommendationCalibrationTrendWindow>();
		foreach (var window in windows.Distinct().OrderBy(w => w)) {
			if (window <= 0) {
				continue;
			}

			result.Add(BuildCalibrationTrendWindow(modeState, window, nowUtc));
		}

		return result;
	}

	/// <summary>
	/// Applies backtest metrics to mode state and appends a timestamped observation.
	/// </summary>
	public static void ApplyBacktestObservation(
		TeamRecommendationCalibrationModeState modeState,
		TeamRecommendationTrendPreferenceState preferenceState,
		TeamRecommendationBacktestResponse backtest,
		DateTime nowUtc,
		IReadOnlyList<int> supportedTrendWindows
	) {
		var nextSamples = Math.Max(1, modeState.Samples + 1);
		modeState.MeanAbsoluteError = ((modeState.MeanAbsoluteError * modeState.Samples) + backtest.MeanAbsoluteError) / nextSamples;
		modeState.MeanBrierScore = ((modeState.MeanBrierScore * modeState.Samples) + backtest.MeanBrierScore) / nextSamples;
		var bias = backtest.MeanPredictedWin - backtest.MeanActualWin;
		modeState.PredictionBias = ((modeState.PredictionBias * modeState.Samples) + bias) / nextSamples;
		modeState.Samples = nextSamples;
		modeState.LastObjective = backtest.Objective;
		modeState.LastUpdatedUtc = nowUtc;
		modeState.PreferredTrendWindowDays = ResolvePreferredCalibrationTrendWindowDays(modeState, preferenceState, backtest.Mode, null, supportedTrendWindows);
		modeState.SuggestedFrictionScale = Math.Clamp(1d + (modeState.PredictionBias * 0.85d), 0.65d, 1.45d);
		modeState.Observations.Add(new TeamRecommendationCalibrationObservation {
			TimestampUtc = nowUtc,
			MeanAbsoluteError = Math.Clamp(backtest.MeanAbsoluteError, 0d, 1d),
			MeanBrierScore = Math.Clamp(backtest.MeanBrierScore, 0d, 1d),
			PredictionBias = Math.Clamp(backtest.MeanPredictedWin - backtest.MeanActualWin, -1d, 1d),
			MatchedTeams = Math.Max(0, backtest.MatchedTeamCount),
			MatchedSamples = Math.Max(0, backtest.MatchedBattleSamples),
			Objective = backtest.Objective,
		});

		var cutoff = nowUtc.AddDays(-120);
		modeState.Observations = modeState.Observations
			.Where(observation => observation.TimestampUtc >= cutoff)
			.OrderByDescending(observation => observation.TimestampUtc)
			.Take(256)
			.OrderBy(observation => observation.TimestampUtc)
			.ToList();
	}

	private static TeamRecommendationCalibrationTrendWindow BuildCalibrationTrendWindow(
		TeamRecommendationCalibrationModeState modeState,
		int windowDays,
		DateTime nowUtc
	) {
		var cutoff = nowUtc.AddDays(-windowDays);
		var observations = modeState.Observations
			.Where(observation => observation.TimestampUtc >= cutoff)
			.OrderBy(observation => observation.TimestampUtc)
			.ToList();

		if (observations.Count == 0) {
			return new TeamRecommendationCalibrationTrendWindow {
				WindowDays = windowDays,
				Samples = 0,
				MeanAbsoluteError = 0d,
				MeanBrierScore = 0d,
				PredictionBias = 0d,
				SuggestedFrictionScale = Math.Clamp(modeState.SuggestedFrictionScale, 0.65d, 1.45d),
				LastUpdatedUtc = modeState.LastUpdatedUtc,
			};
		}

		var mae = observations.Average(observation => observation.MeanAbsoluteError);
		var brier = observations.Average(observation => observation.MeanBrierScore);
		var bias = observations.Average(observation => observation.PredictionBias);

		return new TeamRecommendationCalibrationTrendWindow {
			WindowDays = windowDays,
			Samples = observations.Count,
			MeanAbsoluteError = Math.Round(Math.Clamp(mae, 0d, 1d), 6),
			MeanBrierScore = Math.Round(Math.Clamp(brier, 0d, 1d), 6),
			PredictionBias = Math.Round(Math.Clamp(bias, -1d, 1d), 6),
			SuggestedFrictionScale = Math.Round(Math.Clamp(1d + (bias * 0.85d), 0.65d, 1.45d), 6),
			LastUpdatedUtc = observations.Max(observation => observation.TimestampUtc),
		};
	}
}

/// <summary>
/// Serialized calibration state persisted in SyncMetadata.
/// </summary>
internal sealed class TeamRecommendationCalibrationState {
	public Dictionary<string, TeamRecommendationCalibrationModeState> Modes { get; set; } = new(StringComparer.OrdinalIgnoreCase);
	public DateTime UpdatedAtUtc { get; set; }
}

/// <summary>
/// Serialized trend preference state persisted in SyncMetadata.
/// </summary>
internal sealed class TeamRecommendationTrendPreferenceState {
	public Dictionary<string, int> ModeTrendWindowDays { get; set; } = new(StringComparer.OrdinalIgnoreCase);
	public DateTime UpdatedAtUtc { get; set; }
}

/// <summary>
/// Per-mode calibration aggregate and historical observations.
/// </summary>
internal sealed class TeamRecommendationCalibrationModeState {
	public double SuggestedFrictionScale { get; set; } = 1d;
	public int PreferredTrendWindowDays { get; set; } = 30;
	public double MeanAbsoluteError { get; set; }
	public double MeanBrierScore { get; set; }
	public double PredictionBias { get; set; }
	public int Samples { get; set; }
	public string LastObjective { get; set; } = string.Empty;
	public DateTime? LastUpdatedUtc { get; set; }
	public List<TeamRecommendationCalibrationObservation> Observations { get; set; } = [];
}

/// <summary>
/// Single calibration observation snapshot.
/// </summary>
internal sealed class TeamRecommendationCalibrationObservation {
	public DateTime TimestampUtc { get; set; }
	public double MeanAbsoluteError { get; set; }
	public double MeanBrierScore { get; set; }
	public double PredictionBias { get; set; }
	public int MatchedTeams { get; set; }
	public int MatchedSamples { get; set; }
	public string Objective { get; set; } = string.Empty;
}
