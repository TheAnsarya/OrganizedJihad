using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Api.Models;
using OrganizedJihad.Api.Services.Simulation;
using OrganizedJihad.Api.Services.TeamRecommendation;
using OrganizedJihad.Data;

namespace OrganizedJihad.Api.Tests;

/// <summary>
/// Focused regression tests for extracted Team Recommendation helper modules.
/// </summary>
public class TeamRecommendationMathTests {
	[Fact]
	public void NormalizeBattleType_Should_Map_Supported_Values() {
		BattleRecommendationMath.NormalizeBattleType("arena").Should().Be("arena");
		BattleRecommendationMath.NormalizeBattleType("grandarena").Should().Be("grandarena");
		BattleRecommendationMath.NormalizeBattleType("titanarena").Should().Be("titanarena");
	}

	[Fact]
	public void NormalizeBattleType_Should_Fallback_To_Arena_For_Unknown() {
		BattleRecommendationMath.NormalizeBattleType("invalid-mode").Should().Be("arena");
		BattleRecommendationMath.NormalizeBattleType(null).Should().Be("arena");
	}

	[Fact]
	public void ResolvePowerWindow_Should_Clamp_To_Supported_Range() {
		BattleRecommendationMath.ResolvePowerWindow(1).Should().Be(10000);
		BattleRecommendationMath.ResolvePowerWindow(9999999).Should().Be(500000);
		BattleRecommendationMath.ResolvePowerWindow(120000).Should().Be(120000);
	}

	[Fact]
	public void ResolveMinSamples_Should_Clamp_To_Supported_Range() {
		BattleRecommendationMath.ResolveMinSamples(0).Should().Be(1);
		BattleRecommendationMath.ResolveMinSamples(101).Should().Be(100);
		BattleRecommendationMath.ResolveMinSamples(4).Should().Be(4);
	}

	[Fact]
	public void ResolveRecommendationLimit_Should_Clamp_To_Supported_Range() {
		BattleRecommendationMath.ResolveRecommendationLimit(0).Should().Be(1);
		BattleRecommendationMath.ResolveRecommendationLimit(50).Should().Be(20);
		BattleRecommendationMath.ResolveRecommendationLimit(7).Should().Be(7);
	}

	[Fact]
	public void NormalizeTeamKey_Should_Handle_Unknown_Trim_And_Truncate() {
		BattleRecommendationMath.NormalizeTeamKey(null).Should().Be("[unknown]");
		BattleRecommendationMath.NormalizeTeamKey("   ").Should().Be("[unknown]");
		BattleRecommendationMath.NormalizeTeamKey("  heroA,heroB ").Should().Be("heroA,heroB");

		var longValue = new string('x', 1050);
		BattleRecommendationMath.NormalizeTeamKey(longValue).Length.Should().Be(1024);
	}

	[Fact]
	public void ApplyOpponentFilters_Should_Filter_By_OpponentId() {
		var now = DateTime.UtcNow;
		var samples = new List<BattleRecommendationMath.TeamRecommendationBattleSample> {
			new("A", true, 10, 100000, now),
			new("B", false, 11, 100000, now),
		};

		var filtered = BattleRecommendationMath.ApplyOpponentFilters(samples, opponentId: 10, opponentPower: null, powerWindow: 100000);
		filtered.Should().HaveCount(1);
		filtered[0].OpponentId.Should().Be(10);
	}

	[Fact]
	public void ApplyOpponentFilters_Should_Filter_By_OpponentPower_Window() {
		var now = DateTime.UtcNow;
		var samples = new List<BattleRecommendationMath.TeamRecommendationBattleSample> {
			new("A", true, 10, 100000, now),
			new("B", true, 10, 150000, now),
			new("C", true, 10, 205000, now),
		};

		var filtered = BattleRecommendationMath.ApplyOpponentFilters(samples, opponentId: null, opponentPower: 150000, powerWindow: 50000);
		filtered.Select(s => s.TeamKey).Should().BeEquivalentTo(["A", "B"]);
	}

	[Fact]
	public void ComputeBaselineWinRate_Should_Return_Expected_Fraction() {
		var now = DateTime.UtcNow;
		var samples = new List<BattleRecommendationMath.TeamRecommendationBattleSample> {
			new("A", true, 1, 1, now),
			new("A", true, 1, 1, now),
			new("A", false, 1, 1, now),
		};

		BattleRecommendationMath.ComputeBaselineWinRate(samples).Should().BeApproximately(0.6666667, 0.000001);
		BattleRecommendationMath.ComputeBaselineWinRate([]).Should().Be(0d);
	}

