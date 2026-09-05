# Bids Pricing + Labor Tabs Architecture Map

---
file: docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 sub-decomposition map (per PAGE_DECOMPOSITION_PLAYBOOK.md) for the two largest already-extracted Bids workflow tabs — src/components/bids/BidsPricingTab.tsx (~2,610 lines) and src/components/bids/BidsLaborTab.tsx (~2,365 lines) — which stay coupled through the shared useBidPricingEngine hook. Inventories every logical region's state, handlers, supabase tables/RPCs, and coupling so the next extraction can start without re-reading either file.
audience: Developers, AI Agents
last_updated: 2026-09-05
sections:
  - What this surface is
  - The shared substrate
  - Master summary table
  - "BidsPricingTab — per-region dossiers"
  - "BidsLaborTab — per-region dossiers"
  - What must stay in the parent(s)
  - Stage-A pure-logic inventory
  - Preserve-quirks list
  - Recommended extraction order
---

## What this surface is

Two components that were themselves **Stage-B extractions from `Bids.tsx`** (2026-05-30, see [`BIDS_TABS_ARCHITECTURE.md`](./BIDS_TABS_ARCHITECTURE.md) §Recommended extraction order item 7) and have since kept growing:

| File | Lines (2026-07-29) | Renders behind | Selection prop |
|---|---|---|---|
| [`src/components/bids/BidsPricingTab.tsx`](../src/components/bids/BidsPricingTab.tsx) | **2,610** | `activeTab === 'pricing'` in [`Bids.tsx`](../src/pages/Bids.tsx) (search `<BidsPricingTab`) | `selectedBidForPricing` |
| [`src/components/bids/BidsLaborTab.tsx`](../src/components/bids/BidsLaborTab.tsx) | **2,365** | `activeTab === 'labor'` in `Bids.tsx` (search `<BidsLaborTab`) | `selectedBidForCostEstimate` |
| [`src/hooks/useBidPricingEngine.ts`](../src/hooks/useBidPricingEngine.ts) (the seam, for reference) | 1,562 | consumed by `Bids.tsx`, destructured, threaded down as props | — |

Both are the classic post-extraction shape: **all data state lives upstream** (the engine hook + `Bids.tsx`), so what's left inside is ~35 (`BidsPricingTab`) / ~32 (`BidsLaborTab`) `useState` of pure UI/modal/form state, a large JSX body, and CRUD handlers that write supabase directly and then call engine loaders to refresh. That makes this a **medium-risk, mostly-mechanical sub-decomposition**: the regions below are separable panels/modals, not tangled data engines. The counterpart already-done reference is `BidsTakeoffTab` (5,641 lines), flagged in the playbook as the other sub-decomposition candidate.

Post-extraction churn (grep `docs/RECENT_FEATURES.md`; never read it whole): the Pricing tab keeps absorbing features — `GenerateUnitCostModal` (percent-of-total unit price, ~14 mentions), `PackageAndSendBidPricingModal` ("Share" flow, ~4 mentions), `AssignTakeoffPartModal` (assign takeoff cost from the grid) — and the Labor tab gained the Travel (Lodging & Meals) section with the `gsa-per-diem` edge-function lookup (~5 mentions) and the five Direct-Costs row families. **Pricing is the higher-churn file**; expect line numbers below (anchored "as of 2026-07-29") to rot — search the symbol.

Behavior/workflow docs live elsewhere (`PROJECT_DOCUMENTATION.md`, `GLOSSARY.md`); this map is coupling/refactor-oriented only.

---

## The shared substrate

This surface has **both** kinds of shared substrate the playbook asks about, and both are already extracted — the constraint on any further decomposition is *respecting* them, not building them:

1. **The shared bid pointer (selection).** `Bids.tsx` owns `setSharedBid` / `selectBidAndSyncUrl(bid, tab)` / `closeSharedBidAndClearUrl` and the `?tab=…&id=…` URL router. Each tab receives its facet of the pointer as a controlled prop (`selectedBidForPricing`, `selectedBidForCostEstimate`) plus `onSelectBid` / `onClose` callbacks. **No region extracted from these tabs may own selection**; it flows down as props. Quirk: `BidsLaborTab` uniquely also receives the raw setter `setSelectedBidForCostEstimate` (used only by `updateBidDistanceFromCostEstimate` to swap in the freshly reloaded bid row) — preserve that narrow write path.
2. **The shared data engine.** [`useBidPricingEngine`](../src/hooks/useBidPricingEngine.ts) (invoked once in `Bids.tsx`, destructured) owns every piece of pricing/cost-estimate data both tabs render: `pricingCountRows`, `pricingCostEstimate`, `pricingLaborRows`, the five `pricing*Rows` direct-cost mirrors, `priceBookVersions` / `templatePriceBookVersions` / `priceBookEntries`, `bidPricingAssignments` / `bidCountRowCustomPrices` / `bidCountRowSubmissionHides`, `selectedPricingVersionId`, `selectedBidVersionId` (Bid Versions), `costEstimate`, `costEstimateLaborRows`, `costEstimateCountRows`, the `costEstimate*Rows` direct-cost families, the labor-book state, `teamLaborDataForBids`, and the loaders (`loadBidPricings`, `loadPriceBookEntries`, `loadBidPricingAssignments`, `loadPricingDataForBid`, `loadCostEstimateData`, `loadLaborBookVersions/Entries`, `saveBidSelected*Version`, `openMaterialsModelSwitch`/`confirmMaterialsModelSwitch`). Its load effects key off `activeTab` + the selection props — an extracted sub-region must keep calling the injected loaders, never re-fetch on its own schedule. **Load order (v2.2847):** count rows are per Version and the loaders read the active version from a bid-tagged ref, so every cost-estimate load must run only after that ref belongs to the bid on screen. The Labor/Takeoffs effect in `Bids.tsx` gates on `shouldLoadCostEstimate` ([`lib/bids/laborTabLoadGate.ts`](../src/lib/bids/laborTabLoadGate.ts)) and resolves the version itself first (`loadBidVersions` → `pickActiveVersion` → `setSelectedBidVersionId`), mirroring the Counts effect; `costEstimateResolve` (same shape as `pricingResolve`) is the lifecycle the Labor tab's skeleton reads. **Lazy mint:** `loadCostEstimateData` mints a `cost_estimates` row only when the resolved version has count rows (the HOURS rows need the parent; Pricing reads them) — a bid with no fixtures gets no row until the first write (`ensureCostEstimateForBid` from PO creation, or the sync after the first fixture is added).
3. **The shared calc kernel.** [`useBidPricingRows`](../src/hooks/useBidPricingRows.ts) (also invoked in `Bids.tsx`) wraps [`computeBidPricingRows`](../src/lib/bidPricingRowCalculations.ts) into three memos; `BidsPricingTab` receives `pricingRowsForGrid` + `pricingPackageSource` as props and `BidsCoverLetterTab` receives `coverLetterPricingRows` — the grid, the Share modal, and the cover letter are single-sourced. Any sub-extraction of the grid must keep consuming `pricingRowsForGrid` (never re-run the kernel locally).

