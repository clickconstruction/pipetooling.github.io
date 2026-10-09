---
name: "ZZ test jobs off the Pipeline for everyone but a dev"
number: 61
group: ready
status: parked 2026-09-29 — the owner took the three calls (the ZZ prefix is the rule, any switch is dev only, the sweep first) and the sweep shipped the same day (v2.4157, Settings → Data & recovery → ZZ test jobs) · the gate is met 2026-10-09 (five ZZ jobs on jobs_ledger, one 10 days old, past the sweep's week) · the build is planned below as three PRs; Todd's go 2026-10-09 · PR 1 shipped v2.5116 (the Pipeline, its strip and Quickfill's money without ZZ jobs for every role but dev; the paid head-count and collected-by-day too) · PR 2a shipped v2.5120 (the dev's switch, hidden by default, and the Dashboard's Billed pin, AR card and Ready to bill / Billed lists, by a shared ZZ id read) · PR 2b next
summary: >
  Jobs → Pipeline shows every ZZ test job the live passes and robot runs leave behind — rows the
  office scrolls past, and $2,200 test bids inside "Ready to ask for", the stage counts and the
  section totals (Ready to Bill read 7 while the Dashboard said 2). The proposal: one kernel
  (`isZzTestJob`, now in `src/lib/jobs/zzTestJobSweep.ts` — job name or customer name starts with
  ZZ) applied where the board loads its jobs and its header money, so for every role but dev the
  rows, counts and dollars are simply absent; a dev keeps one checked-by-default line in the
  ⋯ menu's existing Hide groups… modal, with a quiet chip while hidden and an amber one while
  shown. The mockup beside this card shows the Ready to Bill section before, after for the
  office, and after for a dev.
next: >
  PR 2b (The build, below): the other office doors, each dropping ZZ jobs by the shared ids
  (`zzTestJobRows.ts`): header search, the Dashboard's job cards and the Needs you nudges, and
  Customers. PR 3, the Lien desk, waits for a quiet lien lane.
size: M–L (three PRs)
ver: v2.5116 (PR 1) · v2.5120 (PR 2a)
blocker: None for PR 2. PR 3 waits for a quiet lien lane.
opinion: build — the sweep did not keep the board clean, and PR 1 alone gives the office an honest Pipeline.
---

# ZZ test jobs off the Pipeline for everyone but a dev

## The ask

The owner, 2026-09-29, after the J1031/J1037 reassigns: *"on jobs, stages, there are a lot of ZZ tests, should we hide 'ZZ TEST' by default from the stages by checkbox that is selected by default for all users? I see them stacking up as we add and play with features — how could we offer this?"* Then: *"the primary goal is to not let other non devs see them on jobs stages in particular."*

## The decision

- **The ZZ prefix is the rule**, not a new column — the glossary's convention already binds twins and live passes to it, and every row on the board fits it.
- **Dev only.** Assistants and the controller never need the rows; for them there is no checkbox — the rows are not loaded.
- **The sweep first** (shipped v2.4157): a dev tool that folds week-old ZZ jobs into the sink (the ZZ job named `ZZ TEST sink`) through the reassign door. The hide is built only if the swept board still shows residue.

## The mock-up

`zz-test-jobs-before-after.html` beside this card: the Ready to Bill section as Taunya sees it today (seven rows, three ZZ, the money strip inflated), the same section after for the office (four rows, honest totals, no control), and after for a dev (the quiet chip and the new line in Hide groups…).

## The build (planned 2026-10-09; nothing cut until Todd's go)

Three PRs, each cut from `main` after the one before it merges. One rule throughout: `isZzTestJob`
(`src/lib/jobs/zzTestJobSweep.ts`, the job's own `job_name` or its `customer_name` starts with ZZ;
both are plain `jobs_ledger` columns, so no join is needed).

**A view rule, not RLS.** The digital twins and the live passes run as non-dev roles and make the
ZZ rows, so they must keep reading them. The hide happens where the office's screens load and add
up jobs. A dev can still see the office's view through *View as*.

### PR 1 — the Pipeline for the office (the smallest safe piece, M) — shipped v2.5116

- **Kernel** `src/lib/jobs/zzTestJobVisibility.ts` (pure):
  - `hidesZzTestJobs(role)` is true for every role but dev.
  - `withoutZzTestJobs(rows)` drops the ZZ rows.
  - `withoutZzTestJobMoney({ jobs, invoices, payments })` drops a ZZ job together with its bills and
    payments. Dropping the job alone would leave its bills as *orphans* in `computeBillTruth`
    (`billTruth.orphans` / `excludedOwed`), the excluded-bills hint.
- **The Pipeline's rows** (`src/contexts/JobsListCacheContext.tsx`). The rule runs at every point
  where rows reach the cache:
  - the board snapshot read from IndexedDB, about line 179, which paints before any fetch;
  - the scoped merge, about line 211;
  - the full fetch.
  For a non-dev the ZZ rows never enter state, so the sections, counts, totals and the board's map
  card are without them. The cache is shared, so `/accounts-receivable` and Quickfill's *Complete,
  no bill* and *No customer* sections lose the rows in the same PR.
- **The strip and Quickfill's money** (`src/lib/jobs/fetchStagesHeaderStats.ts`).
  `LEAN_STATS_JOB_COLUMNS` gains `job_name, customer_name`, and the fetch gains an option
  `excludeZzTestJobs` that applies `withoutZzTestJobMoney` before assembly and bill truth. Three
  callers pass `hidesZzTestJobs(role)`:
  - the cache (the Pipeline strip);
  - `BilledAwaitingPaymentSection` (Quickfill);
  - `usePipelineMoneyOpportunities` (Quickfill's Jobs cleanup, its only host).
  Two figures skip job rows: the paid head-count and collected-by-week, which reads raw payments. A
  ZZ job already paid still lands in them unless both reads gain the name filter (`ilike 'zz%'` on
  `job_name` and `customer_name`). Recommended: add it.
- **A dev sees no change.** Every ZZ row is shown as today, because the switch is PR 2.
- **The Dashboard's money does not move in PR 1**, because none of its cards read this fetch. The
  Billed pin is `useBilledTotal`, the AR / Unbilled card is `useDashboardFinancials`, and the Ready
  to bill / Billed lists are `useDashboardBillingInvoices`; each reads `jobs_ledger` itself. So
  between PR 1 and PR 2, a non-dev sees the Pipeline strip and Quickfill read lower than those
  Dashboard cards by exactly the ZZ jobs' money. No real job's figure changes anywhere.
- **Tests**:
  - `zzTestJobVisibility.test.ts`: the role matrix; a ZZ job name, a ZZ customer name only, and
    neither; the money drop keeps a real job's bills and payments and drops a ZZ job's, and
    `computeBillTruth` over the result has no orphans.
  - `fetchStagesHeaderStats.test.ts`, which mocks the client: with the option, Ready to Bill's count
    and the Owed total come back without the ZZ job; without it, as today.
  - `JobsStagesTab.render.test.tsx`: as an assistant, no ZZ row and the section count without it,
    including from a snapshot that holds a ZZ row; as the dev, the row is there.

### PR 2 — the dev's switch, the Dashboard's money and the other doors (M–L) — 2a shipped v2.5120

- **The switch** (the mock-up's after-for-a-dev). One line, *ZZ test jobs*, in Hide groups… is
  checked by default. It lives in `JobsStagesHideGroupsModal.tsx` and `jobsStagesExcludeFilters.ts`,
  stored per device beside the other `jobs-stages-*` keys. While they are hidden a quiet chip reads
  *N ZZ test jobs hidden*; while they are shown an amber chip says so.
  - `hidesZzTestJobs(role, devShowsZz)` takes the switch.
  - A dev's cache keeps the rows and the board hides them at view time, so the chip can count them.
  - The fetch callers pass the same answer, so a dev's strip and Quickfill follow the switch.
- **The Dashboard's money, said plainly.** For every non-dev, and for a dev while the switch hides
  them, three Dashboard surfaces drop the ZZ jobs' revenue, bills and payments:
  - the Billed pin (`useBilledTotal`, whose select gains the two name columns);
  - the AR / Unbilled card (`useDashboardFinancials`, which already reads both names);
  - the Ready to bill / Billed lists (`useDashboardBillingInvoices`).
  Each figure falls by exactly the test money, such as a $2,200 test bid. The Pipeline strip,
  Quickfill and the Dashboard agree again.
  The Bridge (dev only) reads `useDashboardFinancials` too, so the dev's Bridge drops the test money
  while the switch hides it.
  One gap: `get_jobs_ledger_by_status` returns `job_name` but no customer name. PR 2 either reads
  the customer's name for those rows or accepts that a ZZ customer with a real job name slips
  through. Changing the RPC would add a migration.
- **The other office doors**:
  - Header search (`HeaderGlobalSearch.tsx`): the `search_jobs_ledger` job hits by `job_name`, and the
    customer hits by name.
  - The Dashboard cards that list jobs: the assigned, team ready-to-bill and superintendent RPCs
    (their rows carry `job_name`), and the *Jobs on a map* card that reuses them.
  - The Needs you nudges that name jobs or sum their money: stale open jobs, lien releases owed,
    bank-returned payments and test reports ready.
  - Customers: a ZZ customer's row on the list, and a ZZ job on a real customer's page.
  - Split as planned. 2a (v2.5120) shipped the switch and the Dashboard's money. 2b is the doors.
  - **The shared ZZ id read (2a).** PR 1's fifth read became `src/lib/jobs/zzTestJobRows.ts`, shared by every
    reader. It answers once a minute, and the sweep clears it. A screen whose rows carry only ids, or no
    customer name, drops ZZ jobs by these ids. That closed the `get_jobs_ledger_by_status` gap with no
    migration.
  - **The trim nit is settled (2a).** The read asks the server for any name containing *zz*, and the kernel
    re-checks, so a leading-space name is caught on both sides. The sweep keeps its strict filter.
- **Tests**: the switch's kernel and its localStorage default; a render smoke on the modal's line
  and both chips; `useBilledTotal` and `dashboardFinancials` kernels with a ZZ job in and out;
  render smokes on the header search and the Customers list as an assistant.

### PR 3 — the Lien desk (S, last; waits for a quiet lien lane)

- **The desk** (`src/hooks/useLienDeskData.ts`). Its queue is built from the RPC rows (around line
  237) before the jobs join, and the join's `LIEN_DESK_JOB_COLUMNS` already has both names. So the
  rule drops ZZ job ids from `rows`, `items`, `affidavitRows` and `retainageRows` after the join.
  This covers the desk's light mode on the Dashboard's pinned row and in Quickfill's Needs you.
- **The rest**: the timeline book, whose `LIEN_BOOK_JOB_COLUMNS` gains `customer_name`, and GC on
  notice (`useGcOnNoticeData`).
- **Waits** until no lien PR is open on `useLienDeskData.ts` or `src/lib/jobs/lienDesk.ts`. On
  2026-10-09 the lien desk signing lane and v2.5093 (#5192) were open. Cut it from `main` after they
  land.
- **Tests**: a `lienDesk` kernel case with a ZZ job in each of the four lists, and the Lien desk
  render smoke as an assistant.

## How to verify

- **After PR 1**: as an assistant on the dev server (`/dev-login?as=<assistant>`), the Pipeline has
  no ZZ row, and its strip agrees with its own sections. As the dev, every ZZ row is there as before.
- **After PR 2**: as the assistant, the strip's Ready to Bill count equals the Dashboard's. As the
  dev, the chip reads *N ZZ test jobs hidden*, and unchecking the line brings the rows back with the
  amber chip.
- **After PR 3**: the Lien desk lists no ZZ job for the assistant.
