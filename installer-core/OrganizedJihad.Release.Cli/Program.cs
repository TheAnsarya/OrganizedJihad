using System.Diagnostics;
using System.Net;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text.Json;

namespace OrganizedJihad.Release.Cli;

internal static class Program {
	private static int Main(string[] args) {
		try {
			var options = ReleaseOptions.Parse(args);
			var pipeline = new ReleasePipeline(options);
			pipeline.Run();
			return 0;
		} catch (Exception ex) {
			Console.Error.WriteLine($"[OJ Release.Cli] ERROR: {ex.Message}");
			return 1;
		}
	}
}

internal sealed class ReleaseOptions {
	public string Version { get; init; } = "0.2.3";
	public string Configuration { get; init; } = "Release";
	public string OutputRoot { get; init; } = "artifacts";
	public string[] Runtimes { get; init; } = ["win-x64", "linux-x64", "osx-x64", "osx-arm64"];
	public bool SkipYarnInstall { get; init; }
	public bool SkipUserscriptBuild { get; init; }
	public bool SkipMigrationCheck { get; init; }
	public bool SkipSmokeTest { get; init; }
	public string SmokeRuntime { get; init; } = "auto";
	public string ReleaseNotesPath { get; init; } = "~docs/plans/release-v0.2.3-github-body.md";
	public string MigrationFirstRunUrl { get; init; } = "http://localhost:5334";
	public string MigrationSecondRunUrl { get; init; } = "http://localhost:5335";
	public string SmokeApiUrl { get; init; } = "http://localhost:5234";
	public int StartupTimeoutSeconds { get; init; } = 60;

