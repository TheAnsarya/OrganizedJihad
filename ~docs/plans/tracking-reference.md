# Tracking Reference — Complete Data Model

This document describes every data type tracked by OrganizedJihad and how it flows from the browser to the database.

## Battle Types

### Arena (`ArenaBattle`)

Standard PvP arena battles.

| Field | Type | Description |
|-------|------|-------------|
| `OpponentId` | long | Game ID of the opponent |
| `OpponentName` | string | Display name |
| `OpponentPower` | long | Opponent team power |
| `AttackTeam` | string (JSON) | Attacker's hero composition |
| `DefenseTeam` | string (JSON) | Defender's hero composition |
| `IsWin` | bool | Whether the player won |
| `RankBefore` / `RankAfter` | int | Arena rank change |
| `CoinsEarned` | int | Arena coins earned |
| `Timestamp` | DateTime | When the battle occurred |

### Grand Arena (`GrandArenaBattle`)

Multi-team PvP format (3 teams of 5 heroes).

Additional fields: `AttackTeam1/2/3`, `DefenseTeam1/2/3`, `WinsCount`, `LossesCount`

### Titan Arena (`TitanArenaBattle`)

Titan PvP battles with element tracking.

Additional fields: `TitanTeam` (JSON), titan-specific rank tracking

### Guild War (`GuildWarBattle`)

War attacks against guild fortifications.

Additional fields: `WarId`, `FortificationIndex`, `StarsEarned`, guild war-specific data

### Raid Boss (`RaidBossAttack`)

Guild raid boss attacks — Osh and Maestro.

Additional fields: `BossName`, `DamageDealt`, `DamageDetails`, `TitaniteEarned`, `RewardsJson`

### Expedition (`ExpeditionBattle`)

PvE expedition boss battles.

Additional fields: `BossIndex`, `DamageDealt`, `RewardsJson`

## Chest System

### Chest Opening (`ChestOpening`)

Every chest opened is recorded.

| Field | Type | Description |
|-------|------|-------------|
| `ChestType` | string | Raw type: heroic, gold, titan, artifactChest, titanArtifactChest, petChest, lootBox, towerChest, outlandChest |
| `OpenMethod` | string | How it was opened (free, key, emeralds) |
| `Quantity` | int | Number of chests opened (batch) |
| `Timestamp` | DateTime | When opened |

### Chest Drop (`ChestDrop`)

Individual items received from a chest opening.

| Field | Type | Description |
|-------|------|-------------|
| `ChestOpeningId` | long | FK to parent ChestOpening |
| `ItemId` | string | Game item ID |
| `ItemName` | string | Display name |
| `Quantity` | int | Number received |
| `Rarity` | string | common, uncommon, rare, epic, legendary |
| `ItemType` | string | Category of the item |
| `EstimatedValue` | int? | Estimated resource value |

## Resource Tracking

### Resource Transaction (`ResourceTransaction`)

Every gain and loss of any currency.

| Field | Type | Description |
|-------|------|-------------|
| `ResourceType` | string | emeralds, gold, arena_coins, grand_arena_coins, guild_coins, tower_coins, titan_coins |
| `Amount` | int | Positive = gained, negative = spent |
| `Source` | string | Where it came from: battle, shop, quest, chest, daily_login, guild_reward, etc. |
| `SourceDetails` | string | Additional context |
| `BalanceAfter` | int? | Resource balance after transaction |
| `Timestamp` | DateTime | When it occurred |

## Shop & Merchant

### Shop Purchase (`ShopPurchase`)

| Field | Type | Description |
|-------|------|-------------|
| `ShopType` | string | arena, guild, tower, merchant, outland, titan |
| `ItemId` | string | Game item ID |
| `ItemName` | string | Display name |
| `Quantity` | int | Amount purchased |
| `CostType` | string | Currency used (gold, emeralds, arena_coins, etc.) |
| `CostAmount` | int | Price paid |
| `Timestamp` | DateTime | When purchased |

