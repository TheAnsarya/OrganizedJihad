using OrganizedJihad.Data.Entities;

namespace OrganizedJihad.Data.Models;

/// <summary>
/// Represents completion of daily quests, weekly quests, and event missions.
/// Tracks when quests are completed and what rewards were received.
/// </summary>
public class QuestCompletion : CreationAuditableEntity {
	/// <summary>
	/// Primary key (auto-increment)
	/// </summary>
	public int Id { get; set; }

	/// <summary>
	/// When the quest was completed
	/// </summary>
	public DateTime CompletedAt { get; set; }

	/// <summary>
	/// Type of quest: "daily", "weekly", "event", "achievement"
	/// </summary>
	public string QuestType { get; set; } = string.Empty;

	/// <summary>
	/// Game's internal quest ID
	/// </summary>
	public string QuestId { get; set; } = string.Empty;

	/// <summary>
	/// Quest display name
	/// </summary>
	public string QuestName { get; set; } = string.Empty;

	/// <summary>
	/// Reward data stored as JSON
	/// Example: {"gold": 1000, "emeralds": 50, "items": [{"id": "item_1", "qty": 5}]}
	/// </summary>
	public string? RewardData { get; set; }

	/// <summary>
	/// Foreign key - which player completed this quest
	/// </summary>
	public long PlayerId { get; set; }
}

/// <summary>
/// Tracks progress through campaign missions and heroic missions.
/// This is mutable data - updated as player progresses through campaign.
/// </summary>
public class MissionProgress : AuditableEntity {
	/// <summary>
	/// Primary key (auto-increment)
	/// </summary>
	public int Id { get; set; }

	/// <summary>
	/// Game's internal mission ID (e.g., "1-1", "2-5", "12-10")
	/// </summary>
	public string MissionId { get; set; } = string.Empty;

	/// <summary>
	/// Mission display name
	/// </summary>
	public string MissionName { get; set; } = string.Empty;

	/// <summary>
	/// Number of stars earned (0-3)
	/// </summary>
	public int Stars { get; set; }

	/// <summary>
	/// Highest level/difficulty completed
	/// </summary>
	public int HighestLevel { get; set; }

	/// <summary>
	/// Whether this is a heroic mission (harder difficulty)
	/// </summary>
	public bool IsHeroic { get; set; }

	/// <summary>
	/// When this mission was last completed
	/// </summary>
	public DateTime LastCompleted { get; set; }

	/// <summary>
	/// Times this mission has been completed (farming tracking)
	/// </summary>
	public int CompletionCount { get; set; }

	/// <summary>
	/// Foreign key - which player's progress
	/// </summary>
	public long PlayerId { get; set; }
}

/// <summary>
/// Tracks purchases made from various in-game shops.
/// Useful for analyzing spending patterns and resource management.
/// </summary>
public class ShopPurchase : CreationAuditableEntity {
	/// <summary>
	/// Primary key (auto-increment)
	/// </summary>
	public int Id { get; set; }

	/// <summary>
	/// When the purchase was made
	/// </summary>
	public DateTime PurchasedAt { get; set; }

	/// <summary>
	/// Shop type: "arena", "guild", "tower", "merchant", "outland", "titan"
	/// </summary>
	public string ShopType { get; set; } = string.Empty;

	/// <summary>
	/// Item ID from game
	/// </summary>
	public string ItemId { get; set; } = string.Empty;

	/// <summary>
	/// Item display name
	/// </summary>
	public string ItemName { get; set; } = string.Empty;

	/// <summary>
	/// Quantity purchased
	/// </summary>
	public int Quantity { get; set; }

	/// <summary>
	/// Cost currency type: "gold", "emeralds", "arena_coins", "guild_coins", "tower_coins"
	/// </summary>
	public string CostType { get; set; } = string.Empty;

	/// <summary>
	/// Amount of currency spent
	/// </summary>
	public int CostAmount { get; set; }

	/// <summary>
	/// Foreign key - which player made the purchase
	/// </summary>
	public long PlayerId { get; set; }
}

/// <summary>
/// Tracks progress through towers and dungeons.
/// This is mutable data - updated as player climbs tower or progresses dungeons.
/// </summary>
public class TowerProgress : AuditableEntity {
	/// <summary>
	/// Primary key (auto-increment)
	/// </summary>
	public int Id { get; set; }

	/// <summary>
	/// Tower type: "regular", "outland", "guild"
	/// </summary>
	public string TowerType { get; set; } = string.Empty;

