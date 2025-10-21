using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using OrganizedJihad.Desktop.Data;
using OrganizedJihad.Desktop.Services;

namespace OrganizedJihad.Desktop;

public static class MauiProgram
{
	public static MauiApp CreateMauiApp()
	{
		var builder = MauiApp.CreateBuilder();
		builder
			.UseMauiApp<App>()
			.ConfigureFonts(fonts =>
			{
				fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
			});

		builder.Services.AddMauiBlazorWebView();

		// Configure SQLite database
		var dbPath = Path.Combine(FileSystem.AppDataDirectory, "herowars.db");
		builder.Services.AddDbContextFactory<GameDatabaseContext>(options =>
			options.UseSqlite($"Data Source={dbPath}"));

		// Register services
		builder.Services.AddScoped<SyncService>();

		// Logging
		builder.Logging.SetMinimumLevel(LogLevel.Information);

#if DEBUG
		builder.Services.AddBlazorWebViewDeveloperTools();
		builder.Logging.AddDebug();
#endif

		var app = builder.Build();

		// Ensure database is created
		InitializeDatabase(app.Services);

		return app;
	}

	/// <summary>
	/// Initializes the database, creating it if it doesn't exist and applying migrations.
	/// </summary>
	private static void InitializeDatabase(IServiceProvider services)
	{
		using var scope = services.CreateScope();
		var contextFactory = scope.ServiceProvider.GetRequiredService<IDbContextFactory<GameDatabaseContext>>();
		using var context = contextFactory.CreateDbContext();

		// Create database and apply migrations
		context.Database.EnsureCreated();

		// Log database location
		var logger = scope.ServiceProvider.GetRequiredService<ILogger<GameDatabaseContext>>();
		var dbPath = Path.Combine(FileSystem.AppDataDirectory, "herowars.db");
		logger.LogInformation("Database initialized at: {DbPath}", dbPath);
	}
}
