---
name: "Customer timeline: one customer's whole story on one spine, with what they owe us floating above it"
number: 97
group: gated
size: 4 PRs — kernel (S), the window (M), the Pipeline doors (S), a one-shot RPC (S, only if needed)
blocker: the owner's five calls below, after looking at the mock-up; nothing technical — every row it needs exists
status: mock-up drawn 2026-10-07 on claude/docs-job-stages-review-2810da; not started
summary: >
  Look up a customer and scroll one vertical timeline of everything between us: each job is an arrow
  from the day its card was made to the day the final payment landed, office events (notes, bills,
  cheques and their deposits, promises, notices) on the left, what we put in (hours, field notes,
  reports, materials) on the right. A bar floats above it with what they owe us, what is not billed
  yet, and the hours and materials we have not been paid for; as you scroll into the past it reads
  what those numbers were then.
next: >
  The owner looks at the mock-up and answers the five calls. Then PR 1, the kernel, which needs no
  screen and no migration.
---

# Customer timeline

## The ask, in the owner's words

2026-10-07: *I would like to be able to look up a customer and see a vertical timeline I can scroll
through showing hours, jobs and when they deposited cheques closing those jobs, where a job is an
arrow and the job starts when card is created and ends when final payment is made, and as long as it
is open I would like to see an arrow where along the way to the left of the arrow are office
activities like notes and payments received and to the right are field hours and field notes and
reports. Perhaps floating while a user scrolls is how much they owe us and how many man hours and
materials we have not been paid for.* And: *help me come up with an entry point in Jobs Stages and a
way to build this.*

## The mock-up

