/**
 * Tests for NotificationManager module (#52)
 *
 * Validates notification delivery, permission handling, per-type toggles,
 * quiet hours, cooldowns, daily reset check, and low energy detection.
 */

import NotificationManager, { NOTIFICATION_TYPES } from '../src/modules/notificationManager.js';

// ── Mock prefStorage ────────────────────────────────────────────────────────

function makePrefStorage(overrides = {}) {
	const store = { ...overrides };
	return {
		get: jest.fn((key, def) => (key in store ? store[key] : def)),
		set: jest.fn((key, val) => { store[key] = val; }),
	};
}

// ── Mock Notification API ───────────────────────────────────────────────────

let mockNotificationInstances;

function setupNotificationMock(permission = 'granted') {
	mockNotificationInstances = [];

	// eslint-disable-next-line no-global-assign
	global.Notification = class MockNotification {
		constructor(title, options = {}) {
			this.title = title;
			this.body = options.body;
			this.tag = options.tag;
			this.close = jest.fn();
			mockNotificationInstances.push(this);
		}

		static permission = permission;

		static requestPermission = jest.fn(async () => {
			MockNotification.permission = 'granted';
			return 'granted';
		});
	};
}

beforeEach(() => {
	setupNotificationMock('granted');
	jest.useFakeTimers();
});

afterEach(() => {
	jest.useRealTimers();
	delete global.Notification;
});

// ── NOTIFICATION_TYPES ──────────────────────────────────────────────────────

describe('NOTIFICATION_TYPES', () => {
	it('should export all expected notification types', () => {
		expect(NOTIFICATION_TYPES.arenaDefense).toBeDefined();
		expect(NOTIFICATION_TYPES.guildWar).toBeDefined();
		expect(NOTIFICATION_TYPES.dailyReset).toBeDefined();
		expect(NOTIFICATION_TYPES.mail).toBeDefined();
		expect(NOTIFICATION_TYPES.lowEnergy).toBeDefined();
	});

	it('should be frozen (immutable)', () => {
		expect(Object.isFrozen(NOTIFICATION_TYPES)).toBe(true);
	});

	it('should have label, icon, and default for each type', () => {
		for (const [, meta] of Object.entries(NOTIFICATION_TYPES)) {
			expect(typeof meta.label).toBe('string');
			expect(typeof meta.icon).toBe('string');
			expect(typeof meta.default).toBe('boolean');
		}
	});
});

// ── NotificationManager ─────────────────────────────────────────────────────

