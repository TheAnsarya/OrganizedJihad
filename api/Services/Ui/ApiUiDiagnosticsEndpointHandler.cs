using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Api.Models.Ui;
using OrganizedJihad.Api.Services.Diagnostics;
using OrganizedJihad.Data;
using System.Reflection;

namespace OrganizedJihad.Api.Services.Ui;

/// <summary>
/// Handles UI diagnostics endpoints for runtime repair and userscript handshake status.
/// </summary>
public sealed class ApiUiDiagnosticsEndpointHandler {
	private readonly ApiUiAccessPolicy _accessPolicy;
	private readonly ApiRuntimePaths _runtimePaths;
	private readonly ScheduledTaskProbeService _taskProbe;
	private readonly UserscriptHandshakeDiagnosticsService _handshakeDiagnostics;
	private readonly ApiUiDiagnosticsResponseBuilder _responseBuilder;
	private readonly ApiUiRepairRecommendationBuilder _recommendationBuilder;
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
		ApiUiDiagnosticsResponseBuilder responseBuilder,
		ApiUiRepairRecommendationBuilder recommendationBuilder,
		IDbContextFactory<GameDatabaseContext> contextFactory,
		ILogger<ApiUiDiagnosticsEndpointHandler> logger) {
		_accessPolicy = accessPolicy;
		_runtimePaths = runtimePaths;
		_taskProbe = taskProbe;
		_handshakeDiagnostics = handshakeDiagnostics;
		_responseBuilder = responseBuilder;
		_recommendationBuilder = recommendationBuilder;
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

		var recommendation = _recommendationBuilder.Build(
			hasDatabase: hasDatabase,
			hasUserscript: hasUserscript,
			hasTrayHost: hasTrayHost,
			apiServiceTaskStatus: apiServiceTaskStatus.Status,
			apiTrayTaskStatus: apiTrayTaskStatus.Status,
			hasRecentSync: handshake.HasRecentSync);

		_logger.LogInformation(
			"Repair status requested. DB={HasDatabase}, Script={HasUserscript}, Tray={HasTrayHost}, Handshake={HandshakeStatus}",
			hasDatabase,
			hasUserscript,
			hasTrayHost,
			handshake.Status);

		var response = _responseBuilder.BuildRepairStatus(
			installRoot: _runtimePaths.InstallRoot,
			hasDatabase: hasDatabase,
			hasUserscript: hasUserscript,
			hasTrayHost: hasTrayHost,
			apiServiceTaskStatus: apiServiceTaskStatus.Status,
			apiTrayTaskStatus: apiTrayTaskStatus.Status,
			handshake: handshake,
			recommendation: recommendation);

		return Results.Ok(response);
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

		var response = _responseBuilder.BuildUserscriptHandshake(handshake);
		return Results.Ok(response);
	}

	/// <summary>
	/// Handles GET /ui/runtime-versions.
	/// </summary>
	public IResult GetRuntimeVersions(HttpContext context) {
		if (!_accessPolicy.IsLocalRequest(context)) {
			return Results.StatusCode(StatusCodes.Status403Forbidden);
		}

		var userscriptPath = Path.Combine(_runtimePaths.InstallRoot, "userscript", "organized-jihad.user.js");
		var response = new ApiUiRuntimeVersionsResponse(
			ApiVersion: ResolveApiAssemblyVersion(),
			ApiInformationalVersion: ResolveApiInformationalVersion(),
			UserscriptVersion: ResolveUserscriptVersion(userscriptPath),
			UserscriptPath: userscriptPath,
			CheckedUtc: DateTime.UtcNow);

		return Results.Ok(response);
	}

	/// <summary>
	/// Handles GET /ui/userscript-file.
	/// </summary>
	public IResult GetUserscriptFileAsync(HttpContext context) {
		return GetUserscriptInstallScriptAsync(context);
	}

	/// <summary>
	/// Handles GET /ui/organized-jihad.user.js.
	/// </summary>
	public IResult GetUserscriptInstallScriptAsync(HttpContext context) {
		if (!_accessPolicy.IsLocalRequest(context)) {
			return Results.StatusCode(StatusCodes.Status403Forbidden);
		}

		var userscriptPath = Path.Combine(_runtimePaths.InstallRoot, "userscript", "organized-jihad.user.js");
		if (!File.Exists(userscriptPath)) {
			_logger.LogWarning("Userscript file endpoint requested but file missing: {Path}", userscriptPath);
			return Results.NotFound(new {
				message = "Userscript file is not installed yet.",
				path = userscriptPath,
			});
		}

		_logger.LogInformation("Userscript install endpoint requested. Serving file from {Path}", userscriptPath);
		return Results.File(userscriptPath, "application/javascript; charset=utf-8", enableRangeProcessing: false);
	}

	private static string ResolveApiAssemblyVersion() {
		var version = Assembly.GetEntryAssembly()?.GetName().Version;
		return version is null ? "unknown" : version.ToString();
	}

	private static string ResolveApiInformationalVersion() {
		var informational = Assembly
			.GetEntryAssembly()?
			.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
			.InformationalVersion;

		return string.IsNullOrWhiteSpace(informational) ? "unknown" : informational;
	}

	private static string ResolveUserscriptVersion(string userscriptPath) {
		if (!File.Exists(userscriptPath)) {
			return "missing";
		}

		try {
			foreach (var line in File.ReadLines(userscriptPath).Take(80)) {
				if (!line.Contains("@version", StringComparison.OrdinalIgnoreCase)) {
					continue;
				}

				var markerIndex = line.IndexOf("@version", StringComparison.OrdinalIgnoreCase);
				if (markerIndex < 0) {
					continue;
				}

				var value = line[(markerIndex + "@version".Length)..].Trim();
				if (!string.IsNullOrWhiteSpace(value)) {
					return value;
				}
			}
		} catch {
			return "unreadable";
		}

		return "unknown";
	}
}
