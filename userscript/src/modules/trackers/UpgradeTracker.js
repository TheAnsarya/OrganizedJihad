/**
 * UpgradeTracker.js
 *
 * Dedicated tracker for hero and titan upgrade events captured from
 * the Hero Wars API. Transforms raw API call/response data into
 * structured records matching the C# entity models.
 *
 * Tracked API Calls:
 * - heroUpgradeSkill       → HeroSkillUpgrade
 * - heroArtifactLevelUp    → HeroArtifactUpgrade
 * - heroSkinUpgrade        → HeroSkinUpgrade
 * - heroEnchantRune        → HeroGlyphUpgrade
 * - consumableUseHeroXp    → HeroLevelUpgrade (via XP potion usage)
 * - heroLevelUp            → HeroLevelUpgrade (via gold spending)
 * - heroEvolve / promote   → HeroStarUpgrade
 * - heroColorEvolve        → HeroColorUpgrade
 * - titanArtifactLevelUp   → TitanArtifactUpgrade
 * - titanUsePotions        → TitanLevelUpgrade
 * - titanEvolve            → TitanStarUpgrade
 * - titanUpgradeSkill      → TitanSkillUpgrade
 * - titanSkinUpgrade       → TitanSkinUpgrade
 * - heroEquip              → EquipmentChange
 *
 * Entity Models (C# side):
 * - data/Models/HeroUpgradeModels.cs  (HeroUpgradeBase + 7 derived classes)
 * - data/Models/TitanUpgradeModels.cs (TitanUpgradeBase + 5 derived classes)
 *
 * References:
 * - Hero Wars Wiki: https://hw-mobile.fandom.com/wiki/Heroes
 * - Titan Wiki: https://hw-mobile.fandom.com/wiki/Titans
 *
 * @module UpgradeTracker
 */

import { resolveHeroName } from '../heroNames.js';

/**
 * Tracks hero and titan upgrade events from intercepted API calls.
 *
 * @class UpgradeTracker
 */
class UpgradeTracker {
	/**
	 * @param {import('../indexedDBStorage.js').default} storage - IndexedDB storage instance
	 */
	constructor(storage) {
		/** @type {import('../indexedDBStorage.js').default} */
		this.storage = storage;
	}

	// ========================================================================
	// Hero Upgrade Tracking
	// ========================================================================

	/**
	 * Track a hero skill upgrade event.
	 * API call: heroUpgradeSkill({heroId, skill})
	 *
	 * The response contains the updated hero object with new skill levels.
	 * We capture before/after by comparing cached hero state.
	 *
	 * @param {Object} args - Request arguments {heroId: number, skill: number}
	 * @param {Object} responseData - Response with updated hero data
	 * @param {string|number} playerId - Current player ID
	 * @returns {Promise<void>}
	 */
	async trackHeroSkillUpgrade(args, responseData, playerId) {
		const timestamp = new Date().toISOString();
		const heroId = args.heroId || args.id;

		// Extract skill info from response - HW API returns updated hero state
		const hero = responseData.hero || responseData;
		const skillSlot = args.skill ?? 0;

		const record = {
			upgradeType: 'skill',
			timestamp,
			heroId,
			heroName: resolveHeroName(heroId),
			playerId,
			powerAfter: hero?.power || 0,
			skillSlot,
			skillName: '', // Not always available in API response
			skillLevelBefore: 0, // Would need cached state to calculate
			skillLevelAfter: hero?.skills?.[skillSlot]?.level || 0,
			goldSpent: 0, // Not always in response
		};

		await this.storage.add('heroUpgrades', record);
		console.log(`[UpgradeTracker] Hero skill upgrade: Hero ${heroId}, skill slot ${skillSlot}`);
	}

