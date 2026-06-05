## Summary
Additional API/UI reporting visualizations slice: add the first chart/report-card page powered by server-side aggregates.

## Scope
- Add reporting-overview JSON endpoint for recent daily aggregates.
- Add reporting-overview HTML page with first chart + cards.
- Link page from API UI shell.
- Add focused integration tests.

## Acceptance Criteria
- GET /ui/reporting-overview returns chart-friendly JSON.
- GET /ui/reporting-overview-page renders chart/report cards.
- Tests validate both endpoints.
