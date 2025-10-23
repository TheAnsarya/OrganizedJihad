using OrganizedJihad.Data.Entities;
using System;
using System.ComponentModel.DataAnnotations;

namespace OrganizedJihad.Data.Models;

/// <summary>
/// Represents a guild member's profile and current statistics.
/// Tracks fellow guild members for roster management and activity monitoring.
///
/// Mutable Entity: Updated each time guild roster is synced.
/// Inherits from AuditableEntity for full audit trail (create, modify, delete).
///
/// Reference: https://hw-mobile.fandom.com/wiki/Guild
/// </summary>
public class GuildMember : AuditableEntity {
	[Key]
	public int Id { get; set; }

	/// <summary>
	/// Guild ID this member belongs to
	/// Used to track members across guild changes
	/// </summary>
	public long GuildId { get; set; }

	/// <summary>
	/// Guild name (denormalized for easy reference)
	/// </summary>
	[MaxLength(100)]
	public string GuildName { get; set; } = string.Empty;

	/// <summary>
	/// Unique player identifier from Hero Wars
	/// </summary>
	public long PlayerId { get; set; }

	/// <summary>
	/// Player's display name
	/// </summary>
	[MaxLength(100)]
	public string PlayerName { get; set; } = string.Empty;

	/// <summary>
	/// Player level
	/// </summary>
	public int Level { get; set; }

	/// <summary>
	/// Team power (sum of top 5 heroes)
	/// </summary>
	public int TeamPower { get; set; }

	/// <summary>
	/// Guild rank/role (e.g., "leader", "officer", "member")
	/// </summary>
	[MaxLength(20)]
	public string GuildRank { get; set; } = string.Empty;

	/// <summary>
	/// VIP level (if available from API)
	/// </summary>
	public int? VipLevel { get; set; }

	/// <summary>
	/// Last time player was seen online (from Hero Wars server)
	/// </summary>
	public DateTime LastOnline { get; set; }

	/// <summary>
	/// Whether player is currently online
	/// </summary>
	public bool IsOnline { get; set; }

	/// <summary>
	/// When player joined the guild
	/// </summary>
	public DateTime? JoinedAt { get; set; }

	/// <summary>
	/// Player's contribution to guild (titanite donations, activity points)
	/// Resets based on guild's contribution period
	/// </summary>
	public int CurrentContribution { get; set; }

	/// <summary>
	/// Total lifetime contribution to guild
	/// </summary>
	public int TotalContribution { get; set; }

	/// <summary>
	/// Arena rank
	/// </summary>
	public int? ArenaRank { get; set; }

	/// <summary>
	/// Grand Arena rank
	/// </summary>
	public int? GrandArenaRank { get; set; }

	/// <summary>
	/// Titan Arena rank
	/// </summary>
	public int? TitanArenaRank { get; set; }

	/// <summary>
	/// Prestige points (league progression)
	/// Reference: https://community.hero-wars.com/discussion/prestige-system
	/// </summary>
	public int Prestige { get; set; }

	/// <summary>
	/// Whether member is still in the guild (false = left guild)
	/// </summary>
	public bool IsActive { get; set; } = true;

	/// <summary>
	/// Optional: Compressed JSON of hero roster (IDs and power levels)
	/// </summary>
	public string? HeroRoster { get; set; }

	/// <summary>
	/// Optional: Compressed JSON of titan roster
	/// </summary>
	public string? TitanRoster { get; set; }
}

/// <summary>
/// Historical snapshot of a guild member's statistics.
/// Tracks changes over time for trend analysis and activity monitoring.
///
/// Immutable Record: Historical data never modified.
/// Inherits from CreationAuditableEntity for audit trail.
/// </summary>
public class GuildMemberSnapshot : CreationAuditableEntity {
	[Key]
	public int Id { get; set; }

	/// <summary>
	/// When this snapshot was captured
	/// </summary>
	public DateTime Timestamp { get; set; }

	/// <summary>
	/// Reference to the guild member
	/// </summary>
	public long PlayerId { get; set; }

	/// <summary>
	/// Player name at time of snapshot
	/// </summary>
	[MaxLength(100)]
	public string PlayerName { get; set; } = string.Empty;

	/// <summary>
	/// Guild ID at time of snapshot
	/// </summary>
	public long GuildId { get; set; }

	/// <summary>
	/// Player level at snapshot
	/// </summary>
	public int Level { get; set; }

	/// <summary>
	/// Team power at snapshot
	/// </summary>
	public int TeamPower { get; set; }

