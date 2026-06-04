using OrganizedJihad.Api.Models;

namespace OrganizedJihad.Api.Services.ToolCatalog;

/// <summary>
/// Curated external tool catalog provider used by sync metadata endpoints.
/// </summary>
public sealed class CuratedExternalToolCatalogProvider : IExternalToolCatalogProvider {
	private static readonly DateTime ReviewedAtRecent = new(2026, 5, 26, 0, 0, 0, DateTimeKind.Utc);
	private static readonly DateTime ReviewedAtStale = new(2025, 12, 1, 0, 0, 0, DateTimeKind.Utc);

	/// <inheritdoc />
	public ToolCatalogResponse BuildCatalog(
		double? minConfidence = null,
		bool includeStale = true,
		string? category = null,
		string? verificationStatus = null,
		string? sort = null
	) {
		var tools = new List<ToolCatalogEntry> {
			new ToolCatalogEntry {
				Name = "Hero Wars Simulator (Chrome Extension)",
				Url = "https://chromewebstore.google.com/detail/hero-wars-simulator/oolajlfdlkcekemoilmmhkajgneokggb",
				Category = "simulator",
				Capabilities = "Battle calculation/simulation for arena, guild war, raid, and cross-server contexts.",
				Caveats = "Third-party service; treat as reference only. Do not copy proprietary implementation code.",
				LastReviewedUtc = ReviewedAtRecent,
				ConfidenceScore = 0.80,
			},
			new ToolCatalogEntry {
				Name = "HW-Simulator",
				Url = "https://www.hw-simulator.com/",
				Category = "simulator",
				Capabilities = "Simulator-focused site with extension ecosystem and feature plans.",
				Caveats = "Backend-dependent tool; availability and assumptions may change.",
				LastReviewedUtc = ReviewedAtRecent,
				ConfidenceScore = 0.76,
			},
			new ToolCatalogEntry {
				Name = "HW Assistant",
				Url = "https://hw-assist.com/",
				Category = "extension",
				Capabilities = "Automation/assistant extension with logs and workflow helpers.",
				Caveats = "Automation tooling may conflict with personal policy/risk tolerance.",
				LastReviewedUtc = ReviewedAtRecent,
				ConfidenceScore = 0.70,
			},
			new ToolCatalogEntry {
				Name = "Hero Wars Hub",
				Url = "https://herowarshub.com/",
				Category = "calculator",
				Capabilities = "Tooling and guides including Mysterious Island simulator resources.",
				Caveats = "Community-maintained content; verify against current game patches.",
				LastReviewedUtc = ReviewedAtRecent,
				ConfidenceScore = 0.74,
			},
			new ToolCatalogEntry {
				Name = "Hero Wars Calculator Hub",
				Url = "https://www.hwcalculator.com/",
				Category = "calculator",
				Capabilities = "Resource planning calculators for evolution, artifacts, and upgrades.",
				Caveats = "Treat outputs as planning aids; cross-check in-game values before committing resources.",
				LastReviewedUtc = ReviewedAtRecent,
				ConfidenceScore = 0.78,
			},
			new ToolCatalogEntry {
				Name = "Hero Wars Central",
				Url = "https://www.herowarscentral.com/",
				Category = "guides",
				Capabilities = "Event guides, team suggestions, and strategy writeups.",
				Caveats = "Content opinions vary; use as directional signal with local telemetry confirmation.",
				LastReviewedUtc = ReviewedAtStale,
				ConfidenceScore = 0.72,
			},
		};

		var now = DateTime.UtcNow;
		foreach (var tool in tools) {
			tool.VerificationStatus = ComputeVerificationStatus(tool, now);
		}

		if (minConfidence.HasValue) {
			var threshold = Math.Clamp(minConfidence.Value, 0d, 1d);
			tools = tools.Where(t => t.ConfidenceScore >= threshold).ToList();
		}

		if (!includeStale) {
			tools = tools.Where(t => !string.Equals(t.VerificationStatus, "stale", StringComparison.OrdinalIgnoreCase)).ToList();
		}

		if (!string.IsNullOrWhiteSpace(category)) {
			var categoryFilter = category.Trim();
			tools = tools.Where(t => string.Equals(t.Category, categoryFilter, StringComparison.OrdinalIgnoreCase)).ToList();
		}

		if (!string.IsNullOrWhiteSpace(verificationStatus)) {
			var statusFilter = verificationStatus.Trim();
			tools = tools.Where(t => string.Equals(t.VerificationStatus, statusFilter, StringComparison.OrdinalIgnoreCase)).ToList();
		}

		var normalizedSort = (sort ?? "confidence").Trim().ToLowerInvariant();
		tools = normalizedSort switch {
			"name" => tools.OrderBy(t => t.Name).ToList(),
			"reviewed" => tools.OrderByDescending(t => t.LastReviewedUtc).ToList(),
			_ => tools.OrderByDescending(t => t.ConfidenceScore).ThenBy(t => t.Name).ToList(),
		};

		return new ToolCatalogResponse {
			GeneratedAtUtc = now,
			Tools = tools,
		};
	}

	/// <inheritdoc />
	public ToolCatalogFilterMetadataResponse BuildFilterMetadata() {
		var now = DateTime.UtcNow;
		var catalog = BuildCatalog(includeStale: true, sort: "name");

		var categories = catalog.Tools
			.Select(t => t.Category)
			.Where(c => !string.IsNullOrWhiteSpace(c))
			.Distinct(StringComparer.OrdinalIgnoreCase)
			.OrderBy(c => c)
			.ToList();

		var statuses = catalog.Tools
			.Select(t => t.VerificationStatus)
			.Where(s => !string.IsNullOrWhiteSpace(s))
			.Distinct(StringComparer.OrdinalIgnoreCase)
			.OrderBy(s => s)
			.ToList();

		return new ToolCatalogFilterMetadataResponse {
			GeneratedAtUtc = now,
			Categories = categories,
			VerificationStatuses = statuses,
			SortOptions = ["confidence", "reviewed", "name"],
			DefaultMinConfidence = 0.65,
			DefaultIncludeStale = false,
			DefaultSort = "confidence",
		};
	}

	private static string ComputeVerificationStatus(ToolCatalogEntry entry, DateTime nowUtc) {
		var ageDays = (nowUtc - entry.LastReviewedUtc).TotalDays;
		if (entry.LastReviewedUtc == default || ageDays > 90) {
			return "stale";
		}

		if (entry.ConfidenceScore >= 0.75) {
			return "verified";
		}

		if (entry.ConfidenceScore >= 0.60) {
			return "partial";
		}

		return "unverified";
	}
}
