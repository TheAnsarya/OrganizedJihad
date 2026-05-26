# Online Tool Survey and Integration Plan

Date: 2026-05-26
Related Issues: #153, #160, #161, #162

## Objective
Convert external Hero Wars tool research into safe, actionable product integrations without copying third-party code.

## Survey Snapshot

| Tool | URL | Category | Notes |
|---|---|---|---|
| Hero Wars Simulator (Chrome) | https://chromewebstore.google.com/detail/hero-wars-simulator/oolajlfdlkcekemoilmmhkajgneokggb | simulator | Describes battle simulation and replay-derived hero strength usage. |
| HW-Simulator | https://www.hw-simulator.com/ | simulator | Public site for simulator ecosystem and feature notes. |
| HW Assistant | https://hw-assist.com/ | extension | Mentions automation/log tools and gameplay helper scripts. |
| Hero Wars Hub | https://herowarshub.com/ | calculator/guides | Includes Mysterious Island simulator resources. |
| Hero Wars Calculator Hub | https://www.hwcalculator.com/ | calculator | Resource planning calculators for progression paths. |
| Hero Wars Central | https://www.herowarscentral.com/ | guides | Frequent strategy/event guide publication. |

## Implementation Completed

1. API endpoint: `GET /api/sync/tools/catalog`
2. Typed payload models: tool catalog response + entries
3. Desktop Settings integration: external tool catalog panel with refresh and direct links
4. Integration tests: endpoint contract and non-empty curated payload

## Legal/Policy Boundaries

1. Metadata + links are allowed.
2. Direct copying of proprietary third-party simulator code is not allowed.
3. Simulator architecture in this repo remains first-principles and telemetry-driven.

## Next Integrations

1. Add optional per-tool confidence score and review timestamps.
2. Add source provenance tags to recommendation rationale (`local telemetry`, `external guide signal`).
3. Add periodic catalog verification task to detect dead links and outdated entries.