	/**
	 * Track a hero artifact level-up event.
	 * API call: heroArtifactLevelUp({heroId, slotId})
	 *
	 * Slot mapping: 0 = Weapon, 1 = Book, 2 = Ring
	 * Reference: https://hw-mobile.fandom.com/wiki/Artifacts
	 *
	 * @param {Object} args - Request arguments {heroId: number, slotId: number}
	 * @param {Object} responseData - Response with updated artifact data
	 * @param {string|number} playerId - Current player ID
	 * @returns {Promise<void>}
	 */
	async trackHeroArtifactUpgrade(args, responseData, playerId) {
		const timestamp = new Date().toISOString();
		const heroId = args.heroId || args.id;
		const slotId = args.slotId ?? 0;

		// Map slot ID to artifact type name
		const artifactTypes = ['Weapon', 'Book', 'Ring'];
		const artifactType = artifactTypes[slotId] || `Slot_${slotId}`;

		// Extract artifact info from response
		const hero = responseData.hero || responseData;
		const artifact = hero?.artifacts?.[slotId] || responseData;

		const record = {
			upgradeType: 'artifact',
			timestamp,
			heroId,
			heroName: resolveHeroName(heroId),
			playerId,
			powerAfter: hero?.power || 0,
			artifactType,
			artifactName: artifact?.name || artifactType,
			levelBefore: 0, // Would need cached state
			levelAfter: artifact?.level || artifact?.star || 0,
			resourcesConsumed: JSON.stringify(args.items || {}),
		};

		await this.storage.add('heroUpgrades', record);
		console.log(`[UpgradeTracker] Hero artifact upgrade: Hero ${heroId}, ${artifactType}`);
	}

	/**
	 * Track a hero skin upgrade event.
	 * API call: heroSkinUpgrade({heroId, skinId})
	 *
	 * Reference: https://hw-mobile.fandom.com/wiki/Skins
	 *
	 * @param {Object} args - Request arguments {heroId: number, skinId: number|string}
	 * @param {Object} responseData - Response with updated skin data
	 * @param {string|number} playerId - Current player ID
	 * @returns {Promise<void>}
	 */
	async trackHeroSkinUpgrade(args, responseData, playerId) {
		const timestamp = new Date().toISOString();
		const heroId = args.heroId || args.id;
		const skinId = args.skinId;

		// Extract skin info from response
		const hero = responseData.hero || responseData;
		const skinData = hero?.skins?.[skinId] || responseData;

		const record = {
			upgradeType: 'skin',
			timestamp,
			heroId,
			heroName: resolveHeroName(heroId),
			playerId,
			powerAfter: hero?.power || 0,
			skinName: skinData?.name || `Skin_${skinId}`,
			skinId: String(skinId),
			isNewUnlock: (skinData?.level || 0) <= 1,
			levelBefore: Math.max(0, (skinData?.level || 1) - 1),
			levelAfter: skinData?.level || 1,
			skinStonesConsumed: 0, // Not always in response
		};

		await this.storage.add('heroUpgrades', record);
		console.log(`[UpgradeTracker] Hero skin upgrade: Hero ${heroId}, skin ${skinId}`);
	}

	/**
	 * Track a hero glyph enchantment event.
	 * API call: heroEnchantRune({heroId, tier, items: {consumable: {[itemId]: qty}}})
	 *
	 * Glyph tiers map to stat types (varies by hero class).
	 * Reference: https://hw-mobile.fandom.com/wiki/Glyphs
	 *
	 * @param {Object} args - Request arguments {heroId: number, tier: number, items: Object}
	 * @param {Object} responseData - Response with updated glyph data
	 * @param {string|number} playerId - Current player ID
	 * @returns {Promise<void>}
	 */
	async trackHeroGlyphUpgrade(args, responseData, playerId) {
		const timestamp = new Date().toISOString();
		const heroId = args.heroId || args.id;
		const tier = args.tier ?? 0;

		// Glyph tier names (approximate - varies by hero class)
		const glyphTypes = ['Strength', 'Intelligence', 'Agility', 'Health', 'PhysicalAttack'];
		const glyphType = glyphTypes[tier] || `Tier_${tier}`;

		const hero = responseData.hero || responseData;

		const record = {
			upgradeType: 'glyph',
			timestamp,
			heroId,
			heroName: resolveHeroName(heroId),
			playerId,
			powerAfter: hero?.power || 0,
			glyphType,
			glyphLevelBefore: 0, // Would need cached state
			glyphLevelAfter: 0, // API may not return this directly
			goldSpent: 0,
		};

		await this.storage.add('heroUpgrades', record);
		console.log(`[UpgradeTracker] Hero glyph upgrade: Hero ${heroId}, ${glyphType}`);
	}

