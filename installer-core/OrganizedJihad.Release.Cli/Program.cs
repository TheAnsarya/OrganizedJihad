using System.Diagnostics;
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
	public string ReleaseNotesPath { get; init; } = "~docs/plans/release-v0.2.3-github-body.md";

	public static ReleaseOptions Parse(string[] args) {
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

		var runtimesRaw = map.TryGetValue("runtimes", out var runtimesValue)
			? runtimesValue
			: "win-x64,linux-x64,osx-x64,osx-arm64";
		var runtimes = (runtimesRaw ?? string.Empty)
			.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
		if (runtimes.Length == 0) {
			runtimes = ["win-x64", "linux-x64", "osx-x64", "osx-arm64"];
		}

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
			ReleaseNotesPath = map.TryGetValue("release-notes-path", out var releaseNotesPath) && !string.IsNullOrWhiteSpace(releaseNotesPath)
				? releaseNotesPath
				: "~docs/plans/release-v0.2.3-github-body.md",
		};
	}
}

internal sealed class ReleasePipeline {
	private readonly ReleaseOptions _options;
	private readonly string _repoRoot;
	private readonly string _artifactRoot;
	private readonly string _bundlePayloadDir;

	public ReleasePipeline(ReleaseOptions options) {
		_options = options;
		_repoRoot = ResolveRepoRoot();
		_artifactRoot = Path.Combine(_repoRoot, _options.OutputRoot, $"v{_options.Version}");
		_bundlePayloadDir = Path.Combine(_repoRoot, "installer-ui", "bundle-payload");
	}

	public void Run() {
		WriteStep("Starting managed cross-platform release pipeline.");
		BuildUserscriptBundle();
		PrepareArtifactRoot();

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
