#if WINDOWS
using System.Drawing;
using System.Runtime.InteropServices;

namespace OrganizedJihad.Api.TrayHost;

internal static class TrayIconLoader {
	public static Icon? TryLoad() {
		try {
			var icoCandidates = new[] {
				Path.Combine(AppContext.BaseDirectory, "Assets", "Icons", "oj-tray-alt-steel.ico"),
				Path.Combine(AppContext.BaseDirectory, "Assets", "Icons", "oj-tray-alt-steel-glyph.ico"),
				Path.Combine(AppContext.BaseDirectory, "Assets", "Icons", "oj-tray-primary.ico"),
				Path.Combine(AppContext.BaseDirectory, "Assets", "Icons", "oj-tray-alt-gold.ico"),
				Path.Combine(AppContext.BaseDirectory, "Assets", "Icons", "oj-tray-fun-shield.ico"),
				Path.Combine(AppContext.BaseDirectory, "Assets", "Icons", "oj-tray-fun-orb.ico"),
				Path.Combine(AppContext.BaseDirectory, "oj-tray-alt-steel.ico"),
				Path.Combine(AppContext.BaseDirectory, "oj-tray-primary.ico"),
				Path.Combine(AppContext.BaseDirectory, "oj-tray-alt-gold.ico"),
			};

			var iconPath = icoCandidates.FirstOrDefault(File.Exists);
			if (!string.IsNullOrWhiteSpace(iconPath)) {
				return new Icon(iconPath);
			}

			var pngCandidates = new[] {
				Path.Combine(AppContext.BaseDirectory, "Assets", "Icons", "oj-tray-alt-steel.png"),
				Path.Combine(AppContext.BaseDirectory, "Assets", "Icons", "oj-tray-alt-steel-glyph.png"),
				Path.Combine(AppContext.BaseDirectory, "Assets", "Icons", "oj-tray-primary.png"),
				Path.Combine(AppContext.BaseDirectory, "Assets", "Icons", "oj-tray-alt-gold.png"),
				Path.Combine(AppContext.BaseDirectory, "Assets", "Icons", "oj-tray-fun-shield.png"),
				Path.Combine(AppContext.BaseDirectory, "Assets", "Icons", "oj-tray-fun-orb.png"),
				Path.Combine(AppContext.BaseDirectory, "oj-tray-alt-steel.png"),
				Path.Combine(AppContext.BaseDirectory, "oj-tray-primary.png"),
				Path.Combine(AppContext.BaseDirectory, "oj-tray-alt-gold.png"),
			};

			var pngPath = pngCandidates.FirstOrDefault(File.Exists);
			if (string.IsNullOrWhiteSpace(pngPath)) {
				return null;
			}

			using var bitmap = new Bitmap(pngPath);
			var hIcon = bitmap.GetHicon();
			try {
				using var tempIcon = Icon.FromHandle(hIcon);
				return (Icon)tempIcon.Clone();
			} finally {
				DestroyIcon(hIcon);
			}
		} catch {
			return null;
		}
	}

	[DllImport("user32.dll", SetLastError = true)]
	private static extern bool DestroyIcon(IntPtr hIcon);
}
#endif
