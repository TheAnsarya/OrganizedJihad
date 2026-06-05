namespace OrganizedJihad.Api.Models.Ui;

/// <summary>
/// Response payload for /ui/daily-report and /ui/daily-report-page.
/// </summary>
/// <param name="DateUtc">UTC date covered by this report.</param>
/// <param name="CheckedUtc">UTC timestamp when this report was generated.</param>
/// <param name="LastSyncUtc">Most recent sync timestamp in UTC.</param>
/// <param name="PlayerSnapshots">Player snapshots captured during report window.</param>
/// <param name="BattlesTracked">Total battles tracked during report window.</param>
/// <param name="ArenaBattles">Arena battles tracked during report window.</param>
/// <param name="GrandArenaBattles">Grand arena battles tracked during report window.</param>
/// <param name="TitanArenaBattles">Titan arena battles tracked during report window.</param>
/// <param name="GuildWarBattles">Guild war battles tracked during report window.</param>
/// <param name="RaidBossAttacks">Raid boss attacks tracked during report window.</param>
/// <param name="ExpeditionBattles">Expedition battles tracked during report window.</param>
/// <param name="ChestOpenings">Chest openings tracked during report window.</param>
/// <param name="QuestCompletions">Quest completion events tracked during report window.</param>
/// <param name="ShopPurchases">Shop purchase events tracked during report window.</param>
/// <param name="ResourceTransactions">Resource transactions tracked during report window.</param>
/// <param name="HeroUpgrades">Hero upgrade events tracked during report window.</param>
/// <param name="TitanUpgrades">Titan upgrade events tracked during report window.</param>
/// <param name="InventoryItemUsages">Inventory item usage events tracked during report window.</param>
/// <param name="ChatMessages">Chat messages tracked during report window.</param>
public sealed record ApiUiDailyReportResponse(
	DateTime DateUtc,
	DateTime CheckedUtc,
	DateTime? LastSyncUtc,
	int PlayerSnapshots,
	int BattlesTracked,
	int ArenaBattles,
	int GrandArenaBattles,
	int TitanArenaBattles,
	int GuildWarBattles,
	int RaidBossAttacks,
	int ExpeditionBattles,
	int ChestOpenings,
	int QuestCompletions,
	int ShopPurchases,
	int ResourceTransactions,
	int HeroUpgrades,
	int TitanUpgrades,
	int InventoryItemUsages,
	int ChatMessages);
