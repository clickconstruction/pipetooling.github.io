---
name: "Read panels say read words when the signal drops"
number: 224
group: ready
status: found 2026-10-31 in v2.6198's live check (Crew Day's panel) · named as a gap in v2.5962 · not started
summary: >
  With no signal, every Retry panel on a read still draws the write sentence: *No connection — the
  app couldn't reach the server, so nothing was saved. Check your signal and try again.* A read
  saved nothing, so the words are wrong for it. On a crew screen they can sit beside a press kept on
  the phone and seem to say it failed. v2.6198 gave the panel an `offlineMessage` door and the
  Dashboard clock its own read words. This card does the same for every read panel.
next: Add one shared read sentence that `offlineRecoveryState` draws for an `idempotent` panel, then update the smokes that pin the write sentence on read panels.
size: S
blocker: None.
ver: v2.5962 · 6198
opinion: build — one kernel line and a mechanical pass over the smokes
mockup: not required — new words on panels that exist
---

# Read panels say read words when the signal drops

## Where this came from

v2.5962 put a Retry panel on every crew read. It named this gap and left it: the offline sentence says *nothing was saved* on a read too. That sentence is the shared `OFFLINE_ERROR_MESSAGE`, which many sites and smokes read.

#163's live test of 2026-10-30 found the write sentence under a clock-out kept on the phone. A crew member reading it would think the press failed and press again. v2.6198 fixed the clock alone. `offlineRecoveryState` and `OfflineRetryPanel` gained an optional `offlineMessage`, and the clock passes `CLOCK_READ_OFFLINE_WORDS`: *No connection, so the clock could not load today's time. It loads again when the signal is back.* v2.6198's live check of 2026-10-31 still saw the write sentence on the Dashboard's Crew Day panel with no signal.

## The plan

One PR, cut from fresh main and merged alone, since it sweeps many surfaces.

1. Add one read sentence in `src/lib/networkErrorMessage.ts`, for example `OFFLINE_READ_MESSAGE`. It follows the plain-words rules (`src/lib/plainWords.ts`) and says the read runs again by itself.
2. `offlineRecoveryState` draws it for a lost signal whenever `idempotent` is true; a write keeps `OFFLINE_ERROR_MESSAGE`. A caller's own `offlineMessage` still wins, so the clock keeps its words, or moves onto the shared sentence if that reads as well.
3. Update the smokes that pin the write sentence on a read panel; `grep -rln OFFLINE_ERROR_MESSAGE src --include='*.test.tsx'` finds about 20. Keep a write panel's assertions on the write sentence. Update `offlineRecoveryState.test.ts` too.
4. The words around it:
   - The guide `what-no-connection-means`. Its first paragraph, *Nothing you pressed was saved*, is its share card, so `helpShareCard.guides.test.ts` checks the change.
   - The paragraph of `job-mode-clocking` on screens that reload by themselves (#225 rewrites the rest of that section).
   - The row in `docs/TROUBLESHOOTING.md`'s error table.
5. A release note and a `docs/recent-features/` fragment. Then delete this card.

## Where it plugs in

- `src/lib/offlineRecoveryState.ts` (the `offline` phase's message), `src/components/OfflineRetryPanel.tsx`, `src/lib/networkErrorMessage.ts`.
- The read panels: every `<OfflineRetryPanel … idempotent>` (`grep -rn "idempotent" src/components --include='*.tsx'`).
- The error door's card (`errorFamilyOf` in `src/lib/help/errorGuides.ts`) already says *Nothing was lost* and *A read tries again on its own*. It needs no change.

## How to verify

`npx vitest run src/lib/offlineRecoveryState.test.ts src/components/OfflineRetryPanel.render.test.tsx` plus the swept smokes, capped with `--maxWorkers=2 --minWorkers=1` on Taunya's Mac. Live on the dev server, cut the signal:

- stub `window.fetch` to reject `*.supabase.co` outside `/auth/v1/`;
- set `navigator.onLine` to false;
- dispatch `offline`.

Then open the Dashboard. Crew Day, My Schedule and the other read panels say the read sentence with Retry, and none says *nothing was saved*. Each reads again by itself on `online`. A write that does not queue, such as a payment, still says the write sentence.
