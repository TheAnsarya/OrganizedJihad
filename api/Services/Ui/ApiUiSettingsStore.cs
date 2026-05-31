using OrganizedJihad.Api.Models.Ui;
using System.Text.Json;

namespace OrganizedJihad.Api.Services.Ui;

/// <summary>
/// Persists local API UI settings as JSON on disk.
/// </summary>
public sealed class ApiUiSettingsStore {
	private readonly ApiRuntimePaths _runtimePaths;

	/// <summary>
	/// Initializes a new instance of the settings store.
	/// </summary>
	public ApiUiSettingsStore(ApiRuntimePaths runtimePaths) {
		_runtimePaths = runtimePaths;
	}

	/// <summary>
	/// Returns the settings file path.
	/// </summary>
	public string SettingsPath => _runtimePaths.UiSettingsPath;

	/// <summary>
	/// Returns default settings when no persisted settings are available.
	/// </summary>
	public ApiUiSettings CreateDefault() {
		return new ApiUiSettings(
			AutoOpenHealthOnLoad: true,
			ApiBaseUrl: "http://localhost:5124",
			PreferredHeroWarsUrl: "https://www.hero-wars.com/",
			Notes: string.Empty,
			UpdatedUtc: DateTime.UtcNow);
	}

	/// <summary>
	/// Attempts to load settings from disk.
	/// </summary>
	public ApiUiSettings? TryLoad() {
		if (!File.Exists(SettingsPath)) {
			return null;
		}

		try {
			var raw = File.ReadAllText(SettingsPath);
			return JsonSerializer.Deserialize<ApiUiSettings>(raw);
		} catch {
			return null;
		}
	}

	/// <summary>
	/// Saves settings to disk.
	/// </summary>
	public async Task SaveAsync(ApiUiSettings settings) {
		var directory = Path.GetDirectoryName(SettingsPath);
		if (!string.IsNullOrWhiteSpace(directory)) {
			Directory.CreateDirectory(directory);
		}

		var json = JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = true });
		var tempPath = SettingsPath + ".tmp";
		await File.WriteAllTextAsync(tempPath, json);

		if (File.Exists(SettingsPath)) {
			File.Replace(tempPath, SettingsPath, destinationBackupFileName: null, ignoreMetadataErrors: true);
			return;
		}

		File.Move(tempPath, SettingsPath);
	}
}
