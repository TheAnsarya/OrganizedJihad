# Userscript Improvement Plan — Lessons from HeroWarsHelper

Based on analysis of the HeroWarsHelper (HWA) v3.3.3 Chrome extension, this plan identifies
concrete improvements for OrganizedJihad's TamperMonkey userscript.

---

## Epic 1: XHR Proxy Reliability (CRITICAL — Issues #34–36)

### Issue #34 — Decode ArrayBuffer request bodies via TextDecoder ✅ DONE
The game sends POST bodies as ArrayBuffer, not string. Our proxy was capturing
the raw JS object (with webpack-minified property names). HWA's `injected.js`
uses `TextDecoder("utf-8").decode(data)` to get the proper JSON string before
parsing. **Fixed in this session.**

### Issue #35 — Add `setRequestHeader` proxy to capture auth headers
HWA captures all headers (especially `X-Request-Id`, `X-Auth-Token`,
`X-Auth-Session-Id`, `X-Env-Unique-Session-Id`) during open/setRequestHeader.
This enables:
- Detecting initial load (X-Request-Id <= 2)
- Replaying API calls with proper auth
- Tracking session identity

### Issue #36 — RequestHistory auto-cleanup (memory leak prevention)
HWA's `requestHistory` keys are `timestamp_random` and a `setInterval` every 5
minutes deletes entries older than 5 minutes. Our `requestHistory` grows forever.

---

## Epic 2: WebSocket Push Events (Issues #37–38)

### Issue #37 — Hook `window.nxg.getModule("pushd")` for real-time events
HWA registers a `pushd.on("message", ...)` listener that receives real-time
game events over WebSocket (not XHR). Events include:
- `chatMessage` — chat messages without polling
- `arenaPlaceChanged` — defeat notification
- `clanWarTarget` — war target assignment
- `clanWarEndBattle` / `clanWarAttack` — battle outcomes
- `clanNewMember` / `clanDismissMember` — roster changes
- `crossClanWar_*` — cross-server war events
- `clanDomination_move` / `clanDomination_defenseState` — castle events
- `clanRaid.startBattle` / `clanRaid.endBattle` — raid events

### Issue #38 — Proxy `WebSocket.prototype.send` for outgoing messages
HWA also intercepts outgoing WebSocket messages and filters `iframeEvent.login`
frames. This could give us auth context.

---

## Epic 3: Missing API Methods (Issues #39–41)

### Issue #39 — Add cross-server war tracking
HWA tracks: `crossClanWar_getInfo`, `crossClanWar_getAttackMap`,
`crossClanWar_getDefenceMap`, `crossClanWar_startBattle`.
We have none of these.

### Issue #40 — Add adventure/expedition replay tracking
HWA tracks: `adventure_getInfo`, `adventure_join`, `adventure_start`,
`adventure_getLog`, `adventure_getGlobalBuffs`, `adventure_find`,
`adventure_getPassed`, `battleGetReplay` (all replay types).
We track `expeditionGetState` and `expeditionBattle` but miss adventures.

### Issue #41 — Add arena replay/journal tracking
HWA tracks: `arenaGetAll`, `battleGetByType` (arena/grand/clan_domination),
`topGet` (rankings). We handle arenaGetEnemies/Attack/End but not replays
or rankings.

---

## Epic 4: Data Storage Improvements (Issues #42–44)

### Issue #42 — Hero data compression for smaller storage footprint
HWA compresses hero snapshots to ordered arrays:
```javascript
const fields = ["agility", "armor", "armorPenetration", ...];
const compressed = fields.map(f => hero[f]); // Just the values
```
Our snapshots store full key-value objects. For 100+ hero snapshots over
months, compression could reduce storage by 40-60%.

### Issue #43 — Replay deduplication by ID before insert
HWA checks `await db.replay.get(id)` before inserting. We should do the
same for all battle/replay records.

### Issue #44 — Add auto-purge for old data
HWA has configurable retention: `max_days_arena`, `max_days_ga`,
`max_days_war`, `max_days_asgard`, `max_days_cow`. Default 120-180 days.
We have no purge mechanism.

---

## Epic 5: Handler Architecture Refactor (Issues #45–46)

### Issue #45 — Extract handler pattern from processAPIResponse switch
HWA uses a handler array pattern:
```javascript
const handler = { calls: ["apiMethod"], handle: (req, res) => {} };
HANDLERS.push(handler);
```
Dispatch: iterate handlers, check `intersection(handler.calls, callNames)`.

Benefits:
- Each handler is self-contained and independently testable
- New API methods = new handler object, not modifying a 200-line switch
- Handlers can declare which calls they need
- Plugin-style architecture

### Issue #46 — Add handler dependency declarations
HWA handlers declare both `calls` (which API methods they handle) and
`results` (which ident patterns they expect). This allows fail-fast on
unexpected response shapes.

---

## Epic 6: UI & In-Game Integration (Issues #47–49)

### Issue #47 — Add keyboard shortcut toggle (backtick/tilde)
HWA toggles its panel with `` ` `` or `~` key. Our OJ badge requires clicking.
Adding a keyboard shortcut makes it faster to check data.

### Issue #48 — Add arrow-key panel resizing
HWA allows resizing the overlay panel with Up/Down arrow keys. Our overlay
has a fixed height.

### Issue #49 — Investigate `#flash-content` / `#game` DOM targeting
HWA injects controls into game-specific DOM nodes. We could use the same
approach to embed data directly into game UI panels.

---

## Epic 7: Advanced Features (Issues #50–52)

### Issue #50 — Opponent team tracking database
HWA maintains a `userTeams` table mapping userId → last-known hero teams,
updated from every replay and battle. This enables opponent scouting.

### Issue #51 — Add notification system for real-time events
HWA triggers browser notifications for war targets, arena defeats, chat
messages, etc. Uses `chrome.notifications` API but we could use
`Notification` web API (requires permission).

### Issue #52 — Sentry error blocking
HWA intercepts `fetch` calls to `sentry.io` and spoofs success responses,
preventing the game from sending error reports about modified data. Not
needed for read-only tracking, but good to know about.

---

## Priority Order

1. **DONE**: Epic 1 (#34) — ArrayBuffer decoding fix
2. **HIGH**: Epic 1 (#36) — RequestHistory cleanup
3. **HIGH**: Epic 5 (#45) — Handler refactor
4. **MEDIUM**: Epic 2 (#37) — Push events
5. **MEDIUM**: Epic 3 (#39-41) — Missing API methods
6. **MEDIUM**: Epic 4 (#42-44) — Storage improvements  
7. **LOW**: Epic 6 (#47-49) — UI improvements
8. **LOW**: Epic 7 (#50-52) — Advanced features
