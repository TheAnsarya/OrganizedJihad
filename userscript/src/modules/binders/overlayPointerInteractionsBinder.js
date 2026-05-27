/**
 * Overlay pointer interactions binder.
 * Isolates drag/resize listener orchestration from UIManager.
 */

/**
 * Bind draggable header behavior.
 *
 * @param {object} params - Binding params
 * @param {HTMLElement} params.overlay - UI overlay root
 * @param {{ set: Function }} params.prefStorage - Preference storage
 * @param {(eventName: string, handler: Function) => void} params.addDocListener - Document-listener registration callback
 * @param {(pos: {x: number, y: number}) => void} params.setSavedPos - Saved-position callback
 */
export function bindOverlayDraggable(params) {
	const overlay = params?.overlay;
	const prefStorage = params?.prefStorage;
	const addDocListener = params?.addDocListener;
	const setSavedPos = params?.setSavedPos;
	if (!overlay || !prefStorage || typeof addDocListener !== 'function' || typeof setSavedPos !== 'function') {
		return;
	}

	const header = overlay.querySelector('.oj-header');
	if (!header) return;

	let isDragging = false;
	let startX;
	let startY;
	let startLeft;
	let startTop;

	header.addEventListener('mousedown', (e) => {
		if (e.target.closest('button')) return;

		isDragging = true;
		if (overlay.style.left === '' || overlay.style.left === 'auto') {
			const rect = overlay.getBoundingClientRect();
			overlay.style.left = rect.left + 'px';
			overlay.style.top = rect.top + 'px';
			overlay.style.right = 'auto';
		}

		startX = e.clientX;
		startY = e.clientY;
		startLeft = parseInt(overlay.style.left, 10) || 0;
		startTop = parseInt(overlay.style.top, 10) || 0;
		header.style.cursor = 'grabbing';
		e.preventDefault();
	});

	addDocListener('mousemove', (e) => {
		if (!isDragging) return;
		e.preventDefault();

		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		const w = overlay.offsetWidth;
		const h = overlay.offsetHeight;
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const minVisible = 40;

		let newLeft = startLeft + dx;
		let newTop = startTop + dy;
		newLeft = Math.max(-w + minVisible, Math.min(newLeft, vw - minVisible));
		newTop = Math.max(0, Math.min(newTop, vh - minVisible));

		overlay.style.left = newLeft + 'px';
		overlay.style.top = newTop + 'px';
	});

	addDocListener('mouseup', () => {
		if (!isDragging) return;
		isDragging = false;
		header.style.cursor = 'grab';

		const savedPos = {
			x: parseInt(overlay.style.left, 10),
			y: parseInt(overlay.style.top, 10),
		};
		setSavedPos(savedPos);
		prefStorage.set('overlayPosition', savedPos);
	});
}

/**
 * Bind resizable handle behavior.
 *
 * @param {object} params - Binding params
 * @param {HTMLElement} params.overlay - UI overlay root
 * @param {{ set: Function }} params.prefStorage - Preference storage
 * @param {(eventName: string, handler: Function) => void} params.addDocListener - Document-listener registration callback
 * @param {(size: {w: number, h: number}) => void} params.setSavedSize - Saved-size callback
 */
export function bindOverlayResizable(params) {
	const overlay = params?.overlay;
	const prefStorage = params?.prefStorage;
	const addDocListener = params?.addDocListener;
	const setSavedSize = params?.setSavedSize;
	if (!overlay || !prefStorage || typeof addDocListener !== 'function' || typeof setSavedSize !== 'function') {
		return;
	}

	const handle = overlay.querySelector('#oj-resize-handle');
	if (!handle) return;

	const MIN_WIDTH = 400;
	const MIN_HEIGHT = 300;
	let isResizing = false;
	let startX;
	let startY;
	let startW;
	let startH;

	handle.addEventListener('mousedown', (e) => {
		isResizing = true;
		if (overlay.style.left === '' || overlay.style.left === 'auto') {
			const rect = overlay.getBoundingClientRect();
			overlay.style.left = rect.left + 'px';
			overlay.style.top = rect.top + 'px';
			overlay.style.right = 'auto';
		}

		startX = e.clientX;
		startY = e.clientY;
		startW = overlay.offsetWidth;
		startH = overlay.offsetHeight;
		e.preventDefault();
		e.stopPropagation();
	});

	addDocListener('mousemove', (e) => {
		if (!isResizing) return;
		e.preventDefault();

		const left = parseInt(overlay.style.left, 10) || 0;
		const top = parseInt(overlay.style.top, 10) || 0;
		const maxW = window.innerWidth - left;
		const maxH = window.innerHeight - top;

		const newW = Math.max(MIN_WIDTH, Math.min(startW + (e.clientX - startX), maxW));
		const newH = Math.max(MIN_HEIGHT, Math.min(startH + (e.clientY - startY), maxH));

		overlay.style.width = newW + 'px';
		overlay.style.height = newH + 'px';
		overlay.style.maxHeight = 'none';
	});

	addDocListener('mouseup', () => {
		if (!isResizing) return;
		isResizing = false;

		const savedSize = {
			w: overlay.offsetWidth,
			h: overlay.offsetHeight,
		};
		setSavedSize(savedSize);
		prefStorage.set('overlaySize', savedSize);
	});
}
