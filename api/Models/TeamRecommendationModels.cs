using System;
using System.Collections.Generic;

namespace OrganizedJihad.Api.Models;

/// <summary>
/// Response payload for the Team Recommendation Engine endpoint.
/// </summary>
public class TeamRecommendationEngineResponse {
	/// <summary>
	/// Normalized mode identifier used for scoring.
	/// </summary>
	public string Mode { get; set; } = "arena";

	/// <summary>
	/// Recommendation objective profile.
	/// </summary>
	public string Objective { get; set; } = "balanced";

	/// <summary>
	/// Number of recommendation cards returned.
	/// </summary>
	public int Limit { get; set; }

	/// <summary>
	/// Current roster summary used by the engine.
	/// </summary>
	public TeamRosterSummary Roster { get; set; } = new();

	/// <summary>
	/// Ranked recommendation cards.
	/// </summary>
	public List<TeamRecommendationCard> Recommendations { get; set; } = [];

	/// <summary>
	/// UTC timestamp when engine output was generated.
	/// </summary>
	public DateTime GeneratedAtUtc { get; set; }
}

/// <summary>
/// Summary of current roster and key resource state.
/// </summary>
public class TeamRosterSummary {
	/// <summary>
	/// Total distinct heroes in latest known roster snapshot.
	/// </summary>
	public int HeroCount { get; set; }

	/// <summary>
	/// Total distinct titans in latest known roster snapshot.
	/// </summary>
	public int TitanCount { get; set; }

	/// <summary>
	/// Total distinct pets in latest known roster snapshot.
	/// </summary>
	public int PetCount { get; set; }

	/// <summary>
	/// Latest known player team power.
	/// </summary>
	public int TeamPower { get; set; }

	/// <summary>
	/// Latest known gold balance.
	/// </summary>
	public long Gold { get; set; }

	/// <summary>
	/// Latest known emerald balance.
	/// </summary>
	public int Emeralds { get; set; }
}

/// <summary>
/// Single team recommendation produced by the engine.
/// </summary>
public class TeamRecommendationCard {
	/// <summary>
	/// Recommendation source category (history, synthetic, hybrid).
	/// </summary>
	public string Source { get; set; } = "synthetic";

	/// <summary>
	/// Human-readable team preview for UI.
	/// </summary>
	public string TeamPreview { get; set; } = string.Empty;

	/// <summary>
	/// Suggested context label (attack, defense, speed, sustain, etc.).
	/// </summary>
	public string ContextTag { get; set; } = "balanced";

	/// <summary>
	/// Name of the active scoring profile used to rank this card.
	/// </summary>
	public string ModeProfile { get; set; } = string.Empty;

	/// <summary>
	/// Estimated win probability (0..1).
	/// </summary>
	public double EstimatedWinProbability { get; set; }

	/// <summary>
	/// Roster readiness score (0..1).
	/// </summary>
	public double ReadinessScore { get; set; }

	/// <summary>
	/// Engine confidence score (0..1).
	/// </summary>
	public double ConfidenceScore { get; set; }

	/// <summary>
	/// Final blended ranking score.
	/// </summary>
	public double FinalScore { get; set; }

	/// <summary>
	/// Human-readable explanation for recommendation.
	/// </summary>
	public string Rationale { get; set; } = string.Empty;

	/// <summary>
	/// Provenance records describing which inputs influenced this recommendation.
	/// </summary>
	public List<TeamRecommendationProvenance> Provenance { get; set; } = [];
}

/// <summary>
/// Provenance metadata for a recommendation input source.
/// </summary>
public class TeamRecommendationProvenance {
	/// <summary>
	/// Source type category (history, simulator, external, roster).
	/// </summary>
	public string SourceType { get; set; } = string.Empty;

	/// <summary>
	/// Human-readable source name.
	/// </summary>
	public string SourceName { get; set; } = string.Empty;

	/// <summary>
	/// Optional source URL for traceability.
	/// </summary>
	public string? SourceUrl { get; set; }

