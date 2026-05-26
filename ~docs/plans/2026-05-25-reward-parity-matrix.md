# Reward Telemetry Parity Matrix (#159)

Date: 2026-05-25
Scope: userscript -> sync payload -> API import -> DB -> UI

## Objective

Close real end-to-end gaps for chest/item rewards so all consumable/chest drops persist and appear in analytics views.

## Matrix

| Area | Userscript Capture | Sync Payload | API DTO/Import | DB Persistence | UI Consumption | Status |
|---|---|---|---|---|---|---|
| Chest openings | `gameTracker.trackConsumableOpening()` writes `chests` | `syncClient` sends `chestOpenings` | `BrowserSyncData.ChestOpenings` imported via `ImportChestOpeningsAsync()` | `ChestOpenings` rows | Userscript + Desktop Chests view | Aligned |
| Per-drop rewards | `gameTracker.trackConsumableOpening()` writes `consumableRewards` | `syncClient` now sends `consumableRewards` | `BrowserSyncData.ConsumableRewards` + `ImportConsumableRewardsAsync()` | `ChestDrops` rows (deduped) | Desktop Chests Include(Drops), reward analytics | Fixed |
| Timestamp compatibility | IDB uses epoch ms for `chests`/`consumableRewards` | `syncClient` now normalizes to ISO-8601 | DateTime binding succeeds consistently | Correct event time retained | Accurate daily filtering and trend views | Fixed |
| Existing opening backfill | N/A | N/A | rewards matched by local opening map first, then timestamp+source fallback | missing drops can be attached to existing openings | richer chest detail rows | Fixed |
| Duplicate insert protection | local event dedupe varies by source | payload may replay incremental windows | import checks existing opening/drop signatures | deduped openings + deduped drops | stable counts across syncs | Fixed |

## Implemented Changes

1. userscript `syncClient` now includes normalized `consumableRewards` in every incremental payload.
2. userscript normalizes epoch timestamps to ISO strings before sending.
3. API contract now includes `ConsumableRewardSyncRecord` list under `BrowserSyncData`.
4. API import now maps consumable rewards into `ChestDrop` rows using opening linkage + fallback matching.
5. API stats include `TotalChestDrops` for visibility.

## Remaining Follow-up Opportunities

1. Add a dedicated import metric for unmatched reward rows (currently skipped silently).
2. Add API integration test for replayed sync payloads validating no duplicate chest drops.
3. Add userscript health badge for recommendation API availability and reward parity checks.
