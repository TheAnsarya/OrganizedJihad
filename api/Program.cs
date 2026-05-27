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

// Root endpoint - provides API information and available endpoints
// https://learn.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis
app.MapGet("/", () => new {
	status = "running",
	version = "1.0.0",
	database = dbPath,
	endpoints = new[]
	{
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
