/**
 * Notification Manager Module (#52)
 *
 * Provides configurable desktop / in-page notifications for significant
 * game events.  Uses the browser Notification API with graceful
 * permission handling, a do-not-disturb quiet-hours feature, and
 * per-event-type toggles persisted through the pref StorageManager.
 *
 * Notification types:
 *   - arenaDefense   — Someone attacked you in Arena
 *   - guildWar       — Guild War phase changed
 *   - dailyReset     — Daily reset reminder (via periodic check)
 *   - mail           — New mail received
 *   - lowEnergy      — Stamina/energy below threshold
 *
 * All types are opt-in (enabled by default) and can be individually
 * toggled from the Settings panel in UIManager.
 *
 * @module notificationManager
 */

// ────────────────────────────────────────────────────────────────────────────
// Notification type catalog
// ────────────────────────────────────────────────────────────────────────────

/**
 * Available notification trigger types with display labels and defaults.
 * Key → stored in prefs as `notify_<key>`.
 *
 * @type {Object<string, { label: string, icon: string, default: boolean }>}
 */
export const NOTIFICATION_TYPES = Object.freeze({
	arenaDefense: { label: 'Arena attack received', icon: '\u2694\uFE0F', default: true },
	guildWar: { label: 'Guild War phase change', icon: '\uD83C\uDFF0', default: true },
	dailyReset: { label: 'Daily reset reminder', icon: '\u23F0', default: true },
	mail: { label: 'New mail received', icon: '\uD83D\uDCE7', default: true },
	lowEnergy: { label: 'Low energy/stamina warning', icon: '\u26A1', default: false },
});

/**
 * Pref key used to store quiet-hours start (HH:MM in 24h).
 * @type {string}
 */
const PREF_QUIET_START = 'notifyQuietStart';

/**
 * Pref key used to store quiet-hours end (HH:MM in 24h).
 * @type {string}
 */
const PREF_QUIET_END = 'notifyQuietEnd';

/**
 * Pref key for the master notifications toggle.
 * @type {string}
 */
const PREF_MASTER = 'notifyEnabled';

/**
 * Pref key for the low-energy threshold.
 * @type {string}
 */
const PREF_LOW_ENERGY_THRESHOLD = 'notifyLowEnergyThreshold';

/**
 * Default low-energy threshold.
 * @type {number}
 */
const DEFAULT_LOW_ENERGY_THRESHOLD = 50;

// ────────────────────────────────────────────────────────────────────────────
// NotificationManager
// ────────────────────────────────────────────────────────────────────────────

/**
 * Manages desktop notification delivery for game events.
 * Integrates with the pref StorageManager for persistence and the
 * GameTracker push event system for real-time triggers.
 */
export default class NotificationManager {
	/**
	 * @param {import('./storageManager.js').default} prefStorage - Prefs store
	 */
	constructor(prefStorage) {
		/** @type {import('./storageManager.js').default} */
		this._prefStorage = prefStorage;

		/** @type {string} Cached Notification permission state */
		this._permission = typeof Notification !== 'undefined'
			? Notification.permission
			: 'denied';

		/**
		 * Cooldown tracker — prevents the same notification type firing
		 * more than once within a short window (30 s default).
		 * @type {Map<string, number>}
		 */
		this._cooldowns = new Map();

		/** @type {number} Cooldown duration in milliseconds */
		this._cooldownMs = 30000;

		/** @type {number|null} Daily reset check interval */
		this._resetCheckInterval = null;

		/** @type {boolean} Whether the daily reset notification already fired this cycle */
		this._resetFiredToday = false;

		/** @type {number|null} Last known energy value */
		this._lastEnergy = null;
	}

	// ── Public API ──────────────────────────────────────────────────────

	/**
	 * Request Notification permission from the browser.
	 * Returns the current permission state.
	 *
	 * @returns {Promise<string>} 'granted', 'denied', or 'default'
	 */
	async requestPermission() {
		if (typeof Notification === 'undefined') return 'denied';
		if (Notification.permission === 'granted') {
			this._permission = 'granted';
			return 'granted';
		}
		try {
			const result = await Notification.requestPermission();
			this._permission = result;
			return result;
		} catch {
			return 'denied';
		}
	}

