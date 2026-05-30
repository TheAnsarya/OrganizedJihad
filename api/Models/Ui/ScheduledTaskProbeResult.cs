namespace OrganizedJihad.Api.Models.Ui;

/// <summary>
/// Represents the result of probing a Windows scheduled task.
/// </summary>
/// <param name="Status">Task status or probe result classification.</param>
/// <param name="Detail">Human-readable detail from the probe operation.</param>
public sealed record ScheduledTaskProbeResult(string Status, string Detail);
