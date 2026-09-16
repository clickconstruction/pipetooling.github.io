---
name: "Takeoffs PR 9: retire Old"
group: gated
status: PR 8 re-measured 2026-09-14 · PR 9 (retire Old) is an owner call
summary: >
  The week of real use: 2 costed bids at 90% coverage, 17 new bids with counts and no takeoff, the
  book learned nothing (table in the plan). Retire Old, or run a second week?
next: >
  Ask Wendi which view she used; decide retire now or run a second week with Remember for the book
  ticked.
size: M
blocker: Your call.
ver: PR 8 done 09-14
---

# Takeoffs: measure a week of One at a time / Sheet use, then retire Old

## The ask, in the owner's words

From the Takeoffs Refresh canvas (2026-09-04): "B → New 1" and "C → New 2" (renamed One at a time / Sheet in v2.2990), with Old left as today's tab until the new views prove out. PRs 1–7 built the parallel run (v2.2768–v2.2784); the plan's last two rungs were deliberately left for later.

## The decision

Old stays the default and stays untouched until One at a time / Sheet have carried a week of real bids. Retirement is a separate PR, not a flag flip.

## Validation 2026-09-05

- Pills are live; the stored view defaults to `old` (`src/lib/bids/takeoffView.ts`, `readStoredTakeoffView`). v2.3082 made the chooser ask on every Combined bid open; v2.3165 (2026-09-08, Wendi's ask) made it ask once per device and remember — so "which view do people pick" is each device's first pick plus the pill switches after it, not a per-open choice.
- Nothing since v2.2784 touches retirement; no fragment mentions PR 8 or PR 9.
- v2.2784 shipped the "what must not die with Old" hardening (shared model toggle, row jumps, smokes, retirement-readiness notes) — that is the checklist PR 9 must satisfy.

## Where it plugs in

- `src/components/bids/BidsTakeoffTab.tsx` (Old body + pill switch), `src/components/bids/TakeoffViewPills.tsx`, `src/lib/bids/takeoffView.ts`.
- One at a time / Sheet bodies and the substrate kernels/hooks listed in the plan (PRs 2–7).
- Coverage numbers to re-measure come from the plan's "Why" table (bids with no takeoff, fixture rows with lines, bids fully costed, book size).

## The plan

1. ~~**PR 8 — re-measure**~~ — done 2026-09-14 (docs-only): the census re-run through the app session, both windows, in `docs/TAKEOFFS_REFRESH_PLAN.md` → *Re-measure*.
2. **PR 9 — retire Old**: flip the default to One at a time (or Sheet, whichever the census says wins), remove the Old body, keep the print / PO / book-apply paths the hardening PR fenced, update `send-a-bid-pricing-package` and the takeoff guides, `docs/BIDS_TAKEOFF_TAB_ARCHITECTURE.md`.

## How to verify

- A bid with counts but no takeoff: One at a time walks it fixture by fixture and the book fills what it has seen before.
- Print takeoff breakdown, Create PO from takeoff, Apply fixture assemblies all still work with Old gone (the v2.2784 smokes cover these — keep them green).
