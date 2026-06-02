using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia;
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
using System.Reflection;

namespace OrganizedJihad.Installer;

public partial class MainWindow : Window {
	private const string DebugPrefix = "[DEBUG]";
	private static readonly IBrush StepDefaultBackground = Brush.Parse("#4a2c1a");
	private static readonly IBrush StepDefaultForeground = Brush.Parse("#FFF1DA");
	private static readonly IBrush StepDefaultBorder = Brush.Parse("#df8320");
	private static readonly IBrush StepHoverBackground = Brush.Parse("#a56535");
	private static readonly IBrush StepHoverForeground = Brush.Parse("#FFFFFF");
	private static readonly IBrush StepHoverBorder = Brush.Parse("#fff0c9");
	private static readonly IBrush StepPressedBackground = Brush.Parse("#93562c");
	private static readonly IBrush StepPressedForeground = Brush.Parse("#FFFFFF");
	private static readonly IBrush StepPressedBorder = Brush.Parse("#ffe4b0");
	private static readonly IBrush StepDisabledBackground = Brush.Parse("#33241a");
	private static readonly IBrush StepDisabledForeground = Brush.Parse("#CBB8A2");
	private static readonly IBrush StepDisabledBorder = Brush.Parse("#9f6f44");

	private static readonly IBrush ToggleOnBackground = Brush.Parse("#1f5a2a");
	private static readonly IBrush ToggleOnForeground = Brush.Parse("#E7FFE8");
	private static readonly IBrush ToggleOnBorder = Brush.Parse("#45e06b");
	private static readonly IBrush ToggleOnHoverBackground = Brush.Parse("#2b7a3a");
	private static readonly IBrush ToggleOnHoverBorder = Brush.Parse("#96f3af");
	private static readonly IBrush ToggleOffBackground = Brush.Parse("#4a1f1f");
	private static readonly IBrush ToggleOffForeground = Brush.Parse("#FFE3E3");
	private static readonly IBrush ToggleOffBorder = Brush.Parse("#d84545");
	private static readonly IBrush ToggleOffHoverBackground = Brush.Parse("#703131");
	private static readonly IBrush ToggleOffHoverBorder = Brush.Parse("#ff7f7f");
	private static readonly IBrush ToggleDisabledBackground = Brush.Parse("#33241a");
	private static readonly IBrush ToggleDisabledForeground = Brush.Parse("#CBB8A2");
	private static readonly IBrush ToggleDisabledBorder = Brush.Parse("#9f6f44");
	private static readonly IBrush ToggleCheckedIconBrush = Brush.Parse("#45e06b");
	private static readonly IBrush ToggleUncheckedIconBrush = Brush.Parse("#FFE3E3");

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
	private readonly string _buildMarker;
	private readonly HashSet<Control> _hoveredControls = new();
	private readonly HashSet<Control> _pressedControls = new();

	public MainWindow() {
		InitializeComponent();

		var assemblyVersion = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "unknown";
		var fileVersion = FileVersionInfo.GetVersionInfo(Environment.ProcessPath ?? string.Empty).FileVersion ?? "unknown";
		_buildMarker = $"{assemblyVersion}|{fileVersion}|{AppContext.BaseDirectory}";

		InstallRootTextBox.Text = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OrganizedJihad");
		ApiUrlTextBox.Text = "http://localhost:5124";

		_availableBrowsers = DetectBrowsers();
		BrowserComboBox.ItemsSource = _availableBrowsers;
		BrowserComboBox.SelectedItem = _availableBrowsers.FirstOrDefault(browser => browser.Installed) ?? _availableBrowsers.FirstOrDefault();
		AppendDebugLog($"{DebugPrefix} Browser options count={_availableBrowsers.Count}");
		foreach (var browser in _availableBrowsers) {
			AppendDebugLog($"{DebugPrefix} Browser option: {browser.Label} arg={browser.Argument} installed={browser.Installed} exe={browser.ExecutablePath ?? "(none)"}");
		}

		var installedBrowsers = _availableBrowsers.Where(browser => browser.Installed).ToList();

		if (installedBrowsers.Count == 0) {
			AppendLog("[Installer UI] No supported browser was auto-detected. Userscript file will still be installed so you can import it manually in Tampermonkey.");
		}

		_userscriptGuidePath = ResolveUserscriptGuidePath();
		if (!string.IsNullOrWhiteSpace(_userscriptGuidePath)) {
			AppendLog($"[Installer UI] Userscript setup guide detected: {_userscriptGuidePath}");
		}

		UpdateOptionToggleLabels();
		InitializeInteractiveButtonVisuals();
		ResetLogViewToTopLeft();

		RefreshTampermonkeyStatus(logResult: true);

		UpdateQuickActionState();
	}

