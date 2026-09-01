# Jobs Stages Tab Architecture Map (sub-decomposition)

---
file: docs/JOBS_STAGES_TAB_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 sub-decomposition map (per PAGE_DECOMPOSITION_PLAYBOOK.md) for the already-extracted Pipeline board — src/components/jobs/JobsStagesTab.tsx (3,664 lines) plus its table/row sub-files JobsStagesUnifiedTable.tsx (1,407), JobsStagesTable.tsx (659), and jobsStagesRowShared.tsx (1,204). The v2.831 extraction moved the tab out of Jobs.tsx, but the surface kept growing (18 commits of churn since; the v2.96x–v2.108x feature run landed almost entirely here). This map inventories every region so the next round of extraction — toolbar, modal tail, inline modals, prop-bundle seam for the two tables — can start without re-deriving the strategy.
audience: Developers, AI Agents
last_updated: 2026-08-20
---

## What this surface is

The Pipeline board (tab label renamed from "Stages" in the v2.1251+ naming audit; the `stages` key, URL slug, and `JobsStages*` filenames are unchanged): the six-section job pipeline (Waiting → Working → Ready to Bill → Billed Awaiting Payment → Collections → Paid in Full) rendered by [`JobsStagesTab`](../src/components/jobs/JobsStagesTab.tsx). Current line counts (2026-08-01):

| File | Lines | Shape |
|---|---|---|
| [`src/components/jobs/JobsStagesTab.tsx`](../src/components/jobs/JobsStagesTab.tsx) | 3,664 | `forwardRef` component; 62 `useState`, 20 `useEffect`, 13 `useMemo`, 8 `useCallback`, 4 refs; **55 props** + `JobsStagesTabHandle` |
| [`src/components/jobs/JobsStagesUnifiedTable.tsx`](../src/components/jobs/JobsStagesUnifiedTable.tsx) | 1,407 | mixed job/invoice-row table (Ready to Bill / Billed / Collections); **75 props** |
| [`src/components/jobs/JobsStagesTable.tsx`](../src/components/jobs/JobsStagesTable.tsx) | 659 | job-only table (Waiting / Working / Paid in Full); **58 props** |
| [`src/components/jobs/jobsStagesRowShared.tsx`](../src/components/jobs/jobsStagesRowShared.tsx) | 1,204 | shared row renderers taking a **21-field `StagesRowRenderContext`** |

Satellite (v2.1587): [`JobsStagesActivityBox.tsx`](../src/components/jobs/JobsStagesActivityBox.tsx) — the wide-screen (≥1100px via `useWideViewport1100`, v2.1670) "Job activity" box both tables render inside the Job cell's slack: pinned NEXT line, scrolling feed of notes+reports numbered by the [`jobActivityBoxFeed`](../src/lib/jobs/jobActivityBoxFeed.ts) kernel (1 = oldest), floating Post → sliding composer through `submitJobThreadNoteWithBody`; feed lazy-loads per row via `loadJobThreadNotesForJob` (both threaded down as OPTIONAL props so `JobsStagesCardList`, which shares the props types, ignores them).

Satellites (v2.1673 — the unified Job Activity view): every expanded activity surface renders ONE body, [`JobActivityView.tsx`](../src/components/jobs/JobActivityView.tsx) (toolbar with crew + % on one row, filter pills below — no Schedule/Week dispatch buttons, owner call — pinned NEXT strip, pill composer + % editor via `commitStagesPctWithNote`) wrapping the compact numbered feed [`JobActivityFeed.tsx`](../src/components/jobs/JobActivityFeed.tsx). Lines come from the [`jobActivityLine`](../src/lib/jobs/jobActivityLine.ts) kernel: one line per item (number · clock time · who · body — no kind column; speech rows band-highlighted, system rows muted), report answers / clock+schedule notes folded behind a click, day groups carrying date + age left-aligned; EVERY line numbered oldest-first pre-filter (deliberate mismatch: the row box still numbers notes/reports only). Wide shells align columns; ≤700px each item is one flowing line with a hanging indent. Rows are keyboard-operable divs (selectable detail), not buttons. Two shells: [`JobsStagesActivityExpandModal.tsx`](../src/components/jobs/JobsStagesActivityExpandModal.tsx) — the floating card (edge-to-edge ≤700px), ONE instance in JobsStagesTab's modal tail behind `StagesRowRenderContext.openJobActivityExpand(job)`, entered from the box's corner expand + the "N Reports" chip; and [`JobsStagesThreadPanel.tsx`](../src/components/jobs/JobsStagesThreadPanel.tsx) — the expanded-row panel (inline in the thread row, portal fullscreen at z 1001 with the shared ref-counted `useBodyScrollLock`; the panel mounts TWICE for a billed job — job row + invoice row — which is why the lock must be ref-counted), entered from the row's ▶ notes toggle and the card list's `openJobThreadFullscreen` more-action. `JobThreadNotesPanel` no longer appears anywhere on Stages (it remains the Job Detail / Job Mode / Quickfill / Estimates panel). Trap: the modal holds a JobWithDetails SNAPSHOT — the % commit patches it in place, but team edits show stale names until reopen.

Total surface: **6,934 lines**. This is a *sub*-decomposition map: how the tab was carved out of `Jobs.tsx`, what the page still owns, the imperative handle, deep-link routing, and the `useJobsStagesMutations` engine are all documented in [`JOBS_TABS_ARCHITECTURE.md`](./JOBS_TABS_ARCHITECTURE.md) (§ `stages` dossier) — **reference that, don't re-derive it here**. This map covers what lives *inside* the four files and how to shrink them.

