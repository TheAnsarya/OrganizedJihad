# Reference Code Research - Hero Wars Helper v3.3.3

**Date**: 2025-01-24
**Session**: HWH Reference Code Deep Dive for Phase 9
**Source**: `~reference-code/mbffmikhmagljbpojlampkojpbabdbbo/3.3.3_0/`

---

## Topic 1: Bottled Energy / Refillable Items

**Key Finding**: The game does NOT use "bottledEnergy" — it uses a **`refillable`** array on the player object.

### Data Structure

`userGetInfo` response includes `refillable` — an array of `{id, amount, lastRefill}` objects:

```js
// On login, refillable is explicitly stripped from stored userInfo:
userInfo = Object.assign({}, a);
delete userInfo.refillable;
```

### Known Refillable IDs

| ID | Name | Usage | Source |
|----|------|-------|--------|
| **1** | Campaign Energy (Stamina) | `refillable.find(e => 1 == e.id).amount` — checked against `3 * lib.data.mission[a].normalMode.teamExp` to determine if enough energy for missions | `hwh2.js` |
| **45** | Portal Spheres (Сферы портала) | `refillable.find(e => 45 == e.id)` — tracked via `setPortals()`, decremented on `adventure_start` | `hwh2.js` |
| **47** | Ascension Points | `e.find(e => 47 == e.id)?.amount` — used in `rollAscension()` | `hwh2.js` |
| **48** | Brawl Attempts | `e.results[0].result.response.refillable.find(e => 48 == e.id)` — brawl system | `hwh2.js` |
| **52** | Epic Brawl Attempts | `e[2].refillable.find(e => 52 == e.id)` — with `this.time = 1e3 * (t.lastRefill + 3600)` (1-hour refill timer) | `hwh2.js` |

### Refillable vs Stamina vs Consumable

- **`refillable`** = regenerating resources with `lastRefill` timestamps (energy, portal spheres, brawl attempts)
- **`stamina`** = mapped as a pseudo item: `{starmoney: 1, gold: 2, stamina: 4}[n]` with `n = "pseudo"`
- **`consumable`** = inventory items consumed on use (potions, keys, etc.) — SEPARATE category
- Refillable ID 45 is rendered as pseudo item: `"refillable" == n && 45 == t && (t = 14, n = "pseudo")`

### Mail Filtering

The `Letters` class filters mail rewards, skipping letters containing:
```js
return !(
	e?.refillable && e.refillable[45] ||  // Portal spheres
	e?.stamina && e.stamina ||              // Stamina
	!!e?.buff ||                            // Buffs
	e?.vipPoints && e.vipPoints ||          // VIP points
	!!e?.fragmentHero ||                    // Hero fragments
	!!e?.bundleHeroReward                   // Bundle hero rewards
);
```

---

## Topic 2: Quest Totals / Daily Quests

**Key Finding**: No hardcoded "quest total" or "max quests" constant exists. Quest counts are determined dynamically from the server response.

### API Calls

| Call | Purpose |
|------|---------|
| `questGetAll` | Returns all quests (daily + guild + battle pass + seasonal) |
| `questFarm` | Farms a single quest by ID: `{name: "questFarm", args: {questId: t.id}}` |
| `quest_questsFarm` | Farms multiple quests at once: `{name: "quest_questsFarm", args: {questIds: D}}` |
| `quest_completeEasterEggQuest` | Easter egg quest completion |

### Quest State System

```js
// Quest states:
// state 1 = in progress (can be auto-completed by dailyQuests class)
// state 2 = completable (ready to farm)
for (t of e)
	t.id < 1e6 && 2 == t.state  // Regular quests with state 2
```

### Quest ID Ranges

| Range | Type |
|-------|------|
| `< 1e6` (< 1,000,000) | Regular daily quests |
| `2e7 <= id < 2001e4` (20M-20.01M) | Guild quests (farmed via `quest_questsFarm`) |
| `2001e4 <= id < 14e8` | Battle Pass / Seasonal quests |
| `> 10046 && < 10051` | Activity quests (fillActive function checks `1750 - progress`) |

