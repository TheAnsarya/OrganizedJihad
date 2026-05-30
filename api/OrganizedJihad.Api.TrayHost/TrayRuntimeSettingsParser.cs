using System.Text.Json;

namespace OrganizedJihad.Api.TrayHost;

internal static class TrayRuntimeSettingsParser {
	public static bool TryReadApiBaseUrl(string rawJson, out string? apiBaseUrl) {
		apiBaseUrl = null;
		if (string.IsNullOrWhiteSpace(rawJson)) {
			return false;
		}

		using var document = JsonDocument.Parse(rawJson);
		if (!document.RootElement.TryGetProperty("apiBaseUrl", out var apiBaseUrlProperty)) {
			return false;
		}

		apiBaseUrl = apiBaseUrlProperty.GetString()?.Trim();
		return !string.IsNullOrWhiteSpace(apiBaseUrl);
	}
}
