Implemented first automation delivery slice.

- Added POST /ui/daily-report/generate to generate and persist latest report payload in SyncMetadata key ui_daily_report_latest_v1.
- Added GET /ui/daily-report/latest to return persisted latest report with on-demand fallback.
- Added GET /ui/daily-report/export.csv for CSV export of latest/generated report.
- Added API UI controls/links for generate/latest/csv actions.
- Added integration tests for generate/latest/csv routes and API UI control presence.
- Added AutomatedDailyReportBenchmarks (aggregation + csv payload performance).

Validation:
- runTests on SyncControllerTests: 44 passed
- dotnet run --project benchmarks/OrganizedJihad.Benchmarks -c Release -- --filter "*AutomatedDailyReportBenchmarks*" --job short
