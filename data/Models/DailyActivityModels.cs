using OrganizedJihad.Data.Entities;
using System;
using System.ComponentModel.DataAnnotations;

namespace OrganizedJihad.Data.Models;

/// <summary>
/// Tracks individual daily quest completions.
/// Each record represents a single daily quest completed by the player.
/// </summary>
public class DailyQuestCompletion : CreationAuditableEntity {
	/// <summary>Primary key.</summary>
	[Key]
	public int Id { get; set; }

	/// <summary>When the quest was completed.</summary>
	public DateTime CompletedAt { get; set; }

	/// <summary>The date this daily quest belongs to (normalized to date-only).</summary>
	public DateTime QuestDate { get; set; }

	/// <summary>The game's internal quest ID.</summary>
	[MaxLength(50)]
	public string QuestId { get; set; } = string.Empty;

	/// <summary>Display name of the quest.</summary>
	[MaxLength(200)]
	public string QuestName { get; set; } = string.Empty;

	/// <summary>Quest category (e.g., "Campaign", "Arena", "Tower", "Outland").</summary>
	[MaxLength(50)]
	public string? Category { get; set; }

	/// <summary>Activity points awarded for this quest.</summary>
	public int ActivityPoints { get; set; }

	/// <summary>JSON serialized reward data (items, gold, etc.).</summary>
	public string? RewardData { get; set; }

	/// <summary>The player who completed the quest.</summary>
	public long PlayerId { get; set; }
}

/// <summary>
/// Tracks guild quest completions.
/// Each record represents a guild quest completed by the player.
/// </summary>
public class GuildQuestCompletion : CreationAuditableEntity {
	/// <summary>Primary key.</summary>
	[Key]
	public int Id { get; set; }

	/// <summary>When the quest was completed.</summary>
	public DateTime CompletedAt { get; set; }

	/// <summary>The date this guild quest belongs to.</summary>
	public DateTime QuestDate { get; set; }

	/// <summary>The game's internal quest ID.</summary>
	[MaxLength(50)]
	public string QuestId { get; set; } = string.Empty;

	/// <summary>Display name of the quest.</summary>
	[MaxLength(200)]
	public string QuestName { get; set; } = string.Empty;

	/// <summary>Quest difficulty or tier.</summary>
	[MaxLength(20)]
	public string? Difficulty { get; set; }

	/// <summary>Guild activity points awarded.</summary>
	public int GuildActivityPoints { get; set; }

	/// <summary>JSON serialized reward data.</summary>
	public string? RewardData { get; set; }

	/// <summary>The player who completed the quest.</summary>
	public long PlayerId { get; set; }

	/// <summary>The guild ID this quest was completed for.</summary>
	public long GuildId { get; set; }
}

/// <summary>
/// Tracks daily login reward claims.
/// One record per day the player claimed their login reward.
/// </summary>
public class LoginReward : CreationAuditableEntity {
	/// <summary>Primary key.</summary>
	[Key]
	public int Id { get; set; }

	/// <summary>When the reward was claimed.</summary>
	public DateTime ClaimedAt { get; set; }

	/// <summary>Which day in the login streak (1-30, etc.).</summary>
	public int DayNumber { get; set; }

	/// <summary>The current login streak length.</summary>
	public int StreakLength { get; set; }

	/// <summary>Whether this is a VIP bonus or regular reward.</summary>
	public bool IsVipBonus { get; set; }

	/// <summary>JSON serialized reward items.</summary>
	public string? RewardData { get; set; }

	/// <summary>The player who claimed the reward.</summary>
	public long PlayerId { get; set; }
}

/// <summary>
/// Aggregated daily activity summary for the player.
/// One record per day, summarizing all activities performed.
/// </summary>
public class DailyActivitySummary : CreationAuditableEntity {
	/// <summary>Primary key.</summary>
	[Key]
	public int Id { get; set; }

	/// <summary>The date this summary covers.</summary>
	public DateTime SummaryDate { get; set; }

	/// <summary>Total daily activity points earned.</summary>
	public int TotalActivityPoints { get; set; }

	/// <summary>Number of daily quests completed.</summary>
	public int DailyQuestsCompleted { get; set; }

	/// <summary>Number of guild quests completed.</summary>
	public int GuildQuestsCompleted { get; set; }

	/// <summary>Number of arena battles fought.</summary>
	public int ArenaBattlesFought { get; set; }

	/// <summary>Number of grand arena battles fought.</summary>
	public int GrandArenaBattlesFought { get; set; }

	/// <summary>Number of tower floors cleared.</summary>
	public int TowerFloorsCleared { get; set; }

	/// <summary>Number of campaign missions completed.</summary>
	public int CampaignMissionsCompleted { get; set; }

	/// <summary>Number of outland bosses fought.</summary>
	public int OutlandBossesFought { get; set; }

	/// <summary>Total gold earned this day.</summary>
	public long GoldEarned { get; set; }

	/// <summary>Total gold spent this day.</summary>
	public long GoldSpent { get; set; }

	/// <summary>Total emeralds earned this day.</summary>
	public int EmeraldsEarned { get; set; }

	/// <summary>Total emeralds spent this day.</summary>
	public int EmeraldsSpent { get; set; }

	/// <summary>Whether the daily chest was claimed.</summary>
	public bool DailyChestClaimed { get; set; }

	/// <summary>The player this summary belongs to.</summary>
	public long PlayerId { get; set; }
}
