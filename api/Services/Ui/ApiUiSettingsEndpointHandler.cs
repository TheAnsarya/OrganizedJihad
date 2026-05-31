using OrganizedJihad.Api.Models.Ui;

namespace OrganizedJihad.Api.Services.Ui;

/// <summary>
/// Handles persisted API UI settings endpoints.
/// </summary>
public sealed class ApiUiSettingsEndpointHandler {
	private readonly ApiUiAccessPolicy _accessPolicy;
	private readonly ApiUiSettingsStore _settingsStore;
	private readonly ILogger<ApiUiSettingsEndpointHandler> _logger;

	/// <summary>
	/// Initializes a new instance of the settings endpoint handler.
	/// </summary>
	public ApiUiSettingsEndpointHandler(
		ApiUiAccessPolicy accessPolicy,
		ApiUiSettingsStore settingsStore,
		ILogger<ApiUiSettingsEndpointHandler> logger) {
		_accessPolicy = accessPolicy;
		_settingsStore = settingsStore;
		_logger = logger;
	}

	/// <summary>
	/// Handles GET /ui/settings.
	/// </summary>
	public IResult GetSettings(HttpContext context) {
		if (!_accessPolicy.IsLocalRequest(context)) {
			return Results.StatusCode(StatusCodes.Status403Forbidden);
		}

		var settings = _settingsStore.TryLoad() ?? _settingsStore.CreateDefault();
		_logger.LogInformation("UI settings fetched from {SettingsPath}", _settingsStore.SettingsPath);
		return Results.Ok(settings);
	}

	/// <summary>
	/// Handles POST /ui/settings.
	/// </summary>
	public async Task<IResult> SaveSettingsAsync(HttpContext context, ApiUiSettingsUpdateRequest request) {
		if (!_accessPolicy.IsLocalRequest(context)) {
			return Results.StatusCode(StatusCodes.Status403Forbidden);
		}

		var defaultApiBaseUrl = $"{context.Request.Scheme}://{context.Request.Host}";
		if (!ApiUiInputNormalizer.TryNormalizeLocalApiUrl(request.ApiBaseUrl, defaultApiBaseUrl, out var normalizedApiBaseUrl, out var apiBaseUrlError)) {
			return Results.BadRequest(new { error = apiBaseUrlError });
		}

		if (!ApiUiInputNormalizer.TryNormalizeHeroWarsUrl(request.PreferredHeroWarsUrl, out var normalizedHeroWarsUrl, out var heroWarsError)) {
			return Results.BadRequest(new { error = heroWarsError });
		}

		var normalizedNotes = (request.Notes ?? string.Empty).Trim();
		if (normalizedNotes.Length > 2048) {
			return Results.BadRequest(new { error = "Notes must be 2048 characters or less." });
		}

		var normalized = new ApiUiSettings(
			AutoOpenHealthOnLoad: request.AutoOpenHealthOnLoad,
			ApiBaseUrl: normalizedApiBaseUrl,
			PreferredHeroWarsUrl: normalizedHeroWarsUrl,
			Notes: normalizedNotes,
			UpdatedUtc: DateTime.UtcNow);

		await _settingsStore.SaveAsync(normalized);
		_logger.LogInformation("UI settings saved at {UpdatedUtc} from {RemoteIp}", normalized.UpdatedUtc, context.Connection.RemoteIpAddress);
		return Results.Ok(normalized);
	}
}
