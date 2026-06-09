using System.Diagnostics;
using System.ComponentModel;

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
			foreach (var line in ex.ToString().Split(new[] { "\r\n", "\n" }, StringSplitOptions.None)) {
				if (!string.IsNullOrWhiteSpace(line)) {
					Console.WriteLine($"[DEBUG] [OJ Installer.Cli] Exception: {line}");
				}
			}
			return 1;
		}
	}
}

internal sealed class InstallOptions {
	public string InstallRoot { get; init; } = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OrganizedJihad");
	public string ApiUrl { get; init; } = "http://localhost:5124";
	public bool SkipApiInstall { get; init; }
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
		Console.WriteLine($"[DEBUG] [OJ Installer.Cli] Base directory: {_baseDir}");
		Console.WriteLine($"[DEBUG] [OJ Installer.Cli] Install root: {_options.InstallRoot}");

		if (_options.SkipApiInstall && _options.SkipUserscriptInstall) {
			throw new InvalidOperationException("At least one install component must be enabled.");
		}

		Directory.CreateDirectory(_options.InstallRoot);

		if (!_options.SkipApiInstall) {
			StopLegacyApiProcesses();
			InstallApiPayload();
			CleanupLegacyApiExecutableVariants();
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
			ProbeApiUiDiagnosticsEndpoints();
		}

		if (!_options.SkipUserscriptInstall && !_options.SkipTampermonkeyBootstrap) {
			OpenTampermonkeyBootstrap();
		}

