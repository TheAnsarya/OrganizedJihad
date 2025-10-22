using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using OrganizedJihad.Data;
using OrganizedJihad.Desktop.Services;

namespace OrganizedJihad.Desktop;

public static class MauiProgram {
	public static MauiApp CreateMauiApp() {
		var builder = MauiApp.CreateBuilder();
		builder
			.UseMauiApp<App>()

<<<<<<< TODO: Unmerged change from project 'OrganizedJihad.Desktop(net10.0-ios)', Before:
			.ConfigureFonts(fonts =>
			{
				fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
			});
=======
			.ConfigureFonts(fonts => fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular"));
>>>>>>> After
			.ConfigureFonts(fonts => fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular"));

		builder.Services.AddMauiBlazorWebView();

		// Configure SQLite database
		var dbPath = Path.Combine(FileSystem.AppDataDirectory, "herowars.db");
		builder.Services.AddDbContextFactory<GameDatabaseContext>(options =>
			options.UseSqlite($"Data Source={dbPath}"));

		// Register services
		builder.Services.AddScoped<SyncService>();

		// TODO: Add API host service once ASP.NET Core hosting is configured
		// builder.Services.AddSingleton<ApiHostService>();

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
	private static void InitializeDatabase(IServiceProvider services) {
		using var scope = services.CreateScope();
		var contextFactory = scope.ServiceProvider.GetRequiredService<IDbContextFactory<GameDatabaseContext>>();
		using var context = contextFactory.CreateDbContext();

		// Create database and apply migrations
		context.Database.Migrate();  // Use migrations instead of EnsureCreated

		// Log database location
		var logger = scope.ServiceProvider.GetRequiredService<ILogger<GameDatabaseContext>>();
		var dbPath = Path.Combine(FileSystem.AppDataDirectory, "herowars.db");
		logger.LogInformation("Database initialized at: {DbPath}", dbPath);
	}
}
