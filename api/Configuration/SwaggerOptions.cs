namespace OrganizedJihad.Api.Configuration;

/// <summary>
/// Configuration values for OpenAPI/Swagger exposure.
/// </summary>
public sealed class SwaggerOptions {
	/// <summary>
	/// Enables OpenAPI generation and Swagger middleware.
	/// </summary>
	public bool Enabled { get; set; } = true;

	/// <summary>
	/// Enables Swagger UI outside Development when true.
	/// </summary>
	public bool EnableUiInProduction { get; set; }
}
