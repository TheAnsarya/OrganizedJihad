/**
 * Settings notification binder.
 * Isolates notification setting listener wiring from UIManager.
 */

/**
 * Bind settings notification listeners.
 *
 * @param {object} params - Binding params
 * @param {HTMLElement} params.overlay - UI overlay root
 * @param {object} params.notificationManager - Notification manager instance
 */
export function bindSettingsNotifications(params) {
	const overlay = params?.overlay;
	const notificationManager = params?.notificationManager;
	if (!overlay || !notificationManager) return;

	const nm = notificationManager;

	const masterCb = overlay.querySelector('#oj-notify-master');
	if (masterCb) {
		masterCb.addEventListener('change', (e) => {
			nm.enabled = e.target.checked;
			const typeCbs = overlay.querySelectorAll('[data-notify-type]');
			for (const cb of typeCbs) cb.disabled = !e.target.checked;
			const quietStart = overlay.querySelector('#oj-quiet-start');
			const quietEnd = overlay.querySelector('#oj-quiet-end');
			if (quietStart) quietStart.disabled = !e.target.checked;
			if (quietEnd) quietEnd.disabled = !e.target.checked;
		});
	}

	const requestLink = overlay.querySelector('#oj-notify-request');
	if (requestLink) {
		requestLink.addEventListener('click', async (e) => {
			e.preventDefault();
			const result = await nm.requestPermission();
			requestLink.textContent = result === 'granted' ? '\u2705 Granted' : `\u274C ${result}`;
		});
	}

	const typeCbs = overlay.querySelectorAll('[data-notify-type]');
	for (const cb of typeCbs) {
		cb.addEventListener('change', (e) => {
			nm.setTypeEnabled(e.target.dataset.notifyType, e.target.checked);
		});
	}

	const quietStart = overlay.querySelector('#oj-quiet-start');
	const quietEnd = overlay.querySelector('#oj-quiet-end');
	if (quietStart && quietEnd) {
		const saveQuiet = () => nm.setQuietHours(quietStart.value, quietEnd.value);
		quietStart.addEventListener('change', saveQuiet);
		quietEnd.addEventListener('change', saveQuiet);
	}
}