	/// <summary>
	/// Guild rank at snapshot
	/// </summary>
	[MaxLength(20)]
	public string GuildRank { get; set; } = string.Empty;

	/// <summary>
	/// Contribution at snapshot
	/// </summary>
	public int Contribution { get; set; }

	/// <summary>
	/// Total lifetime contribution at snapshot
	/// </summary>
	public int TotalContribution { get; set; }

	/// <summary>
	/// Prestige points at snapshot
	/// </summary>
	public int Prestige { get; set; }

	/// <summary>
	/// Whether player was online at snapshot time
	/// </summary>
	public bool IsOnline { get; set; }

	/// <summary>
	/// Last online timestamp from server
	/// </summary>
	public DateTime LastOnline { get; set; }
}

/// <summary>
/// Guild War participation and performance tracking for individual members.
/// Tracks attacks made, damage dealt, and fort assignments.
///
/// Immutable Record: Historical data for each war.
/// Inherits from CreationAuditableEntity for audit trail.
/// </summary>
public class GuildWarParticipation : CreationAuditableEntity {
	[Key]
	public int Id { get; set; }

	/// <summary>
	/// Guild War ID or timestamp
	/// </summary>
	[MaxLength(50)]
	public string WarId { get; set; } = string.Empty;

	/// <summary>
	/// War start date
	/// </summary>
	public DateTime WarDate { get; set; }

	/// <summary>
	/// Member's player ID
	/// </summary>
	public long PlayerId { get; set; }

	/// <summary>
	/// Player name
	/// </summary>
	[MaxLength(100)]
	public string PlayerName { get; set; } = string.Empty;

	/// <summary>
	/// Guild ID
	/// </summary>
	public long GuildId { get; set; }

	/// <summary>
	/// Number of attacks made by member
	/// </summary>
	public int AttacksMade { get; set; }

	/// <summary>
	/// Maximum attacks allowed
	/// </summary>
	public int MaxAttacks { get; set; }

	/// <summary>
	/// Total damage dealt across all attacks
	/// </summary>
	public long TotalDamage { get; set; }

	/// <summary>
	/// Number of forts defended
	/// </summary>
	public int FortsDefended { get; set; }

	/// <summary>
	/// Total defense points earned
	/// </summary>
	public int DefensePoints { get; set; }

	/// <summary>
	/// Whether member participated (made at least 1 attack)
	/// </summary>
	public bool Participated { get; set; }

	/// <summary>
	/// Guild War result (win, loss, or draw)
	/// </summary>
	[MaxLength(10)]
	public string? WarResult { get; set; }

	/// <summary>
	/// Compressed JSON with detailed attack log
	/// </summary>
	public string? AttackDetails { get; set; }
}

/// <summary>
/// Guild Raid (Boss Raid) participation tracking for individual members.
/// Tracks damage dealt to raid boss and minions.
///
/// Immutable Record: Historical data for each raid.
/// Inherits from CreationAuditableEntity for audit trail.
///
/// Reference: https://hw-mobile.fandom.com/wiki/Guild_Raid
/// </summary>
public class GuildRaidParticipation : CreationAuditableEntity {
	[Key]
	public int Id { get; set; }

	/// <summary>
	/// Raid ID or week identifier
	/// </summary>
	[MaxLength(50)]
	public string RaidId { get; set; } = string.Empty;

	/// <summary>
	/// Raid start date
	/// </summary>
	public DateTime RaidDate { get; set; }

	/// <summary>
	/// Member's player ID
	/// </summary>
	public long PlayerId { get; set; }

	/// <summary>
	/// Player name
	/// </summary>
	[MaxLength(100)]
	public string PlayerName { get; set; } = string.Empty;

	/// <summary>
	/// Guild ID
	/// </summary>
	public long GuildId { get; set; }

	/// <summary>
	/// Raid boss identifier (e.g., "hydra", "moloch")
	/// </summary>
	[MaxLength(50)]
	public string BossName { get; set; } = string.Empty;

	/// <summary>
	/// Raid boss level/difficulty
	/// </summary>
	public int BossLevel { get; set; }

	/// <summary>
	/// Total damage dealt to boss
	/// </summary>
	public long BossDamage { get; set; }

	/// <summary>
	/// Total damage dealt to minions
	/// </summary>
	public long MinionDamage { get; set; }

	/// <summary>
	/// Total damage (boss + minions)
	/// </summary>
	public long TotalDamage { get; set; }

