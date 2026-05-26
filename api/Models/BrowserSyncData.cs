using OrganizedJihad.Data.Models;

namespace OrganizedJihad.Api.Models;

/// <summary>
/// Data Transfer Object (DTO) for receiving comprehensive game data from the browser userscript.
///
/// This class represents the complete payload sent from the TamperMonkey userscript
/// when synchronizing Hero Wars game data to the local API/database.
///
/// Organization:
/// - Player and Battle Data: Current state and combat history
/// - Hero/Titan/Pet Rosters: Character progression data
/// - Activity Tracking: Quests, missions, purchases, guild activities
///
/// Design Pattern: Data Transfer Object (DTO)
/// Used to transfer complex data between browser and server in a single HTTP request.
///
/// References:
/// - DTO Pattern: https://learn.microsoft.com/en-us/aspnet/web-api/overview/data/using-web-api-with-entity-framework/part-5
/// - Model Binding: https://learn.microsoft.com/en-us/aspnet/core/mvc/models/model-binding
/// - JSON Serialization: https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/how-to
/// </summary>
public class BrowserSyncData {
	// === Player and Battle Data ===

	/// <summary>
	/// Current player state snapshot (level, power, resources at time of sync).
	/// </summary>
	public PlayerSnapshot? CurrentSnapshot { get; set; }

	/// <summary>
	/// Standard arena (1v1 PvP) battle records.
	/// </summary>
	public List<ArenaBattle>? ArenaBattles { get; set; }

	/// <summary>
	/// Grand Arena (tournament-style PvP) battle records.
	/// </summary>
	public List<GrandArenaBattle>? GrandArenaBattles { get; set; }

	/// <summary>
	/// Titan Arena (titan-based PvP) battle records.
	/// </summary>
	public List<TitanArenaBattle>? TitanArenaBattles { get; set; }

	/// <summary>
	/// Guild War battle records (guild vs guild combat).
	/// </summary>
	public List<GuildWarBattle>? GuildWarBattles { get; set; }

	/// <summary>
	/// Raid boss attack records (cooperative guild boss fights).
	/// </summary>
	public List<RaidBossAttack>? RaidBossAttacks { get; set; }

	/// <summary>
	/// Chest opening records (loot box tracking).
	/// </summary>
	public List<ChestOpening>? ChestOpenings { get; set; }

	/// <summary>
	/// Normalized per-item rewards extracted from consumables/chest openings.
	/// Used to reconstruct chest drop rows when browser payloads do not embed Drops.
	/// </summary>
	public List<ConsumableRewardSyncRecord>? ConsumableRewards { get; set; }

	/// <summary>
	/// Tracked opponents encountered in any arena type.
	/// </summary>
	public List<Opponent>? Opponents { get; set; }

	/// <summary>
	/// Player-defined goals and progress tracking.
	/// </summary>
	public List<Goal>? Goals { get; set; }

	/// <summary>
	/// In-game calendar events and reminders.
	/// </summary>
	public List<CalendarEvent>? CalendarEvents { get; set; }

	// === Hero, Titan, and Pet Rosters ===

	/// <summary>
	/// Complete hero roster with stats, skills, and equipment.
	/// </summary>
	public List<Hero>? Heroes { get; set; }

	/// <summary>
	/// Complete titan roster with stats and artifacts.
	/// </summary>
	public List<Titan>? Titans { get; set; }

	/// <summary>
	/// Pet roster (companions that buff heroes).
	/// </summary>
	public List<Pet>? Pets { get; set; }

	/// <summary>
	/// Current inventory state (resources, items, etc.).
	/// </summary>
	public InventorySnapshot? CurrentInventory { get; set; }

	// === Activity and Progress Tracking ===

	/// <summary>
	/// Completed quests and quest rewards.
	/// </summary>
	public List<QuestCompletion>? QuestCompletions { get; set; }

	/// <summary>
	/// Progress on ongoing missions/campaigns.
	/// </summary>
	public List<MissionProgress>? MissionProgress { get; set; }

	/// <summary>
	/// Shop purchase history (tracking spending patterns).
	/// </summary>
	public List<ShopPurchase>? ShopPurchases { get; set; }