	/**
	 * Start the daily-reset reminder timer.
	 * Checks every 60 s whether it's past midnight local time.
	 */
	startDailyResetCheck() {
		if (this._resetCheckInterval) return;
		this._resetCheckInterval = setInterval(() => {
			this._checkDailyReset();
		}, 60000);
	}

	/**
	 * Clean up timers.
	 */
	destroy() {
		if (this._resetCheckInterval) {
			clearInterval(this._resetCheckInterval);
			this._resetCheckInterval = null;
		}
	}

	// ── Event triggers ──────────────────────────────────────────────────
	// These are called from index.js / gameTracker push handlers.

	/**
	 * Notify about an arena defense (someone attacked the player).
	 *
	 * @param {Object} [details] - Optional details
	 * @param {string} [details.attacker] - Attacker name
	 * @param {string} [details.result] - 'win' or 'loss'
	 */
	notifyArenaDefense(details = {}) {
		const body = details.attacker
			? `${details.attacker} attacked you in Arena${details.result ? ` — ${details.result}` : ''}`
			: 'You were attacked in Arena!';
		this._send('arenaDefense', 'Arena Defense', body);
	}

	/**
	 * Notify about a guild war phase change.
	 *
	 * @param {Object} [details]
	 * @param {string} [details.phase] - New phase description
	 */
	notifyGuildWar(details = {}) {
		const body = details.phase
			? `Guild War: ${details.phase}`
			: 'Guild War phase has changed!';
		this._send('guildWar', 'Guild War Update', body);
	}

	/**
	 * Notify about new mail.
	 *
	 * @param {Object} [details]
	 * @param {number} [details.count] - Number of new messages
	 */
	notifyMail(details = {}) {
		const body = details.count && details.count > 1
			? `You have ${details.count} new messages`
			: 'You received new mail!';
		this._send('mail', 'New Mail', body);
	}

	/**
	 * Check energy value and fire low-energy warning if below threshold.
	 *
	 * @param {number} energy - Current energy value
	 */
	checkEnergy(energy) {
		if (typeof energy !== 'number' || isNaN(energy)) return;

		const threshold = this._prefStorage.get(
			PREF_LOW_ENERGY_THRESHOLD,
			DEFAULT_LOW_ENERGY_THRESHOLD
		);

		// Only fire when crossing below threshold (not every tick)
		if (energy < threshold && (this._lastEnergy === null || this._lastEnergy >= threshold)) {
			this._send('lowEnergy', 'Low Energy', `Your energy is at ${energy} (below ${threshold})`);
		}
		this._lastEnergy = energy;
	}

	// ── Settings helpers ────────────────────────────────────────────────

	/**
	 * Whether the master notifications toggle is enabled.
	 *
	 * @returns {boolean}
	 */
	get enabled() {
		return this._prefStorage.get(PREF_MASTER, true);
	}

	/**
	 * Set the master notifications toggle.
	 *
	 * @param {boolean} val
	 */
	set enabled(val) {
		this._prefStorage.set(PREF_MASTER, !!val);
	}

	/**
	 * Check if a specific notification type is enabled.
	 *
	 * @param {string} type - Key from NOTIFICATION_TYPES
	 * @returns {boolean}
	 */
	isTypeEnabled(type) {
		const def = NOTIFICATION_TYPES[type]?.default ?? true;
		return this._prefStorage.get(`notify_${type}`, def);
	}

	/**
	 * Enable or disable a specific notification type.
	 *
	 * @param {string} type - Key from NOTIFICATION_TYPES
	 * @param {boolean} enabled
	 */
	setTypeEnabled(type, enabled) {
		this._prefStorage.set(`notify_${type}`, !!enabled);
	}

	/**
	 * Get all notification type states.
	 *
	 * @returns {Object<string, boolean>}
	 */
	getTypeStates() {
		const states = {};
		for (const key of Object.keys(NOTIFICATION_TYPES)) {
			states[key] = this.isTypeEnabled(key);
		}
		return states;
	}

