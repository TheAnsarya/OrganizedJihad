using OrganizedJihad.Api.Services.Ui;

namespace OrganizedJihad.Api.Endpoints;

/// <summary>
/// Maps lightweight system/introspection endpoints.
/// </summary>
public static class SystemEndpoints {
	/// <summary>
	/// Maps base API info endpoint.
	/// </summary>
	public static IEndpointRouteBuilder MapSystemEndpoints(this IEndpointRouteBuilder endpoints) {
		endpoints.MapGet("/", (ApiRuntimePaths runtimePaths) => new {
			status = "running",
			version = "1.0.0",
			database = runtimePaths.DatabasePath,
			ui = "/ui",
			endpoints = new[]
			{
				"GET  /ui - Local web UI for API status/config shell",
				"GET  /ui/tray-health - Local tray health dashboard page",
				"GET  /ui/daily-report - Daily report JSON payload",
				"GET  /ui/daily-report/latest - Latest generated daily report JSON payload",
				"GET  /ui/daily-report/history?limit=30 - Generated daily report history JSON payload",
				"POST /ui/daily-report/generate - Generate and persist latest daily report JSON payload",
				"GET  /ui/daily-report/export.csv - Export latest/generated daily report as CSV",
				"GET  /ui/daily-report-page - Daily report HTML page",
				"GET  /ui/daily-report-history-page - Daily report history HTML page",
				"GET  /ui/reporting-overview - Seven-day reporting overview JSON payload",
				"GET  /ui/reporting-overview-page - Seven-day reporting overview chart page",
				"GET  /docs - Scalar API documentation UI",
				"GET  /swagger - Compatibility redirect to /docs",
				"GET  /swagger/index.html - Compatibility redirect to /docs",
				"GET  /swagger/v1/swagger.json - OpenAPI JSON document",
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

		return endpoints;
	}
}
