# Bids Pricing + Labor Tabs Architecture Map

---
file: docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 sub-decomposition map (per PAGE_DECOMPOSITION_PLAYBOOK.md) for the two Bids workflow tabs that share useBidPricingEngine — src/components/bids/BidsPricingTab.tsx (5,122 lines; the Workbench) and src/components/bids/BidsLaborTab.tsx (1,451 lines) — and for the engine hook itself. Inventories every region's state, handlers, supabase tables/RPCs, coupling and test coverage so the next extraction can start without re-reading any of the three files.
covers:
  - src/components/bids/BidsPricingTab.tsx
  - src/components/bids/BidsLaborTab.tsx
  - src/hooks/useBidPricingEngine.ts
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-25
sections:
  - What this surface is
  - The shared substrate
  - Master summary table
  - "BidsPricingTab — per-region dossiers"
  - "BidsLaborTab — per-region dossiers"
  - Test coverage and untested money math
  - What must stay in the parent(s)
  - Stage-A pure-logic inventory
  - Preserve-quirks list
  - Recommended extraction order
---

## What this surface is

> **Every line range in this map is as of `a05cef4c4`.** Ranges rot with each commit — search the symbol named beside the range, and regenerate the facts with `npm run map -- <file>` before trusting a number.

Two components that were **Stage-B extractions from `Bids.tsx`** (2026-05-30, cfb1f1982; the parent side is [`BIDS_TABS_ARCHITECTURE.md`](./BIDS_TABS_ARCHITECTURE.md) §`labor`, §`pricing` and §Pricing-engine shared layer), and the engine hook both read:

| File | Lines | Hook census (fact sheet) | Renders behind / invoked from | Selection prop | Commits, 90 d |
|---|---|---|---|---|---|
| [`src/components/bids/BidsPricingTab.tsx`](../src/components/bids/BidsPricingTab.tsx) | **5,122** | 100 useState · 16 effects · 1 useMemo · 6 useRef · 7 custom hooks · 76 inner functions | `activeTab === 'pricing'` in [`Bids.tsx`](../src/pages/Bids.tsx) (search `<BidsPricingTab`) | `selectedBidForPricing` | 102 |
| [`src/components/bids/BidsLaborTab.tsx`](../src/components/bids/BidsLaborTab.tsx) | **1,451** | 24 useState · 4 effects · 7 useMemo · 1 useRef · 9 custom hooks · 35 inner functions | `activeTab === 'labor'` in `Bids.tsx` (search `<BidsLaborTab`) | `selectedBidForCostEstimate` | 29 |
| [`src/hooks/useBidPricingEngine.ts`](../src/hooks/useBidPricingEngine.ts) | **1,819** | 69 useState · 14 effects · 5 useRef · 41 inner functions | once in `Bids.tsx` (search `useBidPricingEngine({`), destructured and threaded down; `BidsTakeoffTab` / `BidsTakeoffMaterialsSummarySection` import only its return type | — | 20 |

The two tabs have gone opposite ways since the 2026-07-29 map. **Pricing doubled** (2,610 → 5,122): the Workbench (v2.2198–v2.2404), price options and own-takeoff alternates (v2.2404), the RFQ / quote / robot doors (v2.2627–v2.3573), frozen prices (v2.3591) and the ★-aware Share (v2.2120, v2.3685) all live inside it, and it now runs five data reads of its own (effects 778, 878, 1921, 1969, 2086) over 15 tables and 4 RPCs. **Labor shrank** (2,365 → 1,451) through the Labor refresh (v2.3276–v2.3598) and the decomposition train (v2.3546–v2.3565). Pricing is the hot file (last commit 2026-09-21). Only one commit touched the three files after this map's previous edit (f20b71c18, 2026-09-19): v2.3685 (dcacc34ae, Pricing +45/−13 — `starChoice` gains `'both'`, `shareOverride.also`, `loadScenarioInputs` fetches an alternate ★'s own count rows).

What each tab holds is still UI/modal/form state, a large JSX body, and CRUD handlers that write supabase directly and refresh through injected engine loaders — separable panels, not tangled data engines — except the Workbench block (P2), whose 12 sub-blocks share one derive and read 43 state values between them. The sibling map for the other big cluster tab is [`BIDS_TAKEOFF_TAB_ARCHITECTURE.md`](./BIDS_TAKEOFF_TAB_ARCHITECTURE.md) (`BidsTakeoffTab`, 3,186 lines).

Behavior/workflow docs live elsewhere (`PROJECT_DOCUMENTATION.md`, `GLOSSARY.md`, `BIDS_SYSTEM.md`); this map is coupling/refactor-oriented only.

---

## The shared substrate

All four pieces are already extracted — the constraint on further decomposition is *respecting* them, not building them:

1. **The shared bid pointer (selection).** `Bids.tsx` owns `setSharedBid` / `selectBidAndSyncUrl(bid, tab)` / `closeSharedBidAndClearUrl` and the `?tab=…&bidId=…` URL router. Each tab receives its facet as a controlled prop (`selectedBidForPricing`, `selectedBidForCostEstimate`) plus `onSelectBid` / `onClose`. **No region extracted from these tabs may own selection.** Two narrow write paths exist and must be preserved: `BidsLaborTab` gets the raw setter `setSelectedBidForCostEstimate` (used only by `updateBidDistanceFromCostEstimate`, 603–627, to swap in the reloaded bid row), and `BidsPricingTab` gets `onSwitchBidVersion` (= the engine's `switchActiveVersion`) + `reloadBidVersions` for the price-option cards — a Version switch, not a bid selection.
2. **The shared data engine.** [`useBidPricingEngine`](../src/hooks/useBidPricingEngine.ts) (deps type `UseBidPricingEngineDeps` 49–60: the four `selectedBidFor*` facets, `activeTab`, `selectedServiceTypeId`, `authUser`, `setError`, `loadBids`, `setSharedBid`) owns every piece of pricing / cost-estimate data both tabs render; its load effects key off `activeTab` + the selection facets — an extracted sub-region keeps calling the injected loaders, never re-fetches on its own schedule. **Load order (v2.2847):** count rows are per Version and the loaders read the active version from a bid-tagged ref (`selectedBidVersionIdRef` 189), so every cost-estimate load runs only after that ref belongs to the bid on screen — the Labor/Takeoffs effect in `Bids.tsx` gates on `shouldLoadCostEstimate` ([`lib/bids/laborTabLoadGate.ts`](../src/lib/bids/laborTabLoadGate.ts)) and resolves the version first (`loadBidVersions` → `pickActiveVersion` → `setSelectedBidVersionId`); `costEstimateResolve` (185, same shape as `pricingResolve`) is what the Labor tab's `panel` prop is derived from (`laborEmptyState`). **Lazy mint:** `loadCostEstimateData` (721–775) mints a `cost_estimates` row only when the resolved version has count rows (`shouldMintCostEstimateOnLoad`); otherwise the first write does (`ensureCostEstimateForBid` 680–702). The engine by region:

| Engine region | State (line) | Functions (lines) | Effects | Tables | Read by |
|---|---|---|---|---|---|
| E1 Version pointer | `bidVersions` 175, `selectedBidVersionId` 186 (+ref 189) | `setSelectedBidVersionId` 191–194, `activeVersionIdForBid` 196–202, `applyVersionFilter` 205–207, `loadBidVersions` 878–891, `saveBidSelectedBidVersion` 1252–1267, `switchActiveVersion` 1314–1335 | — | `bid_versions`, `bids` | every cluster tab |
| E2 Counts | `countRows` 84 (+`skipNextLoadCountRowsRef` 85) | `loadCountRows` 217–236, `refreshAfterCountsChange` 238–244 | 1396–1416 | `bids_count_rows` | Counts |
| E3 Takeoffs | `takeoffCountRows` / `takeoffMappings` / `takeoffRoughPartLines` / `takeoffRoughCatalogLowestByPartId` 88–91, `materialTemplates` 100, `draftPOs` 101, takeoff book 102–105 | `loadTakeoffCountRows` 246–352, `loadMaterialTemplates` 354–369, `loadDraftPOs` 371–382, `loadTakeoffBookVersions` 384–397, `loadTakeoffBookEntries` 399–443, `saveBidSelectedTakeoffBookVersion` 445–460 | 1418–1445, 1447–1459, 1461–1467, 1469–1477, 1479–1485 | `bids_takeoff_*`, `material_templates`, `purchase_orders`, `takeoff_book_*` | Takeoffs |
| E4 Materials-model switch | `materialsModelSwitchModal` 94, `materialsModelBusy` 99 | `openMaterialsModelSwitch` 1355–1361, `confirmMaterialsModelSwitch` 1363–1394 | — | `bids` | Takeoffs, Labor (Pricing: dead prop, quirk 1) |
| E5 Cost estimate | `costEstimate` 108 … `hoursPerTrip` 117, estimator + travel inputs 123–129, `costEstimate*Rows` 132–144, `costEstimateResolve` 185 (+`costEstimateBidIdRef` 122) | `loadPurchaseOrdersForCostEstimate` 462–472, `loadPOTotal` 474–484, `loadCostEstimate` 486–570, `loadCostEstimateCountRows` 573–586, `loadFixtureLaborDefaults` 588–592, `loadCostEstimateLaborRowsAndSync` 597–678, `ensureCostEstimateForBid` 680–702, `settleCostEstimateLoad` 705–707, `loadCostEstimateData` 721–775, `setCostEstimatePO` 1337–1353 | 1487–1495 | `cost_estimates`, 6 `cost_estimate_*_rows`, `purchase_orders`, `purchase_order_items`, `fixture_labor_defaults`, `labor_book_entries` | Labor, Takeoffs |
| E6 Labor book | `laborBookVersions` 118, `laborBookEntries` 119, `selectedLaborBookVersionId` 120, `laborBookEntriesVersionId` 121 | `loadLaborBookVersions` 777–792, `loadLaborBookEntries` 794–811, `saveBidSelectedLaborBookVersion` 813–828 | 1497–1503 | `labor_book_*`, `bids` | Labor |
| E7 Pricing | 156–169 (`priceBookVersions`, `templatePriceBookVersions`, `userLastPriceBookTemplateId`, `legacyPricingRefs`, `templatesMode`, `priceBookEntries`, the three overlay arrays, `selectedPricingVersionId`), `pricingResolve` 180–181, `pricing*Rows` 133–145, `pricingCountRows` … `pricingFixtureMaterialsFromTakeoff` 208–215 | `loadTemplatePriceBookVersions` 831–851, `loadBidPricings` 855–868, `versionStarredId` 872–875, `loadPriceBookEntries` 893–910, `loadLegacyPricingRefs` 916–943, `loadBidPricingAssignments` 945–1004, **`loadPricingDataForBid` 1006–1225** (220 lines, writes 13 state, reads 12 tables), `saveBidSelectedPriceBookVersion` 1227–1249, `pickDefaultTemplatePricingId` 1277–1282, `legacyDataTemplateIdFor` 1285–1292, `rememberLastPriceBookTemplate` 1303–1307, `retryPricingResolve` 1310–1312 | 1505–1593 (the resolve; writes 17 state), 1598–1608, 1612–1624, 1639–1645 | `price_book_*`, `bid_pricing_assignments`, `bid_count_row_custom_prices`, `bid_count_row_submission_hides` + the loader's reads | Pricing, Cover Letter |
| E8 Team labor / assigned costs | `teamLaborDataForBids` 148, `bidAssignedCosts` 150 | — | 1626–1629, 1632–1637 | via `utils/teamLabor`, `lib/bids/loadBidAssignedCosts` | Pricing, Labor, Bid Costs |
| Return object | — | 1647–1818 | — | — | 35 of the 163 returned members are not destructured by `Bids.tsx` (mostly raw setters; also `templatesMode` / `setTemplatesMode`, `saveBidSelectedBidVersion`, `loadCountRows`) |

3. **The shared calc kernel.** [`useBidPricingRows`](../src/hooks/useBidPricingRows.ts) (216 lines, invoked in `Bids.tsx`) wraps [`computeBidPricingRows`](../src/lib/bidPricingRowCalculations.ts): `BidsPricingTab` receives `pricingRowsForGrid` + `pricingPackageSource`, `BidsCoverLetterTab` receives `coverLetterPricingRows`. The on-screen grid is single-sourced (`derivePricingWorkbench` 2612–2666 reads only `pricingRowsForGrid`), **but the tab re-runs `computeBidPricingRows` itself at four sites for scenarios that are not on screen** (1804, 1945, 2122, 2367 — see the Stage-A inventory).
4. **Quote costs.** `useBidCustomCosts` (in `Bids.tsx`, search `useBidCustomCosts(`) supplies `bidCountRowCustomCosts` + `reloadBidCustomCosts`; the tab's `revertCustomCost` (2593–2604) DELETEs `bid_count_row_custom_costs` and reloads through it.

The cross-tab data flow: Counts → Takeoffs (materials \$) → Labor (`cost_estimates` + labor rows) → **Pricing** (the Workbench) → Cover Letter. Pricing's doors back: `onNavigateBidToTab(bid, 'counts'|'takeoffs'|'labor')` and the margin-breakdown modal's `onJumpToTab` → `onNavigateBidToTabRow` → `Bids.tsx` `setBidTabRowJump` → Labor's `rowJump` prop → `usePendingRowFlash` + `laborRowDomId` on the HOURS row (v2.2400). The old `onNavigateToLabor` / `onNavigateToLaborDirectCosts` props are gone; see quirk 8 for the `#labor-direct-costs` id they left behind.

---

## Master summary table

Anchors are symbol + line range as of `a05cef4c4`. "Tests" names the colocated kernel tests (cases) and component render tests that cover the region; ✗ = no test reaches it.

| Region | Anchor | Lines | Local state | Coupling | Risk | Tests | Status |
|---|---|---|---|---|---|---|---|
| P0 Pricing lock (v2.3591) | `revisedBidIds` 272, `guardPricingWrite` 275–279, `setPricingRevising` 280–285; chip 3934–3966 | ~50 | 1 | **cross-cutting** — 12 write handlers call `guardPricingWrite` | — | `pricingLock` 4 | inline; stays in the tab |
| P1 Bid picker | `!selectedBidForPricing` 2671–2683, `filteredBidsForPricing` 1915–1916, `BidPickerStandardList` 4722–4729 | ~25 | 1 | low | low | `filterBidsForPicker` 2 | inline; shared parts extracted (v2.3546); sweep deferred |
| P2 Workbench card | `selectedBidForPricing &&` 2684–4691 + handlers ~463–703, 905–970, 1921–2666 | **2,008** JSX | 48 | **high** — one derive, 12 blocks (dossier) | high | kernels only; ✗ tab render | inline, **left by decision** — cut per block |
| P3 Margin-breakdown modal | `pricingBreakdownRow &&` 4692–4705 | 14 | 1 | none | — | render 3 | **extracted v2.3547** |
| P4 Price book drawer | `wbBookDrawerOpen ?` 4730–4766; effects 338–349, 358–361, 1077–1087 | 37 + ~250 handlers | 10 | med (v2.2444 offer) | — | render 5; `bookEditBidOffer` 17, `pricingWriteTarget` 7 | **extracted v2.3563**; offer + writes stay |
| P5 Version / delete / entry forms | 4767–4779, 4824–4841, 4842–4864; effects 975–991, 994–1004 | ~55 + ~330 handlers | 20 | med | — | render 3+2+4; `pickActivePricing` 8, `starredScenarioGuard` 7 | **extracted v2.3564**; writes stay |
| P6 Quotes / RFQ / robot doors | 744–865 (state, effects 758–768, 778–826, 857–865, `openRobotChip`), chip 2759–2800, modals 4964–5097 | ~280 | 12 | low-med (one `derivePricingWorkbench` read; 7 openers in the header — chip 2765–2766, `PricingShareMenu` doors 2818–2822) | low-med | `priceMatrixRequest` 11, `rfqDesk` 18; render: PriceWithRobot 3, QuoteCompare 3+4; ✗ six modals | inline wiring; all 8 modals extracted |
| P7 Share / print / CSV + ★ chooser | 1741–1913; `PricingShareMenu` ~2802; chooser 4920–4962; `PackageAndSendBidPricingModal` 5099–5119 | ~250 | 5 | med (reads the pricing inputs) | med | render: ShareMenu 7, PackageAndSend 2; `pricingPage` 8; ✗ `packageRowsFromInputs` | inline |
| Extracted-modal wiring (GenerateUnitCost, AssignTakeoffPart, Adopt) | 4867–4881, 4706–4721, 4909–4919 | ~45 | 2 (+ `adoptOpen`, counted in P2) | low | — | ✗ | components extracted; GenerateUnitCost + AssignTakeoffPart **unreachable** since v2.2707 (quirk 17) |
| L0 Header, flow strip, materials toggle | card 867–1008 | ~140 | 0 | low (E4 confirm modal renders in the parent) | low | — | inline |
| L1 Bid picker | `costEstimateSearchQuery` 253, 848–850, 854–866, 1401–1408 | ~25 | 1 | low | low | `filterBidsForPicker` 2 | inline, same as P1 |
| L2 Autosave | effect 369–446; autosave status/reason + `cellSaves` + helpers 273–295; footer 1385–1397 | ~110 | 3 | **high** — 17 deps, writes 7 tables | med | `costEstimateAutosavePayload` 6, `laborCellSaveState` 5; ✗ effect | inline by decision |
| L3b HOURS (`BidsLaborNewView`) | 1028–1131 + hooks 254–272 + prints 798–846 | ~150 in tab | 0 (view owns its own) | med (36 props) | — | render 12; `laborRowHours` 12, `laborBookMatch` 11, `crewRate` 5, `laborBookCalibration` 5, `costEstimatePage` 10; ✗ Labor-total IIFE | **extracted** (view, v2.3276) |
| L4 Cost-parameter boxes | Vehicle Travel 1132–1241, Lodging and Meals 1242–1356, Bid labor recorded 1357–1371 | ~240 | 7 | med (6 engine input pairs — driving rate, hours/trip, the four travel boxes — + parent distance input) | med | `laborTabCostSummaries` 5, `extractZipFromAddress` 3 | inline by decision; formulas extracted v2.3565 |
| L5 Direct costs | `BidsDirectCostsSection` 1372–1383; handlers 643–796 | ~165 | 0 | low (rows + setters injected) | low | render 3; `costEstimateDirectCosts` 9, `bidTotalCostBreakdown` 5; ✗ handlers | **section extracted v2.3295**; 15 clone handlers inline |
| L6 Labor book panel | `BidsLaborBookPanel` 1409–1449; state 299–321; handlers 344–361, 456–564 | ~190 | 13 | med | — | render 4; `laborEntryProvenance` 11 | **extracted v2.3550**; writes stay |

---

## BidsPricingTab — per-region dossiers

### Component contract (what the parent injects)

`BidsPricingTabProps` (112–197): **67 props**, 66 destructured (202–267). Grouped: **selection** `selectedBidForPricing`, `bids`, `onSelectBid` / `onClose`, `onlyMyBids` / `setOnlyMyBids` / `isMyBid`; **bid flow** `onOpenBidFlowDoor`, `bidFlowDoorAllowed`; **versions** `bidVersions`, `selectedBidVersionId`, `onSwitchBidVersion`, `reloadBidVersions`; **engine data** `priceBookVersions`, `priceBookEntries` (+`setPriceBookEntries`), `templatePriceBookVersions`, `defaultPriceBookTemplateId`, `bidPricingAssignments`, `bidCountRowCustomPrices`, `bidCountRowSubmissionHides`, `selectedPricingVersionId` / `setSelectedPricingVersionId`, `pricingCountRows`, `pricingCostEstimate`, `pricingLaborRows`, the five `pricing*Rows` direct-cost mirrors, `pricingMaterialTotalRoughIn/TopOut/TrimSet`, `pricingLaborRate`, `pricingFixtureMaterialsFromTakeoff`, `teamLaborDataForBids`, `resolvePanel` + `onRetryResolve` (v2.2367); **engine loaders** `loadTemplatePriceBookVersions`, `rememberLastPriceBookTemplate`, `loadBidPricings`, `loadPriceBookEntries`, `loadBidPricingAssignments`, `reloadPricingForBid` (= `loadPricingDataForBid`), `saveBidSelectedPriceBookVersion`; **quote costs** `bidCountRowCustomCosts`, `reloadBidCustomCosts`; **shared calc** `pricingRowsForGrid`, `pricingPackageSource`; **parent-owned** `costEstimatePOModalTaxPercent`, `canPackageAndSendBidPricing`, `estimatorUsers`, `ledgerPrefixMap`, `profileName`, `fixtureTypes` + `getOrCreateFixtureTypeId`, `narrowViewport640`, `bidPreview`, `error` / `setError`, `selectedServiceTypeId`, `loadBids`; **navigation** `onEditBid`, `onNavigateBidToTab`, `onNavigateBidToTabRow`. Gone since the last map: `templatesMode` / `setTemplatesMode` (now `const templatesMode = true`, 320), `onNavigateToLabor`, `onNavigateToLaborDirectCosts`. Dead: `openMaterialsModelSwitch` (quirk 1). Context/router hooks: `useToastContext` 269, `useBidFlowFacts` 287, `useBidFlowReview` 288, `useBidFlowFold` 290, `useConfirmDialog` 291, `useSearchParams` 757, `usePriceMatrixRequests` 832.

The parent renders **`BidVersionPicker` above this tab** and **`BidsPricingCalculator` beside it** — neither is inside the tab.

**State clusters (all 100 `useState`)** — the coupling data behind the extraction order:

| Cluster | State (declaration line) | # | Region |
|---|---|---|---|
| Lock | `revisedBidIds` 272 | 1 | P0 |
| Picker | `pricingSearchQuery` 293 | 1 | P1 |
| Forms | 294–315 (18 values), `pricingFormMode` 363, `pricingCloneSourceId` 364 | 20 | P5 |
| Drawer | `priceBookSearchQuery` 316, `wbBookDrawerOpen` 321, `wbBooksExpanded` 322, `wbPriceDisplayMode` 323, `pendingBookOffer` 330, `applyingBookOffer` 331, `editingTemplateId` 354, `templateEntries` 355, `addPricingMenuOpen` 365 (dead, quirk 17), `pricebookSwitchBusy` 731 | 10 | P4 (P2's book chip sets `wbBookDrawerOpen` + `wbBooksExpanded`, 4119–4120; the P5 entry form reads `wbPriceDisplayMode`) |
| Assign search | `pricingAssignmentSearches` 366, `assignMatchMode` 369, `pricingAssignmentDropdownOpen` 458 | 3 | P2 grid |
| Modal payloads | `pricingBreakdownRow` 459, `assignTakeoffRow` 460, `generateUnitCostModalParams` 732 | 3 | P3 / wiring |
| Solver, preview, drafts | `wbPreview` 463, `wbPreviewRestoredAt` 466, `wbPreviewVeto` 478, `wbLocks` 518, `wbMarginPct` 519, `wbTargetTotalInput` 520, unnamed `setWbTargetSolveResult` 524 (write-only, quirk 17), `wbSolveLanding` 528, `wbShowUnpricedOnly` 529, `wbShowNoCostOnly` 530, `wbApplying` 531, `wbPriceDrafts` 535, `wbCellDraft` 540, `wbJustSaved` 542, `savingUnitPriceOverride` 741, `solveMenuOpen` 905, `wbSolverOpen` 911, `wbCoverageOpen` 928 | 18 | P2 strip + grid |
| Brush | `brushArmed` 547, `brushMarginInput` 548, `brushCommitting` 549, `brushStrokeCount` 550, `brushUndo` 552, `recentMargins` 1223 | 6 | P2 strip + grid |
| Profit bar | `wbBarHover` 707, `wbBarTipLeft` 708, `wbBarPinnedId` 709, `wbLegendCollapsed` 710, `wbFlashRowId` 717 (shared with grid + composition strip) | 5 | P2 profit bar |
| Help | `wbTourSteps` 721, `wbInfoOpen` 970 | 2 | P2 "?" card (`wbInfoOpen` is opened by the header's "?" button, 2747) |
| Scenarios / alternates | `wbCopyingPrices` 718, `wbScenarioRevenue` 724, `wbCloning` 727, `wbVariantDoorOpen` 729, `adoptOpen` 872, `gcNamesById` 875, `addPriceOpen` 876, `copyingGcPrice` 877, `pricingEdit` 956, `altVersionData` 2083, `addOwnTakeoffOpen` 2084, `creatingOwnTakeoffAlt` 2085 | 12 | P2 cards row |
| Book-match bar | `wbFillingBook` 719 | 1 | P2 |
| History | `wbHistory` 726 | 1 | P2 history |
| Share / print | `packageSendOpen` 743, `starChooser` 870, `starChoice` 898, `starBusy` 899, `shareOverride` 972 | 5 | P7 |
| Quotes / RFQ / robot | `d22AuditOpen` 744, `prepareCopyOpen` 745, `plugInQuoteOpen` 748, `plugInScheduleOpen` 750, `priceWithRobotOpen` 752, `quotesCompareOpen` 769, `quoteCount` 770, `quoteNonce` 771, `deskRfqs` 775, `rfqDeskOpen` 776, `composeScope` 777, `openRfqHouseIds` 827 | 12 | P6 |

Refs (6): `bookOfferTokenRef` 334 and `freezingPricingRef` 337 (P4 / freeze chain), `wbTargetTotalFocusedRef` 522, `brushStrokeRef` 553, `brushPaintingRef` 554, `solveMenuRef` 906.

### Region P0 — Pricing lock and the freeze chain (cross-cutting)

- **Lock (v2.3591):** `pricingLockState` over `bid_date_sent` + the session's `revisedBidIds` (sessionStorage, never on the bid). `guardPricingWrite` (275–279) toasts and refuses; it gates `armBrush`, `endBrushStroke`, `undoBrushSweep`, `savePricingAssignment`, `removePricingAssignment`, `updateUnitPriceOverride`, `applyPendingBookOffer`, `savePricingEntry`, `copyPricesIntoViewedScenario`, `fillMatchingBookEntries`, `applyWorkbenchPreview`, `commitWorkbenchTypedPrice`. Chip + *Revise…* / *Lock again* render 3934–3966 inside the sticky strip.
- **Freeze (the first price freezes a bid):** `freezeSharedPricingAfterWrite` (1678–1692; guarded by `freezingPricingRef`) → `resolvePricingWriteTarget` / `needsFreezeAfterWrite` → `cloneTemplateIntoBidAndActivate` (1695–1707, RPC `clone_price_book_version_to_bid`) → `attachAndActivateNewBidPricing` (1655–1665, UPDATE `price_book_versions.bid_version_id`). Every price write calls it after its own write.
- **One write path:** `writeUnitPriceOverrideRow` (1162–1203) is shared by `updateUnitPriceOverride` (GenerateUnitCost's apply, 4879 — unreachable, quirk 17), the brush, the solver's Apply, typed prices and copy-prices (quirk 3).
- **Extraction:** none of this moves. A sub-component receives `guardPricingWrite` and a `writePrice(rowId, value)` callback that wraps write + reload + freeze.

### Region P1 — Bid picker (no bid selected)

- **Render location:** `!selectedBidForPricing &&` search row 2671–2683 (`BidPickerSortToggle`, `MyBidsToggle`) and `BidPickerStandardList` 4722–4729.
- **Owned local state:** `pricingSearchQuery`.
- **Derived:** `bidsScopedForPricing` / `filteredBidsForPricing` (1915–1916) via [`filterBidsForPicker`](../src/lib/bids/filterBidsForPicker.ts).
- **Extraction:** the shared part is done (v2.3546); what repeats across the nine `MyBidsToggle` tabs is the search `<input>` + toggle row — see extraction order item 11.

### Region P2 — The Workbench card (selected bid)

- **Render location:** `selectedBidForPricing &&` 2684–4691 (**2,008 lines**). Per the fact sheet the block reads 43 state values, writes 35 and calls 38 handlers; everything numeric inside it flows from `derivePricingWorkbench()` (2612–2666 — `computeBidCostBreakdown` + `decoratePricingRows` over `pricingRowsForGrid`; also called by `runWorkbenchSolve`, `applyWorkbenchPreview`, `commitWorkbenchTypedPrice` and `QuoteCompareModal` at 5090) and the derive preamble at 2944–3134 (`eff` rows at 3007, `effMargin` 3033, `costed` 3036, `conc = profitConcentration(…)` 3039, `mColor` 3043, the Revenue/Profit/Margin cell editors, `visibleEff`). The five direct-cost mirrors reach the kernel through the one memo, `pricingDirectCostRows` (2607–2610).
- **The twelve blocks (re-measured at `a05cef4c4`; the nine-block table of v2.3562 is superseded):**

| Block | Span | Lines | Owns state (cluster) | Handlers (lines) | Data |
|---|---|---|---|---|---|
| card header, bid flow strip (v2.3200; fold 2707–2720), title, "?" button, RFQ chip (2759–2800), Share ▾ | 2684–2857 | 174 | — (reads `flowFold`, `rfqChip`; its "?" button 2747 opens the Help card's `wbInfoOpen`) | `openRobotChip`, `requestWithStarCheck`, `printAllPricingPages` | — |
| the "?" card (v2.2376) + `SpotlightTour` | 2858–2943 | 86 | Help | `startWorkbenchTour` 2028–2037, `WORKBENCH_TOUR_STEPS` 2000–2026 | — |
| resolve skeleton / empty state (incl. the G1 donor 2987–3002 in the `!derived` branch: `copyingGcPrice`, `copyBasePriceFromVersion`) + the derive preamble | 2944–3134 | 191 | — | `derivePricingWorkbench` | — |
| price-option / version cards row (v2.2404; variant door 3179–3269, own-takeoff name 3271–3320, copy-prices 3430–3443) | 3135–3565 | 431 | Scenarios / alternates | `gcNameForVersion` 890–895, `viewWorkbenchScenario` 2040–2047, `makeScenarioCustomerFacing` 2050–2067, `setScenarioOffered` 2070–2078, `createOwnTakeoffAlternate` 2150–2201, `createPriceOption` 2204–2226, `rekeyClonedPricingToVersion` 2236–2297, `copyBasePriceFromVersion` 2300–2327, `copyPricesIntoViewedScenario` 2338–2421; effects 878–888, 1921–1966, 2086–2147 | `price_book_versions`, `bid_versions`, `bids_count_rows`, `bids_takeoff_rough_part_lines`, `customers`, `bids` (2086), the four overlay tables `price_book_entries` / `bid_pricing_assignments` / `bid_count_row_custom_prices` / `bid_count_row_submission_hides` (effect 1921, copy-prices, the rekey loop); RPCs `split_bid_into_versions`, `create_bid_version`, `clone_price_book_version_to_bid` |
| sticky stats + solver strip (preview Apply/Discard 3598–3624, brush 3645–3704, coverage chip 3715–3736, solver 3737–3896, brush banner, landing chip, no-cost note 3920–3933) | 3566–3933 | 368 | Solver, Brush | `runWorkbenchSolve` 2450–2496, `applyWorkbenchPreview` 2499–2528, `armBrush` … `undoBrushSweep` 556–691, `setAndStashWbPreview` 480–486, `toggleWbPreviewVeto` 490–501; effects 505–517, 692–703, 946–953 | via the write path |
| frozen-price lock chip (v2.3591) | 3934–3966 | 33 | Lock | `setPricingRevising` | — |
| *Sent … · today …* (frozen prices PR 2) | 3967–3981 | 15 | — | — | — |
| margin history | 3985–4083 | 99 | History | effect 1969–1987 | RPC `bid_pricing_history` |
| coverage row "N of M priced" + book-match bar (*Fill N matching*) | 4084–4140 | 57 | Book-match | `fillMatchingBookEntries` 2425–2445 | `bid_pricing_assignments` |
| the grid rows proper (assign dropdown 4269–4353, preview ghost 4356–4389, ⓘ breakdown) | 4142–4489 | 348 | Assign search, `wbLocks`, drafts, `wbFlashRowId` | `commitWorkbenchTypedPrice` 2532–2587, `savePricingAssignment` 1118–1144, `removePricingAssignment` 1146–1159, `revertCustomCost` 2593–2604, `openAddEntryFromAssignSearch` 1401–1413, `renderAssign*` 386–457 | `bid_pricing_assignments`, `bid_count_row_custom_prices`, `bid_count_row_custom_costs` |
| the profit bar + legend | 4491–4669 | 179 | Profit bar | inline `jumpToRow`, `hoverSlice` | — |
| the composition strip (`PricingCompositionBar`, v2.3239/v2.3458) | 4671–4685 | 15 | — (writes the grid filters + `wbFlashRowId`) | — | — |

- **The 3566–3983 sticky `<div data-tour="workbench-summary">` holds the strip, the lock chip and the sent line** — cutting the strip means cutting that wrapper.
- **One effect serves three regions:** the outside-click / Escape effect 1006–1028 closes the assign dropdown (grid), the dead add-pricing menu, and the pinned profit-bar slice — split it before moving the grid or the profit bar.
- **Decision 2026-09-17 still stands for the strip and the grid rows** (they share the 18 solver/draft values, the brush and the flash state): cut only inside a Workbench feature train. The blocks that own their state — the "?" card (opened from the header's "?", 2747), margin history, profit bar — and the whole P6/P7 surfaces are independent of that decision; see the extraction order.

### Region P3 — Margin-breakdown modal — extracted v2.3547

[`PricingMarginBreakdownModal.tsx`](../src/components/bids/PricingMarginBreakdownModal.tsx) (280 lines; `row`, `onClose`, optional `onJumpToTab` built from `onNavigateBidToTabRow` / `onNavigateBidToTab`); `PricingBreakdownRow` moved with it; 3 render tests. The tab keeps `pricingBreakdownRow` and the `openRowBreakdown` closure `derivePricingWorkbench` returns (2649–2664). Wiring 4692–4705.

### Region P4 — The Price book drawer — extracted v2.3563

- **Wiring:** `{wbBookDrawerOpen ? … : null}` 4730–4766 → [`BidsPriceBookDrawer`](../src/components/bids/BidsPriceBookDrawer.tsx) (342 lines) with grouped props (`books`, `entries`, `offer`, `doors`). It opens from the book chip in the book-match bar (the button at 4116–4122 calls `setWbBookDrawerOpen(true)`, `setWbBooksExpanded(false)` and `selectPanelVersion`).
- **Stays in the tab:** the Escape listener + close-time reset (effect 338–349), the offer retire effect (358–361), the template-follow effect (1077–1087), `loadTemplateEntries` (1047–1064, `price_book_entries` SELECT with `fixture_types(name)`), `reloadPanelEntries` / `reloadPanelVersions` (1066–1074), `selectPanelVersion` (1089–1096), `onSelectPriceBookTemplate` (1714–1739, reuse rule = quirk 5), and **the v2.2444 door across**: `noteBookEditForOpenBid` (1446–1506) plans the offer after a book edit, `applyPendingBookOffer` (1513–1555) applies it. Offered once per edit, never automatically — a sent bid must not re-price because someone tidied the book.
- **Derived:** `panelVersionId` (1035) = `templatesMode ? editingTemplateId : selectedPricingVersionId` — with `templatesMode` a constant `true` it is always `editingTemplateId` (quirk 17); it gates the P5 entry form. `currentPriceBookTemplateId` (1038–1045) via `resolveCurrentPriceBookTemplateId`.

### Region P5 — Version form, delete-version, entry form — extracted v2.3564

- **Wiring:** `pricingVersionFormOpen` 4767–4779 → `PricingVersionFormModal` (93 lines; receives `templatesMode`), `deletePricingVersionModalOpen && pricingVersionToDelete` 4824–4841 → `DeletePricingVersionModal` (107), `pricingEntryFormOpen && panelVersionId` 4842–4864 → `PricingEntryFormModal` (157). Between them sits the Workbench's *Price* rename-or-delete card (`pricingEdit &&` 4780–4823, `savePricingEdit` 957–967) — P2 cards-row state, not P5, though its Delete opens the P5 modal (sets `pricingVersionToDelete` + `deletePricingVersionModalOpen`).
- **Stays in the tab:** 20 state values; the reset-all effect on `selectedServiceTypeId` (975–991, writes 15 of them); the auto-total effect (994–1004); `openAddTemplate` 1099–1106, `openEditPricingVersion` 1225–1229, `closePricingVersionForm` 1231–1235, `savePricingVersion` 1237–1322 (rename / new template / new blank pricing with `nextSortOrder` / clone via RPC — cloning from a template calls `rememberLastPriceBookTemplate`), `openDeletePricingVersionModal` 1324–1329, `confirmDeletePricingVersion` 1331–1380 (quirk 11), `openNewPricingEntry` 1382–1392, `openAddEntryFromAssignSearch` 1401–1413 (entry form aimed at the bid's pricing: `entryFormTargetPricing`), `openEditPricingEntry` 1415–1425, `closePricingEntryForm` 1427–1438, `savePricingEntry` 1557–1619 (auto-creates fixture types via `getOrCreateFixtureTypeId`; calls `noteBookEditForOpenBid` and the freeze), `deletePricingEntry` 1622–1635 (`confirmDialog`).
- **Supabase:** `price_book_versions`, `price_book_entries` (INSERT/UPDATE/DELETE), RPC `clone_price_book_version_to_bid`.

### Region P6 — Quotes, RFQs and robot pricing (the doors on the header)

- **State:** the 12-value cluster (744–827). **Hooks:** `useSearchParams` 757 (the `?robot=price&bidId=` one-shot door, effect 758–768), `usePriceMatrixRequests` 832 (keyed by `quoteNonce`). **Effects:** 778–826 (reads `bid_quotes`, `bid_rfqs`, `email_send_log` → `quoteCount`, `deskRfqs`, `openRfqHouseIds`), 857–865 (the `?d22audit=1` one-shot door via `window.history.replaceState`). **Derived:** `rfqChip = derivePricingChip(…)` 837. **Handler:** `openRobotChip` 839–852 (reads `bid_price_matrix_requests`).
- **Render:** the RFQ chip in the header (2759–2800); modals 4964–5097 — `SpecSectionAuditModal` (4964), `PrepareFixtureCopyModal` 4966–4987, `RfqDeskModal` 4989–5006, `RfqComposeModal` 5008–5023, `PlugInQuotesModal` 5025–5038, `PlugInScheduleModal`, `PriceWithRobotModal` 5051–5070, `QuoteCompareModal` 5072–5097. Every modal is an extracted component; the tab only holds open flags and bumps `quoteNonce` after writes.
- **Coupling:** `QuoteCompareModal` reads `derivePricingWorkbench()` and the tax fallback (5088–5090); the modals cross-open each other through the tab's setters (Compare ↔ Plug-in ↔ Desk ↔ Compose); the Workbench header opens seven of them — the RFQ chip (`setRfqDeskOpen` / `setQuotesCompareOpen`, 2765–2766) and `PricingShareMenu`'s five doors (`setPrepareCopyOpen`, `setD22AuditOpen`, `setPlugInQuoteOpen`, `setPlugInScheduleOpen`, `setPriceWithRobotOpen`, 2818–2822).
- **Extraction status + risk:** inline wiring, **low-med** — a `usePricingQuoteDesk` hook (state + 3 effects + `rfqChip` + `openRobotChip`) and a `PricingQuoteModals` wrapper, with `derivePricingWorkbench` passed as a callback. Keep both one-shot URL doors exactly as they are (quirk 18).

### Region P7 — Share, print, CSV and the ★ chooser

- **State:** `packageSendOpen`, `starChooser`, `starChoice` (`'star' | 'viewed' | 'both'` since v2.3685), `starBusy`, `shareOverride` (`SharePricing & { also? }`).
- **Handlers:** `buildPricingPrintContext` 1741–1764, `loadScenarioInputs` 1779–1799 (four overlay tables + an alternate ★'s own `bids_count_rows`, v2.3685; also called by the cards row's `altVersionData` effect, 2119), `packageRowsFromInputs` 1801–1822 (**money math**: "same math as `useBidPricingRows.pricingPackageSource`"), `buildPricingPrintContextFor` 1823–1827, `printPricingPageWith` 1828–1830, `requestWithStarCheck` 1832–1840, `runStarAwareAction` 1842–1880, `printPricingPage` 1882–1884, `downloadPricingCsv` 1886–1888, `downloadPricingCsvWith` 1890–1906, `printAllPricingPages` 1908–1913 — the builders in [`lib/bidDocuments/pricingPage.ts`](../src/lib/bidDocuments/pricingPage.ts) own their own reads.
- **Render:** `PricingShareMenu` in the header; the chooser dialog 4920–4962; `PackageAndSendBidPricingModal` 5099–5119 (takes `shareOverride` or `pricingPackageSource`).
- **Extraction:** after the Stage-A scenario kernel, a `useStarAwareShare` hook (state + handlers) with the pricing inputs injected. **Medium.**

---

## BidsLaborTab — per-region dossiers

### Component contract (what the parent injects)

`BidsLaborTabProps` (71–164): **81 props**, 73 destructured (167–239). **Selection:** `selectedBidForCostEstimate` + `setSelectedBidForCostEstimate` (raw setter, distance write only) + `onSelectBid` / `onClose`, `bids`, the `onlyMyBids` trio; `selectedBidVersionId` (print context only). **Bid flow / row jump:** `onOpenBidFlowDoor`, `bidFlowDoorAllowed`, `rowJump`, `onRowJumpHandled`. **Engine data:** `costEstimate`, `costEstimateLaborRows` / `setCostEstimateLaborRows`, `costEstimateCountRows`, `panel` (`LaborTabPanel`, derived in the parent from `costEstimateResolve`), `purchaseOrdersForCostEstimate`, `costEstimateMaterialTotalRoughIn/TopOut/TrimSet`, `teamLaborDataForBids`, the **10 input pairs** `laborRateInput`, `drivingCostRate`, `hoursPerTrip`, `estimatorCostUseFlat` (boolean), `estimatorCostPerCount`, `estimatorCostFlatAmount`, `travelPeople`, `travelNights`, `travelMealsRate`, `travelHotelRate`, and the five direct-cost families `equipmentRows` … `otherRows` + setters (mapped from the engine's `costEstimate*Rows`). **Labor book:** `laborBookVersions`, `laborBookEntries`, `selectedLaborBookVersionId`, `laborBookEntriesVersionId` / `setLaborBookEntriesVersionId`, `loadLaborBookVersions`, `loadLaborBookEntries`. **Viewer (v2.3597):** `viewerUserId`, `viewerRole`, `selectedServiceTypeName`. **Other:** `openMaterialsModelSwitch` (used here), `costEstimatePOModalTaxPercent`, `costEstimateDistanceInput` / `setCostEstimateDistanceInput` (parent-owned because a parent effect writes it on load), `fixtureTypes` / `getOrCreateFixtureTypeId`, `ledgerPrefixMap`, `narrowViewport640`, `bidPreview`, `error` / `setError`, `loadBids`, `onEditBid`. **Typed and passed but never destructured (8):** `selectedServiceTypeId`, `setEstimatorCostUseFlat`, `setEstimatorCostPerCount`, `setEstimatorCostFlatAmount`, `setLaborBookEntries`, `setSelectedLaborBookVersionId`, `loadCostEstimateData`, `saveBidSelectedLaborBookVersion` (quirk 1).

Custom hooks (9): `useBidFlowFacts` 242, `useBidFlowReview` 243, `useBidFlowFold` 245, `useConfirmDialog` 246, `useToastContext` 247, `usePendingRowFlash` 249, `useBidCrewRate` 257, `useLaborBookCalibration` 259, `useJobBaselineRates` 261 (v2.3367).

### Region L0 — Card header, flow strip, materials toggle

`selectedBidForCostEstimate &&` card 867–1400: close ×, `BidFlowStrip` (fold 889–902), `BidWorkflowTabTitleWithPreview`, the Materials **By Stage / Combined** toggle (IIFE 945–1008) calling `openMaterialsModelSwitch('exact'|'rough', 'labor')` (the engine's confirm modal renders in the parent), then `panel === 'skeleton'` (1009–1023) · `'empty'` (1024–1027) · the table branch (1028–1398).

### Region L1 — Bid picker (no bid selected)

Mirror of P1: `costEstimateSearchQuery` 253, `bidsScopedForCostEstimate` → `filteredBidsForCostEstimate` → `costEstimateBidList` (848–850), search row 854–866, `BidPickerStandardList` 1401–1408.

### Region L2 — Autosave effect (the tab's one dangerous piece)

- **Location:** effect 369–446; 1.5 s debounce; **17 deps** (`costEstimate`, the 10 inputs, the 5 row families, `costEstimateLaborRows`).
- **Behavior:** [`buildCostEstimateAutosavePayload`](../src/lib/bids/costEstimateAutosavePayload.ts) parses the ten inputs (defaults: driving `0.70`, hours/trip `2`, estimator `$10`/count; travel people ≥1, nights ≥0) → the `cost_estimates` values or `{ ok: false, reason }`; a bad box sets `'invalid'` + `costEstimateAutosaveReason` ("Not saved — …", footer 1385–1397). On success: UPDATE `cost_estimates` (the three `purchase_order_id_*` passthroughs + the payload), then one UPDATE per row, sequentially, across `cost_estimate_labor_rows` (`laborRowAutosaveUpdate`) and the five direct-cost tables (`stageAmountRowAutosaveUpdate`) — N+1 by design — then `'saved'` for 2 s.
- **Per-cell save state (J11-F8):** `cellSaves` (277) + `markCell` / `cellA11y` / `cellSaveStyle` (278–295) over [`laborCellSaveState`](../src/lib/bids/laborCellSaveState.ts); the effect moves pending → saving (`beginLaborCellSaves`) → gone (`finishLaborCellSaves`). `markCell`, `cellA11y`, `cellSaveStyle` are passed into `BidsLaborNewView` and `BidsDirectCostsSection` — every region the autosave persists marks cells through them.
- **Owned local state:** `costEstimateAutosaveStatus`, `costEstimateAutosaveReason`, `cellSaves`.
- **Status:** Stage A done (v2.3292); moving the effect into the engine is behavior-affecting — a non-goal.

### Region L3 — The Old HOURS grid — retired v2.3598

The Old grid, *Apply matching Labor Hours*, the add-missing-fixture modal, `handleLaborBookVersionChange`, `LaborViewPills` and `lib/bids/laborView.ts` are gone (the per-device key `bids_labor_view_v1` is abandoned in place). L3b is the HOURS section.

### Region L3b — HOURS: the New view (`BidsLaborNewView`)

- **Render:** `{/* Manhours section */}` 1028–1116 — [`BidsLaborNewView`](../src/components/bids/BidsLaborNewView.tsx) (930 lines, 36 props, 1030–~1071), the labor-rate row (`laborRateInputRef`, `cellA11y('rate:labor', …)`, 1072–1085), the sub-sheet prints (1086–1115); then the **Labor total** IIFE (1117–1131: Σ `laborRowHours` × `parseFloat(laborRateInput)` — inline money math).
- **Tab-side wiring:** `laborRateInputRef` 254, `bidTeamLabor` memo 255, `useBidCrewRate` 257, `useLaborBookCalibration(selectedLaborBookVersionId, …)` 259, `useJobBaselineRates` 261 + `baselineWords` memo 262–266, `focusLaborRate` 267–272, `setCostEstimateLaborRow` 629–639 (optimistic patch; the L2 autosave persists it), row-jump props `rowDomId={laborRowDomId}` / `rowJumpFlashDomId` (1068–1069). All three data hooks run whenever a bid is selected.
- **The view owns:** the applied book's entries (its own `labor_book_entries` SELECT), queue drafts, fill/notice flags; its writes are queue Save → `cost_estimate_labor_rows` UPDATE + refetch, optional `labor_book_entries` UPDATE (alias append) / INSERT; Fill from the book; calibration **Set** / **Propose** (v2.3597: `calibrationSetPlan`; `labor_book_versions.proposed_*`).
- **Kernels:** [`laborBookMatch`](../src/lib/bids/laborBookMatch.ts) (exact → alias → code prefix; `laborRowPatchFromMatch`), [`laborRowHours`](../src/lib/bids/laborRowHours.ts) (`laborRowMultiplier` — sub 0 · task 1 · per 100 ft ÷100 · else count), `bidLaborSummary`, [`crewRate`](../src/lib/bids/crewRate.ts), [`laborBookCalibration`](../src/lib/bids/laborBookCalibration.ts), `bidBaselineRates`, `costEstimateDirectCosts`, `laborEntryProvenance`.
- **Prints:** `buildCostEstimatePrintContext` 798–816 → `printCostEstimatePage` 818–822, `printRoughInSubSheet` 824–828, `printTopOutSubSheet` 830–834, `printTrimSetSubSheet` 836–840, `printAllSubSheets` 842–846 over [`lib/bidDocuments/costEstimatePage.ts`](../src/lib/bidDocuments/costEstimatePage.ts).

### Region L4 — Cost-parameter boxes (Vehicle Travel / Lodging and Meals / Bid labor recorded)

- **Render:** Vehicle Travel 1132–1241, Lodging and Meals 1242–1356 (each collapsible with a summary line), the read-only *Bid labor recorded* line 1357–1371 (v2.3294 — the Estimators Time box is retired; `estimatorCost` is still computed by the kernel and written by the autosave, but no total, print or PDF adds it).
- **Owned local state:** `vehicleTravelCollapsed` 297, `lodgingCollapsed` 298, `updatingBidDistance` 362, `bidDistanceUpdateSuccess` 363, `travelZip` 364, `travelLookupStatus` 365, `travelLookupMessage` 366.
- **Derived:** `drivingSummaryFromInputs` (1140, 1221) and `travelSummaryFromInputs` (1250, 1339) from [`laborTabCostSummaries.ts`](../src/lib/bids/laborTabCostSummaries.ts) — string-input formulas kept apart from `bidCostCalc` on purpose (quirk 7).
- **Handlers:** `handleTravelPerDiemLookup` 566–601 (edge function **`gsa-per-diem`**; sets meals/hotel rates), `updateBidDistanceFromCostEstimate` 603–627 (UPDATE `bids.distance_from_office` → `loadBids` → swap into `setSelectedBidForCostEstimate` → re-seed the distance input; `bidUpdateRefused` guard).
- **Effect:** travel-ZIP prefill 450–454 via `lastZipInAddress` (quirk 12).
- **Status:** Stage A done v2.3565; the box components not built, by decision (~225 lines behind 18 props).

### Region L5 — Direct costs (one list with a kind chip, v2.3295)

- **Render:** [`BidsDirectCostsSection`](../src/components/bids/BidsDirectCostsSection.tsx) (158 lines) at 1372–1383 — `tables`, `canAdd`, `onAdd/onUpdate/onRemove(kind, …)`, the cell-save trio, and `driving={laborDrivingLine}`. It renders `<h3 id="labor-direct-costs">` (its line 62).
- **Tab-side:** 15 structural-clone handlers — `update/add/remove` × Equipment 643–666, Permit 669–692, Subcontractor 695–718, Waste 721–744, Other 747–764 + `removeOtherRow` 792–796 — behind `directCostHandlers: Record<DirectCostKind, …>` (767–773); add = immediate INSERT (`sequence_order = max+1`, `select().single()`), remove = optimistic filter + DELETE, update = state patch persisted by L2. `laborDrivingLine` (775–790) runs `computeBidCostBreakdown` with the string-box overrides.
- **Supabase:** the five `cost_estimate_*_rows` tables (INSERT/DELETE here; UPDATE via L2).
- **Status:** section extracted; the 15 handlers are the remaining dedup (extraction order item 7).

### Region L6 — Labor book panel + entry form (one book per trade, v2.3597)

- **Render:** [`BidsLaborBookPanel`](../src/components/bids/BidsLaborBookPanel.tsx) (303 lines) at 1409–1449, outside the selected-bid card (renders with or without a bid), with grouped props `book` and `entryForm` (the `versionForm` group went with the version picker in v2.3597).
- **Owned local state (13):** `laborEntryFormOpen` … `savingLaborEntry` 299–308 (incl. `laborEntryUnit`, `laborEntryKind`), `laborBookSectionOpen` 309, `resettingEntryId` 319, `userNames` 321.
- **Derived:** `tradeBook` 311 (`laborBookForTrade`), `panelBookId` 312 (`selectedLaborBookVersionId ?? tradeBook?.id`), `panelBook` 317, `bookRights` 318 (`laborBookRights(viewerRole)`), `namedIds` 322–327, `bookProposal` 345–350 (passed to L3b's `BidsLaborNewView` at 1055, not to the panel — so `userNames` and effect 328–343 serve L3b too).
- **Effects:** 313–316 pins the engine's `laborBookEntriesVersionId` to `panelBookId` (quirk 15); 328–343 reads `users` for `set_by` / `proposed_by` names.
- **Handlers:** `nameOf` 344, `resetEntryToRobot` 352–361 (writes `robot_*` hours back; the trigger clears the stamp), `openNewLaborEntry` 456–467, `openEditLaborEntry` 469–480, `closeLaborEntryForm` 482–493, `saveLaborEntry` 495–548 (fixture auto-create; aliases split/trim; `sequence_order = max+1`), `deleteLaborEntry` 551–564 (`confirmDialog`).
- **Supabase:** `labor_book_entries` (SELECT max-seq / INSERT / UPDATE / DELETE), `users` (SELECT), `fixture_types` via the parent helper.

---

## Test coverage and untested money math

No test mounts or names `BidsPricingTab` or `BidsLaborTab` (`devMcpComposites.test.ts` only names `useBidPricingEngine` in a string). The engine has one seam test, [`useBidPricingEngine.laborLoad.render.test.tsx`](../src/hooks/useBidPricingEngine.laborLoad.render.test.tsx) (4 cases: version-filtered count rows, lazy mint, mint-once, unresolved start). Coverage is therefore the extracted components' render tests plus the kernels:

| Area | Covered by (cases) | Not covered |
|---|---|---|
| Pricing money kernels | `bidPricingRowCalculations` 8, `bidTotalCostBreakdown` 5, `decoratePricingRows` 2, `resolvePricingEntry` 4, `pricingWorkbenchSolver` 16, `workbenchCellSolve` 6, `applyMarginPricing` 5, `profitBarLegend` 9, `bidTabCapture` 17, `takeoffOrderRounding` 6, `bidCostCalc` 19 | `submissionHides.ts` (no test file) |
| Pricing state kernels | `pricingLock` 4, `sentVsToday` 7, `pricingWriteTarget` 7, `bookEditBidOffer` 17, `bookEntryMatching` 4, `priceBookAssignSearch` 18, `workbenchPreviewStash` 9, `mapCountRowsByFixture` 5, `ownTakeoffAlternates` 9, `starredScenarioGuard` 7, `pickActivePricing` 8, `resolveCurrentPriceBookTemplateId` 22, `bidFlow` 16, `filterBidsForPicker` 2, `priceMatrixRequest` 11, `rfqDesk` 18, `pricingPage` 8 | `bidPackageLabel.ts` |
| Pricing components | render: `BidsPriceBookDrawer` 5, `PricingVersionFormModal` 3, `DeletePricingVersionModal` 2, `PricingEntryFormModal` 4, `PricingMarginBreakdownModal` 3, `PackageAndSendBidPricingModal` 2, `PricingShareMenu` 7, `PriceWithRobotModal` 3, `QuoteCompareModal` 3 + 4 | `GenerateUnitCostModal`, `AssignTakeoffPartModal`, `PricingCompositionBar`, `AdoptBidModal`, `SpecSectionAuditModal`, `PrepareFixtureCopyModal`, `RfqDeskModal`, `RfqComposeModal`, `PlugInQuotesModal`, `PlugInScheduleModal`, `BidFlowStrip`, `BidPickerStandardList`; hooks `usePriceMatrixRequests`, `useBidPricingRows`, `useBidCustomCosts` |
| Labor | render: `BidsLaborNewView` 12, `BidsLaborBookPanel` 4, `BidsDirectCostsSection` 3; kernels `costEstimateAutosavePayload` 6, `laborCellSaveState` 5, `laborTabCostSummaries` 5, `laborRowHours` 12, `laborBookMatch` 11, `laborEntryProvenance` 11, `costEstimateDirectCosts` 9, `crewRate` 5, `laborBookCalibration` 5, `bidBaselineRates` 2, `bidLaborSummary` 8, `extractZipFromAddress` 3, `laborTabLoadGate` 12, `bidTabRowJump` 7, `costEstimatePage` 10 | the L2 effect's write loop; the 15 direct-cost handlers; hooks `useBidCrewRate`, `useLaborBookCalibration`, `useJobBaselineRates` |
| Engine | the seam test 4; `pickActiveVersion` 25, `pricingResolve` 9, `legacyTemplatePricing` 6, `pickDefaultPriceBookTemplateId` 5, `bidTakeoffHelpers` 26, `bidAssignedCosts` 14, `updateGuard` 4, `utils/teamLabor`, `materialPOUtils` | `pricingUserPrefs.ts`, `loadBidAssignedCosts.ts`; every pricing/takeoff loader |

**Untested money math (risk flags, highest first):**

1. ~~**The scenario pricing adapter, four hand-rolled copies in the Pricing tab**~~ — **done v2.3853**: `lib/bids/scenarioPricingRows.ts` (`scenarioPricingRows` · `scenarioRevenue` · `scenarioPackageRows`, 10 tests) is the one projection; `packageRowsFromInputs`, the `altVersionData` effect, `copyPricesIntoViewedScenario`, `scenarioCardRevenues` (v2.3841) and both `useBidPricingRows` memos call it. Still hand-rolled outside this tab: `BidPackageMapModal`, `BidsCoverLetterTab`, `approvalPdf.ts` (×2), `pricingPage.ts` (×2) — a follow-up sweep.
2. **Per-fixture takeoff materials in the engine** — `loadPricingDataForBid` computes `pricingFixtureMaterialsFromTakeoff` inline (rough branch 1118–1130, exact branch via `expandTemplate` 1172–1214); every grid row's cost and margin reads it.
3. **The Workbench derive preamble** 2944–3134 — effective unit price (preview vs draft vs saved), `effRevenue` / `effProfit` / `effMargin`; the kernels it calls are tested, the composition is not.
4. **The Labor total IIFE** 1117–1131 and `laborDrivingLine` 775–790 (thin, over tested kernels).

---

## What must stay in the parent(s)

**In `Bids.tsx` (already there — keep it there):**
- The shared bid pointer + URL router (`setSharedBid`, `selectBidAndSyncUrl`, `closeSharedBidAndClearUrl`, the `?tab=` / `?bidId=` effects, the `cost-estimate` → `labor` slug normalization) and `bidTabRowJump` (the breakdown-jump target Labor lands on).
- `useBidPricingEngine`, `useBidPricingRows` and `useBidCustomCosts` invocations and their destructured threading; `pricingResolvePanel(…)` → Pricing's `resolvePanel`, `laborEmptyState(…)` → Labor's `panel`.
- `BidVersionPicker` above the Counts / Takeoff / Pricing / Cover-Letter tabs + `switchActiveVersion`; `BidsPricingCalculator` beside Pricing.
- `costEstimatePOModalTaxPercent` (shared with the Takeoffs PO modal), `costEstimateDistanceInput` (written by a parent load effect), the materials-model confirmation modal JSX, `BidFormModal` via `openEditBid`, `fixtureTypes` + `getOrCreateFixtureTypeId`, the `onlyMyBids` state (plain `useState`, not persisted), `canPackageAndSendBidPricing`, `estimatorUsers`, `profileName`, `ledgerPrefixMap`, `openBidFlowDoor` / `bidFlowDoorAllowed`.

**In each tab component (when sub-extracting regions):**
- The props contract — sub-components receive slices, never re-fetch engine data, never own `selectedPricingVersionId` / `selectedLaborBookVersionId` (setter callbacks only).
- `BidsPricingTab`: P0 (`guardPricingWrite`, the freeze chain, `writeUnitPriceOverrideRow`), `derivePricingWorkbench` (five callers), the `pricingRowsForGrid` consumption point, the service-type reset effect (975–991, clears P5), the outside-click effect (1006–1028) until it is split, `applyPendingBookOffer`, and the two one-shot URL doors (or move them together into the P6 hook, unchanged).
- `BidsLaborTab`: the L2 autosave effect and the `cellSaves` trio (every region it persists patches the same injected state and marks cells through the same functions), the 313–316 book-pin effect.

---

## Stage-A pure-logic inventory (extract to `lib/*` + tests before any component moves)

| Candidate | Currently | Target |
|---|---|---|
| **Scenario pricing adapter** (custom-price map + assignment projection + `submissionHiddenIdsForVersion` → `computeBidPricingRows` → rows / revenue) | **done v2.3853** — `lib/bids/scenarioPricingRows.ts`; the four tab sites, `scenarioCardRevenues` and both `useBidPricingRows` memos call it | tests cover the alternate ★ on its own rows, custom price vs override, hidden rows, fixed price, the cost side; left: the same shape in `BidPackageMapModal`, `BidsCoverLetterTab`, `approvalPdf.ts`, `pricingPage.ts` |
| `loadScenarioInputs` (the four overlay reads + the ★'s own count rows) | **done v2.3856** — `lib/bids/loadScenarioInputs.ts` takes `supabase` (the `loadBidAssignedCosts` move); `scenarioNeedsOwnRows` / `scenarioBidVersionIdOf` are the tested decision; the tab keeps a one-line `loadScenarioInputsFor` | left: the batch `.in()` twin in the workbench-cards effect reads every version at once and stays in the tab |
| Per-fixture takeoff materials | inline in the engine's `loadPricingDataForBid` (1118–1130, 1172–1214) | `lib/bids/fixtureMaterialsFromTakeoff.ts` + tests (rough with the rounding extra; exact by stage) |
| Labor total from inputs | inline IIFE 1117–1131 | one more function in `laborTabCostSummaries.ts` + a test |
| Clone re-key plan | `rekeyClonedPricingToVersion` 2236–2297 (uses the tested `mapCountRowsByFixture`, then client-side UPDATE/DELETE per child) | the plan (keep / drop per child) as a pure function; the writes belong in an RPC (quirk 20), not a kernel |
| ~~Pricing cost-breakdown totals~~ | done v2.3292 | `lib/bids/bidTotalCostBreakdown.ts` (`computeBidCostBreakdown`, `directCostRowsFromTables`) + tests — the Workbench, Pricing print/CSV, the Labor page print and the approval PDF read it |
| ~~Grid row decoration~~ · ~~`resolvePricingEntryForCountRow`~~ · ~~bid-picker filter~~ · ~~travel-ZIP extraction~~ | done v2.3546 | `decoratePricingRows`, `resolvePricingEntry`, `filterBidsForPicker`, `lastZipInAddress` + tests |
| ~~Autosave parse/validate/payload~~ | done v2.3292 | `costEstimateAutosavePayload.ts` + tests |
| ~~Labor-book matching~~ | done (Labor refresh) | `laborBookMatch.ts` + tests; apply-hours retired v2.3598 |
| ~~Driving / travel display formulas~~ | done v2.3565 | `laborTabCostSummaries.ts` + tests |
| Already done (don't redo): the `laborRowHours` family, `bidCostCalc`, `pickActivePricing` / `nextSortOrder`, `resolveCurrentPriceBookTemplateId`, `computeBidPricingRows`, `pricingWorkbenchSolver`, `workbenchCellSolve`, `applyMarginPricing`, `profitBarLegend`, `bookEditBidOffer`, `pricingLock`, `sentVsToday`, the `bidDocuments/pricingPage` + `costEstimatePage` builders (all with colocated tests); `submissionHides.ts` exists but has **no** test | `lib/bids/*`, `lib/bidDocuments/*` | — |

---

## Preserve-quirks list (odd but load-bearing — do not "fix" during the move)

Numbers are stable; closed quirks stay struck so older references still resolve.

1. **Dead props.** `openMaterialsModelSwitch` on `BidsPricingTab` is typed and passed but never destructured; `BidsLaborTab` has eight such props (L-contract). Remove them in their own small PR, not as part of a region move.
2. **Tax fallback duality:** every print/package/derive site builds `parseFloat(costEstimatePOModalTaxPercent || '8.25') || 0` — empty → 8.25, junk → 0. Pricing: 1760, 1814, 2614, 5088; Labor: 813. Preserve exactly.
3. **Price writes (amended):** `writeUnitPriceOverrideRow` (1162–1203) has three branches — an existing assignment gets `unit_price_override` and the competing `bid_count_row_custom_prices` row is deleted; else a resolvable book entry gets a new assignment carrying the override (custom row deleted); else the custom-price row is upserted, or deleted for `null`. A typed price that is NaN, ≤ 0 or unchanged writes nothing (`commitWorkbenchTypedPrice` 2550–2557); the old "within 0.001 of the book clears the override" path is gone.
4. ~~Autosave stuck on "Saving…"~~ — closed v2.3292 (`'invalid'` + reason).
5. **`onSelectPriceBookTemplate` reuse rule (1714–1739):** reuses the active Version's copy whose lineage **root** (`resolvePriceBookTemplateRoot`, v2.2396) is the picked template and whose `bid_version_id` matches (null-safe), else clones; it calls `rememberLastPriceBookTemplate` on every pick, while `savePricingVersion` calls it only when cloning from a template (duplicating a bid pricing does not).
6. ~~Apply matching Labor Hours ignores `alias_names`~~ — closed v2.3598 with the Old grid; the New view matches aliases and code prefixes.
7. **Cost-formula duality:** Labor computes driving/travel from the *string inputs* (`laborTabCostSummaries`, `laborDrivingLine`'s overrides); Pricing computes the same figures from the *persisted `cost_estimates` row* via `computeBidCostBreakdown`. They can disagree while an edit is unsaved. Preserve both paths.
8. **`#labor-direct-costs` is now vestigial:** the id lives in `BidsDirectCostsSection.tsx` (line 62) and `Bids.tsx`'s `scrollToLaborDirectCosts` effect still polls for it (20 × 50 ms), but nothing sets `scrollToLaborDirectCosts` true any more (only the effect's own `false` writes). Keep the id (a test id sits on the wrapper) until the parent's state + effect are removed in the dead-code PR.
9. **Sequential per-row autosave writes** (N+1) across 6 tables, and optimistic direct-cost remove (state filters before the DELETE resolves; no revert beyond `setError`).
10. **Uncosted revenue counts as 100 % margin** — rows with revenue but no Takeoffs cost show "—" margin; `decoratePricingRows` returns `uncostedRevenueRows` / `uncostedRevenue` and the totals include them at full profit.
11. **Delete-pricing-version recovery (1331–1380):** type-the-exact-name confirm; a scenario some packet's ★ is built on never deletes (`versionStarringScenario`, BP384); if the deleted version was active, `pickActivePricing({ savedVersionId: null, … })` re-activates another, entries clear when none remain, then persist + `loadBids`.
12. **Travel ZIP prefill takes the LAST 5-digit match** in `customers.address` (`lastZipInAddress`), resets per bid, never persists.
13. ~~`deleteLaborVersion` non-null assertion~~ — closed v2.3597 (version form retired).
14. ~~Raw hexes in hover handlers~~ — closed: the remaining `onMouseEnter/Leave` handlers use tokens (`var(--bg-subtle)`); the L1 highlight went with `BidPickerStandardList`.
15. **Two labor-book selections, now pinned together by the tab:** the engine still owns `selectedLaborBookVersionId` (the bid's book) and `laborBookEntriesVersionId` (what the panel loads); since v2.3597 the tab's effect 313–316 sets the latter to `panelBookId`. Do not merge the engine state; do not drop the effect.
16. **The first price freezes the bid.** Every price write ends in `freezeSharedPricingAfterWrite`, which clones a shared template into a bid-owned copy (RPC) and re-activates it — a write can therefore change `selectedPricingVersionId` under the caller. Keep the write → reload → freeze order.
17. **Dead state kept alive:** `const templatesMode = true` (320) keeps the `templatesMode ? … : …` ternaries (1035–1036, 1067, 1072, 1078, 1090, 1566, 1625) and `PricingVersionFormModal`'s `templatesMode` prop alive, while the engine's own `templatesMode` state (164) is returned and never read; `addPricingMenuOpen` (365) is never set true and `[data-add-pricing-menu]` is never rendered; `setWbTargetSolveResult` (524) is write-only; `assignTakeoffRow` (460) and `generateUnitCostModalParams` (732) are only ever set back to `null` (their openers went with the Old views, v2.2707), so `AssignTakeoffPartModal` and `GenerateUnitCostModal` never open and `updateUnitPriceOverride` (1205–1220) is reachable only from that dead modal — restore or remove, the owner's call. Removal is behavior-neutral but belongs in the dead-code PR, not a move.
18. **Two one-shot URL doors inside the tab:** `?robot=price&bidId=` (effect 758–768, `useSearchParams`, `replace: true`) and `?d22audit=1` (effect 857–865, `window.history.replaceState`, mount-only). Both need `canPackageAndSendBidPricing`. Keep the two mechanisms as they are.
19. **Pricing locks per session:** `revisedBidIds` lives in sessionStorage (`readRevisedBids` / `writeRevisedBid`), never on the bid — a reload in a new tab re-locks.
20. **`rekeyClonedPricingToVersion` is not atomic:** per-child UPDATE/DELETE across three tables from the client; a mid-run error leaves a half-rekeyed clone (the error surfaces via `setError`).

---

## Recommended extraction order (value ÷ risk)

These files are already extracted tabs; this is a **sub-decomposition** — every step keeps the props contract and ships behind green `npm run typecheck && npm run lint && npm test`. The 2026-09-17 train (P3 v2.3547, L6 v2.3550, P4 v2.3563, P5 v2.3564, L4 Stage A v2.3565, plus the v2.3546 kernels) is done; the order below re-ranks what is left against the state clusters above.

| # | Move | Takes out of the tab | Coupling left behind | Risk | Why here |
|---|---|---|---|---|---|
| 1 | **Stage A — `scenarioPricingRows` kernel** — **done: the kernel v2.3853, `loadScenarioInputs` to `lib/bids` v2.3856** | ~60 lines, 0 state | none | low | untested money path hand-rolled four times, with a shipped \$0 bug; unblocks 4 and 9 |
| 2 | **Dead-code PR** — quirks 1, 8, 17 (tab + engine + the `Bids.tsx` scroll state/effect) | 2 tab state, 1 effect arm, the engine's `templatesMode` pair, 9 dead props, the parent's scroll state + effect; plus the two unreachable modal wirings (quirk 17) once the owner picks restore vs. remove | none | nil | behavior-neutral; shrinks every later diff |
| 3 | **P6 → `usePricingQuoteDesk` + `PricingQuoteModals`** | 12 state, 3 effects, 2 hooks, ~280 lines | `derivePricingWorkbench` as a callback; the header's seven openers (the RFQ chip's two setters + `PricingShareMenu`'s five doors) | low-med | largest self-owned cluster; all 8 modals already components; add render smokes for the six untested ones |
| 4 | **P7 → `useStarAwareShare`** (after 1) | 5 state, ~170 lines | the pricing inputs (~15 values) + `pricingPackageSource` | med | the ★/both logic is the newest churn (v2.3685) |
| 5 | **P2 small cuts** — `PricingMarginHistory` (history block 3985–4083 + effect 1969–1987) and `WorkbenchHelpCard` (2858–2943 + tour steps 2000–2037) | 3 state, 1 effect, ~210 lines | history: `effMargin` as a prop; help card: the header's "?" opener (`setWbInfoOpen`, 2747), `gcNameForVersion` / `shortGc`, `priceBookVersions` / `bidVersions`, a `setAndRememberWbSolverOpen` callback | low | each block owns its state (only the help card's open flag is set from outside, by the header) |
| 6 | **`PricingProfitBar`** (4491–4669) | 4 state, ~180 lines | `conc`, `eff`, the `jumpToRow` writes to the grid filters + `wbFlashRowId` (stays in the tab); split effect 1006–1028 first | low-med | the old "cheap cut", now measured |
| 7 | **Labor: one direct-cost handler factory + the Labor-total kernel** | 15 clone handlers → 1 factory; ~120 lines | the five setters + `setError` | low | `directCostHandlers` (767–773) is already the seam; brings the handlers under test |
| 8 | **`useMarginBrush`** | 6 state, 2 refs, 1 effect, ~150 lines | writes `wbPriceDrafts` / `wbSolveLanding`; injected write + freeze chain; reads `wbLocks`; `endBrushStroke` reads `wbPreview` / `wbPreviewVeto` and calls `setAndStashWbPreview` (a sweep drops its rows from a pending preview); `armBrush` folds the solver (`wbSolverOpen`, `setAndRememberWbSolverOpen`) | med | the brush strip + the grid's capture handlers both read it |
| 9 | **P2 cards row** (after 1) | 12 state, 3 effects (878–888, 1921–1966, 2086–2147), ~320 lines of handlers + 431 of JSX | version switching (`onSwitchBidVersion`, `reloadBidVersions`, `bidVersions`), three RPCs, the freeze; `gcNameForVersion` / `shortGc` over `gcNamesById` (also called by the "?" card, the G1 donor and `confirmDeletePricingVersion`); the rename-or-delete card opens P5's delete modal | med-high | largest block; needs the kernel from 1 for its two revenue effects |
| 10 | **Solver strip + grid rows** | the 18-value solver cluster + assign search | everything else in P2 | high | unchanged decision: only as PR 1 of a Workbench feature train — a `useWorkbenchSolver` hook owning the cluster with `derivePricingWorkbench` injected. Residual in `to-dos/decomposition-residuals.md` |
| 11 | **Shared `BidClusterBidPicker` sweep** | ~15 lines × nine tabs | — | low | unchanged: a mechanical sweep from fresh `main` on a quiet Bids day (`CLAUDE.md` → mechanical sweeps merge alone) |

L4's box components stay unbuilt by decision (~225 lines behind 18 props).

**Explicit non-goals:** moving the L2 autosave into the engine, merging the two labor-book selections, collapsing the `setSharedBid` selections, moving the freeze chain or the pricing lock out of the tab, making `rekeyClonedPricingToVersion` atomic as part of a move (that is an RPC + migration), and any UX/schema change — this map is behavior-preserving inventory only, per [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md).
