# OrganizedJihad - Reusable AI Prompts

**Last Updated**: 2025-01-23
**Project**: OrganizedJihad (OJ) - Hero Wars Comprehensive Tracker
**Repository**: TheAnsarya/OrganizedJihad

---

## Quick Reference

Before using any prompt, ensure:

1. The workspace is open at `C:\Users\me\source\repos\OrganizedJihad`
2. The `.github/copilot-instructions.md` is attached/visible
3. You're on the correct git branch

---

## Standard Directives Block

> Copy this block into every session for consistent behavior.

```text
[OJ - Organized Jihad]

DIRECTIVES:
- Follow `.github/copilot-instructions.md` and `.editorconfig` strictly
- Use CRLF, tabs (4), UTF-8 for all files
- K&R brace style (opening brace on same line)
- File-scoped namespaces for C#
- .NET 10, C# 13+, EF Core 9, ES2024+ for JS
- Comprehensive XML docs for C# public members, JSDoc for JS
- Use `yarn` not `npm` for userscript
- Single quotes for JS, semicolons always
- PascalCase public, _camelCase private fields, I prefix interfaces
- Comment everything including code inside methods
- Include links to relevant documentation in comments
- Create GitHub issues BEFORE making changes
- Update session logs in `~docs/copilot-chats/`
```

---

## Category 1: Data Layer (Entity Models & EF Core)

### Add a New Entity Model

```text
[OJ] Create a new entity model in `data/Models/` for tracking [FEATURE].

Requirements:
- Inherit from CreationAuditableEntity (immutable events) or AuditableEntity (mutable records)
- Use SoftDeletableEntity if records can be logically deleted
- Add [Key] int Id, all relevant game data properties
- Use [MaxLength] on all string properties
- Store complex nested data as JSON strings
- Add comprehensive XML documentation on every property
- Include references to Hero Wars wiki where applicable
- Create a GitHub issue first, then implement

After creating the model:
1. Add DbSet<T> to GameDatabaseContext.cs
2. Add OnModelCreating configuration with composite indexes on (EntityId, Timestamp) and (PlayerId, Timestamp)
3. Add DTO list property to BrowserSyncData.cs
4. Add counter to ImportCounts and total to DatabaseStats (update TotalRecords)
5. Add import method to SyncService.cs with deduplication logic
6. Create unit tests in tests/OrganizedJihad.Data.Tests/
7. Generate EF Core migration: dotnet ef migrations add <Name> --project data --startup-project api
```

### Add a Migration

```text
[OJ] Generate an EF Core migration for the latest model changes.

Run: dotnet ef migrations add <DescriptiveName> --project data --startup-project api
Then verify the migration file looks correct.
Do NOT apply the migration (dotnet ef database update) unless I ask.
```

### Modify Existing Entity

```text
[OJ] Add property [PROPERTY_NAME] ([TYPE]) to [ENTITY_NAME] in data/Models/.

After adding the property:
1. Update OnModelCreating if indexes needed
2. Update BrowserSyncData DTO if synced from browser
3. Update SyncService import logic if applicable
4. Update any existing tests
5. Generate EF Core migration
6. Create GitHub issue first
```

---

## Category 2: API Layer (Controllers & Services)

### Add a New API Endpoint

```text
[OJ] Add a new endpoint to SyncController.cs:
- HTTP method: [GET/POST]
- Route: /api/sync/[route]
- Purpose: [description]
- Parameters: [query params or body]
- Response: [describe shape]

Requirements:
- Add service method in SyncService.cs first
- Use AsNoTracking() for read-only queries
- Use IDbContextFactory for thread-safe context creation
- Include comprehensive XML docs with example response
- Add ProducesResponseType attributes
- Wrap in try/catch with proper error logging
- Add tests in OrganizedJihad.Api.Tests
- Create GitHub issue first
```

### Add Import Method to SyncService

```text
[OJ] Add an import method to SyncService.cs for [ENTITY_TYPE].

Follow the existing pattern:
1. Accept List<EntityType> parameter
2. Use IDbContextFactory to create context
3. Implement deduplication using AnyAsync with unique key combination
4. Log import count with ILogger
5. Return int count of imported records
6. Wire up in ImportBrowserDataAsync orchestrator
7. Add corresponding property to BrowserSyncData, ImportCounts, DatabaseStats
8. Create GitHub issue first
```

