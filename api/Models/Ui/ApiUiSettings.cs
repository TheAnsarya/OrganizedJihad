namespace OrganizedJihad.Api.Models.Ui;

/// <summary>
/// Persisted settings for the local API control and tray-health UI pages.
/// </summary>
/// <param name="AutoOpenHealthOnLoad">Whether the browser shell auto-opens health diagnostics on load.</param>
/// <param name="ApiBaseUrl">Preferred local API base URL.</param>
/// <param name="PreferredHeroWarsUrl">Preferred Hero Wars landing URL for quick actions.</param>
/// <param name="Notes">Operator notes displayed in the UI.</param>
/// <param name="UpdatedUtc">Last settings update time in UTC.</param>
public sealed record ApiUiSettings(bool AutoOpenHealthOnLoad, string ApiBaseUrl, string PreferredHeroWarsUrl, string Notes, DateTime UpdatedUtc);

/// <summary>
/// Request model for updating persisted API UI settings.
/// </summary>
/// <param name="AutoOpenHealthOnLoad">Whether to auto-open health checks on load.</param>
/// <param name="ApiBaseUrl">Requested API base URL.</param>
/// <param name="PreferredHeroWarsUrl">Requested Hero Wars URL.</param>
/// <param name="Notes">Optional notes text.</param>
public sealed record ApiUiSettingsUpdateRequest(bool AutoOpenHealthOnLoad, string ApiBaseUrl, string PreferredHeroWarsUrl, string? Notes);
