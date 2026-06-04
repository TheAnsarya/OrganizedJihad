using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Api.Services.Ui;
using OrganizedJihad.Data;

namespace OrganizedJihad.Api.Extensions;

/// <summary>
/// WebApplication composition helpers for API startup and middleware wiring.
/// </summary>
public static class WebApplicationSetupExtensions {
	/// <summary>
	/// Applies pending database migrations unless test mode is explicitly enabled.
	/// </summary>
	public static async Task InitializeDatabaseAsync(this WebApplication app) {
		if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ASPNETCORE_TEST_ENV"))) {
			return;
		}

		using var scope = app.Services.CreateScope();
		var contextFactory = scope.ServiceProvider.GetRequiredService<IDbContextFactory<GameDatabaseContext>>();
		var paths = scope.ServiceProvider.GetRequiredService<ApiRuntimePaths>();
		await using var context = await contextFactory.CreateDbContextAsync();

		await context.Database.MigrateAsync();
		app.Logger.LogInformation("Database initialized at: {DbPath}", paths.DatabasePath);
	}

	/// <summary>
	/// Adds security headers to all /ui endpoint responses.
	/// </summary>
	public static IApplicationBuilder UseUiSecurityHeaders(this IApplicationBuilder app) {
		return app.Use(async (context, next) => {
			if (context.Request.Path.StartsWithSegments("/ui", StringComparison.OrdinalIgnoreCase)) {
				var accessPolicy = context.RequestServices.GetRequiredService<ApiUiAccessPolicy>();
				accessPolicy.ApplySecurityHeaders(context.Response);
			}

			await next();
		});
	}
}
