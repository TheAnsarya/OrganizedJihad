using OrganizedJihad.Api.Services.Ui;

namespace OrganizedJihad.Api.Endpoints;

public static partial class ApiUiEndpoints {
	private static void MapDiagnosticsEndpoints(IEndpointRouteBuilder endpoints) {
		endpoints.MapGet("/ui/repair-status", (HttpContext context, ApiUiDiagnosticsEndpointHandler handler) =>
			handler.GetRepairStatusAsync(context));

		endpoints.MapGet("/ui/userscript-handshake", (HttpContext context, ApiUiDiagnosticsEndpointHandler handler) =>
			handler.GetUserscriptHandshakeAsync(context));
	}
}
