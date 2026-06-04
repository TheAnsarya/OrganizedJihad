using OrganizedJihad.Api.Models.Ui;
using OrganizedJihad.Api.Services.Ui;

namespace OrganizedJihad.Api.Endpoints;

public static partial class ApiUiEndpoints {
	private static void MapSettingsEndpoints(IEndpointRouteBuilder endpoints) {
		endpoints.MapGet("/ui/settings", (HttpContext context, ApiUiSettingsEndpointHandler handler) =>
			handler.GetSettings(context));

		endpoints.MapPost("/ui/settings", (HttpContext context, ApiUiSettingsUpdateRequest request, ApiUiSettingsEndpointHandler handler) =>
			handler.SaveSettingsAsync(context, request));
	}
}
