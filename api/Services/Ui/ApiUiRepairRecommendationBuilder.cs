namespace OrganizedJihad.Api.Services.Ui;

/// <summary>
/// Builds operator-facing repair recommendation text for runtime diagnostics.
/// </summary>
public sealed class ApiUiRepairRecommendationBuilder {
	/// <summary>
	/// Builds recommendation text from runtime artifact and handshake/task status signals.
	/// </summary>
	public string Build(bool hasDatabase, bool hasUserscript, bool hasTrayHost, string apiServiceTaskStatus, string apiTrayTaskStatus, bool hasRecentSync) {
		var recommendation = hasDatabase && hasUserscript && hasTrayHost
			? "Runtime artifacts look healthy."
			: "One or more runtime artifacts are missing. Re-run installer with managed CLI (dotnet run --project installer-core/OrganizedJihad.Installer.Cli -- --run-install-health-check) from your install bundle/repo to repair setup.";

		if (OperatingSystem.IsWindows()
			&& (apiServiceTaskStatus.StartsWith("missing", StringComparison.OrdinalIgnoreCase)
			|| apiTrayTaskStatus.StartsWith("missing", StringComparison.OrdinalIgnoreCase))) {
			recommendation += " Startup tasks are not fully registered; rerun installer as Administrator to restore service/tray startup automation.";
		}

		if (!hasRecentSync) {
			recommendation += " Userscript handshake is stale or missing; verify Tampermonkey script enablement and run install-health-check diagnostics.";
		}

		return recommendation;
	}
}
