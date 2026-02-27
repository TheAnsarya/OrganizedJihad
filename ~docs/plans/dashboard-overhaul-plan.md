# Dashboard Overhaul Plan — Phase 10

## Overview

Comprehensive fix for the Dashboard Player Info section. All issues stem from
incorrect/missing API field mappings discovered via the API Sample Collector
(v0.9.31+). Real API samples are in `~docs/api-samples/hw-api-samples-2026-02-27.json`.

## Issues Summary

| # | Issue | Root Cause | Fix Location |
|---|-------|-----------|-------------|
| 1 | Gold has no visible emoji | 🪙 (U+1FA99) not rendered in all browsers | Use SVG/CSS coin icon |
| 2 | Emerald emoji is pink | `hue-rotate(100deg)` on 💎 doesn't yield green | Use direct green SVG or CSS shape |
| 3 | Energy shows 0 | No `stamina` field on `userGetInfo` — energy is in `refillable[id=1].amount` | Fix `trackPlayerData()` to extract from `refillable` array |
| 4 | No bottled energy count | Never captured `refillable[id=49].amount` | Add to `trackPlayerData()` + display in dashboard |
| 5 | Daily Quests: no total | Shows "X today" not "X/Y" | Use `questGetAll` metadata for total daily quest count |
| 6 | Guild Quests: no total + wrong count | Shows "111 today" (likely wrong) + no total | Fix counting logic, use `questGetAll` for guild quest totals |
| 7 | Guild War: hardcoded /3 | GW is 2 attacks Mon-Fri, from `clanWarGetBriefInfo.tries` | Track from `clanWarGetBriefInfo`, remove hardcoded 3 |
| 8 | No CoW progress | `crossClanWar_getInfo` not tracked for dashboard | Add handler, show hero (X/3) + titan (X/2) usage |
| 9 | Raid: no boss info | `bossRaidGetInfo` handler name wrong — API is `clanRaid_getInfo` | Fix handler name, extract boss level + attack data |
| 10 | Raid: no damage totals | `userStats.damage` from `clanRaid_getInfo` not displayed | Extract and display |

## API Field Mapping (from real samples)

### `userGetInfo` Response

```
gold: number (7053188)
starMoney: number (24439)           ← emeralds
refillable: Array<{id, amount, lastRefill, boughtToday}>
  id=1  → Campaign Energy (amount=100)
  id=49 → Bottled Energy (amount=365)
  id=5  → Arena attempts
  id=2  → Tower/shop charges
```

**CRITICAL**: There is NO top-level `stamina` or `energy` field. Energy comes from
`refillable.find(r => r.id === 1).amount`.

### `questGetAll` Response

Array of quest objects: `{ id, state, progress, reward, createTime, farmCount, order? }`

- **Daily quests**: Identified by reward having `clanQuestsPoints` = false AND
  ID range NOT in guild/battlepass/raid ranges. Actually, the game tracks daily
  quest completion via `questFarm` calls with IDs in 10000-10999 range.
- **Guild quests**: ID range 20000xxx, reward has `clanQuestsPoints`, has `order` field
- **Battle Pass quests**: ID range 1797xxxxxx+, reward has `battlePassExp`
- **Clan Raid quests**: ID range 11xxx, has `order` field

State values: 1 = in-progress, 2 = completed/claimable

### `clanWarGetBriefInfo` Response

```json
{
  "tries": 0,              // remaining GW attacks
  "targets": 0,            // available targets
  "arePointsMax": true,
  "hasActiveWar": false,
  "nextWarTime": 1772182800,
  "nearestWarEndTime": 1772222400
}
```

### `crossClanWar_getInfo` Response (CoW)

```json
{
  "war": {
    "myTries": {
      "heroes": 3,          // remaining hero attacks (max 3)
      "titans": 2,          // remaining titan attacks (max 2)
      "usedHeroes": [],
      "usedTitans": []
    },
    "enemyClan": { "title": "...", ... },
    "points": "1152",
    "enemyPoints": "209"
  }
}
```

### `clanRaid_getInfo` Response (Guild Raid)

```json
{
  "boss": { "level": 140, "teams": [...] },
  "stats": { "currentBoss": "2", "points": "16606" },
  "userStats": { "damage": "0", "points": "800", "usedHeroes": [] },
  "attempts": 0,            // attacks used today
  "bossAttempts": 5,         // max boss attacks per day
  "nodes": { "1": {...}, ... "9": {...} },
  "coins": 800
}
```

**NOTE**: `bossRaidGetInfo` does NOT exist as an API method. The correct name is `clanRaid_getInfo`.

## Implementation Plan

### Phase 10a: Data Collection Fixes (gameTracker.js)

1. **Fix `trackPlayerData()`**: Extract energy from `refillable[id=1].amount` and
   bottled energy from `refillable[id=49].amount`
2. **Fix raid handler**: Change `bossRaidGetInfo` → `clanRaid_getInfo`
3. **Fix `trackRaidBossInfo()`**: Map correct fields from `clanRaid_getInfo` response
4. **Add `clanWarGetBriefInfo` handler**: Track GW tries remaining
5. **Add `crossClanWar_getInfo` handler**: Track CoW hero/titan attack usage
6. **Fix `trackQuestsData()`**: Store quest totals by category (daily, guild, battlepass)

### Phase 10b: Dashboard UI Fixes (uiManager.js)

1. **Gold icon**: Replace 🪙 with inline SVG coin
2. **Emerald icon**: Replace hue-rotated 💎 with green SVG gem
3. **Energy card**: Show actual energy value + bottled energy count
4. **Daily Quests**: Show X/Y format using tracked quest totals
5. **Guild Quests**: Show X/Y format, fix counting
6. **Guild War**: Dynamic X/Y from `clanWarGetBriefInfo.tries`, show attacks used
7. **Add CoW section**: Hero attacks (X/3) + Titan attacks (X/2)
8. **Raid section**: Show boss level, attacks X/5, damage totals, split minion/boss

### Phase 10c: Testing & Verification

1. Run all Jest tests
2. Webpack build
3. Manual verification with live game data
