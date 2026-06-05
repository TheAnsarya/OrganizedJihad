<!-- Use this file to provide workspace-specific custom instructions to Copilot. -->

## Project: OrganizedJihad (OJ) - Hero Wars Comprehensive Tracker

A two-tier game tracking solution for Hero Wars that captures, stores, and analyzes ALL gameplay data including account state, battles, hero/titan upgrades, inventory usage, daily/guild quests, and more.

### Architecture Overview

**Tier 1 - Browser Userscript** (`userscript/`): TamperMonkey userscript that intercepts Hero Wars API requests/responses in the browser and syncs captured data to the local API.

**Tier 2 - API Backend** (`api/`): ASP.NET Core Web API that receives sync data from the browser userscript and persists it to the database.

**Data Layer** (`data/`): Entity Framework Core with SQLite, containing all game entity models, migrations, audit interceptors, and database context.

**Tests** (`tests/`): xUnit test projects for API and Data layers with FluentAssertions.

**Benchmarks** (`benchmarks/`): BenchmarkDotNet performance tests for data layer operations.

---

## Code Style & Formatting Rules

**CRITICAL**: Always follow these formatting preferences:

- **Line Endings**: CRLF (`\r\n`) on all files (LF for `.sh` files only)
- **Indentation**: TABS (not spaces) with tab width of 4
- **Charset**: UTF-8
- **Brace Style**: K&R (opening brace on same line, `} else {`)
- **Target Framework**: .NET 10
- **C# Version**: Latest (C# 13+)
- **Modern Standards**: Use ES2024+ features for JavaScript, async/await, optional chaining, nullish coalescing
- **Comments**: Comprehensive comments including XML docs for C#, JSDoc for JS, inline explanations
- **Package Manager**: **ALWAYS use `yarn`** — never use `npm` or `npx`. Use `yarn` for install/add/remove, `yarn <script>` for scripts, and `yarn dlx` instead of `npx` for one-off executables.
- **Quote Style**: Single quotes for JS strings
- **Semicolons**: Always use semicolons
- **Naming**: PascalCase for public members, `_camelCase` for private fields, `I` prefix for interfaces
- **Namespaces**: File-scoped (enforced by `.editorconfig`)

---

## Mandatory Issue-First Workflow

1. **Before any work**: Ensure a GitHub Issue exists describing the task
2. **Branch naming**: `feature/<issue-number>-description` or `fix/<issue-number>-description`
3. **Commit messages**: Reference issue number (e.g., `Fix #42: Add battle tracking`)
4. **Prompt tracking**: Log significant AI-assisted sessions in `~docs/copilot-chats/`

## Mandatory Branch Workflow

- Never perform general implementation work directly on `main`.
- Always create/switch to a scoped sub-branch first, using issue-aligned naming:
  - `feature/<issue-number>-description`
  - `fix/<issue-number>-description`
- Keep `main` for integration/merge only.

## AI Workflow Overrides (Repository-Specific)

- `~docs/oj-manual-prompts-log.txt` is a manually maintained file.
- AI MUST NEVER edit, stage, or commit `~docs/oj-manual-prompts-log.txt`.
- AI should ignore that file if it appears modified and continue with requested work (including push/PR/commits) without pausing for confirmation.
- For unrelated dirty files in general, ALWAYS continue by committing only intended files.
- Do not pause for confirmation when unexpected unrelated modifications are present.
- Only request confirmation if the user explicitly asks for a full-clean-tree gate.

---

## Session Logging (MANDATORY)

**Every Copilot session MUST produce or update a session log** in `~docs/copilot-chats/`.

- **File naming**: `YYYY-MM-DD-<short-description>.md` (e.g., `2026-02-21-overlay-window-fixes.md`)
- **Content must include**:
  - Date and session number
  - Summary of what was accomplished
  - List of files created or modified
  - GitHub issues created, referenced, or closed
  - Key decisions made and rationale
  - Any known issues or follow-up items
- **Update at the end of every session** — do not skip this step
- If a session spans multiple conversations, append to the existing log for that date

---

## Project Structure

