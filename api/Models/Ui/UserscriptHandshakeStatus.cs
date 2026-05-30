namespace OrganizedJihad.Api.Models.Ui;

/// <summary>
/// Represents the userscript-to-API handshake health computed from sync metadata.
/// </summary>
/// <param name="Status">Current handshake status label.</param>
/// <param name="LastSyncUtc">Timestamp of the most recent sync in UTC.</param>
/// <param name="AgeMinutes">Age of the last sync in minutes.</param>
/// <param name="HasRecentSync">Whether a recent sync was observed.</param>
public sealed record UserscriptHandshakeStatus(string Status, DateTime? LastSyncUtc, double? AgeMinutes, bool HasRecentSync);