[`mockup.html`](./mockup.html) (the same page shared as an artifact: https://claude.ai/artifact/FtTUJDSxmVzCRrq1Nh3gLx) — a made-up GC with four jobs over two years, two of them open. Open
it at desktop and phone width; it reads in both themes. It is a window opened from the Pipeline, with
a Profile | Timeline switch in its title bar.

What it does, top to bottom:

- **The floating bar.** The customer, who to call, since when, how fast they pay. Four tiles: *Owes
  us* (open billed, with the oldest bill's age and their promise), *Not yet billed* (open jobs' price
  less what has been billed), *Unpaid hours* and *Unpaid materials* (clock hours and material cost on
  every job not yet paid in full). Once you scroll it collapses to one line, and a second line reads
  the same four numbers **as of the month under the bar** — scroll back a year and watch what they
  owed then.
- **One spine of time, today at the top.** One row per day. A month label when the month changes. A
  thin spacer between days whose height grows with the days it holds, labelled *2 weeks* / *4
  weeks*, so a slow payer looks slow. A stretch with nothing open folds to one line: *4 months quiet
  · nothing open, nothing owed*.
- **The rails.** One rail per job, colored by job, side by side when jobs overlap (the Projects
  job-history lane packer). The rail starts at a ring on the day the card was made, runs dashed
  while waiting to start, solid while working, hollow while billed and waiting on their money, and
  ends in a ✓ on the day the final payment landed. An open job's rail runs off the top under the
  bar, with an arrowhead: it points at the money they owe.
- **Left, with the customer.** Job card created, bills sent, payments (cheque number, received day,
  *27 days after the bill*, the Mercury deposit day), partials, promises (*They said Oct 15*), GC
  statements, lien notices, change orders, office notes. Money-in cards are green, bills amber,
  promises purple, notices red.
- **Right, what we put in.** Field hours, folded into one card between two office events on the same
  job (*Mar 16 → Apr 24 · 23 work days · 118h 30m · 56% of the job's hours*, the crew, *show the
  days ›*), field notes from clock sessions, test and inspection reports, supply-house buys.
- **Focus and filters.** Tap a job chip, a card or a rail: everything on other jobs dims. *Show:
  Everything · Money · Field.*
- **Phone.** One column: the rails in a narrow gutter on the left, office cards and field cards
  stacked with an OFFICE / FIELD tag, field cards indented.

### Is this the best we can do? (the first draft, and what changed)

The first draft put one event per row. It was sparse (the office side sat empty through a week of
field cards), time was invisible (79 days of owing read as four rows), the bar ate a third of a phone
screen, and a cheque did not say how fast they paid. The second draft folds a day into one row, grows
the gaps with the days they hold, collapses the bar on scroll, and writes *27 days after the bill* on
every payment. Left for the owner: the five calls below.

## Decisions for the owner

1. **Today at the top** (the mock-up) or the past at the top? Newest first matches every feed in the
   app and lets open rails run up into the owed-us bar; oldest first reads like the arrow the owner
   described.
2. **The left/right rule.** The mock-up's rule is *left = with the customer, right = what we put in*,
   so materials sit on the right beside hours. The owner's words put only "field hours and field notes
   and reports" on the right.
3. **Rails colored by job**, with the job's state as solid / hollow / dashed, or rails colored by
   state (blue working, amber billed, green paid) with the job named only on the cards?
4. **Field days fold** between office events on the same job, and *show the days ›* opens the job's
   existing hours story. Or every day its own card?
5. **The scrubbing bar** (the as-of line) ships in PR 2, or waits until the plain view has been used?

Also the name: **Timeline** (the owner's word) or **Story** (the app already says *hours story* and
*money story*). The mock-up says Timeline.

## Entry points in Jobs → Pipeline

1. **The customer's name on every row** already opens the Customer profile window
   (`CustomerProfileModal`, through `CustomerProfileModalContext`; the row's door is in
   `jobsStagesRowShared.tsx`). The timeline is a second view of that window: a **Profile | Timeline**
   switch in its title bar, remembered per device. No new button on the row.
2. **The Pipeline search.** The search already matches `customer_name`. When the text matches one
   customer, a chip sits above the board: *Ridgeway Builders · timeline →*.
3. **A deep link** `?timeline=<customerId>` consumed by `useStagesDeepLinkParams` like `?liendesk`,
   so the Dashboard's AR tiles, the Collections rows, the AR window and the Customers page can link
   straight to it.
4. Later: the Customers page row and `CustomerDetail`'s Jobs tab get the same door.

Who sees it: whoever can open the Customer profile today (the office roles). Field roles do not.

## Where it plugs in (what exists)

| Needs | Exists |
|---|---|
| The jobs, their card day and status moves | `jobs_ledger.created_at`, `job_status_events` (from / to / changed_at); `jobRunningTimeline.ts` already defines a job's run and its state on a day |
| Bills | `jobs_ledger_invoices` (amount, billed_at, sent_to_customer_at) |
| Payments and the deposit day | `jobs_ledger_payments` (paid_on, payment_type, reference_number, mercury_transaction_id) → `mercury_transactions.posted_at`; `jobs_ledger_payment_events` for moves |
| Office events with actor names, role-gated | `list_job_activity_events` RPC per job (status, payments, bills, promises, collections, contracts, lien releases, discounts; cap 200) — `fetchJobActivityEventsForJobLedger` |
| Notes, office vs field | `jobs_ledger_thread_notes` (author_user_id → `users.role`); clock-session notes are field by definition |
| Hours | `clock_sessions` by `job_ledger_id` (`fetchClockSessionsForJobLedger`); `jobHoursStory.ts` folds them per day and already powers the man-hours chip's window |
| Reports | `job_test_reports`; `list_reports_for_job_ledger` |
| Materials | `jobs_ledger_materials.amount` + `supply_house_invoice_job_allocations` (invoice amount × pct) |
| Promises | `job_payment_promises` (`paymentPromises.ts`) |
| Per-customer aggregation shape | `customerSummaryActivity.ts` (Dispatch mode's customer summary: jobs by `customer_id`, cap 60, per-job reads in parallel) |
| Concurrent jobs on lanes | `packBarsIntoLanes` in `projectsJobHistoryLanePacking.ts` |
| The bar's money | `customerProfileStats` (open balance, aging, median days to pay) |

Nothing new in the database for PRs 1–3.

## The plan

**PR 1 — the kernel, no screen.** `src/lib/customers/customerTimeline.ts` + tests:
`buildCustomerTimeline(input, todayYmd)` → the jobs with their lane and state segments, the days
(each with its office and field cards), the gap spacers, the quiet folds, and a running snapshot per
day (owed, unbilled, unpaid hours, unpaid materials); the fold rule for field days; the kind → side
table. `fetchCustomerTimeline(customerId)` beside it: the customer's jobs (by `customer_id`, as the
profile does), then the per-job reads above in parallel, capped like the summary.

**PR 2 — the window.** `CustomerTimelineView` inside `CustomerProfileModal` behind the Profile |
Timeline switch: three columns on a computer, one on a phone, the floating bar, focus, the Show
chips, the `?timeline=` deep link. Help guide *see everything that happened with a customer*; release
note and fragment; `PROJECT_DOCUMENTATION.md` and `GLOSSARY.md` lines; the profile's section in the
docs amended.

**PR 3 — the Pipeline doors and the scrub.** The search chip; *show the days ›* opens the job's hours
story; the as-of line if PR 2 left it out; the Customers page door.

**PR 4 — one round trip, only if needed.** `list_customer_timeline(p_customer_id)` (server-side
role gating, one query per source) when PR 1's per-job reads are slow on a 60-job GC. Migration,
types PR, `EDGE_FUNCTIONS`/`ACCESS_CONTROL` lines.

## How to verify

Dev login, Jobs → Pipeline, the customer name on a GC's row → Timeline. Every open job's rail reaches
the top with an arrowhead. *Owes us* equals the profile's open balance. *Unpaid hours* equals the
sum of the hours story on the open jobs. A paid job ends in ✓ on the day of its last payment, and
that card names the cheque and its deposit day. The phone preset at 375 px; both themes. An
assistant sees it; a helper has no door.
