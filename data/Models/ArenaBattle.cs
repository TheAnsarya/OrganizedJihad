using OrganizedJihad.Data.Entities;
using System;
using System.ComponentModel.DataAnnotations;

namespace OrganizedJihad.Data.Models;

/// <summary>
/// Represents a regular Arena battle.
///
/// Immutable Record: Battle results captured from game API, never modified.
/// Inherits from CreationAuditableEntity for audit trail (DateCreated, CreatedBy).
/// </summary>
public class ArenaBattle : CreationAuditableEntity {
	[Key]
	public int Id { get; set; }

	/// <summary>
	/// When the battle occurred
	/// </summary>
	public DateTime Timestamp { get; set; }

	/// <summary>
	/// Opponent's user ID
	/// </summary>
	public long OpponentId { get; set; }

	/// <summary>
	/// Opponent's username
	/// </summary>
	[MaxLength(100)]
	public string OpponentName { get; set; } = string.Empty;

	/// <summary>
	/// Opponent's team power
	/// </summary>
	public int OpponentPower { get; set; }

	/// <summary>
	/// Whether we won the battle
	/// </summary>
	public bool IsWin { get; set; }

	/// <summary>
	/// Player's rank before battle
	/// </summary>
	public int RankBefore { get; set; }

	/// <summary>
	/// Player's rank after battle
	/// </summary>
	public int RankAfter { get; set; }

	/// <summary>
	/// Our team composition (compressed JSON)
	/// </summary>
	public string? OurTeam { get; set; }

	/// <summary>
	/// Opponent's team composition (compressed JSON)
	/// </summary>
	public string? OpponentTeam { get; set; }

	/// <summary>
	/// Battle duration in seconds
	/// </summary>
	public int? DurationSeconds { get; set; }

	/// <summary>
	/// Coins earned from battle
	/// </summary>
	public int CoinsEarned { get; set; }
}
