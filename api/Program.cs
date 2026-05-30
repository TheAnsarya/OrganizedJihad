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
			--oj-purple: #3a143c;
			--oj-brown-dark: #2a1f14;
			--oj-orange: #d4821d;
			--oj-brown-light: #90590d;
			--bg: #2a1f14;
			--card: #3a143c;
			--ink: #fdf3dc;
			--muted: #d2b583;
			--line: #90590d;
			--ok: #d4821d;
			--warn: #e2a957;
			--accent: #d4821d;
		}

		* {
			box-sizing: border-box;
		}

		body {
			margin: 0;
			font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
			background: radial-gradient(circle at top, #3a143c 0%, #2a1f14 60%);
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
			background: rgba(58, 20, 60, 0.92);
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
			border: 1px solid var(--oj-brown-light);
			background: rgba(212, 130, 29, 0.16);
			color: var(--accent);
			text-decoration: none;
			font-weight: 600;
		}

		code {
			background: rgba(42, 31, 20, 0.92);
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
				<div id="handshakeSummary" style="margin-top: 6px; color: var(--muted);">Checking userscript handshake...</div>
				<div class="actions">
					<a class="button" href="/api/sync/health" target="_blank" rel="noreferrer">Open Health JSON</a>
					<a class="button" href="/api/sync/last-sync" target="_blank" rel="noreferrer">Open Last Sync JSON</a>
					<a class="button" href="/api/sync/stats" target="_blank" rel="noreferrer">Open Stats JSON</a>
					<a class="button" href="/ui/userscript-handshake" target="_blank" rel="noreferrer">Open Handshake JSON</a>
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
						<input id="apiBaseUrl" type="text" style="padding: 8px; border-radius: 8px; border: 1px solid var(--line); background: var(--oj-brown-dark); color: var(--ink);" />
					</label>
					<label style="display: grid; gap: 4px;">
						<span style="color: var(--ink);">Preferred Hero Wars URL</span>
						<input id="heroWarsUrl" type="text" style="padding: 8px; border-radius: 8px; border: 1px solid var(--line); background: var(--oj-brown-dark); color: var(--ink);" />
					</label>
					<label style="display: grid; gap: 4px;">
						<span style="color: var(--ink);">Notes</span>
						<textarea id="uiNotes" rows="3" style="padding: 8px; border-radius: 8px; border: 1px solid var(--line); background: var(--oj-brown-dark); color: var(--ink);"></textarea>
					</label>
					<div class="actions">
						<button id="saveSettings" style="cursor: pointer; padding: 9px 12px; border-radius: 8px; border: 1px solid var(--oj-brown-light); background: rgba(212, 130, 29, 0.16); color: var(--accent); font-weight: 600;">Save Settings</button>
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
			const handshakeSummary = document.getElementById('handshakeSummary');

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
				handshakeSummary.textContent = 'Handshake -> ' + repair.handshakeStatus + (repair.handshakeLastSyncUtc ? ' (Last sync: ' + new Date(repair.handshakeLastSyncUtc).toLocaleString() + ')' : ' (No sync recorded yet)');
			} catch {
				repairSummary.textContent = 'Could not retrieve runtime repair status.';
				taskSummary.textContent = 'Startup task status unavailable.';
				handshakeSummary.textContent = 'Userscript handshake status unavailable.';
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

		(async function initialize() {
			await loadSettings();
			const autoHealth = document.getElementById('autoHealth');
			if (autoHealth.checked) {
				await refresh();
				setInterval(refresh, 15000);
			} else {
				document.getElementById('healthState').textContent = 'Auto refresh disabled';
				document.getElementById('healthState').className = 'stat warn';
				document.getElementById('healthDetail').textContent = 'Enable "Auto-load health" in settings, then save and refresh this page.';
			}
		})();
	</script>
</body>
</html>
""";

	return Results.Content(html, "text/html");
});

app.MapGet("/ui/tray-health", async (HttpContext context, IDbContextFactory<GameDatabaseContext> contextFactory) => {
	if (!IsLocalUiAccessRequest(context)) {
		return Results.StatusCode(StatusCodes.Status403Forbidden);
	}

	var healthStatus = "unknown";
	try {
		using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(4) };
		var probeUrl = $"{context.Request.Scheme}://{context.Request.Host}/api/sync/health";
		using var response = await http.GetAsync(probeUrl);
		healthStatus = response.IsSuccessStatusCode ? "online" : $"degraded ({(int)response.StatusCode})";
	} catch {
		healthStatus = "offline";
	}

	var repair = await GetUserscriptHandshakeStatusAsync(contextFactory);
	var now = DateTime.UtcNow;
	var html = $$"""
<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>OJ Tray Health</title>
	<style>
		:root {
			--oj-purple: #3a143c;
			--oj-brown-dark: #2a1f14;
			--oj-orange: #d4821d;
			--oj-brown-light: #90590d;
			--ink: #fdf3dc;
			--muted: #d2b583;
		}

		* { box-sizing: border-box; }
		body {
			margin: 0;
			font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
			background: radial-gradient(circle at top, var(--oj-purple) 0%, var(--oj-brown-dark) 58%);
			color: var(--ink);
		}
		main {
			max-width: 860px;
			margin: 0 auto;
			padding: 24px 18px 36px;
		}
		.grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
			gap: 12px;
			margin-top: 14px;
		}
		.card {
			border: 1px solid var(--oj-brown-light);
			background: rgba(58, 20, 60, 0.88);
			border-radius: 12px;
			padding: 12px;
		}
		h1 { margin: 0; }
		h2 { margin: 0 0 8px; font-size: 17px; }
		.value { font-size: 25px; font-weight: 700; }
		.muted { color: var(--muted); }
		a.button {
			display: inline-block;
			padding: 8px 11px;
			margin-right: 8px;
			margin-top: 8px;
			border-radius: 8px;
			border: 1px solid var(--oj-brown-light);
			background: rgba(212, 130, 29, 0.18);
			color: var(--ink);
			text-decoration: none;
		}
	</style>
</head>
<body>
	<main>
		<h1>OrganizedJihad Tray Health</h1>
		<p class="muted">Live runtime summary for tray-launched API instance.</p>
		<div class="grid">
			<section class="card">
				<h2>API Health</h2>
				<div class="value">{{healthStatus}}</div>
				<div class="muted">Probe URL: {{context.Request.Scheme}}://{{context.Request.Host}}/api/sync/health</div>
			</section>
			<section class="card">
				<h2>API Base URL</h2>
				<div class="value">{{context.Request.Scheme}}://{{context.Request.Host}}</div>
				<div class="muted">Checked UTC: {{now:yyyy-MM-dd HH:mm:ss}}</div>
			</section>
			<section class="card">
				<h2>Userscript Handshake</h2>
				<div class="value">{{repair.Status}}</div>
				<div class="muted">Last sync: {{(repair.LastSyncUtc is null ? "none" : repair.LastSyncUtc.Value.ToString("u"))}}</div>
			</section>
		</div>
		<div style="margin-top: 14px;">
			<a class="button" href="/ui">Open API Control UI</a>
			<a class="button" href="/ui/repair-status">Open Repair Status JSON</a>
			<a class="button" href="/ui/userscript-handshake">Open Handshake JSON</a>
			<a class="button" href="/api/sync/stats">Open Sync Stats JSON</a>
		</div>
	</main>
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
