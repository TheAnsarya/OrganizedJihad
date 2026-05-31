using System;
using System.Collections.Generic;
using System.Linq;

namespace OrganizedJihad.Api.Services.TeamRecommendation;

/// <summary>
/// External signal contribution used by the Team Recommendation Engine.
/// </summary>
public sealed record ExternalRecommendationSignal(
	string SourceName,
	string SourceType,
	double Confidence,
	string Detail,
	string? SourceUrl = null
);

/// <summary>
/// Contract for providers that contribute external, reference-only recommendation signals.
/// </summary>
public interface IExternalRecommendationSignalProvider {
	/// <summary>
	/// Return external signals for the specified mode/objective pair.
	/// </summary>
	IReadOnlyList<ExternalRecommendationSignal> GetSignals(string mode, string objective);
}

/// <summary>
/// Curated provider that maps known community tools to gameplay modes.
/// </summary>
public sealed class CuratedToolCatalogSignalProvider : IExternalRecommendationSignalProvider {
	/// <summary>
	/// Mode-specific influence map used to scale external-signal confidence.
	/// </summary>
	public static readonly IReadOnlyDictionary<string, double> ModeExternalSignalWeights = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase) {
		["arena"] = 0.10,
		["grandarena"] = 0.09,
		["guildwar"] = 0.12,
		["cow"] = 0.13,
		["campaign"] = 0.11,
		["adventure"] = 0.11,
		["dungeon"] = 0.12,
		["toe"] = 0.12,
	};

	/// <inheritdoc />
	public IReadOnlyList<ExternalRecommendationSignal> GetSignals(string mode, string objective) {
		var normalizedMode = TeamRecommendationModeNormalization.NormalizeMode(mode);
		var normalizedObjective = TeamRecommendationModeNormalization.NormalizeObjective(objective);
		var modeWeight = GetModeExternalSignalWeight(normalizedMode);

		var signals = new List<ExternalRecommendationSignal> {
			new(
				SourceName: "Hero Wars Simulator (Chrome Extension)",
				SourceType: "external",
				Confidence: 0.80,
				Detail: "Community simulation reference baseline for PvP lineup checks.",
				SourceUrl: "https://chromewebstore.google.com/detail/hero-wars-simulator/oolajlfdlkcekemoilmmhkajgneokggb"
			),
			new(
				SourceName: "HW-Simulator",
				SourceType: "external",
				Confidence: 0.76,
				Detail: "Reference signal for simulator-oriented matchup assumptions.",
				SourceUrl: "https://www.hw-simulator.com/"
			),
			new(
				SourceName: "Hero Wars Calculator Hub",
				SourceType: "external",
				Confidence: 0.78,
				Detail: "Resource-planning signal used for upgrade friction awareness.",
				SourceUrl: "https://www.hwcalculator.com/"
			),
		};

		if (normalizedMode is "campaign" or "adventure" or "dungeon") {
			signals.Add(new ExternalRecommendationSignal(
				SourceName: "Hero Wars Hub",
				SourceType: "external",
				Confidence: 0.74,
				Detail: "Guide-oriented PvE strategy signal.",
				SourceUrl: "https://herowarshub.com/"
			));
		}

		if (normalizedMode is "guildwar" or "cow" or "toe") {
			signals.Add(new ExternalRecommendationSignal(
				SourceName: "Hero Wars Central",
				SourceType: "external",
				Confidence: 0.72,
				Detail: "Guild/tournament tactical guide signal.",
				SourceUrl: "https://www.herowarscentral.com/"
			));
		}

		var objectiveBias = normalizedObjective switch {
			"offense" => 0.03,
			"defense" => 0.02,
			"speed" => 0.01,
			"sustain" => 0.02,
			_ => 0.00,
		};

		return signals
			.Select(s => s with {
				Confidence = Math.Clamp(s.Confidence + objectiveBias + modeWeight, 0d, 1d),
				Detail = $"{s.Detail} Applied mode weight {modeWeight:F2} and objective bias {objectiveBias:F2}."
			})
			.OrderByDescending(s => s.Confidence)
			.ToList();
	}

	/// <summary>
	/// Resolve mode-specific external signal weight used by engine scoring.
	/// </summary>
	public static double GetModeExternalSignalWeight(string mode) {
		var normalizedMode = TeamRecommendationModeNormalization.NormalizeMode(mode);
		return ModeExternalSignalWeights.TryGetValue(normalizedMode, out var weight)
			? weight
			: 0.10;
	}
}
