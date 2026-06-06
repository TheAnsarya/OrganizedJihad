using OrganizedJihad.Data.Entities;
using System.ComponentModel.DataAnnotations;

namespace OrganizedJihad.Data.Models;

/// <summary>
/// Represents a single airship (zeppelin) gift claim event.
/// Immutable event row captured from zeppelinGiftGet reward responses.
/// </summary>
public class AirshipGift : CreationAuditableEntity {
	/// <summary>
	/// Primary key (auto-increment).
	/// </summary>
	[Key]
	public int Id { get; set; }

	/// <summary>
	/// Player identifier associated with the gift event.
	/// </summary>
	public long PlayerId { get; set; }

	/// <summary>
	/// Stable gift identifier from client tracking metadata.
	/// </summary>
	[MaxLength(96)]
	public string GiftId { get; set; } = string.Empty;

	/// <summary>
	/// Source action name for the captured event (for example, zeppelinGiftGet).
	/// </summary>
	[MaxLength(64)]
	public string SourceType { get; set; } = string.Empty;

	/// <summary>
	/// Optional human-readable reward summary.
	/// </summary>
	[MaxLength(512)]
	public string RewardSummaryText { get; set; } = string.Empty;

	/// <summary>
	/// Normalized reward payload serialized as JSON.
	/// </summary>
	public string RewardsJson { get; set; } = "[]";

	/// <summary>
	/// UTC timestamp when the gift was claimed.
	/// </summary>
	public DateTime Timestamp { get; set; }
}
