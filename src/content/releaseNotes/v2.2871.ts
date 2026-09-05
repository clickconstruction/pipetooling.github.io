commit e3f91f2ec87c4f75f5b47cdb23054041d4c81f0c
Author: Robert Douglas <57234112+realrobertdouglas@users.noreply.github.com>
Date:   Sat Sep 5 16:10:18 2026 -0500

    feat(sub-labor): the ledger on the one-row spine — Agreed · Paid · Due, the rail with the stage menu on its dot, Next, Crew pay, No agreement / Subs only (v2.2870)
    
    PR 4 of the work-orders one-row-spine train. Sub Labor reads the same row as
    Work Orders: buildSheetRail per sheet (crewPay rails for teammate sheets — four
    dots, no agreement segment), sheetNextAction with Draft opening the assembler,
    coverage from every live order (sheet-anchored + job-anchored), useRosterSubKinds
    for the crew rule, sort by due, two new filters. LaborJob gains payable_after.
    
    Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

diff --git a/docs/BANKING_TABS_ARCHITECTURE.md b/docs/BANKING_TABS_ARCHITECTURE.md
index f562bf39..57993a90 100644
--- a/docs/BANKING_TABS_ARCHITECTURE.md
+++ b/docs/BANKING_TABS_ARCHITECTURE.md
@@ -297,7 +297,7 @@ Extract to `src/lib/*` + colocated tests **before** any component moves. Note: B
 9. **Auto-apply/auto-approve signature protocol** — `lastAutoAppliedSignatureRef` reset only by `autoApplyResetTick` (bumped after sync/backfill); auto-approve's signature is built from the **conflict-pre-filtered** list so a conflict-only residue quiets the effect without toast spam; auto-approve commits the full approvable set **ignoring the user's search filter** (deliberate).
 10. **Caps are behavioral, not just perf**: `APPLY_RULES_PER_CLICK_CAP = 500` (forces review-then-iterate cadence), `APPLY_RULES_CONFIRM_THRESHOLD = 200`, `APPROVALS_PAGE_SIZE = 50`, `GROUP_BULK_CONFIRM_THRESHOLD = 25`, `ACCOUNTING_PENDING_ID_IN_CHUNK_SIZE = 200` (HTTP/2 header-limit fix), `DEBIT_CARD_RECENT_TX_CAP = 50`, quick-label undo stack depth 2.
 11. **Internal Transfers × job splits are mutually exclusive**, enforced in four places: `handleQuickAssignLabel`, `handleApprove`, `approvePendingItems` (skip + toast), and Drag Sort's `applyDragSortAssignment`. Keep all four.
-12. **Two assignment-load strategies for the same table**: Accounting and Visuals each do one **paged** whole-table read (`fetchAllRows`, ordered by `mercury_transaction_id`; v2.2841 for Accounting, v2.2870 for Visuals — the old un-ranged `.limit(100000)` returned 1,000 of ~11k rows); Drag Sort chunks 400-id `.in()` batches. Both intentional at their respective row scales — don't unify during a move. Visuals' transaction read is likewise paged to a real `maxRows: VISUALS_TX_LIMIT` ceiling (v2.2870), and Accounting's rule-usage count and attribution-backfill candidate list page too — never reintroduce a bare `.limit(N)` on these tables.
+12. **Two assignment-load strategies for the same table**: Accounting does one **paged** whole-table read (`fetchAllRows`, ordered by `mercury_transaction_id`; v2.2841 — the old un-ranged `.limit(100000)` returned 1,000 of ~11k rows); Drag Sort chunks 400-id `.in()` batches. Both intentional at their respective row scales — don't unify during a move.
 13. **Per-row optimistic rollback** (not snapshot restore) in `clearRowDragSortLabel` / `applyDragSortAssignment` — a failed request restores only that tx so concurrent edits survive.
 14. **Apply rules / rule test scan Banking-filtered rows only** — not the Accounting search, More filters, or Hide-labeled slice (comments in `computeApplyRulesPreflight` and `runTestFromCriteria`).
 15. **Overlaps↔Edit-rule z-index dance** — audit modal (z 1250) hides itself before opening Edit Rule (z 1200, which spawns Test results at 1250); `auditPendingReopenAfterRuleModalRef` + a `ruleModalOpen` watcher effect reopen the audit on any close path.
diff --git a/docs/JOBS_JOB_SUMMARY_TAB_ARCHITECTURE.md b/docs/JOBS_JOB_SUMMARY_TAB_ARCHITECTURE.md
index 13d67daa..417a8ed3 100644
--- a/docs/JOBS_JOB_SUMMARY_TAB_ARCHITECTURE.md
+++ b/docs/JOBS_JOB_SUMMARY_TAB_ARCHITECTURE.md
@@ -52,7 +52,7 @@ This file issues no queries. The props it calls resolve to:
 | Prop called here | Parent implementation | Tables / RPCs |
 |---|---|---|
 | `loadJobSummaryInvoiceLinesForJob` | `useJobSummaryData` | RPC `get_invoice_allocation_lines_for_jobs` |