	/**
	 * Get quiet-hours range.
	 *
	 * @returns {{ start: string, end: string }} HH:MM strings, empty if unset
	 */
	getQuietHours() {
		return {
			start: this._prefStorage.get(PREF_QUIET_START, ''),
			end: this._prefStorage.get(PREF_QUIET_END, ''),
		};
	}

	/**
	 * Set quiet-hours range.
	 *
	 * @param {string} start - HH:MM in 24h format ('' to disable)
	 * @param {string} end - HH:MM in 24h format ('' to disable)
	 */
	setQuietHours(start, end) {
		this._prefStorage.set(PREF_QUIET_START, start || '');
		this._prefStorage.set(PREF_QUIET_END, end || '');
	}

	/**
	 * Get the current Notification permission state.
	 *
	 * @returns {string} 'granted', 'denied', or 'default'
	 */
	get permission() {
		return this._permission;
	}

	// ── Internal ────────────────────────────────────────────────────────

	/**
	 * Core send method.  Checks master toggle, per-type toggle, permission,
	 * quiet hours, and cooldown before showing the notification.
	 *
	 * @param {string} type - Key from NOTIFICATION_TYPES
	 * @param {string} title - Notification title
	 * @param {string} body - Notification body
	 * @private
	 */
	_send(type, title, body) {
		// Master toggle
		if (!this.enabled) return;

		// Per-type toggle
		if (!this.isTypeEnabled(type)) return;

		// Permission check
		if (this._permission !== 'granted') return;

		// Quiet hours
		if (this._isQuietTime()) return;

		// Cooldown — same type within 30s
		const now = Date.now();
		const lastFired = this._cooldowns.get(type) || 0;
		if (now - lastFired < this._cooldownMs) return;
		this._cooldowns.set(type, now);

		// Fire
		const icon = NOTIFICATION_TYPES[type]?.icon || '\uD83D\uDD14';
		try {
			const n = new Notification(`${icon} ${title}`, {
				body,
				tag: `oj-${type}`,
				icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><text y="24" font-size="24">⚔️</text></svg>',
				requireInteraction: false,
				silent: false,
			});

			// Auto-close after 8 seconds
			setTimeout(() => n.close(), 8000);
		} catch (err) {
			console.warn('[OrganizedJihad] Notification failed:', err);
		}
	}

	/**
	 * Check if the current time falls within quiet hours.
	 *
	 * @returns {boolean} True if notifications should be suppressed
	 * @private
	 */
	_isQuietTime() {
		const { start, end } = this.getQuietHours();
		if (!start || !end) return false;

		const now = new Date();
		const nowMins = now.getHours() * 60 + now.getMinutes();

		const [sh, sm] = start.split(':').map(Number);
		const [eh, em] = end.split(':').map(Number);
		if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return false;

		const startMins = sh * 60 + sm;
		const endMins = eh * 60 + em;

		if (startMins <= endMins) {
			// Same-day range: e.g. 09:00 – 17:00
			return nowMins >= startMins && nowMins < endMins;
		} else {
			// Overnight range: e.g. 22:00 – 07:00
			return nowMins >= startMins || nowMins < endMins;
		}
	}

	/**
	 * Check if it's time for the daily reset reminder.
	 * Fires once when the server day rolls over (assumed 00:00 UTC).
	 *
	 * @private
	 */
	_checkDailyReset() {
		const nowUTC = new Date();
		const hourUTC = nowUTC.getUTCHours();
		const minUTC = nowUTC.getUTCMinutes();

		// Fire within 5 minutes after midnight UTC
		if (hourUTC === 0 && minUTC < 5) {
			if (!this._resetFiredToday) {
				this._resetFiredToday = true;
				this._send('dailyReset', 'Daily Reset', 'Daily reset has occurred — collect your rewards!');
			}
		} else {
			// Reset flag outside the window so it can fire again tomorrow
			this._resetFiredToday = false;
		}
	}
}
