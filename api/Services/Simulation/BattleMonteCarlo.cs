using System;

namespace OrganizedJihad.Api.Services.Simulation;

/// <summary>
/// Baseline feature extractor that blends win-rate priors with power and sample confidence.
/// </summary>
public sealed class BaselineBattleFeatureExtractor : IBattleFeatureExtractor {
	/// <inheritdoc />
	public BattleFeatureVector Extract(BattleSimulationInput input) {
		var historical = Clamp01(input.HistoricalWinRate);
		var weighted = Clamp01(input.WeightedWinRate);
		var prior = (historical * 0.35) + (weighted * 0.65);

		double powerDeltaRatio = 0;
		if (input.OpponentPower > 0) {
			powerDeltaRatio = (input.TeamPower - input.OpponentPower) / (double)input.OpponentPower;
		}
		powerDeltaRatio = Math.Clamp(powerDeltaRatio, -0.75, 0.75);

		var sampleConfidence = Math.Clamp(input.SampleCount / 30.0, 0.1, 1.0);

		return new BattleFeatureVector {
			PriorWinProbability = prior,
			PowerDeltaRatio = powerDeltaRatio,
			SampleConfidence = sampleConfidence,
		};
	}

	private static double Clamp01(double value) => Math.Clamp(value, 0.0, 1.0);
}

/// <summary>
/// Monte Carlo shell for recommendation scoring.
/// </summary>
public sealed class MonteCarloBattleSimulator : IBattleSimulator {
	private readonly IBattleFeatureExtractor _featureExtractor;

	/// <summary>
	/// Initializes a new Monte Carlo simulator.
	/// </summary>
	public MonteCarloBattleSimulator(IBattleFeatureExtractor featureExtractor) {
		_featureExtractor = featureExtractor;
	}

	/// <inheritdoc />
	public BattleSimulationResult Simulate(BattleSimulationInput input, int runs = 1500, int? seed = null) {
		if (runs <= 0) {
			runs = 1;
		}

		var features = _featureExtractor.Extract(input);
		var baseProbability = BuildBaseProbability(features);
		var rng = seed.HasValue ? new Random(seed.Value) : Random.Shared;

		int wins = 0;
		for (int i = 0; i < runs; i++) {
			if (rng.NextDouble() <= baseProbability) {
				wins++;
			}
		}

		var estimate = wins / (double)runs;
		var stdError = Math.Sqrt((estimate * (1 - estimate)) / runs);
		var low = Math.Clamp(estimate - (1.96 * stdError), 0, 1);
		var high = Math.Clamp(estimate + (1.96 * stdError), 0, 1);

		return new BattleSimulationResult {
			EstimatedWinProbability = estimate,
			Runs = runs,
			ConfidenceLow = low,
			ConfidenceHigh = high,
		};
	}

	private static double BuildBaseProbability(BattleFeatureVector features) {
		var prior = features.PriorWinProbability;
		var powerAdjustment = features.PowerDeltaRatio * 0.18;
		var confidenceAdjustment = (features.SampleConfidence - 0.5) * 0.04;
		return Math.Clamp(prior + powerAdjustment + confidenceAdjustment, 0.05, 0.95);
	}
}