	/// <summary>
	/// Tower of Eternity progress (climbing floors).
	/// </summary>
	public List<TowerProgress>? TowerProgress { get; set; }

	/// <summary>
	/// Expedition battle records (PvE campaign battles).
	/// </summary>
	public List<ExpeditionBattle>? ExpeditionBattles { get; set; }

	/// <summary>
	/// Resource transaction log (gains and spends of all currencies).
	/// </summary>
	public List<ResourceTransaction>? ResourceTransactions { get; set; }

	/// <summary>
	/// Guild activity records (donations, raids, wars, etc.).
	/// </summary>
	public List<GuildActivity>? GuildActivities { get; set; }

	// === Hero Upgrade Tracking ===

	/// <summary>
	/// Hero level-up events.
	/// </summary>
	public List<HeroLevelUpgrade>? HeroLevelUpgrades { get; set; }

	/// <summary>
	/// Hero star (evolution) promotion events.
	/// </summary>
	public List<HeroStarUpgrade>? HeroStarUpgrades { get; set; }

	/// <summary>
	/// Hero color (rank/tier) evolution events.
	/// </summary>
	public List<HeroColorUpgrade>? HeroColorUpgrades { get; set; }

	/// <summary>
	/// Hero skill level-up events.
	/// </summary>
	public List<HeroSkillUpgrade>? HeroSkillUpgrades { get; set; }

	/// <summary>
	/// Hero artifact upgrade events (weapon, book, ring).
	/// </summary>
	public List<HeroArtifactUpgrade>? HeroArtifactUpgrades { get; set; }

	/// <summary>
	/// Hero glyph upgrade events.
	/// </summary>
	public List<HeroGlyphUpgrade>? HeroGlyphUpgrades { get; set; }

	/// <summary>
	/// Hero skin unlock and upgrade events.
	/// </summary>
	public List<HeroSkinUpgrade>? HeroSkinUpgrades { get; set; }

	// === Titan Upgrade Tracking ===

	/// <summary>
	/// Titan level-up events.
	/// </summary>
	public List<TitanLevelUpgrade>? TitanLevelUpgrades { get; set; }

	/// <summary>
	/// Titan star (evolution) promotion events.
	/// </summary>
	public List<TitanStarUpgrade>? TitanStarUpgrades { get; set; }

	/// <summary>
	/// Titan skill level-up events.
	/// </summary>
	public List<TitanSkillUpgrade>? TitanSkillUpgrades { get; set; }

	/// <summary>
	/// Titan artifact upgrade events.
	/// </summary>
	public List<TitanArtifactUpgrade>? TitanArtifactUpgrades { get; set; }

	/// <summary>
	/// Titan skin unlock and upgrade events.
	/// </summary>
	public List<TitanSkinUpgrade>? TitanSkinUpgrades { get; set; }

	// === Daily Activity Tracking ===

	/// <summary>
	/// Daily quest completion events.
	/// </summary>
	public List<DailyQuestCompletion>? DailyQuestCompletions { get; set; }

	/// <summary>
	/// Guild quest completion events.
	/// </summary>
	public List<GuildQuestCompletion>? GuildQuestCompletions { get; set; }

	/// <summary>
	/// Daily login reward claims.
	/// </summary>
	public List<LoginReward>? LoginRewards { get; set; }

	/// <summary>
	/// Aggregated daily activity summaries.
	/// </summary>
	public List<DailyActivitySummary>? DailyActivitySummaries { get; set; }

	// === Inventory Tracking ===

	/// <summary>
	/// Inventory item usage events (potions, fragments, scrolls consumed).
	/// </summary>
	public List<InventoryItemUsage>? InventoryItemUsages { get; set; }

	/// <summary>
	/// Equipment changes on heroes (equipping, upgrading, evolving).
	/// </summary>
	public List<EquipmentChange>? EquipmentChanges { get; set; }
}

