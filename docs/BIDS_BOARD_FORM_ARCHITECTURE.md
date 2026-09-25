# Bids Board + Bid Form Architecture Map

---
file: docs/BIDS_BOARD_FORM_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 sub-decomposition map (per PAGE_DECOMPOSITION_PLAYBOOK.md) for the two Bids surfaces that regrew after extraction — src/components/bids/BidsBidBoardTab.tsx (1,983 lines; the Bid Board tab) and src/components/bids/BidFormModal.tsx (1,695 lines; New Bid / the Edit pane of the Bid window). Inventories every region (state, effects, memos, handlers, data, extracted children, coupling, test coverage) so an extraction can start from here instead of the source.
covers:
  - src/components/bids/BidsBidBoardTab.tsx
  - src/components/bids/BidFormModal.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-25
---

## What this surface is

Both files are mounted only by [`src/pages/Bids.tsx`](../src/pages/Bids.tsx) (route `/bids` → `Bids`, 5,293 lines; parent seam in [`BIDS_TABS_ARCHITECTURE.md`](./BIDS_TABS_ARCHITECTURE.md), rows `bid-board` and R14). They share a map because they are the two ends of one loop: every board row's gear and bid-value alert call `onEditBid` → the parent's `openEditBid` → this form (the flow "edit" door gets there through `onOpenBidFlowDoor` → the parent's `openBidFlowDoor` 1279 → `openEditBid`), and the `{ focus }` option the board passes lands on DOM ids the form owns (`bid-form-bid-value`, via [`lib/bids/bidFormFocus.ts`](../src/lib/bids/bidFormFocus.ts)).

**Line numbers are exact as of `a05cef4c4`** (fact sheets from `npm run map -- <file>`) and rot with every edit — search the symbol; every region below is anchored by symbol name and line range.

### `BidsBidBoardTab` — the Bid Board (`/bids?tab=bid-board`)

The estimators' worklist: search, a sticky jump strip of per-section pill counts (scoped to the trade pill), the bid map, five collapsible sections (Unsent/Working · Not yet won or lost · Won · Started or Complete · Lost) drawn as a 6/7-column table on desktop or cards under 660 px, a click-to-expand row (flow poster + details + notes panel), Estimating Health, and the Lost summary / Archived / Customer review modals. Mounted at `Bids.tsx` `<BidsBidBoardTab` 3933 (`activeTab === 'bid-board'`, block 3932–3981). One exported component `BidsBidBoardTab` 193–1983 (render 1460–1982), one module component `BidBoardIcon` 175–181, one module function `bidAddressMapsUrl` 183–185, one exported type `BidBoardJumpTabKey` 146 (no importer outside the file).

- **Hook census** (fact sheet): 13 `useState` · 8 effects · 7 `useMemo` · 1 `useCallback` · 2 `useRef` · 6 custom hooks (`useBidBoardSelfHighlight`, `useNarrowViewport660`, `useBidBoardJobAccountStrips`, `useBidFlowFacts`, `useBidFlowReview`, `useJobFormModal`).
- **No direct supabase calls** (fact sheet: tables —, rpcs —). All data arrives as props or through helpers/hooks: `fetchBidBoardNotesUnreadCounts` (`user_bid_notes_read_state`, `bids_submission_entries`, `customer_contacts`), `upsertBidNotesReadWatermark` (`user_bid_notes_read_state` upsert), `useBidFlowFacts` (existence reads on `bid_rfqs`, `bids_count_rows`, `bids_takeoff_rough_part_lines`, `bid_pricing_assignments`, `bid_proposal_rooms`), `useBidFlowReview` → `useMarkBidReviewed` (`bids` UPDATE + `bids_submission_entries` INSERT), `useBidBoardJobAccountStrips` (RPC `list_bid_job_account_strip` — idle here, see quirk 4), `useBidBoardSelfHighlight` (`users.bid_board_self_highlight`).
- **Monster blocks:** the row/cell render-function layer `bidBoardTableHead` … `renderBidBoardCard` **546–1458 (913 lines, 14 functions)** — `renderBidBoardTableRow` 199, `renderBidBoardBidNumberCluster` 114, `renderBidBoardCard` 108, `renderBidBoardExpandedContent` 95, `renderBidBoardLinksCluster` 85, `renderBidBoardDueChip` 73; the board body branch **1504–1908 (405)** holding the section loop **1633–1866 (234)** and the jump strip **1518–1616 (99)**; the due-legend dialog **1911–1980 (70)**; `BID_BOARD_ICON_PATHS` 149–163 (15 lines of SVG path data).
- **Churn: hot.** 62 commits in 90 days; last touch 2026-09-18 (v2.3574 job accounts PR 2). Recent trains: bid flow strip (v2.3200/3201), bid map + hover (v2.3162/3251), job accounts (v2.3520/PR 1b/PR 2), burn-against-the-bid chips (v2.3302). Schedule moves between trains.

### `BidFormModal` — New Bid / Edit Bid

The bid's data form: header (Go/no-go, trade pill → Copy Bid, linked-project picker, ✕), then sections Status & dates · Location · Files & links · People · ITB & submission links · Money · Notes, a sticky save bar, the autosave close guard, and the Copy Bid (service-type switch) dialog. New Bid renders it as its own overlay; Edit renders it `embedded` as the Edit pane of [`BidWindowModal`](../src/components/bids/BidWindowModal.tsx) (238 lines, which receives it as `children`). Mounted at `Bids.tsx` `<BidFormModal` 4818 (element 4818–4887, window wrap 4891–4911; block 4814–4915). One exported component `BidFormModal` 172–1695 (render 401–1694, early `return null` at 242), module helpers `serviceTypePillStyle` 116–121, `PasteButton` 138–157, `outcomeSegmentSelectedStyle` 166–170, exported types `BidFormOutcomeOption` 46, `BidServiceTypeSwitchSibling` 48, `BidFormAutosaveProps` 51–61, `BidFormModalProps` 63–114.

- **Hook census** (fact sheet): 9 `useState` · 5 effects · 0 `useMemo` · 0 `useCallback` · 0 `useRef` · 1 custom hook (`useCustomerTermsWarning`).
- **The form owns almost no data.** Its 33 field values + 33 setters arrive in one `form: BidEditForm` prop from the parent's `useBidEditForm()` ([`lib/bids/useBidEditForm.ts`](../src/lib/bids/useBidEditForm.ts), 377 lines); save, autosave, attestation, delete, archive and copy all live in the parent (R14). Direct supabase: `bid_versions` head count (effect 216–231) and a `bids` re-read of `bid_due_date, bid_due_time` (`refreshDerivedDue` 373–383). Indirect: `computeBidDistanceToOffice` → edge fns `geocode-one`, `driving-distance`; `useCustomerTermsWarning` → `customers` + RPC `list_payment_promise_records`; `RobotReadinessLine` → edge fn `plan-fetch`; extracted children read and write `bid_gc_recipients`, `bid_gcs`, `bid_version_sends`, `bid_versions`, `bids`, `bids_submission_entries`, `customers` themselves, and `BidPriceRequestsTable` reads `bid_rfqs`, `bid_quotes`, `supply_houses`, `supply_house_contacts` and invokes edge fn `send-rfq-email`.
- **Monster blocks:** People **1042–1299 (258)**, Status & dates **687–903 (217)**, Copy Bid dialog **1477–1691 (215)**, header **452–593 (142)**, save bar + close guard **1360–1473 (114)**.
- **Churn: warm.** 32 commits in 90 days; last touch 2026-09-16 (v2.3526 price requests PR 2). Recent: autosave (v2.3130), robot-readiness line (v2.3142), project link top-right (v2.3215), payment terms bar (Their Word PR 4).

### Props contracts (what the parent already owns)

**Board — `BidsBidBoardTabProps` 59–124, 39 props:**

| Group | Props | Parent source (Bids.tsx @ a05cef4c4) |
|---|---|---|
| Data (15) | `bids`, `sentScope`, `loading`, `gcPacketsByBid`, `recipientsByBidId`, `roomStatesByBid`, `gcNoteCounts`, `jobsByBidId`, `budgetChips`, `jobAccountStrips`, `workingBoardArchivedBids`, `ledgerPrefixMap`, `bidPreview`, `authUser`, `isDev` | `peopleBids` (split of `loadBids` rows, 434), `sentScope` memo 444, `!bidsLoaded`, `useBidGcPackets`, `bidGcRecipientsByBidId`, `jobsByBidId` 456, `useBidBoardBudgetChips` 461, page `useBidBoardJobAccountStrips` 469, `workingBoardArchivedBids` memo 3147 |
| Controlled UI (8) | `sectionOpen` + `onSectionOpenChange`, `deepLinkHighlightId` + `deepLinkHighlightGen`, `lostSummaryModalOpen`, `lostSummaryInitialStaffTab`, `onOpenLostSummary`, `onCloseLostSummary` | `bidBoardSectionOpen` (also written by the deep-link handler and `?lostSummary`), `applyBidBoardDeepLinkToBid` 918–958, `?lostSummary` effect 1716–1733 |
| Gates (5) | `showEstimatingHealth`, `showMap`, `canSeePricingTabs`, `showLostModalLabor`, `robotReadiness` | not primary/superintendent; always `true`; not superintendent; dev/master (882–885); robot bundle always passed |
| Callbacks (11) | `onEditBid`, `onOpenGcBuilderOrCustomer`, `onLastContactClick`, `onOpenBidTab`, `onOpenBidFlowDoor`, `onOpenJobAccountsLens`, `onLinkJobToBid`, `onSaveLossReason`, `onError`, `onReloadBids`, `onReloadCustomerContacts` | `openEditBid`, `openGcBuilderOrCustomerModal`, `handleLastContactClick` 2692, `selectBidAndSyncUrl`, `openBidFlowDoor` 1279, `selectBidsTab('job-accounts')`, `linkJobToBidFromBoard` 475–491 (undefined unless `canSeeBidBoardJobLinks`), `saveLossReasonFromLostSummaryModal` 2394–2408 |

**Form — `BidFormModalProps` 63–114, 40 props:**

| Group | Props |
|---|---|
| Shell (4) | `open`, `embedded` (true when editing), `closeBidForm`, `onServiceTypeSwitchOpenChange` (→ window `escBlocked`) |
| Target (1) | `editingBid` (null = New Bid) |
| Engine (6) | `form` (`BidEditForm`), `saveBid`, `saveBidAndOpenCounts`, `savingBid`, `autosave?` (edit only: status, dirty, retry, closeFlushState, retryClose, keepEditing, closeWithoutSaving), `onOutcomeRollupPersisted` |
| Date sent / attestation (6) | `bidDateSent`, `handleBidDateSentInputChange`, `handleBidDateSentBlur`, `onGcRollupDateChanged`, `pendingAttestationForDate`, `pendingBidDateSentAttestation` |
| Lookups (10) | `projects`, `estimatorUsers`, `visibleServiceTypes`, `customers`, `loadCustomers`, `openNewCustomerModal`, `getCustomerDisplay`, `getGcBuilderPhone`, `getGcBuilderEmail`, `myRole` (parent maps `controller` → `'assistant'`) |
| Lifted UI state (2) | `gcCustomerDropdownOpen` + `setGcCustomerDropdownOpen` (parent-owned: the window's `escBlocked` reads it) |
| Page modals (7) | `onOpenEvaluateChecklist`, `setDeleteBidModalOpen`, `setDeleteConfirmProjectName`, `setError`, `onRequestArchiveFromUnsentWorking`, `showArchiveFromUnsentWorking`, `archiveFromUnsentWorkingBusy` |
| Copy Bid (4) | `serviceTypeSwitchSiblings`, `onServiceTypeSwitchModalOpen`, `onDuplicateBidToServiceType` (parent RPC `duplicate_bid_to_service_type`), `onOpenExistingBidFromServiceTypeSwitch` |

No prop may be re-owned by a child extracted from either file.

### How to maintain this doc

Regenerate the fact sheet (`npm run map -- <file>`), re-read ranges from it, flip a region's Status and point at the new file when it moves, and bump `mapped_at` + `last_updated`. Never put line hints in front matter.

---

## Master summary table

**Board (`BidsBidBoardTab.tsx`)**

| # | Region | Anchor (symbol · lines) | ~Lines | Coupling | Tests | Risk | Status |
|---|---|---|---|---|---|---|---|
| B1 | Module constants + icon | `BID_BOARD_SECTION_CONFIG` 128–134, cap 137–143, `BID_BOARD_ICON_PATHS` 149–163, `BID_BOARD_JUMP_TABS` 167–173, `BidBoardIcon` 175–181, `bidAddressMapsUrl` 183–185, `BID_BOARD_DUE_CHIP_COLORS` 187–191 | 64 | read by B3, B8–B10, B15, B16 | none | low | inline — move first, with B9 |
| B2 | Search + buckets + counts (derived core) | `filteredBidsForBidBoard` 335–344, `bidBoardBuckets` 346–365, `boardCounts` 382, `pillCounts` 418–424, `lostBidsMissingLossReasonCount` 428–434, `bidBoardWeeklySentSummaries` 436–439 | ~55 | feeds every section, pill, map, health, flow facts, unread | comparators + `bidSentCounts` tested; bucketing, search, parity untested | low as logic, widest blast radius | inline — **Stage A first** |
| B3 | Section open / cap / jump | `sectionShowAll` 250–253, `toggleBidBoardSection` 441–443, `jumpToBidBoardSection` 445–456, uncap effect 460–474 | ~35 | parent `sectionOpen`; B4 highlight; B2 buckets | none | low | inline — state stays in tab |
| B4 | Map focus + hover | `mapHoverStore` 290, `mapFocusBidId`/`mapFocusGen`/`mapRevealSignal` 291–293, `rowHighlightId` 294, effects 295–297 + 308–328, `focusRowFromMap` 298–307 | ~40 | parent deep-link id/gen; B3 uncap; B3's Map pill writes `mapRevealSignal`; `BidBoardMapCard` | `bidBoardHoverStore.test.ts`, `BidBoardMapCard.render.test.tsx`; effects untested | med (timers/rAF) | inline — hook seam |
| B5 | Row expand + notes-unread engine | `expandedBidBoardBidId` 243, `bidBoardNotesTab` 245, `bidBoardNotesUnreadByBidId` 246, refs 331–333, effects 476–544, `toggleBidBoardRowExpanded` 605–607, `handleBidBoardRowClick` 610–613 | ~85 | B9 badge, B10 panel, B12/B13 rows | `bidBoardNotesUnreadCounts.test.ts`; watermark + effects untested | med (race guard, writes) | inline — hook seam |
| B6 | Job accounts + bid-flow wiring | `jobAccountBidIds` 369–372, strips 373–374, `missingAccountsNoteFor` 375–376, `showsJobAccounts` 377, `bidFlowIds` 384, `useBidFlowFacts` 385, `useBidFlowReview` 387, `bidFlowDoorAllowed` 388–389, `bidFlowFactsFor` 391–395, `openBidFlowDoor` 397–417 | ~50 | parent strips + door handler; `JobFormModalContext` | `bidBoardJobAccounts.test.ts`, `bidFlow.test.ts`, `bidFlowLanding.test.ts`; hooks + door routing untested | med | inline |
| B7 | Robot icon + key | `robotKeyOpen` 257, `robotKeyButton` 258–286, `renderRobotIcon` 620–647, `RobotIconKeyModal` 1910 | ~60 | `robotReadiness` bundle (parent R6) | `robotRowState.test.ts`, `RobotIconKeyModal.render.test.tsx`; click routing untested | low | partially extracted (`RobotGlyph`, `RobotIconKeyModal`) |
| B8 | Table head + due legend | `bidBoardTableHead` 546–603, `dueLegendOpen` 254, dialog 1911–1980 | ~130 | B1 colors, B7 key button | `DUE_SOON_WINDOW_DAYS` lives in tested `bidBoardDateCells.ts`; JSX none | low | inline — leaf |
| B9 | Row cell renderers | `renderBidBoardBidNumberCluster` 650–763, `renderBidBoardLinksCluster` 766–850, `renderGcSentBadge` 856–877, `renderBidBoardDueChip` 879–951, `renderBidBoardLastContact` 953–980, `renderBidBoardBidValue` 982–1014 | ~365 | B5 unread, B6 flow, B7 robot, 8 props | kernels tested (date cells, job links, budget chips, gcPackets, empty-value alert, formatting, ledger prefixes); JSX none | low–med (money chips) | inline — Stage B leaves |
| B10 | Expanded details | `renderBidBoardExpandedContent` 1017–1111 | 95 | B5 notes tab; B6 flow doors | `formatBidDueTime`, `bidContactInfo`, `bidFormatting` tests; `BidBoardNotesPanel` none | low | partially extracted (`BidFlowStrip`, `BidBoardNotesPanel`) |
| B11 | Lost strip reason | `lossCategorySavingBidId` 330, `renderLostStripReason` 1320–1348 | ~30 | `onSaveLossReason` (parent `bids` UPDATE) | `bidLossCategories.test.ts`; write path none | med (write) | inline — leaf with its state |
| B12 | Desktop row | `renderBidBoardTableRow` 1113–1311 (staff cell IIFE 1225–1270, lost row 1279–1301, expanded row 1302–1308) | 199 | calls B9–B11; `rowHighlightId`, hover store | none | med | inline |
| B13 | Phone card | `renderBidBoardCard` 1351–1458 | 108 | same as B12 | e2e `viewport-smoke.spec.ts` (375 px overflow) | med | inline |
| B14 | Toolbar | search + Archived + Customer review 1464–1503; `workingBoardArchivedModalOpen` 247, `customerReviewOpen` 248 | ~40 | `workingBoardArchivedBids`; the input writes B2's `bidBoardSearchQuery`; both open flags are read and closed by the B17 mounts | none | low | inline |
| B15 | Body states + jump strip + map | skeleton 1504–1511, empty 1512–1515, `<nav aria-label="Bid Board sections">` 1518–1616, `BidBoardMapCard` 1619–1632 | ~130 | B2 `pillCounts`, B3 jump, B4 map, B7 key, self-highlight wheel | none (map card has its own) | low | partially extracted (`BidBoardMapCard`, `BidBoardSelfHighlightWheel`) |
| B16 | Section loop | `BID_BOARD_SECTION_CONFIG.map` 1633–1866 (lost header 1642–1728, other header 1730–1779, cards 1780–1815, table 1816–1863) | 234 | B2, B3, B6 note, B12/B13 | none | med | inline — last |
| B17 | Board-level modals | `BidBoardLostSummaryModal` 1867–1883, `BidWorkingBoardArchivedModal` 1884–1896, health 1897–1906, `BidBoardCustomerReviewModal` 1909 | ~45 | parent lost-summary state; `bidPreview`; B14's two open flags | all four children untested | med (labor $ in lost modal) | extracted children, inline mounts |

**Form (`BidFormModal.tsx`)**

| # | Region | Anchor (symbol · lines) | ~Lines | Coupling | Tests | Risk | Status |
|---|---|---|---|---|---|---|---|
| F1 | Module scope | `serviceTypePillStyle` 116–121, `FORM_SECTION_*_STYLE` 123–136, `PasteButton` 138–157, `OUTCOME_SEGMENTS` 159–164, `outcomeSegmentSelectedStyle` 166–170 | ~55 | used by F4, F6–F11, F13 | none | low | inline — file move |
| F2 | Local state machine | state 173–179, 212, 215, 238–239; effects 186–193, 195–202, 205–207, 216–231, 232–234; `useCustomerTermsWarning` 240; early return 242 | ~70 | parent Esc block via 205–207 | render smoke (footer only) | med (hook order) | inline |
| F3 | Destructure + derived | props 243–282, `form.values` 283–317, `form.setters` 318–352, gates/labels 353–358, service type 360–364 | ~120 | everything | `bidFormAutosave.test.ts` (labels, status line) | low | inline — shrinks as sections move |
| F4 | Header | `bid-form-modal-header` 452–593 (Go/no-go 464–484, trade pill 487–511, project link + suggestion 517–571, ✕ 572–591); shell + `<style>` 401–451 | ~190 | `onOpenEvaluateChecklist`, `openServiceTypeSwitch`, `projects` | `projectNumberLabel.test.ts`; suggestion rule none | low | inline |
| F5 | Hero + staff + trade | 605–686 (Project Name `bid-form-project-name`, Bid # role gate 630–646, Estimator / Account Man / Service Type) | ~80 | `bidFormFocus` ids; role gate | `bidFormFocus.test.ts` (id map + robot-gap doors; no render) | med (role gate) | inline |
| F6 | Status & dates | 687–903: due date/time 690–755, sent panel or date + attestation 756–809, last contact 810–819, Win/Loss + loss capture + start date + Job 821–902 | 217 | parent attestation flow; `bidHasVersions`; `loggingContact`; outcome roll-up | `bidDateSentDisplay` untested; `bidLossCategories.test.ts`; `BidWonJobActions.render.test.tsx`; `BidGcSentPanel`/`BidLogContactControl` none | **high** (attestation, outcome) | partially extracted |
| F7 | Location | 904–965 (address blur → `runDistanceAutoFill` 386–399, `distanceAutoStatus`) | ~62 | `distanceAutoStatus` also read by F8's `RobotReadinessLine` | `bidDistanceToOffice.test.ts` (mile math only; `computeBidDistanceToOffice` fallback + `runDistanceAutoFill` untested) | low | inline |
| F8 | Files & links | 966–1041 (hardcoded Drive folders 972–981, plans/CT/submission `PasteButton`s, `BidPriceRequestsTable` 1007–1014, `RobotReadinessLine` 1017–1027, design date) | ~76 | flow targets `bid-form-plans-link`, `bid-form-count-tooling-link` | `BidPriceRequestsTable.render.test.tsx`; `RobotReadinessLine` none | low | partially extracted |
| F9 | People | 1042–1299: primary `GcCard` 1044–1083, GC search/dropdown 1084–1211, `CustomerTermsBar`/`CustomerTermsModal` 1213–1222, `BidGcRecipientsRow` 1223–1251, project contact + submitted-to 1252–1298 | 258 | `changingPrimary`, terms state, `refreshDerivedDue`, parent dropdown state, 5 role checks | none (children untested) | med–high | partially extracted |
| F10 | ITB links | 1300–1338 | ~39 | `setItbLinks` | `itbLinks.test.ts` (label) | low | inline |
| F11 | Money + Notes | Money 1339–1355 (Bid Value `bid-form-bid-value`, Agreed Value, Maximum Profit), Notes 1356–1359 | ~21 | `bidFormFocus` bidValue | payload side `bidFormPayload.test.ts` (parent); load side untested | med (money strings) | inline |
| F12 | Save bar + close guard | `bid-form-savebar` 1360–1435, close guard 1436–1473; `<form onSubmit>` gate 594–604 | ~125 | `autosave`, `loggingContact`, delete/archive props | `BidFormModal.render.test.tsx` (4 tests, footer + guard) | med | inline — best-tested region |
| F13 | Copy Bid dialog | `serviceTypeSwitchOpen ? (` 1477–1691 | 215 | `duplicatingToServiceTypeId`; parent RPC + siblings | none | med (creates bids) | inline — **first Stage B** |

**Money:** neither file does money math. Board money surfaces are display + one write door: `formatBidValueShort` / `formatCompactCurrency` (tested), the empty-value alert (tested), the burn-against-the-bid chips (`bidBoardBudgetChips.test.ts`), and `onLinkJobToBid` → parent RPC `snapshot_job_budget_from_bid` (stamps the job and snapshots the estimate as its budget; confirm dialog in parent). The Lost summary modal's labor column reads `people_pay_config` + `clock_sessions` (child, 723 lines, untested). Form money is three string inputs; the parent's `bidFormPayload` (tested) converts on save, but the load side `bidRowToFormValues` (`useBidEditForm.ts` 134–172) is **untested**.

---

## Per-region dossiers — Board

### B1 Module constants + `BidBoardIcon`
- **Render location:** module scope 51–191.
- **Owns:** nothing stateful. `BID_BOARD_ICON_PATHS` (12 paths on 15 lines; `robot` is never read) is shared by the jump cluster, links cluster and job chip; `BID_BOARD_DUE_CHIP_COLORS` by the due chip, table head swatches and legend.
- **Coupling:** `bidAddressMapsUrl` re-implements the tested `googleMapsSearchUrl` in [`lib/jobs/jobAddressUrls.ts`](../src/lib/jobs/jobAddressUrls.ts) 13–15 (which also trims); `BidFormModal` 916 builds the same URL inline.
- **Approach:** move with B9 into `BidBoardRowCells.tsx` (or `bidBoardIcons.ts`); replace `bidAddressMapsUrl` and the form's inline URL with `googleMapsSearchUrl`.

### B2 Search + buckets + counts (the derived core)
- **Owns:** `bidBoardSearchQuery` (242; input 1465–1473).
- **Derived:** `filteredBidsForBidBoard` 335–344 (plain expression — project name, bid number via `bidNumberMatchesQuery`, address, customer, builder); `bidBoardBuckets` 346–365 (sort by `compareBidsForBidBoardDueDate`, pile by `getSubmissionSectionKey`, drop archived unsent, re-sort pending by `compareBidsForBidBoardPendingRecency`); `boardCounts` 382 (`bidSentCounts(filtered, { scope })`) → `pillCounts` 418–424; `lostBidsMissingLossReasonCount` 428–434; `bidBoardWeeklySentSummaries` 436–439.
- **Consumers:** B15 pills, B16 headers + rows, `BidBoardMapCard` and Health (filtered list), B6 (`bidFlowIds`, `useBidFlowReview`), B3 uncap effect, B17 (`lostBids`).
- **Tests:** comparators (`compareBidsForBidBoardDueDate.test.ts`), counts (`bidSentCounts.test.ts`), weekly stats (`bidBoardWeeklySentStats.test.ts`). **Untested:** the inline search predicate (a tested twin with the same five matchers exists — `filterBidsForPicker`, v2.3546 — but neither its test nor `ledgerDisplayPrefixes.test.ts` asserts a bid-number match through `bidNumberMatchesQuery`), `getSubmissionSectionKey` (`submissionSections.ts` has no test), the bucketing rules, and pill/header parity (quirk 1).
- **Approach:** Stage A — adopt `filterBidsForPicker` + a new `bucketBidBoardBids` + a parity test against `bidSentCounts`. Everything downstream then takes buckets as props.

### B3 Section open / cap / jump
- **Owns:** `sectionShowAll` (250; only `pending` + `lost` cap at `BID_BOARD_SECTION_ROW_CAP` 25).
- **Shared (stays in parent):** `sectionOpen` / `onSectionOpenChange` — written by `toggleBidBoardSection`, `jumpToBidBoardSection`, `focusRowFromMap`, the parent deep-link handler and `?lostSummary`.
- **Effect 460–474** `[rowHighlightId, bidBoardBuckets]`: uncaps a section whose highlighted row sits past row 25, so the parent's 150 ms scroll finds it.
- **Approach:** keep `sectionShowAll` in the tab (the effect writes it on deep link); pass `capExpanded` + toggler into B16. Stage A the cap arithmetic.

### B4 Map focus + hover
- **Owns:** `mapHoverStore` (external store — a row hover re-renders only the map card), `mapFocusBidId`, `mapFocusGen`, `mapRevealSignal` (written only by B3's `jumpToBidBoardSection` Map pill, read only by the B15 map mount 1628); derived `rowHighlightId = mapFocusBidId ?? deepLinkHighlightId` (294).
- **Effects:** 295–297 clears map focus when a deep link arrives; 308–328 retries `scrollIntoView` on `bid-board-row-<id>` for up to 12 animation frames, then clears the focus after 8,000 ms.
- **Handler:** `focusRowFromMap` 298–307 (the file's only `useCallback`, deps `[bids, onSectionOpenChange]`) opens the bid's section then bumps the gen.
- **Approach:** hook seam `useBidBoardRowFocus({ bids, deepLinkHighlightId, deepLinkHighlightGen, onSectionOpenChange })` returning `{ rowHighlightId, focusRowFromMap, mapRevealSignal, revealMap, hoverStore }`.

### B5 Row expand + notes-unread engine
- **Owns:** `expandedBidBoardBidId`, `bidBoardNotesTab`, `bidBoardNotesUnreadByBidId`, refs `bidBoardUnreadFetchSeqRef` 331 and `bidsForBoardUnreadRef` 332 (live-mirrored during render, 333).
- **Effects:** 476–482 scroll the notes row into view; 484–491 document-level Escape collapses (quirk 6); 493–495 reset the notes tab to `'all'`; 497–516 fetch unread counts for every bid on each `bids` change (seq-guarded); 518–544 on expand: upsert the read watermark, zero that bid, refetch all counts.
- **Consumers:** badge in B9 (`notesUnreadRaw`, `'9+'` cap 651–652), panel in B10, `aria-expanded` in B12/B13.
- **Tests:** `bidBoardNotesUnreadCounts.test.ts`; `userBidNotesReadState.ts` (21 lines) none.
- **Approach:** hook seam `useBidBoardNotesUnread(bids, userId, expandedId)`; the seq ref and the live `bids` ref move verbatim. `bidBoardNotesTab` + its reset effect move with B10.

### B6 Job accounts + bid-flow wiring
- **Job accounts:** `jobAccountStrips = pageJobAccountStrips ?? ownJobAccountStrips` (373–374). The one mount always passes the page's strips, so the own read (373, `enabled` false) never fires; `jobAccountBidIds` 369–372 still computes for nothing (quirk 4). `missingAccountsNoteFor` feeds the Won / Started headers (B16); `showsJobAccounts` gates `BidBoardJobAccountChips` (B12/B13).
- **Bid flow:** `useBidFlowFacts(bidFlowIds)` (chunked existence reads on five tables), `useBidFlowReview(filtered)` (review stamps + `markReviewed`), `bidFlowFactsFor` merges the job-account lane (`jobAccountFlowFacts`), `bidFlowDoorAllowed` hides pricing/cover-letter doors from superintendents, `openBidFlowDoor` routes `review` → mark reviewed, `accounts` → `jobFormModal.openJobAccountsPrompt`, else the page's `onOpenBidFlowDoor` or `onEditBid` / `onOpenBidTab` + `landOnBidFlowTarget`.
- **Tests:** `bidBoardJobAccounts.test.ts`, `bidFlow.test.ts`, `bidFlowLanding.test.ts`, `BidBoardJobAccountChips.render.test.tsx`. **Untested:** `useBidFlowFacts`, `useBidFlowReview`, `useBidBoardJobAccountStrips`, `useMarkBidReviewed` (writes `bids`), door routing.
- **Approach:** Stage A `mergeJobAccountFlowFacts(base, strip, loaded)` into `bidBoardJobAccounts.ts`; the door router stays a closure passed down (it needs three callbacks).

### B7 Robot icon + key
- **Owns:** `robotKeyOpen`; `robotKeyButton` (JSX local, rendered in the table head and, on phones, the jump strip).
- **`renderRobotIcon` 620–647:** `robotRowState(robotReadiness.inputFor(bid))` decides glyph + title; a 5-way ternary (625–634) picks grade / needs / twin compare / none / status.
- **Approach:** Stage A `robotIconAction(state, { hasTwin, sent })` next to `robotRowState.ts` (tested file); then the icon is a leaf component.

### B8 Table head + due legend
- `bidBoardTableHead(hideBidColumn)` 546–603 renders 6 or 7 headers, the robot key and a swatch button that opens the legend. The legend dialog 1911–1980 is 70 lines of static copy (reads `DUE_SOON_WINDOW_DAYS`).
- **Approach:** `BidBoardDueLegend` component owning its own open state, used inside the head — zero parent coupling.

### B9 Row cell renderers
- **Bid-number cluster 650–763:** unread badge, five jump icons (`BID_BOARD_JUMP_TABS`, filtered by `canSeePricingTabs` 731) over a `BidFlowStrip variant="hairline"`, robot icon, the lowercase-"b" number (preview button when `bidPreview`), Edit gear.
- **Links cluster 766–850:** value-match chip + Link button (`onLinkJobToBid`, money), estimate chip (`<Link to=/bids?bidId=&tab=labor>`), job chip (`/jobs?edit=<jobId>`), then the four artifact links via `openInExternalBrowser`.
- **Others:** `renderGcSentBadge` (`perGcSentSummary`), `renderBidBoardDueChip` (`bidBoardDueCellParts` / `bidBoardNoDueDateParts` / `bidBoardSentLabel`), `renderBidBoardLastContact`, `renderBidBoardBidValue` (red `$` → `onEditBid(bid, { focus: 'bidValue' })`).
- **Approach:** Stage B into `BidBoardRowCells.tsx` as props-only leaves, cluster by cluster; the bid-number cluster last (widest props).

### B10 Expanded details
- `renderBidBoardExpandedContent` 1017–1111: full `BidFlowStrip`, a seven-field detail strip (project, GC, address → maps, due + time, bid, estimator, distance), `BidBoardNotesPanel` (`idPrefix="bid-board"`; mutations call `onReloadBids` or `onReloadCustomerContacts` + `onReloadBids`).
- **Approach:** `BidBoardExpandedDetails` component taking `bidBoardNotesTab` + its reset effect (493–495) with it.

### B11 Lost strip reason
- `renderLostStripReason` 1320–1348 (shared by row and card): shows category + note; when uncategorized, the nudge plus `BidLossCategoryChips` (suggested key from the note) calling `onSaveLossReason(bid.id, note, key)` with `lossCategorySavingBidId` as the busy flag.
- **Approach:** leaf `BidBoardLostStripReason` owning `lossCategorySavingBidId`.

### B12 Desktop row / B13 phone card
- Both carry `id="bid-board-row-<id>"`, `BID_FLOW_LANDING_CLASS` when highlighted, `data-deeplink-gen`, click-to-expand (ignores interactive descendants, 611), Enter to expand, `aria-controls="bid-board-notes-<id>"`. The row also sets hover → `mapHoverStore` (1128–1129); the card does not.
- **Both** render `BidBoardGcLines` (when `gcRowsWorthShowing`) or a GC button, plus job-account chips (row 1160–1204, card 1400–1420). **Row-only:** the "+N GCs" recipients chip (1188–1202) and the staff cell IIFE 1225–1270 (embed normalize ×2, same-person rule, self-highlight style).
- **Approach:** after B9–B11 are leaves, move both to `BidBoardRow.tsx` / `BidBoardCard.tsx`. Stage A the staff-line rule first.

### B14 Toolbar / B15 body states, jump strip, map
- Toolbar 1464–1503: search input, Archived (count badge), Customer review. Body 1504: skeleton when `loading && bids.length === 0` (J10-F8), "No bids…" when the filtered list is empty, else the board.
- Jump strip 1518–1616: scope label (`scopeLabel(sentScope)`), phone robot key, Map / five sections / Health pills (pending count orange when >0), `BidBoardSelfHighlightWheel`.
- **Approach:** `BidBoardJumpStrip` (props: `pillCounts`, `sentScope`, `showMap`, `showEstimatingHealth`, `onJump`, `robotKey`, wheel props) — a clean Stage B.

### B16 Section loop
- Per section: header (Lost adds the "Bid Tabs on Lost" button + missing-reason badge 1673–1727; Won / Started add the missing-accounts note, a link to the Job accounts lens when `onOpenJobAccountsLens`), then cards (narrow) or table (wide) with the cap toggle.
- **Approach:** last; one `BidBoardSection` component with `sectionOpen[key]`, `capExpanded`, toggles, and a row renderer prop. Verify DOM identity (ids, colSpans 6/7, cap row colSpan 7).

### B17 Board-level modals
- `BidBoardLostSummaryModal` (723 lines; reads `users`, `people_pay_config`, `clock_sessions`; labor column only when `showLostModalLabor`), `BidWorkingBoardArchivedModal` (274; touches `bid_working_board_columns`, `bid_working_board_placements`, `bids`; only with `authUser`), `BidBoardEstimatingHealthSection` (52), `BidBoardCustomerReviewModal` (750). All untested. Mounts stay in the tab; note quirk 3.

---

## Per-region dossiers — Form

### F1 Module scope
- Pure styling helpers + `PasteButton` (clipboard read; 5 uses). **Approach:** move `PasteButton` to its own file when F8/F10 move.

### F2 Local state machine (hooks above the early return)
| State | Line | Written by | Read by | Moves with |
|---|---|---|---|---|
| `serviceTypeSwitchOpen` | 173 | `openServiceTypeSwitch`, effect 186, Esc effect 195, dialog | header pill, F13, effect 205 → parent | stays in form (header opens, parent is told) |
| `duplicatingToServiceTypeId` | 174 | F13 buttons, effect 186 | F13 | F13 |
| `dueTimeOpen` | 175 | due-date change, add/remove time, effect 186 | 705 | F6 |
| `loggingContact` | 178 | `BidLogContactControl onOpenChange` (815) | `<form onSubmit>` 598, save bar 1424/1431 | stays (read by F12) |
| `distanceAutoStatus` | 179 | `runDistanceAutoFill`, effect 186 | F7 status line, F8 `RobotReadinessLine` | stays (F7 + F8 share) |
| `changingPrimary` | 212 | GC card "change", "keep current", pick/new customer, effect 232 | F9 | F9 |
| `bidHasVersions` | 215 | effect 216 (`bid_versions` head count) | 756 (sent panel), 829 (Won/Lost lock) | F6 |
| `termsRefresh` / `termsModalOpen` | 238 / 239 | terms modal | `useCustomerTermsWarning(termsCustomerId, termsRefresh)` 240, F9 | F9 |

- **Effects:** 186–193 `[props.open]` resets four states on close; 195–202 document Escape closes Copy Bid; 205–207 reports the switch state up (`onServiceTypeSwitchOpenChange` → `setBidFormServiceTypeSwitchOpen` → window `escBlocked`); 216–231 `[editingBid?.id]` counts versions (null while loading, cancel flag); 232–234 resets `changingPrimary` per bid.
- **Rule:** every hook sits above `if (!props.open) return null` (242). A child component extracted from the JSX may own hooks freely; hooks added here may not go below 242.

### F3 Destructure + derived
- 38 of the 40 props destructured 243–282 (`open` and `onServiceTypeSwitchOpenChange` are read before the early return); 33 values 283–317 and 33 setters 318–352 from `form`; `canSubmit`/`missingFields` (Project Name, Service Type — computed in `useBidEditForm` 296–302); `canEditTerms` 355; `footerLabels` 356 and `autosaveLine` 357 (`bidFormAutosave.ts`, tested); `selectedServiceType`, `serviceTypePillTag`, `otherServiceTypes` 360–364.

### F4 Header (+ shell)
- Shell 401–451: overlay or bare pane (`embedded`), inline `<style>` media query (≤640 px: full-screen, single-column grids, save bar bleed).
- Header 452–593: title (Edit/New), Go/no-go (`onOpenEvaluateChecklist` — the checklist modal lives in the parent), trade pill (tag/color via `getBidServiceTypeTag`) → `openServiceTypeSwitch` (also fetches siblings), linked-project `SearchableSelect` + "Suggested: link to …" when the free-text name exactly matches a project (541–570), ✕ (non-embedded only).
- **Approach:** `BidFormHeader` (props only); Stage A `suggestProjectLink(projects, projectName, projectId)`.

### F5 Hero + staff + trade
- Project Name (required, clears `setError`), Bid # (editable only when editing and dev/master/assistant-like; `readOnly`/`disabled` for New Bid, estimator, primary — quirk 12), Estimator / Account Man / Service Type `SearchableSelect`s over `estimatorUsers` / `visibleServiceTypes`.

### F6 Status & dates (highest-risk region)
- **Due:** date input (clearing it clears the time), "+ Add due time" / time input + remove (`dueTimeOpen`).
- **Sent:** with versions → `BidGcSentPanel` (per-GC send records; writes the roll-ups itself — `bids.bid_date_sent` = first send, which a sync trigger also enforces server-side, and `bids.outcome` through `lib/bids/gcPacketOutcome.ts`; `onOutcomeRollupChanged` → `setOutcome` + `onOutcomeRollupPersisted`; `onRollupDateChanged` → parent `onGcRollupDateChanged`, which resets attestation and may offer the robot envelope); without → the hand-typed Bid Date Sent + an IIFE (782–807) deriving "Sent N days ago" and "Acknowledged by …" from `pendingAttestationForDate` / `pendingBidDateSentAttestation` / `editingBid.bid_date_sent_attested_by`.
- **Last contact:** `BidLogContactControl` when editing (a contact is a ledger entry), raw `datetime-local` for New Bid.
- **Win / Loss:** `OUTCOME_SEGMENTS`; Won/Lost locked (`perGcLocked` 829) when the bid has versions; Lost → `BidLossCategoryChips` + free text + nudge; Won → Start Date; editing → `BidWonJobActions`.
- **Tests:** `BidWonJobActions.render.test.tsx`, `bidLossCategories.test.ts`; `bidDateSentDisplay.ts` (29 lines), the attestation IIFE, `BidGcSentPanel` (443) and `BidLogContactControl` (187) have none.
- **Approach:** Stage A the attestation line and the lock rule first; then `BidFormStatusDates` owning `dueTimeOpen` + `bidHasVersions` (effect 216–231 moves with it) and receiving `setLoggingContact`.

### F7 Location / F8 Files & links
- F7: address `onBlur` auto-fills distance only when empty; "↻ Auto" forces; status line names the source (routed vs straight-line) and anchor.
- F8: three hardcoded Drive folder links (plumbing / electrical / HVAC, 972–981), Project Folder, Job Plans (`bid-form-plans-link`), CountTooling Plans (`bid-form-count-tooling-link`), `BidPriceRequestsTable` (saved bids; label hand-built `B<number> · <project>` 1010), `RobotReadinessLine` (reads `distanceAutoStatus`), Bid Submission, Design Drawing Plan Date.
- **Approach:** move F7 + F8 together (they share `distanceAutoStatus`), or lift the status into a tiny `useBidDistanceAutoFill` hook the form keeps.

### F9 People
- Primary GC as a `GcCard` (1044–1083; legacy `bids_gc_builders` name fallback) with "change ▸" and a per-GC `BidGcDetailsEditor` (writes `bid_gcs`; `onBidDueMaybeChanged` → `refreshDerivedDue`, because a per-GC due can move the bid's derived due).
- GC search 1084–1211: input clears `gcCustomerId` when the text stops matching (1109–1114), 200 ms blur close, "+ Add new customer" (role-gated; `onMouseDown` preventDefault beats the blur), the customer filter computed twice (1170–1176 and 1202–1205).
- Terms bar + modal (payment terms / promise record of the payer), `BidGcRecipientsRow` (other GCs; self-loading, writes `bid_gc_recipients`), project contact (collapsible) + Submitted to.
- **Role checks:** the same `dev || master_technician || isAssistantLike || estimator` expression 5× (1075, 1138, 1227, 1229, 1245).
- **Approach:** Stage A `bidFormRoleGates` + `filterCustomersForGcSearch` + `primaryGcDisplay`; then `BidFormPeopleSection` owning `changingPrimary`, both terms states and `useCustomerTermsWarning`; `gcCustomerDropdownOpen` stays a pass-through prop.

### F10 ITB links / F11 Money + Notes
- ITB rows: edit / paste / remove by index, "+ Add ITB link", label via `itbLinkLabel` (tested).
- Money: Bid Value (`bid-form-bid-value`, the board's `focus: 'bidValue'` target), Agreed Value, Maximum Profit — `type="number"` strings, wheel-blur. Notes textarea.

### F12 Save bar + close guard
- Left: Delete bid… (opens the parent confirm), Archive from board (parent-computed eligibility). Right: autosave status line + Retry (edit) or "Required: …" (new), Open Counts (`saveBidAndOpenCounts`), primary submit (New Bid only). Close guard strip when `closeFlushState !== 'idle'` (saving, or Retry / Keep editing / Close without saving).
- `<form onSubmit>` 594–604 swallows Enter while logging a contact or when autosave is on.
- **Tests:** the only rendered coverage in either file — `BidFormModal.render.test.tsx` (178 lines, 4 tests: New Bid buttons, Edit has no Save + Enter submits nothing, failed autosave Retry, failed close-flush strip).

### F13 Copy Bid dialog
- Same-trade "Duplicate this … bid" + per-other-trade "Open B<n>" siblings and "Copy to new … bid"; both call the parent's `onDuplicateBidToServiceType` (RPC `duplicate_bid_to_service_type`) with `duplicatingToServiceTypeId` as the busy key; disabled for unsaved bids.
- **Approach:** first Stage B move — `BidCopyBidDialog` taking `open`, `onClose`, `editingBid`/`savingBid`, service types, siblings and the two parent callbacks (`onDuplicateBidToServiceType`, `onOpenExistingBidFromServiceTypeSwitch`; `onServiceTypeSwitchModalOpen` is the header's, via `openServiceTypeSwitch`); it owns `duplicatingToServiceTypeId`. `serviceTypeSwitchOpen`, the Esc effect and the report-up effect stay in the form.

---

## Shared substrate

- **Selection / URL state is the parent's.** Board: `bidBoardSectionOpen`, `bidBoardDeepLinkHighlightId/Gen` (+ a 2,500 ms clear timer and a 150 ms scroll in `applyBidBoardDeepLinkToBid`), lost-summary open state; jump icons and flow doors navigate through `selectBidAndSyncUrl` / `openBidFlowDoor`. Form: `editingBid`, `bidFormOpen`, `bidWindowInitialTab` (the window's `key` is `${editingBid.id}:${bidWindowInitialTab}`, so switching bids remounts the form).
- **The form's data engine is `useBidEditForm`** ([`lib/bids/useBidEditForm.ts`](../src/lib/bids/useBidEditForm.ts), 377 lines: 34 `useState`, `bidRowToFormValues` 134–172, `missingFields` 296–302), owned by `Bids.tsx` and shared with the autosave slice and `saveBid`. Tests import only its types (`bidFormAutosave`, `bidFormPayload`, `bidUpdatePrune`, `BidFormModal.render`); the hook and `bidRowToFormValues` have no test. The form is already a view over this seam, so no new hook is needed before F-region moves.
- **The board has no data engine.** Everything is a parent cache or a per-concern hook (B5, B6). Two hook seams are worth building before Stage B: `useBidBoardRowFocus` (B4) and `useBidBoardNotesUnread` (B5).
- **Cross-surface duplication:**
  - Section pile rule: `getSubmissionSectionKey` (no test of its own; exercised only through `bidSentCounts.test.ts`) is used by B2, `focusRowFromMap`, `bidSentCounts`, Submission & Followup, Customer review (`bidBoardCustomerReview.ts`), Builder review, `BuilderCallSessionModal`, `useMapPageData`, `bidBoardMap.ts`, `robotMirror.ts`; the parent's `applyBidBoardDeepLinkToBid` re-implements it inline (Bids.tsx ~923–932).
  - Staff embed normalizer `raw == null ? null : Array.isArray(raw) ? raw[0] ?? null : raw` — 4× here (1021, 1227, 1229, 1355) and 8× in `BidSubmissionFollowupTab.tsx`.
  - Google Maps search URL — a tested helper exists (`googleMapsSearchUrl`, `lib/jobs/jobAddressUrls.ts`), yet `bidAddressMapsUrl` here, `BidFormModal` 916, `lib/bids/bidBoardMap.ts` 255 and ~20 other files build it inline.
  - Bid label: the board uses the ledger prefix (`formatBidLedgerNumberLabel`) and a lowercase "b" mark; the form hand-builds `B<number>` (1010, 1652).
  - The `useBidFlowFacts` + `useBidFlowReview` pair also sits in `BidsTakeoffTab`, `BidsCountsTab`, `BidsLaborTab`, `BidsPricingTab`, `BidsCoverLetterTab`.
- **Window events:** children fire `bid-gc-outcome-changed` (`BidBoardGcRows` 142, `BidGcSentPanel` 280); `useMarkBidReviewed` fires `BID_REVIEWED_EVENT` (parent reloads bids); the parent fires `JOB_CREATED_FROM_BID_EVENT` after a board link (bumps the job-link index).

---

## Stage-A inventory

**Still inline (move to `src/lib/**` with tests before any component move):**

| Candidate | Where | Target |
|---|---|---|
| Board search predicate | `filteredBidsForBidBoard` 335–344 | no new kernel — adopt `filterBidsForPicker(bids, query, prefixMap)` ([`lib/bids/filterBidsForPicker.ts`](../src/lib/bids/filterBidsForPicker.ts), tested, same five matchers) as `query.trim() ? filterBidsForPicker(…) : bids` (the kernel copies on a blank query, which would bust `bidBoardBuckets` and the other memos keyed on the list); add a bid-number case to its test (the first real test of `bidNumberMatchesQuery`) |
| Bucketing + pill mapping | `bidBoardBuckets` 346–365, `pillCounts` 418–424 | `bucketBidBoardBids(bids)` + `bidBoardPillCounts(counts)` in a new `lib/bids/bidBoardBuckets.ts` + a parity test against `bidSentCounts`; add `submissionSections.test.ts` for `getSubmissionSectionKey` |
| Section cap math | 137–143, 460–474, 1636–1639 | `visibleSectionRows(rows, key, showAll)` + `capsToLiftForRow(buckets, rowId, showAll)` + test |
| Lost "missing reason" rules | 428–434 (note OR category), 1321–1330 (category only) | one `lossReasonState(bid)` in `bidLossCategories.ts` returning `{ categorized, hasNote }`; callers keep their rules (quirk 2) |
| Staff lines | 1225–1240 (+1021, 1355) | `normalizeBidStaffEmbed` + `bidBoardStaffLines(bid, viewerId)` (same-person rule, self flags) + test; shared with Submission & Followup (check `formatBidStaffDisplayName` in `lib/bids/bidBoardStaffOutcomes.ts` first — it already normalizes the embed for display, trims and caps at 200 chars, and no test calls it) |
| Robot icon click routing | 625–634 | `robotIconAction(state, { hasTwin, sent })` in `robotRowState.ts` + test |
| Job-account flow merge | `bidFlowFactsFor` 391–395 | `mergeJobAccountFlowFacts` in `bidBoardJobAccounts.ts` + test |
| Board link list | 767–771 | `bidArtifactLinks(bid)` + test |
| Maps URL | 183–185, form 916 | reuse `googleMapsSearchUrl` (`lib/jobs/jobAddressUrls.ts`, tested) — no new kernel |
| Date-sent attestation line | form IIFE 782–807 | `bidDateSentAttestationLine({ input, serverSent, attestedBy, pending })` in `lib/bidDateSentDisplay.ts` + its first test file |
| Won/Lost lock | form 829 | `outcomeSegmentLocked(seg, outcome, hasVersions, editing)` + test |
| Form role gates | 355, 634–643, 1075, 1138, 1227, 1229, 1245 | `bidFormRoleGates(myRole)` → `{ canEditBidNumber, canManageGcs, canEditTerms }` + test |
| Customer search filter | 1170–1176, 1202–1205 | `filterCustomersForGcSearch(customers, query)` + test (compute once) |
| Project suggestion + primary GC display | 541–547, 1045–1047 | `suggestProjectLink(...)`, `primaryGcDisplay(...)` + tests |
| Derived-due normalize | `refreshDerivedDue` 379–381 | `derivedDueToForm(row)` (the `slice(0, 5)`) + test |
| Row → form load | `bidRowToFormValues` (`useBidEditForm.ts` 134–172) | test only (money strings `bid_value`/`agreed_value`/`profit`, `slice(0,5)` time, datetime-local) |

**Already extracted (do not re-extract):** `compareBidsForBidBoardDueDate` / `…PendingRecency`, `bidSentCounts` / `scopeLabel`, `bidBoardDateCells`, `bidBoardJobLinks`, `bidBoardBudgetChips`, `gcPackets` (`perGcSentSummary`), `bidBoardEmptyBidValueAlert`, `bidFormatting`, `formatBidDueTime`, `bidContactInfo`, `ledgerDisplayPrefixes`, `robotRowState`, `bidBoardNotesUnreadCounts`, `bidBoardHoverStore`, `bidFlow`, `bidFlowLanding`, `bidBoardJobAccounts`, `bidBoardWeeklySentStats`, `bidLossCategories`, `bidGcRecipients`, `bidRoomState`, `bidFormAutosave`, `bidFormFocus`, `bidDistanceToOffice`, `itbLinks`, `projectNumberLabel`, `unifiedJobBidSearch`, `filterBidsForPicker` (not yet adopted here) — all have test files (but `unifiedJobBidSearch.test.ts` never calls `getBidServiceTypeTag`, the one function the form uses). Untested but extracted: `submissionSections`, `userBidNotesReadState`, `bidDateSentDisplay`, `subcontractorLikeRole`, `openInExternalBrowser`, and the hooks `useBidFlowFacts`, `useBidFlowReview`, `useBidBoardJobAccountStrips`, `useCustomerTermsWarning`, `useNarrowViewport660`, `useBidEditForm`.

---

## Recommended extraction order (value ÷ risk)

1. **Board buckets kernel** (Stage A) — `bidBoardBuckets.ts`: buckets + pill map + cap math + parity test, with search through the existing `filterBidsForPicker` (~60 lines out, ~150 lines of tests). Every later board move takes buckets as props.
2. **Form small kernels** (Stage A) — role gates, attestation line, Won/Lost lock, customer filter, project suggestion, derived-due (~60 lines out); gives `bidDateSentDisplay` its first test (the parent's R14 attestation write rules stay untested).
3. **Board small kernels** (Stage A) — staff lines, robot icon action, job-account flow merge, artifact links, maps URL (~50 lines out).
4. **`BidCopyBidDialog`** (Stage B) — 215 lines out, one owned state, `onClose` + two parent callbacks.
5. **`BidBoardDueLegend` + table head** (Stage B) — ~130 lines out, no parent state (the head takes `robotKeyButton` / `robotReadiness` as props).
6. **`BidBoardRowCells.tsx`** (Stage B) — B1 icons + links / GC-sent / due / last-contact / bid-value leaves (~260 lines), then the bid-number cluster + robot icon (~140).
7. **Board hook seams** — `useBidBoardNotesUnread` (~55) and `useBidBoardRowFocus` (~45).
8. **`BidFormSaveBar`** (Stage B, ~115) — already covered by the render test; keep `loggingContact` in the form.
9. **`BidBoardJumpStrip`** (~100) and **`BidBoardExpandedDetails`** + **`BidBoardLostStripReason`** (~130 together, with `bidBoardNotesTab` and `lossCategorySavingBidId`).
10. **Form sections** — `BidFormHeader` (~140), `BidFormStatusDates` (~220, with `dueTimeOpen` + `bidHasVersions`), `BidFormPeopleSection` (~260, with `changingPrimary` + terms), `BidFormLocationLinks` (~140, with the distance status). Add a render smoke per section as it moves.
11. **`BidBoardRow` / `BidBoardCard`** (~310) and last **`BidBoardSection`** (~235). Add a `BidsBidBoardTab.render.test.tsx` smoke (none exists) before step 11.

**Stays in `Bids.tsx`:** section-open state, deep-link highlight + scroll, `?lostSummary`, lost-summary open state and `saveLossReasonFromLostSummaryModal`, `linkJobToBidFromBoard`, the page's job-account strips, `useBidEditForm`, save / autosave / attestation / delete / archive / copy handlers, `gcCustomerDropdownOpen`, the evaluate checklist, and the Bid window.

Definition of done, gates (`npm run typecheck && npm run lint && npm test` after each move) and anti-patterns: [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md).

---

## Hazards

**Money paths**
- `onLinkJobToBid` → `snapshot_job_budget_from_bid`: stamps the job with the bid and makes the bid's estimate the job's budget (the bid reads Started). Board side is only the chip + button (779–793, `e.stopPropagation()`); keep the parent's confirm dialog in front of it.
- Value-match and estimate chips show only for won outcomes (`isWonOutcome`, 773) and only for job-link roles (`budgetChips` computed with `canSeeBidBoardJobLinks`).
- Lost summary labor column: `people_pay_config` + `clock_sessions`, shown only when `showLostModalLabor` (dev / master).
- Form money fields round-trip as strings; `bidFormPayload` (tested) writes them, `bidRowToFormValues` (untested) loads them.

**RLS / role gates**
- `loadBids` scopes primaries to bids they estimate, manage or created (Bids.tsx 1499–1500), matching the `primary_scope_*` RLS policies; `bids` rows adopted into another bid are filtered at load (1494).
- Updates refused by RLS (twin write fence, deleted bid) succeed with zero rows — the parent's loss-reason save checks `bidUpdateRefused`. Any write moved into a child must keep that check.
- Board gates: `canSeePricingTabs` (jump icons 731, flow doors 388–389), `showEstimatingHealth`, `onLinkJobToBid` presence, `authUser` for the archived modal, `isDev` for org-wide archive labels.
- Form gates: Bid # edit, GC add/edit/recipients (5 inline checks), terms edit (`canEditTerms`), `BidFormUserRole` omits `controller` (the parent maps it to `'assistant'`, Bids.tsx 4827).

**Realtime / events** — no supabase channels in either file. Reloads are callback- or event-driven (`onReloadBids`, `BID_REVIEWED_EVENT`, `JOB_CREATED_FROM_BID_EVENT`, `bid-gc-outcome-changed`).

**URL deep links and DOM ids (load-bearing)**
- `bid-board-row-<id>` (table row 1120 and card 1360) — scrolled by the parent (Bids.tsx 946) and B4 (315). `bid-board-section-<key>`, `bid-board-health-section`, `bid-board-map-card` (in `BidBoardMapCard` 511) — jump targets. `bid-board-notes-<id>` — `aria-controls` + scroll.
- Form ids consumed by `bidFormFocus.ts` (`bid-form-project-name`, `bid-form-gc-builder`, `bid-form-bid-value`, `bid-form-plans-link`, `bid-form-service-type`, `bid-form-bid-due-date`) and by `bidFlow.ts` step targets (`bid-form-plans-link`, `bid-form-count-tooling-link`). Renaming any of them silently breaks focus and landing.
- Board links: `/bids?bidId=<id>&tab=labor` (estimate chip), `/jobs?edit=<jobId>` (job chip); form link: `/bids?tab=pricing&bidId=<id>` (price requests). e2e: `viewport-smoke.spec.ts` (board at 375 px) and `deep-links.spec.ts` (`?newBid=true&project=` opens the New Bid heading).

**Effects whose deps make moves risky**
- Board 497–516 `[bids, authUser?.id]`: a three-table read on every `bids` identity change; the seq ref drops stale responses. 518–544 writes the watermark then refetches using the live `bidsForBoardUnreadRef` — keep the ref assigned during render.
- Board 460–474 `[rowHighlightId, bidBoardBuckets]` must run before the parent's 150 ms scroll; 308–328 rAF retry + 8 s clear; 295–297 hands focus back to deep links.
- Form 205–207 `[serviceTypeSwitchOpen, onServiceTypeSwitchOpenChange]`: an inline callback from a new parent would fire every render. 216–231 fetches only on bid id change (versions created mid-session are not seen until remount). All form hooks must stay above line 242.

**Preserve quirks (odd but load-bearing — fix deliberately, not during a move)**
1. Pill counts (`bidSentCounts` → `bidsInScope`: trade + not adopted) and section buckets (no scope filter) agree only because `loadBids` already filters by trade and `adopted_into_bid_id` (Bids.tsx 1494–1495).
2. Three "lost needs a reason" rules: the Bid Tabs badge counts bids with neither note nor category (428–434); the lost strip nudges on any uncategorized loss (1323–1330); `bidSentCounts.lostNeedingReason` is category-only.
3. `BidBoardLostSummaryModal` and `BidWorkingBoardArchivedModal` mount only inside the non-empty board branch (1867–1896): with no bids, or a search that matches nothing, the Archived button and `?lostSummary=1` open nothing.
4. The board's own `useBidBoardJobAccountStrips` read (369–374) never runs — the one mount always passes the page's strips.
5. `showMap` / `robotReadiness` comments say "off on the Robot Board" (69–70, 112–113); the Robot Board is now `BidsRobotMirrorTab`, and the one mount always passes both.
6. An expanded row collapses on any document Escape (484–491), including one meant for a modal above it.
7. The due-legend dialog's Escape handler is on the overlay div (1917), so it fires only with focus inside the dialog.
8. Only pending and lost cap at 25 rows; the cap row's `colSpan` is a literal 7 (1833) because both always show the Bid column.
9. The phone card has no map-hover handlers; only the desktop row pulses pins.
10. The bid number prints as a small lowercase "b" + digits (671–679); the full prefixed label lives only in `title` / `aria-label`.
11. The staff cell prints the estimator first and hides the account manager when it is the same person (id match, else display-name match, 1237–1240).
12. Form Bid #: New Bid shows "Auto"; estimator/primary get a disabled input; superintendent gets an enabled input whose `onChange` ignores typing (634–637).
13. The customer dropdown closes on a 200 ms blur timer; "+ Add new customer" survives it only through `onMouseDown` preventDefault (1152).
14. Three Google Drive folder URLs are hardcoded in the Files & links label (972–981).
15. The form resets only four states on close (186–193); `changingPrimary` resets per bid id, and the Bid window's `key` remounts the rest.