	[Fact]
	public void BuildCandidates_Should_Exclude_Unknown_Or_Empty_Teams() {
		var now = DateTime.UtcNow;
		var simulator = new FakeBattleSimulator();
		var samples = new List<BattleRecommendationMath.TeamRecommendationBattleSample> {
			new("[unknown]", true, 1, 100000, now),
			new("", true, 1, 100000, now),
			new("A_B_C", true, 1, 100000, now),
			new("A_B_C", false, 1, 101000, now),
		};

		var candidates = BattleRecommendationMath.BuildCandidates(samples, "arena", simulator, null, minSamples: 1, limit: 10, now);
		candidates.Should().HaveCount(1);
		candidates[0].TeamKey.Should().Be("A_B_C");
	}

	[Fact]
	public void BuildCandidates_Should_Order_By_Score_Then_Battles() {
		var now = DateTime.UtcNow;
		var simulator = new FakeBattleSimulator();
		var samples = new List<BattleRecommendationMath.TeamRecommendationBattleSample> {
			new("A_A_A", true, 1, 100000, now.AddDays(-1)),
			new("A_A_A", true, 1, 100000, now.AddDays(-2)),
			new("A_A_A", true, 1, 100000, now.AddDays(-3)),
			new("B_B_B", true, 1, 100000, now.AddDays(-1)),
			new("B_B_B", false, 1, 100000, now.AddDays(-2)),
			new("C_C_C", true, 1, 100000, now.AddDays(-1)),
		};

		var candidates = BattleRecommendationMath.BuildCandidates(samples, "arena", simulator, 100000, minSamples: 1, limit: 3, now);
		candidates.Should().HaveCount(3);
		candidates.First().TeamKey.Should().Be("A_A_A");
	}

	[Fact]
	public void BuildCandidates_Should_Respect_MinSamples_And_Limit() {
		var now = DateTime.UtcNow;
		var simulator = new FakeBattleSimulator();
		var samples = new List<BattleRecommendationMath.TeamRecommendationBattleSample> {
			new("A", true, 1, 100000, now),
			new("A", true, 1, 100000, now),
			new("B", true, 1, 100000, now),
			new("C", true, 1, 100000, now),
			new("C", false, 1, 100000, now),
		};

		var candidates = BattleRecommendationMath.BuildCandidates(samples, "arena", simulator, null, minSamples: 2, limit: 1, now);
		candidates.Should().HaveCount(1);
		candidates[0].Battles.Should().BeGreaterThanOrEqualTo(2);
	}

	[Fact]
	public void NormalizeMode_Should_Handle_Aliases_And_Defaults() {
		TeamRecommendationOrchestrationMath.NormalizeMode("pvp").Should().Be("arena");
		TeamRecommendationOrchestrationMath.NormalizeMode("grand_arena").Should().Be("grandarena");
		TeamRecommendationOrchestrationMath.NormalizeMode("ga").Should().Be("grandarena");
		TeamRecommendationOrchestrationMath.NormalizeMode("titan-arena").Should().Be("arena");
		TeamRecommendationOrchestrationMath.NormalizeMode("gw").Should().Be("guildwar");
		TeamRecommendationOrchestrationMath.NormalizeMode("clash-of-worlds").Should().Be("cow");
		TeamRecommendationOrchestrationMath.NormalizeMode("dungeon-run").Should().Be("dungeon");
		TeamRecommendationOrchestrationMath.NormalizeMode("titan-dungeon").Should().Be("dungeon");
		TeamRecommendationOrchestrationMath.NormalizeMode("power-tournament").Should().Be("toe");
		TeamRecommendationOrchestrationMath.NormalizeMode("tournament-of-elements").Should().Be("toe");
		TeamRecommendationOrchestrationMath.NormalizeMode("unknown").Should().Be("arena");
	}

