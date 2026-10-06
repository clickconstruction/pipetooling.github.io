---
name: People spine — residuals
number: 29
group: residual
status: >
  open 2026-09-22 — the six-PR train shipped (v2.3698 · 3700 · 3701 · 3702 · 3705; the planned PR 4 was already in place since July); the view is pushed and typed. 2026-10-06 (v2.4658): item 2 swept (the edge functions take one `REAL_ACCOUNT` rule; deployed in waves after the merge), item 1 closed by a pin; v2.4664: item 5 done; items 3–4 open
summary: >
  **People spine residuals**: after the roster view, Leave, Hire, the Users lenses and the pointers
  landed, small things stayed open. Done in v2.4658: the edge functions' hand-written sample
  filters (one shared rule that also refuses twins), and the crew pickers (pinned to the view, not
  moved); in v2.4664, the `as never` cast. Open: `get_archived_user_names()` still serves five
  surfaces, and one fixture account has its twin flag unset in prod.
next: >
  After v2.4658's deploy waves: Offsets, Contracts, the Teams member filter and the Hours grid take
  the view's `is_archived` and the RPC drops (separate PRs, plan first).
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

1. **Crew pickers onto the view — closed by a pin, not moved (v2.4658).** The pickers (21 files on 2026-10-06) all go through `activeUsersQuery` / `fetchActiveUsers` and `activeRosterOnly` (`src/lib/people/fetchActiveUsers.ts`, `activeRoster.ts`), which already apply the view's rule in one place: no twin, no sample, not archived, dev only on request. The view carries no email, phone or sign-in stamp, so every picker would need a second read for no gain. The people-half archive is the only difference, and End employment archives both halves together. `src/lib/people/rosterRulePin.test.ts` pins `isActiveRosterPerson` to the view's `is_active_roster`, so a condition added to the view fails CI until the pickers learn it.
2. **The edge functions' hand-written sample filter — swept (v2.4658).** Fifteen functions and two shared modules, not "thirteen": billed-report, crew-day, money-waiting, paid-job, payment-forecast, recurring-job-report, schedule-day, schedule-share, send-bid-pricing-package, send-lien-desk-summary, send-report, send-rfq, statement-round, weekly-money and weekly-movement, plus `_shared/jobWatchers` (bundled by submit-sub-portal) and `_shared/arReturnCaseNotify` (ar-returned-checks, mercury-webhook).
   - **Why not the view.** They could not read it. Every one looks its sender or recipient up as the service role, which the view answers with no rows. The view carries no email, and `is_active_roster` leaves out devs, who send and receive these emails.
   - **What they take instead.** `.match(REAL_ACCOUNT)` from `_shared/realAccount.ts`: no sample, and now no twin. Twins are estimators, so before the sweep a twin's session passed the sender check of send-bid-pricing-package (to a GC) and send-rfq-email (to a supply house). Archived stays with each caller.
   - **How it was done.** `scripts/sweep-real-account.mjs` did the rewrite. `realAccountSweep.test.ts` fails CI on a new hand-written copy.
   - **Deploy waves.** The two outside-email senders first, then the other thirteen. The three shared-module importers are held until they deploy for their own reasons.
   - **Left alone on purpose:** `create-user` (writes the flag), `dev-mcp` and `_shared/devMcpComposites` (View-as reads the samples), and `_shared/rosterRow.ts` (fixture accounts get no roster row, v2.3701).
3. **`get_archived_user_names()`** served five surfaces, all through one set built in `People.tsx`: Offsets (the archived fold), Contracts (archived grouped at the bottom), Review (pay names filtered beside the pay roster), the Teams member filter, and the Hours grid's roster (`src/lib/people/hoursGridRoster.ts`, rule 1).
   - **3a, done in v2.4671:** the set now comes from the `roster_people` read `People.tsx` already makes (`archivedRosterNames`). That means every name an archived roster row answers to, except a living namesake's. It is a pure source swap; no consumer changed.
   - **Id-first matching** (by `person_id`, which the roster rows carry) is left to each consumer's own PR, per the identity plan.
   - **3b:** drop the RPC once 3a has been live a day (REVOKE and DROP in one file; `20260906180000` revoked anon on it). PUNCHLIST pushes it.
   - **3c:** the types PR after that push. It regenerates `database.ts` and dev-mcp's `catalog.ts`.
4. **Twin Estimator 2** (`twin-estimator-2@twins.pipetooling.local`) has `is_digital_twin = false` in prod, so it sits in the People → Users roster under Estimators and the roster view calls it a person. Until the flag is set, v2.4658's twin refusal does not catch it either. A dev sets the flag from Settings → System → Digital twins & samples (the twin minter sets it after `create-user`; this one predates that). Data, not code — the owner's.
5. **The `as never` cast** in `src/lib/people/rosterPeople.ts` — done in v2.4664: `fetchRosterPeople` takes the typed client and reads `roster_people` by name (`src/types/database.ts` has carried the view since the 2026-09-22 regen).

## How to verify the sweep

Read-only on prod through the app's screens: the Hours grid, the crew pickers on Jobs and Schedule, and one email preview must list the same people before and after. The throwaway-Postgres recipe in the memory note *throwaway-postgres-recipe* covers the RPC drop.

For v2.4658 the pickers do not change, so they need no check. The edge half is proven by `src/lib/people/realAccountSenders.run.test.ts` and `realAccountRecipients.run.test.ts`, which run the real handlers on a fake database. Both fail on the pre-sweep code, where a twin gets through. After each deploy wave, an `OPTIONS` probe per function must answer 2xx, not 503. The PR body lists the waves and the probe.
