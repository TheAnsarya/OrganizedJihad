using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Api.Services.Diagnostics;
using OrganizedJihad.Api.Services.Ui;
using OrganizedJihad.Data;
using System.Net;

namespace OrganizedJihad.Api.Endpoints;

public static partial class ApiUiEndpoints {
	private static void MapPageEndpoints(IEndpointRouteBuilder endpoints) {
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
	}
}
