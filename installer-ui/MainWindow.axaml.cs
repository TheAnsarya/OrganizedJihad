using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Threading;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using Microsoft.Win32;
using System.Runtime.Versioning;
using System.Text;
using System.Threading.Tasks;

namespace OrganizedJihad.Installer;

public partial class MainWindow : Window {
	private sealed class BrowserOption {
		public BrowserOption(string label, string argument, bool installed, string? executablePath) {
			Label = label;
			Argument = argument;
			Installed = installed;
			ExecutablePath = executablePath;
		}

		public string Label { get; }
		public string Argument { get; }
		public bool Installed { get; }
		public string? ExecutablePath { get; }

		public override string ToString() {
			return Installed ? Label : $"{Label} (not detected)";
		}
	}

	private bool _isInstalling;
	private bool _tampermonkeyInstalledForSelection;
	private string? _currentLogFilePath;
	private string? _userscriptGuidePath;
	private readonly List<BrowserOption> _availableBrowsers;

	public MainWindow() {
		InitializeComponent();

		InstallRootTextBox.Text = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OrganizedJihad");
		ApiUrlTextBox.Text = "http://localhost:5124";

		_availableBrowsers = DetectBrowsers();
		BrowserComboBox.ItemsSource = _availableBrowsers;
		BrowserComboBox.SelectedItem = _availableBrowsers.FirstOrDefault(browser => browser.Installed) ?? _availableBrowsers.FirstOrDefault();

		var installedBrowsers = _availableBrowsers.Where(browser => browser.Installed).ToList();

		if (installedBrowsers.Count == 0) {
			AppendLog("[Installer UI] No supported browser was auto-detected. Userscript file will still be installed so you can import it manually in Tampermonkey.");
		}

		_userscriptGuidePath = ResolveUserscriptGuidePath();
		if (!string.IsNullOrWhiteSpace(_userscriptGuidePath)) {
			AppendLog($"[Installer UI] Userscript setup guide detected: {_userscriptGuidePath}");
		}

		RefreshTampermonkeyStatus(logResult: true);

		UpdateQuickActionState();
	}

	private void OnBrowserSelectionChanged(object? sender, SelectionChangedEventArgs e) {
		RefreshTampermonkeyStatus(logResult: true);
	}

	private async void OnInstallClick(object? sender, RoutedEventArgs e) {
		await RunInstallWorkflowAsync(
			installApi: true,
			installDesktop: true,
			installUserscript: true,
			openTampermonkeySetup: OpenTampermonkeySetupCheckBox.IsChecked == true,
			allowUserscriptBypass: false,
			stepLabel: "full install");
	}

	private async void OnInstallApiStepClick(object? sender, RoutedEventArgs e) {
		await RunInstallWorkflowAsync(
			installApi: true,
			installDesktop: false,
			installUserscript: false,
			openTampermonkeySetup: false,
			allowUserscriptBypass: false,
			stepLabel: "API server step");
	}

	private async void OnInstallDesktopStepClick(object? sender, RoutedEventArgs e) {
		await RunInstallWorkflowAsync(
			installApi: false,
			installDesktop: true,
			installUserscript: false,
			openTampermonkeySetup: false,
			allowUserscriptBypass: false,
			stepLabel: "desktop app step");
	}

	private async void OnInstallUserscriptStepClick(object? sender, RoutedEventArgs e) {
		await RunInstallWorkflowAsync(
			installApi: false,
			installDesktop: false,
			installUserscript: true,
			openTampermonkeySetup: OpenTampermonkeySetupCheckBox.IsChecked == true,
			allowUserscriptBypass: false,
			stepLabel: "userscript step");
	}

	private async void OnInstallUserscriptBypassStepClick(object? sender, RoutedEventArgs e) {
		await RunInstallWorkflowAsync(
			installApi: false,
			installDesktop: false,
			installUserscript: true,
			openTampermonkeySetup: OpenTampermonkeySetupCheckBox.IsChecked == true,
			allowUserscriptBypass: true,
			stepLabel: "userscript bypass step");
	}

