using OrganizedJihad.Data.Models;

namespace OrganizedJihad.Api.Models;

/// <summary>
/// Data transfer object for receiving sync data from the browser userscript.
/// Contains all tracked game data to be imported into the database.
/// </summary>
public class BrowserSyncData {
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
}

/// <summary>
/// Database statistics for the API.
/// </summary>
public class DatabaseStats {
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
	public int TotalRecords => TotalSnapshots + TotalArenaBattles + TotalGrandArenaBattles +
								TotalTitanArenaBattles + TotalGuildWarBattles + TotalRaidBossAttacks +
								TotalChestOpenings + TotalOpponents + TotalGoals + TotalCalendarEvents;
	public DateTime? OldestSnapshot { get; set; }
	public DateTime? NewestSnapshot { get; set; }
	public DateTime? LastSync { get; set; }
}
