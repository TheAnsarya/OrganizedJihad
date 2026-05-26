namespace OrganizedJihad.Api.Services.Simulation;

/// <summary>
/// Input vector for the recommendation simulator.
/// </summary>
public sealed class BattleSimulationInput {
	/// <summary>
	/// Battle mode key (arena, grandarena, titanarena).
	/// </summary>
	public string BattleType { get; init; } = string.Empty;

	/// <summary>
	/// Historical unweighted win rate from telemetry (0..1).
	/// </summary>
	public double HistoricalWinRate { get; init; }

	/// <summary>
	/// Recency-weighted win rate from telemetry (0..1).
	/// </summary>
	public double WeightedWinRate { get; init; }

	/// <summary>
	/// Number of battles observed for this candidate team.
	/// </summary>
	public int SampleCount { get; init; }

	/// <summary>
	/// Aggregate power estimate for player's team.
	/// </summary>
	public int TeamPower { get; init; }

	/// <summary>
	/// Opponent power estimate for target matchup.
	/// </summary>
	public int OpponentPower { get; init; }
}

/// <summary>
/// Feature vector derived from raw telemetry signals.
/// </summary>
public sealed class BattleFeatureVector {
	/// <summary>
	/// Blended win-rate prior before simulation.
	/// </summary>
	public double PriorWinProbability { get; init; }

	/// <summary>
	/// Team-vs-opponent power delta ratio.
	/// </summary>
	public double PowerDeltaRatio { get; init; }

	/// <summary>
	/// Confidence weight derived from sample count.
	/// </summary>
	public double SampleConfidence { get; init; }
}

/// <summary>
/// Simulator output with probability estimate and confidence bounds.
/// </summary>
public sealed class BattleSimulationResult {
	/// <summary>
	/// Simulated win probability (0..1).
	/// </summary>
	public double EstimatedWinProbability { get; init; }

	/// <summary>
	/// Number of Monte Carlo runs performed.
	/// </summary>
	public int Runs { get; init; }

	/// <summary>
	/// Lower confidence bound for estimated probability.
	/// </summary>
	public double ConfidenceLow { get; init; }

	/// <summary>
	/// Upper confidence bound for estimated probability.
	/// </summary>
	public double ConfidenceHigh { get; init; }
}

/// <summary>
/// Extracts model features from telemetry inputs.
/// </summary>
public interface IBattleFeatureExtractor {
	/// <summary>
	/// Build a normalized feature vector for simulation.
	/// </summary>
	BattleFeatureVector Extract(BattleSimulationInput input);
}

/// <summary>
/// Runs Monte Carlo battle simulations.
/// </summary>
public interface IBattleSimulator {
	/// <summary>
	/// Estimate win probability for a battle candidate.
	/// </summary>
	BattleSimulationResult Simulate(BattleSimulationInput input, int runs = 1500, int? seed = null);
}