The cross-tab data flow (unchanged from the Bids map): Counts → Takeoffs (materials \$) → Labor (`cost_estimates` + labor rows) → **Pricing** (margin grid) → Cover Letter. Pricing's grid deep-links back into Labor (`onNavigateToLabor`, `onNavigateBidToTab(bid,'labor'|'takeoffs')`, `onNavigateToLaborDirectCosts` → parent sets `scrollToLaborDirectCosts` and scrolls to the DOM id **`labor-direct-costs`** that `BidsLaborTab` renders — an id contract between the two files).

---

## Master summary table

Line ranges are as of 2026-07-29 (v2.94x era) and rot; anchors are the symbols named in each dossier.

| Region | File | Lines est. | Coupling | Risk | Status |
|---|---|---|---|---|---|
| Bid picker (search + `MyBidsToggle` + table) | Pricing ~221, ~942–968, ~2086–2112; Labor ~191, ~934–959, ~1978–2009 | ~75 each | low (needs `bids`, `ledgerPrefixMap`, `onlyMyBids`, `onSelectBid`) | low | inline, duplicated across 5 cluster tabs |
| Pricing grid + cost-breakdown card | `BidsPricingTab` ~969–1928 | ~960 | high (consumes `pricingRowsForGrid` + 20 engine props) | med | inline |
| Margin-breakdown modal (`pricingBreakdownRow`) | `BidsPricingTab` ~1930–2069 | ~140 | none (self-contained payload) | low | inline |
| Price Book panel (Pricings/Templates) | `BidsPricingTab` ~2113–2341 | ~230 | med (engine versions/entries + `templatesMode`) | med | inline |
| Pricing version form + delete + entry form modals | `BidsPricingTab` ~2342–2569 | ~230 | med (write `price_book_versions/entries`, re-activate logic) | med | inline (opened only from this tab) |
| Extracted-modal wiring (`GenerateUnitCostModal`, `AssignTakeoffPartModal`, `PackageAndSendBidPricingModal`) | `BidsPricingTab` ~2070–2085, ~2572–2607 | ~55 | low | — | **already extracted components** |
| HOURS section (labor rows + labor-book select + sub-sheet prints) | `BidsLaborTab` ~1077–1299 | ~230 | med (engine `costEstimateLaborRows` + loaders) | med | inline |
| Cost-parameter boxes (Vehicle Travel / Lodging & Meals / Estimators Time) | `BidsLaborTab` ~1300–1602 | ~300 | med (7 engine string-input pairs + parent `costEstimateDistanceInput`) | med | inline |
| Direct Costs ×5 row sections (equipment/permits/sub/waste/other) | `BidsLaborTab` ~1603–1963 (+ handlers ~754–883) | ~490 | low-med (rows + setters injected; autosave persists) | low | inline, 5 structural clones |
| Labor autosave effect | `BidsLaborTab` ~226–361 | ~135 | high (writes 7 tables, deps on 16 props) | med | inline (deliberately left in tab at extraction) |
| Labor Book panel + version/entry modals | `BidsLaborTab` ~2010–2259 | ~350 | med (engine book state + loaders) | med | inline |
| Add-missing-fixture modal + apply-hours flow | `BidsLaborTab` ~611–746, ~2260–2362 | ~240 | med (re-runs `applyLaborBookHoursToEstimate`) | med | inline |

---

## BidsPricingTab — per-region dossiers

### Component contract (what the parent injects)

Props type `BidsPricingTabProps` (top of file). Grouped: **selection** `selectedBidForPricing` + `onSelectBid`/`onClose`; **engine data** `priceBookVersions`, `priceBookEntries` (+`setPriceBookEntries`), `templatePriceBookVersions`, `templatesMode`/`setTemplatesMode`, `bidPricingAssignments`, `bidCountRowCustomPrices`, `bidCountRowSubmissionHides`, `selectedBidVersionId`, `selectedPricingVersionId`/`setSelectedPricingVersionId`, `pricingCountRows`, `pricingCostEstimate`, `pricingLaborRows`, `pricingEquipmentRows`/`pricingPermitRows`/`pricingSubcontractorRows`/`pricingWasteRows`/`pricingOtherRows`, `pricingMaterialTotalRoughIn/TopOut/TrimSet`, `pricingLaborRate`, `pricingFixtureMaterialsFromTakeoff`, `teamLaborDataForBids`; **engine loaders** `loadTemplatePriceBookVersions`, `rememberLastPriceBookTemplate`, `loadBidPricings`, `loadPriceBookEntries`, `loadBidPricingAssignments`, `reloadPricingForBid` (= the engine's `loadPricingDataForBid`), `saveBidSelectedPriceBookVersion`; **shared calc** `pricingRowsForGrid`, `pricingPackageSource` (from `useBidPricingRows`); **parent-owned shared state** `costEstimatePOModalTaxPercent` (shared with Takeoffs' PO modal), `canPackageAndSendBidPricing`, `estimatorUsers`, `ledgerPrefixMap`, `profileName`, `fixtureTypes` + `getOrCreateFixtureTypeId`, `onlyMyBids`/`setOnlyMyBids`/`isMyBid`, `narrowViewport640`, `bidPreview`, `error`/`setError`, `selectedServiceTypeId`, `loadBids`; **navigation** `onEditBid`, `onNavigateToLabor`, `onNavigateBidToTab`, `onNavigateToLaborDirectCosts`. Quirk: `openMaterialsModelSwitch` is declared in the props type and passed by the parent but **never destructured or used** — a dead prop left from the extraction (the materials toggle lives on the Labor/Takeoffs tabs).

