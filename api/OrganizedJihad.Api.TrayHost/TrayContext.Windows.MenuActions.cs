#if WINDOWS
using System.Diagnostics;
using System.Windows.Forms;

namespace OrganizedJihad.Api.TrayHost;

internal sealed partial class TrayContext {
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

	private void OpenApiHealth() {
		var healthUrl = _options.ApiUrl.TrimEnd('/') + "/ui/tray-health";
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
				ApiProcessRuntime.StopManagedProcess(_apiProcess);
			} else {
				ApiProcessRuntime.StopProcessesByName(_options.ApiExecutablePath);
			}
		} catch {
			// Ignore cleanup errors while exiting.
		}

		ExitThread();
	}

	private void ExitWithoutStoppingApi() {
		ExitThread();
	}
}
#endif
