using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Threading;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace OrganizedJihad.Installer;

public partial class MainWindow : Window {
	private readonly Dictionary<string, string> _browserArgumentMap = new() {
		{ "Opera GX", "operaGX" },
		{ "Chrome", "chrome" },
		{ "Edge", "edge" },
		{ "Firefox", "firefox" },
	};

	private bool _isInstalling;
	private string? _currentLogFilePath;

	public MainWindow() {
		InitializeComponent();

		InstallRootTextBox.Text = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OrganizedJihad");
		ApiUrlTextBox.Text = "http://localhost:5124";

		BrowserComboBox.ItemsSource = _browserArgumentMap.Keys.ToList();
		BrowserComboBox.SelectedIndex = 0;

		UpdateQuickActionState();
	}

	private async void OnInstallClick(object? sender, RoutedEventArgs e) {
		if (_isInstalling) {
			return;
		}

		if (!ValidatePreflight(out var installRoot, out var apiUrl, out var preflightMessage)) {
			SetStatus($"Status: {preflightMessage}");
			AppendLog($"[Installer UI] Preflight failed: {preflightMessage}");
			return;
		}

		if (BrowserComboBox.SelectedItem is not string browserLabel || !_browserArgumentMap.TryGetValue(browserLabel, out var browserArg)) {
			SetStatus("Status: Please select a browser.");
			return;
		}

		var scriptPath = ResolveInstallerScriptPath();
		if (scriptPath is null) {
			SetStatus("Status: Could not locate Install-OrganizedJihad.ps1.");
			AppendLog("[Installer UI] Unable to find Install-OrganizedJihad.ps1 near executable or repository root.");
			return;
		}

		var shell = ResolvePowerShellExecutable();
		if (shell is null) {
			SetStatus("Status: PowerShell was not found.");
			AppendLog("[Installer UI] Neither pwsh nor powershell is available in PATH.");
			return;
		}

		var args = BuildInstallerArguments(scriptPath, installRoot, apiUrl, browserArg);
		await RunInstallProcessAsync(shell, args);
	}

	private string BuildInstallerArguments(string scriptPath, string installRoot, string apiUrl, string browserArg) {
		var args = new List<string> {
			"-NoProfile",
			"-ExecutionPolicy", "Bypass",
			"-File", Quote(scriptPath),
			"-InstallRoot", Quote(installRoot),
			"-ApiUrl", Quote(apiUrl),
			"-RunInstallHealthCheck",
			"-TampermonkeyBrowsers", browserArg,
		};

		if (InstallDesktopCheckBox.IsChecked != true) {
			args.Add("-SkipDesktopAppInstall");
		}

		if (FirstRunDiagnosticsCheckBox.IsChecked == true) {
			args.Add("-FirstRunDiagnostics");
		}

		if (OpenDiagnosticsCheckBox.IsChecked == true) {
			args.Add("-OpenUserscriptDiagnostics");
		}

		return string.Join(' ', args);
	}

	private async Task RunInstallProcessAsync(string shell, string args) {
		_isInstalling = true;
		UpdateQuickActionState();

		_currentLogFilePath = CreateInstallLogFilePath();
		LogPathTextBlock.Text = $"Log: {_currentLogFilePath}";
		PersistLogLine("[Installer UI] Log initialized.");

		SetStatus("Status: Installing...");
		AppendLog($"[Installer UI] Running: {shell} {args}");

		var startInfo = new ProcessStartInfo {
			FileName = shell,
			Arguments = args,
			UseShellExecute = false,
			RedirectStandardOutput = true,
			RedirectStandardError = true,
			CreateNoWindow = true,
		};

		try {
			using var process = new Process { StartInfo = startInfo };

			process.OutputDataReceived += (_, eventArgs) => {
				if (!string.IsNullOrWhiteSpace(eventArgs.Data)) {
					AppendLog(eventArgs.Data);
				}
			};
			process.ErrorDataReceived += (_, eventArgs) => {
				if (!string.IsNullOrWhiteSpace(eventArgs.Data)) {
					AppendLog($"[stderr] {eventArgs.Data}");
				}
			};

			if (!process.Start()) {
				AppendLog("[Installer UI] Failed to start installer process.");
				SetStatus("Status: Failed to start installer.");
				return;
			}

			process.BeginOutputReadLine();
			process.BeginErrorReadLine();
			await process.WaitForExitAsync();

			if (process.ExitCode == 0) {
				SetStatus("Status: Install complete.");
				AppendLog("[Installer UI] Installation succeeded.");
			} else {
				SetStatus($"Status: Installer failed (exit {process.ExitCode}).");
				AppendLog($"[Installer UI] Installation failed with exit code {process.ExitCode}.");
			}
		} catch (Exception ex) {
			SetStatus("Status: Installer crashed.");
			AppendLog($"[Installer UI] Exception: {ex.Message}");
		} finally {
			_isInstalling = false;
			UpdateQuickActionState();
		}
	}

