using OrganizedJihad.Data.Models;

namespace OrganizedJihad.Api.Models;

/// <summary>
/// Data transfer object for receiving sync data from the browser userscript.
/// Contains all tracked game data to be imported into the database.
/// </summary>
public class BrowserSyncData {
	// === Player and Battle Data ===
	public PlayerSnapshot? CurrentSnapshot { get; set; }
	public List<ArenaBattle>? ArenaBattles { get; set; }
	public List<GrandArenaBattle>? GrandArenaBattles { get; set; }
	public List<TitanArenaBattle>? TitanArenaBattles { get; set; }
	public List<GuildWarBattle>? GuildWarBattles { get; set; }
	public List<RaidBossAttack>? RaidBossAttacks { get; set; }
	public List<ChestOpening>? ChestOpenings { get; set; }
	public List<Opponent>? Opponents { get; set; }
	public List<Goal>? Goals { get; set; }
	public List<CalendarEvent>? CalendarEvents { get; set; }

	// === Hero, Titan, and Pet Rosters ===
	public List<Hero>? Heroes { get; set; }
	public List<Titan>? Titans { get; set; }
	public List<Pet>? Pets { get; set; }
	public InventorySnapshot? CurrentInventory { get; set; }

	// === Activity and Progress Tracking ===
	public List<QuestCompletion>? QuestCompletions { get; set; }
	public List<MissionProgress>? MissionProgress { get; set; }
	public List<ShopPurchase>? ShopPurchases { get; set; }
	public List<TowerProgress>? TowerProgress { get; set; }
	public List<ExpeditionBattle>? ExpeditionBattles { get; set; }
	public List<ResourceTransaction>? ResourceTransactions { get; set; }
	public List<GuildActivity>? GuildActivities { get; set; }
}

/// <summary>
/// Response from the sync import operation.
/// </summary>
public class SyncResponse {
	public bool Success { get; set; }
	public string? Message { get; set; }
	public DateTime SyncTimestamp { get; set; }
	public ImportCounts? ImportedCounts { get; set; }
}

/// <summary>
/// Count of records imported during sync.
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
