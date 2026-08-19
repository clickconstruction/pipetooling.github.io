# Jobs board scoped-load plan (the "query diet")

---
file: JOBS_BOARD_SCOPED_LOAD_PLAN.md
type: Plan
purpose: Cut the Pipeline board's database footprint by an order of magnitude — fetch-on-expand sections, aggregate headers, server-side search
status: Approved by owner 2026-08-19; PR 0 shipped (v2.1819), PRs 1–5 not started
last_updated: 2026-08-19
---

## Why (grounded in the 2026-08-19 incident)

Prod stalls ~5×/day in short bursts (statement timeouts → idle-in-transaction kills → one full
restart at 09:49:18 on 2026-08-19). The statement Postgres canceled during that window was this
board's primary query. Realtime's "Too many database timeouts" error bursts (68/24h) are collateral
from the same windows — fixing the board shrinks the blast radius of every stall and removes the
app's single heaviest steady-state read.

**What one board load costs today** ([`fetchJobsLedgerWithDetailsForStages.ts`](../src/lib/fetchJobsLedgerWithDetailsForStages.ts)):

1. Primary query: every non-paid job (~130 rows) × 8 embedded relations (invoices, payments,
   team members+users, reports, projects, bids, gc_customer, development, account_manager,
   service_types) via LATERAL joins, ordered by `hcp_number desc`.
2. Second round, batched `.in()` chunks of 150: materials, fixtures, schedule work dates
   (`mergeMaxScheduleWorkDateByJobId`), linked estimates.
3. Expanding Paid in Full (or typing **one character** into search, which prefetches paid so
   search can match it): the same again for ~667 paid jobs.
4. Every mutation and realtime nudge schedules a full refetch of everything loaded
   (`scheduleLoadJobsAfterMutation` → debounced `loadJobs`); tab-return after 30s+ refetches too
   (`VISIBILITY_REFETCH_MIN_MS`).

## Target architecture

Generalize the proven Paid-in-Full lazy pattern ("Expand to load" + `paidJobsMergedForKey`)
from one special case to every section, and stop deriving header numbers from full rows.

### 1. Header stats RPC (no rows, one grouped query)

New `jobs_board_section_stats(p_customer_filter uuid default null)`:

- `SECURITY INVOKER`, `STABLE` — RLS applies per caller, so counts match what each role's board
  would show. No table changes; idempotent `CREATE OR REPLACE`.
- Returns one row per section key — `waiting | working | ready_to_bill | billed | collections |
  paid` (billed vs collections split on `collections_at`, mirroring
  [`stagesSectionKeyForJobRow`](../src/lib/jobs/stagesJobNumberJump.ts)) — with:
  `job_count`, `revenue_sum`, `payments_sum`, `capable_to_bill_sum`
  (Σ max(0, revenue × pct_complete/100 − billed), the
  [`capableToBillTotalFromWorking`](../src/lib/jobsStagesBoard.ts) formula).
- **Parity rule**: the RPC returns raw sums; a TS kernel formats them and is unit-tested against
  the same fixtures as the existing row-derived math. One live side-by-side check
  (headers from RPC vs headers from rows) before the row-derived path is removed.

### 2. Scope-aware cache

[`JobsListCacheContext`](../src/contexts/JobsListCacheContext.tsx) grows from
`{non_paid loaded, paid merged?}` to `mergedScopes: Set<Scope>` per cache key:

- `fetchScopeIfNeeded(scope, customerFilter)` — generalizes `fetchPaidJobsIfNeeded` verbatim
  (same in-flight/merged/main-load guards; keep the v2.1813 lesson: waiters re-kick when the main
  list settles rather than reading "couldn't start" as failure).
- `statusScope` in the fetch fn grows from `'all' | 'non_paid' | 'paid'` to per-status scopes
  (`waiting`, `working`, `ready_to_bill`, `billed_all` (billed incl. collections), `paid`) —
  additive; existing values keep working during the train.
- **Refresh scoping**: the debounced refetch re-fetches only currently-merged scopes; the stats
  RPC re-runs on every refresh (cheap) so collapsed headers stay live.
- **Cross-scope moves**: a status move (e.g. RTB → Billed with Billed un-fetched) patches the
  moved row's status locally (rows may live in `jobs` from any scope; `buildJobsStagesBoardLists`
  already sections by row status) and refreshes stats — no fetch of the destination scope needed.

### 3. Sections: collapsed by default, fetch on expand

- Default open: **Ready to Bill only** (owner-picked). Expanding any section fetches its scope
  and shows the Paid-style "… — loading" header until merged.
- Per-device persistence (`pipetooling_stages_sections_v2` in localStorage, lanes-default
  pattern): whatever you leave open is what loads next visit. Explicit picks stick.
