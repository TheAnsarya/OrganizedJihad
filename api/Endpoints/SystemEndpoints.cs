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
				"GET  /ui/runtime-versions - API + installed userscript version diagnostics",
				"GET  /ui/repair-status - Runtime setup/update repair hints",
				"GET  /ui/userscript-handshake - Userscript handshake diagnostics",
				"GET  /api/sync/health - Health check",
				"POST /api/sync/import - Import data from browser",
				"GET  /api/sync/last-sync - Get last sync timestamp",
				"GET  /api/sync/stats - Get database statistics",
				"GET  /api/sync/tracking/coverage - Get grouped per-domain tracking coverage counts",
				"GET  /api/sync/snapshots?limit=10 - Get recent snapshots",
				"GET  /api/sync/battles?limit=20 - Get recent battles",
				"GET  /api/sync/opponents - Get all opponents",
				"GET  /api/sync/mission-progress?limit=100 - Get mission progress history",
				"GET  /api/sync/shop-purchases?limit=100 - Get shop purchase history",
				"GET  /api/sync/tower-progress?limit=100 - Get tower/dungeon progression",
				"GET  /api/sync/guild-activities?limit=100 - Get guild activity history",
				"GET  /api/sync/chat-messages?limit=100 - Get chat message history",
				"GET  /api/sync/mail?limit=100 - Get mailbox message history",
				"GET  /api/sync/mail/rewards?limit=100 - Get mailbox reward claim history",
				"GET  /api/sync/airship?limit=100 - Get airship/zeppelin gift history",
				"GET  /api/sync/expeditions?limit=100 - Get expedition battle history",
				"GET  /api/sync/guild-participation?limit=100 - Get guild war/raid/dungeon participation"
			}
		});

		return endpoints;
	}
}
