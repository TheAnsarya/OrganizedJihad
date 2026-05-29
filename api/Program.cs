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
var dbPath = Path.Combine(AppContext.BaseDirectory, "herowars.db");
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

app.MapGet("/ui/settings", () => {
	var settings = TryLoadApiUiSettings(uiSettingsPath) ?? defaultUiSettings;
	return Results.Ok(settings);
});

app.MapPost("/ui/settings", async (HttpContext context, ApiUiSettingsUpdateRequest request) => {
	var defaultApiBaseUrl = $"{context.Request.Scheme}://{context.Request.Host}";
	var normalized = new ApiUiSettings(
		AutoOpenHealthOnLoad: request.AutoOpenHealthOnLoad,
		ApiBaseUrl: string.IsNullOrWhiteSpace(request.ApiBaseUrl) ? defaultApiBaseUrl : request.ApiBaseUrl.Trim(),
		PreferredHeroWarsUrl: string.IsNullOrWhiteSpace(request.PreferredHeroWarsUrl) ? "https://www.hero-wars.com/" : request.PreferredHeroWarsUrl.Trim(),
		Notes: request.Notes?.Trim() ?? string.Empty,
		UpdatedUtc: DateTime.UtcNow);

	await SaveApiUiSettingsAsync(uiSettingsPath, normalized);
	return Results.Ok(normalized);
});

app.MapGet("/ui/repair-status", () => {
	var installRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OrganizedJihad");
	var apiDatabasePath = Path.Combine(AppContext.BaseDirectory, "herowars.db");
	var userscriptPath = Path.Combine(installRoot, "userscript", "organized-jihad.user.js");
	var trayHostPath = Path.Combine(installRoot, "api-tray", "OrganizedJihad.Api.TrayHost.exe");
	var apiServiceTaskStatus = GetScheduledTaskStatus("OrganizedJihad.Api.Service");
	var apiTrayTaskStatus = GetScheduledTaskStatus("OrganizedJihad.Api.Tray");

	var hasDatabase = File.Exists(apiDatabasePath);
	var hasUserscript = File.Exists(userscriptPath);
	var hasTrayHost = File.Exists(trayHostPath);

	var recommendation = hasDatabase && hasUserscript && hasTrayHost
		? "Runtime artifacts look healthy."
		: "One or more runtime artifacts are missing. Re-run Install-OrganizedJihad.ps1 from your install bundle to repair setup.";

	if (OperatingSystem.IsWindows() &&
		(apiServiceTaskStatus.Status.StartsWith("missing", StringComparison.OrdinalIgnoreCase)
		|| apiTrayTaskStatus.Status.StartsWith("missing", StringComparison.OrdinalIgnoreCase))) {
		recommendation += " Startup tasks are not fully registered; rerun installer as Administrator to restore service/tray startup automation.";
	}

	return Results.Ok(new {
		installRoot,
		hasDatabase,
		hasUserscript,
		hasTrayHost,
		apiServiceTaskStatus = apiServiceTaskStatus.Status,
		apiTrayTaskStatus = apiTrayTaskStatus.Status,
		recommendation,
		checkedUtc = DateTime.UtcNow,
	});
});

