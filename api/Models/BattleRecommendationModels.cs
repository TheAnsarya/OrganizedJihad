using System;
using System.Collections.Generic;

namespace OrganizedJihad.Api.Models;

/// <summary>
/// Response payload for battle recommendation queries.
/// </summary>
public class BattleRecommendationResponse {
	/// <summary>
	/// Battle type used for recommendation generation: arena, grandarena, or titanarena.
	/// </summary>
	public string BattleType { get; set; } = "arena";

	/// <summary>
	/// Optional opponent filter used during query.
	/// </summary>
	public long? OpponentId { get; set; }

	/// <summary>
	/// Optional opponent power filter center value.
	/// </summary>
	public int? OpponentPower { get; set; }

	/// <summary>
	/// Power window applied when OpponentPower is provided.
	/// </summary>
	public int PowerWindow { get; set; }

	/// <summary>
	/// Minimum samples per team candidate.
	/// </summary>
	public int MinSamples { get; set; }

	/// <summary>
	/// Maximum candidates returned.
	/// </summary>
	public int Limit { get; set; }

	/// <summary>
	/// Number of raw battle samples evaluated after filters.
	/// </summary>
	public int SampleCount { get; set; }

	/// <summary>
	/// Unweighted baseline win rate across all filtered samples.
	/// </summary>
	public double BaselineWinRate { get; set; }

	/// <summary>
	/// Ranked recommendation candidates.
	/// </summary>
	public List<BattleRecommendationCandidate> Recommendations { get; set; } = [];

	/// <summary>
	/// Optional note describing fallback behavior or sparse-data context.
	/// </summary>
	public string? Note { get; set; }

	/// <summary>
	/// UTC timestamp when recommendations were generated.
	/// </summary>
	public DateTime GeneratedAtUtc { get; set; }
}

/// <summary>
/// Single recommendation candidate derived from historical battles.
/// </summary>
public class BattleRecommendationCandidate {
	/// <summary>
	/// Canonical team key used for grouping.
	/// </summary>
	public string TeamKey { get; set; } = string.Empty;

	/// <summary>
	/// Truncated view for UI display.
	/// </summary>
	public string TeamPreview { get; set; } = string.Empty;

	/// <summary>
	/// Number of battles seen with this team key.
	/// </summary>
	public int Battles { get; set; }

	/// <summary>
	/// Number of wins.
	/// </summary>
	public int Wins { get; set; }

	/// <summary>
	/// Number of losses.
	/// </summary>
	public int Losses { get; set; }

	/// <summary>
	/// Raw win rate (0..1) over all samples.
	/// </summary>
	public double WinRate { get; set; }

	/// <summary>
	/// Recency-weighted win rate (0..1).
	/// </summary>
	public double WeightedWinRate { get; set; }

	/// <summary>
	/// Confidence score based on sample volume (0..1).
	/// </summary>
	public double Confidence { get; set; }

	/// <summary>
	/// Composite score used for ranking (higher is better).
	/// </summary>
	public double Score { get; set; }

	/// <summary>
	/// Simulator-estimated win probability (0..1).
	/// </summary>
	public double SimulatedWinProbability { get; set; }

	/// <summary>
	/// Number of Monte Carlo runs used by the simulator.
	/// </summary>
	public int SimulationRuns { get; set; }

	/// <summary>
	/// Lower confidence bound of the simulated win probability.
	/// </summary>
	public double SimulationConfidenceLow { get; set; }

	/// <summary>
	/// Upper confidence bound of the simulated win probability.
	/// </summary>
	public double SimulationConfidenceHigh { get; set; }

	/// <summary>
	/// Average opponent power seen for this team key.
	/// </summary>
	public int AverageOpponentPower { get; set; }

	/// <summary>
	/// Last observed battle timestamp for this team key.
	/// </summary>
	public DateTime LastSeen { get; set; }

	/// <summary>
	/// Human-readable reason string for UI display.
	/// </summary>
	public string Rationale { get; set; } = string.Empty;
}