## Inventory

### Inventory Snapshot (`InventorySnapshot`)

Point-in-time snapshot of entire inventory.

| Field | Type | Description |
|-------|------|-------------|
| `InventoryData` | string (JSON) | Full inventory as JSON with sections: `hero_soul_stones`, `titan_soul_stones`, `pet_soul_stones`, `evolution_items`, `consumables`, `chests` |
| `TotalHeroSoulStones` | int | Denormalized count |
| `TotalTitanSoulStones` | int | Denormalized count |
| `TotalPetSoulStones` | int | Denormalized count |
| `TotalEvolutionItems` | int | Denormalized count |
| `TotalConsumables` | int | Denormalized count |
| `TotalChests` | int | Denormalized count |

### Inventory Item Usage (`InventoryItemUsage`)

Consumption of items.

| Field | Type | Description |
|-------|------|-------------|
| `ItemId` | string | Game item ID |
| `ItemName` | string | Display name |
| `Category` | string | Item category |
| `QuantityUsed` | int | Amount consumed |
| `UsageContext` | string | Where/why it was used |
| `TargetEntity` | string | Hero/titan it was used on |
| `Timestamp` | DateTime | When used |

### Equipment Change (`EquipmentChange`)

Gear equipping, upgrading, and evolving.

| Field | Type | Description |
|-------|------|-------------|
| `HeroId` | long | Hero the equipment was applied to |
| `HeroName` | string | Hero display name |
| `SlotIndex` | int | Equipment slot |
| `EquipmentName` | string | Item name |
| `ChangeType` | string | equip, upgrade, evolve |
| `HeroColorRank` | string | Hero's color rank at time of change |
| `Timestamp` | DateTime | When it occurred |

## Hero / Titan / Pet Tracking

### Hero Snapshot (`HeroSnapshot`)

Full hero state at a point in time: Level, Stars, Color, Power, Skills (JSON), Artifacts (JSON), Glyphs (JSON).

### Hero Upgrades

Separate models for each upgrade type: `HeroLevelUp`, `HeroStarPromotion`, `HeroColorEvolution`, `HeroSkillUpgrade`, `HeroArtifactUpgrade`.

### Titan Snapshot (`TitanSnapshot`)

Full titan state: Level, Stars, Power, Element (auto-resolved), Skills (JSON), Artifacts (JSON), Skins (JSON).

### Pet Snapshot (`PetSnapshot`)

Pet state: Stars, Power, Level, Patronage data.

## Daily Activities

- `DailyQuestCompletion` — Individual daily quest completions with rewards
- `GuildQuestCompletion` — Guild-specific quest completions
- `LoginReward` — Daily login reward tracking (day number, reward details)

## Guild Tracking

- `GuildMember` — Full guild roster with snapshots over time (soft-deletable)
- `GuildWarParticipation` — Per-member war attack/defense stats
- `GuildRaidParticipation` — Per-member raid damage and titanite earned
- `GuildDungeonParticipation` — Titan charges, stages, damage
- `TitaniteTransaction` — Titanite earning and spending
- `ChatMessage` — Guild and private chat archiving (soft-deletable)

## Player State

### Player Snapshot (`PlayerSnapshot`)

Account-level state captured periodically.

Key fields: `Level`, `Power`, `Emeralds` (from `starmoney`), `Gold`, `ArenaCoins`, `GrandArenaCoins`, `GuildCoins`, `TitanArenaCoins`, `ArenaRank`, `GrandArenaRank`, `TitanArenaRank`

## Entity Base Classes

| Base Class | Usage | Fields Added |
|-----------|-------|-------------|
| `CreationAuditableEntity` | Immutable records | `Id`, `CreatedAt` |
| `AuditableEntity` | Mutable records | `Id`, `CreatedAt`, `UpdatedAt` |
| `SoftDeletableEntity` | Soft-delete | `Id`, `CreatedAt`, `UpdatedAt`, `IsDeleted`, `DeletedAt` |
