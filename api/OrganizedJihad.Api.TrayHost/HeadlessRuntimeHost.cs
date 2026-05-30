#if !WINDOWS
using System.Diagnostics;
using System.Net.Http;

namespace OrganizedJihad.Api.TrayHost;

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
			if (TrayHostRuntimeUtilities.TryGetUpdatedApiUrl(_settingsPath, ref _lastSettingsWriteUtc, _options.ApiUrl, out var configuredApiUrl)
				&& !string.IsNullOrWhiteSpace(configuredApiUrl)) {
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
		_httpClient.Dispose();
	}
}
#endif
