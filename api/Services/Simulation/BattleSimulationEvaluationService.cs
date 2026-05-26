using System;
using System.Collections.Generic;
using System.Linq;

namespace OrganizedJihad.Api.Services.Simulation;

/// <summary>
/// Evaluation summary for simulator calibration checks.
/// </summary>
public sealed class BattleSimulationEvaluationResult {
	/// <summary>
	/// Number of observations evaluated.
	/// </summary>
	public int ObservationCount { get; init; }

	/// <summary>
	/// Mean Brier score (lower is better).
	/// </summary>
	public double BrierScore { get; init; }

	/// <summary>
	/// Mean absolute error between estimate and outcome.
	/// </summary>
	public double MeanAbsoluteError { get; init; }
}

/// <summary>
/// Helper service for offline simulator quality checks.
/// </summary>
public sealed class BattleSimulationEvaluationService {
	/// <summary>
	/// Evaluate a sequence of predictions against binary outcomes.
	/// </summary>
	public BattleSimulationEvaluationResult Evaluate(IEnumerable<(double Probability, bool Win)> observations) {
		var materialized = observations?.ToList() ?? [];
		if (materialized.Count == 0) {
			return new BattleSimulationEvaluationResult {
				ObservationCount = 0,
				BrierScore = 0,
				MeanAbsoluteError = 0,
			};
		}

		var brier = materialized.Average(x => {
			var expected = Math.Clamp(x.Probability, 0, 1);
			var actual = x.Win ? 1.0 : 0.0;
			var diff = expected - actual;
			return diff * diff;
		});

		var mae = materialized.Average(x => Math.Abs(Math.Clamp(x.Probability, 0, 1) - (x.Win ? 1.0 : 0.0)));

		return new BattleSimulationEvaluationResult {
			ObservationCount = materialized.Count,
			BrierScore = brier,
			MeanAbsoluteError = mae,
		};
	}
}