	private void OnBrowserSelectionChanged(object? sender, SelectionChangedEventArgs e) {
		RefreshTampermonkeyStatus(logResult: true);
	}

	private void OnOptionToggleChanged(object? sender, RoutedEventArgs e) {
		UpdateOptionToggleLabels();
	}

	private async void OnInstallClick(object? sender, RoutedEventArgs e) {
		await RunInstallWorkflowAsync(
			installApi: true,
			installUserscript: true,
			openTampermonkeySetup: OpenTampermonkeySetupCheckBox.IsChecked == true,
			stepLabel: "full install");
	}

	private async void OnInstallApiStepClick(object? sender, RoutedEventArgs e) {
		await RunInstallWorkflowAsync(
			installApi: true,
			installUserscript: false,
			openTampermonkeySetup: false,
			stepLabel: "API server step");
	}

	private async void OnInstallUserscriptStepClick(object? sender, RoutedEventArgs e) {
		await RunInstallWorkflowAsync(
			installApi: false,
			installUserscript: true,
			openTampermonkeySetup: OpenTampermonkeySetupCheckBox.IsChecked == true,
			stepLabel: "userscript step");
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

	private void OnReinstallTampermonkeyClick(object? sender, RoutedEventArgs e) {
		if (_isInstalling) {
			return;
		}

		if (BrowserComboBox.SelectedItem is not BrowserOption selectedBrowser) {
			SetStatus("Status: Select a browser first.");
			return;
		}

		SetStatus("Status: Opening Tampermonkey reinstall page.");
		AppendLog($"[Installer UI] Reinstall requested for {selectedBrowser.Label}. Opening Tampermonkey store page.");
		OpenTampermonkeyStore(selectedBrowser.Argument);
	}

	private async Task RunInstallWorkflowAsync(bool installApi, bool installUserscript, bool openTampermonkeySetup, string stepLabel) {
		if (_isInstalling) {
			return;
		}

		var elevationRequired = installApi;
		if (!EnsureElevatedUiContext(elevationRequired)) {
			return;
		}

		RefreshTampermonkeyStatus(logResult: false);

		if (installUserscript && !_tampermonkeyInstalledForSelection && OperatingSystem.IsWindows()) {
			SetStatus("Status: Tampermonkey not detected. Continuing with guided userscript flow.");
			AppendLog("[Installer UI] Tampermonkey was not auto-detected for the selected browser. Continuing userscript step anyway; browser may prompt to install/enable Tampermonkey.");
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
			foreach (var candidate in GetInstallerCliCandidates()) {
				AppendLog($"[Installer UI] Installer CLI candidate: {candidate} (exists={File.Exists(candidate)})");
			}
			return;
		}

		AppendLog($"[Installer UI] Installer UI base directory: {AppContext.BaseDirectory}");
		AppendLog($"[Installer UI] Using managed installer CLI: {installerCliPath}");
		var runInstallHealthCheck = installApi && (installUserscript || FirstRunDiagnosticsCheckBox.IsChecked == true || OpenDiagnosticsCheckBox.IsChecked == true);
		var maxRuntime = installApi && !installUserscript
			? TimeSpan.FromSeconds(90)
			: TimeSpan.FromMinutes(4);
		var cliArgs = BuildInstallerCliArguments(
			installRoot,
			apiUrl,
			installApi,
			installUserscript,
			openTampermonkeySetup,
			browserArg,
			runInstallHealthCheck,
			FirstRunDiagnosticsCheckBox.IsChecked == true,
			OpenDiagnosticsCheckBox.IsChecked == true);
		var installSucceeded = await RunInstallProcessAsync(installerCliPath, cliArgs, maxRuntime);

		if (installApi && installSucceeded && runInstallHealthCheck) {
			await ProbeApiUiEndpointsAsync(apiUrl);
		}

		if (installUserscript && installSucceeded) {
			var userscriptPath = Path.Combine(installRoot, "userscript", "organized-jihad.user.js");
			var guidePath = Path.Combine(installRoot, "userscript", "tampermonkey-setup.html");
			AppendLog("[Installer UI] Userscript next steps:");
			AppendLog($"[Installer UI] - Import this file in Tampermonkey Utilities: {userscriptPath}");
			AppendLog("[Installer UI] - Confirm script is Enabled, then refresh Hero Wars.");
			if (openTampermonkeySetup) {
				OpenTampermonkeyImportFlow(userscriptPath, apiUrl, browserArg);
			}
		}

		RefreshTampermonkeyStatus(logResult: false);
	}

	private static string BuildInstallerCliArguments(string installRoot, string apiUrl, bool installApi, bool installUserscript, bool openTampermonkeySetup, string? browserArg, bool runInstallHealthCheck, bool firstRunDiagnostics, bool openUserscriptDiagnostics) {
		var args = new List<string> {
			"--install-root", Quote(installRoot),
			"--api-url", Quote(apiUrl),
		};

		if (!installApi) {
			args.Add("--skip-api-install");
		}

		if (!installUserscript) {
			args.Add("--skip-userscript-install");
		}

		// UI controls userscript tab opening to avoid duplicate browser tabs from both CLI and UI bootstrap paths.
		args.Add("--skip-tampermonkey-bootstrap");

		if (runInstallHealthCheck) {
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
				: $"[Installer UI] Tampermonkey not detected for {browserLabel}. Use Step 1 to install/verify, then continue with Step 3.");
		}

		UpdateQuickActionState();
	}

