# BidsTakeoffTab Architecture Map

---
file: docs/BIDS_TAKEOFF_TAB_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the sub-decomposition of src/components/bids/BidsTakeoffTab.tsx (per PAGE_DECOMPOSITION_PLAYBOOK.md). The tab was extracted from Bids.tsx in 2026-05 but kept growing (5,765 lines at the 2026-07-29 sweep; ~2,958 after decomposition steps T0–T7 — see the Decomposition log) — this map inventories each logical region (state, handlers, supabase tables, modals, coupling) so future extractions can proceed without re-reading the whole file. It goes one level DEEPER than BIDS_TABS_ARCHITECTURE.md, which maps the parent page and stays authoritative for what Bids.tsx passes in.
audience: Developers, AI Agents
last_updated: 2026-09-04
---

## What this surface is

[`src/components/bids/BidsTakeoffTab.tsx`](../src/components/bids/BidsTakeoffTab.tsx) is the Bids page's **Takeoffs** workflow tab — already an extracted component (see [`BIDS_TABS_ARCHITECTURE.md`](./BIDS_TABS_ARCHITECTURE.md) §takeoffs), but it grew to **5,765 lines** (2026-07-29) and became a decomposition target in its own right — **now ~2,958 lines** after train steps T0–T7 (see the Decomposition log below). Counts at 2026-07-29: **~106 `useState`**, **~18 `useEffect`**, 2 `useMemo` + 1 `useCallback`, one exported component (`BidsTakeoffTab`); the former module-level `SortableRoughPartLineRow` moved to its own file in v2.1297.

The tab has **no internal tab switcher**. Its regions are gated by:

1. **Selection**: `selectedBidForTakeoff` null → bid picker list; non-null → the takeoff workspace.
2. **Materials model**: `normalizeMaterialsModel(selectedBidForTakeoff.materials_model)` → `'exact'` ("By Stage" assembly-mapping table) vs `'rough'` ("Combined" per-part-line sheet). Only one renders at a time; they persist to **different tables** (`bids_takeoff_template_mappings` vs `bids_takeoff_rough_part_lines`).
3. **A stack of ~10 modals/portals** (assembly authoring, part prices, bundle breakdown, takeoff-book forms, PO review, remove-confirm, numpad + template-picker portals).

Everything below the component's props seam was already Stage-B-moved from `Bids.tsx`; the parent still owns the selection (`selectedBidForTakeoff` + `onSelectBid`/`onClose`), the URL deep-link router, `costEstimatePOModalTaxPercent` (shared tax with the Labor tab), the materials-model switch confirmation modal (`openMaterialsModelSwitch`), and the `useBidPricingEngine` data — see the parent map; none of that is re-documented here.

Recent churn (grep `docs/RECENT_FEATURES.md` for `BidsTakeoffTab`): **v2.1088** (newest release — `partAssemblyIndex` "In N assemblies" link + part-filter chip in the Add assembly modal), **v2.1059** (rough part-picker dropdown clipping fix: rough table wrapper deliberately has NO `overflow: hidden`), **v2.591** (editable assembly name in the Edit Assembly modal). The rough/Combined model, bundles, and Save-as-Assembly are all 2026 additions — this file is HIGH-churn; prefer symbol search over the line numbers below (they are "as of v2.1088" and rot).

### How to read a dossier

Each region lists: render location (state gate; line ranges approximate), **owned local state** (moves with the region), **cross-region/shared state** (stays in `BidsTakeoffTab` — the "parent" of this sub-decomposition), **derived values**, **handlers**, **supabase tables** (no RPCs and no realtime subscriptions exist anywhere in this file), **sub-components** (extracted vs inline), **external coupling**, and **extraction status + risk + approach**.

---

## Master summary table

| Region | Render gate | Lines est. (state+handlers+JSX) | Coupling | Risk | Status | Recommended action |
|---|---|---|---|---|---|---|
| Bid picker | `!selectedBidForTakeoff` | ~100 | low (props only) | low | inline | extract with header or leave (small) |
| Header + model toggle + book selector | `selectedBidForTakeoff` | ~250 | med (engine setters, print, book apply — `applyTakeoffBookTemplates` lives here) | low-med | inline | extract after Stage A |
| Exact ("By Stage") mappings table | model `'exact'` | ~800 | high (mappings engine, template picker portal, PO creation, modal openers) | med | inline | **NEXT after T7**: extract after parts-catalog seam (T8) |
| Rough ("Combined") part-line sheet | model `'rough'` | ~1,150 (row component already out) | highest (rough-lines engine, numpad, dnd, catalog-price effects) | high | inline | extract last (T9); `SortableRoughPartLineRow` **done (v2.1297)** → [own file](../src/components/bids/SortableRoughPartLineRow.tsx) |
| Takeoff-book admin section | always (collapsible) | ~10 (thin render) | low | — | **extracted (v2.1298)** → [`TakeoffBookAdminSection`](../src/components/bids/TakeoffBookAdminSection.tsx) | Done — delete-cascade quirk preserved via engine props; Apply stays in header |
| Assembly authoring modal cluster (Add Assembly / Add Parts / Edit Template) | modal-open flags | ~65 (cluster render) | — | — | **extracted (v2.1306)** → [`TakeoffAssemblyAuthoringModals`](../src/components/bids/TakeoffAssemblyAuthoringModals.tsx) | Done — open pointers, the PartFormModal-routed `takeoffNewItemPartId` bridge, and the Save-as-Assembly bridge stay parent-owned; preview modal stays with the exact region for T8. **v2.1326**: Add Assembly's staged item picker replaced by [`TakeoffItemSearchCombobox`](../src/components/bids/TakeoffItemSearchCombobox.tsx) (unified parts+assemblies pick-adds-immediately search; a cluster effect consumes the staged part id straight into the item drafts; the old search-query/dropdown staged states were deleted from both files). **v2.1327**: same treatment for the siblings — Edit Assembly uses the combobox with immediate DB adds at qty 1 + inline qty editing in the items table; Add Parts uses `SearchableSelect` with the new reusable `noMatchesAction` create-part prop; only the two PartFormModal-routed part-id bridges remain parent-owned. **v2.1333**: Edit Assembly visual refresh — boxed sections, search-first Items with P/A chip rows (table gone), bundle prices click-to-edit (Enter/blur commits, Escape cancels) with mouse-only × removes |
| Part Prices modal | `partPricesModal != null` | ~5 (thin render) | — | — | **extracted (v2.1300)** → [`TakeoffPartPricesModal`](../src/components/bids/TakeoffPartPricesModal.tsx) | Done — pointer + close-edge refresh effect stay parent-owned |
| Bundle breakdown modal | `bundleBreakdownModal != null` | ~7 (thin render) | — | — | **extracted (v2.1300)** → [`TakeoffBundleBreakdownModal`](../src/components/bids/TakeoffBundleBreakdownModal.tsx) | Done — pointer + `applyBundleQuoteToLine`/`openEditTemplateModal` stay parent |
| Cost-estimate materials section + PO review modal | inside workspace wrapper | ~14 (thin render) | — | — | **extracted (v2.1299)** → [`BidsTakeoffMaterialsSummarySection`](../src/components/bids/BidsTakeoffMaterialsSummarySection.tsx) | Done — tax stays a controlled prop shared with Labor |
| Shared substrate (parts catalog + persistence engines + shared modals) | — | ~450 | — | — | in-component | becomes the `useTakeoffPartsCatalog` seam at T8; see below |

