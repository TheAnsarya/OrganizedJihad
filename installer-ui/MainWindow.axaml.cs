using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Threading;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.Versioning;
using System.Text;
using System.Threading.Tasks;

namespace OrganizedJihad.Installer;

public partial class MainWindow : Window {
	private sealed class BrowserOption {
		public BrowserOption(string label, string argument, bool installed) {
			Label = label;
			Argument = argument;
			Installed = installed;
		}

		public string Label { get; }
		public string Argument { get; }
		public bool Installed { get; }

		public override string ToString() {
			return Installed ? Label : $"{Label} (not detected)";
		}
	}

	private bool _isInstalling;
	private string? _currentLogFilePath;
	private readonly List<BrowserOption> _availableBrowsers;

	public MainWindow() {
		InitializeComponent();

		InstallRootTextBox.Text = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OrganizedJihad");
		ApiUrlTextBox.Text = "http://localhost:5124";

		_availableBrowsers = DetectBrowsers();
		var installedBrowsers = _availableBrowsers.Where(browser => browser.Installed).ToList();
		BrowserComboBox.ItemsSource = installedBrowsers;
		BrowserComboBox.SelectedItem = installedBrowsers.FirstOrDefault();

		if (installedBrowsers.Count == 0) {
			OpenTampermonkeySetupCheckBox.IsChecked = false;
			OpenTampermonkeySetupCheckBox.IsEnabled = false;
			AppendLog("[Installer UI] No supported browser was auto-detected. Userscript file will still be installed so you can import it manually in Tampermonkey.");
		}

		UpdateQuickActionState();
	}

	private async void OnInstallClick(object? sender, RoutedEventArgs e) {
		if (_isInstalling) {
			return;
		}

		if (!EnsureElevatedUiContext()) {
			return;
		}

		var installApi = InstallApiCheckBox.IsChecked == true;
		var installDesktop = InstallDesktopCheckBox.IsChecked == true;
		var installUserscript = InstallUserscriptCheckBox.IsChecked == true;
		var openTampermonkeySetup = OpenTampermonkeySetupCheckBox.IsChecked == true;

		if (!installApi && !installDesktop && !installUserscript) {
			SetStatus("Status: Select at least one component to install.");
			AppendLog("[Installer UI] Please select at least one component (API, desktop, or userscript).");
			return;
		}

		if (!ValidatePreflight(installApi, out var installRoot, out var apiUrl, out var preflightMessage)) {
			SetStatus($"Status: {preflightMessage}");
			AppendLog($"[Installer UI] Preflight failed: {preflightMessage}");
			return;
		}

		string? browserArg = null;
		if (installUserscript && openTampermonkeySetup) {
			if (BrowserComboBox.SelectedItem is BrowserOption selectedBrowser) {
				browserArg = selectedBrowser.Argument;
			} else {
				SetStatus("Status: No supported browser selected for Tampermonkey setup.");
				AppendLog("[Installer UI] Install will continue without automatic Tampermonkey page opening.");
				openTampermonkeySetup = false;
			}
		}

		var scriptPath = ResolveInstallerScriptPath();
		if (scriptPath is null) {
			SetStatus("Status: Could not locate Install-OrganizedJihad.ps1.");
			AppendLog("[Installer UI] Unable to find Install-OrganizedJihad.ps1 near executable or repository root.");
			return;
		}

		var shell = ResolvePowerShellExecutable();
		if (shell is null) {
			SetStatus("Status: PowerShell was not found.");
			AppendLog("[Installer UI] Neither pwsh nor powershell is available in PATH.");
			return;
		}

		var args = BuildInstallerArguments(scriptPath, installRoot, apiUrl, installApi, installDesktop, installUserscript, openTampermonkeySetup, browserArg);
		await RunInstallProcessAsync(shell, args);

		if (installUserscript) {
			var userscriptPath = Path.Combine(installRoot, "userscript", "organized-jihad.user.js");
			AppendLog("[Installer UI] Next steps for userscript installation:");
			AppendLog($"[Installer UI] 1) Open Tampermonkey dashboard in your browser.");
			AppendLog($"[Installer UI] 2) Use Import/Utilities and choose: {userscriptPath}");
			AppendLog("[Installer UI] 3) Save/Enable the OrganizedJihad script and refresh Hero Wars.");
		}
	}

