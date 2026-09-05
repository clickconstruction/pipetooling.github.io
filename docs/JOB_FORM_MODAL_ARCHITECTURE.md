# Job Form Modal Architecture Map

---
file: docs/JOB_FORM_MODAL_ARCHITECTURE.md
type: Engineering / Refactor Map
purpose: Step-0 map for the JobFormModal.tsx decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md, adapted from tabs to form sections) — inventory what every section of the New/Edit Job modal touches (state, handlers, supabase tables/RPCs, sub-components, coupling) to drive the multi-PR extraction, with a deep-dive on the money-path save engine.
audience: Developers, AI Agents
last_updated: 2026-09-05
---

## Overview

> **v2.1675 — the tabbed Job window.** In edit mode the form now usually renders embedded inside [`JobWindowModal.tsx`](../src/components/jobs/JobWindowModal.tsx) as its Edit + Bill tabs: `embeddedRegion: 'edit' | 'bill'` display-toggles two contiguous region wrappers (everything stays mounted — the fixtures section moved ABOVE the Billing header to make the regions contiguous), the shell chrome/backdrop/footer-Close/header-title are skipped, and the window's ✕ routes through `closeForm` via `registerRequestClose`. New-job mode and the no-window fallback still render standalone, so this map's lifecycle/save-engine sections apply unchanged.

[`src/components/jobs/JobFormModal.tsx`](../src/components/jobs/JobFormModal.tsx) is a ~4,096-line shell — down from ~7,137 lines at v2.736 when this map was written. **Every form section is now an extracted component** (v2.1094 closed the queue); what remains inline is the lifecycle, the shared form state, the shared/tail modals, and the save engine (`createJob` + the four `persist*Slice` autosave writers) — the save-engine seam is the only remaining extraction work. It is still the **largest component in the repo that is a modal, not a page**. This map follows [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) and the dossier format of [`DASHBOARD_SECTIONS_ARCHITECTURE.md`](./DASHBOARD_SECTIONS_ARCHITECTURE.md); the billing behavior it implements (invoice lifecycle, payment channels, delete/archive) is flow-mapped in [`BILLING_FLOWS.md`](./BILLING_FLOWS.md) — this doc cross-references that one and does not restate it.

### Key structural differences from the page maps

1. **The modal is not tab-switched.** Where the playbook says "tab", read **form SECTION**: a contiguous JSX region of one scrolling `<div>` (max-width 560, `maxHeight: 90vh; overflow: auto`). Everything mounts at once; section boundaries are visual (`<hr>`, `<h4>`, bold headers), not gates.
2. **Almost all state is the form itself.** Unlike Dashboard (independent data engines per section), most state here is controlled form fields that the **save engine** (`saveJob`) reads at the end. That makes the natural seams *props-heavy controlled sections* plus a small number of self-contained data loaders (parts cost snapshot, labor, migrate search) — not per-section hooks.
3. **Two modes, one component.** `mode: 'new' | 'edit'` plus the `editing: JobWithDetails | null` state (set only in edit mode) fork nearly every section. Billing sections (break-off, Ready to Bill, Outstanding, Labor/Parts accordions, Delete) render only when `editing` is set.
4. **Remount-by-key lifecycle.** [`JobFormModalContext.tsx`](../src/contexts/JobFormModalContext.tsx) remounts the modal with a fresh `key` on every open; the giant init effect is deliberately mount-only (file-top `eslint-disable react-hooks/exhaustive-deps -- mount-only init; parent remounts via key`). Any extraction must preserve this contract.
5. **The modal is itself the parent.** Sections extract to `src/components/jobs/jobForm*/` pieces; the modal shell keeps the lifecycle, the shared form state, the save engine, and modals opened from 2+ sections.

### How to read a dossier

Each section lists: **render location** (anchored by symbol/label text — line numbers are "as of v2.736" and rot), **owned local state** (would move with the section), **shared-with-shell state** (form fields the save engine reads, or state also touched by another section — stays in the shell, passed as props+setters), **handlers**, **supabase** tables/RPCs/edge functions, **sub-components** (extracted vs inline), **coupling**, and **extraction approach** (Stage A = pure logic → `lib/*` + tests; Stage B = component move).

### How to maintain this doc

- Update the relevant dossier whenever a section is extracted or its state/handlers change; flip its Status and point at the new file.
- Line numbers are approximate anchors — search for the symbol (state name, label text, `aria-label`) when in doubt.

---

## Master summary table

Sections in JSX order inside the modal body; nested overlays and tail modals after.