- Headers always render from the stats RPC (identical numbers whether fetched or not).
- First paint: stats RPC + ~6 RTB rows with embeds, instead of ~130 rows + batches.

### 4. Server-side search (≥2 chars, debounced)

- New lean lookup — RPC `jobs_board_search(p_query text)` (RPC rather than PostgREST `or=ilike`
  because customer-name matching needs a join): returns `id, status` only, matching
  `hcp_number/click_number` prefix and `job_name/address/customer` ilike. `SECURITY INVOKER`.
- Flow: ≥2 chars → 300ms debounce → search RPC → fetch full details for the returned ids
  (by-ids variant of the stages fetch) → merge via the existing
  `stagesSearchExtraJobIds` mechanism → sections filter/display matches exactly as today.
- **Deletes the worst current behavior**: search no longer prefetches the full paid universe.
- The **# jump** (v2.1808) swaps its paid-fallback for the same lean lookup: number miss →
  search RPC by number → fetch that job → land in filter mode. The chip's async machinery
  ("Checking…" state, pending-jump resolver) is reused unchanged.

## Consumers audit (who reads the full list today, and what happens to them)

| Consumer | Today | Plan |
|---|---|---|
| Stages/Pipeline tab | full non-paid + lazy paid | scoped (this plan) |
| Billing / Parts / Sub-sheet tabs ([`Jobs.tsx`](../src/pages/Jobs.tsx) gate at ~589) | share the cache's full list | request `non_paid` scope on tab activation — unchanged UX, cost only when those tabs are used |
| Quickfill sections (`useQuickfillCompleteNoBillJobs`, `useQuickfillStagesJobsWithoutCustomer`) | read full list | request the scopes they filter (`working`+`billed_all`) |
| [`JobsAccountsReceivable`](../src/pages/JobsAccountsReceivable.tsx) standalone page | own full fetch via same fn | unchanged (page exists to see everything) |
| `JobDetailModalContext` | by-id lookup in cache | keep; solo-fetch fallback for ids not in any merged scope |
| GC / development / account-man filter options | derived from loaded rows | derive from merged scopes; the ⋯ tools menu triggers `non_paid` fetch on open if options must be complete |
| Weekly money modal, `bankPaymentsModalBilledRows` | full list | fetch `billed_all` (+`paid` where needed) on modal open |
| Dashboard job sections | separate RPCs (`list_assigned_jobs_for_dashboard`) | unaffected |

## PR train

0. **PR 0 — paid-search chip (SHIPPED v2.1819)**: search no longer auto-prefetches the full
   paid list on the first keystroke; the "Search Paid in Full too" chip
   ([`paidSearchChip.ts`](../src/lib/jobs/paidSearchChip.ts)) makes it opt-in — quiet outline
   while loaded jobs match, solid when nothing matches, loading → "✓ included". Retires when
   PR 4's server search covers all statuses natively.
1. **PR 1 — stats RPC** (backend-only migration + `MIGRATIONS.md`; `SET lock_timeout`;
   no client change). Regen types after push.
2. **PR 2 — cache generalization** (no visible change): scoped fetch/merge/refresh machinery,
   initial load still `non_paid` so behavior is identical; kernel + tests for scope bookkeeping.
3. **PR 3 — collapsed-by-default + fetch-on-expand + stats headers** (the visible change).
   Help guide update (Pipeline guide's sections description).
4. **PR 4 — server search + # jump lean lookup** (second migration for `jobs_board_search`);
   removes the search→paid prefetch.
5. **PR 5 — tightenings**: refresh only merged scopes, filter-options/modal fetch-on-open,
   remove dead full-list paths, before/after measurement writeup.

Each PR is independently revertable; the visible flip is isolated in PR 3.

## Risks & mitigations

- **Header math drift** (RPC vs kernel): shared fixtures + live side-by-side check before cutover.
- **Full-list assumptions**: the audit table above is the checklist; PR 2 adds a dev-only console
  warning when a consumer reads `jobs` while its needed scope is un-merged.
- **RLS/roles**: `SECURITY INVOKER` keeps stats identical to row visibility per role; test the
  9 roles on the stats RPC (superintendent and primary see restricted boards).
- **Fetch races**: reuse the merged-key + busy-main-list waiter patterns (v2.1808/v2.1813
  lessons live in `stagesJobNumberJump.ts` history).
- **Stale collapsed sections**: stats refresh on every mutation keeps counts honest even where
  rows aren't loaded.

## Measurement

Before/after on a normal weekday: Postgres log volume for this query shape, realtime
"Too many database timeouts" bursts per day (68/24h baseline on 2026-08-19), and board
first-paint time. Success = order-of-magnitude fewer board-driven rows read, no stall burst
attributable to the board query.