	public static ReleaseOptions Parse(string[] args) {
		var map = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
		var flags = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
		var knownValueOptions = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
			"version",
			"configuration",
			"output-root",
			"runtimes",
			"release-notes-path",
			"migration-first-run-url",
			"migration-second-run-url",
			"smoke-api-url",
			"startup-timeout-seconds",
			"smoke-runtime",
		};
		var knownFlags = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
			"skip-yarn-install",
			"skip-userscript-build",
			"skip-migration-check",
			"skip-smoke-test",
		};

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

		foreach (var key in map.Keys) {
			if (!knownValueOptions.Contains(key)) {
				throw new ArgumentException($"Unknown option '--{key}'.");
			}
		}

		foreach (var key in flags) {
			if (!knownFlags.Contains(key)) {
				throw new ArgumentException($"Unknown flag '--{key}'.");
			}
		}

		var runtimesRaw = map.TryGetValue("runtimes", out var runtimesValue)
			? runtimesValue
			: "win-x64,linux-x64,osx-x64,osx-arm64";
		var runtimes = (runtimesRaw ?? string.Empty)
			.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
		if (runtimes.Length == 0) {
			runtimes = ["win-x64", "linux-x64", "osx-x64", "osx-arm64"];
		}
		runtimes = runtimes.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();

		var migrationFirstRunUrl = map.TryGetValue("migration-first-run-url", out var firstRunUrl) && !string.IsNullOrWhiteSpace(firstRunUrl)
			? firstRunUrl
			: "http://localhost:5334";
		migrationFirstRunUrl = ValidateAbsoluteUrl(migrationFirstRunUrl, "migration-first-run-url");

		var migrationSecondRunUrl = map.TryGetValue("migration-second-run-url", out var secondRunUrl) && !string.IsNullOrWhiteSpace(secondRunUrl)
			? secondRunUrl
			: "http://localhost:5335";
		migrationSecondRunUrl = ValidateAbsoluteUrl(migrationSecondRunUrl, "migration-second-run-url");

		var smokeApiUrl = map.TryGetValue("smoke-api-url", out var smokeApiUrlRaw) && !string.IsNullOrWhiteSpace(smokeApiUrlRaw)
			? smokeApiUrlRaw
			: "http://localhost:5234";
		smokeApiUrl = ValidateAbsoluteUrl(smokeApiUrl, "smoke-api-url");

		var smokeRuntime = map.TryGetValue("smoke-runtime", out var smokeRuntimeRaw) && !string.IsNullOrWhiteSpace(smokeRuntimeRaw)
			? smokeRuntimeRaw.Trim()
			: "auto";
		smokeRuntime = ValidateSmokeRuntime(smokeRuntime);

		return new ReleaseOptions {
			Version = map.TryGetValue("version", out var version) && !string.IsNullOrWhiteSpace(version)
				? version
				: "0.2.3",
			Configuration = map.TryGetValue("configuration", out var configuration) && !string.IsNullOrWhiteSpace(configuration)
				? configuration
				: "Release",
			OutputRoot = map.TryGetValue("output-root", out var outputRoot) && !string.IsNullOrWhiteSpace(outputRoot)
				? outputRoot
				: "artifacts",
			Runtimes = runtimes,
			SkipYarnInstall = flags.Contains("skip-yarn-install"),
			SkipUserscriptBuild = flags.Contains("skip-userscript-build"),
			SkipMigrationCheck = flags.Contains("skip-migration-check"),
			SkipSmokeTest = flags.Contains("skip-smoke-test"),
			SmokeRuntime = smokeRuntime,
			ReleaseNotesPath = map.TryGetValue("release-notes-path", out var releaseNotesPath) && !string.IsNullOrWhiteSpace(releaseNotesPath)
				? releaseNotesPath
				: "~docs/plans/release-v0.2.3-github-body.md",
			MigrationFirstRunUrl = migrationFirstRunUrl,
			MigrationSecondRunUrl = migrationSecondRunUrl,
			SmokeApiUrl = smokeApiUrl,
			StartupTimeoutSeconds = map.TryGetValue("startup-timeout-seconds", out var timeoutRaw) && int.TryParse(timeoutRaw, out var timeout)
				? Math.Max(10, timeout)
				: 60,
		};
	}

	private static string ValidateAbsoluteUrl(string candidate, string optionName) {
		if (!Uri.TryCreate(candidate, UriKind.Absolute, out var uri)) {
			throw new ArgumentException($"Invalid URL for --{optionName}: '{candidate}'");
		}

		if (!string.Equals(uri.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase)
			&& !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)) {
			throw new ArgumentException($"Unsupported URL scheme for --{optionName}: '{candidate}'. Use http or https.");
		}

		return uri.GetLeftPart(UriPartial.Authority) + uri.AbsolutePath.TrimEnd('/');
	}

	private static string ValidateSmokeRuntime(string candidate) {
		if (string.IsNullOrWhiteSpace(candidate)) {
			return "auto";
		}

		var normalized = candidate.Trim();
		if (string.Equals(normalized, "auto", StringComparison.OrdinalIgnoreCase)) {
			return "auto";
		}
		if (string.Equals(normalized, "none", StringComparison.OrdinalIgnoreCase)) {
			return "none";
		}

		if (normalized.Any(char.IsWhiteSpace)) {
			throw new ArgumentException($"Invalid runtime value for --smoke-runtime: '{candidate}'.");
		}

		return normalized;
	}
}

internal sealed class ReleasePipeline {
	private readonly ReleaseOptions _options;
	private readonly string _repoRoot;
	private readonly string _artifactRoot;
	private readonly string _bundlePayloadDir;
	private readonly string? _smokeRuntime;

	public ReleasePipeline(ReleaseOptions options) {
		_options = options;
		_repoRoot = ResolveRepoRoot();
		_artifactRoot = Path.Combine(_repoRoot, _options.OutputRoot, $"v{_options.Version}");
		_bundlePayloadDir = Path.Combine(_repoRoot, "installer-ui", "bundle-payload");
		_smokeRuntime = ResolveSmokeRuntimeForExecution(_options.Runtimes, _options.SkipSmokeTest, _options.SmokeRuntime, GetHostRuntimeIdentifier());
	}

