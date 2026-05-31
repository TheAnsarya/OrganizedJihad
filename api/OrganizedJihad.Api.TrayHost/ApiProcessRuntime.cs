using System.Diagnostics;

namespace OrganizedJihad.Api.TrayHost;

internal static class ApiProcessRuntime {
	public static bool TryStartProcess(TrayHostOptions options, out Process? process, out string? error) {
		process = null;
		error = null;

		try {
			process = Process.Start(new ProcessStartInfo {
				FileName = options.ApiExecutablePath,
				Arguments = $"--urls {options.ApiUrl}",
				WorkingDirectory = options.WorkingDirectory,
				UseShellExecute = false,
				CreateNoWindow = true,
			});

			if (process is null) {
				error = "Process.Start returned null.";
				return false;
			}

			return true;
		} catch (Exception ex) {
			error = ex.Message;
			return false;
		}
	}

	public static void StopManagedProcess(Process? process) {
		if (process is null || process.HasExited) {
			return;
		}

		process.Kill(true);
		if (!process.WaitForExit(3000)) {
			process.Kill(true);
		}
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
