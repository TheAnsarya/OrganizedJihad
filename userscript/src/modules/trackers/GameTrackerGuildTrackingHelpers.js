/**
 * GameTrackerGuildTrackingHelpers
 *
 * Helper seams for guild metadata transition handling and guild roster persistence.
 */

/**
 * Build normalized guild metadata for storage.
 *
 * @param {Object} data - clanGetInfo response payload
 * @returns {Object} normalized guild metadata
 */
export function buildGuildMetadata(data) {
	return {
		id: data?.clan?.id || null,
		name: data?.clan?.name || 'No Guild',
		level: data?.clan?.level || 0,
		members: Object.keys(data?.clan?.members || {}).length,
		lastUpdate: Date.now(),
	};
}

/**
 * Build guild transition activities based on old/new guild metadata.
 *
 * @param {Object} oldGuildData - previously stored guild metadata
 * @param {Object} guildData - newly calculated guild metadata
 * @returns {Array<Object>} ordered activity actions
 */
export function buildGuildTransitionActivities(oldGuildData, guildData) {
	const actions = [];

	if (oldGuildData.id === guildData.id) {
		return actions;
	}

	if (guildData.id && !oldGuildData.id) {
		actions.push({
			activityType: 'join',
			payload: {
				guildId: guildData.id,
				guildName: guildData.name,
				guildLevel: guildData.level,
				memberCount: guildData.members,
			},
		});
		return actions;
	}

	if (!guildData.id && oldGuildData.id) {
		actions.push({
			activityType: 'leave',
			payload: {
				guildId: oldGuildData.id,
				guildName: oldGuildData.name,
			},
		});
		return actions;
	}

	if (guildData.id && oldGuildData.id) {
		actions.push({
			activityType: 'leave',
			payload: {
				guildId: oldGuildData.id,
				guildName: oldGuildData.name,
			},
		});
		actions.push({
			activityType: 'join',
			payload: {
				guildId: guildData.id,
				guildName: guildData.name,
				guildLevel: guildData.level,
				memberCount: guildData.members,
			},
		});
	}

	return actions;
}

/**
 * Persist guild metadata and emit transition activities.
 *
 * @param {Object} tracker - gameTracker instance
 * @param {Object} data - clanGetInfo response payload
 */
export async function trackGuildDataHelper(tracker, data) {
	const oldGuildData = await tracker.storage.getMetadata('guildData', {});
	const guildData = buildGuildMetadata(data);

	await tracker.storage.setMetadata('guildData', guildData);

	const actions = buildGuildTransitionActivities(oldGuildData, guildData);
	for (const action of actions) {
		await tracker.trackGuildActivity(action.activityType, action.payload);
	}
}

/**
 * Build normalized guild member records and historical snapshots.
 *
 * @param {Object} data - clanGetInfo response payload
 * @param {number} currentPlayerId - player ID to skip in guild roster tracking
 * @returns {Object} guild roster and snapshot arrays plus metadata
 */
export function buildGuildMemberSnapshotPayload(data, currentPlayerId) {
	const guildId = data.clan.id || 0;
	const guildName = data.clan.name || 'Unknown Guild';
	const members = data.clan.members || {};
	const guildMemberRecords = [];
	const snapshotRecords = [];

	for (const [memberId, memberInfo] of Object.entries(members)) {
		if (parseInt(memberId) === currentPlayerId) {
			continue;
		}

		const guildMember = {
			guildId: guildId,
			guildName: guildName,
			playerId: parseInt(memberId),
			playerName: memberInfo.name || 'Unknown',
			level: memberInfo.level || 0,
			teamPower: memberInfo.power || memberInfo.teamPower || 0,
			guildRank: memberInfo.rank || memberInfo.role || 'member',
			vipLevel: memberInfo.vipLevel || null,
			lastOnline: new Date(memberInfo.lastOnlineTime || Date.now()),
			isOnline: memberInfo.isOnline || false,
			joinedAt: memberInfo.joinedAt ? new Date(memberInfo.joinedAt) : null,
			currentContribution: memberInfo.contribution || memberInfo.weeklyContribution || 0,
			totalContribution: memberInfo.totalContribution || memberInfo.lifetimeContribution || 0,
			arenaRank: memberInfo.arenaRank || null,
			grandArenaRank: memberInfo.grandArenaRank || null,
			titanArenaRank: memberInfo.titanArenaRank || null,
			prestige: memberInfo.prestige || 0,
			isActive: true,
			heroRoster: memberInfo.heroes ? JSON.stringify(memberInfo.heroes) : null,
			titanRoster: memberInfo.titans ? JSON.stringify(memberInfo.titans) : null,
		};

		guildMemberRecords.push(guildMember);
		snapshotRecords.push({
			timestamp: new Date(),
			playerId: guildMember.playerId,
			playerName: guildMember.playerName,
			guildId: guildId,
			level: guildMember.level,
			teamPower: guildMember.teamPower,
			guildRank: guildMember.guildRank,
			contribution: guildMember.currentContribution,
			totalContribution: guildMember.totalContribution,
			prestige: guildMember.prestige,
			isOnline: guildMember.isOnline,
			lastOnline: guildMember.lastOnline,
		});
	}

	return {
		guildId,
		guildName,
		memberCount: Object.keys(members).length,
		guildMemberRecords,
		snapshotRecords,
	};
}

/**
 * Persist guild roster and snapshots in batch operations.
 *
 * @param {Object} storage - storage adapter
 * @param {Object} payload - payload from buildGuildMemberSnapshotPayload
 */
export async function persistGuildMemberSnapshotPayload(storage, payload) {
	await storage.putBatch('guildMembers', payload.guildMemberRecords);
	await storage.addBatch('guildMemberSnapshots', payload.snapshotRecords);
}
