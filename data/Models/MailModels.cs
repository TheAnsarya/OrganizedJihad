using OrganizedJihad.Data.Entities;
using System.ComponentModel.DataAnnotations;

namespace OrganizedJihad.Data.Models;

/// <summary>
/// Represents a mailbox message captured from the game mail list.
/// Immutable historical mail record captured from browser sync payloads.
/// </summary>
public class MailMessage : CreationAuditableEntity {
	/// <summary>
	/// Primary key (auto-increment).
	/// </summary>
	[Key]
	public int Id { get; set; }

	/// <summary>
	/// Player identifier for this mailbox snapshot row.
	/// </summary>
	public long PlayerId { get; set; }

	/// <summary>
	/// Mail identifier from game API payload.
	/// </summary>
	[MaxLength(64)]
	public string MailId { get; set; } = string.Empty;

	/// <summary>
	/// Mail category/type from source payload.
	/// </summary>
	[MaxLength(64)]
	public string MailType { get; set; } = string.Empty;

	/// <summary>
	/// Sender identifier when available.
	/// </summary>
	[MaxLength(64)]
	public string SenderId { get; set; } = string.Empty;

	/// <summary>
	/// Sender display name when available.
	/// </summary>
	[MaxLength(128)]
	public string SenderName { get; set; } = string.Empty;

	/// <summary>
	/// Message subject/title.
	/// </summary>
	[MaxLength(256)]
	public string Subject { get; set; } = string.Empty;

	/// <summary>
	/// Message body text.
	/// </summary>
	public string MessageText { get; set; } = string.Empty;

	/// <summary>
	/// Optional pre-formatted summary of rewards attached to this mail.
	/// </summary>
	[MaxLength(512)]
	public string RewardSummaryText { get; set; } = string.Empty;

	/// <summary>
	/// Raw rewards object serialized as JSON when present.
	/// </summary>
	public string? RewardsJson { get; set; }

	/// <summary>
	/// Received timestamp from game payload.
	/// </summary>
	public DateTime ReceivedAt { get; set; }

	/// <summary>
	/// Whether the mail was marked read in source payload.
	/// </summary>
	public bool IsRead { get; set; }

	/// <summary>
	/// Whether rewards were already collected in source payload.
	/// </summary>
	public bool IsCollected { get; set; }

	/// <summary>
	/// Raw mail payload serialized as JSON for diagnostics.
	/// </summary>
	public string? RawMailJson { get; set; }
}

/// <summary>
/// Represents a reward item collected from mailbox claims (mailCollect/mailFarm).
/// Immutable historical event row for economic/audit tracking.
/// </summary>
public class MailReward : CreationAuditableEntity {
	/// <summary>
	/// Primary key (auto-increment).
	/// </summary>
	[Key]
	public int Id { get; set; }

	/// <summary>
	/// Player identifier associated with this reward event.
	/// </summary>
	public long PlayerId { get; set; }

	/// <summary>
	/// Mail identifier tied to the reward claim.
	/// </summary>
	[MaxLength(64)]
	public string MailId { get; set; } = string.Empty;

	/// <summary>
	/// Source call type such as mailCollect/mailFarm.
	/// </summary>
	[MaxLength(64)]
	public string MailType { get; set; } = string.Empty;

	/// <summary>
	/// Reward category key (gold, consumable, etc).
	/// </summary>
	[MaxLength(64)]
	public string RewardType { get; set; } = string.Empty;

	/// <summary>
	/// Reward item/resource identifier.
	/// </summary>
	[MaxLength(64)]
	public string RewardId { get; set; } = string.Empty;

	/// <summary>
	/// Quantity of the reward.
	/// </summary>
	public int Quantity { get; set; }

	/// <summary>
	/// Timestamp of reward claim event.
	/// </summary>
	public DateTime Timestamp { get; set; }
}
