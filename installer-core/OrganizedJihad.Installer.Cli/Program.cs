using System.Diagnostics;

namespace OrganizedJihad.Installer.Cli;

internal static class Program {
	private static int Main(string[] args) {
		var options = InstallOptions.Parse(args);
		var installer = new InstallerWorkflow(options);

		try {
			installer.Run();
			return 0;
		} catch (Exception ex) {
			Console.WriteLine($"[OJ Installer.Cli] ERROR: {ex.Message}");
			return 1;
		}
	}
}

internal sealed class InstallOptions {
	public string InstallRoot { get; init; } = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OrganizedJihad");
	public string ApiUrl { get; init; } = "http://localhost:5124";
	public bool SkipApiInstall { get; init; }
	public bool SkipDesktopAppInstall { get; init; }
	public bool SkipUserscriptInstall { get; init; }
	public bool SkipTampermonkeyBootstrap { get; init; }
	public bool RunInstallHealthCheck { get; init; }
	public bool FirstRunDiagnostics { get; init; }
	public bool OpenUserscriptDiagnostics { get; init; }
	public string[] TampermonkeyBrowsers { get; init; } = ["edge"];

	public static InstallOptions Parse(string[] args) {
		var map = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
		var flags = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

		for (var i = 0; i < args.Length; i++) {
			var token = args[i]?.Trim() ?? string.Empty;
			if (!token.StartsWith("--", StringComparison.Ordinal)) {
				continue;
			}

			var key = token[2..];
			if (i + 1 < args.Length && !args[i + 1].StartsWith("--", StringComparison.Ordinal)) {
				map[key] = args[++i];
				continue;
			}

			flags.Add(key);
		}

		var browsersRaw = map.TryGetValue("tampermonkey-browsers", out var browsersValue)
			? browsersValue
			: "edge";

		var browsers = (browsersRaw ?? "edge")
			.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
		if (browsers.Length == 0) {
			browsers = ["edge"];
		}

		return new InstallOptions {
			InstallRoot = map.TryGetValue("install-root", out var installRoot) && !string.IsNullOrWhiteSpace(installRoot)
				? installRoot
				: Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OrganizedJihad"),
			ApiUrl = map.TryGetValue("api-url", out var apiUrl) && !string.IsNullOrWhiteSpace(apiUrl)
				? apiUrl
				: "http://localhost:5124",
			SkipApiInstall = flags.Contains("skip-api-install"),
			SkipDesktopAppInstall = flags.Contains("skip-desktop-app-install"),
			SkipUserscriptInstall = flags.Contains("skip-userscript-install"),
			SkipTampermonkeyBootstrap = flags.Contains("skip-tampermonkey-bootstrap"),
			RunInstallHealthCheck = flags.Contains("run-install-health-check"),
			FirstRunDiagnostics = flags.Contains("first-run-diagnostics"),
			OpenUserscriptDiagnostics = flags.Contains("open-userscript-diagnostics"),
			TampermonkeyBrowsers = browsers,
		};
	}
}

internal sealed class InstallerWorkflow {
	private readonly InstallOptions _options;
	private readonly string _baseDir;

	public InstallerWorkflow(InstallOptions options) {
		_options = options;
		_baseDir = AppContext.BaseDirectory;
	}

	public void Run() {
		Console.WriteLine("[OJ Installer.Cli] Starting cross-platform install workflow.");

		if (_options.SkipApiInstall && _options.SkipDesktopAppInstall && _options.SkipUserscriptInstall) {
			throw new InvalidOperationException("At least one install component must be enabled.");
		}

		Directory.CreateDirectory(_options.InstallRoot);

		if (!_options.SkipApiInstall) {
			InstallApiPayload();
		}

		if (!_options.SkipDesktopAppInstall) {
			InstallDesktopPayload();
		}

		if (!_options.SkipUserscriptInstall) {
			InstallUserscriptPayload();
		}

		if (!_options.SkipApiInstall) {
			StartApiRuntime();
		}

		if (_options.FirstRunDiagnostics || _options.OpenUserscriptDiagnostics) {
			OpenDiagnosticsLinks();
		}

		if (_options.FirstRunDiagnostics || _options.RunInstallHealthCheck) {
			WaitApiHealth();
		}

		if (!_options.SkipUserscriptInstall && !_options.SkipTampermonkeyBootstrap) {
			OpenTampermonkeyBootstrap();
		}

		Console.WriteLine("[OJ Installer.Cli] Installation complete.");
	}

