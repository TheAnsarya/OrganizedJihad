#if !WINDOWS
using System.Diagnostics;
using System.Net.Http;

namespace OrganizedJihad.Api.TrayHost;

internal sealed class HeadlessRuntimeHost : IDisposable {
	private readonly TrayHostOptions _options;
	private readonly HttpClient _httpClient;
	private readonly CancellationTokenSource _shutdownCts;
	private readonly string _settingsPath;
	private readonly string _logPath;
	private Process? _apiProcess;
	private bool _disposed;
	private DateTime _lastSettingsWriteUtc = DateTime.MinValue;

	public HeadlessRuntimeHost(TrayHostOptions options) {
		_options = options;
		_shutdownCts = new CancellationTokenSource();
		_settingsPath = Path.Combine(_options.WorkingDirectory, "api-ui-settings.json");
		_logPath = Path.Combine(_options.WorkingDirectory, "runtime-host.log");
		_httpClient = new HttpClient {
			Timeout = TimeSpan.FromSeconds(2),
		};
	}

	public void Run() {
		AppendLog("Headless runtime host started.");
		EnsureApiRunning();

		try {
			using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
			while (timer.WaitForNextTickAsync(_shutdownCts.Token).AsTask().GetAwaiter().GetResult()) {
				ReloadRuntimeSettingsIfChanged();
				EnsureApiRunning();
			}
		} catch (OperationCanceledException) {
			// Expected during graceful shutdown.
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

		var started = ApiProcessRuntime.TryStartProcess(_options, out _apiProcess, out var startError);
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

				if (_apiProcess is { HasExited: false }) {
					try {
						ApiProcessRuntime.StopManagedProcess(_apiProcess);
					} catch {
						// Best effort.
					}
					_apiProcess = null;
				}
			}
		} catch (Exception ex) {
			AppendLog($"Settings reload failed: {ex.Message}");
		}
	}

	private bool IsApiHealthy() {
		return TrayHostRuntimeUtilities.IsApiHealthy(_httpClient, _options.ApiUrl);
	}

	private void AppendLog(string message) {
		TrayHostRuntimeUtilities.AppendLog(_logPath, message);
	}

	public void Dispose() {
		if (_disposed) {
			return;
		}

		_disposed = true;
		_shutdownCts.Cancel();
		_shutdownCts.Dispose();
		_httpClient.Dispose();
	}
}
#endif
