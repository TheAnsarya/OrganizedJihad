using OrganizedJihad.Api.Models.Ui;
using System.Net;

namespace OrganizedJihad.Api.Services.Ui;

/// <summary>
/// Builds encoded replacement token maps for UI templates.
/// </summary>
public sealed class ApiUiPageTokenBuilder {
	private readonly ApiLocalUrlBuilder _localUrlBuilder;

	/// <summary>
	/// Initializes a new instance of the page token builder.
	/// </summary>
	public ApiUiPageTokenBuilder(ApiLocalUrlBuilder localUrlBuilder) {
		_localUrlBuilder = localUrlBuilder;
	}

	/// <summary>
	/// Builds replacement tokens for the /ui page.
	/// </summary>
	public Dictionary<string, string> BuildUiTokens(HttpContext context) {
		var baseUrl = _localUrlBuilder.BuildLocalBaseUrl(context);
		return new Dictionary<string, string> {
			["__BASE_URL__"] = WebUtility.HtmlEncode(baseUrl),
		};
	}

	/// <summary>
	/// Builds replacement tokens for the /ui/tray-health page.
	/// </summary>
	public Dictionary<string, string> BuildTrayHealthTokens(HttpContext context, string healthStatus, UserscriptHandshakeStatus handshake, DateTime nowUtc) {
		var baseUrl = _localUrlBuilder.BuildLocalBaseUrl(context);
		return new Dictionary<string, string> {
			["__BASE_URL__"] = WebUtility.HtmlEncode(baseUrl),
			["__HEALTH_STATUS__"] = WebUtility.HtmlEncode(healthStatus),
			["__CHECKED_UTC__"] = WebUtility.HtmlEncode(nowUtc.ToString("yyyy-MM-dd HH:mm:ss")),
			["__HANDSHAKE_STATUS__"] = WebUtility.HtmlEncode(handshake.Status),
			["__LAST_SYNC_UTC__"] = WebUtility.HtmlEncode(handshake.LastSyncUtc is null ? "none" : handshake.LastSyncUtc.Value.ToString("u")),
		};
	}
}
