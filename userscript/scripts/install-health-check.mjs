/**
 * install-health-check.mjs
 *
 * One-command install health check for local OrganizedJihad userscript setup.
 *
 * Usage:
 *   node scripts/install-health-check.mjs
 *   node scripts/install-health-check.mjs --baseUrl http://localhost:5124
 *   node scripts/install-health-check.mjs --json
 *   node scripts/install-health-check.mjs --open failed
 */

import { spawn } from 'node:child_process';

/** @typedef {{name: string, path: string, required: boolean}} EndpointCheck */
/** @typedef {'none' | 'failed' | 'required' | 'all'} OpenMode */

const DEFAULT_BASE_URL = 'http://localhost:5124';

/**
 * Parse CLI args for base URL, output format, and browser-open behavior.
 *
 * @param {string[]} args - Raw process argv tail
 * @returns {{ baseUrl: string, json: boolean, openMode: OpenMode }} Parsed options
 */
function parseArgs(args) {
	let baseUrl = DEFAULT_BASE_URL;
	let json = false;
	/** @type {OpenMode} */
	let openMode = 'none';
	for (let i = 0; i < args.length; i++) {
		const arg = String(args[i] || '').trim();
		if (arg === '--baseUrl' && args[i + 1]) {
			baseUrl = String(args[i + 1]).trim();
			i++;
			continue;
		}
		if (arg === '--json') {
			json = true;
			continue;
		}
		if (arg === '--open') {
			const value = String(args[i + 1] || '').trim().toLowerCase();
			if (!value || value.startsWith('--')) {
				openMode = 'failed';
				continue;
			}
			if (value === 'failed' || value === 'required' || value === 'all') {
				openMode = value;
				i++;
			}
		}
	}

	baseUrl = baseUrl.replace(/\/+$/, '');
	if (!baseUrl) {
		baseUrl = DEFAULT_BASE_URL;
	}

	return { baseUrl, json, openMode };
}

/**
 * Attempt to fetch one endpoint and report health status.
 *
 * @param {string} baseUrl - API base URL
 * @param {EndpointCheck} check - Endpoint definition
 * @returns {Promise<{ ok: boolean, required: boolean, name: string, status: string, url: string }>} Check result
 */
async function runEndpointCheck(baseUrl, check) {
	const url = `${baseUrl}${check.path}`;

	try {
		const response = await fetch(url, {
			method: 'GET',
			headers: { Accept: 'application/json' },
		});

		if (!response.ok) {
			return {
				ok: false,
				required: check.required,
				name: check.name,
				status: `HTTP ${response.status}`,
				url,
			};
		}

		return {
			ok: true,
			required: check.required,
			name: check.name,
			status: `HTTP ${response.status}`,
			url,
		};
	} catch (error) {
		return {
			ok: false,
			required: check.required,
			name: check.name,
			status: error instanceof Error ? error.message : 'Unknown connection failure',
			url,
		};
	}
}

/**
 * Open one URL in the default browser on the current OS.
 *
 * @param {string} url - URL to open
 */
function openUrl(url) {
	let command = '';
	let args = [];

	if (process.platform === 'win32') {
		command = 'cmd';
		args = ['/c', 'start', '', url];
	} else if (process.platform === 'darwin') {
		command = 'open';
		args = [url];
	} else {
		command = 'xdg-open';
		args = [url];
	}

	const child = spawn(command, args, {
		stdio: 'ignore',
		detached: true,
	});
	child.unref();
}

/**
 * Resolve which URLs should be opened based on mode and endpoint outcomes.
 *
 * @param {OpenMode} mode - Requested browser-open mode
 * @param {Array<{ ok: boolean, required: boolean, url: string }>} results - Endpoint results
 * @returns {string[]} URL list to open
 */
function selectUrlsToOpen(mode, results) {
	if (mode === 'none') {
		return [];
	}

	if (mode === 'all') {
		return results.map((r) => r.url);
	}

	if (mode === 'required') {
		return results.filter((r) => r.required).map((r) => r.url);
	}

	return results.filter((r) => !r.ok).map((r) => r.url);
}

/**
 * Run all install-health checks and print actionable guidance.
 *
 * @returns {Promise<number>} Process exit code
 */
async function main() {
	const { baseUrl, json, openMode } = parseArgs(process.argv.slice(2));

	/** @type {EndpointCheck[]} */
	const checks = [
		{ name: 'Sync Health', path: '/api/sync/health', required: true },
		{ name: 'Userscript Handshake', path: '/ui/userscript-handshake', required: true },
		{ name: 'Projected Item Catalog', path: '/api/sync/projections/item-catalog', required: false },
		{ name: 'Tool Catalog Filters', path: '/api/sync/tools/catalog/filters', required: false },
	];

	if (!json) {
		console.log('OrganizedJihad Install Health Check');
		console.log(`Base URL: ${baseUrl}`);
		console.log('');
	}

	const results = [];
	for (const check of checks) {
		// Sequential checks keep output deterministic and easier to read.
		// eslint-disable-next-line no-await-in-loop
		const result = await runEndpointCheck(baseUrl, check);
		results.push(result);
		if (!json) {
			const icon = result.ok ? 'PASS' : (check.required ? 'FAIL' : 'WARN');
			console.log(`${icon} ${result.name}: ${result.status}`);
		}
	}

	const failedRequired = results.filter((r) => !r.ok && r.required);
	const failedOptional = results.filter((r) => !r.ok && !r.required);

	const urlsToOpen = [...new Set(selectUrlsToOpen(openMode, results))];
	const openedUrls = [];
	for (const url of urlsToOpen) {
		try {
			openUrl(url);
			openedUrls.push(url);
		} catch {
			// Non-fatal: failing to open browser should not break diagnostics.
		}
	}

	if (json) {
		const payload = {
			timestampUtc: new Date().toISOString(),
			baseUrl,
			ok: failedRequired.length === 0,
			openMode,
			openedUrls,
			summary: {
				totalChecks: results.length,
				requiredFailed: failedRequired.length,
				optionalFailed: failedOptional.length,
			},
			results,
		};
		console.log(JSON.stringify(payload, null, 2));
		return failedRequired.length === 0 ? 0 : 1;
	}

	console.log('');
	if (failedRequired.length === 0) {
		console.log('Result: Required checks passed. Userscript install should be functional.');
		if (failedOptional.length > 0) {
			console.log('Optional endpoints failed; advanced UI sections may show partial data.');
		}
		if (openedUrls.length > 0) {
			console.log(`Opened ${openedUrls.length} URL(s) in browser (${openMode} mode).`);
		}
		return 0;
	}

	console.log('Result: Required checks failed.');
	console.log('Next actions:');
	console.log('1. Start API: dotnet run --project api');
	console.log('2. Re-run this check: yarn install:check --open failed');
	console.log('3. Open API health URL in browser: ' + `${baseUrl}/api/sync/health`);
	console.log('4. Open userscript handshake URL in browser: ' + `${baseUrl}/ui/userscript-handshake`);
	console.log('5. Verify Tampermonkey script is enabled, then load Hero Wars and wait for one sync event.');
	if (openedUrls.length > 0) {
		console.log(`Opened ${openedUrls.length} URL(s) in browser (${openMode} mode).`);
	}
	return 1;
}

main()
	.then((code) => {
		process.exitCode = code;
	})
	.catch((error) => {
		console.error('Unexpected health-check failure:', error);
		process.exitCode = 1;
	});
