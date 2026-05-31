#if WINDOWS
using System.Diagnostics;
using System.Drawing;

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

			var started = ApiProcessRuntime.TryStartProcess(_options, out _apiProcess, out var startError);
			_apiManagedByTray = _apiProcess is not null;
			if (!started) {
				AppendTrayLog($"API process start failed. Url={_options.ApiUrl}, Error={startError}");
			} else {
				AppendTrayLog($"API process start attempted. ManagedByTray={_apiManagedByTray}, Url={_options.ApiUrl}");
			}

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
				ApiProcessRuntime.StopManagedProcess(_apiProcess);
			} else {
				ApiProcessRuntime.StopProcessesByName(_options.ApiExecutablePath);
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
		return TrayPortProbe.IsPortInUse(_options.ApiUrl);
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

	private Icon? TryLoadTrayIcon() {
		return TrayIconLoader.TryLoad();
	}

	private static string Quote(string value) {
		return TrayHostRuntimeUtilities.QuoteArgument(value);
	}

	private void AppendTrayLog(string message) {
		TrayHostRuntimeUtilities.AppendLog(_logPath, message);
	}
}
#endif
