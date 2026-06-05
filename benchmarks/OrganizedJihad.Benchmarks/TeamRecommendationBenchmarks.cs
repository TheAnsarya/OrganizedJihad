using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Order;
using OrganizedJihad.Api.Services.Simulation;
using OrganizedJihad.Api.Services.TeamRecommendation;

namespace OrganizedJihad.Benchmarks;

/// <summary>
/// Performance benchmarks for Team Recommendation math and candidate generation paths.
///
/// Run with: dotnet run --project benchmarks/OrganizedJihad.Benchmarks -c Release -- --filter *TeamRecommendationBenchmarks*
/// </summary>
[MemoryDiagnoser]
[Orderer(SummaryOrderPolicy.FastestToSlowest)]
[RankColumn]
public class TeamRecommendationBenchmarks {
	private readonly IBattleSimulator _simulator = new FastDeterministicSimulator();
	private List<BattleRecommendationMath.TeamRecommendationBattleSample> _samples = [];
	private readonly DateTime _nowUtc = DateTime.UtcNow;

	[Params(200, 1000, 5000)]
	public int SampleSize { get; set; }

	[GlobalSetup]
	public void Setup() {
		var start = _nowUtc.AddDays(-30);
		_samples = Enumerable.Range(0, SampleSize)
			.Select(index => new BattleRecommendationMath.TeamRecommendationBattleSample(
				TeamKey: $"team_{index % 24}",
				IsWin: index % 3 != 0,
				OpponentId: 1000 + (index % 50),
				OpponentPower: 100000 + ((index * 137) % 250000),
				Timestamp: start.AddMinutes(index)))
			.ToList();
	}

	/// <summary>
	/// Benchmark the hot grouping/ranking path for recommendation candidates.
	/// </summary>
	[Benchmark(Description = "Build recommendation candidates")]
	public int BuildCandidates() {
		var candidates = BattleRecommendationMath.BuildCandidates(
			samples: _samples,
			normalizedBattleType: "arena",
			simulator: _simulator,
			opponentPower: 240000,
			minSamples: 3,
			limit: 10,
			nowUtc: _nowUtc);

		return candidates.Count;
	}

	/// <summary>
	/// Benchmark opponent filtering path used before candidate generation.
	/// </summary>
	[Benchmark(Description = "Apply opponent filters")]
	public List<BattleRecommendationMath.TeamRecommendationBattleSample> ApplyFilters() {
		return BattleRecommendationMath.ApplyOpponentFilters(
			samples: _samples,
			opponentId: 1015,
			opponentPower: 220000,
			powerWindow: 60000);
	}

	private sealed class FastDeterministicSimulator : IBattleSimulator {
		public BattleSimulationResult Simulate(BattleSimulationInput input, int runs = 1500, int? seed = null) {
			var powerRatio = input.OpponentPower <= 0
				? 1d
				: Math.Clamp(input.TeamPower / (double)Math.Max(1, input.OpponentPower), 0.5d, 1.5d);
			var estimate = Math.Clamp((input.WeightedWinRate * 0.75d) + (powerRatio * 0.15d), 0.05d, 0.95d);
			return new BattleSimulationResult {
				EstimatedWinProbability = estimate,
				Runs = runs,
				ConfidenceLow = Math.Max(0d, estimate - 0.05d),
				ConfidenceHigh = Math.Min(1d, estimate + 0.05d),
			};
		}
	}
}
