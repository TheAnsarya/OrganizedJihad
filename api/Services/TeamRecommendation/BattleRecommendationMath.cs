using OrganizedJihad.Api.Models;
using OrganizedJihad.Api.Services.Simulation;

namespace OrganizedJihad.Api.Services.TeamRecommendation;

/// <summary>
/// Shared math/orchestration helpers for building historical battle recommendations.
/// </summary>
public static class BattleRecommendationMath {
	public sealed record TeamRecommendationBattleSample(
		string TeamKey,
		bool IsWin,
		long OpponentId,
		int OpponentPower,
		DateTime Timestamp
	);

	public static string NormalizeBattleType(string? battleType) {
		var normalized = (battleType ?? "arena").Trim().ToLowerInvariant();
		return normalized is "arena" or "grandarena" or "titanarena"
			? normalized
			: "arena";
	}

	public static int ResolvePowerWindow(int powerWindow) {
		return Math.Clamp(powerWindow, 10000, 500000);
	}

	public static int ResolveMinSamples(int minSamples) {
		return Math.Clamp(minSamples, 1, 100);
	}

	public static int ResolveRecommendationLimit(int limit) {
		return Math.Clamp(limit, 1, 20);
	}

	public static string NormalizeTeamKey(string? teamKey) {
		if (string.IsNullOrWhiteSpace(teamKey)) {
			return "[unknown]";
		}

		var trimmed = teamKey.Trim();
		return trimmed.Length <= 1024
			? trimmed
			: trimmed[..1024];
	}

	public static List<TeamRecommendationBattleSample> ApplyOpponentFilters(
		IEnumerable<TeamRecommendationBattleSample> samples,
		long? opponentId,
		int? opponentPower,
		int powerWindow
	) {
		var filtered = samples;

		if (opponentId.HasValue) {
			filtered = filtered.Where(s => s.OpponentId == opponentId.Value);
		}

		if (opponentPower.HasValue) {
			var minPower = Math.Max(0, opponentPower.Value - powerWindow);
			var maxPower = opponentPower.Value + powerWindow;
			filtered = filtered.Where(s => s.OpponentPower >= minPower && s.OpponentPower <= maxPower);
		}

		return [.. filtered];
	}

	public static double ComputeBaselineWinRate(IReadOnlyList<TeamRecommendationBattleSample> samples) {
		if (samples.Count == 0) {
			return 0d;
		}

		return samples.Count(s => s.IsWin) / (double)samples.Count;
	}

	public static List<BattleRecommendationCandidate> BuildCandidates(
		IReadOnlyList<TeamRecommendationBattleSample> samples,
		string normalizedBattleType,
		IBattleSimulator simulator,
		int? opponentPower,
		int minSamples,
		int limit,
		DateTime nowUtc
	) {
		var candidates = samples
			.Where(s => !string.IsNullOrWhiteSpace(s.TeamKey) && s.TeamKey != "[unknown]")
			.GroupBy(s => s.TeamKey)
			.Select(group => BuildCandidate(group, normalizedBattleType, simulator, opponentPower, nowUtc))
			.Where(candidate => candidate.Battles >= minSamples)
			.OrderByDescending(candidate => candidate.Score)
			.ThenByDescending(candidate => candidate.Battles)
			.Take(limit)
			.ToList();

		return candidates;
	}

	private static BattleRecommendationCandidate BuildCandidate(
		IGrouping<string, TeamRecommendationBattleSample> group,
		string normalizedBattleType,
		IBattleSimulator simulator,
		int? opponentPower,
		DateTime nowUtc
	) {
		var groupSamples = group.ToList();
		var battles = groupSamples.Count;
		var wins = groupSamples.Count(s => s.IsWin);
		var losses = battles - wins;
		var winRate = battles == 0 ? 0d : wins / (double)battles;
		var weightedWinRate = ComputeRecencyWeightedWinRate(groupSamples, nowUtc);
		var confidence = Math.Min(1d, battles / 20d);
		var avgOpponentPower = (int)Math.Round(groupSamples.Average(s => s.OpponentPower));
		var lastSeen = groupSamples.Max(s => s.Timestamp);

		var simulation = simulator.Simulate(new BattleSimulationInput {
			BattleType = normalizedBattleType,
			HistoricalWinRate = winRate,
			WeightedWinRate = weightedWinRate,
			SampleCount = battles,
			TeamPower = avgOpponentPower,
			OpponentPower = opponentPower ?? avgOpponentPower,
		}, runs: 2000);

		var score = (simulation.EstimatedWinProbability * 0.75d) + (confidence * 0.25d);

		return new BattleRecommendationCandidate {
			TeamKey = group.Key,
			TeamPreview = TeamRecommendationScoringMath.BuildTeamPreview(group.Key),
			Battles = battles,
			Wins = wins,
			Losses = losses,
			WinRate = Math.Round(winRate, 4),
			WeightedWinRate = Math.Round(weightedWinRate, 4),
			Confidence = Math.Round(confidence, 4),
			Score = Math.Round(score, 4),
			SimulatedWinProbability = Math.Round(simulation.EstimatedWinProbability, 4),
			SimulationRuns = simulation.Runs,
			SimulationConfidenceLow = Math.Round(simulation.ConfidenceLow, 4),
			SimulationConfidenceHigh = Math.Round(simulation.ConfidenceHigh, 4),
			AverageOpponentPower = avgOpponentPower,
			LastSeen = lastSeen,
			Rationale = BuildRationale(wins, battles, weightedWinRate, simulation.EstimatedWinProbability, confidence),
		};
	}

	private static double ComputeRecencyWeightedWinRate(
		IReadOnlyList<TeamRecommendationBattleSample> samples,
		DateTime nowUtc
	) {
		var weightedSamples = samples.Select(sample => {
			var ageDays = Math.Max(0d, (nowUtc - sample.Timestamp).TotalDays);
			var weight = Math.Exp(-ageDays / 30d);
			return new { sample, weight };
		}).ToList();

		var totalWeight = weightedSamples.Sum(x => x.weight);
		if (totalWeight <= 0d) {
			return 0d;
		}

		var weightedWins = weightedSamples.Where(x => x.sample.IsWin).Sum(x => x.weight);
		return weightedWins / totalWeight;
	}

	private static string BuildRationale(int wins, int battles, double weightedWinRate, double simulatedWinProbability, double confidence) {
		return $"{wins}/{battles} wins, weighted {weightedWinRate:P1}, simulated {simulatedWinProbability:P1}, confidence {confidence:P0}";
	}
}