	private void OnInstallTampermonkeyClick(object? sender, RoutedEventArgs e) {
		if (_isInstalling) {
			return;
		}

		if (BrowserComboBox.SelectedItem is not BrowserOption selectedBrowser) {
			SetStatus("Status: Select a browser first.");
			return;
		}

		var installed = DetectTampermonkeyInstalled(selectedBrowser.Argument);
		if (installed) {
			SetStatus("Status: Tampermonkey already installed.");
			AppendLog($"[Installer UI] Tampermonkey already detected for {selectedBrowser.Label}. Continue with userscript step.");
			OpenUserscriptGuideFromUi();
		} else {
			SetStatus("Status: Opening Tampermonkey store page.");
			AppendLog($"[Installer UI] Tampermonkey not detected for {selectedBrowser.Label}. Opening browser install page.");
			OpenTampermonkeyStore(selectedBrowser.Argument);
			OpenUserscriptGuideFromUi();
		}

		RefreshTampermonkeyStatus(logResult: true);
	}

	private async Task RunInstallWorkflowAsync(bool installApi, bool installDesktop, bool installUserscript, bool openTampermonkeySetup, bool allowUserscriptBypass, string stepLabel) {
		if (_isInstalling) {
			return;
		}

		if (!EnsureElevatedUiContext()) {
			return;
		}

		RefreshTampermonkeyStatus(logResult: false);

		if (installUserscript && !allowUserscriptBypass && !_tampermonkeyInstalledForSelection && OperatingSystem.IsWindows()) {
			SetStatus("Status: Tampermonkey required for userscript step.");
			AppendLog("[Installer UI] Userscript step is locked until Tampermonkey is detected for the selected browser. Use Step 1 or run the bypass step.");
			return;
		}

		if (!ValidatePreflight(installApi, out var installRoot, out var apiUrl, out var preflightMessage)) {
			SetStatus($"Status: {preflightMessage}");
			AppendLog($"[Installer UI] Preflight failed: {preflightMessage}");
			return;
		}

		var installerCliPath = ResolveInstallerCliPath();

		var selectedComponents = new List<string>();
		if (installApi) {
			selectedComponents.Add("API server");
		}
		if (installDesktop) {
			selectedComponents.Add("desktop app");
		}
		if (installUserscript) {
			selectedComponents.Add("userscript");
		}

		AppendLog($"[Installer UI] Running {stepLabel}: {string.Join(", ", selectedComponents)}");

		var browserArg = ResolveSelectedBrowserArgument();
		if (installUserscript && openTampermonkeySetup && string.IsNullOrWhiteSpace(browserArg)) {
			AppendLog("[Installer UI] No browser selected for bootstrap; proceeding without automatic setup page.");
			openTampermonkeySetup = false;
		}

		if (string.IsNullOrWhiteSpace(installerCliPath)) {
			SetStatus("Status: Could not locate managed installer engine.");
			AppendLog("[Installer UI] OrganizedJihad.Installer.Cli is required but was not found.");
			return;
		}

		AppendLog($"[Installer UI] Using managed installer CLI: {installerCliPath}");
		var cliArgs = BuildInstallerCliArguments(
			installRoot,
			apiUrl,
			installApi,
			installDesktop,
			installUserscript,
			openTampermonkeySetup,
			browserArg,
			FirstRunDiagnosticsCheckBox.IsChecked == true,
			OpenDiagnosticsCheckBox.IsChecked == true);
		await RunInstallProcessAsync(installerCliPath, cliArgs);

		if (installUserscript) {
			var userscriptPath = Path.Combine(installRoot, "userscript", "organized-jihad.user.js");
			var guidePath = Path.Combine(installRoot, "userscript", "tampermonkey-setup.html");
			AppendLog("[Installer UI] Userscript next steps:");
			AppendLog($"[Installer UI] - Import this file in Tampermonkey Utilities: {userscriptPath}");
			AppendLog("[Installer UI] - Confirm script is Enabled, then refresh Hero Wars.");
			if (allowUserscriptBypass) {
				AppendLog("[Installer UI] - Bypass mode was used; if Tampermonkey is not installed yet, complete Step 1 now.");
			}
			if (File.Exists(guidePath)) {
				AppendLog($"[Installer UI] - Detailed setup guide: {guidePath}");
			}
		}

		RefreshTampermonkeyStatus(logResult: false);
	}

