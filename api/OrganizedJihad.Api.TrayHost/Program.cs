using System.Diagnostics;
using System.Drawing;
using System.Net.Http;
using System.Windows.Forms;

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
	private readonly System.Windows.Forms.Timer _healthTimer;
	private readonly HttpClient _httpClient;
	private Process? _apiProcess;
	private bool _apiManagedByTray;

	public TrayContext(TrayHostOptions options) {
		_options = options;

		_notifyIcon = new NotifyIcon {
			Icon = SystemIcons.Application,
			Text = "OrganizedJihad API",
			Visible = true,
			ContextMenuStrip = BuildMenu(),
		};

		_notifyIcon.DoubleClick += (_, _) => OpenApiUi();
		_httpClient = new HttpClient {
			Timeout = TimeSpan.FromSeconds(2),
		};
		_healthTimer = new System.Windows.Forms.Timer {
			Interval = 15000,
		};
		_healthTimer.Tick += (_, _) => EnsureApiRunning();
		_healthTimer.Start();

		EnsureApiRunning();
		UpdateTooltip();
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
		var uiUrl = _options.ApiUrl.TrimEnd('/');
		Process.Start(new ProcessStartInfo {
			FileName = uiUrl,
			UseShellExecute = true,
		});
	}

	private void EnsureApiRunning() {
		if (!File.Exists(_options.ApiExecutablePath)) {
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

			_apiProcess = Process.Start(new ProcessStartInfo {
				FileName = _options.ApiExecutablePath,
				Arguments = $"--urls {_options.ApiUrl}",
				WorkingDirectory = _options.WorkingDirectory,
				UseShellExecute = false,
				CreateNoWindow = true,
			});
			_apiManagedByTray = _apiProcess is not null;

			if (_apiProcess is not null) {
				_apiProcess.EnableRaisingEvents = true;
				_apiProcess.Exited += (_, _) => {
					_apiManagedByTray = false;
					UpdateTooltip();
				};
			}
		} catch (Exception ex) {
			_notifyIcon.BalloonTipTitle = "OJ API Tray";
			_notifyIcon.BalloonTipText = $"Could not start API: {ex.Message}";
			_notifyIcon.ShowBalloonTip(4000);
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
		_notifyIcon.Text = running ? "OrganizedJihad API (running)" : "OrganizedJihad API (stopped)";
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
		base.ExitThreadCore();
	}

	private static string Quote(string value) {
		return $"\"{value.Replace("\"", "\\\"")}\"";
	}
}
