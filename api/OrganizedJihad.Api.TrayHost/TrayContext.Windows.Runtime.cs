#if WINDOWS
using System.Diagnostics;
using System.Drawing;
using System.Net.Sockets;

namespace OrganizedJihad.Api.TrayHost;

internal sealed partial class TrayContext {
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
			if (TrayHostRuntimeUtilities.TryGetUpdatedApiUrl(_settingsPath, ref _lastSettingsWriteUtc, _options.ApiUrl, out var configuredApiUrl)
				&& !string.IsNullOrWhiteSpace(configuredApiUrl)) {
				_options.ApiUrl = configuredApiUrl;
				_notifyIcon.BalloonTipTitle = "OJ API Tray";
				_notifyIcon.BalloonTipText = $"API base URL updated to {_options.ApiUrl}.";
				_notifyIcon.ShowBalloonTip(2500);
				AppendTrayLog($"Applied updated apiBaseUrl from settings: {_options.ApiUrl}");

				if (_apiManagedByTray && _apiProcess is { HasExited: false }) {
					RestartApi();
				}
			}
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
		return TrayHostRuntimeUtilities.IsApiHealthy(_httpClient, _options.ApiUrl);
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
		return TrayHostRuntimeUtilities.QuoteArgument(value);
	}

	private void AppendTrayLog(string message) {
		TrayHostRuntimeUtilities.AppendLog(_logPath, message);
	}
}
#endif