---

## The shared substrate

Two layers, and both already have a seam **above** this file:

1. **External (parent-owned, do not move):** the Bids page's shared bid pointer (`selectedBidForTakeoff` + `selectedBidVersionId` + `onSelectBid`/`onClose`) and the **`useBidPricingEngine`** hook, injected as ~30 props (`takeoffCountRows`, `takeoffMappings`/`setTakeoffMappings`, `takeoffRoughPartLines`/`setTakeoffRoughPartLines`, `takeoffRoughCatalogLowestByPartId`, `materialTemplates`, `draftPOs`, `takeoffBook*`, `costEstimate*`, loaders). Cross-tab because Counts/Labor/Pricing read the same engine. Also parent-owned: `costEstimatePOModalTaxPercent` (shared with Labor) and `openMaterialsModelSwitch` (shared confirm modal). See [BIDS_TABS_ARCHITECTURE.md](./BIDS_TABS_ARCHITECTURE.md).

2. **Internal (this file's own substrate — what future child extractions must be handed):**
   - **Parts/templates catalog:** `takeoffAddTemplateParts` (all `material_parts` for the service type, with `part_types(*)` — loaded by TWO effects: rough-model-active and any-authoring-modal-open; **every load goes through the paged `src/lib/materials/partsCatalog.ts` kernel since v2.2755** — Plumbing is past PostgREST's 1,000-row cap, and a third effect fetches by id any part a rough line references that the list lacks, so rows never render blank), `supplyHouses` + `partTypes` (mount effect keyed on `selectedServiceTypeId`), engine `materialTemplates`, and `takeoffTemplatePreviewCache` (templateId → parts preview, filled lazily). Consumed by both model bodies and every modal. **Seam candidate: `useTakeoffPartsCatalog` hook.**
   - **Two persistence engines (state lives in `useBidPricingEngine`, write logic lives here):** exact = `setTakeoffMapping` → `saveTakeoffMapping` (upsert on `bids_takeoff_template_mappings`) / `removeTakeoffMapping`; rough = `updateTakeoffRoughPartLine` → `persistTakeoffRoughPartLine` (insert/update on `bids_takeoff_rough_part_lines`) / `removeTakeoffRoughPartLine` / `insertRoughBundleLine`. Both are fire-and-forget via `queueMicrotask` inside state setters. These functions stay in the component (or move to a `useTakeoffPersistence` hook) and are passed down.
   - **Shared modal openers:** `openBidsPartFormForCreate`/`openBidsPartFormForEdit` (PartFormModal), `setPartPricesModal`, `openEditTemplateModal`, `openAddPartsToTemplateModal`, `setTakeoffRemoveConfirm`. Each is invoked from 2+ regions, so per playbook rule these modals stay at the `BidsTakeoffTab` level and children open them via callback.

There is **no additional selection pointer inside the tab** — every region keys off the one injected bid. That means child extractions here are prop-threading exercises, not selection redesigns.

---

## Per-region dossiers

### Bid picker (no bid selected)

- **Render location:** two `!selectedBidForTakeoff &&` blocks — search bar + `MyBidsToggle` (~2585–2596) and the Project/Bid Date table (~3759–3785).
- **Owned local state:** `takeoffSearchQuery`.
- **Cross-region/shared state:** `bids`, `onlyMyBids`/`setOnlyMyBids`, `isMyBid`, `ledgerPrefixMap` (all props).
- **Derived values:** `bidsScopedForTakeoff`, `filteredBidsForTakeoff` (project/address/customer/builder substring + `bidNumberMatchesQuery` from `lib/ledgerDisplayPrefixes`).
- **Handlers:** row `onClick={() => onSelectBid(bid)}`.
- **Supabase tables:** none (props data).
- **Sub-components:** `MyBidsToggle`, `BidProjectCell` (both extracted).
- **Extraction status + risk + approach:** Inline, **low risk**, but only ~100 lines and identical in shape to the pickers in the sibling cluster tabs — extracting it standalone has low value; fold it into whatever shell component hosts the header, or leave it.

### Header + materials-model toggle + takeoff-book selector

- **Render location:** the `selectedBidForTakeoff &&` card top (~2597–2749): close ×, `BidWorkflowTabTitleWithPreview`, Print button, the By Stage / Combined toggle (calls `openMaterialsModelSwitch('exact'|'rough', 'takeoffs')` — the confirm modal lives in `Bids.tsx`), and the Takeoff book `<select>` + "Apply Matching Fixture Assemblies" button.
- **Owned local state:** `takeoffPrinting`, `applyingTakeoffBookTemplates`, `takeoffBookApplyMessage` (4s/3s `setTimeout` clears).
- **Cross-region/shared state:** engine `selectedTakeoffBookVersionId`/`setSelectedTakeoffBookVersionId`, `takeoffBookVersions`, `saveBidSelectedTakeoffBookVersion`, `takeoffCountRows`, `takeoffMappings`/`setTakeoffMappings`; props `bidPreview`, `narrowViewport640`, `onClose` (also clears `takeoffCreatedPOId`, owned by the exact region).
- **Handlers:** `applyTakeoffBookTemplates` (~1221–1301 — loads `takeoff_book_entries` + `takeoff_book_entry_items` for the selected version, matches `fixture_name`/`alias_names` case-insensitively against `takeoffCountRows.fixture`, dedupes on `` `${countRowId}:${templateId}:${stage}` `` against existing mappings, appends unsaved `TakeoffMapping`s; **blocked in rough model** with an inline message); `printTakeoffBreakdown` (~1849–1969 — rough branch: part-name lookup from `material_parts` + `buildRoughTakeoffBreakdownHtml`; exact branch: per-stage `expandTemplate` expansion, name sort, `buildExactTakeoffBreakdownHtml`; both via `printHtmlInNewWindow`).
- **Supabase tables:** `takeoff_book_entries`, `takeoff_book_entry_items`, `material_parts` (name lookups for print).
- **Extraction status + risk + approach:** Inline, **low-med risk**. Stage A first: the fixture/alias matching + dedupe loop inside `applyTakeoffBookTemplates` is pure once the two queries are hoisted — `lib/bids/takeoffBookApply.ts` `computeTakeoffBookMappingsToAdd(countRows, entries, itemsByEntryId, existingMappings)` + tests (alias trim/case, dedupe key, quantity = `Number(row.count)`); likewise the exact-print stage/row shaping (the part of `printTakeoffBreakdown` between the `expandTemplate` awaits and the HTML builder). The HTML builders themselves are already in `lib/bidDocuments/takeoffBreakdown.ts`.

### Exact ("By Stage") mappings table

- **Render location:** model `'exact'` branch (~2754–3081): fixture × assembly-mapping table (searchable template picker per mapping row, parts-preview cell, stage select, quantity, remove), then the PO action row ("Create purchase orders for Stages" / "Print Breakdown" / add-to-existing-draft-PO select) and the current-PO-items preview table. The **template-picker dropdown renders in a `createPortal`** (~5050–5112) positioned by `takeoffTemplatePickerAnchor`.
- **Owned local state:** `takeoffTemplatePickerOpenMappingId`, `takeoffTemplatePickerQuery` (ONE query shared by all rows — only one picker opens at a time), `takeoffTemplatePickerInputRefs` (Map), `takeoffTemplatePickerAnchor`, `takeoffTemplatePreviewCache` (also written by the authoring modals), `takeoffPreviewModalTemplateId`/`Name` (the "and N more" preview modal ~3685–3757), `takeoffExistingPOId`, `takeoffExistingPOItems`, `takeoffCreatingPO`, `takeoffAddingToPO`, `takeoffSuccessMessage`, `takeoffCreatedPOId` (renders the `Link to="/materials" state={{ openPOId }}` deep link).
- **Cross-region/shared state:** engine `takeoffMappings`/`setTakeoffMappings`, `takeoffCountRows`, `materialTemplates`, `draftPOs`/`loadDraftPOs`; engine cost-estimate glue (`ensureCostEstimateForBid`, `loadPurchaseOrdersForCostEstimate`, `loadCostEstimate`); shared `takeoffRemoveConfirm` (kind `'exact_mapping'`); modal openers (`openAddPartsToTemplateModal`, `openEditTemplateModal`, Add-Assembly via `setTakeoffAddTemplateModalOpen` + `setTakeoffAddTemplateForMappingId`).
- **Derived values:** `takeoffMappedCount`; `takeoffTemplatePickerOptions(mapping)` (filter + pin the selected template); `filterTemplatesByQuery` (in-body pure fn).
- **Handlers:** `setTakeoffMapping` (~1303–1357 — **quirk:** changing template/stage on a saved mapping deletes the old row and re-inserts with a fresh `crypto.randomUUID()` because of the unique constraint), `saveTakeoffMapping` (~1359–1399 — upsert with `onConflict: 'count_row_id,template_id,stage,bid_version_id'`; writes back the DB id + `isSaved`), `addTakeoffTemplate` (unsaved row seeded with `quantity = max(1, row.count)`), `removeTakeoffMapping` (optimistic, re-adds on delete error), `createPOFromTakeoff` (~1722–1801 — one draft `purchase_orders` row per stage named `` `${projectName} – Takeoff ${date} – ${stageLabel}` ``, items via `expandTemplate` + `addExpandedPartsToPO`, then links the created PO ids into `cost_estimates.purchase_order_id_{rough_in,top_out,trim_set}` preserving existing ids, reloads engine cost-estimate data), `addTakeoffToExistingPO` (~1803–1847 — expand per mapping with `source_template_id`, then reload the PO's items inline). Effects: picker-anchor recompute on resize/scroll-capture (~432–454); preview-cache fill for mapped template ids (~2243–2258); `takeoffExistingPOId` → load `purchase_order_items` preview (~2260–2289).
- **Supabase tables:** `bids_takeoff_template_mappings` (upsert/delete), `purchase_orders` (insert), `purchase_order_items` (select; inserts via `lib/materialPOUtils`), `cost_estimates` (update), `material_parts` (print names).
- **Sub-components:** `TakeoffPartEditIcon` (extracted); picker portal + preview modal inline.
- **External coupling:** created-PO link navigates to Materials with `state: { openPOId }` (consumed by `Materials.tsx`'s PO deep-link router — see [MATERIALS_TABS_ARCHITECTURE.md](./MATERIALS_TABS_ARCHITECTURE.md)).
- **Extraction status + risk + approach:** Inline, **medium risk**. Extract as `BidsTakeoffExactSection` after the parts-catalog seam and after the authoring-modal cluster is out (it only *opens* those modals — pass openers as callbacks). `setTakeoffMapping`/`saveTakeoffMapping` move with it (sole writers of the mappings table) unless a shared `useTakeoffPersistence` hook is built. Stage A: the PO-items row mapping (`{ part_name, quantity, price_at_time, template_name }` from the `purchase_order_items` join) is copy-pasted **3×** in this file (existing-PO preview effect, `addTakeoffToExistingPO`, cost-estimate PO modal effect) → `lib/bids/poItemsSummary.ts` `loadPOItemsSummary(supabase, poId)`.

### Rough ("Combined") part-line sheet

- **Render location:** model `'rough'` branch (~3083–3327): `DndContext` + `SortableContext` table of per-fixture part lines rendered by the module-level **`SortableRoughPartLineRow`** (~5117–5765), "Add part line"/"Add assembly" row actions, Print Breakdown. Satellites: the **Add assembly modal** (~3519–3683, expand-to-lines vs **Add as bundle**, with the v2.1088 part-filter chip), the **qty numpad portal** (`NumericEntryPad` in `createPortal`, ~5018–5049), and grayed display-only bundle part rows inside the sortable row.
- **Owned local state:** `reorderingRoughPartLine`, `takeoffRoughPartPickerLineId` + `takeoffRoughPartSearchQuery` (one picker/query for all lines), `roughAddAssemblyModalCountRowId`/`SearchQuery`/`Expanding`, `partAssemblyIndex` + `roughAddAssemblyPartFilter` ("In N assemblies"), numpad cluster `roughQtyNumpadLineId`/`Pos`/`Draft` + mirror refs `roughQtyNumpadLineIdRef`/`DraftRef` + `roughQtyBlurTimeoutRef`, `bundlePartsByTemplateId` + `collapsedBundleLineIds`, `roughPartLinesSensors` (dnd-kit), `saveAsAssemblyCountRowId` + `takeoffNewTemplateApplyPriceIndex` (Save-as-Assembly handoff into the Add Assembly modal).
- **Cross-region/shared state:** engine `takeoffRoughPartLines`/`setTakeoffRoughPartLines`, `takeoffRoughCatalogLowestByPartId`/setter, `takeoffCountRows`, `materialTemplates`; catalog `takeoffAddTemplateParts`; shared modals (`partPricesModal` with `defaultAddPrice`, `bundleBreakdownModal`, `takeoffRemoveConfirm` kind `'rough_line'`, PartFormModal via `openBidsPartFormForCreate`/`ForEdit`, Add Assembly modal via `openSaveAsAssemblyFromRough`).
- **Derived values:** `takeoffRoughFilledLineCount`; memo `takeoffRoughCatalogLowestPartIdsKey` (sorted distinct part ids, `''` unless active+rough); memo `takeoffBundleTemplateIdsKey`; per-row `lineTotal = quantity × unitPrice × roughCountMultiplier(row.count)`; `partAssemblyEntriesFor` (index filtered to visible templates); `roughAddAssemblyTemplates` (part-filter narrowing).
- **Handlers:** `persistTakeoffRoughPartLine` (~1436–1485 — insert/update; **bundle sentinel: `partId == null && sourceTemplateId != null`**; clamps qty min `0.0001`, price min 0), `updateTakeoffRoughPartLine` (~1535–1557 — state map + `queueMicrotask` persist when persistable), `setRoughPartLinePartAndCatalogPrice` (fetch lowest via `fetchLowestPartPrice`, toast if none), `resetRoughLineToCatalogPrice`, `addTakeoffRoughPartLine`, `removeTakeoffRoughPartLine` (optimistic + revert), `handleRoughPartLinesDragEnd` (~1674–1720 — same-fixture-only `arrayMove`, resequence, `withSupabaseRetry` updates, snapshot revert), numpad handlers `onRoughQtyFocus`/`Blur` (150ms timeout checking `[data-rough-qty-pad]` focus)/`InputChange`/`PadEscape`, `applyRoughAddAssemblyTemplate` (expand + merge quantities + batch lowest prices + persist each line, `sourceTemplateId` stamped), `insertRoughBundleLine`, `applyRoughAddAssemblyBundle` (lowest `material_template_prices` row, $0 + info toast if none), `applyBundleQuoteToLine`, `invalidateBundleParts`, `toggleBundleLineCollapsed`, `openAssembliesForPart`, `openSaveAsAssemblyFromRough` (uses `mergePartLinesToTakeoffTemplateItems`). Effects: numpad ref mirrors (×2), numpad close-on-scroll/resize (commits draft), catalog-lowest batch fetch on `takeoffRoughCatalogLowestPartIdsKey` (via `fetchLowestPartPricesBatch`), lazy bundle-part-rows load on `takeoffBundleTemplateIdsKey` (`loadBundlePartLines`), partPricesModal **close-edge** refresh (`prevPartPricesModalRef` detects open→closed and re-fetches lowest prices), rough-mode parts load, `partAssemblyIndex` load (rebuilds on `materialTemplates` change via `buildPartAssemblyIndex`).
- **Supabase tables:** `bids_takeoff_rough_part_lines` (insert/update/delete), `material_template_prices` (lowest bundle price), `material_template_items` (assembly index), `material_parts` (+`part_types(*)`).
- **Sub-components:** `SortableRoughPartLineRow` (**in-file module component, ~650 lines** — takes ~30 props; renders part picker dropdown, `MoneyDecimalAmountInput`, catalog-price status chips "lowest:/Bid override/No catalog price" via `catalogUnitPricesEffectivelyEqual`, qty input that flips `type` when the numpad is active, drag handle, grayed never-persisted bundle rows), `NumericEntryPad` + `MoneyDecimalAmountInput` + `TakeoffPartEditIcon` (extracted).
- **External coupling:** rough line totals feed the engine's `costEstimateMaterialTotalRoughIn` roll-up (computed in `useBidPricingEngine`, not here).
- **Extraction status + risk + approach:** Inline, **highest risk — extract last**. First do the zero-risk file move: `SortableRoughPartLineRow` → `src/components/bids/SortableRoughPartLineRow.tsx` verbatim (already prop-pure; drops ~650 lines). Then, after the parts-catalog seam and the modal extractions, move the sheet + its satellites as `BidsTakeoffRoughSection`, keeping `persistTakeoffRoughPartLine`/`updateTakeoffRoughPartLine` with it (sole writers) and receiving modal openers as props. Preserve the numpad ref-mirror pattern and the missing `overflow: hidden` on the table wrapper (v2.1059 fix).

### Takeoff-book admin section

- **Render location:** always rendered below the workspace (~3786–3900): collapsible "Takeoff book" section — version chips (select/edit/delete; "Default" has no delete button) + entries table + "Add entry". Its two modals follow: version form (~3901–3935), entry form (~3936–4039).
- **Owned local state:** `takeoffBookSectionOpen`, `takeoffBookVersionFormOpen`, `editingTakeoffBookVersion`, `takeoffBookVersionNameInput`, `savingTakeoffBookVersion`, `takeoffBookEntryFormOpen`, `editingTakeoffBookEntry`, `takeoffBookEntryFixtureName`, `takeoffBookEntryAliasNames` (comma-joined string), `takeoffBookEntryItemRows` (`{templateId, stage}[]`), `savingTakeoffBookEntry`.
- **Cross-region/shared state:** engine `takeoffBookVersions`, `takeoffBookEntries`/`setTakeoffBookEntries`, `takeoffBookEntriesVersionId`/setter (the version being *browsed* — distinct from `selectedTakeoffBookVersionId`, the version *applied to the bid*), `loadTakeoffBookVersions`, `loadTakeoffBookEntries`, `saveBidSelectedTakeoffBookVersion`, `loadBids`, `materialTemplates` (entry rows + name display).
- **Handlers:** `openNew/openEdit/close` for both forms, `saveTakeoffBookVersion` (insert with `service_type_id` / update), `deleteTakeoffBookVersion` (**cascade quirk:** clears `takeoffBookEntriesVersionId`+entries and, if it was the bid's selected version, nulls `selectedTakeoffBookVersionId`, calls `saveBidSelectedTakeoffBookVersion(bid.id, null)` and `loadBids()`), `saveTakeoffBookEntry` (update = delete-all-items-then-reinsert; insert = `sequence_order` max+1; alias split on commas), `deleteTakeoffBookEntry`.
- **Supabase tables:** `takeoff_book_versions` (insert/update/delete), `takeoff_book_entries` (insert/update/delete), `takeoff_book_entry_items` (insert/delete).
- **Sub-components:** none; both modals inline.
- **External coupling:** none beyond the engine (the *Apply* button lives in the header region).
- **Extraction status + risk + approach:** Inline, **low risk — extract first**. Fully self-contained state + CRUD; props needed: the engine book values/loaders listed above, `materialTemplates`, `selectedServiceTypeId`, `selectedBidForTakeoff`, `setError`. This is the momentum extraction (the tab's `po-generator` equivalent) → `src/components/bids/TakeoffBookAdminSection.tsx`, ~440 lines out.

### Assembly authoring modal cluster

- **Render location:** four modals opened from both models: **Add Assembly** (`takeoffAddTemplateModalOpen`, ~3348–3517, `ModalShell`), **assembly parts preview** (`takeoffPreviewModalTemplateId`, ~3685–3757), **Add Parts to Template** (`addPartsToTemplateModalOpen`, ~4353–4506), **Edit Template** (`editTemplateModalOpen`, ~4508–4795, includes v2.591 rename + bundle-price CRUD).
- **Owned local state:** Add Assembly cluster — `takeoffAddTemplateForMappingId`, `takeoffNewTemplateName`/`Description`/`Items`, draft bundle prices `takeoffNewTemplatePrices`/`PriceSupplyHouseId`/`PriceValue`, `savingTakeoffNewTemplate`, item-picker `takeoffNewItemType/PartId/TemplateId/Quantity/PartSearchQuery/PartDropdownOpen/TemplateSearchQuery/TemplateDropdownOpen` (+ `saveAsAssemblyCountRowId`/`takeoffNewTemplateApplyPriceIndex`, shared with the rough region). Add Parts — `addPartsToTemplateId`/`Name`/`SelectedPartId`/`Quantity`/`SearchQuery`/`DropdownOpen`, `savingTemplateParts`. Edit Template — `editTemplateModalId`/`Name`/`Items`, `editTemplateNewItem*` (8 states), `editTemplateAddingItem`, `editTemplatePrices` + `editTemplateNewPriceSupplyHouseId`/`Value` + `editTemplatePriceSaving`/`Editing`, `editTemplateNameDraft`/`NameSaving`.
- **Cross-region/shared state:** catalog `takeoffAddTemplateParts` (re-fetched by the modal-open effect ~2291–2312 — note it casts to `MaterialPart[]`, silently dropping `part_types` typing), `supplyHouses`, `materialTemplates`/`loadMaterialTemplates`, `takeoffTemplatePreviewCache` (invalidated/refetched via `getTemplatePartsPreview` after every item mutation), `invalidateBundleParts` (rough bundle rows cache), `setTakeoffMapping` (Add Assembly auto-assigns the new template when launched from an exact mapping), rough Save-as-Assembly override (deletes the fixture's saved lines + `insertRoughBundleLine` at the chosen price), `partPricesModal` opener, PartFormModal opener.
- **Handlers:** `saveTakeoffNewTemplate` (~522–624 — insert `material_templates` + merged items (parts merged by `part_id`, nested templates may repeat) + optional `material_template_prices`, then `loadMaterialTemplates`, then the exact-mapping assignment and/or the rough bundle override), `addTakeoffNewTemplateItem` (qty-merge for duplicate parts), `removeTakeoffNewTemplateItem`, `updateTakeoffNewTemplateItemQuantity`, `openAddPartsToTemplateModal`/`savePartsToTemplate` (qty-merge via `maybeSingle` lookup, else `sequence_order` max+1), `openEditTemplateModal`/`closeEditTemplateModal`, `loadEditTemplateItems`, `addEditTemplateItem` (qty-merge; blocks self-nesting), `removeEditTemplateItem` (`confirm()`), `saveEditTemplateName`, `loadEditTemplatePrices`/`addEditTemplatePrice`/`updateEditTemplatePrice`/`removeEditTemplatePrice`.
- **Supabase tables:** `material_templates` (insert/update), `material_template_items` (all verbs), `material_template_prices` (all verbs).
- **Sub-components:** `ModalShell` (extracted, Add Assembly only); the three near-duplicate part/template search dropdowns are inline.
- **External coupling:** writes the org-wide materials catalog — everything here is also editable from `Materials.tsx` (Assembly Book / templates-po); no shared client state, coupling is via DB + `loadMaterialTemplates`.
- **Extraction status + risk + approach:** **Extracted (v2.1306)** → [`TakeoffAssemblyAuthoringModals.tsx`](../src/components/bids/TakeoffAssemblyAuthoringModals.tsx) (~1,280 lines) as one plain-props cluster (no hook/imperative handle needed). What stayed parent-owned and why: the three **open pointers** (set from the exact table, the picker portal, the preview modal, and the bundle modal); the **PartFormModal-routed picker states** (`takeoffNewItemPartId`/`addPartsSelectedPartId`/`editTemplateNewItemPartId` + their search/dropdown trios — `handleBidsPartFormSave` writes them and stays in the tab); the **Save-as-Assembly bridge** (`saveAsAssemblyCountRowId`, `takeoffNewTemplateApplyPriceIndex`) plus the Add-Assembly **name/items drafts** that `openSaveAsAssemblyFromRough` seeds; and the catalog/preview-cache substrate (until T8). Everything else (25 internal states + all CRUD handlers) moved. Two mechanical shape changes, both behavior-equivalent: the parent's `openEditTemplateModal` shrank to a pointer-set and the reset + item/price loads became an **open-edge effect** in the cluster (keyed on open+id, deliberately NOT on name so renames don't reload); the redundant open-time resets of cluster-internal picker fields in `openSaveAsAssemblyFromRough`/`openAddPartsToTemplateModal` were dropped (every close path resets them, so they are guaranteed default at open). The **assembly parts preview modal** deliberately did NOT move — its state is exact-region-owned and extracts at T8. Stage A (`mergeTemplateItemDrafts`) was done at T2.

### Part Prices modal

- **Render location:** `partPricesModal != null` (~4912–5016); opened from rough line rows ("Catalog prices", pre-filling `defaultAddPrice`), Add Assembly item rows, and Edit Template item rows.
- **Owned local state:** `partPricesModal` (`{partId, partName, defaultAddPrice?}`), `partPricesModalData` (`'loading' | rows | null`), `partPricesModalEditing` (priceId → draft string), `partPricesModalUpdating`, `partPricesModalAddSupplyHouseId`/`AddPrice`/`Adding`; `prevPartPricesModalRef` (close-edge detection — used by the rough region's refresh effect).
- **Cross-region/shared state:** `supplyHouses`; on close, the rough region re-fetches `takeoffRoughCatalogLowestByPartId`.
- **Handlers:** load effect on `partPricesModal?.partId` (select `material_part_prices` + `supply_houses(name, website_url)`, price-ascending), `updatePartPriceInModal`, `addPartPriceInModal` (optimistic row append).
- **Supabase tables:** `material_part_prices` (select/update/insert).
- **Sub-components:** `SupplyHouseWebsiteLink` (extracted).
- **Extraction status + risk + approach:** Inline, **low-med risk**, cleanly extractable as `TakeoffPartPricesModal` (props: `modal`, `onClose`, `supplyHouses`, `onError`). The parent keeps a thin `onClosed` callback (or the existing `prevPartPricesModalRef` effect) so the rough catalog-price refresh behavior survives. Note: it duplicates `Materials.tsx`'s `PartPricesManager` in spirit but not code — do NOT merge during the move (behavior-preserving only).

### Bundle breakdown modal

- **Render location:** `bundleBreakdownModal != null` (~4798–4911): parts-vs-bundle comparison for a rough Assembly-bundle line (parts list, à-la-carte totals per supply house with "missing N" badges, clickable bundle quotes) + an "Edit assembly" shortcut into the Edit Template modal.
- **Owned local state:** `bundleBreakdownModal` (`{templateId, lineId, assemblyName}`), `bundleBreakdownData` (`'loading' | BundleBreakdown | null`).
- **Cross-region/shared state:** `applyBundleQuoteToLine` writes the rough line's `unitPrice` (clearing `sourceMaterialPartPriceId`); `openEditTemplateModal`.
- **Handlers/loaders:** load effect on `bundleBreakdownModal?.templateId` calling **`loadBundleBreakdown`** ([`lib/bids/assemblyBundleBreakdown.ts`](../src/lib/bids/assemblyBundleBreakdown.ts) — already extracted + tested).
- **Supabase tables:** via the lib helper only.
- **Extraction status + risk + approach:** Inline, **low risk** — data logic already lives in `lib`; a straight component move with three callbacks (`onApplyQuote`, `onEditAssembly`, `onClose`).

### Cost-estimate materials section + PO review modal

- **Render location:** `selectedBidForTakeoff && selectedBidForCostEstimate && costEstimateCountRows.length > 0` (~4040–4194): exact model → "MATERIALS BY STAGE" (three PO selects for `rough_in`/`top_out`/`trim_set` + per-stage and grand totals with tax); rough model → "MATERIALS" roll-up. The **PO review modal** (`costEstimatePOModalPoId`, ~4196–4340) shows a PO's items with editable tax and two print buttons. (Both blocks were moved here from the Labor tab.)
- **Owned local state:** `costEstimatePOModalPoId`, `costEstimatePOModalData`.
- **Cross-region/shared state:** engine `costEstimate`, `costEstimateCountRows`, `purchaseOrdersForCostEstimate`, `costEstimateMaterialTotalRoughIn/TopOut/TrimSet`, `setCostEstimatePO`; **shared controlled prop** `costEstimatePOModalTaxPercent`/setter (parent-owned; the Labor tab reads the same value).
- **Handlers/loaders:** effect on `costEstimatePOModalPoId` loading `purchase_order_items` (third copy of the items-summary mapping); print via `printCostEstimatePOForReview`/`printCostEstimatePOForSupplyHouse` ([`lib/bidDocuments/costEstimatePage.ts`](../src/lib/bidDocuments/costEstimatePage.ts) — already extracted).
- **Supabase tables:** `purchase_order_items` (select).
- **Quirks:** stage totals use `parseFloat(costEstimatePOModalTaxPercent || '8.25')` (default fallback **8.25**) while the PO review modal uses `parseFloat(...) || 0`; `' '.repeat(n)` alignment hacks; PO selects also list stage-`null` POs.
- **Extraction status + risk + approach:** Inline, **low-med risk — extract 2nd** as `BidsTakeoffMaterialsSummarySection` (+ the modal). Everything arrives via engine props already; keep `costEstimatePOModalTaxPercent` a controlled prop. Stage A: reuse the `loadPOItemsSummary` helper named under the exact region.

---

## Preserve-quirks list (load-bearing — do not "fix" during moves)

1. **Mapping identity dance:** `setTakeoffMapping` deletes + re-inserts (new UUID, `isSaved: false`) when template/stage changes on a saved mapping; `saveTakeoffMapping` upserts with `onConflict: 'count_row_id,template_id,stage,bid_version_id'` and back-fills the DB id. Both rows carry `bid_version_id: selectedBidVersionId` (null = unsplit Base).
2. **Bundle line sentinel:** a rough line with `partId == null && sourceTemplateId != null` is an opaque assembly bundle; `persistTakeoffRoughPartLine` and `updateTakeoffRoughPartLine` both encode this guard — keep them in sync. Grayed bundle part rows come from `bundlePartsByTemplateId`, are display-only, never persisted, never summed.
3. **Fire-and-forget persistence:** rough-line and mapping saves run inside `queueMicrotask`/floating promises from state setters — extraction must not make them awaited (UI intentionally doesn't block).
4. **Numpad ref mirrors:** `roughQtyNumpadLineIdRef`/`DraftRef` mirror state so window-scroll/drag-start listeners can commit the draft; blur uses a 150ms timeout that checks `document.querySelector('[data-rough-qty-pad="true"]')` focus containment. The qty input flips `type="number"` ↔ `type="text"` when the pad is active.
5. **One search query per picker family:** `takeoffTemplatePickerQuery`, `takeoffRoughPartSearchQuery`, and each modal's search state are single values shared across rows (only one dropdown opens at a time; all close via 150ms `onBlur` timeouts).
6. **`takeoffAddTemplateParts` double-loader:** the rough-mode effect keeps `part_types(*)` typing; the modal-open effect casts to `MaterialPart[]`. Last-write-wins; both key on `selectedServiceTypeId`.
7. **Rough table wrapper has NO `overflow: hidden`** (v2.1059) — restoring it re-clips the part-picker dropdown on last rows.
8. **Rough line totals multiply by `roughCountMultiplier(row.count)`**, and quantities clamp to min `0.0001` (fractional quantities are legal).
9. **`createPOFromTakeoff` PO-id linking** preserves existing `cost_estimates.purchase_order_id_*` via `?? est.purchase_order_id_* ?? null`, and only reloads the cost estimate when `activeTab` is `labor`/`takeoffs` and the same bid is selected for cost estimate.
10. **Tax fallback asymmetry:** `|| '8.25'` in the materials-section totals vs `|| 0` in the PO review modal (mirrors the Materials page quirk).
11. **`applyTakeoffBookTemplates` is exact-model-only** (rough shows a 4s message) and appends **unsaved** mappings — they persist only when the user later touches them (template already set, so `setTakeoffMapping` on any edit saves).
12. **`deleteTakeoffBookVersion` cascade:** clears the browse pointer, the bid's applied version (DB + `loadBids()`), and entries — all client-side bookkeeping on top of the DB cascade.
13. **partPricesModal close-edge refresh** (`prevPartPricesModalRef`) re-fetches rough catalog lowest prices so "lowest:" chips update after price edits.
14. **"Default" takeoff-book version** is undeletable purely by a `v.name !== 'Default'` render check.
15. **Part-merge duplication:** parts merge by `part_id` (nested templates may repeat) in `saveTakeoffNewTemplate`, `addTakeoffNewTemplateItem`, `addEditTemplateItem`, and `savePartsToTemplate` — four implementations of the same rule.

---

## Decomposition log (train state as of 2026-08-02)

Executed with the [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) process, mirroring the completed 12-PR Materials train (v2.1275–v2.1293). **BidsTakeoffTab.tsx: 5,765 → ~2,958 lines so far.**

| Step | PR | Version | What |
|---|---|---|---|
| T0 | #995 | — | Render-smoke safety net (`BidsTakeoffTab.render.test.tsx`, 4 tests over the ~53-prop seam) |
| T1 | #996 | v2.1294 | `lib/bids/poItemsSummary.ts` — the 3-copy PO-items summary |
| T2 | #997 | v2.1295 | `lib/bids/mergeTemplateItemDrafts.ts` — quirk-15's 4 merge variants |
| T3 | #999 | v2.1297 | `SortableRoughPartLineRow` → own file (+`PartType`/`RoughTakeoffMaterialPart` types) |
| T4 | #1000 | v2.1298 | `TakeoffBookAdminSection` (+2 modals, 11 states, CRUD; cascade quirk intact) |
| T5 | #1001 | v2.1299 | `BidsTakeoffMaterialsSummarySection` (+PO review modal; tax stays controlled prop) |
| T6 | #1002 | v2.1300 | `TakeoffPartPricesModal` + `TakeoffBundleBreakdownModal` (pointers stay parent-owned) |
| T7 | #1010 | v2.1306 | `TakeoffAssemblyAuthoringModals` (Add Assembly / Add Parts / Edit Template as one cluster; open pointers + PartFormModal-routed picker states + Save-as-Assembly bridge + seeded drafts stay parent-owned; Edit Template reset/loads → open-edge effect; preview modal stays for T8) |
| T8 | Takeoffs refresh PR 3 | v2.2770 | `hooks/useTakeoffPartsCatalog.ts` — `takeoffAddTemplateParts` + both paged loads, `supplyHouses`/`partTypes` + mount loads, the exact-model preview cache (the seam only; the Exact body stays inline — By Stage is 1 of 113 new bids and retires with Old) |
| T9 | Takeoffs refresh PR 3 | v2.2770 | `hooks/useTakeoffRoughLines.ts` — the whole Combined persistence engine (persist/update pair together, add/remove, drag reorder + its state, expand-to-parts, bundle insert/apply, the v2.2755 missing-part fallback); qty-numpad handlers, remove-confirm modal, and the PartForm-routed bridges stay in the tab |

**Remaining (in order):** — the seams below shipped in v2.2770 (`docs/TAKEOFFS_REFRESH_PLAN.md` PR 3); the *bodies* (Exact table, Rough sheet JSX) stay inline until Old retires, when the Exact body goes with it and the Rough sheet becomes New 2's table.
- **T8 — `useTakeoffPartsCatalog` seam, then the Exact body** (~800 lines, incl. the assembly parts preview modal). Seam owns `takeoffAddTemplateParts` + its two load effects, `supplyHouses`/`partTypes` mount effect, `takeoffTemplatePreviewCache`. Fold in the remaining Stage-A kernels as touched: `computeTakeoffBookMappingsToAdd`, `takeoffPickerFilters` (now passed as props into the T7 cluster — extract to lib and update both call sites), the exact-print row assembler.
- **T9 — the Rough body, last** (~1,150 lines). The `queueMicrotask` persistence pairs (`updateTakeoffRoughPartLine`/`persistTakeoffRoughPartLine` etc.) must move together or stay together; `takeoffRemoveConfirm` + modal stay tab-level (both models open it).

**Process notes for whoever continues:** one behavior-preserving PR per step; gates (`typecheck`/`lint`/`npm test` incl. the T0 smokes) before every push; check version claims against open AND recently-merged PRs (an untitled PR once took a claimed number); changelog conflicts are routine — slot your `v2.NNN` around what landed; branch protection requires up-to-date branches, so pair auto-merge with a loop that runs `gh pr update-branch` whenever `mergeStateStatus` goes `BEHIND`, and verify merges by polling for `state == MERGED` explicitly.

## Recommended extraction order (value ÷ risk)

1. **Stage A sweep** (each independently shippable; see table below). Highest-leverage: `loadPOItemsSummary` (3 call sites), `computeTakeoffBookMappingsToAdd`, `mergeTemplateItemDrafts`.
2. **`SortableRoughPartLineRow` → own file** — verbatim module move, ~650 lines, zero behavior risk.
3. **Takeoff-book admin section → `TakeoffBookAdminSection`** — self-contained CRUD + 2 modals (~440 lines); validates the prop seam.
4. **Cost-estimate materials section + PO review modal → `BidsTakeoffMaterialsSummarySection`** — engine props already flow; keep tax controlled.
5. **Part Prices modal → `TakeoffPartPricesModal`**, then **Bundle breakdown modal** — small self-contained modals with callback seams.
6. **Assembly authoring modal cluster** — after the small modals, since Edit Template opens Part Prices and Bundle Breakdown opens Edit Template.
7. **Parts-catalog seam (`useTakeoffPartsCatalog`)**, then **exact section**, then **rough section** — the two model bodies come out last, consuming the catalog hook + persistence functions + modal openers as props.

**What must STAY in `BidsTakeoffTab` (the sub-decomposition's parent):** the props seam to `Bids.tsx` (selection, engine, shared tax, `openMaterialsModelSwitch`), the parts/supply-house/part-type catalog loading (or its hook), the persistence functions if shared, `takeoffRemoveConfirm` + its modal (opened by both models), `PartFormModal` wiring + `handleBidsPartFormSave` (its post-save routing branches on which of FOUR contexts opened it: Add Parts modal / Edit Template / rough part picker / Add Assembly item picker), and the Save-as-Assembly handoff state (`saveAsAssemblyCountRowId`, `takeoffNewTemplateApplyPriceIndex`) that bridges the rough region and the Add Assembly modal.
**What stays in `Bids.tsx`** (unchanged, per the parent map): URL/deep-link routing, `selectedBidForTakeoff`, `costEstimatePOModalTaxPercent`, the materials-model switch confirm modal, the shared cost-estimate loader effect.

## Stage-A pure-logic inventory (→ `src/lib/*` + colocated tests)

| Candidate | Currently | Target |
|---|---|---|
| Takeoff-book fixture/alias matching + dedupe (`applyTakeoffBookTemplates` core loop) | inline async handler (still in tab header region) | `lib/bids/takeoffBookApply.ts` `computeTakeoffBookMappingsToAdd(...)` + tests — fold into T8 |
| `purchase_order_items` → `{part_name, quantity, price_at_time, template_name}` mapping (3 copies) | **done (v2.1294)** — [`lib/bids/poItemsSummary.ts`](../src/lib/bids/poItemsSummary.ts), all 3 call sites migrated | — |
| Part-merge-by-`part_id` rule (4 implementations, see quirk 15) | **done (v2.1295)** — [`lib/bids/mergeTemplateItemDrafts.ts`](../src/lib/bids/mergeTemplateItemDrafts.ts) (batch, updater, and DB-quantity forms) | — |
| `filterTemplatesByQuery`, `filterPartsByQuery`, `takeoffTemplatePickerOptions` | pure functions defined inside the component body | `lib/bids/takeoffPickerFilters.ts` + tests (note: near-duplicates exist in `Materials.tsx` — extract, don't unify, in this pass) |
| Exact-print stage/row shaping in `printTakeoffBreakdown` (post-`expandTemplate` sort + name mapping) | inline | pure builder-input assembler next to `lib/bidDocuments/takeoffBreakdown.ts` + test |
| PO naming ``` `${projectName} – Takeoff ${date} – ${stageLabel}` ``` + per-stage grouping in `createPOFromTakeoff` | inline | small pure helpers in `lib/bids/` (low value; optional) |

Already extracted + tested (do not re-derive): [`bidTakeoffHelpers.ts`](../src/lib/bids/bidTakeoffHelpers.ts) (`clampRoughQtyFromDraft`, `roughQtyToDraftString`, `normalizeMaterialsModel`, `takeoffFixtureCountLabel`, `mergePartLinesToTakeoffTemplateItems`, `roughCountMultiplier`, `STAGE_LABELS`), [`partAssemblyIndex.ts`](../src/lib/bids/partAssemblyIndex.ts), [`assemblyBundleBreakdown.ts`](../src/lib/bids/assemblyBundleBreakdown.ts), [`materialPartCatalogPrice.ts`](../src/lib/materialPartCatalogPrice.ts), [`materialPOUtils.ts`](../src/lib/materialPOUtils.ts) (`expandTemplate`, `addExpandedPartsToPO`, `getTemplatePartsPreview`), `lib/bidDocuments/takeoffBreakdown.ts` + `costEstimatePage.ts` + `htmlDoc.ts`.

Definition of done per extraction, verification gates (`npm run typecheck && npm run lint && npm test` after every step), and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md). Behavior-preserving only.
