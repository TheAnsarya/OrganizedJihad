# Recommendation Overlay State Guide

Date: 2026-06-03
Scope: Explain operator-visible recommendation overlay states and hint messages.

## Context Subtitle Signals
- Live Args: target context came directly from a battle/attack call argument payload.
- Fresh Metadata: target context was selected from recent metadata and confidence is acceptable.
- Stale Metadata: context came from older or weaker metadata; recommendations may be less precise.

## Hint Messages
- Recommendations panel auto-opened for combat context.
Meaning: overlay was hidden and was automatically shown due to an attack/enemy-list event.

- Using engine fallback recommendations while battle history is sparse.
Meaning: battle-history endpoint returned insufficient recommendations, so mode engine fallback is active.

- API fetch failed. Showing cached recommendations.
Meaning: latest request failed; last successful payload is displayed.

- API temporarily unavailable. Retrying with backoff.
Meaning: request failed with no cached payload available; exponential retry backoff is active.

- Recommendation API connection recovered.
Meaning: API recovered after one or more prior failures.

## Recommended Operator Flow (Arena)
1. Open arena enemy list and verify overlay context updates.
2. Start arena attack and verify target name/power alignment.
3. Confirm recommendation cards include probable win percentage and rationale.
4. If sparse history warning appears, verify fallback cards still render and update.
5. If cached/backoff warning appears, verify panel recovers after API stabilization.

## Troubleshooting Notes
- If overlay appears missing, use Alt+R to toggle and ensure saved position is within viewport.
- If recommendations are empty repeatedly, collect additional arena battle samples and recheck.
- If hint indicates stale metadata, trigger a fresh enemy-list or attack call to refresh context.