/// <summary>
/// Response payload returned after processing a sync import request.
///
/// Provides feedback to the browser userscript about the success/failure
/// of the import operation and statistics about what was imported.
/// </summary>
public class SyncResponse {
	/// <summary>
	/// Indicates whether the import completed successfully.
	/// </summary>
	public bool Success { get; set; }

	/// <summary>
	/// Human-readable message describing the result (success message or error details).
	/// </summary>
	public string? Message { get; set; }

	/// <summary>
	/// Server timestamp when the sync operation completed.
	/// </summary>
	public DateTime SyncTimestamp { get; set; }

	/// <summary>
	/// Detailed counts of records imported for each entity type.
	/// Null if import failed before processing.
	/// </summary>
	public ImportCounts? ImportedCounts { get; set; }
}

/// <summary>
/// Detailed breakdown of record counts imported during a sync operation.
///
/// Provides transparency about what data was processed and how many
/// records were added to the database for each entity type.
/// </summary>
public class ImportCounts {
	// === Player and Battle Data ===
	public int PlayerSnapshots { get; set; }
	public int ArenaBattles { get; set; }
	public int GrandArenaBattles { get; set; }
	public int TitanArenaBattles { get; set; }
	public int GuildWarBattles { get; set; }
	public int RaidBossAttacks { get; set; }
	public int ChestOpenings { get; set; }
	public int ConsumableRewards { get; set; }
	public int Opponents { get; set; }
	public int Goals { get; set; }
	public int CalendarEvents { get; set; }

	// === Hero, Titan, and Pet Rosters ===
	public int Heroes { get; set; }
	public int Titans { get; set; }
	public int Pets { get; set; }
	public int InventorySnapshots { get; set; }

	// === Activity and Progress Tracking ===
	public int QuestCompletions { get; set; }
	public int MissionProgress { get; set; }
	public int ShopPurchases { get; set; }
	public int TowerProgress { get; set; }
	public int ExpeditionBattles { get; set; }
	public int ResourceTransactions { get; set; }
	public int GuildActivities { get; set; }

	// === Hero Upgrade Tracking ===
	public int HeroLevelUpgrades { get; set; }
	public int HeroStarUpgrades { get; set; }
	public int HeroColorUpgrades { get; set; }
	public int HeroSkillUpgrades { get; set; }
	public int HeroArtifactUpgrades { get; set; }
	public int HeroGlyphUpgrades { get; set; }
	public int HeroSkinUpgrades { get; set; }

	// === Titan Upgrade Tracking ===
	public int TitanLevelUpgrades { get; set; }
	public int TitanStarUpgrades { get; set; }
	public int TitanSkillUpgrades { get; set; }
	public int TitanArtifactUpgrades { get; set; }
	public int TitanSkinUpgrades { get; set; }

	// === Daily Activity Tracking ===
	public int DailyQuestCompletions { get; set; }
	public int GuildQuestCompletions { get; set; }
	public int LoginRewards { get; set; }
	public int DailyActivitySummaries { get; set; }

	// === Inventory Tracking ===
	public int InventoryItemUsages { get; set; }
	public int EquipmentChanges { get; set; }
}

/// <summary>
/// Database statistics for the API.
/// </summary>
public class DatabaseStats {
	// === Player and Battle Data ===
	public int TotalSnapshots { get; set; }
	public int TotalArenaBattles { get; set; }
	public int TotalGrandArenaBattles { get; set; }
	public int TotalTitanArenaBattles { get; set; }
	public int TotalGuildWarBattles { get; set; }
	public int TotalRaidBossAttacks { get; set; }
	public int TotalChestOpenings { get; set; }
	public int TotalChestDrops { get; set; }
	public int TotalOpponents { get; set; }
	public int TotalGoals { get; set; }
	public int TotalCalendarEvents { get; set; }

	// === Hero, Titan, and Pet Rosters ===
	public int TotalHeroes { get; set; }
	public int TotalTitans { get; set; }
	public int TotalPets { get; set; }
	public int TotalInventorySnapshots { get; set; }

	// === Activity and Progress Tracking ===
	public int TotalQuestCompletions { get; set; }
	public int TotalMissionProgress { get; set; }
	public int TotalShopPurchases { get; set; }
	public int TotalTowerProgress { get; set; }
	public int TotalExpeditionBattles { get; set; }
	public int TotalResourceTransactions { get; set; }
	public int TotalGuildActivities { get; set; }

