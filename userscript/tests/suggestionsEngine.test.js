/**
 * SuggestionsEngine Tests
 *
 * Tests for the intelligent suggestion system that analyses game data
 * (heroes, resources, battles, goals) and generates actionable tips.
 *
 * Validates that:
 * - updateSuggestions() is async and calls all analysers
 * - Each analyser correctly uses the async GameTracker API
 * - Suggestions are deduplicated, dismissable, and persisted
 * - Edge cases (empty data, errors) are handled gracefully
 */

import SuggestionsEngine from '../src/modules/suggestionsEngine.js';

// ── Test helpers ──────────────────────────────────────────────────────

/**
 * Creates a mock PrefStorage (get/set).
 * @returns {Object} Mock storage with spies
 */
function createMockStorage() {
	const data = {};
	return {
		get: jest.fn((key, fallback) => (key in data ? data[key] : fallback)),
		set: jest.fn((key, val) => { data[key] = val; }),
		_data: data,
	};
}

/**
 * Creates a mock GameTracker whose async getters return configurable data.
 * @param {Object} overrides - Optional per-method return values
 * @returns {Object} Mock gameTracker
 */
function createMockGameTracker(overrides = {}) {
	return {
		getHeroRoster: jest.fn(async () => overrides.heroes ?? []),
		getResources: jest.fn(async () => overrides.resources ?? { gold: 100000, emeralds: 500, energy: 120, consumables: {}, coins: {} }),
		getBattleHistory: jest.fn(async () => overrides.battles ?? []),
	};
}

/**
 * Creates a mock GoalsManager.
 * @param {Object} goals - Active goals structure
 * @returns {Object} Mock goalsManager
 */
function createMockGoalsManager(goals = { shortTerm: [], longTerm: [] }) {
	return {
		getActiveGoals: jest.fn(() => goals),
	};
}

/**
 * Instantiate a SuggestionsEngine with default mocks.
 * @param {Object} opts - Optional overrides for storage, gameTracker, goalsManager, trackerData
 * @returns {{ engine: SuggestionsEngine, storage: Object, gameTracker: Object, goalsManager: Object }}
 */
