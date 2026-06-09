namespace OrganizedJihad.Api.Models.Ui;

/// <summary>
/// Response payload for runtime version diagnostics.
/// </summary>
/// <param name="ApiVersion">Assembly version of the running API process.</param>
/// <param name="ApiInformationalVersion">Informational build/version string of the running API process.</param>
/// <param name="UserscriptVersion">Installed userscript metadata version parsed from script header.</param>
/// <param name="UserscriptPath">Resolved installed userscript path under install root.</param>
/// <param name="CheckedUtc">UTC timestamp when this payload was generated.</param>
public sealed record ApiUiRuntimeVersionsResponse(
	string ApiVersion,
	string ApiInformationalVersion,
	string UserscriptVersion,
	string UserscriptPath,
	DateTime CheckedUtc);
