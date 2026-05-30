using System.Net.Http;

namespace OrganizedJihad.Api.TrayHost;

internal static class TrayHostRuntimeUtilities {
	public static bool IsApiHealthy(HttpClient httpClient, string apiUrl) {
		try {
			var healthUrl = apiUrl.TrimEnd('/') + "/api/sync/health";
			var response = httpClient.GetAsync(healthUrl).GetAwaiter().GetResult();
			return response.IsSuccessStatusCode;
		} catch {
			return false;
		}
	}

	public static bool TryGetUpdatedApiUrl(string settingsPath, ref DateTime lastSettingsWriteUtc, string currentApiUrl, out string? updatedApiUrl) {
		updatedApiUrl = null;

		if (!File.Exists(settingsPath)) {
			return false;
		}

		var lastWriteUtc = File.GetLastWriteTimeUtc(settingsPath);
		if (lastWriteUtc <= lastSettingsWriteUtc) {
			return false;
		}

		var raw = File.ReadAllText(settingsPath);
		lastSettingsWriteUtc = lastWriteUtc;

		if (!TrayRuntimeSettingsParser.TryReadApiBaseUrl(raw, out var configuredApiUrl)
			|| string.IsNullOrWhiteSpace(configuredApiUrl)
			|| string.Equals(currentApiUrl, configuredApiUrl, StringComparison.OrdinalIgnoreCase)) {
			return false;
		}

		updatedApiUrl = configuredApiUrl;
		return true;
	}

	public static string QuoteArgument(string value) {
		return $"\"{value.Replace("\"", "\\\"")}\"";
	}

	public static void AppendLog(string logPath, string message) {
		try {
			var line = $"[{DateTime.UtcNow:O}] {message}{Environment.NewLine}";
			File.AppendAllText(logPath, line);
		} catch {
			// Best effort logging only.
		}
	}
}