### Complete Daily Quest Catalog (from I18N strings)

| Quest ID | EN Description |
|----------|----------------|
| 10001 | Upgrade the skills of heroes 3 times |
| 10002 | Complete 10 missions |
| 10003 | Complete 3 heroic missions |
| 10004 | Fight 3 times in the Arena or Grand Arena |
| 10006 | Use the exchange of emeralds 1 time |
| 10007 | Perform 1 summon in the Soul Atrium |
| 10016 | Send gifts to guildmates |
| 10018 | Use an experience potion |
| 10019 | Open 1 chest in the Tower |
| 10020 | Open 3 chests in Outland |
| 10021 | Collect 75 Titanite in the Guild Dungeon |
| 10022 | Collect 150 Titanite in the Guild Dungeon |
| 10023 | Upgrade Gift of the Elements by 1 level |
| 10024 | Level up any artifact once |
| 10025 | Start Expedition 1 |
| 10026 | Start 4 Expeditions |
| 10027 | Win 1 battle of the Elemental Tournament |

### The `dailyQuests` Class

```js
class dailyQuests {
	callsList = [
		"userGetInfo", "heroGetAll", "titanGetAll",
		"inventoryGet", "questGetAll", "bossGetAll", "missionGetAll"
	];

	dataQuests = {
		10001: { description: "Улучши умения героев 3 раза", doItCall: () => {...} },
		10002: { description: "Пройди 10 миссий", isWeCanDo: () => false },
		10003: { description: "Пройди 3 героические миссии", isWeCanDo: () => false },
		10004: { /* Arena/Grand Arena fights */ },
		10006: { /* Emerald exchange */ },
		10007: { /* Soul Atrium summon */ },
		10016: { /* Send guild gifts */ },
		10018: { /* Experience potion */ },
		// ...
	};
}
```

### Farming Logic (`rewardsAndMailFarm`)

The comprehensive reward farming function:
1. Calls `questGetAll`, `mailGetAll`, `specialOffer_getAll`, `battlePass_getInfo`, `battlePass_getSpecial`
2. Filters quests where `state == 2` (completable)
3. Separates regular quests (< 1M) from guild quests (20M-20.01M)
4. Guild quests batched into `quest_questsFarm` call
5. Regular quests farmed individually via `questFarm`
6. Iteratively checks for newly-unlocked quests after each farm cycle

### Activity System

```js
// Guild activity cap is 2000 per day:
var a = 2e3 - s[2].stat.todayItemsActivity;
// Individual activity quest progress target is 1750:
s = e.find(e => 10046 < e.id && e.id < 10051);
if (s) t = 1750 - s.progress;
```

---

## Topic 3: Clash of Worlds (CoW) / Cross-Clan War API

**Key Finding**: The API prefix is **`crossClanWar_`** (NOT "cow_"). The game internally abbreviates it as "СМ" (ru) / "CoW" (en).

### API Calls

| Call | Purpose |
|------|---------|
| `crossClanWar_getInfo` | Get CoW status, war info, myTries, usedHeroes |
| `crossClanWar_getAttackMap` | Get attack map: enemySlots, targets, teams |
| `crossClanWar_getDefenceMap` | Get defence map |
| `crossClanWar_startBattle` | Start a CoW battle (args include `team.units`) |
| `crossClanWar_endBattle` | End a CoW battle |

### Handler Files

- **`lib/cow-get-info.js`**: Handles `crossClanWar_getInfo` response
- **`lib/cow-get-info-getAttackMap.js`**: Handles `crossClanWar_getAttackMap` response
- **`lib/cow-get-info-getDefenceMap.js`**: Handles `crossClanWar_getDefenceMap` response

### Data Flow

