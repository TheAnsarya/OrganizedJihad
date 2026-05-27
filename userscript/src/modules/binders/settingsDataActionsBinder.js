/**
 * Settings data actions binder.
 * Isolates export/import/clear listener wiring from UIManager.
 */

/**
 * Bind settings data action listeners.
 *
 * @param {object} params - Binding params
 * @param {HTMLElement} params.overlay - UI overlay root
 * @param {object} params.gameTracker - GameTracker instance
 * @param {{ clearAll: Function }} params.prefStorage - Preference storage
 * @param {(data: object, prefix: string) => void} params.downloadJson - JSON download helper
 * @param {() => void} params.refreshStorageStats - Reload storage stats callback
 */
export function bindSettingsDataActions(params) {
	const overlay = params?.overlay;
	const gameTracker = params?.gameTracker;
	const prefStorage = params?.prefStorage;
	const downloadJson = params?.downloadJson;
	const refreshStorageStats = params?.refreshStorageStats;
	if (!overlay || !gameTracker || !prefStorage || typeof downloadJson !== 'function') return;

	// Export curated data
	const exportBtn = overlay.querySelector('#oj-export-data');
	if (exportBtn) {
		exportBtn.addEventListener('click', async () => {
			try {
				const data = await gameTracker.exportAllData();
				downloadJson(data, 'organized-jihad-export');
			} catch (err) {
				console.error('[OrganizedJihad] Export failed:', err);
				alert('Export failed — check console for details.');
			}
		});
	}

	// Export raw IDB dump
	const exportRawBtn = overlay.querySelector('#oj-export-raw');
	if (exportRawBtn) {
		exportRawBtn.addEventListener('click', async () => {
			try {
				exportRawBtn.textContent = '⏳ Exporting...';
				exportRawBtn.disabled = true;
				const data = await gameTracker.exportRawData();
				downloadJson(data, 'organized-jihad-raw-export');
			} catch (err) {
				console.error('[OrganizedJihad] Raw export failed:', err);
				alert('Raw export failed — check console.');
			} finally {
				exportRawBtn.textContent = '💾 Export Raw';
				exportRawBtn.disabled = false;
			}
		});
	}

	// Export API samples
	const exportSamplesBtn = overlay.querySelector('#oj-export-api-samples');
	if (exportSamplesBtn) {
		exportSamplesBtn.addEventListener('click', () => {
			try {
				const count = gameTracker?.getApiSampleCount?.() || 0;
				if (count === 0) {
					alert('No API samples captured yet. Play the game for a while — visit different screens (arena, heroes, inventory, guild war) to populate samples.');
					return;
				}
				const data = gameTracker.exportApiSamples();
				downloadJson(data, 'hw-api-samples');
				const statsEl = overlay.querySelector('#oj-api-sample-stats');
				if (statsEl) {
					statsEl.textContent = `Methods captured: ${count} — exported!`;
				}
			} catch (err) {
				console.error('[OrganizedJihad] API samples export failed:', err);
				alert('Export failed — check console.');
			}
		});
	}

	// Clear/reset API samples
	const clearSamplesBtn = overlay.querySelector('#oj-clear-api-samples');
	if (clearSamplesBtn) {
		clearSamplesBtn.addEventListener('click', () => {
			if (confirm('Clear all captured API samples? They will be re-captured as you play.')) {
				gameTracker?.clearApiSamples?.();
				const statsEl = overlay.querySelector('#oj-api-sample-stats');
				if (statsEl) {
					statsEl.textContent = 'Methods captured: 0 — cleared! Play the game to re-capture.';
				}
			}
		});
	}

	// Import data
	const importBtn = overlay.querySelector('#oj-import-data');
	const importFile = overlay.querySelector('#oj-import-file');
	if (importBtn && importFile) {
		importBtn.addEventListener('click', () => importFile.click());
		importFile.addEventListener('change', async (e) => {
			const file = e.target.files?.[0];
			if (!file) return;

			if (!confirm(`Import data from "${file.name}"?\n\nExisting records with the same keys will be skipped (not overwritten).`)) {
				importFile.value = '';
				return;
			}

			try {
				importBtn.textContent = '⏳ Importing...';
				importBtn.disabled = true;
				const text = await file.text();
				const data = JSON.parse(text);
				const summary = await gameTracker.importRawData(data);

				const imported = Object.values(summary.imported).reduce((a, b) => a + b, 0);
				const skipped = Object.values(summary.skipped).reduce((a, b) => a + b, 0);
				const errors = summary.errors.length;
				alert(`Import complete!\n\n✅ ${imported} records imported\n⏩ ${skipped} duplicates skipped\n${errors > 0 ? `❌ ${errors} errors` : ''}`);

				refreshStorageStats?.();
			} catch (err) {
				console.error('[OrganizedJihad] Import failed:', err);
				alert('Import failed — check console. File may be invalid JSON.');
			} finally {
				importBtn.textContent = '📤 Import';
				importBtn.disabled = false;
				importFile.value = '';
			}
		});
	}

	// Clear all data
	const clearBtn = overlay.querySelector('#oj-clear-data');
	if (clearBtn) {
		clearBtn.addEventListener('click', async () => {
			if (confirm('⚠️ This will delete ALL tracked data (heroes, battles, snapshots, etc.).\n\nAre you sure?')) {
				try {
					prefStorage.clearAll();
					const dbName = 'OrganizedJihad';
					const deleteReq = indexedDB.deleteDatabase(dbName);
					deleteReq.onsuccess = () => {
						alert('All data cleared. The page will reload.');
						location.reload();
					};
					deleteReq.onerror = () => {
						alert('Failed to clear IndexedDB. Try clearing manually in DevTools.');
					};
				} catch (err) {
					console.error('[OrganizedJihad] Clear failed:', err);
					alert('Clear failed — check console.');
				}
			}
		});
	}
}
