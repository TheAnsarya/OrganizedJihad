using OrganizedJihad.Api.Models.Ui;
using System.Diagnostics;

namespace OrganizedJihad.Api.Services.Diagnostics;

/// <summary>
/// Probes scheduled task registration and status on Windows hosts.
/// </summary>
public sealed class ScheduledTaskProbeService {
	/// <summary>
	/// Probes a named scheduled task and returns a normalized status response.
	/// </summary>
	public ScheduledTaskProbeResult GetStatus(string taskName) {
		if (!OperatingSystem.IsWindows()) {
			return new ScheduledTaskProbeResult("n/a", "Scheduled tasks are only available on Windows.");
		}

		try {
			var startInfo = new ProcessStartInfo {
				FileName = "schtasks.exe",
				Arguments = $"/Query /TN \"{taskName}\" /FO LIST /V",
				UseShellExecute = false,
				RedirectStandardOutput = true,
				RedirectStandardError = true,
				CreateNoWindow = true,
			};

			using var process = Process.Start(startInfo);
			if (process is null) {
				return new ScheduledTaskProbeResult("unknown", "Could not start schtasks query process.");
			}

			var output = process.StandardOutput.ReadToEnd();
			var errors = process.StandardError.ReadToEnd();
			process.WaitForExit(5000);

			if (process.ExitCode != 0) {
				var message = string.IsNullOrWhiteSpace(errors) ? "Task missing or inaccessible." : errors.Trim();
				return new ScheduledTaskProbeResult("missing", message);
			}

			var statusLine = output.Split(Environment.NewLine)
				.Select(line => line.Trim())
				.FirstOrDefault(line => line.StartsWith("Status:", StringComparison.OrdinalIgnoreCase));

			if (!string.IsNullOrWhiteSpace(statusLine)) {
				var status = statusLine.Replace("Status:", string.Empty, StringComparison.OrdinalIgnoreCase).Trim();
				return new ScheduledTaskProbeResult(status, statusLine);
			}

			return new ScheduledTaskProbeResult("registered", "Task exists.");
		} catch (Exception ex) {
			return new ScheduledTaskProbeResult("unknown", ex.Message);
		}
	}
}
