namespace OrganizedJihad.Api.Configuration;

/// <summary>
/// Configuration values for automated daily report generation.
/// </summary>
public sealed class DailyReportAutomationOptions {
	/// <summary>
	/// Enables background daily report generation.
	/// </summary>
	public bool Enabled { get; set; } = true;

	/// <summary>
	/// Interval between generation runs in minutes.
	/// </summary>
	public int IntervalMinutes { get; set; } = 60;

	/// <summary>
	/// Number of UTC days of generated history to retain.
	/// </summary>
	public int RetentionDays { get; set; } = 30;

	/// <summary>
	/// Runs one generation pass immediately when API starts.
	/// </summary>
	public bool RunOnStartup { get; set; } = true;
}
