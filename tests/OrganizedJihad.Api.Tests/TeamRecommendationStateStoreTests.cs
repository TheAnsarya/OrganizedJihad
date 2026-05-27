using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using OrganizedJihad.Api.Services;
using OrganizedJihad.Api.Services.ProjectedItemCatalog;
using OrganizedJihad.Api.Services.TeamRecommendation;
using OrganizedJihad.Api.Services.ToolCatalog;
using OrganizedJihad.Data;
using OrganizedJihad.Data.Models;

namespace OrganizedJihad.Api.Tests;

/// <summary>
/// Tests Team Recommendation state-store persistence and malformed metadata fallback behavior.
/// </summary>
public class TeamRecommendationStateStoreTests {
	private readonly IDbContextFactory<GameDatabaseContext> _contextFactory;
	private readonly TeamRecommendationSyncMetadataStateStore _stateStore;

	/// <summary>
	/// Creates an isolated InMemory database for each test case.
	/// </summary>
	public TeamRecommendationStateStoreTests() {
		var options = new DbContextOptionsBuilder<GameDatabaseContext>()
			.UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
			.ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
			.Options;

		_contextFactory = new RecommendationStateStoreDbContextFactory(options);
		_stateStore = new TeamRecommendationSyncMetadataStateStore();
	}

	/// <summary>
	/// Verifies malformed trend-preference metadata falls back to default state.
	/// </summary>
	[Fact]
	public async Task LoadTrendPreferenceState_Should_Return_Default_On_Malformed_Metadata() {
		// Arrange
		await using (var context = await _contextFactory.CreateDbContextAsync()) {
			context.SyncMetadata.Add(new SyncMetadata {
				Key = "team_recommendation_trend_preferences_v1",
				Value = "{not-json}",
				UpdatedAt = DateTime.UtcNow,
			});
			await context.SaveChangesAsync();
		}

		// Act
		await using var loadContext = await _contextFactory.CreateDbContextAsync();
		var state = await _stateStore.LoadTrendPreferenceStateAsync(loadContext);

		// Assert
		state.ModeTrendWindowDays.Should().BeEmpty();
	}

	/// <summary>
	/// Verifies trend-preference state is persisted and reloaded correctly.
	/// </summary>
	[Fact]
	public async Task TrendPreferenceState_Should_RoundTrip() {
		// Arrange
		await using (var context = await _contextFactory.CreateDbContextAsync()) {
			var state = new TeamRecommendationTrendPreferenceState {
				ModeTrendWindowDays = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase) {
					["arena"] = 90,
					["grandarena"] = 30,
				},
			};
			await _stateStore.SaveTrendPreferenceStateAsync(context, state);
		}

		// Act
		await using var loadContext = await _contextFactory.CreateDbContextAsync();
		var loaded = await _stateStore.LoadTrendPreferenceStateAsync(loadContext);

		// Assert
		loaded.ModeTrendWindowDays.Should().ContainKey("arena").WhoseValue.Should().Be(90);
		loaded.ModeTrendWindowDays.Should().ContainKey("grandarena").WhoseValue.Should().Be(30);
	}

	/// <summary>
	/// Verifies calibration state is persisted and reloaded correctly.
	/// </summary>
	[Fact]
	public async Task CalibrationState_Should_RoundTrip() {
		// Arrange
		await using (var context = await _contextFactory.CreateDbContextAsync()) {
			var modeState = new TeamRecommendationCalibrationModeState {
				SuggestedFrictionScale = 1.12,
				Samples = 7,
				MeanAbsoluteError = 0.14,
				MeanBrierScore = 0.07,
				PredictionBias = -0.03,
			};

			var state = new TeamRecommendationCalibrationState {
				Modes = new Dictionary<string, TeamRecommendationCalibrationModeState>(StringComparer.OrdinalIgnoreCase) {
					["arena"] = modeState,
				},
			};

			await _stateStore.SaveCalibrationStateAsync(context, state);
		}

		// Act
		await using var loadContext = await _contextFactory.CreateDbContextAsync();
		var loaded = await _stateStore.LoadCalibrationStateAsync(loadContext);

		// Assert
		loaded.Modes.Should().ContainKey("arena");
		loaded.Modes["arena"].Samples.Should().Be(7);
		loaded.Modes["arena"].SuggestedFrictionScale.Should().BeApproximately(1.12, 0.0001);
	}

	/// <summary>
	/// Verifies SyncService remains compatible with the injected Team Recommendation state-store seam.
	/// </summary>
	[Fact]
	public async Task SyncService_Should_Use_Injected_StateStore_For_Trend_Preferences() {
		// Arrange
		var logger = new Mock<ILogger<SyncService>>();
		var service = new SyncService(
			_contextFactory,
			logger.Object,
			new SeededProjectedItemCatalogProvider(),
			new CuratedExternalToolCatalogProvider(),
			_stateStore
		);

		// Act
		await service.SetTeamRecommendationTrendPreferenceAsync("arena", 90);
		var response = await service.GetTeamRecommendationTrendPreferencesAsync();

		// Assert
		response.Modes.Should().Contain(entry => entry.Mode == "arena" && entry.PreferredTrendWindowDays == 90);
	}
}

internal sealed class RecommendationStateStoreDbContextFactory : IDbContextFactory<GameDatabaseContext> {
	private readonly DbContextOptions<GameDatabaseContext> _options;

	public RecommendationStateStoreDbContextFactory(DbContextOptions<GameDatabaseContext> options) {
		_options = options;
	}

	public GameDatabaseContext CreateDbContext() {
		return new GameDatabaseContext(_options);
	}
}
