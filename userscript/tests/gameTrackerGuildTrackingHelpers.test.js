import {
	buildGuildMemberSnapshotPayload,
	buildGuildMetadata,
	buildGuildTransitionActivities,
	persistGuildMemberSnapshotPayload,
	trackGuildDataHelper,
} from '../src/modules/trackers/GameTrackerGuildTrackingHelpers.js';

describe('GameTrackerGuildTrackingHelpers', () => {
	test('buildGuildMetadata normalizes clan payload', () => {
		const metadata = buildGuildMetadata({
			clan: {
				id: 123,
				name: 'Night Owls',
				level: 4,
				members: {
					1: {},
					2: {},
				},
			},
		});

		expect(metadata).toEqual(expect.objectContaining({
			id: 123,
			name: 'Night Owls',
			level: 4,
			members: 2,
		}));
		expect(typeof metadata.lastUpdate).toBe('number');
	});

	test('buildGuildTransitionActivities emits join/leave/change semantics', () => {
		const joined = buildGuildTransitionActivities({ id: null }, { id: 1, name: 'A', level: 3, members: 21 });
		const left = buildGuildTransitionActivities({ id: 1, name: 'A' }, { id: null, name: 'No Guild', level: 0, members: 0 });
		const changed = buildGuildTransitionActivities({ id: 1, name: 'A' }, { id: 2, name: 'B', level: 5, members: 27 });

		expect(joined).toEqual([
			expect.objectContaining({ activityType: 'join' }),
		]);
		expect(left).toEqual([
			expect.objectContaining({ activityType: 'leave' }),
		]);
		expect(changed.map((action) => action.activityType)).toEqual(['leave', 'join']);
	});

	test('trackGuildDataHelper persists metadata and dispatches transitions', async () => {
		const tracker = {
			storage: {
				getMetadata: jest.fn(async () => ({ id: 55, name: 'Old Guild' })),
				setMetadata: jest.fn(async () => {}),
			},
			trackGuildActivity: jest.fn(async () => {}),
		};

		await trackGuildDataHelper(tracker, {
			clan: {
				id: 77,
				name: 'New Guild',
				level: 7,
				members: {
					1: {},
				},
			},
		});

		expect(tracker.storage.setMetadata).toHaveBeenCalledWith('guildData', expect.objectContaining({ id: 77, name: 'New Guild' }));
		expect(tracker.trackGuildActivity).toHaveBeenNthCalledWith(1, 'leave', expect.objectContaining({ guildId: 55 }));
		expect(tracker.trackGuildActivity).toHaveBeenNthCalledWith(2, 'join', expect.objectContaining({ guildId: 77 }));
	});

	test('buildGuildMemberSnapshotPayload maps records and skips current player', () => {
		const payload = buildGuildMemberSnapshotPayload({
			clan: {
				id: 500,
				name: 'Raiders',
				members: {
					10: {
						name: 'Self',
					},
					11: {
						name: 'Mate',
						level: 130,
						power: 99999,
						rank: 'officer',
						contribution: 1234,
						totalContribution: 50000,
						heroes: [{ id: 1 }],
						titans: [{ id: 2 }],
					},
				},
			},
		}, 10);

		expect(payload.memberCount).toBe(2);
		expect(payload.guildMemberRecords).toHaveLength(1);
		expect(payload.snapshotRecords).toHaveLength(1);
		expect(payload.guildMemberRecords[0]).toEqual(expect.objectContaining({
			guildId: 500,
			guildName: 'Raiders',
			playerId: 11,
			playerName: 'Mate',
			guildRank: 'officer',
			heroRoster: JSON.stringify([{ id: 1 }]),
			titanRoster: JSON.stringify([{ id: 2 }]),
		}));
	});

	test('persistGuildMemberSnapshotPayload writes both batches', async () => {
		const storage = {
			putBatch: jest.fn(async () => {}),
			addBatch: jest.fn(async () => {}),
		};
		const payload = {
			guildMemberRecords: [{ playerId: 1 }],
			snapshotRecords: [{ playerId: 1 }],
		};

		await persistGuildMemberSnapshotPayload(storage, payload);

		expect(storage.putBatch).toHaveBeenCalledWith('guildMembers', payload.guildMemberRecords);
		expect(storage.addBatch).toHaveBeenCalledWith('guildMemberSnapshots', payload.snapshotRecords);
	});
});
