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
	private readonly ApiUiPageTokenBuilder _tokenBuilder;
	private readonly ApiUiHealthProbeService _healthProbe;
	private readonly UserscriptHandshakeDiagnosticsService _handshakeDiagnostics;
	private readonly IDbContextFactory<GameDatabaseContext> _contextFactory;

	/// <summary>
	/// Initializes a new instance of the page endpoint handler.
	/// </summary>
	public ApiUiPageEndpointHandler(
		ApiUiAccessPolicy accessPolicy,
		ApiUiTemplateRenderer renderer,
		ApiUiPageTokenBuilder tokenBuilder,
		ApiUiHealthProbeService healthProbe,
		UserscriptHandshakeDiagnosticsService handshakeDiagnostics,
		IDbContextFactory<GameDatabaseContext> contextFactory) {
		_accessPolicy = accessPolicy;
		_renderer = renderer;
		_tokenBuilder = tokenBuilder;
		_healthProbe = healthProbe;
		_handshakeDiagnostics = handshakeDiagnostics;
		_contextFactory = contextFactory;
	}

	/// <summary>
	/// Handles GET /ui.
	/// </summary>
	public IResult GetUiPage(HttpContext context) {
		if (!_accessPolicy.IsLocalRequest(context)) {
			return Results.StatusCode(StatusCodes.Status403Forbidden);
		}

		var html = _renderer.Render("api-control.html", _tokenBuilder.BuildUiTokens(context));

		return Results.Content(html, "text/html");
	}

	/// <summary>
	/// Handles GET /ui/tray-health.
	/// </summary>
	public async Task<IResult> GetTrayHealthPageAsync(HttpContext context) {
		if (!_accessPolicy.IsLocalRequest(context)) {
			return Results.StatusCode(StatusCodes.Status403Forbidden);
		}

 		var healthStatus = await _healthProbe.ProbeStatusAsync(context);

		var handshake = await _handshakeDiagnostics.GetStatusAsync(_contextFactory);
		var now = DateTime.UtcNow;
		var html = _renderer.Render("tray-health.html", _tokenBuilder.BuildTrayHealthTokens(context, healthStatus, handshake, now));

		return Results.Content(html, "text/html");
	}
}
