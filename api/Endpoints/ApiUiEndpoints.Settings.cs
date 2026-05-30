using OrganizedJihad.Api.Models.Ui;
using OrganizedJihad.Api.Services.Ui;

namespace OrganizedJihad.Api.Endpoints;

public static partial class ApiUiEndpoints {
	private static void MapSettingsEndpoints(IEndpointRouteBuilder endpoints) {
		endpoints.MapGet("/ui/settings", (HttpContext context, ApiUiAccessPolicy accessPolicy, ApiUiSettingsStore settingsStore, ILoggerFactory loggerFactory) => {
			if (!accessPolicy.IsLocalRequest(context)) {
				return Results.StatusCode(StatusCodes.Status403Forbidden);
			}

			var settings = settingsStore.TryLoad() ?? settingsStore.CreateDefault();
			loggerFactory.CreateLogger("ApiUiEndpoints").LogInformation("UI settings fetched from {SettingsPath}", settingsStore.SettingsPath);
			return Results.Ok(settings);
		});

		endpoints.MapPost("/ui/settings", async (HttpContext context, ApiUiSettingsUpdateRequest request, ApiUiAccessPolicy accessPolicy, ApiUiSettingsStore settingsStore, ILoggerFactory loggerFactory) => {
			if (!accessPolicy.IsLocalRequest(context)) {
				return Results.StatusCode(StatusCodes.Status403Forbidden);
			}

			var defaultApiBaseUrl = GetRequestBaseUrl(context);
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

			await settingsStore.SaveAsync(normalized);
			loggerFactory.CreateLogger("ApiUiEndpoints").LogInformation("UI settings saved at {UpdatedUtc} from {RemoteIp}", normalized.UpdatedUtc, context.Connection.RemoteIpAddress);
			return Results.Ok(normalized);
		});
	}
}
