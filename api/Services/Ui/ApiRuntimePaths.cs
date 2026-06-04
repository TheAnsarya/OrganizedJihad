namespace OrganizedJihad.Api.Services.Ui;

/// <summary>
/// Resolves runtime paths used by the API for database and local UI state files.
/// </summary>
public sealed class ApiRuntimePaths {
	/// <summary>
	/// Gets the resolved database path.
	/// </summary>
	public string DatabasePath { get; }

	/// <summary>
	/// Gets the resolved UI settings path.
	/// </summary>
	public string UiSettingsPath { get; }

	/// <summary>
	/// Gets the expected install root in LocalApplicationData.
	/// </summary>
	public string InstallRoot { get; }

	private ApiRuntimePaths(string databasePath, string uiSettingsPath, string installRoot) {
		DatabasePath = databasePath;
		UiSettingsPath = uiSettingsPath;
		InstallRoot = installRoot;
	}

	/// <summary>
	/// Creates runtime path values from environment variables and defaults.
	/// </summary>
	public static ApiRuntimePaths FromEnvironment() {
		var dbPathOverride = Environment.GetEnvironmentVariable("OJ_DB_PATH");
		var uiSettingsOverride = Environment.GetEnvironmentVariable("OJ_API_UI_SETTINGS_PATH");

		var dbPath = string.IsNullOrWhiteSpace(dbPathOverride)
			? Path.Combine(AppContext.BaseDirectory, "herowars.db")
			: dbPathOverride;

		var uiSettingsPath = string.IsNullOrWhiteSpace(uiSettingsOverride)
			? Path.Combine(AppContext.BaseDirectory, "api-ui-settings.json")
			: uiSettingsOverride;

		var installRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OrganizedJihad");
		return new ApiRuntimePaths(dbPath, uiSettingsPath, installRoot);
	}
}
