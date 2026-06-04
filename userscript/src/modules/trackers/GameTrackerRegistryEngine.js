/**
 * GameTrackerRegistryEngine.js
 *
 * Shared registry-engine helpers for GameTracker handler registration
 * and dependency-aware dispatch ordering.
 */

/**
 * Create a new handler registry map.
 *
 * @returns {Map<string, Array<{handler: Function, label: string, dependsOn: string[], category: string|null}>>}
 */
export function createHandlerRegistry() {
	return new Map();
}

/**
 * Normalize a handler methods input into an array of method names.
 *
 * @param {string|string[]} methods
 * @returns {string[]}
 */
export function normalizeHandlerMethods(methods) {
	return Array.isArray(methods) ? methods : [methods];
}

/**
 * Normalize and sanitize dependency list for a handler registration.
 *
 * @param {string[]|undefined|null} dependsOn
 * @param {string[]} methodList
 * @param {string} label
 * @param {(message: string) => void} warn
 * @returns {string[]}
 */
export function sanitizeDependsOn(dependsOn, methodList, label, warn) {
	const dependencies = Array.isArray(dependsOn) ? [...dependsOn] : [];

	for (const method of methodList) {
		const index = dependencies.indexOf(method);
		if (index !== -1) {
			warn(`[OrganizedJihad] Handler "${label}" has circular self-dependency on "${method}" — ignoring dependency`);
			dependencies.splice(index, 1);
		}
	}

	return dependencies;
}

/**
 * Build a normalized registry entry object.
 *
 * @param {Function} handler
 * @param {string} label
 * @param {string[]} dependsOn
 * @param {string|null} category
 * @returns {{handler: Function, label: string, dependsOn: string[], category: string|null}}
 */
export function buildHandlerEntry(handler, label, dependsOn, category) {
	return {
		handler,
		label,
		dependsOn,
		category,
	};
}

/**
 * Register a normalized entry for each method name.
 *
 * @param {Map<string, Array<{handler: Function, label: string, dependsOn: string[], category: string|null}>>} registry
 * @param {string[]} methodList
 * @param {{handler: Function, label: string, dependsOn: string[], category: string|null}} entry
 */
export function registerHandlerEntry(registry, methodList, entry) {
	for (const method of methodList) {
		if (!registry.has(method)) {
			registry.set(method, []);
		}
		registry.get(method).push(entry);
	}
}

/**
 * Register a handler into the target registry with normalized options.
 *
 * @param {Map<string, Array<{handler: Function, label: string, dependsOn: string[], category: string|null}>>} registry
 * @param {string|string[]} methods
 * @param {Function} handler
 * @param {string} label
 * @param {{dependsOn?: string[], category?: string|null}} options
 * @param {(message: string) => void} warn
 */
export function registerTrackerHandler(registry, methods, handler, label, options = {}, warn = console.warn) {
	const methodList = normalizeHandlerMethods(methods);
	const dependsOn = sanitizeDependsOn(options.dependsOn, methodList, label, warn);
	const category = options.category || null;
	const entry = buildHandlerEntry(handler, label, dependsOn, category);
	registerHandlerEntry(registry, methodList, entry);
}

/**
 * Topologically sort method names using in-batch handler dependencies.
 * Cycles are appended in original order with a warning.
 *
 * @param {string[]} methodNames
 * @param {Map<string, Array<{dependsOn?: string[]}>>} registry
 * @param {(message: string) => void} warn
 * @returns {string[]}
 */
export function topologicalSortHandlerMethods(methodNames, registry, warn = console.warn) {
	const nameSet = new Set(methodNames);
	const deps = new Map();
	const dependents = new Map();

	for (const name of methodNames) {
		deps.set(name, new Set());
		dependents.set(name, new Set());
	}

	for (const name of methodNames) {
		const handlers = registry.get(name) || [];
		for (const entry of handlers) {
			for (const dep of entry.dependsOn || []) {
				if (nameSet.has(dep) && dep !== name) {
					deps.get(name).add(dep);
					dependents.get(dep).add(name);
				}
			}
		}
	}

	const inDegree = new Map();
	for (const [name, depSet] of deps) {
		inDegree.set(name, depSet.size);
	}

	const queue = [];
	for (const [name, degree] of inDegree) {
		if (degree === 0) {
			queue.push(name);
		}
	}

	const sorted = [];
	const sortedSet = new Set();
	let qi = 0;
	while (qi < queue.length) {
		const current = queue[qi++];
		sorted.push(current);
		sortedSet.add(current);

		for (const dependent of (dependents.get(current) || [])) {
			const depSet = deps.get(dependent);
			if (depSet?.has(current)) {
				depSet.delete(current);
				if (depSet.size === 0 && !sortedSet.has(dependent)) {
					queue.push(dependent);
				}
			}
		}
	}

	if (sorted.length < methodNames.length) {
		const remaining = methodNames.filter((name) => !sortedSet.has(name));
		if (remaining.length > 0) {
			warn(`[OrganizedJihad] Circular handler dependencies detected: ${remaining.join(', ')} — appending in original order`);
			sorted.push(...remaining);
		}
	}

	return sorted;
}
