/**
 * Cooperative scheduling helpers to keep the UI thread responsive
 * during heavy parsing/sync workloads.
 */

/**
 * Yield execution back to the browser/event loop.
 *
 * Uses scheduler.yield() when available, then requestIdleCallback,
 * then a macrotask fallback.
 *
 * @returns {Promise<void>}
 */
export async function yieldToMainThread() {
	if (typeof window === 'undefined') {
		await Promise.resolve();
		return;
	}

	if (typeof globalThis.scheduler?.yield === 'function') {
		await globalThis.scheduler.yield();
		return;
	}

	if (typeof globalThis.requestIdleCallback === 'function') {
		await new Promise((resolve) => {
			globalThis.requestIdleCallback(() => resolve(), { timeout: 16 });
		});
		return;
	}

	await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Yield every N iterations to avoid long uninterrupted tasks.
 *
 * @param {number} iteration - Current 1-based iteration count
 * @param {number} every - Yield frequency
 * @returns {Promise<void>}
 */
export async function yieldEvery(iteration, every) {
	if (!Number.isFinite(iteration) || !Number.isFinite(every) || every <= 0) {
		return;
	}

	if (iteration % every === 0) {
		await yieldToMainThread();
	}
}
