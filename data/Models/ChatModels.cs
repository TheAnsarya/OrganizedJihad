using OrganizedJihad.Data.Entities;
using System;
using System.ComponentModel.DataAnnotations;

namespace OrganizedJihad.Data.Models;

/// <summary>
/// Represents a chat message captured from Hero Wars game.
/// Supports guild chat, private messages, adventure party chat, and Altar of Chaos chat.
///
/// Immutable Record: Once captured from game API, never modified.
/// Inherits from CreationAuditableEntity for audit trail (DateCreated, CreatedBy).
///
/// Reference: Hero Wars chat system
/// https://hw-mobile.fandom.com/wiki/Chat
/// </summary>
public class ChatMessage : CreationAuditableEntity {
	[Key]
	public int Id { get; set; }

	/// <summary>
	/// When the message was sent (timestamp from game server)
	/// </summary>
	public DateTime Timestamp { get; set; }

	/// <summary>
	/// Type of chat where message was sent
	/// Values: "guild", "private", "adventure", "aoc" (Altar of Chaos)
	/// </summary>
	[MaxLength(20)]
	public string ChatType { get; set; } = string.Empty;

	/// <summary>
	/// Unique identifier for the chat/conversation
	/// For guild chat: guild ID
	/// For private: conversation ID or recipient user ID
	/// For adventure/AoC: party/team ID
	/// </summary>
	[MaxLength(50)]
	public string ConversationId { get; set; } = string.Empty;

	/// <summary>
	/// User ID of the message sender
	/// </summary>
	public long SenderId { get; set; }

	/// <summary>
	/// Display name of the message sender
	/// </summary>
	[MaxLength(100)]
	public string SenderName { get; set; } = string.Empty;

	/// <summary>
	/// User ID of the message recipient (for private messages only)
	/// Null for group chats (guild, adventure, AoC)
	/// </summary>
	public long? RecipientId { get; set; }

	/// <summary>
	/// Display name of the recipient (for private messages only)
	/// Null for group chats
	/// </summary>
	[MaxLength(100)]
	public string? RecipientName { get; set; }

	/// <summary>
	/// The actual message content (text)
	/// May contain emojis, game item references, player mentions
	/// </summary>
	public string MessageText { get; set; } = string.Empty;

	/// <summary>
	/// Optional: Serialized JSON of message metadata
	/// May include: attachments, item links, player mentions, reactions, etc.
	/// </summary>
	public string? MessageMetadata { get; set; }

	/// <summary>
	/// Whether this message was sent by the tracked player (outgoing)
	/// or received from another player (incoming)
	/// </summary>
	public bool IsOutgoing { get; set; }

	/// <summary>
	/// Optional: Guild name (for guild chat)
	/// </summary>
	[MaxLength(100)]
	public string? GuildName { get; set; }

	/// <summary>
	/// Optional: Adventure/AoC party name or identifier
	/// </summary>
	[MaxLength(100)]
	public string? PartyName { get; set; }

	/// <summary>
	/// Optional: Message ID from game server (if available)
	/// Used to detect duplicates and track message history
	/// </summary>
	[MaxLength(50)]
	public string? ServerMessageId { get; set; }

	/// <summary>
	/// Optional: Player level at time of message (for context)
	/// </summary>
	public int? PlayerLevel { get; set; }
}

/// <summary>
/// Aggregated statistics about chat activity for analytics.
/// Helps identify communication patterns and guild engagement.
///
/// Inherits from CreationAuditableEntity for audit trail.
/// </summary>
public class ChatActivitySummary : CreationAuditableEntity {
	[Key]
	public int Id { get; set; }

	/// <summary>
	/// Date for which this summary represents
	/// </summary>
	public DateTime SummaryDate { get; set; }

	/// <summary>
	/// Type of chat being summarized
	/// Values: "guild", "private", "adventure", "aoc"
	/// </summary>
	[MaxLength(20)]
	public string ChatType { get; set; } = string.Empty;

	/// <summary>
	/// Total number of messages sent by player on this date
	/// </summary>
	public int MessagesSent { get; set; }

	/// <summary>
	/// Total number of messages received by player on this date
	/// </summary>
	public int MessagesReceived { get; set; }

	/// <summary>
	/// Number of unique users interacted with on this date
	/// </summary>
	public int UniqueContacts { get; set; }

	/// <summary>
	/// Guild ID or conversation identifier
	/// </summary>
	[MaxLength(50)]
	public string? ConversationId { get; set; }

	/// <summary>
	/// Optional: Guild or party name
	/// </summary>
	[MaxLength(100)]
	public string? GroupName { get; set; }
}