		Console.WriteLine("[OJ Installer.Cli] Installation complete.");
	}

	private void StopLegacyApiProcesses() {
		if (!OperatingSystem.IsWindows()) {
			return;
		}

		StopScheduledTask("OrganizedJihad.Api.Service");
		StopScheduledTask("OrganizedJihad.Api.Tray");

		var prefixes = new[] {
			"OrganizedJihad.Api",
			"OrganizedJihad.Api.TrayHost",
		};

		foreach (var process in Process.GetProcesses()) {
			try {
				if (process.HasExited) {
					continue;
				}

				var name = process.ProcessName;
				if (!prefixes.Any(prefix => name.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))) {
					continue;
				}

				process.Kill(true);
				process.WaitForExit(10000);
				Console.WriteLine($"[OJ Installer.Cli] Stopped legacy process: {name} (PID {process.Id})");
			} catch {
				// Best effort cleanup only.
			}
		}

		WaitForFileUnlock(Path.Combine(_options.InstallRoot, "api", "OrganizedJihad.Api.exe"), timeoutMs: 12000);
		WaitForFileUnlock(Path.Combine(_options.InstallRoot, "runtime-host", "OrganizedJihad.Api.TrayHost.exe"), timeoutMs: 12000);
	}

	private static void StopScheduledTask(string taskName) {
		if (!OperatingSystem.IsWindows() || string.IsNullOrWhiteSpace(taskName)) {
			return;
		}

		try {
			using var process = Process.Start(new ProcessStartInfo {
				FileName = "schtasks.exe",
				Arguments = $"/End /TN \"{taskName}\"",
				UseShellExecute = false,
				CreateNoWindow = true,
				RedirectStandardOutput = true,
				RedirectStandardError = true,
			});
			process?.WaitForExit(3000);
		} catch {
			// Best effort cleanup only.
		}
	}

	private void CleanupLegacyApiExecutableVariants() {
		var apiDir = Path.Combine(_options.InstallRoot, "api");
		DeleteVersionedExecutables(apiDir, "OrganizedJihad.Api.*.exe", "OrganizedJihad.Api.exe");

		var runtimeHostDir = Path.Combine(_options.InstallRoot, "runtime-host");
		DeleteVersionedExecutables(runtimeHostDir, "OrganizedJihad.Api.TrayHost.*.exe", "OrganizedJihad.Api.TrayHost.exe");
	}

	private static void DeleteVersionedExecutables(string directory, string searchPattern, string keepFileName) {
		if (!Directory.Exists(directory)) {
			return;
		}

		foreach (var file in Directory.GetFiles(directory, searchPattern, SearchOption.TopDirectoryOnly)) {
			if (string.Equals(Path.GetFileName(file), keepFileName, StringComparison.OrdinalIgnoreCase)) {
				continue;
			}

			try {
				File.Delete(file);
				Console.WriteLine($"[OJ Installer.Cli] Removed legacy executable variant: {file}");
			} catch {
				// Best effort cleanup only.
			}
		}
	}

	private void InstallApiPayload() {
		var repositoryRoot = ResolveRepositoryRoot();
		var extractionRoot = Path.GetFullPath(Path.Combine(_baseDir, ".."));
		var sourceCandidates = new[] {
			Path.Combine(_baseDir, "bundled", "api"),
			Path.Combine(extractionRoot, "bundled", "api"),
			Path.Combine(_baseDir, "api"),
			Path.Combine(extractionRoot, "api"),
			Path.GetFullPath(Path.Combine(_baseDir, "..", "..", "..", "..", "..", "api", "bin", "Release", "net10.0", "win-x64", "publish")),
			Path.Combine(repositoryRoot, "artifacts", "api-publish-win-x64"),
			Path.Combine(repositoryRoot, "api", "bin", "Release", "net10.0", "win-x64", "publish"),
		};

		LogDirectoryCandidates("API payload source", sourceCandidates);

		var source = ResolveDirectoryCandidate(sourceCandidates);
		var destination = Path.Combine(_options.InstallRoot, "api");
		Console.WriteLine("[OJ Installer.Cli] Installing API payload...");
		CopyDirectory(source, destination);
		Console.WriteLine("[OJ Installer.Cli] API payload copy completed.");
		LogDirectorySnapshot("API payload destination", destination, maxEntries: 12);

		var runtimeHostSourceCandidates = new[] {
			Path.Combine(_baseDir, "bundled", "runtime-host"),
			Path.Combine(extractionRoot, "bundled", "runtime-host"),
			Path.Combine(_baseDir, "bundled", "api-tray"),
			Path.Combine(extractionRoot, "bundled", "api-tray"),
			Path.Combine(_baseDir, "runtime-host"),
			Path.Combine(extractionRoot, "runtime-host"),
			Path.Combine(_baseDir, "api-tray"),
			Path.Combine(extractionRoot, "api-tray"),
			Path.Combine(repositoryRoot, "artifacts", "runtime-host-publish-win-x64"),
			Path.Combine(repositoryRoot, "api", "OrganizedJihad.Api.TrayHost", "bin", "Release", "net10.0-windows10.0.19041.0", "win-x64", "publish"),
			Path.GetFullPath(Path.Combine(_baseDir, "..", "..", "..", "..", "..", "api", "OrganizedJihad.Api.TrayHost", "bin", "Release", "net10.0-windows10.0.19041.0", "win-x64", "publish")),
		};

		LogDirectoryCandidates("Runtime host payload source", runtimeHostSourceCandidates);
		var runtimeHostSource = ResolveOptionalDirectoryCandidate(
			runtimeHostSourceCandidates);
		if (string.IsNullOrWhiteSpace(runtimeHostSource)) {
			Console.WriteLine("[OJ Installer.Cli] Runtime host payload not found in known bundle locations.");
		}
		if (!string.IsNullOrWhiteSpace(runtimeHostSource)) {
			var runtimeHostDestination = Path.Combine(_options.InstallRoot, "runtime-host");
			Console.WriteLine("[OJ Installer.Cli] Installing runtime host payload...");
			CopyDirectory(runtimeHostSource, runtimeHostDestination);
			Console.WriteLine("[OJ Installer.Cli] Runtime host payload copy completed.");
			LogDirectorySnapshot("Runtime host destination", runtimeHostDestination, maxEntries: 8);
		}

		Console.WriteLine($"[OJ Installer.Cli] API payload installed to: {destination}");
	}

	private void InstallUserscriptPayload() {
		var userscriptDir = Path.Combine(_options.InstallRoot, "userscript");
		Directory.CreateDirectory(userscriptDir);
		var extractionRoot = Path.GetFullPath(Path.Combine(_baseDir, ".."));

		var sourceUserscript = ResolveFileCandidate(
			Path.Combine(_baseDir, "organized-jihad.user.js"),
			Path.Combine(extractionRoot, "organized-jihad.user.js"),
			Path.GetFullPath(Path.Combine(_baseDir, "..", "organized-jihad.user.js")),
			Path.GetFullPath(Path.Combine(_baseDir, "..", "..", "..", "userscript", "dist", "organized-jihad.user.js")));
		File.Copy(sourceUserscript, Path.Combine(userscriptDir, "organized-jihad.user.js"), overwrite: true);

		var guide = ResolveOptionalFileCandidate(
			Path.Combine(_baseDir, "tampermonkey-setup.html"),
			Path.Combine(extractionRoot, "tampermonkey-setup.html"),
			Path.GetFullPath(Path.Combine(_baseDir, "..", "tampermonkey-setup.html")));
		if (!string.IsNullOrWhiteSpace(guide)) {
			File.Copy(guide, Path.Combine(userscriptDir, "tampermonkey-setup.html"), overwrite: true);
		}

		var screenshots = ResolveOptionalDirectoryCandidate(Path.Combine(_baseDir, "guide-screenshots"));
		if (string.IsNullOrWhiteSpace(screenshots)) {
			screenshots = ResolveOptionalDirectoryCandidate(Path.Combine(extractionRoot, "guide-screenshots"));
		}
		if (!string.IsNullOrWhiteSpace(screenshots)) {
			CopyDirectory(screenshots, Path.Combine(userscriptDir, "guide-screenshots"));
		}

		Console.WriteLine($"[OJ Installer.Cli] Userscript payload installed to: {userscriptDir}");
	}

	private void StartApiRuntime() {
		Console.WriteLine("[OJ Installer.Cli] Starting API runtime...");
		var apiDir = Path.Combine(_options.InstallRoot, "api");
		var apiExecutable = ResolveExecutable(Path.Combine(apiDir, "OrganizedJihad.Api"));
		var apiAssembly = ResolveOptionalFileCandidate(Path.Combine(apiDir, "OrganizedJihad.Api.dll"));

		Console.WriteLine($"[DEBUG] [OJ Installer.Cli] API launch probe executable: {(string.IsNullOrWhiteSpace(apiExecutable) ? "(missing)" : apiExecutable)}");
		Console.WriteLine($"[DEBUG] [OJ Installer.Cli] API launch probe assembly: {(string.IsNullOrWhiteSpace(apiAssembly) ? "(missing)" : apiAssembly)}");
		LogDirectorySnapshot("Installed API directory", apiDir, maxEntries: 16);

		var runtimeHostDir = Path.Combine(_options.InstallRoot, "runtime-host");
		var runtimeHostExe = ResolveExecutable(Path.Combine(runtimeHostDir, "OrganizedJihad.Api.TrayHost"));
		if (!string.IsNullOrWhiteSpace(runtimeHostExe) && !string.IsNullOrWhiteSpace(apiExecutable)) {
			try {
				StartBackgroundProcess(runtimeHostExe, $"--api-executable \"{apiExecutable}\" --api-url \"{_options.ApiUrl}\" --working-directory \"{apiDir}\"", runtimeHostDir);
				Console.WriteLine("[OJ Installer.Cli] Runtime host started.");
				return;
			} catch (Exception ex) when (ex is Win32Exception || ex is InvalidOperationException) {
				Console.WriteLine($"[OJ Installer.Cli] Runtime host launch failed ({ex.GetType().Name}: {ex.Message}). Falling back to direct API launch mode.");
			}
		}
		if (!string.IsNullOrWhiteSpace(runtimeHostExe) && string.IsNullOrWhiteSpace(apiExecutable)) {
			Console.WriteLine("[OJ Installer.Cli] Runtime host payload found, but API executable is missing. Falling back to direct launch mode.");
		}

		if (!string.IsNullOrWhiteSpace(apiExecutable)) {
			StartBackgroundProcess(apiExecutable, $"--urls {_options.ApiUrl}", apiDir);
			Console.WriteLine("[OJ Installer.Cli] API started directly (runtime host not found).");
			return;
		}

		if (!string.IsNullOrWhiteSpace(apiAssembly)) {
			StartBackgroundProcess("dotnet", $"\"{apiAssembly}\" --urls {_options.ApiUrl}", apiDir);
			Console.WriteLine("[OJ Installer.Cli] API started via dotnet OrganizedJihad.Api.dll fallback.");
			return;
		}

		throw new InvalidOperationException($"Could not locate installed API executable or assembly. Install root: {_options.InstallRoot}");
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

	private void ProbeApiUiDiagnosticsEndpoints() {
		var endpoints = new[] {
			"/ui/repair-status",
			"/ui/userscript-handshake",
			"/ui/tray-health",
		};

		using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(4) };
		foreach (var endpoint in endpoints) {
			var url = _options.ApiUrl.TrimEnd('/') + endpoint;
			try {
				var response = client.GetAsync(url).GetAwaiter().GetResult();
				if (response.IsSuccessStatusCode) {
					Console.WriteLine($"[OJ Installer.Cli] API UI probe OK: {url} ({(int)response.StatusCode})");
				} else {
					Console.WriteLine($"[OJ Installer.Cli] API UI probe returned non-success: {url} ({(int)response.StatusCode})");
				}
			} catch (Exception ex) {
				Console.WriteLine($"[OJ Installer.Cli] API UI probe failed: {url}");
				Console.WriteLine($"[DEBUG] [OJ Installer.Cli] API UI probe exception for {url}: {ex}");
			}
		}
	}

	private void OpenDiagnosticsLinks() {
		var browser = _options.TampermonkeyBrowsers.FirstOrDefault() ?? "edge";
		var links = new[] {
			"https://www.hero-wars.com/",
			$"{_options.ApiUrl.TrimEnd('/')}/api/sync/health",
			$"{_options.ApiUrl.TrimEnd('/')}/ui/userscript-handshake"
		};

		foreach (var link in links) {
			OpenExternal(link, browser);
		}
	}

	private void OpenTampermonkeyBootstrap() {
		var browser = _options.TampermonkeyBrowsers.FirstOrDefault() ?? "edge";
		var userscriptPath = Path.Combine(_options.InstallRoot, "userscript", "organized-jihad.user.js");
		var apiUserscriptUrl = _options.ApiUrl.TrimEnd('/') + "/ui/organized-jihad.user.js";

		var utilitiesLinks = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
			["chrome"] = "chrome-extension://dhdgffkkebhmkfjojejmpbldmpobfkfo/options.html#nav=utils",
			["edge"] = "chrome-extension://iikmkjmpaadaobahmlepeloendndfphd/options.html#nav=utils",
			["firefox"] = "about:addons",
			["opera"] = "chrome-extension://dhdgffkkebhmkfjojejmpbldmpobfkfo/options.html#nav=utils",
			["operaGX"] = "chrome-extension://dhdgffkkebhmkfjojejmpbldmpobfkfo/options.html#nav=utils",
		};

		if (utilitiesLinks.TryGetValue(browser, out var utilitiesLink)) {
			Console.WriteLine($"[OJ Installer.Cli] Opening Tampermonkey import utilities for {browser}.");
			OpenExternal(utilitiesLink, browser);
		}

		if (CanReachUrl(apiUserscriptUrl)) {
			Console.WriteLine($"[OJ Installer.Cli] Opening API-hosted userscript install URL: {apiUserscriptUrl}");
			OpenExternal(apiUserscriptUrl, browser);
			return;
		}

		if (File.Exists(userscriptPath)) {
			var fileUri = new Uri(userscriptPath).AbsoluteUri;
			Console.WriteLine($"[OJ Installer.Cli] Opening userscript file URI: {fileUri}");
			OpenExternal(fileUri, browser);
			return;
		}

		var links = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
			["chrome"] = "https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo",
			["edge"] = "https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd",
			["firefox"] = "https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/",
			["opera"] = "https://addons.opera.com/en/extensions/details/tampermonkey-beta/",
			["operaGX"] = "https://addons.opera.com/en/extensions/details/tampermonkey-beta/",
		};

		if (links.TryGetValue(browser, out var link)) {
			Console.WriteLine($"[OJ Installer.Cli] Userscript install target unavailable; opening Tampermonkey page instead: {link}");
			OpenExternal(link, browser);
		}
	}

	private static bool CanReachUrl(string url) {
		try {
			using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
			using var response = client.GetAsync(url).GetAwaiter().GetResult();
			return response.IsSuccessStatusCode;
		} catch {
			return false;
		}
	}

	private static void OpenExternal(string target, string? browserArg) {
		try {
			var browserExecutable = ResolveBrowserExecutablePath(browserArg);
			if (!string.IsNullOrWhiteSpace(browserExecutable) && File.Exists(browserExecutable)) {
				Process.Start(new ProcessStartInfo {
					FileName = browserExecutable,
					Arguments = Quote(target),
					UseShellExecute = false,
					CreateNoWindow = true,
				});
				return;
			}

			Process.Start(new ProcessStartInfo {
				FileName = target,
				UseShellExecute = true,
			});
		} catch {
			// Best effort only.
		}
	}

	private static string? ResolveBrowserExecutablePath(string? browserArg) {
		if (!OperatingSystem.IsWindows()) {
			return null;
		}

		return browserArg switch {
			"chrome" => ResolveWindowsExecutable(new[] {
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google", "Chrome", "Application", "chrome.exe"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google", "Chrome", "Application", "chrome.exe"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google", "Chrome", "Application", "chrome.exe"),
			}, new[] { "chrome.exe" }, new[] { "chrome.exe" }),
			"edge" => ResolveWindowsExecutable(new[] {
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe"),
			}, new[] { "msedge.exe" }, new[] { "msedge.exe" }),
			"firefox" => ResolveWindowsExecutable(new[] {
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Mozilla Firefox", "firefox.exe"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Mozilla Firefox", "firefox.exe"),
			}, new[] { "firefox.exe" }, new[] { "firefox.exe" }),
			"opera" => ResolveWindowsExecutable(new[] {
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Opera", "opera.exe"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Opera", "launcher.exe"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Opera", "opera.exe"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Opera", "launcher.exe"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Opera", "opera.exe"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Opera", "launcher.exe"),
			}, new[] { "opera.exe", "launcher.exe" }, new[] { "opera.exe", "launcher.exe" }),
			"operaGX" => ResolveWindowsExecutable(new[] {
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Opera GX", "opera.exe"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Opera GX", "launcher.exe"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Opera GX Stable", "opera.exe"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Opera GX Stable", "launcher.exe"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Opera GX", "opera.exe"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Opera GX", "launcher.exe"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Opera GX", "opera.exe"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Opera GX", "launcher.exe"),
			}, new[] { "opera_gx.exe", "opera.exe", "launcher.exe" }, new[] { "opera.exe", "launcher.exe" }),
			_ => null,
		};
	}

	private static string? ResolveWindowsExecutable(IEnumerable<string> paths, IEnumerable<string> registryExecutables, IEnumerable<string> pathExecutables) {
		foreach (var path in paths) {
			if (!string.IsNullOrWhiteSpace(path) && File.Exists(path)) {
				return path;
			}
		}

		foreach (var executableName in registryExecutables.Where(value => !string.IsNullOrWhiteSpace(value))) {
			if (TryGetExecutableFromAppPaths(executableName, out var registryPath) && File.Exists(registryPath)) {
				return registryPath;
			}
		}

		foreach (var executableName in pathExecutables.Where(value => !string.IsNullOrWhiteSpace(value))) {
			var hit = TryResolveExecutableOnPath(executableName);
			if (!string.IsNullOrWhiteSpace(hit)) {
				return hit;
			}
		}

		return null;
	}

	private static bool TryGetExecutableFromAppPaths(string executableName, out string executablePath) {
		executablePath = string.Empty;
		if (!OperatingSystem.IsWindows()) {
			return false;
		}

		var appPathKeys = new[] {
			$"Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\{executableName}",
		};

		foreach (var hive in new[] { Microsoft.Win32.Registry.CurrentUser, Microsoft.Win32.Registry.LocalMachine }) {
			foreach (var keyPath in appPathKeys) {
				using var key = hive.OpenSubKey(keyPath);
				var candidate = key?.GetValue(string.Empty) as string;
				if (!string.IsNullOrWhiteSpace(candidate) && File.Exists(candidate)) {
					executablePath = candidate;
					return true;
				}
			}
		}

		return false;
	}

	private static string? TryResolveExecutableOnPath(string executableName) {
		var pathValue = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
		var pathEntries = pathValue.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

		foreach (var entry in pathEntries) {
			var candidate = Path.Combine(entry, executableName);
			if (File.Exists(candidate)) {
				return candidate;
			}
		}

		return null;
	}

	private static string Quote(string value) {
		return $"\"{value.Replace("\"", "\\\"")}\"";
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
		string[] candidates;
		if (OperatingSystem.IsWindows()) {
			candidates = [pathWithoutExtension + ".exe", pathWithoutExtension];
		} else {
			candidates = [pathWithoutExtension + ".exe", pathWithoutExtension];
		}

		return candidates.FirstOrDefault(File.Exists);
	}

	private string ResolveRepositoryRoot() {
		var current = new DirectoryInfo(_baseDir);
		while (current is not null) {
			if (File.Exists(Path.Combine(current.FullName, "OrganizedJihad.sln"))) {
				return current.FullName;
			}

			current = current.Parent;
		}

		return Path.GetFullPath(Path.Combine(_baseDir, "..", "..", "..", "..", ".."));
	}

	private static void CopyDirectory(string source, string destination) {
		if (!Directory.Exists(source)) {
			throw new DirectoryNotFoundException($"Source directory not found: {source}");
		}

		if (Directory.Exists(destination)) {
			RetryIoOperation(() => Directory.Delete(destination, recursive: true), destination);
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
			RetryIoOperation(() => File.Copy(file, target, overwrite: true), target);
		}
	}

	private static void WaitForFileUnlock(string path, int timeoutMs) {
		if (string.IsNullOrWhiteSpace(path) || !File.Exists(path)) {
			return;
		}

		var deadline = DateTime.UtcNow.AddMilliseconds(timeoutMs);
		while (DateTime.UtcNow < deadline) {
			try {
				using var stream = new FileStream(path, FileMode.Open, FileAccess.ReadWrite, FileShare.None);
				return;
			} catch (IOException) {
				Thread.Sleep(250);
			} catch (UnauthorizedAccessException) {
				Thread.Sleep(250);
			}
		}

		throw new UnauthorizedAccessException($"Access to the path '{Path.GetFileName(path)}' is denied. A legacy process still has the file locked.");
	}

	private static void RetryIoOperation(Action action, string pathForError) {
		Exception? lastError = null;
		for (var attempt = 1; attempt <= 8; attempt++) {
			try {
				action();
				return;
			} catch (Exception ex) when (ex is IOException || ex is UnauthorizedAccessException) {
				lastError = ex;
				Thread.Sleep(250 * attempt);
			}
		}

		throw new IOException($"I/O operation failed for '{pathForError}': {lastError?.Message}", lastError);
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

	private static void LogDirectoryCandidates(string label, IEnumerable<string> candidates) {
		foreach (var candidate in candidates) {
			if (string.IsNullOrWhiteSpace(candidate)) {
				continue;
			}

			Console.WriteLine($"[DEBUG] [OJ Installer.Cli] {label} candidate: {candidate} (exists={Directory.Exists(candidate)})");
		}
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

	private static void LogDirectorySnapshot(string label, string directory, int maxEntries) {
		if (!Directory.Exists(directory)) {
			Console.WriteLine($"[DEBUG] [OJ Installer.Cli] {label}: missing directory: {directory}");
			return;
		}

		Console.WriteLine($"[DEBUG] [OJ Installer.Cli] {label}: {directory}");
		var entries = Directory.GetFileSystemEntries(directory).Take(maxEntries).ToArray();
		foreach (var entry in entries) {
			Console.WriteLine($"[DEBUG] [OJ Installer.Cli]   -> {Path.GetFileName(entry)}");
		}

		var totalEntries = Directory.GetFileSystemEntries(directory).Length;
		if (totalEntries > entries.Length) {
			Console.WriteLine($"[DEBUG] [OJ Installer.Cli]   ... and {totalEntries - entries.Length} more.");
		}
	}
}
