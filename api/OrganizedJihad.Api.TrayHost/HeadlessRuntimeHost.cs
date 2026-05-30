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
#endif
