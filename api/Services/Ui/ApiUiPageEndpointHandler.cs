using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Api.Services.Diagnostics;
using OrganizedJihad.Data;
using System.Text;

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

	/// <summary>
	/// Handles GET /ui/logs/latest.
	/// </summary>
	public IResult GetLatestApiLogPage(HttpContext context) {
		if (!_accessPolicy.IsLocalRequest(context)) {
			return Results.StatusCode(StatusCodes.Status403Forbidden);
		}

		var logsDirectory = ResolveLogsDirectory();
		if (string.IsNullOrWhiteSpace(logsDirectory) || !Directory.Exists(logsDirectory)) {
			return Results.Text("No server logs directory found.", "text/plain", Encoding.UTF8);
		}

		var latestLogPath = Directory
			.GetFiles(logsDirectory, "api-*.log", SearchOption.TopDirectoryOnly)
			.OrderByDescending(path => File.GetLastWriteTimeUtc(path))
			.FirstOrDefault();

		if (string.IsNullOrWhiteSpace(latestLogPath) || !File.Exists(latestLogPath)) {
			return Results.Text("No API log files found.", "text/plain", Encoding.UTF8);
		}

		var allLines = File.ReadAllLines(latestLogPath);
		var tailLines = allLines.Length <= 400 ? allLines : allLines[^400..];
		var header = $"Latest API log: {latestLogPath}{Environment.NewLine}Total lines: {allLines.Length}{Environment.NewLine}Showing: {tailLines.Length}{Environment.NewLine}{new string('-', 80)}{Environment.NewLine}";
		var payload = header + string.Join(Environment.NewLine, tailLines);

		return Results.Text(payload, "text/plain", Encoding.UTF8);
	}

	private static string? ResolveLogsDirectory() {
		var appBaseLogs = Path.Combine(AppContext.BaseDirectory, "Logs");
		if (Directory.Exists(appBaseLogs)) {
			return appBaseLogs;
		}

		var cwdLogs = Path.Combine(Directory.GetCurrentDirectory(), "Logs");
		if (Directory.Exists(cwdLogs)) {
			return cwdLogs;
		}

		return null;
	}
}