```js
// crossClanWar_getAttackMap response structure:
{
	enemySlots: { [slotId]: { user: {id, ...}, team: {...} } },
	targets: { [slotId]: { userId: attackerId } },
	ts: Date.now()
}

// crossClanWar_getInfo response structure:
{
	war: {
		myTries: {
			usedHeroes: [heroId1, heroId2, ...]  // heroes already used
		}
	}
}

// After starting a battle, used heroes are updated:
// crossClanWar_startBattle_handler:
let a = e.crossClanWar_getInfo;
let e = s.args.team.units;
if (e && e[0] < 1e3 && a && a.war && a.war.myTries)
	a.war.myTries.usedHeroes.push(...e);
```

### Notification Events

| Event Type | Notification Category | Description |
|------------|----------------------|-------------|
| `crossClanWar_attack` | CrossWarAttack | Position under attack |
| `crossClanWar_target` | CrossWarTarget | Target assigned/cancelled |
| `crossClanWar_endBattle` | CrossWarSuccessAttack / CrossWarFailedAttack / CrossWarFailedDefence / CrossWarSuccessDefence | Battle result |

### Position Names Map (CoW has 100 positions)

```js
positionNamesMapCrossEn = {
	1: "Mage 1", 2: "Mage 2", 3: "Mage 3", 4: "Mage 4",
	5: "Light 1", ..., 9: "Light 5",
	10: "Barr -1", 11: "Barr -2", 12: "Barr 1", ..., 14: "Barr 3",
	15: "Bridge 1", ..., 20: "Bridge 6",
	21: "Engin 1", ..., 25: "Engin 5",
	26: "Spring 1", ..., 29: "Spring 4",
	30: "Foundry 1", ..., 34: "Foundry 5",
	35: "Gates 1", ..., 38: "Gates 4",
	39: "Fire 1", ..., 42: "Fire 4",
	43: "Ice 1", ..., 46: "Ice 4",
	47: "Prism 1", ..., 51: "Prism 5",
	52: "Sh Range 1", ..., 56: "Sh Range 5",
	57: "Bastion 1", ..., 61: "Bastion 5",
	62: "Altar 1", ..., 66: "Altar 5",
	67: "BridgeH 1", ..., 72: "BridgeH 6",
	73: "Alchemy 1", ..., 77: "Alchemy 5",
	78: "CH 1", ..., 82: "CH 5",
	83: "Sun 1", ..., 86: "Sun 4",
	87: "Moon 1", ..., 90: "Moon 4",
	91: "Citadel 1", ..., 100: "Citadel 10"
};
```

### Guild War Position Names (40 positions)

```js
positionNamesMapEn = {
	1: "Mage 1", 2: "Mage 2",
	3: "Light 1", 4: "Light 2",
	5: "Barr 1", 6: "Barr 2",
	7: "Bridge 1", 8: "Bridge 2", 9: "Bridge 3",
	10: "Spring 1", 11: "Spring 2", 12: "Spring 3",
	13: "Foundry 1", 14: "Foundry 2", 15: "Foundry 3",
	16: "Gates 1", 17: "Gates 2", 18: "Gates 3",
	19: "Fire 1", 20: "Fire 2", 21: "Fire 3",
	22: "Ice 1", 23: "Ice 2", 24: "Ice 3",
	25: "Citadel 1", ..., 30: "Citadel 6",
	31: "Mage 3", 32: "Light 3", 33: "Barr 3",
	34: "Bridge 4", 35: "Spring 4", 36: "Foundry 4",
	37: "Gates 4", 38: "Fire 4", 39: "Ice 4", 40: "Citadel 7"
};
```

### Observable Data Streams (dist/main.js)

```
cow_can_attack$    — BehaviorSubject for CoW attack availability
gw_can_attack$     — BehaviorSubject for GW attack availability
crossWarInfo$      — crossClanWar_getInfo data
crossWarInfoAttackMap$ — crossClanWar_getAttackMap data
crossWarInfoDefenceMap$ — crossClanWar_getDefenceMap data
```

---

