import { bindSettingsDataActions } from '../src/modules/binders/settingsDataActionsBinder.js';

function buildOverlayHtml() {
	document.body.innerHTML = `
		<div id="root">
			<button id="oj-sync-now">\uD83D\uDD04 Sync Now</button>
			<div id="oj-sync-status"></div>
		</div>
	`;
	return document.querySelector('#root');
}

function flushAsync() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('settingsDataActionsBinder sync actions', () => {
	test('loads existing sync metadata into settings status', async () => {
		const overlay = buildOverlayHtml();
		const idbStorage = {
			getMetadata: jest.fn(async (key) => {
				if (key === 'lastSync') return '2026-06-07T15:00:00.000Z';
				if (key === 'syncStatus') {
					return {
						ok: true,
						timestamp: '2026-06-07T15:00:00.000Z',
						message: 'Synced 12 records',
					};
				}
				return null;
			}),
		};

		bindSettingsDataActions({
			overlay,
			gameTracker: {},
			prefStorage: {},
			idbStorage,
			syncClient: { syncWithRetry: jest.fn() },
			downloadJson: jest.fn(),
			refreshStorageStats: jest.fn(),
		});

		await flushAsync();

		expect(overlay.querySelector('#oj-sync-status').textContent).toContain('Last sync:');
		expect(overlay.querySelector('#oj-sync-status').textContent).toContain('Synced 12 records');
	});

	test('manual sync button triggers sync and updates success status', async () => {
		const overlay = buildOverlayHtml();
		const syncClient = {
			syncWithRetry: jest.fn(async () => ({ importedCounts: { snapshots: 1, battles: 4 } })),
		};
		const idbStorage = {
			getMetadata: jest.fn(async (key) => {
				if (key === 'lastSync') return '2026-06-07T15:01:00.000Z';
				if (key === 'syncStatus') {
					return {
						ok: true,
						timestamp: '2026-06-07T15:01:00.000Z',
						message: 'Synced 5 records',
					};
				}
				return null;
			}),
		};

		bindSettingsDataActions({
			overlay,
			gameTracker: {},
			prefStorage: {},
			idbStorage,
			syncClient,
			downloadJson: jest.fn(),
			refreshStorageStats: jest.fn(),
		});

		overlay.querySelector('#oj-sync-now').click();
		await flushAsync();
		await flushAsync();

		expect(syncClient.syncWithRetry).toHaveBeenCalledWith(idbStorage);
		expect(overlay.querySelector('#oj-sync-status').textContent).toContain('Last sync:');
		expect(overlay.querySelector('#oj-sync-now').textContent).toContain('Sync Now');
	});

	test('manual sync failure updates status with error', async () => {
		const overlay = buildOverlayHtml();
		const syncClient = {
			syncWithRetry: jest.fn(async () => {
				throw new Error('network down');
			}),
		};
		const idbStorage = {
			getMetadata: jest.fn(async () => null),
		};

		bindSettingsDataActions({
			overlay,
			gameTracker: {},
			prefStorage: {},
			idbStorage,
			syncClient,
			downloadJson: jest.fn(),
			refreshStorageStats: jest.fn(),
		});

		overlay.querySelector('#oj-sync-now').click();
		await flushAsync();
		await flushAsync();

		expect(overlay.querySelector('#oj-sync-status').textContent).toContain('Manual sync failed:');
		expect(overlay.querySelector('#oj-sync-status').textContent).toContain('network down');
	});
});
