using OrganizedJihad.Data.Entities;
using System;
using System.ComponentModel.DataAnnotations;

namespace OrganizedJihad.Data.Models;

/// <summary>
/// Represents a Guild War battle (attacking enemy guild fortifications).
///
/// Immutable Record: Battle results captured from game API, never modified.
/// Inherits from CreationAuditableEntity for audit trail (DateCreated, CreatedBy).
/// </summary>
public class GuildWarBattle : CreationAuditableEntity {
	[Key]
	public int Id { get; set; }

	public DateTime Timestamp { get; set; }

	/// <summary>
	/// Unique war identifier
	/// </summary>
	[MaxLength(50)]
	public string WarId { get; set; } = string.Empty;

	/// <summary>
	/// Enemy guild name
	/// </summary>
	[MaxLength(100)]
	public string EnemyGuildName { get; set; } = string.Empty;

	/// <summary>
	/// Fortification/tower number being attacked
	/// </summary>
	public int FortificationNumber { get; set; }

	public bool IsWin { get; set; }

	/// <summary>
	/// Our attack team (compressed JSON)
	/// </summary>
	public string? OurTeam { get; set; }

	/// <summary>
	/// Defender's team (compressed JSON)
	/// </summary>
	public string? DefenderTeam { get; set; }

	public int? DurationSeconds { get; set; }

	/// <summary>
	/// Stars earned (0-3)
	/// </summary>
	public int StarsEarned { get; set; }
}

/// <summary>
/// Represents a Raid Boss attack (damage dealt to guild raid boss).
///
/// Immutable Record: Attack results captured from game API, never modified.
/// Inherits from CreationAuditableEntity for audit trail (DateCreated, CreatedBy).
/// </summary>
public class RaidBossAttack : CreationAuditableEntity {
	[Key]
	public int Id { get; set; }

	public DateTime Timestamp { get; set; }

	/// <summary>
	/// Name/type of raid boss
	/// </summary>
	[MaxLength(100)]
	public string BossName { get; set; } = string.Empty;

	/// <summary>
	/// Raid difficulty level
	/// </summary>
	public int Difficulty { get; set; }

	/// <summary>
	/// Damage dealt to boss
	/// </summary>
	public long DamageDealt { get; set; }

	/// <summary>
	/// Our attack team (compressed JSON)
	/// </summary>
	public string? AttackTeam { get; set; }

	/// <summary>
	/// Rewards received (JSON array)
	/// </summary>
	public string? Rewards { get; set; }
}
