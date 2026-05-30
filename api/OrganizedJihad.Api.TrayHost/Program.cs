#if WINDOWS
using System.Diagnostics;
using System.Drawing;
using System.Net.Http;
using System.Net.Sockets;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Windows.Forms;

[assembly: InternalsVisibleTo("OrganizedJihad.Api.TrayHost.Tests")]

namespace OrganizedJihad.Api.TrayHost;

internal static class Program {
	[STAThread]
	private static void Main(string[] args) {
		var options = TrayHostOptions.Parse(args);
		ApplicationConfiguration.Initialize();
		Application.Run(new TrayContext(options));
	}
}

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
			parsed.ApiExecutablePath = Path.Combine(parsed.WorkingDirectory, "OrganizedJihad.Api.exe");
		}

		return parsed;
	}
}

internal sealed class TrayContext : ApplicationContext {
	private readonly TrayHostOptions _options;
	private readonly NotifyIcon _notifyIcon;
	private readonly Icon? _trayIcon;
	private readonly System.Windows.Forms.Timer _healthTimer;
	private readonly HttpClient _httpClient;
	private readonly string _settingsPath;
	private readonly string _logPath;
	private Process? _apiProcess;
	private bool _apiManagedByTray;
	private DateTime _lastSettingsWriteUtc = DateTime.MinValue;
	private DateTime _lastPortConflictNoticeUtc = DateTime.MinValue;

	public TrayContext(TrayHostOptions options) {
		_options = options;
		_trayIcon = TryLoadTrayIcon();

		_notifyIcon = new NotifyIcon {
			Icon = _trayIcon ?? SystemIcons.Application,
			Text = "OrganizedJihad API",
			Visible = true,
			ContextMenuStrip = BuildMenu(),
		};

		_notifyIcon.DoubleClick += (_, _) => OpenApiUi();
		_settingsPath = Path.Combine(_options.WorkingDirectory, "api-ui-settings.json");
		_logPath = Path.Combine(_options.WorkingDirectory, "tray-host.log");
		_httpClient = new HttpClient {
			Timeout = TimeSpan.FromSeconds(2),
		};
		_healthTimer = new System.Windows.Forms.Timer {
			Interval = 15000,
		};
		_healthTimer.Tick += (_, _) => {
			ReloadRuntimeSettingsIfChanged();
			EnsureApiRunning();
		};
		_healthTimer.Start();

		ReloadRuntimeSettingsIfChanged();
		EnsureApiRunning();
		UpdateTooltip();
		AppendTrayLog("Tray host initialized.");
	}

	private ContextMenuStrip BuildMenu() {
		var menu = new ContextMenuStrip();
		menu.Items.Add("Open API UI", null, (_, _) => OpenApiUi());
		menu.Items.Add("Open API Health", null, (_, _) => OpenApiHealth());
		menu.Items.Add("Open API Folder", null, (_, _) => OpenApiFolder());
		menu.Items.Add("Restart API", null, (_, _) => RestartApi());
		menu.Items.Add("Stop API + Exit", null, (_, _) => StopApiAndExit());
		menu.Items.Add("Exit Tray (Keep API Running)", null, (_, _) => ExitWithoutStoppingApi());
		return menu;
	}

	private void OpenApiUi() {
		var uiUrl = _options.ApiUrl.TrimEnd('/') + "/ui";
		Process.Start(new ProcessStartInfo {
			FileName = uiUrl,
			UseShellExecute = true,
		});
	}