	/// <summary>
	/// Confidence score for this source contribution (0..1).
	/// </summary>
	public double Confidence { get; set; }

	/// <summary>
	/// Optional short detail about how the source influenced ranking.
	/// </summary>
	public string Detail { get; set; } = string.Empty;

	/// <summary>
	/// Optional structured contribution payload for numeric explainability.
	/// </summary>
	public TeamRecommendationContribution? Contribution { get; set; }
}

/// <summary>
/// Structured numeric contribution details for a recommendation provenance record.
/// </summary>
public class TeamRecommendationContribution {
	/// <summary>
	/// Optional win-probability component value (0..1).
	/// </summary>
	public double? WinProbability { get; set; }

	/// <summary>
	/// Optional readiness component value (0..1).
	/// </summary>
	public double? Readiness { get; set; }

	/// <summary>
	/// Optional confidence component value (0..1).
	/// </summary>
	public double? Confidence { get; set; }

	/// <summary>
	/// Optional win weight used by the active profile.
	/// </summary>
	public double? WinWeight { get; set; }

	/// <summary>
	/// Optional readiness weight used by the active profile.
	/// </summary>
	public double? ReadinessWeight { get; set; }

	/// <summary>
	/// Optional confidence weight used by the active profile.
	/// </summary>
	public double? ConfidenceWeight { get; set; }

	/// <summary>
	/// Optional base score before external-signal adjustments.
	/// </summary>
	public double? BaseScore { get; set; }

	/// <summary>
	/// Optional final score after adjustments.
	/// </summary>
	public double? FinalScore { get; set; }

	/// <summary>
	/// Optional external bonus amount added to base score.
	/// </summary>
	public double? ExternalBonus { get; set; }

	/// <summary>
	/// Optional source-scale multiplier used for external bonus.
	/// </summary>
	public double? SourceScale { get; set; }

	/// <summary>
	/// Optional mode-specific external signal weight.
	/// </summary>
	public double? ExternalModeWeight { get; set; }

	/// <summary>
	/// Optional source confidence used for bonus contribution.
	/// </summary>
	public double? SourceConfidence { get; set; }

	/// <summary>
	/// Optional roster-friction penalty applied before external bonus.
	/// </summary>
	public double? FrictionPenalty { get; set; }

	/// <summary>
	/// Optional normalized resource pressure score (0..1, higher means more scarcity).
	/// </summary>
	public double? ResourcePressure { get; set; }

	/// <summary>
	/// Optional calibration multiplier applied to friction penalty.
	/// </summary>
	public double? CalibrationScale { get; set; }
}

/// <summary>
/// Metadata payload describing supported Team Recommendation Engine profiles.
/// </summary>
public class TeamRecommendationProfileMetadataResponse {
	/// <summary>
	/// UTC timestamp when metadata was generated.
	/// </summary>
	public DateTime GeneratedAtUtc { get; set; }

	/// <summary>
	/// Default mode used by clients.
	/// </summary>
	public string DefaultMode { get; set; } = "arena";

	/// <summary>
	/// Default objective used by clients.
	/// </summary>
	public string DefaultObjective { get; set; } = "balanced";

	/// <summary>
	/// Supported mode options with display labels.
	/// </summary>
	public List<TeamRecommendationModeOption> Modes { get; set; } = [];

	/// <summary>
	/// Supported objective options with display labels.
	/// </summary>
	public List<TeamRecommendationObjectiveOption> Objectives { get; set; } = [];

	/// <summary>
	/// Resolved profile weights for each mode/objective pair.
	/// </summary>
	public List<TeamRecommendationProfileDefinition> Profiles { get; set; } = [];

	/// <summary>
	/// Mode-specific external signal influence weights.
	/// </summary>
	public List<TeamRecommendationExternalSignalModeWeight> ExternalSignalModeWeights { get; set; } = [];
}

/// <summary>
/// Mode option entry for Team Recommendation Engine UI controls.
/// </summary>
public class TeamRecommendationModeOption {
	/// <summary>
	/// Mode value used in API queries.
	/// </summary>
	public string Value { get; set; } = string.Empty;