```
OrganizedJihad/
├── .editorconfig                   # Comprehensive formatting rules (tabs, K&R, C# conventions)
├── .gitattributes                  # Line ending normalization
├── .gitignore                      # Build artifacts, node_modules, databases, benchmark output
├── .markdownlint.json              # Markdown linting configuration
├── .github/
│   └── copilot-instructions.md     # THIS FILE - AI coding directives
├── OrganizedJihad.sln              # Solution file
├── Format-AllFiles.ps1             # PowerShell script to normalize formatting
│
├── api/                            # ASP.NET Core Web API (Tier 3)
│   ├── OrganizedJihad.Api.csproj
│   ├── Program.cs
│   ├── Controllers/
│   │   └── SyncController.cs       # Import/query endpoints
│   ├── Models/
│   │   └── BrowserSyncData.cs      # DTOs for sync
│   └── Services/
│       └── SyncService.cs          # Business logic for data import
│
├── data/                           # EF Core Data Layer
│   ├── OrganizedJihad.Data.csproj
│   ├── GameDatabaseContext.cs       # DbContext with 30+ DbSets
│   ├── GameDatabaseContextFactory.cs
│   ├── Entities/                    # Base entity classes (Auditable, SoftDeletable)
│   ├── Interceptors/                # AuditInterceptor for automatic timestamps
│   ├── Interfaces/                  # IAuditableEntity, ISoftDelete, etc.
│   ├── Models/                      # All game entity models
│   │   ├── PlayerSnapshot.cs        # Account state snapshots
│   │   ├── ArenaBattle.cs           # Arena battles
│   │   ├── ArenaModels.cs           # Grand Arena, Titan Arena battles
│   │   ├── BattleModels.cs          # Guild War, Raid Boss attacks
│   │   ├── HeroModels.cs            # Hero snapshots, Inventory snapshots
│   │   ├── TitanModels.cs           # Titan snapshots
│   │   ├── PetModels.cs             # Pet snapshots
│   │   ├── ChestModels.cs           # Chest openings and drops
│   │   ├── ActivityModels.cs        # Quests, Missions, Shop, Tower, Expeditions, Resources, Guild
│   │   ├── ChatModels.cs            # Chat messages and activity summaries
│   │   ├── GuildMemberModels.cs     # Guild members, war/raid/dungeon participation
│   │   ├── Opponent.cs              # Tracked opponents
│   │   ├── UserData.cs              # Goals, Calendar events
│   │   ├── SyncMetadata.cs          # Sync state tracking
│   │   ├── HeroUpgradeModels.cs     # Hero upgrade events (level, star, color, skill, artifact)
│   │   ├── TitanUpgradeModels.cs    # Titan upgrade events
│   │   ├── DailyActivityModels.cs   # Daily quests, guild quests, login rewards
│   │   └── InventoryModels.cs       # Inventory item usage, equipment changes
│   └── Migrations/
│
├── userscript/                      # TamperMonkey Userscript (Tier 1)
│   ├── package.json
│   ├── webpack.config.cjs
│   └── src/
│       ├── index.js                 # Entry point with TamperMonkey metadata
│       ├── modules/
│       │   ├── apiMonitor.js        # API request interception
│       │   ├── gameTracker.js       # Game data tracking
│       │   ├── syncClient.js        # Sync to local API
│       │   ├── storageManager.js    # Data persistence
│       │   └── ...
│       └── styles/
│
├── tests/                           # Test projects
│   ├── OrganizedJihad.Data.Tests/   # Data layer unit tests
│   ├── OrganizedJihad.Api.Tests/    # API integration tests
│   └── OrganizedJihad.Tests/        # Comprehensive cross-cutting tests
│
├── benchmarks/                      # Performance benchmarks
│   └── OrganizedJihad.Benchmarks/   # BenchmarkDotNet project
│
└── ~docs/                           # Documentation and planning
    ├── plans/                       # Architecture and feature plans
    ├── copilot-chats/               # AI session logs
    └── ...
```

---

## What We Track (Comprehensive)

### Account State
- **Player Snapshots**: Level, power, resources (gold, emeralds, arena coins, etc.), ranks
- **Inventory Snapshots**: Full inventory state at point-in-time, item counts by category

### Battles (All Types)
- **Arena**: Opponent, teams, win/loss, rank changes, coins earned
- **Grand Arena**: Multi-team battles with attack/defense compositions
- **Titan Arena**: Titan team compositions, rank changes
- **Guild War**: War ID, fortification, team compositions, stars
- **Raid Boss**: Boss attacks, damage dealt, team composition, rewards
- **Expedition**: Boss battles, damage, rewards