	private void EnsureApiRunning() {
		if (!File.Exists(_options.ApiExecutablePath)) {
			AppendTrayLog($"API executable missing: {_options.ApiExecutablePath}");
			_notifyIcon.BalloonTipTitle = "OJ API Tray";
			_notifyIcon.BalloonTipText = $"API executable not found: {_options.ApiExecutablePath}";
			_notifyIcon.ShowBalloonTip(4000);
			return;
		}

		try {
			if (_apiProcess is { HasExited: false }) {
				return;
			}

			if (IsApiHealthy()) {
				_apiProcess = null;
				_apiManagedByTray = false;
				UpdateTooltip();
				return;
			}

			if (IsConfiguredPortInUse()) {
				AppendTrayLog($"Configured API port is occupied but health probe is failing at {_options.ApiUrl}.");
				ShowPortConflictNotice();
				UpdateTooltip();
				return;
			}

			_apiProcess = Process.Start(new ProcessStartInfo {
				FileName = _options.ApiExecutablePath,
				Arguments = $"--urls {_options.ApiUrl}",
				WorkingDirectory = _options.WorkingDirectory,
				UseShellExecute = false,
				CreateNoWindow = true,
			});
			_apiManagedByTray = _apiProcess is not null;
			AppendTrayLog($"API process start attempted. ManagedByTray={_apiManagedByTray}, Url={_options.ApiUrl}");

			if (_apiProcess is not null) {
				_apiProcess.EnableRaisingEvents = true;
				_apiProcess.Exited += (_, _) => {
					_apiManagedByTray = false;
					UpdateTooltip();
				};
			}
		} catch (Exception ex) {
			if (IsConfiguredPortInUse()) {
				ShowPortConflictNotice();
			}
			AppendTrayLog($"API start failure: {ex.Message}");
			_notifyIcon.BalloonTipTitle = "OJ API Tray";
			_notifyIcon.BalloonTipText = $"Could not start API: {ex.Message}";
			_notifyIcon.ShowBalloonTip(4000);
		}
	}

	private void ReloadRuntimeSettingsIfChanged() {
		try {
			if (!File.Exists(_settingsPath)) {
				return;
			}

			var lastWriteUtc = File.GetLastWriteTimeUtc(_settingsPath);
			if (lastWriteUtc <= _lastSettingsWriteUtc) {
				return;
			}

			var raw = File.ReadAllText(_settingsPath);
			if (TrayRuntimeSettingsParser.TryReadApiBaseUrl(raw, out var configuredApiUrl)
				&& !string.IsNullOrWhiteSpace(configuredApiUrl)
				&& !string.Equals(_options.ApiUrl, configuredApiUrl, StringComparison.OrdinalIgnoreCase)) {
					_options.ApiUrl = configuredApiUrl;
					_notifyIcon.BalloonTipTitle = "OJ API Tray";
					_notifyIcon.BalloonTipText = $"API base URL updated to {_options.ApiUrl}.";
					_notifyIcon.ShowBalloonTip(2500);
					AppendTrayLog($"Applied updated apiBaseUrl from settings: {_options.ApiUrl}");

					if (_apiManagedByTray && _apiProcess is { HasExited: false }) {
						RestartApi();
					}
			}

			_lastSettingsWriteUtc = lastWriteUtc;
		} catch (Exception ex) {
			AppendTrayLog($"Settings reload failed: {ex.Message}");
			// Ignore transient parsing or file lock issues and retry later.
		}
	}

	private void RestartApi() {
		try {
			if (_apiManagedByTray && _apiProcess is { HasExited: false }) {
				_apiProcess.Kill(true);
				_apiProcess.WaitForExit(3000);
			} else {
				StopApiProcessesByName();
			}
		} catch {
			// Ignore kill/wait failures and continue with restart attempt.
		}

		_apiProcess = null;
		_apiManagedByTray = false;
		EnsureApiRunning();
		UpdateTooltip();
	}

	private void OpenApiHealth() {
		var healthUrl = _options.ApiUrl.TrimEnd('/') + "/api/sync/health";
		Process.Start(new ProcessStartInfo {
			FileName = healthUrl,
			UseShellExecute = true,
		});
	}

	private void OpenApiFolder() {
		Process.Start(new ProcessStartInfo {
			FileName = "explorer.exe",
			Arguments = Quote(_options.WorkingDirectory),
			UseShellExecute = true,
		});
	}

	private void StopApiAndExit() {
		try {
			if (_apiManagedByTray && _apiProcess is { HasExited: false }) {
				_apiProcess.Kill(true);
			} else {
				StopApiProcessesByName();
			}
		} catch {
			// Ignore cleanup errors while exiting.
		}

		ExitThread();
	}

	private void ExitWithoutStoppingApi() {
		ExitThread();
	}

	private void UpdateTooltip() {
		var running = (_apiProcess is { HasExited: false }) || IsApiHealthy();
		if (running) {
			_notifyIcon.Text = "OrganizedJihad API (running)";
			return;
		}

		if (IsConfiguredPortInUse()) {
			_notifyIcon.Text = "OrganizedJihad API (port conflict)";
			return;
		}

		_notifyIcon.Text = "OrganizedJihad API (stopped)";
	}

	private bool IsConfiguredPortInUse() {
		if (!Uri.TryCreate(_options.ApiUrl, UriKind.Absolute, out var uri)) {
			return false;
		}

		var port = uri.IsDefaultPort
			? (string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) ? 443 : 80)
			: uri.Port;