	/**
	 * Track a hero XP potion usage (hero leveling).
	 * API call: consumableUseHeroXp({heroId, libId, amount})
	 *
	 * libId values for XP potions:
	 * - 9: Small XP Potion
	 * - 10: Medium XP Potion
	 * - 11: Large XP Potion
	 * - 12: Huge XP Potion
	 *
	 * @param {Object} args - Request arguments {heroId: number, libId: number, amount: number}
	 * @param {Object} responseData - Response with updated hero data
	 * @param {string|number} playerId - Current player ID
	 * @returns {Promise<void>}
	 */
	async trackHeroLevelUpgrade(args, responseData, playerId) {
		const timestamp = new Date().toISOString();
		const heroId = args.heroId || args.id;

		const hero = responseData.hero || responseData;

		const record = {
			upgradeType: 'level',
			timestamp,
			heroId,
			heroName: resolveHeroName(heroId),
			playerId,
			powerAfter: hero?.power || 0,
			levelBefore: 0, // Would need cached state
			levelAfter: hero?.level || 0,
			experienceSpent: args.amount || 0,
			goldSpent: 0,
		};

		await this.storage.add('heroUpgrades', record);
		console.log(`[UpgradeTracker] Hero level upgrade: Hero ${heroId}, now level ${hero?.level || '?'}`);
	}

	// ========================================================================
	// Titan Upgrade Tracking
	// ========================================================================

	/**
	 * Track a titan artifact level-up event.
	 * API call: titanArtifactLevelUp({titanId, slotId})
	 *
	 * @param {Object} args - Request arguments {titanId: number, slotId: number}
	 * @param {Object} responseData - Response with updated titan artifact data
	 * @param {string|number} playerId - Current player ID
	 * @returns {Promise<void>}
	 */
	async trackTitanArtifactUpgrade(args, responseData, playerId) {
		const timestamp = new Date().toISOString();
		const titanId = args.titanId || args.id;
		const slotId = args.slotId ?? 0;

		const titan = responseData.titan || responseData;
		const artifact = titan?.artifacts?.[slotId] || responseData;

		const record = {
			upgradeType: 'artifact',
			timestamp,
			titanId,
			titanName: resolveHeroName(titanId),
			playerId,
			powerAfter: titan?.power || 0,
			artifactType: `Slot_${slotId}`,
			artifactName: artifact?.name || `TitanArtifact_${slotId}`,
			levelBefore: 0,
			levelAfter: artifact?.level || artifact?.star || 0,
			resourcesConsumed: JSON.stringify(args.items || {}),
		};

		await this.storage.add('titanUpgrades', record);
		console.log(`[UpgradeTracker] Titan artifact upgrade: Titan ${titanId}, slot ${slotId}`);
	}

	/**
	 * Track a hero star/evolution upgrade event.
	 * API call: heroEvolve({heroId}) or promote({heroId})
	 *
	 * The hero gains a star rank, requiring soul stones.
	 * Reference: https://hw-mobile.fandom.com/wiki/Heroes#Stars
	 *
	 * @param {Object} args - Request arguments {heroId: number}
	 * @param {Object} responseData - Response with updated hero data
	 * @param {string|number} playerId - Current player ID
	 * @returns {Promise<void>}
	 */
	async trackHeroStarUpgrade(args, responseData, playerId) {
		const timestamp = new Date().toISOString();
		const heroId = args.heroId || args.id;

		const hero = responseData.hero || responseData;

		const record = {
			upgradeType: 'star',
			timestamp,
			heroId,
			heroName: resolveHeroName(heroId),
			playerId,
			powerAfter: hero?.power || 0,
			starsBefore: Math.max(0, (hero?.star || hero?.color || 1) - 1),
			starsAfter: hero?.star || hero?.color || 0,
			soulStonesConsumed: args.count || 0,
		};

		await this.storage.add('heroUpgrades', record);
		console.log(`[UpgradeTracker] Hero star upgrade: Hero ${heroId}, now ${record.starsAfter} stars`);
	}

