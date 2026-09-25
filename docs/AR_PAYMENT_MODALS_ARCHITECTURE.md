# AR Payment Modals (Accounts Receivable + Collect Payment) Architecture Map

---
file: docs/AR_PAYMENT_MODALS_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map (per PAGE_DECOMPOSITION_PLAYBOOK.md) for the two money-in modals — BankPaymentsModal ("Accounts Receivable", 2,618 lines — Mercury deposits applied to billed lines, rebuilt 2026-09-13 around ar/* components + kernels) and CollectPaymentModal (1,655 lines — the field tech's certify → dispatch → customer-pays flow). Inventories every region's state, effects, handlers, RPCs/edge functions and tests, names the shared substrate of each, and sets a value ÷ risk extraction order. Every write here moves or voids money — treat each dossier as "verify against HEAD before cutting".
covers:
  - src/components/jobs/BankPaymentsModal.tsx
  - src/components/jobs/CollectPaymentModal.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-25
---

> **Line numbers are as of `a05cef4c4`** (read from `npm run map` fact sheets generated at `db92699d2`, whose source for both files is byte-identical). They rot — **search the symbol**, then trust the range only as a hint. Regenerate with `npm run map -- <file>`.

## What this surface is

Two sibling modals on the money-in path. They share **no client state and neither imports the other**; they meet only at the `jobs_ledger_invoices` row (a Collect Payment bill is Stripe-hosted; the AR modal may apply a bank deposit to a Stripe-hosted bill only behind the paid-outside-Stripe confirmation, then closes it in Stripe). Domain reference: [`BILLING_FLOWS.md`](./BILLING_FLOWS.md) (Collect Payment steps 1–4; RPC "D" `apply_mercury_bank_payment_allocations`; the Mercury → AR paragraph).

| | [`BankPaymentsModal.tsx`](../src/components/jobs/BankPaymentsModal.tsx) | [`CollectPaymentModal.tsx`](../src/components/jobs/CollectPaymentModal.tsx) |
|---|---|---|
| What the user does | Office picks a Mercury deposit (left list), sees who probably paid, splits it across billed lines or links it to an already-recorded payment, applies (optionally "Apply & next"); batch-applies 1:1 exact matches; turns a leftover into a tip; closes out a non-customer deposit with a reason; marks bounced checks returned | Field tech (sub/helper/superintendent) certifies the job's line items (optionally adds Job Book lines), waits for dispatch approval, then opens/copies/emails the Stripe pay link, fixes the Stripe email, or sends the bill back to the office |
| Lines · components | 2,618 · 1 (`BankPaymentsModal` 180–2618, 2,439) + 5 module fns | 1,655 · 3 (`CollectPaymentModal` 173–1655, 1,483; `CollectPaymentFixturesLineItemsTable` 99–129; `CollectPaymentRefreshIcon` 155–171) + 3 module fns |
| Hook census | **47 useState · 17 effects · 30 useMemo · 12 useCallback · 1 useRef** · 2 custom (`useMercuryLedgerNicknames`, `useToastContext`) | **25 useState · 9 effects · 2 useMemo · 1 useCallback · 2 useRef** · 6 custom (`useAuth`, `useToastContext`, `useId`×3, `useIntervalNowMs`) |
| Churn | 24 commits / 90 d (last a0b9261f8, v2.3795) | 5 commits / 90 d (last 1d2941ac0, v2.2895) |
| Render | 1422–2617 (1,196) | 797–1654 (858) |
| Mounted by | `JobsStagesTab.tsx:4661` (always mounted, `bankPaymentsModalOpen`), `pages/JobsAccountsReceivable.tsx:105` (route **`/accounts-receivable`**, always open, `onClose = goBack`), `dashboard/DashboardArDepositsModal.tsx:39` (always open) + 5 render tests | `dashboard/DashboardTeamReadyToBillSection.tsx:407` only (the "Collect" button, gated `isSubcontractorLikeRole(role) \|\| role === 'superintendent'`) |
| Tables | `mercury_transaction_ar_closed`, `mercury_transactions`, `app_settings`, `mercury_transaction_drag_sort_assignments` (+ embedded `mercury_drag_sort_labels`), `mercury_transaction_ar_income_labels` | `job_book_entries`, `app_settings`; realtime on `job_collect_payment_flows` (not in the fact sheet's Data line — it is a channel, effect 359–386) |
| RPCs | `list_mercury_transactions_for_bank_payments`, `list_unlinked_payments_for_bank_payments`, `list_ar_allocations_for_mercury_transaction`, **`apply_mercury_bank_payment_allocations`**, **`record_job_tip_from_deposit`**, `set_mercury_transaction_ar_closed`, `set_mercury_transaction_ar_returned` | `get_collect_payment_certify_payload`, **`add_collect_payment_fixture_from_job_book`**, **`submit_collect_payment_certification`**, **`return_collect_payment_to_dispatch`** |
| Edge fns | **`record-stripe-invoice-out-of-band-payment`** | `get-stripe-invoice-details`, **`send-stripe-invoice`**, **`update-collect-payment-stripe-customer-email`**, **`void-stripe-invoice-for-revert`** (via `invokeVoidStripeInvoiceForCollectPaymentSendBack`) |

**Bold** = writes money, a bill, or a customer-facing send.

### Props / parent contract

- **`BankPaymentsModalProps`** (160–171, exported): `open`, `onClose`, `authUserId` (legacy sorting-config migration only), `authRole` (every role gate), **`billedRows: StageRow[]`** (the parent's jobs cache → `targets` via `bankPaymentTargetsFromStageRows`, 248 — the modal never loads bills itself), `billedTargetsLoading?` (copy only), **`onApplied`** (parent refetches jobs; awaited after the apply, sweep and tip writes — close-out, reopen and mark-returned call only `refreshList`), `onOpenEditJob?` (applied-breakdown links). Openers into the Jobs Stages instance: PipelineOverview `onOpenAr` (~3208), tools menu key `'accounts-receivable'` (3021; gate dev/master/assistant-like, `stagesSectionToolsMenu.ts:82–86`), billed-section header button (3837; `stagesGates.canRecordArPayments` = the same set as `canApply`), Legal desk "Accounts Receivable" door (`onOpenAccountsReceivable`, 4645), imperative `openBankPayments` (2467) ← **`?openBankPayments=true|1`** (`Jobs.tsx:1106–1142`, gated `canRoleSeeArBankUnallocatedOrgNudge`; Moneyfill's money-queue button), `openMoneyMove('ar')` (2491) ← **`?stagesMove=ar`** (`Jobs.tsx:1084–1104`).
- **`Props`** (Collect, 82–92): `open`, `onClose`, `jobId`, `hcpNumber` + `jobName` (header only), `initialFlowStatus?` (click-time snapshot of the row's `buttonVariant` — avoids a step flash), `onFlowChanged?` (= `refreshAssignedReadyToBill`, a `useCallback` in `hooks/useDashboardAssignedJobs.ts:103`), `stripeModeForBilling` (= `stripeModeForBillingFromRole(role)`; spread into every edge body via `stripeModeInvokeBody`).

### Monster blocks

| File | Block | Lines | Size |
|---|---|---|---|
| Bank | render `!selected ? … : <detail pane>` | 1873–2509 | 637 |
| Bank | ↳ `canAllocateRemaining` (matches, tip, close-out, allocation lines, note) | 2011–2423 | 413 |
| Bank | exact-match sweep panel (`sweepOpen`) | 1589–1733 | 145 |
| Bank | applied breakdown (`consumed > AR_BANK_PAYMENT_CONSUMED_DISPLAY_EPS`) | 1909–2009 | 101 |
| Bank | `submitApply` | 1331–1418 | 88 |
| Collect | `loadingPayload ? … : step === 1 ? … : step === 2 ? … : <step 3>` | 926–1428 | 503 |
| Collect | ↳ step 2 + step 3 (step 3 alone 1128–1427, ~300) | 1098–1428 | 331 |
| Collect | send-back dialog (`sendBackOpen`) | 1536–1651 | 116 |
| Collect | stripe-email effect | 388–468 | 81 |

---

## Master summary table

| Region | Anchor (symbol + lines) | ~Lines | Coupling | Risk | Status |
|---|---|---|---|---|---|
| **B0** Module helpers + constants | `formatMoney` 102, `parseBankPaymentAllocationAmount` 107–112, `allocationAmountStrForTargetChange` 114–124, 4 `AR_BANK_*` EPS consts 127–133, `canRoleApplyBankPayments` 143–145, `listSegStyle` 148–158 | 90 | used by B5/B7/B10/B11 | med (untested money parse) | inline |
| **B1** Chrome: header, bank-transfer details, role banner, Esc | render 1422–1548; Esc effect 827–837; `bankDetailsOpen` 201 | 140 | reads `depositSummary`, `canApply`, `sortingConfig`, mark mode | low | partially extracted (`ArHeaderMenu`, `BankTransferDetailsPanel`) |
| **B2** Org filter + kind badges | `sortingConfig`/`sortingConfigResolved` 191–200, effects 723–752 / 754–779 / 1079–1082, `loadMercurySamplesForConfigModal` 1054–1077, `BankingSortingConfigModal` mount 2585–2615 | 130 | `sortingConfig` → `refreshList`; `kindBadges` → payment_type on every write | med | partially extracted (modal + `bankingSortingConfig`/`bankPaymentsKindBadges` libs) |
| **B3** Deposit list engine *(substrate)* | `candidates`…`selectedId` 207–215, `refreshList` 636–681, `listRequestSeqRef` 618, `loadArClosed` 621–634, `toggleMercuryReturned` 683–721, effects 781 / 786 / 839 / 1046, memos `filteredCandidates` 250–269, `selected` 271–274, `rowStates`/`depositSummary` 414–424, `nextDepositId` 430–433, `candidateById` 452–455 | 170 | read by every region | **high** | inline → hook seam |
| **B4** Deposit list pane | render 1734–1869 minus sweep bar | 95 | writes `selectedId`, `includeHiddenArDeposits`, search | low | partially extracted (`ArDepositRow`) |
| **B5** Exact-match sweep | state 434–441, reset effect 443–450, `sweepPairsPending` 458–460, `applyExactMatchSweep` 462–523, bar 1799–1841, panel 1589–1733 | 270 | reads `exactMatchSweep`, `candidateById`, `targetByKey`, `kindBadges`; calls `onApplied` + `refreshList` | **high** (bulk money write) | partially extracted (kernel `arExactMatchSweep`) |
| **B6** Deposit header, applied breakdown, income label | `ArDepositHeader` 1877–1898, label note 1899–1907, breakdown 1909–2009; `arAllocations*` 224–226 + effects 843 / 851–893; `arIncomeSwitchOn`/`bankLabel` 228–229 + effects 1172–1190 / 1195–1237; `bankLabelNote` 1240 | 250 | `arAllocations` → B8; `bankLabel` → B11 sentence + toast | low (reads) | partially extracted (`ArDepositHeader`, `arBankLabel`, `arAllocationProgress`) |
| **B7** Match assists (payer, quick picks, combo) | memos 348–403, `depositAmountMatchKeys` 526–536, `payerBillCombo` 566–574, `pickTargetIntoLines` 581–598, `applyComboAllocation` 601–610, `ArPayerMatches` 2013–2024 | 100 | writes `allocLines` (B10) | med (suggests amounts) | partially extracted (`ArPayerMatches` + 3 kernels) |
| **B8** Tip offer | `tip*` 231–234, `tipOffer` 899–909, reset effect 912–917, `addTipLine` 919–956, render 2025–2042 | 70 | reads `arAllocations`, `kindPaymentTypeLabel`; `tipOffer` → B11 sentence | med (money write) | partially extracted (`ArTipOffer`, `arTipOffer`) |
| **B9** Close-out + reopen | `close*`/`reopenBusy` 241–246, `closedRow` 963, `closeOutOffer` 964–979, reset effect 981–987, `closeOutDeposit` 989–1021, `reopenDeposit` 1023–1043, render 2043–2062 + `onReopen` 1894 | 100 | `closedById` (B3); `closeOutOffer` → B11 sentence | low-med | partially extracted (`ArCloseOut`, `arCloseOut`) |
| **B10** Allocation lines editor | `allocLines` 216, `recordedPayments` 217 + effect 807–825, `internalNote`/`noteOpen` 218–220, `linkSteerDismissedLineIds` 792, reset effect 794–802, `applyAllocationTarget` 304–320, `setAllocLineKind` 328–332, `applyRecordedPaymentTarget` 335–346, `targetSelectOptions`/`Footer` 544–558, render 2063–2423 | 430 | `allocLines` read by B7/B11; written by B7; `internalNote` read by B11 | **high** | partially extracted (`SearchableSelect`, `ArBilledLineOption`, 2 kernels) |
| **B11** Apply engine + Stripe auto-close + footer | `kindPaymentTypeLabel` 281–284, `paidOnYmdFromMercury` 287–296, `allocationProgress` 425–428, `stripe*` state 1089–1098, memos 1100–1157, `applyDisabled` 1159–1168, `applySentence` 1243–1257, `closeStripeInvoiceOob` 1266–1300, `retryFailedStripeCloses` 1302–1315, `finishApply` 1322–1329, `submitApply` 1331–1418; render 2425–2507 + footer 2512–2579 | 330 | reads everything | **highest** | partially extracted (`arApplySentence`, `arStripeAutoClose`); **stays in parent** |
| **C0** Module scope | types 24–92, `lineTotalDollars` 94–97, `CollectPaymentFixturesLineItemsTable` 99–129, `isValidCollectPaymentEmail` 131–137, `collectPaymentAddFixtureFromJobBookErrorMessage` 139–152, `CollectPaymentRefreshIcon` 155–171 | 150 | table rendered by steps 1 + 3 | low | inline (file-move candidates) |
| **C1** Flow engine *(substrate)* | `step`/`loadingPayload`/`payload` 185–187, `flowStatus` 206, `channelRef` 208, `refreshFlowFromPayload` 231–256, effects 324–357 / 359–386 (realtime) / 489–498 (visibility) | 110 | read by every step | **high** | inline → hook seam |
| **C2** Chrome (dialog, step label, step-3 tools, Close) | render 797–925, footer Close 1430–1454; `stripeDash*` 759–790 | 170 | reads `step`, `role`, collect invoice | low | inline |
| **C3** Step 1 — certify + Job Book | `certifyMode`/`correctionNotes`/`submitting` 203–205, `jobBook*` 212–218, memos 220–229, effects 258–265 / 267–295, `handleAddFromJobBook` 500–525, `handleSubmitCertify` 527–561, render 928–1097, footer submit 1517–1534 | 330 | writes `step`/`flowStatus`; reads `payload` | med (writes fixtures + certification) | inline |
| **C4** Step 2 — awaiting dispatch | render 1098–1127, `dispatchWaitElapsedLabel` 740–744, `dispatchPhone` 207 + effect 297–322, footer phone branch 1472–1516 | 110 | `useIntervalNowMs` tick also feeds C5 | low | inline |
| **C5** Step 3 — customer pays | `emailSending` 188, `stripeEmail*`/`changeEmail*` 190–198, `stripeEmailFetchInvIdRef` 210, effects 388–468 / 470–479, `copyPaymentLink` 619–626, `saveCollectPaymentCustomerEmail` 628–688, `sendInvoiceEmailToCustomer` 690–734, derived 746–757, render 1128–1427 | 520 | reads `payload.collect_invoice`, `stripeModeForBilling` | **high** (customer email + Stripe customer mutation) | inline |
| **C6** Send back to office | `sendBack*` 199–202, effect 481–487, `handleReturnCollectPaymentToDispatch` 563–617, `canSendBackToDispatch` 792–795, footer button 1455–1471, dialog 1536–1651 | 200 | writes `step`/`flowStatus`; reads `payload.collect_invoice`; footer button (parent) writes `sendBackOpen`, reads `sendingBack`; C2's overlay Escape reads/clears `sendBackOpen` + `sendBackNote` | **high** (voids a Stripe invoice) | inline |

---

## Per-region dossiers — BankPaymentsModal

### B0 — Module helpers + constants (89–178)

- **Contents:** types `MercuryCandidateRow`/`MercuryCandidate` (row + `bankReturn`, v2.3795) 89–97, `ArAllocationRow` 99–100, `AllocLine` 178 (`kind: 'billed' | 'payment'`, `targetKey`, `amountStr`); `formatMoney`; **`parseBankPaymentAllocationAmount`** (strips commas + leading `$`, NaN on junk); **`allocationAmountStrForTargetChange`** (`min(target.remaining, max(0, cap − otherPositiveSum))`, `''` when ≤ 0); constants `AR_BANK_PAYMENT_QUICK_MATCH_EPS` 0.02, `…_MAX_OVER` 26, `AR_BANK_PAYMENT_CONSUMED_DISPLAY_EPS` 0.01, `AR_BANK_REMAINING_EPS` 0.0005 (**preserve values**); `BANK_PAYMENTS_SUMMARY_CARD_STYLE`; **`canRoleApplyBankPayments`** (dev · master_technician · assistant-like · primary); `listSegStyle`.
- **Tests:** none. The two amount helpers feed every suggested and submitted amount. **Risk flag: untested money math.**
- **Approach:** Stage A (see inventory). `canRoleApplyBankPayments` has the same body as `canRoleUseArBankCount` in `src/hooks/useArBankUnallocatedCount.ts:7–11` — merge into one lib gate.

### B1 — Chrome (render 1422–1548, Esc 827–837)

- **Render:** dialog `aria-labelledby="accounts-receivable-modal-title"`; `ar-summary` ("N to match · $X unapplied" from `depositSummary`); 🏦 Bank transfer details toggle → `BankTransferDetailsPanel` (`canEdit` dev || master); `ArHeaderMenu` items: **Mark returned deposits** (`canApply` only, toggles `arBankReturnedMarkMode`), **Mercury filter…** (dev only, opens B2); Close; `!canApply` amber banner (1543–1548).
- **Owned state:** `bankDetailsOpen`. **Shared:** `arBankReturnedMarkMode` (read by B4 rows), `sortingConfig` (hint text), `depositSummary`.
- **Tests:** render smoke asserts `ar-summary` text. `ArHeaderMenu`/`BankTransferDetailsPanel` have no tests.
- **Approach:** stays parent chrome. Esc handler (document `keydown`, no one-layer guard for the sweep panel or `BankingSortingConfigModal`) — keep as is during the move.

### B2 — Org filter + kind badges

- **State:** `sortingConfig`, `sortingConfigResolved` (cold-cache hold, 194–200), `sortingConfigModalOpen`, `kindChoices`/`accountChoices`/`debitCardChoices`, `kindBadges` (223).
- **Effects:** 723–752 fetch org config → `resolveSortingConfigAfterFetch` → maybe cache + **dev-only migrate upsert**; 754–779 kind badges (remote wins; dev-only upsert of local); 1079–1082 samples load when the config modal opens (dev).
- **Data:** `app_settings` via `bankingSortingConfig`/`bankPaymentsKindBadges` libs; `mercury_transactions` SELECT `kind, mercury_account_id, raw` limit 5000 (1055–1058).
- **Render:** `BankingSortingConfigModal` 2585–2615 (`onSave` upserts + caches + `refreshList`; `onSaveKindBadges` dev-only).
- **Coupling:** `kindBadges` → `mercuryKindPaymentTypeLabel` → **`p_payment_type` on every apply/sweep/tip write**; also `ArDepositRow`, `ArDepositHeader`.
- **Tests:** `bankingSortingConfig.test.ts` (5), `bankPaymentsKindBadges.test.ts` (8); the effects are untested.
- **Approach:** move into the B3 hook seam (the list fetch waits on `sortingConfigResolved`). The dev menu + modal mount stay parent.

### B3 — Deposit list engine (the substrate — see below)

- **Owned (engine) state:** `candidates`, `bankTxSearchQuery`, `includeHiddenArDeposits`, `arBankReturnedMarkMode`, `returnedToggleSavingId`, `listLoading`, `listError`, `selectedId`, `closedById`; ref `listRequestSeqRef`.
- **Handlers:** `refreshList` 636–681 (fires `loadArClosed`; builds `p_filter` from `sortingConfig` 644–653; RPC `list_mercury_transactions_for_bank_payments`; maps `bankReturn` via `mercuryBankReturnFromRaw`; drops bank-returned rows unless All; keeps or re-picks `selectedId`; seq guard 661/674/679; returns rows for `finishApply`); `toggleMercuryReturned` 683–721 (RPC `set_mercury_transaction_ar_returned`; local list patch after the RPC succeeds (no refetch); `queueMicrotask` re-select; refetch on error); `loadArClosed` 621–634 (`mercury_transaction_ar_closed` limit 5000, quiet on failure).
- **Effects:** 781–784 first fetch after config resolves; 786–789 mark mode off on close; 839–841 search cleared on close; 1046–1052 re-select first filtered row when the search hides the current one.
- **Memos:** `filteredCandidates`, `selected`, `canAllocateRemaining` 276–279, `rowStates` (`arDepositRowStates`), `depositSummary`, `nextDepositId` (`arNextDepositId`), `candidateById`, `exactMatchSweep` 409–412, `targets`/`targetByKey` 248–249 (from the prop).
- **Tests:** kernels `arDepositRowState` (7), `bankReturnedDeposits` (8), `arApplySentence` (`arNextDepositId`); render smokes load the list through a mocked RPC. The seq guard, returned toggle and re-select paths are untested.
- **Approach:** Step 2 seam `useArDepositList({ open, authRole, authUserId, billedRows })` returning one destructured object; `selectedId` + setter exposed (parent still owns the pointer).

### B4 — Deposit list pane (render 1734–1869, minus the sweep bar 1799–1841)

- **Render:** "Deposits" + **To match · All** segmented switch (writes `includeHiddenArDeposits`, which refetches), search input (`bankTxSearchQuery`), empty/error copy, `filteredCandidates.map(ArDepositRow)` with `state={rowStates.get(id) ?? 'hand'}`, `markMode`, `onSelect`, `onToggleReturned`.
- **Owned:** none that isn't engine state. **Tests:** render smoke (`ar-deposit-state` = `exact`, "To match · 1" pressed).
- **Approach:** `ArDepositListPane` once B3 exists (props-only). Low risk.

### B5 — Exact-match sweep (batch apply)

- **Owned state:** `sweepOpen`, `sweepExcluded`, `sweepApplying`, `sweepProgress`, `sweepResults` (434–441); reset-on-close effect 443–450. The bar's "Review & apply…" writes both `sweepOpen` and `sweepResults` (`null`, 1823–1824).
- **Handlers:** `sweepPairsPending` 458–460 (ticked pairs minus prior successes); **`applyExactMatchSweep`** 462–523 — serial loop, per pair RPC `apply_mercury_bank_payment_allocations` with `p_note: ''`, `p_payment_type` from the pair's own `kind`, one allocation `{invoice_id | job_id, amount: amountCents / 100}`, **`p_allow_stripe_hosted: false`**; carries prior `ok` results forward so Retry can't double-apply before the list refreshes (466–470); then `await onApplied()`, `void refreshList()`, auto-close when all ok.
- **Render:** bar 1799–1841 (`canApply && pairs.length > 0`, "Review & apply…"); panel 1589–1733 (table with per-pair checkbox, skipped-as-ambiguous line, "Apply N deposits" / "Retry failed").
- **Tests:** `arExactMatchSweep.test.ts` (7); render smoke opens the panel and un-ticks (Apply disabled). **The apply loop, payload and Retry guard are untested — money risk.**
- **Approach:** `ArExactMatchSweepPanel` owning `sweepExcluded/Applying/Progress/Results` + `applyExactMatchSweep`; props `pairs`, `skipped`, `candidateById`, `targetByKey`, `kindBadges`, `canApply`, `onApplied`, `refreshList`, `onClose`. Keep `sweepOpen` (the bar writes it) in the parent; the bar's `setSweepResults(null)` becomes the panel's reset on open. **Preserve:** `sweepExcluded` survives closing and reopening the panel within one modal session — if the panel unmounts on close, keep `sweepExcluded` in the parent.

### B6 — Deposit header, applied breakdown, applied-means-Income label

- **Render:** `ArDepositHeader` 1877–1898 (name, amount, kind, posted day, returned/closed labels, `onReopen` → B9, `progress = allocationProgress`); `ar-bank-label-note` 1899–1907; **Applied breakdown** 1909–2009 (consumed > 0.01; list of `list_ar_allocations_for_mercury_transaction` rows with `onOpenEditJob` links).
- **Owned state:** `arAllocations`, `arAllocationsLoading`, `arAllocationsError` (224–226; effects 843–849 reset, 851–893 load keyed on `selected?.mercury_transaction_id` + `selected?.consumed`); `arIncomeSwitchOn` (effect 1172–1190, `app_settings` key `AR_APPLIED_INCOME_SETTING_KEY`, once per open), `bankLabel` (effect 1195–1237: `mercury_transaction_drag_sort_assignments` + `mercury_transaction_ar_income_labels`, null on RLS error — "never a wrong clause").
- **Shared out:** `arAllocations` → `tipOffer` (B8); `bankLabel` → `applySentence` + the apply toast (B11). So the loaders stay parent/engine even though only B6 renders them.
- **Tests:** `arBankLabel.test.ts` (7), `arAllocationProgress.test.ts` (5); `BankPaymentsModal.arIncome.render.test.tsx` (2: labelled vs unlabelled). Breakdown list untested.
- **Approach:** file-move the breakdown JSX as `ArAppliedBreakdown` (props: `consumed` (the "Applied to jobs" total, 1912), rows, loading, error, `onOpenEditJob`; carries `formatMoney` + `BANK_PAYMENTS_SUMMARY_CARD_STYLE`) — pure render, first Stage-B win. Loaders move into the seam.

### B7 — Match assists

- **Memos:** `bankPaymentQuickMatchTargets` 348–360 (deposit untouched, window on **`|amount|`**), `depositPayerMatch` 367–377 (`matchArDepositToPayer`), `depositPayerTargets` 380–396 (window on **`remaining_available`**, amount-matches first, top 8), `quickMatchTargetsOutsidePayer` 399–403, `depositAmountMatchKeys` 526–536, `payerBillCombo` 566–574 (`findExactBillCombos`; only when ≥ 2 payer bills, none equals the deposit, exactly one combo); `targetSelectOptions` 544–557 (`orderArBilledLineTargets`, JSX option content) — shared with B10.
- **Callbacks:** `pickTargetIntoLines` 581–598 (first empty billed line or a new line; same amount math as B10), `applyComboAllocation` 601–610 (**replaces** all lines with one per combo bill at full `remaining`).
- **Render:** `ArPayerMatches` 2013–2024 (filters out bills already on a line; combo only when exactly one untouched line).
- **Tests:** `arDepositCustomerMatch` (13), `arPayerBillCombos` (8), `arBilledLineOptions` (9), `jobsStagesBoard.test.ts` (target builders); render smokes: chip row (`render.test`), combo fills two lines (`Combo.render.test`). The three inline amount windows are untested.
- **Approach:** Stage A the windows (inventory #3), then a `useArMatchAssists({ selected, targets, targetByKey })` hook or keep memos in parent — they feed B10 and B11 labels.

### B8 — Tip offer

- **Owned:** `tipJobId`, `tipConfirming`, `tipBusy`, `tipError`; reset effect 912–917 (deps `selected?.mercury_transaction_id`, `tipOffer?.jobId`, `tipOffer?.jobChoices.length`).
- **Memo:** `tipOffer` 899–909 (`buildArTipOffer({ remaining, allocations: arAllocations, returned })`).
- **Handler:** **`addTipLine`** 919–956 — RPC `record_job_tip_from_deposit` (`p_amount: tipOffer.amount`, `p_payment_type`), then **both** `onApplied()` and `refreshList()` (comment 941–943: without the second the strip stays up); `isMissingRpcError` copy.
- **Tests:** `arTipOffer.test.ts` (15). No render smoke; `addTipLine` untested.
- **Approach:** `useArTipOffer` hook (state + effect + handler) or move with `ArTipOffer` as a container; `tipOffer` stays visible to B11.

### B9 — Close-out + reopen

- **Owned:** `closeReason`, `closeNote`, `closeConfirming`, `closeBusy`, `closeError`, `reopenBusy`; reset effect 981–987 (keyed on `closeOutOffer?.suggestedReason`).
- **Memo:** `closeOutOffer` 964–979 (`buildArCloseOutOffer`, **gated on `canApply`**); `closedRow` 963 (render-scope).
- **Handlers:** `closeOutDeposit` 989–1021 (RPC `set_mercury_transaction_ar_closed` with reason + note → toast → `refreshList`); `reopenDeposit` 1023–1043 (same RPC, `p_reason: null`).
- **Tests:** `arCloseOut.test.ts` (10); `BankPaymentsModal.closeOut.render.test.tsx` (3; asserts the RPC args). Reopen untested.
- **Approach:** `useArCloseOut` hook; `closedById` stays in the engine (row chips + header).

### B10 — Allocation lines editor

- **Owned:** `allocLines`, `noteOpen`, `linkSteerDismissedLineIds`; reset effect 794–802 on `[open, selectedId]` (one empty billed line; also clears `noteOpen`, `linkSteerDismissedLineIds`, and `applyError`, `stripeOutOfBandConfirmed`, `stripeCloseResults` — B11 state).
- **Shared:** `internalNote` — written by the note textarea (2408) and cleared by the reset effect (v2.3831), read by B11 (`submitApply`'s `p_note`, `closeStripeInvoiceOob`'s `internal_note` 1281–1284). `recordedPayments` (effect 807–825, RPC `list_unlinked_payments_for_bank_payments`, fail-soft) also read by `rowStates` (B3) and `applyDisabled` (B11).
- **Callbacks:** `applyAllocationTarget`, `setAllocLineKind`, `applyRecordedPaymentTarget`; memo `recordedPaymentById`.
- **Render (2063–2423):** "Allocations"; per line (2072–2374): kind toggle **Billed line · Payment received** (only when `recordedPayments.length > 0`), `SearchableSelect` for recorded payments or billed lines (`noMatchesAction` steers a dead-end search to a recorded payment, v2.2597), picked-line detail, **link-collision steer** (`findRecordedPaymentCollisions`, v2.2591: "Link that payment instead" / "It's a different payment"), amount input (locked for payment lines), remove; "+ Split across another bill", "· Add a note", note textarea (2400–2415).
- **Tests:** `arLinkCollision` (3), `arRecordedPaymentTargets` (7); `BankPaymentsModalLinkGuard.render.test.tsx` (2). Split, remove, manual amount edit untested.
- **Approach:** after Stage A #1–#2, extract `ArAllocationLines` (render + three line callbacks); `allocLines` + setter stay in the parent (B7 and B11 read/write it) and the reset effect stays with them; so does `internalNote` (B11 reads it), and `noteOpen` / `linkSteerDismissedLineIds` go down as value + setter because that effect clears them. **Preserve** the call order `setAllocLineKind` → `applyRecordedPaymentTarget` in the steer and `noMatchesAction` (the kind switch clears `targetKey`, the second updater sets it).

### B11 — Apply engine, Stripe auto-close, footer (stays in parent)

- **Owned:** `applyError`, `applySubmitting`, `stripeOutOfBandConfirmed`, `stripeCloseResults`, `stripeCloseRetrying`.
- **Memos:** `kindPaymentTypeLabel`, `paidOnYmdFromMercury` (company-calendar day from `posted_at` via `denverCalendarDayKey` — the name is historical, zone = `APP_CALENDAR_TZ` America/Chicago), `allocationProgress`, `stripeAllocationSelected`, `stripeAutoCloseLines`, `stripeAutoCloseAll`, **`validationMessage`** 1128–1157, `applyDisabled` 1159–1168 (9 conditions), `applySentence` 1243–1257.
- **Handlers:** **`submitApply(mode)`** 1331–1418 — rebuilds `allocations` (payment lines `{payment_id, amount}`; billed `{invoice_id | job_id, amount}`) in a loop that mirrors `validationMessage` by hand → RPC `apply_mercury_bank_payment_allocations` (`p_paid_on`, `p_payment_type`, `p_note`, **`p_allow_stripe_hosted: stripeAllocationSelected`**) → toast `arAppliedToast` → if Stripe candidates (`arStripeAutoCloseCandidates`) call **`closeStripeInvoiceOob`** (edge `record-stripe-invoice-out-of-band-payment`, `allow_app_paid: true`, note "AR allocation from Mercury deposit …") per invoice → `onApplied()` → `finishApply` (close, or `refreshList` + select `nextDepositId`) or park on the retry panel; `retryFailedStripeCloses` 1302–1315 (closes the modal when all ok).
- **Render:** Stripe paid-outside confirmation 2425–2463; "Allocation applied — but a Stripe invoice could not be closed" retry panel 2464–2504; `applyError`; footer `ar-apply-sentence`, Cancel, **Apply & next ›** (only when `nextDepositId && !applyDisabled`), **Apply $X**.
- **Tests:** `arApplySentence` (15), `arStripeAutoClose` (8); render smoke asserts the sentence and "Apply $1,625.00". **`validationMessage`, the `submitApply` payload, the OOB close, Retry and Apply & next have no test — the core money path is covered only by kernels around it.**
- **Approach:** stays in the parent (reads every region). Stage A #1 (`buildArApplyAllocations`) is the prerequisite for anything else touching B10/B11.

## Per-region dossiers — CollectPaymentModal

### C0 — Module scope (24–171)

- Types `CertifyFixture`, `CertifyInvoice`, `CollectInvoice`, `FlowRow`, `BillingCustomer`, `CertifyPayload`, `JobBookCatalogRow` (24–80), `Props` 82–92. **`lineTotalDollars`** 94–97 (`round(count × unit × 100) / 100`, null unit → 0). `CollectPaymentFixturesLineItemsTable` 99–129 (presentational; rendered at 942 and 1134). `COLLECT_PAYMENT_EMAIL_MAX` 320 + `isValidCollectPaymentEmail`. `collectPaymentAddFixtureFromJobBookErrorMessage` (RPC code → copy). `CollectPaymentRefreshIcon` (FA arrows-rotate SVG).
- **Tests:** none (all three module functions untested; `lineTotalDollars` is money math). **Approach:** the two components file-move verbatim; the functions go to lib (inventory).

### C1 — Flow engine (the substrate — see below)

- **State:** `step: 1 | 2 | 3`, `loadingPayload`, `payload`, `flowStatus` (seeded from `initialFlowStatus`); ref `channelRef`.
- **`refreshFlowFromPayload(setStepFromFlow)`** 231–256 — RPC `get_collect_payment_certify_payload`, silent on error; maps status → step (`approved_for_terminal` → 3, `pending_dispatch` → 2, else 1).
- **Effects:** 324–357 open-load (resets `step`/`certifyMode`/`correctionNotes`, same RPC, same status → step map duplicated at 349–351; deps `[open, jobId, showToast, initialFlowStatus]`); **359–386 realtime** channel `job_collect_payment_${jobId}` on `job_collect_payment_flows` (`filter job_id=eq.<id>`; toast on `approved_for_terminal`; `refreshFlowFromPayload(true)` + `onFlowChanged`); 489–498 `visibilitychange` → refresh.
- **Step writers:** effect 324, `refreshFlowFromPayload`, `handleSubmitCertify`, `handleReturnCollectPaymentToDispatch`.
- **Tests:** none. **Approach:** `useCollectPaymentFlow({ open, jobId, initialFlowStatus, onFlowChanged })` returning `{ step, setStep, loadingPayload, payload, flowStatus, setFlowStatus, refreshFlowFromPayload }`; effect 324–357 also resets C3's `certifyMode`/`correctionNotes`, so the hook needs an on-open reset callback (or that reset stays in the component).

### C2 — Chrome

- **Render:** overlay + dialog 797–858 (title `collect-payment-modal-title`, `{hcpNumber} · {jobName}`; backdrop click → `onClose`; the overlay's `onKeyDown` Escape 810–819 is one-layer — it closes C6's send-back dialog first (reads `sendBackOpen`, clears it and `sendBackNote`), else `onClose`); step-3 tools 859–911 — dev/impersonation **Stripe Dashboard** link (`showStripeDashDevLink = role === 'dev' || isImpersonationSessionActive()`, `stripeDashboardInvoiceUrl`) + refresh button (`refreshFlowFromPayload(true)`); "Step N of 3" 914–924; footer Close 1430–1454.
- **Derived:** `stripeDashButtonStyle` 764–782, `stripeDashTitle`/`AriaLabel` 784–790.
- **Tests:** `impersonationSession.test.ts` (3), `billingStripeModePref.test.ts` (6). **Approach:** stays parent.

### C3 — Step 1: certify + Job Book

- **Owned (moves):** `jobBookAll`, `jobBookLoading`, `addingJobBookEntryId`, `jobBookSearchQuery`, `jobBookSectionExpanded`, two `useId`s. **Shared (stays):** `certifyMode`, `correctionNotes`, `submitting` — read by the footer chain; the first two are also reset by C1's open effect (`submitting` is written only by `handleSubmitCertify`).
- **Memos:** `jobBookFiltered` 220–223 (universal rows = null `service_type_id`), `jobBookSearchRows` 225–229.
- **Effects:** 258–265 reset on close; 267–295 load `job_book_entries` when step 1 + payload.
- **Handlers:** **`handleAddFromJobBook`** 500–525 (RPC `add_collect_payment_fixture_from_job_book` — writes a fixture and recomputes revenue per BILLING_FLOWS; then `refreshFlowFromPayload(false)` + `onFlowChanged`); **`handleSubmitCertify`** 527–561 (RPC `submit_collect_payment_certification`, `p_mode`, `p_correction_notes` only for `correction_requested`; sets `flowStatus = 'pending_dispatch'`, `step = 2`).
- **Render:** draft total 930–941, fixtures table, Job Book disclosure 973–1059, clean/correction choice, correction notes 1081–1096; footer submit 1517–1534.
- **Tests:** none. **Risk:** med. **Approach:** `CollectPaymentCertifyStep` owning the Job Book state, effects and `handleAddFromJobBook` (props: `jobId`, `payload`, `refreshFlowFromPayload`, `onFlowChanged`). `certifyMode`, `correctionNotes`, `submitting` and `handleSubmitCertify` **stay in the parent**: the footer submit button 1517–1534 reads them and C1's open effect resets `certifyMode`/`correctionNotes` — pass them down as value + setter. Moving the button into the step body is a layout change — don't.

### C4 — Step 2: awaiting dispatch

- **Render:** copy + live "Waiting" stopwatch 1098–1127; footer dispatch-phone link 1472–1516 (`FieldDispatchPhoneIcon`).
- **State/effects:** `dispatchPhone` 207 + effect 297–322 (`app_settings` key `APP_SETTINGS_KEY_FIELD_DISPATCH_PHONE`); `dispatchWaitNowMs = useIntervalNowMs(1000)` 211; `dispatchWaitElapsedLabel` 740–744.
- **Tests:** `fieldDispatchPhone.test.ts` (4), `formatElapsedCountUp.test.ts` (5). **Approach:** small; move with the footer chain if the footer is split. The 1 s tick also drives C5's `lastInvoiceEmailSentLabel` (747–750), so it stays in the parent.

### C5 — Step 3: customer pays

- **Owned:** `emailSending`, `stripeEmailResolved`, `stripeEmailLoading`, `stripeEmailError`, `stripeEmailFetchGen`, `changeEmailOpen`/`Draft`/`Baseline`/`Saving`; ref `stripeEmailFetchInvIdRef`.
- **Effects:** 388–468 — edge `get-stripe-invoice-details` (Bearer + `stripeModeInvokeBody`, `AbortController`, clears the label only when the invoice id changes, refetch on `stripeEmailFetchGen` bump); 470–479 clears change-email + send-back state off step 3.
- **Handlers:** `copyPaymentLink` 619–626 (clipboard); **`saveCollectPaymentCustomerEmail`** 628–688 (edge `update-collect-payment-stripe-customer-email`; case-insensitive no-op guard vs baseline; bumps fetch gen); **`sendInvoiceEmailToCustomer`** 690–734 (edge `send-stripe-invoice`; test-mode toast hint).
- **Derived:** `invOkForEmail` (id + status `billed`), `blockEmailSend`, `emailInvoiceDisabled` 751–757.
- **Render (1128–1427):** fixtures table + amount due; Open payment page / Copy payment link (`hosted_invoice_url`); Email invoice + last-sent label; change-email editor 1244–1329; resolved-email line + "Change email" 1330–1395; "Job billing line" mismatch notes 1397–1416; no-link warning 1418–1422.
- **Tests:** `formatCollectPaymentInvoiceEmailLastSentLabel.test.ts` (4); handlers and effect untested. **Risk:** high — a customer-facing send and a Stripe customer mutation. **Approach:** `CollectPaymentPayStep` last among the steps; state + effect 388–468 move with it; effect 470–479 splits (change-email half moves, send-back half stays with C6).

### C6 — Send back to office

- **State:** `sendBackOpen`, `sendBackNote`, `sendingBack`, `sendBackTitleId`; effect 481–487 (reset on close; 470–479 also clears). Not dialog-private: the footer button 1455–1471 writes `sendBackOpen` and reads `sendingBack` (`disabled`); C2's overlay Escape 810–819 reads `sendBackOpen` and clears it and `sendBackNote`.
- **Handler:** **`handleReturnCollectPaymentToDispatch`** 563–617 — note ≥ 3 chars; if the collect invoice is `billed`, **first** `invokeVoidStripeInvoiceForCollectPaymentSendBack` (edge `void-stripe-invoice-for-revert` with `collect_payment_send_back_job_id`), **then** RPC `return_collect_payment_to_dispatch`; sets `flowStatus = 'pending_dispatch'`, `step = 2`.
- **Gate:** `canSendBackToDispatch` 792–795 (step 3, loaded, flow `approved_for_terminal`).
- **Render:** footer "Send back to office" 1455–1471; dialog 1536–1651.
- **Tests:** `voidStripeInvoiceForRevert.test.ts` (12, incl. the send-back variant); the handler is untested. **Approach:** `CollectPaymentSendBackDialog` (dialog JSX + handler + `sendBackNote`; props `open`/`onClose` (`sendBackOpen` stays in the parent with the footer button, the overlay Escape and effect 470–479), `jobId`, `collectInvoice`, `stripeModeForBilling`, `onSentBack` (sets `flowStatus`/`step`, refreshes, `onFlowChanged`), plus `sendingBack` lifted or reported up for the footer's `disabled`) — second Stage-B move.

---

## Shared substrate

**BankPaymentsModal — the in-modal selection pointer + deposit engine.** No URL state and no parent-owned selection: the pointer is `selectedId` (215) → `selected` (271–274), written from **five** places (`refreshList` 667, `toggleMercuryReturned` 706 via `queueMicrotask`, the filtered-list effect 1046–1052, `finishApply` 1328, `ArDepositRow.onSelect` 1864). Everything in B5–B11 keys off `selected`; the reset effect 794–802 and the per-deposit loaders (851, 912, 981, 1195) are keyed on `selectedId` / `selected?.mercury_transaction_id`. The data engine is B2 + B3 (`sortingConfig` → `refreshList` → `candidates`/`closedById`) plus two parent-fed inputs: **`targets`/`targetByKey`** (from the `billedRows` prop) and **`recordedPayments`**. Seam: `useArDepositList` owns B2 + B3 and returns `{ candidates, filteredCandidates, selected, selectedId, setSelectedId, refreshList, closedById, rowStates, depositSummary, nextDepositId, exactMatchSweep, kindBadges, sortingConfig, … }`; `allocLines` + B11 stay in the component.

**CollectPaymentModal — the flow engine (C1).** `payload` + `step` + `flowStatus` + `refreshFlowFromPayload`, driven by the open-load effect, the realtime channel and the visibility refresh. Every step reads `payload`; C3, C6 and C1 write `step`. Seam: `useCollectPaymentFlow`.

**Between the two:** none. Common libs only (`readEdgeFunctionErrorBody`, `withSupabaseRetry`, `useToastContext`); the edge-invoke-and-parse boilerplate is repeated (inventory C-#5).

---

## Stage-A inventory

### Inline pure logic to move (→ `src/lib/**` + colocated `*.test.ts`)

| # | Candidate | Currently | Target |
|---|---|---|---|
| B-1 | **Apply allocation plan** — `validationMessage` 1128–1157 and `submitApply`'s allocation loop 1341–1358 walk `allocLines` twice with hand-mirrored rules (payment line: `abs(amount) > 0`, cap + 0.01; billed: parsed > 0, ≤ `remaining + 0.01`, `invoice_id` else `job_id`; total ≤ deposit remaining + 0.01) | inline ×2, **untested** | `src/lib/jobs/arApplyAllocations.ts` — `buildArApplyAllocations({ lines, targetByKey, paymentById, depositRemaining })` → `{ allocations, validation }` + tests. **Highest leverage: it is the RPC payload.** Fold `stripeAllocationSelected` (1100–1110) in if the diff stays a move |
| B-2 | `parseBankPaymentAllocationAmount` 107–112, `allocationAmountStrForTargetChange` 114–124, the positive-sum reducer duplicated at 307–312 and 588–591 | module fns + inline ×2, untested | `src/lib/jobs/arAllocationAmounts.ts` + tests (commas, `$`, NaN, cap = min(target, deposit left), `''` at ≤ 0) |
| B-3 | Quick-match amount window `[x − 0.01, x + AR_BANK_PAYMENT_QUICK_MATCH_MAX_OVER]` at 356 (x = `|amount|`), 384 and 532 (x = `remaining_available`) + the `bankAbs − remAvail > EPS` guard 352 + payer sort 389–395 | inline ×3 | `src/lib/jobs/arQuickMatch.ts` + tests — **keep the two different x's** |
| B-4 | `payerBillCombo` gate 566–574 | inline | extend `arPayerBillCombos.ts` (`suggestPayerBillCombo`) + tests |
| B-5 | Posted-at → paid-on day: `paidOnYmdFromMercury` 287–296 and the sweep's copy 478–479 | inline ×2 | `mercuryPaidOnYmd(postedAt)` next to `bankReturnedDeposits.ts` + test |
| B-6 | Sweep per-pair payload 489–495 + `sweepPairsPending` 458–460 | inline | `arExactMatchSweep.ts` (`arSweepApplyArgs`, `arSweepPending`) + tests (prior-ok carry) |
| B-7 | `p_filter` build 644–653 | duplicated in `src/hooks/useArBankUnallocatedCount.ts:45–53` | `bankPaymentsListFilter(cfg, { includeHidden })` in `bankingSortingConfig.ts` + test |
| B-8 | `canRoleApplyBankPayments` 143–145 | same body as `canRoleUseArBankCount` (`useArBankUnallocatedCount.ts:7–11`) | one lib gate + test |
| B-9 | `filteredCandidates` predicate 253–268; `toggleMercuryReturned` list patch 696–704; OOB `internal_note` composition 1281–1284; breakdown row words 1944–1954; distinct sets 1065–1076 | inline | small pure fns (`arDepositMatchesSearch`, …) — low value, do opportunistically |
| C-1 | Flow status → step (`approved_for_terminal` 3 / `pending_dispatch` 2 / else 1) at 246–250 and 349–351 | inline ×2 | `src/lib/collectPayment/collectPaymentStep.ts` + test |
| C-2 | `lineTotalDollars` 94–97 | module fn, untested money math | same module + tests (null unit, rounding) — check for an existing fixture-line-total helper first |
| C-3 | `isValidCollectPaymentEmail` + `COLLECT_PAYMENT_EMAIL_MAX` 131–137; `collectPaymentAddFixtureFromJobBookErrorMessage` 139–152 | module fns | same module + tests |
| C-4 | Gates `invOkForEmail`/`blockEmailSend`/`emailInvoiceDisabled` 751–757, `canSendBackToDispatch` 792–795, Job Book filters 220–229 | render-scope / memos | pure predicates + tests |
| C-5 | Edge response parse (`error` string → `success !== true` → value) at 431–453, 657–674, 708–721 (+ `closeStripeInvoiceOob` 1288–1296 in Bank) | inline ×4 across both files | 431–453 (`get-stripe-invoice-details`) → reuse the existing tested `parseStripeInvoiceDetailsResponse` (`src/lib/stripeInvoiceDetailsResponse.ts`, 6 tests; already used by `HostedStripeBillPanel`, `DashboardFieldCollectPaymentQueue`); the other three → `parseEdgeSuccessBody` beside `readEdgeFunctionErrorBody` + tests — `StripeInvoiceSendFromStripeButton` has the same inline check (don't widen scope in one PR) |

### Already extracted (tested — don't re-extract)

`src/lib/jobs/`: `arExactMatchSweep` (7 tests), `arDepositCustomerMatch` (13), `arPayerBillCombos` (8), `arBilledLineOptions` (9), `arDepositRowState` (7), `arAllocationProgress` (5), `arApplySentence` (15, incl. `arNextDepositId`), `arTipOffer` (15), `arCloseOut` (10), `arBankLabel` (7), `arLinkCollision` (3), `bankReturnedDeposits` (8); `src/lib/`: `arRecordedPaymentTargets` (7), `arStripeAutoClose` (8), `bankingSortingConfig` (5), `bankPaymentsKindBadges` (8), `jobsStagesBoard` (target builders), `billingStripeModePref` (6), `voidStripeInvoiceForRevert` (12), `fieldDispatchPhone` (4), `formatElapsedCountUp` (5), `formatCollectPaymentInvoiceEmailLastSentLabel` (4), `impersonationSession` (3). Untested helpers used here: `mercuryRawDebitCard`, `readEdgeFunctionErrorBody`. Components already out: `ar/ArDepositRow` 173, `ArDepositHeader` 118, `ArPayerMatches` 121, `ArTipOffer` 180, `ArCloseOut` 164, `ArHeaderMenu` 118, `ArBilledLineOption` 78, `KindBadgePill` 32, `BankTransferDetailsPanel` 92, `BankingSortingConfigModal` 682 — **none has its own render test**; they are covered only through the 5 `BankPaymentsModal*.render.test.tsx` smokes (9 cases) plus one open smoke in `JobsStagesTab.render.test.tsx` (`openBankPayments` → "Accounts Receivable" renders). `CollectPaymentModal` has **no component test at all** (the opener's `DashboardTeamReadyToBillSection.render.test.tsx` only asserts the Collect button is visible).

---

## Recommended extraction order (value ÷ risk)

> **Timing:** `BankPaymentsModal` is hot (24 commits / 90 d; the returned-deposit train v2.3795 is "PR 1 of 3"). Check `npm run sessions` before any Stage-B move; Stage-A kernels are safe to interleave. `CollectPaymentModal` is quiet (5 / 90 d).

1. **B-1 `buildArApplyAllocations`** + tests — ~45 lines out of `validationMessage`/`submitApply`; kills the hand-mirrored payload.
2. **B-2 + B-3 + B-5 + B-8** amount/window/day/role helpers + tests — ~60 lines out.
3. **C-1…C-3** collect-payment kernels + tests — ~40 lines out.
4. **Verbatim file moves:** `CollectPaymentFixturesLineItemsTable` + `CollectPaymentRefreshIcon` → `src/components/jobs/collectPayment/` — ~50 lines.
5. **`ArAppliedBreakdown`** (B6 render 1909–2009, props-only) — ~100 lines.
6. **`CollectPaymentSendBackDialog`** (C6 dialog + handler + note state; `sendBackOpen` stays parent) — ~180 lines.
7. **B-6 + `ArExactMatchSweepPanel`** (B5; `sweepOpen` + `sweepExcluded` stay parent) — ~220 lines.
8. **`useCollectPaymentFlow`** seam (C1) — ~110 lines.
9. **`CollectPaymentCertifyStep`** (C3, Job Book included) — ~250 lines.
10. **`useArDepositList`** seam (B2 + B3) — ~300 lines; then **`ArDepositListPane`** (B4) — ~95.
11. **`useArTipOffer` + `useArCloseOut`** (B8/B9 state + handlers) — ~70 + ~90.
12. **`ArAllocationLines`** (B10 render + line callbacks; `allocLines` and `internalNote` stay parent) — ~380 lines.
13. **`CollectPaymentPayStep`** (C5) — ~450 lines, last on Collect.
14. **Stays in parent permanently:** B1 chrome + Esc, B11 (apply engine, Stripe auto-close, footer), `allocLines` + its reset effect, `selectedId`; Collect chrome C2, the footer action chain 1430–1534, the 1 s tick.

Gates after every step: `npm run typecheck && npm run lint && npm test`.

---

## Hazards

**Money paths (BankPaymentsModal)**
- Five write endpoints, seven call sites: `apply_mercury_bank_payment_allocations` (manual `submitApply` + serial sweep), `record_job_tip_from_deposit`, `record-stripe-invoice-out-of-band-payment`, `set_mercury_transaction_ar_closed` (close + reopen), `set_mercury_transaction_ar_returned`. The RPC `p_paid_on` is the deposit's posted day — never user-editable (`applyDisabled` requires it).
- **`p_allow_stripe_hosted`** is `stripeAllocationSelected` in `submitApply` (only reachable after the confirmation checkbox) and hard `false` in the sweep. Keep both.
- **Apply first, Stripe close second.** A failed OOB close leaves the allocation standing and parks the modal on the retry panel; `applyDisabled` includes `stripeCloseResults != null`, so a second apply can't fire. `retryFailedStripeCloses` closes the modal on success (no "next").
- **Sweep double-apply guard:** prior `ok` results carry forward (466–470) and `sweepPairsPending` excludes them — preserve when moving.
- **Both refreshes after a write:** `onApplied()` (parent's billed rows → `targets`) and `refreshList()` (deposit remainders). `addTipLine` awaits both; `closeOutDeposit`/`reopenDeposit` only `refreshList`; `submitApply` calls `onApplied` then `finishApply` (which refreshes only for "next").
- `validationMessage` tolerances (+0.01) and the EPS constants are part of the money contract with the server — preserve exactly.

**Money paths (CollectPaymentModal)**
- **Send-back order:** void the Stripe invoice (edge) **before** `return_collect_payment_to_dispatch`. A failure of the RPC after a successful void leaves the invoice voided and the flow not returned — preserve the order; don't swallow either error.
- `send-stripe-invoice` emails the customer; `update-collect-payment-stripe-customer-email` changes the Stripe customer; `add_collect_payment_fixture_from_job_book` changes the bill. Every edge body carries `stripeModeInvokeBody(stripeModeForBilling)` — a move must keep it.

**Role gates**
- Bank: `canApply` (dev · master_technician · assistant-like · primary) gates apply, sweep bar, mark-returned menu, close-out offer (966), line controls. **Not** gated client-side: the tip strip / `addTipLine` (the RPC refuses roles outside dev · master_technician · assistant · primary). Dev-only: Mercury filter menu, kind-badge editor, the config/badge migrate-upserts (741, 767). `BankTransferDetailsPanel` edit: dev || master. Openers gate tighter than `canApply`: tools menu dev/master/assistant-like; `/accounts-receivable` `canRoleSeeArBankUnallocatedOrgNudge`. The bank-label read relies on RLS returning an error → `null` (no clause, never a wrong one).
- Collect: no role gate inside except the dev/impersonation Stripe Dashboard link; the opener's button gate (`isSubcontractorLikeRole || superintendent`) plus server team-membership checks are the real gates.

**Realtime / subscriptions**
- Collect effect 359–386 subscribes `job_collect_payment_${jobId}` with deps `[open, jobId, refreshFlowFromPayload, onFlowChanged, showToast]` — an unstable `onFlowChanged` re-subscribes on every parent render (today it is a `useCallback`). Effect 489–498 refreshes on tab focus. BankPaymentsModal has no realtime.
- `useIntervalNowMs(1000)` re-renders the whole Collect modal every second while open.

**URL deep links**
- Bank: none inside the modal. Outside: route `/accounts-receivable` (always-open page, `onClose = goBack`), `?openBankPayments=true` (`Jobs.tsx` → `JobsStagesTab.openBankPayments`), `?stagesMove=ar` (`Jobs.tsx` → `JobsStagesTab.openMoneyMove`), Dashboard and Quickfill Needs-you "Match deposits" (`DashboardArDepositsModal`, mounted by `DashboardPinnedQuickRow` and `QuickfillNeedsYouSection`). The props contract is the only interface — keep it stable across moves.
- Collect: none.

**Effects whose deps make moves risky**
- Bank 794–802 (`[open, selectedId]`) resets `allocLines`, `internalNote` (v2.3831 — before that a typed note carried to the next deposit's `p_note`, including after Apply & next) **and** B11's Stripe state after selection changes — it flushes after the render that shows the new deposit (the main render smoke waits for `ar-allocation-row` because of this). Splitting `allocLines` into a child changes that timing.
- Bank 781–784 holds the first list fetch until `sortingConfigResolved`; `refreshList` is a `useCallback` over `[open, sortingConfig, includeHiddenArDeposits, loadArClosed]`, so any identity change refetches. `listRequestSeqRef` makes the newest request win — keep it with `refreshList`.
- Bank 912–917 and 981–987 reset the tip / close-out strips on derived keys (`tipOffer?.jobChoices.length`, `closeOutOffer?.suggestedReason`) — carry the exact deps.
- Bank 1195–1237 re-runs per deposit and when `arIncomeSwitchOn` lands; `bankLabel` is read by `submitApply`'s toast.
- Bank Esc handler 827–837 closes the whole modal from `document` with no layer check (sweep panel, sorting-config modal, open `SearchableSelect` lists).
- Collect 324–357 depends on `initialFlowStatus`; it is stable only because the opener passes a click-time snapshot. A live value would reset the step machine and refetch on every parent refresh.
- Collect 388–468 relies on `stripeEmailFetchInvIdRef` (clear only on invoice change) + `stripeEmailFetchGen` (refetch after an email change) + `AbortController`; move all three together.
