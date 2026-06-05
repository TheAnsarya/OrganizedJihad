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

		endpoints.MapGet("/ui/daily-report-page", (HttpContext context, ApiUiPageEndpointHandler handler) =>
			handler.GetDailyReportPageAsync(context));
	}
}