	/// <summary>
	/// Human-readable mode label.
	/// </summary>
	public string Label { get; set; } = string.Empty;

	/// <summary>
	/// Default calibration trend window for this mode.
	/// </summary>
	public int PreferredTrendWindowDays { get; set; } = 30;

	/// <summary>
	/// Whether PreferredTrendWindowDays was explicitly saved by the user.
	/// </summary>
	public bool IsUserPreference { get; set; }

	/// <summary>
	/// Supported calibration trend window options.
	/// </summary>
	public List<int> SupportedTrendWindowDays { get; set; } = [7, 30, 90];
}

/// <summary>
/// Request payload for saving Team Recommendation trend preferences.
/// </summary>
public class TeamRecommendationTrendPreferenceUpdateRequest {
	/// <summary>
	/// Mode to update.
	/// </summary>
	public string Mode { get; set; } = "arena";

	/// <summary>
	/// Preferred trend window in days.
	/// </summary>
	public int PreferredTrendWindowDays { get; set; } = 30;
}

/// <summary>
/// Team Recommendation trend preference response payload.
/// </summary>
public class TeamRecommendationTrendPreferenceResponse {
	/// <summary>
	/// UTC timestamp when preference payload was generated.
	/// </summary>
	public DateTime GeneratedAtUtc { get; set; }

	/// <summary>
	/// Per-mode trend preference entries.
	/// </summary>
	public List<TeamRecommendationModeTrendPreference> Modes { get; set; } = [];
}

/// <summary>
/// Per-mode trend preference entry.
/// </summary>
public class TeamRecommendationModeTrendPreference {
	/// <summary>
	/// Mode identifier.
	/// </summary>
	public string Mode { get; set; } = "arena";

	/// <summary>
	/// Preferred trend window in days.
	/// </summary>
	public int PreferredTrendWindowDays { get; set; } = 30;

	/// <summary>
	/// Supported trend window options for this mode.
	/// </summary>
	public List<int> SupportedTrendWindowDays { get; set; } = [7, 30, 90];
}

/// <summary>
/// Objective option entry for Team Recommendation Engine UI controls.
/// </summary>
public class TeamRecommendationObjectiveOption {
	/// <summary>
	/// Objective value used in API queries.
	/// </summary>
	public string Value { get; set; } = string.Empty;

	/// <summary>
	/// Human-readable objective label.
	/// </summary>
	public string Label { get; set; } = string.Empty;
}

/// <summary>
/// Profile definition entry with normalized weights.
/// </summary>
public class TeamRecommendationProfileDefinition {
	/// <summary>
	/// Mode value.
	/// </summary>
	public string Mode { get; set; } = string.Empty;

	/// <summary>
	/// Objective value.
	/// </summary>
	public string Objective { get; set; } = string.Empty;

	/// <summary>
	/// Profile identifier used in recommendation cards.
	/// </summary>
	public string ProfileName { get; set; } = string.Empty;

	/// <summary>
	/// Weight assigned to win-probability component.
	/// </summary>
	public double WinWeight { get; set; }

	/// <summary>
	/// Weight assigned to readiness component.
	/// </summary>
	public double ReadinessWeight { get; set; }

	/// <summary>
	/// Weight assigned to confidence component.
	/// </summary>
	public double ConfidenceWeight { get; set; }
}

/// <summary>
/// Mode-specific external signal influence definition.
/// </summary>
public class TeamRecommendationExternalSignalModeWeight {
	/// <summary>
	/// Mode value.
	/// </summary>
	public string Mode { get; set; } = string.Empty;

	/// <summary>
	/// Influence factor (0..1) applied to external signal bonuses.
	/// </summary>
	public double ExternalSignalWeight { get; set; }
}

/// <summary>
/// Backtest response payload for Team Recommendation Engine calibration.
/// </summary>
public class TeamRecommendationBacktestResponse {
	/// <summary>
	/// Mode used for backtesting.
	/// </summary>
	public string Mode { get; set; } = "arena";