The parent also renders **`BidVersionPicker` above this tab** (not inside it) when a bid is selected — version switching stays parent-owned.

### Region P1 — Bid picker (no bid selected)

- **Render location:** `!selectedBidForPricing &&` search row (~957) and bid table (~2086–2112).
- **Owned local state:** `pricingSearchQuery`.
- **Derived:** `bidsScopedForPricing` (`onlyMyBids ? bids.filter(isMyBid) : bids`), `filteredBidsForPricing` (project/address/customer/GC name + `bidNumberMatchesQuery(b, q, ledgerPrefixMap)`).
- **Sub-components:** `MyBidsToggle`, `BidProjectCell` (both extracted).
- **Supabase:** none.
- **Extraction:** trivially separable, but the *same* picker (state var renamed) exists in `BidsLaborTab` (`costEstimateSearchQuery`), `BidsCountsTab`, `BidsTakeoffTab`, `BidsCoverLetterTab`. Best done once as a shared `BidClusterBidPicker` component — see extraction order.

### Region P2 — Selected-bid pricing grid + cost breakdown

- **Render location:** `selectedBidForPricing &&` card ~969–1928. Header (title via `BidWorkflowTabTitleWithPreview`, Share/CSV/Print/Review buttons, close ×), Cost Model/Price Model toggle, the price-book template `<select>`, "Apply Matching Price Book Entries" button, then the big grid IIFE behind `selectedPricingVersionId && pricingCountRows.length > 0 && pricingCostEstimate` (~1196).
- **Owned local state:** `pricingViewModel` (`'cost' | 'price'`), `pricingAssignmentSearches` (per-row search text map), `pricingAssignmentDropdownOpen`, `unitPriceEditValues` (per-row in-flight edit strings), `savingUnitPriceOverride`, `savingPricingAssignment`, `assignTakeoffRow`, `generateUnitCostModalParams`, `packageSendOpen`, `pricebookSwitchBusy`.
- **Cross-tab/shared state:** everything in the contract above; notably the grid math itself is **not** local — `pricingRowsForGrid` comes from `useBidPricingRows` in the parent.
- **Derived (inline in the IIFE):** `totalMaterials`, `totalLaborHours` (Σ `laborRowHours`), `laborCost`, `drivingCost` (trips × `costEstimateDrivingRate` × `distance_from_office`), `estimatorCost` (`costEstimateEstimatorCost`), `travelCost` (`computeTravelCost`), the five `sumEquipmentRows(...)` direct-cost sums, `teamLaborCost` (from `teamLaborDataForBids` by bid id), `totalCost`, decorated `rows` (join of `pricingRowsForGrid.rows` × `pricingLaborRows` × `bidCountRowCustomPrices` × `assignmentsForVersion` × `pricingFixtureMaterialsFromTakeoff` + `marginFlag`), `uncostedRevenueRows`/`uncostedRevenue` (Sale Price but no Takeoffs cost → warning row; treated as 100% margin), module-level `MARGIN_FLAG_COLOR`, `addPricingMenuItemStyle`.
- **Handlers:** `savePricingAssignment`, `removePricingAssignment`, `togglePricingAssignmentFixedPrice`, `togglePricingRowOmitFromSubmission`, `updateUnitPriceOverride` (3-branch write: assignment override / new assignment / `bid_count_row_custom_prices`; clears the competing custom-price row), `resolvePricingEntryForCountRow`, `pricingRowCanToggleOmitFromSubmission`, `onSelectPriceBookTemplate` (toolbar dropdown: reuse the version's existing clone matched on `source_version_id` + `bid_version_id`, else `cloneTemplateIntoBidAndActivate`), `handlePricingVersionChange`, `attachAndActivateNewBidPricing` (stamps `bid_version_id` on a new pricing, activates + persists), `buildPricingPrintContext` → `printPricingPage` / `printAllPricingPages` / `downloadPricingCsv` (delegate to [`lib/bidDocuments/pricingPage.ts`](../src/lib/bidDocuments/pricingPage.ts), which owns its own supabase reads), `openRowBreakdown`.
- **Supabase tables/RPCs (direct from this region):** `bid_pricing_assignments` (INSERT/UPDATE/DELETE), `bid_count_row_custom_prices` (INSERT/UPDATE/DELETE), `bid_count_row_submission_hides` (INSERT/DELETE), `price_book_versions` (UPDATE `bid_version_id` in `attachAndActivateNewBidPricing`), RPC **`clone_price_book_version_to_bid`**. Reads happen via injected engine loaders.
- **Sub-components:** `GenerateUnitCostTriggerIcon` + `GenerateUnitCostModal`, `AssignTakeoffPartModal`, `PackageAndSendBidPricingModal`, `BidWorkflowTabTitleWithPreview`, `MyBidsToggle` (all **extracted**); the assignment search-dropdown and the unit-price editor are inline.
- **External coupling:** navigation callbacks into Labor/Takeoffs (`onNavigateBidToTab`, `onNavigateToLaborDirectCosts` → parent's `scrollToLaborDirectCosts` effect → `#labor-direct-costs` in `BidsLaborTab`); `AssignTakeoffPartModal.onAssigned` calls `reloadPricingForBid`; toast via `useToastContext`.
- **Extraction status + risk + approach:** inline; **medium risk** — the JSX is large but the data flow is one-directional (props in, supabase writes out, loader refresh). Stage A first: lift the cost-breakdown totals assembly and the row-decoration join into `lib/bids/*` pure functions with tests (see Stage-A inventory) — the same totals math is re-implemented in `pricingPage.ts`'s CSV builder and `approvalPdf.ts`, so a shared kernel is a triple dedup. Then the grid can move to a `BidsPricingGrid` component taking the decorated rows + the write handlers as props, or stay put — the modals and panel below are the cheaper wins.

### Region P3 — Margin-breakdown modal

- **Render location:** `pricingBreakdownRow && (...)` ~1938–2150.
- **Owned local state:** `pricingBreakdownRow: PricingBreakdownRow | null` (a **self-contained snapshot payload** — fixture, count, unitPrice, isFixedPrice, revenue, materialsBeforeTax, taxAmount, taxPercent, laborCost, cost, margin, materialsFromTakeoff — deliberately decoupled from live state).
- **Layout (v2.1324):** two-column money table — every line (Sale Price, Materials, Tax, Labor, Our cost, Profit) shows **Per unit** (`total ÷ count`, derived in-render) and **Total**; the Per-unit column hides when `count ≤ 1`, fixed-price rows show "—" per unit with a not-multiplied note, and Margin renders as a footer band tinted by `marginFlag` (green/yellow/red theme tint tokens).
- **Supabase:** none. **Coupling:** none beyond the payload.
- **Extraction:** **lowest-risk component move in either file.** New `PricingMarginBreakdownModal({ row, onClose })`; the `PricingBreakdownRow` type moves with it. Pure cut/paste.

### Region P4 — Price Book panel ("This version's prices" / "Template library")

- **Render location:** collapsible section behind `priceBookSectionOpen` ~2113–2341 (renders in **both** selected-bid and no-bid modes).
- **Owned local state:** `priceBookSectionOpen`, `priceBookSearchQuery`, `editingTemplateId`, `templateEntries` (template editing is intentionally isolated from the bid's active Pricing so the grid never flickers), `addPricingMenuOpen`.
- **Cross-tab/shared state:** `templatesMode`/`setTemplatesMode` (engine-owned; effectively only this tab uses it), `templatePriceBookVersions`, `priceBookVersions`, `priceBookEntries`, `selectedPricingVersionId`.
- **Derived:** `panelVersions` / `panelVersionId` / `panelEntries` (templates-vs-pricings resolution), `activeBidPricing` / `isBidOwnedPricing` / `canEditPanelEntries`, `currentPriceBookTemplateId` (via [`resolveCurrentPriceBookTemplateId`](../src/lib/bids/resolveCurrentPriceBookTemplateId.ts) — already Stage-A'd with tests).
- **Handlers:** `loadTemplateEntries` (direct `price_book_entries` SELECT with `fixture_types(name)` join + numeric-aware sort), `reloadPanelEntries`, `reloadPanelVersions`, `selectPanelVersion`, `openAddTemplate` / `openAddBlankPricing` / `openClonePricing` (set `pricingFormMode` for the shared version form).
- **Effects:** templates-mode entry loader (`templatesMode` / `templatePriceBookVersions` change → default to first template, load entries).
- **Supabase:** `price_book_entries` SELECT (template side); everything else through P5's modals.
- **Extraction status + risk + approach:** inline; **medium risk** only because it shares the version-form/delete/entry modals (P5) — extract P4+P5 together as one `BidsPriceBookPanel` component (~460 lines out). `templatesMode` stays engine-owned (passed down), `selectedPricingVersionId` stays a controlled prop.

### Region P5 — Version form, delete-version, and entry form modals

- **Render location:** `pricingVersionFormOpen` (~2342–2395), `deletePricingVersionModalOpen` (~2396–2486, type-the-name-to-confirm), `pricingEntryFormOpen` (~2487–2569). All opened **only from this tab** (playbook: modals opened from one tab move with it).
- **Owned local state:** `pricingVersionFormOpen`, `editingPricingVersion`, `pricingVersionNameInput`, `savingPricingVersion`, `pricingFormMode` (`'template' | 'pricing-blank' | 'pricing-clone'`), `pricingCloneSourceId`, `deletePricingVersionModalOpen`, `pricingVersionToDelete`, `deletePricingVersionNameInput`, `deletePricingVersionError`, `pricingEntryFormOpen`, `editingPricingEntry`, `pricingEntryFixtureName`/`RoughIn`/`TopOut`/`TrimSet`/`Total`, `savingPricingEntry`.
- **Effects:** reset-all-modal-state on `selectedServiceTypeId` change; auto-calc `pricingEntryTotal` from the three stage inputs (manual override tolerated until stages change).
- **Handlers:** `savePricingVersion` (4 branches: rename / new template / new blank pricing with `nextSortOrder(priceBookVersions)` / clone via RPC — clone from a *template* source also calls `rememberLastPriceBookTemplate`), `openEditPricingVersion`, `closePricingVersionForm`, `openDeletePricingVersionModal`, `confirmDeletePricingVersion` (after delete: if the active pricing died, re-activate via [`pickActivePricing`](../src/lib/bids/pickActivePricing.ts), persist with `saveBidSelectedPriceBookVersion`, `loadBids`), `openNewPricingEntry`, `openEditPricingEntry`, `closePricingEntryForm`, `savePricingEntry` (auto-creates fixture types via `getOrCreateFixtureTypeId(name, selectedBidForPricing?.service_type_id)`; insert uses `sequence_order = max+1`), `deletePricingEntry` (`confirm()`).
- **Supabase:** `price_book_versions` (INSERT/UPDATE/DELETE), `price_book_entries` (INSERT/UPDATE/DELETE), RPC `clone_price_book_version_to_bid`, `fixture_types` indirectly via `getOrCreateFixtureTypeId` (parent-owned helper).
- **Extraction:** moves with P4 (they share `pricingFormMode`, `panelVersionId`, `panelEntries`).

---

## BidsLaborTab — per-region dossiers

### Component contract (what the parent injects)

Props type `BidsLaborTabProps`. **Selection:** `selectedBidForCostEstimate` + `setSelectedBidForCostEstimate` (raw setter — used only after the distance write) + `onSelectBid`/`onClose`; `selectedBidVersionId` (print context only — the cost-estimate print reflects the active Version's takeoff materials). **Engine data (edit-side):** `costEstimate`, `costEstimateLaborRows`/`setCostEstimateLaborRows`, `costEstimateCountRows`, `purchaseOrdersForCostEstimate`, `costEstimateMaterialTotalRoughIn/TopOut/TrimSet`, the 11 string-input pairs `laborRateInput`, `drivingCostRate`, `hoursPerTrip`, `estimatorCostUseFlat`, `estimatorCostPerCount`, `estimatorCostFlatAmount`, `travelPeople`, `travelNights`, `travelMealsRate`, `travelHotelRate` (all engine-owned, hydrated by `loadCostEstimate`), and the five direct-cost row families `equipmentRows`/`permitRows`/`subcontractorRows`/`wasteRows`/`otherRows` + setters (parent maps these from the engine's `costEstimate*Rows`). **Labor book:** `laborBookVersions`, `laborBookEntries`/`setLaborBookEntries`, `selectedLaborBookVersionId`/`set…` (the bid's applied book), `laborBookEntriesVersionId`/`set…` (the book being *browsed* in the panel — two independent selections). **Loaders:** `loadCostEstimateData`, `loadLaborBookVersions`, `loadLaborBookEntries`, `saveBidSelectedLaborBookVersion`, `loadBids`, `openMaterialsModelSwitch` (used here, unlike Pricing). **Parent-owned shared state:** `costEstimatePOModalTaxPercent` (print context), `costEstimateDistanceInput`/`setCostEstimateDistanceInput` (**parent-owned because a parent effect writes it when cost-estimate data loads** — see BIDS_TABS map "stays in the parent"). Plus the usual `fixtureTypes`/`getOrCreateFixtureTypeId`, `ledgerPrefixMap`, `onlyMyBids` trio, `narrowViewport640`, `bidPreview`, `error`/`setError`, `selectedServiceTypeId`, `onEditBid`.

### Region L1 — Bid picker (no bid selected)

Mirror of P1: `costEstimateSearchQuery`, `bidsScopedForCostEstimate` → `filteredBidsForCostEstimate` → `costEstimateBidList`, table ~1978–2009 (with a vestigial `sel?.id === bid.id` highlight using raw `#eff6ff`). Same shared-picker extraction opportunity.

### Region L2 — Autosave effect (the tab's one dangerous piece)

- **Location:** first `useEffect` ~226–361; 1.5 s debounce; dep array of 16 values (`costEstimate`, the 10 string inputs, the 5 row families, `costEstimateLaborRows`).
- **Behavior:** parses/validates every input (defaults: driving `0.70`, hours/trip `2`, estimator `$10`/count; travel people ≥1, nights ≥0); on any validation failure it **returns early — leaving `costEstimateAutosaveStatus` stuck on `'saving'`** (quirk #4). On success it UPDATEs `cost_estimates` (12 columns incl. the three `purchase_order_id_*` passthroughs), then sequentially UPDATEs every row of `cost_estimate_labor_rows`, `cost_estimate_equipment_rows`, `cost_estimate_permit_rows`, `cost_estimate_subcontractor_rows`, `cost_estimate_waste_rows`, `cost_estimate_other_rows` (N+1 by design), then flashes `'saved'` for 2 s.
- **Owned local state:** `costEstimateAutosaveStatus`.
- **Extraction status + risk:** this effect was **deliberately left in the tab** at extraction time (it writes UI status + reads parent-injected state). Stage A: extract the parse/validate/payload step to a pure `buildCostEstimateAutosavePayload(inputs) → payload | null` in `lib/bids/` with tests; the effect then shrinks to debounce + writes. Moving the whole effect into the engine is a behavior-affecting change — out of scope.

### Region L3 — HOURS section (labor rows + labor book application)

- **Render location:** ~1077–1299 inside the selected-bid card (card itself ~961; gated by the parent-derived `panel` prop — `laborEmptyState({ resolved, rowCount })` → `'skeleton'` (v2.2367-style loading card while `costEstimateResolve` is unsettled for this bid) · `'empty'` ('Add fixtures in the Counts tab first.', only for a settled zero-row bid) · `'table'`; v2.2847). Above it sits the Materials **By Stage / Combined** toggle calling `openMaterialsModelSwitch('exact'|'rough', 'labor')` (engine-owned confirm modal renders in the parent).
- **Owned local state:** `applyingLaborBookHours`, `laborBookApplyMessage`, `missingLaborBookFixtures: Set<string>`.
- **Cross-tab/shared state:** `costEstimateLaborRows` (engine; synced from counts by the engine's `loadCostEstimateLaborRowsAndSync`), `selectedLaborBookVersionId`, `laborRateInput`.
- **Derived:** per-row `laborRowHours(row)`, totals via `laborRowRough/Top/Trim` (all in [`lib/bids/laborRowHours.ts`](../src/lib/bids/laborRowHours.ts), already tested), labor cost = totalHours × rate.
- **Handlers:** `handleLaborBookVersionChange` (select → `saveBidSelectedLaborBookVersion` → `loadCostEstimateData`), `setCostEstimateLaborRow` (optimistic state patch; persisted by autosave), `saveLaborRows` (explicit row flush), `applyLaborBookHoursToEstimate` (flushes rows first so non-matching fixtures keep values; fetches `labor_book_entries` for the version; builds `entriesByFixtureName` from the **primary fixture name only — `alias_names` are fetched but NOT matched** (quirk #6, differs from the engine's initial sync which honors aliases); updates matching `cost_estimate_labor_rows`; refetches; records `missingLaborBookFixtures`), `printRoughInSubSheet`/`printTopOutSubSheet`/`printTrimSetSubSheet`/`printAllSubSheets` + `printCostEstimatePage` via `buildCostEstimatePrintContext` → [`lib/bidDocuments/costEstimatePage.ts`](../src/lib/bidDocuments/costEstimatePage.ts) (builders own their supplemental supabase reads; the main print is async, the sub-sheets are sync).
- **Supabase:** `labor_book_entries` (SELECT), `cost_estimate_labor_rows` (UPDATE + refetch SELECT), plus the builders' reads.
- **Extraction status + risk + approach:** inline; **medium**. Stage A: `lib/bids/laborBookMatch.ts` — pure `(entries, laborRows) → { hoursByRowId, missingFixtures }` preserving the primary-name-only matching + tests. The section itself can then move as `BidsLaborHoursSection` with the row state + loaders injected.

### Region L4 — Cost-parameter boxes (Vehicle Travel / Lodging & Meals / Estimators Time)

- **Render location:** three amber boxes ~1300–1602, each collapsible with a collapsed-state summary line.
- **Owned local state:** `vehicleTravelCollapsed`, `lodgingCollapsed`, `estimatorTimeCollapsed`, `updatingBidDistance`, `bidDistanceUpdateSuccess`, `travelZip`, `travelLookupStatus`, `travelLookupMessage`.
- **Cross-tab/shared state:** the engine string inputs (`drivingCostRate`, `hoursPerTrip`, `travelPeople/Nights/MealsRate/HotelRate`, `estimatorCostUseFlat/PerCount/FlatAmount`), parent-owned `costEstimateDistanceInput`, `selectedBidForCostEstimate.distance_from_office` / `.customers.address`.
- **Derived (inline IIFEs, duplicated collapsed vs expanded):** driving cost = `(totalHours / hoursPerTrip) × ratePerMile × distance`; travel = `people × nights × (meals + hotel)`; estimator = flat ‖ `countRows × perCount`. These re-implement, with string parsing, what [`lib/bids/bidCostCalc.ts`](../src/lib/bids/bidCostCalc.ts) (`computeTravelCost`, `costEstimateDrivingRate`, `costEstimateHoursPerTrip`, `costEstimateEstimatorCost`) already does from the persisted row — the Pricing tab uses the lib versions; keep the numeric duality in mind (quirk #7).
- **Handlers:** `updateBidDistanceFromCostEstimate` (UPDATE `bids.distance_from_office`, `loadBids`, swap fresh bid into `setSelectedBidForCostEstimate`, re-seed the distance input), `handleTravelPerDiemLookup` (`supabase.functions.invoke('gsa-per-diem', { body: { zip } })` — sets meals/hotel rates on success; friendly `oconus`/not-found messages).
- **Effects:** travel-ZIP prefill on bid change (regex `\b\d{5}\b`, takes the **last** match in `customers.address`; not persisted).
- **Supabase:** `bids` (UPDATE), edge function **`gsa-per-diem`**.
- **Extraction:** each box is a clean candidate component; Stage A the three cost formulas into string-input pure helpers (or adapt `bidCostCalc`) + tests first.

### Region L5 — Direct Costs (five cloned row sections)

- **Render location:** `<h3 id="labor-direct-costs">DIRECT COSTS</h3>` ~1603 (the **scroll-target contract** with `Bids.tsx`'s `scrollToLaborDirectCosts` effect), then five structurally identical sections ~1604–1963: Equipment and Tool Rental, Permits/Inspections/Regulatory Fees, Subcontractor Fees, Waste Disposal and Site Cleanup, Other.
- **Owned local state:** none (rows are engine-owned props).
- **Handlers (×5, identical shape):** `updateEquipmentRow`/`addEquipmentRow`/`removeEquipmentRow`, `updatePermitRow`/…, `updateSubcontractorRow`/…, `updateWasteRow`/…, `updateOtherRow`/… — field edits patch state (persisted by the L2 autosave); add = immediate INSERT (`sequence_order = max+1`, `select().single()` appended to state); remove = optimistic filter + DELETE.
- **Supabase:** `cost_estimate_equipment_rows`, `cost_estimate_permit_rows`, `cost_estimate_subcontractor_rows`, `cost_estimate_waste_rows`, `cost_estimate_other_rows` (INSERT/DELETE here; UPDATE via autosave). Totals via `sumEquipmentRows` (lib, tested).
- **Extraction status + risk + approach:** inline; **low risk, high dedup value** — one generic `DirectCostRowsSection<T>` (title, rows, onUpdate/onAdd/onRemove, addDisabled) collapses ~490 lines to ~120 + 5 instantiations. Behavior-preserving (markup is already identical modulo labels/aria). Keep the `id="labor-direct-costs"` anchor on the h3 outside the generic component.

### Region L6 — Labor Book panel + version/entry modals + add-missing-fixture modal

- **Render location:** collapsible "Labor book" section ~2010–2119 (renders in both modes, like P4); `laborVersionFormOpen` modal ~2120–2171; `laborEntryFormOpen` modal ~2172–2259; `addMissingFixtureModalOpen` modal ~2260–2362.
- **Owned local state:** `laborBookSectionOpen`, `laborVersionFormOpen`, `editingLaborVersion`, `laborVersionNameInput`, `savingLaborVersion`, `laborEntryFormOpen`, `editingLaborEntry`, `laborEntryFixtureName`, `laborEntryAliasNames` (comma-separated string), `laborEntryRoughIn/TopOut/TrimSet`, `savingLaborEntry`, `addMissingFixtureModalOpen`, `addMissingFixtureName/RoughIn/TopOut/TrimSet`, `savingMissingFixture`.
- **Cross-tab/shared state:** `laborBookVersions`, `laborBookEntries`, `laborBookEntriesVersionId` (panel browse selection) vs `selectedLaborBookVersionId` (bid's applied book) — deleting a version clears whichever pointed at it and, if it was the bid's saved book, persists NULL via `saveBidSelectedLaborBookVersion` + `loadBids`.
- **Handlers:** `openNewLaborVersion`/`openEditLaborVersion`/`closeLaborVersionForm`/`saveLaborVersion` (INSERT with `service_type_id` / UPDATE name), `deleteLaborVersion` (`confirm()`; note the `selectedBidForCostEstimate!` non-null assertion), `openNewLaborEntry`/`openEditLaborEntry`/`closeLaborEntryForm`/`saveLaborEntry` (fixture auto-create via `getOrCreateFixtureTypeId`; aliases split/trim; `sequence_order = max+1`), `deleteLaborEntry`, `openAddMissingFixtureModal`, `saveMissingFixtureToLaborBook` (INSERT entry, drop from `missingLaborBookFixtures`, `loadLaborBookEntries`, then **re-runs `applyLaborBookHoursToEstimate`** — couples L6 to L3).
- **Supabase:** `labor_book_versions` (INSERT/UPDATE/DELETE), `labor_book_entries` (SELECT max-seq/INSERT/UPDATE/DELETE), `fixture_types` via helper.
- **Extraction status + risk + approach:** inline; **medium** — same shape as the Price Book panel. Extract as `BidsLaborBookPanel` (~350 lines) with the book state + loaders injected; keep `applyLaborBookHoursToEstimate` injected as a callback (or extract L3 first) because the add-missing-fixture flow re-invokes it.

---

## What must stay in the parent(s)

Two layers of "parent" here — do not pull any of this into a sub-component:

**In `Bids.tsx` (already there — keep it there):**
- The **shared bid pointer** + URL router: `setSharedBid`, `selectBidAndSyncUrl`, `closeSharedBidAndClearUrl`, the `?tab=`/`?id=` deep-link effects, and the `cost-estimate` → `labor` legacy-slug normalization.
- `useBidPricingEngine` + `useBidPricingRows` invocations and their destructured threading.
- `BidVersionPicker` (rendered above the Takeoff/Pricing/Cover-Letter tabs) + `switchActiveVersion`.
- `costEstimatePOModalTaxPercent` (shared with the Takeoffs PO modal), `costEstimateDistanceInput` (written by a parent load effect), `scrollToLaborDirectCosts` + its retry-scroll effect, the materials-model confirmation modal JSX, `BidFormModal` via `openEditBid`, `fixtureTypes` + `getOrCreateFixtureTypeId`, `onlyMyBids` persistence, `canPackageAndSendBidPricing`, `estimatorUsers`, `profileName`, `ledgerPrefixMap`.

**In each tab component (when sub-extracting regions):**
- The props contract itself — sub-components receive slices of the same props, never re-fetch engine data, never own `selectedPricingVersionId`/`selectedLaborBookVersionId`/`templatesMode` (setter callbacks only).
- `BidsLaborTab`: the L2 autosave effect (it spans HOURS + parameter boxes + all five direct-cost families — every region it persists must keep patching the same injected state).
- `BidsPricingTab`: the `useBidPricingRows` consumption point (`pricingRowsForGrid`) and the service-type reset effect (it clears P5 modal state).

---

## Stage-A pure-logic inventory (extract to `lib/*` + tests before any component moves)

| Candidate | Currently | Target |
|---|---|---|
| Pricing cost-breakdown totals (materials + labor + driving + estimator + travel + team labor + 5 direct-cost sums → `totalCost`) | inline IIFE in `BidsPricingTab` grid; re-implemented in `pricingPage.ts` CSV + `approvalPdf.ts` | `lib/bids/bidTotalCostBreakdown.ts` — one function returning the labeled parts + total; 3 call sites converge; tests |
| Grid row decoration (join `pricingRowsForGrid.rows` × labor rows × custom prices × assignments × takeoff materials → `rows`, `uncostedRevenueRows`) | inline `.map` in the grid IIFE | `lib/bids/decoratePricingRows.ts` + tests (incl. uncosted-revenue bucketing) |
| `resolvePricingEntryForCountRow` (assignment → entry, else case-insensitive fixture-name match) | function in `BidsPricingTab` body | `lib/bids/resolvePricingEntry.ts` + tests |
| Autosave parse/validate/payload block (strings → `cost_estimates` update payload or null) | inline in the L2 effect | `lib/bids/costEstimateAutosavePayload.ts` + tests (validation-failure cases; preserve the exact defaults 0.70 / 2 / 10) |
| Labor-book matching for "Apply matching Labor Hours" (`entriesByFixtureName` build + missing-fixture set) | inline in `applyLaborBookHoursToEstimate` | `lib/bids/laborBookMatch.ts` + tests — **preserve primary-name-only matching** (no aliases; quirk #6) |
| Driving / travel / estimator display formulas over string inputs (duplicated collapsed + expanded IIFEs ×3 boxes) | inline IIFEs in L4 | string-input wrappers in `lib/bids/bidCostCalc.ts` (or a sibling `laborTabCostSummaries.ts`) + tests; grid already uses the persisted-row variants |
| Travel-ZIP extraction (last `\b\d{5}\b` match from customer address) | inline in the prefill effect | tiny `lib/bids/extractZipFromAddress.ts` + test |
| Bid-picker filter (name/address/customer/GC + bid number) | duplicated in P1/L1 (and 3 sibling tabs) | `lib/bids/filterBidsForPicker.ts` + test, shared by the picker component |
| Already done (don't redo): `laborRowHours` family, `sumEquipmentRows`/`computeTravelCost`/`costEstimate*` in `bidCostCalc`, `pickActivePricing`/`nextSortOrder`, `resolveCurrentPriceBookTemplateId`, `submissionHiddenIdsForVersion`, `computeBidPricingRows`, the `bidDocuments/pricingPage` + `costEstimatePage`/`laborPage`/`laborSubSheet` builders (all with colocated tests) | `lib/bids/*`, `lib/bidDocuments/*` | — |

---

## Preserve-quirks list (odd but load-bearing — do not "fix" during the move)

1. **`openMaterialsModelSwitch` is a dead prop on `BidsPricingTab`** — typed and passed but never destructured. Removing it is a (tiny) separate cleanup, not part of a region move.
2. **Tax fallback duality:** both tabs build print contexts with `parseFloat(costEstimatePOModalTaxPercent || '8.25') || 0` — empty string → 8.25, junk → 0. Preserve exactly.
3. **Unit-price override blur logic:** empty/NaN → clear override; within `0.001` of the book `total_price` → also clears (treated as "back to book"); otherwise writes the override and deletes any competing `bid_count_row_custom_prices` row. Three distinct write paths in `updateUnitPriceOverride` depending on whether an assignment/entry exists.
4. **Autosave stuck-"Saving…" on invalid input:** the L2 effect sets status `'saving'` *before* validating and early-returns on failure without resetting. Users see "Saving..." until the next valid change. Behavior-preserving extraction keeps this.
5. **`onSelectPriceBookTemplate` reuse rule:** matches an existing clone on `source_version_id` **and** `bid_version_id` (null-safe) so split-bid Versions keep independent pricings; only cloning **from a template** calls `rememberLastPriceBookTemplate` (duplicating another bid pricing does not).
6. **"Apply matching Labor Hours" ignores `alias_names`** (primary `fixture_types.name` only), while the engine's initial `loadCostEstimateData` sync **does** honor aliases. Inconsistent, but changing it alters which rows get overwritten — keep as-is and note it.
7. **Cost-formula duality:** the Labor tab computes driving/travel/estimator from *string inputs* (`parseFloat(...) || default`); the Pricing tab computes the same figures from the *persisted `cost_estimates` row* via `bidCostCalc`. They can disagree while an edit is unsaved. Preserve both paths.
8. **`#labor-direct-costs` DOM id** is a cross-file contract: `Bids.tsx`'s `scrollToLaborDirectCosts` effect polls `document.getElementById('labor-direct-costs')` (20 × 50 ms retries) after `onNavigateToLaborDirectCosts`.
9. **Sequential per-row autosave writes** (N+1) across 6 tables, and **`duplicate`-style optimistic add/remove** on the direct-cost rows (remove filters state before the DELETE resolves; no revert on error beyond `setError`).
10. **Uncosted-revenue margin overstatement is intentional UI:** rows with revenue but no Takeoffs cost show "—" margin and the amber "Currently counts as 100% margin" banner; totals include them at full profit.
11. **Delete-pricing-version recovery path:** type-the-exact-name confirm; if the deleted version was active, re-activate via `pickActivePricing({ savedVersionId: null, ... })`, clear entries when none remain, persist + `loadBids`. Recently-deleted restore (90 days) copy references Settings → Data & migration.
12. **Travel ZIP prefill takes the LAST 5-digit match** in `customers.address` (ZIPs usually trail the state), resets per bid, never persists.
13. **`deleteLaborVersion` uses `selectedBidForCostEstimate!`** (non-null assertion) inside a guard that only checked `?.selected_labor_book_version_id` — works today; a naive refactor could change nullability behavior.
14. **Raw hexes in hover/highlight handlers** (`'#eff6ff'`, `'white'` in the assignment dropdown's `onMouseLeave`; `#eff6ff` row highlight in L1) predate theme tokenization inside inline event handlers — the theme-tokenize CI script doesn't rewrite these; match existing behavior if touched.
15. **Two independent labor-book selections** (`selectedLaborBookVersionId` = applied to the bid; `laborBookEntriesVersionId` = browsed in the panel) are engine-owned and intentionally separate — do not merge.

---

## Recommended extraction order (value ÷ risk)

These files are already extracted tabs; this is a **sub-decomposition**, so every step keeps the existing props contract intact and ships behind green `npm run typecheck && npm run lint && npm test`.

1. **Stage-A sweep** — the [inventory above](#stage-a-pure-logic-inventory-extract-to-lib--tests-before-any-component-moves), each independently shippable. Highest leverage: `bidTotalCostBreakdown` (3-way dedup with the CSV/PDF builders), `costEstimateAutosavePayload`, `laborBookMatch`.
2. **`PricingMarginBreakdownModal`** — pure cut/paste of P3 (self-contained payload, zero coupling). Momentum-builder that validates the sub-extraction pattern.
3. **`DirectCostRowsSection` generic** — collapses the five L5 clones (~490 → ~170 lines); handlers stay in `BidsLaborTab` (the autosave effect needs the same state); keep the `labor-direct-costs` anchor outside the generic.
4. **Shared `BidClusterBidPicker`** — P1/L1 (and the three sibling cluster tabs) each carry the same search + `MyBidsToggle` + table; extract once with `filterBidsForPicker` from Stage A. Five call sites, one component.
5. **`BidsLaborBookPanel`** (L6) — panel + its three modals; inject book state/loaders + `applyLaborBookHoursToEstimate` callback.
6. **`BidsPriceBookPanel`** (P4+P5 together) — panel + version/delete/entry modals; `templatesMode` and `selectedPricingVersionId` remain injected engine state.
7. **Labor parameter boxes** (L4) — three small components after their formulas are Stage-A'd; `costEstimateDistanceInput` stays parent-owned and injected.
8. **`BidsPricingGrid`** (P2) — last and optional: biggest block, most props. Only worth it after steps 1–6 have shrunk the file; it must keep consuming `pricingRowsForGrid` and the injected write handlers.

**Explicit non-goals:** moving the L2 autosave into the engine, merging the two labor-book selections, collapsing the 8 `setSharedBid` selections, alias-matching in apply-hours, removing the dead `openMaterialsModelSwitch` prop as part of a move (do it as its own one-line PR), and any UX/schema change — this map is behavior-preserving inventory only, per [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md).