## Topic 4: Raid Boss Names

**Key Finding**: NO boss name mapping exists in the reference code. Bosses are referred to by numeric ID only. Names come from `lib.data` (game library data loaded at runtime).

### API Calls

| Call | Purpose |
|------|---------|
| `bossGetAll` | Returns array of bosses with `{id, mayRaid, chestId}` |
| `bossRaid` | Raids a boss: `{name: "bossRaid", args: {bossId: t.id}}` |
| `bossOpenChest` | Opens boss chest: `{name: "bossOpenChest", args: {bossId: t.id, amount: 1, starmoney: 0}}` |
| `bossAttack` | Attacks a boss (Outland battles) |
| `clanRaid_startBossBattle` | Start clan raid boss battle |
| `clanRaid_endBossBattle` | End clan raid boss battle (returns `{damage, result}`) |
| `clanRaid_logBoss` | Get clan raid boss replays |
| `clanRaid_logNodes` | Get clan raid node replays |
| `clanRaid_logStats` | Get clan raid stats |
| `clanRaid_getInfo` | Get clan raid info |

### Outland Boss Collection Logic

```js
// getOutland() iterates bossGetAll response:
for (const t of boss_response) {
	if (1 == t.mayRaid)
		s.calls.push({
			name: "bossRaid", args: {bossId: t.id}, ident: "bossRaid_" + t.id
		});
	else if (1 == t.chestId)
		s.calls.push({
			name: "bossOpenChest", args: {bossId: t.id, amount: 1, starmoney: 0},
			ident: "bossOpenChest_" + t.id
		});
}
```

### Clan Raid Boss Battle Damage Tracking

```js
// On battleGetReplay for clan_raid type:
if (b.ident == callsIdent.battleGetReplay
	&& "clan_raid" === b.result.response.replay.type
	&& b?.result?.response?.replay?.result?.damage) {
	const D = Object.values(b.result.response.replay.result.damage);
	const P = D.reduce((e, t) => e + t, 0);
	setProgress(I18N("BOSS_DAMAGE") + P.toLocaleString());
}

// On clanRaid_endBossBattle:
const V = Object.values(b.result.response.damage).reduce((e, t) => e + t);
b.result.response.result.afterInvalid && addProgress("<br>" + I18N("SERVER_NOT_ACCEPT"));
addProgress("<br>Server > " + I18N("BOSS_DAMAGE") + V.toLocaleString());
```

### Invasion Boss (Event Boss)

```js
// The invasion system has bossLvl tracking:
const { invasionInfo: Q, invasionDataPacks: q } = HWHData;
Q.buff = L.amount;
R = q[Q.bossLvl]; // Data pack for specific boss level
// I18N: "INVASION_BOSS_BUFF": "For {bossLvl} boss need buff {needBuff} you have {haveBuff}"
```

### Clan Raid Handlers (background.js)

- `clanRaidBossReplaysHandler` — handles `clanRaid_logBoss` → stores replays in `db.other_replays`
- `clanRaidPreReplaysHandler` — handles `clanRaid_logNodes` → stores with `type: "clan_raid_pre"`
- `clanRaidStatsHandler` — handles `clanRaid_logStats` → stores stats

---

## Topic 5: Guild War Attacks Per Day

**Key Finding**: The maximum number of attacks is **NOT hardcoded** — it comes from the server via `clanWarGetInfo` response as `myTries`. The HWH code only tracks/displays the count.

### API Call

```js
// justInfo() function calls clanWarGetInfo:
const s = (await Send(JSON.stringify({
	calls: [
		{name: "userGetInfo", args: {}, ident: "userGetInfo"},
		{name: "clanWarGetInfo", args: {}, ident: "clanWarGetInfo"},
		{name: "titanArenaGetStatus", args: {}, ident: "titanArenaGetStatus"},
		{name: "quest_completeEasterEggQuest", args: {}, ident: "quest_completeEasterEggQuest"}
	]
}))).results;

var a = s[1].result.response?.myTries ?? 0;     // Remaining attack tries
var r = s[1].result.response?.arePointsMax;      // Whether max points reached
setWarTries(a, false, r);
```

