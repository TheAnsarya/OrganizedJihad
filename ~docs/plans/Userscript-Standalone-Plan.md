# OrganizedJihad Userscript — Standalone Tracker Plan

## Vision

Transform the existing TamperMonkey userscript into a **fully self-contained** game data tracker that:

1. **Captures all Hero Wars API traffic** via XHR/fetch interception
2. **Stores everything locally** in IndexedDB (no external server required)
3. **Displays an in-game overlay UI** with tabs for browsing captured data
4. **Works immediately** after install — no server, no build step for users

The C# backend/desktop app remain as optional Tier 2/3 for advanced analysis. The userscript itself is the primary daily-use tool.

---

## Current State Assessment

### What Already Exists

| Component | Status | Notes |
|---|---|---|
| TamperMonkey metadata | ✅ Working | `@match` for `hero-wars.com/*` — **needs nextersglobal.com iframes** |
| XHR interception | ✅ Working | Proxies `XMLHttpRequest.open/send` for `*.nextersglobal.com/api/` |
| Fetch interception | ⚠️ Partial | `APIMonitor` intercepts fetch, `GameTracker` only does XHR |
| IndexedDB storage | ✅ Working | v6 schema, 25+ object stores, full CRUD methods |
| API call routing | ✅ Working | ~51 `case` handlers in `processAPIResponse()` covering most endpoints |
| Data extraction | ⚠️ Varies | Some handlers richly extract, others store raw; some missing field mappings |
| UI overlay | ⚠️ Skeleton | 7 nav tabs (Dashboard/Goals/Calendar/Heroes/Resources/Reports/Settings), but render methods return mostly static HTML strings; no live data queries from IndexedDB |
| SyncClient | ✅ Working | Sends to localhost:5124 C# API; auto-sync every 15 min |
| Upgrade tracking | ✅ Working | 14 `UpgradeTracker` methods for hero/titan upgrade events |
| Arena tracking | ✅ Working | `ArenaTracker` for arena enemy/battle processing |
| CSS styling | ✅ Working | 540-line main.css with draggable overlay, cards, tables, responsive |
| Webpack build | ✅ Working | Outputs `dist/organized-jihad.user.js`, inline source maps |
| Jest tests | ⚠️ Basic | 3 test files (gameTracker, indexedDBStorage, storageManager) |

### Key Gaps to Fill

