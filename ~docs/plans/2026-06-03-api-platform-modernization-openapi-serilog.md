# API Platform Modernization Plan - OpenAPI + Serilog + API Call Telemetry

## Related Issues
- Epic: #341
- Child: #342 OpenAPI/Swagger
- Child: #343 Serilog rolling file retention
- Child: #344 API call telemetry and exception context logging

## Goals
- Expose a stable OpenAPI document route for API consumers.
- Move runtime logging to Serilog with structured rolling file output.
- Capture API method/path/status/timing in request pipeline logs.
- Capture endpoint-level action context and exception metadata in a centralized filter.

## Implemented Design
### OpenAPI
- Register OpenAPI with `AddOpenApi()` during service composition.
- Map OpenAPI JSON output at `/swagger/v1/swagger.json`.
- Gate OpenAPI mapping with configuration section `Swagger:Enabled`.

### Serilog
- Use `builder.Host.UseSerilog(...)` to read logging configuration from appsettings.
- Configure daily rolling file logs at `Logs/api-.log`.
- Apply 30-day retention policy via `retainedFileCountLimit: 30`.
- Keep Microsoft/System overrides at warning level in base appsettings.

### API Call Logging
- Middleware (`ApiCallLoggingMiddleware`) logs:
	- request method/path/query
	- response status code
	- elapsed milliseconds
	- trace identifier
- Optional debug-level body logging:
	- request and response body snippets
	- size capped by `ApiCallLogging:MaxLoggedBodyBytes`
	- content-type filtered for JSON/text
	- excluded path support from config

### Action-Level Logging
- Global MVC action filter (`ApiActionLoggingFilter`) logs:
	- action display name, method, path
	- argument names at debug level
	- completion status code and trace id
	- explicit exception logging with action context

## Configuration Contract
### `appsettings.json`
- `Serilog` section for sink and retention policy.
- `Swagger` section for OpenAPI toggle.
- `ApiCallLogging` section for body limits and exclusions.

### `appsettings.Development.json`
- Raises Serilog minimum level to debug.
- Increases body capture size limit for local debugging.

## Validation Checklist
- `dotnet build OrganizedJihad.sln` passes.
- `dotnet test tests/OrganizedJihad.Api.Tests/OrganizedJihad.Api.Tests.csproj --filter FullyQualifiedName~SyncControllerTests` passes.
- `dotnet test tests/OrganizedJihad.Api.Tests/OrganizedJihad.Api.Tests.csproj` passes.

## Follow-Up Hardening (Same Session)
- Added integration test coverage for OpenAPI route shape at `/swagger/v1/swagger.json`.
- Added API telemetry correlation-id propagation behavior:
	- consumes `X-Correlation-ID` request header when provided
	- falls back to request trace identifier when absent
	- echoes effective correlation id in `X-Correlation-ID` response header
- Added integration test for correlation-id echo behavior on non-excluded API paths.

## Notes
- Swashbuckle package was not used due .NET 10 preview compatibility failures in integration-test host startup.
- Built-in ASP.NET OpenAPI support is used for stable generation and routing.
