---
name: "Job Parts Tally → Transactions: the team's queue, sorted where it is"
number: 72
group: waiting
status: asked 2026-09-30 · read against 90 days of prod · drawn as before / after, redrawn the same day as pass 2 (a person's day is the unit; the real Before is the Team purchases modal) · the row-cap defect it found shipped as v2.4259 · the owner's go 2026-10-01 ("I like it — build to spec later") · PR 1, the suggestion kernel, v2.4591 on `feat/tally-sort-suggestion-kernel` 2026-10-05; its replay of 90 days found no rule sure enough to sort a day in one press · the owner's go 2026-10-06 on a faster queue, the likely chip first and never pre-selected · PR 2a, the team queue, v2.4654 on `feat/tally-team-queue`, keyed on the day of the swipe · v2.4668 moves the Assign window, Sort mode and the Posted button to the swipe day
summary: >
  The Transactions tab was built for the card holder to sort their own purchases, with a phone
  Sort mode and a clock-out nudge. Ninety days of production say the field does not: one assistant
  sorts 98% of every card charge, from a Dashboard modal, one search window per charge, and the
  page itself was opened on 38 person-days. Two thirds of charges go to a job the holder clocked
  within a day, and the page knows none of it; but that is where the answer lies, not a pick: as a
  guess, the only job clocked that day matched the sorter three times in four (PR 1's replay). The
  charges come in days (2.2 per person-day; two days in three go entirely to one job). After: for
  office roles the tab is the team's queue, one card per person per day — a people strip with who
  is behind, the holder's day in words on the card, the day's likely job first among a few chips,
  two-job days offering both jobs and an even split, a bar for pay sends, the holder's phone card
  carrying the same chips, and the page measuring its own guesses. A bar that sorts the obvious
  days in one press, and any rule that applies itself, wait until a rule measures sure.
next: >
  PR 2a's review and merge, then a few days of the office sorting on it before PR 2b moves the
  Dashboard and Quickfill doors here and retires the Team purchases window. PR 2c (a keyboard path)
  after one real sorting session. Two follow-ups found by 2a, each its own PR: the Assign window's
  "that day" and the holder's Sort mode move to the swipe day, and `list_card_charges_window`
  gains the swipe time. The wrong-guess answers from the field become rules the replay scores.
size: M (five PRs; the kernel and the queue are the two real ones)
blocker: PR 2a's review; then a few days of real use before 2b.
ver: v2.4591 (PR 1) · v2.4654 (PR 2a) · v2.4668 (the swipe day)
opinion: build — the sorter's minute per charge becomes a glance and a tap, and the page can prove its rules before any of them runs on its own.
mockup: tally-transactions-refresh-before-after.html
---

# Job Parts Tally → Transactions: the team's queue, sorted where it is

## The ask, in the owner's words

2026-09-30: "take a look at the page /tally?tab=transactions — it was built a long time ago and I
think worthy of a refresh to make it more useful. Take a look and understand how it works and how
it's been used and come up with some proposals of how it could work better, then make a mockup and
ask yourself is this the best we can do?" On pass 1: "is this the best we can do on the mockup?"
On pass 2, 2026-10-01: "I like the job parts tally refresh, please add it to the punchlist so
someone else can see the mockups and build to spec later."

## What the data says (prod, last 90 days, read-only over the pooler)

| Fact | Number |
|---|---|
| Card charges on the 19 linked cards | 1,063 · $80k |
| Sorted by Taunya (assistant) / by the holders themselves | 837 / 18 of 855 |
| Person-days anyone opened `/tally` | 38 (Robert 10, Paige 1 long session, Taunya 12 short) |
| Person-days with a sorted charge / charges per day | 382 / 2.2 |
| Person-days whose every charge went to one job | 64% (245 days, holding half of all charges) |
| Sorted to a job the holder clocked within ±1 day | 66% (584 of 879 field-card charges) |
| Sorted to the only job the holder clocked that day | 37% |
| The only job clocked that day, as a guess (PR 1's replay, 2026-10-05) | right 72% on a field job (268 of 370), 44% on a day clocked only on Office (45 of 103) |
| Same job as the holder's previous sorted charge | 56% (1,027 of 1,840 over 180 days) |
| Same store → same job as last time at that store | 46% |
| Fuel rows (Mercury tags every row with a category) | 43% |
| Purchase → sorted, median / p90 | 0.8 d / 9.6 d; batches Thu 10–11 am |
| Splits / splits with a note / memos ever | 10% / 4 of 1,028 / 24 |
| Materials Estimate rows this year | 8 (February), none since |
| Payroll marks by rule / by hand | 904 / 9 |
| Charges before the 2026-03-31 floor never sorted | ~4,200 (under the floor by decision) |

Every charge reaches the database the day it is made (Mercury webhook), but it stays pending, with
no `posted_at`, until Mercury settles it, and the lists drop pending rows: at clock-out most of the
day's purchases are not yet on the holder's list (measured under PR 4 below). Mercury carries no receipts on these charges (4 attachments in 1,063, all check
images). The office's actual tool is `DashboardStaleTallyStaffFollowUpModal` (Dashboard and
Quickfill, *Team purchases*), which lists every unlinked charge across the team and opens
`MercuryTransactionAllocationsModal` per row — the window already offers the holder's schedule and
clock picks, so the minute per charge is open · look · pick · save · close, not the search.

## Found while looking (shipped as v2.4259 the same day)

The page's read, `list_my_linked_mercury_transactions_for_tally`, took no limit and PostgREST
capped it at 1,000 rows, so a card past that lost its oldest rows before the date floor and the
payroll merge ran. Both callers now read through `lib/tally/fetchTallyLinkedMercuryRows.ts`
(`docs/recent-features/v2.4259.md`).

## Where it stands

The owner looked at pass 2 on 2026-10-01 and said build it to spec, later, by whoever picks it
up. **The spec is the page beside this file** (`tally-transactions-refresh-before-after.html`,
pass 2 — it replaced pass 1 in place; the same page is the artifact linked below). Every
callout, chip reason and owner's call on it is the build list; the plan below is the order.
PR 1, the kernel, is on `feat/tally-sort-suggestion-kernel` (v2.4591). Its replay of 90 days of
real sorting changed the spec in three places, and the plan below says so: no rule is sure, so
there is no one-press bar yet; a store's run is offered, never kept as the line's pick; the split
leads even. On 2026-10-06 the owner said build the faster queue: the likely chip leads the day
but nothing is selected until the sorter taps. PR 2a (v2.4654) found that Mercury's posting time is
not the day of the work: a charge posts a median 8 hours after the swipe, on a later day for two in
five. The queue keys a charge's day on the swipe (`raw.createdAt`); where the two days had
different jobs, past sorts followed the posting day the Assign window shows, 48 times to 6.

## The decision (drawn; the owner's go taken)

One page for the sorter, with the guess on the card. Detail in the mock-up's callouts (the page
beside this file; the same page as an artifact — https://claude.ai/artifact/WTDeVjMCS2mVBgb5TEzwWG);
the calls in its *Kept · dropped · the owner's calls* section. **Pass 2** (the same day, on
"is this the best we can do?") changed two things and the page says why: the unit of work is a
person's day, not a charge (a day card, one chip, a line keeps its own store rule, two-job days
offer both jobs and a split by hours), and the Before now draws the Team purchases modal with its
Assign window, which is what the After replaces.

