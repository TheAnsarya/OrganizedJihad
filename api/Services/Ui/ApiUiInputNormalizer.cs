namespace OrganizedJihad.Api.Services.Ui;

/// <summary>
/// Validates and normalizes user-editable UI settings input.
/// </summary>
public static class ApiUiInputNormalizer {
	/// <summary>
	/// Validates a local API URL and normalizes it to scheme + authority.
	/// </summary>
	public static bool TryNormalizeLocalApiUrl(string? rawUrl, string fallbackUrl, out string normalizedUrl, out string? error) {
		normalizedUrl = fallbackUrl;
		error = null;

		if (string.IsNullOrWhiteSpace(rawUrl)) {
			return true;
		}

		var candidate = rawUrl.Trim();
		if (!Uri.TryCreate(candidate, UriKind.Absolute, out var uri)) {
			error = "API Base URL must be an absolute URL.";
			return false;
		}

		if (!string.Equals(uri.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase)
			&& !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)) {
			error = "API Base URL must use http or https.";
			return false;
		}

		if (!string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase)
			&& !string.Equals(uri.Host, "127.0.0.1", StringComparison.OrdinalIgnoreCase)
			&& !string.Equals(uri.Host, "::1", StringComparison.OrdinalIgnoreCase)) {
			error = "API Base URL must target localhost/loopback only.";
			return false;
		}

		normalizedUrl = uri.GetLeftPart(UriPartial.Authority);
		return true;
	}

	/// <summary>
	/// Validates and normalizes preferred Hero Wars URL input.
	/// </summary>
	public static bool TryNormalizeHeroWarsUrl(string? rawUrl, out string normalizedUrl, out string? error) {
		normalizedUrl = "https://www.hero-wars.com/";
		error = null;

		if (string.IsNullOrWhiteSpace(rawUrl)) {
			return true;
		}

		var candidate = rawUrl.Trim();
		if (!Uri.TryCreate(candidate, UriKind.Absolute, out var uri)) {
			error = "Preferred Hero Wars URL must be an absolute URL.";
			return false;
		}

		if (!string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)) {
			error = "Preferred Hero Wars URL must use https.";
			return false;
		}

		if (!uri.Host.Contains("hero-wars.com", StringComparison.OrdinalIgnoreCase)) {
			error = "Preferred Hero Wars URL must target hero-wars.com.";
			return false;
		}

		normalizedUrl = uri.ToString();
		return true;
	}
}