	private static bool DetectTampermonkeyInstalled(string browserArg) {
		if (!OperatingSystem.IsWindows()) {
			return false;
		}

		var tampermonkeyExtensionIds = new[] {
			"dhdgffkkebhmkfjojejmpbldmpobfkfo", // Chrome Web Store
			"iikmkjmpaadaobahmlepeloendndfphd", // Edge Add-ons
		};

		if (PolicyForcesTampermonkeyInstall(browserArg, tampermonkeyExtensionIds)) {
			return true;
		}

		return browserArg switch {
			"chrome" => ChromiumTampermonkeyInstalled(new[] {
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google", "Chrome", "User Data"),
			}, tampermonkeyExtensionIds, new[] {
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google", "Chrome", "Application", "Extensions"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google", "Chrome", "Application", "Extensions"),
			}),
			"edge" => ChromiumTampermonkeyInstalled(new[] {
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "Edge", "User Data"),
			}, tampermonkeyExtensionIds, new[] {
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "Extensions"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "Extensions"),
			}),
			"opera" => ChromiumTampermonkeyInstalled(new[] {
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Opera Software", "Opera Stable"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Opera Software", "Opera Stable"),
			}, tampermonkeyExtensionIds, Array.Empty<string>()),
			"operaGX" => ChromiumTampermonkeyInstalled(new[] {
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Opera Software", "Opera GX Stable"),
				Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Opera Software", "Opera GX Stable"),
			}, tampermonkeyExtensionIds, Array.Empty<string>()),
			"firefox" => FirefoxTampermonkeyInstalled(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Mozilla", "Firefox", "Profiles")),
			_ => false,
		};
	}

	private static bool ChromiumTampermonkeyInstalled(IEnumerable<string> browserRoots, IEnumerable<string> extensionIds, IEnumerable<string> globalExtensionDirs) {
		var idSet = new HashSet<string>(extensionIds.Where(id => !string.IsNullOrWhiteSpace(id)), StringComparer.OrdinalIgnoreCase);

		foreach (var globalDir in globalExtensionDirs.Where(path => !string.IsNullOrWhiteSpace(path)).Distinct(StringComparer.OrdinalIgnoreCase)) {
			if (!Directory.Exists(globalDir)) {
				continue;
			}

			foreach (var extensionId in idSet) {
				if (Directory.Exists(Path.Combine(globalDir, extensionId))) {
					return true;
				}
			}
		}

		foreach (var browserRoot in browserRoots.Where(path => !string.IsNullOrWhiteSpace(path)).Distinct(StringComparer.OrdinalIgnoreCase)) {
			if (!Directory.Exists(browserRoot)) {
				continue;
			}

			if (ChromiumTampermonkeyInstalledInRoot(browserRoot, idSet)) {
				return true;
			}
		}

		return false;
	}

	private static bool ChromiumTampermonkeyInstalledInRoot(string browserRoot, ISet<string> extensionIds) {
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
			if (ContainsTampermonkeyPreferences(profile, extensionIds)) {
				return true;
			}

			foreach (var extensionId in extensionIds) {
				var extensionPath = Path.Combine(profile, "Extensions", extensionId);
				if (Directory.Exists(extensionPath)) {
					return true;
				}

				var localExtensionPath = Path.Combine(profile, "Local Extension Settings", extensionId);
				if (Directory.Exists(localExtensionPath)) {
					return true;
				}
			}

			if (ContainsTampermonkeyManifest(profile)) {
				return true;
			}
		}

		return false;
	}

	private static bool ContainsTampermonkeyPreferences(string profilePath, ISet<string> extensionIds) {
		var preferenceFiles = new[] {
			Path.Combine(profilePath, "Preferences"),
			Path.Combine(profilePath, "Secure Preferences"),
		};

		foreach (var preferenceFile in preferenceFiles) {
			if (!File.Exists(preferenceFile)) {
				continue;
			}

			try {
				var content = File.ReadAllText(preferenceFile);
				foreach (var extensionId in extensionIds) {
					if (content.Contains(extensionId, StringComparison.OrdinalIgnoreCase)) {
						return true;
					}
				}

				if (content.Contains("tampermonkey", StringComparison.OrdinalIgnoreCase)) {
					return true;
				}
			} catch {
				// Ignore preference parsing errors.
			}
		}

		return false;
	}

	private static bool PolicyForcesTampermonkeyInstall(string browserArg, IEnumerable<string> extensionIds) {
		if (!OperatingSystem.IsWindows()) {
			return false;
		}

		var policyKey = browserArg switch {
			"chrome" => "Software\\Policies\\Google\\Chrome\\ExtensionInstallForcelist",
			"edge" => "Software\\Policies\\Microsoft\\Edge\\ExtensionInstallForcelist",
			_ => null,
		};

		if (string.IsNullOrWhiteSpace(policyKey)) {
			return false;
		}

		var idSet = new HashSet<string>(extensionIds.Where(id => !string.IsNullOrWhiteSpace(id)), StringComparer.OrdinalIgnoreCase);
		foreach (var hive in new[] { Registry.CurrentUser, Registry.LocalMachine }) {
			using var key = hive.OpenSubKey(policyKey);
			if (key is null) {
				continue;
			}

			foreach (var valueName in key.GetValueNames()) {
				if (key.GetValue(valueName) is not string value || string.IsNullOrWhiteSpace(value)) {
					continue;
				}

				if (idSet.Any(id => value.Contains(id, StringComparison.OrdinalIgnoreCase))) {
					return true;
				}
			}
		}

		return false;
	}

	private static bool ContainsTampermonkeyManifest(string profilePath) {
		try {
			var extensionsDir = Path.Combine(profilePath, "Extensions");
			if (!Directory.Exists(extensionsDir)) {
				return false;
			}

			foreach (var extensionFolder in Directory.GetDirectories(extensionsDir)) {
				foreach (var versionFolder in Directory.GetDirectories(extensionFolder)) {
					var manifestPath = Path.Combine(versionFolder, "manifest.json");
					if (!File.Exists(manifestPath)) {
						continue;
					}

					var manifest = File.ReadAllText(manifestPath);
					if (manifest.Contains("tampermonkey", StringComparison.OrdinalIgnoreCase)) {
						return true;
					}
				}
			}
		} catch {
			// Ignore extension manifest parsing errors.
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

	private void OpenTampermonkeyImportFlow(string userscriptPath, string apiUrl, string? browserArg) {
		try {
			if (!string.IsNullOrWhiteSpace(userscriptPath) && File.Exists(userscriptPath)) {
				AppendLog($"[Installer UI] Userscript staged at: {userscriptPath}");
			}

			var apiUserscriptUrl = apiUrl.TrimEnd('/') + "/ui/organized-jihad.user.js";
			if (CanReachUrl(apiUserscriptUrl)) {
				AppendLog($"[Installer UI] Opening userscript install source: {apiUserscriptUrl}");
				AppendLog("[Installer UI] Opening a single userscript install tab.");
				AppendLog("[Installer UI] Tampermonkey should show an install confirmation in the opened tab.");
				AppendLog("[Installer UI] If prompted by browser policy, grant Tampermonkey script execution permission first.");
				if (!string.IsNullOrWhiteSpace(browserArg)) {
					OpenUrlInPreferredBrowser(apiUserscriptUrl, browserArg);
				} else {
					OpenUrlInPreferredBrowser(apiUserscriptUrl, "edge");
				}
				return;
			}

			if (!string.IsNullOrWhiteSpace(userscriptPath) && File.Exists(userscriptPath)) {
				var userscriptUri = new Uri(userscriptPath).AbsoluteUri;
				AppendLog($"[Installer UI] Opening userscript file URI: {userscriptUri}");
				if (!string.IsNullOrWhiteSpace(browserArg)) {
					OpenUrlInPreferredBrowser(userscriptUri, browserArg);
				} else {
					Process.Start(new ProcessStartInfo {
						FileName = userscriptUri,
						UseShellExecute = true,
					});
				}
				return;
			}

			AppendLog("[Installer UI] Could not open userscript install source automatically. Use Step 1 utilities import and select organized-jihad.user.js from install folder.");
		} catch (Exception ex) {
			AppendLog($"[Installer UI] Failed to open Tampermonkey import flow: {ex.Message}");
		}
	}

	private static bool CanReachUrl(string url) {
		try {
			using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
			using var response = client.GetAsync(url).GetAwaiter().GetResult();
			return response.IsSuccessStatusCode;
		} catch {
			return false;
		}
	}

	private static string? GetTampermonkeyUtilitiesUrl(string? browserArg) {
		if (string.IsNullOrWhiteSpace(browserArg)) {
			return null;
		}

		return browserArg switch {
			"chrome" => "chrome-extension://dhdgffkkebhmkfjojejmpbldmpobfkfo/options.html#nav=utils",
			"edge" => "chrome-extension://iikmkjmpaadaobahmlepeloendndfphd/options.html#nav=utils",
			"opera" => "chrome-extension://dhdgffkkebhmkfjojejmpbldmpobfkfo/options.html#nav=utils",
			"operaGX" => "chrome-extension://dhdgffkkebhmkfjojejmpbldmpobfkfo/options.html#nav=utils",
			"firefox" => "about:addons",
			_ => null,
		};
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

	private async Task<bool> RunInstallProcessAsync(string shell, string args, TimeSpan maxRuntime) {
		_isInstalling = true;
		UpdateQuickActionState();

		_currentLogFilePath = CreateInstallLogFilePath();
		LogPathTextBlock.Text = $"Log: {_currentLogFilePath}";
		PersistLogLine("[Installer UI] Log initialized.");
		AppendDebugLog($"{DebugPrefix} Installer build marker={_buildMarker}");
		AppendDebugLog($"{DebugPrefix} Shell={shell}");
		AppendDebugLog($"{DebugPrefix} Args={args}");

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
			var completionMarkerSeen = false;
			DateTime? completionMarkerAtUtc = null;

			process.OutputDataReceived += (_, eventArgs) => {
				if (!string.IsNullOrWhiteSpace(eventArgs.Data)) {
					if (eventArgs.Data.Contains("[OJ Installer.Cli] Installation complete.", StringComparison.Ordinal)) {
						completionMarkerSeen = true;
						completionMarkerAtUtc = DateTime.UtcNow;
					}

					if (eventArgs.Data.StartsWith(DebugPrefix, StringComparison.Ordinal)) {
						AppendDebugLog(eventArgs.Data);
					} else {
						AppendLog(eventArgs.Data);
					}
				}
			};
			process.ErrorDataReceived += (_, eventArgs) => {
				if (!string.IsNullOrWhiteSpace(eventArgs.Data)) {
					if (eventArgs.Data.StartsWith(DebugPrefix, StringComparison.Ordinal)) {
						AppendDebugLog(eventArgs.Data);
					} else {
						AppendLog($"[stderr] {eventArgs.Data}");
					}
				}
			};

			if (!process.Start()) {
				AppendLog("[Installer UI] Failed to start installer process.");
				SetStatus("Status: Failed to start installer.");
				return false;
			}

			process.BeginOutputReadLine();
			process.BeginErrorReadLine();

			var timeoutAtUtc = DateTime.UtcNow.Add(maxRuntime);
			while (!process.HasExited) {
				if (completionMarkerSeen && completionMarkerAtUtc.HasValue && DateTime.UtcNow >= completionMarkerAtUtc.Value.AddSeconds(3)) {
					try {
						process.Kill(true);
					} catch {
						// Best effort only.
					}

					SetStatus("Status: Install complete.");
					AppendLog("[Installer UI] CLI reported completion; forcing process finalization and restoring controls.");
					return true;
				}

				if (DateTime.UtcNow >= timeoutAtUtc) {
					try {
						process.Kill(true);
					} catch {
						// Best effort only.
					}
					SetStatus("Status: Installer timed out.");
					AppendLog($"[Installer UI] Installer timed out after {Math.Ceiling(maxRuntime.TotalSeconds)} seconds and was stopped to restore UI control.");
					return false;
				}

				await Task.Delay(150);
			}

			if (process.ExitCode == 0) {
				SetStatus("Status: Install complete.");
				AppendLog("[Installer UI] Installation succeeded.");
				return true;
			} else {
				SetStatus($"Status: Installer failed (exit {process.ExitCode}).");
				AppendLog($"[Installer UI] Installation failed with exit code {process.ExitCode}.");
				return false;
			}
		} catch (Exception ex) {
			SetStatus("Status: Installer crashed.");
			AppendLog($"[Installer UI] Exception: {ex.Message}");
			return false;
		} finally {
			_isInstalling = false;
			UpdateQuickActionState();
		}
	}

	private bool EnsureElevatedUiContext(bool elevationRequired) {
		if (!elevationRequired) {
			AppendLog("[Installer UI] Userscript-only step does not require elevation; continuing in current session.");
			return true;
		}

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
		});
	}

	private void ResetLogViewToTopLeft() {
		Dispatcher.UIThread.Post(() => {
			LogTextBox.CaretIndex = 0;
			LogTextBox.SelectionStart = 0;
			LogTextBox.SelectionEnd = 0;
		});
	}

	private void SetStatus(string value) {
		Dispatcher.UIThread.Post(() => {
			StatusTextBlock.Text = value;
		});
	}

	private void UpdateOptionToggleLabels() {
		SetOptionToggleContent(
			OpenTampermonkeySetupCheckBox,
			"Tampermonkey import flow");
		SetOptionToggleContent(
			FirstRunDiagnosticsCheckBox,
			"First-run diagnostics");
		SetOptionToggleContent(
			OpenDiagnosticsCheckBox,
			"Open diagnostics pages");

		ApplyToggleButtonVisual(OpenTampermonkeySetupCheckBox);
		ApplyToggleButtonVisual(FirstRunDiagnosticsCheckBox);
		ApplyToggleButtonVisual(OpenDiagnosticsCheckBox);
	}

	private static void SetOptionToggleContent(ToggleButton? button, string label) {
		if (button is null) {
			return;
		}

		var isChecked = button.IsChecked == true;
		var iconText = isChecked ? "\u2714" : "\u25CB";
		var iconBrush = isChecked ? ToggleCheckedIconBrush : ToggleUncheckedIconBrush;

		var contentGrid = new Grid {
			ColumnDefinitions = new ColumnDefinitions("20,*"),
			VerticalAlignment = VerticalAlignment.Center,
		};

		var iconBlock = new TextBlock {
			Text = iconText,
			Foreground = iconBrush,
			FontFamily = FontFamily.Parse("Segoe UI Symbol"),
			FontSize = 14,
			LineHeight = 16,
			TextAlignment = TextAlignment.Center,
			HorizontalAlignment = HorizontalAlignment.Stretch,
			VerticalAlignment = VerticalAlignment.Center,
		};

		var labelBlock = new TextBlock {
			Text = label,
			VerticalAlignment = VerticalAlignment.Center,
		};

		Grid.SetColumn(iconBlock, 0);
		Grid.SetColumn(labelBlock, 1);
		contentGrid.Children.Add(iconBlock);
		contentGrid.Children.Add(labelBlock);

		button.Content = contentGrid;
	}

	private void InitializeInteractiveButtonVisuals() {
		var stepButtons = new[] {
			InstallTampermonkeyButton,
			InstallApiStepButton,
			InstallUserscriptStepButton,
			InstallButton,
			OpenInstallRootButton,
			OpenSetupGuideButton,
			OpenLogFolderButton,
		};

		foreach (var button in stepButtons) {
			AttachInteractiveVisualHandlers(button, isToggle: false);
			ApplyStepButtonVisual(button);
		}

		var toggleButtons = new[] {
			OpenTampermonkeySetupCheckBox,
			FirstRunDiagnosticsCheckBox,
			OpenDiagnosticsCheckBox,
		};

		foreach (var toggle in toggleButtons) {
			AttachInteractiveVisualHandlers(toggle, isToggle: true);
			ApplyToggleButtonVisual(toggle);
		}
	}

	private void AttachInteractiveVisualHandlers(Control control, bool isToggle) {
		control.PointerEntered += (_, _) => {
			_hoveredControls.Add(control);
			if (isToggle) {
				ApplyToggleButtonVisual(control as ToggleButton);
			} else {
				ApplyStepButtonVisual(control as Button);
			}
		};

		control.PointerExited += (_, _) => {
			_hoveredControls.Remove(control);
			_pressedControls.Remove(control);
			if (isToggle) {
				ApplyToggleButtonVisual(control as ToggleButton);
			} else {
				ApplyStepButtonVisual(control as Button);
			}
		};

		control.PointerPressed += (_, _) => {
			_pressedControls.Add(control);
			if (isToggle) {
				ApplyToggleButtonVisual(control as ToggleButton);
			} else {
				ApplyStepButtonVisual(control as Button);
			}
		};

		control.PointerReleased += (_, _) => {
			_pressedControls.Remove(control);
			if (isToggle) {
				ApplyToggleButtonVisual(control as ToggleButton);
			} else {
				ApplyStepButtonVisual(control as Button);
			}
		};
	}

	private void ApplyStepButtonVisual(Button? button) {
		if (button is null) {
			return;
		}

		if (!button.IsEnabled) {
			button.Background = StepDisabledBackground;
			button.Foreground = StepDisabledForeground;
			button.BorderBrush = StepDisabledBorder;
			button.BorderThickness = new Thickness(2);
			return;
		}

		if (_pressedControls.Contains(button)) {
			button.Background = StepPressedBackground;
			button.Foreground = StepPressedForeground;
			button.BorderBrush = StepPressedBorder;
			button.BorderThickness = new Thickness(2);
			return;
		}

		if (_hoveredControls.Contains(button)) {
			button.Background = StepHoverBackground;
			button.Foreground = StepHoverForeground;
			button.BorderBrush = StepHoverBorder;
			button.BorderThickness = new Thickness(2);
			return;
		}

		button.Background = StepDefaultBackground;
		button.Foreground = StepDefaultForeground;
		button.BorderBrush = StepDefaultBorder;
		button.BorderThickness = new Thickness(2);
	}

	private void ApplyToggleButtonVisual(ToggleButton? button) {
		if (button is null) {
			return;
		}

		if (!button.IsEnabled) {
			button.Background = ToggleDisabledBackground;
			button.Foreground = ToggleDisabledForeground;
			button.BorderBrush = ToggleDisabledBorder;
			button.BorderThickness = new Thickness(2);
			return;
		}

		var isChecked = button.IsChecked == true;
		var isHovered = _hoveredControls.Contains(button);

		if (isChecked) {
			button.Background = isHovered ? ToggleOnHoverBackground : ToggleOnBackground;
			button.Foreground = ToggleOnForeground;
			button.BorderBrush = isHovered ? ToggleOnHoverBorder : ToggleOnBorder;
			button.BorderThickness = new Thickness(2);
			return;
		}

		button.Background = isHovered ? ToggleOffHoverBackground : ToggleOffBackground;
		button.Foreground = ToggleOffForeground;
		button.BorderBrush = isHovered ? ToggleOffHoverBorder : ToggleOffBorder;
		button.BorderThickness = new Thickness(2);
	}

	private async Task ProbeApiUiEndpointsAsync(string apiUrl) {
		var endpoints = new[] {
			"/ui/repair-status",
			"/ui/userscript-handshake",
			"/ui/tray-health",
		};

		using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
		foreach (var endpoint in endpoints) {
			var url = apiUrl.TrimEnd('/') + endpoint;
			try {
				using var response = await client.GetAsync(url);
				if (response.IsSuccessStatusCode) {
					AppendLog($"[Installer UI] API UI endpoint OK: {url} ({(int)response.StatusCode})");
				} else {
					AppendLog($"[Installer UI] API UI endpoint returned non-success: {url} ({(int)response.StatusCode})");
				}
			} catch (Exception ex) {
				AppendLog($"[Installer UI] API UI endpoint probe failed: {url}");
				AppendDebugLog($"{DebugPrefix} API UI endpoint probe exception for {url}: {ex}");
			}
		}
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

	private void AppendDebugLog(string line) {
		PersistLogLine(line);
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
		return GetInstallerCliCandidates().FirstOrDefault(File.Exists);
	}

	private static string[] GetInstallerCliCandidates() {
		var baseDir = AppContext.BaseDirectory;
		var cliName = OperatingSystem.IsWindows() ? "OrganizedJihad.Installer.Cli.exe" : "OrganizedJihad.Installer.Cli";
		return new[] {
			Path.Combine(baseDir, cliName),
			Path.Combine(baseDir, "bundled", "installer-cli", cliName),
			Path.Combine(baseDir, "installer-cli", cliName),
			Path.GetFullPath(Path.Combine(baseDir, "..", "bundle-payload", "installer-cli", cliName)),
			Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "installer-core", "OrganizedJihad.Installer.Cli", "bin", "Release", "net10.0", cliName)),
			Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "installer-core", "OrganizedJihad.Installer.Cli", "bin", "Release", "net10.0", cliName)),
			Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "installer-core", "OrganizedJihad.Installer.Cli", "bin", "Debug", "net10.0", cliName)),
			Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "installer-core", "OrganizedJihad.Installer.Cli", "bin", "Debug", "net10.0", cliName)),
		};
	}

	private void UpdateQuickActionState() {
		InstallButton.IsEnabled = !_isInstalling;
		InstallTampermonkeyButton.IsEnabled = !_isInstalling && !_tampermonkeyInstalledForSelection;
		InstallApiStepButton.IsEnabled = !_isInstalling;
		InstallUserscriptStepButton.IsEnabled = !_isInstalling;
		OpenInstallRootButton.IsEnabled = !_isInstalling;
		OpenSetupGuideButton.IsEnabled = !_isInstalling;
		OpenLogFolderButton.IsEnabled = !_isInstalling;
		BrowserComboBox.IsEnabled = !_isInstalling;
		ApiUrlTextBox.IsEnabled = !_isInstalling;
		InstallRootTextBox.IsEnabled = !_isInstalling;
		OpenTampermonkeySetupCheckBox.IsEnabled = !_isInstalling;
		FirstRunDiagnosticsCheckBox.IsEnabled = !_isInstalling;
		OpenDiagnosticsCheckBox.IsEnabled = !_isInstalling;

		ApplyStepButtonVisual(InstallTampermonkeyButton);
		ApplyStepButtonVisual(InstallApiStepButton);
		ApplyStepButtonVisual(InstallUserscriptStepButton);
		ApplyStepButtonVisual(InstallButton);
		ApplyStepButtonVisual(OpenInstallRootButton);
		ApplyStepButtonVisual(OpenSetupGuideButton);
		ApplyStepButtonVisual(OpenLogFolderButton);
		ApplyToggleButtonVisual(OpenTampermonkeySetupCheckBox);
		ApplyToggleButtonVisual(FirstRunDiagnosticsCheckBox);
		ApplyToggleButtonVisual(OpenDiagnosticsCheckBox);

		if (ReinstallTampermonkeyMenuItem is not null) {
			ReinstallTampermonkeyMenuItem.IsVisible = !_isInstalling && _tampermonkeyInstalledForSelection;
			ReinstallTampermonkeyMenuItem.IsEnabled = !_isInstalling && _tampermonkeyInstalledForSelection;
		}
	}
}