	[Fact]
	public void SharedModeNormalizer_Should_Stay_Aligned_With_Orchestration() {
		var samples = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
			["arena"] = "arena",
			["pvp"] = "arena",
			["ga"] = "grandarena",
			["grand_arena"] = "grandarena",
			["titan-arena"] = "arena",
			["gw"] = "guildwar",
			["clash-of-worlds"] = "cow",
			["dungeon-run"] = "dungeon",
			["power-tournament"] = "toe",
			["unknown"] = "arena",
		};

		foreach (var (input, expected) in samples) {
			TeamRecommendationModeNormalization.NormalizeMode(input).Should().Be(expected);
			TeamRecommendationOrchestrationMath.NormalizeMode(input).Should().Be(expected);
		}

		TeamRecommendationModeNormalization.NormalizeObjective("offense").Should().Be("offense");
		TeamRecommendationModeNormalization.NormalizeObjective("invalid").Should().Be("balanced");
	}

	[Fact]
	public void NormalizeObjective_Should_Handle_Values_And_Default() {
		TeamRecommendationOrchestrationMath.NormalizeObjective("offense").Should().Be("offense");
		TeamRecommendationOrchestrationMath.NormalizeObjective("sustain").Should().Be("sustain");
		TeamRecommendationOrchestrationMath.NormalizeObjective("bad-value").Should().Be("balanced");
	}

	[Fact]
	public void ResolveRecommendationLimit_Should_Clamp_For_Orchestration() {
		TeamRecommendationOrchestrationMath.ResolveRecommendationLimit(0).Should().Be(1);
		TeamRecommendationOrchestrationMath.ResolveRecommendationLimit(50).Should().Be(10);
		TeamRecommendationOrchestrationMath.ResolveRecommendationLimit(6).Should().Be(6);
	}

	[Fact]
	public void GetExternalSignals_Should_Dedupe_By_SourceName_And_Sort_By_Confidence() {
		var providers = new List<IExternalRecommendationSignalProvider> {
			new FakeExternalSignalProvider([
				new ExternalRecommendationSignal("SourceA", "external", 0.50, "old"),
				new ExternalRecommendationSignal("sourcea", "external", 0.80, "new"),
			]),
			new FakeExternalSignalProvider([
				new ExternalRecommendationSignal("SourceB", "external", 0.60, "b"),
			]),
		};

		var signals = TeamRecommendationOrchestrationMath.GetExternalSignals(providers, "arena", "balanced");
		signals.Should().HaveCount(2);
		signals[0].SourceName.Should().Be("sourcea");
		signals[0].Confidence.Should().Be(0.80);
		signals[1].SourceName.Should().Be("SourceB");
	}

	[Fact]
	public async Task ResolveModeFrictionCalibrationScaleAsync_Should_Return_Default_When_No_Mode_Samples() {
		await using var context = CreateContext();
		var store = new FakeStateStore {
			CalibrationState = new TeamRecommendationCalibrationState {
				Modes = new Dictionary<string, TeamRecommendationCalibrationModeState>(StringComparer.OrdinalIgnoreCase)
			}
		};

		var scale = await TeamRecommendationOrchestrationMath.ResolveModeFrictionCalibrationScaleAsync(
			store,
			context,
			"arena",
			preferredTrendWindowDays: null,
			supportedTrendWindowDays: [7, 30, 90]
		);

		scale.Should().Be(1d);
	}

	[Fact]
	public async Task ResolveModeFrictionCalibrationScaleAsync_Should_Use_Mode_State_When_Samples_Exist() {
		await using var context = CreateContext();
		var now = DateTime.UtcNow;
		var modeState = new TeamRecommendationCalibrationModeState {
			Samples = 4,
			SuggestedFrictionScale = 1.30,
			PreferredTrendWindowDays = 30,
			Observations = [
				new TeamRecommendationCalibrationObservation {
					TimestampUtc = now.AddDays(-1),
					MeanAbsoluteError = 0.20,
					MeanBrierScore = 0.15,
					PredictionBias = 0.10,
					MatchedTeams = 2,
					MatchedSamples = 10,
					Objective = "balanced",
				}
			]
		};
		var store = new FakeStateStore {
			CalibrationState = new TeamRecommendationCalibrationState {
				Modes = new Dictionary<string, TeamRecommendationCalibrationModeState>(StringComparer.OrdinalIgnoreCase) {
					["arena"] = modeState,
				}
			},
		};

		var scale = await TeamRecommendationOrchestrationMath.ResolveModeFrictionCalibrationScaleAsync(
			store,
			context,
			"arena",
			preferredTrendWindowDays: 30,
			supportedTrendWindowDays: [7, 30, 90]
		);

		scale.Should().BeGreaterThan(1.0);
	}

	[Fact]
	public async Task UpdateCalibrationStateAsync_Should_Not_Save_When_No_Matched_Teams() {
		await using var context = CreateContext();
		var store = new FakeStateStore();
		var backtest = new TeamRecommendationBacktestResponse {
			Mode = "arena",
			Objective = "balanced",
			MatchedTeamCount = 0,
		};

		await TeamRecommendationOrchestrationMath.UpdateCalibrationStateAsync(store, context, backtest, [7, 30, 90]);
		store.SaveCalibrationCallCount.Should().Be(0);
	}

	[Fact]
	public async Task UpdateCalibrationStateAsync_Should_Save_When_Matched_Teams_Present() {
		await using var context = CreateContext();
		var store = new FakeStateStore {
			CalibrationState = new TeamRecommendationCalibrationState {
				Modes = new Dictionary<string, TeamRecommendationCalibrationModeState>(StringComparer.OrdinalIgnoreCase)
			}
		};
		var backtest = new TeamRecommendationBacktestResponse {
			Mode = "arena",
			Objective = "offense",
			MatchedTeamCount = 2,
			MatchedBattleSamples = 18,
			MeanAbsoluteError = 0.11,
			MeanBrierScore = 0.08,
			MeanPredictedWin = 0.62,
			MeanActualWin = 0.58,
		};

		await TeamRecommendationOrchestrationMath.UpdateCalibrationStateAsync(store, context, backtest, [7, 30, 90]);
		store.SaveCalibrationCallCount.Should().Be(1);
		store.CalibrationState.Modes.Should().ContainKey("arena");
		store.CalibrationState.Modes["arena"].Samples.Should().Be(1);
	}

	private static GameDatabaseContext CreateContext() {
		var options = new DbContextOptionsBuilder<GameDatabaseContext>()
			.UseInMemoryDatabase(Guid.NewGuid().ToString())
			.Options;
		return new GameDatabaseContext(options);
	}

	private sealed class FakeBattleSimulator : IBattleSimulator {
		public BattleSimulationResult Simulate(BattleSimulationInput input, int runs = 1500, int? seed = null) {
			var estimated = Math.Clamp((input.HistoricalWinRate * 0.8d) + (input.WeightedWinRate * 0.2d), 0d, 1d);
			return new BattleSimulationResult {
				EstimatedWinProbability = estimated,
				Runs = runs,
				ConfidenceLow = Math.Max(0d, estimated - 0.05d),
				ConfidenceHigh = Math.Min(1d, estimated + 0.05d),
			};
		}
	}

	private sealed class FakeExternalSignalProvider : IExternalRecommendationSignalProvider {
		private readonly IReadOnlyList<ExternalRecommendationSignal> _signals;

		public FakeExternalSignalProvider(IReadOnlyList<ExternalRecommendationSignal> signals) {
			_signals = signals;
		}

		public IReadOnlyList<ExternalRecommendationSignal> GetSignals(string mode, string objective) {
			return _signals;
		}
	}

	private sealed class FakeStateStore : ITeamRecommendationStateStore {
		public TeamRecommendationTrendPreferenceState TrendPreferenceState { get; set; } = new();
		public TeamRecommendationCalibrationState CalibrationState { get; set; } = new();
		public int SaveCalibrationCallCount { get; private set; }

		public Task<TeamRecommendationTrendPreferenceState> LoadTrendPreferenceStateAsync(GameDatabaseContext context) {
			return Task.FromResult(TrendPreferenceState);
		}

		public Task SaveTrendPreferenceStateAsync(GameDatabaseContext context, TeamRecommendationTrendPreferenceState state) {
			TrendPreferenceState = state;
			return Task.CompletedTask;
		}

		public Task<TeamRecommendationCalibrationState> LoadCalibrationStateAsync(GameDatabaseContext context) {
			return Task.FromResult(CalibrationState);
		}

		public Task SaveCalibrationStateAsync(GameDatabaseContext context, TeamRecommendationCalibrationState state) {
			CalibrationState = state;
			SaveCalibrationCallCount++;
			return Task.CompletedTask;
		}
	}
}
