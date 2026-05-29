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

		payload.Modes.Should().Contain(mode => mode.Value == "arena" && mode.PreferredTrendWindowDays == 7);
		payload.Modes.Should().Contain(mode => mode.Value == "cow" && mode.PreferredTrendWindowDays == 90);
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
	}
}
