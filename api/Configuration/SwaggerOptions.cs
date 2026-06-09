namespace OrganizedJihad.Api.Configuration;

/// <summary>
/// Configuration values for OpenAPI and API documentation exposure.
/// </summary>
public sealed class SwaggerOptions {
	/// <summary>
	/// Enables OpenAPI generation and Scalar API documentation endpoints.
	/// </summary>
	public bool Enabled { get; set; } = true;

	/// <summary>
	/// Legacy toggle retained for compatibility with existing configuration payloads.
	/// </summary>
	public bool EnableUiInProduction { get; set; }
}
