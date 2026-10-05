# AR Payment Modals (Accounts Receivable + Collect Payment) Architecture Map

---
file: docs/AR_PAYMENT_MODALS_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map (per PAGE_DECOMPOSITION_PLAYBOOK.md) for the two money-in modals — BankPaymentsModal ("Accounts Receivable", 3,539 lines — Mercury deposits applied to billed lines, rebuilt 2026-09-13 around ar/* components + kernels; returned-check cases and close-out booking added 2026-10-01/02) and CollectPaymentModal (1,652 lines — the field tech's certify → dispatch → customer-pays flow). Inventories every region's state, effects, handlers, RPCs/edge functions and tests, names the shared substrate of each, and sets a value ÷ risk extraction order. Every write here moves or voids money — treat each dossier as "verify against HEAD before cutting".
covers:
  - src/components/jobs/BankPaymentsModal.tsx
  - src/components/jobs/CollectPaymentModal.tsx
mapped_at: f423bd6e5
audience: Developers, AI Agents
last_updated: 2026-10-05
---

> **Line numbers are as of `f423bd6e5`** (read from `npm run map` fact sheets generated at that commit). They rot — **search the symbol**, then trust the range only as a hint. Regenerate with `npm run map -- <file>`.

## What this surface is

Two sibling modals on the money-in path. They share **no client state and neither imports the other**; they meet only at the `jobs_ledger_invoices` row (a Collect Payment bill is Stripe-hosted; the AR modal may apply a bank deposit to a Stripe-hosted bill only behind the paid-outside-Stripe confirmation, then closes it in Stripe). Domain reference: [`BILLING_FLOWS.md`](./BILLING_FLOWS.md) (Collect Payment steps 1–4; RPC "D" `apply_mercury_bank_payment_allocations`; the Mercury → AR paragraph).

| | [`BankPaymentsModal.tsx`](../src/components/jobs/BankPaymentsModal.tsx) | [`CollectPaymentModal.tsx`](../src/components/jobs/CollectPaymentModal.tsx) |
|---|---|---|
| What the user does | Office picks a Mercury deposit (left list), sees who probably paid, splits it across billed lines or links it to an already-recorded payment, applies (optionally "Apply & next"); batch-applies 1:1 exact matches; turns a leftover into a tip; closes out a non-customer deposit with a reason (and books it in Banking); books an applied deposit as Income; marks bounced checks returned; works a check that came back as a case (takes it off its jobs, uses the new check, closes it) | Field tech (sub/helper/superintendent) certifies the job's line items (optionally adds Job Book lines), waits for dispatch approval, then opens/copies/emails the Stripe pay link, fixes the Stripe email, or sends the bill back to the office |
| Lines · components | 3,539 · 1 (`BankPaymentsModal` 218–3539, 3,322) + 6 module fns | 1,652 · 3 (`CollectPaymentModal` 174–1652, 1,479; `CollectPaymentFixturesLineItemsTable` 100–130; `CollectPaymentRefreshIcon` 156–172) + 3 module fns |
| Hook census | **64 useState · 27 effects · 40 useMemo · 16 useCallback · 11 useRef** · 4 custom (`useMercuryLedgerNicknames`, `useToastContext`, `useArReturnCases`, `useModalFullScreen`) | **25 useState · 9 effects · 2 useMemo · 1 useCallback · 2 useRef** · 6 custom (`useAuth`, `useToastContext`, `useId`×3, `useIntervalNowMs`) |
| Churn | 39 commits / 90 d (last da46e8f11, v2.4444) | 7 commits / 90 d (last 711c868f5, v2.4431) |
| Render | 2043–3538 (1,496) | 794–1651 (858) |
| Mounted by | `JobsStagesTab.tsx:4418` (always mounted, `bankPaymentsModalOpen`), `pages/JobsAccountsReceivable.tsx:108` (route **`/accounts-receivable`**, always open, `onClose = goBack`), `dashboard/DashboardArDepositsModal.tsx:39` (always open) + 9 render tests | `dashboard/DashboardTeamReadyToBillSection.tsx:407` only (the "Collect" button, gated `isSubcontractorLikeRole(role) \|\| role === 'superintendent'`) |
| Tables | `mercury_transaction_ar_closed`, `mercury_transactions`, `app_settings`, `mercury_transaction_drag_sort_assignments` (+ embedded `mercury_drag_sort_labels`), `mercury_transaction_ar_income_labels` | `job_book_entries`, `app_settings`; realtime on `job_collect_payment_flows` (not in the fact sheet's Data line — it is a channel, effect 360–387) |
| RPCs | `list_mercury_transactions_for_bank_payments`, `list_unlinked_payments_for_bank_payments`, `list_ar_allocations_for_mercury_transaction`, **`apply_mercury_bank_payment_allocations`**, **`record_job_tip_from_deposit`**, **`set_mercury_transaction_ar_closed`**, **`set_mercury_transaction_ar_returned`**; called through `as never` or a string, so missing from the fact sheet's Data line: `list_ar_deposit_trails`, `ar_deposit_booking`, **`close_out_ar_deposit`**, **`ar_book_applied_deposit_income`**, **`take_returned_check_off_jobs`**, **`close_ar_return_case`**, **`remove_jobs_ledger_payment_and_reconcile`**; inside `useArReturnCases`: `list_ar_return_cases`, `list_ar_deposit_trails` | `get_collect_payment_certify_payload`, **`add_collect_payment_fixture_from_job_book`**, **`submit_collect_payment_certification`**, **`return_collect_payment_to_dispatch`** |
| Edge fns | **`record-stripe-invoice-out-of-band-payment`** | `get-stripe-invoice-details`, **`send-stripe-invoice`**, **`update-collect-payment-stripe-customer-email`**, **`void-stripe-invoice-for-revert`** (via `invokeVoidStripeInvoiceForCollectPaymentSendBack`) |

**Bold** = writes money, a bill, or a customer-facing send.

### Props / parent contract

- **`BankPaymentsModalProps`** (188–201, exported): `open`, `onClose`, `authUserId` (legacy sorting-config migration only), `authRole` (every role gate), **`billedRows: StageRow[]`** (the parent's jobs cache → `targets` via `bankPaymentTargetsFromStageRows`, 318 — the modal never loads bills itself), `billedTargetsLoading?` (copy only), **`onApplied`** (parent refetches jobs; awaited after the apply, sweep and tip writes and after a case's payments come off a job — close-out, reopen, Book it as Income, mark-returned and a case close call only the modal's own refreshes), `onOpenEditJob?` (applied-breakdown links, and the case pane's job links), `initialDepositId?` (the deposit or case to select once it has loaded — only the route passes it, from `?check=`). Openers into the Jobs Stages instance: PipelineOverview `onOpenAr` (2966), tools menu key `'accounts-receivable'` (2926; gate dev/master/assistant-like, `canOpenAccountsReceivable` at `stagesSectionToolsMenu.ts:88`), billed-section header button (3637; `stagesGates.canRecordArPayments` = the same set as `canApply`), Legal desk "Accounts Receivable" door (`onOpenAccountsReceivable`, 4402), imperative `openBankPayments` (2329) ← **`?openBankPayments=true|1`** (`Jobs.tsx:1108–1144`, gated `canRoleSeeArBankUnallocatedOrgNudge`; Moneyfill's money-queue button), `openMoneyMove('ar')` (2338) ← **`?stagesMove=ar`** (`Jobs.tsx:1085–1106`). The Stages instance's `onClose` also calls `reloadBankReturned()`.
- **`Props`** (Collect, 83–93): `open`, `onClose`, `jobId`, `hcpNumber` + `jobName` (header only), `initialFlowStatus?` (click-time snapshot of the row's `buttonVariant` — avoids a step flash), `onFlowChanged?` (= `refreshAssignedReadyToBill`, a `useCallback` in `hooks/useDashboardAssignedJobs.ts:103`), `stripeModeForBilling` (= `stripeModeForBillingFromRole(role)`; spread into every edge body via `stripeModeInvokeBody`).

### Monster blocks

| File | Block | Lines | Size |
|---|---|---|---|
| Bank | render `selectedCaseView ? <case pane> : !selected ? … : <detail pane>` | 2660–3415 | 756 |
| Bank | ↳ `canAllocateRemaining` (matches, tip, close-out, allocation lines, note) | 2905–3329 | 425 |
| Bank | exact-match sweep panel (`sweepOpen`) | 2230–2374 | 145 |
| Bank | applied breakdown (`consumed > AR_BANK_PAYMENT_CONSUMED_DISPLAY_EPS`) | 2770–2870 | 101 |
| Bank | `submitApply` | 1829–1922 | 94 |
| Collect | `loadingPayload ? … : step === 1 ? … : step === 2 ? … : <step 3>` | 923–1425 | 503 |
| Collect | ↳ step 2 + step 3 (step 3 alone 1125–1424, ~300) | 1095–1425 | 331 |
| Collect | send-back dialog (`sendBackOpen`) | 1533–1648 | 116 |
| Collect | stripe-email effect | 389–469 | 81 |

---

## Master summary table

| Region | Anchor (symbol + lines) | ~Lines | Coupling | Risk | Status |
|---|---|---|---|---|---|
| **B0** Module helpers + constants | `formatMoney` 130, `parseBankPaymentAllocationAmount` 135–140, `allocationAmountStrForTargetChange` 142–152, 4 `AR_BANK_*` EPS consts 155–161, `canRoleApplyBankPayments` 171–173, `listSegStyle` 176–186, `arDepositClearsNote` 211–216 | 100 | used by B4/B5/B7/B10/B11 | med (untested money parse) | inline |
| **B1** Chrome: header, bank-transfer details, role banner, full screen, Esc | render 2043–2189; Esc effect 1159–1169; `bankDetailsOpen` 240; `useModalFullScreen` 2039 | 170 | reads `depositSummary`, `caseViews`, `canApply`, `sortingConfig`, mark mode | low | partially extracted (`ArHeaderMenu`, `BankTransferDetailsPanel`, `ModalFullScreenToggle`) |
| **B2** Org filter + kind badges | `sortingConfig` 230, `sortingConfigResolved` 237, effects 1039–1068 / 1070–1095 / 1544–1547, `loadMercurySamplesForConfigModal` 1519–1542, `BankingSortingConfigModal` mount 3506–3536 | 130 | `sortingConfig` → `refreshList` + the hidden-rows fetch; `kindBadges` → payment_type on every write | med | partially extracted (modal + `bankingSortingConfig`/`bankPaymentsKindBadges` libs) |
| **B3** Deposit list engine *(substrate)* | `candidates` 246 … `selectedId` 267, `refreshList` 809–858, `listRequestSeqRef` 791, `loadArClosed` 794–807, `toggleMercuryReturned` 999–1037, effects 1097 / 1102 / 1171 / 1474 / 1486; search + All rows: `search` 321–330, `hiddenCandidates` 254 + effect 867–902, `allGroups` 335–346, `orderedFiltered` 348; trails `trailsById` 260 + effect 909–950; row labels `rowLabelsById` 315 + effect 958–997; memos `selected` 350–358, `rowStates` 576–585, `elsewhereStates` 587–596, `depositSummary` 597, `nextDepositId` 603–606, `candidateById` 625–628; narrow layout `bodyRef` 426, `mobilePane` 428, `selectRow` 430–433, effects 1500–1514 / 1515–1517 | 420 | read by every region | **high** | inline → hook seam (search, All order, trail kernels out) |
| **B4** Deposit list pane | render 2386–2656 minus the mark-ask 2423–2463, the sweep bar 2483–2525 and the Came back group 2530–2564 | 150 | writes `selectedId` (through `selectRow`), `includeHiddenArDeposits`, search | low | partially extracted (`ArDepositRow`) |
| **B5** Exact-match sweep | state 607–614, reset effect 616–623, `sweepPairsPending` 631–633, `applyExactMatchSweep` 635–696, bar 2483–2525, panel 2230–2374 | 270 | reads `exactMatchSweep`, `candidateById`, `targetByKey`, `kindBadges`; calls `onApplied` + `refreshList` | **high** (bulk money write) | partially extracted (kernel `arExactMatchSweep`) |
| **B6** Deposit header, applied breakdown, income label + Book it as Income | `ArDepositHeader` 2690–2713, income fix / label note 2714–2768, breakdown 2770–2870; `arAllocations` 276 + effects 1175 / 1183–1225; `arIncomeSwitchOn` 280, `bankLabel` 281, `bankLabelSeq` 283 + effects 1637–1655 / 1660–1702; `bankLabelNote` 1705, `appliedIncomeFix` 1708–1714, `bookAppliedIncome` 1716–1737 | 320 | `arAllocations` → B8; `bankLabel` → B9's booking read + B11 sentence + toast; `closeBooking` (B9) → the fix's rule line | med (one Banking write) | partially extracted (`ArDepositHeader`, `arBankLabel`, `arAllocationProgress`) |
| **B7** Match assists (payer, quick picks, combo) | memos 510–565, `depositAmountMatchKeys` 699–709, `payerBillCombo` 739–747, `pickTargetIntoLines` 754–771, `applyComboAllocation` 774–783, `ArPayerMatches` 2908–2918 | 100 | writes `allocLines` (B10) | med (suggests amounts) | partially extracted (`ArPayerMatches` + 3 kernels) |
| **B8** Tip offer | `tipJobId` 286 … `tipError` 289, `tipOffer` 1231–1241, reset effect 1244–1249, `addTipLine` 1251–1288, render 2919–2936 | 70 | reads `arAllocations`, `kindPaymentTypeLabel`; `tipOffer` → B11 sentence | med (money write) | partially extracted (`ArTipOffer`, `arTipOffer`) |
| **B9** Close-out (books it in Banking) + reopen | `closeReason` 296 … `reopenBusy` 301, `closeBooking` 307 … `closeChanging` 311, `closeReasonTouchedRef` 313, `closedRow` 1295, `closeOutOffer` 1296–1311, reset effect 1313–1322, booking effect 1329–1358, `closeBookingView` 1361–1374, `forgetRowLabel` 1377–1385, `closeOutDeposit` 1387–1446, `reopenDeposit` 1448–1471, render 2937–2968 + `onReopen` 2709 | 220 | `closedById` (B3); `closeOutOffer` → B11 sentence; `closeBooking` → B6 | med (labels the deposit in Banking) | partially extracted (`ArCloseOut`, `arCloseOut`, `arCloseBooking`) |
| **B10** Allocation lines editor | `allocLines` 268, `recordedPayments` 269 + effect 1139–1157, `internalNote` 270, `noteOpen` 272, `linkSteerDismissedLineIds` 1108, reset effect 1110–1121, `applyAllocationTarget` 466–482, `setAllocLineKind` 490–494, `applyRecordedPaymentTarget` 497–508, `targetSelectOptions` 717–730, `targetSelectFooter` 731, render 2969–3323 | 430 | `allocLines` read by B7/B11; written by B7 and B12; `internalNote` read by B11 | **high** | partially extracted (`SearchableSelect`, `ArBilledLineOption`, 2 kernels) |
| **B11** Apply engine + Stripe auto-close + footer | `kindPaymentTypeLabel` 367–370, `paidOnYmdFromMercury` 373–382, `allocationProgress` 598–601, `stripeOutOfBandConfirmed` 1554 … `stripeCloseRetrying` 1563, memos 1565–1622, `applyDisabled` 1624–1633, `applySentence` 1740–1755, `closeStripeInvoiceOob` 1764–1798, `retryFailedStripeCloses` 1800–1813, `finishApply` 1820–1827, `submitApply` 1829–1922; render 3331–3413 + footer 3418–3487 | 340 | reads everything | **highest** | partially extracted (`arApplySentence`, `arStripeAutoClose`); **stays in parent** |
| **B12** Returned-check cases | `useArReturnCases` 388, `caseViews` 390–393, `caseIdsRef` 395 + effect 396–398, `caseViewsShown` 399–404, `selectedCaseView` 405, `caseReplacement` 407–410, `depositReplacesCase` 412–415, `caseBusy` 416, `replacingRef` 420, `pendingPrefillRef` 422, `markAsk` 424, `fillReplacementLines` 439–461, prefill effect 1124–1134, `runCaseRpc` 1927–1933 … `requestToggleReturned` 2030–2036; render: mark-ask 2423–2463, Came back group 2530–2564, `ArReturnCasePane` 2661–2676, replacement note 2872–2892, came-back note 2893–2903, `SetPromisedPayDateModal` 3493–3504 | 330 | case ids share `selectedId` (B3); writes `allocLines` (B10); `replacingRef` read by `submitApply` (B11); calls `refreshList`, `onApplied` | **high** (takes payments off jobs) | partially extracted (`useArReturnCases`, `arReturnCase`, `ArReturnCasePane`, `ArReturnCaseRow`) |
| **C0** Module scope | types 25–93, `lineTotalDollars` 95–98, `CollectPaymentFixturesLineItemsTable` 100–130, `isValidCollectPaymentEmail` 134–138, `collectPaymentAddFixtureFromJobBookErrorMessage` 140–153, `CollectPaymentRefreshIcon` 156–172 | 150 | table rendered by steps 1 + 3 | low | inline (file-move candidates) |
| **C1** Flow engine *(substrate)* | `step` 186, `loadingPayload` 187, `payload` 188, `flowStatus` 207, `channelRef` 209, `refreshFlowFromPayload` 232–257, effects 325–358 / 360–387 (realtime) / 490–499 (visibility) | 110 | read by every step | **high** | inline → hook seam |
| **C2** Chrome (dialog, step label, step-3 tools, Close) | render 794–922, footer Close 1427–1451; `stripeDash*` 756–787 | 170 | reads `step`, `role`, collect invoice | low | inline |
| **C3** Step 1 — certify + Job Book | `certifyMode` 204, `correctionNotes` 205, `submitting` 206, `jobBook*` 213–219, memos 221–230, effects 259–266 / 268–296, `handleAddFromJobBook` 501–526, `handleSubmitCertify` 528–562, render 925–1094, footer submit 1514–1531 | 330 | writes `step`/`flowStatus`; reads `payload` | med (writes fixtures + certification) | inline |
| **C4** Step 2 — awaiting dispatch | render 1095–1124, `dispatchWaitElapsedLabel` 737–741, `dispatchPhone` 208 + effect 298–323, footer phone branch 1469–1513 | 110 | `useIntervalNowMs` tick also feeds C5 | low | inline |
| **C5** Step 3 — customer pays | `emailSending` 189, `stripeEmail*`/`changeEmail*` 191–199, `stripeEmailFetchInvIdRef` 211, effects 389–469 / 471–480, `copyPaymentLink` 620–627, `saveCollectPaymentCustomerEmail` 629–689, `sendInvoiceEmailToCustomer` 691–731, derived 743–754, render 1125–1424 | 520 | reads `payload.collect_invoice`, `stripeModeForBilling` | **high** (customer email + Stripe customer mutation) | inline |
| **C6** Send back to office | `sendBack*` 200–203, effect 482–488, `handleReturnCollectPaymentToDispatch` 564–618, `canSendBackToDispatch` 789–792, footer button 1452–1468, dialog 1533–1648 | 200 | writes `step`/`flowStatus`; reads `payload.collect_invoice`; footer button (parent) writes `sendBackOpen`, reads `sendingBack`; C2's overlay Escape reads/clears `sendBackOpen` + `sendBackNote` | **high** (voids a Stripe invoice) | inline |

---

## Per-region dossiers — BankPaymentsModal

### B0 — Module helpers + constants (117–216)

- **Contents:** types `MercuryCandidateRow` 117–118, `MercuryCandidate` 125 (row + `bankReturn`, v2.3795), `ArAllocationRow` 127–128, `AllocLine` 208 (`kind: 'billed' | 'payment'`, `targetKey`, `amountStr`); `formatMoney`; **`parseBankPaymentAllocationAmount`** (strips commas + leading `$`, NaN on junk); **`allocationAmountStrForTargetChange`** (`min(target.remaining, max(0, cap − otherPositiveSum))`, `''` when ≤ 0); constants `AR_BANK_PAYMENT_QUICK_MATCH_EPS` 0.02, `…_MAX_OVER` 26, `AR_BANK_PAYMENT_CONSUMED_DISPLAY_EPS` 0.01, `AR_BANK_REMAINING_EPS` 0.0005 (**preserve values**); `BANK_PAYMENTS_SUMMARY_CARD_STYLE`; **`canRoleApplyBankPayments`** (dev · master_technician · assistant-like · primary); `listSegStyle`; `arDepositClearsNote` (the row's "clears about …" words over `depositClearsYmd` from the tested `checkClearing.ts`, v2.4333).
- **Tests:** none of their own. The two amount helpers feed every suggested and submitted amount. **Risk flag: untested money math.**
- **Approach:** Stage A (see inventory). `canRoleApplyBankPayments` has the same body as `canRoleUseArBankCount` in `src/hooks/useArBankUnallocatedCount.ts:7–11` — merge into one lib gate.

### B1 — Chrome (render 2043–2189, Esc 1159–1169)

- **Render:** dialog `aria-labelledby="accounts-receivable-modal-title"`; `ar-summary` ("N came back · " when there are cases, then "N to match · $X unapplied" from `depositSummary` or "nothing to match"); 🏦 Bank transfer details toggle → `BankTransferDetailsPanel` (`canEdit` dev || master); `ArHeaderMenu` items: **Mark returned deposits** (`canApply` only, toggles `arBankReturnedMarkMode`), **Mercury filter…** (dev only, opens B2); `ModalFullScreenButton` (v2.4065, key `accounts-receivable`; full screen the overlay ends above the app's bottom bar and starts below the top chrome); Close; `!canApply` amber banner (2184–2189).
- **Owned state:** `bankDetailsOpen`. **Shared:** `arBankReturnedMarkMode` (read by B4 rows), `sortingConfig` (hint text), `depositSummary`, `caseViews` (B12).
- **Tests:** render smoke asserts `ar-summary` text and the full-screen toggle (2 cases in `BankPaymentsModal.render.test.tsx`). `ArHeaderMenu`/`BankTransferDetailsPanel`/`ModalFullScreenToggle` have no tests of their own.
- **Approach:** stays parent chrome. Esc handler (document `keydown`, no one-layer guard for the sweep panel, the mark-ask, `SetPromisedPayDateModal` or `BankingSortingConfigModal`) — keep as is during the move.

### B2 — Org filter + kind badges

- **State:** `sortingConfig`, `sortingConfigResolved` (cold-cache hold, 233–239), `sortingConfigModalOpen`, `kindChoices`/`accountChoices`/`debitCardChoices`, `kindBadges` (275).
- **Effects:** 1039–1068 fetch org config → `resolveSortingConfigAfterFetch` → maybe cache + **dev-only migrate upsert**; 1070–1095 kind badges (remote wins; dev-only upsert of local); 1544–1547 samples load when the config modal opens (dev).
- **Data:** `app_settings` via `bankingSortingConfig`/`bankPaymentsKindBadges` libs; `mercury_transactions` SELECT `kind, mercury_account_id, raw` limit 5000 (1520–1523).
- **Render:** `BankingSortingConfigModal` 3506–3536 (`onSave` upserts + caches + `refreshList`; `onSaveKindBadges` dev-only).
- **Coupling:** `kindBadges` → `mercuryKindPaymentTypeLabel` → **`p_payment_type` on every apply/sweep/tip write**; also `ArDepositRow`, `ArDepositHeader`.
- **Tests:** `bankingSortingConfig.test.ts` (5), `bankPaymentsKindBadges.test.ts` (8); the effects are untested.
- **Approach:** move into the B3 hook seam (the list fetch waits on `sortingConfigResolved`). The dev menu + modal mount stay parent.

### B3 — Deposit list engine (the substrate — see below)

- **Owned (engine) state:** `candidates`, `bankTxSearchQuery`, `includeHiddenArDeposits`, `hiddenCandidates`, `hiddenLoading`, `trailsById`, `arBankReturnedMarkMode`, `returnedToggleSavingId`, `listLoading`, `listError`, `selectedId`, `closedById`, `rowLabelsById`, `bodyWidth`, `mobilePane`; refs `listRequestSeqRef`, `hiddenInFlightRef`, `hiddenFetchSeqRef`, `trailsUnavailableRef`, `rowLabelsFetchedRef`, `bodyRef`, `initialAppliedRef`.
- **Handlers:** `refreshList` 809–858 (fires `loadArClosed`; clears `hiddenCandidates` and `trailsById`; builds `p_filter` from `sortingConfig` 819–829; RPC `list_mercury_transactions_for_bank_payments`; maps `bankReturn` via `mercuryBankReturnFromRaw`; drops bank-returned rows unless All; keeps `selectedId` when it is still listed or is a case id, else re-picks the first row; seq guard 837/851/856; returns rows for `finishApply`); `toggleMercuryReturned` 999–1037 (RPC `set_mercury_transaction_ar_returned`; local list patch after the RPC succeeds (no refetch); `queueMicrotask` re-select; refetch on error; reached only through B12's `requestToggleReturned` and the mark-ask's Yes); `loadArClosed` 794–807 (`mercury_transaction_ar_closed` limit 5000, quiet on failure); `selectRow` 430–433 (every row click: sets `selectedId` and opens the pane on a narrow window).
- **Effects:** 1097–1100 first fetch after config resolves; 1102–1105 mark mode off on close; 1171–1173 search cleared on close; 1474–1482 keeps a selection that is still in the list, in the found-in-All rows or a case, else picks the first row shown; 1486–1497 selects `initialDepositId` once it has loaded; 867–902 the All rows behind a To match search (v2.4273: same RPC with `includeHiddenArDeposits`, fetched once per refresh, own seq ref, quiet on failure); 909–950 the trail under every row (v2.4277: `list_ar_deposit_trails`, 500 ids a call, quiet when the RPC is missing); 958–997 the Banking label of each untouched row (v2.4363, `mercury_transaction_drag_sort_assignments`, 150 ids a read); 1500–1514 measures the body, 1515–1517 resets `mobilePane` on close (`narrow` = body under 640 px, 429).
- **Memos:** `search` (`arSearchFallThrough` → `filteredCandidates` 331, `foundElsewhere` 333), `allGroups` (`orderArAllByLastAction`, under All only), `orderedFiltered`, `selected` (looks in `candidates`, then `foundElsewhere`), `canAllocateRemaining` 362–365 (false for a deposit that came back), `rowStates` (`arDepositRowStates`), `elsewhereStates`, `depositSummary` (`arDepositSummaryWords`), `nextDepositId` (`arNextDepositId` over `orderedFiltered`), `candidateById`, `exactMatchSweep` 571–574, `targets` 318, `targetByKey` 319 (from the prop).
- **Tests:** kernels `arDepositRowState` (7), `bankReturnedDeposits` (18), `arDepositSearch` (8), `arAllByLastAction` (4), `arDepositTrail` (11), `arApplySentence` (`arNextDepositId`); render smokes load the list through a mocked RPC, and `cameBack.render.test` finds a check under All. The seq guards and the re-select paths are untested.
- **Approach:** Step 2 seam `useArDepositList({ open, authRole, authUserId, billedRows, initialDepositId })` returning one destructured object; `selectedId` + setter exposed (parent still owns the pointer, and B12's case ids live in it too).

### B4 — Deposit list pane (render 2386–2656, minus the mark-ask 2423–2463, the sweep bar 2483–2525 and the Came back group 2530–2564)

- **Render:** "Deposits" + **To match · All** segmented switch (writes `includeHiddenArDeposits`, which refetches), search input (`bankTxSearchQuery`), empty/error copy, the rows as one group or, under All, under a heading per day (`allGroups`, 2580–2620) — `ArDepositRow` with `state={rowStates.get(id) ?? 'hand'}`, `trail`, `cameBackNote` (`arPayerCameBackNote`), `clearsNote`, `bookedNote` (`arRowBookedLine`), `markMode`, `onSelect`, `onToggleReturned`; then "Looking in All…" and the found-in-All heading and rows (2622–2654). The pane hides on a narrow window while the detail pane shows.
- **Owned:** none that isn't engine state. **Tests:** render smoke (`ar-deposit-state` = `exact`, "To match · 1" pressed).
- **Approach:** `ArDepositListPane` once B3 exists (props-only). Low risk.

### B5 — Exact-match sweep (batch apply)

- **Owned state:** `sweepOpen`, `sweepExcluded`, `sweepApplying`, `sweepProgress`, `sweepResults` (607–614); reset-on-close effect 616–623. The bar's "Review & apply…" writes both `sweepOpen` and `sweepResults` (`null`, 2507–2508).
- **Handlers:** `sweepPairsPending` 631–633 (ticked pairs minus prior successes); **`applyExactMatchSweep`** 635–696 — serial loop, per pair RPC `apply_mercury_bank_payment_allocations` with `p_note: ''`, `p_payment_type` from the pair's own `kind`, one allocation `{invoice_id | job_id, amount: amountCents / 100}`, **`p_allow_stripe_hosted: false`**; carries prior `ok` results forward so Retry can't double-apply before the list refreshes (639–643); then `await onApplied()`, `void refreshList()`, auto-close when all ok.
- **Render:** bar 2483–2525 (`canApply && pairs.length > 0`, "Review & apply…"); panel 2230–2374 (table with per-pair checkbox, skipped-as-ambiguous line, "Apply N deposits" / "Retry failed").
- **Tests:** `arExactMatchSweep.test.ts` (7); render smoke opens the panel and un-ticks (Apply disabled). **The apply loop, payload and Retry guard are untested — money risk.**
- **Approach:** `ArExactMatchSweepPanel` owning `sweepExcluded/Applying/Progress/Results` + `applyExactMatchSweep`; props `pairs`, `skipped`, `candidateById`, `targetByKey`, `kindBadges`, `canApply`, `onApplied`, `refreshList`, `onClose`. Keep `sweepOpen` (the bar writes it) in the parent; the bar's `setSweepResults(null)` becomes the panel's reset on open. **Preserve:** `sweepExcluded` survives closing and reopening the panel within one modal session — if the panel unmounts on close, keep `sweepExcluded` in the parent.

### B6 — Deposit header, applied breakdown, applied-means-Income label

- **Render:** `ArDepositHeader` 2690–2713 (name, amount, kind, posted day, returned/closed labels — the closed label names the Banking label from B9's `closeBooking` —, `onReopen` → B9, `progress = allocationProgress`); **Book it as Income** box `ar-applied-income-fix` 2714–2758 (v2.4369: a deposit that paid a bill under another Banking label; button `canApply` only), else `ar-bank-label-note` 2759–2767 (not on a closed-out deposit, v2.4374); **Applied breakdown** 2770–2870 (consumed > 0.01; list of `list_ar_allocations_for_mercury_transaction` rows with `onOpenEditJob` links).
- **Owned state:** `arAllocations`, `arAllocationsLoading`, `arAllocationsError` (276–278; effects 1175–1181 reset, 1183–1225 load keyed on `selected?.mercury_transaction_id` + `selected?.consumed`); `arIncomeSwitchOn` (effect 1637–1655, `app_settings` key `AR_APPLIED_INCOME_SETTING_KEY`, once per open), `bankLabel` (effect 1660–1702: `mercury_transaction_drag_sort_assignments` + `mercury_transaction_ar_income_labels`, null on RLS error — "never a wrong clause"; re-read when `bankLabelSeq` bumps), `incomeFixBusy`.
- **Handler:** **`bookAppliedIncome`** 1716–1737 — RPC `ar_book_applied_deposit_income`, toast, then bumps `bankLabelSeq` and B9's `closeBookingSeq` (no `refreshList`, no `onApplied`).
- **Shared out:** `arAllocations` → `tipOffer` (B8); `bankLabel` → `applySentence` + the apply toast (B11) and `appliedLabelOff` 1327, which makes B9's booking effect read for an applied deposit. So the loaders stay parent/engine even though only B6 renders them.
- **Tests:** `arBankLabel.test.ts` (9), `arAllocationProgress.test.ts` (5); `BankPaymentsModal.arIncome.render.test.tsx` (3: hand-labelled, closed-out, unlabelled), `BankPaymentsModal.bookIncome.render.test.tsx` (1; asserts the RPC args). Breakdown list untested.
- **Approach:** file-move the breakdown JSX as `ArAppliedBreakdown` (props: `consumed` (the "Applied to jobs" total, 2773), rows, loading, error, `onOpenEditJob`; carries `formatMoney` + `BANK_PAYMENTS_SUMMARY_CARD_STYLE`) — pure render, first Stage-B win. Loaders move into the seam.

### B7 — Match assists

- **Memos:** `bankPaymentQuickMatchTargets` 510–522 (deposit untouched, window on **`|amount|`**), `depositPayerMatch` 529–539 (`matchArDepositToPayer`), `depositPayerTargets` 542–558 (window on **`remaining_available`**, amount-matches first, top 8), `quickMatchTargetsOutsidePayer` 561–565, `depositAmountMatchKeys` 699–709, `payerBillCombo` 739–747 (`findExactBillCombos`; only when ≥ 2 payer bills, none equals the deposit, exactly one combo); `targetSelectOptions` 717–730 (`orderArBilledLineTargets`, JSX option content) — shared with B10.
- **Callbacks:** `pickTargetIntoLines` 754–771 (first empty billed line or a new line; same amount math as B10), `applyComboAllocation` 774–783 (**replaces** all lines with one per combo bill at full `remaining`).
- **Render:** `ArPayerMatches` 2908–2918 (filters out bills already on a line; combo only when exactly one untouched line).
- **Tests:** `arDepositCustomerMatch` (13), `arPayerBillCombos` (8), `arBilledLineOptions` (9), `jobsStagesBoard.test.ts` (target builders); render smokes: chip row (`render.test`), combo fills two lines (`Combo.render.test`). The three inline amount windows are untested.
- **Approach:** Stage A the windows (inventory B-3), then a `useArMatchAssists({ selected, targets, targetByKey })` hook or keep memos in parent — they feed B10 and B11 labels.

### B8 — Tip offer

- **Owned:** `tipJobId`, `tipConfirming`, `tipBusy`, `tipError`; reset effect 1244–1249 (deps `selected?.mercury_transaction_id`, `tipOffer?.jobId`, `tipOffer?.jobChoices.length`).
- **Memo:** `tipOffer` 1231–1241 (`buildArTipOffer({ remaining, allocations: arAllocations, returned })`, `returned` = hand-marked or bank-returned).
- **Handler:** **`addTipLine`** 1251–1288 — RPC `record_job_tip_from_deposit` (`p_amount: tipOffer.amount`, `p_payment_type`), then **both** `onApplied()` and `refreshList()` (comment 1273–1275: without the second the strip stays up); `isMissingRpcError` copy.
- **Tests:** `arTipOffer.test.ts` (15). No render smoke; `addTipLine` untested.
- **Approach:** `useArTipOffer` hook (state + effect + handler) or move with `ArTipOffer` as a container; `tipOffer` stays visible to B11.

### B9 — Close-out + reopen

- **Owned:** `closeReason`, `closeNote`, `closeConfirming`, `closeBusy`, `closeError`, `reopenBusy`; since v2.4363 `closeBooking` (how Banking books the deposit), `closeBookingStatus`, `closeBookingSeq`, `closeLabelId`, `closeChanging`, ref `closeReasonTouchedRef`; reset effect 1313–1322 (keyed on `closeOutOffer?.suggestedReason`).
- **Memo:** `closeOutOffer` 1296–1311 (`buildArCloseOutOffer`, **gated on `canApply`**); `closedRow` 1295 (render-scope); `closeBookingView` 1361–1374 (`arCloseBookingView`: the books line and the button's words for the picked reason).
- **Effect:** 1329–1358 reads RPC `ar_deposit_booking` while the strip, the closed record or B6's income fix shows (`wantCloseBooking` 1328), again when `closeBookingSeq` bumps; the payee's last close-out re-picks the reason unless one was pressed; a failed read leaves the strip closing out without a word about Banking.
- **Handlers:** `closeOutDeposit` 1387–1446 (RPC `close_out_ar_deposit` with reason + note + `p_label_id`; the old `set_mercury_transaction_ar_closed` when the booking was not read or the new RPC is not pushed → toast `arCloseOutToast` → `forgetRowLabel` → `refreshList`); `reopenDeposit` 1448–1471 (`set_mercury_transaction_ar_closed`, `p_reason: null`; toast `arReopenToast` names an undone label).
- **Tests:** `arCloseOut.test.ts` (11), `arCloseBooking.test.ts` (14); `BankPaymentsModal.closeOut.render.test.tsx` (6; asserts both RPCs' args). Reopen untested.
- **Approach:** `useArCloseOut` hook; `closedById` stays in the engine (row chips + header), and `closeBooking` must stay readable by B6 (`appliedIncomeFix`, the header's closed label).

### B10 — Allocation lines editor

- **Owned:** `allocLines`, `noteOpen`, `linkSteerDismissedLineIds`; reset effect 1110–1121 on `[open, selectedId]` (one empty billed line; also clears `noteOpen`, `linkSteerDismissedLineIds`, and `applyError`, `stripeOutOfBandConfirmed`, `stripeCloseResults` — B11 state).
- **Shared:** `internalNote` — written by the note textarea (3314) and cleared by the reset effect (v2.3831), read by B11 (`submitApply`'s `p_note`, `closeStripeInvoiceOob`'s `internal_note` 1779–1782). `recordedPayments` (effect 1139–1157, RPC `list_unlinked_payments_for_bank_payments`, fail-soft) also read by `rowStates`/`elsewhereStates` (B3) and `applyDisabled` (B11). `allocLines` is also written by B12's `fillReplacementLines`.
- **Callbacks:** `applyAllocationTarget`, `setAllocLineKind`, `applyRecordedPaymentTarget`; memo `recordedPaymentById` 484–487.
- **Render (2969–3323):** "Allocations"; per line (2978–3280): kind toggle **Billed line · Payment received** (only when `recordedPayments.length > 0`), `SearchableSelect` for recorded payments or billed lines (`noMatchesAction` steers a dead-end search to a recorded payment, v2.2597), picked-line detail, **link-collision steer** (`findRecordedPaymentCollisions`, v2.2591: "Link that payment instead" / "It's a different payment"), amount input (locked for payment lines), remove; "+ Split across another bill", "· Add a note", note textarea (3306–3321).
- **Tests:** `arLinkCollision` (3), `arRecordedPaymentTargets` (7); `BankPaymentsModalLinkGuard.render.test.tsx` (2), `BankPaymentsModal.notePerDeposit.render.test.tsx` (1). Split, remove, manual amount edit untested.
- **Approach:** after Stage A B-1–B-2, extract `ArAllocationLines` (render + three line callbacks); `allocLines` + setter stay in the parent (B7, B11 and B12 read/write it) and the reset effect stays with them; so does `internalNote` (B11 reads it), and `noteOpen` / `linkSteerDismissedLineIds` go down as value + setter because that effect clears them. **Preserve** the call order `setAllocLineKind` → `applyRecordedPaymentTarget` in the steer and `noMatchesAction` (the kind switch clears `targetKey`, the second updater sets it).

### B11 — Apply engine, Stripe auto-close, footer (stays in parent)

- **Owned:** `applyError`, `applySubmitting`, `stripeOutOfBandConfirmed`, `stripeCloseResults`, `stripeCloseRetrying`.
- **Memos:** `kindPaymentTypeLabel`, `paidOnYmdFromMercury` (company-calendar day from `posted_at` via `denverCalendarDayKey` — the name is historical, zone = `APP_CALENDAR_TZ` America/Chicago), `allocationProgress`, `stripeAllocationSelected` 1565–1575, `stripeAutoCloseLines`, `stripeAutoCloseAll`, **`validationMessage`** 1593–1622, `applyDisabled` 1624–1633 (9 conditions), `applySentence` 1740–1755 (takes `cameBack`).
- **Handlers:** **`submitApply(mode)`** 1829–1922 — rebuilds `allocations` (payment lines `{payment_id, amount}`; billed `{invoice_id | job_id, amount}`) in a loop that mirrors `validationMessage` by hand → RPC `apply_mercury_bank_payment_allocations` (`p_paid_on`, `p_payment_type`, `p_note`, **`p_allow_stripe_hosted: stripeAllocationSelected`**) → toast `arAppliedToast` → when `replacingRef` names this deposit, B12's `closeReplacedCase` → if Stripe candidates (`arStripeAutoCloseCandidates`) call **`closeStripeInvoiceOob`** (edge `record-stripe-invoice-out-of-band-payment`, `allow_app_paid: true`, note "AR allocation from Mercury deposit …") per invoice → `onApplied()` → `finishApply` (close, or `refreshList` + select `nextDepositId`) or park on the retry panel; `retryFailedStripeCloses` 1800–1813 (closes the modal when all ok).
- **Render:** Stripe paid-outside confirmation 3331–3369; "Allocation applied — but a Stripe invoice could not be closed" retry panel 3370–3410; `applyError`; footer `ar-apply-sentence`, Cancel, **Apply & next ›** (only when `nextDepositId && !applyDisabled` and no case is selected), **Apply $X** (not rendered while a case is selected).
- **Tests:** `arApplySentence` (17), `arStripeAutoClose` (8); render smoke asserts the sentence and "Apply $1,625.00"; `returnCases.render.test` asserts the call order apply → `close_ar_return_case`. **`validationMessage`, the `submitApply` payload, the OOB close, Retry and Apply & next have no test — the core money path is covered only by kernels around it.**
- **Approach:** stays in the parent (reads every region). Stage A B-1 (`buildArApplyAllocations`) is the prerequisite for anything else touching B10/B11.

### B12 — Returned-check cases (v2.4325)

- **Data:** `useArReturnCases(open, canApply)` (`src/hooks/useArReturnCases.ts`, 77 lines, no test: `list_ar_return_cases` + the cases' trails) → `caseViews` 390–393 (`arReturnCaseView` per row), `caseViewsShown` 399–404 (To match only; filtered by the search), `selectedCaseView` 405 (a case id sits in `selectedId` like a deposit id), `caseReplacement` 407–410 (`arReplacementFor`: the To match deposit that looks like the case's new check), `depositReplacesCase` 412–415 (`arCaseThisReplaces`: the reverse, for a selected deposit).
- **Owned:** `caseBusy`, `caseError` (cleared on every selection change, effect 434–436), `theySaidJob`, `markAsk`; refs `caseIdsRef` (kept by effect 396–398, read by `refreshList`), `replacingRef`, `pendingPrefillRef`.
- **Handlers:** `fillReplacementLines` 439–461 (one billed line per bill the returned check paid, each `min(bill amount, target.remaining, deposit left)`; sets `replacingRef`); prefill effect 1124–1134 (runs after B10's reset in the same commit; drops `replacingRef` when another deposit is selected); `runCaseRpc` 1927–1933; `afterCaseWrite` 1935–1939 (`returnCases.refresh()`, `refreshList`, `onApplied` when money moved); **`takeCaseOffJobs`** 1941–1958 (`take_returned_check_off_jobs`); **`closeCase`** 1960–1976 (`close_ar_return_case`, reason + note; clears the selection); `closeReplacedCase` 1978–1983 (`close_ar_return_case` `p_reason: 'replaced'`, called by `submitApply`); **`takeRecordedPaymentOff`** 1985–2001 (`remove_jobs_ledger_payment_and_reconcile` for a rejected check's recorded payment); `caseNotBounced` 2003–2021 (`set_mercury_transaction_ar_returned` false, then re-selects the deposit); `useCaseReplacement` 2023–2027 (a plain function, not a hook: sets `pendingPrefillRef`, selects the new check); `requestToggleReturned` 2030–2036 (a hand tick on a deposit the bank never failed opens the mark-ask first).
- **Render:** mark-ask 2423–2463 ("Yes, it bounced" marks it; "No. It is not a customer's payment" selects it; Cancel); Came back group 2530–2564 (`ArReturnCaseRow`); `ArReturnCasePane` 2661–2676 in place of the deposit pane; on a deposit: `ar-replacement-note` 2872–2892 ("Fill in the bills it paid" / "Use it as the new check") and `ar-came-back-note` 2893–2903; `SetPromisedPayDateModal` 3493–3504 ("They said").
- **Tests:** `arReturnCase.test.ts` (16), `ArReturnCasePane.render.test.tsx` (1), `BankPaymentsModal.returnCases.render.test.tsx` (7; asserts the args of take-off, close and the hand tick), `BankPaymentsModal.cameBack.render.test.tsx` (3). `fillReplacementLines`' amount math is reached by one render case only; `takeRecordedPaymentOff` and `caseNotBounced` are untested.
- **Approach:** Stage A the fill math (inventory B-10), then `useArReturnCaseActions` (state + the six handlers; props `selectedCaseView`, `canApply`, `returnCases`, `refreshList`, `onApplied`, `setSelectedId`). `replacingRef` and `pendingPrefillRef` stay with `allocLines` and `submitApply` in the parent.

## Per-region dossiers — CollectPaymentModal

### C0 — Module scope (25–172)

- Types `CertifyFixture`, `CertifyInvoice`, `CollectInvoice`, `FlowRow`, `BillingCustomer`, `CertifyPayload`, `JobBookCatalogRow` (25–81), `Props` 83–93. **`lineTotalDollars`** 95–98 (`round(count × unit × 100) / 100`, null unit → 0). `CollectPaymentFixturesLineItemsTable` 100–130 (presentational; rendered at 939 and 1131). `COLLECT_PAYMENT_EMAIL_MAX` 320 + `isValidCollectPaymentEmail`. `collectPaymentAddFixtureFromJobBookErrorMessage` (RPC code → copy). `CollectPaymentRefreshIcon` (FA arrows-rotate SVG).
- **Tests:** none (all three module functions untested; `lineTotalDollars` is money math). **Approach:** the two components file-move verbatim; the functions go to lib (inventory).

### C1 — Flow engine (the substrate — see below)

- **State:** `step: 1 | 2 | 3`, `loadingPayload`, `payload`, `flowStatus` (seeded from `initialFlowStatus`); ref `channelRef`.
- **`refreshFlowFromPayload(setStepFromFlow)`** 232–257 — RPC `get_collect_payment_certify_payload`, silent on error; maps status → step (`approved_for_terminal` → 3, `pending_dispatch` → 2, else 1).
- **Effects:** 325–358 open-load (resets `step`/`certifyMode`/`correctionNotes`, same RPC, same status → step map duplicated at 350–352; deps `[open, jobId, showToast, initialFlowStatus]`); **360–387 realtime** channel `job_collect_payment_${jobId}` on `job_collect_payment_flows` (`filter job_id=eq.<id>`; toast on `approved_for_terminal`; `refreshFlowFromPayload(true)` + `onFlowChanged`); 490–499 `visibilitychange` → refresh.
- **Step writers:** effect 325, `refreshFlowFromPayload`, `handleSubmitCertify`, `handleReturnCollectPaymentToDispatch`.
- **Tests:** none. **Approach:** `useCollectPaymentFlow({ open, jobId, initialFlowStatus, onFlowChanged })` returning `{ step, setStep, loadingPayload, payload, flowStatus, setFlowStatus, refreshFlowFromPayload }`; effect 325–358 also resets C3's `certifyMode`/`correctionNotes`, so the hook needs an on-open reset callback (or that reset stays in the component).

### C2 — Chrome

- **Render:** overlay + dialog 794–855 (title `collect-payment-modal-title`, `{hcpNumber} · {jobName}`; backdrop click → `onClose`; the overlay's `onKeyDown` Escape 808–817 is one-layer — it closes C6's send-back dialog first (reads `sendBackOpen`, clears it and `sendBackNote`), else `onClose`); step-3 tools 856–908 — dev/impersonation **Stripe Dashboard** link (`showStripeDashDevLink = role === 'dev' || isImpersonationSessionActive()`, `stripeDashboardInvoiceUrl`) + refresh button (`refreshFlowFromPayload(true)`); "Step N of 3" 911–921; footer Close 1427–1451.
- **Derived:** `stripeDashButtonStyle` 761–779, `stripeDashTitle`/`AriaLabel` 781–787.
- **Tests:** `impersonationSession.test.ts` (3), `billingStripeModePref.test.ts` (6). **Approach:** stays parent.

### C3 — Step 1: certify + Job Book

- **Owned (moves):** `jobBookAll`, `jobBookLoading`, `addingJobBookEntryId`, `jobBookSearchQuery`, `jobBookSectionExpanded`, two `useId`s. **Shared (stays):** `certifyMode`, `correctionNotes`, `submitting` — read by the footer chain; the first two are also reset by C1's open effect (`submitting` is written only by `handleSubmitCertify`).
- **Memos:** `jobBookFiltered` 221–224 (universal rows = null `service_type_id`), `jobBookSearchRows` 226–230.
- **Effects:** 259–266 reset on close; 268–296 load `job_book_entries` when step 1 + payload.
- **Handlers:** **`handleAddFromJobBook`** 501–526 (RPC `add_collect_payment_fixture_from_job_book` — writes a fixture and recomputes revenue per BILLING_FLOWS; then `refreshFlowFromPayload(false)` + `onFlowChanged`); **`handleSubmitCertify`** 528–562 (RPC `submit_collect_payment_certification`, `p_mode`, `p_correction_notes` only for `correction_requested`; sets `flowStatus = 'pending_dispatch'`, `step = 2`).
- **Render:** draft total 927–938, fixtures table, Job Book disclosure 970–1056, clean/correction choice, correction notes 1078–1093; footer submit 1514–1531.
- **Tests:** none. **Risk:** med. **Approach:** `CollectPaymentCertifyStep` owning the Job Book state, effects and `handleAddFromJobBook` (props: `jobId`, `payload`, `refreshFlowFromPayload`, `onFlowChanged`). `certifyMode`, `correctionNotes`, `submitting` and `handleSubmitCertify` **stay in the parent**: the footer submit button 1514–1531 reads them and C1's open effect resets `certifyMode`/`correctionNotes` — pass them down as value + setter. Moving the button into the step body is a layout change — don't.

### C4 — Step 2: awaiting dispatch

- **Render:** copy + live "Waiting" stopwatch 1095–1124; footer dispatch-phone link 1469–1513 (`FieldDispatchPhoneIcon`).
- **State/effects:** `dispatchPhone` 208 + effect 298–323 (`app_settings` key `APP_SETTINGS_KEY_FIELD_DISPATCH_PHONE`); `dispatchWaitNowMs = useIntervalNowMs(1000)` 212; `dispatchWaitElapsedLabel` 737–741.
- **Tests:** `fieldDispatchPhone.test.ts` (4), `formatElapsedCountUp.test.ts` (5). **Approach:** small; move with the footer chain if the footer is split. The 1 s tick also drives C5's `lastInvoiceEmailSentLabel` (744–747), so it stays in the parent.

### C5 — Step 3: customer pays

- **Owned:** `emailSending`, `stripeEmailResolved`, `stripeEmailLoading`, `stripeEmailError`, `stripeEmailFetchGen`, `changeEmailOpen`/`Draft`/`Baseline`/`Saving`; ref `stripeEmailFetchInvIdRef`.
- **Effects:** 389–469 — edge `get-stripe-invoice-details` (Bearer + `stripeModeInvokeBody`, `AbortController`, clears the label only when the invoice id changes, refetch on `stripeEmailFetchGen` bump); 471–480 clears change-email + send-back state off step 3.
- **Handlers:** `copyPaymentLink` 620–627 (clipboard); **`saveCollectPaymentCustomerEmail`** 629–689 (edge `update-collect-payment-stripe-customer-email`; case-insensitive no-op guard vs baseline; bumps fetch gen); **`sendInvoiceEmailToCustomer`** 691–731 (edge `send-stripe-invoice`; the success toast is `billEmailSentMessage(parseBillEmailOutcome(body), mode)` from `lib/billing/billEmailOutcome`).
- **Derived:** `invOkForEmail` (id + status `billed`), `blockEmailSend`, `emailInvoiceDisabled` 748–754.
- **Render (1125–1424):** fixtures table + amount due; Open payment page / Copy payment link (`hosted_invoice_url`); Email invoice + last-sent label; change-email editor 1241–1326; resolved-email line + "Change email" 1327–1393; "Job billing line" mismatch notes 1394–1413; no-link warning 1415–1419.
- **Tests:** `formatCollectPaymentInvoiceEmailLastSentLabel.test.ts` (4), `billEmailOutcome.test.ts` (18); handlers and effect untested. **Risk:** high — a customer-facing send and a Stripe customer mutation. **Approach:** `CollectPaymentPayStep` last among the steps; state + effect 389–469 move with it; effect 471–480 splits (change-email half moves, send-back half stays with C6).

### C6 — Send back to office

- **State:** `sendBackOpen`, `sendBackNote`, `sendingBack`, `sendBackTitleId`; effect 482–488 (reset on close; 471–480 also clears). Not dialog-private: the footer button 1452–1468 writes `sendBackOpen` and reads `sendingBack` (`disabled`); C2's overlay Escape 808–817 reads `sendBackOpen` and clears it and `sendBackNote`.
- **Handler:** **`handleReturnCollectPaymentToDispatch`** 564–618 — note ≥ 3 chars; if the collect invoice is `billed`, **first** `invokeVoidStripeInvoiceForCollectPaymentSendBack` (edge `void-stripe-invoice-for-revert` with `collect_payment_send_back_job_id`), **then** RPC `return_collect_payment_to_dispatch`; sets `flowStatus = 'pending_dispatch'`, `step = 2`.
- **Gate:** `canSendBackToDispatch` 789–792 (step 3, loaded, flow `approved_for_terminal`).
- **Render:** footer "Send back to office" 1452–1468; dialog 1533–1648.
- **Tests:** `voidStripeInvoiceForRevert.test.ts` (12, incl. the send-back variant); the handler is untested. **Approach:** `CollectPaymentSendBackDialog` (dialog JSX + handler + `sendBackNote`; props `open`/`onClose` (`sendBackOpen` stays in the parent with the footer button, the overlay Escape and effect 471–480), `jobId`, `collectInvoice`, `stripeModeForBilling`, `onSentBack` (sets `flowStatus`/`step`, refreshes, `onFlowChanged`), plus `sendingBack` lifted or reported up for the footer's `disabled`) — second Stage-B move.

---

## Shared substrate

**BankPaymentsModal — the in-modal selection pointer + deposit engine.** No parent-owned selection (the route's `?check=` only seeds it through `initialDepositId`): the pointer is `selectedId` (267) → `selected` (350–358) or, when the id is a case's, `selectedCaseView` (405). It is written from **eight** places (`selectRow` 431 — every row click, the mark-ask's No and `useCaseReplacement`; `refreshList` 843; `toggleMercuryReturned` 1022 via `queueMicrotask`; the filtered-list effect 1474–1482; the initial-deposit effect 1486–1497; `finishApply` 1826; `closeCase` 1971; `caseNotBounced` 2017). Everything in B5–B11 keys off `selected`; the reset effect 1110–1121 and the per-deposit loaders (1183, 1244, 1313, 1329, 1660) are keyed on `selectedId` / `selected?.mercury_transaction_id`. The data engine is B2 + B3 (`sortingConfig` → `refreshList` → `candidates`/`closedById`, plus the All rows behind a search, the trails and the row labels) plus three inputs from outside it: **`targets`/`targetByKey`** (from the `billedRows` prop), **`recordedPayments`** and B12's **`caseViews`**. Seam: `useArDepositList` owns B2 + B3 and returns `{ candidates, filteredCandidates, foundElsewhere, allGroups, selected, selectedId, setSelectedId, selectRow, refreshList, closedById, trailsById, rowStates, depositSummary, nextDepositId, exactMatchSweep, kindBadges, sortingConfig, … }`; it needs the case ids passed in (`caseIdsRef`) so a refresh keeps a selected case. `allocLines` + B11 stay in the component.

**CollectPaymentModal — the flow engine (C1).** `payload` + `step` + `flowStatus` + `refreshFlowFromPayload`, driven by the open-load effect, the realtime channel and the visibility refresh. Every step reads `payload`; C3, C6 and C1 write `step`. Seam: `useCollectPaymentFlow`.

**Between the two:** none. Common libs only (`readEdgeFunctionErrorBody`, `withSupabaseRetry`, `useToastContext`); the edge-invoke-and-parse boilerplate is repeated (inventory C-5).

---

## Stage-A inventory

### Inline pure logic to move (→ `src/lib/**` + colocated `*.test.ts`)

| # | Candidate | Currently | Target |
|---|---|---|---|
| B-1 | **Apply allocation plan** — `validationMessage` 1593–1622 and `submitApply`'s allocation loop 1839–1856 walk `allocLines` twice with hand-mirrored rules (payment line: `abs(amount) > 0`, cap + 0.01; billed: parsed > 0, ≤ `remaining + 0.01`, `invoice_id` else `job_id`; total ≤ deposit remaining + 0.01) | inline ×2, **untested** | `src/lib/jobs/arApplyAllocations.ts` — `buildArApplyAllocations({ lines, targetByKey, paymentById, depositRemaining })` → `{ allocations, validation }` + tests. **Highest leverage: it is the RPC payload.** Fold `stripeAllocationSelected` (1565–1575) in if the diff stays a move |
| B-2 | `parseBankPaymentAllocationAmount` 135–140, `allocationAmountStrForTargetChange` 142–152, the positive-sum reducer duplicated at 469–474 and 761–764 | module fns + inline ×2, untested | `src/lib/jobs/arAllocationAmounts.ts` + tests (commas, `$`, NaN, cap = min(target, deposit left), `''` at ≤ 0) |
| B-3 | Quick-match amount window `[x − 0.01, x + AR_BANK_PAYMENT_QUICK_MATCH_MAX_OVER]` at 518 (x = `|amount|`), 546 and 705 (x = `remaining_available`) + the `bankAbs − remAvail > EPS` guard 514 + payer sort 551–556 | inline ×3 | `src/lib/jobs/arQuickMatch.ts` + tests — **keep the two different x's** |
| B-4 | `payerBillCombo` gate 739–747 | inline | extend `arPayerBillCombos.ts` (`suggestPayerBillCombo`) + tests |
| B-5 | Posted-at → paid-on day: `paidOnYmdFromMercury` 373–382, the sweep's copy 651–652 and `arDepositClearsNote`'s 213 | inline ×3 | `mercuryPaidOnYmd(postedAt)` next to `bankReturnedDeposits.ts` + test |
| B-6 | Sweep per-pair payload 660–669 + `sweepPairsPending` 631–633 | inline | `arExactMatchSweep.ts` (`arSweepApplyArgs`, `arSweepPending`) + tests (prior-ok carry) |
| B-7 | `p_filter` build 820–829, again at 875–884 for the All rows | a third copy in `src/hooks/useArBankUnallocatedCount.ts:45–53` | `bankPaymentsListFilter(cfg, { includeHidden })` in `bankingSortingConfig.ts` + test |
| B-8 | `canRoleApplyBankPayments` 171–173 | same body as `canRoleUseArBankCount` (`useArBankUnallocatedCount.ts:7–11`) | one lib gate + test |
| B-9 | `toggleMercuryReturned` list patch 1012–1020; OOB `internal_note` composition 1779–1782; breakdown row words 2805–2815; distinct sets 1530–1541; the case search 399–404; the take-off toast 1951–1953 | inline | small pure fns — low value, do opportunistically |
| B-10 | **Replacement fill** — `fillReplacementLines`' line builder 443–456 (per bill `min(bill amount, target.remaining, deposit left)`, skip ≤ 0.005, merge a repeated target) | inline, one render case | `arReplacementLines({ billsItPaid, targetByKey, depositRemaining })` in `arReturnCase.ts` + tests |
| C-1 | Flow status → step (`approved_for_terminal` 3 / `pending_dispatch` 2 / else 1) at 247–251 and 350–352 | inline ×2 | `src/lib/collectPayment/collectPaymentStep.ts` + test |
| C-2 | `lineTotalDollars` 95–98 | module fn, untested money math | same module + tests (null unit, rounding) — check for an existing fixture-line-total helper first |
| C-3 | `isValidCollectPaymentEmail` + `COLLECT_PAYMENT_EMAIL_MAX` 132–138; `collectPaymentAddFixtureFromJobBookErrorMessage` 140–153 | module fns | same module + tests |
| C-4 | Gates `invOkForEmail`/`blockEmailSend`/`emailInvoiceDisabled` 748–754, `canSendBackToDispatch` 789–792, Job Book filters 221–230 | render-scope / memos | pure predicates + tests |
| C-5 | Edge response parse (`error` string → `success !== true` → value) at 433–453, 658–675, 709–722 (+ `closeStripeInvoiceOob` 1786–1793 in Bank, `error` only) | inline ×4 across both files | 433–453 (`get-stripe-invoice-details`) → reuse the existing tested `parseStripeInvoiceDetailsResponse` (`src/lib/stripeInvoiceDetailsResponse.ts`, 6 tests; already used by `HostedStripeBillPanel`, `DashboardFieldCollectPaymentQueue`); the other three → `parseEdgeSuccessBody` beside `readEdgeFunctionErrorBody` + tests — `StripeInvoiceSendFromStripeButton` has the same inline check (don't widen scope in one PR) |

### Already extracted (tested — don't re-extract)

`src/lib/jobs/`: `arExactMatchSweep` (7 tests), `arDepositCustomerMatch` (13), `arPayerBillCombos` (8), `arBilledLineOptions` (9), `arDepositRowState` (7), `arAllocationProgress` (5), `arApplySentence` (17, incl. `arNextDepositId` and `arDepositCameBack`), `arTipOffer` (15), `arCloseOut` (11), `arCloseBooking` (14), `arBankLabel` (9), `arLinkCollision` (3), `bankReturnedDeposits` (18), `arDepositSearch` (8; the list's search predicate and the fall-through to All), `arAllByLastAction` (4), `arDepositTrail` (11), `arReturnCase` (16), `checkClearing` (7); `src/lib/`: `arRecordedPaymentTargets` (7), `arStripeAutoClose` (8), `bankingSortingConfig` (5), `bankPaymentsKindBadges` (8), `jobsStagesBoard` (target builders), `billingStripeModePref` (6), `billing/billEmailOutcome` (18), `voidStripeInvoiceForRevert` (12), `fieldDispatchPhone` (4), `formatElapsedCountUp` (5), `formatCollectPaymentInvoiceEmailLastSentLabel` (4), `impersonationSession` (3). Untested helpers used here: `mercuryRawDebitCard`, `readEdgeFunctionErrorBody`, the hook `useArReturnCases`. Components already out: `ar/ArDepositRow` 227, `ArDepositHeader` 118, `ArPayerMatches` 121, `ArTipOffer` 180, `ArCloseOut` 278, `ArHeaderMenu` 118, `ArBilledLineOption` 78, `KindBadgePill` 32, `ArReturnCasePane` 249, `ArReturnCaseRow` 61, `BankTransferDetailsPanel` 92, `BankingSortingConfigModal` 682, `ModalFullScreenToggle` 67 — **only `ArReturnCasePane` has its own render test** (1 case); the rest are covered only through the 9 `BankPaymentsModal*.render.test.tsx` smokes (26 cases) plus one open smoke in `JobsStagesTab.render.test.tsx` (`openBankPayments` → "Accounts Receivable" renders). `CollectPaymentModal` has **no component test at all** (the opener's `DashboardTeamReadyToBillSection.render.test.tsx` only asserts the Collect button is visible). The returned-check train added `arReturnedCheckPayers` (6 tests) with the hook `useArReturnedCheckPayers` (v2.4328: one read of `list_ar_returned_check_payers`, called by `JobsStagesTab` for the Billed row's pay history and by `BillCustomerReturnedChecksLine`).

---

## Recommended extraction order (value ÷ risk)

> **Timing:** `BankPaymentsModal` is hot (39 commits / 90 d; the returned-check train v2.4313–v2.4333 and the close-out booking v2.4363–v2.4374 landed 2026-10-01/02). Check `npm run sessions` before any Stage-B move; Stage-A kernels are safe to interleave. `CollectPaymentModal` is quiet (7 / 90 d). No step below has shipped yet; the growth since the first map came with its own kernels (`arDepositSearch`, `arAllByLastAction`, `arDepositTrail`, `arCloseBooking`, `arReturnCase`) but left the handlers inline.

1. **B-1 `buildArApplyAllocations`** + tests — ~45 lines out of `validationMessage`/`submitApply`; kills the hand-mirrored payload.
2. **B-2 + B-3 + B-5 + B-8 + B-10** amount/window/day/role/replacement-fill helpers + tests — ~75 lines out.
3. **C-1…C-3** collect-payment kernels + tests — ~40 lines out.
4. **Verbatim file moves:** `CollectPaymentFixturesLineItemsTable` + `CollectPaymentRefreshIcon` → `src/components/jobs/collectPayment/` — ~50 lines.
5. **`ArAppliedBreakdown`** (B6 render 2770–2870, props-only) — ~100 lines.
6. **`CollectPaymentSendBackDialog`** (C6 dialog + handler + note state; `sendBackOpen` stays parent) — ~180 lines.
7. **B-6 + `ArExactMatchSweepPanel`** (B5; `sweepOpen` + `sweepExcluded` stay parent) — ~220 lines.
8. **`useCollectPaymentFlow`** seam (C1) — ~110 lines.
9. **`CollectPaymentCertifyStep`** (C3, Job Book included) — ~250 lines.
10. **`useArDepositList`** seam (B2 + B3) — ~500 lines; then **`ArDepositListPane`** (B4) — ~150.
11. **`useArTipOffer` + `useArCloseOut`** (B8/B9 state + handlers) — ~70 + ~190; **`useArReturnCaseActions`** (B12 state + handlers) — ~120.
12. **`ArAllocationLines`** (B10 render + line callbacks; `allocLines` and `internalNote` stay parent) — ~380 lines.
13. **`CollectPaymentPayStep`** (C5) — ~450 lines, last on Collect.
14. **Stays in parent permanently:** B1 chrome + Esc, B11 (apply engine, Stripe auto-close, footer), `allocLines` + its reset effect + the prefill effect and its two refs, `selectedId`; Collect chrome C2, the footer action chain 1427–1531, the 1 s tick.

Gates after every step: `npm run typecheck && npm run lint && npm test`.

---

## Hazards

**Money paths (BankPaymentsModal)**
- Ten write endpoints, fourteen call sites: `apply_mercury_bank_payment_allocations` (manual `submitApply` + serial sweep), `record_job_tip_from_deposit`, `record-stripe-invoice-out-of-band-payment`, `close_out_ar_deposit`, `set_mercury_transaction_ar_closed` (the close-out's fallback + reopen), `ar_book_applied_deposit_income`, `set_mercury_transaction_ar_returned` (the list tick + It did not bounce), `take_returned_check_off_jobs`, `close_ar_return_case` (by hand + after a replacing apply), `remove_jobs_ledger_payment_and_reconcile`. The RPC `p_paid_on` is the deposit's posted day — never user-editable (`applyDisabled` requires it). A deposit that came back (Mercury `failed`, or marked returned) can be linked by none of them: `canAllocateRemaining` is false for it and trigger `jobs_ledger_payments_refuse_returned_deposit` raises (v2.4313). A selected case (B12) replaces the deposit pane and hides Apply.
- **`replacingRef` is invisible state.** `fillReplacementLines` sets it even when no line was filled, and only selecting another deposit clears it; the next apply on that deposit then closes the case as `replaced`, whatever bills the lines name by then. Keep it beside `submitApply` and clear it on the same rule when moving.
- **`p_allow_stripe_hosted`** is `stripeAllocationSelected` in `submitApply` (only reachable after the confirmation checkbox) and hard `false` in the sweep. Keep both.
- **Apply first, Stripe close second.** A failed OOB close leaves the allocation standing and parks the modal on the retry panel; `applyDisabled` includes `stripeCloseResults != null`, so a second apply can't fire. `retryFailedStripeCloses` closes the modal on success (no "next").
- **Sweep double-apply guard:** prior `ok` results carry forward (639–643) and `sweepPairsPending` excludes them — preserve when moving.
- **Both refreshes after a write:** `onApplied()` (parent's billed rows → `targets`) and `refreshList()` (deposit remainders). `addTipLine` awaits both; `closeOutDeposit`/`reopenDeposit` only `refreshList`; `bookAppliedIncome` neither (it re-reads the label and the booking); `submitApply` calls `onApplied` then `finishApply` (which refreshes only for "next"); the case writes go through `afterCaseWrite` (cases + list, and `onApplied` only when payments came off a job).
- `validationMessage` tolerances (+0.01) and the EPS constants are part of the money contract with the server — preserve exactly.

**Money paths (CollectPaymentModal)**
- **Send-back order:** void the Stripe invoice (edge) **before** `return_collect_payment_to_dispatch`. A failure of the RPC after a successful void leaves the invoice voided and the flow not returned — preserve the order; don't swallow either error.
- `send-stripe-invoice` emails the customer; `update-collect-payment-stripe-customer-email` changes the Stripe customer; `add_collect_payment_fixture_from_job_book` changes the bill. Every edge body carries `stripeModeInvokeBody(stripeModeForBilling)` — a move must keep it.

**Role gates**
- Bank: `canApply` (dev · master_technician · assistant-like · primary) gates apply, sweep bar, mark-returned menu, close-out offer (1298), line controls, the Book it as Income button, the cases read (`useArReturnCases(open, canApply)`) and every case handler. **Not** gated client-side: the tip strip / `addTipLine` (the RPC refuses roles outside dev · master_technician · assistant · primary). Dev-only: Mercury filter menu, kind-badge editor, the config/badge migrate-upserts (1057, 1083). `BankTransferDetailsPanel` edit: dev || master. Openers gate tighter than `canApply`: tools menu dev/master/assistant-like; `/accounts-receivable` `canRoleSeeArBankUnallocatedOrgNudge`. The bank-label read relies on RLS returning an error → `null` (no clause, never a wrong one).
- Collect: no role gate inside except the dev/impersonation Stripe Dashboard link; the opener's button gate (`isSubcontractorLikeRole || superintendent`) plus server team-membership checks are the real gates.

**Realtime / subscriptions**
- Collect effect 360–387 subscribes `job_collect_payment_${jobId}` with deps `[open, jobId, refreshFlowFromPayload, onFlowChanged, showToast]` — an unstable `onFlowChanged` re-subscribes on every parent render (today it is a `useCallback`). Effect 490–499 refreshes on tab focus. BankPaymentsModal has no realtime.
- `useIntervalNowMs(1000)` re-renders the whole Collect modal every second while open.

**URL deep links**
- Bank: one, through a prop — `/accounts-receivable?check=<id>` → `initialDepositId` (`JobsAccountsReceivable.tsx:38`; selected once, when the deposit or case has loaded; a deposit only All lists is not found). Outside: route `/accounts-receivable` (always-open page, `onClose = goBack`), `?openBankPayments=true` (`Jobs.tsx` → `JobsStagesTab.openBankPayments`), `?stagesMove=ar` (`Jobs.tsx` → `JobsStagesTab.openMoneyMove`), Dashboard and Quickfill Needs-you "Match deposits" (`DashboardArDepositsModal`, mounted by `DashboardPinnedQuickRow` and `QuickfillNeedsYouSection`). The props contract is the only interface — keep it stable across moves.
- Collect: none.

**Effects whose deps make moves risky**
- Bank 1110–1121 (`[open, selectedId]`) resets `allocLines`, `internalNote` (v2.3831 — before that a typed note carried to the next deposit's `p_note`, including after Apply & next) **and** B11's Stripe state after selection changes — it flushes after the render that shows the new deposit (the main render smoke waits for `ar-allocation-row` because of this). Splitting `allocLines` into a child changes that timing. The prefill effect 1124–1134 is declared right after it and depends on running second in the same commit: it refills the lines the reset just emptied.
- Bank 1097–1100 holds the first list fetch until `sortingConfigResolved`; `refreshList` is a `useCallback` over `[open, sortingConfig, includeHiddenArDeposits, loadArClosed]`, so any identity change refetches. `listRequestSeqRef` makes the newest request win — keep it with `refreshList`.
- Bank 867–902 fetches the All rows once per refresh behind `hiddenInFlightRef` + `hiddenFetchSeqRef`. A `refreshList` while that fetch is in flight drops its result, and nothing re-runs the effect (its deps did not change), so the search shows no found-in-All rows until the query is cleared and typed again.
- Bank 909–950 lists `trailsById` in its deps and writes it; it stops because it only asks for ids the map lacks. A failed read leaves those ids unasked until `candidates` changes.
- Bank 1244–1249 and 1313–1322 reset the tip / close-out strips on derived keys (`tipOffer?.jobChoices.length`, `closeOutOffer?.suggestedReason`) — carry the exact deps.
- Bank 1660–1702 re-runs per deposit, when `arIncomeSwitchOn` lands and when `bankLabelSeq` bumps; `bankLabel` is read by `submitApply`'s toast. Bank 1329–1358 re-runs on `closeBookingSeq`, which three handlers bump (`closeOutDeposit`, `reopenDeposit`, `bookAppliedIncome`).
- Bank Esc handler 1159–1169 closes the whole modal from `document` with no layer check (sweep panel, mark-ask, promised-pay modal, sorting-config modal, open `SearchableSelect` lists).
- Bank `toggleMercuryReturned`'s re-select 1021–1027 checks only the deposit rows, not `caseIdsRef`: a returned tick made while a case is selected moves the selection to the first deposit.
- Collect 325–358 depends on `initialFlowStatus`; it is stable only because the opener passes a click-time snapshot. A live value would reset the step machine and refetch on every parent refresh.
- Collect 389–469 relies on `stripeEmailFetchInvIdRef` (clear only on invoice change) + `stripeEmailFetchGen` (refetch after an email change) + `AbortController`; move all three together.