	private static string BuildInstallerCliArguments(string installRoot, string apiUrl, bool installApi, bool installDesktop, bool installUserscript, bool openTampermonkeySetup, string? browserArg, bool firstRunDiagnostics, bool openUserscriptDiagnostics) {
		var args = new List<string> {
			"--install-root", Quote(installRoot),
			"--api-url", Quote(apiUrl),
		};

		if (!installApi) {
			args.Add("--skip-api-install");
		}

		if (!installDesktop) {
			args.Add("--skip-desktop-app-install");
		}

		if (!installUserscript) {
			args.Add("--skip-userscript-install");
		}

		if (!openTampermonkeySetup || !installUserscript || string.IsNullOrWhiteSpace(browserArg)) {
			args.Add("--skip-tampermonkey-bootstrap");
		} else {
			args.Add("--tampermonkey-browsers");
			args.Add(browserArg);
		}

		if (installApi) {
			args.Add("--run-install-health-check");
		}

		if (firstRunDiagnostics) {
			args.Add("--first-run-diagnostics");
		}

		if (openUserscriptDiagnostics) {
			args.Add("--open-userscript-diagnostics");
		}

		return string.Join(' ', args);
	}

	private string? ResolveSelectedBrowserArgument() {
		return BrowserComboBox.SelectedItem is BrowserOption selectedBrowser ? selectedBrowser.Argument : null;
	}

	private void RefreshTampermonkeyStatus(bool logResult) {
		if (!OperatingSystem.IsWindows()) {
			_tampermonkeyInstalledForSelection = true;
			TampermonkeyStatusTextBlock.Text = "Tampermonkey status: non-Windows mode (step allowed, manual browser verification recommended)";
			if (logResult) {
				AppendLog("[Installer UI] Non-Windows mode: userscript step enabled without Windows extension registry checks.");
			}
			UpdateQuickActionState();
			return;
		}

		var browserArg = ResolveSelectedBrowserArgument();
		var browserLabel = BrowserComboBox.SelectedItem is BrowserOption selectedBrowser ? selectedBrowser.Label : "(none)";

		if (string.IsNullOrWhiteSpace(browserArg)) {
			_tampermonkeyInstalledForSelection = false;
			TampermonkeyStatusTextBlock.Text = "Tampermonkey status: no browser selected";
			UpdateQuickActionState();
			return;
		}

		_tampermonkeyInstalledForSelection = DetectTampermonkeyInstalled(browserArg);
		TampermonkeyStatusTextBlock.Text = _tampermonkeyInstalledForSelection
			? $"Tampermonkey status ({browserLabel}): detected"
			: $"Tampermonkey status ({browserLabel}): not detected";

		if (logResult) {
			AppendLog(_tampermonkeyInstalledForSelection
				? $"[Installer UI] Tampermonkey detected for {browserLabel}."
				: $"[Installer UI] Tampermonkey not detected for {browserLabel}. Use Step 1 to install/verify or Step 4b to bypass.");
		}

		UpdateQuickActionState();
	}

