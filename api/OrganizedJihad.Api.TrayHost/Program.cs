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
namespace OrganizedJihad.Api.TrayHost;

internal static class Program {
	private static void Main(string[] args) {
		var options = TrayHostOptions.Parse(args);
		// Non-Windows supervision loop lives in HeadlessRuntimeHost.
		using var runtime = new HeadlessRuntimeHost(options);
		runtime.Run();
	}
}
#endif
