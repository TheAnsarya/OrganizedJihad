namespace OrganizedJihad.Api.Models.Ui;

/// <summary>
/// Response payload for /ui/reporting-overview.
/// </summary>
/// <param name="GeneratedAtUtc">UTC timestamp when the payload was generated.</param>
/// <param name="LastSyncUtc">Most recent sync timestamp in UTC.</param>
/// <param name="DailyPoints">Last seven UTC-day aggregate points for charting/report cards.</param>
public sealed record ApiUiReportingOverviewResponse(
	DateTime GeneratedAtUtc,
	DateTime? LastSyncUtc,
	IReadOnlyList<ApiUiReportingDailyPoint> DailyPoints);

/// <summary>
/// Per-day aggregate point for reporting overview visualizations.
/// </summary>
/// <param name="DateUtc">UTC date represented by this point.</param>
/// <param name="BattlesTracked">Total battles tracked for this day.</param>
/// <param name="QuestCompletions">Total quest completion events for this day.</param>
/// <param name="ResourceTransactions">Total resource transactions for this day.</param>
/// <param name="ChestOpenings">Total chest opening events for this day.</param>
public sealed record ApiUiReportingDailyPoint(
	DateTime DateUtc,
	int BattlesTracked,
	int QuestCompletions,
	int ResourceTransactions,
	int ChestOpenings);