# Job Form Modal Architecture Map

---
file: docs/JOB_FORM_MODAL_ARCHITECTURE.md
type: Engineering / Refactor Map
purpose: Step-0 map for the JobFormModal.tsx decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md, adapted from tabs to form sections) — inventory what every section of the New/Edit Job modal touches (state, handlers, supabase tables/RPCs, sub-components, coupling) to drive the multi-PR extraction, with a deep-dive on the money-path save engine.
audience: Developers, AI Agents
last_updated: 2026-07-20
---

## Overview

[`src/components/jobs/JobFormModal.tsx`](../src/components/jobs/JobFormModal.tsx) is a ~4,316-line "God component" (as of v2.782: ~71 `useState` declarations, 17 effects, 23 `useMemo`, 8 `useCallback`, ~30 refs) — down from ~7,137 lines at v2.736 when this map was written; extraction is well underway. It is still the **largest component in the repo that is a modal, not a page**. This map follows [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) and the dossier format of [`DASHBOARD_SECTIONS_ARCHITECTURE.md`](./DASHBOARD_SECTIONS_ARCHITECTURE.md); the billing behavior it implements (invoice lifecycle, payment channels, delete/archive) is flow-mapped in [`BILLING_FLOWS.md`](./BILLING_FLOWS.md) — this doc cross-references that one and does not restate it.

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
| 1 | Header row | `hcpHelpOpen` popover, Import / "Job Detail" button, "Link to: Bid \| Project" (~3113–3356) | inline | 1 (`hcpHelpOpen` + ref/effect) | `bidId`, `projectId`, `newJobImportBlockedByContent`, `jobImportSourceOpen`, modal openers | med (reads dirty gate; opens 3 link modals; `jobDetailOpenerBridge`) | low | Extract `JobFormHeaderRow` late; openers stay in shell |
| 2 | Source-estimate banner | `sourceEstimateForJob` (~3357–3400) | inline | 3 (`sourceEstimateForJob`, `sourceEstimateLoading`, `contractModalEstimateId`) + loader effect | `editing?.id` | low (tail `CustomerAcceptanceRecordModal`) | low | Extract `JobFormSourceEstimateBanner` with its loader + modal |
| 3 | Identity fields | labels `HCP`/`C#`/`Job Name`/`Service type`/`Last manual bill date`/`Job Address` (~3415–3536) | inline | 0 | `hcpNumber`, `clickNumber`, `jobName`, `jobAddress`, `formServiceTypeId`, `lastBillDate` | med (all fields save-engine inputs; hcp drives Sub Labor; serviceType role-filtered) | low | Controlled `JobFormIdentityFields` (props+setters) |
| 4 | People assignment | `contractorsSearch` "Add People..." input + chips (~3537–3666) | inline | 2 (`contractorsSearch`, `contractorsDropdownOpen`) + click-outside effect + ref | `teamMemberIds`, `users` | low | low | **Good first Stage-B** — `JobFormPeoplePicker` |
| 5 | Customer block | `customerExpanded` collapsible, "Link to customer" search (~3667–3988) | inline | 3 (`customerSearch`, `customerDropdownOpen`, highlight timers) | `customerId/Name/Email/Phone`, `dateMet`, `googleDriveLink`, `jobPicturesLink`, `customers`, `customerExpanded`, highlight gates | **high** (immediate DB writes on link; prefill flows write these; save engine reads all) | med | `JobFormCustomerSection` after Stage A; create-customer modal moves with it |
| 6 | Project \| Plans \| Bid links | `projectFilesPlansExpanded`, `job-form-project-files-plans-trigger` (~3989–4232) | inline | 1 (`projectFilesPlansExpanded`) + 8 scroll/focus refs + 3 scroll callbacks | `projectId`, `bidId`, `linkedBidSummary`, `jobPlansLink`, `projects`, `bids` | med (link modals in tail; project link implies customer; header "Link to:" duplicates) | med | `JobFormLinksSection`; link-choice modals stay shell-level (opened from header too) |
| 7 | Specific Work fixtures grid | header "Specific Work or Materials (Fixtures / Tie-ins / Repair)" (~4234–4622) | inline | 2 (`fixtureScopeExpandedById`, `stripeFixturePreviewRowId` + Esc effect) | `fixtures`, `fixturesSectionHighlight` | med (fixtures → `jobTotalBidDollars` → everything billing) | med | `JobFormFixturesSection` + Stripe-preview dialog moves with it |
| 8 | Job Total / Remaining | labels `Job Total ($)` / `Remaining ($)` (~4623–4655) | inline | 0 | `jobTotalBidDollars`, `getEditJobBillableRemaining()` | high (pure display of billing kernels) | low | Rides with §9 (billing section) |
| 9 | Break-off slider + RTB action | `edit-job-partial-invoice-amount`, `data-breakoff-slider-thumb` (~4656–5040) | inline | 3 (`newInvoiceAmount`, `newInvoiceAmountInputFocused`, `breakOffSliderDragCombinedPct`) + 4 slider refs, 9 memos, 7 callbacks | `payments` (paid sum), `editing.invoices`, `jobTotalBidDollars` | **high** — MONEY-PATH (invoice insert, `update_job_status`, Bill Customer opener) | high | Stage A kernels already module-scope → `lib/`; then `JobFormBreakOffSection` |
| 10 | Ready to Bill list | h4 "Ready to Bill" (~5041–5126) | inline | 0 | `editing.invoices`, `billCustomer` context | high (opens Bill Customer with 3 refresh callbacks; navigates to Stages) | med | Rides with §9 or its own `JobFormReadyToBillList` |
| 11 | Outstanding billing table | h4 "Outstanding billing" (~5127–5334) | inline | 0 (opens shell-owned `billViewInvoice`, `agreedWriteDownInvoice`) | `editing.invoices`, `payments` (per-invoice paid) | high (Stripe share panel, write-down, bill view — all shell/tail modals) | med | `JobFormOutstandingBillingTable`; tail modals stay shell |
| 12 | Payments received table | h4 "Payments received" (~5337–5810) | inline | 4 (`paymentRemoveConfirmRowId`, `paymentRemoveRpcBusy`, `unlinkMercuryConfirmRowId`, `unlinkingMercuryPaymentId`) | `payments`, `editing`, `persistedLedgerPaymentIds` | **high** — MONEY-PATH (RPC removal, Mercury unlink, Stripe-locked rows, feeds save overwrite) | high | Stage A lock-predicates → `lib/`; then `JobFormPaymentsSection` + its 2 confirm overlays |
| 13 | Labor Cost panel | header "Labor Cost" (~5811–5916) | inline | 6 (`editJobTeamLabor*` ×3, `editJobSubLabor*` ×3) + loader effect | `editJobEffectiveHcp`, `editing?.id` | med (labor data also feeds delete-gate `hasMigrateableCosts`) | med | `JobFormLaborCostPanel` + `useJobFormLaborCosts` hook (shell keeps hook — delete gate reads it) |
| 14 | Parts Cost accordions | header "Parts Cost", `MaterialsCostAccordionRow` (~5917–6155) | partial (row component extracted) | 10 (`materialsAccordionOpen`, snapshot state ×9) + loader effect | `materials` (Other job charges rows), `editing` | med (snapshot totals also feed delete gate + migrate preview) | med | `JobFormPartsCostSection` + `useJobFormMaterialsSnapshot` hook (shell keeps hook) |
| 15 | Footer actions | Delete / Cancel / Save buttons (~6156–6221) | inline | 0 (`deletingId`, `saving` shell-owned) | `jobFormCanSubmit`, `jobFormMissingFields` | high (triggers save engine + delete flow) | low | Stays in shell (thin) |
| 16 | Payment-remove confirm | h2 "Remove payment?" (~6223–6331) | inline overlay | (state in §12) | `paymentRemovePreview`, `paymentRemoveConfirmsPersistedRpc` | — | — | Moves with §12 |
| 17 | Stripe fixture preview | `stripe-fixture-line-preview-dialog` (~6332–6423) | inline overlay | (state in §7) | `stripeFixturePreviewRow` | — | — | Moves with §7 |
| 18 | Mercury-unlink confirm | h2 "Unlink and remove?" (~6424–6521) | inline overlay | (state in §12) | `editing.status` | — | — | Moves with §12 |
| 19 | Delete-job confirm | h2 "Delete job from Billing?" (~6522–6702) | inline overlay | 1 (`deleteJobConfirmOpen`) | `hasMigrateableCosts`, `costCheckErrored`, `reassignRequired`, `costSnapshotStillLoading` | high (reads §13+§14 cost data; chains into §20) | med | `JobFormDeleteMigrateModals` (with §20) |
| 20 | Migrate-and-delete modal | h2 "Migrate costs and delete this job" (~6703–6911) | inline overlay | 7 (`migrateJobModalOpen`, `migrateTarget*` ×5, `migratingJob`) + 2 loader effects | `partsCostStyleTotal`, `materialsBilledTotalForMigrate`, `editJobTeamLaborRow`, `editJobSubLaborData` | med | med | `JobFormDeleteMigrateModals` — **good first Stage-B** with §19 |
| 21 | Link-choice / import / create-customer modals | `JobBidLinkChoiceModal`, `JobFormImportEstimateOrBidModal`, `JobProjectLinkChoiceModal`, "Create customer from job" (~6912–7076) | 3 of 4 extracted | create-customer: 5 (`createCustomerFromJob*`, `similarCustomersForCreate`) + similar-search effect | `bids`, `projects`, `customerId`, prefill appliers | med | low | Create-customer modal + its handlers move with §5; the rest stay (opened from header + §6) |
| 22 | Tail modals | `AgreedWriteDownModal`, `BilledBillViewModal`, `CustomerAcceptanceRecordModal` (~7079–7134) | extracted components; wiring inline | `billViewInvoice`, `agreedWriteDownInvoice` (+2 memos, refetch callbacks) | `editing` refetch plumbing | opened from 2+ sections (§11 + §12) | low | **Stay in shell** per playbook (multi-section modals) |
| — | **Save engine** | `saveJob` (~2759–2998) | inline fn | — | reads nearly every form field | **maximum** — MONEY-PATH | **highest** | See [The save engine](#the-save-engine-savejob--money-path); Stage A payload builders → `lib/` + tests, sequence documented before any move |

> Status legend: `inline` = rendered/defined directly in `JobFormModal.tsx`; `partial` = major children extracted but section state/JSX still inline; `extracted` = thin wrapper around an imported component.

---

## Modal lifecycle

### Open / close / remount

- **Openers:** [`JobFormModalContext.tsx`](../src/contexts/JobFormModalContext.tsx) provides `openEditJob(jobId, {initialJob?, onSaved?, billingCustomerHighlight?, fixturesSectionHighlight?, jobPicturesLinkHighlight?, alsoOpenCreateCustomerModal?})` and `openNewJob({onSaved?, onCreatedJobId?, projectId?, prefillBidId?})`. Each open bumps a module-scope `jobFormModalInstanceSeed` used as the React `key`, so **every open is a fresh mount with clean state**. ~20 call sites consume the context (`Jobs.tsx`, `Dashboard.tsx`, `Quickfill.tsx`, schedule/dispatch surfaces, `DetailJobModal`, `BankPaymentsModal`, …).
- **Init:** one mount-only `useLayoutEffect` keyed on `authUser?.id` (~1424–1553) loads, in parallel: `customers`, `projects`, `bids` (latest 800), `service_types`, and the caller's own `users` row (role + per-role `*_service_type_ids` columns), then role-filtered `users` for the People picker (dev also loads dev users). Then forks:
  - **new:** `resetNewForm(newJobProjectId)`; fire-and-forget RPC `next_job_number_suggestion` fills `clickNumber`; default service type via `pickDefaultServiceTypeId` (single → it; else "Plumbing" then "Electrical" then first), recorded in `initialNewJobServiceTypeIdRef` so the auto-pick doesn't count as dirty; a `newJobProjectId` prefill pulls the project's customer (name/address/contact/date-met).
  - **edit:** `fetchJobWithDetailsById(editJobId)` with `initialJob` as fallback; not found → toast + `onClose()`. `applyEditJob(job, billingGate, fixturesGate, picturesGate)` hydrates every form field from the row (incl. `breakOffPrefillAmountStringFromJob` seeding the break-off amount); `alsoOpenCreateCustomerModal` + a present customer name opens the create-customer modal immediately (billing flow from Stages).
  - Both paths end with `setInitDone(true)`; until then the render is a bare "Loading…" overlay.
- **Bid prefill timing:** a separate effect (~1555) waits for `initDone && mode==='new'`, then runs `applyPrefillFromBid(newJobPrefillBidId)` exactly once, guarded by `newJobPrefillBidAppliedRef` (Strict-Mode double-invoke guard) and a `bidId === pid` short-circuit.
- **Close:** `closeForm()` (~1081) resets every nested-overlay state, then `onClose()` (context sets `{kind:'closed'}`). Backdrop click closes. **There is no unsaved-changes guard** — edits are silently discarded (quirk #15).
- **onSaved / onCreatedJobId:** stored in refs (`onSavedRef`, `onCreatedJobIdRef`) so stale closures can't fire; `onSaved` fires after save, after several in-modal DB writes (immediate customer link, payment removal, invoice creation, status moves), and after delete/migrate.

### Dirty tracking (Import gating only)

`newJobFormHasBlockingContent` (module-scope, ~190) computes "the New Job sheet has user-visible content" from 19 fields + row arrays (rows count via `materialRowHasUserContent` / `fixtureRowHasUserContent` / `paymentRowHasUserContent`; a service-type change counts only when it differs from the auto-picked `initialNewJobServiceTypeId`). The memo `newJobImportBlockedByContent` hides the header **Import** button and an effect force-closes the import modal if content appears while it's open. This is the modal's **only** dirty tracking — it gates Import overwrites, not close.

### Prefill appliers

- **`applyPrefillFromBid(bidRowId)`** (~1222): fetches the bid + embedded customer; sets `bidId`, `jobName`, `jobAddress`, `linkedBidSummary`, prepends the bid to `bids` if absent; applies the bid's service type only when the caller's role-filtered list allows it (else info toast); applies bid customer (from local `customers` cache first, else the embedded row); fills `googleDriveLink`/`jobPlansLink` **only if currently blank**. Used by both the Import modal (`onSelectBid`) and `openNewJob({prefillBidId})`.
- **`applyPrefillFromEstimate(estimateId)`** (~1331): fetches the estimate; refuses if `job_ledger_id` already set ("already linked to a job"); **clears** any bid link; sets name/address; converts `line_items_snapshot` → fixtures via `normalizeEstimateLineItemsFromJson` + `fixturesPayloadForCreateJobFromEstimate` (both already in `lib/`); applies the estimate's customer (fetching the row if not cached, tolerating archived), else just `customer_email`.
- Neither applier touches payments/materials, and neither marks anything saved — prefill is form-state only until Save.

### Highlight gates (deep-link affordances)

Three boolean gates arrive as props and scroll/flash their targets: `billingCustomerHighlight` (red "Link a customer before sending this invoice." box; cleared automatically once `customerId` is set), `fixturesSectionHighlight` and `jobPicturesLinkHighlight` (blue flash, auto-clear after 2.5s; pictures also focuses+selects the input). `applyEditJob` also force-expands the customer block when the pictures or billing gate demands it.

---

## Module-scope pure logic (Stage-A inventory)

All of these are already **module-scope pure functions** in `JobFormModal.tsx` — extraction is a cut/paste to `src/lib/` plus tests. Grouped by proposed target file:

| Proposed lib file | Functions / constants (all module-scope today) | Notes |
|---|---|---|
| `src/lib/jobFormBreakOff.ts` | `unallocatedBillableDollars`, `breakDollarsFromCombinedPct`, `snapBreakOffCombinedPctToStep`, `breakOffPrefillAmountStringFromJob`, `BREAK_OFF_COMBINED_SLIDER_STEP_PCT` | **Money-path kernels** — the slider/prefill math documented in [BILLING_FLOWS § Break-off](./BILLING_FLOWS.md#invoices-jobs_ledger_invoices). Note the repo already has 5 copies of the "unallocated" kernel (BILLING_FLOWS optimization candidate #3); extract verbatim, do **not** consolidate in the same pass. |
| `src/lib/jobFormRowContent.ts` | `MaterialRow`/`PaymentRow`/`FixtureRow` types, `materialRowHasUserContent`, `fixtureRowHasUserContent`, `paymentRowHasUserContent`, `newJobFormHasBlockingContent`, `normalizeFixtureDisplayName`, `newEmptyPaymentRow`, `paymentRowsFromJob`, `localDateYYYYMMDD` | The dirty-gate + row hydration kernels. `newEmptyPaymentRow`/`localDateYYYYMMDD` impure at the margins (uuid/now) — inject or accept. |
| `src/lib/jobFormPaymentLocks.ts` | `mercuryLinkedPaymentRow`, `paymentRowLinkedToInvoice`, `jobsLedgerInvoiceIsStripeLinked`, `stripeBillInvoiceForPaymentRow`, `mercuryUnlinkBlockedByStripeHostedInvoice`, `canRemovePaymentRowFromForm`, `canUnlinkMercuryPayment` | The Stripe/Mercury row-lock predicate family — used by the payments table, `updatePaymentRow` immutability enforcement, removal confirms, and the save engine's implicit "locked rows ride along". High test value. |
| `src/lib/jobFormServiceTypes.ts` | `visibleServiceTypesForJobForm`, `pickDefaultServiceTypeId` | Role-filtered trade visibility (estimator/primary/superintendent/field-role id lists) + default pick. |
| `src/lib/moneyInputTyping.ts` (or fold into an existing money lib) | `parseMoneyInputToNumber`, `parseMoneyInputToNumberOrNull`, `sanitizeMoneyTyping`, `formatCurrency`, `formatPaymentDateForDisplay` | Generic input parsing/format helpers; check for existing equivalents before minting a new file. |
| `src/lib/jobFormSave.ts` (new, Stage A for the save engine) | payload builders extracted **out of** `saveJob`: build-update/insert payload for `jobs_ledger`, `validPayments`/`validMaterials`/`validFixtures` filters + row→insert mapping, team-member add/remove diff, the paid→billed demote predicate (`statusBeforeSave === 'paid' && revNum > paymentsMadeNum + 0.01`) | See [save engine](#the-save-engine-savejob--money-path). Pure builders first; the write *sequence* moves later (hook), unchanged. |
| stays put | `formatJobFormBidLinkTitle` (needs `LedgerPrefixMap` — thin, could join `lib/ledgerDisplayPrefixes`), `ClipboardPasteGlyph` + `pasteTextToField` + `ReadOnlyPaymentRefCopy` (tiny components), style constants, z-index ladder | Move with their consuming sections in Stage B. |

Already-in-`lib/` kernels this file consumes (do not duplicate): `revenueDollarsFromFixtures`, `resolveCustomerIdForJobPayload` (tested), `resolveEditJobMasterUserId` (tested), `resolveEffectiveJobMasterUserId`, `filterActiveCustomersForPicker` (tested, v2.736), `jobLedgerHasCustomerForBilling`, `stripeInvoiceLineDescription` helpers (tested), `fetchJobMaterialsCostSnapshot`, `fetchJobWithDetailsById`, `prepareBilledInvoicesBeforeJobRevertToReadyToBill`, `normalizeJobsLedgerStatus`, `createJobFromEstimateSubmit` / `estimateLineItemNormalize`.

---

## The save engine (`saveJob`) — MONEY-PATH

**Anchor:** `async function saveJob()` (~2759–2998). This is the highest-risk piece of the file: it is the only writer of the job's child-row tables from this surface, it overwrites `payments_made`, and it can demote a job's billing status. It is flagged in [BILLING_FLOWS](./BILLING_FLOWS.md) as payment-insert path **E** and optimization candidates **#9/#10**. **The map documents; it does not fix.** Any extraction must be byte-equivalent in behavior.

### Preconditions

`authUser?.id` present; `formServiceTypeId` non-empty (toast + bail). The Save button additionally gates on `jobFormCanSubmit` (Job Name + Job Address + Service type non-empty). Computed up front: `revNum = jobTotalBidDollars` (= `revenueDollarsFromFixtures(fixtures)`), `paymentsMadeNum` = sum of ALL payment rows, `validPayments` = rows with `amount > 0`, `validMaterials` = rows with description or non-zero amount.

### Edit branch — full write sequence, in order

1. **Resolve owner + customer:** `masterUserIdForUpdate = resolveEditJobMasterUserId({projectId, projectMasterUserId, existingJobMasterUserId})` — editing preserves the job's owner or follows the linked project's owner; it deliberately does **not** re-derive from `job_owner_override` (in-code comment: that steers NEW jobs only; re-deriving would silently re-own the job and break the customer↔master invariant). `resolvedCustomerId = resolveCustomerIdForJobPayload(customerId, masterUserIdForUpdate, customerName, customers)`.
2. **`UPDATE jobs_ledger`** with the full payload: hcp/click numbers, name, address, customer id/name/email/phone, `last_bill_date`, three links, **`revenue: revNum`**, **`payments_made: paymentsMadeNum` (overwrite — one of three writers of this column, no DB invariant)**, `project_id`, `bid_id`, `service_type_id`, `master_user_id`. Error checked → throw.
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

- **Render location:** title "Edit Job"/"New Job" + HCP/C# "i" help popover (`hcpHelpOpen`, outside-click/Esc effect ~701) + center button (**Import** in new mode when `!newJobImportBlockedByContent`, else **Job Detail** in edit mode → `closeForm()` then `jobDetailOpenerBridge.requestOpenJobDetail(id)`) + right-aligned "Link to: **Bid** | **Project**" quick links (~3113–3356). Linked → `<Link>` navigations; unlinked → open `JobBidLinkChoiceModal`/`JobProjectLinkChoiceModal`.
- **Owned state:** `hcpHelpOpen` + `hcpHelpRef`.
- **Shared:** `bidId`, `projectId`, `newJobImportBlockedByContent`, `jobImportSourceOpen` setter, both link-choice modal setters, `editing`.
- **Coupling:** duplicates §6's link/unlink affordances; the Import gate is the dirty-tracking consumer.
- **Extraction:** `JobFormHeaderRow` taking flags + opener callbacks. Low value until the sections around it are out; do late.

### 2. Source-estimate banner

- **Render location:** `editing && sourceEstimateForJob` green banner with `#estimate_number` link + "View contract & acceptance" (~3357–3400); the `error` paragraph sits just below (~3401, shell-owned).
- **Owned state:** `sourceEstimateForJob`, `sourceEstimateLoading`, `contractModalEstimateId`; loader effect (~1580) queries `estimates` by `job_ledger_id = editing.id`.
- **Sub-components:** `CustomerAcceptanceRecordModal` (tail, extracted) — its only opener.
- **Extraction:** clean vertical slice — banner + loader + modal into `JobFormSourceEstimateBanner`. **Low risk, good early win.**

### 3. Identity fields

- **Render location:** HCP / C# / Job Name (clipboard-paste affordance) row; Service type (`SearchableSelect`, options from `jobFormServiceTypeSelectOptions`); Last manual bill date + Job Address (paste affordance) row (~3415–3536).
- **Owned state:** none (paste helpers use `jobNameInputRef`/`jobAddressInputRef`).
- **Shared (all save-engine inputs):** `hcpNumber` (also drives §13 Sub Labor via `editJobEffectiveHcp`), `clickNumber` (async RPC suggestion on new), `jobName`, `jobAddress`, `formServiceTypeId` (required; role-filtered options; edit mode injects the job's current type into the list when the role filter would hide it — `jobFormServiceTypeSelectOptions` memo), `lastBillDate`.
- **Stage A:** `visibleServiceTypesForJobForm` + `pickDefaultServiceTypeId` → `lib` (see inventory).
- **Extraction:** controlled `JobFormIdentityFields` with props+setters. Simple but wide props surface.

### 4. People assignment

- **Render location:** "Add People..." search input + dropdown + selected chips with × (~3537–3666).
- **Owned state:** `contractorsSearch`, `contractorsDropdownOpen`, `contractorsDropdownRef` + outside-click effect (~1929).
- **Shared:** `teamMemberIds` (save engine step 7), `users` (shell cache).
- **Quirk:** Enter picks the first filtered match; dropdown z-index 9999 (above everything).
- **Extraction:** **recommended first Stage-B** — self-contained, two shared props (`teamMemberIds` + setter, `users`).

### 5. Customer block

- **Render location:** collapsible "Customer: <name>" header with "Not in Customers" amber chip (`customerListImpliesLinkedRow` heuristic: unique name match, master-scoped first) + clipboard **Import** (`handleCustomerImport` → `parseCustomerImport`); body = Link-to-customer search (billing-highlight wrapper), Create-customer / Clear-link buttons, Customer Name/Phone/Email, Date Met (locked when the linked customer already has one), Customer Files (`googleDriveLink`), Customer Pictures (`jobPicturesLink`, highlight + focus target) (~3667–3988).
- **Owned state:** `customerSearch`, `customerDropdownOpen`; the highlight scroll/clear effects (~1841–1890).
- **Shared:** `customerId/Name/Email/Phone`, `dateMet`, `googleDriveLink`, `jobPicturesLink`, `customers` cache, `customerExpanded` (also set by `applyEditJob` gates), `billingCustomerHighlight`/`jobPicturesLinkHighlight`, `customersLoading`.
- **Handlers:** picker `onClick` fills id+name+contact+dateMet and job address if blank; typing that no longer matches the selected display clears `customerId`; a sync effect (~1892) rewrites `customerSearch`/`dateMet` whenever `customerId` resolves against the cache.
- **Archived customers (v2.736):** the dropdown filters through `filterActiveCustomersForPicker(customers, customerId)` — archived rows are excluded from linking **except** the currently-linked row (`keepId`) so an existing link stays editable (in-code comment at ~3815).
- **Supabase:** none directly in the section (cache from init); but see §21 — `handleCreateCustomerFromJob` / `handleLinkToSimilarCustomer` **write `customers` and `jobs_ledger.customer_id` immediately in edit mode** (before Save), then refetch `editing` + fire `onSaved` (quirk #18/#19).
- **Extraction:** `JobFormCustomerSection` after Stage A; the create-customer modal (§21) and its two handlers move with it. **Medium risk** — prefill appliers and §6's project-implies-customer also write these fields (they stay shell-side; section receives setters).

### 6. Project | Plans | Bid links

- **Render location:** chevron + "Project | Plans | Bid" jump-link row (links scroll+focus via `scrollToProjectSection`/`scrollToJobPlansSection`/`scrollToBidSection`); expanded panel `job-form-project-files-plans-panel`: Project select-or-disconnect, Job Plans URL, Bid proposal link-or-disconnect (+ "Open cover letter") (~3989–4232).
- **Owned state:** `projectFilesPlansExpanded` (also set by `resetNewForm(!!projectPrefill)`, §21 link callbacks); refs `jobFormProjectSectionRef`/`SelectRef`/`DisconnectRef`, `jobFormJobPlansSectionRef`/`InputRef`, `jobFormBidSectionRef`/`DisconnectRef`/`LinkButtonRef`; the three scroll callbacks.
- **Shared:** `projectId` (select implies `customerId` when unset), `bidId` + `linkedBidSummary` (label via `formatJobFormBidLinkTitle` + `prefixMap`; backfilled from `bids` cache by effect ~1565), `jobPlansLink`, `projects`, `bids`.
- **Coupling:** header row (§1) has twin link buttons; `JobProjectLinkChoiceModal`'s "create new" opens the app-level `newProjectModal` with a prefill built from form fields; disconnects are staged ("Save the job to apply" toasts) — contrast quirk #19.
- **Extraction:** `JobFormLinksSection`; the two link-choice modals **stay in the shell** (opened from §1 too); scroll refs move with the section (jump-link row is part of it).

### 7. Specific Work fixtures grid

- **Render location:** header "Specific Work or Materials (Fixtures / Tie-ins / Repair)" + 3-col table (Line Item `AutosizeTextarea` normalized on blur; Count min-1; Unit price `MoneyDecimalAmountInput` where 0 → null) with per-row second row: Stripe length counter `(n / STRIPE_INVOICE_LINE_DESCRIPTION_MAX)`, "Add scope or notes" expander, "Stripe preview" dialog opener; +/trash controls (last row hosts +) (~4234–4622). Highlight wrapper `fixturesSectionHighlightRef`.
- **Owned state:** `fixtureScopeExpandedById` (scope stays open while non-empty), `stripeFixturePreviewRowId` + Esc-close effect (~802) + `stripeFixturePreviewRow` memo; handlers `addFixtureRow`/`updateFixtureRow`/`removeFixtureRow` (removal also cleans both maps; refuses to remove the last row).
- **Shared:** `fixtures` (drives `jobTotalBidDollars = revenueDollarsFromFixtures(fixtures)` — the number every billing computation hangs off), `fixturesSectionHighlight`.
- **Stage A:** already in `lib/` (`stripeInvoiceLineDescription`, `revenueFromJobFixtures`); `normalizeFixtureDisplayName`/`fixtureRowHasUserContent` move per inventory.
- **Extraction:** `JobFormFixturesSection` + the §17 preview dialog moves with it (single opener).

### 8. Job Total / Remaining

- **Render location:** two centered figures (~4623–4655): `$formatCurrency(jobTotalBidDollars)` ("Total of lines above.") and `$formatCurrency(getEditJobBillableRemaining())`.
- **Note:** `getEditJobBillableRemaining()` = `unallocatedBillableDollars(jobTotalBidDollars, paidSum, editing?.invoices)` — in NEW mode `editing` is null so Remaining = total − payments. Pure display; extract with §9.

### 9. Break-off slider + Ready-to-Bill action (edit only)

- **Render location:** `editing && …` block (~4656–5040; note the redundant nested `editing ? …` — quirk #16): label toggles "Send to Ready to Bill:" vs "Break off Invoice:" (`isSendFullUnallocatedToReadyToBill` — amount matches full remaining on a `working` job), amount input (display formats when unfocused; blur clamps to remaining then snaps to the 5% grid), action button (`moveWorkingJobToReadyToBillFromEdit` or `createInvoice`), "% of job total" hint, then the custom pointer-driven track: paid fill, break preview fill, 5%-tick rails, yellow field-progress dot (`pct_complete`), green triangle thumb (`role="slider"` + arrow/Home/End keys), 20/40/60/80% labels, legend.
- **Owned state:** `newInvoiceAmount`, `newInvoiceAmountInputFocused`, `breakOffSliderDragCombinedPct`, `creatingInvoice`, `movingJobToReadyToBill`; refs `billingBreakOffTrackRef`, `breakOffSliderPointerActiveRef`, `breakOffSliderLastDragCombinedRef`, `breakOffSliderLastPointerXRef`; memos `isSendFullUnallocatedToReadyToBill`, `breakOffBillingTrackPercents`, `jobCompleteTrackPct`, `breakOffPaidSum`, `breakOffRemaining`, `breakOffCombinedSliderBounds`, `breakOffDraftCoveragePctDisplay`, `breakOffCombinedHandlePct`, `breakOffCombinedThumbLeftPct`; callbacks `seedBreakOffSliderFromPointerX`, `endBreakOffSliderPointerGesture`, the four pointer handlers, `onBreakOffSliderKeyDown`. Drag moves by **relative pointer delta**, not absolute position (quirk #23).
- **Shared:** `payments` (paid sum), `editing` (+`invoices`, `status`, `pct_complete`), `jobTotalBidDollars`, `error` setter; `newInvoiceAmount` is (re)seeded by `applyEditJob`/refetches via `breakOffPrefillAmountStringFromJob` (80% target, 95% when paid > 80%).
- **Money-path handlers:**
  - `createInvoice()` (~2309): clamps to unallocated remaining (toast "Adjusted to remaining unallocated"); zero remaining rejects; **full-remainder on an RTB job opens Bill Customer instead** (customer-link precheck; three refresh callbacks); else `INSERT jobs_ledger_invoices {status:'ready_to_bill', sequence_order: invoices.length, estimated_bill_date: last_bill_date, is_primary_rtb_bundle:false}` + on RTB jobs re-runs RPC `ensure_single_ready_to_bill_invoice_for_job`; refetch + reseed + `onSaved`. (Jobs Stages' partial-invoice modal copy-pastes this insert+ensure block — BILLING_FLOWS #4.)
  - `moveWorkingJobToReadyToBillFromEdit()` (~2259): requires the amount to equal full remaining exactly; runs `prepareBilledInvoicesBeforeJobRevertToReadyToBill` (Stripe void prep) then RPC **`update_job_status(p_job_id,'ready_to_bill')`**; refetch + reseed + `onSaved`.
- **Stage A:** the four break-off kernels → `lib/jobFormBreakOff.ts` (already pure, already at module scope).
- **Extraction:** after Stage A, `JobFormBreakOffSection` receiving `{editing, payments, jobTotalBidDollars, newInvoiceAmount(+setter+focus)}` and the two action callbacks (which can stay shell-side initially). **High risk** — do late, kernels first.

### 10. Ready to Bill list (edit only)

- **Render location:** h4 "Ready to Bill" when any invoice `status==='ready_to_bill'` (~5041–5126); per-draft "See in Stages" (sets `setReturnEditJobFromStages(editing.id)`, closes, navigates `/jobs?tab=stages&stagesInvoice=…`) and "Preview / Stripe bill…" (customer-link precheck then `billCustomer.openBillCustomer({kind:'invoice', …})` with `onSuccess`/`onAfterEnsureSuccess`/`onAfterOobUnwindSuccess` refetch callbacks).
- **Owned state:** none.
- **Shared:** `editing.invoices`, `billCustomer` context, `refreshEditingJobAndHydratePayments`, `navigate`, `onClose`.
- **Extraction:** small `JobFormReadyToBillList`; can ride along with §9 in one PR.

### 11. Outstanding billing table (edit only)

- **Render location:** h4 "Outstanding billing" when any invoice `status==='billed'` (~5127–5334). Rows: sent date (+`invoiceCreatedCalendarDayOffset` "(+n)"), amount, actions — conditional "See in Stages" (hidden for the single-full-total-invoice case), "Bill" (→ shell `billViewInvoice`), `StripeInvoiceSharePanel` (compact inline variant), "Add discount" (→ shell `agreedWriteDownInvoice`; disabled when billed ≈ paid on that line; role-gated by `canApplyAgreedWriteDown`); detail sub-row for note/memo/footer.
- **Owned state:** none — every action opens shell-owned modal state.
- **Shared:** `editing.invoices`, `payments` (per-invoice paid sum → write-down room), `canApplyAgreedWriteDown` (dev/master/assistant-like/primary), `jobTotalBidDollars`.
- **Related shell effect:** the **Stripe memo/footer backfill** (~642–693): for billed Stripe invoices missing memo/footer, serially invokes edge fn `get-stripe-invoice-details` per invoice then refetches — **reads the raw Stripe mode pref without the dev gate** (BILLING_FLOWS quirk; candidate #19). Keyed by `stripeMemoBackfillKey` memo. Stays in the shell (it's `editing`-level, not render-level).
- **Extraction:** `JobFormOutstandingBillingTable` with `onViewBill(inv)` / `onAddDiscount(inv)` callbacks; tail modals stay shell-side (BilledBillView also opened from §12).

### 12. Payments received table

- **Render location:** h4 "Payments received" (~5337–5810). Renders in **both** modes (new mode = manual rows only). Three row archetypes decided by the lock predicates: **Stripe-locked** (plain-text date via `formatPaymentDateForDisplay`, doc-icon "View Stripe bill" → `billViewInvoice`, read-only amount, read-only Type/Ref/Memo sub-row with `ReadOnlyPaymentRefCopy` clipboard button), **Mercury-locked** ("Mercury" chip, read-only, "Unlink and remove" button when `canUnlinkMercuryPayment(authRole)` and not blocked by a Stripe-hosted invoice), **editable** (date input, `MoneyDecimalAmountInput`, editable Type/Ref/Memo sub-row). The **last non-locked row hosts the +** (`lastUnlockedPaymentIdx`; all-locked → no inline add — quirk #22).
- **Owned state:** `paymentRemoveConfirmRowId`, `paymentRemoveRpcBusy`, `unlinkMercuryConfirmRowId`, `unlinkingMercuryPaymentId`; memos `paymentRemovePreview` (job total / remaining now / remaining after), `paymentRemoveConfirmsPersistedRpc`.
- **Shared:** `payments` + `setPayments` (THE save-engine input), `editing` (lock resolution needs `editing.invoices`), `persistedLedgerPaymentIds` (ids present in the DB row — decides RPC vs form-only removal), `refreshEditingJobAndHydratePayments`.
- **Handlers:** `addPaymentRow`, `updatePaymentRow` (**re-freezes amount/paid_on/ids on locked rows even if updates sneak in** — quirk #21), `removePaymentRow` (refuses locked; empty list → one fresh row), `requestRemovePaymentRow` (toast explanations per lock type; opens confirm), `confirmRemovePaymentRow` — persisted unlocked rows call RPC **`remove_jobs_ledger_payment_and_reconcile(p_payment_id)`** (immediate DB write: recomputes `payments_made`, re-syncs invoice paid↔billed, may demote job paid→billed — see BILLING_FLOWS § Unlink/reconcile) then refetch+rehydrate; unpersisted rows are removed form-only ("click Save to update the database"); `executeUnlinkMercuryFromBankRow`/`confirmUnlinkMercuryFromBankRow` — same RPC for Mercury rows, frees the bank deposit in AR.
- **Stage A:** the lock-predicate family → `lib/jobFormPaymentLocks.ts`; `paymentRowsFromJob`/`newEmptyPaymentRow` → `lib/jobFormRowContent.ts`.
- **Extraction:** `JobFormPaymentsSection` including overlays §16 + §18 (single openers). **High risk** — MONEY-PATH; the RPC handlers can stay shell-side callbacks in the first pass.

### 13. Labor Cost panel (edit only)

- **Render location:** header "Labor Cost" (~5811–5916): Team Labor line (hours · cost · people; "Open on Jobs →" → `/jobs?tab=combined-labor&teamLaborJob=…` gated by `showTeamLaborOpenOnJobsLink`) and Sub Labor line ("Add an HCP to link sub labor" / count · total; "Open on Jobs →" → `/jobs?tab=sub_sheet_ledger&editLabor=<hcp>`).
- **Owned state:** `editJobTeamLaborLoading/Row/Error`, `editJobSubLaborLoading/Data/Error`; loader effect (~1651) keyed on `editing?.id` + `hcpNumber`: team via `loadTeamLaborData(supabase)` filtered to this job; sub labor matches `people_labor_jobs.job_number` **case-insensitively against the effective HCP text**, sums item costs via `laborItemsSubtotal` + drive cost from `app_settings` `drive_mileage_cost`/`drive_time_per_mile` (defaults 0.7 / 0.02) (quirk #26).
- **Shared:** `editJobEffectiveHcp` memo; role gates `canLinkTeamLaborOnJobs` (not assistant-like/superintendent/primary), `canLinkSubLaborOnJobs` (not primary); **the loaded rows also feed the delete gate** (`hasMigrateableCosts`, `costCheckErrored`) and the migrate summary.
- **Supabase:** `people_labor_jobs`, `people_labor_job_items`, `app_settings`; `clock_sessions` etc. inside `loadTeamLaborData`.
- **Extraction:** render → `JobFormLaborCostPanel`; data → `useJobFormLaborCosts` hook **kept in the shell** (delete/migrate read it) with outputs passed down.

### 14. Parts Cost accordions + Other job charges

- **Render location:** header "Parts Cost" (~5917–6155). Edit mode: three read-only `MaterialsCostAccordionRow`s — "Supply house invoices" (lines or the office-roles hint), "Card charges" (Mercury allocations; card nickname via `useMercuryLedgerNicknames`), "Parts from tally". Both modes: "Other job charges" accordion = the **editable `materials` rows** (description/amount, +/trash; last row clears instead of removes — quirk #17). Tail: `JobChargesTimelineStandalone` (edit only, team-labor inclusion by `showJobCostBreakdownTeamLabor(authRole)`).
- **Owned state:** `materialsAccordionOpen` (default `'billed'`), `jobMaterialsSnapshotLoading`, `supplyInvoiceTotal/RpcFailed/Lines`, `mercuryAllocLines/FetchFailed`, `tallyPartLines/FetchFailed`; loader effect (~1609) = `fetchJobMaterialsCostSnapshot(editing.id)`; display memos `billedMaterialsTotalDisplay`, `mercuryCardTotal`, `tallyPartsTotal`, `toggleMaterialsAccordion`.
- **Shared:** `materials` + handlers (`addMaterialRow`/`updateMaterialRow`/`removeMaterialRow`) — save-engine input; **snapshot totals feed the delete gate** (`partsCostStyleTotal`, `hasMigrateableCosts`, `costCheckErrored`) and the migrate preview.
- **Sub-components:** `MaterialsCostAccordionRow` ([`JobFormMaterialsCostAccordion.tsx`](../src/components/jobs/JobFormMaterialsCostAccordion.tsx)) and `JobChargesTimelineStandalone` — already extracted.
- **Extraction:** render → `JobFormPartsCostSection`; snapshot loader → `useJobFormMaterialsSnapshot` hook **kept in the shell** (same reason as §13).

### 15. Footer actions

- **Render location:** ~6156–6221. Delete (edit only, **hidden for role `primary`** — quirk #27) → `deleteJobConfirmOpen`; Cancel → `closeForm`; missing-fields list (`jobFormMissingFields`); Save → `saveJob` (disabled by `jobFormCanSubmit`/`saving`).
- **Extraction:** stays in the shell — it is the shell's own chrome.

### 16–18. Nested confirm overlays (payment remove / Stripe fixture preview / Mercury unlink)

Documented with their owning sections (§12, §7, §12). All render at `JOB_FORM_NESTED_OVERLAY_Z_INDEX` (1011) with busy-guarded backdrop close. The payment-remove copy forks on `paymentRemoveConfirmsPersistedRpc` ("updates the database immediately" vs "click Save"); the Mercury copy warns about double-counting and the paid→billed demote.

### 19–20. Delete confirm + Migrate-and-delete

- **Render location:** §19 h2 "Delete job from Billing?" (~6522–6702); §20 h2 "Migrate costs and delete this job" (~6703–6911, `JOB_FORM_MIGRATE_OVERLAY_Z_INDEX`).
- **Flow:** Delete confirm shows HCP + name and the 90-day restore note (Settings → Data & migration → Recently deleted — the deleted-records archive, see [BILLING_FLOWS § Cleanup](./BILLING_FLOWS.md#cleanup-and-deletion)). Cost gate: `hasMigrateableCosts` (parts snapshot totals, billed materials, team labor, sub labor) or `costCheckErrored` (any cost source failed to load) ⇒ `reassignRequired` — the Delete button is **replaced** by "Reassign to another job…" (no plain-delete escape hatch; while loading, "Checking costs…" disables). Plain path: `confirmDeleteJob` → `deleteJob(id)` = direct `from('jobs_ledger').delete()` (FK cascade + archive trigger per BILLING_FLOWS), `onSaved`, `closeForm`.
- **Migrate modal:** debounced (280ms) RPC **`search_jobs_ledger`** (min 2 chars, excludes self, top 30); selecting a target loads a preview (`fetchJobMaterialsCostSnapshot` + `loadTeamLaborData` for the target); Source/Target summary table; warnings (own invoices/payments deleted with the job; sub labor tracked by HCP is NOT moved); confirm → RPC **`migrate_job_ledger_costs_and_delete(p_from, p_to, p_allow_billed: true)`** → `onSaved` + `closeForm` + verification toast.
- **Owned state:** `deleteJobConfirmOpen`; `migrateJobModalOpen`, `migrateTargetSearch/Candidates/SearchLoading/JobId/PreviewLoading/Preview`, `migratingJob` + the two loader effects (~1769, ~1807); `deletingId` (shell).
- **Extraction:** `JobFormDeleteMigrateModals` — self-contained modal pair whose only inputs are `editing`, the cost-gate values, and `onDeleted`-style callbacks. **Recommended first Stage-B alongside §4.**

### 21. Link-choice / import / create-customer modals

- `JobBidLinkChoiceModal` (extracted): `onLinked` sets `bidId` + `linkedBidSummary` + implies `customerId`; staged (Save to keep). **Stays shell** (openers in §1 and §6).
- `JobFormImportEstimateOrBidModal` (extracted): top of the z-ladder (1013); `onSelectBid`/`onSelectEstimate` → the prefill appliers. **Stays shell** (lifecycle-level).
- `JobProjectLinkChoiceModal` (extracted): `onLinked` sets `projectId` (+implied customer, staged); `onCreateNew` → app-level `newProjectModal` with form-field prefill. **Stays shell.**
- **Create customer from job** (inline, ~6987–7076): Residential/Commercial toggle, similar-customer list (`nameSimilarity ≥ 0.7` or substring, top 10, loaded by effect ~1902 on open), "link instead" → `handleLinkToSimilarCustomer`, create → `handleCreateCustomerFromJob(type)` — resolves the **job's** master for `customers.master_user_id` (edit: `resolveEditJobMasterUserId`; new: `master_assistants` adoption then self — the in-code comment records the orphan-customer incident this fixed), inserts the customer, and in edit mode immediately `UPDATE jobs_ledger SET customer_id` + refetch + `onSaved`. **Moves with §5.**

### 22. Tail modals (shell-owned, multi-section)

- `AgreedWriteDownModal` (opened from §11): props include `paidOnInvoice` (memo `agreedWriteDownInvoicePaidSum`) and `isStripeHosted`; success → `refreshEditingJobAndHydratePayments` + `onSaved`. (Reads the raw Stripe mode pref without the dev gate — BILLING_FLOWS candidate #19.)
- `BilledBillViewModal` (opened from §11 **and** §12): `onAfterStripeDetailsLoaded` → `refetchEditingFromBillView` (merges the refreshed invoice back into `billViewInvoice`); `onAfterOobUnwindSuccess` → rehydrate payments; `onClose` runs a **3-attempt / 280ms retry refetch loop** waiting for memo/footer backfill to land (quirk #10).
- `CustomerAcceptanceRecordModal` (opened from §2).
- All three **stay in the shell** (playbook rule: modal opened from 2+ sections).

---

## Supabase surface (whole modal)

- **Tables read:** `customers`, `projects`, `bids`, `service_types`, `users`, `estimates`, `people_labor_jobs`, `people_labor_job_items`, `app_settings`, `master_assistants`, `jobs_ledger_team_members`; via libs: `jobs_ledger` (+details fetch), materials-snapshot sources, team-labor sources.
- **Tables written:** `jobs_ledger` (update/insert/delete + immediate customer-link updates), `jobs_ledger_payments` / `jobs_ledger_materials` / `jobs_ledger_fixtures` (delete+reinsert in save), `jobs_ledger_team_members` (diff), `jobs_ledger_invoices` (break-off insert), `customers` (insert; `date_met` backfill), `dispatch_requests` (auto-close on pictures link).
- **RPCs:** `next_job_number_suggestion`, `search_jobs_ledger`, `update_job_status` (RTB move + paid→billed demote), `ensure_single_ready_to_bill_invoice_for_job`, `remove_jobs_ledger_payment_and_reconcile`, `migrate_job_ledger_costs_and_delete`.
- **Edge functions:** `get-stripe-invoice-details` (memo/footer backfill); Stripe void-prep via `lib/voidStripeInvoiceForRevert` (inside `prepareBilledInvoicesBeforeJobRevertToReadyToBill`).
- **No realtime channels.** Refresh is refetch-on-action (`fetchJobWithDetailsById`) throughout.

---

## Quirks (preserve, don't fix)

1. **Save delete+reinsert id churn** — payments/materials/fixtures are wholesale deleted and re-inserted with new client UUIDs on every Edit save; locked Stripe/Mercury payment rows ride along. (BILLING_FLOWS #9 / insert-path E.)
2. **Child-row write errors unchecked in `saveJob`** — only the `jobs_ledger` update/insert results are checked; every child delete/insert result is dropped, so a mid-loop failure silently loses rows while `payments_made` already reflects the full form sum.
3. **`payments_made` overwrite** — save sets it to the form-row sum; it has three writers repo-wide and no DB invariant (BILLING_FLOWS #10).
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

**Stage A wave (pure logic → `lib/` + tests; each independently shippable):**

1. `lib/jobFormBreakOff.ts` — the four break-off kernels (money-path math gets tests first).
2. `lib/jobFormPaymentLocks.ts` — the lock-predicate family.
3. `lib/jobFormRowContent.ts` — row types + content predicates + `newJobFormHasBlockingContent` + hydration helpers.
4. `lib/jobFormServiceTypes.ts` + money-input helpers.
5. `lib/jobFormSave.ts` — **payload builders only** (pins the save engine's field semantics under test before anything else moves).

**Stage B wave (components → `src/components/jobs/jobForm*/`):**

6. `JobFormDeleteMigrateModals` (§19+§20) — self-contained, clear inputs.
7. `JobFormPeoplePicker` (§4) — smallest shared surface.
8. `JobFormSourceEstimateBanner` (§2) — vertical slice with its loader + modal.
9. `JobFormIdentityFields` (§3) — controlled, wide-but-shallow props.
10. `JobFormLinksSection` (§6) — refs move with it; link modals stay shell.
11. `JobFormFixturesSection` (§7+§17).
12. `JobFormPartsCostSection` (§14) + `useJobFormMaterialsSnapshot` (hook stays in shell).
13. `JobFormLaborCostPanel` (§13) + `useJobFormLaborCosts` (hook stays in shell).
14. `JobFormCustomerSection` (§5+§21 create-customer) — after the prefill appliers' touch points are catalogued in the PR.
15. `JobFormOutstandingBillingTable` (§11) + `JobFormReadyToBillList` (§10).
16. `JobFormPaymentsSection` (§12+§16+§18) — money-path UI; RPC handlers stay shell callbacks first.
17. `JobFormBreakOffSection` (§9) — last section out.
18. **Save engine seam** (`useJobFormSave` / runner) — the very last move, after 5 pinned the builders; sequence byte-equivalent, transactional TODO documented, no behavior change.

**What stays in the shell permanently:** lifecycle (init/prefill/close/remount contract), all shared form-field state + setters, reference-data caches, `saveJob` orchestration call, footer chrome, the z-index ladder, the three link/import modals, the tail modals (`AgreedWriteDownModal`, `BilledBillViewModal`, `CustomerAcceptanceRecordModal`), the Stripe memo/footer backfill effect, refetch plumbing (`refreshEditingJobAndHydratePayments`, `refetchEditingFromBillView`), and all context wiring.