function createEngine(opts = {}) {
	const storage = opts.storage || createMockStorage();
	const gameTracker = opts.gameTracker || createMockGameTracker(opts.trackerData);
	const goalsManager = opts.goalsManager || createMockGoalsManager(opts.goals);
	const engine = new SuggestionsEngine(storage, gameTracker, goalsManager);
	return { engine, storage, gameTracker, goalsManager };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('SuggestionsEngine', () => {
	// ── Constructor & persistence ────────────────────────────────────

	describe('constructor', () => {
		test('should initialise with empty suggestions when storage has nothing', () => {
			const { engine } = createEngine();
			expect(engine.suggestions).toEqual([]);
		});

		test('should load saved suggestions from storage', () => {
			const storage = createMockStorage();
			const saved = [{ id: 1, title: 'Test', type: 'goal', dismissed: false, timestamp: Date.now() }];
			storage._data.suggestions = saved;
			const engine = new SuggestionsEngine(storage, createMockGameTracker(), createMockGoalsManager());
			expect(engine.suggestions).toEqual(saved);
		});

		test('should handle corrupt storage data gracefully', () => {
			const storage = createMockStorage();
			storage._data.suggestions = 'not-an-array';
			const engine = new SuggestionsEngine(storage, createMockGameTracker(), createMockGoalsManager());
			expect(engine.suggestions).toEqual([]);
		});

		test('should handle storage.get throwing', () => {
			const storage = { get: () => { throw new Error('boom'); }, set: jest.fn() };
			const engine = new SuggestionsEngine(storage, createMockGameTracker(), createMockGoalsManager());
			expect(engine.suggestions).toEqual([]);
		});
	});

	// ── updateSuggestions (async orchestrator) ───────────────────────

	describe('updateSuggestions', () => {
		test('should be async and return an array', async () => {
			const { engine } = createEngine();
			const result = engine.updateSuggestions();
			expect(result).toBeInstanceOf(Promise);
			expect(Array.isArray(await result)).toBe(true);
		});

		test('should clear old suggestions before running analysers', async () => {
			const { engine } = createEngine();
			engine.suggestions = [{ id: 999, title: 'old', type: 'test' }];
			await engine.updateSuggestions();
			// Old suggestion is gone; any new ones come from analysers
			const old = engine.suggestions.find((s) => s.id === 999);
			expect(old).toBeUndefined();
		});

		test('should persist suggestions after update', async () => {
			const { engine, storage } = createEngine();
			await engine.updateSuggestions();
			expect(storage.set).toHaveBeenCalledWith('suggestions', expect.any(Array));
		});
	});

	// ── _analyzeResources ────────────────────────────────────────────

	describe('resource analysis', () => {
		test('should flag low gold (< 50 000)', async () => {
			const { engine } = createEngine({ trackerData: { resources: { gold: 10000, emeralds: 500, energy: 120 } } });
			await engine.updateSuggestions();
			const s = engine.getSuggestions().find((s) => s.title === 'Low Gold');
			expect(s).toBeDefined();
			expect(s.type).toBe('resource');
			expect(s.description).toContain('10,000');
		});

		test('should flag low emeralds (< 100)', async () => {
			const { engine } = createEngine({ trackerData: { resources: { gold: 100000, emeralds: 50, energy: 120 } } });
			await engine.updateSuggestions();
			const s = engine.getSuggestions().find((s) => s.title === 'Low Emeralds');
			expect(s).toBeDefined();
		});

		test('should flag low energy (< 20)', async () => {
			const { engine } = createEngine({ trackerData: { resources: { gold: 100000, emeralds: 500, energy: 5 } } });
			await engine.updateSuggestions();
			const s = engine.getSuggestions().find((s) => s.title === 'Low Energy');
			expect(s).toBeDefined();
		});

		test('should set high priority when resource is 0', async () => {
			const { engine } = createEngine({ trackerData: { resources: { gold: 0, emeralds: 500, energy: 120 } } });
			await engine.updateSuggestions();
			const s = engine.getSuggestions().find((s) => s.title === 'Low Gold');
			expect(s.priority).toBe('high');
		});

		test('should NOT flag resources above thresholds', async () => {
			const { engine } = createEngine({ trackerData: { resources: { gold: 100000, emeralds: 500, energy: 120 } } });
			await engine.updateSuggestions();
			expect(engine.getSuggestions().filter((s) => s.type === 'resource')).toHaveLength(0);
		});

		test('should handle gameTracker.getResources() throwing', async () => {
			const gameTracker = createMockGameTracker();
			gameTracker.getResources.mockRejectedValue(new Error('DB error'));
			const { engine } = createEngine({ gameTracker });
			await expect(engine.updateSuggestions()).resolves.toBeDefined();
		});
	});

	// ── _analyzeHeroes ───────────────────────────────────────────────

	describe('hero analysis', () => {
		test('should call getHeroRoster (NOT getHeroes)', async () => {
			const { engine, gameTracker } = createEngine();
			await engine.updateSuggestions();
			expect(gameTracker.getHeroRoster).toHaveBeenCalled();
			expect(gameTracker.getHeroes).toBeUndefined(); // method should NOT exist
		});

		test('should flag stagnant heroes (>7 days since update)', async () => {
			const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
			const heroes = [
				{ id: 1, power: 50000, timestamp: oldDate },
				{ id: 2, power: 40000, timestamp: oldDate },
			];
			const { engine } = createEngine({ trackerData: { heroes } });
			await engine.updateSuggestions();
			const s = engine.getSuggestions().find((s) => s.title === 'Hero Development');
			expect(s).toBeDefined();
			expect(s.description).toContain('2 hero(es)');
		});

		test('should flag weak heroes (< 70% avg power)', async () => {
			const heroes = [
				{ id: 1, power: 100000, timestamp: new Date().toISOString() },
				{ id: 2, power: 100000, timestamp: new Date().toISOString() },
				{ id: 3, power: 20000, timestamp: new Date().toISOString() },
			];
			const { engine } = createEngine({ trackerData: { heroes } });
			await engine.updateSuggestions();
			const s = engine.getSuggestions().find((s) => s.title === 'Balance Your Team');
			expect(s).toBeDefined();
		});

		test('should handle empty hero roster', async () => {
			const { engine } = createEngine({ trackerData: { heroes: [] } });
			await engine.updateSuggestions();
			expect(engine.getSuggestions().filter((s) => s.type === 'hero')).toHaveLength(0);
		});

		test('should handle getHeroRoster throwing', async () => {
			const gameTracker = createMockGameTracker();
			gameTracker.getHeroRoster.mockRejectedValue(new Error('fail'));
			const { engine } = createEngine({ gameTracker });
			await expect(engine.updateSuggestions()).resolves.toBeDefined();
		});
	});

	// ── _analyzeBattles ──────────────────────────────────────────────

	describe('battle analysis', () => {
		test('should flag inactivity (>12 hours since last battle)', async () => {
			const oldTime = Date.now() - 14 * 60 * 60 * 1000; // 14 hours ago
			const battles = Array.from({ length: 5 }, (_, i) => ({
				type: 'Arena',
				timestamp: oldTime - i * 3600000,
			}));
			const { engine } = createEngine({ trackerData: { battles } });
			await engine.updateSuggestions();
			const s = engine.getSuggestions().find((s) => s.title === 'Battle Activity');
			expect(s).toBeDefined();
			expect(s.description).toContain('12 hours');
		});

		test('should NOT flag when recent battle exists', async () => {
			const battles = Array.from({ length: 5 }, (_, i) => ({
				type: 'Arena',
				timestamp: Date.now() - i * 60000, // recent
			}));
			const { engine } = createEngine({ trackerData: { battles } });
			await engine.updateSuggestions();
			expect(engine.getSuggestions().filter((s) => s.type === 'battle')).toHaveLength(0);
		});

		test('should handle ISO string timestamps', async () => {
			const oldISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
			const battles = Array.from({ length: 5 }, () => ({ timestamp: oldISO }));
			const { engine } = createEngine({ trackerData: { battles } });
			await engine.updateSuggestions();
			const s = engine.getSuggestions().find((s) => s.title === 'Battle Activity');
			expect(s).toBeDefined();
		});

		test('should skip analysis with fewer than 5 battles', async () => {
			const battles = [{ timestamp: Date.now() - 24 * 60 * 60 * 1000 }];
			const { engine } = createEngine({ trackerData: { battles } });
			await engine.updateSuggestions();
			expect(engine.getSuggestions().filter((s) => s.type === 'battle')).toHaveLength(0);
		});
	});

	// ── _analyzeGoals ────────────────────────────────────────────────

	describe('goal analysis', () => {
		test('should flag goals with < 25% progress', async () => {
			const goals = {
				shortTerm: [{ id: 'g1', title: 'Max Asta', target: 100, current: 10, priority: 'high' }],
				longTerm: [],
			};
			const { engine } = createEngine({ goals });
			await engine.updateSuggestions();
			const s = engine.getSuggestions().find((s) => s.title === 'Focus on: Max Asta');
			expect(s).toBeDefined();
			expect(s.priority).toBe('high');
		});

		test('should flag overdue goals', async () => {
			const goals = {
				shortTerm: [],
				longTerm: [{ id: 'g2', title: 'Farm Gold', target: 1000, current: 500, deadline: Date.now() - 86400000, priority: 'medium' }],
			};
			const { engine } = createEngine({ goals });
			await engine.updateSuggestions();
			const s = engine.getSuggestions().find((s) => s.title === 'Overdue: Farm Gold');
			expect(s).toBeDefined();
			expect(s.priority).toBe('high');
		});

		test('should handle goals without target/current', async () => {
			const goals = {
				shortTerm: [{ id: 'g3', title: 'No target' }],
				longTerm: [],
			};
			const { engine } = createEngine({ goals });
			await engine.updateSuggestions();
			expect(engine.getSuggestions().filter((s) => s.type === 'goal')).toHaveLength(0);
		});

		test('should default priority to medium when unset', async () => {
			const goals = {
				shortTerm: [{ id: 'g4', title: 'Lazy Goal', target: 100, current: 5 }],
				longTerm: [],
			};
			const { engine } = createEngine({ goals });
			await engine.updateSuggestions();
			const s = engine.getSuggestions().find((s) => s.title === 'Focus on: Lazy Goal');
			expect(s.priority).toBe('medium');
		});
	});

	// ── Deduplication ────────────────────────────────────────────────

	describe('deduplication', () => {
		test('should not add duplicate suggestions with same title + type', async () => {
			const { engine } = createEngine();
			engine._addSuggestion({ type: 'test', priority: 'low', title: 'Dup Test' });
			engine._addSuggestion({ type: 'test', priority: 'low', title: 'Dup Test' });
			expect(engine.suggestions).toHaveLength(1);
		});

		test('should allow same title with different type', async () => {
			const { engine } = createEngine();
			engine._addSuggestion({ type: 'hero', priority: 'low', title: 'Attention' });
			engine._addSuggestion({ type: 'battle', priority: 'low', title: 'Attention' });
			expect(engine.suggestions).toHaveLength(2);
		});
	});

	// ── Filtering & dismissal ────────────────────────────────────────

	describe('filtering and dismissal', () => {
		test('getSuggestions should exclude dismissed items', () => {
			const { engine } = createEngine();
			engine._addSuggestion({ type: 'a', priority: 'low', title: 'Keep' });
			engine._addSuggestion({ type: 'b', priority: 'low', title: 'Remove' });
			engine.suggestions.find((s) => s.title === 'Remove').dismissed = true;
			expect(engine.getSuggestions()).toHaveLength(1);
			expect(engine.getSuggestions()[0].title).toBe('Keep');
		});

		test('dismissSuggestion should mark by ID and save', () => {
			const { engine, storage } = createEngine();
			engine._addSuggestion({ type: 'a', priority: 'low', title: 'X' });
			const id = engine.suggestions[0].id;
			engine.dismissSuggestion(id);
			expect(engine.suggestions[0].dismissed).toBe(true);
			expect(storage.set).toHaveBeenCalledWith('suggestions', expect.any(Array));
		});

		test('getSuggestionsByPriority should filter correctly', () => {
			const { engine } = createEngine();
			engine._addSuggestion({ type: 'a', priority: 'high', title: 'H' });
			engine._addSuggestion({ type: 'b', priority: 'low', title: 'L' });
			expect(engine.getSuggestionsByPriority('high')).toHaveLength(1);
			expect(engine.getSuggestionsByPriority('low')).toHaveLength(1);
		});

		test('getSuggestionsByType should filter correctly', () => {
			const { engine } = createEngine();
			engine._addSuggestion({ type: 'hero', priority: 'low', title: 'A' });
			engine._addSuggestion({ type: 'battle', priority: 'low', title: 'B' });
			expect(engine.getSuggestionsByType('hero')).toHaveLength(1);
			expect(engine.getSuggestionsByType('goal')).toHaveLength(0);
		});
	});

	// ── clearOldSuggestions ──────────────────────────────────────────

	describe('clearOldSuggestions', () => {
		test('should remove suggestions older than the given days', () => {
			const { engine, storage } = createEngine();
			const old = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago
			engine.suggestions = [
				{ id: 1, title: 'Old', type: 'a', timestamp: old },
				{ id: 2, title: 'New', type: 'b', timestamp: Date.now() },
			];
			engine.clearOldSuggestions(7);
			expect(engine.suggestions).toHaveLength(1);
			expect(engine.suggestions[0].title).toBe('New');
			expect(storage.set).toHaveBeenCalled();
		});
	});

	// ── getStats ─────────────────────────────────────────────────────

	describe('getStats', () => {
		test('should return correct counts', () => {
			const { engine } = createEngine();
			engine._addSuggestion({ type: 'a', priority: 'high', title: 'H1' });
			engine._addSuggestion({ type: 'b', priority: 'medium', title: 'M1' });
			engine._addSuggestion({ type: 'c', priority: 'low', title: 'L1' });
			engine.suggestions[1].dismissed = true; // dismiss medium one

			const stats = engine.getStats();
			expect(stats.total).toBe(3);
			expect(stats.active).toBe(2);
			expect(stats.dismissed).toBe(1);
			expect(stats.high).toBe(1);
			expect(stats.medium).toBe(0); // dismissed
			expect(stats.low).toBe(1);
		});
	});
});
