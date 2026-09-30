---
name: "Job Parts Tally → Transactions: the team's queue, sorted where it is"
number: 72
group: ready
status: asked 2026-09-30 · read against 90 days of prod · drawn as before / after · not built · the owner's look pending
summary: >
  The Transactions tab was built for the card holder to sort their own purchases, with a phone
  Sort mode and a clock-out nudge. Ninety days of production say the field does not: one assistant
  sorts 98% of every card charge, from a Dashboard modal, one search window per charge, and the
  page itself was opened on 38 person-days. Two thirds of charges go to a job the holder clocked
  that day and half go where the last one went, and the page knows none of it. After: for office
  roles the tab is the team's queue — a people strip with who is behind, one line per charge
  with the holder's day in words and the app's best guess as a chip with its reason, one tap to
  sort, two chips to split, a bar that sorts the obvious ones in one press and one for pay sends,
  the holder's phone card carrying the same chip, and the page measuring its own guesses so the
  owner can later let the surest rule auto-apply.
next: >
  The owner's look at the mock-up and four calls (fuel on a two-job day; auto-apply gated on
  measured accuracy; which roles see the team view; retire Materials Estimate). Then PR 1, the
  suggestion kernel, then the team queue.
size: M (five PRs; the kernel and the queue are the two real ones)
blocker: The owner's look, and ten minutes with Taunya on what she does when a guess is wrong.
ver: —
opinion: build — the sorter's minute per charge becomes a glance and a tap, and the page can prove its rules before any of them runs on its own.
mockup: tally-transactions-refresh-before-after.html
---

# Job Parts Tally → Transactions: the team's queue, sorted where it is

## The ask, in the owner's words

2026-09-30: "take a look at the page /tally?tab=transactions — it was built a long time ago and I
think worthy of a refresh to make it more useful. Take a look and understand how it works and how
it's been used and come up with some proposals of how it could work better, then make a mockup and
ask yourself is this the best we can do?"

## What the data says (prod, last 90 days, read-only over the pooler)

| Fact | Number |
|---|---|
| Card charges on the 19 linked cards | 1,063 · $80k |
| Sorted by Taunya (assistant) / by the holders themselves | 837 / 18 of 855 |
| Person-days anyone opened `/tally` | 38 (Robert 10, Paige 1 long session, Taunya 12 short) |
| Sorted to a job the holder clocked within ±1 day | 66% (584 of 879 field-card charges) |
| Sorted to the only job the holder clocked that day | 37% |
| Same job as the holder's previous sorted charge | 56% (1,027 of 1,840 over 180 days) |
| Same store → same job as last time at that store | 46% |
| Fuel rows (Mercury tags every row with a category) | 43% |
| Purchase → sorted, median / p90 | 0.8 d / 9.6 d; batches Thu 10–11 am |
| Splits / splits with a note / memos ever | 10% / 4 of 1,028 / 24 |
| Materials Estimate rows this year | 8 (February), none since |
| Payroll marks by rule / by hand | 904 / 9 |
| Charges before the 2026-03-31 floor never sorted | ~4,200 (under the floor by decision) |

Every charge reaches the app the day it is made (Mercury webhook), so timing is not why the field
skips the nudge. Mercury carries no receipts on these charges (4 attachments in 1,063, all check
images). The office's actual tool is `DashboardStaleTallyStaffFollowUpModal` (Dashboard and
Quickfill, *Team purchases*), which lists every unlinked charge across the team and opens
`MercuryTransactionAllocationsModal` per row — the window already offers the holder's schedule and
clock picks, so the minute per charge is open · look · pick · save · close, not the search.

## Found while looking (its own small PR, before or beside PR 2)

The page's read, `list_my_linked_mercury_transactions_for_tally`, takes no limit and PostgREST
caps it at 1,000 rows: on the dev's card (over 1,000 charges since 2025) the console logs
`[row-cap]` three times per load and the oldest rows are dropped **before** the client applies
the date floor and the payroll merge, so the *Payroll: 401 · $161,929.90* chip and the unlinked
count read only what survived the cap. Page the read with `fetchAllRows`
(`src/lib/supabasePaging.ts`) or push the floor into the RPC. Any holder's card that crosses
1,000 rows will do the same.