1. **Fuel on a two-job day** — settled by the data: even split. Across a day's clocked jobs the
   office split 35 times evenly and never by hours (PR 1's replay); by hours stays the last chip.
2. **Auto-apply** — never by default; the page measures each rule and shows its accuracy; the
   owner flips a rule to auto-apply the way payroll rules already run. No rule qualifies yet: the
   best is right about three times in four, and a rule is not even called sure under 95% on 40 or
   more charges (PR 1's replay).
3. **Who sees the team view** — drawn for dev, master, assistant, controller (what the staff RPC
   admits); superintendents and primaries keep their own card.
4. **Materials Estimate** — drawn as retired (redirect to Transactions); or a door in Materials.

## Where it plugs in

- Reads: `list_stale_unlinked_mercury_transactions_for_tally_staff(min_age_days, include_all_unlinked)`
  (the team's unsorted charges; its `job_splits` is always empty), `clock_sessions` and
  `job_schedule_blocks` as rows, the day ±3 with clock-in and clock-out
  (`lib/tally/fetchSortModeDayJobs.ts` merges them into one list for posted ±1, which drops the
  day, the source and the hours the kernel needs), the holder's sorted charges 30 days back with
  their splits and Mercury category from `list_card_charges_window` (#52's read, office roles,
  paged; agreed 2026-10-05 so one read serves both, since the v2.4566 Sorted read stops at 300
  rows for the whole team), `raw.mercuryCategory` on the unsorted rows. That read returns card
  refunds too since v2.4611, so store runs and same-day history are built from purchases only
  (`amount < 0`); a refund in the queue may later earn its own rule, the job of the purchase it
  returns.
- Writes: unchanged — `replace_mercury_job_splits_for_linked_card_as_staff` (office) and
  `replace_mercury_job_splits_for_my_linked_card` (holder), `set_tally_payroll_flag`, the rules RPCs.
- Screens: `src/pages/JobTally.tsx` (the Transactions block, 934–1827 at the map's commit — see
  `docs/JOB_TALLY_ARCHITECTURE.md`; the extraction order there still applies, and PR 2 is the
  moment to land `TallyTransactionsTab`), `TallySortModeCardList` / `TallySortPurchaseModal` /
  `TallyPreClockOutModal` (the chip), the Dashboard and Quickfill *Team purchases* doors.
- New: `src/lib/tally/tallySortSuggestion.ts` (the kernel) and `tallySuggestionWords.ts` (its
  words, one formatter for the office and the phone), both in PR 1; the replay per rule (PR 5).

## The plan

1. **PR 1 — the kernel** (v2.4591) `tallySortSuggestion.ts`: a person's day (its charges) + the
   holder's clock sessions and schedule, the day ±3 + the holder's sorted charges, 30 days back →
   the day's chips in a fixed order, at most 5, and each line's best and own suggestions, each
   with a rule id, the rule's one confidence (sure · likely · none) and its facts; the even and
   by-hours split amounts; the words from one formatter. Two layers: a line's own rules first
   (Mercury category Advertising, Insurance or InternetAndTelephone → Office; the store's last
   charges, never for fuel, offered only), then the day's (the only job clocked that day when it
   is a field job, or the only job scheduled; the clocked jobs and the even split; the scheduled,
   neighbouring and same-day jobs; Office). This plan first wrote "Telecom" (Mercury's category is
   InternetAndTelephone), put the clock before the category (a Software charge would have gone
   to the field job), reached only ±1 (a Saturday needs Monday) and let a store's run beat the
   clock (right 2 times in 12). The replay set the levels: nothing is sure in rule set v1; the
   table is in the kernel and `docs/recent-features/v2.4591.md`. Pure, tested. No screen change.
2. **PR 2a — the team queue** (v2.4654) on the Transactions tab for office roles, behind a
   **Team | My card** switch: the people strip, the through-date, the day cards keyed on the day of
   the swipe, the evidence sentence, the chips (likely first, nothing pre-selected), *Sort the day*
   through the staff RPC (one write per charge), *Another job…* (today's Assign window), Invoices,
   Backcharge and the Sorted list on every card. Kernel v2: a refund is not history, by hours is
   not a chip. Lands as its own component, `TallyTeamQueue`; the guide *sort the team's card
   purchases from the office* gains the Job Parts Tally section (this plan first named the field
   guide), GLOSSARY and PROJECT_DOCUMENTATION amended.
   **PR 2b** — after a few days of real use, the Dashboard and Quickfill doors open here and the
   Team purchases window retires. **PR 2c** — a keyboard path for the desktop sorter, after one
   real session. The own-card block's extraction into `TallyTransactionsTab` is its own PR.
   **Follow-ups found by 2a**: the Assign window's "that day", Sort mode and the own-card table's
   Posted button moved to the swipe day in v2.4668, which also put Sort mode's swipe-day jobs
   first. The about 48 charges in 90 days already on the next day's job wait on the owner's
   five-case answer, then go to the office as a read-only list, with no code.
   `list_card_charges_window` gains the swipe time (`purchased_at`, #52), so store runs and
   same-day chips move too.
3. **PR 3 — the pay bar**: the pay-send bar that marks and widens the matching payroll rule, and
   undo per line. The obvious bar (sort-all for ✓ days) waits until PR 5 promotes a rule to sure;
   with the levels the replay found, it would have written a wrong charge on about 4 obvious days
   in 10.
4. **PR 4 — the holder's card gains the day's chip**: phone cards, Sort mode, the pre-clock-out
   sheet, one component over the same kernel. Found 2026-10-06 while building 2a: Mercury keeps a
   card charge `pending`, with no `posted_at`, until it settles, and the date floor drops a row
   with no `posted_at`. Over the 90 days, 337 of the 585 purchases made before that day's
   clock-out (58%) were still pending when the holder clocked out, and 7 of 32 recent card rows
   ended `failed`. So the clock-out sheet cannot show most of a day's purchases unless it shows
   pending charges keyed on the swipe, with the care a pending amount needs. That changes what
   the nudge can ever do, so it is the owner's call before PR 4 is planned.
5. **PR 5 — the page measures itself**: PR 1's replay per rule and per rule × holder, the
   accuracy line on the through-date, and an owner switch per rule for auto-apply (off), offered
   only to a rule at 95% or better on 40 or more charges. Open for its plan: the replay measures
   agreement with the final split, not "accepted vs overridden" on what the screen showed, and it
   reads clock sessions as corrected later. If PR 2 shows the likely chip selected, only a log of
   what was shown can measure how often the sorter just confirmed it, and that log is a migration.
   The recommendation: the replay for the rules, a log only if PR 2 pre-selects. Materials
   Estimate retires here or in its own PR (`?tab=materials` keeps redirecting).

## How to verify

- Kernel: the mock-up's cases with made-up names, stores and amounts (only job that day; two jobs
  and a store's run; no clock and no schedule → no likely; the Office category rule; an evening
  charge keeps its day), the words against the plain-words rules, and the replay (read-only, as
  the dev on the dev server, each day rebuilt as it stood when it was sorted; the recipe is in
  `docs/recent-features/v2.4591.md`).
- Live, as the dev on the dev server (`/dev-login?as=1&to=/tally?tab=transactions`): the strip
  names every holder with unlinked charges and the same counts as the Dashboard *Team purchases*
  card; a chip sorts and the row's split shows in Banking → User Sort and the job's Costs tab;
  Undo removes it.
- Production numbers to re-read after a month: Taunya's charges per sorting day, the p90 lag, the
  override rate per rule (PR 5's line).