	public void Run() {
		WriteStep("Starting managed cross-platform release pipeline.");
		if (!_options.SkipMigrationCheck) {
			RunMigrationPathCheck();
		}

		BuildUserscriptBundle();
		PrepareArtifactRoot();

		if (_options.SkipSmokeTest) {
			WriteStep("Skipping published API smoke test (--skip-smoke-test).");
		} else if (string.IsNullOrWhiteSpace(_smokeRuntime)) {
			WriteStep("Skipping published API smoke test: no host-compatible runtime in requested matrix.", ConsoleColor.Yellow);
		} else {
			WriteStep($"Published API smoke test will run for runtime '{_smokeRuntime}'.");
		}

		var desktopPublishDir = TryPublishDesktopPayload();
		var manifestEntries = new List<ManifestRuntime>();

		foreach (var runtime in _options.Runtimes) {
			PublishRuntime(runtime, desktopPublishDir, manifestEntries);
		}

		CopyReleaseNotesDraft();
		WriteManifest(manifestEntries);
		WriteStep($"Artifacts ready at: {_artifactRoot}");
	}

	private void BuildUserscriptBundle() {
		var userscriptDir = Path.Combine(_repoRoot, "userscript");
		if (_options.SkipUserscriptBuild) {
			WriteStep("Skipping userscript build (--skip-userscript-build).");
		} else if (_options.SkipYarnInstall) {
			WriteStep("Skipping yarn install (--skip-yarn-install).");
		} else {
			WriteStep("Running yarn install in userscript workspace.");
			RunProcess("yarn", "install --frozen-lockfile", userscriptDir);
		}

		if (!_options.SkipUserscriptBuild) {
			WriteStep("Building userscript bundle.");
			RunProcess("yarn", "build", userscriptDir);
		}

		var userscriptAsset = Path.Combine(userscriptDir, "dist", "organized-jihad.user.js");
		if (!File.Exists(userscriptAsset)) {
			throw new FileNotFoundException($"Userscript bundle missing: {userscriptAsset}");
		}
	}

	private void CopyReleaseNotesDraft() {
		var source = Path.IsPathRooted(_options.ReleaseNotesPath)
			? _options.ReleaseNotesPath
			: Path.Combine(_repoRoot, _options.ReleaseNotesPath.Replace('/', Path.DirectorySeparatorChar));

		if (!File.Exists(source)) {
			WriteStep($"Release notes draft not found, skipping copy: {source}");
			return;
		}

		var destination = Path.Combine(_artifactRoot, "RELEASE-NOTES.md");
		File.Copy(source, destination, overwrite: true);
		WriteStep($"Copied release notes draft: {destination}");
	}

	private void PrepareArtifactRoot() {
		if (Directory.Exists(_artifactRoot)) {
			Directory.Delete(_artifactRoot, recursive: true);
		}

		Directory.CreateDirectory(_artifactRoot);
	}

	private string? TryPublishDesktopPayload() {
		if (!_options.Runtimes.Contains("win-x64", StringComparer.OrdinalIgnoreCase)) {
			return null;
		}

		WriteStep("Publishing desktop payload for win-x64.");
		var desktopProject = Path.Combine(_repoRoot, "desktop-app", "OrganizedJihad.Desktop.csproj");
		RunDotnetPublish(desktopProject, "-f net10.0-windows10.0.19041.0 -c " + _options.Configuration + " -p:WindowsPackageType=None");

		var candidates = new[] {
			Path.Combine(_repoRoot, "desktop-app", "bin", "Release", "net10.0-windows10.0.19041.0", "win-x64", "publish"),
			Path.Combine(_repoRoot, "desktop-app", "bin", "Release", "net10.0-windows10.0.19041.0", "publish"),
		};

		return candidates.FirstOrDefault(Directory.Exists);
	}