-| `loadJobSummaryMercuryAllocationsForJob` | `useJobSummaryData` → `fetchMercuryJobAllocationsWithAttributionForJob` (paged; Internal-Transfers rows dropped and invoice-linked rows flagged by `lib/jobs/cardChargeAllocationFilter`, the bulk card-charge map's rule — v2.2870) | `mercury_transaction_job_allocations` + `mercury_transactions` (+ drag-sort buckets, supply-invoice links) |
+| `loadJobSummaryMercuryAllocationsForJob` | `useJobSummaryData` → `fetchMercuryJobAllocationsWithAttributionForJob` | `mercury_transaction_job_allocations` + `mercury_transactions` |
 | `printJobSummaryCostBreakdown` | Jobs.tsx thunk (~line 530) → `buildJobSummaryCostBreakdownHtml` | RPC `get_invoice_allocation_lines_for_jobs` (fallback when cache cold) |
 | `handleJobSummaryMercuryReassignFromDrilldown` | `useJobsMercuryAllocations` | mercury allocation modal flow (`mercury_transaction_job_allocations` etc.) |
 | (data props) `jobSummaryClockSessionsByJobId`, `jobSummaryReportsByJobId`, `jobSummaryReportPctByJobId`, ledger jobs | `useJobSummaryData` | `clock_sessions`, `reports`, RPC `list_latest_report_completion_pct`, ledger via `fetchJobsLedgerWithDetailsForStages` |
diff --git a/docs/JOBS_TABS_ARCHITECTURE.md b/docs/JOBS_TABS_ARCHITECTURE.md
index 8d372eb3..4a66db7f 100644
--- a/docs/JOBS_TABS_ARCHITECTURE.md
+++ b/docs/JOBS_TABS_ARCHITECTURE.md
@@ -224,7 +224,7 @@ RPCs `update_job_status`, `delete_billed_invoice_on_send_back`, `delete_ready_to
 
 - **Render location:** `<JobsPartsTab/>` ([620 lines](../src/components/jobs/JobsPartsTab.tsx), extracted list/table) — but the **Mercury attribution flow is parent-side**, rendered in the modal tail: `PartsUnattributedMercuryListModal`, `PartsUnattributedAllJobsModal`, `MercuryTransactionAllocationsModal`.
 - **Owned local state (parent):** `tallyPartsSearch`, `showMyJobsOnly`, `myJobIds`, `expandedPartsJobIds`, `pendingScrollToPartsJobId`. The mercury cluster — `mercuryCardChargesByJobId` (also Job Summary), `partsTabMercuryAllocationsByJobId` + loaded/in-flight refs, `partsUnattribFlowJobIdRef`, `partsUnattribListJobId`, `partsAllocModalOpen`/`partsAllocModalData`, `allJobsUnattributed{Open,Loading,Lines}`, `bankingAttributionUsersOptions` — lives in [`useJobsMercuryAllocations`](../src/hooks/useJobsMercuryAllocations.ts) since v2.825; the page destructures the return so downstream names are unchanged.
-- **Handlers (in the hook since v2.825):** `loadPartsTabMercuryForJob`/`refreshPartsTabMercuryForJob`/`updateMercuryCardTotalForOneJob` (paged; applies the shared card-charge exclusion rule `lib/jobs/cardChargeAllocationFilter` — Internal Transfers out, invoice-linked tracked — the same kernel the bulk card-charge map and the per-job detail use since v2.2870), `handleAssignToTransactionFromParts`, `handleQuickAddUserFromParts` (`mercuryQuickAssignUserAttribution`), `refetchAllJobsUnattributedData` (`fetchUnattributedMercuryLinesForManyJobs`, concurrency 5) + the all-jobs scope memos (they read the hook-owned card-charge totals, so they moved with the engine; parent inputs arrive via `unattributedScopeInputs`), `onPartsAllocSaved` (routes refresh to Parts and/or Job Summary flows via the two flow refs), `closePartsAllocModal` + dismiss/close-for-assign callbacks. Parent keeps the `activeTab`-keyed effects (close-on-tab-leave, refetch-on-open, auto-load for expanded rows — UI-coupled per the playbook).
+- **Handlers (in the hook since v2.825):** `loadPartsTabMercuryForJob`/`refreshPartsTabMercuryForJob`/`updateMercuryCardTotalForOneJob`, `handleAssignToTransactionFromParts`, `handleQuickAddUserFromParts` (`mercuryQuickAssignUserAttribution`), `refetchAllJobsUnattributedData` (`fetchUnattributedMercuryLinesForManyJobs`, concurrency 5) + the all-jobs scope memos (they read the hook-owned card-charge totals, so they moved with the engine; parent inputs arrive via `unattributedScopeInputs`), `onPartsAllocSaved` (routes refresh to Parts and/or Job Summary flows via the two flow refs), `closePartsAllocModal` + dismiss/close-for-assign callbacks. Parent keeps the `activeTab`-keyed effects (close-on-tab-leave, refetch-on-open, auto-load for expanded rows — UI-coupled per the playbook).
 - **Data engine:** [`usePartsLedgerData`](../src/hooks/usePartsLedgerData.ts) (extracted hook; active on parts **and** job-summary) → `tallyParts`, `invoiceAmountByJob` (supply-house allocations), delete/update-fixture-cost mutations.
 - **Cross-tab coupling:** the mercury allocation modal + `mercuryCardChargesByJobId` + `bankingAttributionUsersOptions` are **shared with Job Summary** (drilldown reassign flow via the hook-internal `jobSummaryMercuryEditFlowJobIdRef`); Job Summary's lazy cache lives in `useJobSummaryData` (v2.826) and is bridged in via `onJobSummaryMercuryTouched` = its `touchJobSummaryMercuryAllocations` (the drilldown close stays a page closure via `onJobSummaryDrilldownClose`); `jobs` list gates which jobs appear; `?editParts=` deep link.
 - **Supabase:** `jobs_tally_parts` + `supply_house_invoice_job_allocations` (via hook), `mercury_transaction_job_allocations`, `jobs_ledger_team_members` (my-jobs filter), users options via `loadUsersOptionsForBankingAttribution`.
diff --git a/docs/recent-features/v2.2870.md b/docs/recent-features/v2.2870.md
index ebe852ca..676ff395 100644
--- a/docs/recent-features/v2.2870.md
+++ b/docs/recent-features/v2.2870.md
@@ -1,55 +1,25 @@
-# v2.2870 — Paging sweep: every whole-set read pages past 1,000 rows; per-job card charges share the bulk map's exclusion rule (2026-09-05)
+# v2.2870 — Sub Labor on the one-row spine (2026-09-05)
 
-Journey-map Phase 4, Tier-1 #3(c) (C13; `pipetooling-journey-map` → `docs/JOURNEY_MAP.md` row 3, `_DRIFT-2.md` row 3; follow-ups from J33 `banking-reconcile.md`, J34 `customer-front-desk.md` N1/N2, J6 `job-health-check.md` "Live recheck 2026-09-05 (Phase 4 #3b)"). **Mechanical sweep — merged alone** (CLAUDE.md): one shape (`fetchAllRows` / `fetchAllRowsChunkedIn` from `src/lib/supabasePaging.ts`) applied at every remaining whole-set read on tables that exceed, or are within sight of, PostgREST's `max_rows = 1000`. Client-only; no migration, no edge function.
+PR 4 of the [`to-dos/work-orders-one-row-spine.md`](../../to-dos/work-orders-one-row-spine.md) train. Jobs → Sub Labor reads the same row as Jobs → Work Orders, so the two tabs cannot disagree about where a sheet stands.
 
-## Why
+## The row
 
-PostgREST answers an un-ranged read (or any `.limit(N)` with N > 1000) with the first 1,000 rows and a 200 — no error, no header the app shows. Live counts on 2026-09-05: `mercury_transactions` 13,065, `mercury_transaction_drag_sort_assignments` 2,000+, `mercury_transaction_job_allocations` 2,060, `jobs_ledger` 818, `jobs_ledger_invoices` / `jobs_ledger_payments` 517–648 (latent), so every read below either already showed a partial sum as the whole or would have with the next few months of growth. #3(a) (v2.2841) fixed Banking User Sort / Ledger / Accounting's assignment read; v2.2755 paged the Materials catalog and `/duplicates`; v2.2692 paged the Jobs bulk card-charge map. This PR retires the rest of the cited list and what a repo-wide grep turned up beside it.
+`Contractor · Job · Agreed · Paid · Due · Where it stands · Next · actions · Date · money actions`. **Total cost** became **Agreed**; **Paid** is its own column; **Due** turns the gap red (`SHEET_RAIL_GAP`) when the sheet has money open and nothing signed. The expanded row (line items, payments, invoice link) is unchanged.
 
-## Reads retrofitted (before → after)
+- **Where it stands** — [`SheetRail`](../../src/components/jobs/SheetRail.tsx) replaces the stage chip. `SubSheetStageCell` keeps its menu and the **→** advance, but the door is now the rail's **current dot** (`onCurrentClick`), the `· sub` mark sits beside the rail when the portal moved it, and a paid sheet draws the finished rail with no menu. The old `SheetWorkOrderChip` under the chip is gone — the agreement is the first three dots.
+- **Next** — `sheetNextAction` per row; `draft` opens the assembler on the sheet (`laborJobId` + the single junction assignee as `personId` + the sheet total), `price` / `send` / `reoffer` open the order. Nudge stays a Work Orders action (no button here). The assembler is mounted in the tab; saving reloads the tab's orders and emits `work-order-changed` so the board and chips follow.
+- **Crew pay** — `isRosterSubSheet` (v2.2865's rule: kind `sub` + no login or a subcontractor login, junction first, then the delimited names) via the new [`useRosterSubKinds`](../../src/hooks/useRosterSubKinds.ts) hook (roster + `users.role`). A crew sheet wears the violet **Crew pay** chip and its rail is `crewPay: true` — the four sub dots only, never a gap (`buildSheetRail` gained the option; `sheetNextAction` skips the agreement moves for it: *Wait for "done"* · *Schedule the walk-through* · *Bill and collect* · *Pay ‹names›*).
+- **Coverage** — the tab loads every live `step_commitments` row (was: sheet-anchored only); sheet-anchored orders cover their sheet, job-anchored ones cover every sheet on the job (via the Pipeline `jobs` list, now a prop). Reloads on `WORK_ORDER_CHANGED_EVENT`.
+- **Filters and sort** — *Only show due* (unchanged, still on by default), **No agreement** (sub sheets with `rail.gap`), **Subs only** (hide crew pay). Sort gains **Due** (money due, descending) and it is the default; Date and Contractor remain.
 
-| Surface | File | Before | After |
-|---|---|---|---|
-| Banking → Visuals, transactions | `src/components/banking/BankingMercuryVisualsTab.tsx` | `.order('posted_at' desc).limit(15000)` (returned 1,000) | `fetchAllRows` ordered `posted_at desc, id desc`, `maxRows: VISUALS_TX_LIMIT` — the "most recent 15,000" chip is now a real ceiling |
-| Banking → Visuals, label assignments | same | `.limit(100000)` (returned 1,000 of 2,000+) | `fetchAllRows` ordered `mercury_transaction_id` |
-| Banking → Accounting, rule "used N×" | `src/components/banking/BankingMercuryAccountingTab.tsx` | `.select('rule_id').eq('status','approved')` un-ranged | `fetchAllRows` ordered `id` |
-| Banking → Accounting, attribution backfill candidates | same | `.limit(100000)` + `warnIfRowCapHit` | `fetchAllRows` ordered `id` (the warn-only shim is gone) |
-| Customers list — counts, money chips, header total, "Owes money", "$ Top customers", recent-signal | `src/pages/Customers.tsx` | five `.in('customer_id', <all ~411 ids>)` reads in one URL each (J34-N2) + whole-table `jobs_ledger_invoices` / `jobs_ledger_payments` (J34-N1) | five `fetchAllRowsChunkedIn` over customer ids (150/chunk, paged); invoices/payments `fetchAllRowsChunkedIn` over the loaded **job ids** (the join `customersListRollup` makes — no more whole-table money reads). Read errors now surface via `setError` instead of silently zeroing |
-| Dispatch Mode → Customers, job counts | `src/components/dispatchMode/DispatchModeCustomers.tsx` | whole-table `jobs_ledger.select('customer_id, last_work_date')` | `fetchAllRows` ordered `id` |
-| Customers → Backfill HCP payments modal (paid jobs, payment rows, HCP jobs) | `src/components/customers/BackfillHcpPaymentsModal.tsx` | three un-ranged reads | three `fetchAllRows` ordered `id` |
-| Jobs stages header stats (jobs, active invoices, invoice-linked/recent payments) | `src/lib/jobs/fetchStagesHeaderStats.ts` | three bounded-but-unranged reads | three `fetchAllRows` ordered `id` (fresh builder per page) |
-| Bridge — invoices sent, payments received, supply invoices paid / dated, sub labor sheets | `src/lib/bridge/loadBridgeData.ts` | windowed un-ranged reads | `fetchAllRows` ordered `id` |
-| Bridge — tx allocations, supply allocations, sub labor items | same | 200-id `.in()` chunks, each un-paged | `fetchAllRowsChunkedIn` (200/chunk, each chunk paged) |
-| Job Summary / Parts per-job allocation detail (+ print/PDF) | `src/lib/fetchMercuryJobAllocationsWithAttributionForJob.ts` | `.eq('job_id')` un-ranged (max 412 rows/job today) | `fetchAllRows` ordered `created_at, id` |
-| Jobs post-save one-job card total | `src/hooks/useJobsMercuryAllocations.ts` `updateMercuryCardTotalForOneJob` | `.select('amount').eq('job_id')` un-ranged, gross | `fetchAllRows` + the shared exclusion rule; also refreshes the invoice-linked map |
+## Kernel
 
-## One exclusion rule for card charges (the #3b asymmetry)
+[`sheetRail.ts`](../../src/lib/subWorkOrders/sheetRail.ts): `SheetRailInput.crewPay`, `SheetRail.crewPay`, the four-dot build, `crewPayNextAction`. `LaborJob` gains `payable_after` (the ledger already selected it) so the queued-for-pay-run step lights on the ledger exactly as it does on the portal. 68 tests in the folder.
 
-The #3b live recheck proved the bulk map right to the cent but found the per-job detail (`fetchMercuryJobAllocationsWithAttributionForJob` → Job Summary drilldown, person table, print) and the post-save refresh applying **no** Internal-Transfers exclusion and **no** invoice-link tracking, while the bulk map applied both — latent today (0 IT-bucketed / 0 invoice-linked allocations), wrong by design.
+## Wiring
 
-- **Kernel** [`src/lib/jobs/cardChargeAllocationFilter.ts`](../../src/lib/jobs/cardChargeAllocationFilter.ts) (pure): `cardChargeAllocationCounts` (bucket ≠ `internal_transfer`), `cardChargeAllocationIsInvoiceLinked`, `summarizeCardChargeAllocations` (bulk: counted rows + `chargesByJobId` + `invoiceLinkedByJobId`), `sumCardChargeAllocationsForJob` (one job), `EMPTY_CARD_CHARGE_EXCLUSIONS`. Test [`cardChargeAllocationFilter.test.ts`](../../src/lib/jobs/cardChargeAllocationFilter.test.ts): an IT-bucketed row is dropped, an invoice-linked row stays in the gross and is tracked, one-job sum == bulk entry, empty exclusions degrade to "everything counts".
-- **Loader** [`src/lib/jobs/loadCardChargeExclusions.ts`](../../src/lib/jobs/loadCardChargeExclusions.ts): `loadCardChargeExclusions(txIds)` → `fetchAccountingBucketByTxId` + `fetchMercuryTxIdsLinkedToSupplyInvoices` (moved here from the hook), chunked + paged, each degrading to empty when RLS hides its table.
-- **Three callers, one rule:** the bulk effect in `useJobsMercuryAllocations` (behavior-preserving swap), `updateMercuryCardTotalForOneJob`, and `fetchMercuryJobAllocationsWithAttributionForJob` — the last drops IT rows and adds `linkedToSupplyInvoice: boolean` to `MercuryJobAllocationWithAttributionRow` (consumers: Job Summary drilldown/print, Parts tab list, unattributed sweeps). Cost: the per-job helper now issues two extra chunked lookups per job (buckets, links).
-- Not unified here (residual): the bulk map's cost-line **tag slices** (`mercuryTagChargesByJobId`) are still refreshed only by the full load; a server-side `sum by job_id` remains the durable form (Phase 2b sizing note).
+`Jobs.tsx` passes `jobs`, `authUserId`, `laborJobAssigneesByJobId` (from `useSubLaborLedger`) to the tab. Guides: `record-sub-labor-on-a-job` (Where the sheet stands rewritten), `share-a-sub-their-portal` (the move-the-stage sentence).
 
-## `.limit(N > 1000)` grep — found and left alone (with reason)
+## Next in the train
 
-`src/components/jobs/BankPaymentsModal.tsx:796` `mercury_transactions.select('kind, mercury_account_id, raw').limit(5000)` — builds distinct kind/account/debit-card choices; paging 13k rows of `raw` JSON on modal open is the wrong fix (needs a server-side distinct RPC). `src/components/quickfill/BankingSortingSnapshotSection.tsx:202` `mercury_transactions.select('*')…limit(5000)` — "most recent 5,000" incl. `raw`; 5× the payload for a Quickfill section — narrow the select before paging. `SettingsEmailCatalogSection.tsx:68` (`email_send_log`, 30 days, 5000), `jobFollowupStore.ts:79` (`job_followup_reviews`, 5000), `PeopleVehiclesTab.tsx` ×5 / `QuickfillVehicleOdometersSection.tsx:141` (`vehicle_*`, 2000, keyed by vehicle ids), `DashboardPinnedQuickRow.tsx:483` / `useLostBidNudge.ts:33` (`bids` lost, 1000), `JobsWorkOrdersTab.tsx:110/113` (`step_commitments`, `people_labor_jobs`, 1000), `SupplyHouseJobAccountsSection.tsx:41` (1000) — none on a table known to exceed 1,000; `.limit(1000)` equals the cap so nothing is silently lost today. Deliberate viewer caps kept: `BankingStripeInvoicesPanel.tsx` (`.limit(500)` with "Showing up to 500 rows" copy), J30-N1 / J28-N1 (`.limit(50)`, Tier-3). Already paged on main and confirmed untouched: Banking User Sort (#2580), `Duplicates.tsx` / `useMaterialsCatalog.ts` (v2.2755), Moneyfill queue (#2592), People Review / Overhead / Bridge sessions, `fetchStagesHeaderStats`' peers.
-
-`row_cap_hit{table}` counter (the map's telemetry ask): already on main as the `[row-cap]` tripwire (`src/lib/supabaseRowCapTripwire.ts`, v2.2756) — nothing added.
-
-## Files
-
-New: `src/lib/jobs/cardChargeAllocationFilter.ts` (+ test), `src/lib/jobs/loadCardChargeExclusions.ts`. Changed: the eleven files in the table above, `partsUnattributedMercuryDedupe.test.ts` / `fetchUnattributedMercuryForManyJobs.test.ts` (row builders gain `linkedToSupplyInvoice`), `docs/BANKING_TABS_ARCHITECTURE.md` (item 12), `docs/JOBS_TABS_ARCHITECTURE.md` (Parts handlers), `docs/JOBS_JOB_SUMMARY_TAB_ARCHITECTURE.md` (per-job row).
-
-## Verify
-
-1. Banking → Visuals as dev: the Sankey / totals cover all ~13k transactions (compare a year total against Banking → Ledger's paged list); the "most recent 15,000" note is absent while the table is under 15,000 rows; labeled transactions are no longer bucketed as unlabeled.
-2. Banking → Accounting: a rule with > 1,000 approved suggestions shows the true "used N×"; saving a person on such a rule offers to backfill every approved transaction.
-3. `/customers`: the header "Total open balance across N customers" equals the sum of the cards' open balances, and the Hub's OPEN BALANCE for any customer equals the card's — list and Hub can no longer disagree via the cap. Network tab: `jobs_ledger?customer_id=in.(…)` URLs carry ≤ 150 ids; `jobs_ledger_invoices` / `jobs_ledger_payments` requests carry `job_id=in.(…)` with `Range` headers.
-4. Jobs → Job Summary: pick a job whose card-charge allocations include a transaction in the **Internal Transfers** bucket (or label one in Banking → Accounting) — the drilldown rows omit it, the card total omits it, the printed breakdown omits it, and saving a split on that job leaves the card total unchanged-except-for-the-split.
-5. Bridge: day totals unchanged for a normal window (no row crossed the cap at today's volumes); `Range` headers present on every windowed read.
-
-## Rollback
-
-Revert the PR — client-only. Every retrofitted read returns the same rows as before at < 1,000 rows; only the exclusion change alters displayed numbers (and only on jobs carrying IT-bucketed / invoice-linked allocations — none today).
+PR 5: the small chips elsewhere (job window strip, Person Desk row, Needs You copy) read the rail's words.
diff --git a/src/components/banking/BankingMercuryAccountingTab.tsx b/src/components/banking/BankingMercuryAccountingTab.tsx
index e251392d..90d06a78 100644
--- a/src/components/banking/BankingMercuryAccountingTab.tsx
+++ b/src/components/banking/BankingMercuryAccountingTab.tsx
@@ -2,7 +2,7 @@ import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'rea
 import type { Database, Json } from '../../types/database'
 import { supabase } from '../../lib/supabase'
 import { withSupabaseRetry } from '../../utils/errorHandling'
-import { fetchAllRows } from '../../lib/supabasePaging'
+import { fetchAllRows, warnIfRowCapHit } from '../../lib/supabasePaging'
 import { useToastContext } from '../../contexts/ToastContext'
 import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
 import { mercuryBankDescriptionFromRaw } from '../../lib/mercuryBankDescriptionFromRaw'
@@ -608,24 +608,9 @@ export function BankingMercuryAccountingTab({
         withSupabaseRetry(async () => {
           return supabase.from('mercury_accounting_label_rules').select('*').order('sort_order').order('id')
         }, 'accounting load rules'),
-        // Paged (Phase 4 #3(c)): approved suggestions outgrow PostgREST's 1,000-row cap after
-        // a few rule passes, and an un-ranged read under-counted every rule's "used N×".
-        fetchAllRows<{ rule_id: string }>(
-          async (from, to) => ({
-            data: (await withSupabaseRetry(
-              async () =>
-                supabase
-                  .from('mercury_accounting_label_suggestions')
-                  .select('rule_id')
-                  .eq('status', 'approved')
-                  .order('id')
-                  .range(from, to),
-              'accounting rule usage',
-            )) as { rule_id: string }[] | null,
-            error: null,
-          }),
-          'accounting rule usage',
-        ),
+        withSupabaseRetry(async () => {
+          return supabase.from('mercury_accounting_label_suggestions').select('rule_id').eq('status', 'approved')
+        }, 'accounting rule usage'),
       ])
       const list = (rulesData as RuleRow[]) ?? []
       setRules(list)
@@ -766,26 +751,19 @@ export function BankingMercuryAccountingTab({
     async (ruleId: string, draft: AccountingRuleSaveDraft) => {
       if (draft.attributedPersonId == null && draft.attributedUserId == null) return
       try {
-        // Paged (Phase 4 #3(c)): a `.limit(100000)` is still cut to 1,000 rows by PostgREST,
-        // so a big rule's backfill offer would have silently skipped the rest.
-        const rows = await fetchAllRows<{ mercury_transaction_id: string }>(
-          async (from, to) => ({
-            data: (await withSupabaseRetry(
-              async () =>
-                supabase
-                  .from('mercury_accounting_label_suggestions')
-                  .select('mercury_transaction_id')
-                  .eq('rule_id', ruleId)
-                  .eq('status', 'approved')
-                  .order('id')
-                  .range(from, to),
-              'accounting backfill candidates',
-            )) as { mercury_transaction_id: string }[] | null,
-            error: null,
-          }),
+        const rows = await withSupabaseRetry(
+          async () =>
+            supabase
+              .from('mercury_accounting_label_suggestions')
+              .select('mercury_transaction_id')
+              .eq('rule_id', ruleId)
+              .eq('status', 'approved')
+              .limit(100000),
           'accounting backfill candidates',
         )
-        const ids = [...new Set(rows.map((r) => r.mercury_transaction_id))]
+        // Still un-ranged (a per-rule list; rarely near the cap) — surface the cap if it ever hits.
+        warnIfRowCapHit('accounting backfill candidates', (rows ?? []).length)
+        const ids = [...new Set(((rows ?? []) as { mercury_transaction_id: string }[]).map((r) => r.mercury_transaction_id))]
         if (ids.length === 0) return
         const value = draft.attributedPersonId ? `p:${draft.attributedPersonId}` : `u:${draft.attributedUserId}`
         setBackfillPrompt({
diff --git a/src/components/banking/BankingMercuryVisualsTab.tsx b/src/components/banking/BankingMercuryVisualsTab.tsx
index 009b05f2..42eb2a8d 100644
--- a/src/components/banking/BankingMercuryVisualsTab.tsx
+++ b/src/components/banking/BankingMercuryVisualsTab.tsx
@@ -5,7 +5,6 @@ import { bankingPersonKindTag, buildBankingAttributionOptions } from '../../lib/
 import { BankingMercuryTxDetailModal, type TxDetailChange } from './BankingMercuryTxDetailModal'
 import { supabase } from '../../lib/supabase'
 import { withSupabaseRetry } from '../../utils/errorHandling'
-import { fetchAllRows } from '../../lib/supabasePaging'
 import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
 import { fetchAllAttributions, fetchAllJobAllocations } from '../../lib/fetchMercuryRelationsByTxIds'
 import {
@@ -105,65 +104,28 @@ type VisualsData = {
   truncated: boolean
 }
 
-/** The `mercury_transactions` select shape below — `fetchVisualsData` derives `VisualsTxRow` from it. */
-type VisualsTxRaw = {
-  id: string
-  amount: number
-  kind: string
-  posted_at: string | null
-  mercury_account_id: string
-  duplicate_of_transaction_id: string | null
-  counterparty_name: string | null
-  external_memo: string | null
-  bank_description: string | null
-}
-
 async function fetchVisualsData(): Promise<VisualsData> {
   const [txRows, labelRows, assignmentRows, nicknameRows, debitNicknameRows, usersOptionRows, peopleOptionRows, allocRows, attrRows] =
     await Promise.all([
-      // Paged up to the REAL ceiling (Phase 4 #3(c)): a bare `.limit(15000)` is cut to
-      // PostgREST's 1,000-row max_rows with no error, so every Visuals total covered the
-      // newest ~1,000 of ~13k transactions and the "most recent 15,000" chip could never fire.
-      fetchAllRows<VisualsTxRaw>(
-        async (from, to) => ({
-          data: (await withSupabaseRetry(
-            async () =>
-              supabase
-                .from('mercury_transactions')
-                // bank_description pulls ONE string out of the raw JSON server-side —
-                // the raw column itself stays unfetched (it's large).
-                .select('id, amount, kind, posted_at, mercury_account_id, duplicate_of_transaction_id, counterparty_name, external_memo, bank_description:raw->>bankDescription')
-                .order('posted_at', { ascending: false })
-                .order('id', { ascending: false })
-                .range(from, to),
-            'visuals mercury_transactions',
-          )) as unknown as VisualsTxRaw[] | null,
-          error: null,
-        }),
+      withSupabaseRetry(
+        async () =>
+          supabase
+            .from('mercury_transactions')
+            // bank_description pulls ONE string out of the raw JSON server-side —
+            // the raw column itself stays unfetched (it's large).
+            .select('id, amount, kind, posted_at, mercury_account_id, duplicate_of_transaction_id, counterparty_name, external_memo, bank_description:raw->>bankDescription')
+            .order('posted_at', { ascending: false })
+            .limit(VISUALS_TX_LIMIT),
         'visuals mercury_transactions',
-        undefined,
-        { maxRows: VISUALS_TX_LIMIT },
       ),
       withSupabaseRetry(
         async () =>
           supabase.from('mercury_drag_sort_labels').select('id, name, schedule_c_line, default_key').order('sort_order'),
         'visuals labels',
       ),
-      // Same cap on the label assignments (the un-ranged `.limit(100000)` returned 1,000 of
-      // 2,000+ rows, so most labeled transactions rendered as unlabeled here).
-      fetchAllRows<{ mercury_transaction_id: string; label_id: string }>(
-        async (from, to) => ({
-          data: (await withSupabaseRetry(
-            async () =>
-              supabase
-                .from('mercury_transaction_drag_sort_assignments')
-                .select('mercury_transaction_id, label_id')
-                .order('mercury_transaction_id')
-                .range(from, to),
-            'visuals label assignments',
-          )) as { mercury_transaction_id: string; label_id: string }[] | null,
-          error: null,
-        }),
+      withSupabaseRetry(
+        async () =>
+          supabase.from('mercury_transaction_drag_sort_assignments').select('mercury_transaction_id, label_id').limit(100000),
         'visuals label assignments',
       ),
       withSupabaseRetry(
diff --git a/src/components/customers/BackfillHcpPaymentsModal.tsx b/src/components/customers/BackfillHcpPaymentsModal.tsx
index 2c45c281..9dfc6dda 100644
--- a/src/components/customers/BackfillHcpPaymentsModal.tsx
+++ b/src/components/customers/BackfillHcpPaymentsModal.tsx
@@ -2,7 +2,6 @@ import { useEffect, useMemo, useRef, useState } from 'react'
 import { supabase } from '../../lib/supabase'
 import { useToastContext } from '../../contexts/ToastContext'
 import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
-import { fetchAllRows } from '../../lib/supabasePaging'
 import { parseCsv } from '../../lib/parseCsv'
 import {
   backfillPaymentNote,
@@ -91,52 +90,27 @@ export default function BackfillHcpPaymentsModal({
     let cancelled = false
     ;(async () => {
       try {
-        // Paged whole-set reads (Phase 4 #3(c)): the backfill decides "paid job with no
-        // payment row" from these lists, so a silent 1,000-row cap would offer to mint
-        // payments that already exist.
         const [jobRows, paymentRows, hcpJobRows, tipLineRows] = await Promise.all([
-          fetchAllRows(
-            async (from, to) => ({
-              data: (await withSupabaseRetry(
-                async () =>
-                  supabase
-                    .from('jobs_ledger')
-                    .select('id, hcp_number, click_number, job_name, customer_name, status, revenue, created_at')
-                    .eq('status', 'paid')
-                    .gt('revenue', 0)
-                    .order('id')
-                    .range(from, to),
-                'payment backfill: paid jobs',
-              )) as BackfillJobInput[] | null,
-              error: null,
-            }),
+          withSupabaseRetry(
+            async () =>
+              supabase
+                .from('jobs_ledger')
+                .select('id, hcp_number, click_number, job_name, customer_name, status, revenue, created_at')
+                .eq('status', 'paid')
+                .gt('revenue', 0),
             'payment backfill: paid jobs',
           ),
-          fetchAllRows(
-            async (from, to) => ({
-              data: (await withSupabaseRetry(
-                async () => supabase.from('jobs_ledger_payments').select('job_id').order('id').range(from, to),
-                'payment backfill: payment rows',
-              )) as Array<{ job_id: string }> | null,
-              error: null,
-            }),
+          withSupabaseRetry(
+            async () => supabase.from('jobs_ledger_payments').select('job_id'),
             'payment backfill: payment rows',
           ),
-          fetchAllRows(
-            async (from, to) => ({
-              data: (await withSupabaseRetry(
-                async () =>
-                  supabase
-                    .from('jobs_ledger')
-                    .select('id, hcp_number, click_number, job_name, customer_name, status, revenue, payments_made, created_at')
-                    .not('hcp_number', 'is', null)
-                    .neq('hcp_number', '')
-                    .order('id')
-                    .range(from, to),
-                'tips sweep: HCP jobs',
-              )) as TipsSweepJobInput[] | null,
-              error: null,
-            }),
+          withSupabaseRetry(
+            async () =>
+              supabase
+                .from('jobs_ledger')
+                .select('id, hcp_number, click_number, job_name, customer_name, status, revenue, payments_made, created_at')
+                .not('hcp_number', 'is', null)
+                .neq('hcp_number', ''),
             'tips sweep: HCP jobs',
           ),
           withSupabaseRetry(
diff --git a/src/components/dispatchMode/DispatchModeCustomers.tsx b/src/components/dispatchMode/DispatchModeCustomers.tsx
index 72220d47..d95c4460 100644
--- a/src/components/dispatchMode/DispatchModeCustomers.tsx
+++ b/src/components/dispatchMode/DispatchModeCustomers.tsx
@@ -1,7 +1,6 @@
 import { useEffect, useMemo, useState, type CSSProperties } from 'react'
 import { supabase } from '../../lib/supabase'
 import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
-import { fetchAllRows } from '../../lib/supabasePaging'
 import { denverCalendarDayKey } from '../../utils/dateUtils'
 import CustomerSummaryModal from './CustomerSummaryModal'
 import {
@@ -83,16 +82,8 @@ export default function DispatchModeCustomers({
                 .order('name', { ascending: true }),
             'dispatch mode customers',
           ),
-          // Paged: a whole-table read that PostgREST silently caps at 1,000 rows (J34-N1;
-          // `jobs_ledger` is within sight of the cap) — every customer's job count would drift.
-          fetchAllRows(
-            async (from, to) => ({
-              data: (await withSupabaseRetry(
-                async () => supabase.from('jobs_ledger').select('customer_id, last_work_date').order('id').range(from, to),
-                'dispatch mode customer job counts',
-              )) as Array<{ customer_id: string | null; last_work_date: string | null }> | null,
-              error: null,
-            }),
+          withSupabaseRetry(
+            async () => supabase.from('jobs_ledger').select('customer_id, last_work_date'),
             'dispatch mode customer job counts',
           ),
           withSupabaseRetry(
diff --git a/src/components/jobs/JobsSubLaborTab.tsx b/src/components/jobs/JobsSubLaborTab.tsx
index b17ba7f7..1457566f 100644
--- a/src/components/jobs/JobsSubLaborTab.tsx
+++ b/src/components/jobs/JobsSubLaborTab.tsx
@@ -1,6 +1,17 @@
-import { useEffect, useMemo, useState } from 'react'
+import { useCallback, useEffect, useMemo, useState } from 'react'
 import { supabase } from '../../lib/supabase'
 import { formatCurrency } from '../../lib/jobs/jobFormatting'
+import { todayYmdInAppTz } from '../../utils/dateUtils'
+import { buildJobWorkOrderCoverage, type JobWorkOrderCoverage, type WorkOrderRowLike } from '../../lib/subWorkOrders/workOrderCoverage'
+import { buildSheetRail, sheetNextAction, type SheetNextAction, type SheetRail as SheetRailShape } from '../../lib/subWorkOrders/sheetRail'
+import { isRosterSubSheet, type NeedsWorkOrderRosterPerson } from '../../lib/subWorkOrders/sheetsNeedingWorkOrder'
+import { SHEET_RAIL_GAP } from '../../lib/subWorkOrders/sheetRailTone'
+import { normalizePersonNameKey } from '../../lib/personNameKey'
+import { useRosterSubKinds } from '../../hooks/useRosterSubKinds'
+import { emitWorkOrderChanged, WORK_ORDER_CHANGED_EVENT } from '../../hooks/useJobWorkOrderCoverage'
+import { SheetRail } from './SheetRail'
+import { WorkOrderAssemblerModal, type WorkOrderAssemblerInitial } from './WorkOrderAssemblerModal'
+import type { JobWithDetails } from '../../types/jobWithDetails'
 import {
   SUB_SHEET_STAGES,
   SUB_SHEET_STAGE_HINT,
@@ -20,6 +31,7 @@ import {
   subLaborJobBalance,
   subLaborJobMatchesSearch,
   type SubLaborOutstandingByPerson,
+  type SubLaborSheetAssignee,
 } from '../../lib/subLaborOutstanding'
 import type {
   LaborJob,
@@ -34,6 +46,11 @@ export type JobsSubLaborTabProps = {
   laborJobs: LaborJob[]
   laborJobsLoading: boolean
   laborJobNamesByHcp: Record<string, string>
+  /** Pipeline jobs — job-anchored work orders cover every sheet on their job; the assembler needs the list. */
+  jobs: JobWithDetails[]
+  authUserId: string | undefined
+  /** Junction assignees per sheet — with the roster, tells a crew pay sheet from a sub sheet. */
+  laborJobAssigneesByJobId: ReadonlyMap<string, readonly SubLaborSheetAssignee[]>
   subLaborDueTotal: number
   subLaborOutstandingByPerson: SubLaborOutstandingByPerson
   onNewLaborJob: () => void
@@ -55,6 +72,9 @@ export default function JobsSubLaborTab({
   laborJobs,
   laborJobsLoading,
   laborJobNamesByHcp,
+  jobs,
+  authUserId,
+  laborJobAssigneesByJobId,
   subLaborDueTotal,
   subLaborOutstandingByPerson,
   onNewLaborJob,
@@ -67,36 +87,26 @@ export default function JobsSubLaborTab({
 }: JobsSubLaborTabProps) {
   const [expandedSubLaborJobIds, setExpandedSubLaborJobIds] = useState<Set<string>>(new Set())
   const [stageMenuJobId, setStageMenuJobId] = useState<string | null>(null)
-  /** Sheet-anchored work orders (v2.2786): one chip per sheet under the stage cell. */
-  const [workOrdersBySheet, setWorkOrdersBySheet] = useState<Record<string, SheetWorkOrderChipInfo>>({})
-  const laborJobIdsKey = useMemo(() => laborJobs.map((j) => j.id).sort().join(','), [laborJobs])
+  /** Every live work order (one-row spine, PR 4): sheet-anchored ones cover their sheet, job-anchored ones every sheet on the job. */
+  const [commitments, setCommitments] = useState<WorkOrderRowLike[]>([])
+  const loadCommitments = useCallback(async () => {
+    const { data, error } = await supabase
+      .from('step_commitments')
+      .select('id, status, amount, display_name, job_id, labor_job_id, step_id, record_id, offered_at, offer_expires_at, signed_at, accepted_at, declined_at, decline_reason, created_at, person_id')
+      .neq('status', 'cancelled')
+      .order('created_at', { ascending: false })
+      .limit(1000)
+    if (error) return
+    setCommitments((data ?? []) as WorkOrderRowLike[])
+  }, [])
   useEffect(() => {
-    const ids = laborJobIdsKey ? laborJobIdsKey.split(',') : []
-    if (ids.length === 0) {
-      setWorkOrdersBySheet({})
-      return
-    }
-    let cancelled = false
-    void (async () => {
-      const next: Record<string, SheetWorkOrderChipInfo> = {}
-      for (let i = 0; i < ids.length; i += 300) {
-        const { data, error } = await supabase
-          .from('step_commitments')
-          .select('labor_job_id, status, signed_at, accepted_at, offered_at, amount')
-          .in('labor_job_id', ids.slice(i, i + 300))
-          .is('step_id', null)
-          .neq('status', 'cancelled')
-        if (error) return
-        for (const r of (data ?? []) as Array<{ labor_job_id: string | null; status: string; signed_at: string | null; accepted_at: string | null; offered_at: string | null; amount: number }>) {
-          if (r.labor_job_id) next[r.labor_job_id] = { status: r.status, signedAt: r.signed_at ?? r.accepted_at, offeredAt: r.offered_at, amount: Number(r.amount) }
-        }
-      }
-      if (!cancelled) setWorkOrdersBySheet(next)
-    })()
-    return () => {
-      cancelled = true
-    }
-  }, [laborJobIdsKey])
+    void loadCommitments()
+    const onChanged = () => void loadCommitments()
+    window.addEventListener(WORK_ORDER_CHANGED_EVENT, onChanged)
+    return () => window.removeEventListener(WORK_ORDER_CHANGED_EVENT, onChanged)
+  }, [loadCommitments])
+  const { roster } = useRosterSubKinds()
+  const [assembler, setAssembler] = useState<WorkOrderAssemblerInitial | null>(null)
   useEffect(() => {
     if (!stageMenuJobId) return
     const close = () => setStageMenuJobId(null)
@@ -105,7 +115,47 @@ export default function JobsSubLaborTab({
   }, [stageMenuJobId])
   const [showAllOutstanding, setShowAllOutstanding] = useState(false)
   const [showOnlyDue, setShowOnlyDue] = useState(true)
-  const [sortBy, setSortBy] = useState<'date' | 'contractor'>('contractor')
+  const [noAgreementOnly, setNoAgreementOnly] = useState(false)
+  const [subsOnly, setSubsOnly] = useState(false)
+  const [sortBy, setSortBy] = useState<'due' | 'date' | 'contractor'>('due')
+  const today = todayYmdInAppTz()
+
+  const spine = useMemo(() => {
+    const personById = new Map(roster.map((p) => [p.id, p]))
+    const personByNameKey = new Map<string, NeedsWorkOrderRosterPerson>()
+    for (const p of roster) {
+      const k = normalizePersonNameKey(p.name)
+      if (k && !personByNameKey.has(k)) personByNameKey.set(k, p)
+    }
+    const jobsByNumber = new Map(jobs.map((j) => [j.hcp_number.trim().toLowerCase(), j]))
+    const bySheet = new Map<string, WorkOrderRowLike[]>()
+    const byJob = new Map<string, WorkOrderRowLike[]>()
+    for (const r of commitments) {
+      if (r.labor_job_id) bySheet.set(r.labor_job_id, [...(bySheet.get(r.labor_job_id) ?? []), r])
+      else if (r.job_id) byJob.set(r.job_id, [...(byJob.get(r.job_id) ?? []), r])
+    }
+    const assigneeIds = new Map<string, string[]>()
+    for (const [id, list] of laborJobAssigneesByJobId) assigneeIds.set(id, list.map((a) => a.personId))
+    return { personById, personByNameKey, jobsByNumber, bySheet, byJob, assigneeIds }
+  }, [roster, jobs, commitments, laborJobAssigneesByJobId])
+
+  /** The rail, the office's next move, and whether the sheet is crew pay — one call per row. */
+  const spineFor = useCallback(
+    (job: LaborJob, bal: { totalCost: number; paid: number; backcharges: number; balance: number }): { coverage: JobWorkOrderCoverage; rail: SheetRailShape; next: SheetNextAction; crew: boolean; jobId: string | null; personId: string | null } => {
+      const pipelineJob = spine.jobsByNumber.get((job.job_number ?? '').trim().toLowerCase()) ?? null
+      const covering = [...(spine.bySheet.get(job.id) ?? []), ...(pipelineJob ? (spine.byJob.get(pipelineJob.id) ?? []) : [])]
+      const coverage = buildJobWorkOrderCoverage(covering, today)
+      const crew = roster.length > 0 && !isRosterSubSheet(job, spine.assigneeIds, spine.personById, spine.personByNameKey)
+      const unpriced = bal.totalCost === 0 && bal.paid === 0 && bal.backcharges === 0
+      const open = Math.max(0, bal.balance)
+      const rail = buildSheetRail({ coverage, sheetStage: normalizeSubSheetStage(job.stage), payableAfter: job.payable_after ?? null, agreed: bal.totalCost, open, unpriced, crewPay: crew })
+      const next = sheetNextAction(rail, coverage, { subName: job.assigned_to_name, agreed: bal.totalCost, open, unpriced, todayYmd: today })
+      const ids = spine.assigneeIds.get(job.id) ?? []
+      const personId = ids.length === 1 ? ids[0]! : null
+      return { coverage, rail, next, crew, jobId: pipelineJob?.id ?? null, personId }
+    },
+    [spine, roster.length, today],
+  )
 
   const outstandingRows = subLaborOutstandingByPerson.rows
   const OUTSTANDING_PREVIEW = 8
@@ -118,9 +168,17 @@ export default function JobsSubLaborTab({
   // computed balance so the row render reuses it rather than recomputing.
   const visibleLedgerJobs = laborJobs
     .filter((job) => subLaborJobMatchesSearch(job, subLaborSearch, laborJobNamesByHcp))
-    .map((job) => ({ job, ...subLaborJobBalance(job) }))
+    .map((job) => {
+      const bal = subLaborJobBalance(job)
+      return { job, ...bal, ...spineFor(job, bal) }
+    })
     .filter((row) => !showOnlyDue || row.balance > 0)
+    .filter((row) => !noAgreementOnly || (!row.crew && row.rail.gap))
+    .filter((row) => !subsOnly || !row.crew)
     .sort((a, b) => {
+      if (sortBy === 'due') {
+        return b.balance - a.balance || (a.job.assigned_to_name ?? '').localeCompare(b.job.assigned_to_name ?? '')
+      }
       if (sortBy === 'contractor') {
         return (a.job.assigned_to_name ?? '').localeCompare(b.job.assigned_to_name ?? '')
       }
@@ -223,7 +281,7 @@ export default function JobsSubLaborTab({
         <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
           <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Sort:</span>
           <div style={{ display: 'flex', border: '1px solid var(--border-strong)', borderRadius: 4, overflow: 'hidden' }}>
-            {(['date', 'contractor'] as const).map((key) => {
+            {(['due', 'date', 'contractor'] as const).map((key) => {
               const active = sortBy === key
               return (
                 <button
@@ -241,7 +299,7 @@ export default function JobsSubLaborTab({
                     fontWeight: active ? 600 : 400,
                   }}
                 >
-                  {key === 'date' ? 'Date' : 'Contractor'}
+                  {key === 'due' ? 'Due' : key === 'date' ? 'Date' : 'Contractor'}
                 </button>
               )
             })}
@@ -255,24 +313,34 @@ export default function JobsSubLaborTab({
           />
           Only show due
         </label>
+        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }} title="Sub sheets with work under way and nothing signed">
+          <input type="checkbox" checked={noAgreementOnly} onChange={(e) => setNoAgreementOnly(e.target.checked)} />
+          No agreement
+        </label>
+        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }} title="Hide crew pay sheets (a teammate on the sheet)">
+          <input type="checkbox" checked={subsOnly} onChange={(e) => setSubsOnly(e.target.checked)} />
+          Subs only
+        </label>
       </div>
       {laborJobsLoading ? (
         <p style={{ color: 'var(--text-muted)' }}>Loading sub sheet ledger…</p>
       ) : laborJobs.length === 0 ? (
         <p style={{ color: 'var(--text-muted)' }}>No jobs yet. Click New Sub Labor to add one.</p>
       ) : visibleLedgerJobs.length === 0 ? (
-        <p style={{ color: 'var(--text-muted)' }}>{showOnlyDue ? 'No payments due.' : 'No matching jobs.'}</p>
+        <p style={{ color: 'var(--text-muted)' }}>{noAgreementOnly ? 'Every sub sheet with money open has an agreement behind it.' : showOnlyDue ? 'No payments due.' : 'No matching jobs.'}</p>
       ) : (
         <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'auto', WebkitOverflowScrolling: 'touch', minWidth: 0 }}>
-          <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse', fontSize: '0.875rem' }}>
+          <table style={{ width: '100%', minWidth: 1100, borderCollapse: 'collapse', fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' }}>
             <thead style={{ background: 'var(--bg-subtle)' }}>
               <tr>
                 <th style={{ padding: '0.75rem', width: 32, borderBottom: '1px solid var(--border)' }} />
                 <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Contractor</th>
-                <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Total cost</th>
                 <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Job</th>
-                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Stage</th>
+                <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Agreed</th>
+                <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Paid</th>
                 <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Due</th>
+                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Where it stands</th>
+                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Next</th>
                 <th style={{ padding: '0.75rem', width: 80, borderBottom: '1px solid var(--border)' }} />
                 <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Date</th>
                 <th style={{ padding: '0.75rem', width: 80, borderBottom: '1px solid var(--border)' }} />
@@ -280,7 +348,7 @@ export default function JobsSubLaborTab({
             </thead>
             <tbody>
               {visibleLedgerJobs
-                .flatMap(({ job, totalCost, paid, backcharges, balance }) => {
+                .flatMap(({ job, totalCost, paid, backcharges, balance, rail, next, crew, coverage, jobId, personId }) => {
                 const jobRate = job.labor_rate ?? 0
                 const dateInputValue = job.job_date ?? (job.created_at ? job.created_at.slice(0, 10) : '')
                 const expanded = expandedSubLaborJobIds.has(job.id)
@@ -299,8 +367,14 @@ export default function JobsSubLaborTab({
                     onClick={toggle}
                   >
                     <td style={{ padding: '0.75rem', width: 32 }}>{expanded ? '▼' : '▶'}</td>
-                    <td style={{ padding: '0.75rem' }}>{job.assigned_to_name}</td>
-                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{totalCost > 0 ? <AmountSmallCents value={totalCost} /> : '—'}</td>
+                    <td style={{ padding: '0.75rem' }}>
+                      {job.assigned_to_name}
+                      {crew ? (
+                        <span title="A teammate is on this sheet — crew pay never needs a work order" style={{ display: 'inline-block', marginLeft: 6, padding: '1px 7px', borderRadius: 999, fontSize: '0.66rem', fontWeight: 700, background: 'var(--bg-violet-100)', color: 'var(--text-violet-700)', whiteSpace: 'nowrap' }}>
+                          Crew pay
+                        </span>
+                      ) : null}
+                    </td>
                     <td style={{ padding: '0.75rem', maxWidth: 220 }}>
                       <div style={{ lineHeight: 1.4 }}>
                         <div style={{ fontWeight: 500 }}>
@@ -347,9 +421,23 @@ export default function JobsSubLaborTab({
                         </div>
                       </div>
                     </td>
-                    <td style={{ padding: '0.75rem', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
+                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{totalCost > 0 ? <AmountSmallCents value={totalCost} /> : <span style={{ color: 'var(--text-faint)' }}>unpriced</span>}</td>
+                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{paid > 0 ? <AmountSmallCents value={paid} /> : '—'}</td>
+                    <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.8125rem' }}>
+                      {totalCost > 0 ? (
+                        balance > 0 ? (
+                          <span style={{ color: rail.gap ? SHEET_RAIL_GAP : 'var(--text-red-700)', fontWeight: rail.gap ? 700 : 500 }}><AmountSmallCents value={balance} /> due</span>
+                        ) : balance < 0 ? (
+                          <span style={{ color: 'var(--text-green-600)' }}>Over <AmountSmallCents value={-balance} /></span>
+                        ) : (
+                          <span style={{ color: 'var(--text-green-600)' }}>Paid</span>
+                        )
+                      ) : '—'}
+                    </td>
+                    <td style={{ padding: '0.75rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                       <SubSheetStageCell
                         job={job}
+                        rail={rail}
                         paid={totalCost > 0 && balance <= 0}
                         menuOpen={stageMenuJobId === job.id}
                         onToggleMenu={() => setStageMenuJobId((cur) => (cur === job.id ? null : job.id))}
@@ -358,18 +446,23 @@ export default function JobsSubLaborTab({
                           void onSetLaborJobStage(job.id, stage)
                         }}
                       />
-                      {workOrdersBySheet[job.id] ? <SheetWorkOrderChip info={workOrdersBySheet[job.id]!} /> : null}
                     </td>
-                    <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.8125rem' }}>
-                      {totalCost > 0 ? (
-                        balance > 0 ? (
-                          <span style={{ color: 'var(--text-red-700)' }}><AmountSmallCents value={balance} /> due</span>
-                        ) : balance < 0 ? (
-                          <span style={{ color: 'var(--text-green-600)' }}>Over <AmountSmallCents value={-balance} /></span>
-                        ) : (
-                          <span style={{ color: 'var(--text-green-600)' }}>Paid</span>
-                        )
-                      ) : '—'}
+                    <td style={{ padding: '0.75rem', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
+                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: next.button === 'reoffer' ? 'var(--text-amber-800)' : 'inherit' }}>{next.label}</div>
+                      {next.hint ? <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{next.hint}</div> : null}
+                      {next.button && next.button !== 'nudge' && next.buttonLabel ? (
+                        <button
+                          type="button"
+                          onClick={() =>
+                            next.button === 'draft'
+                              ? setAssembler({ jobId, laborJobId: job.id, personId, amount: totalCost > 0 ? totalCost : null })
+                              : setAssembler({ commitmentId: coverage.kind === 'none' ? null : coverage.id })
+                          }
+                          style={{ marginTop: 4, padding: '0.2rem 0.55rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}
+                        >
+                          {next.buttonLabel}
+                        </button>
+                      ) : null}
                     </td>
                     <td style={{ padding: '0.75rem', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'stretch' }}>
@@ -411,7 +504,7 @@ export default function JobsSubLaborTab({
                   ...(expanded
                     ? [
                         <tr key={`${job.id}-expand`}>
-                          <td colSpan={9} style={{ padding: 0, borderBottom: '1px solid var(--border)', background: 'var(--surface)', verticalAlign: 'top' }}>
+                          <td colSpan={11} style={{ padding: 0, borderBottom: '1px solid var(--border)', background: 'var(--surface)', verticalAlign: 'top' }}>
                             <div onClick={(e) => e.stopPropagation()} style={{ padding: '1rem' }}>
                               <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                 Total cost: <AmountSmallCents value={totalCost} /> · Paid: <AmountSmallCents value={paid} /> · Backcharges: <AmountSmallCents value={backcharges} />
@@ -506,6 +599,10 @@ export default function JobsSubLaborTab({
           </table>
         </div>
       )}
+      <p style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
+        The rail is the one the sub sees on their portal — Work · Walk-through · Customer pays · Paid — with the office's Drafted · Sent · Signed in front of it. A dashed red run means work is happening with nothing signed. Click the current dot to move the stage.
+      </p>
+      <WorkOrderAssemblerModal open={assembler != null} onClose={() => setAssembler(null)} jobs={jobs} initial={assembler} authUserId={authUserId} onChanged={() => { void loadCommitments(); emitWorkOrderChanged() }} />
     </div>
   )
 }
@@ -524,12 +621,14 @@ const STAGE_CHIP_TONES: Record<SubSheetStageTone | 'green', { bg: string; fg: st
  */
 function SubSheetStageCell({
   job,
+  rail,
   paid,
   menuOpen,
   onToggleMenu,
   onPick,
 }: {
   job: LaborJob
+  rail: SheetRailShape
   paid: boolean
   menuOpen: boolean
   onToggleMenu: () => void
@@ -548,33 +647,20 @@ function SubSheetStageCell({
     .filter(Boolean)
     .join(' · ')
   if (paid) {
-    return (
-      <span title={title} style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, borderRadius: 999, padding: '3px 10px', background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}`, whiteSpace: 'nowrap' }}>
-        Paid
-      </span>
-    )
+    return <SheetRail rail={rail} title={title} />
   }
   return (
     <div style={{ position: 'relative', display: 'inline-block' }}>
-      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999, padding: '2px 3px 2px 10px', background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}`, whiteSpace: 'nowrap', fontSize: '0.75rem', fontWeight: 700 }}>
-        <button
-          type="button"
-          title={title}
-          aria-haspopup="menu"
-          aria-expanded={menuOpen}
-          onClick={onToggleMenu}
-          style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}
-        >
-          {SUB_SHEET_STAGE_LABEL[stage]}
-          {job.stage_source === 'portal' ? <span style={{ fontWeight: 500, opacity: 0.85 }}> · sub</span> : null}
-        </button>
+      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
+        <SheetRail rail={rail} title={`${title} · click the current dot to move the stage`} onCurrentClick={onToggleMenu} />
+        {job.stage_source === 'portal' ? <span style={{ fontSize: '0.68rem', fontWeight: 600, color: tone.fg }} title="The sub moved it from their portal">· sub</span> : null}
         {next ? (
           <button
             type="button"
             title={`Move to ${SUB_SHEET_STAGE_LABEL[next]}`}
             aria-label={`Move to ${SUB_SHEET_STAGE_LABEL[next]}`}
             onClick={() => onPick(next)}
-            style={{ background: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: 999, padding: '1px 7px', fontSize: '0.72rem', fontWeight: 700, color: 'inherit', cursor: 'pointer' }}
+            style={{ background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 999, padding: '1px 7px', fontSize: '0.72rem', fontWeight: 700, color: tone.fg, cursor: 'pointer' }}
           >
             →
           </button>
@@ -613,33 +699,3 @@ function SubSheetStageCell({
     </div>
   )
 }
-
-type SheetWorkOrderChipInfo = { status: string; signedAt: string | null; offeredAt: string | null; amount: number }
-
-/** "✍ Signed Sep 4" / "Awaiting signature" / "Draft work order" / "Declined" under the stage chip (v2.2786). */
-function SheetWorkOrderChip({ info }: { info: SheetWorkOrderChipInfo }) {
-  const signed = info.status === 'accepted' || info.status === 'approved' || info.status === 'settled'
-  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')
-  const label = signed
-    ? `✍ Signed${info.signedAt ? ` ${fmt(info.signedAt)}` : ''}`
-    : info.status === 'offered'
-      ? 'Awaiting signature'
-      : info.status === 'declined'
-        ? 'Declined'
-        : 'Draft work order'
-  const tone = signed
-    ? { background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' }
-    : info.status === 'offered'
-      ? { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }
-      : info.status === 'declined'
-        ? { background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' }
-        : { background: 'var(--bg-muted)', color: 'var(--text-muted)' }
-  return (
-    <span
-      title={`Work order · $${info.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}${info.offeredAt ? ` · sent ${fmt(info.offeredAt)}` : ''}`}
-      style={{ ...tone, display: 'inline-block', marginTop: 4, fontSize: '0.66rem', fontWeight: 650, borderRadius: 999, padding: '0.05rem 0.5rem', whiteSpace: 'nowrap' }}
-    >
-      {label}
-    </span>
-  )
-}
diff --git a/src/content/help/record-sub-labor-on-a-job.md b/src/content/help/record-sub-labor-on-a-job.md
index 31b9fd33..9cd75505 100644
--- a/src/content/help/record-sub-labor-on-a-job.md
+++ b/src/content/help/record-sub-labor-on-a-job.md
@@ -30,7 +30,13 @@ New entries no longer ask for miles — the drive-cost math simply isn't applied
 
 ## Where the sheet stands
 
-The **Stage** column on the ledger says what you're waiting on for each sheet: {{chip:yellow|Waiting on work}} → {{chip:purple|Waiting on walk-through}} → {{chip:blue|Waiting on customer}}, and {{chip:green|Paid}} once the balance is $0. Tap **→** on the chip to advance one stage, or tap the chip to pick any of the three (stepping back is fine). The sub sees the same steps on their portal and can move a sheet to *Waiting on walk-through* themselves by telling you the work is done — the chip then reads *· sub* with their note behind ✎, and the job's Activity feed keeps the history. Details in [share a sub their portal](/help/share-a-sub-their-portal).
+Every ledger row carries the same spine as **Jobs → Work Orders**: **Agreed · Paid · Due**, then **Where it stands** — the rail the sub sees on their portal. Four big dots are the sub's steps (**Work · Walk-through · Customer pays · Paid**); the three small dots in front (**Drafted · Sent · Signed**) are the office's agreement steps. The filled terracotta dot is where the sheet is today; a **dashed red run** through the small dots means work is happening with nothing signed, and the Due figure turns the same red.
+
+**Next** names the office's move — *Get it in writing* ({{button:blue|Draft a work order…}} opens the assembler on the sheet), *Price it and send*, *Waiting on ‹sub›*, *Wait for "done"*, *Schedule the walk-through*, *Bill and collect*, *Pay ‹sub›*, *Nothing — done*.
+
+**Moving the stage**: click the rail's current dot to pick any of the three stages (stepping back is fine), or tap **→** beside the rail to advance one. The sub can move a sheet to *Walk-through* themselves by telling you the work is done — the rail then reads *· sub* with their note behind ✎, and the job's Activity feed keeps the history. Details in [share a sub their portal](/help/share-a-sub-their-portal). Paid sets itself once the balance is $0.
+
+**Crew pay** sheets — a teammate on the sheet — wear a {{chip:purple|Crew pay}} label and draw only the four sub dots: they never need a work order. **Subs only** hides them; **No agreement** shows just the sub sheets with money open and nothing signed. Rows sort by money due; switch to Date or Contractor with the sort buttons.
 
 ## Sending the sub a work order
 
diff --git a/src/content/help/share-a-sub-their-portal.md b/src/content/help/share-a-sub-their-portal.md
index 25c9723f..c1ecd2cd 100644
--- a/src/content/help/share-a-sub-their-portal.md
+++ b/src/content/help/share-a-sub-their-portal.md
@@ -48,7 +48,7 @@ Every sub sheet sits at one of three stages, and the portal draws them as a four
 | {{chip:blue|Waiting on customer}} + a *payable after* date | The fourth dot lights with a green {{chip:green|Queued for Friday}} chip: "Queued for the pay run — the date is right below." |
 | {{chip:green|Paid}} | The card leaves *Your jobs* — Paid sets itself when the balance hits $0. |
 
-Move a sheet from the **Stage** column on **Jobs → Sub Labor**: the **→** on the chip advances one stage, and clicking the chip opens all three so you can jump or step back. The same control sits in the sheet editor's *Shown on the sub's portal* box.
+Move a sheet from the **Where it stands** rail on **Jobs → Sub Labor**: the **→** beside the rail advances one stage, and clicking the rail's current dot opens all three so you can jump or step back. The same control sits in the sheet editor's *Shown on the sub's portal* box.
 
 :::example The sub tells you first
 While a sheet is *Waiting on work*, the sub sees {{button:green|✓ My work here is done}} on that job. Pressing it (with an optional note — "Cleanout is behind the water heater — gate code 4471") moves the sheet to *Waiting on walk-through* by itself. You'll see **Ready to walk — Danny Vasquez · 1004 162 Forest Drive** in the dispatch inbox, and the chip on Sub Labor reads *Waiting on walk-through · sub* with their note behind ✎.
diff --git a/src/content/releaseNotes/v2.2870.ts b/src/content/releaseNotes/v2.2870.ts
index 58e5f6e7..457e1b66 100644
--- a/src/content/releaseNotes/v2.2870.ts
+++ b/src/content/releaseNotes/v2.2870.ts
@@ -3,12 +3,12 @@ import type { ReleaseNote } from '../../lib/releaseNotes'
 const note: ReleaseNote = {
   version: 'v2.2871',
   date: '2026-09-05',
-  title: 'Totals count every row: Banking Visuals & Accounting, customer money chips, Bridge, job card charges',
-  kind: 'fix',
+  title: 'Sub Labor: the same row as Work Orders, with the rail on it',
+  kind: 'feature',
   highlights: [
-    'Several whole-company reads used to stop quietly at 1,000 rows and present the partial sum as the total. They now page through everything: Banking → Visuals (transactions and their labels), Banking → Accounting ("used N×" rule counts and the retroactive-attribution offer), the PAID / BILLED / UNBILLED chips and "Total open balance" on Customers, Dispatch Mode\'s customer job counts, the HCP payment backfill, the Jobs stages header, and every Bridge day total.',
-    'Job Summary card charges follow one rule everywhere: the per-job detail rows, the print/PDF breakdown, and the total shown right after saving a split now exclude Internal Transfers and mark invoice-linked charges exactly like the job list does — the detail can no longer sum to a different number than the card.',
-    'Banking → Visuals\' "Showing the most recent 15,000 transactions" note now appears only when that ceiling is really reached.',
+    'Jobs → Sub Labor now carries the Work Orders spine: Agreed · Paid · Due, then Where it stands — the rail the sub sees on their portal (Work · Walk-through · Customer pays · Paid) with the office\'s Drafted · Sent · Signed in front of it. A dashed red run means work is happening with nothing signed, and the Due figure turns the same red.',
+    'Next names the office\'s move on every row — Get it in writing (with Draft a work order… right there), Price it and send, Waiting on the sub, Wait for "done", Schedule the walk-through, Bill and collect, Pay the sub. The stage menu now lives on the rail\'s current dot; → beside it still advances one step.',
+    'Crew pay sheets (a teammate on the sheet) wear a Crew pay label and draw only the four sub dots — they never need a work order. Two new filters: No agreement and Subs only. Rows sort by money due by default; Date and Contractor are still there.',
   ],
 }
 
diff --git a/src/hooks/useJobsMercuryAllocations.ts b/src/hooks/useJobsMercuryAllocations.ts
index 08107dc7..41ba5c54 100644
--- a/src/hooks/useJobsMercuryAllocations.ts
+++ b/src/hooks/useJobsMercuryAllocations.ts
@@ -14,11 +14,27 @@ import { isSelectableOption } from '../components/SearchableSelect'
 import { mercuryQuickAssignUserAttribution } from '../lib/mercuryQuickAssignUserAttribution'
 import type { BankingAttributionUser } from '../lib/mercuryCardNicknameUserMatch'
 import type { JobWithDetails } from '../types/jobWithDetails'
-import { fetchAllRows, fetchAllRowsChunkedIn } from '../lib/supabasePaging'
+import { fetchAllRowsChunkedIn } from '../lib/supabasePaging'
+import { fetchAccountingBucketByTxId } from '../lib/overheadPartsBucketLoader'
 import { costLineTags, sumTagChargesByJob } from '../lib/mercuryTagSplit'
 import { fetchLabelIdByTxId, useCategoryTags } from '../lib/banking/categoryTagsData'
-import { summarizeCardChargeAllocations, sumCardChargeAllocationsForJob } from '../lib/jobs/cardChargeAllocationFilter'
-import { loadCardChargeExclusions } from '../lib/jobs/loadCardChargeExclusions'
+
+/** Mercury tx ids (among `txIds`) that carry a supply-house invoice link — the same purchase seen twice. */
+async function fetchMercuryTxIdsLinkedToSupplyInvoices(txIds: readonly string[]): Promise<Set<string>> {
+  if (txIds.length === 0) return new Set()
+  const rows = (await fetchAllRowsChunkedIn(
+    [...txIds],
+    (chunk, from, to) =>
+      supabase
+        .from('mercury_transaction_supply_house_invoice_links')
+        .select('mercury_transaction_id')
+        .in('mercury_transaction_id', chunk)
+        .order('id')
+        .range(from, to),
+    'mercury invoice links by tx',
+  )) as Array<{ mercury_transaction_id: string }>
+  return new Set(rows.map((r) => r.mercury_transaction_id))
+}
 
 /**
  * Parts/Job Summary shared Mercury-allocation engine (Jobs.tsx decomposition
@@ -117,12 +133,12 @@ export function useJobsMercuryAllocations({
           'mercury card charges by job',
         )) as Array<{ job_id: string; amount: number; mercury_transaction_id: string }>
         const txIds = [...new Set(rows.map((r) => r.mercury_transaction_id))]
-        // Which rows count (Internal Transfers out) and which are invoice-linked is
-        // ONE rule shared with the per-job detail and the post-save refresh —
-        // `lib/jobs/cardChargeAllocationFilter` (v2.2692 exclusions; unified in
-        // Phase 4 #3(c)). Lookups degrade to "everything counts" when RLS hides them.
-        const [exclusions, categoryRows, labelIdByTxId] = await Promise.all([
-          loadCardChargeExclusions(txIds),
+        // Internal Transfers are money moving between the org's own accounts,
+        // not a cost — the same exclusion People → Overhead applies (v2.2692).
+        // Bucket/link lookups degrade to "everything counts" when RLS hides them.
+        const [bucketByTxId, linkedTxIds, categoryRows, labelIdByTxId] = await Promise.all([
+          fetchAccountingBucketByTxId(txIds).catch(() => new Map<string, string>()),
+          fetchMercuryTxIdsLinkedToSupplyInvoices(txIds).catch(() => new Set<string>()),
           // Bank category — the fallback for transactions nobody has labelled yet (v2.2708 → v2.2725).
           fetchAllRowsChunkedIn(
             txIds,
@@ -133,11 +149,21 @@ export function useJobsMercuryAllocations({
           fetchLabelIdByTxId(txIds).catch(() => new Map<string, string>()),
         ])
         if (cancelled) return
-        const { counted, chargesByJobId, invoiceLinkedByJobId } = summarizeCardChargeAllocations(rows, exclusions)
+        const m = new Map<string, number>()
+        const linked = new Map<string, number>()
+        const counted: typeof rows = []
+        for (const row of rows) {
+          if (bucketByTxId.get(row.mercury_transaction_id) === 'internal_transfer') continue
+          counted.push(row)
+          const jid = row.job_id
+          const usd = Math.abs(Number(row.amount))
+          m.set(jid, (m.get(jid) ?? 0) + usd)
+          if (linkedTxIds.has(row.mercury_transaction_id)) linked.set(jid, (linked.get(jid) ?? 0) + usd)
+        }
         const categoryByTxId = new Map<string, unknown>()
         for (const r of categoryRows as Array<{ id: string; mercury_category: unknown }>) categoryByTxId.set(r.id, r.mercury_category)
-        setMercuryCardChargesByJobId(chargesByJobId)
-        setMercuryInvoiceLinkedChargesByJobId(invoiceLinkedByJobId)
+        setMercuryCardChargesByJobId(m)
+        setMercuryInvoiceLinkedChargesByJobId(linked)
         setMercuryTagChargesByJobId(sumTagChargesByJob(counted, labelIdByTxId, categoryByTxId, tagLookups))
       } catch {
         if (cancelled) return
@@ -191,41 +217,20 @@ export function useJobsMercuryAllocations({
   )
 
   const updateMercuryCardTotalForOneJob = useCallback((jobId: string) => {
-    // Same paging + the same exclusion rule as the bulk map above, so a saved
-    // split never shows a gross-including-Internal-Transfers total until the
-    // next full load (#3b asymmetry #2).
-    void (async () => {
-      const label = 'mercury card charges for one job (parts refresh)'
-      const rows = (await fetchAllRows(
-        async (from, to) => ({
-          data: (await withSupabaseRetry(
-            async () =>
-              supabase
-                .from('mercury_transaction_job_allocations')
-                .select('amount, mercury_transaction_id')
-                .eq('job_id', jobId)
-                .order('id')
-                .range(from, to),
-            label,
-          )) as Array<{ amount: number; mercury_transaction_id: string }> | null,
-          error: null,
-        }),
-        label,
-      )) as Array<{ amount: number; mercury_transaction_id: string }>
-      const exclusions = await loadCardChargeExclusions([...new Set(rows.map((r) => r.mercury_transaction_id))])
-      const { charges, invoiceLinked } = sumCardChargeAllocationsForJob(rows, exclusions)
-      setMercuryCardChargesByJobId((m) => {
-        const n = new Map(m)
-        n.set(jobId, charges)
-        return n
-      })
-      setMercuryInvoiceLinkedChargesByJobId((m) => {
-        const n = new Map(m)
-        if (invoiceLinked > 0) n.set(jobId, invoiceLinked)
-        else n.delete(jobId)
-        return n
+    void withSupabaseRetry(
+      async () =>
+        supabase.from('mercury_transaction_job_allocations').select('amount').eq('job_id', jobId),
+      'mercury card charges for one job (parts refresh)',
+    )
+      .then((rows) => {
+        const sum = (rows ?? []).reduce((a, r) => a + Math.abs(Number(r.amount)), 0)
+        setMercuryCardChargesByJobId((m) => {
+          const n = new Map(m)
+          n.set(jobId, sum)
+          return n
+        })
       })
-    })().catch(() => {})
+      .catch(() => {})
   }, [])
 
   const dismissPartsUnattributedList = useCallback(() => {
diff --git a/src/hooks/useRosterSubKinds.ts b/src/hooks/useRosterSubKinds.ts
new file mode 100644
index 00000000..02d0be99
--- /dev/null
+++ b/src/hooks/useRosterSubKinds.ts
@@ -0,0 +1,40 @@
+/**
+ * The roster with each person's login role — what tells a crew pay sheet from a
+ * sub sheet (Work Orders one-row spine). Teammates carry a `kind = 'sub'` row
+ * too (the roster row behind a login), so `isRosterSub` needs the account
+ * role: kind `sub` AND (no login OR a `subcontractor` login). Both the Work
+ * Orders board and the Sub Labor ledger read this one list.
+ */
+import { useEffect, useState } from 'react'
+import { supabase } from '../lib/supabase'
+import type { NeedsWorkOrderRosterPerson } from '../lib/subWorkOrders/sheetsNeedingWorkOrder'
+
+export function useRosterSubKinds(enabled = true): { roster: NeedsWorkOrderRosterPerson[]; loaded: boolean } {
+  const [roster, setRoster] = useState<NeedsWorkOrderRosterPerson[]>([])
+  const [loaded, setLoaded] = useState(false)
+  useEffect(() => {
+    if (!enabled) return
+    let cancelled = false
+    void (async () => {
+      const [{ data: people }, { data: users }] = await Promise.all([
+        supabase.from('people').select('id, name, kind, account_user_id').order('id').limit(1000),
+        supabase.from('users').select('id, role').order('id').limit(1000),
+      ])
+      if (cancelled) return
+      const roleByUserId = new Map(((users ?? []) as Array<{ id: string; role: string | null }>).map((u) => [u.id, u.role]))
+      setRoster(
+        ((people ?? []) as Array<{ id: string; name: string; kind: string; account_user_id: string | null }>).map((p) => ({
+          id: p.id,
+          name: p.name,
+          kind: p.kind,
+          accountRole: p.account_user_id ? (roleByUserId.get(p.account_user_id) ?? null) : null,
+        })),
+      )
+      setLoaded(true)
+    })()
+    return () => {
+      cancelled = true
+    }
+  }, [enabled])
+  return { roster, loaded }
+}
diff --git a/src/lib/bridge/loadBridgeData.ts b/src/lib/bridge/loadBridgeData.ts
index 8fca47f0..5db08e78 100644
--- a/src/lib/bridge/loadBridgeData.ts
+++ b/src/lib/bridge/loadBridgeData.ts
@@ -1,7 +1,7 @@
 import { supabase } from '../supabase'
 import { withSupabaseRetry } from '../../utils/errorHandling'
 import { calendarYmdInAppTzFromIso, denverCalendarDayKey, ymdAddDays } from '../../utils/dateUtils'
-import { fetchAllRows, fetchAllRowsChunkedIn } from '../supabasePaging'
+import { fetchAllRows } from '../supabasePaging'
 import { loadOverheadPoolSnapshot, loadOverheadPoolSnapshotInputs } from '../overheadPoolSnapshot'
 import { buildEarnedRevenue, type EarnedRevenueJob, type EarnedRevenueResult } from './earnedRevenue'
 import { upcomingFridays } from './cashForecast'
@@ -199,115 +199,52 @@ export async function loadBridgeData(): Promise<BridgeData> {
     if (d >= windowStart && d <= todayYmd) addTo(bankFlowByDay, d, Number(t.amount ?? 0))
   }
   const txDay = new Map(txRows.filter((t) => Number(t.amount ?? 0) < 0).map((t) => [t.id, calendarYmdInAppTzFromIso(t.posted_at)]))
-  // Every read below is paged (Phase 4 #3(c)): a 200-id `.in()` chunk can still return
-  // >1,000 child rows, and the windowed whole-set reads cross PostgREST's silent cap as
-  // the window's history grows — either way a Bridge day total drops rows with no error.
-  type TxAllocRow = { mercury_transaction_id: string; job_id: string | null; amount: number | null }
-  const txAllocRows = await fetchAllRowsChunkedIn(
-    [...txDay.keys()],
-    async (chunk, from, to) => ({
-      data: (await withSupabaseRetry(
-        async () =>
-          supabase
-            .from('mercury_transaction_job_allocations')
-            .select('mercury_transaction_id, job_id, amount')
-            .in('mercury_transaction_id', chunk)
-            .order('id')
-            .range(from, to),
-        'bridge tx allocations',
-      )) as TxAllocRow[] | null,
-      error: null,
-    }),
-    'bridge tx allocations',
-    { chunkSize: 200 },
-  )
-  for (const a of txAllocRows) {
-    if (!a.job_id || a.job_id === officeJobLedgerId) continue
-    const d = txDay.get(a.mercury_transaction_id)
-    if (d && d >= windowStart && d <= todayYmd) addTo(materialsByDay, d, Math.abs(Number(a.amount ?? 0)))
+  for (const ids of chunks([...txDay.keys()], 200)) {
+    const rows = (await withSupabaseRetry(
+      async () => supabase.from('mercury_transaction_job_allocations').select('mercury_transaction_id, job_id, amount').in('mercury_transaction_id', ids),
+      'bridge tx allocations',
+    )) as Array<{ mercury_transaction_id: string; job_id: string | null; amount: number | null }> | null
+    for (const a of rows ?? []) {
+      if (!a.job_id || a.job_id === officeJobLedgerId) continue
+      const d = txDay.get(a.mercury_transaction_id)
+      if (d && d >= windowStart && d <= todayYmd) addTo(materialsByDay, d, Math.abs(Number(a.amount ?? 0)))
+    }
   }
   // Materials: supply-house invoices allocated to non-office jobs, by invoice date.
-  type SupplyInvRow = { id: string; amount: number | null; invoice_date: string; paid_at: string | null }
-  const invRows = await fetchAllRows(
-    async (from, to) => ({
-      data: (await withSupabaseRetry(
-        async () =>
-          supabase
-            .from('supply_house_invoices')
-            .select('id, amount, invoice_date, paid_at')
-            .gte('invoice_date', windowStart)
-            .lte('invoice_date', todayYmd)
-            .order('id')
-            .range(from, to),
-        'bridge supply invoices',
-      )) as SupplyInvRow[] | null,
-      error: null,
-    }),
+  const invRows = (await withSupabaseRetry(
+    async () => supabase.from('supply_house_invoices').select('id, amount, invoice_date, paid_at').gte('invoice_date', windowStart).lte('invoice_date', todayYmd),
     'bridge supply invoices',
-  )
-  const invById = new Map(invRows.map((r) => [r.id, r]))
-  type SupplyAllocRow = { invoice_id: string; job_id: string | null; pct: number | null }
-  const supplyAllocRows = await fetchAllRowsChunkedIn(
-    [...invById.keys()],
-    async (chunk, from, to) => ({
-      data: (await withSupabaseRetry(
-        async () =>
-          supabase
-            .from('supply_house_invoice_job_allocations')
-            .select('invoice_id, job_id, pct')
-            .in('invoice_id', chunk)
-            .order('id')
-            .range(from, to),
-        'bridge supply allocations',
-      )) as SupplyAllocRow[] | null,
-      error: null,
-    }),
-    'bridge supply allocations',
-    { chunkSize: 200 },
-  )
-  for (const a of supplyAllocRows) {
-    const inv = invById.get(a.invoice_id)
-    if (!inv || !a.job_id || a.job_id === officeJobLedgerId) continue
-    addTo(materialsByDay, inv.invoice_date, Number(inv.amount ?? 0) * (Number(a.pct ?? 0) / 100))
+  )) as Array<{ id: string; amount: number | null; invoice_date: string; paid_at: string | null }> | null
+  const invById = new Map((invRows ?? []).map((r) => [r.id, r]))
+  for (const ids of chunks([...invById.keys()], 200)) {
+    const rows = (await withSupabaseRetry(
+      async () => supabase.from('supply_house_invoice_job_allocations').select('invoice_id, job_id, pct').in('invoice_id', ids),
+      'bridge supply allocations',
+    )) as Array<{ invoice_id: string; job_id: string | null; pct: number | null }> | null
+    for (const a of rows ?? []) {
+      const inv = invById.get(a.invoice_id)
+      if (!inv || !a.job_id || a.job_id === officeJobLedgerId) continue
+      addTo(materialsByDay, inv.invoice_date, Number(inv.amount ?? 0) * (Number(a.pct ?? 0) / 100))
+    }
   }
   // Sub labor sheets by job date.
   const subByDay = new Map<string, number>()
-  const sheets = await fetchAllRows(
-    async (from, to) => ({
-      data: (await withSupabaseRetry(
-        async () =>
-          supabase.from('people_labor_jobs').select('id, job_date').gte('job_date', windowStart).lte('job_date', todayYmd).order('id').range(from, to),
-        'bridge sub sheets',
-      )) as Array<{ id: string; job_date: string }> | null,
-      error: null,
-    }),
+  const sheets = (await withSupabaseRetry(
+    async () => supabase.from('people_labor_jobs').select('id, job_date').gte('job_date', windowStart).lte('job_date', todayYmd),
     'bridge sub sheets',
-  )
-  const sheetDay = new Map(sheets.map((s) => [s.id, s.job_date]))
-  type SubItemRow = { job_id: string; count: number | null; hrs_per_unit: number | null; labor_rate: number | null; direct_labor_amount: number | null }
-  const subItems = await fetchAllRowsChunkedIn(
-    [...sheetDay.keys()],
-    async (chunk, from, to) => ({
-      data: (await withSupabaseRetry(
-        async () =>
-          supabase
-            .from('people_labor_job_items')
-            .select('job_id, count, hrs_per_unit, labor_rate, direct_labor_amount')
-            .in('job_id', chunk)
-            .order('id')
-            .range(from, to),
-        'bridge sub items',
-      )) as SubItemRow[] | null,
-      error: null,
-    }),
-    'bridge sub items',
-    { chunkSize: 200 },
-  )
-  for (const it of subItems) {
-    const d = sheetDay.get(it.job_id)
-    if (!d) continue
-    const v = it.direct_labor_amount != null ? Number(it.direct_labor_amount) : Number(it.count ?? 0) * Number(it.hrs_per_unit ?? 0) * Number(it.labor_rate ?? 0)
-    addTo(subByDay, d, v)
+  )) as Array<{ id: string; job_date: string }> | null
+  const sheetDay = new Map((sheets ?? []).map((s) => [s.id, s.job_date]))
+  for (const ids of chunks([...sheetDay.keys()], 200)) {
+    const items = (await withSupabaseRetry(
+      async () => supabase.from('people_labor_job_items').select('job_id, count, hrs_per_unit, labor_rate, direct_labor_amount').in('job_id', ids),
+      'bridge sub items',
+    )) as Array<{ job_id: string; count: number | null; hrs_per_unit: number | null; labor_rate: number | null; direct_labor_amount: number | null }> | null
+    for (const it of items ?? []) {
+      const d = sheetDay.get(it.job_id)
+      if (!d) continue
+      const v = it.direct_labor_amount != null ? Number(it.direct_labor_amount) : Number(it.count ?? 0) * Number(it.hrs_per_unit ?? 0) * Number(it.labor_rate ?? 0)
+      addTo(subByDay, d, v)
+    }
   }
 
   // Net position history flows (v2.2726): invoices sent, payments received,
@@ -316,55 +253,22 @@ export async function loadBridgeData(): Promise<BridgeData> {
   const paymentsReceivedByDay = new Map<string, number>()
   const supplyDatedByDay = new Map<string, number>()
   const supplyPaidByDay = new Map<string, number>()
-  for (const inv of invRows) addTo(supplyDatedByDay, inv.invoice_date, Number(inv.amount ?? 0))
-  type SentRow = { amount: number | null; sent_to_customer_at: string | null }
-  type PaidRow = { amount: number | null; paid_on: string | null }
-  type SupplyPaidRow = { amount: number | null; paid_at: string | null }
+  for (const inv of invRows ?? []) addTo(supplyDatedByDay, inv.invoice_date, Number(inv.amount ?? 0))
   const [sentRows, paidRows, supplyPaidRows, settingRows, paySpeedRaw, promisesRaw] = await Promise.all([
-    fetchAllRows(
-      async (from, to) => ({
-        data: (await withSupabaseRetry(
-          async () =>
-            supabase
-              .from('jobs_ledger_invoices')
-              .select('amount, sent_to_customer_at')
-              .gte('sent_to_customer_at', `${ymdAddDays(windowStart, -1)}T00:00:00-00:00`)
-              .or('stripe_mode.is.null,stripe_mode.neq.test')
-              .order('id')
-              .range(from, to),
-          'bridge invoices sent',
-        )) as SentRow[] | null,
-        error: null,
-      }),
+    withSupabaseRetry(
+      async () =>
+        supabase
+          .from('jobs_ledger_invoices')
+          .select('amount, sent_to_customer_at')
+          .gte('sent_to_customer_at', `${ymdAddDays(windowStart, -1)}T00:00:00-00:00`)
+          .or('stripe_mode.is.null,stripe_mode.neq.test'),
       'bridge invoices sent',
-    ),
-    fetchAllRows(
-      async (from, to) => ({
-        data: (await withSupabaseRetry(
-          async () =>
-            supabase.from('jobs_ledger_payments').select('amount, paid_on').gte('paid_on', windowStart).lte('paid_on', todayYmd).order('id').range(from, to),
-          'bridge payments',
-        )) as PaidRow[] | null,
-        error: null,
-      }),
-      'bridge payments',
-    ),
-    fetchAllRows(
-      async (from, to) => ({
-        data: (await withSupabaseRetry(
-          async () =>
-            supabase
-              .from('supply_house_invoices')
-              .select('amount, paid_at')
-              .gte('paid_at', `${ymdAddDays(windowStart, -1)}T00:00:00-00:00`)
-              .order('id')
-              .range(from, to),
-          'bridge supply paid',
-        )) as SupplyPaidRow[] | null,
-        error: null,
-      }),
+    ) as Promise<Array<{ amount: number | null; sent_to_customer_at: string | null }> | null>,
+    withSupabaseRetry(async () => supabase.from('jobs_ledger_payments').select('amount, paid_on').gte('paid_on', windowStart).lte('paid_on', todayYmd), 'bridge payments') as Promise<Array<{ amount: number | null; paid_on: string | null }> | null>,
+    withSupabaseRetry(
+      async () => supabase.from('supply_house_invoices').select('amount, paid_at').gte('paid_at', `${ymdAddDays(windowStart, -1)}T00:00:00-00:00`),
       'bridge supply paid',
-    ),
+    ) as Promise<Array<{ amount: number | null; paid_at: string | null }> | null>,
     withSupabaseRetry(async () => supabase.from('app_settings').select('key, value_text').in('key', [BRIDGE_CASH_SETTING_KEY, BRIDGE_FLOOR_SETTING_KEY]), 'bridge settings') as Promise<Array<{ key: string; value_text: string | null }> | null>,
     (async (): Promise<unknown> => {
       try {
diff --git a/src/lib/fetchMercuryJobAllocationsWithAttributionForJob.ts b/src/lib/fetchMercuryJobAllocationsWithAttributionForJob.ts
index 5c244c01..7561681e 100644
--- a/src/lib/fetchMercuryJobAllocationsWithAttributionForJob.ts
+++ b/src/lib/fetchMercuryJobAllocationsWithAttributionForJob.ts
@@ -2,9 +2,6 @@ import { supabase } from './supabase'
 import type { Database } from '../types/database'
 import { withSupabaseRetry } from '../utils/errorHandling'
 import { fetchAttributionsByMercuryTxIds } from './fetchMercuryRelationsByTxIds'
-import { fetchAllRows } from './supabasePaging'
-import { cardChargeAllocationCounts, cardChargeAllocationIsInvoiceLinked } from './jobs/cardChargeAllocationFilter'
-import { loadCardChargeExclusions } from './jobs/loadCardChargeExclusions'
 
 type MtSelect = {
   posted_at: string | null
@@ -24,8 +21,6 @@ export type MercuryJobAllocationWithAttributionRow = {
   /** Needed to open alloc modal or dedupe by transaction. */
   mercury_transaction_id: string
   attributionDisplayName: string | null
-  /** The charge is also linked to a supply-house invoice — Job Summary counts the purchase once (same rule as the bulk card-charge map). */
-  linkedToSupplyInvoice: boolean
   mercury_transactions: MtSelect | null
 }
 
@@ -41,39 +36,23 @@ type RawAlloc = {
  * Loads Mercury job allocations for one job and resolves `attributionDisplayName`
  * from `mercury_transaction_attributions` + `people` / `users` names.
  * Mirrors Job Summary’s client logic.
- *
- * Paged (a job can outgrow PostgREST's 1,000-row cap) and filtered by the same
- * `cardChargeAllocationFilter` rule as the Jobs bulk card-charge map: rows whose
- * transaction sits in the Internal Transfers bucket are not a cost and are
- * dropped here too, so the detail / print rows always sum to the card total;
- * invoice-linked rows stay and carry `linkedToSupplyInvoice`.
  */
 export async function fetchMercuryJobAllocationsWithAttributionForJob(
   jobId: string,
   operationLabel: string,
 ): Promise<MercuryJobAllocationWithAttributionRow[]> {
-  const label = `${operationLabel} mercury allocations`
-  const allRows = (await fetchAllRows(
-    async (from, to) => ({
-      data: (await withSupabaseRetry(
-        async () =>
-          await supabase
-            .from('mercury_transaction_job_allocations')
-            .select(
-              'id, amount, note, mercury_transaction_id, mercury_transactions(posted_at, counterparty_name, amount, note, external_memo, mercury_account_id, raw)',
-            )
-            .eq('job_id', jobId)
-            .order('created_at', { ascending: true })
-            .order('id')
-            .range(from, to),
-        label,
-      )) as RawAlloc[] | null,
-      error: null,
-    }),
-    label,
-  )) as RawAlloc[]
-  const exclusions = await loadCardChargeExclusions([...new Set(allRows.map((r) => r.mercury_transaction_id))])
-  const rawRows = allRows.filter((r) => cardChargeAllocationCounts(r, exclusions))
+  const data = await withSupabaseRetry(
+    async () =>
+      await supabase
+        .from('mercury_transaction_job_allocations')
+        .select(
+          'id, amount, note, mercury_transaction_id, mercury_transactions(posted_at, counterparty_name, amount, note, external_memo, mercury_account_id, raw)',
+        )
+        .eq('job_id', jobId)
+        .order('created_at', { ascending: true }),
+    `${operationLabel} mercury allocations`,
+  )
+  const rawRows = (data ?? []) as RawAlloc[]
   const attrByTxId = new Map<string, { person_id: string | null; user_id: string | null }>()
   const personNameById = new Map<string, string>()
   const userNameById = new Map<string, string>()
@@ -131,7 +110,6 @@ export async function fetchMercuryJobAllocationsWithAttributionForJob(
       mercury_transaction_id: r.mercury_transaction_id,
       mercury_transactions: r.mercury_transactions,
       attributionDisplayName,
-      linkedToSupplyInvoice: cardChargeAllocationIsInvoiceLinked(r, exclusions),
     }
   })
 }
diff --git a/src/lib/fetchUnattributedMercuryForManyJobs.test.ts b/src/lib/fetchUnattributedMercuryForManyJobs.test.ts
index de291655..ba46b9c7 100644
--- a/src/lib/fetchUnattributedMercuryForManyJobs.test.ts
+++ b/src/lib/fetchUnattributedMercuryForManyJobs.test.ts
@@ -15,7 +15,6 @@ function sampleRow(
     note: null,
     mercury_transaction_id: tx,
     attributionDisplayName: attribution,
-    linkedToSupplyInvoice: false,
     mercury_transactions: {
       posted_at: '2020-01-15',
       counterparty_name: 'X',
diff --git a/src/lib/jobs/cardChargeAllocationFilter.test.ts b/src/lib/jobs/cardChargeAllocationFilter.test.ts
deleted file mode 100644
index decb4274..00000000
--- a/src/lib/jobs/cardChargeAllocationFilter.test.ts
+++ /dev/null
@@ -1,59 +0,0 @@
-import { describe, expect, it } from 'vitest'
-import {
-  EMPTY_CARD_CHARGE_EXCLUSIONS,
-  cardChargeAllocationCounts,
-  cardChargeAllocationIsInvoiceLinked,
-  sumCardChargeAllocationsForJob,
-  summarizeCardChargeAllocations,
-  type CardChargeExclusions,
-} from './cardChargeAllocationFilter'
-
-const plain = { id: 'a1', job_id: 'J1', mercury_transaction_id: 'tx-plain', amount: -100 }
-const internal = { id: 'a2', job_id: 'J1', mercury_transaction_id: 'tx-internal', amount: -500 }
-const linked = { id: 'a3', job_id: 'J1', mercury_transaction_id: 'tx-linked', amount: -40 }
-const fuel = { id: 'a4', job_id: 'J2', mercury_transaction_id: 'tx-fuel', amount: 25 }
-const rows = [plain, internal, linked, fuel]
-
-const exclusions: CardChargeExclusions = {
-  bucketByTxId: new Map([
-    ['tx-internal', 'internal_transfer'],
-    ['tx-fuel', 'fuel_gas'],
-  ]),
-  invoiceLinkedTxIds: new Set(['tx-linked']),
-}
-
-describe('cardChargeAllocationFilter', () => {
-  it('drops Internal-Transfers-bucketed rows and keeps every other bucket', () => {
-    expect(cardChargeAllocationCounts(internal, exclusions)).toBe(false)
-    expect(cardChargeAllocationCounts(plain, exclusions)).toBe(true)
-    expect(cardChargeAllocationCounts(fuel, exclusions)).toBe(true)
-  })
-
-  it('flags invoice-linked rows without removing them from the gross total', () => {
-    expect(cardChargeAllocationIsInvoiceLinked(linked, exclusions)).toBe(true)
-    expect(cardChargeAllocationIsInvoiceLinked(plain, exclusions)).toBe(false)
-    const s = summarizeCardChargeAllocations(rows, exclusions)
-    expect(s.chargesByJobId.get('J1')).toBe(140) // 100 plain + 40 linked; the 500 internal transfer is gone
-    expect(s.invoiceLinkedByJobId.get('J1')).toBe(40)
-    expect(s.chargesByJobId.get('J2')).toBe(25)
-    expect(s.invoiceLinkedByJobId.has('J2')).toBe(false)
-    expect(s.counted.map((r) => r.id)).toEqual(['a1', 'a3', 'a4'])
-  })
-
-  it('the one-job sum equals the bulk map entry for the same rows (the #3b asymmetry)', () => {
-    const bulk = summarizeCardChargeAllocations(rows, exclusions)
-    const j1 = sumCardChargeAllocationsForJob(
-      rows.filter((r) => r.job_id === 'J1'),
-      exclusions,
-    )
-    expect(j1.charges).toBe(bulk.chargesByJobId.get('J1'))
-    expect(j1.invoiceLinked).toBe(bulk.invoiceLinkedByJobId.get('J1'))
-  })
-
-  it('degrades to "everything counts, nothing linked" with empty exclusions', () => {
-    const s = summarizeCardChargeAllocations(rows, EMPTY_CARD_CHARGE_EXCLUSIONS)
-    expect(s.chargesByJobId.get('J1')).toBe(640)
-    expect(s.invoiceLinkedByJobId.size).toBe(0)
-    expect(sumCardChargeAllocationsForJob([], exclusions)).toEqual({ charges: 0, invoiceLinked: 0 })
-  })
-})
diff --git a/src/lib/jobs/cardChargeAllocationFilter.ts b/src/lib/jobs/cardChargeAllocationFilter.ts
deleted file mode 100644
index 8e06d3c8..00000000
--- a/src/lib/jobs/cardChargeAllocationFilter.ts
+++ /dev/null
@@ -1,96 +0,0 @@
-/**
- * The ONE rule for which Mercury job allocations count as a job's "card
- * charges" — shared by the Jobs bulk card-charge map, the per-job detail /
- * print rows, and the post-save one-job refresh (journey-map Phase 4, Tier-1
- * #3(c); the #3b recheck found the three paths applying different exclusions).
- *
- * - **Internal Transfers** (drag-sort bucket `internal_transfer`) are money
- *   moving between the org's own accounts, not a cost — excluded outright,
- *   the same exclusion People → Overhead applies (v2.2692).
- * - **Supply-house-invoice-linked** charges are the same purchase the invoice
- *   allocation already counts. They stay in the gross card total (so the
- *   detail rows still sum to the card) and are tracked separately so Job
- *   Summary's parts cost can count them once (`Jobs.tsx`, v2.2692).
- *
- * Pure — the lookups arrive pre-loaded (`loadCardChargeExclusions`), so the
- * rule is unit-testable and every caller sees identical numbers.
- */
-
-export type CardChargeAllocationLike = {
-  mercury_transaction_id: string
-  amount: number
-}
-
-export type CardChargeExclusions = {
-  /** Mercury tx id → accounting bucket key (`fetchAccountingBucketByTxId`); absent = counts. */
-  bucketByTxId: ReadonlyMap<string, string>
-  /** Mercury tx ids carrying at least one supply-house invoice link. */
-  invoiceLinkedTxIds: ReadonlySet<string>
-}
-
-/** "Everything counts, nothing is linked" — what a caller uses when RLS hides the lookups. */
-export const EMPTY_CARD_CHARGE_EXCLUSIONS: CardChargeExclusions = {
-  bucketByTxId: new Map(),
-  invoiceLinkedTxIds: new Set(),
-}
-
-/** Bucket key that removes an allocation from every card-charge number. */
-export const CARD_CHARGE_EXCLUDED_BUCKET = 'internal_transfer' as const
-
-/** True when the allocation counts toward the job's card charges (not an Internal Transfer). */
-export function cardChargeAllocationCounts(row: CardChargeAllocationLike, exclusions: CardChargeExclusions): boolean {
-  return exclusions.bucketByTxId.get(row.mercury_transaction_id) !== CARD_CHARGE_EXCLUDED_BUCKET
-}
-
-/** True when the allocation's transaction is also linked to a supply-house invoice. */
-export function cardChargeAllocationIsInvoiceLinked(
-  row: CardChargeAllocationLike,
-  exclusions: CardChargeExclusions,
-): boolean {
-  return exclusions.invoiceLinkedTxIds.has(row.mercury_transaction_id)
-}
-
-export type CardChargeSummary<T> = {
-  /** Rows that count (Internal Transfers removed), in input order. */
-  counted: T[]
-  /** job id → gross card charges (abs amounts, invoice-linked included). */
-  chargesByJobId: Map<string, number>
-  /** job id → the slice of `chargesByJobId` that is also invoice-linked. */
-  invoiceLinkedByJobId: Map<string, number>
-}
-
-/** Applies the rule across many jobs' rows (the Jobs bulk card-charge map). */
-export function summarizeCardChargeAllocations<T extends CardChargeAllocationLike & { job_id: string }>(
-  rows: readonly T[],
-  exclusions: CardChargeExclusions,
-): CardChargeSummary<T> {
-  const counted: T[] = []
-  const chargesByJobId = new Map<string, number>()
-  const invoiceLinkedByJobId = new Map<string, number>()
-  for (const row of rows) {
-    if (!cardChargeAllocationCounts(row, exclusions)) continue
-    counted.push(row)
-    const usd = Math.abs(Number(row.amount))
-    chargesByJobId.set(row.job_id, (chargesByJobId.get(row.job_id) ?? 0) + usd)
-    if (cardChargeAllocationIsInvoiceLinked(row, exclusions)) {
-      invoiceLinkedByJobId.set(row.job_id, (invoiceLinkedByJobId.get(row.job_id) ?? 0) + usd)
-    }
-  }
-  return { counted, chargesByJobId, invoiceLinkedByJobId }
-}
-
-/** Applies the rule to ONE job's rows (post-save refresh): gross card charges + the invoice-linked slice. */
-export function sumCardChargeAllocationsForJob(
-  rows: readonly CardChargeAllocationLike[],
-  exclusions: CardChargeExclusions,
-): { charges: number; invoiceLinked: number } {
-  let charges = 0
-  let invoiceLinked = 0
-  for (const row of rows) {
-    if (!cardChargeAllocationCounts(row, exclusions)) continue
-    const usd = Math.abs(Number(row.amount))
-    charges += usd
-    if (cardChargeAllocationIsInvoiceLinked(row, exclusions)) invoiceLinked += usd
-  }
-  return { charges, invoiceLinked }
-}
diff --git a/src/lib/jobs/fetchStagesHeaderStats.ts b/src/lib/jobs/fetchStagesHeaderStats.ts
index 03ec1e57..0bc56838 100644
--- a/src/lib/jobs/fetchStagesHeaderStats.ts
+++ b/src/lib/jobs/fetchStagesHeaderStats.ts
@@ -27,7 +27,6 @@
  */
 import { supabase } from '../supabase'
 import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
-import { fetchAllRows } from '../supabasePaging'
 import { addDaysYmd } from '../emailSchedule/emailScheduleWeek'
 import { buildJobsStagesBoardLists, type StageRow } from '../jobsStagesBoard'
 import {
@@ -71,64 +70,33 @@ export async function fetchStagesHeaderStats(
   now = new Date(),
 ): Promise<FetchStagesHeaderStatsResult> {
   try {
-    // Paged (Phase 4 #3(c)): these are bounded-but-unranged company-wide reads; the
-    // invoice-linked payments clause grows with company age and an un-ranged read is
-    // silently cut at PostgREST's 1,000 rows — the header's billed/collected numbers
-    // would drift with no error. Fresh builder per page; `.order('id')` keeps pages stable.
-    const makeJobsQ = () => {
-      let q = supabase
-        .from('jobs_ledger')
-        .select(LEAN_STATS_JOB_COLUMNS)
-        .or(`status.in.(${LEAN_STATS_ACTIVE_JOB_STATUSES.join(',')}),status.is.null`)
-      if (customerFilter) q = q.eq('customer_id', customerFilter)
-      return q.order('id')
-    }
+    let jobsQ = supabase
+      .from('jobs_ledger')
+      .select(LEAN_STATS_JOB_COLUMNS)
+      .or(`status.in.(${LEAN_STATS_ACTIVE_JOB_STATUSES.join(',')}),status.is.null`)
+    if (customerFilter) jobsQ = jobsQ.eq('customer_id', customerFilter)
     let paidQ = supabase.from('jobs_ledger').select('id', { count: 'exact', head: true }).eq('status', 'paid')
     if (customerFilter) paidQ = paidQ.eq('customer_id', customerFilter)
     const [jobRows, paidCount, invoiceRows, paymentRows] = await Promise.all([
-      fetchAllRows(
-        async (from, to) => ({
-          data: (await withSupabaseRetry(async () => makeJobsQ().range(from, to), 'stages header stats: jobs')) as unknown as
-            | LeanStatsJobRow[]
-            | null,
-          error: null,
-        }),
-        'stages header stats: jobs',
-      ),
+      withSupabaseRetry(async () => jobsQ, 'stages header stats: jobs'),
       withSupabaseRetry(async () => {
         const { count, error } = await paidQ
         return { data: count ?? 0, error }
       }, 'stages header stats: paid count'),
-      fetchAllRows(
-        async (from, to) => ({
-          data: (await withSupabaseRetry(
-            async () =>
-              supabase
-                .from('jobs_ledger_invoices')
-                .select(LEAN_STATS_INVOICE_COLUMNS)
-                .in('status', [...LEAN_STATS_ACTIVE_INVOICE_STATUSES])
-                .order('id')
-                .range(from, to),
-            'stages header stats: invoices',
-          )) as unknown as LeanStatsInvoiceRow[] | null,
-          error: null,
-        }),
+      withSupabaseRetry(
+        async () =>
+          supabase
+            .from('jobs_ledger_invoices')
+            .select(LEAN_STATS_INVOICE_COLUMNS)
+            .in('status', [...LEAN_STATS_ACTIVE_INVOICE_STATUSES]),
         'stages header stats: invoices',
       ),
-      fetchAllRows(
-        async (from, to) => ({
-          data: (await withSupabaseRetry(
-            async () =>
-              supabase
-                .from('jobs_ledger_payments')
-                .select(LEAN_STATS_PAYMENT_COLUMNS)
-                .or(`invoice_id.not.is.null,paid_on.gte.${collectedWindowStartYmd(now)}`)
-                .order('id')
-                .range(from, to),
-            'stages header stats: payments',
-          )) as unknown as LeanStatsPaymentRow[] | null,
-          error: null,
-        }),
+      withSupabaseRetry(
+        async () =>
+          supabase
+            .from('jobs_ledger_payments')
+            .select(LEAN_STATS_PAYMENT_COLUMNS)
+            .or(`invoice_id.not.is.null,paid_on.gte.${collectedWindowStartYmd(now)}`),
         'stages header stats: payments',
       ),
     ])
diff --git a/src/lib/jobs/loadCardChargeExclusions.ts b/src/lib/jobs/loadCardChargeExclusions.ts
deleted file mode 100644
index d47196f1..00000000
--- a/src/lib/jobs/loadCardChargeExclusions.ts
+++ /dev/null
@@ -1,36 +0,0 @@
-import { supabase } from '../supabase'
-import { fetchAllRowsChunkedIn } from '../supabasePaging'
-import { fetchAccountingBucketByTxId } from '../overheadPartsBucketLoader'
-import { EMPTY_CARD_CHARGE_EXCLUSIONS, type CardChargeExclusions } from './cardChargeAllocationFilter'
-
-/** Mercury tx ids (among `txIds`) that carry a supply-house invoice link — the same purchase seen twice. */
-export async function fetchMercuryTxIdsLinkedToSupplyInvoices(txIds: readonly string[]): Promise<Set<string>> {
-  if (txIds.length === 0) return new Set()
-  const rows = (await fetchAllRowsChunkedIn(
-    [...txIds],
-    (chunk, from, to) =>
-      supabase
-        .from('mercury_transaction_supply_house_invoice_links')
-        .select('mercury_transaction_id')
-        .in('mercury_transaction_id', chunk)
-        .order('id')
-        .range(from, to),
-    'mercury invoice links by tx',
-  )) as Array<{ mercury_transaction_id: string }>
-  return new Set(rows.map((r) => r.mercury_transaction_id))
-}
-
-/**
- * Loads the two lookups `cardChargeAllocationFilter` needs for a set of
- * transactions (chunked + paged). Each lookup degrades to "everything counts"
- * when RLS hides its table — a role that can't read buckets or links still sees
- * gross card charges rather than nothing.
- */
-export async function loadCardChargeExclusions(txIds: readonly string[]): Promise<CardChargeExclusions> {
-  if (txIds.length === 0) return EMPTY_CARD_CHARGE_EXCLUSIONS
-  const [bucketByTxId, invoiceLinkedTxIds] = await Promise.all([
-    fetchAccountingBucketByTxId(txIds).catch(() => new Map<string, string>()),
-    fetchMercuryTxIdsLinkedToSupplyInvoices(txIds).catch(() => new Set<string>()),
-  ])
-  return { bucketByTxId, invoiceLinkedTxIds }
-}
diff --git a/src/lib/partsUnattributedMercuryDedupe.test.ts b/src/lib/partsUnattributedMercuryDedupe.test.ts
index 681bce66..79cefe09 100644
--- a/src/lib/partsUnattributedMercuryDedupe.test.ts
+++ b/src/lib/partsUnattributedMercuryDedupe.test.ts
@@ -15,7 +15,6 @@ function row(
     note: null,
     mercury_transaction_id: partial.mercury_transaction_id,
     attributionDisplayName: partial.attributionDisplayName ?? null,
-    linkedToSupplyInvoice: false,
     mercury_transactions: null,
   }
 }
diff --git a/src/lib/subWorkOrders/sheetRail.test.ts b/src/lib/subWorkOrders/sheetRail.test.ts
index 88216b9a..fa749d8c 100644
--- a/src/lib/subWorkOrders/sheetRail.test.ts
+++ b/src/lib/subWorkOrders/sheetRail.test.ts
@@ -123,3 +123,16 @@ describe('daysBetweenYmd', () => {
     expect(daysBetweenYmd('2026-09-05', '2026-09-02')).toBe(-3)
   })
 })
+
+describe('buildSheetRail — crew pay', () => {
+  it('draws only the sub’s four dots, never a gap, and Next skips the agreement', () => {
+    const r = rail({ coverage: none, sheetStage: 'walkthrough', crewPay: true, agreed: 1000, open: 1000 })
+    expect(r.steps.map((s) => s.key)).toEqual(['work', 'inspection', 'customer_pays', 'paid'])
+    expect(states(r)).toBe('done now todo todo')
+    expect(r).toMatchObject({ crewPay: true, gap: false, current: 'inspection', label: 'Walk-through', position: 4 })
+    expect(sheetNextAction(r, none, { subName: 'Abraham, Misses Taunya TESTING', agreed: 1000, open: 1000, unpriced: false, todayYmd: TODAY }).label).toBe('Schedule the walk-through')
+    const paid = rail({ coverage: none, sheetStage: 'customer_pay', crewPay: true, agreed: 1000, open: 0 })
+    expect(paid).toMatchObject({ current: 'paid', tone: 'paid', label: 'Paid' })
+    expect(sheetNextAction(rail({ coverage: none, crewPay: true, agreed: 1000, open: 1000 }), none, { subName: 'Abraham', agreed: 1000, open: 1000, unpriced: false, todayYmd: TODAY })).toMatchObject({ label: 'Wait for “done”', hint: 'crew pay — no work order needed', button: null })
+  })
+})
diff --git a/src/lib/subWorkOrders/sheetRail.ts b/src/lib/subWorkOrders/sheetRail.ts
index 245a5202..1d61e69c 100644
--- a/src/lib/subWorkOrders/sheetRail.ts
+++ b/src/lib/subWorkOrders/sheetRail.ts
@@ -57,6 +57,8 @@ export type SheetRailInput = {
   agreed: number
   open: number
   unpriced: boolean
+  /** A crew pay sheet (a teammate on it): only the sub's four dots — there is no agreement segment to draw. */
+  crewPay?: boolean
 }
 
 export type SheetRail = {
@@ -72,6 +74,8 @@ export type SheetRail = {
   /** The line under the label: "Sep 5 · no price", "good through Sep 12", "“too soon” · Sep 3" … */
   sublabel: string | null
   tone: 'gap' | 'now' | 'paid'
+  /** Four dots, no agreement segment (crew pay). */
+  crewPay: boolean
 }
 
 const stageRank = (s: SubSheetStage | null): number => (s === 'walkthrough' ? 1 : s === 'customer_pay' ? 2 : 0)
@@ -91,6 +95,29 @@ export function buildSheetRail(input: SheetRailInput): SheetRail {
   const moneyStep = sheetMoneyStep(input)
   const moneyIdx = STEP_ORDER.indexOf(moneyStep)
 
+  if (input.crewPay) {
+    const subSteps = STEP_ORDER.slice(STEP_ORDER.indexOf('work'))
+    const steps: SheetRailStep[] = subSteps.map((key) => {
+      const idx = STEP_ORDER.indexOf(key)
+      const state: SheetRailStepState = idx < moneyIdx ? 'done' : idx === moneyIdx ? (moneyStep === 'paid' ? 'done' : 'now') : 'todo'
+      return { key, label: SHEET_RAIL_STEP_LABEL[key], state }
+    })
+    const cur = steps.find((s) => s.key === moneyStep)
+    if (cur && cur.state !== 'done') cur.state = 'now'
+    const queued = moneyStep === 'paid' && input.open > 0
+    return {
+      steps,
+      current: moneyStep,
+      gap: false,
+      group: 'signed',
+      position: 3 + (moneyIdx - STEP_ORDER.indexOf('work')),
+      label: SHEET_RAIL_STEP_LABEL[moneyStep],
+      sublabel: queued ? 'queued for the pay run' : null,
+      tone: moneyStep === 'paid' ? 'paid' : 'now',
+      crewPay: true,
+    }
+  }
+
   const signed = c.kind === 'signed'
   const sentLive = c.kind === 'sent' && !c.expired
   const drafted = c.kind === 'draft'
@@ -155,7 +182,7 @@ export function buildSheetRail(input: SheetRailInput): SheetRail {
   }
 
   const tone: SheetRail['tone'] = gap ? 'gap' : moneyStep === 'paid' && signed ? 'paid' : 'now'
-  return { steps, current, gap, group, position, label, sublabel, tone }
+  return { steps, current, gap, group, position, label, sublabel, tone, crewPay: false }
 }
 
 export type SheetNextButton = 'draft' | 'price' | 'send' | 'nudge' | 'reoffer' | null
@@ -196,6 +223,7 @@ const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
  */
 export function sheetNextAction(rail: SheetRail, coverage: JobWorkOrderCoverage, ctx: SheetNextActionContext): SheetNextAction {
   const sub = ctx.subName.trim() || 'the sub'
+  if (rail.crewPay) return crewPayNextAction(rail, sub, ctx)
   if (coverage.kind === 'declined') {
     return { label: 'Re-offer or re-price', hint: coverage.reason ? `${sub} said “${coverage.reason}”` : `${sub} declined`, button: 'reoffer', buttonLabel: 'Re-offer…' }
   }
@@ -235,3 +263,19 @@ export function sheetNextAction(rail: SheetRail, coverage: JobWorkOrderCoverage,
       return { label: 'Signed', hint: null, button: null, buttonLabel: null }
   }
 }
+
+/** Crew pay sheets skip the agreement steps: the office's move is the sheet's own step. */
+function crewPayNextAction(rail: SheetRail, sub: string, ctx: SheetNextActionContext): SheetNextAction {
+  switch (rail.current) {
+    case 'inspection':
+      return { label: 'Schedule the walk-through', hint: 'the crew said the work is done', button: null, buttonLabel: null }
+    case 'customer_pays':
+      return { label: 'Bill and collect', hint: `${sub} ${sub.includes(',') || sub.includes('|') ? 'are' : 'is'} owed ${money(ctx.open)}`, button: null, buttonLabel: null }
+    case 'paid':
+      return ctx.open > 0
+        ? { label: `Pay ${sub}`, hint: `${money(ctx.open)} queued for the pay run`, button: null, buttonLabel: null }
+        : { label: 'Nothing — done', hint: null, button: null, buttonLabel: null }
+    default:
+      return { label: 'Wait for “done”', hint: 'crew pay — no work order needed', button: null, buttonLabel: null }
+  }
+}
diff --git a/src/pages/Customers.tsx b/src/pages/Customers.tsx
index 46a9c78b..041118cf 100644
--- a/src/pages/Customers.tsx
+++ b/src/pages/Customers.tsx
@@ -5,8 +5,6 @@ import { NO_CUSTOMER_TYPE_LABEL } from '../constants/customerTypeLabels'
 import { supabase } from '../lib/supabase'
 import { appliedByInvoiceId, openBillRowsForJob } from '../lib/billing/billTruth'
 import { legacyListOpenBalance, reportBillTruthShadow } from '../lib/billing/billTruthShadow'
-import { fetchAllRowsChunkedIn } from '../lib/supabasePaging'
-import { formatErrorMessage } from '../utils/errorHandling'
 import { useNewCustomerModal } from '../contexts/NewCustomerModalContext'
 import { useEditCustomerModal } from '../contexts/EditCustomerModalContext'
 import { CustomerNotesTable } from '../components/customerNotes/CustomerNotesTable'
@@ -247,97 +245,55 @@ export default function Customers() {
     setCustomers(customersWithMasters)
     const customerIds = customersWithMasters.map((c) => c.id)
     if (customerIds.length > 0) {
-      try {
-        // Chunked `.in()` + paged (Phase 4 #3(c) — J34-N1/N2): the per-customer reads used to
-        // put every customer id in ONE URL, and the invoice/payment reads were whole-table
-        // and silently capped at PostgREST's 1,000 rows — every money chip, the header
-        // total, "Owes money" and "$ Top customers" drifted with no error and no chip.
-        const [projectRows, jobRows, bidRows, contactRows, estimateRows] = await Promise.all([
-          fetchAllRowsChunkedIn(
-            customerIds,
-            (chunk, from, to) => supabase.from('projects').select('customer_id').in('customer_id', chunk).order('id').range(from, to),
-            'customers list projects',
-          ),
-          fetchAllRowsChunkedIn(
-            customerIds,
-            (chunk, from, to) =>
-              supabase
-                .from('jobs_ledger')
-                .select('id, customer_id, status, revenue, payments_made, created_at')
-                .in('customer_id', chunk)
-                .order('id')
-                .range(from, to),
-            'customers list jobs',
-          ),
-          fetchAllRowsChunkedIn(
-            customerIds,
-            (chunk, from, to) => supabase.from('bids').select('customer_id, created_at').in('customer_id', chunk).order('id').range(from, to),
-            'customers list bids',
-          ),
-          fetchAllRowsChunkedIn(
-            customerIds,
-            (chunk, from, to) => supabase.from('customer_contacts').select('customer_id').in('customer_id', chunk).order('id').range(from, to),
-            'customers list contacts',
-          ),
-          fetchAllRowsChunkedIn(
-            customerIds,
-            (chunk, from, to) => supabase.from('estimates').select('customer_id, created_at').in('customer_id', chunk).order('id').range(from, to),
-            'customers list estimates',
-          ),
-        ])
-        // Money rows exist per job, so key them by the jobs just loaded — the same join
-        // `customersListRollup` makes — instead of reading the whole invoice/payment tables.
-        const jobIds = jobRows.map((j) => j.id)
-        const [invoiceRows, paymentRows] = await Promise.all([
-          fetchAllRowsChunkedIn(
-            jobIds,
-            (chunk, from, to) => supabase.from('jobs_ledger_invoices').select('id, job_id, status, amount').in('job_id', chunk).order('id').range(from, to),
-            'customers list invoices',
-          ),
-          fetchAllRowsChunkedIn(
-            jobIds,
-            (chunk, from, to) =>
-              supabase.from('jobs_ledger_payments').select('job_id, invoice_id, amount, paid_on').in('job_id', chunk).order('id').range(from, to),
-            'customers list payments',
-          ),
-        ])
+      const [projectsRes, jobsRes, bidsRes, contactsRes, invoicesRes, paymentsRes, estimatesRes] = await Promise.all([
+        supabase.from('projects').select('customer_id').in('customer_id', customerIds),
+        supabase
+          .from('jobs_ledger')
+          .select('id, customer_id, status, revenue, payments_made, created_at')
+          .in('customer_id', customerIds),
+        supabase.from('bids').select('customer_id, created_at').in('customer_id', customerIds),
+        supabase.from('customer_contacts').select('customer_id').in('customer_id', customerIds),
+        supabase.from('jobs_ledger_invoices').select('id, job_id, status, amount'),
+        supabase.from('jobs_ledger_payments').select('job_id, invoice_id, amount, paid_on'),
+        supabase.from('estimates').select('customer_id, created_at').in('customer_id', customerIds),
+      ])
       const counts: Record<string, { projects: number; jobs: number; bids: number; notes: number }> = {}
       for (const id of customerIds) counts[id] = { projects: 0, jobs: 0, bids: 0, notes: 0 }
-      for (const r of projectRows) {
+      for (const r of (projectsRes.data ?? [])) {
         const entry = r.customer_id ? counts[r.customer_id] : undefined
         if (entry) entry.projects++
       }
-      for (const r of jobRows) {
+      for (const r of (jobsRes.data ?? [])) {
         const entry = r.customer_id ? counts[r.customer_id] : undefined
         if (entry) entry.jobs++
       }
-      for (const r of bidRows) {
+      for (const r of (bidsRes.data ?? [])) {
         const entry = r.customer_id ? counts[r.customer_id] : undefined
         if (entry) entry.bids++
       }
-      for (const r of contactRows) {
+      for (const r of (contactsRes.data ?? [])) {
         const entry = r.customer_id ? counts[r.customer_id] : undefined
         if (entry) entry.notes++
       }
       setCountsByCustomerId(counts)
       const rollup = customersListRollup(
-        jobRows as LcvJobRow[],
-        invoiceRows as LcvInvoiceRow[],
-        paymentRows as LcvPaymentRow[],
+        (jobsRes.data ?? []) as LcvJobRow[],
+        (invoicesRes.data ?? []) as LcvInvoiceRow[],
+        (paymentsRes.data ?? []) as LcvPaymentRow[],
       )
       setRollupByCustomerId(rollup)
       // Bill-truth shadow (one release, journey J34-N6): the list used to clamp each CUSTOMER's
       // open balance at 0 after netting unclamped shells; the kernel clamps per row. Log-only.
       {
-        const applied = appliedByInvoiceId(paymentRows as LcvPaymentRow[])
+        const applied = appliedByInvoiceId((paymentsRes.data ?? []) as LcvPaymentRow[])
         const invByJob = new Map<string, LcvInvoiceRow[]>()
-        for (const inv of invoiceRows as LcvInvoiceRow[]) {
+        for (const inv of (invoicesRes.data ?? []) as LcvInvoiceRow[]) {
           const list = invByJob.get(inv.job_id)
           if (list) list.push(inv)
           else invByJob.set(inv.job_id, [inv])
         }
         const legacyByCustomer = new Map<string, ReturnType<typeof openBillRowsForJob>>()
-        for (const j of jobRows as LcvJobRow[]) {
+        for (const j of (jobsRes.data ?? []) as LcvJobRow[]) {
           if (!j.customer_id) continue
           const rows = openBillRowsForJob(
             { id: j.id, status: j.status, revenue: j.revenue, payments_made: j.payments_made ?? 0 },
@@ -357,10 +313,10 @@ export default function Customers() {
       // Paid jobs with zero payment rows (HCP imports): the money rail reads
       // rows, so these show $0 collected until backfilled.
       const jobIdsWithPaymentRows = new Set(
-        (paymentRows as LcvPaymentRow[]).map((p) => p.job_id),
+        ((paymentsRes.data ?? []) as LcvPaymentRow[]).map((p) => p.job_id),
       )
       setUnrecordedPaidCount(
-        (jobRows as LcvJobRow[]).filter(
+        ((jobsRes.data ?? []) as LcvJobRow[]).filter(
           (j) => j.status === 'paid' && Number(j.revenue ?? 0) > 0 && !jobIdsWithPaymentRows.has(j.id),
         ).length,
       )
@@ -370,16 +326,13 @@ export default function Customers() {
         const prev = signal[cid]
         if (!prev || iso > prev) signal[cid] = iso
       }
-      for (const r of bidRows as Array<{ customer_id: string | null; created_at: string | null }>) {
+      for (const r of (bidsRes.data ?? []) as Array<{ customer_id: string | null; created_at: string | null }>) {
         stampSignal(r.customer_id, r.created_at)
       }
-      for (const r of estimateRows as Array<{ customer_id: string | null; created_at: string | null }>) {
+      for (const r of (estimatesRes.data ?? []) as Array<{ customer_id: string | null; created_at: string | null }>) {
         stampSignal(r.customer_id, r.created_at)
       }
       setRecentSignalByCustomerId(signal)
-      } catch (e) {
-        setError(formatErrorMessage(e))
-      }
     }
     const unlinkedRes = await supabase
       .from('jobs_ledger')
diff --git a/src/pages/Jobs.tsx b/src/pages/Jobs.tsx
index 4f35e242..241b0a16 100644
--- a/src/pages/Jobs.tsx
+++ b/src/pages/Jobs.tsx
@@ -1804,6 +1804,9 @@ export default function Jobs() {
           laborJobs={laborJobs}
           laborJobsLoading={laborJobsLoading}
           laborJobNamesByHcp={laborJobNamesByHcp}
+          jobs={jobs}
+          authUserId={authUser?.id}
+          laborJobAssigneesByJobId={laborJobAssigneesByJobId}
           subLaborDueTotal={subLaborDueTotal}
           subLaborOutstandingByPerson={subLaborOutstandingByPerson}
           onNewLaborJob={() => subLaborFormRef.current?.openNew()}
diff --git a/src/types/laborJob.ts b/src/types/laborJob.ts
index f82bcebf..37e4a3e8 100644
--- a/src/types/laborJob.ts
+++ b/src/types/laborJob.ts
@@ -22,6 +22,8 @@ export type LaborJob = {
   stage_changed_by?: string | null
   stage_source?: string | null
   stage_note?: string | null
+  /** Queued for the pay run (v2.2838) — the portal lights "You're paid" once this is set. */
+  payable_after?: string | null
   /** Resolved display name of stage_changed_by (office moves only). */
   stage_changed_by_name?: string | null
   /** Project name resolved for anchored sheets (display only). */
diff --git a/to-dos/work-orders-one-row-spine.md b/to-dos/work-orders-one-row-spine.md
index 5124fc63..420d2350 100644
--- a/to-dos/work-orders-one-row-spine.md
+++ b/to-dos/work-orders-one-row-spine.md
@@ -1,6 +1,6 @@
 # Work Orders + Sub Labor: one row, with the sub's rail on it
 
-Status: in progress · PR 1 (derivation fix) v2.2865 #2607 · PR 2 (rail kernel + `SheetRail`) v2.2866 #2608 · PR 3 (Work Orders rows become sheets, all eight mock-up changes — artifact `1e154fbb`) v2.2867 #2609 · live test passed 2026-09-05, follow-ups v2.2869 #2611 · next: PR 4 (Sub Labor on the same spine) and PR 5 (chips elsewhere) · designed 2026-09-05 · mock-up: [`work-orders-one-row-spine.html`](./work-orders-one-row-spine.html) (also published at https://claude.ai/code/artifact/a8ce5a7d-d47a-4e2f-905b-558e9d67e298)
+Status: in progress · PR 1 (derivation fix) v2.2865 #2607 · PR 2 (rail kernel + `SheetRail`) v2.2866 #2608 · PR 3 (Work Orders rows become sheets, all eight mock-up changes — artifact `1e154fbb`) v2.2867 #2609 · live test passed 2026-09-05, follow-ups v2.2869 #2611 · PR 4 (Sub Labor on the same spine, Crew pay, stage menu on the rail's dot) v2.2870 · next: PR 5 (chips elsewhere) · designed 2026-09-05 · mock-up: [`work-orders-one-row-spine.html`](./work-orders-one-row-spine.html) (also published at https://claude.ai/code/artifact/a8ce5a7d-d47a-4e2f-905b-558e9d67e298)
 
 ## The ask, in the owner's words
 
