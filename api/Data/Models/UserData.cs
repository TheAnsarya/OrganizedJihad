using System;
using System.ComponentModel.DataAnnotations;

namespace OrganizedJihad.Api.Data.Models;

/// <summary>
/// Represents a user goal (short-term or long-term)
/// </summary>
public class Goal {
	[Key]
	public int Id { get; set; }

	/// <summary>
	/// Goal title/description
	/// </summary>
	[MaxLength(200)]
	public string Title { get; set; } = string.Empty;

	/// <summary>
	/// Detailed description
	/// </summary>
	public string? Description { get; set; }

	/// <summary>
	/// Goal type: "short-term" or "long-term"
	/// </summary>
	[MaxLength(20)]
	public string Type { get; set; } = "short-term";

	/// <summary>
	/// Goal category (e.g., "hero", "arena", "guild", "resource")
	/// </summary>
	[MaxLength(50)]
	public string? Category { get; set; }

	/// <summary>
	/// Target value for measurable goals
	/// </summary>
	public int? TargetValue { get; set; }

	/// <summary>
	/// Current progress value
	/// </summary>
	public int? CurrentValue { get; set; }

	/// <summary>
	/// Unit of measurement (e.g., "gold", "level", "rank")
	/// </summary>
	[MaxLength(50)]
	public string? Unit { get; set; }

	/// <summary>
	/// Whether the goal is completed
	/// </summary>
	public bool IsCompleted { get; set; }

	/// <summary>
	/// When the goal was created
	/// </summary>
	public DateTime CreatedAt { get; set; }

	/// <summary>
	/// Target completion date (optional)
	/// </summary>
	public DateTime? TargetDate { get; set; }

	/// <summary>
	/// When the goal was completed (if applicable)
	/// </summary>
	public DateTime? CompletedAt { get; set; }

	/// <summary>
	/// Priority level (1=highest, 5=lowest)
	/// </summary>
	public int Priority { get; set; } = 3;

	/// <summary>
	/// Additional notes
	/// </summary>
	public string? Notes { get; set; }
}

/// <summary>
/// Represents a calendar event or reminder
/// </summary>
public class CalendarEvent {
	[Key]
	public int Id { get; set; }

	/// <summary>
	/// Event title
	/// </summary>
	[MaxLength(200)]
	public string Title { get; set; } = string.Empty;

	/// <summary>
	/// Event description
	/// </summary>
	public string? Description { get; set; }

	/// <summary>
	/// Event type (e.g., "event", "raid", "war", "reminder")
	/// </summary>
	[MaxLength(50)]
	public string Type { get; set; } = "reminder";

	/// <summary>
	/// When the event occurs
	/// </summary>
	public DateTime EventDate { get; set; }

	/// <summary>
	/// Event duration in minutes (optional)
	/// </summary>
	public int? DurationMinutes { get; set; }

	/// <summary>
	/// Whether to send reminders
	/// </summary>
	public bool EnableReminders { get; set; }

	/// <summary>
	/// Minutes before event to send reminder
	/// </summary>
	public int? ReminderMinutesBefore { get; set; }

	/// <summary>
	/// Whether the event has occurred/been completed
	/// </summary>
	public bool IsCompleted { get; set; }

	/// <summary>
	/// Whether this is a recurring event
	/// </summary>
	public bool IsRecurring { get; set; }

	/// <summary>
	/// Recurrence pattern (e.g., "daily", "weekly", "monthly")
	/// </summary>
	[MaxLength(50)]
	public string? RecurrencePattern { get; set; }

	/// <summary>
	/// When the event was created
	/// </summary>
	public DateTime CreatedAt { get; set; }

	/// <summary>
	/// Additional notes
	/// </summary>
	public string? Notes { get; set; }
}
