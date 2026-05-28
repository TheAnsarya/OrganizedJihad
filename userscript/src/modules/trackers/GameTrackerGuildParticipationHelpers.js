/**
 * GameTrackerGuildParticipationHelpers
 *
 * Normalization helpers for guild war/raid/dungeon participation payloads.
 */

/**
 * Build normalized guild war participation records.
 *
 * @param {Object} data - clanWarGetInfo/clanWarUserGetInfo response payload
 * @param {number} guildId - guild ID for participation rows
 * @returns {{participants: Object, records: Array<Object>}} normalized participants and records
 */
export function buildGuildWarParticipationRecords(data, guildId) {
	const warId = data.war.id || data.war.warId || String(Date.now());
	const warDate = new Date(data.war.startTime || data.war.date || Date.now());
	const participants = data.war.participants || {};
	const records = [];

	for (const [memberId, participantInfo] of Object.entries(participants)) {
		records.push({
			warId: warId,
			warDate: warDate,
			playerId: parseInt(memberId),
			playerName: participantInfo.name || 'Unknown',
			guildId: guildId,
			attacksMade: participantInfo.attacks || participantInfo.attackCount || 0,
			maxAttacks: participantInfo.maxAttacks || data.war.maxAttacks || 3,
			totalDamage: participantInfo.damage || participantInfo.totalDamage || 0,
			fortsDefended: participantInfo.fortsDefended || 0,
			defensePoints: participantInfo.defensePoints || 0,
			participated: (participantInfo.attacks || 0) > 0,
			warResult: data.war.result || null,
			attackDetails: participantInfo.attackLog ? JSON.stringify(participantInfo.attackLog) : null,
		});
	}

	return {
		participants,
		records,
	};
}

/**
 * Build normalized guild raid participation records plus titanite transaction intents.
 *
 * @param {Object} data - bossRaidGetInfo response payload
 * @param {number} guildId - guild ID for participation rows
 * @returns {{participants: Object, records: Array<Object>, titaniteTransactions: Array<Object>}} normalized records and transaction intents
 */
export function buildGuildRaidParticipationRecords(data, guildId) {
	const raidId = data.raid.id || data.raid.raidId || String(Date.now());
	const raidDate = new Date(data.raid.startTime || data.raid.date || Date.now());
	const bossName = data.raid.bossName || data.raid.bossType || 'unknown';
	const bossLevel = data.raid.bossLevel || data.raid.difficulty || 0;
	const participants = data.raid.participants || {};
	const records = [];
	const titaniteTransactions = [];

	for (const [memberId, participantInfo] of Object.entries(participants)) {
		const bossDamage = participantInfo.bossDamage || 0;
		const minionDamage = participantInfo.minionDamage || participantInfo.supportDamage || 0;
		const totalDamage = bossDamage + minionDamage;
		const titaniteEarned = participantInfo.titaniteEarned || participantInfo.reward?.titanite || 0;

		const participation = {
			raidId: raidId,
			raidDate: raidDate,
			playerId: parseInt(memberId),
			playerName: participantInfo.name || 'Unknown',
			guildId: guildId,
			bossName: bossName,
			bossLevel: bossLevel,
			bossDamage: bossDamage,
			minionDamage: minionDamage,
			totalDamage: totalDamage,
			attacksMade: participantInfo.attacks || participantInfo.attackCount || 0,
			maxAttacks: participantInfo.maxAttacks || data.raid.maxAttacks || 3,
			participated: totalDamage > 0,
			titaniteEarned: titaniteEarned,
			guildRank: data.raid.guildRank || null,
			attackDetails: participantInfo.attackLog ? JSON.stringify(participantInfo.attackLog) : null,
		};

		records.push(participation);

		if (participation.titaniteEarned > 0) {
			titaniteTransactions.push({
				playerId: participation.playerId,
				playerName: participation.playerName,
				guildId: guildId,
				transactionType: 'earned',
				amount: participation.titaniteEarned,
				source: 'raid',
				description: `${bossName} Level ${bossLevel}`,
			});
		}
	}

	return {
		participants,
		records,
		titaniteTransactions,
	};
}

/**
 * Build normalized guild dungeon participation records plus titanite transaction intents.
 *
 * @param {Object} data - dungeonGetState/titanDungeonGetInfo response payload
 * @param {number} guildId - guild ID for participation rows
 * @returns {{participants: Object, records: Array<Object>, titaniteTransactions: Array<Object>}} normalized records and transaction intents
 */
export function buildGuildDungeonParticipationRecords(data, guildId) {
	const dungeonId = data.dungeon.id || data.dungeon.dungeonId || String(Date.now());
	const dungeonDate = new Date(data.dungeon.startTime || data.dungeon.date || Date.now());
	const dungeonType = data.dungeon.type || data.dungeon.dungeonType || 'unknown';
	const participants = data.dungeon.participants || {};
	const records = [];
	const titaniteTransactions = [];

	for (const [memberId, participantInfo] of Object.entries(participants)) {
		const participation = {
			dungeonId: dungeonId,
			dungeonDate: dungeonDate,
			playerId: parseInt(memberId),
			playerName: participantInfo.name || 'Unknown',
			guildId: guildId,
			dungeonType: dungeonType,
			titanChargesUsed: participantInfo.chargesUsed || participantInfo.titanCharges || 0,
			maxTitanCharges: participantInfo.maxCharges || data.dungeon.maxCharges || 6,
			battlesFought: participantInfo.battles || participantInfo.battleCount || 0,
			totalDamage: participantInfo.damage || participantInfo.totalDamage || 0,
			highestStage: participantInfo.stage || participantInfo.maxStage || 0,
			participated: (participantInfo.chargesUsed || 0) > 0,
			titaniteEarned: participantInfo.titaniteEarned || participantInfo.reward?.titanite || 0,
			titanTeam: participantInfo.titanTeam ? JSON.stringify(participantInfo.titanTeam) : null,
		};

		records.push(participation);

		if (participation.titaniteEarned > 0) {
			titaniteTransactions.push({
				playerId: participation.playerId,
				playerName: participation.playerName,
				guildId: guildId,
				transactionType: 'earned',
				amount: participation.titaniteEarned,
				source: 'dungeon',
				description: `${dungeonType} Stage ${participation.highestStage}`,
			});
		}
	}

	return {
		participants,
		records,
		titaniteTransactions,
	};
}
