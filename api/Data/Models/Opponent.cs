using System;
using System.ComponentModel.DataAnnotations;

namespace OrganizedJihad.Api.Data.Models;

/// <summary>
/// Tracks opponents and win/loss records against them
/// </summary>
public class Opponent
{
	[Key]
	public int Id { get; set; }

	/// <summary>
	/// Unique opponent identifier from Hero Wars
	/// </summary>
	public long OpponentId { get; set; }

	/// <summary>
	/// Opponent's username
	/// </summary>
	[MaxLength(100)]
	public string OpponentName { get; set; } = string.Empty;

	/// <summary>
	/// Last known team power
	/// </summary>
	public int LastKnownPower { get; set; }

	/// <summary>
	/// Last known rank
	/// </summary>
	public int? LastKnownRank { get; set; }

	/// <summary>
	/// Last seen guild name
	/// </summary>
	[MaxLength(100)]
	public string? GuildName { get; set; }

	/// <summary>
	/// Total wins against this opponent
	/// </summary>
	public int TotalWins { get; set; }

	/// <summary>
	/// Total losses against this opponent
	/// </summary>
	public int TotalLosses { get; set; }

	/// <summary>
	/// Wins in regular arena
	/// </summary>
	public int ArenaWins { get; set; }

	/// <summary>
	/// Losses in regular arena
	/// </summary>
	public int ArenaLosses { get; set; }

	/// <summary>
	/// Wins in grand arena
	/// </summary>
	public int GrandArenaWins { get; set; }

	/// <summary>
	/// Losses in grand arena
	/// </summary>
	public int GrandArenaLosses { get; set; }

	/// <summary>
	/// Wins in titan arena
	/// </summary>
	public int TitanArenaWins { get; set; }

	/// <summary>
	/// Losses in titan arena
	/// </summary>
	public int TitanArenaLosses { get; set; }

	/// <summary>
	/// When we first encountered this opponent
	/// </summary>
	public DateTime FirstSeen { get; set; }

	/// <summary>
	/// When we last battled this opponent
	/// </summary>
	public DateTime LastSeen { get; set; }

	/// <summary>
	/// Their most recent team composition (compressed JSON)
	/// </summary>
	public string? LastKnownTeam { get; set; }

	/// <summary>
	/// Notes about this opponent
	/// </summary>
	public string? Notes { get; set; }
}
