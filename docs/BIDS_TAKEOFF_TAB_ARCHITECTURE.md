# BidsTakeoffTab Architecture Map

---
file: docs/BIDS_TAKEOFF_TAB_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the sub-decomposition of src/components/bids/BidsTakeoffTab.tsx (per PAGE_DECOMPOSITION_PLAYBOOK.md). The tab was extracted from Bids.tsx in 2026-05, cut from 5,765 to 2,958 lines by train steps T0–T7 and to 2,645 by the T8/T9 hook seams (v2.2770), then grew back to 3,186 as the Takeoffs refresh (One at a time / Sheet views), the bid flow strip and Materials by stage landed inside it. This map inventories each logical region (state, handlers, tables, modals, coupling, tests) so extractions can proceed without re-reading the whole file. It goes one level DEEPER than BIDS_TABS_ARCHITECTURE.md, which maps the parent page and stays authoritative for what Bids.tsx passes in.
covers:
  - src/components/bids/BidsTakeoffTab.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-28
---

## What this surface is

[`src/components/bids/BidsTakeoffTab.tsx`](../src/components/bids/BidsTakeoffTab.tsx) is the Bids page's **Takeoffs** workflow tab (see [`BIDS_TABS_ARCHITECTURE.md`](./BIDS_TABS_ARCHITECTURE.md) §takeoffs). At `a05cef4c4`: **3,186 lines**, one exported component (`BidsTakeoffTab`, lines 194–3185), module scope = `MaterialPart` / `ServiceType` / `BidsTakeoffEngine` types + the `BidsTakeoffTabProps` interface (125–192). Hook census (from `npm run map`): **61 `useState`**, 0 `useReducer`, **18 `useEffect`**, **11 `useMemo`**, **1 `useCallback`**, **12 `useRef`**, **10 custom-hook calls** (`useBidFlowFacts`, `useBidFlowReview`, `useBidFlowFold`, `useToastContext`, `usePendingRowFlash` ×2, `useSensors`, `useTakeoffPartsCatalog`, `useTakeoffRoughLines`, `useTakeoffFixtureHistory`), 44 inner handlers/functions, render 1992–3184 (1,193 lines). 48 commits in the 90 days to 2026-09-21.

**Line numbers below are "as of `a05cef4c4`"** — the file is high-churn; search the symbol, then use the range to size the job. Regenerate the facts with `npm run map -- src/components/bids/BidsTakeoffTab.tsx`. **v2.4396 deleted the By Stage editor and everything only it used: the file is 2,034 lines, 43 props, 44 `useState`, 16 `useEffect`, so every range below that sat after line ~300 has moved up. Search the symbol.**

The tab has **no internal tab switcher**. Its regions are gated by:

1. **Selection**: `selectedBidForTakeoff` null → bid picker; non-null → the workspace card (2101–2716).
2. **View** (`takeoffView`): `'new1'` One at a time → `TakeoffFocusView`, `'new2'` Sheet → `TakeoffCostRailView` (Old retired in v2.3588). There is one materials model: the part lines in `bids_takeoff_rough_part_lines`. By Stage (`'exact'`, picks in `bids_takeoff_template_mappings` priced through three stage POs) was switched off in v2.4389 and its editor deleted in v2.4396; the table and its rows stay, unread.
3. **A stack of modals/portals**: remove-confirm, RFQ compose, Add assembly (Combined), PartFormModal, the T7 authoring cluster, Part Prices, Bundle breakdown, plus one `createPortal` (the qty numpad).

