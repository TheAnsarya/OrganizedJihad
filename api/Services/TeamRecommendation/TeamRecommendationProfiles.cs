using System;
using System.Collections.Generic;
using System.Linq;

namespace OrganizedJihad.Api.Services.TeamRecommendation;

/// <summary>
/// Resolved scoring profile used by the Team Recommendation Engine.
/// </summary>
public sealed record TeamRecommendationScoringProfile(
	string ProfileName,
	double WinWeight,
	double ReadinessWeight,
	double ConfidenceWeight
);

/// <summary>
/// Catalog of scoring profiles by mode and objective.
/// </summary>
public static class TeamRecommendationProfileCatalog {
	/// <summary>
	/// Supported mode values.
	/// </summary>
	public static IReadOnlyList<string> SupportedModes { get; } = ["arena", "grandarena", "guildwar", "cow", "campaign", "adventure", "dungeon", "toe"];

	/// <summary>
	/// Supported objective values.
	/// </summary>
	public static IReadOnlyList<string> SupportedObjectives { get; } = ["balanced", "offense", "defense", "speed", "sustain"];

	/// <summary>
	/// Resolve a scoring profile for the specified mode and objective.
	/// </summary>
	public static TeamRecommendationScoringProfile Resolve(string mode, string objective) {
		var normalizedMode = TeamRecommendationModeNormalization.NormalizeMode(mode);
		var normalizedObjective = TeamRecommendationModeNormalization.NormalizeObjective(objective);

		var objectiveWeights = normalizedObjective switch {
			"offense" => (Win: 0.60, Ready: 0.20, Conf: 0.20),
			"defense" => (Win: 0.35, Ready: 0.40, Conf: 0.25),
			"speed" => (Win: 0.55, Ready: 0.30, Conf: 0.15),
			"sustain" => (Win: 0.40, Ready: 0.35, Conf: 0.25),
			_ => (Win: 0.50, Ready: 0.30, Conf: 0.20),
		};

		var modeAdjustment = normalizedMode switch {
			"campaign" => (Win: 0.05, Ready: -0.02, Conf: -0.03),
			"adventure" => (Win: 0.03, Ready: 0.00, Conf: -0.03),
			"dungeon" => (Win: 0.02, Ready: 0.02, Conf: -0.04),
			"guildwar" => (Win: -0.03, Ready: 0.05, Conf: -0.02),
			"toe" => (Win: -0.02, Ready: 0.06, Conf: -0.04),
			"cow" => (Win: -0.05, Ready: 0.08, Conf: -0.03),
			_ => (Win: 0.00, Ready: 0.00, Conf: 0.00),
		};

		var win = Math.Clamp(objectiveWeights.Win + modeAdjustment.Win, 0.20, 0.75);
		var ready = Math.Clamp(objectiveWeights.Ready + modeAdjustment.Ready, 0.15, 0.60);
		var conf = Math.Clamp(objectiveWeights.Conf + modeAdjustment.Conf, 0.10, 0.40);
		var total = win + ready + conf;

		return new TeamRecommendationScoringProfile(
			$"{normalizedMode}:{normalizedObjective}",
			win / total,
			ready / total,
			conf / total
		);
	}

	/// <summary>
	/// Build mode options with display labels for UI controls.
	/// </summary>
	public static IReadOnlyList<(string Value, string Label)> BuildModeOptions() {
		return SupportedModes
			.Select(m => (m, ToTitleLabel(m)))
			.ToList();
	}

	/// <summary>
	/// Returns the default calibration trend window used by recommendation friction scaling.
	/// </summary>
	public static int GetDefaultCalibrationTrendWindowDays(string mode) {
		var normalizedMode = TeamRecommendationModeNormalization.NormalizeMode(mode);
		return normalizedMode switch {
			"arena" => 7,
			"grandarena" => 30,
			"guildwar" => 30,
			"cow" => 90,
			"campaign" => 30,
			"adventure" => 30,
			"dungeon" => 30,
			"toe" => 90,
			_ => 30,
		};
	}

	/// <summary>
	/// Build objective options with display labels for UI controls.
	/// </summary>
	public static IReadOnlyList<(string Value, string Label)> BuildObjectiveOptions() {
		return SupportedObjectives
			.Select(o => (o, ToTitleLabel(o)))
			.ToList();
	}

	private static string ToTitleLabel(string value) {
		switch ((value ?? string.Empty).Trim().ToLowerInvariant()) {
			case "grandarena":
				return "Grand Arena";
			case "guildwar":
				return "Guild War";
			case "cow":
				return "CoW";
			case "toe":
				return "ToE";
		}

		if (string.IsNullOrWhiteSpace(value)) {
			return string.Empty;
		}

		return string.Join(" ", value
			.Split(['-', '_'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
			.Select(token => char.ToUpperInvariant(token[0]) + token[1..]));
	}

}
