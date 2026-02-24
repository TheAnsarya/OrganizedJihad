/**
 * UpgradeTracker Tests
 *
 * Tests for the hero and titan upgrade event tracking system.
 * Verifies that each tracking method correctly transforms API
 * call/response data into structured records and stores them.
 *
 * Uses a mock storage that captures all add() calls for assertions.
 */

// Mock heroNames before importing UpgradeTracker
jest.mock('../src/modules/heroNames.js', () => ({
	resolveHeroName: (id) => `Hero_${id}`,
}));

import UpgradeTracker from '../src/modules/trackers/UpgradeTracker.js';

/**
 * Creates a mock IndexedDB storage that records all add() operations.
 * @returns {{ add: jest.Mock, records: Array<{store: string, record: Object}> }}
 */
function createMockStorage() {
	const records = [];
	return {
		records,
		add: jest.fn(async (store, record) => {
			records.push({ store, record });
		}),
		getMetadata: jest.fn(async () => null),
		setMetadata: jest.fn(async () => {}),
	};
}

describe('UpgradeTracker', () => {
	let tracker;
	let storage;

	beforeEach(() => {
		storage = createMockStorage();
		tracker = new UpgradeTracker(storage);
	});

	// =========================================================================
	// Hero Upgrades
	// =========================================================================

	describe('Hero skill upgrade', () => {
		test('should store skill upgrade record with correct fields', async () => {
			const args = { heroId: 42, skill: 2 };
			const response = {
				hero: { power: 50000, skills: { 2: { level: 85 } } },
			};

			await tracker.trackHeroSkillUpgrade(args, response, 'player1');

			expect(storage.add).toHaveBeenCalledTimes(1);
			const { store, record } = storage.records[0];
			expect(store).toBe('heroUpgrades');
			expect(record.upgradeType).toBe('skill');
			expect(record.heroId).toBe(42);
			expect(record.heroName).toBe('Hero_42');
			expect(record.playerId).toBe('player1');
			expect(record.powerAfter).toBe(50000);
			expect(record.skillSlot).toBe(2);
			expect(record.skillLevelAfter).toBe(85);
			expect(record.timestamp).toBeDefined();
		});

		test('should handle missing hero object in response', async () => {
			await tracker.trackHeroSkillUpgrade({ heroId: 1, skill: 0 }, {}, 'p1');
			expect(storage.add).toHaveBeenCalledTimes(1);
			expect(storage.records[0].record.powerAfter).toBe(0);
		});

		test('should use args.id when args.heroId is missing', async () => {
			await tracker.trackHeroSkillUpgrade({ id: 99, skill: 1 }, {}, 'p1');
			expect(storage.records[0].record.heroId).toBe(99);
		});
	});

	describe('Hero artifact upgrade', () => {
		test('should store artifact upgrade with slot mapping', async () => {
			const args = { heroId: 10, slotId: 1 };
			const response = {
				hero: { power: 60000, artifacts: { 1: { level: 50, name: 'Book of Power' } } },
			};

			await tracker.trackHeroArtifactUpgrade(args, response, 'p1');

			const rec = storage.records[0].record;
			expect(rec.upgradeType).toBe('artifact');
			expect(rec.heroId).toBe(10);
			expect(rec.artifactType).toBe('Book');
			expect(rec.levelAfter).toBe(50);
		});

		test('should handle unknown slot index', async () => {
			await tracker.trackHeroArtifactUpgrade({ heroId: 1, slotId: 5 }, {}, 'p1');
			expect(storage.records[0].record.artifactType).toBe('Slot_5');
		});

		test('should default slotId to 0 when missing', async () => {
			await tracker.trackHeroArtifactUpgrade({ heroId: 1 }, {}, 'p1');
			expect(storage.records[0].record.artifactType).toBe('Weapon');
		});
	});

	describe('Hero skin upgrade', () => {
		test('should store skin upgrade record', async () => {
			const args = { heroId: 20, skinId: 'skin_fire' };
			const response = {
				hero: { power: 70000, skins: { skin_fire: { level: 15, name: 'Fire Skin' } } },
			};

			await tracker.trackHeroSkinUpgrade(args, response, 'p1');

			const rec = storage.records[0].record;
			expect(rec.upgradeType).toBe('skin');
			expect(rec.heroId).toBe(20);
			expect(rec.skinId).toBe('skin_fire');
			expect(rec.skinName).toBe('Fire Skin');
			expect(rec.levelAfter).toBe(15);
			expect(rec.isNewUnlock).toBe(false);
		});

		test('should mark level 1 as new unlock', async () => {
			const response = {
				hero: { skins: { s1: { level: 1 } } },
			};
			await tracker.trackHeroSkinUpgrade({ heroId: 1, skinId: 's1' }, response, 'p1');
			expect(storage.records[0].record.isNewUnlock).toBe(true);
		});
	});

	describe('Hero glyph upgrade', () => {
		test('should store glyph upgrade with tier mapping', async () => {
			const args = { heroId: 30, tier: 0 };
			await tracker.trackHeroGlyphUpgrade(args, { hero: { power: 80000 } }, 'p1');

			const rec = storage.records[0].record;
			expect(rec.upgradeType).toBe('glyph');
			expect(rec.glyphType).toBe('Strength');
			expect(rec.powerAfter).toBe(80000);
		});

		test('should handle unknown tier', async () => {
			await tracker.trackHeroGlyphUpgrade({ heroId: 1, tier: 99 }, {}, 'p1');
			expect(storage.records[0].record.glyphType).toBe('Tier_99');
		});
	});

	describe('Hero level upgrade (XP potions)', () => {
		test('should store level upgrade record', async () => {
			const args = { heroId: 40, amount: 500 };
			const response = { hero: { power: 90000, level: 120 } };

			await tracker.trackHeroLevelUpgrade(args, response, 'p1');

			const rec = storage.records[0].record;
			expect(rec.upgradeType).toBe('level');
			expect(rec.heroId).toBe(40);
			expect(rec.levelAfter).toBe(120);
			expect(rec.experienceSpent).toBe(500);
		});
	});

	describe('Hero star upgrade', () => {
		test('should store star upgrade record', async () => {
			const args = { heroId: 50, count: 200 };
			const response = { hero: { power: 100000, star: 5 } };

			await tracker.trackHeroStarUpgrade(args, response, 'p1');

			const rec = storage.records[0].record;
			expect(rec.upgradeType).toBe('star');
			expect(rec.starsAfter).toBe(5);
			expect(rec.starsBefore).toBe(4);
			expect(rec.soulStonesConsumed).toBe(200);
		});
	});

	describe('Hero color upgrade', () => {
		test('should store color upgrade with rank names', async () => {
			const args = { heroId: 60 };
			const response = { hero: { power: 110000, color: 6 } };

			await tracker.trackHeroColorUpgrade(args, response, 'p1');

			const rec = storage.records[0].record;
			expect(rec.upgradeType).toBe('color');
			expect(rec.colorAfter).toBe('Violet');
			expect(rec.colorBefore).toBe('Blue+2');
			expect(rec.colorRankAfter).toBe(6);
			expect(rec.colorRankBefore).toBe(5);
		});

		test('should handle color rank 0', async () => {
			await tracker.trackHeroColorUpgrade({ heroId: 1 }, { hero: { color: 0 } }, 'p1');
			const rec = storage.records[0].record;
			expect(rec.colorAfter).toBe('White');
		});

		test('should handle max color rank 18', async () => {
			await tracker.trackHeroColorUpgrade({ heroId: 1 }, { hero: { color: 18 } }, 'p1');
			const rec = storage.records[0].record;
			expect(rec.colorAfter).toBe('Red+2 (Max)');
			expect(rec.colorBefore).toBe('Red+2');
			expect(rec.colorRankAfter).toBe(18);
		});
	});

	describe('Hero gold level upgrade', () => {
		test('should store gold level-up record', async () => {
			const args = { heroId: 70, level: 50 };
			const response = { hero: { power: 50000, level: 50 }, goldSpent: 25000 };

			await tracker.trackHeroGoldLevelUpgrade(args, response, 'p1');

			const rec = storage.records[0].record;
			expect(rec.upgradeType).toBe('level');
			expect(rec.levelAfter).toBe(50);
			expect(rec.levelBefore).toBe(49);
		});
	});

	// =========================================================================
	// Titan Upgrades
	// =========================================================================

	describe('Titan artifact upgrade', () => {
		test('should store titan artifact record in titanUpgrades store', async () => {
			const args = { titanId: 4001, slotId: 2 };
			const response = {
				titan: { power: 30000, artifacts: { 2: { level: 80 } } },
			};

			await tracker.trackTitanArtifactUpgrade(args, response, 'p1');

			const { store, record } = storage.records[0];
			expect(store).toBe('titanUpgrades');
			expect(record.upgradeType).toBe('artifact');
			expect(record.titanId).toBe(4001);
			expect(record.levelAfter).toBe(80);
		});
	});

	describe('Titan level upgrade', () => {
		test('should store titan level-up record', async () => {
			const args = { titanId: 4002, amount: 10 };
			const response = { titan: { power: 35000, level: 90 } };

			await tracker.trackTitanLevelUpgrade(args, response, 'p1');

			const rec = storage.records[0].record;
			expect(rec.upgradeType).toBe('level');
			expect(rec.titanId).toBe(4002);
			expect(rec.levelAfter).toBe(90);
			expect(rec.potionsSpent).toBe(10);
		});
	});

	describe('Titan star upgrade', () => {
		test('should store titan star-up record', async () => {
			const args = { titanId: 4003, count: 100 };
			const response = { titan: { power: 40000, star: 4 } };

			await tracker.trackTitanStarUpgrade(args, response, 'p1');

			const rec = storage.records[0].record;
			expect(rec.upgradeType).toBe('star');
			expect(rec.starsAfter).toBe(4);
			expect(rec.starsBefore).toBe(3);
			expect(rec.soulStonesConsumed).toBe(100);
		});
	});

	describe('Titan skill upgrade', () => {
		test('should store titan skill upgrade record', async () => {
			const args = { titanId: 4004, skill: 0 };
			const response = {
				titan: { power: 45000, skills: { 0: { level: 60 } } },
			};

			await tracker.trackTitanSkillUpgrade(args, response, 'p1');

			const rec = storage.records[0].record;
			expect(rec.upgradeType).toBe('skill');
			expect(rec.titanId).toBe(4004);
			expect(rec.skillLevelAfter).toBe(60);
		});
	});

	describe('Titan skin upgrade', () => {
		test('should store titan skin upgrade record', async () => {
			const args = { titanId: 4005, skinId: 'ts1' };
			const response = {
				titan: { power: 50000, skins: { ts1: { level: 20, name: 'Default' } } },
			};

			await tracker.trackTitanSkinUpgrade(args, response, 'p1');

			const { store, record } = storage.records[0];
			expect(store).toBe('titanUpgrades');
			expect(record.upgradeType).toBe('skin');
			expect(record.skinName).toBe('Default');
			expect(record.levelAfter).toBe(20);
		});
	});

	// =========================================================================
	// Equipment Changes
	// =========================================================================

	describe('Equipment change', () => {
		test('should store equipment change in equipmentChanges store', async () => {
			const args = { heroId: 80, slotId: 3, itemId: 'item_123' };
			const response = { hero: { power: 120000, color: 10 } };

			await tracker.trackEquipmentChange(args, response, 'p1', 'equipped');

			const { store, record } = storage.records[0];
			expect(store).toBe('equipmentChanges');
			expect(record.heroId).toBe(80);
			expect(record.slotIndex).toBe(3);
			expect(record.equipmentItemId).toBe('item_123');
			expect(record.changeType).toBe('equipped');
			expect(record.heroColorRank).toBe(10);
		});

		test('should default changeType to equipped', async () => {
			await tracker.trackEquipmentChange({ heroId: 1, slotId: 0 }, {}, 'p1');
			expect(storage.records[0].record.changeType).toBe('equipped');
		});

		test('should handle args.slot instead of args.slotId', async () => {
			await tracker.trackEquipmentChange({ heroId: 1, slot: 5 }, {}, 'p1');
			expect(storage.records[0].record.slotIndex).toBe(5);
		});

		test('should use libId when itemId is missing', async () => {
			await tracker.trackEquipmentChange({ heroId: 1, libId: 'lib_456' }, {}, 'p1');
			expect(storage.records[0].record.equipmentItemId).toBe('lib_456');
		});
	});

	// =========================================================================
	// Edge Cases
	// =========================================================================

	describe('Edge cases', () => {
		test('should handle response data passed directly without hero/titan wrapper', async () => {
			// Some API endpoints return hero data directly (no `hero:` wrapper)
			const response = { power: 99999, level: 130 };
			await tracker.trackHeroLevelUpgrade({ heroId: 1, amount: 100 }, response, 'p1');
			expect(storage.records[0].record.powerAfter).toBe(99999);
			expect(storage.records[0].record.levelAfter).toBe(130);
		});

		test('should set timestamp on every record', async () => {
			await tracker.trackHeroSkillUpgrade({ heroId: 1, skill: 0 }, {}, 'p1');
			await tracker.trackTitanLevelUpgrade({ titanId: 1 }, {}, 'p1');
			await tracker.trackEquipmentChange({ heroId: 1 }, {}, 'p1');

			for (const { record } of storage.records) {
				expect(record.timestamp).toBeDefined();
				// Should be ISO format
				expect(() => new Date(record.timestamp)).not.toThrow();
			}
		});

		test('should default numeric fields to 0 when missing', async () => {
			await tracker.trackHeroLevelUpgrade({ heroId: 1 }, {}, 'p1');
			const rec = storage.records[0].record;
			expect(rec.powerAfter).toBe(0);
			expect(rec.levelAfter).toBe(0);
			expect(rec.experienceSpent).toBe(0);
		});
	});
});
