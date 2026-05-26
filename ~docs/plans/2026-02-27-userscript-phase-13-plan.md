# Userscript Phase 13 Plan — February 27, 2026

## Objectives
- Address remaining performance, bug, and test coverage issues from backlog
- File new issues for audit findings (e.g., syncTimestamp bug, test coverage gaps)
- Continue refactoring and modularization (e.g., extract handler groups)
- Improve session logging and documentation

## Immediate Backlog
- #143: Bug: getHistoricalComparison returns stale data
- #139: Performance: apiMonitor request log cleanup
- #138: Bug: processAPIResponse not returning correct handler result
- #137: Performance: _apiSamples Map unbounded
- #134: Race condition: renderView() handler
- #133: Memory leak: UIManager and API listeners
- #132: Performance: Dashboard loads ALL data
- #131: Enhancement: Comprehensive battle tracking
- #130: Enhancement: No user-visible feedback on sync failure
- #129: Enhancement: IndexedDB missing defensive handlers
- #125: Test coverage: Phase 12+ features
- #102: Refactor: Extract gameTracker handler groups
- #99: Test coverage: heroNames.js — edge cases

## New Issues To File
- Bug: syncClient never persisted lastSync due to property name mismatch (syncTimestamp vs timestamp)
- Enhancement: Add tests for batch IDB operations and incremental sync
- Enhancement: Document timestamp format for all stores in API-Call-Reference
- Enhancement: Add session log auto-generation to userscript build

## Session Logging
- Update `~docs/copilot-chats/2025-02-27-performance-incremental-sync.md` with final commit hashes and push status
- Ensure all future sessions produce a log in `~docs/copilot-chats/`

## Next Steps
1. File new issues from audit findings
2. Continue working on #143, #139, #138, #137, #134, #133, #132, #131, #130, #129, #125, #102, #99
3. Update session log and planning docs
4. Refactor handler groups in gameTracker.js (#102)
5. Add missing tests (#125, #99)
