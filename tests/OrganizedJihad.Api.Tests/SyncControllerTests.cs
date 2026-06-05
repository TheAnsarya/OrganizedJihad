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
using System.Text.Json;

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

	/// <summary>
	/// Verifies OpenAPI JSON endpoint is available and exposes required document fields.
	/// </summary>
	[Fact]
	public async Task OpenApi_Document_Should_Be_Available_At_Swagger_Json_Route() {
		var response = await _client.GetAsync("/swagger/v1/swagger.json");
		response.StatusCode.Should().Be(HttpStatusCode.OK);

		var body = await response.Content.ReadAsStringAsync();
		using var document = JsonDocument.Parse(body);
		var root = document.RootElement;

		root.TryGetProperty("openapi", out var openApiVersion).Should().BeTrue();
		openApiVersion.GetString().Should().NotBeNullOrWhiteSpace();
		root.TryGetProperty("info", out var info).Should().BeTrue();
		info.TryGetProperty("title", out _).Should().BeTrue();
		root.TryGetProperty("paths", out var paths).Should().BeTrue();
		paths.ValueKind.Should().Be(JsonValueKind.Object);
	}

	/// <summary>
	/// Verifies local Swagger UI route serves HTML content.
	/// </summary>
	[Theory]
	[InlineData("/swagger")]
	[InlineData("/swagger/index.html")]
	public async Task Swagger_Ui_Route_Should_Return_Html(string route) {
		var response = await _client.GetAsync(route);
		var body = await response.Content.ReadAsStringAsync();

		response.StatusCode.Should().Be(HttpStatusCode.OK);
		response.Content.Headers.ContentType.Should().NotBeNull();
		response.Content.Headers.ContentType!.MediaType.Should().Be("text/html");
		body.Should().Contain("SwaggerUIBundle");
		body.Should().Contain("/swagger/v1/swagger.json");
	}

	/// <summary>
	/// Verifies middleware preserves caller correlation id and echoes it in response headers.
	/// </summary>
	[Fact]
	public async Task Api_Should_Echo_Correlation_Id_Header_On_Api_Calls() {
		using var request = new HttpRequestMessage(HttpMethod.Get, "/api/sync/tools/catalog");
		request.Headers.Add("X-Correlation-ID", "test-correlation-id-123");

		var response = await _client.SendAsync(request);

		response.StatusCode.Should().Be(HttpStatusCode.OK);
		response.Headers.TryGetValues("X-Correlation-ID", out var values).Should().BeTrue();
		values.Should().ContainSingle().Which.Should().Be("test-correlation-id-123");
	}

	/// <summary>
	/// Verifies the API control UI route serves HTML content.
	/// </summary>
	[Fact]
	public async Task Api_Ui_Route_Should_Return_Html() {
		// Act
		var response = await _client.GetAsync("/ui");
		var body = await response.Content.ReadAsStringAsync();

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		response.Content.Headers.ContentType.Should().NotBeNull();
		response.Content.Headers.ContentType!.MediaType.Should().Be("text/html");
		body.Should().Contain("OrganizedJihad API Control");
		body.Should().Contain("/ui/settings");
		body.Should().Contain("Health Status Mode");
		body.Should().Contain("Open Health Dashboard");
		body.Should().Contain("Open Swagger UI");
		body.Should().Contain("Open Latest Daily Report JSON");
		body.Should().Contain("Open Daily Report History JSON");
		body.Should().Contain("Export Daily Report CSV");
		body.Should().Contain("Generate Daily Report Now");
		body.Should().Contain("🟢 Good");
		body.Should().Contain("🔴 Bad");
	}

	/// <summary>
	/// Verifies API UI settings endpoint returns a settings payload.
	/// </summary>
	[Fact]
	public async Task Api_Ui_Settings_Should_Return_Payload() {
		// Act
		var response = await _client.GetAsync("/ui/settings");
		var json = await response.Content.ReadAsStringAsync();

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		using var document = JsonDocument.Parse(json);
		var root = document.RootElement;
		root.TryGetProperty("autoOpenHealthOnLoad", out _).Should().BeTrue();
		root.TryGetProperty("apiBaseUrl", out _).Should().BeTrue();
		root.TryGetProperty("preferredHeroWarsUrl", out _).Should().BeTrue();
		root.TryGetProperty("updatedUtc", out _).Should().BeTrue();
	}

	/// <summary>
	/// Verifies userscript handshake diagnostics endpoint returns status payload.
	/// </summary>
	[Fact]
	public async Task Api_Ui_Userscript_Handshake_Should_Return_Payload() {
		// Act
		var response = await _client.GetAsync("/ui/userscript-handshake");
		var json = await response.Content.ReadAsStringAsync();

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		using var document = JsonDocument.Parse(json);
		var root = document.RootElement;
		root.TryGetProperty("status", out _).Should().BeTrue();
		root.TryGetProperty("hasRecentSync", out _).Should().BeTrue();
		root.TryGetProperty("checkedUtc", out _).Should().BeTrue();
	}

	/// <summary>
	/// Verifies latest API logs endpoint returns plain-text output for local requests.
	/// </summary>
	[Fact]
	public async Task Api_Ui_Latest_Logs_Should_Return_PlainText() {
		// Act
		var response = await _client.GetAsync("/ui/logs/latest");

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		response.Content.Headers.ContentType.Should().NotBeNull();
		response.Content.Headers.ContentType!.MediaType.Should().Be("text/plain");
	}

	/// <summary>
	/// Verifies daily report endpoint returns JSON payload with expected fields.
	/// </summary>
	[Fact]
	public async Task Api_Ui_Daily_Report_Should_Return_Payload() {
		// Act
		var response = await _client.GetAsync("/ui/daily-report");
		var json = await response.Content.ReadAsStringAsync();

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		using var document = JsonDocument.Parse(json);
		var root = document.RootElement;
		root.TryGetProperty("dateUtc", out _).Should().BeTrue();
		root.TryGetProperty("checkedUtc", out _).Should().BeTrue();
		root.TryGetProperty("lastSyncUtc", out _).Should().BeTrue();
		root.TryGetProperty("battlesTracked", out _).Should().BeTrue();
		root.TryGetProperty("questCompletions", out _).Should().BeTrue();
		root.TryGetProperty("resourceTransactions", out _).Should().BeTrue();
	}

	/// <summary>
	/// Verifies daily report generate endpoint persists and returns payload.
	/// </summary>
	[Fact]
	public async Task Api_Ui_Daily_Report_Generate_Should_Return_Payload() {
		var response = await _client.PostAsync("/ui/daily-report/generate", content: null);
		var json = await response.Content.ReadAsStringAsync();

		response.StatusCode.Should().Be(HttpStatusCode.OK);
		using var document = JsonDocument.Parse(json);
		var root = document.RootElement;
		root.TryGetProperty("dateUtc", out _).Should().BeTrue();
		root.TryGetProperty("checkedUtc", out _).Should().BeTrue();
		root.TryGetProperty("battlesTracked", out _).Should().BeTrue();
	}

	/// <summary>
	/// Verifies latest daily report endpoint returns persisted/generated payload.
	/// </summary>
	[Fact]
	public async Task Api_Ui_Daily_Report_Latest_Should_Return_Payload() {
		var generateResponse = await _client.PostAsync("/ui/daily-report/generate", content: null);
		generateResponse.StatusCode.Should().Be(HttpStatusCode.OK);

		var response = await _client.GetAsync("/ui/daily-report/latest");
		var json = await response.Content.ReadAsStringAsync();

		response.StatusCode.Should().Be(HttpStatusCode.OK);
		using var document = JsonDocument.Parse(json);
		var root = document.RootElement;
		root.TryGetProperty("dateUtc", out _).Should().BeTrue();
		root.TryGetProperty("checkedUtc", out _).Should().BeTrue();
	}

	/// <summary>
	/// Verifies daily report history endpoint returns a history payload with report list.
	/// </summary>
	[Fact]
	public async Task Api_Ui_Daily_Report_History_Should_Return_Payload() {
		var generateResponse = await _client.PostAsync("/ui/daily-report/generate", content: null);
		generateResponse.StatusCode.Should().Be(HttpStatusCode.OK);

		var response = await _client.GetAsync("/ui/daily-report/history?limit=10");
		var json = await response.Content.ReadAsStringAsync();

		response.StatusCode.Should().Be(HttpStatusCode.OK);
		using var document = JsonDocument.Parse(json);
		var root = document.RootElement;
		root.TryGetProperty("generatedAtUtc", out _).Should().BeTrue();
		root.TryGetProperty("retainedDays", out _).Should().BeTrue();
		root.TryGetProperty("reports", out var reports).Should().BeTrue();
		reports.ValueKind.Should().Be(JsonValueKind.Array);
		reports.GetArrayLength().Should().BeGreaterThan(0);
	}

	/// <summary>
	/// Verifies daily report CSV export route returns CSV content.
	/// </summary>
	[Fact]
	public async Task Api_Ui_Daily_Report_Csv_Export_Should_Return_Csv() {
		var response = await _client.GetAsync("/ui/daily-report/export.csv");
		var body = await response.Content.ReadAsStringAsync();

		response.StatusCode.Should().Be(HttpStatusCode.OK);
		response.Content.Headers.ContentType.Should().NotBeNull();
		response.Content.Headers.ContentType!.MediaType.Should().Be("text/csv");
		body.Should().Contain("metric,value");
		body.Should().Contain("battlesTracked");
	}

	/// <summary>
	/// Verifies daily report page endpoint returns HTML content.
	/// </summary>
	[Fact]
	public async Task Api_Ui_Daily_Report_Page_Should_Return_Html() {
		// Act
		var response = await _client.GetAsync("/ui/daily-report-page");
		var body = await response.Content.ReadAsStringAsync();

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		response.Content.Headers.ContentType.Should().NotBeNull();
		response.Content.Headers.ContentType!.MediaType.Should().Be("text/html");
		body.Should().Contain("OrganizedJihad Daily Report");
		body.Should().Contain("Open Daily Report JSON");
	}

	/// <summary>
	/// Verifies reporting overview endpoint returns JSON payload with chart points.
	/// </summary>
	[Fact]
	public async Task Api_Ui_Reporting_Overview_Should_Return_Payload() {
		// Act
		var response = await _client.GetAsync("/ui/reporting-overview");
		var json = await response.Content.ReadAsStringAsync();

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		using var document = JsonDocument.Parse(json);
		var root = document.RootElement;
		root.TryGetProperty("generatedAtUtc", out _).Should().BeTrue();
		root.TryGetProperty("lastSyncUtc", out _).Should().BeTrue();
		root.TryGetProperty("dailyPoints", out var dailyPoints).Should().BeTrue();
		dailyPoints.ValueKind.Should().Be(JsonValueKind.Array);
		dailyPoints.GetArrayLength().Should().Be(7);
	}

	/// <summary>
	/// Verifies reporting overview chart page route serves HTML content.
	/// </summary>
	[Fact]
	public async Task Api_Ui_Reporting_Overview_Page_Should_Return_Html() {
		// Act
		var response = await _client.GetAsync("/ui/reporting-overview-page");
		var body = await response.Content.ReadAsStringAsync();

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		response.Content.Headers.ContentType.Should().NotBeNull();
		response.Content.Headers.ContentType!.MediaType.Should().Be("text/html");
		body.Should().Contain("Reporting Overview");
		body.Should().Contain("Open Reporting Overview JSON");
	}

	/// <summary>
	/// Verifies latest API logs endpoint includes tail content when a log file exists.
	/// </summary>
	[Fact]
	public async Task Api_Ui_Latest_Logs_Should_Include_Expected_Log_Content() {
		// Arrange
		var logsDirectory = Path.Combine(AppContext.BaseDirectory, "Logs");
		Directory.CreateDirectory(logsDirectory);
		var marker = $"observability-wave-test-marker-{Guid.NewGuid():N}";
		var logPath = Path.Combine(logsDirectory, "api-99991231.log");
		await File.WriteAllTextAsync(logPath, $"line-1{Environment.NewLine}{marker}{Environment.NewLine}line-3");
		File.SetLastWriteTimeUtc(logPath, DateTime.UtcNow.AddMinutes(1));

		try {
			// Act
			var response = await _client.GetAsync("/ui/logs/latest");
			var body = await response.Content.ReadAsStringAsync();

			// Assert
			response.StatusCode.Should().Be(HttpStatusCode.OK);
			body.Should().Contain("Latest API log:");
			body.Should().Contain(marker);
		}
		finally {
			if (File.Exists(logPath)) {
				File.Delete(logPath);
			}
		}
	}

	/// <summary>
	/// Verifies UI settings endpoint rejects non-local API base URLs.
	/// </summary>
	[Fact]
	public async Task Api_Ui_Settings_Should_Reject_NonLocal_ApiBaseUrl() {
		// Act
		var response = await _client.PostAsJsonAsync("/ui/settings", new {
			autoOpenHealthOnLoad = true,
			apiBaseUrl = "https://example.com",
			preferredHeroWarsUrl = "https://www.hero-wars.com/",
			notes = "test",
		});

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
		var body = await response.Content.ReadAsStringAsync();
		body.Should().Contain("localhost/loopback");
	}

	/// <summary>
	/// Verifies recommendation endpoint returns ranked candidates including simulator fields.
	/// </summary>
	[Fact]
	public async Task Recommendations_Should_Return_Scored_Candidates_With_Simulation() {
		// Arrange - seed arena battles with repeated team keys so minSamples is satisfied
		var now = DateTime.UtcNow;
		var syncData = new BrowserSyncData {
			ArenaBattles = [
				new ArenaBattle {
					Timestamp = now.AddMinutes(-30),
					OpponentId = 1001,
					OpponentName = "Opponent A",
					OpponentPower = 900000,
					IsWin = true,
					RankBefore = 100,
					RankAfter = 95,
					OurTeam = "Astaroth,Keira,Sebastian,Jet,Martha",
					CoinsEarned = 20,
				},
				new ArenaBattle {
					Timestamp = now.AddMinutes(-20),
					OpponentId = 1002,
					OpponentName = "Opponent B",
					OpponentPower = 920000,
					IsWin = true,
					RankBefore = 95,
					RankAfter = 90,
					OurTeam = "Astaroth,Keira,Sebastian,Jet,Martha",
					CoinsEarned = 20,
				},
				new ArenaBattle {
					Timestamp = now.AddMinutes(-10),
					OpponentId = 1003,
					OpponentName = "Opponent C",
					OpponentPower = 880000,
					IsWin = false,
					RankBefore = 90,
					RankAfter = 92,
					OurTeam = "Corvus,Morrigan,Keira,Phobos,Dorian",
					CoinsEarned = 10,
				},
				new ArenaBattle {
					Timestamp = now.AddMinutes(-5),
					OpponentId = 1004,
					OpponentName = "Opponent D",
					OpponentPower = 910000,
					IsWin = true,
					RankBefore = 92,
					RankAfter = 89,
					OurTeam = "Corvus,Morrigan,Keira,Phobos,Dorian",
					CoinsEarned = 20,
				}
			],
			Heroes = [],
			Titans = []
		};

		var importResponse = await _client.PostAsJsonAsync("/api/sync/import", syncData);
		importResponse.StatusCode.Should().Be(HttpStatusCode.OK);

		// Act
		var response = await _client.GetAsync("/api/sync/battles/recommendations?battleType=arena&limit=3&minSamples=2");

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		var payload = await response.Content.ReadFromJsonAsync<BattleRecommendationResponse>();
		payload.Should().NotBeNull();
		payload!.BattleType.Should().Be("arena");
		payload.SampleCount.Should().BeGreaterThan(0);
		payload.Recommendations.Should().NotBeEmpty();

		var first = payload.Recommendations.First();
		first.Battles.Should().BeGreaterThanOrEqualTo(2);
		first.SimulationRuns.Should().BeGreaterThan(0);
		first.SimulatedWinProbability.Should().BeInRange(0d, 1d);
		first.SimulationConfidenceLow.Should().BeInRange(0d, 1d);
		first.SimulationConfidenceHigh.Should().BeInRange(0d, 1d);
		first.SimulationConfidenceLow.Should().BeLessThanOrEqualTo(first.SimulationConfidenceHigh);
	}

	/// <summary>
	/// Verifies invalid battleType query values are normalized to arena.
	/// </summary>
	[Fact]
	public async Task Recommendations_Should_Normalize_Invalid_BattleType_To_Arena() {
		// Arrange
		var syncData = new BrowserSyncData {
			ArenaBattles = [
				new ArenaBattle {
					Timestamp = DateTime.UtcNow,
					OpponentId = 2001,
					OpponentName = "Opponent X",
					OpponentPower = 500000,
					IsWin = true,
					RankBefore = 200,
					RankAfter = 180,
					OurTeam = "Aurora,Dante,Nebula,Iris,Martha",
					CoinsEarned = 20,
				}
			],
			Heroes = [],
			Titans = []
		};

		var importResponse = await _client.PostAsJsonAsync("/api/sync/import", syncData);
		importResponse.StatusCode.Should().Be(HttpStatusCode.OK);

		// Act
		var response = await _client.GetAsync("/api/sync/battles/recommendations?battleType=not-a-real-mode&limit=2&minSamples=1");

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		var payload = await response.Content.ReadFromJsonAsync<BattleRecommendationResponse>();
		payload.Should().NotBeNull();
		payload!.BattleType.Should().Be("arena");
		payload.Recommendations.Should().NotBeEmpty();
	}

	/// <summary>
	/// Verifies external tools catalog endpoint returns curated metadata entries.
	/// </summary>
	[Fact]
	public async Task ToolCatalog_Should_Return_Curated_Entries() {
		// Act
		var response = await _client.GetAsync("/api/sync/tools/catalog");

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		var payload = await response.Content.ReadFromJsonAsync<ToolCatalogResponse>();
		payload.Should().NotBeNull();
		payload!.Tools.Should().NotBeEmpty();

		payload.Tools.Should().OnlyContain(t =>
			!string.IsNullOrWhiteSpace(t.Name) &&
			!string.IsNullOrWhiteSpace(t.Url) &&
			!string.IsNullOrWhiteSpace(t.Category) &&
			!string.IsNullOrWhiteSpace(t.VerificationStatus) &&
			t.ConfidenceScore >= 0d &&
			t.ConfidenceScore <= 1d &&
			t.LastReviewedUtc != default);
	}

	/// <summary>
	/// Verifies tool catalog endpoint applies query filtering and sorting options.
	/// </summary>
	[Fact]
	public async Task ToolCatalog_Should_Apply_Filter_And_Sort_Query_Params() {
		// Act
		var response = await _client.GetAsync("/api/sync/tools/catalog?minConfidence=0.75&includeStale=false&category=simulator&verificationStatus=verified&sort=name");

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		var payload = await response.Content.ReadFromJsonAsync<ToolCatalogResponse>();
		payload.Should().NotBeNull();
		payload!.Tools.Should().NotBeEmpty();

		payload.Tools.Should().OnlyContain(t =>
			t.ConfidenceScore >= 0.75 &&
			string.Equals(t.Category, "simulator", StringComparison.OrdinalIgnoreCase) &&
			string.Equals(t.VerificationStatus, "verified", StringComparison.OrdinalIgnoreCase) &&
			!string.Equals(t.VerificationStatus, "stale", StringComparison.OrdinalIgnoreCase));

		var sortedByName = payload.Tools
			.OrderBy(t => t.Name)
			.Select(t => t.Name)
			.ToList();
		var returnedNames = payload.Tools.Select(t => t.Name).ToList();
		returnedNames.Should().Equal(sortedByName);
	}

	/// <summary>
	/// Verifies tool catalog filter metadata endpoint returns supported options and defaults.
	/// </summary>
	[Fact]
	public async Task ToolCatalogFilters_Should_Return_Supported_Options_And_Defaults() {
		// Act
		var response = await _client.GetAsync("/api/sync/tools/catalog/filters");

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		var payload = await response.Content.ReadFromJsonAsync<ToolCatalogFilterMetadataResponse>();
		payload.Should().NotBeNull();

		payload!.Categories.Should().NotBeEmpty();
		payload.VerificationStatuses.Should().NotBeEmpty();
		payload.SortOptions.Should().Contain("confidence");
		payload.SortOptions.Should().Contain("reviewed");
		payload.SortOptions.Should().Contain("name");
		payload.DefaultMinConfidence.Should().BeInRange(0d, 1d);
		payload.GeneratedAtUtc.Should().NotBe(default);
	}

	/// <summary>
	/// Verifies projected item catalog endpoint returns canonical seeded entries and aliases.
	/// </summary>
	[Fact]
	public async Task ProjectedItemCatalog_Should_Return_Seeded_Items_And_Aliases() {
		// Act
		var response = await _client.GetAsync("/api/sync/projections/item-catalog");

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		var payload = await response.Content.ReadFromJsonAsync<ProjectedItemCatalogResponse>();
		payload.Should().NotBeNull();

		payload!.GeneratedAtUtc.Should().NotBe(default);
		payload.Items.Should().NotBeEmpty();
		payload.Aliases.Should().NotBeEmpty();

		payload.Items.Should().Contain(i => i.ItemId == "xp_potion_l" && i.DisplayName == "Large XP Potion");
		payload.Items.Should().Contain(i => i.ItemId == "item_red_fragment" && i.Category == "fragment");
		payload.Aliases.Should().ContainKey("xp_potion_large");
		payload.Aliases["xp_potion_large"].Should().Be("xp_potion_l");
	}

	/// <summary>
	/// Verifies projected item catalog endpoint returns deterministic sorted item IDs.
	/// </summary>
	[Fact]
	public async Task ProjectedItemCatalog_Should_Return_Items_Sorted_By_ItemId() {
		// Act
		var response = await _client.GetAsync("/api/sync/projections/item-catalog");

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		var payload = await response.Content.ReadFromJsonAsync<ProjectedItemCatalogResponse>();
		payload.Should().NotBeNull();

		var sortedIds = payload!.Items.Select(i => i.ItemId).OrderBy(i => i).ToList();
		var returnedIds = payload.Items.Select(i => i.ItemId).ToList();
		returnedIds.Should().Equal(sortedIds);
	}

	/// <summary>
	/// Verifies team recommendation engine endpoint returns mode-aware cards.
	/// </summary>
	[Fact]
	public async Task TeamRecommendations_Should_Return_Mode_Aware_Cards() {
		// Arrange
		var now = DateTime.UtcNow;
		var syncData = new BrowserSyncData {
			CurrentSnapshot = new PlayerSnapshot {
				PlayerId = 3333,
				PlayerName = "EngineTester",
				Timestamp = now,
				Level = 120,
				TeamPower = 1450000,
				Gold = 2500000,
				Emeralds = 4500,
			},
			Heroes = [
				new Hero { HeroId = 1, HeroName = "Astaroth", Level = 120, Stars = 6, Color = 12, Power = 115000, Timestamp = now, PlayerId = 3333 },
				new Hero { HeroId = 2, HeroName = "Keira", Level = 120, Stars = 6, Color = 12, Power = 112000, Timestamp = now, PlayerId = 3333 },
				new Hero { HeroId = 3, HeroName = "Sebastian", Level = 120, Stars = 6, Color = 12, Power = 108000, Timestamp = now, PlayerId = 3333 },
				new Hero { HeroId = 4, HeroName = "Jet", Level = 120, Stars = 6, Color = 12, Power = 101000, Timestamp = now, PlayerId = 3333 },
				new Hero { HeroId = 5, HeroName = "Martha", Level = 120, Stars = 6, Color = 12, Power = 99000, Timestamp = now, PlayerId = 3333 },
			],
			Titans = [
				new Titan { TitanId = 101, TitanName = "Angus", Level = 120, Stars = 6, Power = 89000, Timestamp = now, PlayerId = 3333 },
				new Titan { TitanId = 102, TitanName = "Eden", Level = 120, Stars = 6, Power = 87000, Timestamp = now, PlayerId = 3333 },
			],
			ArenaBattles = [
				new ArenaBattle {
					Timestamp = now.AddMinutes(-10),
					OpponentId = 4001,
					OpponentName = "OpponentEngine",
					OpponentPower = 980000,
					IsWin = true,
					RankBefore = 120,
					RankAfter = 110,
					OurTeam = "Astaroth,Keira,Sebastian,Jet,Martha",
					CoinsEarned = 20,
				}
			],
			GrandArenaBattles = [],
			TitanArenaBattles = [],
		};

		var importResponse = await _client.PostAsJsonAsync("/api/sync/import", syncData);
		importResponse.StatusCode.Should().Be(HttpStatusCode.OK);

		// Act
		var response = await _client.GetAsync("/api/sync/teams/recommendations?mode=campaign&objective=offense&limit=3");

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		var payload = await response.Content.ReadFromJsonAsync<TeamRecommendationEngineResponse>();
		payload.Should().NotBeNull();
		payload!.Mode.Should().Be("campaign");
		payload.Objective.Should().Be("offense");
		payload.Roster.HeroCount.Should().BeGreaterThan(0);
		payload.Recommendations.Should().NotBeEmpty();
		payload.Recommendations.Should().OnlyContain(r =>
			r.EstimatedWinProbability >= 0d &&
			r.EstimatedWinProbability <= 1d &&
			r.ReadinessScore >= 0d &&
			r.ReadinessScore <= 1d &&
			r.ConfidenceScore >= 0d &&
			r.ConfidenceScore <= 1d &&
			r.FinalScore >= 0d &&
			r.FinalScore <= 1d);

		payload.Recommendations.Should().OnlyContain(r =>
			!string.IsNullOrWhiteSpace(r.ModeProfile) &&
			r.Provenance != null &&
			r.Provenance.Count > 0);

		payload.Recommendations.Should().Contain(r =>
			!string.IsNullOrWhiteSpace(r.Rationale) &&
			r.Rationale.Contains("campaign", StringComparison.OrdinalIgnoreCase));

		payload.Recommendations.Should().OnlyContain(r =>
			r.Provenance.Any(p =>
				!string.IsNullOrWhiteSpace(p.Detail) &&
				p.Detail.Contains("score", StringComparison.OrdinalIgnoreCase)));

		payload.Recommendations.Should().OnlyContain(r =>
			r.Provenance.Any(p =>
				p.Contribution != null &&
				p.Contribution.FinalScore.HasValue &&
				p.Contribution.FinalScore.Value >= 0d &&
				p.Contribution.FinalScore.Value <= 1d));

		payload.Recommendations.Should().OnlyContain(r =>
			r.Provenance.Any(p =>
				p.Contribution != null &&
				p.Contribution.ExternalBonus.HasValue &&
				p.Contribution.ExternalBonus.Value >= 0d));

		payload.Recommendations.Should().OnlyContain(r =>
			r.Provenance.Any(p =>
				p.Contribution != null &&
				p.Contribution.FrictionPenalty.HasValue &&
				p.Contribution.FrictionPenalty.Value >= 0d &&
				p.Contribution.FrictionPenalty.Value <= 1d));

		payload.Recommendations.Should().OnlyContain(r =>
			r.Provenance.Any(p =>
				p.Contribution != null &&
				p.Contribution.ResourcePressure.HasValue &&
				p.Contribution.ResourcePressure.Value >= 0d &&
				p.Contribution.ResourcePressure.Value <= 1d));
	}

	/// <summary>
	/// Verifies Team Recommendation Engine returns dungeon-mode recommendations.
	/// </summary>
	[Fact]
	public async Task TeamRecommendationEngine_Should_Return_Dungeon_Mode_Recommendations() {
		var now = DateTime.UtcNow;
		var syncData = new BrowserSyncData {
			CurrentSnapshot = new PlayerSnapshot {
				PlayerId = 7333,
				PlayerName = "DungeonModeTester",
				Timestamp = now,
				Level = 120,
				TeamPower = 1400000,
				Gold = 1800000,
				Emeralds = 2200,
			},
			Heroes = [
				new Hero { HeroId = 1, HeroName = "Astaroth", Level = 120, Stars = 6, Color = 12, Power = 113000, Timestamp = now, PlayerId = 7333 },
				new Hero { HeroId = 2, HeroName = "Keira", Level = 120, Stars = 6, Color = 12, Power = 111000, Timestamp = now, PlayerId = 7333 },
				new Hero { HeroId = 3, HeroName = "Sebastian", Level = 120, Stars = 6, Color = 12, Power = 107000, Timestamp = now, PlayerId = 7333 },
				new Hero { HeroId = 4, HeroName = "Martha", Level = 120, Stars = 6, Color = 12, Power = 103000, Timestamp = now, PlayerId = 7333 },
				new Hero { HeroId = 5, HeroName = "Jet", Level = 120, Stars = 6, Color = 12, Power = 101000, Timestamp = now, PlayerId = 7333 },
			],
			Titans = [],
			ArenaBattles = [],
			GrandArenaBattles = [],
			TitanArenaBattles = [],
		};

		var importResponse = await _client.PostAsJsonAsync("/api/sync/import", syncData);
		importResponse.StatusCode.Should().Be(HttpStatusCode.OK);

		var response = await _client.GetAsync("/api/sync/teams/recommendations?mode=dungeon&objective=sustain&limit=3");

		response.StatusCode.Should().Be(HttpStatusCode.OK);
		var payload = await response.Content.ReadFromJsonAsync<TeamRecommendationEngineResponse>();
		payload.Should().NotBeNull();
		payload!.Mode.Should().Be("dungeon");
		payload.Objective.Should().Be("sustain");
		payload.Recommendations.Should().NotBeEmpty();
		payload.Recommendations.Should().OnlyContain(r =>
			r.FinalScore >= 0d &&
			r.FinalScore <= 1d &&
			!string.IsNullOrWhiteSpace(r.ModeProfile));
	}

	/// <summary>
	/// Verifies Team Recommendation Engine returns ToE-mode recommendations.
	/// </summary>
	[Fact]
	public async Task TeamRecommendationEngine_Should_Return_Toe_Mode_Recommendations() {
		var now = DateTime.UtcNow;
		var syncData = new BrowserSyncData {
			CurrentSnapshot = new PlayerSnapshot {
				PlayerId = 7444,
				PlayerName = "ToeModeTester",
				Timestamp = now,
				Level = 120,
				TeamPower = 1500000,
				Gold = 2100000,
				Emeralds = 3100,
			},
			Heroes = [
				new Hero { HeroId = 1, HeroName = "Astaroth", Level = 120, Stars = 6, Color = 12, Power = 116000, Timestamp = now, PlayerId = 7444 },
				new Hero { HeroId = 2, HeroName = "Keira", Level = 120, Stars = 6, Color = 12, Power = 114000, Timestamp = now, PlayerId = 7444 },
				new Hero { HeroId = 3, HeroName = "Sebastian", Level = 120, Stars = 6, Color = 12, Power = 110000, Timestamp = now, PlayerId = 7444 },
				new Hero { HeroId = 4, HeroName = "Jet", Level = 120, Stars = 6, Color = 12, Power = 105000, Timestamp = now, PlayerId = 7444 },
				new Hero { HeroId = 5, HeroName = "Martha", Level = 120, Stars = 6, Color = 12, Power = 104000, Timestamp = now, PlayerId = 7444 },
			],
			Titans = [
				new Titan { TitanId = 101, TitanName = "Angus", Level = 120, Stars = 6, Power = 90000, Timestamp = now, PlayerId = 7444 },
			],
			ArenaBattles = [],
			GrandArenaBattles = [],
			TitanArenaBattles = [],
		};

		var importResponse = await _client.PostAsJsonAsync("/api/sync/import", syncData);
		importResponse.StatusCode.Should().Be(HttpStatusCode.OK);

		var response = await _client.GetAsync("/api/sync/teams/recommendations?mode=toe&objective=defense&limit=3");

		response.StatusCode.Should().Be(HttpStatusCode.OK);
		var payload = await response.Content.ReadFromJsonAsync<TeamRecommendationEngineResponse>();
		payload.Should().NotBeNull();
		payload!.Mode.Should().Be("toe");
		payload.Objective.Should().Be("defense");
		payload.Recommendations.Should().NotBeEmpty();
		payload.Recommendations.Should().OnlyContain(r =>
			r.FinalScore >= 0d &&
			r.FinalScore <= 1d &&
			!string.IsNullOrWhiteSpace(r.ModeProfile));
	}

	/// <summary>
	/// Verifies Team Recommendation Engine normalizes common mode aliases.
	/// </summary>
	[Fact]
	public async Task TeamRecommendationEngine_Should_Normalize_Mode_Aliases() {
		var now = DateTime.UtcNow;
		var syncData = new BrowserSyncData {
			CurrentSnapshot = new PlayerSnapshot {
				PlayerId = 7555,
				PlayerName = "AliasModeTester",
				Timestamp = now,
				Level = 120,
				TeamPower = 1420000,
				Gold = 1900000,
				Emeralds = 2500,
			},
			Heroes = [
				new Hero { HeroId = 1, HeroName = "Astaroth", Level = 120, Stars = 6, Color = 12, Power = 112000, Timestamp = now, PlayerId = 7555 },
				new Hero { HeroId = 2, HeroName = "Keira", Level = 120, Stars = 6, Color = 12, Power = 110000, Timestamp = now, PlayerId = 7555 },
				new Hero { HeroId = 3, HeroName = "Sebastian", Level = 120, Stars = 6, Color = 12, Power = 108000, Timestamp = now, PlayerId = 7555 },
				new Hero { HeroId = 4, HeroName = "Martha", Level = 120, Stars = 6, Color = 12, Power = 104000, Timestamp = now, PlayerId = 7555 },
				new Hero { HeroId = 5, HeroName = "Jet", Level = 120, Stars = 6, Color = 12, Power = 102000, Timestamp = now, PlayerId = 7555 },
			],
			Titans = [
				new Titan { TitanId = 101, TitanName = "Angus", Level = 120, Stars = 6, Power = 91000, Timestamp = now, PlayerId = 7555 },
			],
			ArenaBattles = [],
			GrandArenaBattles = [],
			TitanArenaBattles = [],
		};

		var importResponse = await _client.PostAsJsonAsync("/api/sync/import", syncData);
		importResponse.StatusCode.Should().Be(HttpStatusCode.OK);

		var toeAliasResponse = await _client.GetAsync("/api/sync/teams/recommendations?mode=power-tournament&objective=defense&limit=3");
		toeAliasResponse.StatusCode.Should().Be(HttpStatusCode.OK);
		var toeAliasPayload = await toeAliasResponse.Content.ReadFromJsonAsync<TeamRecommendationEngineResponse>();
		toeAliasPayload.Should().NotBeNull();
		toeAliasPayload!.Mode.Should().Be("toe");
		toeAliasPayload.Recommendations.Should().NotBeEmpty();

		var dungeonAliasResponse = await _client.GetAsync("/api/sync/teams/recommendations?mode=dungeon-run&objective=sustain&limit=3");
		dungeonAliasResponse.StatusCode.Should().Be(HttpStatusCode.OK);
		var dungeonAliasPayload = await dungeonAliasResponse.Content.ReadFromJsonAsync<TeamRecommendationEngineResponse>();
		dungeonAliasPayload.Should().NotBeNull();
		dungeonAliasPayload!.Mode.Should().Be("dungeon");
		dungeonAliasPayload.Recommendations.Should().NotBeEmpty();

		var grandArenaAliasResponse = await _client.GetAsync("/api/sync/teams/recommendations?mode=ga&objective=balanced&limit=3");
		grandArenaAliasResponse.StatusCode.Should().Be(HttpStatusCode.OK);
		var grandArenaAliasPayload = await grandArenaAliasResponse.Content.ReadFromJsonAsync<TeamRecommendationEngineResponse>();
		grandArenaAliasPayload.Should().NotBeNull();
		grandArenaAliasPayload!.Mode.Should().Be("grandarena");
		grandArenaAliasPayload.Recommendations.Should().NotBeEmpty();

		var pvpAliasResponse = await _client.GetAsync("/api/sync/teams/recommendations?mode=pvp&objective=balanced&limit=3");
		pvpAliasResponse.StatusCode.Should().Be(HttpStatusCode.OK);
		var pvpAliasPayload = await pvpAliasResponse.Content.ReadFromJsonAsync<TeamRecommendationEngineResponse>();
		pvpAliasPayload.Should().NotBeNull();
		pvpAliasPayload!.Mode.Should().Be("arena");
		pvpAliasPayload.Recommendations.Should().NotBeEmpty();

		var spacedAliasResponse = await _client.GetAsync("/api/sync/teams/recommendations?mode=Grand%20Arena&objective=balanced&limit=3");
		spacedAliasResponse.StatusCode.Should().Be(HttpStatusCode.OK);
		var spacedAliasPayload = await spacedAliasResponse.Content.ReadFromJsonAsync<TeamRecommendationEngineResponse>();
		spacedAliasPayload.Should().NotBeNull();
		spacedAliasPayload!.Mode.Should().Be("grandarena");
		spacedAliasPayload.Recommendations.Should().NotBeEmpty();

		var slashAliasResponse = await _client.GetAsync("/api/sync/teams/recommendations?mode=titan/dungeon&objective=balanced&limit=3");
		slashAliasResponse.StatusCode.Should().Be(HttpStatusCode.OK);
		var slashAliasPayload = await slashAliasResponse.Content.ReadFromJsonAsync<TeamRecommendationEngineResponse>();
		slashAliasPayload.Should().NotBeNull();
		slashAliasPayload!.Mode.Should().Be("dungeon");
		slashAliasPayload.Recommendations.Should().NotBeEmpty();
	}

	/// <summary>
	/// Verifies Team Recommendation Engine normalizes objective aliases.
	/// </summary>
	[Fact]
	public async Task TeamRecommendationEngine_Should_Normalize_Objective_Aliases() {
		var now = DateTime.UtcNow;
		var syncData = new BrowserSyncData {
			CurrentSnapshot = new PlayerSnapshot {
				PlayerId = 7666,
				PlayerName = "AliasObjectiveTester",
				Timestamp = now,
				Level = 120,
				TeamPower = 1410000,
				Gold = 1600000,
				Emeralds = 2000,
			},
			Heroes = [
				new Hero { HeroId = 1, HeroName = "Astaroth", Level = 120, Stars = 6, Color = 12, Power = 112000, Timestamp = now, PlayerId = 7666 },
				new Hero { HeroId = 2, HeroName = "Keira", Level = 120, Stars = 6, Color = 12, Power = 111000, Timestamp = now, PlayerId = 7666 },
				new Hero { HeroId = 3, HeroName = "Sebastian", Level = 120, Stars = 6, Color = 12, Power = 109000, Timestamp = now, PlayerId = 7666 },
				new Hero { HeroId = 4, HeroName = "Martha", Level = 120, Stars = 6, Color = 12, Power = 104000, Timestamp = now, PlayerId = 7666 },
				new Hero { HeroId = 5, HeroName = "Jet", Level = 120, Stars = 6, Color = 12, Power = 101000, Timestamp = now, PlayerId = 7666 },
			],
			Titans = [],
			ArenaBattles = [],
			GrandArenaBattles = [],
			TitanArenaBattles = [],
		};

		var importResponse = await _client.PostAsJsonAsync("/api/sync/import", syncData);
		importResponse.StatusCode.Should().Be(HttpStatusCode.OK);

		var attackAliasResponse = await _client.GetAsync("/api/sync/teams/recommendations?mode=arena&objective=attack&limit=3");
		attackAliasResponse.StatusCode.Should().Be(HttpStatusCode.OK);
		var attackAliasPayload = await attackAliasResponse.Content.ReadFromJsonAsync<TeamRecommendationEngineResponse>();
		attackAliasPayload.Should().NotBeNull();
		attackAliasPayload!.Objective.Should().Be("offense");
		attackAliasPayload.Recommendations.Should().NotBeEmpty();

		var defensiveAliasResponse = await _client.GetAsync("/api/sync/teams/recommendations?mode=arena&objective=defensive&limit=3");
		defensiveAliasResponse.StatusCode.Should().Be(HttpStatusCode.OK);
		var defensiveAliasPayload = await defensiveAliasResponse.Content.ReadFromJsonAsync<TeamRecommendationEngineResponse>();
		defensiveAliasPayload.Should().NotBeNull();
		defensiveAliasPayload!.Objective.Should().Be("defense");
		defensiveAliasPayload.Recommendations.Should().NotBeEmpty();

		var healAliasResponse = await _client.GetAsync("/api/sync/teams/recommendations?mode=arena&objective=healing&limit=3");
		healAliasResponse.StatusCode.Should().Be(HttpStatusCode.OK);
		var healAliasPayload = await healAliasResponse.Content.ReadFromJsonAsync<TeamRecommendationEngineResponse>();
		healAliasPayload.Should().NotBeNull();
		healAliasPayload!.Objective.Should().Be("sustain");
		healAliasPayload.Recommendations.Should().NotBeEmpty();
	}

	/// <summary>
	/// Verifies recommendations endpoint rejects unsupported preferred trend windows.
	/// </summary>
	[Fact]
	public async Task TeamRecommendationEngine_Should_Reject_Invalid_PreferredTrendWindow() {
		var response = await _client.GetAsync("/api/sync/teams/recommendations?mode=arena&objective=balanced&preferredTrendWindowDays=14");
		response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
		var body = await response.Content.ReadAsStringAsync();
		body.Should().Contain("preferredTrendWindowDays must be one of: 7, 30, 90");
	}

	/// <summary>
	/// Verifies Team Recommendation profile metadata endpoint returns options and profile weights.
	/// </summary>
	[Fact]
	public async Task TeamRecommendationProfiles_Should_Return_Mode_Objective_And_Weights() {
		// Act
		var response = await _client.GetAsync("/api/sync/teams/recommendations/profiles");

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		var payload = await response.Content.ReadFromJsonAsync<TeamRecommendationProfileMetadataResponse>();
		payload.Should().NotBeNull();

		payload!.Modes.Should().NotBeEmpty();
		payload.Objectives.Should().NotBeEmpty();
		payload.Profiles.Should().NotBeEmpty();
		payload.ExternalSignalModeWeights.Should().NotBeEmpty();
		payload.GeneratedAtUtc.Should().NotBe(default);

		payload.Profiles.Should().OnlyContain(p =>
			!string.IsNullOrWhiteSpace(p.Mode) &&
			!string.IsNullOrWhiteSpace(p.Objective) &&
			!string.IsNullOrWhiteSpace(p.ProfileName) &&
			p.WinWeight >= 0d &&
			p.ReadinessWeight >= 0d &&
			p.ConfidenceWeight >= 0d &&
			Math.Abs((p.WinWeight + p.ReadinessWeight + p.ConfidenceWeight) - 1d) < 0.0015);

		payload.ExternalSignalModeWeights.Should().OnlyContain(w =>
			!string.IsNullOrWhiteSpace(w.Mode) &&
			w.ExternalSignalWeight >= 0d &&
			w.ExternalSignalWeight <= 1d);

		payload.Modes.Should().OnlyContain(mode =>
			mode.PreferredTrendWindowDays > 0 &&
			mode.SupportedTrendWindowDays.Contains(mode.PreferredTrendWindowDays));

		payload.Modes.Should().Contain(mode =>
			mode.Value == "arena" &&
			mode.PreferredTrendWindowDays > 0 &&
			mode.SupportedTrendWindowDays.Contains(mode.PreferredTrendWindowDays));
		payload.Modes.Should().Contain(mode => mode.Value == "grandarena" && mode.Label == "Grand Arena");
		payload.Modes.Should().Contain(mode => mode.Value == "guildwar" && mode.Label == "Guild War");
		payload.Modes.Should().Contain(mode => mode.Value == "cow" && mode.PreferredTrendWindowDays == 90);
		payload.Modes.Should().Contain(mode => mode.Value == "cow" && mode.Label == "CoW");
		payload.Modes.Should().Contain(mode => mode.Value == "dungeon" && mode.PreferredTrendWindowDays == 30);
		payload.Modes.Should().Contain(mode => mode.Value == "toe" && mode.PreferredTrendWindowDays == 90);
		payload.Modes.Should().Contain(mode => mode.Value == "toe" && mode.Label == "ToE");
	}

	/// <summary>
	/// Verifies Team Recommendation trend preferences can be persisted and reflected in profile metadata.
	/// </summary>
	[Fact]
	public async Task TeamRecommendationPreferences_Should_Persist_And_Reflect_In_Metadata() {
		var initialResponse = await _client.GetAsync("/api/sync/teams/recommendations/preferences");
		initialResponse.StatusCode.Should().Be(HttpStatusCode.OK);

		var updateResponse = await _client.PutAsJsonAsync("/api/sync/teams/recommendations/preferences", new TeamRecommendationTrendPreferenceUpdateRequest {
			Mode = "guildwar",
			PreferredTrendWindowDays = 90,
		});
		updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);

		var preferences = await updateResponse.Content.ReadFromJsonAsync<TeamRecommendationTrendPreferenceResponse>();
		preferences.Should().NotBeNull();
		preferences!.Modes.Should().Contain(entry => entry.Mode == "guildwar" && entry.PreferredTrendWindowDays == 90);

		var profileResponse = await _client.GetAsync("/api/sync/teams/recommendations/profiles");
		profileResponse.StatusCode.Should().Be(HttpStatusCode.OK);
		var profilePayload = await profileResponse.Content.ReadFromJsonAsync<TeamRecommendationProfileMetadataResponse>();
		profilePayload.Should().NotBeNull();
		profilePayload!.Modes.Should().Contain(mode =>
			mode.Value == "guildwar" &&
			mode.PreferredTrendWindowDays == 90 &&
			mode.IsUserPreference);

	}

	/// <summary>
	/// Verifies preference save normalizes alias mode keys and reports canonical entries.
	/// </summary>
	[Fact]
	public async Task TeamRecommendationPreferences_Should_Normalize_Alias_Mode_Save() {
		var updateResponse = await _client.PutAsJsonAsync("/api/sync/teams/recommendations/preferences", new TeamRecommendationTrendPreferenceUpdateRequest {
			Mode = "titan-arena",
			PreferredTrendWindowDays = 90,
		});
		updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);

		var preferences = await updateResponse.Content.ReadFromJsonAsync<TeamRecommendationTrendPreferenceResponse>();
		preferences.Should().NotBeNull();
		preferences!.Modes.Should().Contain(entry => entry.Mode == "arena" && entry.PreferredTrendWindowDays == 90);

		var metadataResponse = await _client.GetAsync("/api/sync/teams/recommendations/profiles");
		metadataResponse.StatusCode.Should().Be(HttpStatusCode.OK);
		var metadata = await metadataResponse.Content.ReadFromJsonAsync<TeamRecommendationProfileMetadataResponse>();
		metadata.Should().NotBeNull();
		metadata!.Modes.Should().Contain(mode =>
			mode.Value == "arena" &&
			mode.PreferredTrendWindowDays == 90 &&
			mode.IsUserPreference);
	}

	/// <summary>
	/// Verifies preference save rejects unknown modes instead of mutating canonical defaults.
	/// </summary>
	[Fact]
	public async Task TeamRecommendationPreferences_Should_Reject_Unknown_Mode() {
		var response = await _client.PutAsJsonAsync("/api/sync/teams/recommendations/preferences", new TeamRecommendationTrendPreferenceUpdateRequest {
			Mode = "definitely-not-a-real-mode",
			PreferredTrendWindowDays = 30,
		});

		response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
		var body = await response.Content.ReadAsStringAsync();
		body.Should().Contain("Unknown mode");
	}

	/// <summary>
	/// Verifies Team Recommendation backtest endpoint returns calibration metrics for arena mode.
	/// </summary>
	[Fact]
	public async Task TeamRecommendationBacktest_Should_Return_Calibration_Metrics() {
		// Arrange
		var now = DateTime.UtcNow;
		var syncData = new BrowserSyncData {
			CurrentSnapshot = new PlayerSnapshot {
				PlayerId = 4444,
				PlayerName = "BacktestTester",
				Timestamp = now,
				Level = 120,
				TeamPower = 1520000,
				Gold = 1900000,
				Emeralds = 3200,
			},
			Heroes = [
				new Hero { HeroId = 1, HeroName = "Astaroth", Level = 120, Stars = 6, Color = 12, Power = 118000, Timestamp = now, PlayerId = 4444 },
				new Hero { HeroId = 2, HeroName = "Keira", Level = 120, Stars = 6, Color = 12, Power = 116000, Timestamp = now, PlayerId = 4444 },
				new Hero { HeroId = 3, HeroName = "Sebastian", Level = 120, Stars = 6, Color = 12, Power = 111000, Timestamp = now, PlayerId = 4444 },
				new Hero { HeroId = 4, HeroName = "Jet", Level = 120, Stars = 6, Color = 12, Power = 107000, Timestamp = now, PlayerId = 4444 },
				new Hero { HeroId = 5, HeroName = "Martha", Level = 120, Stars = 6, Color = 12, Power = 102000, Timestamp = now, PlayerId = 4444 },
			],
			Titans = [],
			ArenaBattles = [
				new ArenaBattle {
					Timestamp = now.AddDays(-1),
					OpponentId = 6001,
					OpponentName = "Opponent One",
					OpponentPower = 980000,
					IsWin = true,
					RankBefore = 120,
					RankAfter = 114,
					OurTeam = "Astaroth, Keira, Sebastian, Jet, Martha",
					CoinsEarned = 20,
				},
				new ArenaBattle {
					Timestamp = now.AddHours(-20),
					OpponentId = 6002,
					OpponentName = "Opponent Two",
					OpponentPower = 995000,
					IsWin = true,
					RankBefore = 114,
					RankAfter = 109,
					OurTeam = "Astaroth, Keira, Sebastian, Jet, Martha",
					CoinsEarned = 20,
				},
				new ArenaBattle {
					Timestamp = now.AddHours(-12),
					OpponentId = 6003,
					OpponentName = "Opponent Three",
					OpponentPower = 1005000,
					IsWin = false,
					RankBefore = 109,
					RankAfter = 111,
					OurTeam = "Astaroth, Keira, Sebastian, Jet, Martha",
					CoinsEarned = 10,
				},
			],
		};

		var importResponse = await _client.PostAsJsonAsync("/api/sync/import", syncData);
		importResponse.StatusCode.Should().Be(HttpStatusCode.OK);

		// Act
		var response = await _client.GetAsync("/api/sync/teams/recommendations/backtest?mode=arena&objective=balanced&lookbackDays=30&limit=3");

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		var payload = await response.Content.ReadFromJsonAsync<TeamRecommendationBacktestResponse>();
		payload.Should().NotBeNull();

		payload!.Mode.Should().Be("arena");
		payload.Objective.Should().Be("balanced");
		payload.LookbackDays.Should().Be(30);
		payload.EvaluatedTeamCount.Should().BeGreaterThan(0);
		payload.TotalBattleSamples.Should().BeGreaterThan(0);
		payload.Teams.Should().NotBeEmpty();
		payload.CalibrationQuality.Should().NotBeNullOrWhiteSpace();

		payload.Teams.Should().OnlyContain(t =>
			t.PredictedWinProbability >= 0d &&
			t.PredictedWinProbability <= 1d &&
			t.MatchedSamples >= 0);

		payload.Teams.Should().Contain(t =>
			t.MatchedSamples > 0 &&
			t.ActualWinRate.HasValue &&
			t.ActualWinRate.Value >= 0d &&
			t.ActualWinRate.Value <= 1d);

		var calibrationResponse = await _client.GetAsync("/api/sync/teams/recommendations/calibration?mode=arena&preferredTrendWindowDays=7");
		calibrationResponse.StatusCode.Should().Be(HttpStatusCode.OK);
		var calibration = await calibrationResponse.Content.ReadFromJsonAsync<TeamRecommendationCalibrationResponse>();
		calibration.Should().NotBeNull();
		calibration!.Mode.Should().Be("arena");
		calibration.PreferredTrendWindowDays.Should().Be(7);
		calibration.SupportedTrendWindowDays.Should().Contain(7);
		calibration.SupportedTrendWindowDays.Should().Contain(30);
		calibration.SupportedTrendWindowDays.Should().Contain(90);
		calibration.SuggestedFrictionScale.Should().BeGreaterThan(0d);
		calibration.SuggestedFrictionScale.Should().BeLessThanOrEqualTo(2d);
		calibration.Samples.Should().BeGreaterThan(0);
		calibration.TrendWindows.Should().NotBeEmpty();
		calibration.TrendWindows.Should().Contain(t => t.WindowDays == 7);
		calibration.TrendWindows.Should().Contain(t => t.WindowDays == 30);
		calibration.TrendWindows.Should().Contain(t => t.WindowDays == 90);
		calibration.TrendWindows.Should().OnlyContain(t =>
			t.SuggestedFrictionScale > 0d &&
			t.SuggestedFrictionScale <= 2d &&
			t.MeanAbsoluteError >= 0d &&
			t.MeanAbsoluteError <= 1d &&
			t.MeanBrierScore >= 0d &&
			t.MeanBrierScore <= 1d);

		var objectiveAliasBacktestResponse = await _client.GetAsync("/api/sync/teams/recommendations/backtest?mode=arena&objective=attack&lookbackDays=30&limit=3");
		objectiveAliasBacktestResponse.StatusCode.Should().Be(HttpStatusCode.OK);
		var objectiveAliasBacktest = await objectiveAliasBacktestResponse.Content.ReadFromJsonAsync<TeamRecommendationBacktestResponse>();
		objectiveAliasBacktest.Should().NotBeNull();
		objectiveAliasBacktest!.Objective.Should().Be("offense");

		var calibrationAfterAliasResponse = await _client.GetAsync("/api/sync/teams/recommendations/calibration?mode=arena");
		calibrationAfterAliasResponse.StatusCode.Should().Be(HttpStatusCode.OK);
		var calibrationAfterAlias = await calibrationAfterAliasResponse.Content.ReadFromJsonAsync<TeamRecommendationCalibrationResponse>();
		calibrationAfterAlias.Should().NotBeNull();
		calibrationAfterAlias!.LastObjective.Should().Be("offense");
	}

	/// <summary>
	/// Verifies calibration endpoint returns default state when no prior backtest exists.
	/// </summary>
	[Fact]
	public async Task TeamRecommendationCalibration_Should_Return_Default_State_When_No_Backtest() {
		var response = await _client.GetAsync("/api/sync/teams/recommendations/calibration?mode=campaign");
		response.StatusCode.Should().Be(HttpStatusCode.OK);

		var payload = await response.Content.ReadFromJsonAsync<TeamRecommendationCalibrationResponse>();
		payload.Should().NotBeNull();
		payload!.Mode.Should().Be("campaign");
		payload.PreferredTrendWindowDays.Should().Be(30);
		payload.SuggestedFrictionScale.Should().BeGreaterThan(0d);
		payload.Samples.Should().BeGreaterThanOrEqualTo(0);
		payload.TrendWindows.Should().NotBeEmpty();
		payload.TrendWindows.Should().Contain(t => t.WindowDays == 30);

		var dungeonResponse = await _client.GetAsync("/api/sync/teams/recommendations/calibration?mode=dungeon");
		dungeonResponse.StatusCode.Should().Be(HttpStatusCode.OK);
		var dungeonPayload = await dungeonResponse.Content.ReadFromJsonAsync<TeamRecommendationCalibrationResponse>();
		dungeonPayload.Should().NotBeNull();
		dungeonPayload!.Mode.Should().Be("dungeon");
		dungeonPayload.PreferredTrendWindowDays.Should().Be(30);
		dungeonPayload.SupportedTrendWindowDays.Should().Contain(30);
		dungeonPayload.TrendWindows.Should().Contain(t => t.WindowDays == 30);

		var toeResponse = await _client.GetAsync("/api/sync/teams/recommendations/calibration?mode=toe");
		toeResponse.StatusCode.Should().Be(HttpStatusCode.OK);
		var toePayload = await toeResponse.Content.ReadFromJsonAsync<TeamRecommendationCalibrationResponse>();
		toePayload.Should().NotBeNull();
		toePayload!.Mode.Should().Be("toe");
		toePayload.PreferredTrendWindowDays.Should().BeGreaterThan(0);
		toePayload.SupportedTrendWindowDays.Should().Contain(toePayload.PreferredTrendWindowDays);
		toePayload.SupportedTrendWindowDays.Should().Contain(90);
		toePayload.TrendWindows.Should().Contain(t => t.WindowDays == 90);

		var titanArenaAliasResponse = await _client.GetAsync("/api/sync/teams/recommendations/calibration?mode=titan-arena");
		titanArenaAliasResponse.StatusCode.Should().Be(HttpStatusCode.OK);
		var titanArenaAliasPayload = await titanArenaAliasResponse.Content.ReadFromJsonAsync<TeamRecommendationCalibrationResponse>();
		titanArenaAliasPayload.Should().NotBeNull();
		titanArenaAliasPayload!.Mode.Should().Be("arena");
		titanArenaAliasPayload.PreferredTrendWindowDays.Should().BeGreaterThan(0);
		titanArenaAliasPayload.SupportedTrendWindowDays.Should().Contain(titanArenaAliasPayload.PreferredTrendWindowDays);

		var invalidWindowResponse = await _client.GetAsync("/api/sync/teams/recommendations/calibration?mode=arena&preferredTrendWindowDays=14");
		invalidWindowResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
		var invalidWindowBody = await invalidWindowResponse.Content.ReadAsStringAsync();
		invalidWindowBody.Should().Contain("preferredTrendWindowDays must be one of: 7, 30, 90");
	}

	/// <summary>
	/// Verifies battle recommendation endpoint preserves required contract fields and value types.
	/// </summary>
	[Fact]
	public async Task BattleRecommendations_Should_Expose_Stable_Contract_Shape() {
		// Arrange
		var now = DateTime.UtcNow;
		var syncData = new BrowserSyncData {
			ArenaBattles = [
				new ArenaBattle {
					Timestamp = now.AddMinutes(-8),
					OpponentId = 8701,
					OpponentName = "Contract Opponent A",
					OpponentPower = 820000,
					IsWin = true,
					RankBefore = 200,
					RankAfter = 190,
					OurTeam = "Astaroth,Keira,Sebastian,Jet,Martha",
					CoinsEarned = 20,
				},
				new ArenaBattle {
					Timestamp = now.AddMinutes(-5),
					OpponentId = 8702,
					OpponentName = "Contract Opponent B",
					OpponentPower = 840000,
					IsWin = false,
					RankBefore = 190,
					RankAfter = 194,
					OurTeam = "Astaroth,Keira,Sebastian,Jet,Martha",
					CoinsEarned = 10,
				}
			],
			Heroes = [],
			Titans = []
		};

		var importResponse = await _client.PostAsJsonAsync("/api/sync/import", syncData);
		importResponse.StatusCode.Should().Be(HttpStatusCode.OK);

		// Act
		var response = await _client.GetAsync("/api/sync/battles/recommendations?battleType=arena&limit=3&minSamples=1");

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
		var root = document.RootElement;

		root.TryGetProperty("battleType", out var battleType).Should().BeTrue();
		battleType.GetString().Should().Be("arena");

		root.TryGetProperty("sampleCount", out var sampleCount).Should().BeTrue();
		sampleCount.ValueKind.Should().Be(JsonValueKind.Number);

		root.TryGetProperty("baselineWinRate", out var baselineWinRate).Should().BeTrue();
		baselineWinRate.ValueKind.Should().Be(JsonValueKind.Number);

		root.TryGetProperty("recommendations", out var recommendations).Should().BeTrue();
		recommendations.ValueKind.Should().Be(JsonValueKind.Array);
		recommendations.GetArrayLength().Should().BeGreaterThan(0);

		var first = recommendations.EnumerateArray().First();
		first.TryGetProperty("teamPreview", out _).Should().BeTrue();
		first.TryGetProperty("simulatedWinProbability", out var simulatedWinProbability).Should().BeTrue();
		simulatedWinProbability.ValueKind.Should().Be(JsonValueKind.Number);
		first.TryGetProperty("confidence", out var confidence).Should().BeTrue();
		confidence.ValueKind.Should().Be(JsonValueKind.Number);
		first.TryGetProperty("simulationConfidenceLow", out var confidenceLow).Should().BeTrue();
		confidenceLow.ValueKind.Should().Be(JsonValueKind.Number);
		first.TryGetProperty("simulationConfidenceHigh", out var confidenceHigh).Should().BeTrue();
		confidenceHigh.ValueKind.Should().Be(JsonValueKind.Number);
	}

	/// <summary>
	/// Verifies team recommendation endpoint preserves required contract fields and value types.
	/// </summary>
	[Fact]
	public async Task TeamRecommendations_Should_Expose_Stable_Contract_Shape() {
		// Arrange
		var now = DateTime.UtcNow;
		var syncData = new BrowserSyncData {
			CurrentSnapshot = new PlayerSnapshot {
				PlayerId = 99001,
				PlayerName = "ContractTeamTester",
				Timestamp = now,
				Level = 120,
				TeamPower = 1400000,
				Gold = 1000000,
				Emeralds = 2000,
			},
			Heroes = [
				new Hero { HeroId = 1, HeroName = "Astaroth", Level = 120, Stars = 6, Color = 12, Power = 110000, Timestamp = now, PlayerId = 99001 },
				new Hero { HeroId = 2, HeroName = "Keira", Level = 120, Stars = 6, Color = 12, Power = 108000, Timestamp = now, PlayerId = 99001 },
				new Hero { HeroId = 3, HeroName = "Sebastian", Level = 120, Stars = 6, Color = 12, Power = 106000, Timestamp = now, PlayerId = 99001 },
				new Hero { HeroId = 4, HeroName = "Jet", Level = 120, Stars = 6, Color = 12, Power = 102000, Timestamp = now, PlayerId = 99001 },
				new Hero { HeroId = 5, HeroName = "Martha", Level = 120, Stars = 6, Color = 12, Power = 100000, Timestamp = now, PlayerId = 99001 },
			],
			Titans = [],
			ArenaBattles = [],
			GrandArenaBattles = [],
			TitanArenaBattles = [],
		};

		var importResponse = await _client.PostAsJsonAsync("/api/sync/import", syncData);
		importResponse.StatusCode.Should().Be(HttpStatusCode.OK);

		// Act
		var response = await _client.GetAsync("/api/sync/teams/recommendations?mode=arena&objective=balanced&limit=3");

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
		var root = document.RootElement;

		root.TryGetProperty("mode", out var mode).Should().BeTrue();
		mode.GetString().Should().Be("arena");

		root.TryGetProperty("objective", out var objective).Should().BeTrue();
		objective.GetString().Should().Be("balanced");

		root.TryGetProperty("roster", out var roster).Should().BeTrue();
		roster.ValueKind.Should().Be(JsonValueKind.Object);
		roster.TryGetProperty("heroCount", out _).Should().BeTrue();
		roster.TryGetProperty("teamPower", out _).Should().BeTrue();

		root.TryGetProperty("recommendations", out var recommendations).Should().BeTrue();
		recommendations.ValueKind.Should().Be(JsonValueKind.Array);
		recommendations.GetArrayLength().Should().BeGreaterThan(0);

		var first = recommendations.EnumerateArray().First();
		first.TryGetProperty("source", out _).Should().BeTrue();
		first.TryGetProperty("teamPreview", out _).Should().BeTrue();
		first.TryGetProperty("estimatedWinProbability", out var estimatedWinProbability).Should().BeTrue();
		estimatedWinProbability.ValueKind.Should().Be(JsonValueKind.Number);
		first.TryGetProperty("readinessScore", out var readinessScore).Should().BeTrue();
		readinessScore.ValueKind.Should().Be(JsonValueKind.Number);
		first.TryGetProperty("confidenceScore", out var confidenceScore).Should().BeTrue();
		confidenceScore.ValueKind.Should().Be(JsonValueKind.Number);
		first.TryGetProperty("finalScore", out var finalScore).Should().BeTrue();
		finalScore.ValueKind.Should().Be(JsonValueKind.Number);
		first.TryGetProperty("provenance", out var provenance).Should().BeTrue();
		provenance.ValueKind.Should().Be(JsonValueKind.Array);
	}

	/// <summary>
	/// Verifies arena simulation endpoint preserves required integrated recommendation fields.
	/// </summary>
	[Fact]
	public async Task ArenaTeamRecommendationSimulation_Should_Expose_Stable_Contract_Shape() {
		// Arrange
		var now = DateTime.UtcNow;
		var syncData = new BrowserSyncData {
			CurrentSnapshot = new PlayerSnapshot {
				PlayerId = 88111,
				PlayerName = "ArenaSimulationContractTester",
				Timestamp = now,
				Level = 120,
				TeamPower = 1300000,
				Gold = 1000000,
				Emeralds = 1000,
			},
			Heroes = [
				new Hero { HeroId = 1, HeroName = "Astaroth", Level = 120, Stars = 6, Color = 12, Power = 110000, Timestamp = now, PlayerId = 88111 },
				new Hero { HeroId = 2, HeroName = "Keira", Level = 120, Stars = 6, Color = 12, Power = 109000, Timestamp = now, PlayerId = 88111 },
				new Hero { HeroId = 3, HeroName = "Sebastian", Level = 120, Stars = 6, Color = 12, Power = 107000, Timestamp = now, PlayerId = 88111 },
				new Hero { HeroId = 4, HeroName = "Jet", Level = 120, Stars = 6, Color = 12, Power = 103000, Timestamp = now, PlayerId = 88111 },
				new Hero { HeroId = 5, HeroName = "Martha", Level = 120, Stars = 6, Color = 12, Power = 101000, Timestamp = now, PlayerId = 88111 },
			],
			ArenaBattles = [
				new ArenaBattle {
					Timestamp = now.AddMinutes(-45),
					OpponentId = 7711,
					OpponentName = "Arena Sim Opponent",
					OpponentPower = 900000,
					IsWin = true,
					RankBefore = 100,
					RankAfter = 94,
					OurTeam = "Astaroth,Keira,Sebastian,Jet,Martha",
					CoinsEarned = 20,
				},
				new ArenaBattle {
					Timestamp = now.AddMinutes(-25),
					OpponentId = 7712,
					OpponentName = "Arena Sim Opponent B",
					OpponentPower = 910000,
					IsWin = false,
					RankBefore = 94,
					RankAfter = 96,
					OurTeam = "Astaroth,Keira,Sebastian,Jet,Martha",
					CoinsEarned = 10,
				}
			],
			Titans = []
		};

		var importResponse = await _client.PostAsJsonAsync("/api/sync/import", syncData);
		importResponse.StatusCode.Should().Be(HttpStatusCode.OK);

		// Act
		var response = await _client.GetAsync("/api/sync/teams/recommendations/arena/simulate?objective=balanced&limit=3&minSamples=1&opponentPower=900000");

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
		var root = document.RootElement;

		root.TryGetProperty("mode", out var mode).Should().BeTrue();
		mode.GetString().Should().Be("arena");

		root.TryGetProperty("objective", out var objective).Should().BeTrue();
		objective.GetString().Should().Be("balanced");

		root.TryGetProperty("opponentPowerUsed", out var opponentPowerUsed).Should().BeTrue();
		opponentPowerUsed.ValueKind.Should().Be(JsonValueKind.Number);

		root.TryGetProperty("historySampleCount", out var historySampleCount).Should().BeTrue();
		historySampleCount.ValueKind.Should().Be(JsonValueKind.Number);
		historySampleCount.GetInt32().Should().BeGreaterThanOrEqualTo(0);
		root.TryGetProperty("historyRecommendationCount", out var historyRecommendationCount).Should().BeTrue();
		historyRecommendationCount.ValueKind.Should().Be(JsonValueKind.Number);
		historyRecommendationCount.GetInt32().Should().BeGreaterThanOrEqualTo(0);
		root.TryGetProperty("engineRecommendationCount", out var engineRecommendationCount).Should().BeTrue();
		engineRecommendationCount.ValueKind.Should().Be(JsonValueKind.Number);
		engineRecommendationCount.GetInt32().Should().BeGreaterThanOrEqualTo(0);

		root.TryGetProperty("generatedAtUtc", out var generatedAtUtc).Should().BeTrue();
		generatedAtUtc.ValueKind.Should().Be(JsonValueKind.String);
		DateTime.TryParse(generatedAtUtc.GetString(), out _).Should().BeTrue();

		root.TryGetProperty("recommendations", out var recommendations).Should().BeTrue();
		recommendations.ValueKind.Should().Be(JsonValueKind.Array);
		recommendations.GetArrayLength().Should().BeGreaterThan(0);

		var first = recommendations.EnumerateArray().First();
		first.TryGetProperty("source", out _).Should().BeTrue();
		first.TryGetProperty("teamPreview", out _).Should().BeTrue();
		first.TryGetProperty("simulatedWinProbability", out var simulatedWinProbability).Should().BeTrue();
		simulatedWinProbability.ValueKind.Should().Be(JsonValueKind.Number);
		simulatedWinProbability.GetDouble().Should().BeGreaterThanOrEqualTo(0).And.BeLessThanOrEqualTo(1);
		first.TryGetProperty("simulationConfidenceLow", out var simulationConfidenceLow).Should().BeTrue();
		simulationConfidenceLow.ValueKind.Should().Be(JsonValueKind.Number);
		simulationConfidenceLow.GetDouble().Should().BeGreaterThanOrEqualTo(0).And.BeLessThanOrEqualTo(1);
		first.TryGetProperty("simulationConfidenceHigh", out var simulationConfidenceHigh).Should().BeTrue();
		simulationConfidenceHigh.ValueKind.Should().Be(JsonValueKind.Number);
		simulationConfidenceHigh.GetDouble().Should().BeGreaterThanOrEqualTo(0).And.BeLessThanOrEqualTo(1);
		simulationConfidenceHigh.GetDouble().Should().BeGreaterThanOrEqualTo(simulationConfidenceLow.GetDouble());
		first.TryGetProperty("simulationRuns", out var simulationRuns).Should().BeTrue();
		simulationRuns.ValueKind.Should().Be(JsonValueKind.Number);
		simulationRuns.GetInt32().Should().BeGreaterThan(0);
		first.TryGetProperty("estimatedWinProbability", out var estimatedWinProbability).Should().BeTrue();
		estimatedWinProbability.ValueKind.Should().Be(JsonValueKind.Number);
		estimatedWinProbability.GetDouble().Should().BeGreaterThanOrEqualTo(0).And.BeLessThanOrEqualTo(1);
		first.TryGetProperty("confidenceScore", out var confidenceScore).Should().BeTrue();
		confidenceScore.ValueKind.Should().Be(JsonValueKind.Number);
		confidenceScore.GetDouble().Should().BeGreaterThanOrEqualTo(0).And.BeLessThanOrEqualTo(1);
		first.TryGetProperty("finalScore", out var finalScore).Should().BeTrue();
		finalScore.ValueKind.Should().Be(JsonValueKind.Number);
		finalScore.GetDouble().Should().BeGreaterThanOrEqualTo(0).And.BeLessThanOrEqualTo(1);
		first.TryGetProperty("teamPowerEstimate", out var teamPowerEstimate).Should().BeTrue();
		teamPowerEstimate.ValueKind.Should().Be(JsonValueKind.Number);
		teamPowerEstimate.GetDouble().Should().BeGreaterThan(0);
		first.TryGetProperty("opponentPowerUsed", out var rowOpponentPowerUsed).Should().BeTrue();
		rowOpponentPowerUsed.ValueKind.Should().Be(JsonValueKind.Number);
		rowOpponentPowerUsed.GetDouble().Should().BeGreaterThan(0);
	}

	/// <summary>
	/// Verifies calibration endpoint preserves required contract fields and supported windows.
	/// </summary>
	[Fact]
	public async Task TeamRecommendationCalibration_Should_Expose_Stable_Contract_Shape() {
		// Act
		var response = await _client.GetAsync("/api/sync/teams/recommendations/calibration?mode=arena");

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
		var root = document.RootElement;

		root.TryGetProperty("mode", out var mode).Should().BeTrue();
		mode.GetString().Should().Be("arena");

		root.TryGetProperty("preferredTrendWindowDays", out var preferredTrendWindowDays).Should().BeTrue();
		preferredTrendWindowDays.ValueKind.Should().Be(JsonValueKind.Number);

		root.TryGetProperty("supportedTrendWindowDays", out var supportedTrendWindowDays).Should().BeTrue();
		supportedTrendWindowDays.ValueKind.Should().Be(JsonValueKind.Array);
		supportedTrendWindowDays.EnumerateArray().Select(v => v.GetInt32()).Should().Contain([7, 30, 90]);

		root.TryGetProperty("suggestedFrictionScale", out var suggestedFrictionScale).Should().BeTrue();
		suggestedFrictionScale.ValueKind.Should().Be(JsonValueKind.Number);

		root.TryGetProperty("trendWindows", out var trendWindows).Should().BeTrue();
		trendWindows.ValueKind.Should().Be(JsonValueKind.Array);
		trendWindows.GetArrayLength().Should().BeGreaterThan(0);

		var first = trendWindows.EnumerateArray().First();
		first.TryGetProperty("windowDays", out _).Should().BeTrue();
		first.TryGetProperty("suggestedFrictionScale", out var trendSuggestedScale).Should().BeTrue();
		trendSuggestedScale.ValueKind.Should().Be(JsonValueKind.Number);
	}

	/// <summary>
	/// Verifies operations summary endpoint returns per-mode compact calibration projection.
	/// </summary>
	[Fact]
	public async Task TeamRecommendationOperationsSummary_Should_Return_Per_Mode_Projection() {
		var response = await _client.GetAsync("/api/sync/teams/recommendations/operations-summary?preferredTrendWindowDays=30");
		response.StatusCode.Should().Be(HttpStatusCode.OK);

		using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
		var root = document.RootElement;

		root.TryGetProperty("preferredTrendWindowDays", out var preferredTrendWindowDays).Should().BeTrue();
		preferredTrendWindowDays.GetInt32().Should().Be(30);

		root.TryGetProperty("modes", out var modes).Should().BeTrue();
		modes.ValueKind.Should().Be(JsonValueKind.Array);
		modes.GetArrayLength().Should().BeGreaterThan(0);

		var modeNames = modes.EnumerateArray()
			.Select(m => m.GetProperty("mode").GetString())
			.Where(v => !string.IsNullOrWhiteSpace(v))
			.ToList();
		modeNames.Should().Contain("arena");
		modeNames.Should().Contain("grandarena");
		modeNames.Should().Contain("guildwar");
		modeNames.Should().Contain("cow");

		var first = modes.EnumerateArray().First();
		first.TryGetProperty("suggestedFrictionScale", out var suggestedFrictionScale).Should().BeTrue();
		suggestedFrictionScale.ValueKind.Should().Be(JsonValueKind.Number);
		first.TryGetProperty("meanAbsoluteError", out var meanAbsoluteError).Should().BeTrue();
		meanAbsoluteError.ValueKind.Should().Be(JsonValueKind.Number);
		first.TryGetProperty("meanBrierScore", out var meanBrierScore).Should().BeTrue();
		meanBrierScore.ValueKind.Should().Be(JsonValueKind.Number);
		first.TryGetProperty("predictionBias", out var predictionBias).Should().BeTrue();
		predictionBias.ValueKind.Should().Be(JsonValueKind.Number);
		first.TryGetProperty("samples", out var samples).Should().BeTrue();
		samples.ValueKind.Should().Be(JsonValueKind.Number);
		first.TryGetProperty("isStale", out var isStale).Should().BeTrue();
		(new[] { JsonValueKind.True, JsonValueKind.False }).Should().Contain(isStale.ValueKind);
		first.TryGetProperty("healthStatus", out var healthStatus).Should().BeTrue();
		healthStatus.ValueKind.Should().Be(JsonValueKind.String);
		(new[] { "healthy", "monitor", "stale" }).Should().Contain(healthStatus.GetString());
		first.TryGetProperty("healthLabel", out var healthLabel).Should().BeTrue();
		healthLabel.ValueKind.Should().Be(JsonValueKind.String);
		healthLabel.GetString().Should().NotBeNullOrWhiteSpace();

		var invalidResponse = await _client.GetAsync("/api/sync/teams/recommendations/operations-summary?preferredTrendWindowDays=14");
		invalidResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
		var invalidBody = await invalidResponse.Content.ReadAsStringAsync();
		invalidBody.Should().Contain("preferredTrendWindowDays must be one of: 7, 30, 90");
	}
}