### War Tries UI Tracking

```js
function setWarTries(e = 0, t = false, s = false) {
	var n = HWHData["buttons"];
	const a = n.goToClanWar.button;
	const r = a.querySelector(".scriptMenu_dot");
	e = t ? Math.max(+r.innerText + e, 0) : e;
	if (e && !s) {  // s = arePointsMax
		a.classList.add("scriptMenu_attention");
		r.title = e + " " + I18N("ATTEMPTS");
		r.innerText = e;
		r.style.backgroundColor = "red";
	} else {
		a.classList.remove("scriptMenu_attention");
		r.innerText = 0;
	}
}
```

### War Attack Decrement

```js
// After each war battle ends:
if (b.ident == callsIdent.clanWarEndBattle)
	setWarTries(-1, true);  // Decrement by 1
```

### CoW Used Heroes Tracking

```js
// CoW tracks used heroes via crossClanWar_getInfo.war.myTries.usedHeroes
// On crossClanWar_startBattle, the handler pushes hero IDs:
if (e && e[0] < 1e3 && a.war && a.war.myTries && a.war.myTries.usedHeroes.length >= 0)
	a.war.myTries.usedHeroes.push(...e);
```

### Observable Flags

- `cow_can_attack` — stored/tracked flag for CoW attack availability
- `gw_can_attack` — stored/tracked flag for GW attack availability

---

## Topic 6: Consumable Item IDs

**Key Finding**: Consumables are accessed via `inventoryGet` response under `.consumable` — an object keyed by numeric ID.

### Known Consumable IDs

| ID | Name / Purpose | Source |
|----|----------------|--------|
| **2** | Clan Activity Reward (Green Rune) | `ClanActivity2` notification: `letter.reward.consumable[2]` |
| **3** | Clan Activity Reward (Blue Rune) | `ClanActivity3` notification: `letter.reward.consumable[3]` |
| **4** | Clan Activity Reward (Purple Rune) | `ClanActivity4` notification: `letter.reward.consumable[4]` |
| **9-12** | Experience Potions (Tiers 1-4) | `for (let e = 9; e <= 12; e++) if (t.consumable[e]) { s.libId = e; break }` |
| **22** | BATTLE_PASS_EXP_3 | dist/main.js inventory mapping |
| **23** | CLAN_RAID_TRASH_LEVELS | dist/main.js inventory mapping |
| **24** | CLAN_RAID_MORALE (Titan Gift / Morale) | `t.consumable[24]` used in `getHeroIdTitanGift()` |
| **25** | BATTLE_PASS_GOLD_TICKET | dist/main.js inventory mapping |
| **26** | CLAN_RAID_BOSS_ATTACK_ATTEMPTS | dist/main.js inventory mapping |
| **27** | BATTLE_PASS_EXP_4 | dist/main.js inventory mapping |
| **28** | BRAWLS | dist/main.js inventory mapping |
| **29** | BATTLE_PASS_EXP_5 | dist/main.js inventory mapping |
| **30** | BATTLE_PASS_EXP_6 | dist/main.js inventory mapping |
| **45** | Artifact Chest Keys | `cheats.updateInventory({consumable: {[H]: -(w-G)}})` where `H = "artifactChestOpen" == q.name ? 45 : 55` |
| **55** | Titan Artifact Chest Keys | See above |
| **81** | Prediction Cards (Карты предсказаний) | `HWHData.countPredictionCard = b.result.response.consumable[81] || 0` |
| **148** | Russian Dolls (recursive loot box) | `lastRussianDollId` reference |
| **362-389** | Equipment Fragment Boxes | `362 <= q.args.libId && q.args.libId <= 389` |

### API Calls for Consumables