	// === Hero Upgrade Tracking ===
	public int TotalHeroLevelUpgrades { get; set; }
	public int TotalHeroStarUpgrades { get; set; }
	public int TotalHeroColorUpgrades { get; set; }
	public int TotalHeroSkillUpgrades { get; set; }
	public int TotalHeroArtifactUpgrades { get; set; }
	public int TotalHeroGlyphUpgrades { get; set; }
	public int TotalHeroSkinUpgrades { get; set; }

	// === Titan Upgrade Tracking ===
	public int TotalTitanLevelUpgrades { get; set; }
	public int TotalTitanStarUpgrades { get; set; }
	public int TotalTitanSkillUpgrades { get; set; }
	public int TotalTitanArtifactUpgrades { get; set; }
	public int TotalTitanSkinUpgrades { get; set; }

	// === Daily Activity Tracking ===
	public int TotalDailyQuestCompletions { get; set; }
	public int TotalGuildQuestCompletions { get; set; }
	public int TotalLoginRewards { get; set; }
	public int TotalDailyActivitySummaries { get; set; }

	// === Inventory Tracking ===
	public int TotalInventoryItemUsages { get; set; }
	public int TotalEquipmentChanges { get; set; }

	public int TotalRecords => TotalSnapshots + TotalArenaBattles + TotalGrandArenaBattles +
								TotalTitanArenaBattles + TotalGuildWarBattles + TotalRaidBossAttacks +
								TotalChestOpenings + TotalChestDrops + TotalOpponents + TotalGoals + TotalCalendarEvents +
								TotalHeroes + TotalTitans + TotalPets + TotalInventorySnapshots +
								TotalQuestCompletions + TotalMissionProgress + TotalShopPurchases +
								TotalTowerProgress + TotalExpeditionBattles + TotalResourceTransactions +
								TotalGuildActivities +
								TotalHeroLevelUpgrades + TotalHeroStarUpgrades + TotalHeroColorUpgrades +
								TotalHeroSkillUpgrades + TotalHeroArtifactUpgrades + TotalHeroGlyphUpgrades +
								TotalHeroSkinUpgrades +
								TotalTitanLevelUpgrades + TotalTitanStarUpgrades + TotalTitanSkillUpgrades +
								TotalTitanArtifactUpgrades + TotalTitanSkinUpgrades +
								TotalDailyQuestCompletions + TotalGuildQuestCompletions +
								TotalLoginRewards + TotalDailyActivitySummaries +
								TotalInventoryItemUsages + TotalEquipmentChanges;
	public DateTime? OldestSnapshot { get; set; }
	public DateTime? NewestSnapshot { get; set; }
	public DateTime? LastSync { get; set; }
}

/// <summary>
/// Normalized reward row emitted by the userscript for each dropped item.
/// These records are mapped to ChestDrop entities server-side.
/// </summary>
public class ConsumableRewardSyncRecord {
	/// <summary>
	/// Timestamp of the reward event.
	/// </summary>
	public DateTime Timestamp { get; set; }

	/// <summary>
	/// Source type from userscript (e.g., genericChest, artifactChest, towerChest).
	/// </summary>
	public string SourceType { get; set; } = string.Empty;

	/// <summary>
	/// Source identifier from userscript (chest/consumable ID).
	/// </summary>
	public string SourceId { get; set; } = string.Empty;

	/// <summary>
	/// Reward category (consumable, gear, coin, fragmentHero, etc.).
	/// </summary>
	public string ItemType { get; set; } = string.Empty;

	/// <summary>
	/// Item identifier within the category.
	/// </summary>
	public string ItemId { get; set; } = string.Empty;

	/// <summary>
	/// Quantity received.
	/// </summary>
	public int Quantity { get; set; }

	/// <summary>
	/// Local userscript opening ID from the chests store.
	/// Used as a join key against ChestOpenings in the same payload.
	/// </summary>
	public int OpeningId { get; set; }
}