	private string BuildInstallerArguments(string scriptPath, string installRoot, string apiUrl, bool installApi, bool installDesktop, bool installUserscript, bool openTampermonkeySetup, string? browserArg) {
		var args = new List<string> {
			"-NoProfile",
			"-WindowStyle", "Hidden",
			"-ExecutionPolicy", "Bypass",
			"-File", Quote(scriptPath),
			"-InstallRoot", Quote(installRoot),
			"-ApiUrl", Quote(apiUrl),
		};

		if (!installApi) {
			args.Add("-SkipApiInstall");
		}

		if (!installDesktop) {
			args.Add("-SkipDesktopAppInstall");
		}

		if (!installUserscript) {
			args.Add("-SkipUserscriptInstall");
		}

		if (!openTampermonkeySetup || !installUserscript || string.IsNullOrWhiteSpace(browserArg)) {
			args.Add("-SkipTampermonkeyBootstrap");
		} else {
			args.Add("-TampermonkeyBrowsers");
			args.Add(browserArg);
		}

		if (installApi) {
			args.Add("-RunInstallHealthCheck");
		}

		if (FirstRunDiagnosticsCheckBox.IsChecked == true) {
			args.Add("-FirstRunDiagnostics");
		}

		if (OpenDiagnosticsCheckBox.IsChecked == true) {
			args.Add("-OpenUserscriptDiagnostics");
		}

		return string.Join(' ', args);
	}

