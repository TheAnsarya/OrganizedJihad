using System.Net.Sockets;

namespace OrganizedJihad.Api.TrayHost;

internal static class TrayPortProbe {
	public static bool IsPortInUse(string apiUrl) {
		if (!Uri.TryCreate(apiUrl, UriKind.Absolute, out var uri)) {
			return false;
		}

		var port = uri.IsDefaultPort
			? (string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) ? 443 : 80)
			: uri.Port;

		try {
			using var client = new TcpClient();
			var connectTask = client.ConnectAsync(uri.Host, port);
			var completed = connectTask.Wait(500);
			return completed && client.Connected;
		} catch {
			return false;
		}
	}
}
