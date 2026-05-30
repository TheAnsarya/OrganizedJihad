using System.Diagnostics;

namespace OrganizedJihad.Api.TrayHost;

internal static class ApiProcessRuntime {
	public static bool TryStartProcess(TrayHostOptions options, out Process? process) {
		process = Process.Start(new ProcessStartInfo {
			FileName = options.ApiExecutablePath,
			Arguments = $"--urls {options.ApiUrl}",
			WorkingDirectory = options.WorkingDirectory,
			UseShellExecute = false,
			CreateNoWindow = true,
		});

		return process is not null;
	}

	public static void StopManagedProcess(Process? process) {
		if (process is null || process.HasExited) {
			return;
		}

		process.Kill(true);
		process.WaitForExit(3000);
	}

	public static void StopProcessesByName(string apiExecutablePath) {
		var processName = Path.GetFileNameWithoutExtension(apiExecutablePath);
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
}
