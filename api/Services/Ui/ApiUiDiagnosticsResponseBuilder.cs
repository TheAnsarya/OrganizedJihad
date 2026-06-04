using OrganizedJihad.Api.Models.Ui;

namespace OrganizedJihad.Api.Services.Ui;

/// <summary>
/// Builds strongly typed diagnostics responses for UI endpoints.
/// </summary>
public sealed class ApiUiDiagnosticsResponseBuilder {
	/// <summary>
	/// Builds a repair-status response object.
	/// </summary>
	public ApiUiRepairStatusResponse BuildRepairStatus(
		string installRoot,
		bool hasDatabase,
		bool hasUserscript,
		bool hasTrayHost,
		string apiServiceTaskStatus,
		string apiTrayTaskStatus,
		UserscriptHandshakeStatus handshake,
		string recommendation) {
		return new ApiUiRepairStatusResponse(
			InstallRoot: installRoot,
			HasDatabase: hasDatabase,
			HasUserscript: hasUserscript,
			HasTrayHost: hasTrayHost,
			ApiServiceTaskStatus: apiServiceTaskStatus,
			ApiTrayTaskStatus: apiTrayTaskStatus,
			HandshakeStatus: handshake.Status,
			HandshakeLastSyncUtc: handshake.LastSyncUtc,
			HandshakeAgeMinutes: handshake.AgeMinutes,
			Recommendation: recommendation,
			CheckedUtc: DateTime.UtcNow);
	}

	/// <summary>
	/// Builds a userscript-handshake response object.
	/// </summary>
	public ApiUiUserscriptHandshakeResponse BuildUserscriptHandshake(UserscriptHandshakeStatus handshake) {
		return new ApiUiUserscriptHandshakeResponse(
			Status: handshake.Status,
			LastSyncUtc: handshake.LastSyncUtc,
			AgeMinutes: handshake.AgeMinutes,
			HasRecentSync: handshake.HasRecentSync,
			RecommendedChecks: [
				"Confirm Tampermonkey extension is installed and enabled in your active browser.",
				"Confirm organized-jihad.user.js is installed and enabled in Tampermonkey.",
				"Open Hero Wars, then verify /api/sync/health and /api/sync/last-sync endpoints.",
				"Run userscript install check: yarn install:check --open failed"
			],
			CheckedUtc: DateTime.UtcNow);
	}
}
