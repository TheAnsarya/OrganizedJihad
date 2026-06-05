# Daily Report Slice - Issue #376 (2026-06-04)

## Summary

Add an initial automated daily report generation surface in API UI so local operators can quickly inspect daily tracked activity without opening multiple endpoints.

## Scope

- Add JSON endpoint: `GET /ui/daily-report`
- Add HTML page endpoint: `GET /ui/daily-report-page`
- Add `daily-report.html` template with high-signal counters
- Add links from API control shell page
- Add focused API integration tests for JSON/page availability and payload shape

## Metrics Included

- Player snapshots
- Battle counts by mode and total
- Chest openings
- Quest completion events (core + daily + guild)
- Shop purchases
- Resource transactions
- Hero and titan upgrade event totals
- Inventory usage events
- Chat messages
- Last sync UTC and report generated UTC

## Validation

- `dotnet test tests/OrganizedJihad.Api.Tests/OrganizedJihad.Api.Tests.csproj --filter "FullyQualifiedName~Api_Ui_"`

## Notes

- Report window uses current UTC day boundaries.
- Counters are computed from `DateCreated` across immutable tracked entities for consistency.
