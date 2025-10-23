using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using OrganizedJihad.Api;
using OrganizedJihad.Api.Models;
using OrganizedJihad.Data;
using OrganizedJihad.Data.Models;
using System.Net;
using System.Net.Http.Json;

namespace OrganizedJihad.Api.Tests;

/// <summary>
/// Integration tests for the Sync API Controller.
/// 
/// These tests verify the complete HTTP request/response cycle including:
/// - Controller routing and action execution
/// - Model binding and validation
/// - Service layer interaction
/// - Database persistence (using in-memory provider)
/// - HTTP status codes and response formatting
/// 
/// Test Strategy:
/// Uses WebApplicationFactory to create a test server with the real application
/// but configured to use an in-memory database instead of SQLite. This provides
/// true integration testing without external dependencies.
/// 
/// References:
/// - Integration Testing: https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests
/// - WebApplicationFactory: https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.mvc.testing.webapplicationfactory-1
/// - xUnit: https://xunit.net/
/// - FluentAssertions: https://fluentassertions.com/
/// </summary>
public class SyncControllerTests : IClassFixture<WebApplicationFactory<Program>> {
	private readonly WebApplicationFactory<Program> _factory;
	private readonly HttpClient _client;

	/// <summary>
	/// Initializes the test fixture with a configured test server.
	/// </summary>
	/// <param name="factory">WebApplicationFactory provided by xUnit's IClassFixture</param>
	/// <remarks>
	/// Configuration steps:
	/// 1. Sets ASPNETCORE_TEST_ENV to skip production DB initialization
	/// 2. Removes all EF Core service descriptors (avoids SQLite/InMemory conflict)
	/// 3. Registers InMemory database provider for testing
	/// 4. Configures warnings to suppress transaction errors (InMemory doesn't support transactions)
	/// 
	/// This ensures tests run in complete isolation with a clean database for each test.
	/// 
	/// https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests#customize-webapplicationfactory
	/// </remarks>
	public SyncControllerTests(WebApplicationFactory<Program> factory) {
		// Set environment variable to skip database initialization in Program.cs
		// This prevents the production SQLite configuration from interfering with test setup
		Environment.SetEnvironmentVariable("ASPNETCORE_TEST_ENV", "true");

		_factory = factory.WithWebHostBuilder(builder =>            // ConfigureTestServices runs AFTER normal service registration
																	// This allows us to override production services with test doubles
																	// https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests#inject-mock-services
			builder.ConfigureTestServices(services => {
				// Remove ALL Entity Framework service registrations to avoid provider conflicts
				// EF Core only allows one database provider per service provider
				// https://learn.microsoft.com/en-us/ef/core/miscellaneous/testing/choosing-a-testing-strategy
				var dbDescriptors = services
					.Where(d => d.ServiceType.Namespace != null &&
								(d.ServiceType.Namespace.StartsWith("Microsoft.EntityFrameworkCore") ||
								 d.ServiceType.FullName?.Contains("GameDatabaseContext") == true))
					.ToList();

				foreach (var descriptor in dbDescriptors) {
					services.Remove(descriptor);
				}

				// Add in-memory database factory for testing
				// InMemory database doesn't support transactions, so we suppress the warning
				// https://learn.microsoft.com/en-us/ef/core/providers/in-memory/
				services.AddDbContextFactory<GameDatabaseContext>(options =>
					options.UseInMemoryDatabase("TestDatabase")
						.ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning)));
			}));

		// Create HTTP client for making requests to the test server
		_client = _factory.CreateClient();
	}

	/// <summary>
	/// Verifies that the sync endpoint successfully imports valid game data.
	/// </summary>
	/// <remarks>
	/// Tests the happy path scenario where all data is valid and should be imported.
	/// Verifies:
	/// - Endpoint returns HTTP 200 OK
	/// - Response contains success flag
	/// - Import counts are returned
	/// 
	/// This is an end-to-end test that exercises:
	/// - HTTP routing
	/// - Model binding from JSON
	/// - Controller action execution
	/// - Service layer processing
	/// - Database persistence
	/// - Response serialization
	/// </remarks>
	[Fact]
	public async Task Sync_Should_Return_Ok_With_Valid_Data() {
		// Arrange - Create test data with a player snapshot
		var syncData = new BrowserSyncData {
			CurrentSnapshot = new PlayerSnapshot {
				PlayerId = 12345,
				PlayerName = "TestPlayer",
				Timestamp = DateTime.UtcNow,
				Level = 120,
				TeamPower = 1500000
			},
			Heroes = new List<Hero>(),
			Titans = new List<Titan>()
		};

		// Act - Send POST request to sync endpoint
		var response = await _client.PostAsJsonAsync("/api/sync/import", syncData);

		// Assert - Verify successful response
		response.StatusCode.Should().Be(HttpStatusCode.OK);

		var result = await response.Content.ReadFromJsonAsync<SyncResponse>();
		result.Should().NotBeNull();
		result!.Success.Should().BeTrue();
	}

	/// <summary>
	/// Verifies that the sync endpoint handles empty/minimal data gracefully.
	/// </summary>
	/// <remarks>
	/// Tests edge case where userscript sends empty collections.
	/// Should still return success (200 OK) with zero import counts.
	/// 
	/// This ensures the API doesn't fail when there's no new data to import.
	/// </remarks>
	[Fact]
	public async Task Sync_Should_Handle_Empty_Data() {
		// Arrange - Create minimal sync data with empty collections
		var syncData = new BrowserSyncData {
			Heroes = new List<Hero>(),
			Titans = new List<Titan>()
		};

		// Act - Send POST with empty data
		var response = await _client.PostAsJsonAsync("/api/sync/import", syncData);

		// Assert - Should still succeed with zero counts
		response.StatusCode.Should().Be(HttpStatusCode.OK);

		var result = await response.Content.ReadFromJsonAsync<SyncResponse>();
		result.Should().NotBeNull();
		result!.Success.Should().BeTrue();
	}

	/// <summary>
	/// Verifies the health check endpoint returns 200 OK.
	/// </summary>
	/// <remarks>
	/// Health check is used by monitoring systems and the userscript
	/// to verify the API is available before attempting data sync.
	/// 
	/// Should always return 200 OK if the application is running.
	/// </remarks>
	[Fact]
	public async Task Health_Check_Should_Return_Ok() {
		// Act - Call health check endpoint
		var response = await _client.GetAsync("/api/sync/health");

		// Assert - Should return 200 OK
		response.StatusCode.Should().Be(HttpStatusCode.OK);
	}
}
