# Hero Wars API Call Reference — Userscript Edition

> **Auto-generated**: 2026-02-27
> **Source**: `hw-api-samples-2026-02-27.json` (112 methods captured)
> **Branch**: `api-backend-creation`
>
> Documents every API call the OrganizedJihad userscript intercepts, the response
> structure, where data is stored (IndexedDB / metadata), and which UI component
> consumes it.

---

## Table of Contents

- [Hero Wars API Call Reference — Userscript Edition](#hero-wars-api-call-reference--userscript-edition)
	- [Table of Contents](#table-of-contents)
	- [Legend](#legend)
	- [1. Player \& Roster](#1-player--roster)
		- [1.1 `userGetInfo`](#11-usergetinfo)
		- [1.2 `heroGetAll`](#12-herogetall)
		- [1.3 `inventoryGet`](#13-inventoryget)
		- [1.4 `titanGetAll`](#14-titangetall)
		- [1.5 `pet_getAll`](#15-pet_getall)
	- [2. Quests \& Daily Activities](#2-quests--daily-activities)
		- [2.1 `questGetAll`](#21-questgetall)
		- [2.2 `questComplete`](#22-questcomplete)
		- [2.3 `questFarm`](#23-questfarm)
		- [2.4 `quest_questsFarm`](#24-quest_questsfarm)
		- [2.5 `dailyBonusFarm`](#25-dailybonusfarm)
		- [2.6 `dailyBonusGetInfo`](#26-dailybonusgetinfo)
	- [3. Arena \& PvP Battles](#3-arena--pvp-battles)
		- [3.1 `arenaGetEnemies` / `arenaFindEnemies`](#31-arenagetenemies--arenafindenemies)
		- [3.2 `arenaAttack` / `arenaEnd`](#32-arenaattack--arenaend)
		- [3.3 `arenaGetReplay`](#33-arenagetreplay)
		- [3.4 `grandArenaGetEnemies`](#34-grandarenagetenemies)
		- [3.5 `grandArenaAttack` / `grandArenaEnd`](#35-grandarenaattack--grandarenaend)
		- [3.6 `grandGetReplay`](#36-grandgetreplay)
		- [3.7 `titanArenaGetEnemies`](#37-titanarenagetenemies)
		- [3.8 `titanArenaAttack` / `titanArenaEnd`](#38-titanarenaattack--titanarenaend)
		- [3.9 `battleGetReplay`](#39-battlegetreplay)
	- [4. PvE Battles](#4-pve-battles)
		- [4.1 `missionEnd`](#41-missionend)
		- [4.2 `towerEnd`](#42-towerend)
		- [4.3 `bossEnd`](#43-bossend)
		- [4.4 `adventureEnd`](#44-adventureend)
		- [4.5 `expeditionGetState`](#45-expeditiongetstate)
		- [4.6 `expeditionBattle`](#46-expeditionbattle)
		- [4.7 `dungeonBattle` / `dungeonEnd`](#47-dungeonbattle--dungeonend)
		- [4.8 `titanDungeonBattle` / `titanDungeonEnd`](#48-titandungeonbattle--titandungeonend)
		- [4.9 `clanDungeonBattle`](#49-clandungeonbattle)
		- [4.10 `towerGetState`](#410-towergetstate)
		- [4.11 `adventureGetAll`](#411-adventuregetall)
	- [5. Guild \& Clan](#5-guild--clan)
		- [5.1 `clanGetInfo`](#51-clangetinfo)
		- [5.2 `clanWarGetInfo` / `clanWarUserGetInfo`](#52-clanwargetinfo--clanwarusergetinfo)
		- [5.3 `clanWarGetBriefInfo`](#53-clanwargetbriefinfo)
		- [5.4 `clanWarAttack`](#54-clanwarattack)
		- [5.5 `clanWarGetBattleResults`](#55-clanwargetbattleresults)
		- [5.6 `crossClanWar_getInfo`](#56-crossclanwar_getinfo)
		- [5.7 `clanRaid_getInfo`](#57-clanraid_getinfo)
		- [5.8 `bossRaidAttack`](#58-bossraidattack)
		- [5.9 `dungeonGetState` / `titanDungeonGetInfo`](#59-dungeongetstate--titandungeongetinfo)
	- [6. Chat \& Mail](#6-chat--mail)
		- [6.1 `chatGetDialog` / `chatGetNewMessages`](#61-chatgetdialog--chatgetnewmessages)
		- [6.2 `chatSendMessage`](#62-chatsendmessage)
		- [6.3 `mailGetAll`](#63-mailgetall)
		- [6.4 `mailFarm` / `mailCollect`](#64-mailfarm--mailcollect)
	- [7. Chests \& Loot](#7-chests--loot)
		- [7.1 `chestOpen`](#71-chestopen)
		- [7.2 `artifactChestOpen`](#72-artifactchestopen)
		- [7.3 `titanArtifactChestOpen`](#73-titanartifactchestopen)
		- [7.4 `pet_chestOpen`](#74-pet_chestopen)
		- [7.5 `consumableUseLootBox`](#75-consumableuselootbox)
		- [7.6 `towerOpenChest`](#76-toweropenchest)
		- [7.7 `bossOpenChest`](#77-bossopenchest)
		- [7.8 `skinChestOpen`](#78-skinchestopen)
		- [7.9 `runeChestOpen`](#79-runechestopen)
		- [7.10 `gachaOpen`](#710-gachaopen)
		- [7.11 `shopBuy`](#711-shopbuy)
	- [8. Hero Upgrades](#8-hero-upgrades)
		- [8.1 `heroUpgradeSkill`](#81-heroupgradeskill)
		- [8.2 `heroArtifactLevelUp`](#82-heroartifactlevelup)
		- [8.3 `heroSkinUpgrade`](#83-heroskinupgrade)
		- [8.4 `heroEnchantRune`](#84-heroenchantrune)
		- [8.5 `consumableUseHeroXp`](#85-consumableuseheroxp)
		- [8.6 `heroLevelUp`](#86-herolevelup)
		- [8.7 `heroEvolve` / `heroPromote`](#87-heroevolve--heropromote)
		- [8.8 `heroColorEvolve`](#88-herocolorevolve)
		- [8.9 `heroEquip`](#89-heroequip)
		- [8.10 `heroAscension`](#810-heroascension)
		- [8.11 `heroAbsoluteStarMission`](#811-heroabsolutestarmission)
		- [8.12 `heroGiftOfElements`](#812-herogiftofelements)
	- [9. Titan Upgrades](#9-titan-upgrades)
		- [9.1 `titanArtifactLevelUp`](#91-titanartifactlevelup)
		- [9.2 `titanUsePotions`](#92-titanusepotions)
		- [9.3 `titanEvolve` / `titanStarUp`](#93-titanevolve--titanstarup)
		- [9.4 `titanUpgradeSkill`](#94-titanupgradeskill)
		- [9.5 `titanSkinUpgrade`](#95-titanskinupgrade)
		- [9.6 `titanEnchantRune`](#96-titanenchantrune)
		- [9.7 `titanSpiritUpgrade`](#97-titanspiritupgrade)
	- [10. Pet Upgrades](#10-pet-upgrades)
		- [10.1 `pet_levelUp`](#101-pet_levelup)
		- [10.2 `pet_evolve`](#102-pet_evolve)
	- [11. Economy \& Shopping](#11-economy--shopping)
		- [11.1 `offerBuy`](#111-offerbuy)
		- [11.2 `campaignFarm` / `missionFarm`](#112-campaignfarm--missionfarm)
		- [11.3 `seerFarm`](#113-seerfarm)
	- [12. Social](#12-social)
		- [12.1 Friend Gifts \& Hearts](#121-friend-gifts--hearts)
	- [13. Events \& Seasons](#13-events--seasons)
		- [13.1 `eventGetInfo` / `eventGetAll`](#131-eventgetinfo--eventgetall)
		- [13.2 `eventFarm`](#132-eventfarm)
		- [13.3 `seasonGetInfo` / `seasonGetAll`](#133-seasongetinfo--seasongetall)
		- [13.4 `seasonFarm`](#134-seasonfarm)
	- [14. Special Battle Modes](#14-special-battle-modes)
		- [14.1 Clash of Worlds Battles](#141-clash-of-worlds-battles)
		- [14.2 Tournament of Elements](#142-tournament-of-elements)
	- [15. Unhandled but Captured Methods](#15-unhandled-but-captured-methods)
		- [Account / Settings](#account--settings)
		- [Arena / Rankings](#arena--rankings)
		- [Guild Extended](#guild-extended)
		- [Cross-Server War](#cross-server-war)
		- [Shopping / Economy](#shopping--economy)
		- [Game Data](#game-data)
		- [Titans Extended](#titans-extended)
		- [Events / Season](#events--season)
		- [Social / Chat](#social--chat)
		- [Misc](#misc)
	- [Appendix A: IndexedDB Object Stores](#appendix-a-indexeddb-object-stores)
	- [Appendix B: Metadata Keys](#appendix-b-metadata-keys)
	- [Appendix C: Data Flow Diagram](#appendix-c-data-flow-diagram)

---

## Legend

| Symbol | Meaning |
|--------|---------|
| **IDB** | IndexedDB object store |
| **Meta** | `metadata` store (key-value) |
| **UI** | Dashboard / tab that displays this data |
| **Cat** | Handler category (used for grouping/filtering) |
| `→` | "writes to" |

---

## 1. Player & Roster

### 1.1 `userGetInfo`

| | |
|---|---|
| **Handler** | `trackPlayerData` |
| **Category** | `player` |
| **Fires when** | Nearly every API batch (most frequent call) |
| **Dedup** | Fingerprint on `userId`, `level`, `vipLevel`, `power`, `gold`, `starMoney`, `currentEnergy`, `bottledEnergy`, `clanId`, arena ranks |

**Response shape** (30 keys):

```
{
  id: "49712971",             // string — player ID
  name: "Wayness",            // string — display name
  level: "130",               // string
  gold: 7053188,              // number
  starMoney: 24439,           // number — emeralds
  vipPoints: "449745",        // string
  clanId: "307990",           // string
  clanRole: "4",              // string (1=member, 2=officer, 3=general, 4=leader)
  serverId: "338",            // string
  refillable: [               // Array[59] — energy/resources
    { id: 1, amount: 120, lastRefill: 1772152049, boughtToday: 0 },  // ← campaign energy
    { id: 5, amount: 5, ... },   // ← arena attempts
    { id: 49, amount: 30, ... }, // ← bottled energy
    ...
  ],
  maxSumPower: {
    heroes: 5563997,
    titans: 2880393,
    pets: 1314781
  },
  experience: "0",
  maxLevel: 130,
  nextDayTs: ...,             // unix timestamp — server day rollover
  nextServerDayTs: ...,
  registrationTime: "...",
  // ... plus avatarId, frameId, leagueId, flags, tutorialStep, etc.
}
```

**Key `refillable` IDs** (confirmed from samples):

| ID | Resource |
|----|----------|
| 1 | Campaign energy (stamina) |
| 5 | Arena attempts |
| 49 | Bottled energy |

> More IDs exist (56 entries) — need further mapping.

**Storage**:

| Target | Data |
|--------|------|
| → **IDB** `snapshots` | Full player snapshot: `playerId`, `playerName`, `level`, `vipLevel`, `teamPower`, `gold`, `emeralds`, `stamina`, `bottledEnergy`, `guildName`, `guildId`, `arenaRank`, `grandArenaRank`, `titanArenaRank`, `timestamp`, `rawData` |
| → **Meta** `playerData` | `{ player: {id, name, level}, gold, starMoney, emeralds, stamina, bottledEnergy, clanId, clanTitle, vipLevel, power }` |
| → **Meta** `currentPlayerId` | Player ID string |

**UI consumers**:

| Component | Reads | Displays |
|-----------|-------|----------|
| Dashboard player header | Meta `playerData` + IDB `snapshots` (latest) | Name, level, guild, Gold (SVG coin), Emeralds (SVG gem), Energy (SVG bolt + bottled count) |
| Dashboard status | `snapshots` count | Last snapshot time |
| All tracker methods | Meta `currentPlayerId` | Used internally for playerId |

---

### 1.2 `heroGetAll`

| | |
|---|---|
| **Handler** | `trackHeroesData` |
| **Category** | `player` |
| **Depends on** | `userGetInfo` (needs playerId) |
| **Dedup** | Fingerprint on all hero IDs + level/star/color/power/skills/runes/skins/artifacts |

**Response shape**: Object keyed by hero ID (71 entries):

```
{
  "1": {
    id: 1,
    level: 130,
    star: 6,
    color: 15,                    // promotion tier (white=1..orange+4=15)
    power: 71234,
    xp: 3625195,
    skills: { "2": 130, "3": 130, "4": 130, "5": 130 },  // skillId → level
    artifacts: [
      { level: 65, star: 4 },    // weapon
      { level: 65, star: 4 },    // book
      { level: 65, star: 4 },    // ring
    ],
    runes: [8260, 5900, 5890, 5300, 6480],  // 5 glyph levels
    skins: { "1": 47, "154": 20, "325": 26 },  // skinId → level
    currentSkin: 154,
    titanGiftLevel: 30,
    slots: [1, 1, 1, 1, 1, 1],   // equipment slots (0=empty, 1=equipped)
    petId: 0,                     // 0 = no pet assigned
    ascensions: { "1": [0,1,2,...] },  // tier → unlocked nodes
    perks: [4],
    scale: 1,
    type: "hero",
  },
  "2": { ... },
  ...
}
```

**Storage**:

| Target | Data |
|--------|------|
| → **IDB** `heroes` | Per-hero record: `heroId`, `heroName`, `level`, `stars`, `color`, `power`, `skins` (count), `skillLevel1-4`, `artifactWeaponLevel/Star`, `artifactBookLevel/Star`, `artifactRingLevel/Star`, `glyphLevels` (JSON), `skinLevels` (JSON), `ascensionData` (JSON), `equipped` (count), `playerId`, `timestamp`, `rawData` |

**UI consumers**:

| Component | Reads | Displays |
|-----------|-------|----------|
| Dashboard hero bar | `_calcAverageHeroCompletion()` → IDB `heroes` | Avg completion % with progress bar |
| Heroes tab | IDB `heroes` (all records) | Full hero roster table with sortable columns, completion %, gear levels |

---

### 1.3 `inventoryGet`

| | |
|---|---|
| **Handler** | `trackInventoryData` |
| **Category** | `player` |
| **Depends on** | `userGetInfo` |

**Response shape**: Object with 14 category dictionaries:

```
{
  consumable: { "1": 415, "2": 476, ... },      // 66 items — potions, boosters
  gear: { "1": 55, "2": 30, ... },              // 68 items — equipment
  scroll: { "1": 20, ... },                      // 26 items
  coin: { "1": 5000, "4": 100, ... },           // 30 items — currency tokens
  fragmentGear: { ... },                          // 47 items — gear crafting mats
  fragmentScroll: { ... },                        // 52 items
  ascensionGear: { ... },                         // 23 items
  fragmentTitanArtifact: { ... },                 // 35 items
  bannerStone: { ... },                           // 10 items
  fragmentPet: { ... },                           // 8 pet soul stones
  petGear: { ... },                               // 8 pet equipment
  fragmentArtifact: { ... },                      // 55 artifact fragments
  fragmentHero: { ... },                          // 3 hero soul stones
  fragmentTitan: { ... },                         // 4 titan soul stones
}
```

**Storage**:

| Target | Data |
|--------|------|
| → **IDB** `inventory` | Full inventory snapshot: `playerId`, `timestamp`, `rawData` (entire response JSON), per-category counts |

**UI consumers**:

| Component | Reads | Displays |
|-----------|-------|----------|
| Resources tab | IDB `inventory` + `resourceTransactions` | Item counts, category breakdowns |

---

### 1.4 `titanGetAll`

| | |
|---|---|
| **Handler** | `trackTitansData` |
| **Category** | `player` |

**Response shape**: Object keyed by titan ID (23 entries):

```
{
  "4000": {
    id: 4000,
    level: 120,
    star: 6,
    power: 108610,
    xp: 686760,
    skills: { "4001": 120 },           // skillId → level
    artifacts: [
      { level: 90, star: 5 },          // seal
      { level: 90, star: 5 },          // weapon
      { level: 90, star: 5 },          // book
    ],
    skins: { "10001": 21, "10013": 23 },
    currentSkin: 10013,
    scale: 0.8,
    type: "titan",
    perks: [4],
  },
  ...
}
```

**Storage**: → **IDB** `titans` (per-titan snapshot records, same pattern as heroes)

**UI consumers**: Dashboard titan bar, Titans tab (roster table with completion %)

---

### 1.5 `pet_getAll`

| | |
|---|---|
| **Handler** | `trackPetsData` |
| **Category** | `player` |

**Response shape**: Array of 10 pet objects:

```
[
  {
    id: 6001,
    level: 130,
    star: 5,
    color: 10,
    power: 171933,
    xp: 450551,
    skills: { "6005": 130, "6006": 130 },
    slots: [25, 25, 50, 25, 25, 7],    // 6 gear slot levels
    type: "pet",
    perks: [5, 2],
    name: null,                          // custom name (null if unset)
  },
  ...
]
```

**Storage**: → **IDB** `pets` (per-pet snapshot records)

**UI consumers**: Dashboard pet bar, referenced in hero patronage data

---

## 2. Quests & Daily Activities

### 2.1 `questGetAll`

| | |
|---|---|
| **Handler** | `trackQuestsData` |
| **Category** | `quests` |
| **Fires when** | Game loads, quest screen opened |

**Response shape**: Array of ~429 quest objects:

```
[
  {
    id: 785,                    // quest ID
    state: 1,                   // 1=in-progress, 2=completed
    progress: 0,
    reward: { starmoney: 50 },  // or { consumable: {"164": "1"} }
    createTime: 1719284834,     // unix timestamp
    farmCount: 0,
    order: 3,                   // optional (guild quests)
    rewardSorting: [...],       // optional
  },
  ...
]
```

**Quest ID ranges** (determined from sample data):

| Range | Type | Example |
|-------|------|---------|
| 10001–10999 | Daily quests | Standard daily tasks |
| 20000xxx | Guild quests | reward contains `clanQuestsPoints`, has `order` field |
| 11xxx | Clan Raid quests | Special raid tasks |
| 1797xxxxxx+ | Battle Pass quests | reward has `battlePassExp` |

**Storage**:

| Target | Data |
|--------|------|
| → **Meta** `questSummary` | `{ dailyTotal, dailyCompleted, guildTotal, guildCompleted }` |

**UI consumers**:

| Component | Reads | Displays |
|-----------|-------|----------|
| Dashboard "Daily Quests" card | Meta `questSummary` | `X/Y` format (completed/total) |
| Dashboard "Guild Quests" card | Meta `questSummary` | `X/Y` format |

---

### 2.2 `questComplete`

| | |
|---|---|
| **Handler** | `trackQuestComplete` |
| **Category** | `quests` |
| **Fires when** | Player manually completes a quest |

**Request args**: `{ questId }` — the quest being completed

**Storage**: → **IDB** `questCompletions` (individual completion record)

---

### 2.3 `questFarm`

| | |
|---|---|
| **Handler** | `trackDailyQuestFarm` |
| **Category** | `quests` |
| **Fires when** | Player collects daily quest reward |

**Storage**: → **IDB** `dailyQuestCompletions`

---

### 2.4 `quest_questsFarm`

| | |
|---|---|
| **Handler** | `trackBatchQuestFarm` |
| **Category** | `quests` |
| **Fires when** | Player batch-collects multiple quest rewards |

**Storage**: → **IDB** `dailyQuestCompletions` (multiple records)

---

### 2.5 `dailyBonusFarm`

| | |
|---|---|
| **Handler** | `trackLoginReward` |
| **Category** | `quests` |
| **Fires when** | Player claims daily login reward |

**Storage**: → **IDB** `loginRewards`

---

### 2.6 `dailyBonusGetInfo`

| | |
|---|---|
| **Handler** | `trackDailyBonusInfo` |
| **Category** | `quests` |
| **Fires when** | Login reward screen loads |

**Response shape**:

```
{
  year: "2026",
  month: 2,
  currentDay: "26",
  availableToday: false,     // can claim today?
  availableVip: false,       // VIP bonus available?
  daysInMonth: 28,
  heroId: 70,                // monthly login hero reward ID
}
```

**Storage**: → **Meta** (daily bonus info cached)

---

## 3. Arena & PvP Battles

### 3.1 `arenaGetEnemies` / `arenaFindEnemies`

| | |
|---|---|
| **Handler** | `trackArenaEnemies` |
| **Category** | `battles` |
| **Fires when** | Arena opponent list loads or refreshes |

**`arenaFindEnemies` response** — Array of 3 opponents:

```
[
  {
    userId: "12345678",
    place: "42",                    // arena rank
    power: "850000",
    heroes: [
      { id: 54, level: 130, color: 15, star: 6 },
      // ... up to 6 heroes
    ],
    banners: [{ id: 1, slots: {...} }],
    user: {
      id: "12345678",
      name: "OpponentName",
      level: 130,
      clanId: "...",
      clanTitle: "...",
      // ... full user profile
    },
  },
  ...
]
```

**Storage**: → **IDB** `opponents` (upserts opponent data by `opponentId`)

**UI consumers**: Battles tab (arena opponent history)

---

### 3.2 `arenaAttack` / `arenaEnd`

| | |
|---|---|
| **Handler** | `trackArenaBattle` |
| **Category** | `battles` |
| **Fires when** | Arena attack initiated / battle completes |

**Storage**: → **IDB** `battles` (battleType: `'Arena'`)

**UI consumers**: Dashboard win rate cards, Battles tab arena section

---

### 3.3 `arenaGetReplay`

| | |
|---|---|
| **Handler** | `trackArenaReplay` |
| **Category** | `battles` |
| **Fires when** | Player views arena defense log replay |

**Storage**: → **IDB** `battles` (replay data attached)

---

### 3.4 `grandArenaGetEnemies`

| | |
|---|---|
| **Handler** | `trackGrandArenaEnemies` |
| **Category** | `battles` |

**Storage**: → **IDB** `opponents`

---

### 3.5 `grandArenaAttack` / `grandArenaEnd`

| | |
|---|---|
| **Handler** | `trackGrandArenaBattle` |
| **Category** | `battles` |
| **Fires when** | Grand Arena battle starts / completes |

**Storage**: → **IDB** `battles` (battleType: `'GrandArena'`)

**UI consumers**: Dashboard win rate cards, Battles tab

---

### 3.6 `grandGetReplay`

| | |
|---|---|
| **Handler** | `trackArenaReplay` (reused) |
| **Category** | `battles` |

**Storage**: → **IDB** `battles`

---

### 3.7 `titanArenaGetEnemies`

| | |
|---|---|
| **Handler** | `trackTitanArenaEnemies` |
| **Category** | `battles` |

**`titanArenaGetStatus` response** (includes rivals):

```
{
  rank: 18506,
  tier: "7",
  status: "battle",
  dailyScore: 16562,
  weeklyScore: 66406,
  defenders: { "4013": ..., "4030": ... },
  rivals: {
    "userId": {
      userId: "...",
      power: ...,
      titans: {
        "4001": { id, level, star, skills, power, artifacts, skins, ... },
        ...
      }
    },
    ...  // 9 rivals
  },
  canRaid: ...,
  maxTier: 7,
}
```

**Storage**: → **IDB** `opponents`

---

### 3.8 `titanArenaAttack` / `titanArenaEnd`

| | |
|---|---|
| **Handler** | `trackTitanArenaBattle` |
| **Category** | `battles` |

**Storage**: → **IDB** `battles` (battleType: `'TitanArena'`)

**UI consumers**: Dashboard win rate cards, Battles tab

---

### 3.9 `battleGetReplay`

| | |
|---|---|
| **Handler** | `trackBattleGetReplay` (smart router) |
| **Category** | `battles` |
| **Fires when** | Generic replay (may be any battle type) |
| **Logic** | Routes to `trackAdventureReplay` or `trackArenaReplay` based on `args.ident` / `args.type` |

---

## 4. PvE Battles

### 4.1 `missionEnd`

| | |
|---|---|
| **Handlers** | `trackMissionProgress` + `trackBattleResult` |
| **Category** | `battles` |
| **Fires when** | Campaign mission completes |

**Storage**:

| Target | Data |
|--------|------|
| → **IDB** `missionProgress` | `missionId`, stars, attempts (upsert by `missionId`) |
| → **IDB** `battles` | Battle record (battleType: `'Mission'`) |

---

### 4.2 `towerEnd`

| | |
|---|---|
| **Handlers** | `trackTowerProgress` + `trackBattleResult` |
| **Category** | `battles` |

**Storage**: → **IDB** `towerProgress` + `battles`

---

### 4.3 `bossEnd`

| | |
|---|---|
| **Handler** | `trackBattleResult` |
| **Category** | `battles` |
| **Context** | Outland boss battles (NOT guild raid) |

**`bossGetAll` response** (Outland bosses):

```
[
  {
    id: 10,
    bossLevel: 33,
    chestNum: 2,
    chestId: 2,
    lastChestReward: { coin: {"4": 100} },
    chests: [{ coin: {"4": 100} }, { coin: {"10": 50} }],
    cost: { starmoney: "90" },
    mayRaid: false,
  },
  // 3 bosses total
]
```

**Storage**: → **IDB** `battles`

---

### 4.4 `adventureEnd`

| | |
|---|---|
| **Handler** | `trackBattleResult` |
| **Category** | `battles` |

**Storage**: → **IDB** `battles`

---

### 4.5 `expeditionGetState`

| | |
|---|---|
| **Handler** | `trackExpeditionState` |
| **Category** | `battles` |

**`expeditionGet` response** — Object keyed by slot (9 expeditions):

```
{
  "2": {
    id: 2,
    slotId: 3,
    status: 3,            // 3=completed
    heroes: [],
    endTime: 0,
    duration: 21600,      // 6 hours in seconds
    day: "20260225",
    reward: {
      fragmentArtifact: { "2005": 1 },
      consumable: { "35": 5, "41": 3 }
    },
    power: 175600,
    rarity: 1,
    storyId: 14,
    attemptsLeft: 1,
  },
  ...
}
```

**Storage**: → **IDB** `expeditionBattles` (state snapshot)

---

### 4.6 `expeditionBattle`

| | |
|---|---|
| **Handler** | `trackExpeditionBattle` |
| **Category** | `battles` |

**Storage**: → **IDB** `expeditionBattles`

---

### 4.7 `dungeonBattle` / `dungeonEnd`

| | |
|---|---|
| **Handler** | `trackBattleResult` |
| **Category** | `battles` |

**`dungeonGetInfo` response**:

```
{
  userId: "49712971",
  elements: { prime: "fire", nonprime: ["earth", "water"] },
  respawnFloor: "20331",
  floorNumber: "20347",
  floorType: "battle",
  todayFloorsPassed: 26,
  maxFloorReached: "20347",
  floor: { userData: [...], defenders: {...}, state: {...} },
  reward: [...],
  states: { titans: [...] },
  talent: null,
}
```

**Storage**: → **IDB** `battles`

---

### 4.8 `titanDungeonBattle` / `titanDungeonEnd`

| | |
|---|---|
| **Handler** | `trackBattleResult` |
| **Category** | `battles` |

**Storage**: → **IDB** `battles`

---

### 4.9 `clanDungeonBattle`

| | |
|---|---|
| **Handler** | `trackBattleResult` |
| **Category** | `battles` |

**Storage**: → **IDB** `battles`

---

### 4.10 `towerGetState`

| | |
|---|---|
| **Handler** | `_trackGenericEvent('tower', 'towerState', ...)` |
| **Category** | `battles` |

**`towerGetInfo` response** (16 keys):

```
{
  userId: "49712971",
  teamLevel: "130",
  points: "62370",
  floorNumber: "50",
  floorType: "chest",
  maySkipFloor: "26",
  states: { heroes: [], mercenaries: [] },
  effects: { percentBuff_goldBonus: ... },
  floor: { chests: ..., chestRewards: ... },
  reward: { "4": ..., "8": ..., "50": ... },
  mayBuySkip: ...,
  mayFullSkip: ...,
  skipBought: ...,
  fullSkipCost: { starmoney: ... },
  pointRewards: { "200": ..., "3000": ... },
}
```

**Storage**: → **IDB** `guildActivities` (generic event)

---

### 4.11 `adventureGetAll`

| | |
|---|---|
| **Handler** | `_trackGenericEvent('adventure', 'adventureState', ...)` |
| **Category** | `battles` |

**`adventure_getActiveData` response**:

```
{
  hasActive: false,
  lastChatTime: null,
  hasRewards: false,
}
```

> Minimal when no active adventure. Full adventure data comes through `adventure_join`, `adventure_turnStartBattle`, etc.

**Storage**: → **IDB** `guildActivities` (generic event)

---

## 5. Guild & Clan

### 5.1 `clanGetInfo`

| | |
|---|---|
| **Handlers** | `trackGuildData` + `trackGuildMembers` |
| **Category** | `guild` |
| **Fires when** | Guild screen opened |

**Response shape** (7 keys):

```
{
  clan: {
    id: "307990",
    ownerId: "...",
    level: "...",
    title: "GuildName",
    description: "...",
    icon: { flagColor1, flagColor2, flagShape, iconColor, iconShape },
    members: {                          // keyed by userId
      "49712971": {
        id: "49712971", name: "Wayness", level: 130,
        lastLoginTime: "...", clanRole: "4", commander: true,
        avatarId: "651", frameId: 221, leagueId: 3,
        // ...
      },
      ...  // ~27 members
    },
    warriors: ["userId1", "userId2", ...],  // war participants
    membersCount: "27",
    minLevel: "...",
    league: "...",
    blackList: {},
  },
  membersStat: [
    {
      userId: "...",
      activitySum: ...,
      todayActivity: ...,
      dungeonActivitySum: ...,
      todayDungeonActivity: ...,
      raidSum: ...,
      wasChampion: ...,
      todayPrestige: ...,
      prestigeSum: ...,
    },
    ...  // per-member stats
  ],
  stat: {
    todayActivity: 2220,
    activitySum: 16396,
    dungeonActivitySum: 1555,
    todayRaid: [],
    todayItemsActivity: 0,
    todayDungeonActivity: 174,
    activityForRuneAvailable: false,
    adventureStat: 1,
    clanWarStat: 2,
  },
  serverResetTime: 1772157600,
  clanWarEndSeasonTime: 1772281800,
  freeClanChangeInterval: { start, end },
  giftUids: [],
}
```

**Storage**:

| Target | Data |
|--------|------|
| → **IDB** `guildActivities` | Guild activity snapshot |
| → **IDB** `guildMembers` | Upsert each member (keyed by `playerId`) |
| → **IDB** `guildMemberSnapshots` | Historical member stat snapshots |

**UI consumers**: Dashboard guild name display

---

### 5.2 `clanWarGetInfo` / `clanWarUserGetInfo`

| | |
|---|---|
| **Handlers** | `trackGuildWarInfo` + `trackGuildWarParticipation` |
| **Category** | `guild` |

**`clanWarGetInfo` response** (basic/inactive):

```
{
  season: "202609",
  day: "4",
  endTime: 1772136000,
  nextWarTime: 1772182800,
  nextLockTime: 1772179200,
}
```

**`clanWarGetWarlordInfo` response** (full detail):

```
{
  warInfo: { season, day, endTime, nextWarTime, nextLockTime },
  defence: {
    slots: { "1": userId, "2": userId, ... },   // 40 fortification slots
    teams: {
      "userId": {
        clanDefence_titans: {
          units: {
            "titanId": { id, level, star, element, ... }
          }
        }
      }
    },
    warriors: { ... },
    league: 1,
  }
}
```

**Storage**: → **IDB** `guildWarParticipations` + `guildActivities`

---

### 5.3 `clanWarGetBriefInfo`

| | |
|---|---|
| **Handler** | `trackGuildWarBrief` |
| **Category** | `guild` |
| **Fires when** | War screen loads (lightweight check) |

**Response shape** (6 keys):

```
{
  tries: 0,                     // remaining hero attacks
  targets: 0,                   // available targets
  arePointsMax: true,           // max contribution reached?
  hasActiveWar: false,           // is war currently running?
  nextWarTime: 1772182800,
  nearestWarEndTime: 1772222400,
}
```

**Storage**:

| Target | Data |
|--------|------|
| → **Meta** `guildWarBrief` | `{ triesRemaining, targets, arePointsMax, hasActiveWar, nextWarTime, nearestWarEndTime, lastUpdate }` |

**UI consumers**:

| Component | Reads | Displays |
|-----------|-------|----------|
| Dashboard "Guild War" card | Meta `guildWarBrief` | `X/2` attacks used (or "No War" if inactive) |

---

### 5.4 `clanWarAttack`

| | |
|---|---|
| **Handler** | `trackGuildWarBattle` |
| **Category** | `battles` |

**Storage**: → **IDB** `battles` (battleType: `'GuildWar'`)

**UI consumers**: Dashboard GW battle count

---

### 5.5 `clanWarGetBattleResults`

| | |
|---|---|
| **Handler** | `trackCrossServerWarResults` |
| **Category** | `battles` |

**Storage**: → **IDB** `battles`

---

### 5.6 `crossClanWar_getInfo`

| | |
|---|---|
| **Handler** | `trackCowData` |
| **Category** | `guild` |
| **Fires when** | Clash of Worlds screen loads |

**Response shape** (14 keys):

```
{
  season: 14,
  plannedSeason: 14,
  rating: "9837",
  division: 9,
  league: 2,
  maxLeague: 2,
  nextWarTime: ...,
  nextLockTime: ...,
  seasonEndTime: ...,
  requiredDefendedSlots: 0,
  defendedSlots: 95,
  settings: [],
  war: {
    id: 14,
    endTime: ...,
    enemyClan: {
      id: ...,
      serverId: ...,
      title: "EnemyGuild",
      icon: { flagColor1, flagColor2, flagShape, iconColor, iconShape },
    },
    myTries: {
      heroes: 3,                // remaining hero attacks
      titans: 2,                // remaining titan attacks
      usedHeroes: [],           // hero IDs already used
      usedTitans: [],           // titan IDs already used
    },
    points: "1234",
    enemyPoints: "567",
    clanTries: {                // per-member usage
      "userId": {
        heroes: 3,
        titans: 2,
        usedHeroes: [54, 20, 1],
        usedTitans: [4001, 4013],
      },
      ...
    },
  },
}
```

**Storage**:

| Target | Data |
|--------|------|
| → **Meta** `cowData` | `{ heroAttacksRemaining, titanAttacksRemaining, heroAttacksMax(3), titanAttacksMax(2), usedHeroes, usedTitans, ourPoints, enemyPoints, enemyClan, isActive, rating, division, league, lastUpdate }` |

**UI consumers**:

| Component | Reads | Displays |
|-----------|-------|----------|
| Dashboard "Clash of Worlds" card | Meta `cowData` | `🦸X/3 💠Y/2` (or "No CoW" if inactive) |

---

### 5.7 `clanRaid_getInfo`

| | |
|---|---|
| **Handlers** | `trackRaidBossInfo` + `trackGuildRaidParticipation` |
| **Category** | `guild` |
| **Fires when** | Guild raid screen opened |
| **⚠ Note** | Actual API method is `clanRaid_getInfo`, NOT `bossRaidGetInfo` |

**Response shape** (11 keys):

```
{
  boss: {
    timestamps: { start, end },
    teams: [...],
    level: 130,                     // boss level
  },
  nodes: {
    "1": {                          // minion nodes 1-9
      reward: { consumable: {...}, lootBox: {...} },
      victoryPoints: [64],
      timestamps: { start, end },
      teams: [{
        statLevel, team, unitLevel, victoryPoints,
        states: [...]
      }],
    },
    // ... up to 9 nodes
  },
  shop: { "1": {reward, cost}, ... },     // raid shop (21 slots)
  buffs: [],
  flags: { goldBuffPurchasedAtLeastOnce: ... },
  stats: {
    currentBoss: ...,                       // boss identifier
    points: ...,                            // clan total points
    bossKilled: ...,
    clanBuff: [{ id, value }],
    weekStart: ...,
  },
  userStats: {
    damage: ...,                            // my total damage
    points: ...,                            // my contribution points
    usedHeroes: [...],
    bossReward: {...},
    damageReward: {...},
    // ...
  },
  attempts: 0,                              // used attempts today
  bossAttempts: 5,                          // max attempts per day
  lastBossId: "1",
  coins: 800,                              // my raid coins
}
```

**Storage**:

| Target | Data |
|--------|------|
| → **Meta** `currentRaidBoss` | `{ bossLevel, currentBoss, clanPoints, myDamage, myPoints, attemptsUsed, attemptsMax, coins, nodeCount, lastUpdate }` |
| → **IDB** `guildRaidParticipations` | Participation records |

**UI consumers**:

| Component | Reads | Displays |
|-----------|-------|----------|
| Dashboard "Raid Boss" card | Meta `currentRaidBoss` | `X/5` attacks, boss level, my damage |

---

### 5.8 `bossRaidAttack`

| | |
|---|---|
| **Handler** | `trackRaidBossAttack` |
| **Category** | `battles` |

**Storage**: → **IDB** `battles` (battleType: `'RaidBoss'`)

---

### 5.9 `dungeonGetState` / `titanDungeonGetInfo`

| | |
|---|---|
| **Handler** | `trackGuildDungeonParticipation` |
| **Category** | `guild` |

**Storage**: → **IDB** `guildDungeonParticipations`

---

## 6. Chat & Mail

### 6.1 `chatGetDialog` / `chatGetNewMessages`

| | |
|---|---|
| **Handler** | `trackChatMessages` |
| **Category** | `guild` |

**`chatGetAll` / `chatsGetAll` response**:

```
{
  chat: [
    {
      id: "133211545",
      userId: "49664238",
      messageType: "text",           // or "challenge"
      ctime: "1772122820",          // creation timestamp
      data: {
        ids: [],
        text: "Hello guild!",        // for text messages
        // OR for challenge:
        // text: "5", power: 860356, type: "hero"|"titan",
        // manual: bool, maxUpgrade: bool,
        // heroes: [{ full hero objects }]
      }
    },
    ...  // 50 messages per page
  ],
  users: {
    "userId": { id, name, level, clanRole, avatarId, frameId, ... },
    ...
  },
  clans: [],
}
```

**Storage**: → **IDB** `chatMessages` (deduped by `serverMessageId`)

---

### 6.2 `chatSendMessage`

| | |
|---|---|
| **Handler** | `trackOutgoingMessage` |
| **Category** | `guild` |

**Storage**: → **IDB** `chatMessages` (flagged `isOutgoing: true`)

---

### 6.3 `mailGetAll`

| | |
|---|---|
| **Handler** | `trackMailList` |
| **Category** | `player` |

**Response**: `{ letters: [], users: [] }` (array of mail items)

**Storage**: → **IDB** (mail data cached)

---

### 6.4 `mailFarm` / `mailCollect`

| | |
|---|---|
| **Handler** | `trackMailRewards` |
| **Category** | `player` |

**Storage**: → **IDB** `resourceTransactions` (tracks mail reward resources)

---

## 7. Chests & Loot

All chest handlers follow a consistent pattern using `trackConsumableOpening()` or `trackChestOpening()`.

### 7.1 `chestOpen`

| | |
|---|---|
| **Handler** | `trackChestOpening` |
| **Category** | `chests` |

**Storage**: → **IDB** `chests` + `consumableRewards`

### 7.2 `artifactChestOpen`

| Source type | `artifactChest` |
|---|---|
| **Storage** | → **IDB** `chests` + `consumableRewards` |

### 7.3 `titanArtifactChestOpen`

| Source type | `titanArtifactChest` |
|---|---|

### 7.4 `pet_chestOpen`

| Source type | `petChest` |
|---|---|

### 7.5 `consumableUseLootBox`

| Source type | `lootBox` |
|---|---|

### 7.6 `towerOpenChest`

| Source type | `towerChest` |
|---|---|

### 7.7 `bossOpenChest`

| Source type | `outlandChest` |
|---|---|

### 7.8 `skinChestOpen`

| Source type | `skinChest` |
|---|---|

### 7.9 `runeChestOpen`

| Source type | `runeChest` |
|---|---|

### 7.10 `gachaOpen`

| Source type | `gacha` |
|---|---|

**`gacha_getInfo` response**:

```
{
  nextRefill: ...,
  wishlist: [],
  onceRolled: { super: ... },
  openings: {
    count: 7703,
    last: 7690,
    next: 7710,
    reward: { consumable: {"56": "10"}, gold: 100000 }
  },
  guaranteedOfferCount: [],
}
```

### 7.11 `shopBuy`

| | |
|---|---|
| **Handler** | `trackShopPurchase` |
| **Category** | `chests` |

**`shopGetAll` response** (26 shops):

```
{
  "12": {
    id: 12,
    slots: {
      "1": {
        id: 1,
        reward: { consumable: {"164": "5"} },
        bought: false,
        cost: { starmoney: 425 },
        amountAvailable: null,
        pinned: false,
      },
      ...
    },
    availableUntil: ...,
    level: ...,
    refreshTime: ...,
  },
  ...
}
```

**Storage**: → **IDB** `shopPurchases`

---

## 8. Hero Upgrades

All hero upgrade handlers write to → **IDB** `heroUpgrades` via the `upgradeTracker` module.
`upgradeType` discriminates the kind: `'skill'`, `'artifact'`, `'skin'`, `'glyph'`, `'level'`, `'goldLevel'`, `'star'`, `'color'`, `'equip'`.

### 8.1 `heroUpgradeSkill`

| Args | `{ heroId, skillId }` |
|---|---|
| **upgradeType** | `'skill'` |

### 8.2 `heroArtifactLevelUp`

| Args | `{ heroId, slotId, items: {itemId: qty} }` |
|---|---|
| **upgradeType** | `'artifact'` |
| **Also** | → **IDB** `inventoryItemUsages` (artifact resources consumed) |

### 8.3 `heroSkinUpgrade`

| Args | `{ heroId, skinId }` |
|---|---|
| **upgradeType** | `'skin'` |
| **Also** | → **IDB** `inventoryItemUsages` (skin stones consumed) |

### 8.4 `heroEnchantRune`

| Args | `{ heroId, items: { consumable: {itemId: qty} } }` |
|---|---|
| **upgradeType** | `'glyph'` |
| **Also** | → **IDB** `inventoryItemUsages` (glyph essences consumed) |

### 8.5 `consumableUseHeroXp`

| Args | `{ heroId, amount }` |
|---|---|
| **upgradeType** | `'level'` |
| **Also** | → **IDB** `inventoryItemUsages` (XP potions consumed) |

### 8.6 `heroLevelUp`

| Args | `{ heroId }` |
|---|---|
| **upgradeType** | `'goldLevel'` (gold-spend level up) |

### 8.7 `heroEvolve` / `heroPromote`

| Args | `{ heroId }` |
|---|---|
| **upgradeType** | `'star'` |

### 8.8 `heroColorEvolve`

| Args | `{ heroId }` |
|---|---|
| **upgradeType** | `'color'` |

### 8.9 `heroEquip`

| Args | `{ heroId, slotId }` |
|---|---|
| **Tracker** | `upgradeTracker.trackEquipmentChange()` |
| **Also** | → **IDB** `equipmentChanges` |

### 8.10 `heroAscension`

| Args | `{ heroId, items: {itemId: qty} }` |
|---|---|
| **Storage** | → **IDB** `inventoryItemUsages` (ascension mats consumed) |

### 8.11 `heroAbsoluteStarMission`

| **Handler** | `_trackGenericEvent('hero', 'absoluteStarMission', ...)` |
|---|---|

### 8.12 `heroGiftOfElements`

| **Handler** | `_trackGenericUpgrade('hero', 'giftOfElements', ...)` |
|---|---|

---

## 9. Titan Upgrades

All titan upgrade handlers write to → **IDB** `titanUpgrades`.

### 9.1 `titanArtifactLevelUp`

| **upgradeType** | `'artifact'` |
|---|---|

### 9.2 `titanUsePotions`

| **upgradeType** | `'level'` |
|---|---|
| **Also** | → **IDB** `inventoryItemUsages` (titan XP potions consumed) |

### 9.3 `titanEvolve` / `titanStarUp`

| **upgradeType** | `'star'` |
|---|---|

### 9.4 `titanUpgradeSkill`

| **upgradeType** | `'skill'` |
|---|---|

### 9.5 `titanSkinUpgrade`

| **upgradeType** | `'skin'` |
|---|---|

### 9.6 `titanEnchantRune`

| **upgradeType** | `'glyph'` |
|---|---|
| **Also** | `upgradeTracker.trackTitanGlyphUpgrade()` + generic event |

### 9.7 `titanSpiritUpgrade`

| **Handler** | `_trackGenericUpgrade('titan', 'spiritUpgrade', ...)` |
|---|---|

---

## 10. Pet Upgrades

### 10.1 `pet_levelUp`

| **Handler** | `_trackGenericUpgrade('pet', 'levelUp', ...)` |
|---|---|

### 10.2 `pet_evolve`

| **Handler** | `_trackGenericUpgrade('pet', 'evolve', ...)` |
|---|---|

---

## 11. Economy & Shopping

### 11.1 `offerBuy`

| | |
|---|---|
| **Handler** | `_trackGenericEvent('economy', 'offerBuy', ...)` |
| **Category** | `chests` |
| **Also** | → **IDB** `resourceTransactions` if reward contains `gold` or `starmoney` |

### 11.2 `campaignFarm` / `missionFarm`

| | |
|---|---|
| **Handler** | `_trackGenericEvent('economy', 'campaignFarm', ...)` |
| **Category** | `quests` |
| **Also** | → **IDB** `resourceTransactions` if reward contains `gold` or `starmoney` |

### 11.3 `seerFarm`

| | |
|---|---|
| **Handler** | `_trackGenericEvent('economy', 'seerFarm', ...)` |
| **Category** | `quests` |
| **Also** | → **IDB** `resourceTransactions` |

---

## 12. Social

### 12.1 Friend Gifts & Hearts

**Methods**: `friendSendGift`, `friendGetGift`, `friendSendHearts`, `friendGetHearts`

| | |
|---|---|
| **Handler** | `_trackGenericEvent('social', 'friendGift', ...)` |
| **Category** | `player` |
| **Also** | → **IDB** `resourceTransactions` if reward contains `starmoney` |

---

## 13. Events & Seasons

### 13.1 `eventGetInfo` / `eventGetAll`

| **Handler** | `_trackGenericEvent('event', 'eventInfo', ...)` |
|---|---|

### 13.2 `eventFarm`

| **Handler** | `_trackGenericEvent('event', 'eventFarm', ...)` |
|---|---|
| **Also** | → **IDB** `resourceTransactions` |

### 13.3 `seasonGetInfo` / `seasonGetAll`

| **Handler** | `_trackGenericEvent('event', 'seasonInfo', ...)` |
|---|---|

### 13.4 `seasonFarm`

| **Handler** | `_trackGenericEvent('event', 'seasonFarm', ...)` |
|---|---|
| **Also** | → **IDB** `resourceTransactions` |

---

## 14. Special Battle Modes

### 14.1 Clash of Worlds Battles

**Methods**: `clashGetInfo`, `clashBattle`, `clashEnd`

| | |
|---|---|
| **Handler** | `trackClash` (smart router) |
| **Category** | `battles` |
| **Logic** | Battle/End → `trackBattleResult`, Info → `_trackGenericEvent('clash', 'clashInfo', ...)` |

**Storage**: → **IDB** `battles` (for battle/end), `guildActivities` (for info)

### 14.2 Tournament of Elements

**Methods**: `tournamentGetInfo`, `tournamentBattle`, `tournamentEnd`

| | |
|---|---|
| **Handler** | `trackTournament` (smart router) |
| **Category** | `battles` |
| **Logic** | Same pattern as Clash |

---

## 15. Unhandled but Captured Methods

> **Updated after Phase 13 (#121)**: Of 112 originally captured methods, the userscript
> now has **~190+ handler registrations** covering virtually all methods from both
> API sample exports. As of v0.9.46, only the following remain without handlers:

| Method | Description | Reason |
|--------|-------------|--------|
| `demoBattles_getAll` | Demo battle configurations | Low value — tutorial/demo data |

All other previously-unhandled methods were addressed in:

- **Phase 12** (#112): Guild war defense/warlord/league, weekly stats, guild log,
  leaderboards, hero ratings, event quests, special offers, CoW, titan summoning,
  tower state, dungeons, shops, billing, bundles, subscriptions, prestige, banners,
  campaign story, social quests, idle, teams, buffs, stronghold, zeppelin, etc.
- **Phase 13** (#121): 30 new methods — boss outland, tower state, expeditions,
  invasion, workshop buffs, special battle pass, pet chest, adventures (co-op + solo),
  chat summary, titan arena forgotten/chest, cosmetics (avatars/frames/stickers),
  telegram quests, rewarded video, sale showcase, plus 10 system no-ops (getTime,
  registration, tutorialGetInfo, splitGetAll, stashClient, freebieHaveGroup,
  mechanicAvailability, mechanicsBan_getInfo, playable_getAvailable, userMergeGetStatus).

---

## Appendix A: IndexedDB Object Stores

| Store | Key | Description | Primary Writers |
|-------|-----|-------------|-----------------|
| `snapshots` | auto | Player state point-in-time | `userGetInfo` |
| `heroes` | auto | Hero roster snapshots | `heroGetAll` |
| `titans` | auto | Titan roster snapshots | `titanGetAll` |
| `pets` | auto | Pet collection snapshots | `pet_getAll` |
| `inventory` | auto | Full inventory snapshots | `inventoryGet` |
| `battles` | auto | All battle results | Arena, GW, missions, tower, raids, etc. |
| `chests` | auto | Chest opening events | `chestOpen`, artifact/titan/pet chests |
| `consumableRewards` | auto | Individual drop records | All chest handlers |
| `opponents` | `opponentId` | Tracked opponents | Arena enemies handlers |
| `questCompletions` | auto | Quest completion records | `questComplete` |
| `dailyQuestCompletions` | auto | Daily quest farm events | `questFarm`, `quest_questsFarm` |
| `guildQuestCompletions` | auto | Guild quest farm events | `questFarm` (guild type) |
| `loginRewards` | auto | Login reward claims | `dailyBonusFarm` |
| `missionProgress` | `missionId` | Campaign mission state | `missionEnd` |
| `towerProgress` | `towerType` | Tower floor state | `towerEnd` |
| `expeditionBattles` | auto | Expedition events | `expeditionGetState`, `expeditionBattle` |
| `shopPurchases` | auto | Shop transactions | `shopBuy` |
| `resourceTransactions` | auto | Resource gain/spend | Multiple (offers, farms, events) |
| `guildActivities` | auto | Guild activity events | `clanGetInfo`, generic events |
| `guildMembers` | `playerId` | Guild member roster | `clanGetInfo` |
| `guildMemberSnapshots` | auto | Member stat history | `clanGetInfo` |
| `guildWarParticipations` | auto | War participation | `clanWarGetInfo`, `clanWarUserGetInfo` |
| `guildRaidParticipations` | auto | Raid participation | `clanRaid_getInfo` |
| `guildDungeonParticipations` | auto | Dungeon participation | `dungeonGetState`, `titanDungeonGetInfo` |
| `titaniteTransactions` | auto | Titanite economy | Various guild handlers |
| `chatMessages` | auto | Chat archive | `chatGetDialog`, `chatGetNewMessages`, `chatSendMessage` |
| `heroUpgrades` | auto | Hero upgrade events | All hero upgrade handlers |
| `titanUpgrades` | auto | Titan upgrade events | All titan upgrade handlers |
| `inventoryItemUsages` | auto | Item consumption | Upgrade handlers (artifacts, potions, etc.) |
| `equipmentChanges` | auto | Gear slot changes | `heroEquip` |
| `activityEvents` | auto | Live activity feed (capped 500) | All handlers via `_logActivity()` |
| `apiLogs` | auto | Raw API monitoring | `apiMonitor` |
| `goals` | auto | User-set goals | Goals manager |
| `events` | auto | Calendar events | Events manager |
| `metadata` | `key` | Key-value fast cache | Multiple handlers |

---

## Appendix B: Metadata Keys

| Key | Written by | Read by | Shape |
|-----|-----------|---------|-------|
| `playerData` | `userGetInfo` | Dashboard, all trackers | `{ player: {id,name,level}, gold, starMoney, emeralds, stamina, bottledEnergy, clanId, clanTitle, vipLevel, power }` |
| `currentPlayerId` | `userGetInfo` | All upgrade trackers | string |
| `questSummary` | `questGetAll` | Dashboard | `{ dailyTotal, dailyCompleted, guildTotal, guildCompleted }` |
| `guildWarBrief` | `clanWarGetBriefInfo` | Dashboard | `{ triesRemaining, targets, arePointsMax, hasActiveWar, nextWarTime, nearestWarEndTime, lastUpdate }` |
| `cowData` | `crossClanWar_getInfo` | Dashboard | `{ heroAttacksRemaining, titanAttacksRemaining, heroAttacksMax, titanAttacksMax, usedHeroes, usedTitans, ourPoints, enemyPoints, enemyClan, isActive, rating, division, league, lastUpdate }` |
| `currentRaidBoss` | `clanRaid_getInfo` | Dashboard | `{ bossLevel, currentBoss, clanPoints, myDamage, myPoints, attemptsUsed, attemptsMax, coins, nodeCount, lastUpdate }` |

---

## Appendix C: Data Flow Diagram

```
Browser (Hero Wars)
  │
  ├── API Request/Response ──► apiMonitor.js ──► gameTracker.js
  │                                                  │
  │                                    ┌─────────────┼──────────────────┐
  │                                    │             │                  │
  │                              registerHandler   upgradeTracker   _trackGenericEvent
  │                                    │             │                  │
  │                                    ▼             ▼                  ▼
  │                              ┌──────────────────────────────────────────┐
  │                              │          IndexedDB Storage               │
  │                              │  ┌──────────┐ ┌──────────┐ ┌─────────┐  │
  │                              │  │snapshots │ │ battles  │ │ heroes  │  │
  │                              │  │metadata  │ │ chests   │ │ titans  │  │
  │                              │  │apiLogs   │ │opponents │ │  pets   │  │
  │                              │  │ ...30+   │ │ quests   │ │ guilds  │  │
  │                              │  └──────────┘ └──────────┘ └─────────┘  │
  │                              └──────────────────────────────────────────┘
  │                                                  │
  │                                                  ▼
  │                                          uiManager.js
  │                                    ┌─────────────┼──────────────────┐
  │                                    │             │                  │
  │                              Dashboard       Tab Views        Settings
  │                              - Resources     - Heroes          - Export
  │                              - Quests X/Y    - Titans          - API Samples
  │                              - GW/CoW/Raid   - Battles         - About
  │                              - Win rates     - Chests
  │                              - Completion %  - Upgrades
  │                                              - Activity
  └──────────────────────────────────────────────────────────────────────────
```
