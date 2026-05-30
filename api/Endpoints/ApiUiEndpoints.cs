using OrganizedJihad.Api.Services.Ui;

namespace OrganizedJihad.Api.Endpoints;

/// <summary>
/// Maps local UI shell endpoints, diagnostics pages, and persisted UI settings operations.
/// </summary>
public static partial class ApiUiEndpoints {
	/// <summary>
	/// Maps all local-only API UI endpoints under /ui.
	/// </summary>
	public static IEndpointRouteBuilder MapApiUiEndpoints(this IEndpointRouteBuilder endpoints) {
		MapSettingsEndpoints(endpoints);
		MapDiagnosticsEndpoints(endpoints);
		MapPageEndpoints(endpoints);

		return endpoints;
	}

	private static string GetRequestBaseUrl(HttpContext context) {
		return $"{context.Request.Scheme}://{context.Request.Host}";
	}
}