| Call | Purpose |
|------|---------|
| `inventoryGet` | Returns full inventory including `.consumable` object |
| `consumableUseLootBox` | Opens loot boxes: `{name: "consumableUseLootBox", args: {libId: d, amount: p}}` |

### Item Type Category Map (from dist/main.js)

```js
{
	1: "coin",
	2: "pseudo",
	3: "refillable",
	4: "consumable",
	5: "creep_icons",
	8: "scroll_icons",
	9: "quest_icons"
}
```

### Consumable Tracking in Response Handlers

```js
// inventoryGet response tracking:
if (b.ident == callsIdent.inventoryGet)
	HWHData.countPredictionCard = b.result.response.consumable[81] || 0;

// questFarm response tracking:
if (b.ident != callsIdent.questFarm || (l = b.result.response?.consumable))
	l[81] && (HWHData.countPredictionCard += l[81]);

// mailFarm response tracking (per letter):
K.consumable?.[81] && HWHData.countPredictionCard += K.consumable[81];
K.refillable?.[45] && setPortals(+K.refillable[45], true);

// quest_questsFarm response tracking (per reward):
X.consumable?.[81] && HWHData.countPredictionCard += X.consumable[81];
X.refillable?.[45] && setPortals(+X.refillable[45], true);
```

### Equipment Box Auto-Open

```js
// Auto-opens equipment boxes (IDs 362-389):
for ([d, p] of S)
	d != this.massOpen && 362 <= d && d <= 389 && (
		x.push({name: "consumableUseLootBox", args: {libId: d, amount: p}, ident: "consumableUseLootBox_" + d}),
		H[d] = -p
	);
```

### Library Data Access

Consumable item details are in `lib.data.inventoryItem.consumable[id]` with properties like `effectDescription.playerChoiceType`.

---

## Bonus: Complete Battle Type Ident List

From the response handler, all battle-type callsIdents tracked:

```
callsIdent.clanWarAttack
callsIdent.crossClanWar_startBattle
callsIdent.bossAttack
callsIdent.battleGetReplay
callsIdent.brawl_startBattle
callsIdent.adventureSolo_turnStartBattle
callsIdent.invasion_bossStart
callsIdent.titanArenaStartBattle
callsIdent.towerStartBattle
callsIdent.epicBrawl_startBattle
callsIdent.adventure_turnStartBattle
```

End-battle calls:
```
adventure_endBattle
adventureSolo_endBattle
clanWarEndBattle
crossClanWar_endBattle
brawl_endBattle
towerEndBattle
invasion_bossEnd
titanArenaEndBattle
bossEndBattle
clanRaid_endNodeBattle
epicBrawl_endBattle
```

---

## Summary for OJ Implementation

1. **Energy/Refillable**: Track the `refillable` array from `userGetInfo`. Key IDs: 1 (energy), 45 (portals), 47 (ascension), 48 (brawl), 52 (epic brawl).
2. **Quests**: Use `questGetAll` to get all quests. State 2 = completable. Regular quests < 1M, guild quests 20M-20.01M range. ~17 known daily quest IDs.
3. **CoW**: All API calls use `crossClanWar_` prefix. 100 positions on the map. Track `war.myTries.usedHeroes` for hero usage.
4. **Raid Bosses**: No name mapping in HWH code — boss names come from `lib.data` loaded at runtime. Use `bossGetAll` for Outland bosses, `clanRaid_*` calls for clan raid.
5. **GW Attacks**: `clanWarGetInfo` response has `myTries` (remaining) and `arePointsMax` (cap reached). NOT hardcoded.
6. **Consumables**: Numeric IDs as keys in `inventoryGet.consumable`. Key IDs: 9-12 (exp potions), 24 (morale), 45/55 (artifact keys), 81 (prediction cards), 362-389 (equipment boxes).

---

## Files Modified

- Created: `~docs/copilot-chats/2025-01-24-reference-code-research.md` (this file)

## Issues Referenced

- Feeds into Phase 9 Comprehensive Enhancement planning