**Churn since extraction** (`docs/RECENT_FEATURES.md`, grep the component names): `JobsStagesTab` touched in v2.830–834, v2.849, v2.965–968, v2.980, v2.984, v2.987, v2.1005, v2.1040–1041, v2.1049, v2.1052, v2.1056–1057, v2.1060, v2.1082; `jobsStagesRowShared` in v2.1041–1044, v2.1052–1055, v2.1060–1062. The growth drivers were: Paid-email settings gear (v2.965), tableLayout-fixed jitter fixes (v2.967/971), phone-layout passes (v2.980/984/987), hazmat green box (v2.1040), Stripe-emailed compact hint (v2.1041), inline thread chevron (v2.1043), the ⋯ tools menu (v2.1049), fullscreen thread panel (v2.1052), Job Calendar modal (v2.1056–1057), the "Next" upcoming-appointment line (v2.1060), and the red no-bid-value chip (v2.1082). **This is a HIGH-CHURN surface — expect line numbers below to rot; search symbols.**

### Mount/state semantics (preserve in every extraction)

`Jobs.tsx` renders `<JobsStagesTab ref={stagesTabRef} active={activeTab === 'stages'} .../>` **unconditionally**. The board body (`{active && <div>…</div>}`, ~line 1089) renders only when active; the **modal tail (~2688–3294) renders regardless** — mirroring the page-level modal tail it came from, so all Pipeline state survives tab switches. Effects formerly keyed on `activeTab === 'stages'` are keyed on `active`. The tab reads `useSearchParams()` **read-only** (loading hint + return-edit banner); the router that writes params stays in `Jobs.tsx` and drives tab state through the handle (`followMovedJob`, `focusSection`, `focusJob`, `focusInvoice`, `openBankPayments`, `showBilledTotalByName`).

### Old/New views (v2.1915)

The tab opens with **Old / New** pills (`jobs_pipeline_view_v1` per-device, default Old; Counts precedent v2.1909). New renders [`PipelineOverview`](../src/components/jobs/PipelineOverview.tsx) — the money story strip + Today's money moves queue — between the toolbar and the jump strip; Old renders nothing extra. Both views share every state cluster, modal, and the board itself (the overview's actions reuse the existing openers: Capable modal, aging/profit charts, AR modal, `focusStagesSection`, `setBilledAgingFilter`). View-models come from the pure kernel [`pipelineOverview.ts`](../src/lib/jobs/pipelineOverview.ts) over `cacheHeaderStats` (extended in the same PR with `collectedByWeek` + `billedNoDate`) — no extra fetches.

---

## The shared substrate

There is **no selected-record pointer** (no Bids-style `setSharedBid`). The surface has three substrate layers instead:

