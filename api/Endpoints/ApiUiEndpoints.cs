using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Api.Models.Ui;
using OrganizedJihad.Api.Services.Diagnostics;
using OrganizedJihad.Api.Services.Ui;
using OrganizedJihad.Data;
using System.Net;

namespace OrganizedJihad.Api.Endpoints;

/// <summary>
/// Maps local UI shell endpoints, diagnostics pages, and persisted UI settings operations.
/// </summary>
public static class ApiUiEndpoints {
	/// <summary>
	/// Maps all local-only API UI endpoints under /ui.
	/// </summary>
	public static IEndpointRouteBuilder MapApiUiEndpoints(this IEndpointRouteBuilder endpoints) {
		endpoints.MapGet("/ui/settings", (HttpContext context, ApiUiAccessPolicy accessPolicy, ApiUiSettingsStore settingsStore, ILoggerFactory loggerFactory) => {
			if (!accessPolicy.IsLocalRequest(context)) {
				return Results.StatusCode(StatusCodes.Status403Forbidden);
			}

			var settings = settingsStore.TryLoad() ?? settingsStore.CreateDefault();
			loggerFactory.CreateLogger("ApiUiEndpoints").LogInformation("UI settings fetched from {SettingsPath}", settingsStore.SettingsPath);
			return Results.Ok(settings);
		});

		endpoints.MapPost("/ui/settings", async (HttpContext context, ApiUiSettingsUpdateRequest request, ApiUiAccessPolicy accessPolicy, ApiUiSettingsStore settingsStore, ILoggerFactory loggerFactory) => {
			if (!accessPolicy.IsLocalRequest(context)) {
				return Results.StatusCode(StatusCodes.Status403Forbidden);
			}

			var defaultApiBaseUrl = GetRequestBaseUrl(context);
			if (!ApiUiInputNormalizer.TryNormalizeLocalApiUrl(request.ApiBaseUrl, defaultApiBaseUrl, out var normalizedApiBaseUrl, out var apiBaseUrlError)) {
				return Results.BadRequest(new { error = apiBaseUrlError });
			}

			if (!ApiUiInputNormalizer.TryNormalizeHeroWarsUrl(request.PreferredHeroWarsUrl, out var normalizedHeroWarsUrl, out var heroWarsError)) {
				return Results.BadRequest(new { error = heroWarsError });
			}

			var normalizedNotes = (request.Notes ?? string.Empty).Trim();
			if (normalizedNotes.Length > 2048) {
				return Results.BadRequest(new { error = "Notes must be 2048 characters or less." });
			}

			var normalized = new ApiUiSettings(
				AutoOpenHealthOnLoad: request.AutoOpenHealthOnLoad,
				ApiBaseUrl: normalizedApiBaseUrl,
				PreferredHeroWarsUrl: normalizedHeroWarsUrl,
				Notes: normalizedNotes,
				UpdatedUtc: DateTime.UtcNow);

			await settingsStore.SaveAsync(normalized);
			loggerFactory.CreateLogger("ApiUiEndpoints").LogInformation("UI settings saved at {UpdatedUtc} from {RemoteIp}", normalized.UpdatedUtc, context.Connection.RemoteIpAddress);
			return Results.Ok(normalized);
		});

		endpoints.MapGet("/ui/repair-status", async (
			HttpContext context,
			ApiUiAccessPolicy accessPolicy,
			ApiRuntimePaths runtimePaths,
			ScheduledTaskProbeService taskProbe,
			UserscriptHandshakeDiagnosticsService handshakeDiagnostics,
			IDbContextFactory<GameDatabaseContext> contextFactory,
			ILoggerFactory loggerFactory) => {
			if (!accessPolicy.IsLocalRequest(context)) {
				return Results.StatusCode(StatusCodes.Status403Forbidden);
			}

			var userscriptPath = Path.Combine(runtimePaths.InstallRoot, "userscript", "organized-jihad.user.js");
			var runtimeHostPath = Path.Combine(runtimePaths.InstallRoot, "runtime-host", "OrganizedJihad.Api.TrayHost.exe");
			var legacyTrayHostPath = Path.Combine(runtimePaths.InstallRoot, "api-tray", "OrganizedJihad.Api.TrayHost.exe");
			var apiServiceTaskStatus = taskProbe.GetStatus("OrganizedJihad.Api.Service");
			var apiTrayTaskStatus = taskProbe.GetStatus("OrganizedJihad.Api.Tray");
			var handshake = await handshakeDiagnostics.GetStatusAsync(contextFactory);

			var hasDatabase = File.Exists(runtimePaths.DatabasePath);
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

			loggerFactory.CreateLogger("ApiUiEndpoints").LogInformation(
				"Repair status requested. DB={HasDatabase}, Script={HasUserscript}, Tray={HasTrayHost}, Handshake={HandshakeStatus}",
				hasDatabase,
				hasUserscript,
				hasTrayHost,
				handshake.Status);

			return Results.Ok(new {
				installRoot = runtimePaths.InstallRoot,
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
		});

		endpoints.MapGet("/ui/userscript-handshake", async (HttpContext context, ApiUiAccessPolicy accessPolicy, UserscriptHandshakeDiagnosticsService handshakeDiagnostics, IDbContextFactory<GameDatabaseContext> contextFactory, ILoggerFactory loggerFactory) => {
			if (!accessPolicy.IsLocalRequest(context)) {
				return Results.StatusCode(StatusCodes.Status403Forbidden);
			}

			var handshake = await handshakeDiagnostics.GetStatusAsync(contextFactory);
			loggerFactory.CreateLogger("ApiUiEndpoints").LogInformation("Userscript handshake diagnostics requested. Status={Status}, LastSyncUtc={LastSyncUtc}", handshake.Status, handshake.LastSyncUtc);

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
		});

		endpoints.MapGet("/ui", (HttpContext context, ApiUiAccessPolicy accessPolicy, ApiUiTemplateRenderer renderer) => {
			if (!accessPolicy.IsLocalRequest(context)) {
				return Results.StatusCode(StatusCodes.Status403Forbidden);
			}

			var baseUrl = GetRequestBaseUrl(context);
			var html = renderer.Render("api-control.html", new Dictionary<string, string> {
				["__BASE_URL__"] = WebUtility.HtmlEncode(baseUrl),
			});

			return Results.Content(html, "text/html");
		});

		endpoints.MapGet("/ui/tray-health", async (
			HttpContext context,
			ApiUiAccessPolicy accessPolicy,
			ApiUiTemplateRenderer renderer,
			UserscriptHandshakeDiagnosticsService handshakeDiagnostics,
			IDbContextFactory<GameDatabaseContext> contextFactory,
			IHttpClientFactory httpClientFactory) => {
			if (!accessPolicy.IsLocalRequest(context)) {
				return Results.StatusCode(StatusCodes.Status403Forbidden);
			}

			var healthStatus = "unknown";
			try {
				var probeUrl = $"{context.Request.Scheme}://{context.Request.Host}/api/sync/health";
				using var response = await httpClientFactory.CreateClient("UiProbeClient").GetAsync(probeUrl);
				healthStatus = response.IsSuccessStatusCode ? "online" : $"degraded ({(int)response.StatusCode})";
			} catch {
				healthStatus = "offline";
			}

			var handshake = await handshakeDiagnostics.GetStatusAsync(contextFactory);
			var now = DateTime.UtcNow;
			var baseUrl = GetRequestBaseUrl(context);
			var html = renderer.Render("tray-health.html", new Dictionary<string, string> {
				["__BASE_URL__"] = WebUtility.HtmlEncode(baseUrl),
				["__HEALTH_STATUS__"] = WebUtility.HtmlEncode(healthStatus),
				["__CHECKED_UTC__"] = WebUtility.HtmlEncode(now.ToString("yyyy-MM-dd HH:mm:ss")),
				["__HANDSHAKE_STATUS__"] = WebUtility.HtmlEncode(handshake.Status),
				["__LAST_SYNC_UTC__"] = WebUtility.HtmlEncode(handshake.LastSyncUtc is null ? "none" : handshake.LastSyncUtc.Value.ToString("u")),
			});

			return Results.Content(html, "text/html");
		});

		return endpoints;
	}

	private static string GetRequestBaseUrl(HttpContext context) {
		return $"{context.Request.Scheme}://{context.Request.Host}";
	}
}
