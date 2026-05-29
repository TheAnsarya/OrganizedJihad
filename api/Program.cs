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
				<div class="actions">
					<a class="button" href="/api/sync/health" target="_blank" rel="noreferrer">Open Health JSON</a>
					<a class="button" href="/api/sync/last-sync" target="_blank" rel="noreferrer">Open Last Sync JSON</a>
					<a class="button" href="/api/sync/stats" target="_blank" rel="noreferrer">Open Stats JSON</a>
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
		}

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

// Make the implicit Program class public for integration testing
// https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests
public partial class Program { }
