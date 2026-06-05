namespace OrganizedJihad.Api.TrayHost;

internal static class TrayMenuLinkBuilder {
	public static string BuildUiUrl(string apiUrl) => apiUrl.TrimEnd('/') + "/ui";

	public static string BuildHealthUrl(string apiUrl) => apiUrl.TrimEnd('/') + "/ui/tray-health";

	public static string BuildDocumentationUrl(string apiUrl) => apiUrl.TrimEnd('/') + "/docs";

	public static string BuildOpenApiJsonUrl(string apiUrl) => apiUrl.TrimEnd('/') + "/swagger/v1/swagger.json";

	public static string BuildLogsUrl(string apiUrl) => apiUrl.TrimEnd('/') + "/ui/logs/latest";
}
