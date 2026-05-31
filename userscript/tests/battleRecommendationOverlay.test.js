/**
 * Tests for BattleRecommendationOverlay
 */

import BattleRecommendationOverlay from '../src/modules/battleRecommendationOverlay.js';

function makePrefStorage(overrides = {}) {
	const store = {
		battleRecommendationOverlayVisible: true,
		battleRecommendationOverlayCollapsed: false,
		teamRecommendationsObjective: 'balanced',
		...overrides,
	};
	return {
		get: jest.fn((key, def) => store[key] ?? def),
		set: jest.fn((key, value) => { store[key] = value; }),
	};
}

function makeIdbStorage(metadata = {}) {
	return {
		getMetadata: jest.fn(async (key, def) => (key in metadata ? metadata[key] : def)),
		setMetadata: jest.fn(async () => undefined),
	};
}

describe('BattleRecommendationOverlay', () => {
	async function flushScheduledRefresh() {
		await jest.runOnlyPendingTimersAsync();
		await Promise.resolve();
	}

	beforeEach(() => {
		global.fetch = jest.fn();
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
		document.body.innerHTML = '';
		jest.restoreAllMocks();
	});

	it('should initialize panel and toggle with Alt+R', () => {
		const overlay = new BattleRecommendationOverlay(makeIdbStorage(), makePrefStorage());
		overlay.init();

		expect(document.querySelector('#oj-battle-reco-overlay')).toBeTruthy();

		const event = new KeyboardEvent('keydown', { altKey: true, key: 'r' });
		document.dispatchEvent(event);
		expect(overlay.isVisible).toBe(false);

		overlay.destroy();
	});

	it('should build arena query with opponent filters from attack context', async () => {
		const idb = makeIdbStorage({
			arenaEnemies: [{ userId: 123, name: 'Target', power: 450000 }],
		});
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'A', weightedWinRate: 0.61, confidence: 0.5, score: 0.7, battles: 12 }] }),
		});

		await overlay.onApiProcessed({
			calls: [{ name: 'arenaAttack', args: { enemyUserId: 123 } }],
		});
		await flushScheduledRefresh();

		expect(global.fetch).toHaveBeenCalled();
		const url = global.fetch.mock.calls[0][0];
		expect(url).toContain('battleType=arena');
		expect(url).toContain('opponentId=123');
		expect(url).toContain('opponentPower=450000');

		overlay.destroy();
	});

	it('should fallback to team engine when battle recommendations are empty', async () => {
		const idb = makeIdbStorage({
			arenaEnemies: [{ userId: 33, name: 'Sparse', power: 200000 }],
		});
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage({ teamRecommendationsObjective: 'offense' }));
		overlay.init();

		global.fetch
			.mockResolvedValueOnce({ ok: true, json: async () => ({ recommendations: [] }) })
			.mockResolvedValueOnce({ ok: true, json: async () => ({ recommendations: [{ teamPreview: 'Fallback Team', estimatedWinProbability: 0.7, confidenceScore: 0.6, finalScore: 0.72, sampleSize: 8 }] }) });

		await overlay.onApiProcessed({
			calls: [{ name: 'arenaAttack', args: { enemyUserId: 33 } }],
		});
		await flushScheduledRefresh();

		expect(global.fetch).toHaveBeenCalledTimes(2);
		expect(global.fetch.mock.calls[1][0]).toContain('/api/sync/teams/recommendations');
		expect(global.fetch.mock.calls[1][0]).toContain('objective=offense');

		overlay.destroy();
	});

	it('should create segmented grand arena requests for opponent teams', async () => {
		const idb = makeIdbStorage({
			grandArenaEnemies: [{ userId: 88, name: 'GrandTarget', teams: [{ power: 150000 }, { power: 160000 }, { power: 170000 }] }],
		});
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'GA Team', weightedWinRate: 0.56, confidence: 0.42, score: 0.59, battles: 5 }] }),
		});

		await overlay.onApiProcessed({
			calls: [{ name: 'grandArenaAttack', args: { enemyUserId: 88 } }],
		});
		await flushScheduledRefresh();

		expect(global.fetch).toHaveBeenCalledTimes(3);
		expect(global.fetch.mock.calls[0][0]).toContain('battleType=grandarena');
		expect(global.fetch.mock.calls[0][0]).toContain('opponentPower=150000');
		expect(global.fetch.mock.calls[1][0]).toContain('opponentPower=160000');
		expect(global.fetch.mock.calls[2][0]).toContain('opponentPower=170000');

		overlay.destroy();
	});

	it('should extract guild war opponent context from metadata mode', async () => {
		const idb = makeIdbStorage({
			guildWarDefense: {
				forts: [
					{ userId: 991, name: 'DefenderX', power: 510000 },
				],
			},
			currentGuildWar: {},
			guildWarWarlord: {},
		});
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'GW Team', estimatedWinProbability: 0.65, confidenceScore: 0.55, finalScore: 0.62 }] }),
		});

		await overlay.onApiProcessed({
			calls: [{ name: 'clanWarAttack', args: {} }],
		});
		await flushScheduledRefresh();

		const ctxText = document.querySelector('#oj-bro-context')?.textContent || '';
		expect(ctxText).toContain('Guild War');
		expect(ctxText).toContain('DefenderX');

		overlay.destroy();
	});

	it('should sanitize unsupported objective/mode in outbound team engine queries', async () => {
		const prefs = makePrefStorage({ teamRecommendationsObjective: '../../invalid-objective' });
		const overlay = new BattleRecommendationOverlay(makeIdbStorage(), prefs);
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'Safe Team', estimatedWinProbability: 0.4, confidenceScore: 0.4, finalScore: 0.4 }] }),
		});

		await overlay.onApiProcessed({ calls: [{ name: 'clashGetInfo', args: {} }] });
		await flushScheduledRefresh();

		const url = global.fetch.mock.calls[0][0];
		expect(url).toContain('mode=cow');
		expect(url).toContain('objective=balanced');

		overlay.destroy();
	});

	it('should use cached payload when API failures trigger backoff', async () => {
		const idb = makeIdbStorage({ arenaEnemies: [{ userId: 10, name: 'A', power: 100000 }] });
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage());
		overlay.init();

		global.fetch
			.mockResolvedValueOnce({ ok: true, json: async () => ({ recommendations: [{ teamPreview: 'Stable', weightedWinRate: 0.6, confidence: 0.5, score: 0.6 }] }) })
			.mockRejectedValueOnce(new Error('network down'));

		await overlay.onApiProcessed({ calls: [{ name: 'arenaAttack', args: { enemyUserId: 10 } }] });
		await overlay.refresh();

		const body = document.querySelector('#oj-bro-body')?.textContent || '';
		expect(body).toContain('Stable');

		overlay.destroy();
	});

	it('should persist drag position on mouse up', () => {
		const pref = makePrefStorage();
		const overlay = new BattleRecommendationOverlay(makeIdbStorage(), pref);
		overlay.init();

		const header = document.querySelector('#oj-bro-header');
		header.dispatchEvent(new MouseEvent('mousedown', { clientX: 120, clientY: 120, bubbles: true }));
		document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 220, bubbles: true }));
		document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

		expect(pref.set).toHaveBeenCalledWith('battleRecommendationOverlayPosition', expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));

		overlay.destroy();
	});

	it('should toggle collapsed class and persist preference', () => {
		const pref = makePrefStorage();
		const overlay = new BattleRecommendationOverlay(makeIdbStorage(), pref);
		overlay.init();

		const collapseBtn = document.querySelector('#oj-bro-collapse');
		collapseBtn.click();

		expect(document.querySelector('#oj-battle-reco-overlay')?.classList.contains('oj-bro-collapsed')).toBe(true);
		expect(pref.set).toHaveBeenCalledWith('battleRecommendationOverlayCollapsed', true);

		overlay.destroy();
	});
});