### Hero/Titan/Pet Tracking
- **Hero Snapshots**: Level, stars, color, power, skills, artifacts, glyphs
- **Hero Upgrades**: Every level-up, star promotion, color evolution, skill upgrade, artifact upgrade
- **Titan Snapshots**: Level, stars, power, skills, artifacts, element, skins
- **Titan Upgrades**: Level-up, star promotion, skill upgrades
- **Pet Snapshots**: Stars, power, level, patronage data

### Inventory & Resources
- **Resource Transactions**: Every gain/spend of any resource with source tracking
- **Inventory Item Usage**: Consumption of potions, fragments, scrolls, etc.
- **Equipment Changes**: Gear equipping, upgrading, and evolving
- **Shop Purchases**: What was bought, cost, shop type
- **Chest Openings**: Every chest opened with individual drop tracking

### Daily Activities
- **Daily Quests**: Completion tracking with rewards
- **Guild Quests**: Guild-specific quest completions
- **Login Rewards**: Daily login reward tracking
- **Mission Progress**: Campaign mission stars and completions
- **Tower Progress**: Tower floor progression

### Guild Activities
- **Guild Members**: Full roster tracking with snapshots over time
- **Guild War Participation**: Per-member attack/defense stats
- **Guild Raid Participation**: Per-member damage and titanite earned
- **Guild Dungeon Participation**: Titan charges, stages, damage
- **Titanite Transactions**: Earning and spending of titanite
- **Guild Activities**: General guild event tracking
- **Chat Messages**: Guild and private chat archiving

---

## Build Commands

### .NET Projects
- `dotnet build` — Build entire solution
- `dotnet test` — Run all tests
- `dotnet run --project api` — Start the API server
- `dotnet run --project benchmarks/OrganizedJihad.Benchmarks` — Run benchmarks

### Userscript
- `yarn build` — Production build
- `yarn dev` — Development build with watch mode
- `yarn lint` — Run ESLint
- `yarn test` — Run Jest tests
- `yarn format` — Format all files with Prettier

### Utilities
- `.\Format-AllFiles.ps1` — Normalize all files to tabs/CRLF/UTF-8
- `.\Format-AllFiles.ps1 -DryRun` — Preview formatting changes

---

## Development Guidelines

1. All C# code must include comprehensive XML documentation comments
2. All JavaScript code must include JSDoc comments
3. Use modern C# features (file-scoped namespaces, pattern matching, records where appropriate)
4. Use modern ES2024+ syntax for JavaScript
5. Follow the established entity model pattern for new data types
6. All new entities must inherit from `CreationAuditableEntity` (immutable) or `AuditableEntity` (mutable)
7. Soft-deletable entities inherit from `SoftDeletableEntity`
8. Every new entity needs corresponding tests
9. Include links to documentation in comments where applicable
10. Deduplication logic is required for all import methods
11. Keep the UI responsive and performant
12. Test changes in TamperMonkey before committing userscript changes

---

## Performance Considerations

- Use `AsNoTracking()` for read-only queries
- Batch database operations within transactions
- Implement deduplication checks before inserts
- Use composite indexes for frequently queried combinations
- Keep snapshot data as JSON strings for complex nested data
- Profile with BenchmarkDotNet before optimizing

---

## Current Phase: Comprehensive Tracking Enhancement

**Focus Areas**:
1. ✅ Core entity models for all battle types
2. ✅ Guild member and participation tracking
3. ✅ Chat message archiving
4. ✅ Hero/Titan upgrade event tracking
5. ✅ Daily/Guild quest tracking
6. ✅ Inventory usage tracking
7. ✅ Mail tracking and reward collection
8. ✅ API handler coverage — 190+ handler registrations covering virtually all known API methods
9. ✅ Dashboard overhaul — player info, arena ranks, campaign, battle pass, gacha, guild activity
10. ✅ Pets tab — avatars, Color column, soul stones progress
11. ✅ Titans tab — avatars, artifacts, totem stats
12. ✅ Battle tracking — damage/healing/petId in compressed teams, expandable detail rows
13. 🔄 Comprehensive test coverage (569/16 — heroNames, syncClient, apiMonitor added)
14. 🔄 Performance benchmarking
15. 🔄 Refactor: Extract gameTracker.js handler groups into tracker modules (#102)
16. ⬜ Additional API/UI reporting visualizations
17. ⬜ Automated daily report generation
