using System.Net;

namespace OrganizedJihad.Api.Services.Ui;

/// <summary>
/// Enforces local-only access to UI endpoints and applies defense-in-depth response headers.
/// </summary>
public sealed class ApiUiAccessPolicy {
	/// <summary>
	/// Returns true when the current request originates from loopback/local transport.
	/// </summary>
	public bool IsLocalRequest(HttpContext context) {
		var remoteAddress = context.Connection.RemoteIpAddress;
		if (remoteAddress is null) {
			return true;
		}

		if (IPAddress.IsLoopback(remoteAddress)) {
			return true;
		}

		if (remoteAddress.AddressFamily == System.Net.Sockets.AddressFamily.InterNetworkV6
			&& remoteAddress.IsIPv4MappedToIPv6
			&& IPAddress.IsLoopback(remoteAddress.MapToIPv4())) {
			return true;
		}

		return false;
	}

	/// <summary>
	/// Adds strict cache and framing headers for local UI responses.
	/// </summary>
	public void ApplySecurityHeaders(HttpResponse response) {
		response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate";
		response.Headers["Pragma"] = "no-cache";
		response.Headers["X-Content-Type-Options"] = "nosniff";
		response.Headers["X-Frame-Options"] = "DENY";
		response.Headers["Referrer-Policy"] = "no-referrer";
	}
}
