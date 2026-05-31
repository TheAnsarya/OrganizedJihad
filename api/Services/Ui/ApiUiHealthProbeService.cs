namespace OrganizedJihad.Api.Services.Ui;

/// <summary>
/// Probes API health endpoint state for local UI diagnostics pages.
/// </summary>
public sealed class ApiUiHealthProbeService {
	private readonly IHttpClientFactory _httpClientFactory;

	/// <summary>
	/// Initializes a new instance of the health probe service.
	/// </summary>
	public ApiUiHealthProbeService(IHttpClientFactory httpClientFactory) {
		_httpClientFactory = httpClientFactory;
	}

	/// <summary>
	/// Probes /api/sync/health on the current request host and returns a status token.
	/// </summary>
	public async Task<string> ProbeStatusAsync(HttpContext context) {
		try {
			var probeUrl = $"{context.Request.Scheme}://{context.Request.Host}/api/sync/health";
			using var response = await _httpClientFactory.CreateClient("UiProbeClient").GetAsync(probeUrl);
			return response.IsSuccessStatusCode ? "online" : $"degraded ({(int)response.StatusCode})";
		} catch {
			return "offline";
		}
	}
}
