using Microsoft.Extensions.Options;
using OrganizedJihad.Api.Configuration;
using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Api.Models.Ui;
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
	private readonly ApiUiDailyReportService _dailyReportService;
	private readonly DailyReportAutomationOptions _dailyReportOptions;
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
		ApiUiDailyReportService dailyReportService,
		IOptions<DailyReportAutomationOptions> dailyReportOptions,
		IDbContextFactory<GameDatabaseContext> contextFactory) {
		_accessPolicy = accessPolicy;
		_renderer = renderer;
		_tokenBuilder = tokenBuilder;
		_healthProbe = healthProbe;
		_handshakeDiagnostics = handshakeDiagnostics;
		_dailyReportService = dailyReportService;
		_dailyReportOptions = dailyReportOptions.Value;
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

		var candidateLogPaths = Directory
			.GetFiles(logsDirectory, "api-*.log", SearchOption.TopDirectoryOnly)
			.OrderByDescending(path => File.GetLastWriteTimeUtc(path))
			.ToList();

		if (candidateLogPaths.Count == 0) {
			return Results.Text("No API log files found.", "text/plain", Encoding.UTF8);
		}

		foreach (var logPath in candidateLogPaths) {
			if (!File.Exists(logPath)) {
				continue;
			}

			if (!TryReadTailLines(logPath, 400, out var totalLines, out var tailLines)) {
				continue;
			}

			var header = $"Latest API log: {logPath}{Environment.NewLine}Total lines: {totalLines}{Environment.NewLine}Showing: {tailLines.Count}{Environment.NewLine}{new string('-', 80)}{Environment.NewLine}";
			var payload = header + string.Join(Environment.NewLine, tailLines);

			return Results.Text(payload, "text/plain", Encoding.UTF8);
		}

		return Results.Text("No readable API log files found.", "text/plain", Encoding.UTF8);
	}

	/// <summary>
	/// Handles GET /ui/daily-report.
	/// </summary>
	public async Task<IResult> GetDailyReportJsonAsync(HttpContext context) {
		if (!_accessPolicy.IsLocalRequest(context)) {
			return Results.StatusCode(StatusCodes.Status403Forbidden);
		}

		var report = await _dailyReportService.BuildDailyReportAsync(context.RequestAborted);
		return Results.Json(report);
	}

	/// <summary>
	/// Handles GET /ui/daily-report/latest.
	/// </summary>
	public async Task<IResult> GetDailyReportLatestJsonAsync(HttpContext context) {
		if (!_accessPolicy.IsLocalRequest(context)) {
			return Results.StatusCode(StatusCodes.Status403Forbidden);
		}

		var report = await _dailyReportService.LoadLatestDailyReportAsync(context.RequestAborted)
			?? await _dailyReportService.BuildDailyReportAsync(context.RequestAborted);
		return Results.Json(report);
	}

	/// <summary>
	/// Handles POST /ui/daily-report/generate.
	/// </summary>
	public async Task<IResult> GenerateDailyReportJsonAsync(HttpContext context) {
		if (!_accessPolicy.IsLocalRequest(context)) {
			return Results.StatusCode(StatusCodes.Status403Forbidden);
		}

		var report = await _dailyReportService.GenerateAndPersistDailyReportAsync(_dailyReportOptions.RetentionDays, context.RequestAborted);
		return Results.Json(report);
	}

	/// <summary>
	/// Handles GET /ui/daily-report/history.
	/// </summary>
	public async Task<IResult> GetDailyReportHistoryJsonAsync(HttpContext context, int? limit) {
		if (!_accessPolicy.IsLocalRequest(context)) {
			return Results.StatusCode(StatusCodes.Status403Forbidden);
		}

		var reports = await _dailyReportService.LoadDailyReportHistoryAsync(limit ?? 30, context.RequestAborted);
		var response = new ApiUiDailyReportHistoryResponse(
			GeneratedAtUtc: DateTime.UtcNow,
			RetainedDays: Math.Clamp(_dailyReportOptions.RetentionDays, 1, 365),
			Reports: reports);

		return Results.Json(response);
	}

	/// <summary>
	/// Handles GET /ui/daily-report/export.csv.
	/// </summary>
	public async Task<IResult> ExportDailyReportCsvAsync(HttpContext context) {
		if (!_accessPolicy.IsLocalRequest(context)) {
			return Results.StatusCode(StatusCodes.Status403Forbidden);
		}

		var report = await _dailyReportService.LoadLatestDailyReportAsync(context.RequestAborted)
			?? await _dailyReportService.BuildDailyReportAsync(context.RequestAborted);
		var csv = ApiUiDailyReportService.BuildDailyReportCsv(report);
		var fileName = $"daily-report-{report.DateUtc:yyyy-MM-dd}.csv";
		return Results.File(Encoding.UTF8.GetBytes(csv), "text/csv", fileName);
	}

	/// <summary>
	/// Handles GET /ui/daily-report-page.
	/// </summary>
	public async Task<IResult> GetDailyReportPageAsync(HttpContext context) {
		if (!_accessPolicy.IsLocalRequest(context)) {
			return Results.StatusCode(StatusCodes.Status403Forbidden);
		}

		var report = await _dailyReportService.BuildDailyReportAsync(context.RequestAborted);
		var html = _renderer.Render("daily-report.html", _tokenBuilder.BuildDailyReportTokens(context, report));
		return Results.Content(html, "text/html");
	}

	/// <summary>
	/// Handles GET /ui/reporting-overview.
	/// </summary>
	public async Task<IResult> GetReportingOverviewJsonAsync(HttpContext context) {
		if (!_accessPolicy.IsLocalRequest(context)) {
			return Results.StatusCode(StatusCodes.Status403Forbidden);
		}

		var overview = await BuildReportingOverviewAsync();
		return Results.Json(overview);
	}

	/// <summary>
	/// Handles GET /ui/reporting-overview-page.
	/// </summary>
	public IResult GetReportingOverviewPage(HttpContext context) {
		if (!_accessPolicy.IsLocalRequest(context)) {
			return Results.StatusCode(StatusCodes.Status403Forbidden);
		}

		var html = _renderer.Render("reporting-overview.html", _tokenBuilder.BuildUiTokens(context));
		return Results.Content(html, "text/html");
	}

	/// <summary>
	/// Handles GET /swagger and /swagger/index.html.
	/// </summary>
	public IResult GetSwaggerUiPage(HttpContext context) {
		if (!_accessPolicy.IsLocalRequest(context)) {
			return Results.StatusCode(StatusCodes.Status403Forbidden);
		}

		var html = _renderer.Render("swagger-ui.html", _tokenBuilder.BuildUiTokens(context));
		return Results.Content(html, "text/html");
	}

	private async Task<ApiUiReportingOverviewResponse> BuildReportingOverviewAsync() {
		await using var dbContext = await _contextFactory.CreateDbContextAsync();
		var nowUtc = DateTime.UtcNow;
		var todayStartUtc = nowUtc.Date;
		var points = new List<ApiUiReportingDailyPoint>(capacity: 7);

		for (var i = 6; i >= 0; i--) {
			var dayStartUtc = todayStartUtc.AddDays(-i);
			var dayEndUtc = dayStartUtc.AddDays(1);

			var arenaBattles = await dbContext.ArenaBattles.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc);
			var grandArenaBattles = await dbContext.GrandArenaBattles.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc);
			var titanArenaBattles = await dbContext.TitanArenaBattles.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc);
			var guildWarBattles = await dbContext.GuildWarBattles.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc);
			var raidBossAttacks = await dbContext.RaidBossAttacks.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc);
			var expeditionBattles = await dbContext.ExpeditionBattles.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc);

			var questCompletions = await dbContext.QuestCompletions.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc)
				+ await dbContext.DailyQuestCompletions.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc)
				+ await dbContext.GuildQuestCompletions.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc);

			var resourceTransactions = await dbContext.ResourceTransactions.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc);
			var chestOpenings = await dbContext.ChestOpenings.AsNoTracking().CountAsync(item => item.DateCreated >= dayStartUtc && item.DateCreated < dayEndUtc);

			points.Add(new ApiUiReportingDailyPoint(
				DateUtc: dayStartUtc,
				BattlesTracked: arenaBattles + grandArenaBattles + titanArenaBattles + guildWarBattles + raidBossAttacks + expeditionBattles,
				QuestCompletions: questCompletions,
				ResourceTransactions: resourceTransactions,
				ChestOpenings: chestOpenings));
		}

		var syncTimestampRaw = await dbContext.SyncMetadata
			.AsNoTracking()
			.Where(item => item.Key == "last_sync_timestamp")
			.Select(item => item.Value)
			.FirstOrDefaultAsync();

		DateTime? lastSyncUtc = null;
		if (!string.IsNullOrWhiteSpace(syncTimestampRaw) && DateTime.TryParse(syncTimestampRaw, out var parsedSyncUtc)) {
			lastSyncUtc = DateTime.SpecifyKind(parsedSyncUtc, DateTimeKind.Utc);
		}

		return new ApiUiReportingOverviewResponse(
			GeneratedAtUtc: nowUtc,
			LastSyncUtc: lastSyncUtc,
			DailyPoints: points);
	}

	private static bool TryReadTailLines(string path, int maxTailLines, out int totalLines, out List<string> tailLines) {
		totalLines = 0;
		tailLines = new List<string>();

		try {
			using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
			using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);

			var queue = new Queue<string>(Math.Max(1, maxTailLines));
			while (reader.ReadLine() is { } line) {
				totalLines++;
				if (queue.Count == maxTailLines) {
					queue.Dequeue();
				}

				queue.Enqueue(line);
			}

			tailLines = queue.ToList();
			return true;
		}
		catch (IOException) {
			return false;
		}
		catch (UnauthorizedAccessException) {
			return false;
		}
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
