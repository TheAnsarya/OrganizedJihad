namespace OrganizedJihad.Api.Configuration;

/// <summary>
/// Configuration values for API request/response telemetry logging.
/// </summary>
public sealed class ApiCallLoggingOptions {
	/// <summary>
	/// Enables API call logging middleware.
	/// </summary>
	public bool Enabled { get; set; } = true;

	/// <summary>
	/// Maximum request/response body payload bytes logged at debug level.
	/// </summary>
	public int MaxLoggedBodyBytes { get; set; } = 4096;

	/// <summary>
	/// Logs request bodies at debug level when true.
	/// </summary>
	public bool LogRequestBodyOnDebug { get; set; } = true;

	/// <summary>
	/// Logs response bodies at debug level when true.
	/// </summary>
	public bool LogResponseBodyOnDebug { get; set; } = true;

	/// <summary>
	/// Paths that should bypass detailed API call logging.
	/// </summary>
	public List<string> ExcludedPaths { get; set; } = [];
}