	private bool ValidatePreflight(out string installRoot, out string apiUrl, out string message) {
		installRoot = InstallRootTextBox.Text?.Trim() ?? string.Empty;
		apiUrl = ApiUrlTextBox.Text?.Trim() ?? string.Empty;

		if (string.IsNullOrWhiteSpace(installRoot)) {
			message = "Install root is required.";
			return false;
		}

		if (installRoot.IndexOfAny(Path.GetInvalidPathChars()) >= 0) {
			message = "Install root contains invalid characters.";
			return false;
		}

		if (!Path.IsPathRooted(installRoot)) {
			message = "Install root must be an absolute path.";
			return false;
		}

		try {
			Directory.CreateDirectory(installRoot);
		} catch (Exception ex) {
			message = $"Install root is not writable: {ex.Message}";
			return false;
		}

		if (string.IsNullOrWhiteSpace(apiUrl)) {
			message = "API URL is required.";
			return false;
		}

		if (!Uri.TryCreate(apiUrl, UriKind.Absolute, out var uri)) {
			message = "API URL must be a valid absolute URL.";
			return false;
		}

		if (!string.Equals(uri.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase) && !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)) {
			message = "API URL must use http or https.";
			return false;
		}

		message = "Preflight checks passed.";
		return true;
	}

	private string? ResolveInstallerScriptPath() {
		var baseDir = AppContext.BaseDirectory;
		var candidates = new[] {
			Path.Combine(baseDir, "Install-OrganizedJihad.ps1"),
			Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "Install-OrganizedJihad.ps1")),
			Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "Install-OrganizedJihad.ps1")),
		};

		return candidates.FirstOrDefault(File.Exists);
	}

	private static string? ResolvePowerShellExecutable() {
		var candidatePaths = new List<string>();

		candidatePaths.AddRange(ResolveExecutablesFromPath("pwsh"));
		candidatePaths.AddRange(ResolveExecutablesFromPath("powershell"));

		foreach (var path in candidatePaths.Distinct(StringComparer.OrdinalIgnoreCase)) {
			if (CommandExists(path)) {
				return path;
			}
		}

		return null;
	}

	private static IEnumerable<string> ResolveExecutablesFromPath(string commandName) {
		var pathValue = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
		var pathEntries = pathValue.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
		var pathextRaw = Environment.GetEnvironmentVariable("PATHEXT") ?? ".EXE;.CMD;.BAT";
		var extensions = pathextRaw.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
			.Select(ext => ext.StartsWith('.') ? ext : $".{ext}")
			.ToArray();

		foreach (var entry in pathEntries) {
			foreach (var ext in extensions) {
				var candidate = Path.Combine(entry, $"{commandName}{ext}");
				if (File.Exists(candidate)) {
					yield return candidate;
				}
			}
		}
	}

	private static bool CommandExists(string commandPath) {
		var info = new ProcessStartInfo {
			FileName = commandPath,
			Arguments = "-NoProfile -Command \"$PSVersionTable.PSVersion\"",
			UseShellExecute = false,
			RedirectStandardOutput = true,
			RedirectStandardError = true,
			CreateNoWindow = true,
		};

		try {
			using var process = Process.Start(info);
			if (process is null) {
				return false;
			}
			process.WaitForExit(2000);
			return process.ExitCode == 0;
		} catch {
			return false;
		}
	}

	private void AppendLog(string line) {
		PersistLogLine(line);

		Dispatcher.UIThread.Post(() => {
			LogTextBox.Text = string.Concat(LogTextBox.Text ?? string.Empty, Environment.NewLine, line);
			LogTextBox.CaretIndex = (LogTextBox.Text ?? string.Empty).Length;
		});
	}

	private void SetStatus(string value) {
		Dispatcher.UIThread.Post(() => {
			StatusTextBlock.Text = value;
		});
	}

	private static string Quote(string value) {
		return $"\"{value.Replace("\"", "\\\"")}\"";
	}

	private string CreateInstallLogFilePath() {
		var logRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OrganizedJihad", "installer-logs");
		Directory.CreateDirectory(logRoot);
		return Path.Combine(logRoot, $"installer-{DateTime.Now:yyyyMMdd-HHmmss}.log");
	}

	private void PersistLogLine(string line) {
		if (string.IsNullOrWhiteSpace(_currentLogFilePath)) {
			return;
		}

		var stampedLine = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {line}";
		File.AppendAllText(_currentLogFilePath, stampedLine + Environment.NewLine, Encoding.UTF8);
	}

	private void OnOpenInstallRootClick(object? sender, RoutedEventArgs e) {
		var installRoot = InstallRootTextBox.Text?.Trim();
		if (string.IsNullOrWhiteSpace(installRoot) || !Directory.Exists(installRoot)) {
			SetStatus("Status: Install root does not exist yet.");
			return;
		}

		OpenFolder(installRoot);
	}

	private void OnOpenLogFolderClick(object? sender, RoutedEventArgs e) {
		if (string.IsNullOrWhiteSpace(_currentLogFilePath)) {
			SetStatus("Status: Run an install first to create a log file.");
			return;
		}

		var folder = Path.GetDirectoryName(_currentLogFilePath);
		if (string.IsNullOrWhiteSpace(folder) || !Directory.Exists(folder)) {
			SetStatus("Status: Log folder does not exist.");
			return;
		}

		OpenFolder(folder);
	}

	private static void OpenFolder(string folderPath) {
		Process.Start(new ProcessStartInfo {
			FileName = "explorer.exe",
			Arguments = Quote(folderPath),
			UseShellExecute = true,
		});
	}

	private void UpdateQuickActionState() {
		InstallButton.IsEnabled = !_isInstalling;
		OpenInstallRootButton.IsEnabled = !_isInstalling;
		OpenLogFolderButton.IsEnabled = !_isInstalling;
	}
}