### Add Query Method to SyncService

```text
[OJ] Add a query method to SyncService.cs for retrieving [DATA_TYPE].

Requirements:
- Accept optional filter parameters (entityId, playerId, dateRange, limit)
- Use AsNoTracking() for read-only queries
- Order by Timestamp descending (newest first)
- Use Take(limit) for pagination
- Return object (anonymous type or DTO)
- Add corresponding controller endpoint
```

---

## Category 3: Testing

### Add Unit Tests for Entity

```text
[OJ] Create unit tests for [ENTITY_NAME] in tests/OrganizedJihad.Data.Tests/.

Follow the existing test pattern:
- Use IDisposable with InMemory database (unique Guid name)
- Test basic CRUD operations for each entity type
- Test audit field population (DateCreated)
- Test query patterns (filter by ID, date range, category)
- Use FluentAssertions (.Should())
- Include XML documentation on test class and methods
- Create GitHub issue first
```

### Add Integration Tests for API

```text
[OJ] Create integration tests for [ENDPOINT] in tests/OrganizedJihad.Api.Tests/.

Follow SyncServiceTests pattern:
- Use TestDbContextFactory with InMemory database
- Mock ILogger with Moq
- Test service method directly (not through HTTP)
- Test filtering, pagination, deduplication
- Use FluentAssertions
- For anonymous type results, use reflection to access properties
```

### Run All Tests

```text
[OJ] Build the solution and run all tests. Report results.

dotnet build --no-restore
dotnet test --no-restore

Expected: 55+ tests all passing, 0 warnings
```

---

## Category 4: Userscript (TamperMonkey)

### Add Event Capture

```text
[OJ] Update the TamperMonkey userscript to capture [EVENT_TYPE] from the Hero Wars API.

Steps:
1. Identify the API endpoint/response that contains this data
2. Add interception logic in src/modules/apiMonitor.js
3. Transform game data to match BrowserSyncData DTO structure
4. Add to sync payload in src/modules/syncClient.js
5. Store locally in src/modules/storageManager.js (IndexedDB)
6. Add JSDoc comments with API endpoint documentation
7. Test in TamperMonkey before committing
8. Create GitHub issue first

Use yarn build for production, yarn dev for watch mode.
```

### Debug Userscript

```text
[OJ] Debug the userscript capture for [FEATURE].

1. Check src/modules/apiMonitor.js for the API endpoint pattern
2. Verify the data transformation matches the C# DTO
3. Check browser console for errors
4. Verify sync payload structure matches BrowserSyncData
5. Test against the local API at http://localhost:5000/api/sync/health
```

---

## Category 5: Desktop App (MAUI Blazor)

### Add a Blazor Page

```text
[OJ] Add a new Blazor page to the desktop app for [FEATURE].

Steps:
1. Create .razor file in desktop-app/Components/Pages/
2. Create code-behind .razor.cs if complex
3. Add navigation link in NavMenu or MainLayout
4. Use API client service to fetch data from local API
5. Add responsive layout with proper Blazor components
6. Follow project code style (tabs, comments)
7. Create GitHub issue first
```

---

## Category 6: Infrastructure & Maintenance

### Full Build & Verify

```text
[OJ] Do a full build, run all tests, check for warnings, and verify everything is clean.

dotnet build
dotnet test
dotnet format --verify-no-changes (optional)

Report: test count, pass/fail, warnings, errors
```

### Format All Files

```text
[OJ] Run the formatting script to normalize all files.

.\Format-AllFiles.ps1 -DryRun  (preview first)
.\Format-AllFiles.ps1          (apply)
dotnet format                  (C# formatting)
```

### Create/Close GitHub Issues

```text
[OJ] Review the current work and GitHub issues.

1. Run: gh issue list --state all
2. Close any completed issues: gh issue close <N> --comment "reason"
3. Create new issues for remaining work items
4. Use labels: infrastructure, data-layer, api, testing, benchmarks, tracking, documentation
5. Follow branch naming: feature/<issue-number>-description
```

