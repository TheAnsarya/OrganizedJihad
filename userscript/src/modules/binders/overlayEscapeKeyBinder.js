/**
 * Overlay Escape-key binder.
 * Isolates document-level Escape-key listener wiring from UIManager.
 */

/**
 * Bind overlay Escape-key document listener.
 *
 * @param {object} params - Binding params
 * @param {(eventName: string, handler: Function) => void} params.addDocListener - Document-listener registration callback
 * @param {() => boolean} params.isVisible - Visibility accessor callback
 * @param {() => void} params.hide - Hide overlay callback
 */
export function bindOverlayEscapeKey(params) {
	const addDocListener = params?.addDocListener;
	const isVisible = params?.isVisible;
	const hide = params?.hide;
	if (typeof addDocListener !== 'function' || typeof isVisible !== 'function' || typeof hide !== 'function') {
		return;
	}

	addDocListener('keydown', (e) => {
		if (e.key === 'Escape' && isVisible()) {
			e.preventDefault();
			hide();
		}
	});
}