Parent-owned (see the parent map; not re-documented): the selection (`selectedBidForTakeoff` + `onSelectBid`/`onClose`), URL deep-link + `rowJump` router, `costEstimatePOModalTaxPercent` (Labor and Pricing read it; this tab's materials summary holds its only writer), `onOpenBidFlowDoor`/`bidFlowDoorAllowed`, and the `useBidPricingEngine` data.

**Parent contract:** `BidsTakeoffTabProps` declares **43 props** since v2.4396 (the mappings pair, `draftPOs` / `loadDraftPOs`, the cost-estimate PO loaders, `setCostEstimatePO`, the top-out / trim-set totals and `authUser` went with By Stage). **`onEditBid` is declared and passed by `Bids.tsx` but never read** — a dead prop.

Recent churn (grep `docs/recent-features/` for the version): **v2.3675** (the book and the assembly remember stage splits), **v2.3673** (printed schedule of values; stage text on the rough breakdown print), **v2.3672** (stage boxes on the sheet + Stages panel), **v2.3588** (Old view retired; By Stage keeps the classic editor), **v2.3409/v2.3407** (Sold in rounding, Materials to order).

### How to read a dossier

Each region lists: anchors (symbol @ lines), **owned local state** (moves with the region), **cross-region/shared state** (stays in `BidsTakeoffTab` — the "parent" of this sub-decomposition), derived values, handlers + effects, **tables** (direct `supabase.from` calls: `bid_rfqs`, `bids`, `takeoff_book_entries`, `takeoff_book_entry_items`, `bids_takeoff_template_mappings`, `purchase_orders`, `cost_estimates`, `material_parts`; no direct RPCs, no realtime — the only RPC, `takeoff_fixture_history`, arrives via `useTakeoffFixtureHistory`), sub-components, tests, and extraction status + risk + approach.

---

## Master summary table

| Region | Anchors (as of a05cef4c4) | Lines est. | Coupling | Risk | Status | Tests | Recommended action |
|---|---|---|---|---|---|---|---|
| Bid picker | `takeoffSearchQuery` 292, `bidsScopedForTakeoff` 1680 + `filteredBidsForTakeoff` 1681–1690, render 2088–2100 + 2958–2965 | ~35 | low (props only) | low | list/toggles extracted (`BidPickerStandardList`, `BidPickerSortToggle`, `MyBidsToggle`); filter inline | smoke (1) | leave; the filter is a cross-surface sweep (11 other bid files) |
| Header card: bid flow strip, title, view pills, Print | hooks 254–258, render 2101–2249, `printTakeoffBreakdown` rough branch 1410–1451 | ~200 | med (engine switch, print reads `stageSummary`, close clears exact's `takeoffCreatedPOId`) | low-med | inline; `BidFlowStrip` block duplicated in 5 workflow tabs | smokes mount it; print untested | leave until a shared workflow-tab header exists |
| View state: view, hop, chooser, row-jump flash | 260–288, `switchTakeoffView` 352–369, chooser 531–536 + 2181–2193, effect 627–631 | ~90 | low (own state; `noteTakeoffRow` called by the line editor + Focus view) | low | inline; kernels `takeoffView`/`takeoffHop`/`bidTabRowJump` extracted + tested | smokes (8 of 11) | **#3** `useTakeoffViewState` hook |
| Combined views mount | 2250–2311 (`TakeoffFocusView` 2252–2274, `TakeoffCostRailView` 2276–2310), `takeoffCoverage` 543, history 633–638 | ~70 | med (render-prop `renderRoughLinesTable`) | — | **extracted** (v2.2778 / v2.2781) | smokes; no child render tests | done — keep the render-prop contract |
| Materials at today's book (v2.4395) | memo `takeoffDrift` + `refreshTakeoffPrices` beside `takeoffPartNameById`; render just above the Combined views mount | ~45 | low (writes through `updateTakeoffRoughPartLine`, one per moved line) | med (lines' unit prices) | **born extracted**: [`TakeoffPriceDriftLine`](../src/components/bids/TakeoffPriceDrift.tsx) over [`takeoffPriceDrift.ts`](../src/lib/bids/takeoffPriceDrift.ts); book prices via `useBookPrices` ([`takeoffPriceDriftIo.ts`](../src/lib/bids/takeoffPriceDriftIo.ts)); lock from `pricingLockState` + the session's revised set | `takeoffPriceDrift.test.ts` (7), `takeoffPriceDriftIo.test.ts` (4), `TakeoffPriceDrift.render.test.tsx` (7); the tab's refresh wiring has no tab-level test | — |
| Combined line editor + satellites | `renderRoughLinesTable` 1735–1990, numpad 302–310 + 800–806 + 1205–1283 + portal 3086–3119, Add assembly modal 2718–2882, part-assembly index 874–887 + 1634–1646, bundle rows 1563–1613, catalog-lowest 464–479 + 1531–1561 + 1615–1630 | ~735 | highest (numpad refs, dnd, 3 modal pointers, stage chips, remove-confirm) | high | inline; persistence **out** (`useTakeoffRoughLines`, v2.2770), row **out** (`SortableRoughPartLineRow`, v2.1297) | none on the body; hook untested | **#7** `TakeoffRoughLinesTable` after #2/#3 shrink its props |
| Materials by stage | state 430–435, effects 548–569 + 576–593, memos 570–623, handlers 716–798 | ~170 | low-med (reads coverage, bundle cache, book entries; feeds line editor, Stages panel, print, remember-for-book) | low-med | inline; kernel `materialsByStage` extracted + tested, IO untested | kernel only | **#1** Stage-A input builder, **#2** `useTakeoffMaterialsByStage` |
| Book fill, fixture history, remember-for-book | 512–524, `bookFillPlan` 537–541, 653–713, `applyTakeoffBookTemplates` rough branch 975–996 | ~105 | med (hook writers `fillRowsFromAssemblies`/`copyLinesToRow`) | low | inline; kernels `takeoffBookFill`/`Match`/`Learn`/`takeoffFixtureHistory` tested; `takeoffBookLearnWrite` untested | kernels | leave — thin glue over tested kernels |
| RFQ door | 639–651 (`bid_rfqs`), render 1994–2009 (`RfqComposeModal`, shared with Pricing) | ~30 | low (one opener: Sheet's `onRequestQuotes`) | low | inline mount | none | **#6** (optional) lift into `TakeoffCostRailView` |
| ~~By Stage ("exact") editor~~ | — | 0 | — | **deleted v2.4396** (about 1,000 lines: the mappings table and its four functions, `createPOFromTakeoff` / `addTakeoffToExistingPO`, the template picker portal, the assembly preview modal, the exact branches of the book apply and the print) |
| PartFormModal bridge | 371–408, `handleBidsPartFormSave` 908–957, `…SaveAndAddAnother` 962–969, render 2999–3011 | ~115 | high (routes into 4 contexts) | — | stays; routing kernel `resolvePartFormSaveTarget` extracted + tested | kernel | stays in tab |
| Assembly authoring pointers | 332–345, 410–418, 438–442, `openSaveAsAssemblyFromRough` 846–865, openers 889–906, render 3013–3067 | ~120 | high (49 props into the cluster) | — | **extracted (v2.1306)** → [`TakeoffAssemblyAuthoringModals`](../src/components/bids/TakeoffAssemblyAuthoringModals.tsx) (1,230 lines) | `TakeoffItemSearchCombobox` render test only | done — pointers stay |
| Takeoff-book admin | render 2966–2983 | ~18 | — | — | **extracted (v2.1298)** → [`TakeoffBookAdminSection`](../src/components/bids/TakeoffBookAdminSection.tsx) (525) | none | done |
| Cost-estimate materials + PO review | render 2984–2997 | ~14 | — | — | **extracted (v2.1299)** → [`BidsTakeoffMaterialsSummarySection`](../src/components/bids/BidsTakeoffMaterialsSummarySection.tsx) (379) | `costEstimatePage` kernel | done — tax stays a controlled prop |
| Part Prices modal | pointer 421–422, `applyCatalogPriceToLine` 1673–1676, render 3077–3084 | ~15 | — | — | **extracted (v2.1300)** → [`TakeoffPartPricesModal`](../src/components/bids/TakeoffPartPricesModal.tsx) (328) | none | done — close-edge refresh stays |
| Bundle breakdown modal | pointer 423, `applyBundleQuoteToLine` 1666–1670, render 3069–3075 | ~13 | — | — | **extracted (v2.1300)** → [`TakeoffBundleBreakdownModal`](../src/components/bids/TakeoffBundleBreakdownModal.tsx) (175) | `assemblyBundleBreakdown` kernel | done |
| Remove-confirm dialog (part lines) | state 311–314, effects 808–820, 1285–1295, render 2010–2086 | ~105 | low (pointer written by line editor + exact table) | low | inline bespoke dialog | none | **#5** `TakeoffRemoveConfirmDialog` (pointer stays) |
| Shared substrate | `useTakeoffPartsCatalog` 447–462, `useTakeoffRoughLines` 483–510, `refreshTakeoffRoughCatalogLowest` 464–479 | — | — | — | **seams shipped (T8/T9, v2.2770)** | hooks untested | see below |

---

## The shared substrate

Two layers, both with a seam **above** the tab's JSX:

1. **External (parent-owned, do not move):** the shared bid pointer (`selectedBidForTakeoff` + `selectedBidVersionId` + `onSelectBid`/`onClose`) and **`useBidPricingEngine`**, injected as 32 props (`takeoffCountRows`, `takeoffMappings`/setter, `takeoffRoughPartLines`/setter, `takeoffRoughCatalogLowestByPartId`/setter, `materialTemplates`, `draftPOs`, `takeoffBook*`, `costEstimate*`, loaders, `openMaterialsModelSwitch`). Cross-tab because Counts/Labor/Pricing read the same engine.

2. **Internal (the tab's own substrate — what child extractions are handed):**
   - **Parts catalog → [`useTakeoffPartsCatalog`](../src/hooks/useTakeoffPartsCatalog.ts)** (137 lines, 447–462): `takeoffAddTemplateParts` (paged via `lib/materials/partsCatalog.ts`, loaded when Combined is active or any authoring modal is open), `supplyHouses` + `partTypes` (service-type effect), and the By Stage `takeoffTemplatePreviewCache`. The tab still reloads the catalog itself after a part save (916, 964).
   - **Combined persistence → [`useTakeoffRoughLines`](../src/hooks/useTakeoffRoughLines.ts)** (637 lines, 483–510): `updateTakeoffRoughPartLine`/`persistTakeoffRoughPartLine` (the `queueMicrotask` pair), add/remove, drag reorder (+ its `reorderingRoughPartLine` state, not consumed by the tab), set-part-at-catalog-price, reset, expand-to-lines / bundle insert / bundle apply, `fillRowsFromAssemblies`, `copyLinesToRow`, `refreshOrderIncrementsFromCatalog`, and the v2.2755 missing-part-by-id fetch. Tables: `bids_takeoff_rough_part_lines`, `material_template_prices`.
   - **Coverage:** `takeoffCoverage` memo (543, `summarizeTakeoffCoverage`) feeds both views, the row chip's `orderRounding`, the chooser, and `stageSummary`.
   - **Shared modal openers:** `openBidsPartFormForCreate`, `setPartPricesModal`, `openEditTemplateModal`, `setTakeoffRemoveConfirm`, `setBundleBreakdownModal` — each invoked from 2+ regions (line editor, By Stage table, T7 cluster, bundle modal), so the modals stay at tab level and children open them via callback. `openBidsPartFormForEdit` (line editor only, 1912) and `openAddPartsToTemplateModal` (By Stage table 2420 + its preview modal 2929) have one caller region each and stay with the modals they open.

There is **no additional selection pointer inside the tab** — every region keys off the one injected bid; extractions here are prop-threading exercises.

---

### Order rounding (v2.3406 / v2.3407) — the sticks in every price

A part's **Sold in** rule (`part_types.order_increment` → `material_parts` override; kernel `src/lib/materials/orderIncrement.ts`) is snapshotted onto each rough line when its part is picked (`orderIncrement` / `orderIncrementUnit`, written by `persistTakeoffRoughPartLine` in the hook, read back by the engine's mapper). `src/lib/bids/takeoffOrderRounding.ts` groups the lines by part, sums `quantity × count`, rounds up once per part per bid, and spreads the extra over the fixtures by footage share. **Every price reader goes through it** — `summarizeTakeoffCoverage` (`materialsTotal`, `perFixture.total`, the strip's Order rounding tile, the rail's *incl.* line), the engine's two rough reads (`costEstimateMaterialTotalRoughIn`, `pricingMaterialTotalRoughIn` + `fixtureMaterials`), the Pricing tab's version compare via `roughMaterialsTotalWithRounding`, and `stageSummary`'s `roundingExtraByCountRow` — so the strip never disagrees with Pricing. The row's chip (`SortableRoughPartLineRow`, `orderRounding` prop from `takeoffCoverage.orderRounding.byPartId`, 1889) is the only per-line surface. **Materials to order (v2.3409)** — `TakeoffOrderListPanel` on the Sheet rail and under the Focus view's strip; `refreshOrderIncrementsFromCatalog` (the hook) re-snapshots lines; the Part Prices modal edits the part's own rule.

### Materials by stage (v2.3671–v2.3675) — the stage splits under every row

Every bid (`stageBidId` is the bid's id). The load effect, which also runs when the version changes (v2.4393), reads `bid_takeoff_stage_splits` + the company factor (`loadStageSplitsForBid`, `loadSovMaterialFactorDefault`) and resets `sovFactorOverride` from `bids.sov_material_factor`; a second effect (576–593) loads each bundle assembly's per-part memory (`loadAssemblyPartStageSplits` → `assemblyPartDefaults`) keyed on `stageBundleTemplateIdsKey`. Memos: `stageLookup` (`indexStageSplits`), `bookStageSplitByRow` (`matchBookEntries` + `parseStageSplitJson` over the loaded book entries), `stageBundleParts` (from the bundle-rows cache), `stageSummary` (`computeMaterialsByStage` with coverage's rounding extras and the factor), `stageOwnCountByRow`. `renderRoughLinesTable` renders [`StageSplitChips`](../src/components/bids/StageSplitChips.tsx) inline on the no-lines row (1816) and hands `stageLookup` / `onSetStageSplit` / `stageOwnCount` / `assemblyPartDefaults` / `onRememberPartSplitForAssembly` to every `SortableRoughPartLineRow` (1902–1906); the rail's [`TakeoffStagesPanel`](../src/components/bids/TakeoffStagesPanel.tsx) arrives through `TakeoffCostRailView`'s `stagesPanel` slot (2299–2309). Writers: `setStageSplit` (optimistic, `saveStageSplit`), `fillStagesByRules` (`planRuleFill` with the book's splits → `saveFixtureSplitsBatch` → reload), `rememberPartSplitForAssembly` (`saveAssemblyPartStageSplit`), `setBidSovFactor` (`bids.sov_material_factor`, then `loadBids()`); `rememberFixtureForBookFromRow` also saves the fixture's split onto the book entry (`saveBookEntryStageSplit`). Paper: `printScheduleOfValues` (771–784, `buildScheduleOfValuesHtml`) and the rough breakdown print's `stageTextByRowId` (1444). Kernel + IO: `src/lib/bids/materialsByStage.ts` (tested), `materialsByStageIo.ts` (**untested**). The cover letter and approval PDF compute the same summary through `loadMaterialsByStageForBid` — a second assembly of the same inputs (see Recommended order #1).

## Per-region dossiers

### Bid picker (no bid selected)

- **Render location:** `!selectedBidForTakeoff` search bar + `BidPickerSortToggle` + `MyBidsToggle` (2088–2100); `BidPickerStandardList` (2958–2965).
- **Owned local state:** `takeoffSearchQuery` (292).
- **Cross-region/shared state:** props `bids`, `onlyMyBids`/`setOnlyMyBids`, `isMyBid`, `ledgerPrefixMap`, `onSelectBid`.
- **Derived values:** `bidsScopedForTakeoff` (1680), `filteredBidsForTakeoff` (1681–1690: project/address/customer/builder substring + `bidNumberMatchesQuery`).
- **Tables:** none. **Tests:** smoke "mounts the bid picker".
- **Status:** list + toggles extracted; the filter predicate is the same shape in 11 other files under `src/components/bids/` (`bidNumberMatchesQuery(…)`) — a cross-surface kernel sweep, not a Takeoffs extraction.

### Header card: bid flow strip, title, view pills, Print, model toggle

- **Render location:** card 2101–2249 — mobile close × (2112–2122) and desktop close × (2168–2178), both `onClose()` + `setTakeoffCreatedPOId(null)`; `BidFlowStrip` twice — full (2123–2136, when `flowFold.expanded`) and inline (2144–2156) with identical `canOpenDoor`/`onOpenDoor`/`reviewStamp` closures; `BidWorkflowTabTitleWithPreview`; `TakeoffViewPills` (2157, Combined only); Print (2160–2167); the materials-model toggle (2194–2249, `openMaterialsModelSwitch('exact'|'rough', 'takeoffs')` + `MATERIALS_MODEL_CAPTION`).
- **Owned local state:** `takeoffPrinting` (318).
- **Hooks:** `useBidFlowFacts`, `useBidFlowReview`, `useBidFlowFold` (254–257) — the same trio is in `BidsCountsTab`, `BidsLaborTab`, `BidsPricingTab`, `BidsCoverLetterTab` (+ Facts and Review in `BidsBidBoardTab`).
- **Handlers:** `printTakeoffBreakdown` (1408–1529) — rough branch (1410–1451: part names from `material_parts`, bundle lines named "<assembly> (bundle)", `stageTextByRowId` from `stageSummary`, `buildRoughTakeoffBreakdownHtml`); exact branch belongs to the By Stage region.
- **Tables:** `material_parts` (print names). **Tests:** smokes mount the header; print untested.
- **Status:** inline, low-med risk. Extract only as part of a shared workflow-tab header across the five tabs (cross-surface), not alone.

### View state: view, hop, chooser, row-jump flash

- **State/refs:** `takeoffTouchedRowId` (273) + `takeoffTouchedByBidRef` (274, per-bid memory for the session), `hopFlash` (284), `takeoffView` (349, `readStoredTakeoffView`), `takeoffChooserOpen` (531), `viewFocusRequest` (626), `lastRowJumpRef` (263).
- **Handlers/effects:** `noteTakeoffRow` (275–279), effect 280–283 (restore touched row on bid change), `switchTakeoffView` (352–369: `pickHopRow` over row DOM tops → focus request; Sheet also gets `hopFlash`), chooser effect (532–536: open on a Combined bid only while `!hasStoredTakeoffView`), row-jump → focus-request effect (627–631); `usePendingRowFlash` ×2 (265, 285) → `rowJumpFlashCountRowId` (287–288) tints rows in both editors.
- **Readers outside the region:** `renderRoughLinesTable` (`noteTakeoffRow` on pointer/focus capture, 1796–1803; `rowJumpFlashCountRowId`), `TakeoffFocusView` (`preferredFocusId`, `onFocusChange`, `focusRequest`), `TakeoffCostRailView` (`focusRequest`), exact table rows (flash tint).
- **Tests:** kernels `takeoffView.test.ts`, `takeoffHop.test.ts`, `bidTabRowJump.test.ts`; 8 of the 11 render smokes (new1/new2 mounts, chooser ×3, hop, remembered view, By Stage ignores the view).
- **Status:** inline, low risk → `useTakeoffViewState` hook returning `{ takeoffView, switchTakeoffView, takeoffTouchedRowId, noteTakeoffRow, viewFocusRequest, rowJumpFlashCountRowId, chooserOpen, closeChooser }`.

### Combined views (One at a time / Sheet)

- **Render location:** 2250–2311. `TakeoffFocusView` (2252–2274, 21 props: `renderLinesTable`, `bookPlan`, `history`, `onApplyBook`, `onUseLines`, `onRemember`, `fillButton`/`onFillAll`, `onSheetView`, `onRefreshOrderRules`, …). `TakeoffCostRailView` (2276–2310, 20 props incl. the book selector `onSelectBook` → engine setter + `saveBidSelectedTakeoffBookVersion`, `onCopyFromBid`, `onRequestQuotes`, `onFocusView`, `stagesPanel`).
- **Status:** **extracted** ([`TakeoffFocusView`](../src/components/bids/TakeoffFocusView.tsx) 361 lines, [`TakeoffCostRailView`](../src/components/bids/TakeoffCostRailView.tsx) 316, [`TakeoffViewChooser`](../src/components/bids/TakeoffViewChooser.tsx) 155, [`TakeoffViewPills`](../src/components/bids/TakeoffViewPills.tsx) 41). Both views call back into the tab's `renderRoughLinesTable(rows, { suggestionFor })` so they cannot drift — preserve that render-prop contract when the editor moves.
- **Tests:** the tab's smokes mount both; no render tests of their own.

### Combined line editor + satellites

- **Render location:** `renderRoughLinesTable` (1735–1990, 256 lines): `DndContext` (drag-start commits the numpad draft, 1739–1748; `handleRoughPartLinesDragEnd` from the hook), table wrapper with **no `overflow: hidden`** (1753–1755), per-fixture rows — no-lines row with `StageSplitChips` + add-line/add-assembly, else `SortableContext` of `SortableRoughPartLineRow` (1880–1924, 39 props) and the add-line footer. Satellites: **Add assembly modal** (2718–2882, expand-to-lines via `applyRoughAddAssemblyTemplate` 2828 / **Add as bundle** via `applyRoughAddAssemblyBundle` 2856, part-filter chip 2765–2804), **qty numpad portal** (3086–3119, `NumericEntryPad`).
- **Owned local state:** `takeoffRoughPartPickerLineId` + `takeoffRoughPartSearchQuery` (293–294; `handleBidsPartFormSave` also reads/clears both, 928/943–944), `roughAddAssemblyModalCountRowId`/`SearchQuery`/`Expanding` (295–297; `Expanding` is written by the hook via the passed setter, and the hook also calls `closeRoughAddAssemblyModal`), `partAssemblyIndex` + `roughAddAssemblyPartFilter` (300–301), numpad `roughQtyNumpadLineId`/`Pos`/`Draft` (302–304) + refs `…LineIdRef`/`…DraftRef`/`…OriginalRef`/`roughQtyBlurTimeoutRef` (305–310), `collapsedBundleLineIds` (436), `roughPartLinesSensors` (290).
- **Cross-region/shared state:** engine lines/lowest-price map; catalog `takeoffAddTemplateParts`; `takeoffCoverage`; stage props (Materials by stage); modal pointers `partPricesModal`, `bundleBreakdownModal`, `takeoffRemoveConfirm` (`'rough_line'`), PartFormModal openers, `openSaveAsAssemblyFromRough`; view state `noteTakeoffRow` / `rowJumpFlashCountRowId`. `bundlePartsByTemplateId` (428) is shared, not owned: the rows render it and the lazy-load effect fills it, but `stageBundleParts` (Materials by stage) reads it and `invalidateBundleParts` is called only by the T7 cluster (3026).
- **Derived:** `takeoffRoughCatalogLowestPartIdsKey` (1531–1536), `takeoffBundleTemplateIdsKey` (1564–1571), `partAssemblyEntriesFor` (874–879), `roughAddAssemblyFilterEntries`/`roughAddAssemblyTemplates` (1723–1728), `filterPartsByQuery` (1714–1720, also passed to the T7 cluster).
- **Handlers + effects:** numpad `onRoughQtyFocus`/`Blur`/`InputChange`/`PadEscape` (1225–1283) + ref mirrors (800–806) + close-on-scroll/resize (1205–1223); `closeRoughAddAssemblyModal` (867–871), `openAssembliesForPart` (882–887); catalog-lowest batch effect (1538–1561) + `refreshTakeoffRoughCatalogLowest` (464–479) + Part Prices **close-edge** refresh (1615–1630, `prevPartPricesModalRef`); bundle rows lazy load (1574–1593) + `invalidateBundleParts` (1597–1604) + `toggleBundleLineCollapsed` (1606–1613); part-assembly index effect (1634–1646, [`loadPartAssemblyIndex`](../src/lib/bids/partAssemblyIndexIo.ts) — every `material_template_items` row, paged, → `buildPartAssemblyIndex`; a failed read leaves the index as it was; re-runs on `materialTemplates`); `applyBundleQuoteToLine` / `applyCatalogPriceToLine` (1666–1676).
- **Tables (direct):** none. `material_template_items` via `partAssemblyIndexIo`; everything else via the hook / `fetchLowestPartPricesBatch` / `loadBundlePartLines`.
- **Tests:** none on the body; `SortableRoughPartLineRow` (806 lines) has no render test; kernels `bidTakeoffHelpers` (qty clamp/restore, `roughCountMultiplier`), `partAssemblyIndex`, `partAssemblyIndexIo`, `assemblyBundleBreakdown` (its two loaders included) and `materialPartCatalogPrice` (lowest-price selection; the batch pages `material_part_prices` through `loadPartPriceRows`) are tested; **`useTakeoffRoughLines` is an untested money path.**
- **Status:** inline, **highest risk — extract after** Materials by stage and view state leave (both cut its props). Target `TakeoffRoughLinesTable` owning the numpad cluster, Add assembly modal, part-assembly index and the catalog-lowest batch effect; the tab keeps the bundle-rows cache (shared, above), `refreshTakeoffRoughCatalogLowest` (the rough-lines hook takes it) and the Part Prices close-edge refresh (keyed on the tab's pointer), plus modal pointers, remove-confirm and the PartForm bridge, and passes openers.

### Materials by stage

- **Owned local state:** `stageSplits`, `sovFactorDefault`, `sovFactorOverride`, `stageFillNote` (430–433), `assemblyPartDefaults` (435).
- **Effects:** 548–569 (splits + factor per Combined bid), 576–593 (assembly part memory).
- **Memos:** `stageLookup` 570, `stageBundleTemplateIdsKey` 572–575, `bookStageSplitByRow` 595–604, `stageBundleParts` 605–609, `stageSummary` 610–622, `stageOwnCountByRow` 623.
- **Handlers:** `setStageSplit` 716–735, `fillStagesByRules` 738–749, `rememberPartSplitForAssembly` 752–768, `printScheduleOfValues` 771–784, `setBidSovFactor` 786–798.
- **Readers outside:** `renderRoughLinesTable`, `TakeoffStagesPanel` slot, `printTakeoffBreakdown` (`stageSummary`), `rememberFixtureForBookFromRow` (`stageLookup`).
- **Inputs from elsewhere:** `takeoffIsRough`, `selectedBidForTakeoff`, `takeoffCountRows`, `takeoffRoughPartLines`, `takeoffCoverage`, `bundlePartsByTemplateId`, `takeoffBookEntries`, `materialTemplates`, `loadBids`, `showToast`.
- **Tables:** `bids` (direct, factor); `bid_takeoff_stage_splits`, `app_settings`, `material_template_items`, `takeoff_book_entries` via `materialsByStageIo`.
- **Tests:** `materialsByStage.test.ts`, `scheduleOfValues.test.ts`, `StageSplitChips.render.test.tsx`, `TakeoffStagesPanel.render.test.tsx`; **`materialsByStageIo.ts` untested**; the tab's input assembly (605–622) duplicates `loadMaterialsByStageForBid`'s (untested).
- **Status:** inline, low-med risk, the cleanest hook seam in the file — no other region writes its state.

### Book fill, fixture history, remember-for-book

- **Anchors:** book-entries sync effect 516–524 (`bookEntriesSyncedForRef` 515 — loads the bid's selected book onto the tab once per version), `bookFillPlan` 537–540 (`planBookFill`, null unless the loaded entries are the selected version's), `bookFillButton` 541, `takeoffHistory` 633–637, `takeoffPartNameById` 638; handlers `copyFixturesFromBid` 653–666, `applyBookToFixture` 668–675, `useHistoryLinesOnFixture` 677–684, `rememberFixtureForBookFromRow` 687–713; `applyTakeoffBookTemplates` 973–1070 (Combined branch 975–996 → `fillRowsFromAssemblies` over `bookFillPlan.fillable`).
- **Owned state:** `applyingTakeoffBookTemplates`. The fill's summary is a toast since v2.4396: the line it printed on sat in the Old view (retired v2.3588), so the message state was written and never shown.
- **Tables:** via `takeoffBookLearnWrite` (`material_templates`, `material_template_items`, `takeoff_book_entries`, `takeoff_book_entry_items`) and the hook.
- **Tests:** `takeoffBookFill`, `takeoffBookMatch`, `takeoffBookLearn`, `takeoffFixtureHistory` kernels; `takeoffBookLearnWrite.ts` untested.
- **Status:** thin glue over tested kernels + hook writers; leave inline.

### RFQ door

- **Anchors:** `takeoffRfqScope`, `takeoffOpenRfqHouseIds` (640–641), open-RFQ effect (642–651, `bid_rfqs` `status = 'sent'`), render 1994–2009 (`RfqComposeModal` with `bidPackageLabel`, `plans_link`).
- **Opened by:** `TakeoffCostRailView`'s `onRequestQuotes` only (2295).
- **Status:** inline mount of a shared modal (also used by `BidsPricingTab`); optional lift into the Sheet view.

### By Stage ("exact") editor — deleted v2.4396

Retired on the owner's yes of 2026-10-01 (punch list #77): switched off in v2.4389 (`docs/recent-features/v2.4389.md` holds the check that came first), deleted in v2.4396. What went from this file: the fixture × assembly table and `setTakeoffMapping` / `saveTakeoffMapping` / `addTakeoffTemplate` / `removeTakeoffMapping`, `createPOFromTakeoff` and `addTakeoffToExistingPO`, the template picker portal, the assembly preview modal, the exact branches of `applyTakeoffBookTemplates` and `printTakeoffBreakdown`, the takeoff-book selector row that sat above the table, and seventeen state hooks. With it: the Add Parts to Template modal in `TakeoffAssemblyAuthoringModals` (only the preview modal opened it), the parts-preview cache in `useTakeoffPartsCatalog`, `lib/bids/poItemsSummary.ts`, `lib/bidDocuments/costEstimatePO.ts`, and the PO pickers and PO review window in `BidsTakeoffMaterialsSummarySection`. The table `bids_takeoff_template_mappings` and the copy functions that name it stay.

### PartFormModal bridge

- **Anchors:** `takeoffNewItemPartId` 371, `bidsPartFormOpen`/`InitialName`/`EditingPart` 374–376, refs `bidsPartFormIsEditRef` 377 + `bidsPartFormRoughLineIdRef` 379, `openBidsPartFormForCreate` 388–394, `…ForEdit` 396–402, `closeBidsPartForm` 404–408, `handleBidsPartFormSave` 908–957 (reload catalog, then `resolvePartFormSaveTarget` → Add Parts auto-add / Edit Assembly item / rough line / Add Assembly draft), `handleBidsPartFormSaveAndAddAnother` 962–969, render 2999–3011.
- **Tests:** `partFormSaveTarget.test.ts`. **Status:** stays in the tab — it writes into four contexts owned by three regions.

### Assembly authoring pointers (T7 cluster mount)

- **Anchors:** `takeoffAddTemplateModalOpen`/`ForMappingId`/`NewTemplateName`/`NewTemplateItems` (336–339), `saveAsAssemblyCountRowId` 343, `takeoffNewTemplateApplyPriceIndex` 345, Add Parts pointers `addPartsToTemplateModalOpen`/`Id`/`Name` 411–413 + routed ids `addPartsSelectedPartId` 414 / `addPartsAutoAddPartId` 418, Edit Template pointers `editTemplateModalOpen`/`Id`/`Name` 439–441 + routed `editTemplateNewItemPartId` 442 (the three `…Open` flags also gate `useTakeoffPartsCatalog`'s load; Add Parts' and Edit Template's feed `handleBidsPartFormSave`'s routing); `openSaveAsAssemblyFromRough` 846–865 (merges the fixture's part lines, `saveAsAssemblyDefaultName`), `openAddPartsToTemplateModal` 891–897, `openEditTemplateModal` 901–906; render 3013–3067 (49 props).
- **Status:** **extracted (v2.1306)** → [`TakeoffAssemblyAuthoringModals.tsx`](../src/components/bids/TakeoffAssemblyAuthoringModals.tsx). What stayed and why: the three open pointers (set from the exact table, the picker portal, the preview modal, the bundle modal and the line editor); the PartFormModal-routed ids; the Save-as-Assembly bridge + the Add-Assembly name/items drafts it seeds. Edit Template's reset + loads are an open-edge effect inside the cluster (keyed on open + id, not name). v2.1326/v2.1327/v2.1333: unified item search (`TakeoffItemSearchCombobox`), immediate adds, visual refresh. The assembly parts preview modal stays with the By Stage region.

### Takeoff-book admin section · Cost-estimate materials + PO review · Part Prices · Bundle breakdown

All four are **extracted** thin mounts (2966–2983, 2984–2997, 3077–3084, 3069–3075). What stays in the tab: for the book admin, nothing but engine props (the *Apply* button lives in the By Stage branch and the Sheet rail); for materials summary, `costEstimatePOModalTaxPercent` as a controlled prop; for Part Prices, the `partPricesModal` pointer, the close-edge refresh (1615–1630) and `applyCatalogPriceToLine` (v2.1638 "Use"); for Bundle breakdown, the pointer and `applyBundleQuoteToLine`.

### Remove-confirm dialog (both models)

- **Anchors:** `takeoffRemoveConfirm` (311–313, `{ kind: 'rough_line', lineId }`), `takeoffRemoveConfirmDeleteRef` 314, focus effect 808–811, Escape effect 813–820, `closeTakeoffRemoveConfirm` 1285–1287, `confirmTakeoffRemove` 1289–1295 (→ hook's `removeTakeoffRoughPartLine` or `removeTakeoffMapping`), render 2010–2086 (bespoke 77-line dialog).
- **Status:** inline; the pointer is opened by both models so it stays; the dialog body can move to a props-only `TakeoffRemoveConfirmDialog`. Swapping it for the app's shared `ConfirmDialog` is a UI change — its own PR.

---

## Test coverage (as of a05cef4c4)

| Surface | Tests | Gap |
|---|---|---|
| Tab wiring | `BidsTakeoffTab.render.test.tsx` — 10 smokes: picker; a bid flagged By Stage opens on One at a time with no Materials pills (v2.4389); Combined default One at a time + chooser; new1; hop new1→new2 remembered; chooser first open; remembered view (incl. a stored Old → One at a time); new2; a bid flagged By Stage follows the stored view; null `materials_model` is Combined | no interaction smokes for line edits, numpad, remove, PO, print, stages |
| Kernels the tab calls | `bidTakeoffHelpers`, `takeoffView`, `takeoffHop`, `bidTabRowJump`, `bidFlow`, `takeoffCoverage`, `takeoffOrderRounding`, `materialsByStage`, `takeoffBookFill`, `takeoffBookMatch`, `takeoffBookLearn`, `takeoffFixtureHistory`, `partFormSaveTarget`, `partAssemblyIndex`, `partAssemblyIndexIo`, `assemblyBundleBreakdown`, `materialPartCatalogPrice`, `poItemsSummary`, `mergeTemplateItemDrafts`, `materials/partsCatalog`, `materialPOUtils`, `bidDocuments/takeoffBreakdown`, `scheduleOfValues`, `costEstimatePage` (all `*.test.ts`) | — |
| Child render tests | `StageSplitChips`, `TakeoffStagesPanel`, `TakeoffOrderListPanel`, `TakeoffItemSearchCombobox` | none for `SortableRoughPartLineRow`, `TakeoffFocusView`, `TakeoffCostRailView`, `TakeoffAssemblyAuthoringModals`, `TakeoffBookAdminSection`, `BidsTakeoffMaterialsSummarySection`, `TakeoffPartPricesModal`, `TakeoffBundleBreakdownModal`, `RfqComposeModal` |
| **Untested money paths (risk flags)** | — | `useTakeoffRoughLines` (every rough-line write, qty clamp, lowest bundle price pick, copy at today's lowest prices); `materialsByStageIo.ts` (split writes + the paper's summary loader); tab-inline `createPOFromTakeoff`/`addTakeoffToExistingPO` (PO qty rounding, `cost_estimates` PO linking), `setTakeoffMapping`/`saveTakeoffMapping`, the exact book-apply loop (quantity = `Number(row.count)`), `setBidSovFactor`, the `stageSummary` input assembly |

---

## Preserve-quirks list (load-bearing — do not "fix" during moves)

1. **Mapping identity dance:** `setTakeoffMapping` (1072–1126) deletes + re-inserts (new UUID, `isSaved: false`) when template/stage changes on a saved mapping; `saveTakeoffMapping` upserts with `onConflict: 'count_row_id,template_id,stage,bid_version_id'` and back-fills the DB id. The upsert carries `bid_version_id: selectedBidVersionId` (1133; null = unsplit Base); the old row's delete is by id only.
2. **Bundle line sentinel:** `partId == null && sourceTemplateId != null` is an opaque assembly bundle. Encoded in the hook's `persistTakeoffRoughPartLine` and `updateTakeoffRoughPartLine` (keep in sync) and in the tab's `takeoffBundleTemplateIdsKey` / `stageBundleTemplateIdsKey`. Grayed bundle part rows (`bundlePartsByTemplateId`) are display-only, never persisted, never summed.
3. **Fire-and-forget persistence:** rough saves run in `queueMicrotask` inside the hook's state setters; `setTakeoffMapping` fires its delete + `saveTakeoffMapping` as floating promises inside the setter. Extraction must not make them awaited.
4. **Numpad refs:** `roughQtyNumpadLineIdRef`/`DraftRef` mirror state so scroll/resize/drag-start listeners can commit; `roughQtyNumpadOriginalRef` (v2.1329) holds the pre-focus quantity — focus clears the draft, every close path restores via `resolveRoughQtyOnClose`, and `onRoughQtyInputChange` skips empty drafts so the `0.0001` floor never stamps over a line. Focusing a new line commits the previous one first. Blur waits 150ms and checks `[data-rough-qty-pad="true"]` focus containment.
5. **One search query per picker family:** `takeoffTemplatePickerQuery` and `takeoffRoughPartSearchQuery` are single values shared across rows; pickers close via 150ms `onBlur` timeouts.
6. **Catalog multi-loader:** the hook's Combined-active effect and modal-open effect both write `takeoffAddTemplateParts` (last write wins; both typed with the tab's `MaterialPartWithType`); `handleBidsPartFormSave`/`…AndAddAnother` reload it again (916, 964); the rough hook merges missing parts by id (v2.2755).
7. **Rough table wrapper has NO `overflow: hidden`** (1753–1755, v2.1059) — restoring it re-clips the part picker on last rows.
8. **Rough line totals multiply by `roughCountMultiplier(row.count)`**; quantities clamp to min `0.0001`.
9. ~~By Stage quirk~~ — gone with the editor (v2.4396).
10. ~~By Stage quirk~~ — gone with the editor (v2.4396).
11. ~~By Stage quirk~~ — gone with the editor (v2.4396).
12. **Book entries on the tab:** the sync effect (516–524) loads the bid's selected version once per version (`bookEntriesSyncedForRef`); `bookFillPlan` is null unless `takeoffBookEntriesVersionId === selectedTakeoffBookVersionId`, but `bookStageSplitByRow` (595–604) has no such guard — while the admin section browses another version, Fill from rules reads that version's splits. Observed asymmetry; verify before changing.
13. **Stage splits are optimistic:** `setStageSplit` inserts a `pending-<row>-<line>-<part>` id, swaps in the saved row, and restores the previous array on error; `sovFactorOverride` re-derives from `bids.sov_material_factor` whenever that raw value changes; `setBidSovFactor` reverts on error, else reloads bids.
14. **Part Prices close-edge refresh** (1615–1630, `prevPartPricesModalRef`) re-fetches rough lowest prices so "lowest:" chips update after price edits.
15. **View chooser asks once per device** (`hasStoredTakeoffView`); picking the view already showing still writes storage (2186–2191). A hop into One at a time sends only a focus request; into Sheet it also flashes the row (368).
16. **PartForm rough-line origin is captured at click** (`bidsPartFormRoughLineIdRef`, v2.1395) — by save time the row's search box has blurred and nulled the live picker id.
17. **`useHistoryLinesOnFixture` is not a hook** (677) — a plain async handler with a `use` prefix; rename only in its own PR.
18. **Dead prop:** `onEditBid` is declared (183) and passed by `Bids.tsx` but never destructured.
19. Now in extracted children (keep there): tax fallback asymmetry `|| '8.25'` vs `|| 0` (`BidsTakeoffMaterialsSummarySection`); `deleteTakeoffBookVersion` cascade and the undeletable "Default" version (`TakeoffBookAdminSection`); part-merge-by-`part_id` (`mergeTemplateItemDrafts`).

---

## Decomposition log (train state as of a05cef4c4)

Executed with the [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) process. **Line count: 5,765 (2026-07-29) → 2,958 after T7 → 2,645 after T8/T9 (v2.2770) → 2,862 (v2.2784, views) → 2,955 (v2.3588, Old retired) → 3,101 (v2.3672) → 3,186 (v2.3675, `a05cef4c4`).** The growth since T9 is new features landing inside the tab, not regressions of extracted pieces.

| Step | PR | Version | What |
|---|---|---|---|
| T0 | #995 | — | Render-smoke safety net (`BidsTakeoffTab.render.test.tsx`; now 11 tests) |
| T1 | #996 | v2.1294 | `lib/bids/poItemsSummary.ts` — the 3-copy PO-items summary (deleted v2.4396 with its last callers) |
| T2 | #997 | v2.1295 | `lib/bids/mergeTemplateItemDrafts.ts` — the 4 merge variants |
| T3 | #999 | v2.1297 | `SortableRoughPartLineRow` → own file (+`PartType`/`RoughTakeoffMaterialPart` types) |
| T4 | #1000 | v2.1298 | `TakeoffBookAdminSection` (+2 modals, 11 states, CRUD; cascade quirk intact) |
| T5 | #1001 | v2.1299 | `BidsTakeoffMaterialsSummarySection` (+PO review modal; tax stays controlled prop) |
| T6 | #1002 | v2.1300 | `TakeoffPartPricesModal` + `TakeoffBundleBreakdownModal` (pointers stay parent-owned) |
| T7 | #1010 | v2.1306 | `TakeoffAssemblyAuthoringModals` (open pointers + PartForm-routed ids + Save-as-Assembly bridge stay; Edit Template reset/loads → open-edge effect; preview modal stays) |
| — | #1095 | v2.1395 | `lib/bids/partFormSaveTarget.ts` — PartForm save routing kernel |
| T8 | #2507 | v2.2770 | `hooks/useTakeoffPartsCatalog.ts` — catalog + both paged loads, supply houses / part types (its By Stage preview cache went in v2.4396) |
| T9 | #2507 | v2.2770 | `hooks/useTakeoffRoughLines.ts` — the whole Combined persistence engine (persist/update pair, add/remove, drag reorder, expand, bundle insert/apply, missing-part fallback; later `fillRowsFromAssemblies`, `copyLinesToRow`, `refreshOrderIncrementsFromCatalog`) |
| — | #2517 / #2520 / #3397 | v2.2778 / v2.2781 / v2.3588 | Combined bodies became `TakeoffFocusView` + `TakeoffCostRailView` over the shared `renderRoughLinesTable`; Old's sheet retired |

**Remaining:** Materials by stage and view state (new, inline); the Combined line editor body (`renderRoughLinesTable` + satellites); the remove-confirm dialog.

**Process notes for whoever continues:** one behavior-preserving PR per step; gates (`typecheck`/`lint`/`npm test` incl. the T0 smokes) before every push; claim the version with `npm run claim`; branch protection requires up-to-date branches, so pair auto-merge with `gh pr update-branch` whenever `mergeStateStatus` goes `BEHIND`, and verify merges by polling for `state == MERGED`.

## Recommended extraction order (value ÷ risk, as of a05cef4c4)

1. **Stage A — one materials-by-stage input builder.** Lift the `stageSummary` input assembly (rounding extras from coverage, `bundlePartInputs`, splits, assembly defaults, factor; 605–622) into a pure helper in `lib/bids/materialsByStage.ts` and call it from both the memo and `loadMaterialsByStageForBid` (`materialsByStageIo.ts`) so the rail and the paper cannot drift; add `materialsByStageIo.test.ts` with a fake client. Zero UI risk, covers untested money IO.
2. **`useTakeoffMaterialsByStage` hook** — 5 `useState` (430–435, not `collapsedBundleLineIds`), 2 effects, 6 memos, 5 handlers (~170 lines). Nothing outside writes its state; inputs listed in the dossier. Newest and busiest code (the last three commits).
3. **`useTakeoffViewState` hook** — 5 `useState` + 2 refs + 3 effects + `switchTakeoffView`/`noteTakeoffRow` + both `usePendingRowFlash` calls (~90 lines). Kernels tested; 8 smokes already exercise it.
4. ~~By Stage Stage A~~ — moot: the editor was deleted in v2.4396.
5. **`TakeoffRemoveConfirmDialog`** — the 2010–2086 dialog + its two effects; pointer and `confirmTakeoffRemove` stay. Low risk, ~90 lines.
6. **RFQ door (optional)** — move `takeoffRfqScope`/`takeoffOpenRfqHouseIds`/effect + `RfqComposeModal` into `TakeoffCostRailView`, its only opener (~30 lines).
7. **Combined line editor → `TakeoffRoughLinesTable`** — after 2 and 3 cut its props; carries the numpad cluster, Add assembly modal, part-assembly index and the catalog-lowest batch effect (~735 lines); the bundle-rows cache is passed in, since `stageBundleParts` reads it and the T7 cluster invalidates it. Keep `renderLinesTable(rows, { suggestionFor })` as the views' contract, the numpad ref pattern and the no-overflow wrapper. Highest risk; add an interaction smoke (edit qty → persist) first.
8. ~~By Stage body → `BidsTakeoffExactSection`~~ — moot: deleted in v2.4396.

**What must STAY in `BidsTakeoffTab`:** the props seam to `Bids.tsx`, the two substrate hooks, `takeoffCoverage`, `takeoffRemoveConfirm` + `confirmTakeoffRemove`, the PartFormModal bridge (four routing targets), the authoring-cluster pointers + Save-as-Assembly bridge, the bundle-rows cache (`bundlePartsByTemplateId`), and the Part Prices / Bundle breakdown pointers.
**What stays in `Bids.tsx`** (per the parent map): URL/deep-link + `rowJump` routing, `selectedBidForTakeoff`, `costEstimatePOModalTaxPercent`, the materials-model switch confirm modal, the bid-flow door router, the shared cost-estimate loader effect.

## Stage-A pure-logic inventory (→ `src/lib/*` + colocated tests)

| Candidate | Currently | Target |
|---|---|---|
| Materials-by-stage input assembly (tab memo 605–622 ≡ `loadMaterialsByStageForBid`) | duplicated, untested | helper in `lib/bids/materialsByStage.ts` + tests (Recommended #1) |
| PO quantity rule (quirk 10, 3 copies) | inline, untested | `lib/bids/` `poQuantityForMapping` + test |
| Exact-print stage/row shaping (1460–1513, post-`expandTemplate` sort + name mapping) | inline | builder-input assembler next to `lib/bidDocuments/takeoffBreakdown.ts` + test |
| `filterTemplatesByQuery`, `filterPartsByQuery`, `takeoffTemplatePickerOptions` (1694–1720) | inner functions, passed as props to the T7 cluster + row | `lib/bids/takeoffPickerFilters.ts` + tests (near-duplicates in `lib/materials/materialsFilters.ts`, the Materials tabs' tested kernel — not a drop-in: it reads `part_type` where Takeoff's parts carry `part_types`, and its template filter takes `assemblyTypes`; see the playbook's Takeoff ↔ Materials row) |
| PO naming ``` `${projectName} – Takeoff ${date} – ${stageLabel}` ``` + per-stage grouping (1307–1350) | inline | small pure helpers in `lib/bids/` (low value; optional) |
| Bid-picker filter (1680–1690) | inline, same shape in 11 other bid files | shared kernel in a separate cross-surface sweep |
| Part-merge-by-`part_id` rule | **done (v2.1295)** — [`mergeTemplateItemDrafts.ts`](../src/lib/bids/mergeTemplateItemDrafts.ts) | — |
| PartForm save routing | **done (v2.1395)** — [`partFormSaveTarget.ts`](../src/lib/bids/partFormSaveTarget.ts) | — |

Already extracted + tested (do not re-derive): [`bidTakeoffHelpers.ts`](../src/lib/bids/bidTakeoffHelpers.ts) (`clampRoughQtyFromDraft`, `resolveRoughQtyOnClose`, `normalizeMaterialsModel`, `takeoffFixtureCountLabel`, `mergePartLinesToTakeoffTemplateItems`, `saveAsAssemblyDefaultName`, `roughCountMultiplier`, `STAGE_LABELS`, `MATERIALS_MODEL_CAPTION`), `takeoffView.ts`, `takeoffHop.ts`, `bidTabRowJump.ts`, `takeoffCoverage.ts`, `takeoffOrderRounding.ts`, `materialsByStage.ts`, `takeoffBookFill.ts`, `takeoffBookMatch.ts`, `takeoffBookLearn.ts`, `takeoffFixtureHistory.ts`, [`partAssemblyIndex.ts`](../src/lib/bids/partAssemblyIndex.ts) + [`partAssemblyIndexIo.ts`](../src/lib/bids/partAssemblyIndexIo.ts), [`assemblyBundleBreakdown.ts`](../src/lib/bids/assemblyBundleBreakdown.ts), [`materialPartCatalogPrice.ts`](../src/lib/materialPartCatalogPrice.ts) (`fetchLowestPartPricesBatch`, paged), `lib/materials/partsCatalog.ts`, [`materialPOUtils.ts`](../src/lib/materialPOUtils.ts) (`expandTemplate`, `addExpandedPartsToPO`, `getTemplatePartsPreview`), `lib/bidDocuments/takeoffBreakdown.ts` + `scheduleOfValues.ts` + `costEstimatePage.ts`. Extracted but **untested**: `materialsByStageIo.ts`, `takeoffBookLearnWrite.ts`, `hooks/useTakeoffRoughLines.ts`, `hooks/useTakeoffPartsCatalog.ts`.

Definition of done per extraction, verification gates (`npm run typecheck && npm run lint && npm test` after every step), and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md). Behavior-preserving only.
