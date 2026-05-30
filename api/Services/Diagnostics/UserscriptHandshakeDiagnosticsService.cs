using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Api.Models.Ui;
using OrganizedJihad.Data;

namespace OrganizedJihad.Api.Services.Diagnostics;

/// <summary>
/// Computes userscript handshake health from synchronization metadata.
/// </summary>
public sealed class UserscriptHandshakeDiagnosticsService {
	/// <summary>
	/// Returns userscript handshake health and recency information.
	/// </summary>
	public async Task<UserscriptHandshakeStatus> GetStatusAsync(IDbContextFactory<GameDatabaseContext> contextFactory) {
		try {
			await using var context = await contextFactory.CreateDbContextAsync();
			var metadata = await context.SyncMetadata.FirstOrDefaultAsync(m => m.Key == "last_sync_timestamp");
			if (metadata is null || string.IsNullOrWhiteSpace(metadata.Value)) {
				return new UserscriptHandshakeStatus("missing", null, null, false);
			}

			if (!DateTime.TryParse(metadata.Value, out var parsed)) {
				return new UserscriptHandshakeStatus("invalid", null, null, false);
			}

			var lastSyncUtc = DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
			var ageMinutes = Math.Max(0d, (DateTime.UtcNow - lastSyncUtc).TotalMinutes);
			var hasRecentSync = ageMinutes <= 30d;
			var status = hasRecentSync ? "active" : "stale";
			return new UserscriptHandshakeStatus(status, lastSyncUtc, Math.Round(ageMinutes, 2), hasRecentSync);
		} catch {
			return new UserscriptHandshakeStatus("unknown", null, null, false);
		}
	}
}
