using OrganizedJihad.Api.Services.Ui;

namespace OrganizedJihad.Api.Endpoints;

public static partial class ApiUiEndpoints {
	private static void MapDiagnosticsEndpoints(IEndpointRouteBuilder endpoints) {
		endpoints.MapGet("/ui/repair-status", (HttpContext context, ApiUiDiagnosticsEndpointHandler handler) =>
			handler.GetRepairStatusAsync(context));

		endpoints.MapGet("/ui/userscript-handshake", (HttpContext context, ApiUiDiagnosticsEndpointHandler handler) =>
			handler.GetUserscriptHandshakeAsync(context));

		endpoints.MapGet("/ui/runtime-versions", (HttpContext context, ApiUiDiagnosticsEndpointHandler handler) =>
			handler.GetRuntimeVersions(context));

		endpoints.MapGet("/ui/userscript-file", (HttpContext context, ApiUiDiagnosticsEndpointHandler handler) =>
			handler.GetUserscriptFileAsync(context));

		endpoints.MapGet("/ui/organized-jihad.user.js", (HttpContext context, ApiUiDiagnosticsEndpointHandler handler) =>
			handler.GetUserscriptInstallScriptAsync(context));
	}
}