### Git Commit & Push

```text
[OJ] Stage, commit, and push all current changes.

1. git status (review changes)
2. git add -A
3. git commit -m "Fix #<issue>: <description>"
4. git push

Commit messages should reference GitHub issues.
```

### Session Wrap-up

```text
[OJ] Create a session log for today's work.

Create `~docs/copilot-chats/YYYY-MM-DD-<topic>.md` with:
- Date, branch, issues worked
- Summary of changes
- Files created/modified
- Architecture decisions made
- What was completed
- Next steps

Also update the prompts log in `~docs/oj-manual-prompts-log.txt`.
```

---

## Category 7: Comprehensive Work Sessions

### Continue Development

```text
[OJ] Continue development on the project.

1. Check current branch: git branch
2. Check open issues: gh issue list
3. Check for uncommitted changes: git status
4. Review what was done last: check ~docs/copilot-chats/ for most recent log
5. Pick the next issue to work on
6. Create a GitHub issue if one doesn't exist
7. Implement the changes
8. Write tests
9. Build and verify
10. Update session log
11. Commit with issue reference
```

### Major Feature Implementation

```text
[OJ] Implement [FEATURE] end-to-end.

This is a large feature requiring changes across multiple tiers:

1. **Plan**: Create GitHub issue with acceptance criteria
2. **Data Layer**: Add entity models, DbContext registration, migration
3. **API Layer**: Add DTOs, import methods, query endpoints
4. **Userscript**: Add API interception and sync payload updates
5. **Desktop**: Add visualization page (if applicable)
6. **Tests**: Unit tests for data layer, integration tests for API
7. **Benchmarks**: Add relevant benchmarks if performance-sensitive
8. **Docs**: Update session log, close issue
9. **Verify**: Full build, all tests pass

Create GitHub issues for each major step before starting.
```

### Bulk Update Session

```text
[OJ] Perform a comprehensive update session:

1. Assess current state (git status, gh issue list, dotnet build, dotnet test)
2. Create GitHub issues for all planned work
3. Work through issues in priority order
4. Write tests as you go
5. Create a session log
6. Create a git commit per logical unit
7. Report final status: tests, build, issues closed
```

---

## Category 8: Research & Analysis

### Analyze Hero Wars API

```text
[OJ] Research the Hero Wars API to identify new data we should track.

Look at:
- Reference code in ~reference-code/
- Existing apiMonitor.js patterns
- HW wiki: https://hw-mobile.fandom.com/
- Current BrowserSyncData fields vs what the game API provides

Report:
- API endpoints we're not capturing yet
- Data fields available but not tracked
- Recommended new entity models
```

### Performance Analysis

```text
[OJ] Run benchmarks and analyze performance.

dotnet run --project benchmarks/OrganizedJihad.Benchmarks -c Release

Review results for:
- Insert performance (single vs batch)
- Query performance (tracked vs untracked)
- Deduplication overhead
- Upsert patterns

Add new benchmarks if gaps are identified.
```

---

## Appendix: Entity Model Patterns

### Immutable Event Record (use CreationAuditableEntity)

- Battle logs, upgrade events, quest completions, chest openings
- Only DateCreated/CreatedBy audit fields
- Never updated after creation

### Mutable State Record (use AuditableEntity)

- Player snapshots, hero/titan state, inventory snapshots
- Has DateCreated, DateModified, CreatedBy, ModifiedBy
- May be updated on re-sync

### Soft-Deletable Record (use SoftDeletableEntity)

- Goals, calendar events, guild members
- Has IsDeleted, DateDeleted, DeletedBy
- Logical deletion without data loss

### Deduplication Patterns

- **Upgrade events**: Deduplicate by (EntityId + Timestamp)
- **Quest completions**: Deduplicate by (PlayerId + QuestId + CompletedAt)
- **Login rewards**: Deduplicate by (PlayerId + ClaimedAt)
- **Daily summaries**: Upsert by (PlayerId + SummaryDate)
- **Inventory usage**: Deduplicate by (PlayerId + ItemId + Timestamp)
- **Equipment changes**: Deduplicate by (HeroId + SlotIndex + Timestamp)
