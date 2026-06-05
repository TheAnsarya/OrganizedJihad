## Summary
Implement initial automated daily report generation surface for local operators via API UI.

## Scope
- Add daily report JSON endpoint under /ui.
- Add daily report HTML page under /ui.
- Aggregate key daily metrics from existing tracked entities (battles, quests, rewards, purchases, sync status).
- Link the report from the API control page.
- Add integration tests and docs/session log updates.

## Acceptance Criteria
- GET /ui/daily-report returns JSON payload with UTC date + key counters.
- GET /ui/daily-report-page returns HTML summary page rendering same values.
- API control UI exposes link/button to daily report page.
- Tests validate endpoint shape and page availability.