	/// <summary>
	/// Objective profile used for generated recommendations.
	/// </summary>
	public string Objective { get; set; } = "balanced";

	/// <summary>
	/// Lookback window in days used for historical battle matching.
	/// </summary>
	public int LookbackDays { get; set; }

	/// <summary>
	/// Number of recommendation cards evaluated.
	/// </summary>
	public int EvaluatedTeamCount { get; set; }

	/// <summary>
	/// Number of recommendation cards that matched historical battle samples.
	/// </summary>
	public int MatchedTeamCount { get; set; }

	/// <summary>
	/// Number of historical samples scanned in the lookback period.
	/// </summary>
	public int TotalBattleSamples { get; set; }

	/// <summary>
	/// Number of historical samples used by matched recommendation cards.
	/// </summary>
	public int MatchedBattleSamples { get; set; }

	/// <summary>
	/// Mean predicted win probability across evaluated cards (0..1).
	/// </summary>
	public double MeanPredictedWin { get; set; }

	/// <summary>
	/// Mean observed win rate across matched cards (0..1).
	/// </summary>
	public double MeanActualWin { get; set; }

	/// <summary>
	/// Mean absolute error between predicted and observed win rates.
	/// </summary>
	public double MeanAbsoluteError { get; set; }

	/// <summary>
	/// Mean Brier score across matched cards (lower is better).
	/// </summary>
	public double MeanBrierScore { get; set; }

	/// <summary>
	/// Qualitative calibration label (good/fair/poor/no-data/unsupported).
	/// </summary>
	public string CalibrationQuality { get; set; } = "no-data";

	/// <summary>
	/// Optional informational note for unsupported modes or missing data.
	/// </summary>
	public string? Note { get; set; }

	/// <summary>
	/// Per-team calibration details.
	/// </summary>
	public List<TeamRecommendationBacktestCard> Teams { get; set; } = [];

	/// <summary>
	/// UTC timestamp when backtest output was generated.
	/// </summary>
	public DateTime GeneratedAtUtc { get; set; }
}

/// <summary>
/// Per-team backtest calibration record.
/// </summary>
public class TeamRecommendationBacktestCard {
	/// <summary>
	/// Team preview string.
	/// </summary>
	public string TeamPreview { get; set; } = string.Empty;

	/// <summary>
	/// Predicted win probability from recommendation card (0..1).
	/// </summary>
	public double PredictedWinProbability { get; set; }

	/// <summary>
	/// Observed win rate from matched historical battles (0..1).
	/// </summary>
	public double? ActualWinRate { get; set; }

	/// <summary>
	/// Number of historical battles matched to this team.
	/// </summary>
	public int MatchedSamples { get; set; }

	/// <summary>
	/// Absolute prediction error for this team.
	/// </summary>
	public double? AbsoluteError { get; set; }

	/// <summary>
	/// Brier score for this team.
	/// </summary>
	public double? BrierScore { get; set; }

	/// <summary>
	/// Drift from prediction to observation (actual - predicted).
	/// </summary>
	public double? Drift { get; set; }
}

/// <summary>
/// Response payload describing persisted calibration state and suggested friction scaling.
/// </summary>
public class TeamRecommendationCalibrationResponse {
	/// <summary>
	/// Requested mode for calibration lookup.
	/// </summary>
	public string Mode { get; set; } = "arena";

	/// <summary>
	/// Preferred trend window used to infer the suggested friction scale.
	/// </summary>
	public int PreferredTrendWindowDays { get; set; } = 30;

	/// <summary>
	/// Supported trend window options that clients can request.
	/// </summary>
	public List<int> SupportedTrendWindowDays { get; set; } = [7, 30, 90];

	/// <summary>
	/// Suggested friction multiplier for this mode.
	/// </summary>
	public double SuggestedFrictionScale { get; set; } = 1d;

	/// <summary>
	/// Running mean absolute error from historical backtests.
	/// </summary>
	public double MeanAbsoluteError { get; set; }