1. **Parent-injected engines (stay in `Jobs.tsx` — already seamed).** The jobs cache (`jobs`, `loadJobs`, `runFetchJobs`, `fetchPaidJobsIfNeeded`, `customerFilterForFetch`, `scheduleLoadJobsAfterMutation`), the 12 [`useJobsStagesMutations`](../src/hooks/useJobsStagesMutations.ts) values (`updateJobStatus`, `moveJobToReadyToBillWithStripePrep`, `revertBilledInvoiceToReadyToBill`, `deleteInvoice`, `setInvoiceEstimatedBillDate`, `bumpInvoiceEstimatedBillDate`, `updateJobPctComplete`, `commitStagesPctWithNote`, + 4 busy ids), and the 14 [`useJobThreadNotes`](../src/hooks/useJobThreadNotes.ts) values (shared with Job Summary). These arrive as props; any internal extraction re-threads them, it never re-hosts the hooks.
2. **The board-lists memo (the tab's data engine).** `stagesBoardLists = useMemo(() => buildJobsStagesBoardLists(jobs, stagesSearchQuery, stagesSearchExtraJobIds))` — the builder is already pure and tested in [`lib/jobsStagesBoard.ts`](../src/lib/jobsStagesBoard.ts). Every section, chip, total, and modal reads from this one memo (plus `bankPaymentsModalBilledRows = buildJobsStagesBoardLists(jobs, '').billedRows`, the deliberate empty-search AR variant mirrored verbatim in `JobsAccountsReceivable.tsx`).
3. **The selection *analog*: focus/flash + section-open state.** `stagesSectionOpen` {waiting/working/readyToBill/billed/collections/paid}, the job pair `pendingStagesJobFocusId`/`stagesJobFlashId`, and the invoice pair `pendingStagesInvoiceFocusId`/`stagesInvoiceFlashId` (+ `applyStagesInvoiceFocus`, `focusStagesSection`, `followMovedJob`). These are written by the imperative handle, the tools/alert modals, `collectionsConfirm`, and the Bill Customer `onSuccess` follow — they are the cross-region glue and **must stay in `JobsStagesTab`**; extracted children receive them as props/callbacks.
4. **The row-render context.** `StagesRowRenderContext` (21 fields, [`jobsStagesRowShared.tsx`](../src/components/jobs/jobsStagesRowShared.tsx) ~51–73) is the seam between the tab's state and the row renderers; both tables build it identically from props + their own `useNavigate`/`useDispatchTaskModal`/`useChecklistAddModal` hooks. Any prop-count reduction should widen THIS seam (one bundle object / context) rather than invent a second one.

Consequence for extraction: children are cheap to carve off *if* they take `stagesBoardLists` slices + open/focus callbacks; anything that needs the mutation engine must keep receiving it as props from the tab (which receives it from the page).

---

## Region dossiers (inside `JobsStagesTab.tsx`)

### 1. State block + derived gates (~304–573)

- **Role gates (memos/consts):** `canOpenJobScheduleModal`, `canEditJobPctComplete` (mirrors `jobs_ledger` UPDATE RLS), `canManageJobPeople` (mirrors `jobs_ledger_team_members` RLS), `canCreateHazmatFee` (mirrors `create_hazmat_fee_incident` RPC gate), plus `canManageCollections` inside the IIFE and two inline role checks in the tools menu. All pure functions of `authRole`/`myRole`.
- **Owned state (grouped):** search (`stagesSearchQuery`, `stagesSearchExtraJobIds`, `stagesScheduleSessionSearchBusy`); sections + focus/flash (substrate #3 above); modes (`stagesHamMode` ← localStorage `jobs-stages-ham-mode`, `stagesFollowMoves` ← `jobs-stages-follow-moves`, `stagesIncludeScheduleTimeInSearch` ← `jobs-stages-search-include-schedule-time`, default **true**); the single-opener modal cluster (§6); assigned-edit (`assignedEditJobId`/`assignedEditSelectedIds`/`assignedEditSavingId` + `assignedEditDropdownRef` + click-outside effect); `returnEditBannerJobId`; `stagesToolsMenuOpen`; `stagesInvoiceSendBackConfirmLockRef`.
- **Loaders owned by the tab:** `loadStagesManHours` (RPC `get_man_hours_by_job`, load-once via `stagesManHoursLoadedRef`, ref resets on error to allow retry; 80 ms-delayed effect on `active && authUser?.id`) → `stagesManHoursByJobId` / `stagesLaborBreakdownByJobId` memos; `loadHazmatFeeJobIds` (`job_hazmat_incidents` SELECT `.is('voided_at', null)`, silent-failure by design, v2.1040); `stagesUpcomingByJobId` effect (`fetchStagesUpcomingScheduleForJobs(ids, scheduleTodayDateKey())` on every `jobs` change); `sendBackStatusEventLine` effect (`job_status_events` SELECT + `formatMoveIntoStageByOnLine`); `useArBankUnallocatedCount({ enabled: active, … })`; `useSendBackCollectPaymentFlowNotice(sendBackJob)`; `useIsMobile()`.
- **Derived memos:** `stagesBoardLists`, `stagesJobsWithoutCustomer`, `stagesWorkingJobsWithoutPictures`, `stagesReadyToBillNoEmailJobs` (each with an auto-close effect on its modal when the list empties), `bankPaymentsModalBilledRows`, `accountsReceivableButtonAccessibleName`, `billedAgingBuckets` (= `buildBilledAgingBuckets(stagesFilteredJobs)` — already lib), `lienToolingSenderFallback`, `stagesManHoursByJobId`, `stagesLaborBreakdownByJobId`.
- **Effects (search/focus):** 350 ms debounced schedule/clock-session search (`fetchJobIdsMatchingScheduleOrClockSessions`, gated by `shouldFetchStagesScheduleSessionSearch` + `STAGES_SCHEDULE_SESSION_SEARCH_MIN_CHARS`); paid-list prefetch-on-search; 320 ms debounced `refreshJobThreadStatsForJobIds`; flash timers (2,600 ms each); invoice scroll (200 ms, `[data-stages-invoice-id]`); job scroll with one 700 ms retry (`[data-stages-job-id]`); return-edit banner trio over `lib/returnEditJobFromStages` (10 s timeout, cleared on `!active`).
- **Extraction status:** stays. This is the tab's core; extract *from* it (Stage-A gates/kernels below), not it.

### 2. Toolbar + ⋯ tools menu (~1094–1304)

- **Render:** New Job button (`openNew`, `shortNewJobButtonLabel`), search input (a11y `stages-search-supplemental-desc` + `aria-busy`), search-busy hint, active-filter chips (v2.1232: tap-to-clear pills that render only when a GC/development filter is applied; the selects themselves moved into the menu), and the v2.1049 ⋯ menu: a Filters group at the top (GC + development `<select>`s, v2.1232 — selecting keeps the menu open; the ⋯ trigger tints blue while a filter is applied), then Job Book…, Total by Name…, Combine / Separate… (first and third gated `['dev','master_technician','assistant','controller']` vs `authRole || myRole`), divider, five toggle rows (Schedule & time in search, Follow cards I move, Ham mode, Edit mode, Mobile cards — the last renders sections as full-width cards via `JobsStagesCardList.tsx` (v2.1241, all roles): the card/table pair share the exact props types, so the section sites just swap the component tag (`StagesSectionList` / `StagesUnifiedSectionList`); cards reuse the shared row renderers, `StagesProgressPaymentCell`, the activity cell (`asDiv` option), and `JobsStagesThreadPanel` — the last two gated `['dev','assistant','controller']`; Edit mode (v2.1236) renders a thin vertical EDIT rail on every job-backed row in both section tables via `renderStagesEditModeRail` in `jobsStagesRowShared.tsx` → one tap into Edit Job, with the effective flag role-gated in the tab so a stale localStorage value can't surface rails for other roles). Module-scope helpers `stagesToolsMenuItemStyle`, `stagesActiveFilterChipStyle`, `stagesToolsMenuFilterSelectStyle` + `renderStagesToolsMenuToggleState`.
- **Owned state:** `stagesToolsMenuOpen` only; everything else it touches is setters for tab-level state/localStorage toggles (`toggleStagesHamMode`, `toggleStagesIncludeScheduleTimeInSearch`, the follow-moves inline toggle) and modal openers (`setJobBookModalOpen`, `setBilledTotalByNameModalOpen`, `setCombineSeparateModalOpen`).
- **Coupling:** low — props in: `openNew`, `shortNewJobButtonLabel`, `stagesSearchQuery`+setter, busy flags, the three mode values+toggles, three open callbacks, `authRole`/`myRole`.
- **Extraction:** **low risk, do first** → `JobsStagesToolbar.tsx` (~215 lines out). Pure JSX move; no supabase, no effects.

### 3. Jump nav + alert chips + alert modals (~1305–1553)

- **Render:** Waiting → Working → Ready to Bill → Billed (→ Collections when non-empty) count buttons calling `focusStagesSection`; right-aligned red/amber chips "No customer (n)" / "No customer pictures (n)" / "No email (n)" with hover state; then `StagesAlertJobListModal` ×2 (no-email, no-pictures) and `StagesNoCustomerJobsModal` — all three **already-extracted** components, opened only here, `onSelectJob` → `tryOpenEditJob(jobId, { onSaved: () => void loadJobs() })`.
- **Owned state:** three `…ModalOpen` + three `…BtnHover` booleans (+ the auto-close effects in §1).
- **Coupling:** reads four `stagesBoardLists`-derived memos + `focusStagesSection` + `tryOpenEditJob`/`loadJobs`.
- **Extraction:** low risk → `JobsStagesJumpNavAndAlerts.tsx` (~250 lines). Props: the counts/lists, `focusStagesSection`, `onEditJob` callback.

### 4. Section wiring IIFE — the six sections (~1576–2356)

- **Render:** `{(() => { … })()}` destructures `stagesBoardLists`; defines `toggleStages`, `toggleStagesJobThreadExpanded` (wraps `setExpandedJobThreadId`), the section totals (`waitingTotal`/`workingTotal` = Σ `revenue − payments_made`; `capableToBillTotal` = `capableToBillTotalFromWorking`; `readyToBillTotal` = `readyToBillRowsExposureTotal`; `billedTotal`/`collectionsTotal` = Σ `stageRowBilledRemainingAmount`), and `canManageCollections`; returns six header+table blocks with anchor ids `stages-waiting`/`stages-working`/`stages-ready-to-bill`/`stages-billed`/`stages-collections` (+ the un-id'd Paid header):
  - **Waiting** → `<JobsStagesTable jobList={waiting} actionLabel='Move to Working' onAction={updateJobStatus('working')} …/>`
  - **Working** → action `'Ready to Bill'` (ham: `nudgeMissingBillingEmail` + direct `moveJobToReadyToBillWithStripePrep`; else opens the `readyForBillingJob` double-checkbox confirm), `onSendBackSimple` → waiting (ham direct / `sendBackConfirmJob`), plus the "Capable of Being Billed: $…" header button.
  - **Ready to Bill** → `<JobsStagesUnifiedTable rows={readyToBillRows} actionLabel='Bill Customer'…>`: `onJobAction`/`onInvoiceAction` run the customer-link guard (`jobLedgerHasCustomerForBilling` → toast + `openEdit(j, { billingCustomerHighlight: true })`) then `billCustomer.openBillCustomer({ payload, onSuccess: loadJobs + followMovedJob(id,'billed'), onAfterEnsureSuccess: loadJobs })`; send-backs use `DELETE_DRAFT_BILL_LABEL` / `sendBackJob{toStatus:'working', rtbDraftCount}` / `deleteInvoice` (ham) / `sendBackInvoice{action:'delete'}`.
  - **Billed Awaiting Payment** → header carries the aging summary (`billedAgingBuckets`), the Accounts Receivable button (+ `arBankTxUnallocatedCount` badge; enabled for dev/master/assistant-like/**primary**) and Print (`printBilledAwaitingPaymentReport` → `buildBilledAwaitingPaymentReportHtml` + `openHtmlPrintWindow`, both already lib); table actions: Mark Paid (`setMarkPaidJob`/`setMarkPaidInvoice`), View Bill, Lien Tooling, Move to Collections (`canManageCollections`), send-backs (`moveJobToReadyToBillWithStripePrep` ham / `sendBackJob{toStatus:'ready_to_bill'}`; invoice: `revertBilledInvoiceToReadyToBill` ham / `sendBackInvoice{action:'revert'}`); mobile three-row header via `isMobile` (v2.987).
  - **Collections** → same unified table with `jobNoteLine={(j) => j.collections_note}`, send-backs routed to `collectionsConfirm{direction:'from'}`; empty-state paragraph.
  - **Paid in Full** → header toggle lazily runs `queueMicrotask(() => fetchPaidJobsIfNeeded(customerFilterForFetch))` on expand; count shows "Expand to load" until `paidJobsMergedForKey === jobsListDataKey`; dev/master ⚙ "Paid notifications" button (`paidEmailSettingsOpen`, v2.965); job table with `actionLabel={null}`, send-back-to-billed.
- **The problem:** each of the six call sites repeats the same **~50 pass-through props** (assigned-edit cluster, thread cluster, mutation busy-ids, man-hours maps, calendar/schedule openers, hazmat, customers…). ~780 of these lines are prop lists.
- **Extraction:** the section wiring itself **stays** (it is the tab's raison d'être), but build the **prop-bundle seam first**: one `stagesTableShared` object (or React context) matching `StagesRowRenderContext` + the table-level shared props, passed as a single prop; per-section call sites shrink to their genuinely-per-section props (`jobList`/`rows`, action labels/handlers, flags). Medium risk — mechanical but wide; do after the leaf extractions so the diff is reviewable.

### 5. Inline modals inside the IIFE (~2357–2682)

- **Total by Name modal** (`billedTotalByNameModalOpen`, opened from ⋯ menu + the `showBilledTotalByName` handle for `?showBilledTotalByName=true`): groups `billedActiveRows` by `job.job_name` into `byNameRows`, sorts entries by total desc, expandable per-name detail (`billedTotalByNameExpandedName`, reset-on-close effect) using `sortStageRowsForTotalByNameDetail`/`stageRowBilledRemainingAmount`/`stageRowBilledAgeDays`/`stageRowBilledLineLabel` (all lib); Print button (same `printBilledAwaitingPaymentReport`); "take me to Job: Stages: Billed" opens+scrolls the billed section.
- **Capable of Being Billed modal** (`capableToBillModalOpen`): `buildCapableToBillBreakdownRows(working)` (lib) table with View → `tryOpenEditJob(job.id, { initialJob, onSaved: loadJobs + refreshCustomersAfterJobFormSave })`; "take me to … Working" scroll. (Note: its `aria-label` says "Billed Awaiting Payment by Job Name" — copy/paste quirk, preserve or fix in a separate a11y PR, not during a move.)
- **Est-bill-date modal** (`whenInvoiceBillModal` + `whenInvoiceBillModalDate`, opened from the unified table's ham pencil): date input → `setInvoiceEstimatedBillDate(invoiceId, jobId, date)` (mutation-hook prop).
- **Extraction:** all three are **low risk single-opener components** → `StagesBilledTotalByNameModal.tsx`, `StagesCapableToBillModal.tsx`, `StagesEstBillDateModal.tsx` (~325 lines out). Total-by-Name's grouping is a Stage-A candidate first (below).

### 6. The modal tail (~2688–3294, rendered regardless of `active`)

Single-opener state → component pairs, all opened only from this surface:

| Opener state | Modal / element | Notes (data writes) |
|---|---|---|
| `calendarJob` | `JobCalendarModal` (extracted, v2.1056) | `onOpenSchedule` seeds `scheduleModalInitialDate`+`scheduleModalJob`; `onOpenWeekDispatch` navigates `/schedule-dispatch` via `companyWeekStartSundayContaining`/`getDefaultWeekRange` |
| `readyForBillingJob` + `Checked1`/`Checked2` | inline double-checkbox Ready-to-Bill confirm | `nudgeMissingBillingEmail` + `moveJobToReadyToBillWithStripePrep` |
| `createPartialInvoiceJob`/`Amount`/`creatingPartialInvoiceFromModal` | inline Create-partial-invoice modal | `createInvoiceFromModal`: clamp via `clampPartialInvoiceCentsToUnallocated`; full-remaining on an RTB job short-circuits into `billCustomer.openBillCustomer`; else **INSERT `jobs_ledger_invoices`** (`status:'ready_to_bill'`, `sequence_order` = invoices.length, `estimated_bill_date: null` (manual `last_bill_date` seed retired, v2.1154), `is_primary_rtb_bundle:false`) + RPC **`ensure_single_ready_to_bill_invoice_for_job`** via `withSupabaseRetry`; onBlur re-clamp; writes page-global `error` (quirk #7) |
| `paidEmailSettingsOpen` | `PaidInFullEmailSettingsModal` (extracted) | v2.965 |
| `bankPaymentsModalOpen` | `BankPaymentsModal` (extracted, always-mounted `open` prop) | fed `bankPaymentsModalBilledRows` (empty-search build); `onApplied`→`loadJobs`; also opened by the `openBankPayments` handle |
| `jobBookModalOpen` | `JobBookModal` (extracted) | |
| `combineSeparateModalOpen` | `JobsCombineSeparateModal` (extracted) | `onAfterSuccess` → `runJobsStagesSerializedPipeline(() => loadJobs())` |
| `viewBillInvoice` | `BilledBillViewModal` (extracted) | `onAfterStripeDetailsLoaded` re-runs `runFetchJobs` (retry-once on coalesced undefined) and re-merges via `findInvoiceWithJobFromJobs`; void-success → `scheduleLoadJobsAfterMutation` |
| `lienToolingPrefillModal` | `LienToolingPrefillModal` (extracted) | `senderNameFallback` = `lienToolingSenderFallback` memo over `users` |
| `lienReleaseModal` | `LienReleaseModal` (extracted, v2.2579) | in-app waiver-and-release (3 forms; kernel `lib/jobsDocuments/lienWaiverRelease.ts`); opened via `onOpenLienRelease` on the unified sections (gate = `canCreateHazmatFee` office set); `signerNameFallback` = `lienReleaseSignerFallback` memo over `users` |
| `aiaG702StagesJob` | `AiaG702G703Modal` (extracted) | |
| `hazmatFeeJob` | `HazmatFeeModal` (extracted) | `onCreated` → `loadJobs` + `loadHazmatFeeJobIds` |
| `markPaidJob` / `markPaidInvoice` | `BilledPaymentConfirmationModal` ×2 (extracted) | `stripeModeForBillingFromRole(authRole)` |
| `sendBackInvoice` + `sendBackChecked` + `sendBackInvoiceStripeExplainerAfterFailure` | inline invoice send-back/delete confirm | `stagesInvoiceSendBackConfirmLockRef` re-entry guard; delete → `deleteInvoice`; revert → `revertBilledInvoiceToReadyToBill`, on failure + `invoiceNeedsStripeVoidForRevert` shows the Stripe explainer |
| `sendBackJob` (+ shared `sendBackChecked`, `sendBackStatusEventLine`, `sendBackCollectPaymentNotice`) | inline job send-back confirm | `toStatus:'ready_to_bill'` path first runs `getAccessTokenForEdgeFunctions` + `prepareBilledInvoicesBeforeJobRevertToReadyToBill` (edge-function Stripe void prep), then `updateJobStatus` |
| `confirmJobStatusJob` | inline generic confirm — **DEAD** (parent map quirk #3: no setter call sites) | keep until the step-10 cleanup PR |
| `sendBackConfirmJob` | inline simple confirm (waiting/ready_to_bill/billed) | `updateJobStatus` |
| `collectionsConfirm` + `collectionsNoteDraft`/`collectionsSaving` | inline Collections to/from confirm | `setJobCollectionsFlag` (lib → RPC `set_job_collections_flag`); success re-applies the follow-moves focus/flash |
| `scheduleModalJob` (+ `scheduleModalInitialDate`) | `ScheduleJobModal` (extracted, keyed by job id) | assignees from `users` |
| `manageJobPeople` | `ManageJobPeopleModal` (extracted) | `onChanged` → `loadJobs` |
| `returnEditBannerJobId` | fixed "Back to Edit Job" banner (`active` only) | `tryOpenEditJob` with `initialJob` from `jobs` |

- **Extraction:** medium risk overall, low per item. The inline confirms (`readyForBillingJob`, `sendBackJob`, `sendBackInvoice`, `sendBackConfirmJob`, `collectionsConfirm`, partial-invoice) are the meat (~610 lines): each can become its own `Stages…Modal.tsx` taking its opener object + the specific mutation callbacks. `sendBackChecked` is **shared between the job and invoice send-back modals** — keep it in the tab (or give each modal its own only if resetting-on-open behavior is preserved; today both reset it at open time, so per-modal state is equivalent — verify before changing). The partial-invoice modal carries the tab's only direct supabase write; extract its decision kernel (Stage A) before the component move.

### 7. `JobsStagesTable.tsx` (644 lines — job-only sections)

- **Consumed by:** Waiting, Working, Paid in Full call sites in §4 (only caller: `JobsStagesTab`).
- **Shape:** 58 props = the 7 former `renderStagesTable` params (`jobList`, `actionLabel`, `onAction`, `showTimeOpen`, `onSendBack`, `onSendBackSimple`, `showPctComplete`) + captured page values. Gets `navigate`/`dispatchTaskModal`/`checklistAddModal` from app-global hooks; builds `stagesRowSharedCtx` from props.
- **Row anatomy:** fixed 4-column `colgroup` (9rem / flex / 12rem / 140 — the Activity column was removed in v2.1555), `tableLayout: fixed` + `STAGES_TABLE_MIN_WIDTH` (760; v2.967 anti-jitter — **preserve**); Team cell with the ham-mode assigned-edit dropdown (`updateJobTeamMembers`), `renderStagesJobHcpSubline`, `renderStagesFieldAndBillingLines`; Job cell (`renderStagesOpenDetailJobName` — still a tab-level `useCallback` prop — with `renderStagesThreadExpandButton` riding the name line, `renderJobAddressWithMap`, `renderJobCustomerLine`, `renderStagesJobColumnEstimateFooter`, then `renderStagesJobCellActivityFooter(j, stagesJobLevelStripeEmailedHintInvoice(j))`); `StagesProgressPaymentCell` fed `buildStagesMoneyBarModel` (+ `onNoBidValueClick` → `openEdit(j,{fixturesSectionHighlight:true})`, v2.1082); action column (send-backs, action button, partial-invoice/edit/detail icon row, Click Tooling / AIA / hazmat icon row); expanded `JobsStagesThreadPanel` row via `renderStagesExpandedRowPanel` (v2.1673); `renderStagesProjectBannerRow`.
- **Supabase:** none directly — everything through props/lib.
- **Extraction status + approach:** already extracted; the work is **shrinkage**: (a) consume the §4 prop bundle; (b) dedupe the **assigned-edit dropdown JSX** (~105 lines duplicated verbatim in the unified table) into a `StagesAssignedEditCell` component; (c) the quick-action icon stacks (partial-invoice/edit/detail + tooling/AIA/hazmat) are also near-duplicated across both tables — extract `StagesRowActionIcons`. Low risk each.

### 8. `JobsStagesUnifiedTable.tsx` (1,381 lines — mixed job/invoice rows)

- **Consumed by:** Ready to Bill, Billed Awaiting Payment, Collections call sites (only caller: `JobsStagesTab`).
- **Shape:** 75 props = the flattened former `renderUnifiedStagesTable(rows, options)` option keys (defaults preserved in the destructure: `jobSendBackLabel='Send back'`, `invoiceBundleActionLabel='Remove line'`, `invoiceStandaloneActionLabel='Send back'`, `flashInvoiceId=null`, `showClickTooling=true`) + the same captured values as the job table + the invoice cluster (`stagesInvoiceUpdatingId`, `invoiceEstimatedBillDateSavingId`, `bumpInvoiceEstimatedBillDate`, `setWhenInvoiceBillModal`/`setWhenInvoiceBillModalDate`).
- **Row kinds** (from `StageRow`): `job` / `job_with_merged_billed` / `job_with_primary_rtb` (bundle rows, ~369–970: job row carrying `bundleInv`, footnote variants "This bill: X paid · Y left" vs "Z remainder", merged action button with the green left border) and the standalone **invoice row** branch (~971–1374: green `Invoice:` badge, `effectiveInvoiceEstBillDate` display, ham ±1 est-bill-date buttons + pencil → `whenInvoiceBillModal`, draft footnote, View Bill, Lien Tooling with `invForLien` single-billed fallback). Both branches repeat the expanded-thread panel and project banner.
- **Supabase:** none directly.
- **Extraction status + approach:** already extracted; **the highest-value shrink target of the sub-files**. Approach: (a) prop bundle; (b) split the two `rows.map` branches into `StagesUnifiedJobRow` + `StagesUnifiedInvoiceRow` (each ~450 lines) sharing `StagesAssignedEditCell` / `StagesRowActionIcons` / an extracted `StagesExpandedThreadRow` (the `JobsStagesThreadPanel` wiring block is pasted **three times** across the two tables — identical modulo `j`/`job`). Medium risk: the branches differ in subtle flag combinations (`sendBackBelowRemaining`, `showCreatePartialInvoice`, bundle vs standalone labels) — move byte-identically, no consolidation of the flag logic in the same PR.

### 9. `jobsStagesRowShared.tsx` (1,075 lines — shared renderers)

- **Exports:** `StagesRowRenderContext` (21 fields), `STAGES_TABLE_MIN_WIDTH`, `renderStagesExpandedRowPanel`, `renderStagesTwoLineHeader`, `renderStagesJobHcpSubline`, `renderStagesThreadFullscreenJobHeader` (also used by Job Calendar / leaner Job Mode surfaces — takes the narrow `JobCalendarJobIdentity`), `renderStagesFieldAndBillingLines` (j:/b:/man-hours lines; opens `openJobCalendar`, v2.1056), `renderJobAddressWithMap`, `renderJobCustomerLine` (+ module-private pure `customerListImpliesLinkedRow`), `shouldSuppressStagesRowJobThreadToggle`, `renderStagesJobCellActivityFooter` (v2.1555 — the Activity column's survivors, rendered at the bottom of the Job cell: `renderStagesInvoiceJumpChips`, `renderStagesStripeEmailedCustomerHint` (v2.1041, wraps `StripeInvoiceSendFromStripeButton`), and the Reports button; the note/report mini-feed and the NEXT line are desktop-gone — cards keep their own zones), `renderStagesThreadExpandButton` (now rides the Job cell's name line in both tables), `stagesRowHasProjectBanner`, `renderStagesProjectBannerRow`, `renderStagesJobColumnEstimateFooter`.
- **Supabase:** none; `StripeInvoiceSendFromStripeButton` (imported component) does its own send.
- **Extraction status + approach:** this file is the intended landing zone for shared row logic — **churn magnet** (11 of the last ~30 Pipeline versions touched it). The function-returning-JSX style blocks memoization; converting the big ones (`renderStagesFieldAndBillingLines` → component) to real components is safe and unlocks `memo`. Pure kernels inside it are Stage-A candidates (below).

---

## Supabase tables + RPCs touched by this surface directly

(Everything else flows through `useJobsStagesMutations` / `useJobThreadNotes` / the extracted modals — see the parent map's Supabase section.)

| Where | Table / RPC | Verb |
|---|---|---|
| `createInvoiceFromModal` | `jobs_ledger_invoices` | INSERT; RPC `ensure_single_ready_to_bill_invoice_for_job` |
| `updateJobTeamMembers` | `jobs_ledger_team_members` | SELECT + per-id INSERT/DELETE diff |
| `loadStagesManHours` | RPC `get_man_hours_by_job` | (RLS-governed; empty for roles without labor access) |
| `loadHazmatFeeJobIds` | `job_hazmat_incidents` | SELECT (`voided_at IS NULL`) |
| `sendBackStatusEventLine` effect | `job_status_events` (+ `users(name)` join) | SELECT latest |
| `collectionsConfirm` confirm | RPC `set_job_collections_flag` via `lib/setJobCollectionsFlag` | |
| send-back to ready_to_bill | edge functions via `prepareBilledInvoicesBeforeJobRevertToReadyToBill` (`lib/voidStripeInvoiceForRevert`) | Stripe void prep |
| search effect | schedule/clock tables via `lib/jobsStagesScheduleSessionSearch` | SELECT |
| upcoming-schedule effect | via `lib/stagesUpcomingSchedule` | SELECT |

---

## Master summary table

| Region | File / anchor | Lines est. | Coupling | Risk | Status |
|---|---|---|---|---|---|
| State block + gates + loaders/effects | `JobsStagesTab` ~304–1086 | ~780 | high (substrate host) | — | stays (Stage-A kernels extractable) |
| Toolbar + ⋯ tools menu | `JobsStagesTab` ~1094–1304 | ~215 | low | low | inline → `JobsStagesToolbar` |
| Jump nav + alert chips/modals | `JobsStagesTab` ~1305–1553 | ~250 | low-med | low | inline → `JobsStagesJumpNavAndAlerts` |
| Section wiring IIFE (6 sections) | `JobsStagesTab` ~1576–2356 | ~780 (≈650 = repeated props) | highest | med | stays; **prop-bundle seam** |
| Inline modals (Total by Name / Capable / est-bill-date) | `JobsStagesTab` ~2357–2682 | ~325 | low-med | low | inline → 3 components |
| Modal tail (6 inline confirms + 13 extracted modals + banner) | `JobsStagesTab` ~2688–3294 | ~610 | med | low-med | inline confirms → per-modal components |
| Job-only table | `JobsStagesTable.tsx` | 644 (58 props) | high (prop fan-in) | low-med | extracted; shrink via bundle + `StagesAssignedEditCell` |
| Unified job/invoice table | `JobsStagesUnifiedTable.tsx` | 1,381 (75 props) | highest | med | extracted; split row-kind branches |
| Shared row renderers | `jobsStagesRowShared.tsx` | 1,075 (21-field ctx) | med | low-med | extracted; componentize big renderers, Stage-A kernels |

---

## Stage-A candidates (pure logic → `src/lib/*` + tests, before any component move)

| Candidate | Currently | Target |
|---|---|---|
| Total-by-Name grouping (`byNameRows` map + entries sort by total desc) | inline IIFE in the Total by Name modal (`JobsStagesTab` ~2358–2371) | `lib/jobs/invoiceBilling.ts` `buildBilledTotalByNameEntries(rows)` + tests (sibling of `sortStageRowsForTotalByNameDetail`) |
| Section exposure totals (`waitingTotal`/`workingTotal` = Σ `revenue − payments_made`; `billedTotal`/`collectionsTotal` = Σ `stageRowBilledRemainingAmount`) | inline reduces in the IIFE | `lib/jobsStagesBoard.ts` (join `readyToBillRowsExposureTotal`/`capableToBillTotalFromWorking`) + tests |
| Pipeline role gates (`canOpenJobScheduleModal`, `canEditJobPctComplete`, `canManageJobPeople`, `canCreateHazmatFee`, `canManageCollections`, the tools-menu role arrays, the AR-button role check ×3 copies) | memos/consts + repeated inline boolean chains | `lib/jobs/stagesRoleGates.ts` + tests — **keep the RLS-mirroring comments with each gate** |
| `accountsReceivableButtonAccessibleName` composer | `useMemo` over role/count/rows | pure `(canRecordPayments, unallocatedCount, billedRowCount) => string` + test |
| `focusStagesSection` key → element-id mapping (`stages-waiting`…`stages-billed`) | nested ternary | `stagesSectionElementId(key)` const map + test (also used by the two "take me to" modal buttons' hardcoded ids) |
| `customerListImpliesLinkedRow` (exactly-one-name-match heuristic, master_user_id preference) | module-private in `jobsStagesRowShared.tsx` | `lib/jobs/customerLinkHeuristics.ts` + tests |
| Partial-invoice decision (clamp → adjust-toast → full-remaining-RTB ⇒ Bill Customer vs INSERT path; `nextOrder`/`estBillModal` derivation) | inside `createInvoiceFromModal` | pure `planPartialInvoice(job, amount)` returning a discriminated action + tests (the IO stays in the modal) |

Already-extracted lib (do NOT re-derive; add tests only if missing): `buildJobsStagesBoardLists` + friends, `buildBilledAgingBuckets`, `stagesMoneyBar`, `stagesJobReferenceDates`, `jobsStagesScheduleSessionSearch`, `stagesUpcomingSchedule` formatters, `billedAwaitingPaymentReport` HTML builder, `returnEditJobFromStages`, `setJobCollectionsFlag`, `voidStripeInvoiceForRevert`.

---

## Preserve-quirks list (load-bearing — do not "fix" during moves)

1. **Always-mounted + `active`-gated body; modal tail unconditional** — state must survive tab switches (see Mount/state semantics). Effects key on `active`, never on URL params.
2. **`searchParams` is read-only here**; the writing router + the handle-gating rule (`!jobsListLoading` before any `stagesTabRef` call) live in `Jobs.tsx` — see parent map v2.832/v2.835 note.
3. **`bankPaymentsModalBilledRows` builds with EMPTY search** so AR always sees all billed rows incl. Collections; `JobsAccountsReceivable.tsx` carries a verbatim copy — keep the derivation in `lib/jobsStagesBoard.ts` so both stay in lockstep.
4. **Page-global `error` prop (parent quirk #7):** the partial-invoice modal both displays and writes it (`setError`); do not localize.
5. **`confirmJobStatusJob` is dead state + dead modal** (no setter call sites) — removal is a step-10 cleanup PR, not part of a move.
6. **AR button role gate is broader than the tab gate** (primaries can use it but can't reach Pipeline via the tab bar) — three copies of the same boolean chain style it; keep semantics when extracting the gate.
7. **Timers:** flash 2,600 ms; invoice scroll 200 ms; job scroll 250 ms + one 700 ms retry; return-edit banner 10 s; man-hours load delayed 80 ms; search debounce 350 ms; thread-stats debounce 320 ms. All deliberate.
8. **`STAGES_TABLE_MIN_WIDTH = 760` + `tableLayout: fixed` + the exact colgroup** (v2.967/971/984 anti-jitter + phone fixes; re-based for the 4-column layout when the Activity column was removed in v2.1555). `renderStagesExpandedRowPanel` is `position: sticky; left: 0` for phone horizontal scroll.
9. **localStorage keys:** `jobs-stages-ham-mode`, `jobs-stages-follow-moves`, `jobs-stages-search-include-schedule-time` (default ON); all try/catch-wrapped (private-mode safe).
10. **`loadStagesManHours` load-once ref resets on error** (retry next visit); `loadHazmatFeeJobIds` swallows failures by design.
11. **Paid section:** lazy `fetchPaidJobsIfNeeded` fires via `queueMicrotask` on expand AND eagerly when a search query is active; the count renders "Expand to load" until `paidJobsMergedForKey === jobsListDataKey`.
12. **`sendBackChecked` is shared** by the job and invoice send-back modals; `stagesInvoiceSendBackConfirmLockRef` guards double-confirm on the invoice path only.
13. **Send-back to `ready_to_bill` runs the Stripe void prep** (edge functions) *before* `updateJobStatus`; failure blocks the move and surfaces `prep.message` via `setError`.
14. **Bill Customer success follows the move** (`followMovedJob(id,'billed')`) only via `onSuccess`, not `onAfterEnsureSuccess`.
15. **Both tables' assigned-edit dropdown, action-icon stacks, and the `JobsStagesThreadPanel` wiring are intentional verbatim duplicates** (3× panel, 2× dropdown) from the byte-identical v2.830 move — dedupe is allowed but must be its own diff-reviewable PR.
16. **Capable-to-Bill modal's `aria-label` says "Billed Awaiting Payment by Job Name"** — pre-existing copy/paste bug; fix separately if desired, never silently inside a move.

---

## Recommended extraction order (value ÷ risk)

1. **Stage-A sweep** — the table above; each independently shippable. Highest leverage: `pickStagesLastActivity`, `buildBilledTotalByNameEntries`, `stagesRoleGates`.
2. **Toolbar → `JobsStagesToolbar`** (~215 lines, smallest prop surface; validates the intra-tab seam).
3. **Inline modals → components**: `StagesBilledTotalByNameModal`, `StagesCapableToBillModal`, `StagesEstBillDateModal`, then the modal-tail confirms (`StagesReadyForBillingConfirmModal`, `StagesSendBackJobModal`, `StagesSendBackInvoiceModal`, `StagesSendBackSimpleConfirmModal`, `StagesCollectionsConfirmModal`, `StagesCreatePartialInvoiceModal` — this last after its Stage-A kernel). ~935 lines out of `JobsStagesTab` in total.
4. **Jump nav + alerts → `JobsStagesJumpNavAndAlerts`** (~250 lines).
5. **Prop-bundle seam** — one `stagesTableShared` object (superset of `StagesRowRenderContext`) built once in `JobsStagesTab` and passed as a single prop to both tables; collapse the six ~50-prop call sites. Behavior-identical, wide diff — land alone.
6. **Row dedupe inside the tables** — `StagesAssignedEditCell`, `StagesRowActionIcons`, `StagesExpandedThreadRow`; then split `JobsStagesUnifiedTable` into `StagesUnifiedJobRow` / `StagesUnifiedInvoiceRow`; componentize `renderStagesFieldAndBillingLines` in `jobsStagesRowShared`.

**What must STAY in `JobsStagesTab`:** the imperative handle + everything it writes (`stagesSectionOpen`, both focus/flash pairs, `applyStagesInvoiceFocus`, `followMovedJob`, `openBankPayments`/`showBilledTotalByName` openers), the `stagesBoardLists` + `bankPaymentsModalBilledRows` memos, the search state/effects, the mode toggles, the section wiring, and the prop plumbing for the parent-injected engines. **What stays in `Jobs.tsx`** (unchanged from the parent map): the URL deep-link router, the jobs cache, `customers`/`users`, the `useJobsStagesMutations`/`useJobThreadNotes` call sites, and the app modal contexts (`useJobFormModal`, `useJobDetailModal`, `useBillCustomerModal`, `useDispatchTaskModal`, `useChecklistAddModal`).

Verification gates, definition of done, and anti-patterns: [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) (`npm run typecheck && npm run lint && npm test` green after every step; behavior-preserving only; one region per commit).
