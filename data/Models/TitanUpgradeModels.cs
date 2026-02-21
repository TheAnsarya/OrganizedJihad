using OrganizedJihad.Data.Entities;
using System;
using System.ComponentModel.DataAnnotations;

namespace OrganizedJihad.Data.Models;

/// <summary>
/// Base class for titan upgrade events, capturing the common fields
/// shared across all titan upgrade types.
/// </summary>
public abstract class TitanUpgradeBase : CreationAuditableEntity {
	/// <summary>Primary key.</summary>
	[Key]
	public int Id { get; set; }

	/// <summary>When the upgrade occurred.</summary>
	public DateTime Timestamp { get; set; }

	/// <summary>The game's internal titan ID.</summary>
	public long TitanId { get; set; }

	/// <summary>Display name of the titan.</summary>
	[MaxLength(100)]
	public string TitanName { get; set; } = string.Empty;

	/// <summary>The player who owns this titan.</summary>
	public long PlayerId { get; set; }

	/// <summary>Titan's total power after the upgrade.</summary>
	public int PowerAfter { get; set; }
}

/// <summary>
/// Tracks titan level-up events.
/// Recorded every time a titan gains a level.
/// </summary>
public class TitanLevelUpgrade : TitanUpgradeBase {
	/// <summary>Level before the upgrade.</summary>
	public int LevelBefore { get; set; }

	/// <summary>Level after the upgrade.</summary>
	public int LevelAfter { get; set; }

	/// <summary>Amount of titan potions consumed.</summary>
	public int PotionsSpent { get; set; }

	/// <summary>Gold cost of the level-up.</summary>
	public long GoldSpent { get; set; }
}

/// <summary>
/// Tracks titan star (evolution) promotions.
/// Recorded when a titan reaches a new star tier.
/// </summary>
public class TitanStarUpgrade : TitanUpgradeBase {
	/// <summary>Star count before the upgrade.</summary>
	public int StarsBefore { get; set; }

	/// <summary>Star count after the upgrade.</summary>
	public int StarsAfter { get; set; }

	/// <summary>Number of soul stones consumed for promotion.</summary>
	public int SoulStonesConsumed { get; set; }
}

/// <summary>
/// Tracks titan skill upgrades.
/// Recorded when a titan's skill is leveled up.
/// </summary>
public class TitanSkillUpgrade : TitanUpgradeBase {
	/// <summary>Which skill was upgraded.</summary>
	[MaxLength(100)]
	public string SkillName { get; set; } = string.Empty;

	/// <summary>Skill level before the upgrade.</summary>
	public int SkillLevelBefore { get; set; }

	/// <summary>Skill level after the upgrade.</summary>
	public int SkillLevelAfter { get; set; }

	/// <summary>Titanite spent on this skill upgrade.</summary>
	public int TitaniteSpent { get; set; }
}

/// <summary>
/// Tracks titan artifact upgrades.
/// Recorded when a titan's artifact is leveled or evolved.
/// </summary>
public class TitanArtifactUpgrade : TitanUpgradeBase {
	/// <summary>Which artifact type (e.g., "Seal", "Weapon", "Totem").</summary>
	[MaxLength(50)]
	public string ArtifactType { get; set; } = string.Empty;

	/// <summary>Artifact name.</summary>
	[MaxLength(100)]
	public string? ArtifactName { get; set; }

	/// <summary>Artifact level before the upgrade.</summary>
	public int LevelBefore { get; set; }

	/// <summary>Artifact level after the upgrade.</summary>
	public int LevelAfter { get; set; }

	/// <summary>Resources consumed (JSON).</summary>
	public string? ResourcesConsumed { get; set; }
}

/// <summary>
/// Tracks titan skin upgrades.
/// Recorded when a titan skin is unlocked or leveled.
/// </summary>
public class TitanSkinUpgrade : TitanUpgradeBase {
	/// <summary>Name of the skin.</summary>
	[MaxLength(100)]
	public string SkinName { get; set; } = string.Empty;

	/// <summary>Skin ID from game data.</summary>
	[MaxLength(50)]
	public string? SkinId { get; set; }

	/// <summary>Whether this was a first unlock (true) or level-up (false).</summary>
	public bool IsNewUnlock { get; set; }

	/// <summary>Skin level before the upgrade.</summary>
	public int LevelBefore { get; set; }

	/// <summary>Skin level after the upgrade.</summary>
	public int LevelAfter { get; set; }

	/// <summary>Skin stones consumed.</summary>
	public int SkinStonesConsumed { get; set; }
}