		try {
			using var client = new TcpClient();
			var connectTask = client.ConnectAsync(uri.Host, port);
			var completed = connectTask.Wait(500);
			return completed && client.Connected;
		} catch {
			return false;
		}
	}

	private void ShowPortConflictNotice() {
		var now = DateTime.UtcNow;
		if ((now - _lastPortConflictNoticeUtc).TotalSeconds < 30) {
			return;
		}

		_lastPortConflictNoticeUtc = now;
		AppendTrayLog($"Port conflict notice triggered for {_options.ApiUrl}");
		_notifyIcon.BalloonTipTitle = "OJ API Tray";
		_notifyIcon.BalloonTipText = $"Configured API URL port appears in use but /api/sync/health is not responding at {_options.ApiUrl}. Check for a conflicting process.";
		_notifyIcon.ShowBalloonTip(4500);
	}

	private bool IsApiHealthy() {
		try {
			var healthUrl = _options.ApiUrl.TrimEnd('/') + "/api/sync/health";
			var response = _httpClient.GetAsync(healthUrl).GetAwaiter().GetResult();
			return response.IsSuccessStatusCode;
		} catch {
			return false;
		}
	}

	private void StopApiProcessesByName() {
		var processName = Path.GetFileNameWithoutExtension(_options.ApiExecutablePath);
		if (string.IsNullOrWhiteSpace(processName)) {
			processName = "OrganizedJihad.Api";
		}

		foreach (var process in Process.GetProcessesByName(processName)) {
			try {
				process.Kill(true);
				process.WaitForExit(3000);
			} catch {
				// Best effort shutdown; continue with remaining instances.
			}
		}
	}

	protected override void ExitThreadCore() {
		_healthTimer.Stop();
		_healthTimer.Dispose();
		_httpClient.Dispose();
		_notifyIcon.Visible = false;
		_notifyIcon.Dispose();
		_trayIcon?.Dispose();
		base.ExitThreadCore();
	}

	private Icon? TryLoadTrayIcon() {
		try {
			var candidates = new[] {
				Path.Combine(AppContext.BaseDirectory, "Assets", "Icons", "oj-tray-alt-steel.ico"),
				Path.Combine(AppContext.BaseDirectory, "Assets", "Icons", "oj-tray-primary.ico"),
				Path.Combine(AppContext.BaseDirectory, "oj-tray-alt-steel.ico"),
				Path.Combine(AppContext.BaseDirectory, "oj-tray-primary.ico"),
			};

			var iconPath = candidates.FirstOrDefault(File.Exists);
			if (string.IsNullOrWhiteSpace(iconPath)) {
				return null;
			}

			return new Icon(iconPath);
		} catch {
			return null;
		}
	}

	private static string Quote(string value) {
		return $"\"{value.Replace("\"", "\\\"")}\"";
	}

	private void AppendTrayLog(string message) {
		try {
			var line = $"[{DateTime.UtcNow:O}] {message}{Environment.NewLine}";
			File.AppendAllText(_logPath, line);
		} catch {
			// Best effort logging only.
		}
	}
}

internal static class TrayRuntimeSettingsParser {
	public static bool TryReadApiBaseUrl(string rawJson, out string? apiBaseUrl) {
		apiBaseUrl = null;
		if (string.IsNullOrWhiteSpace(rawJson)) {
			return false;
		}

		using var document = JsonDocument.Parse(rawJson);
		if (!document.RootElement.TryGetProperty("apiBaseUrl", out var apiBaseUrlProperty)) {
			return false;
		}

		apiBaseUrl = apiBaseUrlProperty.GetString()?.Trim();
		return !string.IsNullOrWhiteSpace(apiBaseUrl);
	}
}
#else
using System.Diagnostics;
using System.Net.Http;
using System.Runtime.CompilerServices;
using System.Text.Json;

[assembly: InternalsVisibleTo("OrganizedJihad.Api.TrayHost.Tests")]

namespace OrganizedJihad.Api.TrayHost;

internal static class Program {
	private static void Main(string[] args) {
		var options = TrayHostOptions.Parse(args);
		using var runtime = new HeadlessRuntimeHost(options);
		runtime.Run();
	}
}

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
			parsed.ApiExecutablePath = Path.Combine(parsed.WorkingDirectory, "OrganizedJihad.Api");
			if (!File.Exists(parsed.ApiExecutablePath)) {
				parsed.ApiExecutablePath = Path.Combine(parsed.WorkingDirectory, "OrganizedJihad.Api.exe");
			}
		}

		return parsed;
	}
}