	/// <summary>
	/// Highest floor/level reached
	/// </summary>
	public int HighestFloor { get; set; }

	/// <summary>
	/// When this progress was last updated
	/// </summary>
	public DateTime LastUpdate { get; set; }

	/// <summary>
	/// Detailed floor completion data stored as JSON
	/// Example: {"1": true, "2": true, "3": false, ...}
	/// </summary>
	public string? FloorData { get; set; }

	/// <summary>
	/// Foreign key - which player's progress
	/// </summary>
	public long PlayerId { get; set; }
}

/// <summary>
/// Tracks guild war expedition battles and campaign battles.
/// Different from arena battles - these are PvE boss fights.
/// </summary>
public class ExpeditionBattle : CreationAuditableEntity {
	/// <summary>
	/// Primary key (auto-increment)
	/// </summary>
	public int Id { get; set; }

	/// <summary>
	/// When the battle occurred
	/// </summary>
	public DateTime Timestamp { get; set; }

	/// <summary>
	/// Expedition identifier (e.g., "guild_war_1", "campaign_boss_5")
	/// </summary>
	public string ExpeditionId { get; set; } = string.Empty;

	/// <summary>
	/// Boss ID from game
	/// </summary>
	public int BossId { get; set; }

	/// <summary>
	/// Boss display name
	/// </summary>
	public string BossName { get; set; } = string.Empty;

	/// <summary>
	/// Whether the battle was won
	/// </summary>
	public bool IsWin { get; set; }

	/// <summary>
	/// Team composition stored as JSON (hero IDs and their stats)
	/// </summary>
	public string? TeamComposition { get; set; }

	/// <summary>
	/// Damage dealt to boss (relevant for raid-style content)
	/// </summary>
	public int DamageDealt { get; set; }

	/// <summary>
	/// Reward data stored as JSON
	/// </summary>
	public string? RewardData { get; set; }

	/// <summary>
	/// Foreign key - which player's battle
	/// </summary>
	public long PlayerId { get; set; }
}

/// <summary>
/// Tracks resource gains and losses for economic analysis.
/// Helps understand income sources and spending patterns.
/// </summary>
public class ResourceTransaction : CreationAuditableEntity {
	/// <summary>
	/// Primary key (auto-increment)
	/// </summary>
	public int Id { get; set; }

	/// <summary>
	/// When the transaction occurred
	/// </summary>
	public DateTime Timestamp { get; set; }

	/// <summary>
	/// Resource type: "gold", "emeralds", "arena_coins", "guild_coins", "tower_coins", "titan_coins"
	/// </summary>
	public string ResourceType { get; set; } = string.Empty;

	/// <summary>
	/// Amount of resource (positive for gain, negative for loss)
	/// </summary>
	public int Amount { get; set; }

	/// <summary>
	/// Source of transaction: "battle", "shop", "quest", "chest", "daily_reward", "guild", "event"
	/// </summary>
	public string Source { get; set; } = string.Empty;

	/// <summary>
	/// Specific details about the source (e.g., which shop, which quest)
	/// </summary>
	public string? SourceDetail { get; set; }

	/// <summary>
	/// Foreign key - which player's transaction
	/// </summary>
	public long PlayerId { get; set; }
}

/// <summary>
/// Tracks guild-related activities and participation.
/// Useful for tracking guild engagement and contributions.
/// </summary>
public class GuildActivity : CreationAuditableEntity {
	/// <summary>
	/// Primary key (auto-increment)
	/// </summary>
	public int Id { get; set; }

	/// <summary>
	/// When the activity occurred
	/// </summary>
	public DateTime Timestamp { get; set; }

	/// <summary>
	/// Guild ID from game
	/// </summary>
	public long GuildId { get; set; }

	/// <summary>
	/// Guild name
	/// </summary>
	public string GuildName { get; set; } = string.Empty;

	/// <summary>
	/// Activity type: "join", "leave", "donation", "raid", "war", "titanium_donation"
	/// </summary>
	public string ActivityType { get; set; } = string.Empty;

	/// <summary>
	/// Activity-specific data stored as JSON
	/// Example for donation: {"gold": 50000, "titanite": 100}
	/// Example for raid: {"damage": 1000000, "rank": 3}
	/// </summary>
	public string? ActivityData { get; set; }

	/// <summary>
	/// Foreign key - which player's activity
	/// </summary>
	public long PlayerId { get; set; }
}
