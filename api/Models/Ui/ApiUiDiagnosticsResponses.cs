namespace OrganizedJihad.Api.Models.Ui;

/// <summary>
/// Response payload for /ui/repair-status.
/// </summary>
/// <param name="InstallRoot">Local install root path.</param>
/// <param name="HasDatabase">Whether the API database file exists.</param>
/// <param name="HasUserscript">Whether userscript payload exists.</param>
/// <param name="HasTrayHost">Whether tray/runtime host executable exists.</param>
/// <param name="ApiServiceTaskStatus">Status of the API service scheduled task.</param>
/// <param name="ApiTrayTaskStatus">Status of the API tray scheduled task.</param>
/// <param name="HandshakeStatus">Computed userscript handshake status.</param>
/// <param name="HandshakeLastSyncUtc">Most recent sync timestamp in UTC.</param>
/// <param name="HandshakeAgeMinutes">Age in minutes of latest sync.</param>
/// <param name="Recommendation">Operator-facing remediation recommendation text.</param>
/// <param name="CheckedUtc">UTC timestamp when diagnostic evaluation was computed.</param>
public sealed record ApiUiRepairStatusResponse(
	string InstallRoot,
	bool HasDatabase,
	bool HasUserscript,
	bool HasTrayHost,
	string ApiServiceTaskStatus,
	string ApiTrayTaskStatus,
	string HandshakeStatus,
	DateTime? HandshakeLastSyncUtc,
	double? HandshakeAgeMinutes,
	string Recommendation,
	DateTime CheckedUtc);

/// <summary>
/// Response payload for /ui/userscript-handshake.
/// </summary>
/// <param name="Status">Current handshake status label.</param>
/// <param name="LastSyncUtc">Most recent sync timestamp in UTC.</param>
/// <param name="AgeMinutes">Age in minutes of most recent sync.</param>
/// <param name="HasRecentSync">Whether a sync happened recently.</param>
/// <param name="RecommendedChecks">Ordered diagnostic checks for operators.</param>
/// <param name="CheckedUtc">UTC timestamp when diagnostic evaluation was computed.</param>
public sealed record ApiUiUserscriptHandshakeResponse(
	string Status,
	DateTime? LastSyncUtc,
	double? AgeMinutes,
	bool HasRecentSync,
	string[] RecommendedChecks,
	DateTime CheckedUtc);
