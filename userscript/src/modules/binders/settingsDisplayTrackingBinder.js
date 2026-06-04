/**
 * Settings display/tracking binder.
 * Isolates display preferences and tracking category wiring from UIManager.
 */

/**
 * Bind settings display and tracking listeners.
 *
 * @param {object} params - Binding params
 * @param {HTMLElement} params.overlay - UI overlay root
 * @param {{ set: Function }} params.prefStorage - Preference storage
 * @param {object} params.gameTracker - GameTracker instance
 * @param {(language: string) => void} [params.onUiLanguageChange] - Optional callback for UI language changes
 */
export function bindSettingsDisplayTracking(params) {
	const overlay = params?.overlay;
	const prefStorage = params?.prefStorage;
	const gameTracker = params?.gameTracker;
	const onUiLanguageChange = params?.onUiLanguageChange;
	if (!overlay || !prefStorage || !gameTracker) return;

	const autoShowCb = overlay.querySelector('#oj-auto-show');
	if (autoShowCb) {
		autoShowCb.addEventListener('change', (e) => {
			prefStorage.set('uiVisible', e.target.checked);
		});
	}

	const autoHideCb = overlay.querySelector('#oj-auto-hide-battle');
	if (autoHideCb) {
		autoHideCb.addEventListener('change', (e) => {
			prefStorage.set('autoHideBattle', e.target.checked);
		});
	}

	const opacitySlider = overlay.querySelector('#oj-opacity');
	const opacityVal = overlay.querySelector('#oj-opacity-val');
	if (opacitySlider) {
		opacitySlider.addEventListener('input', (e) => {
			const val = parseInt(e.target.value, 10);
			if (opacityVal) opacityVal.textContent = `${val}%`;
			overlay.style.opacity = val / 100;
		});
		opacitySlider.addEventListener('change', (e) => {
			prefStorage.set('overlayOpacity', parseInt(e.target.value, 10));
		});
	}

	const defaultTabSel = overlay.querySelector('#oj-default-tab');
	if (defaultTabSel) {
		defaultTabSel.addEventListener('change', (e) => {
			prefStorage.set('defaultTab', e.target.value);
		});
	}

	const languageSel = overlay.querySelector('#oj-ui-language');
	if (languageSel) {
		languageSel.addEventListener('change', (e) => {
			const language = String(e.target.value || 'en').trim().toLowerCase() || 'en';
			prefStorage.set('uiLanguage', language);
			if (typeof onUiLanguageChange === 'function') {
				onUiLanguageChange(language);
			}
		});
	}

	const catCheckboxes = overlay.querySelectorAll('[data-track-cat]');
	for (const cb of catCheckboxes) {
		cb.addEventListener('change', (e) => {
			const cat = e.target.dataset.trackCat;
			gameTracker.setTrackingCategory(cat, e.target.checked);
		});
	}
}