## The decision (drawn; the owner's look pending)

One page for the sorter, with the guess on the row. Detail in the mock-up's callouts (the page
beside this file; the same page as an artifact — https://claude.ai/artifact/WTDeVjMCS2mVBgb5TEzwWG);
the calls in its *Kept · dropped · the owner's calls* section:

1. **Fuel on a two-job day** — even split (today's practice, drawn) or by hours on each job.
2. **Auto-apply** — never by default; the page measures accepted vs overridden per rule and shows
   its accuracy; the owner flips a rule to auto-apply the way payroll rules already run.
3. **Who sees the team view** — drawn for dev, master, assistant, controller (what the staff RPC
   admits); superintendents and primaries keep their own card.
4. **Materials Estimate** — drawn as retired (redirect to Transactions); or a door in Materials.

## Where it plugs in

- Reads: `list_stale_unlinked_mercury_transactions_for_tally_staff(min_age_days, include_all_unlinked)`
  (the team's charges, with `job_splits`), `clock_sessions` and `fetchDispatchScheduledJobsForAssigneeDay`
  (already combined in `lib/tally/fetchSortModeDayJobs.ts` for posted ±1), the holder's last
  sorted charges (`mercury_transaction_job_allocations` by tx → holder), `raw.mercuryCategory`.
- Writes: unchanged — `replace_mercury_job_splits_for_linked_card_as_staff` (office) and
  `replace_mercury_job_splits_for_my_linked_card` (holder), `set_tally_payroll_flag`, the rules RPCs.
- Screens: `src/pages/JobTally.tsx` (the Transactions block, 934–1827 at the map's commit — see
  `docs/JOB_TALLY_ARCHITECTURE.md`; the extraction order there still applies, and PR 2 is the
  moment to land `TallyTransactionsTab`), `TallySortModeCardList` / `TallySortPurchaseModal` /
  `TallyPreClockOutModal` (the chip), the Dashboard and Quickfill *Team purchases* doors.
- New: `src/lib/tally/tallySortSuggestion.ts` (the kernel), a per-rule accuracy read (PR 5).

## The plan

1. **PR 1 — the kernel** `tallySortSuggestion.ts`: charge + the holder's day jobs (clock first,
   then schedule, posted ±1) + the holder's last N sorted charges + the store's last N → ranked
   chips with a reason each and a confidence (sure · likely · none). Rules in order: only job
   clocked that day; same store → same job within 30 days; same as the previous charge the same
   day; category Utilities / Software / Telecom → Office. Pure, tested. No screen change.
2. **PR 2 — the team queue** on the Transactions tab for office roles: the people strip, the
   through-date, day groups, the evidence line, the chips, one-tap sort and even split through the
   staff RPC, *Another job…* opening today's Assign window; the Dashboard and Quickfill doors open
   here. Lands as `TallyTransactionsTab` per the architecture map. Guide *sort my card purchases to
   jobs* gains the office section; GLOSSARY and PROJECT_DOCUMENTATION amended.
3. **PR 3 — the obvious bar and the pay bar**: sort-all for ✓ rows with Undo per line; the
   pay-send bar that marks and widens the matching payroll rule.
4. **PR 4 — the holder's card gains the chip**: phone cards, Sort mode, the pre-clock-out sheet,
   one component over the same kernel.
5. **PR 5 — the page measures itself**: accepted vs overridden per rule, the accuracy line on the
   through-date, an owner switch per rule for auto-apply (off). Materials Estimate retires here or
   in its own PR (`?tab=materials` keeps redirecting).

## How to verify

- Kernel: the cases in the mock-up (only job that day; two jobs and a store rule; no clock and no
  schedule → no pick; the Office category rule).
- Live, as the dev on the dev server (`/dev-login?as=1&to=/tally?tab=transactions`): the strip
  names every holder with unlinked charges and the same counts as the Dashboard *Team purchases*
  card; a ✓ chip sorts and the row's split shows in Banking → User Sort and the job's Costs tab;
  Undo removes it; the obvious bar's count equals the ✓ rows on screen.
- Production numbers to re-read after a month: Taunya's charges per sorting day, the p90 lag, the
  override rate per rule (PR 5's line).