	private void PublishRuntime(string runtime, string? desktopPublishDir, List<ManifestRuntime> manifestEntries) {
		WriteStep($"Publishing runtime: {runtime}");

		var bundledRoot = Path.Combine(_bundlePayloadDir, "bundled");
		var apiOut = Path.Combine(bundledRoot, "api");
		var runtimeHostOut = Path.Combine(bundledRoot, "runtime-host");
		var installerCliOut = Path.Combine(_bundlePayloadDir, "installer-cli");
		var desktopOut = Path.Combine(bundledRoot, "desktop-app");

		ResetDirectory(apiOut);
		ResetDirectory(runtimeHostOut);
		ResetDirectory(installerCliOut);
		DeleteIfExists(desktopOut);

		var apiProject = Path.Combine(_repoRoot, "api", "OrganizedJihad.Api.csproj");
		var runtimeHostProject = Path.Combine(_repoRoot, "api", "OrganizedJihad.Api.TrayHost", "OrganizedJihad.Api.TrayHost.csproj");
		var installerCliProject = Path.Combine(_repoRoot, "installer-core", "OrganizedJihad.Installer.Cli", "OrganizedJihad.Installer.Cli.csproj");
		var installerUiProject = Path.Combine(_repoRoot, "installer-ui", "OrganizedJihad.Installer.csproj");
		var installerUiOut = Path.Combine(_repoRoot, "installer-ui", "publish", runtime);

		RunDotnetPublish(apiProject, $"-c {_options.Configuration} -r {runtime} --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o \"{apiOut}\"");

		if (ShouldRunSmokeForRuntime(runtime)) {
			RunPublishedApiSmokeTest(apiOut, runtime);
		}

		var runtimeHostTfm = runtime.StartsWith("win-", StringComparison.OrdinalIgnoreCase)
			? "net10.0-windows10.0.19041.0"
			: "net10.0";
		RunDotnetPublish(runtimeHostProject, $"-f {runtimeHostTfm} -c {_options.Configuration} -r {runtime} --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o \"{runtimeHostOut}\"");

		RunDotnetPublish(installerCliProject, $"-c {_options.Configuration} -r {runtime} --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o \"{installerCliOut}\"");

		if (runtime.Equals("win-x64", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(desktopPublishDir) && Directory.Exists(desktopPublishDir)) {
			ResetDirectory(desktopOut);
			CopyDirectory(desktopPublishDir, desktopOut);
		}

		CopyBundleSupportAssets();

		DeleteIfExists(installerUiOut);
		RunDotnetPublish(installerUiProject, $"-c {_options.Configuration} -r {runtime} --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:IncludeAllContentForSelfExtract=true -o \"{installerUiOut}\"");

		var installerBinaryName = runtime.StartsWith("win-", StringComparison.OrdinalIgnoreCase)
			? "OrganizedJihad.Installer.exe"
			: "OrganizedJihad.Installer";
		var installerBinaryPath = Path.Combine(installerUiOut, installerBinaryName);
		if (!File.Exists(installerBinaryPath)) {
			throw new FileNotFoundException($"Installer binary missing for {runtime}: {installerBinaryPath}");
		}

		var runtimeArtifactDir = Path.Combine(_artifactRoot, runtime);
		ResetDirectory(runtimeArtifactDir);
		var installerAssetPath = Path.Combine(runtimeArtifactDir, installerBinaryName);
		File.Copy(installerBinaryPath, installerAssetPath, overwrite: true);

		var checksum = ComputeSha256(installerAssetPath);
		var checksumFile = Path.Combine(runtimeArtifactDir, "SHA256SUMS.txt");
		File.WriteAllText(checksumFile, $"{checksum}  {installerBinaryName}{Environment.NewLine}");

		manifestEntries.Add(new ManifestRuntime {
			Runtime = runtime,
			Installer = installerBinaryName,
			ChecksumFile = "SHA256SUMS.txt",
		});
	}

	private void CopyBundleSupportAssets() {
		Directory.CreateDirectory(_bundlePayloadDir);

		var userscriptFile = Path.Combine(_repoRoot, "userscript", "dist", "organized-jihad.user.js");
		var healthCheck = Path.Combine(_repoRoot, "userscript", "scripts", "install-health-check.mjs");
		var guideHtml = Path.Combine(_repoRoot, "~docs", "installer-guide", "tampermonkey-setup.html");
		var guideScreenshots = Path.Combine(_repoRoot, "~docs", "installer-guide", "screenshots");

		if (!File.Exists(userscriptFile)) {
			throw new FileNotFoundException($"Userscript bundle missing: {userscriptFile}");
		}
		if (!File.Exists(healthCheck)) {
			throw new FileNotFoundException($"Install health-check script missing: {healthCheck}");
		}
		if (!File.Exists(guideHtml)) {
			throw new FileNotFoundException($"Guide HTML missing: {guideHtml}");
		}
		if (!Directory.Exists(guideScreenshots)) {
			throw new DirectoryNotFoundException($"Guide screenshots directory missing: {guideScreenshots}");
		}

		File.Copy(userscriptFile, Path.Combine(_bundlePayloadDir, "organized-jihad.user.js"), overwrite: true);
		File.Copy(healthCheck, Path.Combine(_bundlePayloadDir, "install-health-check.mjs"), overwrite: true);
		File.Copy(guideHtml, Path.Combine(_bundlePayloadDir, "tampermonkey-setup.html"), overwrite: true);

		var screenshotsOut = Path.Combine(_bundlePayloadDir, "guide-screenshots");
		ResetDirectory(screenshotsOut);
		CopyDirectory(guideScreenshots, screenshotsOut);
	}

	private void WriteManifest(List<ManifestRuntime> runtimes) {
		var manifest = new ReleaseManifest {
			Version = _options.Version,
			GeneratedAtUtc = DateTime.UtcNow,
			Runtimes = runtimes,
		};

		var json = JsonSerializer.Serialize(manifest, new JsonSerializerOptions {
			WriteIndented = true,
			PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
		});
		File.WriteAllText(Path.Combine(_artifactRoot, "release-manifest.json"), json);
	}

	private void RunDotnetPublish(string projectPath, string arguments) {
		RunProcess("dotnet", $"publish \"{projectPath}\" {arguments}", _repoRoot);
	}

	private static void RunProcess(string fileName, string arguments, string workingDirectory) {
		var resolvedFileName = ResolveCommand(fileName);
		var startInfo = new ProcessStartInfo {
			FileName = resolvedFileName,
			Arguments = arguments,
			WorkingDirectory = workingDirectory,
			UseShellExecute = false,
			RedirectStandardOutput = true,
			RedirectStandardError = true,
			CreateNoWindow = true,
		};

		using var process = Process.Start(startInfo);
		if (process is null) {
			throw new InvalidOperationException($"Could not start process: {resolvedFileName}");
		}

		process.OutputDataReceived += (_, e) => {
			if (!string.IsNullOrWhiteSpace(e.Data)) {
				Console.WriteLine(e.Data);
			}
		};
		process.ErrorDataReceived += (_, e) => {
			if (!string.IsNullOrWhiteSpace(e.Data)) {
				Console.Error.WriteLine(e.Data);
			}
		};

		process.BeginOutputReadLine();
		process.BeginErrorReadLine();
		process.WaitForExit();

		if (process.ExitCode != 0) {
			throw new InvalidOperationException($"Process failed ({resolvedFileName} {arguments}) with exit code {process.ExitCode}.");
		}
	}

	private static string ResolveCommand(string command) {
		if (Path.IsPathRooted(command) || command.Contains(Path.DirectorySeparatorChar) || command.Contains(Path.AltDirectorySeparatorChar)) {
			return command;
		}

		var pathValue = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
		var pathEntries = pathValue.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

		var candidates = new List<string>();
		if (OperatingSystem.IsWindows()) {
			var defaultOrder = new[] { ".CMD", ".BAT", ".EXE", ".COM" };
			var envExtensions = (Environment.GetEnvironmentVariable("PATHEXT") ?? string.Empty)
				.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
				.Select(value => value.StartsWith('.') ? value.ToUpperInvariant() : $".{value.ToUpperInvariant()}");

			var extensions = defaultOrder.Concat(envExtensions).Distinct(StringComparer.OrdinalIgnoreCase);
			candidates.AddRange(extensions.Select(ext => command + ext));
		} else {
			candidates.Add(command);
		}

		foreach (var entry in pathEntries) {
			foreach (var candidate in candidates) {
				var fullPath = Path.Combine(entry, candidate);
				if (File.Exists(fullPath)) {
					return fullPath;
				}
			}
		}

		return command;
	}

	private static void ResetDirectory(string path) {
		DeleteIfExists(path);
		Directory.CreateDirectory(path);
	}

	private static void DeleteIfExists(string path) {
		if (Directory.Exists(path)) {
			Directory.Delete(path, recursive: true);
		}
	}

	private static void CopyDirectory(string source, string destination) {
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

	private static string ComputeSha256(string filePath) {
		using var stream = File.OpenRead(filePath);
		using var sha = SHA256.Create();
		var hash = sha.ComputeHash(stream);
		return Convert.ToHexString(hash);
	}

	private static void WriteStep(string message) {
		Console.WriteLine($"[OJ Release.Cli] {message}");
	}

	private static string ResolveRepoRoot() {
		var current = new DirectoryInfo(AppContext.BaseDirectory);
		while (current is not null) {
			var solution = Path.Combine(current.FullName, "OrganizedJihad.sln");
			if (File.Exists(solution)) {
				return current.FullName;
			}
			current = current.Parent;
		}

		throw new DirectoryNotFoundException("Could not resolve repository root containing OrganizedJihad.sln.");
	}

	private void RunMigrationPathCheck() {
		WriteStep("Running migration-path check (cold start + repeat start).", ConsoleColor.DarkCyan);

		var apiProject = Path.Combine(_repoRoot, "api", "OrganizedJihad.Api.csproj");
		if (!File.Exists(apiProject)) {
			throw new FileNotFoundException($"Missing API project for migration check: {apiProject}");
		}

		var tempRoot = Path.Combine(Path.GetTempPath(), "oj-migration-" + Guid.NewGuid().ToString("N"));
		Directory.CreateDirectory(tempRoot);
		var dbPath = Path.Combine(tempRoot, "migration-herowars.db");

		try {
			RunApiCycle(apiProject, _options.MigrationFirstRunUrl, dbPath, _options.StartupTimeoutSeconds);
			RunApiCycle(apiProject, _options.MigrationSecondRunUrl, dbPath, _options.StartupTimeoutSeconds);

			if (!File.Exists(dbPath)) {
				throw new InvalidOperationException("Migration check failed: database file was not created.");
			}

			var dbFile = new FileInfo(dbPath);
			if (dbFile.Length <= 0) {
				throw new InvalidOperationException("Migration check failed: database file is empty.");
			}

			WriteStep("Migration-path check passed.", ConsoleColor.Green);
		} finally {
			TryDeleteDirectory(tempRoot);
		}
	}

	private void RunApiCycle(string apiProjectPath, string baseUrl, string dbPath, int timeoutSeconds) {
		Process? process = null;

		try {
			var startInfo = new ProcessStartInfo {
				FileName = ResolveCommand("dotnet"),
				Arguments = $"run --project \"{apiProjectPath}\" -- --urls {baseUrl}",
				WorkingDirectory = _repoRoot,
				UseShellExecute = false,
				CreateNoWindow = true,
				RedirectStandardOutput = true,
				RedirectStandardError = true,
			};
			startInfo.Environment["OJ_DB_PATH"] = dbPath;

			process = Process.Start(startInfo);
			if (process is null) {
				throw new InvalidOperationException("Could not launch API project for migration cycle.");
			}

			if (!WaitHealthy(baseUrl, timeoutSeconds)) {
				throw new InvalidOperationException($"API did not become healthy at {baseUrl} within {timeoutSeconds}s.");
			}
		} finally {
			TryStopProcess(process);
		}
	}

	private bool ShouldRunSmokeForRuntime(string runtime) {
		return !string.IsNullOrWhiteSpace(_smokeRuntime)
			&& runtime.Equals(_smokeRuntime, StringComparison.OrdinalIgnoreCase);
	}

	private void RunPublishedApiSmokeTest(string publishedApiDirectory, string runtime) {
		WriteStep($"Running published API smoke test ({runtime}).", ConsoleColor.DarkCyan);

		var apiExecutable = ResolvePublishedApiExecutable(publishedApiDirectory);
		if (string.IsNullOrWhiteSpace(apiExecutable)) {
			throw new FileNotFoundException($"Could not locate published API executable in: {publishedApiDirectory}");
		}

		var workingDirectory = Path.GetDirectoryName(apiExecutable) ?? _repoRoot;
		var tempRoot = Path.Combine(Path.GetTempPath(), "oj-smoke-" + Guid.NewGuid().ToString("N"));
		Directory.CreateDirectory(tempRoot);
		var dbPath = Path.Combine(tempRoot, "smoke-herowars.db");

		Process? process = null;
		try {
			var startInfo = new ProcessStartInfo {
				FileName = apiExecutable,
				Arguments = $"--urls {_options.SmokeApiUrl}",
				WorkingDirectory = workingDirectory,
				UseShellExecute = false,
				CreateNoWindow = true,
				RedirectStandardOutput = true,
				RedirectStandardError = true,
			};
			startInfo.Environment["OJ_DB_PATH"] = dbPath;

			process = Process.Start(startInfo);
			if (process is null) {
				throw new InvalidOperationException("Could not launch published API executable for smoke test.");
			}

			if (!WaitHealthy(_options.SmokeApiUrl, _options.StartupTimeoutSeconds)) {
				throw new InvalidOperationException($"Published API did not become healthy at {_options.SmokeApiUrl} within {_options.StartupTimeoutSeconds}s.");
			}

			var probeEndpoints = new[] {
				$"{_options.SmokeApiUrl.TrimEnd('/')}/api/sync/health",
				$"{_options.SmokeApiUrl.TrimEnd('/')}/ui/settings",
				$"{_options.SmokeApiUrl.TrimEnd('/')}/ui/repair-status",
				$"{_options.SmokeApiUrl.TrimEnd('/')}/ui/userscript-handshake",
			};

			using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(8) };
			foreach (var endpoint in probeEndpoints) {
				using var response = client.GetAsync(endpoint).GetAwaiter().GetResult();
				if (response.StatusCode is < HttpStatusCode.OK or >= HttpStatusCode.MultipleChoices) {
					throw new InvalidOperationException($"Smoke probe failed for {endpoint} (HTTP {(int)response.StatusCode}).");
				}
			}

			WriteStep("Published API smoke test passed.", ConsoleColor.Green);
		} finally {
			TryStopProcess(process);
			TryDeleteDirectory(tempRoot);
		}
	}

	private static string? ResolvePublishedApiExecutable(string publishedApiDirectory) {
		var candidates = new[] {
			Path.Combine(publishedApiDirectory, "OrganizedJihad.Api.exe"),
			Path.Combine(publishedApiDirectory, "OrganizedJihad.Api"),
		};

		return candidates.FirstOrDefault(File.Exists);
	}

	internal static string? ResolveSmokeRuntimeForExecution(string[] runtimes, bool skipSmokeTest, string smokeRuntimeOption, string? hostRuntime) {
		if (skipSmokeTest) {
			return null;
		}

		var normalizedOption = string.IsNullOrWhiteSpace(smokeRuntimeOption)
			? "auto"
			: smokeRuntimeOption.Trim();

		if (string.Equals(normalizedOption, "none", StringComparison.OrdinalIgnoreCase)) {
			return null;
		}

		if (string.Equals(normalizedOption, "auto", StringComparison.OrdinalIgnoreCase)) {
			if (string.IsNullOrWhiteSpace(hostRuntime)) {
				return null;
			}

			var hostMatch = runtimes.FirstOrDefault(runtime => runtime.Equals(hostRuntime, StringComparison.OrdinalIgnoreCase));
			return hostMatch;
		}

		var explicitMatch = runtimes.FirstOrDefault(runtime => runtime.Equals(normalizedOption, StringComparison.OrdinalIgnoreCase));
		if (string.IsNullOrWhiteSpace(explicitMatch)) {
			throw new ArgumentException($"Smoke runtime '{normalizedOption}' is not present in --runtimes.");
		}

		return explicitMatch;
	}

	private static string? GetHostRuntimeIdentifier() {
		if (OperatingSystem.IsWindows()) {
			return RuntimeInformation.ProcessArchitecture switch {
				Architecture.X64 => "win-x64",
				Architecture.Arm64 => "win-arm64",
				_ => null,
			};
		}

		if (OperatingSystem.IsLinux()) {
			return RuntimeInformation.ProcessArchitecture switch {
				Architecture.X64 => "linux-x64",
				Architecture.Arm64 => "linux-arm64",
				_ => null,
			};
		}

		if (OperatingSystem.IsMacOS()) {
			return RuntimeInformation.ProcessArchitecture switch {
				Architecture.X64 => "osx-x64",
				Architecture.Arm64 => "osx-arm64",
				_ => null,
			};
		}

		return null;
	}

	private static bool WaitHealthy(string baseUrl, int timeoutSeconds) {
		var healthUrl = $"{baseUrl.TrimEnd('/')}/api/sync/health";
		var deadline = DateTime.UtcNow.AddSeconds(timeoutSeconds);
		using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };

		while (DateTime.UtcNow < deadline) {
			try {
				using var response = client.GetAsync(healthUrl).GetAwaiter().GetResult();
				if (response.StatusCode is >= HttpStatusCode.OK and < HttpStatusCode.MultipleChoices) {
					return true;
				}
			} catch {
				// Keep waiting until timeout.
			}

			Thread.Sleep(800);
		}

		return false;
	}

	private static void TryStopProcess(Process? process) {
		if (process is null) {
			return;
		}

		try {
			if (!process.HasExited) {
				process.Kill(entireProcessTree: true);
				process.WaitForExit(8000);
			}
		} catch {
			// Best effort process cleanup.
		} finally {
			process.Dispose();
		}
	}

	private static void TryDeleteDirectory(string path) {
		try {
			if (Directory.Exists(path)) {
				Directory.Delete(path, recursive: true);
			}
		} catch {
			// Best effort cleanup.
		}
	}

	private static void WriteStep(string message, ConsoleColor color) {
		var previous = Console.ForegroundColor;
		try {
			Console.ForegroundColor = color;
			WriteStep(message);
		} finally {
			Console.ForegroundColor = previous;
		}
	}

	private sealed class ReleaseManifest {
		public string Version { get; init; } = string.Empty;
		public DateTime GeneratedAtUtc { get; init; }
		public List<ManifestRuntime> Runtimes { get; init; } = [];
	}

	private sealed class ManifestRuntime {
		public string Runtime { get; init; } = string.Empty;
		public string Installer { get; init; } = string.Empty;
		public string ChecksumFile { get; init; } = string.Empty;
	}
}
