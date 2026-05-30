/// <summary>
/// OrganizedJihad API - Hero Wars Game Data Tracking Backend
///
/// This ASP.NET Core minimal API provides endpoints for synchronizing game data
/// from a browser userscript to a local SQLite database. It serves as the backend
/// for tracking player progress, battle results, and game statistics.
///
/// Architecture:
/// - ASP.NET Core 10.0 Web API
/// - Entity Framework Core with SQLite
/// - DbContextFactory pattern for better performance and thread safety
/// - CORS enabled for browser userscript access
///
/// References:
/// - ASP.NET Core: https://learn.microsoft.com/en-us/aspnet/core/
/// - EF Core DbContextFactory: https://learn.microsoft.com/en-us/ef/core/dbcontext-configuration/#using-a-dbcontext-factory
/// - SQLite: https://www.sqlite.org/
/// </summary>

using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Api.Services.ProjectedItemCatalog;
using OrganizedJihad.Api.Services;
using OrganizedJihad.Api.Services.TeamRecommendation;
using OrganizedJihad.Api.Services.ToolCatalog;
using OrganizedJihad.Data;
using OrganizedJihad.Data.Models;
using System.Net;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
// https://learn.microsoft.com/en-us/aspnet/core/fundamentals/dependency-injection
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// Configure CORS for browser userscript access
// Allows the TamperMonkey userscript to make cross-origin requests to this API
// https://learn.microsoft.com/en-us/aspnet/core/security/cors
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy.AllowAnyOrigin()
			  .AllowAnyMethod()
			  .AllowAnyHeader()));

// Configure SQLite database with DbContextFactory pattern
// DbContextFactory is recommended for better performance and thread safety
// https://learn.microsoft.com/en-us/ef/core/dbcontext-configuration/#using-a-dbcontext-factory
var dbPath = ResolveApiDatabasePath();
builder.Services.AddDbContextFactory<GameDatabaseContext>(options =>
	options.UseSqlite($"Data Source={dbPath}"));

// Register application services
// Scoped lifetime ensures one instance per HTTP request
// https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection#service-lifetimes
builder.Services.AddScoped<IProjectedItemCatalogProvider, SeededProjectedItemCatalogProvider>();
builder.Services.AddScoped<IExternalToolCatalogProvider, CuratedExternalToolCatalogProvider>();
builder.Services.AddScoped<ITeamRecommendationStateStore, TeamRecommendationSyncMetadataStateStore>();
builder.Services.AddScoped<SyncService>();

var app = builder.Build();
var uiProbeClient = new HttpClient {
	Timeout = TimeSpan.FromSeconds(4),
};

// Initialize database with EF Core migrations
// Skip in test environment to avoid conflicts with InMemory provider
// Tests set ASPNETCORE_TEST_ENV environment variable to bypass this
// https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/
if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ASPNETCORE_TEST_ENV"))) {
	using var scope = app.Services.CreateScope();
	var contextFactory = scope.ServiceProvider.GetRequiredService<IDbContextFactory<GameDatabaseContext>>();
	await using var context = await contextFactory.CreateDbContextAsync();

	// Apply pending migrations to bring database schema up to date
	await context.Database.MigrateAsync();
	app.Logger.LogInformation("Database initialized at: {DbPath}", dbPath);
}

// Configure the HTTP request pipeline
// https://learn.microsoft.com/en-us/aspnet/core/fundamentals/middleware/
if (app.Environment.IsDevelopment()) {
	// Development-specific middleware would go here (e.g., Swagger)
}

// Enable CORS middleware - must be called before MapControllers
// https://learn.microsoft.com/en-us/aspnet/core/security/cors
app.UseCors();

app.Use(async (context, next) => {
	if (context.Request.Path.StartsWithSegments("/ui", StringComparison.OrdinalIgnoreCase)) {
		ApplyUiSecurityHeaders(context.Response);
	}

	await next();
});

// Map controller endpoints
// https://learn.microsoft.com/en-us/aspnet/core/mvc/controllers/routing
app.MapControllers();