	private static List<BrowserOption> DetectBrowsers() {
		var options = new List<BrowserOption> {
			new("Chrome", "chrome", BrowserInstalled(
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google", "Chrome", "Application", "chrome.exe"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google", "Chrome", "Application", "chrome.exe"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google", "Chrome", "Application", "chrome.exe"))),
			new("Edge", "edge", BrowserInstalled(
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe"))),
			new("Firefox", "firefox", BrowserInstalled(
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Mozilla Firefox", "firefox.exe"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Mozilla Firefox", "firefox.exe"))),
			new("Opera GX", "operaGX", BrowserInstalled(
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Opera GX", "launcher.exe"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Opera GX", "launcher.exe"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Opera GX", "launcher.exe")))
		};

		return options;
	}

	private static bool BrowserInstalled(params string[] paths) {
		return paths.Any(path => !string.IsNullOrWhiteSpace(path) && File.Exists(path));
	}

	private async Task RunInstallProcessAsync(string shell, string args) {
		_isInstalling = true;
		UpdateQuickActionState();

		_currentLogFilePath = CreateInstallLogFilePath();
		LogPathTextBlock.Text = $"Log: {_currentLogFilePath}";
		PersistLogLine("[Installer UI] Log initialized.");

		SetStatus("Status: Installing...");
		AppendLog("[Installer UI] Running install pipeline in hidden shell mode (GUI-only experience).");

		var startInfo = new ProcessStartInfo {
			FileName = shell,
			Arguments = args,
			UseShellExecute = false,
			RedirectStandardOutput = true,
			RedirectStandardError = true,
			CreateNoWindow = true,
		};

		try {
			using var process = new Process { StartInfo = startInfo };

			process.OutputDataReceived += (_, eventArgs) => {
				if (!string.IsNullOrWhiteSpace(eventArgs.Data)) {
					AppendLog(eventArgs.Data);
				}
			};
			process.ErrorDataReceived += (_, eventArgs) => {
				if (!string.IsNullOrWhiteSpace(eventArgs.Data)) {
					AppendLog($"[stderr] {eventArgs.Data}");
				}
			};

			if (!process.Start()) {
				AppendLog("[Installer UI] Failed to start installer process.");
				SetStatus("Status: Failed to start installer.");
				return;
			}

			process.BeginOutputReadLine();
			process.BeginErrorReadLine();
			await process.WaitForExitAsync();

			if (process.ExitCode == 0) {
				SetStatus("Status: Install complete.");
				AppendLog("[Installer UI] Installation succeeded.");
			} else {
				SetStatus($"Status: Installer failed (exit {process.ExitCode}).");
				AppendLog($"[Installer UI] Installation failed with exit code {process.ExitCode}.");
			}
		} catch (Exception ex) {
			SetStatus("Status: Installer crashed.");
			AppendLog($"[Installer UI] Exception: {ex.Message}");
		} finally {
			_isInstalling = false;
			UpdateQuickActionState();
		}
	}

	private bool EnsureElevatedUiContext() {
		if (!OperatingSystem.IsWindows()) {
			AppendLog("[Installer UI] Non-Windows runtime detected; skipping Windows UAC elevation flow.");
			return true;
		}

		if (IsAdministrator()) {
			AppendLog("[Installer UI] Elevated UI session confirmed.");
			return true;
		}

		SetStatus("Status: Elevation required.");
		AppendLog("[Installer UI] Please give us admin privileges so we can install fully.");
		AppendLog("[Installer UI] Requesting Windows UAC prompt for installer UI relaunch...");

		var exePath = Environment.ProcessPath;
		if (string.IsNullOrWhiteSpace(exePath) || !File.Exists(exePath)) {
			AppendLog("[Installer UI] Could not resolve current installer executable for elevation.");
			SetStatus("Status: Could not request elevation.");
			return false;
		}

		try {
			Process.Start(new ProcessStartInfo {
				FileName = exePath,
				UseShellExecute = true,
				Verb = "runas",
			});

			Close();
			return false;
		} catch (Exception ex) {
			AppendLog($"[Installer UI] Elevation request did not complete: {ex.Message}");
			SetStatus("Status: Elevation was not granted.");
			return false;
		}
	}

	[SupportedOSPlatform("windows")]
	private static bool IsAdministrator() {
		var identity = System.Security.Principal.WindowsIdentity.GetCurrent();
		var principal = new System.Security.Principal.WindowsPrincipal(identity);
		return principal.IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator);
	}

	private bool ValidatePreflight(bool installApi, out string installRoot, out string apiUrl, out string message) {
		installRoot = InstallRootTextBox.Text?.Trim() ?? string.Empty;
		apiUrl = ApiUrlTextBox.Text?.Trim() ?? string.Empty;

		if (string.IsNullOrWhiteSpace(installRoot)) {
			message = "Install root is required.";
			return false;
		}

		if (installRoot.IndexOfAny(Path.GetInvalidPathChars()) >= 0) {
			message = "Install root contains invalid characters.";
			return false;
		}

		if (!Path.IsPathRooted(installRoot)) {
			message = "Install root must be an absolute path.";
			return false;
		}

		try {
			Directory.CreateDirectory(installRoot);
		} catch (Exception ex) {
			message = $"Install root is not writable: {ex.Message}";
			return false;
		}

		if (installApi) {
			if (string.IsNullOrWhiteSpace(apiUrl)) {
				message = "API URL is required when API install is enabled.";
				return false;
			}

			if (!Uri.TryCreate(apiUrl, UriKind.Absolute, out var uri)) {
				message = "API URL must be a valid absolute URL.";
				return false;
			}

			if (!string.Equals(uri.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase) && !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)) {
				message = "API URL must use http or https.";
				return false;
			}
		}

		message = "Preflight checks passed.";
		return true;
	}

	private string? ResolveInstallerScriptPath() {
		var baseDir = AppContext.BaseDirectory;
		var candidates = new[] {
			Path.Combine(baseDir, "Install-OrganizedJihad.ps1"),
			Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "Install-OrganizedJihad.ps1")),
			Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "Install-OrganizedJihad.ps1")),
		};

