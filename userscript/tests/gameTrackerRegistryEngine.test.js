import {
	buildHandlerEntry,
	createHandlerRegistry,
	normalizeHandlerMethods,
	registerHandlerEntry,
	registerTrackerHandler,
	sanitizeDependsOn,
	topologicalSortHandlerMethods,
} from '../src/modules/trackers/GameTrackerRegistryEngine.js';

describe('GameTrackerRegistryEngine', () => {
	test('createHandlerRegistry returns empty Map', () => {
		const registry = createHandlerRegistry();
		expect(registry).toBeInstanceOf(Map);
		expect(registry.size).toBe(0);
	});

	test('normalizeHandlerMethods normalizes string and array inputs', () => {
		expect(normalizeHandlerMethods('userGetInfo')).toEqual(['userGetInfo']);
		expect(normalizeHandlerMethods(['a', 'b'])).toEqual(['a', 'b']);
	});

	test('sanitizeDependsOn removes self-dependencies and warns', () => {
		const warn = jest.fn();
		const result = sanitizeDependsOn(['heroGetAll', 'userGetInfo'], ['heroGetAll'], 'hero', warn);
		expect(result).toEqual(['userGetInfo']);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('circular self-dependency'));
	});

	test('buildHandlerEntry returns normalized entry shape', () => {
		const handler = jest.fn();
		const entry = buildHandlerEntry(handler, 'test', ['a'], 'player');
		expect(entry).toEqual({
			handler,
			label: 'test',
			dependsOn: ['a'],
			category: 'player',
		});
	});

	test('registerHandlerEntry inserts entries for all methods', () => {
		const registry = createHandlerRegistry();
		const entry = buildHandlerEntry(jest.fn(), 'test', [], 'player');
		registerHandlerEntry(registry, ['a', 'b'], entry);
		expect(registry.get('a')).toEqual([entry]);
		expect(registry.get('b')).toEqual([entry]);
	});

	test('registerTrackerHandler registers normalized handler entry', () => {
		const registry = createHandlerRegistry();
		const handler = jest.fn();
		registerTrackerHandler(
			registry,
			'heroGetAll',
			handler,
			'testLabel',
			{ dependsOn: ['userGetInfo'], category: 'player' },
			jest.fn()
		);

		expect(registry.get('heroGetAll')[0]).toEqual({
			handler,
			label: 'testLabel',
			dependsOn: ['userGetInfo'],
			category: 'player',
		});
	});

	test('topologicalSortHandlerMethods sorts dependencies before dependents', () => {
		const registry = createHandlerRegistry();
		registerTrackerHandler(registry, 'heroGetAll', jest.fn(), 'hero', { dependsOn: ['userGetInfo'] }, jest.fn());
		registerTrackerHandler(registry, 'userGetInfo', jest.fn(), 'user', {}, jest.fn());

		const sorted = topologicalSortHandlerMethods(['heroGetAll', 'userGetInfo'], registry, jest.fn());
		expect(sorted).toEqual(['userGetInfo', 'heroGetAll']);
	});

	test('topologicalSortHandlerMethods appends cycle members and warns', () => {
		const registry = createHandlerRegistry();
		const warn = jest.fn();
		registerTrackerHandler(registry, 'a', jest.fn(), 'a', { dependsOn: ['b'] }, jest.fn());
		registerTrackerHandler(registry, 'b', jest.fn(), 'b', { dependsOn: ['a'] }, jest.fn());

		const sorted = topologicalSortHandlerMethods(['a', 'b'], registry, warn);
		expect(sorted).toHaveLength(2);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('Circular handler dependencies'));
	});
});
