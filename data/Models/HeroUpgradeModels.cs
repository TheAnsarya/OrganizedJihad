using OrganizedJihad.Data.Entities;
using System;
using System.ComponentModel.DataAnnotations;

namespace OrganizedJihad.Data.Models;

/// <summary>
/// Base class for hero upgrade events, capturing the common fields
/// shared across all hero upgrade types.
/// </summary>
public abstract class HeroUpgradeBase : CreationAuditableEntity {
	/// <summary>Primary key.</summary>
	[Key]
	public int Id { get; set; }

	/// <summary>When the upgrade occurred.</summary>
	public DateTime Timestamp { get; set; }

	/// <summary>The game's internal hero ID.</summary>
	public long HeroId { get; set; }

	/// <summary>Display name of the hero.</summary>
	[MaxLength(100)]
	public string HeroName { get; set; } = string.Empty;

	/// <summary>The player who owns this hero.</summary>
	public long PlayerId { get; set; }

	/// <summary>Hero's total power after the upgrade.</summary>
	public int PowerAfter { get; set; }
}

/// <summary>
/// Tracks hero level-up events from one level to the next.
/// Recorded every time a hero gains a level.
/// </summary>
public class HeroLevelUpgrade : HeroUpgradeBase {
	/// <summary>Level before the upgrade.</summary>
	public int LevelBefore { get; set; }

	/// <summary>Level after the upgrade.</summary>
	public int LevelAfter { get; set; }

	/// <summary>Amount of experience potions or XP consumed.</summary>
	public int ExperienceSpent { get; set; }

	/// <summary>Gold cost of the level-up (if any).</summary>
	public long GoldSpent { get; set; }
}

/// <summary>
/// Tracks hero star (evolution) promotions.
/// Recorded when a hero reaches a new star tier.
/// </summary>
public class HeroStarUpgrade : HeroUpgradeBase {
	/// <summary>Star count before the upgrade.</summary>
	public int StarsBefore { get; set; }

	/// <summary>Star count after the upgrade.</summary>
	public int StarsAfter { get; set; }

	/// <summary>Number of soul stones consumed for this promotion.</summary>
	public int SoulStonesConsumed { get; set; }

	/// <summary>Gold cost if applicable.</summary>
	public long GoldSpent { get; set; }
}

/// <summary>
/// Tracks hero color (rank/tier) evolutions.
/// Recorded when a hero evolves to the next color tier (e.g., Green → Blue).
/// </summary>
public class HeroColorUpgrade : HeroUpgradeBase {
	/// <summary>Color rank before the upgrade (numeric representation).</summary>
	public int ColorBefore { get; set; }

	/// <summary>Color rank after the upgrade.</summary>
	public int ColorAfter { get; set; }

	/// <summary>Name of the color tier before (e.g., "Green+2").</summary>
	[MaxLength(50)]
	public string? ColorNameBefore { get; set; }

	/// <summary>Name of the color tier after (e.g., "Blue").</summary>
	[MaxLength(50)]
	public string? ColorNameAfter { get; set; }

	/// <summary>JSON of equipment items consumed for this evolution.</summary>
	public string? EquipmentConsumed { get; set; }
}

/// <summary>
/// Tracks hero skill level upgrades.
/// Recorded when any of a hero's skills is leveled up.
/// </summary>
public class HeroSkillUpgrade : HeroUpgradeBase {
	/// <summary>Which skill slot was upgraded (1-4, or 0 for ultimate/passive).</summary>
	public int SkillSlot { get; set; }

	/// <summary>Skill name being upgraded.</summary>
	[MaxLength(100)]
	public string SkillName { get; set; } = string.Empty;

	/// <summary>Skill level before the upgrade.</summary>
	public int SkillLevelBefore { get; set; }

	/// <summary>Skill level after the upgrade.</summary>
	public int SkillLevelAfter { get; set; }

	/// <summary>Gold spent on this skill upgrade.</summary>
	public long GoldSpent { get; set; }
}

/// <summary>
/// Tracks hero artifact upgrades (weapon, book, ring).
/// Recorded when any artifact component is upgraded.
/// </summary>
public class HeroArtifactUpgrade : HeroUpgradeBase {
	/// <summary>Which artifact type: "Weapon", "Book", or "Ring".</summary>
	[MaxLength(20)]
	public string ArtifactType { get; set; } = string.Empty;

	/// <summary>Artifact name.</summary>
	[MaxLength(100)]
	public string? ArtifactName { get; set; }

	/// <summary>Artifact level/star before the upgrade.</summary>
	public int LevelBefore { get; set; }

	/// <summary>Artifact level/star after the upgrade.</summary>
	public int LevelAfter { get; set; }

	/// <summary>Resources or items consumed (JSON).</summary>
	public string? ResourcesConsumed { get; set; }
}

/// <summary>
/// Tracks hero glyph upgrades.
/// Recorded when a hero's glyph stat is leveled.
/// </summary>
public class HeroGlyphUpgrade : HeroUpgradeBase {
	/// <summary>Which glyph stat: "Strength", "Intelligence", "Agility", "Health", "PhysicalAttack", etc.</summary>
	[MaxLength(50)]
	public string GlyphType { get; set; } = string.Empty;

	/// <summary>Glyph level before the upgrade.</summary>
	public int GlyphLevelBefore { get; set; }

	/// <summary>Glyph level after the upgrade.</summary>
	public int GlyphLevelAfter { get; set; }

	/// <summary>Gold cost of upgrading.</summary>
	public long GoldSpent { get; set; }
}

/// <summary>
/// Tracks hero skin activations and upgrades.
/// Recorded when a hero skin is unlocked or leveled.
/// </summary>
public class HeroSkinUpgrade : HeroUpgradeBase {
	/// <summary>Name of the skin (e.g., "Default", "Romantic", "Champion").</summary>
	[MaxLength(100)]
	public string SkinName { get; set; } = string.Empty;

	/// <summary>Skin ID from the game data.</summary>
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
