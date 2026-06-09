#if !WINDOWS
using System.Diagnostics;
using System.Net.Http;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.ApplicationLifetimes;

namespace OrganizedJihad.Api.TrayHost;

internal sealed class TrayHostNonWindowsApp : Application {
	private readonly TrayHostOptions _options;
	private readonly HttpClient _httpClient;
	private readonly string _settingsPath;
	private readonly string _logPath;
	private readonly CancellationTokenSource _loopCts;
	private TrayIcon? _trayIcon;
	private Process? _apiProcess;
	private bool _apiManagedByTray;
	private DateTime _lastSettingsWriteUtc = DateTime.MinValue;

	public TrayHostNonWindowsApp(TrayHostOptions options) {
		_options = options;
		_settingsPath = Path.Combine(_options.WorkingDirectory, "api-ui-settings.json");
		_logPath = Path.Combine(_options.WorkingDirectory, "runtime-host.log");
		_loopCts = new CancellationTokenSource();
		_httpClient = new HttpClient {
			Timeout = TimeSpan.FromSeconds(2),
		};
	}

	public override void OnFrameworkInitializationCompleted() {
		BuildTrayIcon();
		_ = RunSupervisorLoopAsync(_loopCts.Token);
		base.OnFrameworkInitializationCompleted();
	}

	private void BuildTrayIcon() {
		var menu = new NativeMenu();
		menu.Add(BuildMenuItem("Open API UI", (_, _) => OpenUrl(TrayMenuLinkBuilder.BuildUiUrl(_options.ApiUrl))));
		menu.Add(BuildMenuItem("Open API Documentation", (_, _) => OpenUrl(TrayMenuLinkBuilder.BuildDocumentationUrl(_options.ApiUrl))));
		menu.Add(BuildMenuItem("Open OpenAPI JSON", (_, _) => OpenUrl(TrayMenuLinkBuilder.BuildOpenApiJsonUrl(_options.ApiUrl))));
		menu.Add(BuildMenuItem("Open API Health", (_, _) => OpenUrl(TrayMenuLinkBuilder.BuildHealthUrl(_options.ApiUrl))));
		menu.Add(BuildMenuItem("Open API Server Logs", (_, _) => OpenUrl(TrayMenuLinkBuilder.BuildLogsUrl(_options.ApiUrl))));
		menu.Add(BuildMenuItem("Open API Folder", (_, _) => OpenPath(_options.WorkingDirectory)));
		menu.Add(new NativeMenuItemSeparator());
		menu.Add(BuildMenuItem("Restart API", (_, _) => RestartApi()));
		menu.Add(BuildMenuItem("Stop API + Exit", (_, _) => StopApiAndExit()));
		menu.Add(BuildMenuItem("Exit Tray (Keep API Running)", (_, _) => ExitWithoutStoppingApi()));

		_trayIcon = new TrayIcon {
			Menu = menu,
			ToolTipText = "OrganizedJihad API (starting)",
			IsVisible = true,
		};

		var iconPath = ResolveIconCandidatePath();
		if (!string.IsNullOrWhiteSpace(iconPath) && File.Exists(iconPath)) {
			_trayIcon.Icon = new WindowIcon(iconPath);
		}
	}

	private static NativeMenuItem BuildMenuItem(string label, EventHandler onClick) {
		var item = new NativeMenuItem(label);
		item.Click += onClick;
		return item;
	}

	private async Task RunSupervisorLoopAsync(CancellationToken cancellationToken) {
		AppendLog("Non-Windows tray host initialized.");
		ReloadRuntimeSettingsIfChanged();
		EnsureApiRunning();
		UpdateTooltip();

		try {
			using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
			while (await timer.WaitForNextTickAsync(cancellationToken)) {
				ReloadRuntimeSettingsIfChanged();
				EnsureApiRunning();
				UpdateTooltip();
			}
		} catch (OperationCanceledException) {
			// Expected on shutdown.
		}
	}

	private void EnsureApiRunning() {
		if (_apiProcess is { HasExited: false }) {
			return;
		}

		if (IsApiHealthy()) {
			_apiProcess = null;
			_apiManagedByTray = false;
			return;
		}

		if (!File.Exists(_options.ApiExecutablePath)) {
			AppendLog($"API executable not found: {_options.ApiExecutablePath}");
			return;
		}

		var started = ApiProcessRuntime.TryStartProcess(_options, out _apiProcess, out var startError);
		_apiManagedByTray = _apiProcess is not null;
		if (!started) {
			AppendLog($"API process start failed for {_options.ApiUrl}: {startError}");
			return;
		}

		AppendLog($"API process start attempted for {_options.ApiUrl}.");
	}

