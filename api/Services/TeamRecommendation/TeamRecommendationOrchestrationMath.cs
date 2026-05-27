using OrganizedJihad.Api.Models;
using OrganizedJihad.Data;

namespace OrganizedJihad.Api.Services.TeamRecommendation;

/// <summary>
/// Shared orchestration helpers for Team Recommendation mode/objective resolution,
/// external signal aggregation, and calibration-state updates.
/// </summary>
public static class TeamRecommendationOrchestrationMath {
	public static string NormalizeMode(string? mode) {
		var normalized = (mode ?? "arena").Trim().ToLowerInvariant();
		return normalized switch {
			"arena" => "arena",
			"grandarena" or "grand_arena" or "grand-arena" => "grandarena",
			"guildwar" or "guild_war" or "guild-war" or "gw" => "guildwar",
			"cow" or "clashofworlds" or "clash_of_worlds" or "clash-of-worlds" => "cow",
			"campaign" => "campaign",
			"adventure" => "adventure",
			_ => "arena",
		};
	}

	public static string NormalizeObjective(string? objective) {
		var normalized = (objective ?? "balanced").Trim().ToLowerInvariant();
		return normalized switch {
			"offense" => "offense",
			"defense" => "defense",
			"speed" => "speed",
			"sustain" => "sustain",
			_ => "balanced",
		};
	}

	public static int ResolveRecommendationLimit(int limit) {
		return Math.Clamp(limit, 1, 10);
	}

	public static IReadOnlyList<ExternalRecommendationSignal> GetExternalSignals(
		IReadOnlyList<IExternalRecommendationSignalProvider> externalSignalProviders,
		string mode,
		string objective
	) {
		return [.. externalSignalProviders
			.SelectMany(provider => provider.GetSignals(mode, objective))
			.GroupBy(signal => signal.SourceName, StringComparer.OrdinalIgnoreCase)
			.Select(group => group.OrderByDescending(s => s.Confidence).First())
			.OrderByDescending(signal => signal.Confidence)];
	}

	public static async Task<double> ResolveModeFrictionCalibrationScaleAsync(
		ITeamRecommendationStateStore stateStore,
		GameDatabaseContext context,
		string mode,
		int? preferredTrendWindowDays,
		IReadOnlyList<int> supportedTrendWindowDays
	) {
		var state = await stateStore.LoadCalibrationStateAsync(context);
		var preferenceState = await stateStore.LoadTrendPreferenceStateAsync(context);
		if (state.Modes.TryGetValue(mode, out var modeState) && modeState.Samples > 0) {
			var resolvedTrendWindowDays = TeamRecommendationCalibrationStateMath.ResolvePreferredCalibrationTrendWindowDays(
				modeState,
				preferenceState,
				mode,
				preferredTrendWindowDays,
				supportedTrendWindowDays
			);
			return TeamRecommendationCalibrationStateMath.ResolveSuggestedScaleFromModeState(modeState, resolvedTrendWindowDays, DateTime.UtcNow);
		}

		return 1d;
	}

	public static async Task UpdateCalibrationStateAsync(
		ITeamRecommendationStateStore stateStore,
		GameDatabaseContext context,
		TeamRecommendationBacktestResponse backtest,
		IReadOnlyList<int> supportedTrendWindowDays
	) {
		if (backtest.MatchedTeamCount <= 0) {
			return;
		}

		var state = await stateStore.LoadCalibrationStateAsync(context);
		var preferenceState = await stateStore.LoadTrendPreferenceStateAsync(context);
		if (!state.Modes.TryGetValue(backtest.Mode, out var modeState)) {
			modeState = new TeamRecommendationCalibrationModeState();
			state.Modes[backtest.Mode] = modeState;
		}

		TeamRecommendationCalibrationStateMath.ApplyBacktestObservation(
			modeState,
			preferenceState,
			backtest,
			DateTime.UtcNow,
			supportedTrendWindowDays
		);

		state.UpdatedAtUtc = DateTime.UtcNow;
		await stateStore.SaveCalibrationStateAsync(context, state);
	}
}
