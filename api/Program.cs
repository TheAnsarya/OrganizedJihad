using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Api.Services;
using OrganizedJihad.Data;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// Configure CORS for browser userscript access
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy.AllowAnyOrigin()
			  .AllowAnyMethod()
			  .AllowAnyHeader()));

// Configure SQLite database
var dbPath = Path.Combine(AppContext.BaseDirectory, "herowars.db");
builder.Services.AddDbContextFactory<GameDatabaseContext>(options =>
	options.UseSqlite($"Data Source={dbPath}"));

// Register services
builder.Services.AddScoped<SyncService>();

var app = builder.Build();

// Initialize database (skip in test environment to avoid conflicts with InMemory provider)
if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ASPNETCORE_TEST_ENV"))) {
	using (var scope = app.Services.CreateScope()) {
		var contextFactory = scope.ServiceProvider.GetRequiredService<IDbContextFactory<GameDatabaseContext>>();
		await using var context = await contextFactory.CreateDbContextAsync();
		await context.Database.MigrateAsync();
		app.Logger.LogInformation("Database initialized at: {DbPath}", dbPath);
	}
}

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment()) {
	// Swagger removed for simplicity
}

app.UseCors();
app.MapControllers();

// Welcome endpoint
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

