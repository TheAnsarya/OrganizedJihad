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

		return parsed;
	}
}
