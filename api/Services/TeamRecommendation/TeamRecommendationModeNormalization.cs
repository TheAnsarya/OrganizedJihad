namespace OrganizedJihad.Api.Services.TeamRecommendation;

/// <summary>
/// Shared canonical normalization for Team Recommendation mode/objective values.
/// Keeping this centralized prevents alias drift across orchestration, scoring,
/// profile metadata, and external signal weighting paths.
/// </summary>
public static class TeamRecommendationModeNormalization {
	/// <summary>
	/// Normalize a raw mode value to canonical supported mode keys.
	/// </summary>
	public static string NormalizeMode(string? mode) {
		var normalized = (mode ?? "arena").Trim().ToLowerInvariant();
		return normalized switch {
			"arena" or "pvp" => "arena",
			"grandarena" or "grand_arena" or "grand-arena" or "ga" => "grandarena",
			"titanarena" or "titan_arena" or "titan-arena" or "ta" => "arena",
			"guildwar" or "guild_war" or "guild-war" or "gw" => "guildwar",
			"cow" or "clashofworlds" or "clash_of_worlds" or "clash-of-worlds" => "cow",
			"campaign" => "campaign",
			"adventure" => "adventure",
			"dungeon" or "titan_dungeon" or "titan-dungeon" or "dungeon-run" => "dungeon",
			"toe" or "tournamentofelements" or "tournament_of_elements" or "tournament-of-elements" or "powertournament" or "power_tournament" or "power-tournament" => "toe",
			_ => "arena",
		};
	}

	/// <summary>
	/// Normalize a raw objective value to canonical supported objective keys.
	/// </summary>
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
}