1. **@match patterns** — Only matches `hero-wars.com` but game runs inside `i-heroes-*.nextersglobal.com` iframe
2. **UI is a dead shell** — `renderDashboard()` calls `this.gameTracker.getGameData()` which reads from in-memory object, not IndexedDB. Most views return hardcoded HTML.
3. **No data browser** — Can't browse stored battles, heroes, snapshots, etc.
4. **No status indicator** — No way to tell at a glance if the script is working / intercepting
5. **No data export** — `APIMonitor` has `exportLogs()` but no UI button for it
6. **Settings page is non-functional** — Toggles don't persist, no real configuration
7. **Constructor mismatch** — `UIManager` constructor takes 5 args but `index.js` passes 7 (includes `syncClient`)

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                  TamperMonkey Userscript              │
│                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ API Interceptor│  │ Data Processor │  │  IndexedDB │  │
│  │ (XHR + Fetch) │→│ (GameTracker)  │→│  Storage   │  │
│  └──────────────┘  └──────────────┘  └─────┬──────┘  │
│                                             │         │
│  ┌──────────────────────────────────────────┴──────┐  │
│  │                  UI Layer                        │  │
│  │  ┌─────────┐ ┌────────┐ ┌───────┐ ┌─────────┐  │  │
│  │  │Status   │ │Activity│ │ Data  │ │Settings │  │  │
│  │  │Indicator│ │  Feed  │ │Browser│ │  Panel  │  │  │
│  │  └─────────┘ └────────┘ └───────┘ └─────────┘  │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  ┌──────────────────┐  (Optional)                     │
│  │ SyncClient → API │ ← Only if C# server running    │
│  └──────────────────┘                                 │
└──────────────────────────────────────────────────────┘
```

---

## Milestones

### Milestone 1: "I Can See It Working" (Priority: IMMEDIATE)

**Goal**: Install the script, open the game, and see visual proof of interception.

- Fix `@match` patterns to include `*.nextersglobal.com/*` iframe URLs
- Add a small **floating status badge** (fixed position, bottom-right) showing:
  - "OJ: Listening..." (yellow) — waiting for first API call
  - "OJ: 42 calls captured" (green, live counter) — actively working
  - Click to open the full overlay
- Add a `@grant GM_addStyle` CSS injection for the badge
- Wire `GameTracker` to emit a visible console banner on first API intercept
- **Deliverable**: User installs → opens game → sees green badge counting up

### Milestone 2: Live Activity Feed

**Goal**: Real-time scrolling log of every tracked event.

- New "Activity" tab in overlay replacing the static dashboard
- Shows last N events as they happen: "Snapshot saved", "Arena battle won vs Player123", "Hero Galahad leveled to 101", "Chest opened: 3 drops"
- Each entry is timestamped, color-coded by category (green=reward, red=battle loss, blue=info)
- Activity feed reads from IndexedDB and also receives push updates from GameTracker events
- **Deliverable**: Open overlay → see live events scrolling as you play

### Milestone 3: Data Browser Tabs

**Goal**: Browse all stored data through the overlay UI.

- **Heroes Tab**: Table of all tracked heroes with sort/filter (by name, power, level, stars)
- **Titans Tab**: Same pattern for titans
- **Battles Tab**: Filterable battle history (arena/grand/titan/guild war) with win/loss stats
- **Inventory Tab**: Current inventory snapshot with category breakdown
- **Chest Log Tab**: Chest opening history with drop rate stats
- **Resources Tab**: Resource transaction timeline (gold/emeralds/energy over time)
- All tabs query IndexedDB directly, paginated (25 per page)
- **Deliverable**: Full browsable data explorer within the game UI

### Milestone 4: Statistics & Insights

**Goal**: Computed analytics from stored data.

- **Win rates**: Arena/Grand/Titan arena win percentages (overall and last 7 days)
- **Resource trends**: Gold/emeralds earned vs spent over time
- **Hero growth**: Power progression charts per hero
- **Daily summaries**: Auto-generated daily activity recap
- **Guild overview**: Member activity, war participation rates
- Simple inline charts using CSS/SVG (no external chart lib)
- **Deliverable**: Actionable insights dashboard

### Milestone 5: Settings & Data Management

**Goal**: User control over the script behavior.

- Toggle tracking on/off per category
- Export all data as JSON
- Import data from JSON backup
- Clear specific data stores
- Configure overlay position, size, opacity
- Configure auto-sync to C# API (URL, interval, enable/disable)
- **Deliverable**: Full user configuration panel

### Milestone 6: Polish & Reliability

**Goal**: Production-ready script.

- Error boundary around every tracker (never crash the game)
- IndexedDB storage limits monitoring (warn at 80% quota)
- Deduplication across all store types
- Performance profiling (ensure <5ms overhead per API call)
- Comprehensive Jest test coverage
- Full JSDoc documentation
- **Deliverable**: Stable, well-tested, documented script

---

## Technical Notes

### @match Patterns Needed

From HeroWarsHelper's manifest, the game loads inside iframes on these domains:

```
https://i-heroes-fb.nextersglobal.com/*       (Facebook login)
https://i.hero-wars-fb.com/*                   (Facebook alt)
https://i-heroes-vk.nextersglobal.com/*        (VK login)
https://i-heroes-ok.nextersglobal.com/*        (Odnoklassniki)
https://i-heroes-mm.nextersglobal.com/*        (Mail.ru)
https://i-heroes-wb.nextersglobal.com/*        (Web direct)
https://i-heroes-mg.nextersglobal.com/*        (MiniGames)
https://hero-wars.com/*                         (Main site)
https://www.hero-wars.com/*                     (Main site www)
```

The API calls go to `*.nextersglobal.com/api/` — the XHR interception pattern is correct, but TamperMonkey needs `@match` for the iframe domain where JS runs.

### IndexedDB Stores (Existing)

25 stores already defined:
`snapshots`, `battles`, `chests`, `opponents`, `goals`, `events`, `metadata`,
`heroes`, `titans`, `pets`, `inventory`, `questCompletions`, `missionProgress`,
`shopPurchases`, `towerProgress`, `expeditionBattles`, `resourceTransactions`,
`guildActivities`, `chatMessages`, `guildMembers`, `guildMemberSnapshots`,
`guildWarParticipations`, `guildRaidParticipations`, `guildDungeonParticipations`,
`titaniteTransactions`, `heroUpgrades`, `titanUpgrades`, `dailyQuestCompletions`,
`guildQuestCompletions`, `loginRewards`, `inventoryItemUsages`, `equipmentChanges`,
`apiLogs` (in APIMonitor)

### Build Pipeline

```bash
cd userscript
yarn install
yarn build          # → dist/organized-jihad.user.js
yarn dev            # → watch mode with auto-rebuild
```

The built file is a single JS bundle that TamperMonkey can load directly.

---

## File Changes Summary

| File | Changes Needed |
|---|---|
| `src/index.js` | Fix @match patterns, add @grant, restructure init |
| `src/modules/uiManager.js` | Major rewrite — live data from IDB, new tabs |
| `src/modules/gameTracker.js` | Add event emitter for live feed, minor fixes |
| `src/modules/indexedDBStorage.js` | Add pagination helpers, count methods |
| `src/modules/apiMonitor.js` | Wire export to UI, status badge data |
| `src/styles/main.css` | Status badge styles, new tab styles, table styles |
| `src/modules/helpers/formatters.js` | NEW — date/number/resource formatting utils |
| `src/modules/views/*.js` | NEW — individual view renderers (split from uiManager) |
| `tests/*.test.js` | Expand coverage for new features |

---

## Estimated Effort

| Milestone | Issues | Effort |
|---|---|---|
| M1: "I Can See It Working" | 2-3 | Small — mostly config + badge |
| M2: Live Activity Feed | 2-3 | Medium — event system + UI |
| M3: Data Browser Tabs | 4-6 | Large — multiple views + IDB queries |
| M4: Statistics & Insights | 3-4 | Medium — computed analytics |
| M5: Settings & Data Management | 2-3 | Medium — config persistence |
| M6: Polish & Reliability | 2-3 | Medium — testing + docs |
| **Total** | **15-22** | |
