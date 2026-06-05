# Reporting Visualization Slice - Issue #377 (2026-06-05)

## Summary

Start roadmap item #16 (Additional API/UI reporting visualizations) by adding the first chart/report-card page in local API UI.

## Delivered

- `GET /ui/reporting-overview` JSON endpoint (7-day points)
- `GET /ui/reporting-overview-page` chart/report-card HTML page
- API control shell links to new JSON/page endpoints
- System endpoint index updates
- Focused API integration tests for JSON/page routes

## Data points

Per-day UTC aggregates for the last 7 days:
- Battles tracked
- Quest completions
- Resource transactions
- Chest openings

## Validation target

`dotnet test tests/OrganizedJihad.Api.Tests/OrganizedJihad.Api.Tests.csproj --filter "FullyQualifiedName~Api_Ui_"`