	/**
	 * Track a hero color/rank evolution event.
	 * API call: heroColorEvolve({heroId}) or similar promotion call.
	 *
	 * Hero color ranks: White → Green → Blue → Violet → Orange → Red.
	 * Reference: https://hw-mobile.fandom.com/wiki/Heroes#Color
	 *
	 * @param {Object} args - Request arguments {heroId: number}
	 * @param {Object} responseData - Response with updated hero data
	 * @param {string|number} playerId - Current player ID
	 * @returns {Promise<void>}
	 */
	async trackHeroColorUpgrade(args, responseData, playerId) {
		const timestamp = new Date().toISOString();
		const heroId = args.heroId || args.id;

		const hero = responseData.hero || responseData;

		// Color rank names for display
		const colorNames = ['White', 'Green', 'Green+1', 'Blue', 'Blue+1', 'Blue+2',
			'Violet', 'Violet+1', 'Violet+2', 'Violet+3',
			'Orange', 'Orange+1', 'Orange+2', 'Orange+3', 'Orange+4',
			'Red', 'Red+1', 'Red+2', 'Red+2 (Max)'];

		const colorRank = hero?.color || 0;

		const record = {
			upgradeType: 'color',
			timestamp,
			heroId,
			heroName: resolveHeroName(heroId),
			playerId,
			powerAfter: hero?.power || 0,
			colorBefore: colorNames[Math.max(0, colorRank - 1)] || `Color_${colorRank - 1}`,
			colorAfter: colorNames[colorRank] || `Color_${colorRank}`,
			colorRankBefore: Math.max(0, colorRank - 1),
			colorRankAfter: colorRank,
		};

		await this.storage.add('heroUpgrades', record);
		console.log(`[UpgradeTracker] Hero color upgrade: Hero ${heroId}, now ${record.colorAfter}`);
	}

	/**
	 * Track a hero level-up via gold spending.
	 * API call: heroLevelUp({heroId, level}) - direct level purchase with gold.
	 *
	 * Different from consumableUseHeroXp which uses XP potions.
	 *
	 * @param {Object} args - Request arguments {heroId: number, level: number}
	 * @param {Object} responseData - Response with updated hero data
	 * @param {string|number} playerId - Current player ID
	 * @returns {Promise<void>}
	 */
	async trackHeroGoldLevelUpgrade(args, responseData, playerId) {
		const timestamp = new Date().toISOString();
		const heroId = args.heroId || args.id;

		const hero = responseData.hero || responseData;

		const record = {
			upgradeType: 'level',
			timestamp,
			heroId,
			heroName: resolveHeroName(heroId),
			playerId,
			powerAfter: hero?.power || 0,
			levelBefore: args.level ? args.level - 1 : 0,
			levelAfter: hero?.level || args.level || 0,
			experienceSpent: 0,
			goldSpent: responseData?.goldSpent || 0,
		};

		await this.storage.add('heroUpgrades', record);
		console.log(`[UpgradeTracker] Hero gold level-up: Hero ${heroId}, now level ${record.levelAfter}`);
	}

	/**
	 * Track a titan level-up event via potions.
	 * API call: titanUsePotions({titanId, libId, amount})
	 *
	 * @param {Object} args - Request arguments {titanId: number, libId: number, amount: number}
	 * @param {Object} responseData - Response with updated titan data
	 * @param {string|number} playerId - Current player ID
	 * @returns {Promise<void>}
	 */
	async trackTitanLevelUpgrade(args, responseData, playerId) {
		const timestamp = new Date().toISOString();
		const titanId = args.titanId || args.id;

		const titan = responseData.titan || responseData;

		const record = {
			upgradeType: 'level',
			timestamp,
			titanId,
			titanName: resolveHeroName(titanId),
			playerId,
			powerAfter: titan?.power || 0,
			levelBefore: 0, // Would need cached state
			levelAfter: titan?.level || 0,
			potionsSpent: args.amount || 1,
			goldSpent: 0,
		};

		await this.storage.add('titanUpgrades', record);
		console.log(`[UpgradeTracker] Titan level upgrade: Titan ${titanId}, now level ${titan?.level || '?'}`);
	}

	/**
	 * Track a titan star/evolution upgrade event.
	 * API call: titanEvolve({titanId}) or titanStarUp({titanId})
	 *
	 * Titan gains a star rank, requiring soul stones.
	 * Reference: https://hw-mobile.fandom.com/wiki/Titans#Stars
	 *
	 * @param {Object} args - Request arguments {titanId: number}
	 * @param {Object} responseData - Response with updated titan data
	 * @param {string|number} playerId - Current player ID
	 * @returns {Promise<void>}
	 */
	async trackTitanStarUpgrade(args, responseData, playerId) {
		const timestamp = new Date().toISOString();
		const titanId = args.titanId || args.id;

		const titan = responseData.titan || responseData;

		const record = {
			upgradeType: 'star',
			timestamp,
			titanId,
			titanName: resolveHeroName(titanId),
			playerId,
			powerAfter: titan?.power || 0,
			starsBefore: Math.max(0, (titan?.star || 1) - 1),
			starsAfter: titan?.star || 0,
			soulStonesConsumed: args.count || 0,
		};

		await this.storage.add('titanUpgrades', record);
		console.log(`[UpgradeTracker] Titan star upgrade: Titan ${titanId}, now ${record.starsAfter} stars`);
	}

