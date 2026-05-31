using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Api.Services.Diagnostics;
using OrganizedJihad.Data;

namespace OrganizedJihad.Api.Services.Ui;

/// <summary>
/// Handles UI diagnostics endpoints for runtime repair and userscript handshake status.
/// </summary>
public sealed class ApiUiDiagnosticsEndpointHandler {
	private readonly ApiUiAccessPolicy _accessPolicy;
	private readonly ApiRuntimePaths _runtimePaths;
	private readonly ScheduledTaskProbeService _taskProbe;
	private readonly UserscriptHandshakeDiagnosticsService _handshakeDiagnostics;
	private readonly IDbContextFactory<GameDatabaseContext> _contextFactory;
	private readonly ILogger<ApiUiDiagnosticsEndpointHandler> _logger;

	/// <summary>
	/// Initializes a new instance of the diagnostics endpoint handler.
	/// </summary>
	public ApiUiDiagnosticsEndpointHandler(
		ApiUiAccessPolicy accessPolicy,
		ApiRuntimePaths runtimePaths,
		ScheduledTaskProbeService taskProbe,
		UserscriptHandshakeDiagnosticsService handshakeDiagnostics,
		IDbContextFactory<GameDatabaseContext> contextFactory,
		ILogger<ApiUiDiagnosticsEndpointHandler> logger) {
		_accessPolicy = accessPolicy;
		_runtimePaths = runtimePaths;
		_taskProbe = taskProbe;
		_handshakeDiagnostics = handshakeDiagnostics;
		_contextFactory = contextFactory;
		_logger = logger;
	}

	/// <summary>
	/// Handles GET /ui/repair-status.
	/// </summary>
	public async Task<IResult> GetRepairStatusAsync(HttpContext context) {
		if (!_accessPolicy.IsLocalRequest(context)) {
			return Results.StatusCode(StatusCodes.Status403Forbidden);
		}

		var userscriptPath = Path.Combine(_runtimePaths.InstallRoot, "userscript", "organized-jihad.user.js");
		var runtimeHostPath = Path.Combine(_runtimePaths.InstallRoot, "runtime-host", "OrganizedJihad.Api.TrayHost.exe");
		var legacyTrayHostPath = Path.Combine(_runtimePaths.InstallRoot, "api-tray", "OrganizedJihad.Api.TrayHost.exe");
		var apiServiceTaskStatus = _taskProbe.GetStatus("OrganizedJihad.Api.Service");
		var apiTrayTaskStatus = _taskProbe.GetStatus("OrganizedJihad.Api.Tray");
		var handshake = await _handshakeDiagnostics.GetStatusAsync(_contextFactory);

		var hasDatabase = File.Exists(_runtimePaths.DatabasePath);
		var hasUserscript = File.Exists(userscriptPath);
		var hasTrayHost = File.Exists(runtimeHostPath) || File.Exists(legacyTrayHostPath);

		var recommendation = hasDatabase && hasUserscript && hasTrayHost
			? "Runtime artifacts look healthy."
			: "One or more runtime artifacts are missing. Re-run installer with managed CLI (dotnet run --project installer-core/OrganizedJihad.Installer.Cli -- --run-install-health-check) from your install bundle/repo to repair setup.";

		if (OperatingSystem.IsWindows()
			&& (apiServiceTaskStatus.Status.StartsWith("missing", StringComparison.OrdinalIgnoreCase)
			|| apiTrayTaskStatus.Status.StartsWith("missing", StringComparison.OrdinalIgnoreCase))) {
			recommendation += " Startup tasks are not fully registered; rerun installer as Administrator to restore service/tray startup automation.";
		}

		if (!handshake.HasRecentSync) {
			recommendation += " Userscript handshake is stale or missing; verify Tampermonkey script enablement and run install-health-check diagnostics.";
		}

		_logger.LogInformation(
			"Repair status requested. DB={HasDatabase}, Script={HasUserscript}, Tray={HasTrayHost}, Handshake={HandshakeStatus}",
			hasDatabase,
			hasUserscript,
			hasTrayHost,
			handshake.Status);

		return Results.Ok(new {
			installRoot = _runtimePaths.InstallRoot,
			hasDatabase,
			hasUserscript,
			hasTrayHost,
			apiServiceTaskStatus = apiServiceTaskStatus.Status,
			apiTrayTaskStatus = apiTrayTaskStatus.Status,
			handshakeStatus = handshake.Status,
			handshakeLastSyncUtc = handshake.LastSyncUtc,
			handshakeAgeMinutes = handshake.AgeMinutes,
			recommendation,
			checkedUtc = DateTime.UtcNow,
		});
	}

	/// <summary>
	/// Handles GET /ui/userscript-handshake.
	/// </summary>
	public async Task<IResult> GetUserscriptHandshakeAsync(HttpContext context) {
		if (!_accessPolicy.IsLocalRequest(context)) {
			return Results.StatusCode(StatusCodes.Status403Forbidden);
		}

		var handshake = await _handshakeDiagnostics.GetStatusAsync(_contextFactory);
		_logger.LogInformation("Userscript handshake diagnostics requested. Status={Status}, LastSyncUtc={LastSyncUtc}", handshake.Status, handshake.LastSyncUtc);

		return Results.Ok(new {
			status = handshake.Status,
			lastSyncUtc = handshake.LastSyncUtc,
			ageMinutes = handshake.AgeMinutes,
			hasRecentSync = handshake.HasRecentSync,
			recommendedChecks = new[] {
				"Confirm Tampermonkey extension is installed and enabled in your active browser.",
				"Confirm organized-jihad.user.js is installed and enabled in Tampermonkey.",
				"Open Hero Wars, then verify /api/sync/health and /api/sync/last-sync endpoints.",
				"Run userscript install check: yarn install:check --open failed"
			},
			checkedUtc = DateTime.UtcNow,
		});
	}
}