	/// <summary>
	/// Number of attacks made
	/// </summary>
	public int AttacksMade { get; set; }

	/// <summary>
	/// Maximum attacks allowed
	/// </summary>
	public int MaxAttacks { get; set; }

	/// <summary>
	/// Whether member participated
	/// </summary>
	public bool Participated { get; set; }

	/// <summary>
	/// Titanite earned from raid
	/// </summary>
	public int TitaniteEarned { get; set; }

	/// <summary>
	/// Guild rank/placement in raid leaderboard
	/// </summary>
	public int? GuildRank { get; set; }

	/// <summary>
	/// Compressed JSON with detailed attack log
	/// </summary>
	public string? AttackDetails { get; set; }
}

/// <summary>
/// Guild Dungeon participation tracking.
/// Tracks progress through dungeon stages and titan usage.
///
/// Immutable Record: Historical data for each dungeon run.
/// Inherits from CreationAuditableEntity for audit trail.
/// </summary>
public class GuildDungeonParticipation : CreationAuditableEntity {
	[Key]
	public int Id { get; set; }

	/// <summary>
	/// Dungeon run ID or date
	/// </summary>
	[MaxLength(50)]
	public string DungeonId { get; set; } = string.Empty;

	/// <summary>
	/// Dungeon date/week
	/// </summary>
	public DateTime DungeonDate { get; set; }

	/// <summary>
	/// Member's player ID
	/// </summary>
	public long PlayerId { get; set; }

	/// <summary>
	/// Player name
	/// </summary>
	[MaxLength(100)]
	public string PlayerName { get; set; } = string.Empty;

	/// <summary>
	/// Guild ID
	/// </summary>
	public long GuildId { get; set; }

	/// <summary>
	/// Dungeon type/identifier
	/// </summary>
	[MaxLength(50)]
	public string DungeonType { get; set; } = string.Empty;

	/// <summary>
	/// Number of titan charges used
	/// </summary>
	public int TitanChargesUsed { get; set; }

	/// <summary>
	/// Maximum titan charges available
	/// </summary>
	public int MaxTitanCharges { get; set; }

	/// <summary>
	/// Number of battles fought
	/// </summary>
	public int BattlesFought { get; set; }

	/// <summary>
	/// Total damage dealt in dungeon
	/// </summary>
	public long TotalDamage { get; set; }

	/// <summary>
	/// Highest stage reached
	/// </summary>
	public int HighestStage { get; set; }

	/// <summary>
	/// Whether member participated
	/// </summary>
	public bool Participated { get; set; }

	/// <summary>
	/// Titanite earned from dungeon
	/// </summary>
	public int TitaniteEarned { get; set; }

	/// <summary>
	/// Compressed JSON with titan team composition
	/// </summary>
	public string? TitanTeam { get; set; }
}

/// <summary>
/// Tracks titanite donations and spending within the guild.
/// Monitors guild currency flow for economic analysis.
///
/// Immutable Record: Historical transaction data.
/// Inherits from CreationAuditableEntity for audit trail.
/// </summary>
public class TitaniteTransaction : CreationAuditableEntity {
	[Key]
	public int Id { get; set; }

	/// <summary>
	/// When the transaction occurred
	/// </summary>
	public DateTime Timestamp { get; set; }

	/// <summary>
	/// Member's player ID
	/// </summary>
	public long PlayerId { get; set; }

	/// <summary>
	/// Player name
	/// </summary>
	[MaxLength(100)]
	public string PlayerName { get; set; } = string.Empty;

	/// <summary>
	/// Guild ID
	/// </summary>
	public long GuildId { get; set; }

	/// <summary>
	/// Transaction type: "donation", "earned", "spent"
	/// </summary>
	[MaxLength(20)]
	public string TransactionType { get; set; } = string.Empty;

	/// <summary>
	/// Amount of titanite (positive for gain, negative for spending)
	/// </summary>
	public int Amount { get; set; }

	/// <summary>
	/// Source of titanite (e.g., "raid", "dungeon", "donation", "guild_shop")
	/// </summary>
	[MaxLength(50)]
	public string Source { get; set; } = string.Empty;

	/// <summary>
	/// Optional: What was purchased/upgraded with titanite
	/// </summary>
	[MaxLength(100)]
	public string? PurchaseDescription { get; set; }

	/// <summary>
	/// Running balance after transaction (if trackable)
	/// </summary>
	public int? BalanceAfter { get; set; }
}
