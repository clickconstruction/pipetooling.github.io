---
name: People spine — residuals
number: 29
group: residual
status: >
  open 2026-09-22 — the six-PR train shipped (v2.3698 · 3700 · 3701 · 3702 · 3705; the planned PR 4 was already in place since July); the view is pushed and typed; these are what it deliberately left, re-checked 2026-09-29 — none moved
summary: >
  **People spine residuals**: after the roster view, Leave, Hire, the Users lenses and the pointers
  landed, four small things stay open — the crew pickers still read `users` directly, thirteen edge
  functions still filter `is_sample = false` by hand, `get_archived_user_names()` still serves three
  surfaces, one fixture account has its twin flag unset in prod, and the `as never` cast outlived the regen.
next: >
  One mechanical sweep PR: crew pickers and the thirteen edge functions read `roster_people`; then
  Offsets, Contracts and the Teams member filter take the view's verdict and the RPC drops.
size: S
blocker: none
ver: v2.3698 · 3700 · 3701 · 3702 · 3705
opinion: do the sweep when the next roster surface is touched anyway; the guardrail that mattered (pay lists) is in.
mockup: not required — a sweep and a data fix, no screen changes
---

# People spine — residuals

## Where it stands (handoff, 2026-09-22)

PRs 1–3 merged (#3539 v2.3698 · #3542 v2.3700 · #3543 v2.3701). PR 5 #3545 (v2.3702, Users lenses) rebased onto main with auto-merge armed. PR 6 (v2.3705, this file's PR) is stacked on PR 5's branch `claude/people-spine-5-lenses`: when #3545 merges, GitHub retargets it to main — re-arm with `gh pr merge <n> --auto` (no strategy flag; the merge queue decides). PR 5 and PR 6 merged; `20260922001000_roster_people_view.sql` is pushed and `src/types/database.ts` carries `roster_people` since the 2026-09-22 regen — but the `as never` cast in `src/lib/people/rosterPeople.ts` (line 64) was never dropped (item 5 below). Edge functions `invite-user` v72 / `create-user` v75 are deployed. Memory note for the agent: *people-spine-train*.

The train: [`docs/recent-features/v2.3698.md`](../docs/recent-features/v2.3698.md) (the `roster_people` view and the salary guard), [`v2.3700.md`](../docs/recent-features/v2.3700.md) (Leave), [`v2.3701.md`](../docs/recent-features/v2.3701.md) (Hire, born linked), [`v2.3702.md`](../docs/recent-features/v2.3702.md) (the Users lenses), [`v2.3705.md`](../docs/recent-features/v2.3705.md) (pointers and homes). The design boards: the Claude artifact *People surfaces unified* (BhRVGMD3iAFxNVMn74Bqkb).

## Left open, on purpose

1. **Crew pickers onto the view.** The 19 `activeUsersQuery` / `activeRosterOnly` callers (still 19 on 2026-09-29) (`src/lib/people/fetchActiveUsers.ts`, `activeRoster.ts`) still read `users` with their own flags. They need contact columns, so they would join `roster_people` by `user_id` for membership and keep their own select for email and phone. The view already guarantees membership for the pay lists; this is the tidy-up.
2. **The thirteen edge functions** that carry `eq('is_sample', false)` by hand (`_shared/jobWatchers`, schedule-day, schedule-share, crew-day, weekly-money, weekly-movement, money-waiting, payment-forecast, statement-round, recurring-job-report, paid-job, send-report, billed-report, send-rfq, send-bid-pricing-package): read the view's `is_active_roster` instead. Mechanical; merges alone. (All thirteen still carry it on 2026-09-29. `_shared/rosterRow.ts`, v2.3701, also reads `is_sample` — on purpose, fixture accounts get no roster row — and is not part of the sweep.)
3. **`get_archived_user_names()`** still serves Offsets (the archived fold), Contracts (archived grouped at the bottom), the Teams member filter in `People.tsx` and the Hours grid's roster (`src/lib/people/hoursGridRoster.ts` keeps the pre-v2.3698 archived-name rule as its first filter). Swap them to the view's `is_archived` and drop the RPC (revoke first — `20260906180000` revoked anon on it).
4. **Twin Estimator 2** (`twin-estimator-2@twins.pipetooling.local`) has `is_digital_twin = false` in prod, so it sits in the People → Users roster under Estimators and the roster view calls it a person. A dev sets the flag from Settings → System → Digital twins & samples (the twin minter sets it after `create-user`; this one predates that). Data, not code.
5. **The `as never` cast** in `src/lib/people/rosterPeople.ts` — `src/types/database.ts` has carried `roster_people` since the 2026-09-22 regen, so this is a one-line PR that is simply not done yet.

## How to verify the sweep

Read-only on prod through the app's screens: the Hours grid, the crew pickers on Jobs and Schedule, and one email preview must list the same people before and after. The throwaway-Postgres recipe in the memory note *throwaway-postgres-recipe* covers the RPC drop.