| # | Section | Anchor symbol / text | Status | Owned state | Shared form state | Coupling | Risk | Recommended action |
|---|---|---|---|---|---|---|---|---|
| 0 | Shell + lifecycle | `initDone` gate, overlay div (`JOB_FORM_OVERLAY_Z_INDEX`), `closeForm` (~3067–3113) | shell | `initDone`, `editing`, `error`, `saving` | all | — | — | **Stays** — this is the parent |
| 1 | Header row | `JobFormHeaderRow` | **extracted** (v2.1094) | 1 (`hcpHelpOpen` + ref/effect, moved in) | `bidId`, `projectId`, `newJobImportBlockedByContent` as props; import/link-choice modal openers + the Job Detail close-then-bridge action stay shell callbacks | med | low | Done — [`JobFormHeaderRow.tsx`](../src/components/jobs/JobFormHeaderRow.tsx) |
| 2 | Source-estimate banner | `JobFormSourceEstimateBanner` | **extracted** (v2.1090) | 3 states + loader + acceptance modal, all inside the component | `editing?.id` (sole prop) | low | low | Done — [`JobFormSourceEstimateBanner.tsx`](../src/components/jobs/JobFormSourceEstimateBanner.tsx) |
| 3 | Identity fields | `JobFormIdentityFields` | **extracted** (v2.1091) | 2 paste refs only | `hcpNumber`, `clickNumber`, `jobName`, `jobAddress`, `formServiceTypeId`, `lastBillDate` (controlled props+setters); `jobFormServiceTypeSelectOptions` + `headerTradePill` memos stay shell-side, passed as values | med | low | Done — [`JobFormIdentityFields.tsx`](../src/components/jobs/JobFormIdentityFields.tsx) |
| 4 | People assignment | `JobFormPeoplePicker` | **extracted** (#436; redesigned as a "+" chip → Add-people modal, v2.760, which moved the search state into the component) | modal-open state | `teamMemberIds`, `users` | low | low | Done — [`JobFormPeoplePicker.tsx`](../src/components/jobs/JobFormPeoplePicker.tsx) |
| 5 | Customer block | `JobFormCustomerSection` | **extracted** (v2.1093) | 1 (`customerDropdownOpen`) | everything else stays shell (controlled props): all customer form fields incl. `customerSearch` (create/link handlers + sync effect write it), `customerExpanded` (applyEditJob gates), highlight flags + refs (effects stay shell), `customers` cache; display helpers → `lib/jobs/jobFormCustomerDisplay.ts` | **high** (DB-writing handlers stay shell callbacks) | med | Done — [`JobFormCustomerSection.tsx`](../src/components/jobs/JobFormCustomerSection.tsx) |
| 6 | Project \| Plans \| Bid links | `JobFormLinksSection` | **extracted** (v2.1092) | 7 scroll/focus refs + 3 scroll callbacks (moved in) | `projectFilesPlansExpanded` (shell — reset + modal callbacks write it), `projectId`, `customerId`, `bidId`, `linkedBidSummary`, `jobPlansLink`, `projects`; `jobFormProjectDisconnectRef` stays shell (modal onLinked focuses it) | med | med | Done — [`JobFormLinksSection.tsx`](../src/components/jobs/JobFormLinksSection.tsx); link-choice modals stay shell-level |
| 7 | Specific Work fixtures grid | `JobFormFixturesSection` | **extracted** (#435) | scope-expand + focus state inside the component | `fixtures`, `fixturesSectionHighlight` | med (fixtures → `jobTotalBidDollars` → everything billing) | med | Done — [`JobFormFixturesSection.tsx`](../src/components/jobs/JobFormFixturesSection.tsx); `riderRows` slot renders `JobFormHazmatRiderRows` (v2.1029/v2.1071-era strip → rows) + `riderFeesDollars` joins the displayed Job Total; the §17 Stripe preview is now a job-wide shell dialog (v2.1223) |
| 8 | Job Total / Remaining | Job Total footer / equation row | **absorbed** | 0 | `jobTotalBidDollars`, `getEditJobBillableRemaining()` (shell) | high (pure display of billing kernels) | low | Done — the Job Total footer renders inside `JobFormFixturesSection`; Remaining lives in §9's equation row |
| 9 | Break-off slider + RTB action | `JobFormBreakOffSection` | **extracted** (#434; split further in v2.1223 → `JobFormBreakOffTrack` + `JobFormSegmentsCreateAction`) | slider/input state via the shared `useBreakOffSlider` | `payments` (paid sum), `editing.invoices`, `jobTotalBidDollars` | **high** — MONEY-PATH (invoice insert, `update_job_status`, Bill Customer opener — handlers stay shell callbacks) | high | Done — [`JobFormBreakOffSection.tsx`](../src/components/jobs/JobFormBreakOffSection.tsx); kernels in [`lib/jobs/jobFormBreakOff.ts`](../src/lib/jobs/jobFormBreakOff.ts) |
| 10 | Ready to Bill list | `JobFormInvoiceList` | **replaced** (#430) | — | `editing.invoices`, `billCustomer` context | high (opens Bill Customer with 3 refresh callbacks; navigates to Pipeline) | med | Done — merged with §11 into the unified Invoices table [`JobFormInvoiceList.tsx`](../src/components/jobs/JobFormInvoiceList.tsx) |
| 11 | Outstanding billing table | `JobFormInvoiceList` | **extracted** (#430) | — (opens shell-owned `billViewInvoice`, `agreedWriteDownInvoice`) | `editing.invoices`, `payments` (per-invoice paid) | high (Stripe share panel, write-down, bill view — all shell/tail modals) | med | Done — unified with §10 in [`JobFormInvoiceList.tsx`](../src/components/jobs/JobFormInvoiceList.tsx); tail modals stay shell |
| 12 | Payments received table | `JobFormPaymentsTable` | **extracted** (#431) | row-detail fold state inside the component | `payments`, `editing`, `persistedLedgerPaymentIds` | **high** — MONEY-PATH (RPC removal, Mercury unlink, Stripe-locked rows — confirm state + handlers stay shell) | high | Done — [`JobFormPaymentsTable.tsx`](../src/components/jobs/JobFormPaymentsTable.tsx); lock predicates in [`lib/jobs/jobFormPaymentPredicates.ts`](../src/lib/jobs/jobFormPaymentPredicates.ts) |
| 13 | Labor Cost panel | `JobFormLaborCostPanel` | **extracted** (#433) | — | `editJobEffectiveHcp`, `editing?.id`; labor state + loader stay shell (delete gate reads them) | med (labor data also feeds delete-gate `hasMigrateableCosts`) | med | Done — [`JobFormLaborCostPanel.tsx`](../src/components/jobs/JobFormLaborCostPanel.tsx) |
| 14 | Parts Cost accordions | `JobFormPartsCostSection` | **extracted** (#432) | draft-row reveal state inside the component | `materials` (Other job charges rows), `editing`; accordion-open + snapshot state + loader stay shell (delete gate + migrate preview read them) | med (snapshot totals also feed delete gate + migrate preview) | med | Done — [`JobFormPartsCostSection.tsx`](../src/components/jobs/JobFormPartsCostSection.tsx) |
| 15 | Footer actions | Delete / Cancel / Save buttons (~6156–6221) | inline | 0 (`deletingId`, `saving` shell-owned) | `jobFormCanSubmit`, `jobFormMissingFields` | high (triggers save engine + delete flow) | low | Stays in shell (thin) |
| 16 | Payment-remove confirm | h2 "Remove payment?" | inline overlay (stayed shell when §12 extracted) | `paymentRemoveConfirmRowId`, `paymentRemoveRpcBusy` (shell) | `paymentRemovePreview`, `paymentRemoveConfirmsPersistedRpc` | — | — | Stays shell — §12 triggers it via callbacks |
| 17 | Stripe fixture preview | `stripe-fixture-line-preview-dialog` | inline overlay (stayed shell; job-wide since v2.1223) | `stripeFixturePreviewOpen` (shell) | `fixtures` | — | — | Stays shell — opened from §7's title row (`onOpenStripeFixturePreview`) |
| 18 | Mercury-unlink confirm | h2 "Unlink and remove?" | inline overlay (stayed shell when §12 extracted) | `unlinkMercuryConfirmRowId`, `unlinkingMercuryPaymentId` (shell) | `editing.status` | — | — | Stays shell — §12 triggers it via callbacks |
| 19 | Delete-job confirm | `JobFormDeleteMigrateModals` | **extracted** (#437) | (open flags in the shell) | `hasMigrateableCosts`, `costCheckErrored`, `reassignRequired`, `costSnapshotStillLoading` | high (reads §13+§14 cost data; chains into §20) | med | Done — [`JobFormDeleteMigrateModals.tsx`](../src/components/jobs/JobFormDeleteMigrateModals.tsx) |
| 20 | Migrate-and-delete modal | `JobFormDeleteMigrateModals` | **extracted** (#437; target state → `useJobMigrate` hook, incl. the v2.1166 bid-target flow) | migrate state via `useJobMigrate` | `partsCostStyleTotal`, `materialsBilledTotalForMigrate`, `editJobTeamLaborRow`, `editJobSubLaborData` | med | med | Done — [`JobFormDeleteMigrateModals.tsx`](../src/components/jobs/JobFormDeleteMigrateModals.tsx) + [`useJobMigrate.ts`](../src/components/jobs/useJobMigrate.ts) |
| 21 | Link-choice / import / create-customer modals | `JobBidLinkChoiceModal`, `JobFormImportEstimateOrBidModal`, `JobProjectLinkChoiceModal`, `JobFormCreateCustomerModal` | all 4 extracted (create-customer with §5, v2.1093) | — (modal owns the similar-search; open/busy flags shell) | `bids`, `projects`, `customerId`, prefill appliers | med | low | Done — all four are extracted components wired from the shell (openers in header + §6) |
| 22 | Tail modals | `AgreedWriteDownModal`, `BilledBillViewModal`, `CustomerAcceptanceRecordModal` (~7079–7134) | extracted components; wiring inline | `billViewInvoice`, `agreedWriteDownInvoice` (+2 memos, refetch callbacks) | `editing` refetch plumbing | opened from 2+ sections (§11 + §12) | low | **Stay in shell** per playbook (multi-section modals) |
| — | **Save engine** | `createJob` + `persistBillingSlice`/`persistIdentitySlice`/`persistMaterialsSlice`/`persistTeamSlice` | inline fns — **the remaining extraction work** | — | reads nearly every form field | **maximum** — MONEY-PATH | **highest** | See [The save engine](#the-save-engine-savejob--money-path); slice payload builders already in [`lib/jobs/jobFormAutosaveSlices.ts`](../src/lib/jobs/jobFormAutosaveSlices.ts) |

> Status legend: `inline` = rendered/defined directly in `JobFormModal.tsx`; `partial` = major children extracted but section state/JSX still inline; `extracted` = thin wrapper around an imported component.

---

## Modal lifecycle

### Open / close / remount

- **Openers:** [`JobFormModalContext.tsx`](../src/contexts/JobFormModalContext.tsx) provides `openEditJob(jobId, {initialJob?, onSaved?, billingCustomerHighlight?, fixturesSectionHighlight?, jobPicturesLinkHighlight?, alsoOpenCreateCustomerModal?})` and `openNewJob({onSaved?, onCreatedJobId?, projectId?, prefillBidId?})`. Each open bumps a module-scope `jobFormModalInstanceSeed` used as the React `key`, so **every open is a fresh mount with clean state**. ~20 call sites consume the context (`Jobs.tsx`, `Dashboard.tsx`, `Quickfill.tsx`, schedule/dispatch surfaces, `DetailJobModal`, `BankPaymentsModal`, …).
- **Init:** one mount-only `useLayoutEffect` keyed on `authUser?.id` (~1424–1553) loads, in parallel: `customers`, `projects`, `bids` (latest 800), `service_types`, and the caller's own `users` row (role + per-role `*_service_type_ids` columns), then role-filtered `users` for the People picker (dev also loads dev users). Then forks:
  - **new:** `resetNewForm(newJobProjectId)`; fire-and-forget RPC `next_job_number_suggestion` fills `clickNumber`; default service type via `pickDefaultServiceTypeId` (single → it; else "Plumbing" then "Electrical" then first), recorded in `initialNewJobServiceTypeIdRef` so the auto-pick doesn't count as dirty; a `newJobProjectId` prefill pulls the project's customer (name/address/contact/date-met).
  - **edit:** `fetchJobWithDetailsById(editJobId)` with `initialJob` as fallback; not found → toast + `onClose()`. `applyEditJob(job, billingGate, fixturesGate, picturesGate)` hydrates every form field from the row (incl. `breakOffPrefillAmountStringFromJob` seeding the break-off amount); `alsoOpenCreateCustomerModal` + a present customer name opens the create-customer modal immediately (billing flow from Pipeline).
  - Both paths end with `setInitDone(true)`; until then the render is a bare "Loading…" overlay.
- **Bid prefill timing:** a separate effect waits for `initDone && mode==='new'`, then runs `applyPrefillFromBid(newJobPrefillBidId, undefined, { closeOnCancel: true })` exactly once, guarded by `newJobPrefillBidAppliedRef` (Strict-Mode double-invoke guard) and a `bidId === pid` short-circuit. `closeOnCancel` (v2.2859) marks that this form exists only for the import: cancelling the winning-GC picker or the second-conversion confirm runs `cancelBidImport(true, …)` — info toast + the guarded close through `closeFormRef` — instead of leaving a blank New Job form open (J15-F4). From the Import modal the same cancel only toasts.
- **Close:** `closeForm()` is a **guarded async close** (v2.1077, extended v2.1079–80): it cancels every autosave debounce and, if any slice needs flushing / a write is in flight / close-time side effects apply, flushes all four slices (`useJobFormAutosaveSlice.flushForClose` over the `jobFormCloseFlush` kernel) **then runs `runEditCloseSideEffects`** (the `customers.date_met` backfill + the paid→billed demote via `shouldDemotePaidJobToBilled` — these rode the Save button until v2.1080 and now run on every edit-mode close, gated by `editCloseSideEffectsNeeded()`), all under one 15s `withOperationTimeout`. On failure it keeps the modal open with Retry / Keep editing / Close-without-saving (`closeFlushState`). Callers that navigate after closing (trade pill → Pipeline, Job Detail bridge) await the returned boolean. Delete and migrate+delete use `closeFormWithoutSaving()` — the job row is gone, flushing would reinsert children. A `visibilitychange → hidden` listener flushes all slices. A dirty-but-invalid identity slice (required field blank) is deliberately skipped on close — an invalid state never persists. **Escape** (v2.1100) also routes through `closeForm()` via a window listener gated by `escCloseBlocked` — the OR of every nested-overlay shell flag plus `bannerOverlayOpen` (reported by `JobFormSourceEstimateBanner.onOverlayOpenChange`, since the acceptance-record modal is child-owned) — so Esc never closes the form under a stacked modal; the listener calls through `closeFormRef` to stay on the current render's closure.
- **onSaved / onCreatedJobId:** stored in refs (`onSavedRef`, `onCreatedJobIdRef`) so stale closures can't fire; `onSaved` fires after save, after several in-modal DB writes (immediate customer link, payment removal, invoice creation, status moves), and after delete/migrate.

### Dirty tracking (Import gating only)

`newJobFormHasBlockingContent` (module-scope, ~190) computes "the New Job sheet has user-visible content" from 19 fields + row arrays (rows count via `materialRowHasUserContent` / `fixtureRowHasUserContent` / `paymentRowHasUserContent`; a service-type change counts only when it differs from the auto-picked `initialNewJobServiceTypeId`). The memo `newJobImportBlockedByContent` hides the header **Import** button and an effect force-closes the import modal if content appears while it's open. This is the modal's **only** dirty tracking — it gates Import overwrites, not close.

### Prefill appliers

- **`applyPrefillFromBid(bidRowId, forcedGc?, opts?)`**: fetches the bid + embedded customer; **on the first pass (no `forcedGc`) checks `jobs_ledger` for jobs already carrying this `bid_id`** and, if any, asks through `useConfirmDialog` ("A job already exists from this bid" → *Create another job* / *Cancel*; message from `secondConversionMessage`, v2.2859) — Cancel is a `cancelBidImport`; then the winning-GC resolution (silent single winner, else `PickWinningGcModal`, which carries `closeOnCancel` from `opts`); sets `bidId`, `jobName`, `jobAddress`, `linkedBidSummary`, prepends the bid to `bids` if absent; applies the bid's service type only when the caller's role-filtered list allows it (else info toast); applies bid customer (from local `customers` cache first, else the embedded row); fills `googleDriveLink`/`jobPlansLink` **only if currently blank**. Used by the Import modal (`onSelectBid`), `openNewJob({prefillBidId})` (every Won-moment button — `BidWonJobActions`), and the picker's re-entry (`handleWinningGcPick` → `forcedGc`).
- **After `createJob` inserts (v2.2859):** `recordNavClick(user, role, 'job_created', jobCreatedTelemetryTarget({ bidId, projectId }))` (`ui_nav_clicks`, target `source:bid:<id>` / `source:project` / `source:blank` — the job's birth is unloggable in `job_activity_events` without a migration) and, when `bidId` is set, `window.dispatchEvent(JOB_CREATED_FROM_BID_EVENT, { bidId, jobId })` so bid surfaces (`useJobsOpenedFromBid`, the board's `jobsByBidId` index) refetch.
- **`applyPrefillFromEstimate(estimateId)`** (~1331): fetches the estimate; refuses if `job_ledger_id` already set ("already linked to a job"); **clears** any bid link; sets name/address; converts `line_items_snapshot` → fixtures via `normalizeEstimateLineItemsFromJson` + `fixturesPayloadForCreateJobFromEstimate` (both already in `lib/`); applies the estimate's customer (fetching the row if not cached, tolerating archived), else just `customer_email`.
- Neither applier touches payments/materials, and neither marks anything saved — prefill is form-state only until Save.

### Highlight gates (deep-link affordances)

Three boolean gates arrive as props and scroll/flash their targets: `billingCustomerHighlight` (red "Link a customer before sending this invoice." box; cleared automatically once `customerId` is set), `fixturesSectionHighlight` and `jobPicturesLinkHighlight` (blue flash, auto-clear after 2.5s; pictures also focuses+selects the input). `applyEditJob` also force-expands the customer block when the pictures or billing gate demands it.

---

## Module-scope pure logic (Stage-A inventory)

**The Stage-A wave has landed** — everything below lives in tested `src/lib/jobs/` files (note the filenames differ from the ones this map originally proposed). The autosave restructure added its own kernel family alongside: [`jobFormAutosaveSlices.ts`](../src/lib/jobs/jobFormAutosaveSlices.ts), [`jobFormCloseFlush.ts`](../src/lib/jobs/jobFormCloseFlush.ts), [`jobFormUndo.ts`](../src/lib/jobs/jobFormUndo.ts), [`jobFormFixtureLinks.ts`](../src/lib/jobs/jobFormFixtureLinks.ts), [`jobFormReorder.ts`](../src/lib/jobs/jobFormReorder.ts), [`jobFormCustomerDisplay.ts`](../src/lib/jobs/jobFormCustomerDisplay.ts), [`jobFormBidLinkTitle.ts`](../src/lib/jobs/jobFormBidLinkTitle.ts) — and the autosave hook is [`src/components/jobs/useJobFormAutosaveSlice.ts`](../src/components/jobs/useJobFormAutosaveSlice.ts) (component-side, NOT `src/hooks/`).

| Landed lib file | Functions / constants | Notes |
|---|---|---|
| [`src/lib/jobs/jobFormBreakOff.ts`](../src/lib/jobs/jobFormBreakOff.ts) | `unallocatedBillableDollars`, `breakDollarsFromCombinedPct`, `snapBreakOffCombinedPctToStep`, `breakOffPrefillAmountStringFromJob`, `BREAK_OFF_COMBINED_SLIDER_STEP_PCT` | **Money-path kernels** — the slider/prefill math documented in [BILLING_FLOWS § Break-off](./BILLING_FLOWS.md#invoices-jobs_ledger_invoices). The repo had 5 copies of the "unallocated" kernel (BILLING_FLOWS optimization candidate #3); this extraction was verbatim, not a consolidation. |
| [`src/lib/jobs/jobFormRows.ts`](../src/lib/jobs/jobFormRows.ts) (proposed as `jobFormRowContent.ts`) | `materialRowHasUserContent`, `fixtureRowHasUserContent`, `paymentRowHasUserContent`, `newJobFormHasBlockingContent`, `normalizeFixtureDisplayName`, `newEmptyPaymentRow`, `paymentRowsFromJob` | The dirty-gate + row hydration kernels; row types live in [`jobFormTypes.ts`](../src/lib/jobs/jobFormTypes.ts). |
| [`src/lib/jobs/jobFormPaymentPredicates.ts`](../src/lib/jobs/jobFormPaymentPredicates.ts) (proposed as `jobFormPaymentLocks.ts`) | `mercuryLinkedPaymentRow`, `paymentRowLinkedToInvoice`, `jobsLedgerInvoiceIsStripeLinked`, `stripeBillInvoiceForPaymentRow`, `mercuryUnlinkBlockedByStripeHostedInvoice`, `canRemovePaymentRowFromForm`, `canUnlinkMercuryPayment` | The Stripe/Mercury row-lock predicate family — used by the payments table, `updatePaymentRow` immutability enforcement, removal confirms, and the diff-based persist's "locked rows ride along". |
| [`src/lib/jobs/jobFormServiceTypes.ts`](../src/lib/jobs/jobFormServiceTypes.ts) | `visibleServiceTypesForJobForm`, `pickDefaultServiceTypeId` | Role-filtered trade visibility (estimator/primary/superintendent/field-role id lists) + default pick. |
| [`src/lib/jobs/jobFormMoney.ts`](../src/lib/jobs/jobFormMoney.ts) (proposed as `moneyInputTyping.ts`) | `parseMoneyInputToNumber`, `parseMoneyInputToNumberOrNull`, `sanitizeMoneyTyping`, `formatCurrency`, `formatPaymentDateForDisplay` | Generic input parsing/format helpers. |
| [`src/lib/jobs/jobFormAutosaveSlices.ts`](../src/lib/jobs/jobFormAutosaveSlices.ts) (superseded the proposed `jobFormSave.ts`) | per-slice payload builders + slice JSON snapshots for the four edit-mode autosave writers; payment diffing in [`paymentRowsDiff.ts`](../src/lib/jobs/paymentRowsDiff.ts) | See [save engine](#the-save-engine-savejob--money-path). The write *sequence* (`createJob` + the `persist*Slice` functions) is still in the shell — the last extraction target. |
| stays put | `ReadOnlyPaymentRefCopy` (tiny component), remaining style constants, z-index ladder | Move with their consuming sections in Stage B. `formatJobFormBidLinkTitle` → `lib/jobs/jobFormBidLinkTitle.ts` (v2.1092, two consumers); `ClipboardPasteGlyph` + `pasteTextToField` moved into `JobFormIdentityFields` (v2.1091). |

Already-in-`lib/` kernels this file consumes (do not duplicate): `revenueDollarsFromFixtures`, `resolveCustomerIdForJobPayload` (tested), `resolveEditJobMasterUserId` (tested), `resolveEffectiveJobMasterUserId`, `filterActiveCustomersForPicker` (tested, v2.736), `jobLedgerHasCustomerForBilling`, `stripeInvoiceLineDescription` helpers (tested), `fetchJobMaterialsCostSnapshot`, `fetchJobWithDetailsById`, `prepareBilledInvoicesBeforeJobRevertToReadyToBill`, `normalizeJobsLedgerStatus`, `createJobFromEstimateSubmit` / `estimateLineItemNormalize`.

### Job-stages billing additions (v2.1067–v2.1071)

The ①/② billing area gained the job-stages family; all money math is in tested `src/lib/jobs/` kernels, the components are render-only:

- **`jobFormReorder.ts`** `moveRowById` — ▲▼ re-order in ① (v2.1067) and in the generator modal; `sequence_order` persistence already existed.
- **`jobs_ledger_fixtures.invoice_id`** (migration `20260729002615`, v2.1068) — fixture-side FK to the billing invoice, ON DELETE SET NULL. `FixtureRow.invoice_id` rides BOTH fixture write paths (billing autosave + `saveJob`) through the delete+reinsert, and the autosave change-slice includes it (v2.1069). **Any future save-engine refactor must preserve this carry-through.**
- **`jobFormFixtureLinks.ts`** — linked-row lock predicate + lifecycle chip; linked rows disable name/count/price/scope and hide remove in `JobFormFixturesSection`.
- **`jobSegmentsCoverage.ts`** + **`JobFormSegmentsBar`** (v2.1070) — the ② Invoices 100%-strip and the create-invoice-from-selected-segments flow (`createInvoiceFromSelectedSegments` in the shell: flush autosave → insert invoice → link by `sequence_order` positions → mirror links into local fixtures state → RTB remainder resync → refetch). Selection state (`selectedSegmentIds`) clears on hydrate/reset/import.
- **`segmentGenerator.ts`** + **`MultipleSegmentGeneratorModal`** (v2.1071) — %-split generator with Commercial 30/30/30/10 and Residential 40/40/20 presets; "Add to Job" appends `FixtureRow`s via `addGeneratedSegmentsToJob`.

### Billing-area compaction + segment net billing (v2.1223)

- **`segmentSelectionNetSummary`** (`jobSegmentsCoverage.ts`, tested) — "Create invoice from remaining on selected segments": the create flow bills the selection NET of the v2.1132 dollar-coverage waterfall. Consumers: the shell's `createInvoiceFromSelectedSegments` (invoice `amount`), `toggleSegmentSelected` (slider sync), and the button/summary UI. The exceeds-Remaining check survives as a stale-state backstop only.
- **`JobFormSegmentsBar` split three ways**: the bar itself (legend row now carries the $0/$total axis anchors via `axisTotalDollars`; new `trackSlot` renders between the strip and the per-segment rows), `JobFormBreakOffTrack` (the draggable track, rendered in `trackSlot`; tip-anchored thumb, no edge clamp), and `JobFormSegmentsCreateAction` (the create button + helper text, rendered by the shell BELOW `JobFormBreakOffSection`'s equation row). All share the shell's single `useBreakOffSlider` instance.
- **§7 fixtures compaction** (`JobFormFixturesSection`): count/unit-price are in-border `[× n]`/`[$ amount]` input groups; the per-row secondary line is gone — the scope pencil lives inside the name field's border (opens/closes-empty/focuses-nonempty), and the Stripe char counter renders only within 100 of the limit. **Stripe preview is job-wide**: one title-row trigger opens the §17 dialog listing every named line's Stripe description (`stripeFixturePreviewOpen` boolean replaced `stripeFixturePreviewRowId`; section prop `onOpenStripeFixturePreview`).
- **§12 payments compaction** (`JobFormPaymentsTable`): explainer behind an ⓘ toggle; Date/Paid `<thead>` removed ($-prefix amount group); Type/Ref/Memo + Applies-to fold to a one-line summary per row (`detailsOpenById`; unsaved manual rows auto-expand — `persistedLedgerPaymentIds` only changes on refetch, so rows never fold mid-typing); locked rows compact to one wrapping line keeping `ReadOnlyPaymentRefCopy`. Lock predicates and the last-unlocked `+` placement unchanged.

---

## The save engine — MONEY-PATH

> **v2.1078–v2.1080 restructure:** the edit branch of the old `saveJob` is GONE. Edit-mode writes now flow through four `useJobFormAutosaveSlice` instances (billing / identity / materials / team — payload builders + slice JSONs in [`jobFormAutosaveSlices.ts`](../src/lib/jobs/jobFormAutosaveSlices.ts)), each debounced ~1.2s with a hydrate-commit baseline, flushed by the close guard. `createJob` keeps the create-only path (New Job button). The paid→billed demote and `customers.date_met` backfill run at close time (`runEditCloseSideEffects`). The historical description below still documents the WRITE SHAPES (delete+reinsert per slice, unchecked child inserts in `createJob`, `payments_made` overwrite) — those are unchanged, just re-homed.

**Anchor:** `async function createJob()` + `persistBillingSlice`/`persistIdentitySlice`/`persistMaterialsSlice`/`persistTeamSlice`. This remains the highest-risk area of the file: these are the only writers of the job's child-row tables from this surface, they overwrite `payments_made`, and the close guard can demote a job's billing status. Flagged in [BILLING_FLOWS](./BILLING_FLOWS.md) as payment-insert path **E** and optimization candidates **#9/#10**. **The map documents; it does not fix.**

### Preconditions

`authUser?.id` present; `formServiceTypeId` non-empty (toast + bail). The Save button additionally gates on `jobFormCanSubmit` (Job Name + Job Address + Service type non-empty). Computed up front: `revNum = jobTotalWithRidersDollars` (= `revenueDollarsFromFixtures(fixtures)` + `sumHazmatRiderFees(hazmatIncidents)` — v2.1029; previously fixtures-only, which silently wiped hazmat revenue bumps on save; the billing autosave mirrors this via `autosaveRiderFeesRef`), `paymentsMadeNum` = sum of ALL payment rows, `validPayments` = rows with `amount > 0`, `validMaterials` = rows with description or non-zero amount.

### Edit branch — full write sequence, in order

1. **Resolve owner + customer:** `masterUserIdForUpdate = resolveEditJobMasterUserId({projectId, projectMasterUserId, existingJobMasterUserId})` — editing preserves the job's owner or follows the linked project's owner; it deliberately does **not** re-derive from `job_owner_override` (in-code comment: that steers NEW jobs only; re-deriving would silently re-own the job and break the customer↔master invariant). `resolvedCustomerId = resolveCustomerIdForJobPayload(customerId, masterUserIdForUpdate, customerName, customers)`.
2. **`UPDATE jobs_ledger`** with the full payload: hcp/click numbers, name, address, customer id/name/email/phone, three links, **`revenue: revNum`**, **`payments_made: paymentsMadeNum` (overwrite — one of three writers of this column, no DB invariant)**, `project_id`, `bid_id`, `service_type_id`, `master_user_id`. Error checked → throw.
3. **Dispatch-request auto-close:** if `job_pictures_link` transitioned blank→set, `UPDATE dispatch_requests SET status='closed', …` for `pending_action='link_job_pictures'` open rows on this job + `notifyDispatchRequestsChanged()` (failure only `console.warn`s).
4. **Payments — delete + reinsert:** `DELETE FROM jobs_ledger_payments WHERE job_id = …` then a sequential `for` loop of single-row `INSERT`s of `validPayments` (form order = `sequence_order`), carrying `invoice_id` and `mercury_transaction_id` along. **Locked Stripe/Mercury rows are deleted and re-inserted with new client UUIDs on every save** (id churn; paired activity/archive events per row per save). **Neither the delete's nor any insert's error is checked** — a mid-loop failure silently drops rows while `payments_made` (step 2) already reflects the full form sum (the desync risk called out in BILLING_FLOWS #9).
5. **Materials — delete + reinsert:** same pattern for `jobs_ledger_materials` (`description`, `amount`, `sequence_order`). Errors unchecked.
6. **Fixtures — delete + reinsert:** same pattern for `jobs_ledger_fixtures`; rows filtered to `normalizeFixtureDisplayName(name) !== ''` (**a row with only scope notes is silently dropped** — quirk #4); `line_unit_price` written only when `> 0` else `null`; `line_description` trimmed-or-null. Errors unchecked.
7. **Team members — diff, not delete+reinsert:** reads existing `jobs_ledger_team_members`, inserts missing ids, deletes removed ids one-by-one. (The one child table treated incrementally.) Errors unchecked.
8. **Paid→Billed demote:** if `normalizeJobsLedgerStatus(editing.status) === 'paid'` and `revNum > paymentsMadeNum + 0.01`, RPC **`update_job_status(p_job_id, 'billed')`** with toast on success/failure (job saved either way).

### New branch

1. `effectiveMasterId = await resolveEffectiveJobMasterUserId(supabase, authUser.id, projectId)` (assistant→master adoption / `job_owner_override`), then `resolveCustomerIdForJobPayload` against it.
2. **`INSERT jobs_ledger … select('id').single()`** (same payload minus `master_user_id` derivation differences). Error checked → throw.
3. Sequential inserts of `validPayments`, `validMaterials`, valid fixtures, and every `teamMemberIds` row (all unchecked), then **`onCreatedJobIdRef.current?.(jobId)`**.

### Both branches, tail

If `customerId && dateMet` and the cached customer row lacks `date_met`: `UPDATE customers SET date_met`. Then `closeForm()` + `onSaved`. Catch → `setError(formatPostgrestOrUnknownError(...))` (modal stays open); finally `setSaving(false)`.

### Recommended seam (documented, not done)

- **Stage A:** extract pure payload builders + row filters + the team diff into `src/lib/jobFormSave.ts` with tests (see table above). This pins today's exact field trims/null coercions before anything moves.
- **Stage B:** move the sequence into a `useJobFormSave` hook (or `lib/jobFormSaveRunner.ts` taking `supabase`) that the shell calls — **same order, same unchecked errors, same non-transactionality**, with a `// TODO(billing): make transactional server-side (RPC) — see BILLING_FLOWS optimization candidates #9/#10` note at the seam. Candidates for a later, separate behavioral PR (NOT the decomposition): a `save_job_form` RPC wrapping steps 2–8 in one transaction, or at minimum error-checking the child-row writes.

---

## Per-section dossiers

### 0. Shell + lifecycle

- **Render location:** `if (!initDone) return <Loading overlay>` (~3067); main overlay div at `JOB_FORM_OVERLAY_Z_INDEX` (1010 — above Job Detail's 1004 so Edit Job can stack on it) with backdrop-click close (~3088–3111).
- **Owned state:** `initDone`, `editing`, `error`, `saving`, `deletingId`, plus the context props and `onSavedRef`/`onCreatedJobIdRef`.
- **Stays in the shell permanently:** init effect, prefill-timing effect, `closeForm`, `applyEditJob`, `resetNewForm`, `saveJob` (until its own seam), the z-index ladder (`JOB_FORM_OVERLAY_Z_INDEX` 1010 → `NESTED` 1011 → `MIGRATE` 1012 → `IMPORT_SOURCE` 1013; `BILL_VIEW` also 1012 — quirk #11), the reference-data caches (`customers`, `projects`, `bids`, `serviceTypes`, `users`, `meServiceTypeColumns`), and context wiring (`useAuth`, `useToastContext`, `useLedgerPrefixMap`, `useBillCustomerModal`, `useJobDetailOpenerBridge`, `useNewProjectModal`, `useMercuryLedgerNicknames`, `useNavigate`).

### 1. Header row

- **Status: extracted (v2.1094)** → [`JobFormHeaderRow.tsx`](../src/components/jobs/JobFormHeaderRow.tsx). Title, the HCP/C# "i" help popover (`hcpHelpOpen` + ref + outside-click/Esc effect moved in), the center **Import** (new mode, until the dirty gate blocks it) / **Job Detail** (edit) button, and the "Link to: **Bid** | **Project**" quick links.
- **Stays shell-side:** the import + link-choice modals and their open flags (row receives `onOpenImport`/`onOpenBidLinkChoice`/`onOpenProjectLinkChoice` callbacks); the Job Detail action (`closeForm()` flush → `jobDetailOpenerBridge.requestOpenJobDetail`) as `onJobDetailClick`; `newJobImportBlockedByContent` (the dirty gate) passed as `importBlocked`.
- **Coupling (unchanged):** duplicates §6's link/unlink affordances; the Import gate is the dirty-tracking consumer.

### 2. Source-estimate banner

- **Status: extracted (v2.1090)** → [`JobFormSourceEstimateBanner.tsx`](../src/components/jobs/JobFormSourceEstimateBanner.tsx). Sole prop `jobId` (= `editing?.id ?? null`); the component owns `sourceEstimateForJob`/`sourceEstimateLoading`/`contractModalEstimateId`, the `estimates.job_ledger_id` loader, and the `CustomerAcceptanceRecordModal` render. The shell's `error` paragraph below the banner stays shell-owned. `finishClose`/`resetNewForm` no longer reset this state — it dies with the component (remount-by-key) and self-clears when `jobId` is null.
- **Stacking fix shipped with the move:** as a shell-tail sibling of the overlay, the acceptance modal's hardcoded `zIndex: 80` lost to the form's 1010 root-level backdrop, so "View contract &amp; acceptance" opened it invisibly BEHIND the form. It now renders inside the overlay's stacking context, where 80 resolves locally and the record stacks above the form.

### 3. Identity fields

- **Status: extracted (v2.1091)** → [`JobFormIdentityFields.tsx`](../src/components/jobs/JobFormIdentityFields.tsx). Fully controlled: the six identity fields arrive as props+setters (all save-engine / identity-autosave-slice inputs — `hcpNumber` also drives §13 Sub Labor via `editJobEffectiveHcp`; `clickNumber` still gets the async RPC suggestion in the shell). The paste affordances (`ClipboardPasteGlyph`, `pasteTextToField`, the two `JOB_FIELD_*` style consts, both input refs) moved into the component — they had no other consumers.
- **Stays shell-side:** the `jobFormServiceTypeSelectOptions` memo (role filtering + edit-mode current-type injection needs the `serviceTypes`/role caches) and the `headerTradePill` memo, both passed down as computed values; the pill's click action is an `onTradePillClick` shell callback (`closeForm()` flush → navigate to Jobs → Pipeline). The pill renders on `tradePill` alone — the memo is already null when not editing, so the old `headerTradePill && editing` gate is preserved by construction.

### 4. People assignment — extracted (#436)

> **Status:** → [`JobFormPeoplePicker.tsx`](../src/components/jobs/JobFormPeoplePicker.tsx). Extracted with the shell keeping the search/dropdown state; then redesigned in v2.760 — the always-visible "Add People..." search input became a **"+" chip → Add-people modal** (`SearchableMultiSelect` roster), and the component now owns its modal-open state (the shell's search/dropdown state and reset plumbing were deleted). Selections stay form-state only until the team slice persists.

- **Shared:** `teamMemberIds` (team-slice input), `users` (shell cache).

### 5. Customer block — extracted (v2.1093)

> **Status:** → [`JobFormCustomerSection.tsx`](../src/components/jobs/JobFormCustomerSection.tsx) + [`JobFormCreateCustomerModal.tsx`](../src/components/jobs/JobFormCreateCustomerModal.tsx); display helpers (`getCustomerDisplay`, `extractContactFromCustomer`, `customerTypeShortLabel`, `customerListImpliesLinkedRow`) → tested [`lib/jobs/jobFormCustomerDisplay.ts`](../src/lib/jobs/jobFormCustomerDisplay.ts) (shell handlers + the customerId sync effect still consume the first two). The section owns only `customerDropdownOpen`. **Stays shell:** every customer form field as controlled props (`customerSearch` included — the create/link-similar handlers and the sync effect write it), `customerExpanded` (applyEditJob gates force-expand), the highlight flags/refs/effects, `handleCustomerImport`, and both immediate-DB-write handlers (`handleCreateCustomerFromJob`, `handleLinkToSimilarCustomer` — quirk #18 unchanged). The modal component is always-mounted (gating on `open` internally) so its type toggle + match list survive close/reopen exactly as when the state lived in the shell; it owns the similar-customers search effect; `createCustomerFromJobModalOpen` and `creatingCustomerFromJob` stay shell (init's `alsoOpenCreateCustomerModal` opens it; the create handler drives the busy flag). The dossier below describes the pre-extraction inline layout for reference.

- **Render location:** collapsible "Customer: <name>" header with "Not in Customers" amber chip (`customerListImpliesLinkedRow` heuristic: unique name match, master-scoped first) + clipboard **Import** (`handleCustomerImport` → `parseCustomerImport`); body = Link-to-customer search (billing-highlight wrapper), Create-customer / Clear-link buttons, Customer Name/Phone/Email, Date Met (locked when the linked customer already has one), Customer Files (`googleDriveLink`), Customer Pictures (`jobPicturesLink`, highlight + focus target) (~3667–3988).
- **Owned state:** `customerSearch`, `customerDropdownOpen`; the highlight scroll/clear effects (~1841–1890).
- **Shared:** `customerId/Name/Email/Phone`, `dateMet`, `googleDriveLink`, `jobPicturesLink`, `customers` cache, `customerExpanded` (also set by `applyEditJob` gates), `billingCustomerHighlight`/`jobPicturesLinkHighlight`, `customersLoading`.
- **Handlers:** picker `onClick` fills id+name+contact+dateMet and job address if blank; typing that no longer matches the selected display clears `customerId`; a sync effect (~1892) rewrites `customerSearch`/`dateMet` whenever `customerId` resolves against the cache.
- **Archived customers (v2.736):** the dropdown filters through `filterActiveCustomersForPicker(customers, customerId)` — archived rows are excluded from linking **except** the currently-linked row (`keepId`) so an existing link stays editable (in-code comment at ~3815).
- **Supabase:** none directly in the section (cache from init); but see §21 — `handleCreateCustomerFromJob` / `handleLinkToSimilarCustomer` **write `customers` and `jobs_ledger.customer_id` immediately in edit mode** (before Save), then refetch `editing` + fire `onSaved` (quirk #18/#19).
- **Extraction:** `JobFormCustomerSection` after Stage A; the create-customer modal (§21) and its two handlers move with it. **Medium risk** — prefill appliers and §6's project-implies-customer also write these fields (they stay shell-side; section receives setters).

### 6. Project | Plans | Bid links

- **Status: extracted (v2.1092)** → [`JobFormLinksSection.tsx`](../src/components/jobs/JobFormLinksSection.tsx). The jump-link row, expanded panel (Project select-or-disconnect, Job Plans URL, Bid link-or-disconnect + cover letter), 7 scroll/focus refs, the three scroll callbacks, and the `projectFilesPlans*` style consts all moved in; the component reads `useToastContext`/`useLedgerPrefixMap` itself.
- **Stays shell-side:** `projectFilesPlansExpanded` (prop + setter — `resetNewForm` and both link-choice modal `onLinked` callbacks also write it); `jobFormProjectDisconnectRef` (prop — `JobProjectLinkChoiceModal.onLinked` focuses it after linking); the two link-choice modals (opened from §1's header too); all form state as controlled props (`projectId`/`customerId` — select implies customer when unset, `bidId`+`linkedBidSummary`, `jobPlansLink`, `projects`).
- **Stage A rode along:** `formatJobFormBidLinkTitle` + the `JobFormLinkedBidSummary` type moved to [`lib/jobs/jobFormBidLinkTitle.ts`](../src/lib/jobs/jobFormBidLinkTitle.ts) with tests — it has a second consumer (the shell's bid-summary backfill effect), so it could not move into the component.
- **Coupling (unchanged):** disconnects are staged ("Save the job to apply" toasts) — contrast quirk #19; `JobProjectLinkChoiceModal`'s "create new" opens the app-level `newProjectModal`.

### 7. Specific Work fixtures grid — extracted (#435)

> **Status:** → [`JobFormFixturesSection.tsx`](../src/components/jobs/JobFormFixturesSection.tsx) (now the "① Line Items" table). Heavily reworked since extraction: in-border `[× n]`/`[$ amount]` input groups, in-border scope pencil, narrow-viewport focus expansion (v2.1223/v2.1229/v2.1230), the `riderRows` slot rendering `JobFormHazmatRiderRows`, and the fee-inclusive Job Total footer (absorbing §8's Job Total display). The **§17 Stripe preview dialog stayed shell-side** — it became job-wide (v2.1223): the section gets `onOpenStripeFixturePreview` and the shell owns `stripeFixturePreviewOpen` + the dialog.

- **Shared:** `fixtures` (drives `jobTotalBidDollars = revenueDollarsFromFixtures(fixtures)` — the number every billing computation hangs off, plus `riderFeesDollars`), `fixturesSectionHighlight`.
- **Stage A:** `stripeInvoiceLineDescription`, `revenueFromJobFixtures` were already in `lib/`; `normalizeFixtureDisplayName`/`fixtureRowHasUserContent` landed in [`jobFormRows.ts`](../src/lib/jobs/jobFormRows.ts).

### 8. Job Total / Remaining — absorbed

> **Status:** no longer a standalone section. The Job Total renders as `JobFormFixturesSection`'s footer (fee-inclusive breakdown, v2.1029); the Remaining figure lives in §9's Paid + Billed + New Invoice → Left to bill equation row.

- **Note:** `getEditJobBillableRemaining()` = `unallocatedBillableDollars(jobTotalBidDollars, paidSum, editing?.invoices)` stays in the shell — in NEW mode `editing` is null so Remaining = total − payments.

### 9. Break-off slider + Ready-to-Bill action (edit only) — extracted (#434)

> **Status:** → [`JobFormBreakOffSection.tsx`](../src/components/jobs/JobFormBreakOffSection.tsx), since split further (v2.1223): the draggable track is `JobFormBreakOffTrack` (rendered in `JobFormSegmentsBar`'s `trackSlot`) and the create action is `JobFormSegmentsCreateAction`; all three share the shell's single [`useBreakOffSlider`](../src/components/jobs/useBreakOffSlider.ts) instance, which absorbed the slider state/refs/memos below. The money-path handlers (`createInvoice`, `moveWorkingJobToReadyToBillFromEdit`) **stay shell-side** as callbacks; kernels are in [`lib/jobs/jobFormBreakOff.ts`](../src/lib/jobs/jobFormBreakOff.ts). The pre-extraction description below is kept for reference.

- **Render location:** `editing && …` block (~4656–5040; note the redundant nested `editing ? …` — quirk #16): label toggles "Send to Ready to Bill:" vs "Break off Invoice:" (`isSendFullUnallocatedToReadyToBill` — amount matches full remaining on a `working` job), amount input (display formats when unfocused; blur clamps to remaining then snaps to the 5% grid), action button (`moveWorkingJobToReadyToBillFromEdit` or `createInvoice`), "% of job total" hint, then the custom pointer-driven track: paid fill, break preview fill, 5%-tick rails, yellow field-progress dot (`pct_complete`), green triangle thumb (`role="slider"` + arrow/Home/End keys), 20/40/60/80% labels, legend.
- **Owned state:** `newInvoiceAmount`, `newInvoiceAmountInputFocused`, `breakOffSliderDragCombinedPct`, `creatingInvoice`, `movingJobToReadyToBill`; refs `billingBreakOffTrackRef`, `breakOffSliderPointerActiveRef`, `breakOffSliderLastDragCombinedRef`, `breakOffSliderLastPointerXRef`; memos `isSendFullUnallocatedToReadyToBill`, `breakOffBillingTrackPercents`, `jobCompleteTrackPct`, `breakOffPaidSum`, `breakOffRemaining`, `breakOffCombinedSliderBounds`, `breakOffDraftCoveragePctDisplay`, `breakOffCombinedHandlePct`, `breakOffCombinedThumbLeftPct`; callbacks `seedBreakOffSliderFromPointerX`, `endBreakOffSliderPointerGesture`, the four pointer handlers, `onBreakOffSliderKeyDown`. Drag moves by **relative pointer delta**, not absolute position (quirk #23).
- **Shared:** `payments` (paid sum), `editing` (+`invoices`, `status`, `pct_complete`), `jobTotalBidDollars`, `error` setter; `newInvoiceAmount` is (re)seeded by `applyEditJob`/refetches via `breakOffPrefillAmountStringFromJob` (80% target, 95% when paid > 80%).
- **Money-path handlers:**
  - `createInvoice()` (~2309): clamps to unallocated remaining (toast "Adjusted to remaining unallocated"); zero remaining rejects; **full-remainder on an RTB job opens Bill Customer instead** (customer-link precheck; three refresh callbacks); else `INSERT jobs_ledger_invoices {status:'ready_to_bill', sequence_order: invoices.length, estimated_bill_date: null (manual seed retired, v2.1154), is_primary_rtb_bundle:false}` + on RTB jobs re-runs RPC `ensure_single_ready_to_bill_invoice_for_job`; refetch + reseed + `onSaved`. (the Jobs Pipeline board's partial-invoice modal copy-pastes this insert+ensure block — BILLING_FLOWS #4.)
  - `moveWorkingJobToReadyToBillFromEdit()` (~2259): requires the amount to equal full remaining exactly; runs `prepareBilledInvoicesBeforeJobRevertToReadyToBill` (Stripe void prep) then RPC **`update_job_status(p_job_id,'ready_to_bill')`**; refetch + reseed + `onSaved`.
- **Stage A:** the four break-off kernels → `lib/jobFormBreakOff.ts` (already pure, already at module scope).
- **Extraction:** after Stage A, `JobFormBreakOffSection` receiving `{editing, payments, jobTotalBidDollars, newInvoiceAmount(+setter+focus)}` and the two action callbacks (which can stay shell-side initially). **High risk** — do late, kernels first.

### 10–11. Ready to Bill list + Outstanding billing table (edit only) — extracted (#430)

> **Status:** the two lists merged into one unified **Invoices** table → [`JobFormInvoiceList.tsx`](../src/components/jobs/JobFormInvoiceList.tsx) (Status/Date/Amount/Actions, drafts + billed together; inline Send bill / share / Add discount; draft-delete ✕ → `delete_ready_to_bill_invoice` RPC with the `onInvoiceDeleted` fixture-link clear, v2.1072; muted `auto` tag on the elastic primary row, v2.1134). It self-sources the router/toast/bill-customer context hooks; every modal action still opens shell-owned state (`billViewInvoice`, `agreedWriteDownInvoice`).

- **Shared:** `editing.invoices`, `payments` (per-invoice paid sum → write-down room), `canApplyAgreedWriteDown` (dev/master/assistant-like/primary), `refreshEditingJobAndHydratePayments`, `billCustomer` context.
- **Related shell effect:** the **Stripe memo/footer backfill** (~642–693): for billed Stripe invoices missing memo/footer, serially invokes edge fn `get-stripe-invoice-details` per invoice then refetches — **reads the raw Stripe mode pref without the dev gate** (BILLING_FLOWS quirk; candidate #19). Keyed by `stripeMemoBackfillKey` memo. Stays in the shell (it's `editing`-level, not render-level).
- **Extraction:** `JobFormOutstandingBillingTable` with `onViewBill(inv)` / `onAddDiscount(inv)` callbacks; tail modals stay shell-side (BilledBillView also opened from §12).

### 12. Payments received table — extracted (#431)

> **Status:** → [`JobFormPaymentsTable.tsx`](../src/components/jobs/JobFormPaymentsTable.tsx) (compacted in v2.1223: ⓘ explainer, folded Type/Ref/Memo detail rows via `detailsOpenById`, one-line locked rows). The lock predicates landed in [`lib/jobs/jobFormPaymentPredicates.ts`](../src/lib/jobs/jobFormPaymentPredicates.ts); the confirm overlays (§16/§18), their state, and the RPC handlers **stay shell-side** — the table triggers them via callbacks. The pre-extraction description below is kept for reference.

- **Render location:** h4 "Payments received" (~5337–5810). Renders in **both** modes (new mode = manual rows only). Three row archetypes decided by the lock predicates: **Stripe-locked** (plain-text date via `formatPaymentDateForDisplay`, doc-icon "View Stripe bill" → `billViewInvoice`, read-only amount, read-only Type/Ref/Memo sub-row with `ReadOnlyPaymentRefCopy` clipboard button), **Mercury-locked** ("Mercury" chip, read-only, "Unlink and remove" button when `canUnlinkMercuryPayment(authRole)` and not blocked by a Stripe-hosted invoice), **editable** (date input, `MoneyDecimalAmountInput`, editable Type/Ref/Memo sub-row). The **last non-locked row hosts the +** (`lastUnlockedPaymentIdx`; all-locked → no inline add — quirk #22).
- **Owned state:** `paymentRemoveConfirmRowId`, `paymentRemoveRpcBusy`, `unlinkMercuryConfirmRowId`, `unlinkingMercuryPaymentId`; memos `paymentRemovePreview` (job total / remaining now / remaining after), `paymentRemoveConfirmsPersistedRpc`.
- **Shared:** `payments` + `setPayments` (THE save-engine input), `editing` (lock resolution needs `editing.invoices`), `persistedLedgerPaymentIds` (ids present in the DB row — decides RPC vs form-only removal), `refreshEditingJobAndHydratePayments`.
- **Handlers:** `addPaymentRow`, `updatePaymentRow` (**re-freezes amount/paid_on/ids on locked rows even if updates sneak in** — quirk #21), `removePaymentRow` (refuses locked; empty list → one fresh row), `requestRemovePaymentRow` (toast explanations per lock type; opens confirm), `confirmRemovePaymentRow` — persisted unlocked rows call RPC **`remove_jobs_ledger_payment_and_reconcile(p_payment_id)`** (immediate DB write: recomputes `payments_made`, re-syncs invoice paid↔billed, may demote job paid→billed — see BILLING_FLOWS § Unlink/reconcile) then refetch+rehydrate; unpersisted rows are removed form-only ("click Save to update the database"); `executeUnlinkMercuryFromBankRow`/`confirmUnlinkMercuryFromBankRow` — same RPC for Mercury rows, frees the bank deposit in AR.
- **Stage A:** the lock-predicate family → `lib/jobFormPaymentLocks.ts`; `paymentRowsFromJob`/`newEmptyPaymentRow` → `lib/jobFormRowContent.ts`.
- **Extraction:** `JobFormPaymentsSection` including overlays §16 + §18 (single openers). **High risk** — MONEY-PATH; the RPC handlers can stay shell-side callbacks in the first pass.

### 13. Labor Cost panel (edit only) — extracted (#433)

> **Status:** render → [`JobFormLaborCostPanel.tsx`](../src/components/jobs/JobFormLaborCostPanel.tsx); the labor state + loader effect **stay in the shell** as planned (the delete gate and migrate summary read them), flowing down as props.

- **Render location:** header "Labor Cost" (~5811–5916): Team Labor line (hours · cost · people; "Open on Jobs →" → `/jobs?tab=combined-labor&teamLaborJob=…` gated by `showTeamLaborOpenOnJobsLink`) and Sub Labor line ("Add an HCP to link sub labor" / count · total; "Open on Jobs →" → `/jobs?tab=sub_sheet_ledger&editLabor=<hcp>`).
- **Owned state:** `editJobTeamLaborLoading/Row/Error`, `editJobSubLaborLoading/Data/Error`; loader effect (~1651) keyed on `editing?.id` + `hcpNumber`: team via `loadTeamLaborData(supabase)` filtered to this job; sub labor matches `people_labor_jobs.job_number` **case-insensitively against the effective HCP text**, sums item costs via `laborItemsSubtotal` + drive cost from `app_settings` `drive_mileage_cost`/`drive_time_per_mile` (defaults 0.7 / 0.02) (quirk #26).
- **Shared:** `editJobEffectiveHcp` memo; role gates `canLinkTeamLaborOnJobs` (not assistant-like/superintendent/primary), `canLinkSubLaborOnJobs` (not primary); **the loaded rows also feed the delete gate** (`hasMigrateableCosts`, `costCheckErrored`) and the migrate summary.
- **Supabase:** `people_labor_jobs`, `people_labor_job_items`, `app_settings`; `clock_sessions` etc. inside `loadTeamLaborData`.
- **Extraction:** render → `JobFormLaborCostPanel`; data → `useJobFormLaborCosts` hook **kept in the shell** (delete/migrate read it) with outputs passed down.

### 14. Parts Cost accordions + Other job charges — extracted (#432)

> **Status:** render → [`JobFormPartsCostSection.tsx`](../src/components/jobs/JobFormPartsCostSection.tsx) (draft "Other job charges" rows presentation-hidden behind **+ Add other charge**, v2.1142–v2.1143); the snapshot state, its loader effect, and `materialsAccordionOpen` **stay in the shell** (delete gate + migrate preview read the totals), flowing down as props.

- **Render location:** header "Parts Cost" (~5917–6155). Edit mode: three read-only `MaterialsCostAccordionRow`s — "Supply house invoices" (lines or the office-roles hint), "Card charges" (Mercury allocations; card nickname via `useMercuryLedgerNicknames`), "Parts from tally". Both modes: "Other job charges" accordion = the **editable `materials` rows** (description/amount, +/trash; last row clears instead of removes — quirk #17). Tail: `JobChargesTimelineStandalone` (edit only, team-labor inclusion by `showJobCostBreakdownTeamLabor(authRole)`).
- **Owned state:** `materialsAccordionOpen` (default `'billed'`), `jobMaterialsSnapshotLoading`, `supplyInvoiceTotal/RpcFailed/Lines`, `mercuryAllocLines/FetchFailed`, `tallyPartLines/FetchFailed`; loader effect (~1609) = `fetchJobMaterialsCostSnapshot(editing.id)`; display memos `billedMaterialsTotalDisplay`, `mercuryCardTotal`, `tallyPartsTotal`, `toggleMaterialsAccordion`.
- **Shared:** `materials` + handlers (`addMaterialRow`/`updateMaterialRow`/`removeMaterialRow`) — save-engine input; **snapshot totals feed the delete gate** (`partsCostStyleTotal`, `hasMigrateableCosts`, `costCheckErrored`) and the migrate preview.
- **Sub-components:** `MaterialsCostAccordionRow` ([`JobFormMaterialsCostAccordion.tsx`](../src/components/jobs/JobFormMaterialsCostAccordion.tsx)) and `JobChargesTimelineStandalone` — already extracted.
- **Extraction:** render → `JobFormPartsCostSection`; snapshot loader → `useJobFormMaterialsSnapshot` hook **kept in the shell** (same reason as §13).

### 15. Footer actions

- **Render location:** ~6156–6221. Delete (edit only, **hidden for role `primary`** — quirk #27) → `deleteJobConfirmOpen`; Cancel → `closeForm`; missing-fields list (`jobFormMissingFields`); Save → `saveJob` (disabled by `jobFormCanSubmit`/`saving`).
- **Extraction:** stays in the shell — it is the shell's own chrome.

### 16–18. Nested confirm overlays (payment remove / Stripe fixture preview / Mercury unlink)

Documented with their triggering sections (§12, §7, §12) but **all three stayed in the shell** when those sections extracted — the section components open them via callbacks (the fixture preview is job-wide since v2.1223). All render at `JOB_FORM_NESTED_OVERLAY_Z_INDEX` (1011) with busy-guarded backdrop close. The payment-remove copy forks on `paymentRemoveConfirmsPersistedRpc` ("updates the database immediately" vs "click Save"); the Mercury copy warns about double-counting and the paid→billed demote.

### 19–20. Delete confirm + Migrate-and-delete — extracted (#437)

> **Status:** → [`JobFormDeleteMigrateModals.tsx`](../src/components/jobs/JobFormDeleteMigrateModals.tsx); the migrate target state + loaders live in [`useJobMigrate.ts`](../src/components/jobs/useJobMigrate.ts), which later gained the **Another job / A bid** target toggle with dry-run preview (v2.1166) and create-bid-from-search (v2.1174). The description below is kept for reference (job→job flow unchanged).

- **Render location:** §19 h2 "Delete job from Billing?"; §20 h2 "Migrate costs and delete this job" (`JOB_FORM_MIGRATE_OVERLAY_Z_INDEX`).
- **Flow:** Delete confirm shows HCP + name and the 90-day restore note (Settings → Data & migration → Recently deleted — the deleted-records archive, see [BILLING_FLOWS § Cleanup](./BILLING_FLOWS.md#cleanup-and-deletion)). Cost gate: `hasMigrateableCosts` (parts snapshot totals, billed materials, team labor, sub labor) or `costCheckErrored` (any cost source failed to load) ⇒ `reassignRequired` — the Delete button is **replaced** by "Reassign to another job…" (no plain-delete escape hatch; while loading, "Checking costs…" disables). Plain path: `confirmDeleteJob` → `deleteJob(id)` = direct `from('jobs_ledger').delete()` (FK cascade + archive trigger per BILLING_FLOWS), `onSaved`, `closeForm`.
- **Migrate modal:** debounced (280ms) RPC **`search_jobs_ledger`** (min 2 chars, excludes self, top 30); selecting a target loads a preview (`fetchJobMaterialsCostSnapshot` + `loadTeamLaborData` for the target); Source/Target summary table; warnings (own invoices/payments deleted with the job; sub labor tracked by HCP is NOT moved); confirm → RPC **`migrate_job_ledger_costs_and_delete(p_from, p_to, p_allow_billed: true)`** → `onSaved` + `closeForm` + verification toast.
- **Owned state:** `deleteJobConfirmOpen`; `migrateJobModalOpen`, `migrateTargetSearch/Candidates/SearchLoading/JobId/PreviewLoading/Preview`, `migratingJob` + the two loader effects (~1769, ~1807); `deletingId` (shell).
- **Extraction:** `JobFormDeleteMigrateModals` — self-contained modal pair whose only inputs are `editing`, the cost-gate values, and `onDeleted`-style callbacks. **Recommended first Stage-B alongside §4.**

### 21. Link-choice / import / create-customer modals

- `JobBidLinkChoiceModal` (extracted): `onLinked` sets `bidId` + `linkedBidSummary` + implies `customerId`; staged (Save to keep). **Stays shell** (openers in §1 and §6).
- `JobFormImportEstimateOrBidModal` (extracted): top of the z-ladder (1013); `onSelectBid`/`onSelectEstimate` → the prefill appliers. **Stays shell** (lifecycle-level).
- `JobProjectLinkChoiceModal` (extracted): `onLinked` sets `projectId` (+implied customer, staged); `onCreateNew` → app-level `newProjectModal` with form-field prefill. **Stays shell.**
- **Create customer from job** (extracted with §5, v2.1093 → [`JobFormCreateCustomerModal.tsx`](../src/components/jobs/JobFormCreateCustomerModal.tsx)): Residential/Commercial toggle, similar-customer list (`nameSimilarity ≥ 0.7` or substring, top 10, loaded by effect ~1902 on open), "link instead" → `handleLinkToSimilarCustomer`, create → `handleCreateCustomerFromJob(type)` — resolves the **job's** master for `customers.master_user_id` (edit: `resolveEditJobMasterUserId`; new: `master_assistants` adoption then self — the in-code comment records the orphan-customer incident this fixed), inserts the customer, and in edit mode immediately `UPDATE jobs_ledger SET customer_id` + refetch + `onSaved`. **Moved with §5** (handlers stayed shell-side).

### 22. Tail modals (shell-owned, multi-section)

- `AgreedWriteDownModal` (opened from §11): props include `paidOnInvoice` (memo `agreedWriteDownInvoicePaidSum`) and `isStripeHosted`; success → `refreshEditingJobAndHydratePayments` + `onSaved`. (Reads the raw Stripe mode pref without the dev gate — BILLING_FLOWS candidate #19.)
- `BilledBillViewModal` (opened from §11 **and** §12): `onAfterStripeDetailsLoaded` → `refetchEditingFromBillView` (merges the refreshed invoice back into `billViewInvoice`); `onAfterOobUnwindSuccess` → rehydrate payments; `onClose` runs a **3-attempt / 280ms retry refetch loop** waiting for memo/footer backfill to land (quirk #10).
- ~~`CustomerAcceptanceRecordModal` (opened from §2)~~ — moved into `JobFormSourceEstimateBanner` with §2 (v2.1090; single opener).
- The remaining two **stay in the shell** (playbook rule: modal opened from 2+ sections).

---

## Supabase surface (whole modal)

- **Tables read:** `customers`, `projects`, `bids`, `service_types`, `users`, `estimates`, `people_labor_jobs`, `people_labor_job_items`, `app_settings`, `master_assistants`, `jobs_ledger_team_members`; via libs: `jobs_ledger` (+details fetch), materials-snapshot sources, team-labor sources.
- **Tables written:** `jobs_ledger` (update/insert/delete + immediate customer-link updates), `jobs_ledger_payments` / `jobs_ledger_materials` / `jobs_ledger_fixtures` (delete+reinsert in save), `jobs_ledger_team_members` (diff), `jobs_ledger_invoices` (break-off insert), `customers` (insert; `date_met` backfill), `dispatch_requests` (auto-close on pictures link).
- **RPCs:** `next_job_number_suggestion`, `search_jobs_ledger`, `update_job_status` (RTB move + paid→billed demote), `ensure_single_ready_to_bill_invoice_for_job`, `remove_jobs_ledger_payment_and_reconcile`, `migrate_job_ledger_costs_and_delete`.
- **Edge functions:** `get-stripe-invoice-details` (memo/footer backfill); Stripe void-prep via `lib/voidStripeInvoiceForRevert` (inside `prepareBilledInvoicesBeforeJobRevertToReadyToBill`).
- **No realtime channels.** Refresh is refetch-on-action (`fetchJobWithDetailsById`) throughout.

---

## Quirks (preserve, don't fix)

1. **Save delete+reinsert id churn** — materials/fixtures are wholesale deleted and re-inserted with new client UUIDs on every Edit save. **Payments are DIFFED since v2.1121 (B5)**: `diffPaymentRows` (`lib/jobs/paymentRowsDiff.ts`, tested) upserts persist-worthy rows under stable ids and deletes only ids the form owns (`hydratedPaymentIdsRef`, captured at both hydration sites, updated after each slice persist, deliberately NOT reset by Undo) — rows born mid-edit (Stripe webhook payments) survive autosaves, and stable ids end the `payment_added` activity churn. `payments_made` is trigger-maintained since B3 (v2.1119); the client stopped writing it in B4 (v2.1120). (BILLING_FLOWS #9 / insert-path E, updated.)
2. **Child-row write errors unchecked in `saveJob`** — only the `jobs_ledger` update/insert results are checked; every child delete/insert result is dropped, so a mid-loop failure silently loses rows while `payments_made` already reflects the full form sum.
3. **`payments_made` is trigger-derived since B3/B4 (v2.1119–v2.1120)** — an AFTER trigger on `jobs_ledger_payments` derives the column from rows; the client and the incrementing RPCs stopped writing it (the old three-writers-no-invariant overwrite is gone — BILLING_FLOWS #10, fixed; B6 hard write-guard still pending).
4. **Fixture rows with only scope notes are dropped on save** (name empty ⇒ filtered out) even though `fixtureRowHasUserContent` counts them as blocking content for the Import gate.
5. **Paid→billed demote tolerance** is `revenue > payments + 0.01`.
6. **Team members are diffed**, not delete+reinserted — the one child table treated incrementally.
7. **Mount-only init** with file-top `eslint-disable react-hooks/exhaustive-deps`; correctness depends on the context's remount-by-key contract.
8. **`editing` doubles as the mode flag**; edit mode refetches by id and falls back to `initialJob`.
9. **Stripe memo/footer backfill** invokes the edge fn serially per invoice and reads the Stripe mode pref **without** the dev gate (shared with `AgreedWriteDownModal`; BILLING_FLOWS #19).
10. **`BilledBillViewModal.onClose` retry loop** — up to 3 refetches, 280ms apart, waiting for memo/footer to land.
11. **Z-index collision:** `JOB_FORM_MIGRATE_OVERLAY_Z_INDEX` and `JOB_FORM_BILL_VIEW_OVERLAY_Z_INDEX` are both `NESTED + 1` (1012); they currently never co-open.
12. **C# suggestion** (`next_job_number_suggestion`) fills asynchronously after init and is editable.
13. **Customer↔master invariant:** created customers belong to the **job's** master, never the clicking assistant (in-code incident comment in `handleCreateCustomerFromJob`); edit-save re-derives the written master and the customer-validation master from one value so they can't diverge.
14. **Import gating is the only dirty tracking** (`newJobFormHasBlockingContent`); service-type edits count only when they differ from the auto-picked default.
15. **No unsaved-changes guard** — backdrop click / Cancel discard silently.
16. **Redundant nested `editing` checks** at the billing block (`{editing && (<>{editing ? … : null}`).
17. **Last-row semantics differ per grid:** materials last row clears in place; fixtures refuse removal of the last row; payments replace an emptied list with one fresh row.
18. **Customer linking writes immediately in edit mode** (`handleLinkToSimilarCustomer`, `handleCreateCustomerFromJob`, picker selection does not — only the two handlers) — `jobs_ledger.customer_id` is updated before Save and `onSaved` fires.
19. **Staged vs immediate inconsistency:** project/bid link+disconnect are staged ("Save the job to apply") while customer create/link-similar is immediate.
20. **Archived-customer picker filtering keeps the linked row** (`filterActiveCustomersForPicker(customers, customerId)` — v2.736 `keepId` contract).
21. **`updatePaymentRow` re-freezes locked fields** (amount/paid_on/invoice_id/mercury_transaction_id) on Stripe/Mercury rows even when an update sneaks through.
22. **The + control lives on the last unlocked payment row**; if every row is locked there is no inline add.
23. **Slider drags by relative pointer delta** (`breakOffSliderLastPointerXRef`), not absolute track position; blur/keys snap to the 5% grid but a focused input is un-snapped.
24. **`createInvoice` full-remainder special case** — on an RTB job it opens Bill Customer instead of inserting a second draft; over-entries clamp with a toast.
25. **RTB move requires the exact full remaining** and runs Stripe void-prep first.
26. **Sub Labor joins by HCP text** (case-insensitive `people_labor_jobs.job_number` match) with drive-cost defaults 0.7 / 0.02 from `app_settings`.
27. **Delete hidden for role `primary`**; other roles rely on RLS.
28. **Failed cost checks force reassign** — `costCheckErrored` is treated as "has costs", so a job whose cost sources errored cannot be plain-deleted.

---

## Recommended extraction order

Per playbook: Stage A before Stage B per unit; lowest coupling first; money-path last; verify (`npm run typecheck && npm run lint && npm test`) each step; behavior-preserving only.

**Stage A wave — DONE** (landed under `src/lib/jobs/`, some filenames differ from the plan):

1. ~~`lib/jobFormBreakOff.ts`~~ — **done** → [`lib/jobs/jobFormBreakOff.ts`](../src/lib/jobs/jobFormBreakOff.ts).
2. ~~`lib/jobFormPaymentLocks.ts`~~ — **done** → [`lib/jobs/jobFormPaymentPredicates.ts`](../src/lib/jobs/jobFormPaymentPredicates.ts).
3. ~~`lib/jobFormRowContent.ts`~~ — **done** → [`lib/jobs/jobFormRows.ts`](../src/lib/jobs/jobFormRows.ts) (+ types in `jobFormTypes.ts`).
4. ~~`lib/jobFormServiceTypes.ts` + money-input helpers~~ — **done** → [`lib/jobs/jobFormServiceTypes.ts`](../src/lib/jobs/jobFormServiceTypes.ts) + [`lib/jobs/jobFormMoney.ts`](../src/lib/jobs/jobFormMoney.ts).
5. ~~`lib/jobFormSave.ts`~~ — **superseded** by the autosave restructure (v2.1078–80): slice payload builders in [`lib/jobs/jobFormAutosaveSlices.ts`](../src/lib/jobs/jobFormAutosaveSlices.ts) + [`jobFormCloseFlush.ts`](../src/lib/jobs/jobFormCloseFlush.ts) / [`jobFormUndo.ts`](../src/lib/jobs/jobFormUndo.ts) / [`paymentRowsDiff.ts`](../src/lib/jobs/paymentRowsDiff.ts); the hook is [`components/jobs/useJobFormAutosaveSlice.ts`](../src/components/jobs/useJobFormAutosaveSlice.ts) (note: component-side, not `src/hooks/`).

**Stage B wave — DONE** (every form section is an extracted component as of v2.1094):

6. ~~`JobFormDeleteMigrateModals` (§19+§20)~~ — **done** (#437, + `useJobMigrate`).
7. ~~`JobFormPeoplePicker` (§4)~~ — **done** (#436; modal redesign v2.760).
8. ~~`JobFormSourceEstimateBanner` (§2)~~ — **done** (v2.1090).
9. ~~`JobFormIdentityFields` (§3)~~ — **done** (v2.1091).
10. ~~`JobFormLinksSection` (§6)~~ — **done** (v2.1092; `formatJobFormBidLinkTitle` Stage-A'd to `lib/jobs/jobFormBidLinkTitle.ts`).
11. ~~`JobFormFixturesSection` (§7)~~ — **done** (#435; the §17 preview dialog stayed shell-side and went job-wide in v2.1223).
12. ~~`JobFormPartsCostSection` (§14)~~ — **done** (#432; snapshot state/loader stayed in the shell).
13. ~~`JobFormLaborCostPanel` (§13)~~ — **done** (#433; labor state/loader stayed in the shell).
14. ~~`JobFormCustomerSection` (§5+§21 create-customer)~~ — **done** (v2.1093; helpers Stage-A'd to `lib/jobs/jobFormCustomerDisplay.ts`, DB-writing handlers kept as shell callbacks).
15. ~~`JobFormOutstandingBillingTable` (§11) + `JobFormReadyToBillList` (§10)~~ — **done** (#430, merged as the unified `JobFormInvoiceList`).
16. ~~`JobFormPaymentsSection` (§12)~~ — **done** (#431, as `JobFormPaymentsTable`; the §16/§18 confirm overlays and RPC handlers stayed shell-side).
17. ~~`JobFormBreakOffSection` (§9)~~ — **done** (#434; split further in v2.1223 → `JobFormBreakOffTrack` + `JobFormSegmentsCreateAction`, shared `useBreakOffSlider`). `JobFormHeaderRow` (§1) closed the section queue (v2.1094).
18. **Save engine seam** — **the one remaining item**: `createJob` + the four `persist*Slice` functions still live in the shell; a future `useJobFormSave`-style runner move must be sequence byte-equivalent, keep the transactional TODO documented, and change no behavior.

**What stays in the shell permanently:** lifecycle (init/prefill/close/remount contract), all shared form-field state + setters, reference-data caches, the save engine (`createJob` + the `persist*Slice` writers, until its own seam), footer chrome, the z-index ladder, the three link/import modals, the tail modals (`AgreedWriteDownModal`, `BilledBillViewModal`, `CustomerAcceptanceRecordModal`), the Stripe memo/footer backfill effect, refetch plumbing (`refreshEditingJobAndHydratePayments`, `refetchEditingFromBillView`), and all context wiring.
