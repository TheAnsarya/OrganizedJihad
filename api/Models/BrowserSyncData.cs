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

	public int TotalRecords => TotalSnapshots + TotalArenaBattles + TotalGrandArenaBattles +
								TotalTitanArenaBattles + TotalGuildWarBattles + TotalRaidBossAttacks +
								TotalChestOpenings + TotalOpponents + TotalGoals + TotalCalendarEvents +
								TotalHeroes + TotalTitans + TotalPets + TotalInventorySnapshots +
								TotalQuestCompletions + TotalMissionProgress + TotalShopPurchases +
								TotalTowerProgress + TotalExpeditionBattles + TotalResourceTransactions +
								TotalGuildActivities;
	public DateTime? OldestSnapshot { get; set; }
	public DateTime? NewestSnapshot { get; set; }
	public DateTime? LastSync { get; set; }
}
