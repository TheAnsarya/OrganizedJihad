import {
	buildMissionProgressId,
	buildMissionProgressLogMessage,
	buildMissionProgressRecord,
	buildTowerProgressLogMessage,
	buildTowerProgressRecord,
	executeResourceTransactionIntents,
	getExistingProgressRecord,
	resolveTowerType,
} from '../src/modules/trackers/GameTrackerProgressionTrackingHelpers.js';

describe('GameTrackerProgressionTrackingHelpers', () => {
	test('getExistingProgressRecord returns row and swallows lookup errors', async () => {
		const storageOk = { get: jest.fn(async () => ({ id: 1 })) };
		const storageFail = { get: jest.fn(async () => { throw new Error('missing'); }) };

		await expect(getExistingProgressRecord(storageOk, 'missionProgress', 'm1')).resolves.toEqual({ id: 1 });
		await expect(getExistingProgressRecord(storageFail, 'missionProgress', 'm1')).resolves.toBeNull();
	});

	test('buildMissionProgressId preserves heroic/normal suffix', () => {
		expect(buildMissionProgressId({ missionId: 10, isHeroic: true })).toBe('10_heroic');
		expect(buildMissionProgressId({ missionId: 10, isHeroic: false })).toBe('10_normal');
	});

	test('buildMissionProgressRecord applies merge semantics', () => {
		const record = buildMissionProgressRecord(
			{ missionId: 20, missionName: 'C20', level: 3, isHeroic: true },
			{ stars: 1 },
			{ stars: 3, highestLevel: 9, completionCount: 4 },
			'p1',
			'iso'
		);

		expect(record).toEqual({
			missionId: '20_heroic',
			missionName: 'C20',
			stars: 3,
			highestLevel: 3,
			isHeroic: true,
			lastCompleted: 'iso',
			completionCount: 5,
			playerId: 'p1',
		});
	});

	test('buildMissionProgressLogMessage keeps parity format', () => {
		expect(buildMissionProgressLogMessage({ missionName: 'M1', stars: 2 }))
			.toBe('[OrganizedJihad] Mission progress updated: M1 - 2 stars');
	});

	test('resolveTowerType defaults to regular', () => {
		expect(resolveTowerType({ towerType: 'guild' })).toBe('guild');
		expect(resolveTowerType({ type: 'outland' })).toBe('outland');
		expect(resolveTowerType({})).toBe('regular');
	});

	test('buildTowerProgressRecord applies highest-floor merge semantics', () => {
		const record = buildTowerProgressRecord({ floorDetails: { chest: true } }, { highestFloor: 17 }, 'p2', 'regular', 11, 'ts');
		expect(record).toEqual({
			towerType: 'regular',
			highestFloor: 17,
			lastUpdate: 'ts',
			floorData: JSON.stringify({ chest: true }),
			playerId: 'p2',
		});
	});

	test('buildTowerProgressLogMessage keeps parity format', () => {
		expect(buildTowerProgressLogMessage({ towerType: 'regular', highestFloor: 5 }))
			.toBe('[OrganizedJihad] Tower progress updated: regular - floor 5');
	});

	test('executeResourceTransactionIntents dispatches intents in order', async () => {
		const tracker = { trackResourceTransaction: jest.fn(async () => {}) };
		await executeResourceTransactionIntents(tracker, [
			{ resourceType: 'gold', amount: 1, source: 'battle', sourceDetail: 'a' },
			{ resourceType: 'emeralds', amount: 2, source: 'quest', sourceDetail: 'b' },
		]);

		expect(tracker.trackResourceTransaction).toHaveBeenNthCalledWith(1, 'gold', 1, 'battle', 'a');
		expect(tracker.trackResourceTransaction).toHaveBeenNthCalledWith(2, 'emeralds', 2, 'quest', 'b');
	});
});
