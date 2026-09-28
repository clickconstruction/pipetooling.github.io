# Job Form Modal Architecture Map

---
file: docs/JOB_FORM_MODAL_ARCHITECTURE.md
type: Engineering / Refactor Map
purpose: Step-0 map for the JobFormModal.tsx decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md, adapted from tabs to form regions) — inventory what every region of the New/Edit Job form touches (state, handlers, supabase tables/RPCs, child components, coupling, test coverage) to drive the remaining extractions, with a deep-dive on the money-path save engine and the invoice/payment handlers that still live in the shell.
covers:
  - src/components/jobs/JobFormModal.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-27
---

## Overview

**Line numbers are exact as of `a05cef4c4` and rot with every commit — search the symbol, not the number.** Regenerate the facts with `npm run map -- src/components/jobs/JobFormModal.tsx` before trusting a range.

[`src/components/jobs/JobFormModal.tsx`](../src/components/jobs/JobFormModal.tsx) is **5,457 lines**: one default-exported component `JobFormModal` (309–5457, 5,149 lines; render 3919–5456, 1,538 lines) over a module scope of types, `FOCUS_FIELD_RING` and the z-index ladder (27–307) — **0 module functions**. Census: **97 `useState` · 30 effects · 37 `useMemo` · 12 `useCallback` · 39 `useRef` · 21 custom-hook calls**; 133 local imports, 40 child components in the render. Churn: **150 commits in 90 days**, last `a05cef4c4` (2026-09-25) — the hottest modal in the repo; run `npm run sessions` before touching it.

