namespace OrganizedJihad.Api.TrayHost;

internal sealed class TrayHostOptions {
	public string ApiExecutablePath { get; set; } = string.Empty;
	public string ApiUrl { get; set; } = "http://localhost:5124";
	public string WorkingDirectory { get; set; } = AppContext.BaseDirectory;

	public static TrayHostOptions Parse(string[] args) {
		var parsed = new TrayHostOptions();

		for (var i = 0; i < args.Length; i++) {
			var current = args[i];
			if (string.Equals(current, "--api-executable", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length) {
				parsed.ApiExecutablePath = args[++i];
				continue;
			}
			if (string.Equals(current, "--api-url", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length) {
				parsed.ApiUrl = args[++i];
				continue;
			}
			if (string.Equals(current, "--working-directory", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length) {
				parsed.WorkingDirectory = args[++i];
			}
		}

		if (string.IsNullOrWhiteSpace(parsed.ApiExecutablePath)) {
#if WINDOWS
			parsed.ApiExecutablePath = Path.Combine(parsed.WorkingDirectory, "OrganizedJihad.Api.exe");
#else
			parsed.ApiExecutablePath = Path.Combine(parsed.WorkingDirectory, "OrganizedJihad.Api");
			if (!File.Exists(parsed.ApiExecutablePath)) {
				parsed.ApiExecutablePath = Path.Combine(parsed.WorkingDirectory, "OrganizedJihad.Api.exe");
			}
#endif
		}

		parsed.WorkingDirectory = NormalizeWorkingDirectory(parsed.WorkingDirectory);
		parsed.ApiUrl = NormalizeApiUrl(parsed.ApiUrl);

		return parsed;
	}

	private static string NormalizeWorkingDirectory(string? rawWorkingDirectory) {
		if (string.IsNullOrWhiteSpace(rawWorkingDirectory)) {
			return AppContext.BaseDirectory;
		}

		try {
			return Path.GetFullPath(rawWorkingDirectory.Trim());
		} catch {
			return AppContext.BaseDirectory;
		}
	}

	private static string NormalizeApiUrl(string? rawApiUrl) {
		if (string.IsNullOrWhiteSpace(rawApiUrl)) {
			return "http://localhost:5124";
		}

		var candidate = rawApiUrl.Trim();
		if (!Uri.TryCreate(candidate, UriKind.Absolute, out var uri)) {
			return "http://localhost:5124";
		}

		if (!string.Equals(uri.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase)
			&& !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)) {
			return "http://localhost:5124";
		}

		return uri.GetLeftPart(UriPartial.Authority);
	}
}
