/**
 * Overlay chrome controls binder.
 * Isolates top-level overlay control listener wiring from UIManager.
 */

/**
 * Bind overlay chrome control listeners.
 *
 * @param {object} params - Binding params
 * @param {HTMLElement} params.overlay - UI overlay root
 * @param {(view: string) => void} params.switchView - View switching callback
 * @param {() => void} params.hide - Hide overlay callback
 * @param {{ set: Function, delete: Function }} params.prefStorage - Preference storage
 * @param {(isMinimized: boolean) => void} params.setMinimized - Persist minimized state callback
 * @param {() => void} params.resetPositionAndSizeState - Reset overlay position/size callback
 */
export function bindOverlayChromeControls(params) {
	const overlay = params?.overlay;
	const switchView = params?.switchView;
	const hide = params?.hide;
	const prefStorage = params?.prefStorage;
	const setMinimized = params?.setMinimized;
	const resetPositionAndSizeState = params?.resetPositionAndSizeState;
	if (!overlay || typeof switchView !== 'function' || typeof hide !== 'function' || !prefStorage || typeof setMinimized !== 'function' || typeof resetPositionAndSizeState !== 'function') {
		return;
	}

	overlay.querySelectorAll('.oj-nav-btn').forEach((btn) => {
		btn.addEventListener('click', (e) => {
			switchView(e.target.dataset.view);
		});
	});

	const closeBtn = overlay.querySelector('#oj-close');
	if (closeBtn) {
		closeBtn.addEventListener('click', () => {
			hide();
		});
	}

	const minimizeBtn = overlay.querySelector('#oj-minimize');
	if (minimizeBtn) {
		minimizeBtn.addEventListener('click', () => {
			const isMinimized = overlay.classList.toggle('minimized');
			minimizeBtn.textContent = isMinimized ? '+' : '\u2212';
			minimizeBtn.title = isMinimized ? 'Expand' : 'Minimize';
			setMinimized(isMinimized);
			prefStorage.set('overlayMinimized', isMinimized);
		});
	}

	const resetBtn = overlay.querySelector('#oj-reset-pos');
	if (resetBtn) {
		resetBtn.addEventListener('click', () => {
			overlay.style.left = '';
			overlay.style.top = '';
			overlay.style.right = '';
			overlay.style.width = '';
			overlay.style.height = '';
			resetPositionAndSizeState();
			prefStorage.delete('overlayPosition');
			prefStorage.delete('overlaySize');
		});
	}
}
