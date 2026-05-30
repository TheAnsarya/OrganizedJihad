#if WINDOWS
using System.Windows.Forms;

namespace OrganizedJihad.Api.TrayHost;

internal static class Program {
	[STAThread]
	private static void Main(string[] args) {
		var options = TrayHostOptions.Parse(args);
		ApplicationConfiguration.Initialize();
		Application.Run(new TrayContext(options));
	}
}
#else
namespace OrganizedJihad.Api.TrayHost;

internal static class Program {
	private static void Main(string[] args) {
		var options = TrayHostOptions.Parse(args);
		using var runtime = new HeadlessRuntimeHost(options);
		runtime.Run();
	}
}
#endif