**Size history:** ~7,137 lines at v2.736 (map written) → 3,767 right after the v2.1094 section wave (~4,100 by the #1009 catch-up) → 5,242 at this map's previous touch (6857dfe20, v2.3478) → 5,457 now. **Every section extraction held** — the regrowth is new logic landing in the shell: Stage Plan (PRs 2–4 + the portal-link mint, v2.3517), who-pays / GC party (v2.3345–v2.3403), discount rows + standing offer (v2.3252–v2.3272), payer carves (v2.3349), property record (v2.2638+), payment actions (Move v2.3576, Record payment on bill v2.3692, Undo part payment v2.3695, returned deposits v2.3784/v2.3795), the New Job discard guard (Tier-2 #42), and the focus-row doors (v2.3667/v2.3697/v2.3819). Since 6857dfe20: 11 commits, +230/−15.

**Hosts** (fact sheet "Imported by"): [`JobWindowModal.tsx`](../src/components/jobs/JobWindowModal.tsx) mounts it **embedded** for every edit open (`openEditJob` delegates through `requestOpenJobWindowEdit`, v2.1675) as its Edit / Bill / Costs tabs — for window roles only; for the rest the same open lands on the read-only `DetailJobModal` ([JOBS_MODALS](./JOBS_MODALS_ARCHITECTURE.md)); [`JobFormModalContext.tsx`](../src/contexts/JobFormModalContext.tsx) mounts it **standalone** for `openNewJob` and as the edit fallback when no window is registered. 29 `src/` files call `openEditJob(`/`openNewJob(`. It is the largest component in the repo that is a modal, not a page. Billing behavior (invoice lifecycle, payment channels, delete/archive) is flow-mapped in [`BILLING_FLOWS.md`](./BILLING_FLOWS.md) — cross-referenced, not restated.

### Key structural differences from the page maps

1. **Regions, not tabs.** Standalone, one scrolling card (max-width 560, `maxHeight: min(90vh, 100%)`) renders everything. Embedded, `embeddedRegion: 'edit' | 'bill' | 'costs'` display-toggles three contiguous region wrappers (4004 / 4261 / 4583) — **everything stays mounted**, so tab switches never lose typed state (pinned by `JobWindowModal.render.test.tsx`). The window's ✕ routes through `closeForm` via `registerRequestClose`; `onRequestRegion` lets Stage Plan / the job-account note jump tabs.
2. **Almost all state is the form.** Controlled fields feed four autosave slices (edit) or `createJob` (new). Seams are props-heavy controlled children plus a few self-contained data loaders — not per-region hooks.
3. **Two modes fork the UI, not just the save.** `mode` plus `editing: JobWithDetails | null` (set only in edit mode) gate nearly everything. Since v2.1681, **edit mode renders people / customer / GC / bill-to / property / links / development as fact rows (`JobFormEditFactRows`)**; the classic `JobFormCustomerSection` / `JobFormLinksSection` / `JobFormAccountManSection` + `JobFormPeoplePicker` render **only in new mode**. Billing regions (segments, invoices, status stepper, stages) render only when `editing` is set.
4. **Remount-by-key lifecycle.** The context bumps `jobFormModalInstanceSeed` as the React `key` on every open, so the init effect is deliberately mount-only (file-top `eslint-disable react-hooks/exhaustive-deps -- mount-only init; parent remounts via key`). Any extraction must preserve this.
5. **The modal is itself the parent.** Regions extract to `src/components/jobs/JobForm*` pieces; the shell keeps lifecycle, shared form state, the save engine, and modals opened from 2+ regions.

### Shared substrate

No selection pointer — the substrate is the **job snapshot + the money inputs**:

| State | Line | Readers / writers (fact sheet) | Role |
|---|---|---|---|
| `editing` | 352 | 65 / 21 | the loaded job (invoices, payments, status, master); doubles as the mode flag |
| `payments` | 544 | 20 / 12 | billing-slice input; every paid-sum, lock predicate, coverage and stage plan |
| `fixtures` (`fixturesRaw` 573 via the `setFixtures` wrapper 583–585, which runs `syncDiscountRows`) | 573 | every money memo (607–675) | Job Total, segments, stage plan, billing-slice input |
| `error` | 1454 | 5 / 10 | shared error sink rendered at 3987–3999 |
| `customerId` / `gcCustomerId` | 452 / 454 | 19 / 10 · 14 / 5 | party pickers go through `pickCustomerId` / `pickGcCustomerId` (953–977, `jobPartyExclusive`); `setCustomerId` is also called directly — skipping the exclusivity rule — by undo / hydrate / reset, the estimate prefill, the init project prefill, both customer handlers and the project link's `onLinked` |

The **data engine** is the four `useJobFormAutosaveSlice` instances (865 / 1126 / 1156 / 1209) — the hook is extracted, but their `persist*Slice` writers and the 17 mirror refs they read (775–799, 937–987, 1136, 1174) are inline. That is the "save engine" seam below.

### State placement (97 `useState`)

Every `useState` by home region, from the fact sheet's Read by / Written by (innermost units). "Hydrate / reset / undo" = `applyEditJob` / `resetNewForm` / `performUndo`, which write most form state; the last column names the other writers.

| Home | States | Also written by |
|---|---|---|
| Substrate (above) | `editing`, `payments`, `fixturesRaw`, `error`, `customerId`, `gcCustomerId` (6) | nearly everything |
| 0 Lifecycle + reference caches | `initDone`, `customers`, `customersLoading`, `projects`, `bids`, `serviceTypes`, `meServiceTypeColumns`, `users`, `developments`, `clickNumberSuggesting` (10) | `customers`: `patchCustomerRow`, the estimate prefill, both customer handlers · `developments`: `createDevelopmentFromPicker` · `users`: effect 1354 · `bids`: `applyPrefillFromBid` |
| 1–2 Header + banner | `carryBidBudget` (read by `createJob`), `bannerOverlayOpen` (read by the Esc gate) (2) | — |
| 3 Identity fields | `hcpNumber`, `clickNumber`, `jobName`, `jobAddress`, `formServiceTypeId`, `hideHcpEntryField` (6) | hydrate / reset / undo; the appliers (name, address, trade); init (C# suggestion, default trade, project address); `jobAddress` also the fact rows, `JobFormCustomerSection`, `handleCustomerImport`, `handleLinkToSimilarCustomer` |
| 3c / 4–6 Party, people, links (fact rows in edit, the classic sections in new) | identity-slice fields `accountManagerUserId`, `accountManagerRelationship`, `customerName`, `customerEmail`, `customerPhone`, `billToParty`, `billCopyOtherParty`, `customerAddressId`, `developmentId`, `projectId`, `bidId`, `googleDriveLink`, `jobPicturesLink`, `jobPlansLink`; `teamMemberIds` (team slice); `dateMet` (close backfill, create); display / UI state `linkedBidSummary`, `linkedBidGc`, `newJobShowOtherParty`, `propertyCandidates`, `customerSearch`, `customerExpanded`, `projectFilesPlansExpanded` (23) | hydrate / reset / undo; `pickGcCustomerId` / `pickCustomerId`; GC default effect 901 (`billToParty`, `newJobShowOtherParty`); AM-unteam effect 1167; property effect 992 + the fact rows' property callbacks; the appliers; init; the customer handlers; effect 2672 (`customerSearch`, `dateMet`); the §21 bid / project link modals |
| 4a Terms | `termsRefresh`, `termsModalOpen` (2) | — |
| 7 Line items | `fixtureScopeExpandedById`, `stripeFixturePreviewOpen` (§17) (2; `customerStanding` and `standingWaived` live in `useStandingDiscountOffer` since v2.3914) | `fixtureScopeExpandedById`: hydrate / reset and both appliers |
| Highlight / focus doors | `billingCustomerHighlight`, `fixturesSectionHighlight`, `paymentsReceivedHighlight`, `focusFieldFlash`, `jobPicturesLinkHighlight` (5) | each flag's own clear effect (2572–2670); hydrate / reset for the other three (`paymentsReceivedHighlight` is set by init, `focusFieldFlash` is seeded from the `focusRow` prop); `finishClose` (billing + fixtures flags); the invoice list's add-discount (`fixturesSectionHighlight`) |
| 8 % done | `pctSaving` (1) | — |
| 9 Invoices | `selectedSegmentIds` (1; the 6 busy flags — `creatingInvoice`, `creatingSegmentInvoice`, `movingJobToReadyToBill`, `carvingByPayer`, `billingFeeSeparatelyId` (read by the §7 riders strip), `billingStageFixtureId` — live in `useJobFormInvoiceActions` since v2.3934) | `selectedSegmentIds`: hydrate / reset / undo, `applyPrefillFromEstimate` and the invoice hook through its setter |
| 12 / 12a / 16 / 18 Payment actions | `paymentMoveRow`, `undoPartPaymentRow`, `recordPaymentTarget` (3; `paymentRemoveConfirmRowId`, `paymentRemoveRpcBusy`, `unlinkMercuryConfirmRowId`, `unlinkingMercuryPaymentId` live in `useJobFormPaymentActions` since v2.3956) | the hook hands back the setters `finishClose` / hydrate / reset clear; `recordPaymentTarget` is also opened from the invoice list |
| 13–14 Costs | `editJobTeamLaborLoading`, `editJobTeamLaborRow`, `editJobTeamLaborError`, `editJobSubLaborLoading`, `editJobSubLaborData`, `editJobSubLaborError` (6) | — (labor loader effect 2455 only) |
| 15 Footer + close guard | `closeFlushState`, `undoConfirmOpen`, `saving` (3) | `undoConfirmOpen`: `performUndo`, `finishClose` |
| 19–20 Delete | `deleteJobConfirmOpen`, `deletingId` (2) | `deleteJobConfirmOpen`: the footer's Delete, `finishClose` / hydrate / reset |
| 21 Link / import / picker modals | `jobBidLinkChoiceOpen`, `jobImportSourceOpen`, `jobProjectLinkChoiceOpen`, `winningGcPick`, `createCustomerFromJobModalOpen`, `creatingCustomerFromJob`, `segmentGeneratorOpen`, `stagesDrawerOpen` (8) | openers in §1 (link / import), §3a (drawer), §3c / §5 / §6 (bid link, create customer), §7 (generator), init (create customer); `finishClose` resets the link and create-customer flags |
| 22 Tail modals | `billViewInvoice`, `agreedWriteDownInvoice`, `billToEditorInvoice` (3) | the invoice list, the payments table (bill view), `billHazmatFeeSeparately` (bill-to); bill view also reset by the refetches, `finishClose` and hydrate / reset |
| Save engine | `materials` (materials slice; rendered in §14 as "Other job charges"), `rebaselineBillingNonce` (2) | `materials`: hydrate / reset / undo + the row handlers |

### How to read a dossier

Each region lists: **anchor** (symbol + line range as of `a05cef4c4`), **status** (extracted / inline / shell-owned), **props in** (shell state passed down — stays in the parent), **what stays shell-side**, **data**, **tests**, and **next action**. Coupling counts ("reads 34 · writes 23") are the fact sheet's per-block state reads/writes (a setter passed as a prop counts as a write).

### How to maintain this doc

- When a region extracts or its state/handlers change, flip its row and dossier and point at the new file; re-run `npm run map` and move `mapped_at`.
- Search the symbol (state name, component tag, label text) — never trust a line number past `mapped_at`.

---

## Master summary table

Render regions in JSX order (all line ranges @ `a05cef4c4`). Status legend: `extracted` = thin wiring around an imported component; `inline` = JSX/logic in this file; `shell-owned` = state/handlers deliberately kept here.

| # | Region | Anchor (lines) | Status | Coupling (props in / block reads·writes) | Tests | Risk | Next action |
|---|---|---|---|---|---|---|---|
| 0 | Shell + lifecycle | `!initDone` loading 3892–3915; overlay + card 3922–3959; `closeForm` 1753–1790 | shell | — | `JobWindowModal.render.test.tsx` (7 `it`, embedded edit only) | — | **Stays** |
| 1 | Header row | `JobFormHeaderRow` 3961–3984 (Edit-region wrapper 3960–3986) | **extracted** (v2.1094) | 15 props incl. `importBlocked`, `carryBidBudget` (new mode, v2.3302) | none | low | Done |
| 2 | Source-estimate banner | `JobFormSourceEstimateBanner` 3985 | **extracted** (v2.1090) | `jobId`, `onOverlayOpenChange` | none | low | Done |
| — | Error line | `error &&` 3987–3999 | inline | reads `error` | via window test | — | Stays |
| 3 | Identity fields | `JobFormIdentityFields` 4005–4029 | **extracted** (v2.1091) | 5 fields + setters (`hcpNumber`, `clickNumber`, `jobName`, `jobAddress`, `formServiceTypeId`), `hideHcpNumberField`, `clickNumberSuggesting`, `serviceTypeOptions`, `tradePill` | render | low | Done |
| 3a | Stages read-out (edit) | `JobFormStagesGroup` 4036–4043 | **extracted** (Stage Plan PR 4) | `stagePlan`, `stagesGcName`, `onGoToBill` | render | low | Done |
| 3b | Status stepper (edit) | `JobStatusStepper` 4048–4063 in the `focusFieldFlash==='status'` ring | **extracted** | job subset, `authRole` | render | low | Done |
| 3c | **Edit fact rows** (edit) | `JobFormEditFactRows` 4064–4153 (edit branch 4030–4154 of the `editing ?` ternary 4030–4167, whose fact-sheet block — both branches — reads 34 · writes 23) | **extracted** (v2.1681) | ~75 props: people, AM, customer, GC, bill-to, copy-other-party, property record, links, development, highlight refs, focus doors | render (+ `JobFormOwnerLookupBox`, `JobFormAddressNudge` renders) | med | Done — widest prop surface in the file |
| 4 | People (new) | `JobFormAccountManSection` 4157–4164 + `JobFormPeoplePicker` 4165 | **extracted** (v2.1466 / #436) | `users`, `teamMemberIds`, AM pair | none | low | Done |
| 4a | Customer terms bar | `CustomerTermsBar` 4170–4177 + `CustomerTermsModal` 4178–4186 | **extracted**; `termsModalOpen`/`termsRefresh` shell | `useCustomerTermsWarning(termsPayerId)` 469 | none | low | Done |
| 5 | Customer block (new) | `JobFormCustomerSection` 4187–4231 (reads 20 · writes 11) | **extracted** (v2.1093) | all customer fields + GC + bill-to as controlled props | `JobFormCustomerSectionCreate.render` | med | Done |
| 6 | Links (new) | `JobFormLinksSection` 4232–4254 (reads 10 · writes 7) | **extracted** (v2.1092) | project/bid/plans/development | none | med | Done |
| 7 | Line items | `JobFormFixturesSection` 4262–4286 | **extracted** (#435) | 23 props: fixtures, riders, discounts, standing offer, `onSetJobTotal`, stage plan, payer tags | render ×2 (+ `JobFormDiscountRow`, `JobFormHazmatRidersStrip`) | med | Done |
| 8 | Billing header + money bar | 4296–4396: autosave status line 4312–4339, `MoneyLifecycleBar` 4342–4394 (`% done` → `commitPctComplete`) | **extracted** bar; header inline | `billingBar`, `billingBarMarks`, `pctSaving` | `MoneyLifecycleBar.render` | low | Done (small inline header) |
| 8a | Job-account note (embedded) | `JobFormBillJobAccountNote` 4399–4408 | **extracted** (v2.3257) | `supplyInvoiceLines` from the Costs snapshot hook | render | low | Done |
| 9 | Invoices block (edit) | `editing &&` 4410–4492 (reads 10 · writes 6 · 8 handlers · 7 children): `InvoicesSectionHeading`, `JobFormSegmentsBar` + `JobFormBreakOffTrack`, `JobFormBreakOffSection`, `JobFormSegmentsCreateAction`, `JobFormUpcomingDraws` | **extracted** children; money handlers → **`useJobFormInvoiceActions`** (v2.3934) | `breakOff`, `segmentCoverage`, `stagePlan`, `payerCarvePlan` | SegmentsBar / BreakOffSection renders; UpcomingDraws render (in `JobFormFixturesSectionStagePlan.render`) | **high** (money path) | Done (order #5–6) |
| 10–11 | Invoice list | `JobFormInvoiceList` 4469–4490 | **extracted** (#430; row list v2.3478) | 17 props (10 callbacks/setters incl. `setEditing`) | render | high | Done |
| 12 | Payments received | `JobFormPaymentsTable` 4498–4511 in the highlight wrapper 4493–4512 | **extracted** (#431) | `payments`, lock inputs, 8 callbacks | render | high | Done |
| 12a | Payment action modals | `UndoStripePartPaymentModal` 4513–4532, `BilledPaymentConfirmationModal` 4533–4560, `JobPaymentMoveModal` 4561–4577 | **extracted**; open state + success refetch **shell** | `undoPartPaymentRow`, `recordPaymentTarget`, `paymentMoveRow` | Confirmation render only | high | Stays — the open states are the shell's; the success handler is `finishRecordPaymentOnBill` (the hook's) |
| 13 | Costs top (charts) | `JobFormLaborCostPanel` 4584 (22-line wrapper → `JobCostsTabCharts`) | **extracted** | `editing`, `editJobTeamLaborRow` | none | low | Done |
| 14 | Parts + labor cost | `JobFormPartsCostSection` 4585–4608 (team/sub labor lines render here since v2.3361) | **extracted** (#432); snapshot → **`useJobCostSnapshot`** hook (#427); labor loader → **`useJobFormLabor`** (v2.3871) | snapshot values, `teamLabor`/`subLabor` objects, materials rows | render | med | Labor loader → hook (order #1) |
| 15a | Close-flush error banner | `JobFormFooter` (drawn on `closeFlushState === 'error'`) | **extracted** (v2.3908) | `closeFlushState` + 3 callbacks | render | low | — |
| 15 | Footer | `JobFormFooter`: Delete, Undo cluster, required list, autosave status, Close / Cancel + Create Job | **extracted** (v2.3908) | 13 values + 7 callbacks | render + `jobFormFooter` kernel | low | — |
| 16 | Payment-remove confirm | `paymentRemoveConfirmRowId &&` 4898–5007 (preview 4927–4969) | **extracted** (v2.3872) | reads 2 · writes 1 | render | low | — |
| 17 | Stripe line preview | `stripeFixturePreviewOpen &&` 5008–5108 | **extracted** (v2.3872) | reads/writes 1 | render | low | — |
| 18 | Mercury-unlink confirm | `unlinkMercuryConfirmRowId &&` 5109–5217 | **extracted** (v2.3872) | reads 4 · writes 1 | render | low | — |
| 19–20 | Delete + migrate | `JobFormDeleteMigrateModals` 5218–5237 + `useJobMigrate` (1448) | **extracted** (#437; bid target v2.1166) | 18 props; the two migrate RPC handlers stay shell | **none** (739 + 333 lines) | med | Add render smoke |
| 21 | Link / import / picker modals | `JobBidLinkChoiceModal` 5238–5275, `JobFormImportEstimateOrBidModal` 5276–5284, `PickWinningGcModal` 5285–5298, `MultipleSegmentGeneratorModal` 5299–5307, `JobFormStagesDrawer` 5308–5322, `JobProjectLinkChoiceModal` 5323–5360, `JobFormCreateCustomerModal` 5361–5383 | **extracted**; open flags + `onLinked` wiring shell | bid link writes 5 states, project link 4 | Generator / Drawer / CreateCustomer renders; rest none | low–med | Stay (openers in 2+ places) |
| 22 | Tail modals | `AgreedWriteDownModal` 5386–5399, `BilledBillViewModal` 5400–5436, `JobFormBillToEditor` 5437–5454 (fragment siblings of the overlay) | **extracted**; wiring shell | opened from list + payments + riders | none | low | **Stay** (multi-region) |

### Shell logic regions (non-render)

| Region | Symbols (lines) | Writes | Data | Tests | Next action |
|---|---|---|---|---|---|
| Stripe memo backfill | `stripeMemoBackfillKey` 379–394, effect 396–432 | `editing` | edge `get-stripe-invoice-details` | none | Stays |
| Money memos | `jobTotalBidDollars` 607, `riderFeesDollars` 611, `billingBar` 614–622, `billingSegments` 638–641, `segmentCoverage` 646–655, `stagePlan` 662–674 | — | `useJobStagePlanInputs` 660 | kernels tested (`editJobBillingBar`, `jobSegmentsCoverage`, `stagePlanForm`); `revenueDollarsFromFixtures` tested directly and `jobTotalWithRidersDollars` on `jobFormRevenueDollars` since v2.3922 | Done (order #5, first half) |
| Billing slice | `persistBillingSlice` 806–863, `billingAutosave` 865, rebaseline 880–894 | — | `jobs_ledger`, `jobs_ledger_payments`, `jobs_ledger_fixtures`, rpc `log_job_discount_event` | payload kernels tested; sequence **untested** | Save-engine seam (last) |
| Party + GC default | GC default effect 901–909, `pickGcCustomerId`/`pickCustomerId` 953–977 | 8 / 3 setters | — | `billToParty`, `billVisibility`, `jobPartyExclusive` tested | Stays |
| Identity slice | `identityFields` 914–936, `persistIdentitySlice` 1080–1124, `autoCloseJobDispatchRequests` 1030–1063, bid-outcome toast 1071–1078 | — | `jobs_ledger`, `dispatch_requests`, `bids` | payload + `jobDispatchAutoClose` + `bidOutcomeFromJob` tested | Save-engine seam |
| Property candidates | **`useJobPropertyCandidates`** (v2.3914), called where the effect ran | `propertyCandidates` (the hook's); `customerAddressId` (the shell's, handed in with its setter) | `customer_addresses` | hook render test (5) | Done |
| Materials / team slices | `persistMaterialsSlice` 1139–1154, `persistTeamSlice` 1177–1207 (debounce 400), AM-unteam effect 1167–1172 | — | `jobs_ledger_materials`, `jobs_ledger_team_members` | payload / diff tested | Save-engine seam |
| Undo-to-opened | effect 1234–1254, `undoAvailable` 1257–1264, `performUndo` 1266–1299 | 26 setters | — | `jobFormUndo` tested | Stays (26 setters) |
| Autosave aggregate | `editAutosaveAggregate` = `jobFormAutosaveAggregate(editAutosaveSlices, identityBlocked)` | — | — | `jobFormFooter` tested | Kernel since v2.3908; the shell keeps the one call |
| % done | `commitPctComplete` 1327–1342 | `pctSaving`, `editing` | `jobs_ledger` (+ thread note) | `stagesPctNote` tested | Stays |
| Import gate | `newJobImportBlockedByContent` 1373–1417, force-close effect 1418–1422 | — | — | `jobFormRows` tested | Stays |
| Delete gate | `materialsBilledTotalForMigrate` … `reassignRequired` 1552–1595 | — | — | none | Moves with labor hook inputs |
| New Job discard guard | `currentNewJobSnapshot` 1601–1622, arm/capture 1626–1633, `confirmDiscardNewJobIfDirty` 1640–1657 | — | `ui_nav_clicks` via `recordNavClick` | `newJobDraftDirty` tested | Stays |
| Close guard | `finishClose` 1660–1676, `closeFormWithoutSaving` 1684–1688, `editCloseSideEffectsNeeded` 1703–1714, `runEditCloseSideEffects` 1717–1751, `closeForm` 1753–1790, visibility flush 1795–1801 | `closeFlushState` | `customers`, rpc `update_job_status` | `jobFormCloseFlush` tested; guard **untested** | Save-engine seam |
| Hydrate / reset | `applyEditJob` 1803–1880 (41 setters), `resetNewForm` 1882–1930 (43 setters) | — | — | none | Stays |
| ~~Bid / estimate import~~ | **`hooks/useJobFormImport.ts`** (v2.3949): `cancelBidImport`, `applyPrefillFromBid`, `handleWinningGcPick`, `applyPrefillFromEstimate` | the shell's form setters, handed in (20) + `closeFormRef`, `newJobSnapshotArmedRef`; `winningGcPick` stays the shell's | `bids`, `jobs_ledger`, `bid_versions`, `bid_version_sends`, `bid_gc_recipients`, `customers`, `estimates` | hook render test (22) over a per-table client; `jobImportFromBid` + `jobImportFromEstimate` tested | Done (order #7) |
| Init | effect 2286–2427 (writes 20), prefill timing 2429–2438, bid-summary backfill 2440–2453 | 20 | `customers`, `projects`, `bids` (800), `service_types`, `users`, `developments`, rpc `next_job_number_suggestion` | none | Stays |
| ~~Labor loader~~ | **done v2.3871** — `hooks/useJobFormLabor.ts` (the team read as before; the sub half on `useJobDetailSubLaborCost` + `lib/jobs/subLaborSummary.ts`, the shared `laborJobSubCost`) | the six names come back from the hook | `loadTeamLaborData`; the sub reads are the detail hook's | the hand copy of the drive-cost formula is gone; `subLaborSummary.test.ts` + `useJobFormLabor.render.test.tsx` | keyed on the job id alone (the number deps were pre-v2.3060) |
| Highlight / focus effects | 2572–2680 (9 effects) | 5 highlight flags, `customerSearch`, `dateMet` | — | none | Stays |
| ~~Invoice creation~~ | **`hooks/useJobFormInvoiceActions.ts`** (v2.3934): `createInvoice`, `createInvoiceFromSelectedSegments` / `createInvoiceFromSegmentIds`, `billStageRow`, `carveInvoicesByPayer`, `billHazmatFeeSeparately`, `moveWorkingJobToReadyToBillFromEdit`, `getEditJobBillableRemaining` | the hook's 6 busy flags; the shell's `editing`, `error`, `selectedSegmentIds`, `billToEditorInvoice` through their setters | `jobs_ledger_invoices`, `jobs_ledger_fixtures`, rpcs `update_job_status`, `ensure_single_ready_to_bill_invoice_for_job` | hook render test (26) over a recording client; `draftInvoiceWrite` + `jobFormInvoiceClamps` tested | Done (order #6) |
| Row handlers | 3170–3499 (materials, payments, fixtures, discounts, `setJobTotalFromTyped` 3420–3426) | row arrays | — (the standing read and the waive write are **`useStandingDiscountOffer`**'s since v2.3914) | `discountLine`, `jobFormReorder` tested | Stays |
| ~~Payment actions~~ | **`hooks/useJobFormPaymentActions.ts`** (v2.3956): `requestRemovePaymentRow`, `confirmRemovePaymentRow`, `finishRecordPaymentOnBill`, `executeUnlinkMercuryFromBankRow`, `confirmUnlinkMercuryFromBankRow`, the `persistedLedgerPaymentIds` / `paymentRemovePreview` / `paymentRemoveConfirmsPersistedRpc` memos | the hook's 4 confirm/busy states (their setters handed back for the shell's close, hydrate and reset); the shell's `payments`, `editing` through their setters | rpc `remove_jobs_ledger_payment_and_reconcile` | hook render test (18); `jobFormPaymentActions` + predicates tested | Done (order #8) |
| Customer / development writes | `handleCreateCustomerFromJob` 3501–3568, `handleLinkToSimilarCustomer` 3570–3603, `handleCustomerImport` 3605–3626, `createDevelopmentFromPicker` 3633–3659 | customer fields, `customers`, `developments` | `customers`, `jobs_ledger`, `developments` | `jobDevelopments` tested | Stays (callbacks) |
| Create / delete / migrate | `createJob` 3667–3767, `deleteJob` 3769–3782, `migrateJobLedgerCostsAndDelete` 3784–3831, `migrateJobLedgerCostsToBidAndDelete` 3839–3885 | `saving`, `deletingId`, `error` | 6 tables (`jobs_ledger`, the 4 child tables, `customers`; + `bids` via `readBidOutcomeForToast`) + rpcs `snapshot_job_budget_from_bid`, both migrate RPCs | **none** | Save-engine seam |

---

## Modal lifecycle

### Open / close / remount

- **Openers:** `openEditJob(jobId, {initialJob?, onSaved?, billingCustomerHighlight?, fixturesSectionHighlight?, paymentsReceivedHighlight?, jobPicturesLinkHighlight?, alsoOpenCreateCustomerModal?, initialTab?, propertyRecordFocus?, focusRow?})` first tries the Job window bridge; only when no window is registered does the context mount the standalone form. `openNewJob({onSaved?, onCreatedJobId?, projectId?, prefillBidId?})` always mounts standalone. Every open bumps `jobFormModalInstanceSeed` → fresh mount, clean state.
- **Init** (effect 2286–2427, keyed on `authUser?.id`): parallel loads of `customers` (incl. `billing_email`, `gc_pays_by_default`, `sees_customer_bills`, `date_met_source`), `projects`, `bids` (latest 800, `partitionBidsByScope` with `fetchTwinUserIds` to drop twin-seat bids), `service_types`, the caller's `users` row (per-role `*_service_type_ids`), `developments`; role-filtered people via `fetchActiveUsers` (dev also loads dev users). Then:
  - **new:** `resetNewForm(newJobProjectId)`; RPC `next_job_number_suggestion` with `clickNumberSuggesting` (C# shows "finding…"; the late value fills only an empty box); default trade via `pickDefaultServiceTypeId`, recorded in `initialNewJobServiceTypeIdRef`; a `newJobProjectId` prefill pulls the project's customer.
  - **edit:** `fetchJobWithDetailsById(editJobId)` (fallback `initialJob`; not found → toast + `onClose()`); `applyEditJob(job, billingGate, fixturesGate, picturesGate)` hydrates 41 states (incl. `breakOffPrefillAmountStringFromJob`, `hideHcpEntryField`, `hydratedPaymentIdsRef`, discount snapshot); `setPaymentsReceivedHighlight`; `alsoOpenCreateCustomerModal` + a customer name opens the create-customer modal.
  - Both end `setInitDone(true)`; until then a bare "Loading…" (embedded: inline text; standalone: overlay).
- **Bid prefill timing** (2429–2438): once `initDone && mode==='new'`, runs `applyPrefillFromBid(newJobPrefillBidId, undefined, { closeOnCancel: true })` once (`newJobPrefillBidAppliedRef` Strict-Mode guard + `bidId === pid` short-circuit).
- **Close** (`closeForm` 1753–1790): bail while a flush is saving → **New Job discard guard** (`confirmDiscardNewJobIfDirty`) → cancel every slice debounce → fast path when nothing needs flushing and `editCloseSideEffectsNeeded()` is false → else flush billing → identity → materials → team (`flushForClose`, first failure stops) then `runEditCloseSideEffects` (`customers.date_met` backfill stamped `date_met_source: 'manual'` + the paid→billed demote via `update_job_status`), all under one 15 s `withOperationTimeout`. Failure or timeout keeps the form open with the §15a banner (Retry and close / Keep editing / Close without saving). Callers that navigate after closing (trade pill → Stages, Job Detail bridge) await the boolean. Delete and both migrate paths use `closeFormWithoutSaving()` (clears slice baselines — a flush would reinsert children of a dead job). `visibilitychange → hidden` flushes all slices (1795–1801). An invalid identity slice (required field blank) never persists — the footer reads "Waiting on required fields".
- **Escape** (after the payment/delete state, ~1430 since v2.3839): window listener → `closeFormRef.current()` unless `escCloseBlocked` (23 terms: `externalEscBlocked`, the three link/import flags, create-customer, segment generator, `bannerOverlayOpen`, Stripe preview, `billViewInvoice`, `agreedWriteDownInvoice`, `billToEditorInvoice`; and since v2.3839 `invoiceListOverlayOpen` / `peoplePickerOverlayOpen` (reported by `JobFormInvoiceList` / `JobFormPeoplePicker` through `onOverlayOpenChange`), the two inline payment confirms, record-payment / undo-part / move-payment, delete + migrate, `winningGcPick`, terms, the Stages drawer) or `isTopmostModal()` is false (`useModalStackEntry(!embedded)`, Tier-2 #42). A new stacked layer adds its flag here (quirk #29).
- **onSaved / onCreatedJobId** ride refs (346–349); `onSaved` fires after every slice persist, every immediate write, invoice/payment actions, status moves, create, delete and migrate.

### Dirty tracking — two New Job gates + edit-mode undo

- **Import gate** — `newJobImportBlockedByContent` (1373–1417) over `newJobFormHasBlockingContent` (19 inputs: 14 fields + the auto-picked trade + 4 row arrays). `JobFormHeaderRow` still renders Import but greys it with a hint toast via `newJobImportButtonState` (never `disabled`, v2.2909); effect 1418–1422 force-closes an open Import modal once content appears.
- **Discard guard** — `newJobInitialSnapshotRef` is armed at init (1626–1628) and captured on the next render (1629–1633); `applyPrefillFromBid` re-arms after an import so imported rows are baseline. `confirmDiscardNewJobIfDirty` compares via `newJobDraftIsDirty` and asks "Discard this job?" once at a time; `newJobSkipDiscardGuardRef` is set before `createJob`'s own close.
- **Edit mode** has no discard prompt — it autosaves. `performUndo` restores the snapshot taken on hydrate (re-based when the invoice set changes, `invoiceSetKey`), and the autosave persists the revert.

### Prefill appliers — in `useJobFormImport` since v2.3949

- **`applyPrefillFromBid(bidRowId, forcedGc?, opts?)`**: fetches the bid (+ `agreed_value`, embedded customer); first pass checks `jobs_ledger` for jobs already on this `bid_id` and asks through `confirmDialog` (`secondConversionMessage`) — Cancel → `cancelBidImport`; builds GC packets from `bid_versions` + `bid_version_sends` + `bid_gc_recipients` (+ `customers` names) → `resolveWinningPacket` (silent single winner, else `PickWinningGcModal` via `winningGcPick`, carrying `closeOnCancel`); asks "Start the job at $X?" for the bid's `agreed_value` when set, else the sent value (forced/picked packet → auto winner → lone packet) — Yes replaces the line items with one "Bid price" line and back-fills `bids.agreed_value` only when null (`.is('agreed_value', null)`), No writes nothing; sets bid link, name, address, `linkedBidSummary`, `linkedBidGc`, the bid's GC through `pickGcCustomerId`; applies the trade only if the role-filtered list allows it; fills drive/plans links only when blank. `handleWinningGcPick` (2148–2186) records the win through `setGcPacketOutcome` then re-enters with `forcedGc`.
- **`applyPrefillFromEstimate(estimateId)`**: refuses an estimate already on a job; clears the bid link; line items via `normalizeEstimateLineItemsFromJson` + `fixturesPayloadForCreateJobFromEstimate`; applies the customer (fetching an uncached/archived row).
- **`createJob` tail** (3734–3748, after the child inserts 3722–3733): `onCreatedJobIdRef`, `recordNavClick('job_created', jobCreatedTelemetryTarget(...))`, `JOB_CREATED_FROM_BID_EVENT`, `snapshot_job_budget_from_bid` when `carryBidBudget` (best-effort toast), `closeOpenJobFromBidRequests`, and the bid-outcome toast.

### Highlight / focus doors

Props → state → scroll/flash effects (2572–2680): `billingCustomerHighlight` (clears once `customerId` is set), `fixturesSectionHighlight` and `jobPicturesLinkHighlight` (auto-clear after the flash; pictures focuses the input), `paymentsReceivedHighlight` (v2.3795, rings the 4493 wrapper), `focusFieldFlash: 'status' | 'pct'` (v2.3819, rings the stepper or the % done bar). `propertyRecordFocus` and `focusRow` (fact rows) pass straight to `JobFormEditFactRows`.

---

## Stage-A inventory

Module scope holds no functions. Every kernel the shell calls is already in `lib/` — the Stage-A work left is **logic still inline in handlers** (below).

| Landed kernel | Used for | Tested |
|---|---|---|
| [`lib/jobs/jobFormAutosaveSlices.ts`](../src/lib/jobs/jobFormAutosaveSlices.ts) | slice JSON, `buildEditJobIdentityUpdatePayload`, `fixtureInsertRows` / `materialInsertRows` / `paymentInsertRows`, `diffTeamMemberIds`, `identitySliceReadyToSave`, `shouldDemotePaidJobToBilled` | yes |
| [`lib/jobs/jobFormFooter.ts`](../src/lib/jobs/jobFormFooter.ts) | the footer's rules: `jobFormAutosaveAggregate` (worst-first across the slices), `jobFormAutosaveStatusWords` / `…Color`, `jobFormFooterShowsDelete` (not `primary`; the Job window's Edit region only) | yes |
| `paymentRowsDiff.ts`, `jobFormCloseFlush.ts` (reached via `useJobFormAutosaveSlice.flushForClose`, not imported by the shell), `jobFormUndo.ts`, `newJobDraftDirty.ts`, `jobFormRows.ts` | payment diff (B5), close flush, undo, discard + import gates, row hydration | yes |
| `jobFormBreakOff.ts`, `jobSegmentsCoverage.ts`, `segmentGenerator.ts`, `ensureRtbRemainderResult.ts`, `editJobBillingBar.ts`, `editJobInvoiceSendBack.ts`, `splitByPayer.ts`, `stagePlanForm.ts` | money: remaining, coverage, segment net, payer carves, bar, stage plan | yes |
| `discountLine.ts` (re-export of `supabase/functions/_shared/discountLine.ts`), `discountActivity.ts`, `jobFormFixtureHydrate.ts`, `jobFormReorder.ts` | discount rows, standing offer, discount event diff | yes |
| `jobFormPaymentPredicates.ts` | Stripe/Mercury lock + `stripeHoldsPaymentReason` / `unlinkedPaymentToastText` | yes |
| `billToParty.ts`, `billVisibility.ts`, `jobPartyExclusive.ts`, `jobDevelopments.ts`, `jobFormServiceTypes.ts`, `jobFormCustomerDisplay.ts`, `jobFormBidLinkTitle.ts`, `jobFormMoney.ts`, `stagesPctNote.ts` | party / identity rules | yes |
| `lib/bids/{gcPackets,versionSends,gcPacketOutcome,wonMomentActions,bidOutcomeFromJob,bidBoardJobLinks}.ts`, `jobDispatchAutoClose.ts`, `dispatchRequestClosure.ts` | bid import + side effects | yes |
| `revenueFromJobFixtures.ts` (`revenueDollarsFromFixtures`) | **the Job Total** | yes (direct since v2.3922) |
| [`lib/jobs/jobFormMoneyTotals.ts`](../src/lib/jobs/jobFormMoneyTotals.ts) | `jobFormRevenueDollars` (the Job Total with riders), `jobFormPaidDollars` (the paid sum), `jobFormPaymentRemovePreview` | yes |
| [`lib/jobs/draftInvoiceWrite.ts`](../src/lib/jobs/draftInvoiceWrite.ts) | the draft-invoice write taking `supabase`: `writeDraftInvoice` (insert → `afterInsert` → re-sync), `insertDraftInvoice`, `linkFixturesToInvoiceByPositions`, `resyncRemainderAfterDraft`, `draftInvoiceErrorMessage` | yes (mocked client, pins the order) |
| [`lib/jobs/jobFormInvoiceClamps.ts`](../src/lib/jobs/jobFormInvoiceClamps.ts) | the invoice doors' money rules, in whole cents: `planTypedInvoice`, `segmentSelectionBillCheck`, `isFullRemainingAmount` | yes |
| [`lib/bids/jobImportFromBid.ts`](../src/lib/bids/jobImportFromBid.ts), [`lib/jobs/jobImportFromEstimate.ts`](../src/lib/jobs/jobImportFromEstimate.ts) | the import's decisions: which GC the job is for, the figure it opens at and the question asked, the job's GC, what a pick writes on the bid; the estimate's line items and customer fields | yes |
| [`lib/jobs/jobFormPaymentActions.ts`](../src/lib/jobs/jobFormPaymentActions.ts) | the payment lines' rules: `mergePaymentRowUpdate` (what a locked line keeps), `paymentRowsAfterRemove`, `planPaymentRemoveRequest` + its refusal words, `paymentRemoveWritesNow`, `removePaymentReply` (the remove RPC's answer) | yes |
| [`lib/jobs/jobFormSliceWrites.ts`](../src/lib/jobs/jobFormSliceWrites.ts), [`lib/jobs/jobFormCloseSideEffects.ts`](../src/lib/jobs/jobFormCloseSideEffects.ts) | the save engine's writes, taking `supabase`: the billing, materials and team slices and a new job's child rows, in their order; `autosaveFailureWords`; the two close checks (`closeDateMetBackfillNeeded`, `closeDemoteToBilledNeeded`) | yes (mocked client, pins the order and where a failure stops) |
| `lib/bids/openJobFromBidDispatchRequest.ts`, `postJobThreadNote.ts`, `fetchJobWithDetailsById.ts` | IO helpers | no |

**Component-side hooks** (`src/components/jobs/`): `useJobFormAutosaveSlice` (186 lines, debounce default 1,200 ms), `useBreakOffSlider` (303), `useJobCostSnapshot` (95), `useJobMigrate` (333) — **none has a direct test** (`useBreakOffSlider` is only type-mocked by the BreakOffSection render test). `src/hooks/` used here (`useJobStagePlanInputs`, `useGcPortalLinks`, `useCustomerTermsWarning`, `useJobHazmatIncidents`, `useModalStackEntry`, `useNarrowViewport640`) are untested.

**Still inline (Stage-A candidates):**

| Logic | Where | Why it matters |
|---|---|---|
| ~~Revenue-with-riders + paid-sum~~ | gone v2.3922 | every copy calls `jobFormMoneyTotals` — revenue in `jobTotalWithRidersDollars`, `persistBillingSlice`, `editCloseSideEffectsNeeded`, `runEditCloseSideEffects`; the paid sum in `segmentCoverage`, the two close checks, `getEditJobBillableRemaining`, `agreedWriteDownInvoicePaidSum`; `paymentRemovePreview` is the kernel's |
| ~~Draft-invoice write~~ | gone v2.3926 | `createInvoice`, `createInvoiceFromSegmentIds` and `billHazmatFeeSeparately` call `writeDraftInvoice` (insert the draft → the door's attach step → the remainder re-sync on a Ready to Bill job); each door keeps its own attach step, toasts and refetch |
| ~~Invoice clamps~~ | gone v2.3929 | `lib/jobs/jobFormInvoiceClamps.ts`: `planTypedInvoice` (cents min against what is left; the full remainder on a Ready to Bill job → Bill Customer), `segmentSelectionBillCheck` (the cents backstop), `isFullRemainingAmount` (Working → Ready to Bill) |
| ~~Sub-labor drive cost~~ | gone v2.3871 | the form reads `laborJobSubCost` through `subLaborSummary` |
| ~~Sent-value / winner decision~~ | gone v2.3939 | `lib/bids/jobImportFromBid.ts`: `bidImportGcOptions`, `decideBidImportGc` (silent single winner, else ask), `bidImportCarry` (the agreed value, else what was sent), `bidImportCarryQuestion`, `bidImportFirstLine`, `bidImportEffectiveGc`, `bidImportWinWrite`; `lib/jobs/jobImportFromEstimate.ts` for the estimate's rows and customer fields |

---

## The save engine — MONEY-PATH

Edit mode has **no Save button** (v2.1080): four `useJobFormAutosaveSlice` instances persist — registered, with their mirror refs and writers, in [`useJobFormAutosaveEngine`](../src/hooks/useJobFormAutosaveEngine.ts) since v2.3973 — `createJob` is the New Job button only, and the close guard runs the paid→billed demote and `date_met` backfill. Flagged in [BILLING_FLOWS](./BILLING_FLOWS.md) as payment-write path **E** and candidates **#9/#10** (both struck through there — fixed by B5 and B3/B4; only #10's B6 hard write-guard is still open). **The map documents; it does not fix.** Since v2.3966 the write sequences below are [`lib/jobs/jobFormSliceWrites.ts`](../src/lib/jobs/jobFormSliceWrites.ts) (`writeBillingSlice`, `writeMaterialsSlice`, `writeTeamSlice`, `writeNewJobChildRows`), each taking `supabase` and tested over a client that records the order; the shell's `persist*Slice` functions read their refs, call the writer, and toast a failure. The identity slice's writer stays inline (one update between two bid reads and the dispatch auto-closes).

| Slice | Writer (lines) | Debounce / gate | Write sequence | Errors |
|---|---|---|---|---|
| billing | `persistBillingSlice` 806–863 | 1,200 ms | `UPDATE jobs_ledger SET revenue` (fixtures + rider fees; `payments_made` is trigger-derived since B3/B4) → payments **diffed** (`diffPaymentRows` over `hydratedPaymentIdsRef`: delete owned-and-gone ids, upsert the rest) → fixtures **delete + reinsert** one row at a time (`fixtureInsertRows`, carries `invoice_id`) → discount events via `log_job_discount_event` (fire-and-forget) | every write checked → toast, slice `error` |
| identity | `persistIdentitySlice` 1080–1124 | 1,200 ms; `enabled: identitySliceReadyToSave` | one `UPDATE jobs_ledger` from `buildEditJobIdentityUpdatePayload` (master via `resolveEditJobMasterUserId`, customer / GC / development re-resolved) → bid-outcome toast when `bid_id` changed → `autoCloseJobDispatchRequests` for blank→set pictures link / phone | checked; dispatch close only `console.warn`s |
| materials | `persistMaterialsSlice` 1139–1154 | 1,200 ms | delete + reinsert `jobs_ledger_materials` | checked |
| team | `persistTeamSlice` 1177–1207 | 400 ms | read existing → insert missing → delete removed (`diffTeamMemberIds`) | checked |
| close side effects | `runEditCloseSideEffects` 1717–1751 | every edit close when `editCloseSideEffectsNeeded()` | `customers.date_met` backfill; `update_job_status(p_to_status 'billed')` when `shouldDemotePaidJobToBilled` (form refs, not DB) | toast only, never blocks close |
| **create** | `createJob` 3667–3767 | Create Job button (`jobFormCanSubmit`) | `resolveEffectiveJobMasterUserId` → `INSERT jobs_ledger … select('id').single()` (24 columns incl. GC, bill-to, `show_bills_to_other_party`, `customer_address_id`, development, AM, title-cased address) → sequential inserts of payments / materials / fixtures / team → tail (above) → `date_met` backfill → `closeForm()` → `onSaved` | **only the `jobs_ledger` insert is checked**; child inserts are awaited one by one but their errors are never read |

**Contracts any seam must keep:** `FixtureRow.invoice_id` rides both fixture write paths and the slice JSON (v2.1068–69); `hydratedPaymentIdsRef` is re-captured by `applyEditJob`, `refreshEditingJobAndHydratePayments` 545–557, each billing persist (838) and the undo-part / record-payment successes — **not** by the remove-payment (3270–3274), Mercury-unlink (3361–3365) or payment-Move (4568–4573) refetches, which re-hydrate `payments` only — and is **not** reset by Undo; `rehydrateFixturesFromDb` (886–894) re-baselines the billing slice through `rebaselineBillingNonce` after Bill Customer writes a discount row; invoice creators call `flushBillingAutosave()` first so `sequence_order` positions match the DB.

**The seam, as built (v2.3966 + v2.3973):** the write sequences are `jobFormSliceWrites`; the four slices, their mirror refs, their records of what was last saved and their writers are `useJobFormAutosaveEngine`, called once every field it carries is declared (after `teamMemberIds`). **Same order, same checked/unchecked errors, same non-transactionality**; the transactional `TODO(billing)` sits at the head of `jobFormSliceWrites`. The slices register in the order they had (billing → its re-baseline effect → identity → materials → team), so they keep their order among themselves; they now all run after three shell effects they used to be interleaved with (the GC-pays default, the property-candidates read, the Account Man un-team), none of which reads or writes a slice's refs. **Left in the shell, by decision:** the close guard (`closeForm`, `closeFormWithoutSaving`, `runEditCloseSideEffects`, the visibility flush) — it ends in `finishClose`, which resets a dozen pieces of the form's own state — and `createJob`. Error-checking `createJob`'s child inserts is a separate behavioral PR, not part of the decomposition. **Observed, not changed** (pinned in the engine's test): after `rehydrateFixturesFromDb` the billing slice is re-baselined, but the debounce the new rows started is not cancelled, so 1.2 s later the slice writes the same rows once more.

---

## Per-region dossiers

### 0. Shell + lifecycle

- **Anchor:** loading 3892–3915; overlay 3922–3941 (`JOB_FORM_OVERLAY_Z_INDEX` 1010, safe-area padding, backdrop click → `closeForm` when not embedded); card 3942–3959 (style-less when embedded).
- **Owns permanently:** init / prefill-timing / close, `applyEditJob`, `resetNewForm`, the reference caches (`customers`, `projects`, `bids`, `serviceTypes`, `meServiceTypeColumns`, `users`, `developments`), the z-ladder (`OVERLAY` 1010 → `NESTED` 1011 → `MIGRATE` 1012 → `IMPORT_SOURCE` 1013; `BILL_VIEW` = `NESTED + 1` = 1012; the Stages drawer passes `NESTED + 1` too), and context wiring (`useAuth`, `useConfirmDialog`, `useToastContext`, `useNavigate`, `useModalStackEntry`, `useNarrowViewport640`, `useLedgerPrefixMap`, `useJobHazmatIncidents`, `useBillCustomerModal`, `useJobDetailOpenerBridge`, `useNewProjectModal`).

### 1–2. Header row + source-estimate banner — extracted

- `JobFormHeaderRow` (v2.1094): title, HCP/C# help popover, Import (new) / Job Detail (edit — `closeForm()` then `jobDetailOpenerBridge.requestOpenJobDetail`), "Link to: Bid | Project" openers, and the new-mode **carry the bid's estimate as budget** toggle (`carryBidBudget`, v2.3302). Import/link modals + their open flags stay shell.
- `JobFormSourceEstimateBanner` (v2.1090): owns its estimate lookup and the acceptance-record modal; reports `onOverlayOpenChange` → `bannerOverlayOpen` for the Esc gate.

### 3. Identity fields — extracted

`JobFormIdentityFields` (v2.1091), fully controlled. Shell keeps `jobFormServiceTypeSelectOptions` (1487–1496: role-filtered + the current type injected in edit), `headerTradePill` (1499–1503), the `onTradePillClick` close-then-navigate to `/jobs?tab=stages&stagesJob=…`, and `hideHcpEntryField` (441, seeded from the `hideHcpFieldSetting` localStorage cache and re-decided by `applyEditJob`; effect 444–447 only refreshes that cache for the next open).

### 3a–3c. Edit-mode stack — extracted

- **`JobFormStagesGroup`** (4036–4043): the stage-plan read-out; eye toggles call `updateFixtureRow(id, { shared_with_gc })`; "see as customer" opens the shell-owned `JobFormStagesDrawer` (5308–5322, portal link via `useGcPortalLinks`, sample URL when none); `onGoToBill` → `onRequestRegion('bill')`.
- **`JobStatusStepper`** (4048–4063): quick stage moves + Collections flag; writes itself, calls `onSaved`.
- **`JobFormEditFactRows`** (4064–4153, 1,214 lines, render-tested): label · value · pencil rows for people, Account Man, customer, GC (`pickGcCustomerId`), who pays (`billToParty`), copy other party, property record (`propertyCandidates`, `customerAddressId`, `onPropertyAdded`, `onOwnerConfirmed`, `onPropertyKindSaved`; owner lookup box v2.3452), links (project, plans, bid, development), and the lien contract row (`contractJob`). The shell passes ~75 props; all state stays shell-side because the identity slice, undo and `applyEditJob` read it. `onCustomerPatched` → `patchCustomerRow` mirrors the GC billing email the row wrote straight to `customers`.

### 4–6. New-mode people, customer, links — extracted

- `JobFormAccountManSection` + `JobFormPeoplePicker` (4157–4165). Effect 1167–1172 clears the AM when un-teamed (mirrors the DB trigger, v2.1466); effect 1354–1372 resolves off-list team ids through `fetchUserDisplayNames`.
- `JobFormCustomerSection` (4187–4231): owns only picker-local state (`customerDropdownOpen`; its GC picker's `gcSearch` / `gcDropdownOpen`); archived customers filtered by `filterActiveCustomersForPicker` inside the section. Shell keeps every field, `customerExpanded`, highlight refs, `handleCustomerImport`, and the two immediate-write handlers.
- `JobFormLinksSection` (4232–4254): project / plans / bid / development; `createDevelopmentFromPicker` (3633–3659) inserts `developments` under the job's master.
- `CustomerTermsBar` / `CustomerTermsModal` (4170–4186) render in **both** modes for the payer (`termsPayerId`: the GC when bills go to the GC, else customer, else GC).

### 7. Line items — extracted (#435)

`JobFormFixturesSection` (now "① Line Items"). Shell keeps: `fixtures` + the `setFixtures` discount-invariant wrapper, `fixtureScopeExpandedById`, `riderRows` (`JobFormHazmatRiderRows` with "Bill separately…" → `billHazmatFeeSeparately`), `addDiscountRow` (3479–3486), `setJobTotalFromTyped` (3420–3426, "Make the Job Total $X" → `applyTargetJobTotal`), `moveFixtureRowInList`, `removeFixtureRow` (refuses the last row), the §17 preview opener, and split-payer tags (`gcNameForPayerTags` 2897–2900). The standing-discount offer is **`useStandingDiscountOffer`** (v2.3914: reads `customers.standing_discount_pct`, Apply writes the rows through the shell's `setFixtures`, waive writes `jobs_ledger.standing_discount_waived_at`).

### 8. Billing header + money bar

Standalone shows a "Billing" header with the billing-slice status; embedded shows only a right-aligned status line while saving/failed (4296–4340). `MoneyLifecycleBar` (4342–4394) renders `billingBar` (paid / billed-unpaid / draft / remaining) with `billingBarMarks` segment ticks; its % done input calls `commitPctComplete` (immediate `jobs_ledger.pct_complete` write + auto thread note, outside the slices). Embedded-only `JobFormBillJobAccountNote` (4399–4408) reads the Costs region's `supplyInvoiceLines` and can jump to Costs.

### 9. Invoices block (edit) — children extracted, handlers in `useJobFormInvoiceActions` (v2.3934)

- **Children:** `InvoicesSectionHeading`; `JobFormSegmentsBar` with `JobFormBreakOffTrack` in `trackSlot` (`billsAheadRemedyHint`); `JobFormBreakOffSection` (amount + equation row); `JobFormSegmentsCreateAction` (selection create + split-payer carve); `JobFormUpcomingDraws` ("Bill it" per ready stage row → `billStageRow`). All share the one `useBreakOffSlider` (1344); the shell destructures only `newInvoiceAmount` + its two setters (1348) and also reads `breakOff.breakOffRemaining` in `toggleSegmentSelected`.
- **Shell money handler:** `toggleSegmentSelected` (selection moves the bar to `segmentSelectionNetSummary` clamped to `breakOffRemaining`, never locks it) — it stays with the selection it writes.
- **The invoice doors — [`useJobFormInvoiceActions`](../src/hooks/useJobFormInvoiceActions.ts)** (19 inputs; the toast and Bill Customer contexts are read inside it). Plain functions made on every render, as they were in the form, so each reads the render it was called from: `createInvoice` (flush → clamp to remaining with toast → full remainder on an RTB job opens **Bill Customer** (customer precheck, three refresh callbacks) → else insert draft, link an exact single-segment match by `sequence_order` (v2.2467), ensure-resync, refetch + reseed); `createInvoiceFromSegmentIds` (net of coverage, cents backstop, flush, insert, link positions, mirror links locally, ensure-resync, refetch); `carveInvoicesByPayer` (one draft per payer via `planPayerCarves`, then stamps `bill_to_party`); `moveWorkingJobToReadyToBillFromEdit` (exact full remaining, Stripe void prep, `update_job_status('ready_to_bill')`); `billHazmatFeeSeparately` (own draft with memo, `linkHazmatFeeIncidentToInvoice`, ensure-resync, opens `JobFormBillToEditor`).
- **Remaining** = `unallocatedBillableDollars(total, paidSum, editing.invoices, payments)` (`getEditJobBillableRemaining`, inside the hook; open-line allocation since v2.3775).
- **Stay in the shell:** `selectedSegmentIds` (the toggle, hydrate, reset, undo and the estimate prefill write it too), `billToEditorInvoice` (the Esc gate and the invoice list read it), and the `payerCarvePlan` / `gcNameForPayerTags` memos (what the Bill tab shows before anything is written).

### 10–11. Invoice list — extracted (#430)

`JobFormInvoiceList` (875 lines, render-tested; row list since v2.3478). It self-sources router/toast/Bill Customer; every modal it opens is shell state (`billViewInvoice`, `agreedWriteDownInvoice`, `billToEditorInvoice`, `recordPaymentTarget`). Callbacks: `onInvoiceDeleted` → `clearFixtureLinksForDeletedInvoice` (746–748, mirrors ON DELETE SET NULL so a later reinsert can't carry a dead `invoice_id`), `onAddDiscountLine`, `onFixturesChangedOutside` → `rehydrateFixturesFromDb`.

### 12. Payments received — extracted (#431), actions in `useJobFormPaymentActions` (v2.3956)

- `JobFormPaymentsTable` (1,253 lines, render-tested): lock predicates, folded detail rows, blank manual rows hidden until manual entry opens, Move / Record-on-bill / Undo-part / Unlink openers.
- **Shell row handlers** (they write the list the autosave carries): `updatePaymentRow` re-freezes amount / paid_on / `mercury_transaction_id` / `invoice_id` on locked rows; `removePaymentRow` refuses locked rows and replaces an emptied list with one fresh row.
- **The actions — [`useJobFormPaymentActions`](../src/hooks/useJobFormPaymentActions.ts)**, called above the Escape gate, which reads two of its states while rendering: `requestRemovePaymentRow` toasts per lock type; `confirmRemovePaymentRow` → persisted unlocked rows call `remove_jobs_ledger_payment_and_reconcile` (immediate), unpersisted rows leave the form; `finishRecordPaymentOnBill` drops the hand-typed draft after `BilledPaymentConfirmationModal` records the real payment; `executeUnlinkMercuryFromBankRow` refuses while Stripe holds the payment (`stripeHoldsPaymentReason`), else the same RPC (marks a failed deposit returned, v2.3784). Success paths refetch and re-hydrate `payments`.
- **Modals (12a):** `UndoStripePartPaymentModal`, `BilledPaymentConfirmationModal` (`mode="invoice"`), `JobPaymentMoveModal` — each open state is shell (`undoPartPaymentRow`, `recordPaymentTarget`, `paymentMoveRow` — set from the table and the invoice list), each success refetches.

### 13–14. Costs region — extracted; labor loader inline

- `JobFormLaborCostPanel` (4584): charts only (`JobCostsTabCharts`, team labor gated by `showJobCostBreakdownTeamLabor`).
- `JobFormPartsCostSection` (4585–4608): "Where the money went" — parts accordions from **`useJobCostSnapshot`** (1455–1468: supply invoices / Mercury allocations / tally parts, accordion state, card + tally totals) plus the team / sub labor lines and "Open on Jobs →" links (`showTeamLaborOpenOnJobsLink` 1526–1533, `showSubLaborOpenOnJobsLink` 1535–1550; role gates 1519–1524) and the editable "Other job charges" (`materials`).
- **Labor loader — a hook since v2.3871 (`useJobFormLabor(jobId)`):** team labor = `loadTeamLaborData(supabase)` then the job's row, as before; sub labor = `useJobDetailSubLaborCost` (sheets by `job_ledger_id`, items, the drive-rate settings through the shared `jobSubLaborInputsFromRows`) summed by `subLaborSummary` → `laborJobSubCost`, so the form and the Job window's profit band read one kernel. The hook returns the six names the form used, so the delete gate (`hasMigrateableCosts`, `costCheckErrored`, `costSnapshotStillLoading`, `reassignRequired`) and the cost block are untouched.

### 15. Footer + close-flush banner — a component since v2.3908 (`JobFormFooter`)

[`JobFormFooter.tsx`](../src/components/jobs/JobFormFooter.tsx) draws both; the shell mounts it once with 13 values and 7 callbacks and keeps every flag, `performUndo`, the guarded close and `createJob`. Its rules are the [`jobFormFooter`](../src/lib/jobs/jobFormFooter.ts) kernel.

- **Banner:** only on `closeFlushState === 'error'` — Retry and close (`onClose`, the same guarded close as the footer's) / Keep editing / Close without saving.
- **Footer:** Delete (`showDelete` = `jobFormFooterShowsDelete`: edit, not role `primary`; in the Job window on the Edit region only; → `deleteJobConfirmOpen`), Undo ↔ "Revert everything since opening?" cluster (`undoAvailable`, `performUndo`), required-fields list, `editAutosaveAggregate` status (saving / error / blocked / pending / saved), Close (standalone only; "Cancel" in new mode) and Create Job (new mode → `createJob`). Phone edit layout (`narrowViewport`, v2.1239) stacks status over [Delete][Undo][Close].

### 16–18. Inline confirm overlays — components since v2.3872 (`JobFormPaymentRemoveConfirm`, `JobFormStripeLinePreviewDialog`, `JobFormMercuryUnlinkConfirm`)

All at `JOB_FORM_NESTED_OVERLAY_Z_INDEX` (1011) with safe-area padding. **16** "Remove payment?" (4898–5007): `paymentRemovePreview` (job total / remaining now / after) and copy forked on `paymentRemoveConfirmsPersistedRpc`. **17** Stripe line preview (5008–5108): every named line's Stripe description (`stripeFixturePreviewRows`, own Esc effect 596–606). **18** "Unlink and remove?" (5109–5217): Mercury double-count + demote warnings, busy-guarded.

### 19–20. Delete + migrate — extracted (#437)

`JobFormDeleteMigrateModals` + `useJobMigrate` (target search `search_jobs_ledger` / `search_bids_for_clock`, previews, bid dry-run). Cost gate: `reassignRequired = hasMigrateableCosts || costCheckErrored` replaces Delete with "Reassign…"; "Checking costs…" while `costSnapshotStillLoading`. Shell keeps `deleteJob` (direct `jobs_ledger` delete; cascade + archive trigger per BILLING_FLOWS), `migrateJobLedgerCostsAndDelete` (`migrate_job_ledger_costs_and_delete`, `p_allow_billed`), `migrateJobLedgerCostsToBidAndDelete` (`migrate_job_ledger_costs_to_bid_and_delete`, `p_dry_run: false`); all three end in `closeFormWithoutSaving()`.

### 21. Link / import / picker modals

- `JobBidLinkChoiceModal.onLinked` sets `bidId`, `linkedBidSummary`, `linkedBidGc`, fills the GC only when empty (v2.1182), expands links. `JobProjectLinkChoiceModal.onLinked` sets `projectId` (+ customer when empty) and focuses `jobFormProjectDisconnectRef`; `onCreateNew` opens the app-level new-project modal with prefill (`linkJobId` in edit).
- `JobFormImportEstimateOrBidModal` (z 1013) → the two appliers. `PickWinningGcModal` → `handleWinningGcPick` / `cancelBidImport`. `MultipleSegmentGeneratorModal` → `addGeneratedSegmentsToJob` (731–741, replaces a lone blank placeholder).
- `JobFormCreateCustomerModal` (always mounted): `onCreate` → `handleCreateCustomerFromJob` (edit: job master via `resolveEditJobMasterUserId`; else `resolveEffectiveJobMasterUserId` = project owner, else company owner / override, else self — one company since v2.2972, master is provenance), inserts `customers` and **in edit mode immediately updates `jobs_ledger.customer_id`** + refetch + `onSaved`; `onLinkSimilar` → `handleLinkToSimilarCustomer` (same immediate write).

### 22. Tail modals — shell-owned, multi-region

- `AgreedWriteDownModal` (from the invoice list): `paidOnInvoice` = `agreedWriteDownInvoicePaidSum` (566–571), `canApplyAgreedWriteDown` (558–565: dev / master / assistant-like / primary); success → `refreshEditingJobAndHydratePayments`.
- `BilledBillViewModal` (from list **and** payments): `onAfterStripeDetailsLoaded` → `refetchEditingFromBillView` (364–377); `onClose` runs the 3-attempt / 280 ms refetch loop waiting for memo/footer.
- `JobFormBillToEditor` (from list **and** the riders "Bill separately…" flow, v2.1086): save → refetch `editing`.

---

## Supabase surface (direct from this file; fact sheet)

- **Tables (21):** `jobs_ledger` (insert in `createJob`; update in identity/billing slices, `commitPctComplete`, `waiveStandingOffer`, the two customer handlers; delete in `deleteJob`), `jobs_ledger_payments` (diff delete/upsert; create inserts), `jobs_ledger_fixtures` (delete + reinsert; create inserts; `invoice_id` link updates), `jobs_ledger_materials` (delete + reinsert; create inserts), `jobs_ledger_team_members` (read/insert/delete; create inserts), `jobs_ledger_invoices` (draft inserts ×3; `bill_to_party` stamp), `customers` (reads; insert; `date_met` backfill; standing-discount read), `developments` (insert), `dispatch_requests` (auto-close update), `bids` (reads; conditional `agreed_value` update); reads only: `customer_addresses`, `bid_versions`, `bid_version_sends`, `bid_gc_recipients`, `estimates`, `projects`, `service_types`, `users`, `people_labor_jobs`, `people_labor_job_items`, `app_settings`.
- **RPCs (8):** `next_job_number_suggestion`, `log_job_discount_event`, `update_job_status` (RTB move + close demote), `ensure_single_ready_to_bill_invoice_for_job`, `remove_jobs_ledger_payment_and_reconcile` (remove / record-on-bill draft drop / Mercury unlink), `snapshot_job_budget_from_bid`, `migrate_job_ledger_costs_and_delete`, `migrate_job_ledger_costs_to_bid_and_delete`.
- **Edge function:** `get-stripe-invoice-details` (memo/footer backfill, dev-gated Stripe mode via `stripeModeForBillingFromRole`, A5). Stripe void prep runs inside `prepareBilledInvoicesBeforeJobRevertToReadyToBill`.
- **Via hooks / children (not exhaustive):** `useJobMigrate` (`search_jobs_ledger`, `search_bids_for_clock`, `bids`, the `migrate_job_ledger_costs_to_bid_and_delete` dry run), `useJobCostSnapshot` → `fetchJobMaterialsCostSnapshot` (`get_invoice_amounts_for_jobs`, `list_tally_parts_with_po`, `supply_house_invoice_job_allocations`, `mercury_transaction_job_allocations`), `useJobStagePlanInputs` (`job_stage_windows`, `step_commitments`, `people_labor_jobs`), `resolveEffectiveJobMasterUserId` (`projects`, `app_settings`).
- **No realtime channels.** Refresh is refetch-on-action (`fetchJobWithDetailsById`) plus the cross-surface `JOB_CREATED_FROM_BID_EVENT`.

---

## Test coverage

- **The shell:** only [`JobWindowModal.render.test.tsx`](../src/components/jobs/JobWindowModal.render.test.tsx) mounts it for real (embedded, edit mode, stubbed job): tab order, one ✕, Edit/Bill region toggling with typed state surviving, Costs region content, History tab. **No new-mode render, no test drives `createJob`, `closeForm`, the four `persist*Slice` sequences, or any invoice / payment handler.** Three other render tests (`DispatchInboxSection`, `BidFormModal`, `BidWonJobActions`) mock `JobFormModalContext` and never render it.
- **Children with render tests:** IdentityFields, StagesGroup, StatusStepper, EditFactRows, CustomerSection (create), FixturesSection (×2), DiscountRow, HazmatRidersStrip, MoneyLifecycleBar, BillJobAccountNote, SegmentsBar, BreakOffSection, InvoiceList, UpcomingDraws (in `JobFormFixturesSectionStagePlan.render`), PaymentsTable, BilledPaymentConfirmationModal, PartsCostSection, MultipleSegmentGeneratorModal, StagesDrawer, CreateCustomerModal, the three confirm overlays (`JobFormOverlays.render`), Footer.
- **Untested children:** HeaderRow, SourceEstimateBanner, AccountManSection, PeoplePicker, LinksSection (685 lines), LaborCostPanel, `UndoStripePartPaymentModal`, `JobPaymentMoveModal`, **`JobFormDeleteMigrateModals` (739) + `useJobMigrate` (333)**, link-choice / import / winning-GC modals, **`AgreedWriteDownModal` (390)**, `BilledBillViewModal`, `JobFormBillToEditor`, CustomerTermsBar/Modal.
- **Money risk flags:** `useBreakOffSlider` is untested; `createJob`'s unchecked child inserts have no test.

---

## Quirks (preserve, don't fix)

1. **Child-row write shapes differ per table:** fixtures and materials delete + reinsert on every slice write (id churn); payments are **diffed** (B5, `diffPaymentRows`; rows born mid-edit — Stripe webhook payments — survive); team is diffed.
2. **Error handling differs per path:** every edit-mode slice write is checked (toast → slice error → close-guard banner); `createJob` checks only the `jobs_ledger` insert — its payment / material / fixture / team inserts are awaited but never error-checked, so a mid-loop failure silently drops rows on a job that exists.
3. **`payments_made` is trigger-derived** (B3/B4, v2.1119–v2.1120); no client writes it (B6 hard write-guard still pending — BILLING_FLOWS #10).
4. **Scope-only fixture rows are dropped on save** (`fixtureInsertRows` filters on the normalized name) yet count as blocking content for the Import gate.
5. **Paid→billed demote tolerance** is `revenue > payments + 0.01` (`shouldDemotePaidJobToBilled`), judged at close from the form's refs, not the DB.
6. ~~**Revenue and paid sum are recomputed in 4 and 5 places**~~ — one kernel since v2.3922 (`jobFormMoneyTotals`); the sum with the rider fees is still not rounded again after the line items round to cents.
7. **Mount-only init** under the file-top `eslint-disable`; correctness depends on remount-by-key.
8. **`editing` doubles as the mode flag** (65 reading units); edit mode refetches by id and falls back to `initialJob`.
9. **Stripe memo/footer backfill** invokes the edge function serially per invoice (dev gate now applied — the old "raw pref" quirk is fixed, here and in `AgreedWriteDownModal`).
10. **`BilledBillViewModal.onClose` retry loop** — up to 3 refetches, 280 ms apart.
11. **Z-index collision:** migrate, the `BILL_VIEW` constant (bill view + agreed write-down) and the Stages drawer all resolve to 1012.
12. **C# suggestion** fills asynchronously after init, only into an empty box.
13. **Master is provenance, not a wall** (v2.2972): new customers carry the job's master (edit) or the company owner (new); the local `CustomerRow` still needs `master_user_id` so the identity slice's re-resolve keeps the pick.
14. **Both New Job gates ignore GC, development, Account Man, bill-to and property** — `newJobFormHasBlockingContent` (19 inputs) and `NewJobDraftSnapshot` (18 keys) predate those fields.
15. **Discard vs autosave:** New Job asks before Cancel / Esc / backdrop discard; edit mode never asks (autosave), and "Close without saving" appears only after a failed flush.
16. **Redundant nested `editing` check** in the invoices block (`{editing && (<>…{editing ? <JobFormBreakOffSection/> : null}` at 4410 / 4432).
17. **Last-row semantics differ:** materials clear the last row in place; fixtures refuse to remove it; payments replace an emptied list with one fresh row.
18. **Immediate writes outside the slices (edit mode):** `handleCreateCustomerFromJob` / `handleLinkToSimilarCustomer` (`jobs_ledger.customer_id`), `commitPctComplete` (`pct_complete` + thread note), `waiveStandingOffer` (`standing_discount_waived_at`, fire-and-forget), the fact rows' GC billing email, and discount event logging (best-effort).
19. **Stale "Save the job to keep changes" toasts:** the bid / project link-choice `onLinked` handlers still say Save, but in edit mode the identity slice autosaves the link ~1.2 s later.
20. **Archived customers** are filtered out of the new-mode picker except the linked row (`filterActiveCustomersForPicker` inside `JobFormCustomerSection`).
21. **`updatePaymentRow` re-freezes locked fields** on Stripe/Mercury rows even when an update sneaks through.
22. **Blank manual payment rows are hidden** until manual entry is opened (`JobFormPaymentsTable`); the old "+ on the last unlocked row" is gone.
23. **Slider drags by relative pointer delta** (`breakOffSliderLastPointerXRef` in `useBreakOffSlider`), not absolute track position.
24. **`createInvoice` full-remainder special case** opens Bill Customer on an RTB job instead of inserting a second draft; over-entries clamp with a toast; an amount equal to one segment's remaining net links that segment (v2.2467).
25. **RTB move requires the exact full remaining**, flushes the billing slice, and runs Stripe void prep first.
26. **Labor loader over-fetches:** team labor loads every job's rows via `loadTeamLaborData` and filters client-side; the effect's deps still include `editing?.hcp_number` / `hcpNumber`, so it refetches on HCP keystrokes although sub labor joins by `job_ledger_id` since v2.3060.
27. **Delete hidden for role `primary`**, and in the Job window shown on the Edit region only; other roles rely on RLS.
28. **Failed cost checks force reassign** — `costCheckErrored` counts as "has costs".
29. **Esc gate (gaps closed v2.3839):** every layer the form stacks now blocks `escCloseBlocked` — before, Esc under the §16/§18 inline confirms, delete/migrate, `PickWinningGcModal`, terms, the Stages drawer (its own listener closed it *and* the form), the record-payment / undo-part / move-payment modals, the invoice list's three dialogs or the Add people dialog ran `closeForm()` underneath. Those layers still close only by their buttons (they have no Escape of their own); a layer added later must add its flag or report through `onOverlayOpenChange`.
30. ~~**The property loader's effect listed `open` in its deps**~~ — gone v2.3914: no local binding, so it was the global `window.open`, a constant; `useJobPropertyCandidates` keys on the customer and the GC alone, which is what ran.
31. **`finishRecordPaymentOnBill` polls `billingAutosave.isRunning()` every 100 ms** before dropping the typed draft; "Payment not found" (never-persisted draft) is swallowed.
32. **Payer carve stamps `bill_to_party` after each create**; a failed stamp leaves that draft on the default payer and the loop continues.
33. **Invoice → line links are written by `sequence_order` positions** after a forced flush, then mirrored into local `fixtures` so the next delete + reinsert keeps them.
34. **A failed ensure-RTB resync is reported, not failed** ("Invoice created, but the remainder draft did not re-sync") via `ensureRemainderResyncOutcome`.

---

## Recommended extraction order

Per playbook: Stage A before Stage B per unit; lowest coupling first; money path last; `npm run typecheck && npm run lint && npm test` each step; behavior-preserving only. **Done so far:** the Stage-A kernel wave (all `lib/jobs/jobForm*` files above), every form section as a component (v2.1094 closed that queue), `useJobCostSnapshot` (#427), `useJobMigrate`, `useBreakOffSlider`, `useJobFormAutosaveSlice`.

| # | Unit | Lines removed (approx.) | Coupling | Risk | Why here |
|---|---|---|---|---|---|
| 1 | **Labor loader → hook.** Sub labor: reuse `useJobDetailSubLaborCost(true, editing?.id)` + `laborJobSubCost` (DetailJobModal already uses both — the latter via `buildJobProfitSummary`; `laborJobSubCost` and the hook's row-shaper `jobSubLaborInputsFromRows` are tested, the hook itself is not); team labor: a new `useJobTeamLaborRow(jobId)` (the existing `useJobDetailTeamLabor` returns a `JobTeamLaborRowModel`, not the `TeamLaborRow` the charts panel and `hasMigrateableCosts` read). Return the six current names so memos 1526–1595 don't change; keep "error ⇒ force reassign". | effect 2455–2570 + 6 `useState` | writes only its own 6 states | low | kills a verbatim money-math copy and the HCP-keystroke refetch (quirk #26 — a deliberate, noted dep change) |
| 2 | ~~**Inline overlays → components**~~ — **done v2.3872**: `JobFormPaymentRemoveConfirm`, `JobFormStripeLinePreviewDialog` (its Escape listener with it), `JobFormMercuryUnlinkConfirm` in `src/components/jobs/`; open flags, preview math and RPC handlers stay shell callbacks; the shell passes `JOB_FORM_NESTED_OVERLAY_Z_INDEX`. `JobFormOverlays.render.test.tsx` (6) pins the seams. | ~320 JSX | ≤ 4 reads each | low | cheapest large JSX win; natural place to close the Esc gap (quirk #29) in a follow-up |
| 3 | ~~**`JobFormFooter`**~~ — **done v2.3908**: the close-flush banner + the footer in `src/components/jobs/JobFormFooter.tsx`, presentational; its rules (the autosave aggregate, its words and colour, who sees Delete) in `lib/jobs/jobFormFooter.ts` (11 tests); `JobFormFooter.render.test.tsx` (7) pins the seam. | ~270 | 13 values + 7 callbacks | low | pure render; phone/desktop layouts already self-contained |
| 4 | ~~**Small data hooks**~~ — **done v2.3914**: `hooks/useStandingDiscountOffer.ts` (the customer's rate read, the waived flag, the offer memo, Apply through the shell's `setFixtures`, the fire-and-forget waive write) and `hooks/useJobPropertyCandidates.ts` (the saved-address read; handed `customerAddressId` + its setter, hands back `setPropertyCandidates` for the fact rows). The property hook is called where its effect ran, so effect order is unchanged. Render tests 5 + 5. | ~80 + 3 `useState` + 3 effects | own state, plus shell writes both ways | low | self-contained loaders |
| 5 | ~~**Stage A — money totals + draft-invoice writer**~~ — **done v2.3922 + v2.3926**: `lib/jobs/jobFormMoneyTotals.ts` (`jobFormRevenueDollars`, `jobFormPaidDollars`, `jobFormPaymentRemovePreview`; 10 tests) replaces the four revenue copies and the five paid sums, and `revenueDollarsFromFixtures` has 7 direct tests; `lib/jobs/draftInvoiceWrite.ts` taking `supabase` (`writeDraftInvoice`: insert draft → the door's attach step → ensure-resync outcome; 17 mocked-client tests pin the order) replaces the three handlers' copies. The invoice clamps followed in v2.3929 (#6's Stage A). | ~150 across 3 handlers + 9 call sites | pure | med | pins untested money rules before anything moves |
| 6 | ~~**`useJobFormInvoiceActions`**~~ — **done v2.3929 + v2.3934**: Stage A `jobFormInvoiceClamps` (12 tests), then `hooks/useJobFormInvoiceActions.ts` — the eight handlers and the six busy flags, moved byte for byte; `selectedSegmentIds` and `billToEditorInvoice` stay the shell's and go in with their setters. `useJobFormInvoiceActions.render.test.tsx` (26) pins each door over a recording client. | ~365 | 19 inputs; 8 handlers, 6 busy states (own) | **high** | money path; only after #5 |
| 7 | ~~**`useJobFormImport`**~~ — **done v2.3939 + v2.3949**: Stage A `jobImportFromBid` (24 tests) + `jobImportFromEstimate` (5), then `hooks/useJobFormImport.ts` — the four callbacks moved as written, with the dependency lists they had, taking the form's setters; `winningGcPick` stays the shell's (its Escape gate reads it at render). `useJobFormImport.render.test.tsx` (22). | ~290 | 20 form setters + 2 refs | med–high | new-mode only, but writes `bids.agreed_value` and the bid's win |
| 8 | ~~**`useJobFormPaymentActions`**~~ — **done v2.3952 + v2.3956**: Stage A `jobFormPaymentActions` (17 tests), then `hooks/useJobFormPaymentActions.ts` — the five handlers, the three memos and the four confirm/busy states, moved as written. It hands back the setters `finishClose` / `applyEditJob` / `resetNewForm` reset; the three payment windows' open states and the row handlers stay the shell's. `useJobFormPaymentActions.render.test.tsx` (18). | ~150 | 10 inputs; `payments`, `editing` | **high** | RPC `remove_jobs_ledger_payment_and_reconcile` |
| 9 | ~~**Save-engine seam**~~ — **done v2.3966 + v2.3973**: Stage A `jobFormSliceWrites` (19 tests) + `jobFormCloseSideEffects` (7), then `hooks/useJobFormAutosaveEngine.ts` — the four slices with their mirror refs, saved-state refs and writers, moved as written and registered in the order they had. `useJobFormAutosaveEngine.render.test.tsx` (18, on a fake clock). The close guard and `createJob` stay the shell's (see *The save engine*). | ~330 | 15 inputs; hands back 24 (refs, slices, the two bid-outcome helpers) | **highest** | last |

**Stays in the shell permanently:** lifecycle (init, prefill timing, `applyEditJob`, `resetNewForm`, the close contract), all form-field state + setters, reference caches, undo (26 setters), the New Job gates, highlight/focus effects, the z-index ladder, link/import/picker modal wiring, the tail modals, the Stripe memo backfill, refetch plumbing (`refreshEditingJobAndHydratePayments`, `refetchEditingFromBillView`, `rehydrateFixturesFromDb`), and context wiring.
