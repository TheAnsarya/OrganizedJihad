using System;
using System.ComponentModel.DataAnnotations;

namespace OrganizedJihad.Data.Models;

/// <summary>
/// Stores sync metadata for browser-to-desktop synchronization
/// </summary>
public class SyncMetadata {
	[Key]
	public int Id { get; set; }

	/// <summary>
	/// Unique key identifying the sync data type
	/// (e.g., "last_sync_timestamp", "last_snapshot_id", "browser_version")
	/// </summary>
	[MaxLength(100)]
	public string Key { get; set; } = string.Empty;

	/// <summary>
	/// The value associated with this key
	/// </summary>
	public string Value { get; set; } = string.Empty;

	/// <summary>
	/// When this metadata was last updated
	/// </summary>
	public DateTime UpdatedAt { get; set; }

	/// <summary>
	/// Optional notes about this metadata entry
	/// </summary>
	public string? Notes { get; set; }
}