describe('NotificationManager', () => {
	let nm;
	let prefStorage;

	beforeEach(() => {
		prefStorage = makePrefStorage();
		nm = new NotificationManager(prefStorage);
	});

	afterEach(() => {
		nm.destroy();
	});

	// ── Construction ────────────────────────────────────────────────────

	it('should initialize with granted permission', () => {
		expect(nm.permission).toBe('granted');
	});

	it('should detect denied permission', () => {
		setupNotificationMock('denied');
		const nm2 = new NotificationManager(makePrefStorage());
		expect(nm2.permission).toBe('denied');
		nm2.destroy();
	});

	it('should default enabled to true', () => {
		expect(nm.enabled).toBe(true);
	});

	// ── Permission request ──────────────────────────────────────────────

	describe('requestPermission', () => {
		it('should return granted when already granted', async () => {
			const result = await nm.requestPermission();
			expect(result).toBe('granted');
		});

		it('should request permission when default', async () => {
			setupNotificationMock('default');
			const nm2 = new NotificationManager(makePrefStorage());
			const result = await nm2.requestPermission();
			expect(Notification.requestPermission).toHaveBeenCalled();
			expect(result).toBe('granted');
			nm2.destroy();
		});
	});

	// ── Master toggle ───────────────────────────────────────────────────

	describe('enabled', () => {
		it('should persist via prefStorage', () => {
			nm.enabled = false;
			expect(prefStorage.set).toHaveBeenCalledWith('notifyEnabled', false);
		});

		it('should suppress notifications when disabled', () => {
			nm.enabled = false;
			// Need to re-read from stored value
			prefStorage.get.mockImplementation((key, def) => {
				if (key === 'notifyEnabled') return false;
				return def;
			});
			nm.notifyArenaDefense();
			expect(mockNotificationInstances).toHaveLength(0);
		});
	});

	// ── Per-type toggles ────────────────────────────────────────────────

	describe('type toggles', () => {
		it('should enable all types by default', () => {
			const states = nm.getTypeStates();
			expect(states.arenaDefense).toBe(true);
			expect(states.guildWar).toBe(true);
			expect(states.dailyReset).toBe(true);
			expect(states.mail).toBe(true);
			// lowEnergy defaults to false
			expect(states.lowEnergy).toBe(false);
		});

		it('should toggle a specific type', () => {
			nm.setTypeEnabled('arenaDefense', false);
			expect(prefStorage.set).toHaveBeenCalledWith('notify_arenaDefense', false);
		});

		it('should suppress notification when type is disabled', () => {
			nm.setTypeEnabled('arenaDefense', false);
			prefStorage.get.mockImplementation((key, def) => {
				if (key === 'notify_arenaDefense') return false;
				return def;
			});
			nm.notifyArenaDefense();
			expect(mockNotificationInstances).toHaveLength(0);
		});
	});

	// ── Notification triggers ───────────────────────────────────────────

	describe('notifyArenaDefense', () => {
		it('should show notification', () => {
			nm.notifyArenaDefense();
			expect(mockNotificationInstances).toHaveLength(1);
			expect(mockNotificationInstances[0].body).toContain('Arena');
		});

		it('should include attacker name', () => {
			nm.notifyArenaDefense({ attacker: 'DarkKnight' });
			expect(mockNotificationInstances[0].body).toContain('DarkKnight');
		});

		it('should include result', () => {
			nm.notifyArenaDefense({ attacker: 'DarkKnight', result: 'You won' });
			expect(mockNotificationInstances[0].body).toContain('You won');
		});
	});

	describe('notifyGuildWar', () => {
		it('should show notification', () => {
			nm.notifyGuildWar();
			expect(mockNotificationInstances).toHaveLength(1);
			expect(mockNotificationInstances[0].body).toContain('Guild War');
		});

		it('should include phase', () => {
			nm.notifyGuildWar({ phase: 'Attack phase started' });
			expect(mockNotificationInstances[0].body).toContain('Attack phase started');
		});
	});

	describe('notifyMail', () => {
		it('should show notification for single mail', () => {
			nm.notifyMail();
			expect(mockNotificationInstances).toHaveLength(1);
			expect(mockNotificationInstances[0].body).toContain('mail');
		});

		it('should show count for multiple messages', () => {
			nm.notifyMail({ count: 5 });
			expect(mockNotificationInstances[0].body).toContain('5');
		});
	});

	// ── Low energy ──────────────────────────────────────────────────────

	describe('checkEnergy', () => {
		beforeEach(() => {
			// Enable lowEnergy notifications (disabled by default)
			nm.setTypeEnabled('lowEnergy', true);
			prefStorage.get.mockImplementation((key, def) => {
				if (key === 'notify_lowEnergy') return true;
				return def;
			});
		});

		it('should fire when energy drops below threshold', () => {
			nm.checkEnergy(100); // Above threshold — no notification
			expect(mockNotificationInstances).toHaveLength(0);

			nm.checkEnergy(30); // Below 50 — should fire
			expect(mockNotificationInstances).toHaveLength(1);
			expect(mockNotificationInstances[0].body).toContain('30');
		});

		it('should not re-fire while already below threshold', () => {
			nm.checkEnergy(100);
			nm.checkEnergy(30); // Fire
			nm.checkEnergy(25); // Should NOT re-fire (already below)
			expect(mockNotificationInstances).toHaveLength(1);
		});

		it('should re-fire after recovery and drop again', () => {
			nm.checkEnergy(100);
			nm.checkEnergy(30); // Fire
			// Wait out cooldown
			jest.advanceTimersByTime(31000);
			nm.checkEnergy(60); // Recovery above threshold
			nm.checkEnergy(40); // Drop again — should fire
			expect(mockNotificationInstances).toHaveLength(2);
		});

		it('should ignore non-numeric energy', () => {
			nm.checkEnergy('abc');
			nm.checkEnergy(null);
			nm.checkEnergy(undefined);
			expect(mockNotificationInstances).toHaveLength(0);
		});
	});

	// ── Cooldown ────────────────────────────────────────────────────────

	describe('cooldown', () => {
		it('should prevent duplicate notifications within 30s', () => {
			nm.notifyArenaDefense();
			nm.notifyArenaDefense(); // Should be suppressed
			expect(mockNotificationInstances).toHaveLength(1);
		});

		it('should allow notification after cooldown expires', () => {
			nm.notifyArenaDefense();
			jest.advanceTimersByTime(31000);
			nm.notifyArenaDefense();
			expect(mockNotificationInstances).toHaveLength(2);
		});

		it('should track cooldowns per type independently', () => {
			nm.notifyArenaDefense();
			nm.notifyGuildWar(); // Different type — should work
			expect(mockNotificationInstances).toHaveLength(2);
		});
	});

	// ── Quiet hours ─────────────────────────────────────────────────────

	describe('quiet hours', () => {
		it('should default to no quiet hours', () => {
			const qh = nm.getQuietHours();
			expect(qh.start).toBe('');
			expect(qh.end).toBe('');
		});

		it('should persist quiet hours', () => {
			nm.setQuietHours('22:00', '07:00');
			expect(prefStorage.set).toHaveBeenCalledWith('notifyQuietStart', '22:00');
			expect(prefStorage.set).toHaveBeenCalledWith('notifyQuietEnd', '07:00');
		});

		it('should suppress notifications during quiet hours (same-day range)', () => {
			// Set quiet hours 09:00 – 17:00
			prefStorage.get.mockImplementation((key, def) => {
				if (key === 'notifyQuietStart') return '09:00';
				if (key === 'notifyQuietEnd') return '17:00';
				return def;
			});

			// Mock current time to 12:00 (within quiet hours)
			jest.setSystemTime(new Date(2025, 0, 21, 12, 0, 0));

			nm.notifyArenaDefense();
			expect(mockNotificationInstances).toHaveLength(0);
		});

		it('should allow notifications outside quiet hours', () => {
			prefStorage.get.mockImplementation((key, def) => {
				if (key === 'notifyQuietStart') return '22:00';
				if (key === 'notifyQuietEnd') return '06:00';
				return def;
			});

			// Mock current time to 12:00 (outside 22:00 – 06:00)
			jest.setSystemTime(new Date(2025, 0, 21, 12, 0, 0));

			nm.notifyArenaDefense();
			expect(mockNotificationInstances).toHaveLength(1);
		});

		it('should handle overnight quiet hours', () => {
			prefStorage.get.mockImplementation((key, def) => {
				if (key === 'notifyQuietStart') return '22:00';
				if (key === 'notifyQuietEnd') return '06:00';
				return def;
			});

			// Mock current time to 23:00 (within overnight range)
			jest.setSystemTime(new Date(2025, 0, 21, 23, 0, 0));

			nm.notifyArenaDefense();
			expect(mockNotificationInstances).toHaveLength(0);
		});
	});

	// ── Permission denied ───────────────────────────────────────────────

	describe('permission denied', () => {
		it('should suppress notifications when permission denied', () => {
			setupNotificationMock('denied');
			const nm2 = new NotificationManager(makePrefStorage());

			nm2.notifyArenaDefense();
			expect(mockNotificationInstances).toHaveLength(0);

			nm2.destroy();
		});
	});

	// ── Daily reset check ───────────────────────────────────────────────

	describe('daily reset', () => {
		it('should start and stop the check interval', () => {
			nm.startDailyResetCheck();
			expect(nm._resetCheckInterval).not.toBeNull();

			nm.destroy();
			expect(nm._resetCheckInterval).toBeNull();
		});

		it('should fire notification near midnight UTC', () => {
			// Set to 00:02 UTC
			jest.setSystemTime(new Date(Date.UTC(2025, 0, 21, 0, 2, 0)));

			nm.startDailyResetCheck();
			jest.advanceTimersByTime(61000); // Trigger check

			expect(mockNotificationInstances).toHaveLength(1);
			expect(mockNotificationInstances[0].body).toContain('reset');
		});

		it('should not fire again in the same cycle', () => {
			jest.setSystemTime(new Date(Date.UTC(2025, 0, 21, 0, 2, 0)));

			nm.startDailyResetCheck();
			jest.advanceTimersByTime(61000); // First check fires
			jest.advanceTimersByTime(61000); // Second check — should not fire

			expect(mockNotificationInstances).toHaveLength(1);
		});
	});

	// ── Auto-close ──────────────────────────────────────────────────────

	describe('auto-close', () => {
		it('should close notification after 8 seconds', () => {
			nm.notifyArenaDefense();
			expect(mockNotificationInstances).toHaveLength(1);

			jest.advanceTimersByTime(9000);
			expect(mockNotificationInstances[0].close).toHaveBeenCalled();
		});
	});

	// ── destroy ─────────────────────────────────────────────────────────

	describe('destroy', () => {
		it('should clear the reset check interval', () => {
			nm.startDailyResetCheck();
			nm.destroy();
			expect(nm._resetCheckInterval).toBeNull();
		});
	});
});
