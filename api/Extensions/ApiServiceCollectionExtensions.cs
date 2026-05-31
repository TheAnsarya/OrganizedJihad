using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Api.Services;
using OrganizedJihad.Api.Services.Diagnostics;
using OrganizedJihad.Api.Services.ProjectedItemCatalog;
using OrganizedJihad.Api.Services.TeamRecommendation;
using OrganizedJihad.Api.Services.ToolCatalog;
using OrganizedJihad.Api.Services.Ui;
using OrganizedJihad.Data;

namespace OrganizedJihad.Api.Extensions;

/// <summary>
/// DI composition helpers for API startup.
/// </summary>
public static class ApiServiceCollectionExtensions {
	/// <summary>
	/// Registers core API services, database, and diagnostics dependencies.
	/// </summary>
	public static IServiceCollection AddApiComposition(this IServiceCollection services) {
		services.AddControllers();
		services.AddEndpointsApiExplorer();

		services.AddCors(options => options.AddDefaultPolicy(policy => policy
			.AllowAnyOrigin()
			.AllowAnyMethod()
			.AllowAnyHeader()));

		var runtimePaths = ApiRuntimePaths.FromEnvironment();
		services.AddSingleton(runtimePaths);

		services.AddDbContextFactory<GameDatabaseContext>(options =>
			options.UseSqlite($"Data Source={runtimePaths.DatabasePath}"));

		services.AddHttpClient("UiProbeClient", client => {
			client.Timeout = TimeSpan.FromSeconds(4);
		});

		services.AddSingleton<ApiUiAccessPolicy>();
		services.AddSingleton<ApiUiTemplateRenderer>();
		services.AddSingleton<ApiUiSettingsStore>();
		services.AddSingleton<ApiUiDiagnosticsResponseBuilder>();
		services.AddSingleton<UserscriptHandshakeDiagnosticsService>();
		services.AddSingleton<ScheduledTaskProbeService>();
		services.AddScoped<ApiUiSettingsEndpointHandler>();
		services.AddScoped<ApiUiDiagnosticsEndpointHandler>();
		services.AddScoped<ApiUiPageEndpointHandler>();

		services.AddScoped<IProjectedItemCatalogProvider, SeededProjectedItemCatalogProvider>();
		services.AddScoped<IExternalToolCatalogProvider, CuratedExternalToolCatalogProvider>();
		services.AddScoped<ITeamRecommendationStateStore, TeamRecommendationSyncMetadataStateStore>();
		services.AddScoped<SyncService>();

		return services;
	}
}