	/// <summary>
	/// Running mean Brier score from historical backtests.
	/// </summary>
	public double MeanBrierScore { get; set; }

	/// <summary>
	/// Running prediction bias (predicted - actual).
	/// </summary>
	public double PredictionBias { get; set; }

	/// <summary>
	/// Number of backtest updates recorded for this mode.
	/// </summary>
	public int Samples { get; set; }

	/// <summary>
	/// Last objective that updated this calibration mode.
	/// </summary>
	public string LastObjective { get; set; } = string.Empty;

	/// <summary>
	/// UTC timestamp when calibration state was last updated.
	/// </summary>
	public DateTime? LastUpdatedUtc { get; set; }

	/// <summary>
	/// UTC timestamp when this calibration response was generated.
	/// </summary>
	public DateTime GeneratedAtUtc { get; set; }

	/// <summary>
	/// Trend windows computed from recent calibration observations.
	/// </summary>
	public List<TeamRecommendationCalibrationTrendWindow> TrendWindows { get; set; } = [];
}

/// <summary>
/// Calibration trend metrics for a specific recent-day window.
/// </summary>
public class TeamRecommendationCalibrationTrendWindow {
	/// <summary>
	/// Trend window size in days.
	/// </summary>
	public int WindowDays { get; set; }

	/// <summary>
	/// Number of observations contributing to this window.
	/// </summary>
	public int Samples { get; set; }

	/// <summary>
	/// Mean absolute error in the window.
	/// </summary>
	public double MeanAbsoluteError { get; set; }

	/// <summary>
	/// Mean Brier score in the window.
	/// </summary>
	public double MeanBrierScore { get; set; }

	/// <summary>
	/// Mean prediction bias in the window.
	/// </summary>
	public double PredictionBias { get; set; }

	/// <summary>
	/// Suggested friction scale inferred from this window.
	/// </summary>
	public double SuggestedFrictionScale { get; set; } = 1d;

	/// <summary>
	/// UTC timestamp of the most recent observation in this window.
	/// </summary>
	public DateTime? LastUpdatedUtc { get; set; }
}

/// <summary>
/// Compact operations summary payload for recommendation calibration health by mode.
/// </summary>
public class TeamRecommendationOperationsSummaryResponse {
	/// <summary>
	/// Trend window used for calibration projection in this summary.
	/// </summary>
	public int PreferredTrendWindowDays { get; set; } = 30;

	/// <summary>
	/// Per-mode recommendation operations summaries.
	/// </summary>
	public List<TeamRecommendationModeOperationsSummary> Modes { get; set; } = [];

	/// <summary>
	/// UTC timestamp when the summary payload was generated.
	/// </summary>
	public DateTime GeneratedAtUtc { get; set; }
}

/// <summary>
/// Per-mode recommendation calibration and readiness summary.
/// </summary>
public class TeamRecommendationModeOperationsSummary {
	/// <summary>
	/// Recommendation mode key.
	/// </summary>
	public string Mode { get; set; } = "arena";

	/// <summary>
	/// Suggested friction scale for this mode and trend window.
	/// </summary>
	public double SuggestedFrictionScale { get; set; } = 1d;

	/// <summary>
	/// Mean absolute error in calibration state.
	/// </summary>
	public double MeanAbsoluteError { get; set; }

	/// <summary>
	/// Mean Brier score in calibration state.
	/// </summary>
	public double MeanBrierScore { get; set; }

	/// <summary>
	/// Prediction bias for this mode.
	/// </summary>
	public double PredictionBias { get; set; }

	/// <summary>
	/// Number of calibration samples for this mode.
	/// </summary>
	public int Samples { get; set; }

	/// <summary>
	/// Indicates whether the mode appears stale for operations monitoring.
	/// </summary>
	public bool IsStale { get; set; }

	/// <summary>
	/// UTC timestamp of last calibration update for this mode.
	/// </summary>
	public DateTime? LastUpdatedUtc { get; set; }
}