	private void InstallApiPayload() {
		var source = ResolveDirectoryCandidate(
			Path.Combine(_baseDir, "bundled", "api"),
			Path.GetFullPath(Path.Combine(_baseDir, "..", "..", "..", "api", "bin", "Release", "net10.0", "win-x64", "publish")));
		var destination = Path.Combine(_options.InstallRoot, "api");
		CopyDirectory(source, destination);

		var runtimeHostSource = ResolveOptionalDirectoryCandidate(
			Path.Combine(_baseDir, "bundled", "runtime-host"),
			Path.Combine(_baseDir, "bundled", "api-tray"));
		if (!string.IsNullOrWhiteSpace(runtimeHostSource)) {
			var runtimeHostDestination = Path.Combine(_options.InstallRoot, "runtime-host");
			CopyDirectory(runtimeHostSource, runtimeHostDestination);
		}

		Console.WriteLine($"[OJ Installer.Cli] API payload installed to: {destination}");
	}

	private void InstallDesktopPayload() {
		var source = ResolveOptionalDirectoryCandidate(Path.Combine(_baseDir, "bundled", "desktop-app"));
		if (string.IsNullOrWhiteSpace(source)) {
			Console.WriteLine("[OJ Installer.Cli] Desktop payload not found in bundle. Skipping desktop install.");
			return;
		}

		var destination = Path.Combine(_options.InstallRoot, "desktop-app");
		CopyDirectory(source, destination);
		Console.WriteLine($"[OJ Installer.Cli] Desktop payload installed to: {destination}");
	}

	private void InstallUserscriptPayload() {
		var userscriptDir = Path.Combine(_options.InstallRoot, "userscript");
		Directory.CreateDirectory(userscriptDir);

		var sourceUserscript = ResolveFileCandidate(
			Path.Combine(_baseDir, "organized-jihad.user.js"),
			Path.GetFullPath(Path.Combine(_baseDir, "..", "..", "..", "userscript", "dist", "organized-jihad.user.js")));
		File.Copy(sourceUserscript, Path.Combine(userscriptDir, "organized-jihad.user.js"), overwrite: true);

		var guide = ResolveOptionalFileCandidate(Path.Combine(_baseDir, "tampermonkey-setup.html"));
		if (!string.IsNullOrWhiteSpace(guide)) {
			File.Copy(guide, Path.Combine(userscriptDir, "tampermonkey-setup.html"), overwrite: true);
		}

		var screenshots = ResolveOptionalDirectoryCandidate(Path.Combine(_baseDir, "guide-screenshots"));
		if (!string.IsNullOrWhiteSpace(screenshots)) {
			CopyDirectory(screenshots, Path.Combine(userscriptDir, "guide-screenshots"));
		}

		Console.WriteLine($"[OJ Installer.Cli] Userscript payload installed to: {userscriptDir}");
	}

	private void StartApiRuntime() {
		var apiDir = Path.Combine(_options.InstallRoot, "api");
		var apiExecutable = ResolveExecutable(Path.Combine(apiDir, "OrganizedJihad.Api"));
		if (string.IsNullOrWhiteSpace(apiExecutable)) {
			throw new InvalidOperationException("Could not locate installed API executable.");
		}

		var runtimeHostDir = Path.Combine(_options.InstallRoot, "runtime-host");
		var runtimeHostExe = ResolveExecutable(Path.Combine(runtimeHostDir, "OrganizedJihad.Api.TrayHost"));
		if (!string.IsNullOrWhiteSpace(runtimeHostExe)) {
			StartBackgroundProcess(runtimeHostExe, $"--api-executable \"{apiExecutable}\" --api-url \"{_options.ApiUrl}\" --working-directory \"{apiDir}\"", runtimeHostDir);
			Console.WriteLine("[OJ Installer.Cli] Runtime host started.");
			return;
		}

		StartBackgroundProcess(apiExecutable, $"--urls {_options.ApiUrl}", apiDir);
		Console.WriteLine("[OJ Installer.Cli] API started directly (runtime host not found).");
	}

	private void WaitApiHealth() {
		var healthUrl = _options.ApiUrl.TrimEnd('/') + "/api/sync/health";
		var timeoutAt = DateTime.UtcNow.AddSeconds(35);
		using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(4) };

