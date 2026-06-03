# Arena Recommendation Smoke Checklist

Date: 2026-06-03
Related Issue: #337

## Preconditions
- Userscript build loaded in browser.
- Local API server reachable from userscript.
- Overlay preference not permanently disabled.

## Steps
1. Open Arena enemy list.
2. Verify overlay is visible and context shows Arena mode.
3. Start an Arena attack on a known target.
4. Verify overlay either remains visible or auto-opens.
5. Verify hint appears for auto-open path when panel was previously hidden.
6. Verify recommendation rows render team name, Win %, Conf %, Score %, and sample count.
7. Verify probable win percentage reflects simulator/battle payload values when available.
8. Induce sparse history scenario and verify engine fallback hint appears.
9. Induce temporary API failure and verify cached/backoff hint behavior.
10. Restore API and verify recovery hint appears.

## Pass Criteria
- Overlay does not disappear unexpectedly during arena target/attack flow.
- Recommendation cards appear with stable metrics and rationale text.
- Hint messages are context-appropriate and non-blocking.
- No console errors related to recommendation rendering.

## Evidence To Capture
- Screenshot: arena list with overlay context.
- Screenshot: active attack target with recommendation cards.
- Screenshot: fallback or cached/backoff hint state.
- Short note linking run to issue #337.
