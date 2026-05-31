namespace OrganizedJihad.Api.Services.TeamRecommendation;

/// <summary>
/// Shared canonical normalization for Team Recommendation mode/objective values.
/// Keeping this centralized prevents alias drift across orchestration, scoring,
/// profile metadata, and external signal weighting paths.
/// </summary>
public static class TeamRecommendationModeNormalization {
	private static readonly HashSet<string> KnownModeTokens = new(StringComparer.OrdinalIgnoreCase) {
		"arena",
		"pvp",
		"ranked",
		"grandarena",
		"ga",
		"titanarena",
		"ta",
		"guildwar",
		"gw",
		"cow",
		"clashofworlds",
		"campaign",
		"camp",
		"adventure",
		"adv",
		"dungeon",
		"titandungeon",
		"dungeonrun",
		"toe",
		"tournamentofelements",
		"powertournament",
	};

	private static readonly HashSet<string> KnownObjectiveTokens = new(StringComparer.OrdinalIgnoreCase) {
		"balanced",
		"balance",
		"default",
		"standard",
		"offense",
		"offensive",
		"attack",
		"atk",
		"damage",
		"dps",
		"burst",
		"defense",
		"defensive",
		"tank",
		"fortify",
		"speed",
		"fast",
		"tempo",
		"sustain",
		"survival",
		"endurance",
		"attrition",
		"healing",
		"heal",
	};

	/// <summary>
	/// Normalize a raw mode value to canonical supported mode keys.
	/// </summary>
	public static string NormalizeMode(string? mode) {
		var collapsed = CollapseToken(mode, "arena");
		return collapsed switch {
			"arena" or "pvp" or "ranked" => "arena",
			"grandarena" or "ga" => "grandarena",
			"titanarena" or "ta" => "arena",
			"guildwar" or "gw" => "guildwar",
			"cow" or "clashofworlds" => "cow",
			"campaign" or "camp" => "campaign",
			"adventure" or "adv" => "adventure",
			"dungeon" or "titandungeon" or "dungeonrun" => "dungeon",
			"toe" or "tournamentofelements" or "powertournament" => "toe",
			_ => "arena",
		};
	}

	/// <summary>
	/// Normalize a raw objective value to canonical supported objective keys.
	/// </summary>
	public static string NormalizeObjective(string? objective) {
		var collapsed = CollapseToken(objective, "balanced");
		return collapsed switch {
			"offense" or "offensive" or "attack" or "atk" or "damage" or "dps" or "burst" => "offense",
			"defense" or "defensive" or "tank" or "fortify" => "defense",
			"speed" or "fast" or "tempo" => "speed",
			"sustain" or "survival" or "endurance" or "attrition" or "healing" or "heal" => "sustain",
			"balanced" or "balance" or "default" or "standard" => "balanced",
			_ => "balanced",
		};
	}

	/// <summary>
	/// Determines whether a mode value resolves to a canonical supported mode.
	/// </summary>
	public static bool IsKnownMode(string? mode) {
		var collapsed = CollapseToken(mode, string.Empty);
		return !string.IsNullOrWhiteSpace(collapsed) && KnownModeTokens.Contains(collapsed);
	}

	/// <summary>
	/// Determines whether an objective value resolves to a canonical supported objective.
	/// </summary>
	public static bool IsKnownObjective(string? objective) {
		var collapsed = CollapseToken(objective, string.Empty);
		return !string.IsNullOrWhiteSpace(collapsed) && KnownObjectiveTokens.Contains(collapsed);
	}

	private static string CollapseToken(string? value, string fallback) {
		var normalized = (value ?? fallback).Trim().ToLowerInvariant();
		if (string.IsNullOrWhiteSpace(normalized)) {
			return fallback;
		}

		var compact = new char[normalized.Length];
		var index = 0;
		foreach (var ch in normalized) {
			if (char.IsLetterOrDigit(ch)) {
				compact[index++] = ch;
			}
		}

		if (index <= 0) {
			return fallback;
		}

		return new string(compact, 0, index);
	}
}
