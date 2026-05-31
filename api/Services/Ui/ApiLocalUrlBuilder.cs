namespace OrganizedJihad.Api.Services.Ui;

/// <summary>
/// Builds local loopback URLs from the active HTTP context without trusting Host headers.
/// </summary>
public sealed class ApiLocalUrlBuilder {
	/// <summary>
	/// Builds a local base URL using loopback and the currently bound local port.
/// </summary>
	public string BuildLocalBaseUrl(HttpContext context) {
		var scheme = string.Equals(context.Request.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)
			? Uri.UriSchemeHttps
			: Uri.UriSchemeHttp;

		var localPort = context.Connection.LocalPort;
		if (localPort <= 0) {
			localPort = string.Equals(scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) ? 443 : 80;
		}

		return $"{scheme}://localhost:{localPort}";
	}
}
