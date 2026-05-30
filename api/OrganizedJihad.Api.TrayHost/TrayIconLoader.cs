#if WINDOWS
using System.Drawing;

namespace OrganizedJihad.Api.TrayHost;

internal static class TrayIconLoader {
	public static Icon? TryLoad() {
		try {
			var candidates = new[] {
				Path.Combine(AppContext.BaseDirectory, "Assets", "Icons", "oj-tray-alt-steel.ico"),
				Path.Combine(AppContext.BaseDirectory, "Assets", "Icons", "oj-tray-primary.ico"),
				Path.Combine(AppContext.BaseDirectory, "oj-tray-alt-steel.ico"),
				Path.Combine(AppContext.BaseDirectory, "oj-tray-primary.ico"),
			};

			var iconPath = candidates.FirstOrDefault(File.Exists);
			if (string.IsNullOrWhiteSpace(iconPath)) {
				return null;
			}

			return new Icon(iconPath);
		} catch {
			return null;
		}
	}
}
#endif
