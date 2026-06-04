using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Data;
using OrganizedJihad.Data.Models;
using System.Text.Json;

namespace OrganizedJihad.Api.Services.TeamRecommendation;

/// <summary>
/// Abstraction for Team Recommendation calibration/trend state persistence.
/// </summary>
public interface ITeamRecommendationStateStore {
	/// <summary>
	/// Loads persisted trend preferences state.
	/// </summary>
	Task<TeamRecommendationTrendPreferenceState> LoadTrendPreferenceStateAsync(GameDatabaseContext context);

	/// <summary>
	/// Saves trend preferences state.
	/// </summary>
	Task SaveTrendPreferenceStateAsync(GameDatabaseContext context, TeamRecommendationTrendPreferenceState state);

	/// <summary>
	/// Loads persisted calibration state.
	/// </summary>
	Task<TeamRecommendationCalibrationState> LoadCalibrationStateAsync(GameDatabaseContext context);

	/// <summary>
	/// Saves calibration state.
	/// </summary>
	Task SaveCalibrationStateAsync(GameDatabaseContext context, TeamRecommendationCalibrationState state);
}

/// <summary>
/// SyncMetadata-backed implementation for Team Recommendation state persistence.
/// </summary>
public sealed class TeamRecommendationSyncMetadataStateStore : ITeamRecommendationStateStore {
	private const string TeamRecommendationCalibrationMetadataKey = "team_recommendation_calibration_v1";
	private const string TeamRecommendationTrendPreferencesMetadataKey = "team_recommendation_trend_preferences_v1";

	/// <inheritdoc />
	public async Task<TeamRecommendationTrendPreferenceState> LoadTrendPreferenceStateAsync(GameDatabaseContext context) {
		var metadata = await context.SyncMetadata
			.AsNoTracking()
			.FirstOrDefaultAsync(m => m.Key == TeamRecommendationTrendPreferencesMetadataKey);

		if (metadata == null || string.IsNullOrWhiteSpace(metadata.Value)) {
			return new TeamRecommendationTrendPreferenceState();
		}

		try {
			var parsed = JsonSerializer.Deserialize<TeamRecommendationTrendPreferenceState>(metadata.Value);
			if (parsed?.ModeTrendWindowDays == null) {
				return new TeamRecommendationTrendPreferenceState();
			}

			return parsed;
		} catch {
			return new TeamRecommendationTrendPreferenceState();
		}
	}

	/// <inheritdoc />
	public async Task SaveTrendPreferenceStateAsync(GameDatabaseContext context, TeamRecommendationTrendPreferenceState state) {
		state.UpdatedAtUtc = DateTime.UtcNow;
		var serialized = JsonSerializer.Serialize(state);
		await UpsertSyncMetadataAsync(context, TeamRecommendationTrendPreferencesMetadataKey, serialized);
	}

	/// <inheritdoc />
	public async Task<TeamRecommendationCalibrationState> LoadCalibrationStateAsync(GameDatabaseContext context) {
		var metadata = await context.SyncMetadata
			.AsNoTracking()
			.FirstOrDefaultAsync(m => m.Key == TeamRecommendationCalibrationMetadataKey);

		if (metadata == null || string.IsNullOrWhiteSpace(metadata.Value)) {
			return new TeamRecommendationCalibrationState();
		}

		try {
			var parsed = JsonSerializer.Deserialize<TeamRecommendationCalibrationState>(metadata.Value);
			if (parsed?.Modes == null) {
				return new TeamRecommendationCalibrationState();
			}

			return parsed;
		} catch {
			return new TeamRecommendationCalibrationState();
		}
	}

	/// <inheritdoc />
	public async Task SaveCalibrationStateAsync(GameDatabaseContext context, TeamRecommendationCalibrationState state) {
		state.UpdatedAtUtc = DateTime.UtcNow;
		var serialized = JsonSerializer.Serialize(state);
		await UpsertSyncMetadataAsync(context, TeamRecommendationCalibrationMetadataKey, serialized);
	}

	private static async Task UpsertSyncMetadataAsync(GameDatabaseContext context, string key, string value) {
		var metadata = await context.SyncMetadata.FirstOrDefaultAsync(m => m.Key == key);
		if (metadata == null) {
			metadata = new SyncMetadata {
				Key = key,
				Value = value,
				UpdatedAt = DateTime.UtcNow,
			};
			context.SyncMetadata.Add(metadata);
		} else {
			metadata.Value = value;
			metadata.UpdatedAt = DateTime.UtcNow;
		}

		await context.SaveChangesAsync();
	}
}
