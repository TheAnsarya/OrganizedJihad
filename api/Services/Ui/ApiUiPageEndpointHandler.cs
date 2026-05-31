using System.Net;
using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Api.Services.Diagnostics;
using OrganizedJihad.Data;

namespace OrganizedJihad.Api.Services.Ui;

/// <summary>
/// Handles API UI page endpoints.
/// </summary>
public sealed class ApiUiPageEndpointHandler {
	private readonly ApiUiAccessPolicy _accessPolicy;
	private readonly ApiUiTemplateRenderer _renderer;
	private readonly UserscriptHandshakeDiagnosticsService _handshakeDiagnostics;
	private readonly IDbContextFactory<GameDatabaseContext> _contextFactory;
	private readonly IHttpClientFactory _httpClientFactory;

	/// <summary>
	/// Initializes a new instance of the page endpoint handler.
	/// </summary>
	public ApiUiPageEndpointHandler(
		ApiUiAccessPolicy accessPolicy,
		ApiUiTemplateRenderer renderer,
		UserscriptHandshakeDiagnosticsService handshakeDiagnostics,
		IDbContextFactory<GameDatabaseContext> contextFactory,
		IHttpClientFactory httpClientFactory) {
		_accessPolicy = accessPolicy;
		_renderer = renderer;
		_handshakeDiagnostics = handshakeDiagnostics;
		_contextFactory = contextFactory;
		_httpClientFactory = httpClientFactory;
	}

	/// <summary>
	/// Handles GET /ui.
	/// </summary>
	public IResult GetUiPage(HttpContext context) {
		if (!_accessPolicy.IsLocalRequest(context)) {
			return Results.StatusCode(StatusCodes.Status403Forbidden);
		}

		var baseUrl = $"{context.Request.Scheme}://{context.Request.Host}";
		var html = _renderer.Render("api-control.html", new Dictionary<string, string> {
			["__BASE_URL__"] = WebUtility.HtmlEncode(baseUrl),
		});

		return Results.Content(html, "text/html");
	}

	/// <summary>
	/// Handles GET /ui/tray-health.
	/// </summary>
	public async Task<IResult> GetTrayHealthPageAsync(HttpContext context) {
		if (!_accessPolicy.IsLocalRequest(context)) {
			return Results.StatusCode(StatusCodes.Status403Forbidden);
		}

		var healthStatus = "unknown";
		try {
			var probeUrl = $"{context.Request.Scheme}://{context.Request.Host}/api/sync/health";
			using var response = await _httpClientFactory.CreateClient("UiProbeClient").GetAsync(probeUrl);
			healthStatus = response.IsSuccessStatusCode ? "online" : $"degraded ({(int)response.StatusCode})";
		} catch {
			healthStatus = "offline";
		}

		var handshake = await _handshakeDiagnostics.GetStatusAsync(_contextFactory);
		var now = DateTime.UtcNow;
		var baseUrl = $"{context.Request.Scheme}://{context.Request.Host}";
		var html = _renderer.Render("tray-health.html", new Dictionary<string, string> {
			["__BASE_URL__"] = WebUtility.HtmlEncode(baseUrl),
			["__HEALTH_STATUS__"] = WebUtility.HtmlEncode(healthStatus),
			["__CHECKED_UTC__"] = WebUtility.HtmlEncode(now.ToString("yyyy-MM-dd HH:mm:ss")),
			["__HANDSHAKE_STATUS__"] = WebUtility.HtmlEncode(handshake.Status),
			["__LAST_SYNC_UTC__"] = WebUtility.HtmlEncode(handshake.LastSyncUtc is null ? "none" : handshake.LastSyncUtc.Value.ToString("u")),
		});

		return Results.Content(html, "text/html");
	}
}
