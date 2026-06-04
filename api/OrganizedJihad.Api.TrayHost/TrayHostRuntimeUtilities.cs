using System.Net.Http;

namespace OrganizedJihad.Api.TrayHost;

internal static class TrayHostRuntimeUtilities {
	private const long MaxSettingsBytes = 512 * 1024;

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

		var fileInfo = new FileInfo(settingsPath);
		if (fileInfo.Length > MaxSettingsBytes) {
			lastSettingsWriteUtc = lastWriteUtc;
			return false;
		}

		string raw;
		try {
			raw = File.ReadAllText(settingsPath);
		} catch {
			return false;
		}
		lastSettingsWriteUtc = lastWriteUtc;

		if (!TrayRuntimeSettingsParser.TryReadApiBaseUrl(raw, out var configuredApiUrl)
			|| !TryNormalizeApiBaseUrl(configuredApiUrl, out var normalizedApiBaseUrl)
			|| string.Equals(currentApiUrl, normalizedApiBaseUrl, StringComparison.OrdinalIgnoreCase)) {
			return false;
		}

		updatedApiUrl = normalizedApiBaseUrl;
		return true;
	}

	private static bool TryNormalizeApiBaseUrl(string? rawApiUrl, out string normalizedApiUrl) {
		normalizedApiUrl = string.Empty;
		if (string.IsNullOrWhiteSpace(rawApiUrl)) {
			return false;
		}

		if (!Uri.TryCreate(rawApiUrl.Trim(), UriKind.Absolute, out var uri)) {
			return false;
		}

		if (!string.Equals(uri.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase)
			&& !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)) {
			return false;
		}

		normalizedApiUrl = uri.GetLeftPart(UriPartial.Authority);
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