	/**
	 * Track a titan skill upgrade event.
	 * API call: titanUpgradeSkill({titanId, skill})
	 *
	 * @param {Object} args - Request arguments {titanId: number, skill: number}
	 * @param {Object} responseData - Response with updated titan data
	 * @param {string|number} playerId - Current player ID
	 * @returns {Promise<void>}
	 */
	async trackTitanSkillUpgrade(args, responseData, playerId) {
		const timestamp = new Date().toISOString();
		const titanId = args.titanId || args.id;

		const titan = responseData.titan || responseData;
		const skillIndex = args.skill ?? 0;

		const record = {
			upgradeType: 'skill',
			timestamp,
			titanId,
			titanName: resolveHeroName(titanId),
			playerId,
			powerAfter: titan?.power || 0,
			skillName: '', // Not always available in API response
			skillLevelBefore: 0, // Would need cached state
			skillLevelAfter: titan?.skills?.[skillIndex]?.level || 0,
			titaniteSpent: responseData?.titaniteSpent || 0,
		};

		await this.storage.add('titanUpgrades', record);
		console.log(`[UpgradeTracker] Titan skill upgrade: Titan ${titanId}, skill ${skillIndex}`);
	}

	/**
	 * Track a titan skin upgrade event.
	 * API call: titanSkinUpgrade({titanId, skinId})
	 *
	 * @param {Object} args - Request arguments {titanId: number, skinId: number|string}
	 * @param {Object} responseData - Response with updated titan data
	 * @param {string|number} playerId - Current player ID
	 * @returns {Promise<void>}
	 */
	async trackTitanSkinUpgrade(args, responseData, playerId) {
		const timestamp = new Date().toISOString();
		const titanId = args.titanId || args.id;
		const skinId = args.skinId;

		const titan = responseData.titan || responseData;
		const skinData = titan?.skins?.[skinId] || responseData;

		const record = {
			upgradeType: 'skin',
			timestamp,
			titanId,
			titanName: resolveHeroName(titanId),
			playerId,
			powerAfter: titan?.power || 0,
			skinName: skinData?.name || `Skin_${skinId}`,
			skinId: String(skinId),
			isNewUnlock: (skinData?.level || 0) <= 1,
			levelBefore: Math.max(0, (skinData?.level || 1) - 1),
			levelAfter: skinData?.level || 1,
		};

		await this.storage.add('titanUpgrades', record);
		console.log(`[UpgradeTracker] Titan skin upgrade: Titan ${titanId}, skin ${skinId}`);
	}

	/**
	 * Track an equipment change on a hero.
	 * API call: heroEquip({heroId, slotId, itemId}) or similar equipment call.
	 *
	 * Records when a hero equips, upgrades, or evolves gear.
	 * Reference: https://hw-mobile.fandom.com/wiki/Equipment
	 *
	 * @param {Object} args - Request arguments {heroId: number, slotId: number, itemId: string|number}
	 * @param {Object} responseData - Response with updated hero data
	 * @param {string|number} playerId - Current player ID
	 * @param {string} [changeType='equipped'] - Type of change: 'equipped', 'upgraded', 'evolved'
	 * @returns {Promise<void>}
	 */
	async trackEquipmentChange(args, responseData, playerId, changeType = 'equipped') {
		const timestamp = new Date().toISOString();
		const heroId = args.heroId || args.id;
		const slotIndex = args.slotId ?? args.slot ?? 0;

		const hero = responseData.hero || responseData;

		const record = {
			timestamp,
			heroId,
			heroName: resolveHeroName(heroId),
			slotIndex,
			equipmentItemId: String(args.itemId || args.libId || ''),
			equipmentName: '', // Item name not always in response
			changeType,
			heroColorRank: hero?.color || 0,
			materialsConsumed: JSON.stringify(args.items || {}),
			playerId,
		};

		await this.storage.add('equipmentChanges', record);
		console.log(`[UpgradeTracker] Equipment ${changeType}: Hero ${heroId}, slot ${slotIndex}`);
	}
}

export default UpgradeTracker;