		return candidates.FirstOrDefault(File.Exists);
	}

	private static string? ResolvePowerShellExecutable() {
		var candidatePaths = new List<string>();

		candidatePaths.AddRange(ResolveExecutablesFromPath("pwsh"));
		candidatePaths.AddRange(ResolveExecutablesFromPath("powershell"));

		foreach (var path in candidatePaths.Distinct(StringComparer.OrdinalIgnoreCase)) {
			if (CommandExists(path)) {
				return path;
			}
		}

		return null;
	}

	private static IEnumerable<string> ResolveExecutablesFromPath(string commandName) {
		var pathValue = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
		var pathEntries = pathValue.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
		var pathextRaw = Environment.GetEnvironmentVariable("PATHEXT") ?? ".EXE;.CMD;.BAT";
		var extensions = pathextRaw.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
			.Select(ext => ext.StartsWith('.') ? ext : $".{ext}")
			.ToArray();

		foreach (var entry in pathEntries) {
			foreach (var ext in extensions) {
				var candidate = Path.Combine(entry, $"{commandName}{ext}");
				if (File.Exists(candidate)) {
					yield return candidate;
				}
			}
		}
	}

	private static bool CommandExists(string commandPath) {
		var info = new ProcessStartInfo {
			FileName = commandPath,
			Arguments = "-NoProfile -Command \"$PSVersionTable.PSVersion\"",
			UseShellExecute = false,
			RedirectStandardOutput = true,
			RedirectStandardError = true,
			CreateNoWindow = true,
		};

		try {
			using var process = Process.Start(info);
			if (process is null) {
				return false;
			}
			process.WaitForExit(2000);
			return process.ExitCode == 0;
		} catch {
			return false;
		}
	}

	private void AppendLog(string line) {
		PersistLogLine(line);

		Dispatcher.UIThread.Post(() => {
			LogTextBox.Text = string.Concat(LogTextBox.Text ?? string.Empty, Environment.NewLine, line);
			LogTextBox.CaretIndex = (LogTextBox.Text ?? string.Empty).Length;
		});
	}

	private void SetStatus(string value) {
		Dispatcher.UIThread.Post(() => {
			StatusTextBlock.Text = value;
		});
	}

	private static string Quote(string value) {
		return $"\"{value.Replace("\"", "\\\"")}\"";
	}

	private string CreateInstallLogFilePath() {
		var logRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OrganizedJihad", "installer-logs");
		Directory.CreateDirectory(logRoot);
		return Path.Combine(logRoot, $"installer-{DateTime.Now:yyyyMMdd-HHmmss}.log");
	}

	private void PersistLogLine(string line) {
		if (string.IsNullOrWhiteSpace(_currentLogFilePath)) {
			return;
		}

		var stampedLine = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {line}";
		File.AppendAllText(_currentLogFilePath, stampedLine + Environment.NewLine, Encoding.UTF8);
	}

	private void OnOpenInstallRootClick(object? sender, RoutedEventArgs e) {
		var installRoot = InstallRootTextBox.Text?.Trim();
		if (string.IsNullOrWhiteSpace(installRoot) || !Directory.Exists(installRoot)) {
			SetStatus("Status: Install root does not exist yet.");
			return;
		}

		OpenFolder(installRoot);
	}

	private void OnOpenLogFolderClick(object? sender, RoutedEventArgs e) {
		if (string.IsNullOrWhiteSpace(_currentLogFilePath)) {
			SetStatus("Status: Run an install first to create a log file.");
			return;
		}

		var folder = Path.GetDirectoryName(_currentLogFilePath);
		if (string.IsNullOrWhiteSpace(folder) || !Directory.Exists(folder)) {
			SetStatus("Status: Log folder does not exist.");
			return;
		}

		OpenFolder(folder);
	}

	private static void OpenFolder(string folderPath) {
		Process.Start(new ProcessStartInfo {
			FileName = "explorer.exe",
			Arguments = Quote(folderPath),
			UseShellExecute = true,
		});
	}

	private void UpdateQuickActionState() {
		InstallButton.IsEnabled = !_isInstalling;
		OpenInstallRootButton.IsEnabled = !_isInstalling;
		OpenLogFolderButton.IsEnabled = !_isInstalling;
	}
}
