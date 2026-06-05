using OrganizedJihad.Api.Services.Ui;

namespace OrganizedJihad.Api.Endpoints;

public static partial class ApiUiEndpoints {
	private static void MapPageEndpoints(IEndpointRouteBuilder endpoints) {
		endpoints.MapGet("/ui", (HttpContext context, ApiUiPageEndpointHandler handler) =>
			handler.GetUiPage(context));

		endpoints.MapGet("/ui/tray-health", (HttpContext context, ApiUiPageEndpointHandler handler) =>
			handler.GetTrayHealthPageAsync(context));

		endpoints.MapGet("/ui/logs/latest", (HttpContext context, ApiUiPageEndpointHandler handler) =>
			handler.GetLatestApiLogPage(context));

		endpoints.MapGet("/ui/daily-report", (HttpContext context, ApiUiPageEndpointHandler handler) =>
			handler.GetDailyReportJsonAsync(context));

		endpoints.MapGet("/ui/daily-report/latest", (HttpContext context, ApiUiPageEndpointHandler handler) =>
			handler.GetDailyReportLatestJsonAsync(context));

		endpoints.MapGet("/ui/daily-report/history", (HttpContext context, int? limit, ApiUiPageEndpointHandler handler) =>
			handler.GetDailyReportHistoryJsonAsync(context, limit));

		endpoints.MapPost("/ui/daily-report/generate", (HttpContext context, ApiUiPageEndpointHandler handler) =>
			handler.GenerateDailyReportJsonAsync(context));

		endpoints.MapGet("/ui/daily-report/export.csv", (HttpContext context, ApiUiPageEndpointHandler handler) =>
			handler.ExportDailyReportCsvAsync(context));

		endpoints.MapGet("/ui/daily-report-page", (HttpContext context, ApiUiPageEndpointHandler handler) =>
			handler.GetDailyReportPageAsync(context));

		endpoints.MapGet("/ui/daily-report-history-page", (HttpContext context, ApiUiPageEndpointHandler handler) =>
			handler.GetDailyReportHistoryPage(context));

		endpoints.MapGet("/ui/reporting-overview", (HttpContext context, ApiUiPageEndpointHandler handler) =>
			handler.GetReportingOverviewJsonAsync(context));

		endpoints.MapGet("/ui/reporting-overview-page", (HttpContext context, ApiUiPageEndpointHandler handler) =>
			handler.GetReportingOverviewPage(context));

		endpoints.MapGet("/swagger", (HttpContext context, ApiUiPageEndpointHandler handler) =>
			handler.GetSwaggerUiPage(context));

		endpoints.MapGet("/swagger/index.html", (HttpContext context, ApiUiPageEndpointHandler handler) =>
			handler.GetSwaggerUiPage(context));

	}
}