	private static bool DetectTampermonkeyInstalled(string browserArg) {
		if (!OperatingSystem.IsWindows()) {
			return false;
		}

		const string extensionId = "dhdgffkkebhmkfjojejmpbldmpobfkfo";

		return browserArg switch {
			"chrome" => ChromiumExtensionInstalled(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google", "Chrome", "User Data"), extensionId),
			"edge" => ChromiumExtensionInstalled(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "Edge", "User Data"), extensionId),
			"opera" => ChromiumExtensionInstalled(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Opera Software", "Opera Stable"), extensionId),
			"operaGX" => ChromiumExtensionInstalled(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Opera Software", "Opera GX Stable"), extensionId),
			"firefox" => FirefoxTampermonkeyInstalled(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Mozilla", "Firefox", "Profiles")),
			_ => false,
		};
	}

	private static bool ChromiumExtensionInstalled(string browserRoot, string extensionId) {
		if (string.IsNullOrWhiteSpace(browserRoot) || !Directory.Exists(browserRoot)) {
			return false;
		}

		var profileCandidates = new List<string>();
		profileCandidates.Add(browserRoot);

		try {
			profileCandidates.AddRange(Directory.GetDirectories(browserRoot)
				.Where(path => {
					var name = Path.GetFileName(path);
					return string.Equals(name, "Default", StringComparison.OrdinalIgnoreCase)
						|| name.StartsWith("Profile ", StringComparison.OrdinalIgnoreCase)
						|| name.StartsWith("Guest Profile", StringComparison.OrdinalIgnoreCase);
				}));
		} catch {
			// Ignore profile enumeration errors.
		}

		foreach (var profile in profileCandidates.Distinct(StringComparer.OrdinalIgnoreCase)) {
			var extensionPath = Path.Combine(profile, "Extensions", extensionId);
			if (Directory.Exists(extensionPath)) {
				return true;
			}

			var localExtensionPath = Path.Combine(profile, "Local Extension Settings", extensionId);
			if (Directory.Exists(localExtensionPath)) {
				return true;
			}
		}

		return false;
	}

	private static bool FirefoxTampermonkeyInstalled(string profilesRoot) {
		if (string.IsNullOrWhiteSpace(profilesRoot) || !Directory.Exists(profilesRoot)) {
			return false;
		}

		try {
			foreach (var profile in Directory.GetDirectories(profilesRoot)) {
				var extensionsDir = Path.Combine(profile, "extensions");
				if (!Directory.Exists(extensionsDir)) {
					continue;
				}

				var entries = Directory.GetFileSystemEntries(extensionsDir);
				if (entries.Any(path => Path.GetFileName(path).Contains("tampermonkey", StringComparison.OrdinalIgnoreCase))) {
					return true;
				}
			}
		} catch {
			return false;
		}

		return false;
	}

	private static void OpenTampermonkeyStore(string browserArg) {
		var browserLinks = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
			["chrome"] = "https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo",
			["edge"] = "https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd",
			["firefox"] = "https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/",
			["opera"] = "https://addons.opera.com/en/extensions/details/tampermonkey-beta/",
			["operaGX"] = "https://addons.opera.com/en/extensions/details/tampermonkey-beta/",
		};

		if (!browserLinks.TryGetValue(browserArg, out var url)) {
			return;
		}

		OpenUrlInPreferredBrowser(url, browserArg);
	}

	private static List<BrowserOption> DetectBrowsers() {
		if (!OperatingSystem.IsWindows()) {
			return new List<BrowserOption> {
				new("Chrome", "chrome", IsExecutableOnPath("google-chrome") || IsExecutableOnPath("chrome") || IsExecutableOnPath("chromium"), null),
				new("Firefox", "firefox", IsExecutableOnPath("firefox"), null),
				new("Opera", "opera", IsExecutableOnPath("opera"), null),
			};
		}

		var chromePath = ResolveWindowsExecutable(new[] {
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google", "Chrome", "Application", "chrome.exe"),
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google", "Chrome", "Application", "chrome.exe"),
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google", "Chrome", "Application", "chrome.exe")
		}, new[] { "chrome.exe" }, new[] { "chrome.exe" });

		var edgePath = ResolveWindowsExecutable(new[] {
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"),
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe")
		}, new[] { "msedge.exe" }, new[] { "msedge.exe" });

		var firefoxPath = ResolveWindowsExecutable(new[] {
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Mozilla Firefox", "firefox.exe"),
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Mozilla Firefox", "firefox.exe")
		}, new[] { "firefox.exe" }, new[] { "firefox.exe" });

		var operaPath = ResolveWindowsExecutable(new[] {
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Opera", "opera.exe"),
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Opera", "launcher.exe"),
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Opera", "opera.exe"),
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Opera", "launcher.exe"),
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Opera", "opera.exe"),
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Opera", "launcher.exe")
		}, new[] { "opera.exe", "launcher.exe" }, new[] { "opera.exe", "launcher.exe" });

		var operaGxPath = ResolveWindowsExecutable(new[] {
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Opera GX", "opera.exe"),
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Opera GX", "launcher.exe"),
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Opera GX Stable", "opera.exe"),
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Opera GX Stable", "launcher.exe"),
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Opera GX", "opera.exe"),
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Opera GX", "launcher.exe"),
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Opera GX", "opera.exe"),
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Opera GX", "launcher.exe")
		}, new[] { "opera_gx.exe", "opera.exe", "launcher.exe" }, new[] { "opera.exe", "launcher.exe" });

		var options = new List<BrowserOption> {
			new("Chrome", "chrome", !string.IsNullOrWhiteSpace(chromePath), chromePath),
			new("Edge", "edge", !string.IsNullOrWhiteSpace(edgePath), edgePath),
			new("Firefox", "firefox", !string.IsNullOrWhiteSpace(firefoxPath), firefoxPath),
			new("Opera", "opera", !string.IsNullOrWhiteSpace(operaPath), operaPath),
			new("Opera GX", "operaGX", !string.IsNullOrWhiteSpace(operaGxPath), operaGxPath)
		};

		return options;
	}

	private static string? ResolveWindowsExecutable(IEnumerable<string> paths, IEnumerable<string> registryExecutables, IEnumerable<string> pathExecutables) {
		foreach (var path in paths) {
			if (!string.IsNullOrWhiteSpace(path) && File.Exists(path)) {
				return path;
			}
		}

		foreach (var executableName in registryExecutables.Where(value => !string.IsNullOrWhiteSpace(value))) {
			if (TryGetExecutableFromAppPaths(executableName, out _)) {
				if (TryGetExecutableFromAppPaths(executableName, out var registryPath) && File.Exists(registryPath)) {
					return registryPath;
				}
			}
		}

		foreach (var executableName in pathExecutables.Where(value => !string.IsNullOrWhiteSpace(value))) {
			var pathHit = TryResolveExecutableOnPath(executableName);
			if (!string.IsNullOrWhiteSpace(pathHit)) {
				return pathHit;
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

		foreach (var hive in new[] { Registry.CurrentUser, Registry.LocalMachine }) {
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

	private static string? ResolveUserscriptGuidePath() {
		var baseDir = AppContext.BaseDirectory;
		var candidates = new[] {
			Path.Combine(baseDir, "tampermonkey-setup.html"),
			Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "~docs", "installer-guide", "tampermonkey-setup.html")),
			Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "~docs", "installer-guide", "tampermonkey-setup.html")),
		};

		return candidates.FirstOrDefault(File.Exists);
	}

	private async Task RunInstallProcessAsync(string shell, string args) {
		_isInstalling = true;
		UpdateQuickActionState();

		_currentLogFilePath = CreateInstallLogFilePath();
		LogPathTextBlock.Text = $"Log: {_currentLogFilePath}";
		PersistLogLine("[Installer UI] Log initialized.");

		SetStatus("Status: Installing...");
		AppendLog("[Installer UI] Running installer engine in hidden-process mode (GUI-only experience).");

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

	private void OnOpenSetupGuideClick(object? sender, RoutedEventArgs e) {
		OpenUserscriptGuideFromUi();
	}

	private void OpenUserscriptGuideFromUi() {
		var candidates = new List<string>();

		if (!string.IsNullOrWhiteSpace(_userscriptGuidePath)) {
			candidates.Add(_userscriptGuidePath);
		}

		var installRoot = InstallRootTextBox.Text?.Trim();
		if (!string.IsNullOrWhiteSpace(installRoot)) {
			candidates.Add(Path.Combine(installRoot, "userscript", "tampermonkey-setup.html"));
		}

		var guidePath = candidates.FirstOrDefault(path => !string.IsNullOrWhiteSpace(path) && File.Exists(path));
		if (string.IsNullOrWhiteSpace(guidePath)) {
			SetStatus("Status: Setup guide not found yet. Run install first.");
			return;
		}

		OpenPathInPreferredBrowser(guidePath, ResolveSelectedBrowserArgument());
	}

	private static void OpenFolder(string folderPath) {
		if (OperatingSystem.IsWindows()) {
			Process.Start(new ProcessStartInfo {
				FileName = "explorer.exe",
				Arguments = Quote(folderPath),
				UseShellExecute = true,
			});
			return;
		}

		if (OperatingSystem.IsMacOS()) {
			Process.Start(new ProcessStartInfo {
				FileName = "open",
				Arguments = Quote(folderPath),
				UseShellExecute = false,
				CreateNoWindow = true,
			});
			return;
		}

		Process.Start(new ProcessStartInfo {
			FileName = "xdg-open",
			Arguments = Quote(folderPath),
			UseShellExecute = false,
			CreateNoWindow = true,
		});
	}

	private static bool IsExecutableOnPath(string executableName) {
		return !string.IsNullOrWhiteSpace(TryResolveExecutableOnPath(executableName));
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

	private static void OpenUrlInPreferredBrowser(string url, string browserArg) {
		var browserPath = ResolveBrowserExecutablePath(browserArg);
		if (!string.IsNullOrWhiteSpace(browserPath) && File.Exists(browserPath)) {
			Process.Start(new ProcessStartInfo {
				FileName = browserPath,
				Arguments = Quote(url),
				UseShellExecute = false,
				CreateNoWindow = true,
			});
			return;
		}

		Process.Start(new ProcessStartInfo {
			FileName = url,
			UseShellExecute = true,
		});
	}

	private static void OpenPathInPreferredBrowser(string filePath, string? browserArg) {
		if (string.IsNullOrWhiteSpace(browserArg)) {
			Process.Start(new ProcessStartInfo {
				FileName = filePath,
				UseShellExecute = true,
			});
			return;
		}

		var browserPath = ResolveBrowserExecutablePath(browserArg);
		if (!string.IsNullOrWhiteSpace(browserPath) && File.Exists(browserPath)) {
			Process.Start(new ProcessStartInfo {
				FileName = browserPath,
				Arguments = Quote(filePath),
				UseShellExecute = false,
				CreateNoWindow = true,
			});
			return;
		}

		Process.Start(new ProcessStartInfo {
			FileName = filePath,
			UseShellExecute = true,
		});
	}

	private static string? ResolveBrowserExecutablePath(string browserArg) {
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

	private static string? ResolveInstallerCliPath() {
		var baseDir = AppContext.BaseDirectory;
		var cliName = OperatingSystem.IsWindows() ? "OrganizedJihad.Installer.Cli.exe" : "OrganizedJihad.Installer.Cli";
		var candidates = new[] {
			Path.Combine(baseDir, cliName),
			Path.Combine(baseDir, "installer-cli", cliName),
			Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "installer-core", "OrganizedJihad.Installer.Cli", "bin", "Debug", "net10.0", cliName)),
			Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "installer-core", "OrganizedJihad.Installer.Cli", "bin", "Debug", "net10.0", cliName)),
		};

		return candidates.FirstOrDefault(File.Exists);
	}

	private void UpdateQuickActionState() {
		InstallButton.IsEnabled = !_isInstalling;
		InstallTampermonkeyButton.IsEnabled = !_isInstalling;
		InstallApiStepButton.IsEnabled = !_isInstalling;
		InstallDesktopStepButton.IsEnabled = !_isInstalling;
		InstallUserscriptBypassButton.IsEnabled = !_isInstalling;
		InstallUserscriptStepButton.IsEnabled = !_isInstalling && _tampermonkeyInstalledForSelection;
		OpenInstallRootButton.IsEnabled = !_isInstalling;
		OpenSetupGuideButton.IsEnabled = !_isInstalling;
		OpenLogFolderButton.IsEnabled = !_isInstalling;
		BrowserComboBox.IsEnabled = !_isInstalling;
		ApiUrlTextBox.IsEnabled = !_isInstalling;
		InstallRootTextBox.IsEnabled = !_isInstalling;
		OpenTampermonkeySetupCheckBox.IsEnabled = !_isInstalling;
		FirstRunDiagnosticsCheckBox.IsEnabled = !_isInstalling;
		OpenDiagnosticsCheckBox.IsEnabled = !_isInstalling;
	}
}
