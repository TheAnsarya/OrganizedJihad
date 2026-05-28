using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Threading;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
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

	public MainWindow() {
		InitializeComponent();

		InstallRootTextBox.Text = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OrganizedJihad");
		ApiUrlTextBox.Text = "http://localhost:5124";

		BrowserComboBox.ItemsSource = _browserArgumentMap.Keys.ToList();
		BrowserComboBox.SelectedIndex = 0;
	}

	private async void OnInstallClick(object? sender, RoutedEventArgs e) {
		if (_isInstalling) {
			return;
		}

		if (string.IsNullOrWhiteSpace(InstallRootTextBox.Text)) {
			SetStatus("Status: Install root is required.");
			return;
		}
		if (string.IsNullOrWhiteSpace(ApiUrlTextBox.Text)) {
			SetStatus("Status: API URL is required.");
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

		var args = BuildInstallerArguments(scriptPath, browserArg);
		await RunInstallProcessAsync(shell, args);
	}

	private string BuildInstallerArguments(string scriptPath, string browserArg) {
		var args = new List<string> {
			"-NoProfile",
			"-ExecutionPolicy", "Bypass",
			"-File", Quote(scriptPath),
			"-InstallRoot", Quote(InstallRootTextBox.Text!.Trim()),
			"-ApiUrl", Quote(ApiUrlTextBox.Text!.Trim()),
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
		InstallButton.IsEnabled = false;
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
			InstallButton.IsEnabled = true;
		}
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
		if (CommandExists("pwsh")) return "pwsh";
		if (CommandExists("powershell")) return "powershell";
		return null;
	}

	private static bool CommandExists(string command) {
		var info = new ProcessStartInfo {
			FileName = command,
			Arguments = "-NoProfile -Command \"$PSVersionTable.PSVersion\"",
			UseShellExecute = false,
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
}
