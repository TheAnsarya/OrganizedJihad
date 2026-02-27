/**
 * Tests for DomTargeting module (#50)
 *
 * Validates game state detection, auto-hide behavior, container lookup,
 * and MutationObserver integration.
 */

import DomTargeting, { GameState } from '../src/modules/domTargeting.js';

// ── Mock prefStorage ────────────────────────────────────────────────────────

function makePrefStorage(overrides = {}) {
	const store = { autoHideBattle: true, ...overrides };
	return {
		get: jest.fn((key, def) => store[key] ?? def),
		set: jest.fn((key, val) => { store[key] = val; }),
	};
}

// ── GameState enum ──────────────────────────────────────────────────────────

describe('GameState', () => {
	it('should export all expected state values', () => {
		expect(GameState.IDLE).toBe('idle');
		expect(GameState.BATTLE).toBe('battle');
		expect(GameState.LOADING).toBe('loading');
		expect(GameState.UNKNOWN).toBe('unknown');
	});

	it('should be frozen (immutable)', () => {
		expect(Object.isFrozen(GameState)).toBe(true);
	});
});

// ── DomTargeting construction ───────────────────────────────────────────────

describe('DomTargeting', () => {
	let dt;
	let prefStorage;

	beforeEach(() => {
		prefStorage = makePrefStorage();
		dt = new DomTargeting({ prefStorage });
	});

	afterEach(() => {
		dt.destroy();
	});

	it('should initialize with UNKNOWN state', () => {
		expect(dt.state).toBe(GameState.UNKNOWN);
	});

	it('should default autoHideBattle to true', () => {
		expect(dt.autoHideBattle).toBe(true);
	});

	it('should read autoHideBattle from prefStorage', () => {
		const ps = makePrefStorage({ autoHideBattle: false });
		const dt2 = new DomTargeting({ prefStorage: ps });
		expect(dt2.autoHideBattle).toBe(false);
		dt2.destroy();
	});

	// ── Container detection ─────────────────────────────────────────────

	describe('container detection', () => {
		it('should return null when no game container exists', () => {
			dt.init();
			expect(dt.container).toBeNull();
		});

		it('should find a canvas element', () => {
			const canvas = document.createElement('canvas');
			document.body.appendChild(canvas);

			dt.init();
			expect(dt.container).toBe(canvas);

			document.body.removeChild(canvas);
		});

		it('should prefer canvas#canvas over generic canvas', () => {
			const generic = document.createElement('canvas');
			const specific = document.createElement('canvas');
			specific.id = 'canvas';
			document.body.appendChild(generic);
			document.body.appendChild(specific);

			dt.init();
			expect(dt.container).toBe(specific);

			document.body.removeChild(generic);
			document.body.removeChild(specific);
		});

		it('should provide containerBounds falling back to viewport', () => {
			dt.init();
			const bounds = dt.containerBounds;
			expect(bounds.top).toBe(0);
			expect(bounds.left).toBe(0);
			expect(bounds.width).toBe(window.innerWidth);
			expect(bounds.height).toBe(window.innerHeight);
		});
	});

	// ── API call state detection ────────────────────────────────────────

	describe('onApiCall', () => {
		it('should transition to BATTLE on battleStart', () => {
			dt.onApiCall('battleStart');
			expect(dt.state).toBe(GameState.BATTLE);
		});

		it('should transition to BATTLE on arenaAttack', () => {
			dt.onApiCall('arenaAttack');
			expect(dt.state).toBe(GameState.BATTLE);
		});

		it('should transition back to IDLE on battleEnd', () => {
			dt.onApiCall('battleStart');
			expect(dt.state).toBe(GameState.BATTLE);

			dt.onApiCall('battleEnd');
			expect(dt.state).toBe(GameState.IDLE);
		});

		it('should stay in current state for unknown API calls', () => {
			dt.onApiCall('heroGetAll');
			expect(dt.state).toBe(GameState.UNKNOWN);
		});

		it('should fire onStateChange callback', () => {
			const callback = jest.fn();
			const ps = makePrefStorage();
			const dt2 = new DomTargeting({ prefStorage: ps, onStateChange: callback });

			dt2.onApiCall('battleStart');
			expect(callback).toHaveBeenCalledWith(GameState.BATTLE, GameState.UNKNOWN);

			dt2.onApiCall('battleEnd');
			expect(callback).toHaveBeenCalledWith(GameState.IDLE, GameState.BATTLE);

			dt2.destroy();
		});

		it('should not fire callback when state does not change', () => {
			const callback = jest.fn();
			const ps = makePrefStorage();
			const dt2 = new DomTargeting({ prefStorage: ps, onStateChange: callback });

			dt2.onApiCall('battleStart');
			dt2.onApiCall('arenaAttack'); // Still BATTLE
			expect(callback).toHaveBeenCalledTimes(1);

			dt2.destroy();
		});
	});

	// ── Auto-hide during battles ────────────────────────────────────────

	describe('auto-hide during battles', () => {
		it('should hide registered elements when battle starts', () => {
			const el = document.createElement('div');
			el.style.display = 'block';
			dt.registerElement(el);

			dt.onApiCall('battleStart');
			expect(el.style.display).toBe('none');
		});

		it('should restore element display when battle ends', () => {
			const el = document.createElement('div');
			el.style.display = 'flex';
			dt.registerElement(el);

			dt.onApiCall('battleStart');
			expect(el.style.display).toBe('none');

			dt.onApiCall('battleEnd');
			expect(el.style.display).toBe('flex');
		});

		it('should not hide elements when autoHideBattle is disabled', () => {
			dt.setAutoHideBattle(false);
			const el = document.createElement('div');
			el.style.display = 'block';
			dt.registerElement(el);

			dt.onApiCall('battleStart');
			expect(el.style.display).toBe('block');
		});

		it('should unregister elements', () => {
			const el = document.createElement('div');
			el.style.display = 'block';
			dt.registerElement(el);
			dt.unregisterElement(el);

			dt.onApiCall('battleStart');
			expect(el.style.display).toBe('block');
		});
	});

	// ── setAutoHideBattle ───────────────────────────────────────────────

	describe('setAutoHideBattle', () => {
		it('should persist the preference', () => {
			dt.setAutoHideBattle(false);
			expect(prefStorage.set).toHaveBeenCalledWith('autoHideBattle', false);
		});

		it('should update the internal flag', () => {
			dt.setAutoHideBattle(false);
			expect(dt.autoHideBattle).toBe(false);
		});

		it('should show hidden elements when disabled during battle', () => {
			const el = document.createElement('div');
			el.style.display = 'block';
			dt.registerElement(el);

			dt.onApiCall('battleStart');
			expect(el.style.display).toBe('none');

			dt.setAutoHideBattle(false);
			expect(el.style.display).toBe('block');
		});
	});

	// ── Battle start/end call coverage ──────────────────────────────────

	describe('battle API call variants', () => {
		const battleStartCalls = [
			'battleStart', 'arenaAttack', 'grandArenaAttack', 'titanArenaAttack',
			'clanWarAttack', 'clanRaidAttack', 'bossRaidAttack', 'adventureBattle',
			'towerAttack', 'missionStart', 'battleGetReplay',
			'dungeonBattle', 'titanDungeonBattle', 'clashBattle',
			'tournamentBattle', 'expeditionBattle', 'clanDungeonBattle',
		];

		const battleEndCalls = [
			'battleEnd', 'arenaEnd', 'grandArenaEnd', 'titanArenaEnd',
			'clanWarEnd', 'clanRaidEnd', 'adventureEnd', 'towerEnd',
			'missionEnd', 'dungeonEnd', 'titanDungeonEnd',
			'clashEnd', 'tournamentEnd', 'bossEnd', 'expeditionEnd',
		];

		it.each(battleStartCalls)('should detect %s as battle start', (call) => {
			const fresh = new DomTargeting({ prefStorage: makePrefStorage() });
			fresh.onApiCall(call);
			expect(fresh.state).toBe(GameState.BATTLE);
			fresh.destroy();
		});

		it.each(battleEndCalls)('should detect %s as battle end', (call) => {
			const fresh = new DomTargeting({ prefStorage: makePrefStorage() });
			fresh.onApiCall('battleStart'); // Enter battle first
			fresh.onApiCall(call);
			expect(fresh.state).toBe(GameState.IDLE);
			fresh.destroy();
		});
	});

	// ── destroy ─────────────────────────────────────────────────────────

	describe('destroy', () => {
		it('should clear managed elements', () => {
			const el = document.createElement('div');
			el.style.display = 'block';
			dt.registerElement(el);
			dt.destroy();

			// After destroy, battle shouldn't affect the element
			dt.onApiCall('battleStart');
			expect(el.style.display).toBe('block');
		});
	});
});
