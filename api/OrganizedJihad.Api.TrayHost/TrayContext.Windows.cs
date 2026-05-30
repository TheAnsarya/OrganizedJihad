#if WINDOWS
using System.Diagnostics;
using System.Drawing;
using System.Net.Http;
using System.Net.Sockets;
using System.Windows.Forms;

namespace OrganizedJihad.Api.TrayHost;

internal sealed partial class TrayContext : ApplicationContext {
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

	protected override void ExitThreadCore() {
		_healthTimer.Stop();
		_healthTimer.Dispose();
		_httpClient.Dispose();
		_notifyIcon.Visible = false;
		_notifyIcon.Dispose();
		_trayIcon?.Dispose();
		base.ExitThreadCore();
	}
}
#endif
