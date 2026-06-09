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

	it('should auto-show hidden overlay when arena combat context arrives', async () => {
		const prefs = makePrefStorage({
			battleRecommendationOverlayVisible: false,
			battleRecommendationOverlayAutoShow: true,
		});
		const overlay = new BattleRecommendationOverlay(makeIdbStorage(), prefs);
		overlay.init();

		expect(overlay.isVisible).toBe(false);

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'Auto Team', weightedWinRate: 0.61, confidence: 0.5, score: 0.7, battles: 12 }] }),
		});

		await overlay.onApiProcessed({
			calls: [{ name: 'arenaAttack', args: { enemyUserId: 123 } }],
		});
		const hintBeforeFlush = document.querySelector('#oj-bro-hints')?.textContent || '';
		expect(hintBeforeFlush.toLowerCase()).toContain('auto-opened');
		await flushScheduledRefresh();

		expect(overlay.isVisible).toBe(true);
		expect(prefs.set).toHaveBeenCalledWith('battleRecommendationOverlayVisible', true);
		expect(global.fetch).toHaveBeenCalled();
		const ctxText = document.querySelector('#oj-bro-context')?.textContent || '';
		expect(ctxText).toContain('Auto-opened');

		overlay.destroy();
	});

	it('should clamp off-screen saved overlay position into viewport on init', () => {
		const prefs = makePrefStorage({
			battleRecommendationOverlayPosition: { x: 100000, y: 100000 },
		});
		const overlay = new BattleRecommendationOverlay(makeIdbStorage(), prefs);
		overlay.init();

		const panel = document.querySelector('#oj-battle-reco-overlay');
		expect(panel).toBeTruthy();

		const left = parseInt(panel.style.left || '0', 10);
		const top = parseInt(panel.style.top || '0', 10);
		expect(left).toBeLessThanOrEqual(window.innerWidth);
		expect(top).toBeLessThanOrEqual(window.innerHeight);

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
		expect(url).toContain('/api/sync/teams/recommendations/arena/simulate');
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
			.mockResolvedValueOnce({ ok: true, json: async () => ({ recommendations: [] }) })
			.mockResolvedValueOnce({ ok: true, json: async () => ({ recommendations: [{ teamPreview: 'Fallback Team', estimatedWinProbability: 0.7, confidenceScore: 0.6, finalScore: 0.72, sampleSize: 8 }] }) });

		await overlay.onApiProcessed({
			calls: [{ name: 'arenaAttack', args: { enemyUserId: 33 } }],
		});
		await flushScheduledRefresh();

		expect(global.fetch).toHaveBeenCalledTimes(3);
		expect(global.fetch.mock.calls[1][0]).toContain('/api/sync/battles/recommendations');
		expect(global.fetch.mock.calls[2][0]).toContain('/api/sync/teams/recommendations');
		expect(global.fetch.mock.calls[2][0]).toContain('objective=offense');

		overlay.destroy();
	});

	it('should render simulated win probability fields from battle payloads', async () => {
		const idb = makeIdbStorage({
			arenaEnemies: [{ userId: 45, name: 'Simulator Target', power: 390000 }],
		});
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				recommendations: [{
					TeamPreview: 'Sim Team',
					simulatedWinProbability: 0.74,
					simulationConfidenceLow: 0.58,
					simulationConfidenceHigh: 0.80,
					simulationRuns: 1400,
					teamPowerEstimate: 520000,
					opponentPowerUsed: 390000,
					totalBattles: 9,
				}],
			}),
		});

		await overlay.onApiProcessed({
			calls: [{ name: 'arenaAttack', args: { enemyUserId: 45 } }],
		});
		await flushScheduledRefresh();

		const bodyText = document.querySelector('#oj-bro-body')?.textContent || '';
		expect(bodyText).toContain('Sim Team');
		expect(bodyText).toContain('74.0%');
		expect(bodyText).toContain('58.0%-80.0%');
		expect(bodyText).toContain('Runs 1400');
		expect(bodyText).toContain('Power team 520,000');
		expect(bodyText).toContain('opp 390,000');

		overlay.destroy();
	});

	it('should render API sparse-data note when present in payload', async () => {
		const idb = makeIdbStorage({
			arenaEnemies: [{ userId: 78, name: 'Sparse Target', power: 280000 }],
		});
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				note: 'Sparse historical arena data; using engine-backed simulated recommendations.',
				recommendations: [{
					teamPreview: 'Sparse Team',
					estimatedWinProbability: 0.62,
					confidenceScore: 0.5,
					finalScore: 0.6,
				}],
			}),
		});

		await overlay.onApiProcessed({
			calls: [{ name: 'arenaAttack', args: { enemyUserId: 78 } }],
		});
		await flushScheduledRefresh();

		const bodyText = document.querySelector('#oj-bro-body')?.textContent || '';
		expect(bodyText).toContain('Sparse historical arena data; using engine-backed simulated recommendations.');

		overlay.destroy();
	});

	it('should render hero avatar icons from recommendation team preview names', async () => {
		const idb = makeIdbStorage({
			arenaEnemies: [{ userId: 79, name: 'Avatar Target', power: 300000 }],
		});
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				recommendations: [{
					teamPreview: 'Galahad, Astaroth, Thea, Keira, Faceless',
					weightedWinRate: 0.66,
					confidence: 0.59,
					score: 0.69,
					battles: 14,
				}],
			}),
		});

		await overlay.onApiProcessed({
			calls: [{ name: 'arenaAttack', args: { enemyUserId: 79 } }],
		});
		await flushScheduledRefresh();

		const icons = document.querySelectorAll('.oj-bro-team-icon');
		expect(icons.length).toBeGreaterThanOrEqual(5);
		expect(icons[0].getAttribute('src')).toContain('hero_icons');

		overlay.destroy();
	});

	it('should render quality and source tags on recommendation cards', async () => {
		const idb = makeIdbStorage({
			arenaEnemies: [{ userId: 82, name: 'Tag Target', power: 355000 }],
		});
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				recommendations: [{
					teamPreview: 'Astaroth, Galahad, Keira, Thea, Faceless',
					weightedWinRate: 0.72,
					confidence: 0.76,
					score: 0.74,
					battles: 34,
					simulatedWinProbability: 0.71,
					simulationRuns: 1800,
					sourceType: 'engine',
				}],
			}),
		});

		await overlay.onApiProcessed({
			calls: [{ name: 'arenaAttack', args: { enemyUserId: 82 } }],
		});
		await flushScheduledRefresh();

		const tagsText = document.querySelector('.oj-bro-tags')?.textContent || '';
		expect(tagsText).toContain('High confidence');
		expect(tagsText).toContain('Strong sample');
		expect(tagsText).toContain('Simulator');
		expect(tagsText).toContain('Engine fallback');

		overlay.destroy();
	});

	it('should apply payload sourceType to recommendation tags when card source is absent', async () => {
		const idb = makeIdbStorage({
			grandArenaEnemies: [{ userId: 83, name: 'Source Target', teams: [{ power: 220000 }, { power: 225000 }, { power: 230000 }] }],
		});
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				recommendations: [{
					teamPreview: 'Astaroth, Galahad, Keira, Thea, Faceless',
					weightedWinRate: 0.62,
					confidence: 0.49,
					score: 0.65,
					battles: 12,
				}],
			}),
		});

		await overlay.onApiProcessed({
			calls: [{ name: 'grandArenaAttack', args: { enemyUserId: 83 } }],
		});
		await flushScheduledRefresh();

		const tagsText = document.querySelector('.oj-bro-tags')?.textContent || '';
		expect(tagsText).toContain('Battle history');

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

	it('should build segmented grand arena recommendations from enemy list trigger', async () => {
		const idb = makeIdbStorage({
			grandArenaEnemies: [
				{ userId: 7, name: 'Lower GA', teams: [{ power: 110000 }, { power: 120000 }, { power: 130000 }] },
				{ userId: 8, name: 'Higher GA', teams: [{ power: 210000 }, { power: 220000 }, { power: 230000 }] },
			],
		});
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'GA List Team', weightedWinRate: 0.57, confidence: 0.47, score: 0.56, battles: 7 }] }),
		});

		await overlay.onApiProcessed({ calls: [{ name: 'grandArenaGetEnemies', args: {} }] });
		await flushScheduledRefresh();

		expect(global.fetch).toHaveBeenCalledTimes(3);
		expect(global.fetch.mock.calls[0][0]).toContain('battleType=grandarena');
		expect(global.fetch.mock.calls[0][0]).toContain('opponentId=8');
		expect(global.fetch.mock.calls[0][0]).toContain('opponentPower=210000');
		expect(global.fetch.mock.calls[1][0]).toContain('opponentPower=220000');
		expect(global.fetch.mock.calls[2][0]).toContain('opponentPower=230000');

		overlay.destroy();
	});

	it('should build titan arena query from enemy list trigger', async () => {
		const idb = makeIdbStorage({
			titanArenaEnemies: [
				{ userId: 91, name: 'Titan Lower', power: 150000 },
				{ userId: 92, name: 'Titan Higher', power: 260000 },
			],
		});
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'Titan List Team', weightedWinRate: 0.6, confidence: 0.5, score: 0.58, battles: 9 }] }),
		});

		await overlay.onApiProcessed({ calls: [{ name: 'titanArenaGetEnemies', args: {} }] });
		await flushScheduledRefresh();

		const url = global.fetch.mock.calls[0][0];
		expect(url).toContain('battleType=titanarena');
		expect(url).toContain('opponentId=92');
		expect(url).toContain('opponentPower=260000');

		overlay.destroy();
	});

	it('should treat grandArenaFindEnemies alias as grand arena enemy-list trigger', async () => {
		const idb = makeIdbStorage({
			grandArenaEnemies: [{ userId: 17, name: 'Grand Alias', teams: [{ power: 190000 }, { power: 195000 }, { power: 200000 }] }],
		});
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'GA Alias Team', weightedWinRate: 0.58, confidence: 0.48, score: 0.57, battles: 8 }] }),
		});

		await overlay.onApiProcessed({ calls: [{ name: 'grandArenaFindEnemies', args: {} }] });
		await flushScheduledRefresh();

		expect(global.fetch.mock.calls[0][0]).toContain('battleType=grandarena');
		expect(global.fetch.mock.calls[0][0]).toContain('opponentId=17');

		overlay.destroy();
	});

	it('should treat titanArenaFindEnemies alias as titan arena enemy-list trigger', async () => {
		const idb = makeIdbStorage({
			titanArenaEnemies: [{ userId: 71, name: 'Titan Alias', power: 225000 }],
		});
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'Titan Alias Team', weightedWinRate: 0.59, confidence: 0.49, score: 0.58, battles: 10 }] }),
		});

		await overlay.onApiProcessed({ calls: [{ name: 'titanArenaFindEnemies', args: {} }] });
		await flushScheduledRefresh();

		const url = global.fetch.mock.calls[0][0];
		expect(url).toContain('battleType=titanarena');
		expect(url).toContain('opponentId=71');

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

	it('should use adventure mode for adventure context recommendations', async () => {
		const overlay = new BattleRecommendationOverlay(makeIdbStorage(), makePrefStorage({ teamRecommendationsObjective: 'sustain' }));
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'Adventure Team', estimatedWinProbability: 0.63, confidenceScore: 0.56, finalScore: 0.61 }] }),
		});

		await overlay.onApiProcessed({ calls: [{ name: 'adventure_getActiveData', args: {} }] });
		await flushScheduledRefresh();

		const url = global.fetch.mock.calls[0][0];
		expect(url).toContain('mode=adventure');
		expect(url).toContain('objective=sustain');

		const ctxText = document.querySelector('#oj-bro-context')?.textContent || '';
		expect(ctxText).toContain('Adventure');

		overlay.destroy();
	});

	it('should use dungeon engine mode for dungeon context with sparse min samples', async () => {
		const overlay = new BattleRecommendationOverlay(makeIdbStorage(), makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'Dungeon Team', estimatedWinProbability: 0.57, confidenceScore: 0.46, finalScore: 0.55 }] }),
		});

		await overlay.onApiProcessed({ calls: [{ name: 'dungeonGetState', args: {} }] });
		await flushScheduledRefresh();

		const url = global.fetch.mock.calls[0][0];
		expect(url).toContain('mode=dungeon');
		expect(url).toContain('minSamples=1');

		const ctxText = document.querySelector('#oj-bro-context')?.textContent || '';
		expect(ctxText).toContain('Dungeon');

		overlay.destroy();
	});

	it('should use toe engine mode for toe context while preserving toe label', async () => {
		const overlay = new BattleRecommendationOverlay(makeIdbStorage(), makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'ToE Team', estimatedWinProbability: 0.6, confidenceScore: 0.5, finalScore: 0.58 }] }),
		});

		await overlay.onApiProcessed({ calls: [{ name: 'powerTournament_getState', args: {} }] });
		await flushScheduledRefresh();

		const url = global.fetch.mock.calls[0][0];
		expect(url).toContain('mode=toe');
		expect(url).toContain('minSamples=1');

		const ctxText = document.querySelector('#oj-bro-context')?.textContent || '';
		expect(ctxText).toContain('Tournament of Elements');

		overlay.destroy();
	});

	it('should use dungeon args to enrich context name and opponent id for battle calls', async () => {
		const overlay = new BattleRecommendationOverlay(makeIdbStorage(), makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'Dungeon Push', estimatedWinProbability: 0.61, confidenceScore: 0.49, finalScore: 0.57 }] }),
		});

		await overlay.onApiProcessed({
			calls: [{
				name: 'dungeonBattle',
				args: {
					targetUserId: 777,
					targetName: 'Dungeon Guardian',
					targetPower: 345000,
				},
			}],
		});
		await flushScheduledRefresh();

		const url = global.fetch.mock.calls[0][0];
		expect(url).toContain('mode=dungeon');

		const ctxText = document.querySelector('#oj-bro-context')?.textContent || '';
		expect(ctxText).toContain('Dungeon');
		expect(ctxText).toContain('Dungeon Guardian');

		overlay.destroy();
	});

	it('should extract toe nested args for context labels and direct toe mode requests', async () => {
		const overlay = new BattleRecommendationOverlay(makeIdbStorage(), makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'Element Team', estimatedWinProbability: 0.62, confidenceScore: 0.51, finalScore: 0.6 }] }),
		});

		await overlay.onApiProcessed({
			calls: [{
				name: 'tournamentBattle',
				args: {
					target: {
						id: 991,
						name: 'Elemental Champion',
						power: 510000,
					},
				},
			}],
		});
		await flushScheduledRefresh();

		const url = global.fetch.mock.calls[0][0];
		expect(url).toContain('mode=toe');

		const ctxText = document.querySelector('#oj-bro-context')?.textContent || '';
		expect(ctxText).toContain('Tournament of Elements');
		expect(ctxText).toContain('Elemental Champion');

		overlay.destroy();
	});

	it('should keep high-priority toe battle context when low-priority mode state call follows', async () => {
		const overlay = new BattleRecommendationOverlay(makeIdbStorage(), makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'Stable ToE Team', estimatedWinProbability: 0.64, confidenceScore: 0.53, finalScore: 0.61 }] }),
		});

		await overlay.onApiProcessed({
			calls: [
				{ name: 'tournamentBattle', args: { targetUserId: 22, targetName: 'ToE Rival', targetPower: 420000 } },
				{ name: 'clashGetInfo', args: {} },
			],
		});
		await flushScheduledRefresh();

		const url = global.fetch.mock.calls[0][0];
		expect(url).toContain('mode=toe');

		const ctxText = document.querySelector('#oj-bro-context')?.textContent || '';
		expect(ctxText).toContain('Tournament of Elements');

		overlay.destroy();
	});

	it('should use defense objective by default for guild war mode', async () => {
		const overlay = new BattleRecommendationOverlay(makeIdbStorage(), makePrefStorage({ teamRecommendationsObjective: 'balanced' }));
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'War Team', estimatedWinProbability: 0.58, confidenceScore: 0.48, finalScore: 0.56 }] }),
		});

		await overlay.onApiProcessed({ calls: [{ name: 'clanWarGetInfo', args: {} }] });
		await flushScheduledRefresh();

		const url = global.fetch.mock.calls[0][0];
		expect(url).toContain('mode=guildwar');
		expect(url).toContain('objective=defense');

		overlay.destroy();
	});

	it('should treat clanWarGetDefense alias as guild war mode trigger', async () => {
		const overlay = new BattleRecommendationOverlay(makeIdbStorage(), makePrefStorage({ teamRecommendationsObjective: 'balanced' }));
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'Defense Alias Team', estimatedWinProbability: 0.56, confidenceScore: 0.45, finalScore: 0.54 }] }),
		});

		await overlay.onApiProcessed({ calls: [{ name: 'clanWarGetDefense', args: {} }] });
		await flushScheduledRefresh();

		const url = global.fetch.mock.calls[0][0];
		expect(url).toContain('mode=guildwar');
		expect(url).toContain('objective=defense');

		overlay.destroy();
	});

	it('should adapt arena power window based on opponent power', async () => {
		const idb = makeIdbStorage({
			arenaEnemies: [{ userId: 900, name: 'Heavy Target', power: 900000 }],
		});
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'Arena Team', weightedWinRate: 0.62, confidence: 0.52, score: 0.6, battles: 20 }] }),
		});

		await overlay.onApiProcessed({ calls: [{ name: 'arenaAttack', args: { enemyUserId: 900 } }] });
		await flushScheduledRefresh();

		const url = global.fetch.mock.calls[0][0];
		expect(url).toContain('powerWindow=72000');

		overlay.destroy();
	});

	it('should ignore invalid oversized ids and powers from args in arena battle queries', async () => {
		const overlay = new BattleRecommendationOverlay(makeIdbStorage(), makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'Safe Arena Team', weightedWinRate: 0.55, confidence: 0.45, score: 0.54, battles: 6 }] }),
		});

		await overlay.onApiProcessed({
			calls: [{
				name: 'arenaAttack',
				args: {
					targetUserId: 999999999999,
					targetPower: 999999999999,
				},
			}],
		});
		await flushScheduledRefresh();

		const url = global.fetch.mock.calls[0][0];
		expect(url).toContain('/api/sync/teams/recommendations/arena/simulate');
		expect(url).not.toContain('opponentId=');
		expect(url).not.toContain('opponentPower=');

		overlay.destroy();
	});

	it('should pick strongest enemy from enemy list context instead of first row', async () => {
		const idb = makeIdbStorage({
			arenaEnemies: [
				{ userId: 1, name: 'Low', power: 120000 },
				{ userId: 2, name: 'High', power: 510000 },
			],
		});
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'List Team', weightedWinRate: 0.58, confidence: 0.49, score: 0.57, battles: 9 }] }),
		});

		await overlay.onApiProcessed({ calls: [{ name: 'arenaGetEnemies', args: {} }] });
		await flushScheduledRefresh();

		const url = global.fetch.mock.calls[0][0];
		expect(url).toContain('opponentId=2');
		expect(url).toContain('opponentPower=510000');

		overlay.destroy();
	});

	it('should fallback to floor label when dungeon payload has no explicit target name', async () => {
		const overlay = new BattleRecommendationOverlay(makeIdbStorage(), makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'Floor Team', estimatedWinProbability: 0.59, confidenceScore: 0.48, finalScore: 0.57 }] }),
		});

		await overlay.onApiProcessed({ calls: [{ name: 'dungeonBattle', args: { floor: 7 } }] });
		await flushScheduledRefresh();

		const ctxText = document.querySelector('#oj-bro-context')?.textContent || '';
		expect(ctxText).toContain('Floor 7');

		overlay.destroy();
	});

	it('should prioritize dedicated last-target metadata for dungeon context', async () => {
		const idb = makeIdbStorage({
			battleRecommendationLastTargetDungeon: {
				userId: 456,
				name: 'Dungeon Last Target',
				power: 380000,
				lastUpdate: Date.now(),
			},
			towerState: {
				floor: 10,
				lastUpdate: Date.now() - 120000,
			},
		});
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'Dungeon Last Team', estimatedWinProbability: 0.6, confidenceScore: 0.5, finalScore: 0.58 }] }),
		});

		await overlay.onApiProcessed({ calls: [{ name: 'dungeonGetState', args: {} }] });
		await flushScheduledRefresh();

		const url = global.fetch.mock.calls[0][0];
		expect(url).toContain('mode=dungeon');

		const ctxText = document.querySelector('#oj-bro-context')?.textContent || '';
		expect(ctxText).toContain('Dungeon Last Target');
		expect(ctxText).toContain('Fresh Metadata');

		overlay.destroy();
	});

	it('should show live args signal when context comes from battle args', async () => {
		const overlay = new BattleRecommendationOverlay(makeIdbStorage(), makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'Args Team', estimatedWinProbability: 0.61, confidenceScore: 0.5, finalScore: 0.58 }] }),
		});

		await overlay.onApiProcessed({
			calls: [{
				name: 'tournamentBattle',
				args: { targetUserId: 44, targetName: 'Args Rival', targetPower: 300000 },
			}],
		});
		await flushScheduledRefresh();

		const ctxText = document.querySelector('#oj-bro-context')?.textContent || '';
		expect(ctxText).toContain('Live Args');

		overlay.destroy();
	});

	it('should fallback to dedicated arena last-target metadata when attack args are sparse', async () => {
		const idb = makeIdbStorage({
			arenaEnemies: [],
			battleRecommendationLastTargetArena: {
				userId: 701,
				name: 'Arena Last Target',
				power: 540000,
				lastUpdate: Date.now(),
			},
		});
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'Arena Anchor', weightedWinRate: 0.62, confidence: 0.52, score: 0.6, battles: 11 }] }),
		});

		await overlay.onApiProcessed({ calls: [{ name: 'arenaAttack', args: {} }] });
		await flushScheduledRefresh();

		const url = global.fetch.mock.calls[0][0];
		expect(url).toContain('/api/sync/teams/recommendations/arena/simulate');
		expect(url).toContain('opponentId=701');
		expect(url).toContain('opponentPower=540000');

		const ctxText = document.querySelector('#oj-bro-context')?.textContent || '';
		expect(ctxText).toContain('Arena Last Target');

		overlay.destroy();
	});

	it('should use dedicated grand arena last-target metadata teams for segmented requests', async () => {
		const idb = makeIdbStorage({
			grandArenaEnemies: [],
			battleRecommendationLastTargetGrandArena: {
				userId: 815,
				name: 'Grand Last Target',
				teams: [{ power: 210000 }, { power: 220000 }, { power: 230000 }],
				lastUpdate: Date.now(),
			},
		});
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'Grand Segment', weightedWinRate: 0.57, confidence: 0.47, score: 0.56, battles: 7 }] }),
		});

		await overlay.onApiProcessed({ calls: [{ name: 'grandArenaAttack', args: {} }] });
		await flushScheduledRefresh();

		expect(global.fetch).toHaveBeenCalledTimes(3);
		expect(global.fetch.mock.calls[0][0]).toContain('opponentPower=210000');
		expect(global.fetch.mock.calls[1][0]).toContain('opponentPower=220000');
		expect(global.fetch.mock.calls[2][0]).toContain('opponentPower=230000');

		overlay.destroy();
	});

	it('should ignore stale dungeon metadata candidates beyond mode TTL', async () => {
		jest.setSystemTime(new Date('2026-01-01T00:30:00.000Z'));
		const staleTimestamp = Date.now() - (11 * 60 * 1000);
		const idb = makeIdbStorage({
			battleRecommendationLastTargetDungeon: {
				userId: 902,
				name: 'Stale Dungeon Target',
				power: 410000,
				lastUpdate: staleTimestamp,
			},
		});
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'Dungeon Safe Team', estimatedWinProbability: 0.58, confidenceScore: 0.47, finalScore: 0.56 }] }),
		});

		await overlay.onApiProcessed({ calls: [{ name: 'dungeonGetState', args: {} }] });
		await flushScheduledRefresh();

		const url = global.fetch.mock.calls[0][0];
		expect(url).toContain('/api/sync/teams/recommendations');
		expect(url).toContain('mode=dungeon');

		const ctxText = document.querySelector('#oj-bro-context')?.textContent || '';
		expect(ctxText).not.toContain('Stale Dungeon Target');

		overlay.destroy();
	});

	it('should mark stale metadata signal when selected metadata context is old but still within mode TTL', async () => {
		jest.setSystemTime(new Date('2026-01-01T00:30:00.000Z'));
		const oldTimestamp = Date.now() - (3 * 60 * 1000);
		const idb = makeIdbStorage({
			battleRecommendationLastTargetAdventure: {
				userId: 303,
				name: 'Old Adventure Target',
				power: 300000,
				lastUpdate: oldTimestamp,
			},
		});
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'Adventure Safe', estimatedWinProbability: 0.57, confidenceScore: 0.46, finalScore: 0.55 }] }),
		});

		await overlay.onApiProcessed({ calls: [{ name: 'adventure_getActiveData', args: {} }] });
		await flushScheduledRefresh();

		const ctxText = document.querySelector('#oj-bro-context')?.textContent || '';
		expect(ctxText).toContain('Old Adventure Target');
		expect(ctxText).toContain('Stale Metadata');

		overlay.destroy();
	});

	it('should keep high-confidence metadata fresh within extended confidence window', async () => {
		jest.setSystemTime(new Date('2026-01-01T00:30:00.000Z'));
		const recentTimestamp = Date.now() - (2 * 60 * 1000);
		const idb = makeIdbStorage({
			battleRecommendationLastTargetDungeon: {
				userId: 1001,
				name: 'Confident Dungeon Target',
				power: 420000,
				confidence: 0.96,
				lastUpdate: recentTimestamp,
			},
		});
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'Confidence Team', estimatedWinProbability: 0.6, confidenceScore: 0.52, finalScore: 0.58 }] }),
		});

		await overlay.onApiProcessed({ calls: [{ name: 'dungeonGetState', args: {} }] });
		await flushScheduledRefresh();

		const ctxText = document.querySelector('#oj-bro-context')?.textContent || '';
		expect(ctxText).toContain('Confident Dungeon Target');
		expect(ctxText).toContain('Fresh Metadata');

		overlay.destroy();
	});

	it('should ignore same-mode low-confidence context overwrite when update is not materially fresher', async () => {
		const metadata = {
			battleRecommendationLastTargetDungeon: {
				userId: 5001,
				name: 'High Confidence Target',
				power: 430000,
				confidence: 0.95,
				lastUpdate: Date.now(),
			},
		};
		const idb = {
			getMetadata: jest.fn(async (key, def) => (key in metadata ? metadata[key] : def)),
			setMetadata: jest.fn(async () => undefined),
		};
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'Guard Team', estimatedWinProbability: 0.6, confidenceScore: 0.5, finalScore: 0.58 }] }),
		});

		await overlay.onApiProcessed({ calls: [{ name: 'dungeonGetState', args: {} }] });
		await flushScheduledRefresh();

		metadata.battleRecommendationLastTargetDungeon = {
			userId: 5001,
			name: 'Low Confidence Replacement',
			power: 430000,
			confidence: 0.10,
			lastUpdate: Date.now() + 1000,
		};

		await overlay.onApiProcessed({ calls: [{ name: 'dungeonGetState', args: {} }] });
		await flushScheduledRefresh();

		const ctxText = document.querySelector('#oj-bro-context')?.textContent || '';
		expect(ctxText).toContain('High Confidence Target');
		expect(ctxText).not.toContain('Low Confidence Replacement');

		overlay.destroy();
	});

	it('should re-fetch when confidence bucket changes even if target identity is unchanged', async () => {
		const metadata = {
			battleRecommendationLastTargetDungeon: {
				userId: 6002,
				name: 'Bucket Target',
				power: 410000,
				confidence: 0.11,
				lastUpdate: Date.now(),
			},
		};
		const idb = {
			getMetadata: jest.fn(async (key, def) => (key in metadata ? metadata[key] : def)),
			setMetadata: jest.fn(async () => undefined),
		};
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage());
		overlay.init();

		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ recommendations: [{ teamPreview: 'Bucket Team', estimatedWinProbability: 0.59, confidenceScore: 0.49, finalScore: 0.57 }] }),
		});

		await overlay.onApiProcessed({ calls: [{ name: 'dungeonGetState', args: {} }] });
		await flushScheduledRefresh();

		metadata.battleRecommendationLastTargetDungeon = {
			userId: 6002,
			name: 'Bucket Target',
			power: 410000,
			confidence: 0.96,
			lastUpdate: Date.now() + 1000,
		};

		await overlay.onApiProcessed({ calls: [{ name: 'dungeonGetState', args: {} }] });
		await flushScheduledRefresh();

		expect(global.fetch).toHaveBeenCalledTimes(2);

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

	it('should not enter backoff when API responds successfully with empty recommendations', async () => {
		const idb = makeIdbStorage({ arenaEnemies: [{ userId: 11, name: 'Sparse', power: 120000 }] });
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage());
		overlay.init();

		global.fetch
			.mockResolvedValueOnce({ ok: true, json: async () => ({ recommendations: [] }) })
			.mockResolvedValueOnce({ ok: true, json: async () => ({ recommendations: [] }) })
			.mockResolvedValueOnce({ ok: true, json: async () => ({ recommendations: [] }) });

		await overlay.onApiProcessed({ calls: [{ name: 'arenaAttack', args: { enemyUserId: 11 } }] });
		await flushScheduledRefresh();

		expect(global.fetch).toHaveBeenCalledTimes(3);
		expect(overlay._dataHealth).toBe('live');
		expect(overlay._renderHealthBadge()).toContain('Live data');

		const hint = document.querySelector('#oj-bro-hints')?.textContent || '';
		expect(hint).toContain('API connected');

		overlay.destroy();
	});

	it('should render canonical health badge wording for delivery states', () => {
		const overlay = new BattleRecommendationOverlay(makeIdbStorage(), makePrefStorage());
		overlay.init();

		overlay._dataHealth = 'live';
		expect(overlay._renderHealthBadge()).toContain('Live data');

		overlay._dataHealth = 'cached';
		expect(overlay._renderHealthBadge()).toContain('Cached fallback');

		overlay._dataHealth = 'backoff';
		expect(overlay._renderHealthBadge()).toContain('Retry backoff');

		overlay.destroy();
	});

	it('should render operations diagnostics when operations summary is enabled', async () => {
		const idb = makeIdbStorage({ arenaEnemies: [{ userId: 10, name: 'A', power: 100000 }] });
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage({
			battleRecommendationOverlayShowOps: true,
			teamRecommendationsPreferredTrendWindowDays: 90,
		}));
		overlay.init();

		global.fetch
			.mockResolvedValueOnce({ ok: true, json: async () => ({ recommendations: [{ teamPreview: 'Stable', weightedWinRate: 0.6, confidence: 0.5, score: 0.6 }] }) })
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					preferredTrendWindowDays: 90,
					modes: [{
						mode: 'arena',
						meanAbsoluteError: 0.11,
						meanBrierScore: 0.19,
						predictionBias: -0.02,
						suggestedFrictionScale: 1.07,
						samples: 37,
						isStale: false,
					}],
				}),
			});

		await overlay.onApiProcessed({ calls: [{ name: 'arenaAttack', args: { enemyUserId: 10 } }] });
		await flushScheduledRefresh();

		const bodyText = document.querySelector('#oj-bro-body')?.textContent || '';
		expect(bodyText).toContain('Live data');
		expect(bodyText).toContain('Ops Metrics');
		expect(bodyText).toContain('Healthy');
		expect(bodyText).toContain('MAE');
		expect(bodyText).toContain('0.110');
		expect(bodyText).toContain('Brier');
		expect(bodyText).toContain('0.190');

		const operationsCall = global.fetch.mock.calls.find((entry) => String(entry?.[0] || '').includes('/api/sync/teams/recommendations/operations-summary'));
		expect(operationsCall).toBeTruthy();
		expect(String(operationsCall[0])).toContain('preferredTrendWindowDays=90');

		overlay.destroy();
	});

	it('should render API-provided operations health labels when present', async () => {
		const idb = makeIdbStorage({ arenaEnemies: [{ userId: 12, name: 'Label Target', power: 101000 }] });
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage({
			battleRecommendationOverlayShowOps: true,
		}));
		overlay.init();

		global.fetch
			.mockResolvedValueOnce({ ok: true, json: async () => ({ recommendations: [{ teamPreview: 'Watchlist Team', weightedWinRate: 0.56, confidence: 0.45, score: 0.54 }] }) })
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					preferredTrendWindowDays: 30,
					modes: [{
						mode: 'arena',
						meanAbsoluteError: 0.25,
						meanBrierScore: 0.31,
						predictionBias: 0.03,
						suggestedFrictionScale: 1.11,
						samples: 19,
						isStale: false,
						healthStatus: 'monitor',
						healthLabel: 'Needs Attention',
					}],
				}),
			});

		await overlay.onApiProcessed({ calls: [{ name: 'arenaAttack', args: { enemyUserId: 12 } }] });
		await flushScheduledRefresh();

		const bodyText = document.querySelector('#oj-bro-body')?.textContent || '';
		expect(bodyText).toContain('Needs Attention');

		overlay.destroy();
	});

	it('should show waiting operations message when mode summary is unavailable', async () => {
		const idb = makeIdbStorage({ arenaEnemies: [{ userId: 15, name: 'B', power: 105000 }] });
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage({ battleRecommendationOverlayShowOps: true }));
		overlay.init();

		global.fetch
			.mockResolvedValueOnce({ ok: true, json: async () => ({ recommendations: [{ teamPreview: 'Stable', weightedWinRate: 0.58, confidence: 0.48, score: 0.57 }] }) })
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					preferredTrendWindowDays: 30,
					modes: [{
						mode: 'guildwar',
						meanAbsoluteError: 0.2,
						meanBrierScore: 0.22,
						predictionBias: 0,
						suggestedFrictionScale: 1.1,
						samples: 12,
						isStale: false,
					}],
				}),
			});

		await overlay.onApiProcessed({ calls: [{ name: 'arenaAttack', args: { enemyUserId: 15 } }] });
		await flushScheduledRefresh();

		const bodyText = document.querySelector('#oj-bro-body')?.textContent || '';
		expect(bodyText).toContain('Waiting for operations summary data...');

		overlay.destroy();
	});

	it('should allow toggling operations diagnostics from overlay controls', async () => {
		const pref = makePrefStorage();
		const idb = makeIdbStorage({ arenaEnemies: [{ userId: 21, name: 'Ops Toggle', power: 111000 }] });
		const overlay = new BattleRecommendationOverlay(idb, pref);
		overlay.init();

		global.fetch
			.mockResolvedValueOnce({ ok: true, json: async () => ({ recommendations: [{ teamPreview: 'Stable', weightedWinRate: 0.62, confidence: 0.5, score: 0.59 }] }) })
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					preferredTrendWindowDays: 30,
					modes: [{
						mode: 'arena',
						meanAbsoluteError: 0.13,
						meanBrierScore: 0.2,
						predictionBias: 0.01,
						suggestedFrictionScale: 1.05,
						samples: 22,
						isStale: false,
					}],
				}),
			});

		await overlay.onApiProcessed({ calls: [{ name: 'arenaAttack', args: { enemyUserId: 21 } }] });
		const opsToggle = document.querySelector('#oj-bro-ops-toggle');
		expect(opsToggle).toBeTruthy();
		opsToggle.click();
		await flushScheduledRefresh();

		expect(pref.set).toHaveBeenCalledWith('battleRecommendationOverlayShowOps', true);
		const bodyText = document.querySelector('#oj-bro-body')?.textContent || '';
		expect(bodyText).toContain('Ops Metrics');

		overlay.destroy();
	});

	it('should cache operations summary between nearby refreshes', async () => {
		const idb = makeIdbStorage({ arenaEnemies: [{ userId: 31, name: 'Ops Cache', power: 125000 }] });
		const overlay = new BattleRecommendationOverlay(idb, makePrefStorage({ battleRecommendationOverlayShowOps: true }));
		overlay.init();

		global.fetch
			.mockResolvedValueOnce({ ok: true, json: async () => ({ recommendations: [{ teamPreview: 'First Pull', weightedWinRate: 0.6, confidence: 0.5, score: 0.59 }] }) })
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					preferredTrendWindowDays: 30,
					modes: [{ mode: 'arena', meanAbsoluteError: 0.12, meanBrierScore: 0.2, predictionBias: 0, suggestedFrictionScale: 1.02, samples: 42, isStale: false }],
				}),
			})
			.mockResolvedValueOnce({ ok: true, json: async () => ({ recommendations: [{ teamPreview: 'Second Pull', weightedWinRate: 0.59, confidence: 0.49, score: 0.58 }] }) });

		await overlay.onApiProcessed({ calls: [{ name: 'arenaAttack', args: { enemyUserId: 31 } }] });
		await flushScheduledRefresh();

		jest.advanceTimersByTime(1500);
		await overlay.refresh();

		const operationsCalls = global.fetch.mock.calls.filter((entry) => String(entry?.[0] || '').includes('/api/sync/teams/recommendations/operations-summary'));
		expect(operationsCalls).toHaveLength(1);

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