internal sealed class HeadlessRuntimeHost : IDisposable {
	private readonly TrayHostOptions _options;
	private readonly HttpClient _httpClient;
	private readonly string _settingsPath;
	private readonly string _logPath;
	private Process? _apiProcess;
	private bool _disposed;
	private DateTime _lastSettingsWriteUtc = DateTime.MinValue;

	public HeadlessRuntimeHost(TrayHostOptions options) {
		_options = options;
		_settingsPath = Path.Combine(_options.WorkingDirectory, "api-ui-settings.json");
		_logPath = Path.Combine(_options.WorkingDirectory, "runtime-host.log");
		_httpClient = new HttpClient {
			Timeout = TimeSpan.FromSeconds(2),
		};
	}

	public void Run() {
		AppendLog("Headless runtime host started.");
		EnsureApiRunning();

		while (true) {
			ReloadRuntimeSettingsIfChanged();
			EnsureApiRunning();
			Thread.Sleep(TimeSpan.FromSeconds(15));
		}
	}

	private void EnsureApiRunning() {
		if (_apiProcess is { HasExited: false }) {
			return;
		}

		if (IsApiHealthy()) {
			_apiProcess = null;
			return;
		}

		if (!File.Exists(_options.ApiExecutablePath)) {
			AppendLog($"API executable not found: {_options.ApiExecutablePath}");
			return;
		}

		_apiProcess = Process.Start(new ProcessStartInfo {
			FileName = _options.ApiExecutablePath,
			Arguments = $"--urls {_options.ApiUrl}",
			WorkingDirectory = _options.WorkingDirectory,
			UseShellExecute = false,
			CreateNoWindow = true,
		});

		AppendLog($"API process start attempted for {_options.ApiUrl}.");
	}

	private void ReloadRuntimeSettingsIfChanged() {
		try {
			if (!File.Exists(_settingsPath)) {
				return;
			}

			var lastWriteUtc = File.GetLastWriteTimeUtc(_settingsPath);
			if (lastWriteUtc <= _lastSettingsWriteUtc) {
				return;
			}

			var raw = File.ReadAllText(_settingsPath);
			if (TrayRuntimeSettingsParser.TryReadApiBaseUrl(raw, out var configuredApiUrl)
				&& !string.IsNullOrWhiteSpace(configuredApiUrl)
				&& !string.Equals(_options.ApiUrl, configuredApiUrl, StringComparison.OrdinalIgnoreCase)) {
				_options.ApiUrl = configuredApiUrl;
				AppendLog($"Applied updated apiBaseUrl from settings: {_options.ApiUrl}");

				if (_apiProcess is { HasExited: false }) {
					try {
						_apiProcess.Kill(true);
					} catch {
						// Best effort.
					}
					_apiProcess = null;
				}
			}

			_lastSettingsWriteUtc = lastWriteUtc;
		} catch (Exception ex) {
			AppendLog($"Settings reload failed: {ex.Message}");
		}
	}

	private bool IsApiHealthy() {
		try {
			var healthUrl = _options.ApiUrl.TrimEnd('/') + "/api/sync/health";
			var response = _httpClient.GetAsync(healthUrl).GetAwaiter().GetResult();
			return response.IsSuccessStatusCode;
		} catch {
			return false;
		}
	}

	private void AppendTrayLog(string message) {
		AppendLog(message);
	}

	private void AppendLog(string message) {
		try {
			var line = $"[{DateTime.UtcNow:O}] {message}{Environment.NewLine}";
			File.AppendAllText(_logPath, line);
		} catch {
			// Best effort logging only.
		}
	}

	public void Dispose() {
		if (_disposed) {
			return;
		}

		_disposed = true;
		_httpClient.Dispose();
	}
}

internal static class TrayRuntimeSettingsParser {
	public static bool TryReadApiBaseUrl(string rawJson, out string? apiBaseUrl) {
		apiBaseUrl = null;
		if (string.IsNullOrWhiteSpace(rawJson)) {
			return false;
		}

		using var document = JsonDocument.Parse(rawJson);
		if (!document.RootElement.TryGetProperty("apiBaseUrl", out var apiBaseUrlProperty)) {
			return false;
		}

		apiBaseUrl = apiBaseUrlProperty.GetString()?.Trim();
		return !string.IsNullOrWhiteSpace(apiBaseUrl);
	}
}
#endif
