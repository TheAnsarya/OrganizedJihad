namespace OrganizedJihad.Api.Models.Ui;

/// <summary>
/// Response payload for /ui/daily-report/history.
/// </summary>
/// <param name="GeneratedAtUtc">UTC timestamp when history payload was generated.</param>
/// <param name="RetainedDays">Configured retention window in UTC days.</param>
/// <param name="Reports">Generated daily report snapshots ordered by report date descending.</param>
public sealed record ApiUiDailyReportHistoryResponse(
	DateTime GeneratedAtUtc,
	int RetainedDays,
	IReadOnlyList<ApiUiDailyReportResponse> Reports);
