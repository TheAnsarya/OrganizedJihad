/// <summary>
/// OrganizedJihad API - Hero Wars Game Data Tracking Backend.
///
/// This file is intentionally kept as a thin composition root. Service registration,
/// middleware wiring, and endpoint mapping are delegated to dedicated classes.
/// </summary>

using Microsoft.Extensions.Options;
using OrganizedJihad.Api.Configuration;
using OrganizedJihad.Api.Endpoints;
using OrganizedJihad.Api.Extensions;
using OrganizedJihad.Api.Middleware;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, _, loggerConfiguration) => {
	loggerConfiguration
		.ReadFrom.Configuration(context.Configuration)
		.Enrich.FromLogContext();
});

// Registers all previous Program.cs service wiring:
// CORS, DbContextFactory, HttpClient, SyncService, and UI/diagnostics services.
builder.Services.AddApiComposition(builder.Configuration);

var app = builder.Build();

var swaggerOptions = app.Services.GetRequiredService<IOptions<SwaggerOptions>>().Value;

await app.InitializeDatabaseAsync();

if (swaggerOptions.Enabled) {
	app.MapOpenApi("/swagger/v1/swagger.json");
}

app.UseSerilogRequestLogging();
app.UseCors();
app.UseMiddleware<ApiCallLoggingMiddleware>();
app.UseUiSecurityHeaders();

app.MapControllers();
// Maps all previous /ui* endpoints and their logic via extracted endpoint modules.
app.MapApiUiEndpoints();
// Maps the previous root info endpoint.
app.MapSystemEndpoints();

app.Run();

// Make the implicit Program class public for integration testing
// https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests
public partial class Program { }
