# Tracking Parity Matrix (2026-06-05)

Issue linkage:

- #383 Userscript/API parity audit
- #384 Domain-specific sync query expansion
- #385 Tracking coverage endpoint by domain

## Snapshot

This matrix maps the current userscript capture surface to API import/query persistence.
Status values:

- Implemented: DTO import + persisted model + query endpoint
- Partial: capture/persistence exists but query or dedicated model is missing
- Missing: no dedicated persistence model and no dedicated query endpoint

## Matrix

| Domain | Userscript Capture Signal | API Import / Persistence | API Query | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Arena / Grand Arena / Titan Arena | Arena tracker + recommendation overlay metadata | BrowserSyncData arena fields + battles tables | `/api/sync/battles`, `/api/sync/battles/recommendations`, `/api/sync/teams/recommendations*` | Implemented | Core recommendation path present |
| Guild War / Raid Boss Battles | Guild/raid execution helpers | Guild war + raid models imported | `/api/sync/guild-war-battles`, `/api/sync/raid-boss-attacks` | Implemented | Query + import parity in place |
| Hero/Titan/Pet Roster | Tracker registries and hero/titan helpers | Hero/Titan/Pet snapshots imported | `/api/sync/heroes`, `/api/sync/titans`, `/api/sync/pets` | Implemented | |
| Inventory snapshots/usages/equipment | Inventory tracking helpers | InventorySnapshot + usage + equipment models imported | `/api/sync/inventory` | Implemented | |
| Quests / Daily / Guild quest | Quest tracking helpers | Quest + daily activity models imported | `/api/sync/daily-activity` | Implemented | |
| Mission progression | Gameplay/progression handlers | MissionProgress imported | `/api/sync/mission-progress` | Implemented | Added in this session |
| Shop purchases | Economy/activity helpers | ShopPurchase imported | `/api/sync/shop-purchases` | Implemented | Added in this session |
| Tower / Dungeon progression | Progression helpers + tower metadata usage | TowerProgress imported | `/api/sync/tower-progress` | Implemented | Added in this session |
| Expedition battles | Progression/activity helpers | ExpeditionBattle imported | `/api/sync/expeditions` | Implemented | Added in this session |
| Guild activity + participation views | Guild tracking and participation helper modules | GuildActivity + participation models available | `/api/sync/guild-activities`, `/api/sync/guild-participation` | Implemented | Added in this session |
| Chat | Core registry notes chat flow; chat models exist | Chat models in DB | `/api/sync/chat-messages` | Partial | Capture-to-import wiring still needs explicit verification |
| Mail | `mailGetAll` + `mailCollect`/`mailFarm` handlers | MailMessage + MailReward persisted via sync payload | `/api/sync/mail`, `/api/sync/mail/rewards` | Implemented | Added server-side mail slice |
| Airship | `zeppelinGiftGet` handler metadata capture | AirshipGift entity imported via sync payload | `/api/sync/airship` | Implemented | Added dedicated airship gift tracking slice |
| ToE (Tower of Eternity as dedicated domain) | Recommendation overlay supports `toe` mode | No dedicated ToE persistence model (tower is generic) | Recommendation-only (`/teams/recommendations`) | Partial | Needs dedicated tracking model if desired |
| Consumable opening normalized record | Consumable opening helpers present | Consumable reward sync record ingested and linked to chests | `/api/sync/chests` | Partial | Consider dedicated consumable query endpoint |

## Immediate Slice Backlog

1. ToE dedicated persistence slice

- Add dedicated ToE progress/event model instead of generic tower-only projection
- Add `/api/sync/toe` query endpoint + tests

1. Consumables query slice

- Add `/api/sync/consumables` endpoint over normalized consumable reward rows
- Add filter params for source type/source id/item id

## Evidence Pointers

- Userscript tracker modules under `userscript/src/modules/trackers/` show broad domain capture seams
- Mail notification hook is visible in `userscript/src/index.js` via `push:updateMail`
- API import orchestrator is in `api/Services/SyncService.cs`
- Query surface is in `api/Controllers/SyncQueryController.cs`
- Coverage summary endpoint is in `GET /api/sync/tracking/coverage`