// Local web UI endpoint for service-style API configuration and status checks.
// This is intentionally lightweight and dependency-free so it is always available
// when the API starts from tray/startup tasks.
app.MapGet("/ui", (HttpContext context) => {
	var baseUrl = $"{context.Request.Scheme}://{context.Request.Host}";
	var html = $$"""
<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>OrganizedJihad API Control</title>
	<style>
		:root {
			--bg: #0b1220;
			--card: #111a2b;
			--ink: #f1f5f9;
			--muted: #94a3b8;
			--line: #1e293b;
			--ok: #22c55e;
			--warn: #f59e0b;
			--accent: #38bdf8;
		}

		* {
			box-sizing: border-box;
		}

		body {
			margin: 0;
			font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
			background: radial-gradient(circle at top, #172554 0%, #0b1220 45%);
			color: var(--ink);
		}

		main {
			max-width: 960px;
			margin: 0 auto;
			padding: 28px 18px 40px;
		}

		h1 {
			margin: 0 0 10px;
			font-size: 30px;
		}

		p {
			margin: 0;
			color: var(--muted);
		}

		.grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
			gap: 14px;
			margin-top: 20px;
		}

		.card {
			background: rgba(17, 26, 43, 0.92);
			border: 1px solid var(--line);
			border-radius: 12px;
			padding: 14px;
		}

		h2 {
			margin: 0 0 10px;
			font-size: 18px;
		}

		.stat {
			font-size: 26px;
			font-weight: 700;
			margin: 2px 0;
		}

		.ok {
			color: var(--ok);
		}

		.warn {
			color: var(--warn);
		}

		.actions {
			display: flex;
			flex-wrap: wrap;
			gap: 10px;
			margin-top: 14px;
		}

		a.button {
			display: inline-block;
			padding: 9px 12px;
			border-radius: 8px;
			border: 1px solid #0c4a6e;
			background: rgba(14, 116, 144, 0.24);
			color: var(--accent);
			text-decoration: none;
			font-weight: 600;
		}

		code {
			background: #1e293b;
			padding: 2px 6px;
			border-radius: 6px;
		}
	</style>
</head>
<body>
	<main>
		<h1>OrganizedJihad API Control</h1>
		<p>
			This local page is used for service-style runtime checks, userscript connectivity validation, and setup/update guidance.
		</p>

		<div class="grid">
			<section class="card">
				<h2>Service Status</h2>
				<div id="healthState" class="stat">Checking...</div>
				<p id="healthDetail">Probing <code>{{baseUrl}}/api/sync/health</code></p>
			</section>

			<section class="card">
				<h2>Sync Metadata</h2>
				<div id="lastSync" class="stat">...</div>
				<p>Last known sync time from browser userscript.</p>
			</section>

			<section class="card">
				<h2>Setup / Update</h2>
				<p>
					If userscript, API, or tray startup behavior needs repair, rerun installer script from your install bundle.
				</p>
				<div id="repairSummary" style="margin-top: 10px; color: var(--muted);">Checking runtime artifacts...</div>
				<div id="taskSummary" style="margin-top: 6px; color: var(--muted);">Checking startup task status...</div>
				<div class="actions">
					<a class="button" href="/api/sync/health" target="_blank" rel="noreferrer">Open Health JSON</a>
					<a class="button" href="/api/sync/last-sync" target="_blank" rel="noreferrer">Open Last Sync JSON</a>
					<a class="button" href="/api/sync/stats" target="_blank" rel="noreferrer">Open Stats JSON</a>
					<a class="button" id="openHeroWars" href="https://www.hero-wars.com/" target="_blank" rel="noreferrer">Open Hero Wars</a>
				</div>
			</section>

			<section class="card">
				<h2>UI Settings</h2>
				<p style="margin-bottom: 10px;">Settings are persisted to <code>api-ui-settings.json</code> next to API binaries.</p>
				<div style="display: grid; gap: 8px;">
					<label style="display: flex; gap: 8px; align-items: center; color: var(--ink);">
						<input id="autoHealth" type="checkbox" />
						Auto-load health and sync data when page opens
					</label>
					<label style="display: grid; gap: 4px;">
						<span style="color: var(--ink);">API Base URL</span>
						<input id="apiBaseUrl" type="text" style="padding: 8px; border-radius: 8px; border: 1px solid var(--line); background: #0f172a; color: var(--ink);" />
					</label>
					<label style="display: grid; gap: 4px;">
						<span style="color: var(--ink);">Preferred Hero Wars URL</span>
						<input id="heroWarsUrl" type="text" style="padding: 8px; border-radius: 8px; border: 1px solid var(--line); background: #0f172a; color: var(--ink);" />
					</label>
					<label style="display: grid; gap: 4px;">
						<span style="color: var(--ink);">Notes</span>
						<textarea id="uiNotes" rows="3" style="padding: 8px; border-radius: 8px; border: 1px solid var(--line); background: #0f172a; color: var(--ink);"></textarea>
					</label>
					<div class="actions">
						<button id="saveSettings" style="cursor: pointer; padding: 9px 12px; border-radius: 8px; border: 1px solid #0c4a6e; background: rgba(14, 116, 144, 0.24); color: var(--accent); font-weight: 600;">Save Settings</button>
					</div>
					<div id="settingsStatus" style="color: var(--muted);">Loading settings...</div>
				</div>
			</section>
		</div>
	</main>

	<script>
		async function fetchJson(url) {
			const response = await fetch(url, { cache: 'no-store' });
			if (!response.ok) {
				throw new Error('HTTP ' + response.status);
			}
			return await response.json();
		}

		async function refresh() {
			const healthState = document.getElementById('healthState');
			const healthDetail = document.getElementById('healthDetail');
			const lastSync = document.getElementById('lastSync');
			const repairSummary = document.getElementById('repairSummary');
			const taskSummary = document.getElementById('taskSummary');

			try {
				const health = await fetchJson('/api/sync/health');
				healthState.textContent = 'Online';
				healthState.className = 'stat ok';
				healthDetail.textContent = 'API health: ' + JSON.stringify(health);
			} catch (error) {
				healthState.textContent = 'Unavailable';
				healthState.className = 'stat warn';
				healthDetail.textContent = 'Health probe failed: ' + error.message;
			}

			try {
				const sync = await fetchJson('/api/sync/last-sync');
				if (sync.lastSyncTime) {
					lastSync.textContent = new Date(sync.lastSyncTime).toLocaleString();
				} else {
					lastSync.textContent = 'No sync yet';
				}
			} catch {
				lastSync.textContent = 'Unknown';
			}

			try {
				const repair = await fetchJson('/ui/repair-status');
				repairSummary.textContent = repair.recommendation + ' (Checked: ' + new Date(repair.checkedUtc).toLocaleString() + ')';
				taskSummary.textContent = 'Startup tasks -> Service: ' + repair.apiServiceTaskStatus + ' | Tray: ' + repair.apiTrayTaskStatus;
			} catch {
				repairSummary.textContent = 'Could not retrieve runtime repair status.';
				taskSummary.textContent = 'Startup task status unavailable.';
			}
		}

		async function loadSettings() {
			const autoHealth = document.getElementById('autoHealth');
			const apiBaseUrl = document.getElementById('apiBaseUrl');
			const heroWarsUrl = document.getElementById('heroWarsUrl');
			const uiNotes = document.getElementById('uiNotes');
			const openHeroWars = document.getElementById('openHeroWars');
			const settingsStatus = document.getElementById('settingsStatus');

			try {
				const settings = await fetchJson('/ui/settings');
				autoHealth.checked = !!settings.autoOpenHealthOnLoad;
				apiBaseUrl.value = settings.apiBaseUrl || window.location.origin;
				heroWarsUrl.value = settings.preferredHeroWarsUrl || 'https://www.hero-wars.com/';
				uiNotes.value = settings.notes || '';
				openHeroWars.href = heroWarsUrl.value;
				settingsStatus.textContent = 'Settings loaded.';
			} catch (error) {
				settingsStatus.textContent = 'Settings load failed: ' + error.message;
			}
		}

		async function saveSettings() {
			const autoHealth = document.getElementById('autoHealth');
			const apiBaseUrl = document.getElementById('apiBaseUrl');
			const heroWarsUrl = document.getElementById('heroWarsUrl');
			const uiNotes = document.getElementById('uiNotes');
			const openHeroWars = document.getElementById('openHeroWars');
			const settingsStatus = document.getElementById('settingsStatus');

			settingsStatus.textContent = 'Saving settings...';
			try {
				const response = await fetch('/ui/settings', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						autoOpenHealthOnLoad: autoHealth.checked,
						apiBaseUrl: apiBaseUrl.value,
						preferredHeroWarsUrl: heroWarsUrl.value,
						notes: uiNotes.value
					})
				});
				if (!response.ok) {
					throw new Error('HTTP ' + response.status);
				}
				const saved = await response.json();
				apiBaseUrl.value = saved.apiBaseUrl || apiBaseUrl.value;
				heroWarsUrl.value = saved.preferredHeroWarsUrl || heroWarsUrl.value;
				openHeroWars.href = heroWarsUrl.value;
				settingsStatus.textContent = 'Settings saved at ' + new Date(saved.updatedUtc).toLocaleString();
			} catch (error) {
				settingsStatus.textContent = 'Save failed: ' + error.message;
			}
		}

		document.getElementById('saveSettings').addEventListener('click', saveSettings);
		loadSettings();
		refresh();
		setInterval(refresh, 15000);
	</script>
</body>
</html>
""";

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
		"GET  /ui/settings - Get persisted API UI settings",
		"POST /ui/settings - Save persisted API UI settings",
		"GET  /ui/repair-status - Runtime setup/update repair hints",
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
