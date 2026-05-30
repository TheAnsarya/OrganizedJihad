/// <summary>
/// OrganizedJihad API - Hero Wars Game Data Tracking Backend.
///
/// This file is intentionally kept as a thin composition root. Service registration,
/// middleware wiring, and endpoint mapping are delegated to dedicated classes.
/// </summary>

using OrganizedJihad.Api.Endpoints;
using OrganizedJihad.Api.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Registers all previous Program.cs service wiring:
// CORS, DbContextFactory, HttpClient, SyncService, and UI/diagnostics services.
builder.Services.AddApiComposition();

var app = builder.Build();

await app.InitializeDatabaseAsync();

app.UseCors();
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
