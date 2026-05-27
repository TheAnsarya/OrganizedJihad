/**
 * Settings health actions binder.
 * Isolates first-run health action button wiring from UIManager.
 */

/**
 * Bind health action listeners in settings view.
 *
 * @param {object} params - Binding params
 * @param {HTMLElement} params.overlay - UI overlay root
 * @param {() => void} params.runInstallHealthCheck - Action to run install health check
 * @param {() => void} params.openApiLog - Action to open API log tab
 * @param {() => void} params.openApiHealth - Action to open API health endpoint
 * @param {() => void} params.openApiDocs - Action to open API docs endpoint
 */
export function bindSettingsHealthActions(params) {
	const overlay = params?.overlay;
	if (!overlay) return;

	const healthBtn = overlay.querySelector('#oj-install-health-check');
	if (healthBtn) {
		healthBtn.addEventListener('click', () => {
			params?.runInstallHealthCheck?.();
		});
	}

	const openApiLogBtn = overlay.querySelector('#oj-health-open-apilog');
	if (openApiLogBtn) {
		openApiLogBtn.addEventListener('click', () => {
			params?.openApiLog?.();
		});
	}

	const openApiHealthBtn = overlay.querySelector('#oj-health-open-api-health');
	if (openApiHealthBtn) {
		openApiHealthBtn.addEventListener('click', () => {
			params?.openApiHealth?.();
		});
	}

	const openApiDocsBtn = overlay.querySelector('#oj-health-open-api-docs');
	if (openApiDocsBtn) {
		openApiDocsBtn.addEventListener('click', () => {
			params?.openApiDocs?.();
		});
	}
}
