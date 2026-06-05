#if WINDOWS
using System.Windows.Forms;

namespace OrganizedJihad.Api.TrayHost;

internal static class Program {
	[STAThread]
	private static void Main(string[] args) {
		var options = TrayHostOptions.Parse(args);
		ApplicationConfiguration.Initialize();
		// Full tray behavior (menu/actions/health monitoring/process supervision)
		// lives in TrayContext after Program.cs decomposition.
		Application.Run(new TrayContext(options));
	}
}
#else
using Avalonia;

namespace OrganizedJihad.Api.TrayHost;

internal static class Program {
	private static void Main(string[] args) {
		var options = TrayHostOptions.Parse(args);
		try {
			BuildAvaloniaApp(options).StartWithClassicDesktopLifetime(args, Avalonia.Controls.ShutdownMode.OnExplicitShutdown);
		} catch (Exception ex) {
			TrayHostRuntimeUtilities.AppendLog(Path.Combine(options.WorkingDirectory, "runtime-host.log"), $"Tray UI startup failed; falling back to headless runtime host: {ex.Message}");
			using var runtime = new HeadlessRuntimeHost(options);
			runtime.Run();
		}
	}

	private static AppBuilder BuildAvaloniaApp(TrayHostOptions options) {
		return AppBuilder.Configure(() => new TrayHostNonWindowsApp(options))
			.UsePlatformDetect()
			.LogToTrace();
	}
}
#endif