	private void ReloadRuntimeSettingsIfChanged() {
		try {
			if (TrayHostRuntimeUtilities.TryGetUpdatedApiUrl(_settingsPath, ref _lastSettingsWriteUtc, _options.ApiUrl, out var configuredApiUrl)
				&& !string.IsNullOrWhiteSpace(configuredApiUrl)) {
				_options.ApiUrl = configuredApiUrl;
				AppendLog($"Applied updated apiBaseUrl from settings: {_options.ApiUrl}");

				if (_apiManagedByTray && _apiProcess is { HasExited: false }) {
					RestartApi();
				}
			}
		} catch (Exception ex) {
			AppendLog($"Settings reload failed: {ex.Message}");
		}
	}

	private void RestartApi() {
		try {
			if (_apiManagedByTray && _apiProcess is { HasExited: false }) {
				ApiProcessRuntime.StopManagedProcess(_apiProcess);
			} else {
				ApiProcessRuntime.StopProcessesByName(_options.ApiExecutablePath);
			}
		} catch {
			// Best effort.
		}

		_apiProcess = null;
		_apiManagedByTray = false;
		EnsureApiRunning();
		UpdateTooltip();
	}

	private void StopApiAndExit() {
		try {
			if (_apiManagedByTray && _apiProcess is { HasExited: false }) {
				ApiProcessRuntime.StopManagedProcess(_apiProcess);
			} else {
				ApiProcessRuntime.StopProcessesByName(_options.ApiExecutablePath);
			}
		} catch {
			// Best effort.
		}

		ShutdownTray();
	}

	private void ExitWithoutStoppingApi() {
		ShutdownTray();
	}

	private void ShutdownTray() {
		_loopCts.Cancel();
		_httpClient.Dispose();
		if (_trayIcon is not null) {
			_trayIcon.IsVisible = false;
			_trayIcon.Dispose();
			_trayIcon = null;
		}

		if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktopLifetime) {
			desktopLifetime.Shutdown();
		}
	}

	private void UpdateTooltip() {
		if (_trayIcon is null) {
			return;
		}

		var running = (_apiProcess is { HasExited: false }) || IsApiHealthy();
		_trayIcon.ToolTipText = running
			? "OrganizedJihad API (running)"
			: "OrganizedJihad API (stopped)";
	}

	private bool IsApiHealthy() {
		return TrayHostRuntimeUtilities.IsApiHealthy(_httpClient, _options.ApiUrl);
	}

	private static string? ResolveIconCandidatePath() {
		var pngCandidates = new[] {
			Path.Combine(AppContext.BaseDirectory, "Assets", "Icons", "oj-tray-alt-steel.png"),
			Path.Combine(AppContext.BaseDirectory, "Assets", "Icons", "oj-tray-primary.png"),
			Path.Combine(AppContext.BaseDirectory, "Assets", "Icons", "oj-tray-alt-gold.png"),
			Path.Combine(AppContext.BaseDirectory, "oj-tray-alt-steel.png"),
		};

		foreach (var path in pngCandidates) {
			if (File.Exists(path)) {
				return path;
			}
		}

		var icoCandidates = new[] {
			Path.Combine(AppContext.BaseDirectory, "Assets", "Icons", "oj-tray-alt-steel.ico"),
			Path.Combine(AppContext.BaseDirectory, "Assets", "Icons", "oj-tray-primary.ico"),
			Path.Combine(AppContext.BaseDirectory, "Assets", "Icons", "oj-tray-alt-gold.ico"),
		};

		return icoCandidates.FirstOrDefault(File.Exists);
	}

	private static void OpenUrl(string targetUrl) {
		try {
			Process.Start(new ProcessStartInfo {
				FileName = targetUrl,
				UseShellExecute = true,
			});
		} catch {
			// Best effort only.
		}
	}

	private static void OpenPath(string folderPath) {
		if (string.IsNullOrWhiteSpace(folderPath)) {
			return;
		}

		try {
			if (OperatingSystem.IsMacOS()) {
				Process.Start(new ProcessStartInfo {
					FileName = "open",
					Arguments = TrayHostRuntimeUtilities.QuoteArgument(folderPath),
					UseShellExecute = false,
					CreateNoWindow = true,
				});
				return;
			}

			if (OperatingSystem.IsLinux()) {
				Process.Start(new ProcessStartInfo {
					FileName = "xdg-open",
					Arguments = TrayHostRuntimeUtilities.QuoteArgument(folderPath),
					UseShellExecute = false,
					CreateNoWindow = true,
				});
				return;
			}
		} catch {
			// Best effort only.
		}
	}

	private void AppendLog(string message) {
		TrayHostRuntimeUtilities.AppendLog(_logPath, message);
	}
}
#endif
