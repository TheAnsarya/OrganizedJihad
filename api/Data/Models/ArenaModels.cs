using System;
using System.ComponentModel.DataAnnotations;

namespace OrganizedJihad.Api.Data.Models;

/// <summary>
/// Represents a Grand Arena battle
/// </summary>
public class GrandArenaBattle {
	[Key]
	public int Id { get; set; }

	public DateTime Timestamp { get; set; }

	public long OpponentId { get; set; }

	[MaxLength(100)]
	public string OpponentName { get; set; } = string.Empty;

	public int OpponentPower { get; set; }

	public bool IsWin { get; set; }

	public int RankBefore { get; set; }

	public int RankAfter { get; set; }

	/// <summary>
	/// Attack team (compressed JSON)
	/// </summary>
	public string? AttackTeam { get; set; }

	/// <summary>
	/// Defense team (compressed JSON)
	/// </summary>
	public string? DefenseTeam { get; set; }

	/// <summary>
	/// Opponent's attack team (compressed JSON)
	/// </summary>
	public string? OpponentAttackTeam { get; set; }

	/// <summary>
	/// Opponent's defense team (compressed JSON)
	/// </summary>
	public string? OpponentDefenseTeam { get; set; }

	public int? DurationSeconds { get; set; }

	public int CoinsEarned { get; set; }
}

/// <summary>
/// Represents a Titan Arena battle
/// </summary>
public class TitanArenaBattle {
	[Key]
	public int Id { get; set; }

	public DateTime Timestamp { get; set; }

	public long OpponentId { get; set; }

	[MaxLength(100)]
	public string OpponentName { get; set; } = string.Empty;

	public int OpponentPower { get; set; }

	public bool IsWin { get; set; }

	public int RankBefore { get; set; }

	public int RankAfter { get; set; }

	/// <summary>
	/// Our titan team (compressed JSON)
	/// </summary>
	public string? OurTitanTeam { get; set; }

	/// <summary>
	/// Opponent's titan team (compressed JSON)
	/// </summary>
	public string? OpponentTitanTeam { get; set; }

	public int? DurationSeconds { get; set; }

	public int CoinsEarned { get; set; }
}