		while (DateTime.UtcNow < timeoutAt) {
			try {
				var response = client.GetAsync(healthUrl).GetAwaiter().GetResult();
				if (response.IsSuccessStatusCode) {
					Console.WriteLine($"[OJ Installer.Cli] API health endpoint reachable: {healthUrl}");
					return;
				}
			} catch {
				// Retry until timeout.
			}

			Thread.Sleep(1000);
		}

		Console.WriteLine($"[OJ Installer.Cli] API health probe timed out: {healthUrl}");
	}

	private void OpenDiagnosticsLinks() {
		var links = new[] {
			"https://www.hero-wars.com/",
			$"{_options.ApiUrl.TrimEnd('/')}/api/sync/health",
			$"{_options.ApiUrl.TrimEnd('/')}/ui/userscript-handshake"
		};

		foreach (var link in links) {
			OpenExternal(link);
		}
	}

	private void OpenTampermonkeyBootstrap() {
		var links = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
			["chrome"] = "https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo",
			["edge"] = "https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd",
			["firefox"] = "https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/",
			["opera"] = "https://addons.opera.com/en/extensions/details/tampermonkey-beta/",
			["operaGX"] = "https://addons.opera.com/en/extensions/details/tampermonkey-beta/",
		};

		var browser = _options.TampermonkeyBrowsers.FirstOrDefault() ?? "edge";
		if (links.TryGetValue(browser, out var link)) {
			OpenExternal(link);
		}
	}

	private static void OpenExternal(string target) {
		try {
			Process.Start(new ProcessStartInfo {
				FileName = target,
				UseShellExecute = true,
			});
		} catch {
			// Best effort only.
		}
	}

	private static void StartBackgroundProcess(string executablePath, string arguments, string workingDirectory) {
		var startInfo = new ProcessStartInfo {
			FileName = executablePath,
			Arguments = arguments,
			WorkingDirectory = workingDirectory,
			UseShellExecute = false,
			CreateNoWindow = true,
		};

		Process.Start(startInfo);
	}

	private static string? ResolveExecutable(string pathWithoutExtension) {
		var candidates = new[] {
			pathWithoutExtension + ".exe",
			pathWithoutExtension,
		};

		return candidates.FirstOrDefault(File.Exists);
	}

	private static void CopyDirectory(string source, string destination) {
		if (!Directory.Exists(source)) {
			throw new DirectoryNotFoundException($"Source directory not found: {source}");
		}

		if (Directory.Exists(destination)) {
			Directory.Delete(destination, recursive: true);
		}
		Directory.CreateDirectory(destination);

		foreach (var directory in Directory.GetDirectories(source, "*", SearchOption.AllDirectories)) {
			var relative = Path.GetRelativePath(source, directory);
			Directory.CreateDirectory(Path.Combine(destination, relative));
		}

		foreach (var file in Directory.GetFiles(source, "*", SearchOption.AllDirectories)) {
			var relative = Path.GetRelativePath(source, file);
			var target = Path.Combine(destination, relative);
			var parent = Path.GetDirectoryName(target);
			if (!string.IsNullOrWhiteSpace(parent)) {
				Directory.CreateDirectory(parent);
			}
			File.Copy(file, target, overwrite: true);
		}
	}

	private static string ResolveDirectoryCandidate(params string[] candidates) {
		var found = ResolveOptionalDirectoryCandidate(candidates);
		if (string.IsNullOrWhiteSpace(found)) {
			throw new DirectoryNotFoundException($"Could not resolve required directory from candidates: {string.Join("; ", candidates)}");
		}

		return found;
	}

	private static string? ResolveOptionalDirectoryCandidate(params string[] candidates) {
		return candidates.FirstOrDefault(path => !string.IsNullOrWhiteSpace(path) && Directory.Exists(path));
	}

	private static string ResolveFileCandidate(params string[] candidates) {
		var found = ResolveOptionalFileCandidate(candidates);
		if (string.IsNullOrWhiteSpace(found)) {
			throw new FileNotFoundException($"Could not resolve required file from candidates: {string.Join("; ", candidates)}");
		}

		return found;
	}

	private static string? ResolveOptionalFileCandidate(params string[] candidates) {
		return candidates.FirstOrDefault(path => !string.IsNullOrWhiteSpace(path) && File.Exists(path));
	}
}