var uiSettingsPath = ResolveApiUiSettingsPath();
var defaultUiSettings = new ApiUiSettings(
	AutoOpenHealthOnLoad: true,
	ApiBaseUrl: "http://localhost:5124",
	PreferredHeroWarsUrl: "https://www.hero-wars.com/",
	Notes: string.Empty,
	UpdatedUtc: DateTime.UtcNow);

app.MapGet("/ui/settings", (HttpContext context) => {
	if (!IsLocalUiAccessRequest(context)) {
		return Results.StatusCode(StatusCodes.Status403Forbidden);
	}

	var settings = TryLoadApiUiSettings(uiSettingsPath) ?? defaultUiSettings;
	app.Logger.LogInformation("UI settings fetched from {SettingsPath}", uiSettingsPath);
	return Results.Ok(settings);
});

app.MapPost("/ui/settings", async (HttpContext context, ApiUiSettingsUpdateRequest request) => {
	if (!IsLocalUiAccessRequest(context)) {
		return Results.StatusCode(StatusCodes.Status403Forbidden);
	}

	var defaultApiBaseUrl = $"{context.Request.Scheme}://{context.Request.Host}";
	if (!TryNormalizeLocalApiUrl(request.ApiBaseUrl, defaultApiBaseUrl, out var normalizedApiBaseUrl, out var apiBaseUrlError)) {
		return Results.BadRequest(new { error = apiBaseUrlError });
	}

	if (!TryNormalizeHeroWarsUrl(request.PreferredHeroWarsUrl, out var normalizedHeroWarsUrl, out var heroWarsError)) {
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

	await SaveApiUiSettingsAsync(uiSettingsPath, normalized);
	app.Logger.LogInformation("UI settings saved at {UpdatedUtc} from {RemoteIp}", normalized.UpdatedUtc, context.Connection.RemoteIpAddress);
	return Results.Ok(normalized);
});

app.MapGet("/ui/repair-status", async (HttpContext context, IDbContextFactory<GameDatabaseContext> contextFactory) => {
	if (!IsLocalUiAccessRequest(context)) {
		return Results.StatusCode(StatusCodes.Status403Forbidden);
	}

	var installRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OrganizedJihad");
	var apiDatabasePath = Path.Combine(AppContext.BaseDirectory, "herowars.db");
	var userscriptPath = Path.Combine(installRoot, "userscript", "organized-jihad.user.js");
	var runtimeHostPath = Path.Combine(installRoot, "runtime-host", "OrganizedJihad.Api.TrayHost.exe");
	var legacyTrayHostPath = Path.Combine(installRoot, "api-tray", "OrganizedJihad.Api.TrayHost.exe");
	var apiServiceTaskStatus = GetScheduledTaskStatus("OrganizedJihad.Api.Service");
	var apiTrayTaskStatus = GetScheduledTaskStatus("OrganizedJihad.Api.Tray");
	var handshake = await GetUserscriptHandshakeStatusAsync(contextFactory);

	var hasDatabase = File.Exists(apiDatabasePath);
	var hasUserscript = File.Exists(userscriptPath);
	var hasTrayHost = File.Exists(runtimeHostPath) || File.Exists(legacyTrayHostPath);

	var recommendation = hasDatabase && hasUserscript && hasTrayHost
		? "Runtime artifacts look healthy."
		: "One or more runtime artifacts are missing. Re-run installer with managed CLI (dotnet run --project installer-core/OrganizedJihad.Installer.Cli -- --run-install-health-check) from your install bundle/repo to repair setup.";

	if (OperatingSystem.IsWindows() &&
		(apiServiceTaskStatus.Status.StartsWith("missing", StringComparison.OrdinalIgnoreCase)
		|| apiTrayTaskStatus.Status.StartsWith("missing", StringComparison.OrdinalIgnoreCase))) {
		recommendation += " Startup tasks are not fully registered; rerun installer as Administrator to restore service/tray startup automation.";
	}

	if (!handshake.HasRecentSync) {
		recommendation += " Userscript handshake is stale or missing; verify Tampermonkey script enablement and run install-health-check diagnostics.";
	}

	app.Logger.LogInformation("Repair status requested. DB={HasDatabase}, Script={HasUserscript}, Tray={HasTrayHost}, Handshake={HandshakeStatus}", hasDatabase, hasUserscript, hasTrayHost, handshake.Status);

	return Results.Ok(new {
		installRoot,
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

app.MapGet("/ui/userscript-handshake", async (HttpContext context, IDbContextFactory<GameDatabaseContext> contextFactory) => {
	if (!IsLocalUiAccessRequest(context)) {
		return Results.StatusCode(StatusCodes.Status403Forbidden);
	}

	var handshake = await GetUserscriptHandshakeStatusAsync(contextFactory);
	app.Logger.LogInformation("Userscript handshake diagnostics requested. Status={Status}, LastSyncUtc={LastSyncUtc}", handshake.Status, handshake.LastSyncUtc);

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

// Local web UI endpoint for service-style API configuration and status checks.
// This is intentionally lightweight and dependency-free so it is always available
// when the API starts from tray/startup tasks.
app.MapGet("/ui", (HttpContext context) => {
	if (!IsLocalUiAccessRequest(context)) {
		return Results.StatusCode(StatusCodes.Status403Forbidden);
	}

	var baseUrl = GetRequestBaseUrl(context);
	var html = LoadUiTemplate("api-control.html", new Dictionary<string, string> {
		["__BASE_URL__"] = WebUtility.HtmlEncode(baseUrl),
	});

	return Results.Content(html, "text/html");
});

app.MapGet("/ui/tray-health", async (HttpContext context, IDbContextFactory<GameDatabaseContext> contextFactory) => {
	if (!IsLocalUiAccessRequest(context)) {
		return Results.StatusCode(StatusCodes.Status403Forbidden);
	}

	var healthStatus = "unknown";
	try {
		var probeUrl = $"{context.Request.Scheme}://{context.Request.Host}/api/sync/health";
		using var response = await uiProbeClient.GetAsync(probeUrl);
		healthStatus = response.IsSuccessStatusCode ? "online" : $"degraded ({(int)response.StatusCode})";
	} catch {
		healthStatus = "offline";
	}

	var repair = await GetUserscriptHandshakeStatusAsync(contextFactory);
	var now = DateTime.UtcNow;
	var baseUrl = GetRequestBaseUrl(context);
	var html = LoadUiTemplate("tray-health.html", new Dictionary<string, string> {
		["__BASE_URL__"] = WebUtility.HtmlEncode(baseUrl),
		["__HEALTH_STATUS__"] = WebUtility.HtmlEncode(healthStatus),
		["__CHECKED_UTC__"] = WebUtility.HtmlEncode(now.ToString("yyyy-MM-dd HH:mm:ss")),
		["__HANDSHAKE_STATUS__"] = WebUtility.HtmlEncode(repair.Status),
		["__LAST_SYNC_UTC__"] = WebUtility.HtmlEncode(repair.LastSyncUtc is null ? "none" : repair.LastSyncUtc.Value.ToString("u")),
	});

	return Results.Content(html, "text/html");
});

// Root endpoint - provides API information and available endpoints
// https://learn.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis
app.MapGet("/", () => new {
	status = "running",
	version = "1.0.0",
	database = dbPath,
	ui = "/ui",
	endpoints = new[]
	{
		"GET  /ui - Local web UI for API status/config shell",
		"GET  /ui/tray-health - Local tray health dashboard page",
		"GET  /ui/settings - Get persisted API UI settings",
		"POST /ui/settings - Save persisted API UI settings",
		"GET  /ui/repair-status - Runtime setup/update repair hints",
		"GET  /ui/userscript-handshake - Userscript handshake diagnostics",
		"GET  /api/sync/health - Health check",
		"POST /api/sync/import - Import data from browser",
		"GET  /api/sync/last-sync - Get last sync timestamp",
		"GET  /api/sync/stats - Get database statistics",
		"GET  /api/sync/snapshots?limit=10 - Get recent snapshots",
		"GET  /api/sync/battles?limit=20 - Get recent battles",
		"GET  /api/sync/opponents - Get all opponents"
	}
});

app.Run();

static string ResolveApiUiSettingsPath() {
	var overridePath = Environment.GetEnvironmentVariable("OJ_API_UI_SETTINGS_PATH");
	if (!string.IsNullOrWhiteSpace(overridePath)) {
		return overridePath;
	}

	return Path.Combine(AppContext.BaseDirectory, "api-ui-settings.json");
}

static string ResolveApiDatabasePath() {
	var overridePath = Environment.GetEnvironmentVariable("OJ_DB_PATH");
	if (!string.IsNullOrWhiteSpace(overridePath)) {
		return overridePath;
	}

	return Path.Combine(AppContext.BaseDirectory, "herowars.db");
}

static string GetRequestBaseUrl(HttpContext context) {
	return $"{context.Request.Scheme}://{context.Request.Host}";
}

static string LoadUiTemplate(string templateFileName, IReadOnlyDictionary<string, string> replacements) {
	var templatePath = ResolveUiTemplatePath(templateFileName);
	if (!File.Exists(templatePath)) {
		throw new FileNotFoundException($"UI template not found: {templatePath}");
	}

	var html = File.ReadAllText(templatePath);
	foreach (var replacement in replacements) {
		html = html.Replace(replacement.Key, replacement.Value, StringComparison.Ordinal);
	}

	return html;
}

static string ResolveUiTemplatePath(string templateFileName) {
	return Path.Combine(AppContext.BaseDirectory, "Resources", "UiTemplates", templateFileName);
}

static bool IsLocalUiAccessRequest(HttpContext context) {
	var remoteAddress = context.Connection.RemoteIpAddress;
	if (remoteAddress is null) {
		return true;
	}

	if (IPAddress.IsLoopback(remoteAddress)) {
		return true;
	}

	if (remoteAddress.AddressFamily == System.Net.Sockets.AddressFamily.InterNetworkV6
		&& remoteAddress.IsIPv4MappedToIPv6
		&& IPAddress.IsLoopback(remoteAddress.MapToIPv4())) {
		return true;
	}

	return false;
}

static void ApplyUiSecurityHeaders(HttpResponse response) {
	response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate";
	response.Headers["Pragma"] = "no-cache";
	response.Headers["X-Content-Type-Options"] = "nosniff";
	response.Headers["X-Frame-Options"] = "DENY";
	response.Headers["Referrer-Policy"] = "no-referrer";
}

static bool TryNormalizeLocalApiUrl(string? rawUrl, string fallbackUrl, out string normalizedUrl, out string? error) {
	normalizedUrl = fallbackUrl;
	error = null;

	if (string.IsNullOrWhiteSpace(rawUrl)) {
		return true;
	}

	var candidate = rawUrl.Trim();
	if (!Uri.TryCreate(candidate, UriKind.Absolute, out var uri)) {
		error = "API Base URL must be an absolute URL.";
		return false;
	}

	if (!string.Equals(uri.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase)
		&& !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)) {
		error = "API Base URL must use http or https.";
		return false;
	}

	if (!string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase)
		&& !string.Equals(uri.Host, "127.0.0.1", StringComparison.OrdinalIgnoreCase)
		&& !string.Equals(uri.Host, "::1", StringComparison.OrdinalIgnoreCase)) {
		error = "API Base URL must target localhost/loopback only.";
		return false;
	}

	normalizedUrl = uri.GetLeftPart(UriPartial.Authority);
	return true;
}

static bool TryNormalizeHeroWarsUrl(string? rawUrl, out string normalizedUrl, out string? error) {
	normalizedUrl = "https://www.hero-wars.com/";
	error = null;

	if (string.IsNullOrWhiteSpace(rawUrl)) {
		return true;
	}

	var candidate = rawUrl.Trim();
	if (!Uri.TryCreate(candidate, UriKind.Absolute, out var uri)) {
		error = "Preferred Hero Wars URL must be an absolute URL.";
		return false;
	}

	if (!string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)) {
		error = "Preferred Hero Wars URL must use https.";
		return false;
	}

	if (!uri.Host.Contains("hero-wars.com", StringComparison.OrdinalIgnoreCase)) {
		error = "Preferred Hero Wars URL must target hero-wars.com.";
		return false;
	}

	normalizedUrl = uri.ToString();
	return true;
}

static async Task<(string Status, DateTime? LastSyncUtc, double? AgeMinutes, bool HasRecentSync)> GetUserscriptHandshakeStatusAsync(IDbContextFactory<GameDatabaseContext> contextFactory) {
	try {
		await using var context = await contextFactory.CreateDbContextAsync();
		var metadata = await context.SyncMetadata.FirstOrDefaultAsync(m => m.Key == "last_sync_timestamp");
		if (metadata is null || string.IsNullOrWhiteSpace(metadata.Value)) {
			return ("missing", null, null, false);
		}

		if (!DateTime.TryParse(metadata.Value, out var parsed)) {
			return ("invalid", null, null, false);
		}

		var lastSyncUtc = DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
		var ageMinutes = Math.Max(0d, (DateTime.UtcNow - lastSyncUtc).TotalMinutes);
		var hasRecentSync = ageMinutes <= 30d;
		var status = hasRecentSync ? "active" : "stale";
		return (status, lastSyncUtc, Math.Round(ageMinutes, 2), hasRecentSync);
	} catch {
		return ("unknown", null, null, false);
	}
}

static ApiUiSettings? TryLoadApiUiSettings(string settingsPath) {
	if (!File.Exists(settingsPath)) {
		return null;
	}

	try {
		var raw = File.ReadAllText(settingsPath);
		return JsonSerializer.Deserialize<ApiUiSettings>(raw);
	} catch {
		return null;
	}
}

static async Task SaveApiUiSettingsAsync(string settingsPath, ApiUiSettings settings) {
	var directory = Path.GetDirectoryName(settingsPath);
	if (!string.IsNullOrWhiteSpace(directory)) {
		Directory.CreateDirectory(directory);
	}

	var json = JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = true });
	await File.WriteAllTextAsync(settingsPath, json);
}

static (string Status, string Detail) GetScheduledTaskStatus(string taskName) {
	if (!OperatingSystem.IsWindows()) {
		return ("n/a", "Scheduled tasks are only available on Windows.");
	}

	try {
		var startInfo = new System.Diagnostics.ProcessStartInfo {
			FileName = "schtasks.exe",
			Arguments = $"/Query /TN \"{taskName}\" /FO LIST /V",
			UseShellExecute = false,
			RedirectStandardOutput = true,
			RedirectStandardError = true,
			CreateNoWindow = true,
		};

		using var process = System.Diagnostics.Process.Start(startInfo);
		if (process is null) {
			return ("unknown", "Could not start schtasks query process.");
		}

		var output = process.StandardOutput.ReadToEnd();
		var errors = process.StandardError.ReadToEnd();
		process.WaitForExit(5000);

		if (process.ExitCode != 0) {
			var message = string.IsNullOrWhiteSpace(errors) ? "Task missing or inaccessible." : errors.Trim();
			return ("missing", message);
		}

		var statusLine = output.Split(Environment.NewLine)
			.Select(line => line.Trim())
			.FirstOrDefault(line => line.StartsWith("Status:", StringComparison.OrdinalIgnoreCase));

		if (!string.IsNullOrWhiteSpace(statusLine)) {
			return (statusLine.Replace("Status:", string.Empty, StringComparison.OrdinalIgnoreCase).Trim(), statusLine);
		}

		return ("registered", "Task exists.");
	} catch (Exception ex) {
		return ("unknown", ex.Message);
	}
}

internal sealed record ApiUiSettings(bool AutoOpenHealthOnLoad, string ApiBaseUrl, string PreferredHeroWarsUrl, string Notes, DateTime UpdatedUtc);

internal sealed record ApiUiSettingsUpdateRequest(bool AutoOpenHealthOnLoad, string ApiBaseUrl, string PreferredHeroWarsUrl, string? Notes);

// Make the implicit Program class public for integration testing
// https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests
public partial class Program { }
