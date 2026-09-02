# Materials Tabs Architecture Map

---
file: docs/MATERIALS_TABS_ARCHITECTURE.md
type: Engineering / Refactor Map
purpose: Map of the Materials.tsx decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md) — the decomposition is COMPLETE (12-PR train, v2.1275–v2.1293): every tab is an extracted component and src/pages/Materials.tsx is a ~2,123-line orchestration shell. This doc records what each tab owns (state, loaders, handlers, sub-components, supabase tables/RPCs, cross-tab coupling) and where everything landed.
audience: Developers, AI Agents
last_updated: 2026-09-02
---

## Overview

[`src/pages/Materials.tsx`](../src/pages/Materials.tsx) is a ~2,123-line orchestration shell (~80 `useState`) — down from ~6,935 lines / ~144 `useState` when this map was written. **The decomposition is COMPLETE** (12-PR train, v2.1275–v2.1293): every tab renders an extracted component in [`src/components/materials/`](../src/components/materials/), the data engines live in `useMaterialsCatalog` / `useMaterialsAssemblies` / `useMaterialsPurchaseOrders` hooks, and the parent keeps the shared modals, the deep-link router, and the cross-tab state. This map follows [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) and the format of [`BIDS_TABS_ARCHITECTURE.md`](./BIDS_TABS_ARCHITECTURE.md) / [`DASHBOARD_SECTIONS_ARCHITECTURE.md`](./DASHBOARD_SECTIONS_ARCHITECTURE.md). It is coupling/refactor-oriented; for feature/workflow behavior see [`PROJECT_DOCUMENTATION.md`](./PROJECT_DOCUMENTATION.md) §Materials Management and the Materials System section of [`GLOSSARY.md`](./GLOSSARY.md).

The page is tab-switched on a single `activeTab` state (search `const [activeTab, setActiveTab]`; the deep-link union is `const MATERIALS_TABS`):

```
'parts-book' | 'assembly-book' | 'assemblies-po' | 'purchase-orders' | 'supply-houses' | 'job-accounts' | 'po-generator'
```

Labels differ from keys: `parts-book` renders as **Parts Book** (the GLOSSARY's "Price Book" — the legacy `?tab=price-book` slug is rewritten to `parts-book` in the URL effect), `assemblies-po` renders as **PO Builder**, `po-generator` renders as **PO Generator**. Tab order in the UI is Supply Houses | Job Accounts | PO Generator ‖ Parts Book | Assembly Book | PO Builder | Purchase Orders. Note: the `assemblies-po` key was `assemblies-po` until v2.1258 (a legacy redirect at `Materials.tsx` ~line 1031 rewrites old `?tab=templates-po` links), and the label was "Assemblies & Purchase Orders" until the v2.1260 rename to **PO Builder**.

### Key structural differences from Bids

1. **No shared record pointer.** There is no `setSharedBid` equivalent; nothing like `?id=` is URL-synced. The only URL-driven selections are `?tab=`, `?po=<id>` / `location.state.openPOId` (opens a PO on the `purchase-orders` tab), `?addPart=true`, and `?addAssembly=true`.
2. **The shared substrate is data, not selection**: the service-type scope (`selectedServiceTypeId`) plus five caches loaded together per service type — `supplyHouses`, `partTypes`, `assemblyTypes`, `materialTemplates`, and `allPOs`/`draftPOs` — and the parts caches (`parts` paginated / `allParts` in Load All mode). See [Shared infrastructure](#shared-infrastructure).
3. **Two tabs share one selection anyway**: `selectedTemplate` + `templateItems` are read/written by BOTH `assembly-book` and `assemblies-po` (each renders its own detail UI off the same state), and `editingPO`/`selectedPO` are shared between `assemblies-po` and `purchase-orders`. These two pairs are the real coupling clusters.
4. **Every tab is extracted**: `supply-houses` was first ([`SupplyHousesTab`](../src/components/SupplyHousesTab.tsx), ~1,367 lines); the v2.1275–v2.1293 train brought the other five to the same end-state (see the master table).

### How to read a dossier

Each section lists: render location (anchored by symbol/JSX comment — line numbers are "as of v2.735" and rot; search the symbol), **owned local state** (moves with the tab), **cross-tab/shared state** (stays in the parent), **derived values**, **handlers/loaders**, **supabase tables/RPCs** (no realtime subscriptions exist anywhere on this page), **sub-components** (extracted vs inline), **external coupling**, and **extraction status + risk + approach** with Stage-A pure-logic candidates.

### How to maintain this doc

- Update the relevant dossier whenever a tab is extracted or its state/handlers change; flip its Status and point at the new file.
- Prefer symbol names over line numbers; when a line number appears, treat it as approximate and search for the symbol.

---

## Master summary table

| Tab key | Label | Render anchor | Approx inline lines | Status | Owned state (approx) | Cross-tab coupling | Risk | Recommended action |
|---|---|---|---|---|---|---|---|---|
| `supply-houses` | Supply Houses | `activeTab === 'supply-houses'` wrapper | ~9 | **extracted** (`SupplyHousesTab`) | 0 in parent | low (`handleNavigateToPOFromSupplyHouses` writes PO state) | — | Done; later fold the legacy Supply House modal (Parts Book) into it |
| `po-generator` | PO Generator | always-mounted `<MaterialsPoGeneratorTab active={…}>` | ~9 | **extracted (v2.1279)** ([`MaterialsPoGeneratorTab`](../src/components/materials/MaterialsPoGeneratorTab.tsx)) | 0 in parent | low (props: `supplyHouses`, `selectedServiceTypeId`, `myRole`, `onError`) | — | Done |
| `job-accounts` | Job Accounts | always-mounted `<MaterialsJobAccountsTab active={…}>` | ~15 | **born extracted (v2.2652)** ([`MaterialsJobAccountsTab`](../src/components/materials/MaterialsJobAccountsTab.tsx); kernel [`lib/materials/jobAccountsFlow.ts`](../src/lib/materials/jobAccountsFlow.ts)) | 0 in parent | low (`onOpenSupplyHouse` writes `supplyHouseToAutoOpen` + switches to supply-houses) | — | Done |
| `purchase-orders` | Purchase Orders | always-mounted `<MaterialsPurchaseOrdersTab active={…}>` | ~40 | **extracted (v2.1281)** ([`MaterialsPurchaseOrdersTab`](../src/components/materials/MaterialsPurchaseOrdersTab.tsx)); engine in [`useMaterialsPurchaseOrders`](../src/hooks/useMaterialsPurchaseOrders.ts) | 0 in parent | price-edit cluster + draft SH options stay parent-owned (written by shared `updatePOItemSupplyHouse`); deep-link router + `selectedPODetailRef` parent | — | Done |
| `parts-book` | Parts Book | always-mounted `<MaterialsPartsBookTab active={…}>` | ~35 | **extracted (v2.1286)** ([`MaterialsPartsBookTab`](../src/components/materials/MaterialsPartsBookTab.tsx)); engine in [`useMaterialsCatalog`](../src/hooks/useMaterialsCatalog.ts) (v2.1282) | 0 in parent | shared modals + openers + `expandedPartId` stay page-level as props | — | Done |
| `assembly-book` | Assembly Book | always-mounted `<MaterialsAssemblyBookTab>` (modal renders independent of `active`) | ~65 | **extracted (v2.1290)** ([`MaterialsAssemblyBookTab`](../src/components/materials/MaterialsAssemblyBookTab.tsx)); engine in [`useMaterialsAssemblies`](../src/hooks/useMaterialsAssemblies.ts) (v2.1288) | 0 in parent (pure JSX consumer) | addItemModal* cluster + handlers stay page-owned (shared `handlePartSaved` writes them) | — | Done |
| `assemblies-po` | PO Builder | `<MaterialsPoBuilderTab active={…}>` | ~90 | **extracted (v2.1293)** ([`MaterialsPoBuilderTab`](../src/components/materials/MaterialsPoBuilderTab.tsx)) | 0 in parent (pure JSX consumer, ~85 props) | every state atom/handler page-owned (intersection of both engines); Template Form modal page-level | — | Done — **decomposition complete** |

Page-level modals (stay in parent or move with a cluster): `PartFormModal` (extracted component; opened from parts-book, assembly-book, assemblies-po, and `?addPart=true`), Part Prices Modal (`viewingPartPrices` + in-file `PartPricesManager`; opened from parts-book, assembly-book, assemblies-po), Supply House Management Modal (`viewingSupplyHouses`, inline; opened from Parts Book toolbar; wraps extracted `SupplyHouseForm`), Template Form Modal (`templateFormOpen`, inline; opened from assembly-book, assemblies-po, and `?addAssembly=true`), Add Item to Assembly Modal (`addItemModalOpen`, inline; opened from assembly-book only).

---

## Per-tab dossiers

### `parts-book` — Parts Book (the Price Book)

- **Render location:** `{/* Parts Book Tab */}` block behind `activeTab === 'parts-book'` (~3092–3346); its modals (`PartFormModal`, Part Prices Modal, Supply House Management Modal) render unconditionally after it (~3348–3555).
- **Owned local state:** `searchQuery` (server-side search), `clientSearchQuery` (Load-All client search), `filterPartTypeId`, `filterManufacturer`, `sortByPriceCountAsc`, `partsPage`, `hasMoreParts`, `loadingPartsPage`, `loadingPartsRef`, `loadAllMode`, `loadingAllParts`. The Supply House Management Modal cluster (`viewingSupplyHouses`, `supplyHouseFormOpen`, `editingSupplyHouse`, 9 `supplyHouse*` field states, `savingSupplyHouse`, `supplyHouseStatsByServiceType`) is opened only from this tab's toolbar.
- **Cross-tab/shared state:** `parts` + `allParts` (the caches — also read by assembly-book detail, assemblies-po pickers, and the Add Item modal), `expandedPartId` (**shared with assembly-book**'s expandable part rows), `partFormOpen`/`editingPart`/`partFormInitialName` (shared modal), `viewingPartPrices` (shared modal), `supplyHouses`, `partTypes`, `selectedServiceTypeId`.
- **Derived values:** `sortedParts` (= `parts`; server-sorted), `displayParts` (Load-All client-side filter/sort IIFE), `manufacturers` (unique list from `allParts` falling back to `parts`).
- **Handlers/loaders:** `loadParts(page, options)` (paginated; price-count sort path uses RPC then slices IDs client-side), `loadAllParts`, `reloadPartsFirstPage` (useCallback), `fetchPricesForParts` (module-level batch price fetch, 500-ID chunks), `openAddPart`/`openAddPartWithName`/`openEditPart`/`handlePartSaved`, supply-house CRUD (`openSupplyHousesModal`, `openAddSupplyHouse`, `openEditSupplyHouse`, `saveSupplyHouseFromFormData`, `deleteSupplyHouse`, `loadSupplyHouseStatsByServiceType`). Effects: 300ms debounced search/filter reload; window-scroll infinite scroll (gated `activeTab === 'parts-book' && !loadAllMode`, 200px threshold, `loadingPartsRef` re-entry guard); Load-All preference restore from localStorage.
- **Supabase tables/RPCs:** `material_parts` (SELECT + `part_types(*)` join), `material_part_prices` (batch SELECT + `supply_houses(*)`), `supply_houses` (SELECT/INSERT/UPDATE/DELETE), RPC `get_parts_ordered_by_price_count` (price-count sort), RPC `get_supply_house_stats_by_service_type` (stats header). Via `PartPricesManager`: `material_part_prices` CRUD + `material_part_price_history` SELECT.
- **Sub-components:** `PartFormModal` (**extracted**), `SupplyHouseForm` (**extracted**, `variant="inline"` inside the inline Supply House modal), `SupplyHouseWebsiteLink` (**extracted**), [`PartPricesManager`](../src/components/materials/PartPricesManager.tsx) (**extracted v2.1280** — part price CRUD + per-supply-house price history viewer).
- **External coupling:** `location.state.refreshPrices` triggers `reloadPartsFirstPage` (set by other pages after price edits); `?addPart=true` deep link; localStorage key `` `materials_loadAllMode_${uid}` ``.
- **Extraction status:** **Done (v2.1286)** — [`MaterialsPartsBookTab`](../src/components/materials/MaterialsPartsBookTab.tsx), consuming the [`useMaterialsCatalog`](../src/hooks/useMaterialsCatalog.ts) engine (v2.1282), which the parent keeps (pickers in 3 other tabs read `parts`/`allParts`). The shared modals (`PartFormModal` wiring, Part Prices Modal, Supply House Management Modal) and their openers stay page-level as props. Stage A landed per the [inventory](#stage-a-pure-logic-inventory-extract-to-lib--tests-before-any-component-moves); `PartPricesManager` moved to its own file (v2.1280; its `onPricesUpdated` callback still patches `parts`/`allParts`/`templateItems` in the parent). The legacy Supply House Management Modal still duplicates `SupplyHousesTab` CRUD (see [quirks](#preserve-quirks-list)).

### `assembly-book` — Assembly Book

- **Render location:** `{/* Assembly Book Tab */}` block behind `activeTab === 'assembly-book'` (~3558–4122): filter/search toolbar, assembly card list with cost/status badges, and a right-hand detail panel (parts with expandable price rows, nested assemblies, cost summary, bundle prices, quick actions).
- **Owned local state:** essentially none exclusive. `editingItemQuantityId`/`editingItemQuantityValue` (inline qty editor) are used only here. The Add Item modal cluster (`addItemModal*`, 10 states) is opened only from this tab.
- **Cross-tab/shared state (the problem):** `selectedTemplate` + `templateItems` (**also the working selection of `assemblies-po`** — selecting an assembly here carries over there and vice versa), `templateSearchQuery`, `filterAssemblyTypeIds`, `filterIncludeEmpty`, `filterAssemblyTypeDropdownOpen` + `filterAssemblyTypeDropdownRef` (**the same ref/state instances are rendered by both this tab and `assemblies-po`** — legal only because one tab renders at a time), `materialTemplates`, `assemblyTypes`, `allTemplateItemsForStats`, `partIdToLowestPrice`, `parts`/`allParts` (part lookups + price display), `expandedPartId` (shared with parts-book), `viewingPartPrices`, `partFormOpen`/`editingPart`, `templateFormOpen` cluster.
- **Derived values:** `filteredTemplates` (empty/type/search filter — shared with assemblies-po), `templateIdsWithItems`, `partIdsWithNoPrice` (from the **paginated** `parts` cache — see quirks), `templatesWithItemsWithNoPrice` / `templateStatsTotal` / `templateStatsPctWithNoPrice`, and per-card `calculateAssemblyCost(templateId)` (recursive, cycle-guarded, closes over `allTemplateItemsForStats` + `partIdToLowestPrice`).
- **Handlers/loaders:** `loadMaterialTemplates`, `loadAssemblyTypes`, `loadTemplateItems(templateId)` (batch part/price/nested-template hydration), `loadAllTemplateItemsForStats` (effect-gated to `assemblies-po || assembly-book`), template CRUD (`openAddTemplate`, `openEditTemplate`, `saveTemplate`, `deleteTemplate`), item CRUD (`updateItemQuantity`, `removeItemFromTemplate` — optimistic delete, `closeAddItemModal`, `handleAddItemFromModal` — merges quantity into an existing part row instead of duplicating), `filterPartsByQuery` / `filterTemplatesByQuery` (pure filters defined inside the component body).
- **Supabase tables:** `material_templates`, `material_template_items`, `material_parts`, `material_part_prices`, `assembly_types` (cast `as any` — missing from generated types), and via `TemplatePricesManager`: `material_template_prices` CRUD.
- **Sub-components:** [`TemplatePricesManager`](../src/components/materials/TemplatePricesManager.tsx) (**extracted v2.1280** — assembly-level supply-house **bundle prices**, one row per supply house in `material_template_prices`; rendered by BOTH assembly-book and assemblies-po detail panels).
- **External coupling:** `?addAssembly=true` opens the Template Form Modal. Assembly bundle prices are consumed by Bids takeoffs ("adding this assembly as a bundle on a bid takeoff").
- **Extraction status:** **Done (v2.1290)** — [`MaterialsAssemblyBookTab`](../src/components/materials/MaterialsAssemblyBookTab.tsx), a pure JSX consumer of the [`useMaterialsAssemblies`](../src/hooks/useMaterialsAssemblies.ts) engine (v2.1288). The assembly cluster's shared state (`selectedTemplate`, `templateItems`, the shared filter states) stays parent-owned as controlled props (playbook rule: shared selection never moves); the `addItemModal*` cluster + handlers stay page-owned (shared `handlePartSaved` writes them). Stage A landed: `calculateAssemblyCost` → [`lib/materials/assemblyCost.ts`](../src/lib/materials/assemblyCost.ts), filters → [`lib/materials/materialsFilters.ts`](../src/lib/materials/materialsFilters.ts) (both v2.1276); `TemplatePricesManager` moved to its own file (v2.1280).

### `assemblies-po` — PO Builder

- **Render location:** `{/* Assemblies & PO Builder Tab */}` two-column grid behind `activeTab === 'assemblies-po'` (~4125–5023). Left: assembly list (second copy of the filter dropdown + search), selected-assembly items table with inline add-item form, bundle prices. Right: create-PO-from-template / add-template-to-PO buttons, draft PO list, `editingPO` draft detail with per-item qty/supply-house/price/notes editing. The Template Form Modal (~5027–5099) and Add Item modal (~5101–5372) follow.
- **Owned local state:** template add-item form (`newItemType`, `newItemPartId`, `templatePartSearchQuery`, `templatePartDropdownOpen`, `newItemTemplateId`, `newItemTemplateSearchQuery`, `newItemTemplateDropdownOpen`, `newItemFilterAssemblyTypeId`, `newItemQuantity`, `newItemNotes`, `addingItemToTemplate`), template form modal (`templateFormOpen`, `editingTemplate`, `templateName`, `templateDescription`, `templateAssemblyTypeId`, `savingTemplate` — also opened from assembly-book + `?addAssembly=true`), PO creation flags (`creatingPOFromTemplate`, `addingTemplateToPO`), draft-PO item editing (`editingPOItem`, `editingPOItemQuantity`, `editingPOItemSupplyHouse`, `editingPOItemPrice`, `editingPOItemNotesId`, `editingPOItemNotesValue`, `editingPOName`, `editingPONameValue`, `draftPOSupplyHouseOptionsPartId`, `draftPOSupplyHouseOptions`, `loadingDraftPOSupplyHouseOptions`), refs `templatePartPickerRef`, `templateItemsSectionRef`, `editingPODetailRef`.
- **Cross-tab/shared state:** everything in the assembly cluster (see assembly-book) **plus** the PO engine: `editingPO` (draft being edited here; also written by the `?po=` deep link, `duplicatePOAsDraft`, and `handleNavigateToPOFromSupplyHouses`), `selectedPO` (the purchase-orders view card), `draftPOs`, `allPOs`, `loadPurchaseOrders`.
- **Derived values:** `filteredTemplates` (shared), `templateIdsWithItems`, `partIdsWithNoPrice`-based per-template unpriced badges, PO totals computed inline per row.
- **Handlers/loaders:** `addItemToTemplate` (quantity-merge for existing parts, circular-reference guard, `sequence_order` = max+1), `createPOFromTemplate` / `createEmptyPO` / `addTemplateToPO` (template expansion via [`expandTemplate` + `addExpandedPartsToPO`](../src/lib/materialPOUtils.ts) — already-extracted pure-ish lib), `updatePOItem`, `removePOItem`, `updatePOName`/`startEditPOName`/`cancelEditPOName`, `loadSupplyHouseOptionsForPart` (per-part price options for the supply-house dropdown), `updatePOItemSupplyHouse` (optimistic 4-way state write to `selectedPO`/`editingPO`/`draftPOs`/`allPOs`, server-reload revert on error). Effect: `editingPO?.id` change reloads the PO's items.
- **Supabase tables:** `material_templates`, `material_template_items`, `purchase_orders` (INSERT/UPDATE), `purchase_order_items` (SELECT with `material_parts(*), supply_houses(*), source_template:material_templates!source_template_id` join — repeated ~10× in the file; CRUD), `material_part_prices`, `material_template_prices` (via `TemplatePricesManager`).
- **Sub-components:** `TemplatePricesManager` (in-file, shared), inline part/assembly picker dropdowns (near-duplicates of the Add Item modal pickers).
- **External coupling:** `duplicatePOAsDraft` (from purchase-orders tab) lands here via `setActiveTab('assemblies-po')` with the copy as `editingPO`.
- **Extraction status:** **Done (v2.1293)** — [`MaterialsPoBuilderTab`](../src/components/materials/MaterialsPoBuilderTab.tsx), the final PR of the train (it was extracted last, as this map recommended — it sits at the intersection of both clusters). A pure JSX consumer (~85 props): every state atom/handler stays page-owned, along with `selectedTemplate`, `editingPO`/`selectedPO`, and both shared modals (Template Form + Add Item, opened from 2+ tabs / URL params). Stage A landed: the repeated `purchase_order_items` join → [`lib/materials/poItemDetails.ts`](../src/lib/materials/poItemDetails.ts) `loadPOItemsWithDetails` (v2.1275, 12 call sites); `expandTemplate`/`addExpandedPartsToPO` gained tests in [`lib/materialPOUtils.test.ts`](../src/lib/materialPOUtils.test.ts) (v2.1277).

### `purchase-orders` — Purchase Orders

- **Render location:** `{/* Purchase Orders Tab */}` behind `activeTab === 'purchase-orders'` (~5375–5974): optional `selectedPO` detail card (notes, items table with draft-only supply-house/price editing + price confirmation, tax footer, print/delete/duplicate/finalize actions), then search/status-filter toolbar and the all-POs table.
- **Owned local state:** `poStatusFilter`, `poSearchQuery`, `viewedPOTaxPercent` (string, default `'8.25'`), `userNamesMap` (notes_added_by display names), `addingNotesToPO`, `notesValue`, `duplicatingPO`, `confirmingPriceForItem`, price-editing-in-place cluster (`editingPOItemSupplyHouseView`, `availablePricesForItem`, `loadingAvailablePrices`, `editingPricesByPriceId`, `updatingPriceId`, `addPriceSupplyHouseId`, `addPriceValue`, `addingNewPrice`), ref `selectedPODetailRef`.
- **Cross-tab/shared state:** the PO engine (`allPOs`, `draftPOs`, `selectedPO`, `editingPO`, `loadPurchaseOrders`) shared with `assemblies-po`; `supplyHouses` (add-price dropdowns); the `?po=` / `location.state.openPOId` deep-link effect writes `selectedPO` + `editingPO` and force-switches `activeTab` here.
- **Derived values:** `filteredPOs` (status + name search), per-row totals and with-tax totals computed inline.
- **Handlers/loaders:** `loadPurchaseOrders` (per-PO item loads in `Promise.all` + notes-author name lookup), `finalizePO` (status → `'finalized'`, immutable), `addNotesToFinalizedPO` (**add-only** notes: verifies `notes IS NULL` + `status = 'finalized'` both client-side and via `.is('notes', null)` guard on the UPDATE; stamps `notes_added_by`/`notes_added_at`), `deletePO`, `duplicatePOAsDraft` (sequential per-item copy, resets price confirmation, deletes the partial PO on any item failure, then jumps to `assemblies-po`), `printPO` (draft variant fetches ALL supply-house prices per item to print an "All prices / Chosen" comparison; finalized variant prints chosen only), `printPOForSupplyHouse` (chosen prices + tax footer), `updatePartPriceInBook` (price 0 ⇒ DELETE the price row), `addPartPriceFromPOModal`, `updatePOItemSupplyHouse` (shared), `confirmPOItemPrice` / `unconfirmPOItemPrice` (optimistic; confirm also inserts a zero-delta `material_part_price_history` row noting "Price confirmed via PO: <name>"), `formatTimeSince`, `handleNavigateToPOFromSupplyHouses` (entry point passed to `SupplyHousesTab`).
- **Supabase tables:** `purchase_orders` (SELECT/UPDATE/DELETE/INSERT), `purchase_order_items` (all verbs), `material_part_prices` (SELECT/UPDATE/DELETE/INSERT), `material_part_price_history` (INSERT), `users` (name lookups).
- **Sub-components:** `SupplyHouseWebsiteLink` (extracted). No other extracted pieces; the price-editing sub-table is inline.
- **External coupling:** deep-link senders verified in-repo: [`JobsPartsTab`](../src/components/jobs/JobsPartsTab.tsx) (`/materials?tab=purchase-orders&po=<id>`), [`BidsTakeoffTab`](../src/components/bids/BidsTakeoffTab.tsx) (`state: { openPOId }`), [`SupplyHousesTab`](../src/components/SupplyHousesTab.tsx) (prop callback, with a `state: { openPOId }` fallback). Finalized POs link onward to Projects ("Go to Projects to Add" — a raw `window.location.href = '/projects'` full reload).
- **Extraction status:** **Done (v2.1281)** — [`MaterialsPurchaseOrdersTab`](../src/components/materials/MaterialsPurchaseOrdersTab.tsx), with the PO-engine seam in [`useMaterialsPurchaseOrders`](../src/hooks/useMaterialsPurchaseOrders.ts) (`allPOs`/`draftPOs`/`selectedPO`/`editingPO` + `loadPurchaseOrders` + the reload-on-`editingPO.id` effect), which the parent keeps and passes to both this tab and `assemblies-po`. The `?po=`/`openPOId` deep-link router and `selectedPODetailRef` **stay in the parent** (playbook rule); the price-edit cluster + draft SH options stay parent-owned (written by shared `updatePOItemSupplyHouse`). Stage A landed: print builders → [`lib/materialsDocuments/poPrint.ts`](../src/lib/materialsDocuments/poPrint.ts), `formatTimeSince` → [`lib/formatTimeSinceAgo.ts`](../src/lib/formatTimeSinceAgo.ts) (both v2.1277), `loadPOItemsWithDetails` (v2.1275).

### `supply-houses` — Supply Houses (extracted)

- **Render location:** thin wrapper behind `activeTab === 'supply-houses' && (myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole))` — renders [`SupplyHousesTab`](../src/components/SupplyHousesTab.tsx) (~1,367 lines) with `supplyHouses`, `onSupplyHousesChange={loadSupplyHouses}`, `myRole`, `selectedServiceTypeId`, `onNavigateToPO={handleNavigateToPOFromSupplyHouses}`.
- **Owned local state (parent):** none — everything lives in the component (expanded-house detail, supply-house invoices CRUD with job allocations, monthly-payment-day "Due" column, PO list per house).
- **Cross-tab/shared state:** `supplyHouses` (parent cache, refreshed via callback), `selectedServiceTypeId` (note: the page-level service-type filter row is **hidden** on this tab — it doesn't scope by service type), PO navigation callback writes `editingPO`/`selectedPO`/`draftPOs`/`allPOs` and switches to `purchase-orders`.
- **Supabase tables (inside the component):** `supply_houses` (all verbs, with a legacy-column fallback SELECT), `supply_house_invoices` (CRUD), `supply_house_invoice_job_allocations`, `purchase_orders`, `purchase_order_items`, `material_part_prices`, `service_types`, and `material_po_generator_entries` — invoice **Purchase Order #** fields are parsed with [`parsePoGeneratorCodeFromPurchaseOrderName`](../src/lib/parsePoGeneratorCodeFromPurchaseOrderName.ts) and matched against the PO Generator ledger; unmatched generator-style codes render a red warning (see GLOSSARY "PO Generator ledger").
- **Extraction status:** **Done.** Remaining cleanup (separate, optional): the Parts Book toolbar's inline Supply House Management Modal duplicates this component's CRUD + stats; folding it into `SupplyHousesTab` (or deleting it in favor of tab navigation) would remove ~250 parent lines and the 9-field `supplyHouse*` state cluster — but that is a behavior change, so it is NOT part of the behavior-preserving decomposition.

### `job-accounts` — Job Accounts (born extracted, v2.2652)

- **Render location:** always-mounted `<MaterialsJobAccountsTab active={activeTab === 'job-accounts'}>` (returns null when inactive or for non-office roles); tab button sits between Supply Houses and PO Generator.
- **What it is:** per-job money flow — `jobs_ledger.revenue`/`payments_made` (customer side) against `supply_house_invoice_job_allocations` × `supply_house_invoices` (supplier side). Headline: "holding for suppliers" = unpaid supplier balances on jobs the customer has paid (held = min(owed, paidIn) per job). Statuses `owe_suppliers` / `floating` / `awaiting_customer` / `settled`; unpaid invoices allocated to neither a job nor a bid surface as an explicit "unallocated" bucket.
- **Owned local state:** everything (`view`, `filter`, `expandedJobId`, `loading`, `error`, one-shot `loadStartedRef`); loads on first activation with `fetchAllRows`/`fetchAllRowsChunkedIn` + `withSupabaseRetry`. Nothing in the parent.
- **Pure kernel:** [`lib/materials/jobAccountsFlow.ts`](../src/lib/materials/jobAccountsFlow.ts) (`buildJobAccountsView`, `classifyJobAccount`; tested) — reuses `agingBucketFor` from [`lib/supplyHouseAging.ts`](../src/lib/supplyHouseAging.ts); allocation pct is 0–100.
- **Supabase tables:** `supply_house_invoices`, `supply_house_invoice_job_allocations`, `supply_house_invoice_bid_allocations` (ids only, to exclude bid-tied invoices from "unallocated"), `supply_houses`, `jobs_ledger` (chunked `.in()` on allocated job ids). All read-only.
- **External coupling:** `onOpenSupplyHouse(houseId | null)` → parent sets `supplyHouseToAutoOpen` and switches to `supply-houses`; `SupplyHousesTab` gained `autoOpenHouseId`/`onAutoOpenHouseHandled` (auto-opens that house's detail once the list has it). Job titles and the expanded statement's **Open job** open the global job window via `useJobFormModal().openEditJob(jobId, { onSaved: reload })` (v2.2657; `/jobs?tab=stages&edit=<id>` navigation is the no-provider fallback). Like Supply Houses, the page-level service-type filter row is hidden on this tab.

### `po-generator` — PO Generator

- **Render location:** behind `activeTab === 'po-generator' && (myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole))` (~5977–6385): a generate card (job picker, user picker, optional supply-house picker, notes) + the ledger table.
- **Owned local state:** the `poGen*` cluster — `poGenJobSearch`/`poGenJobResults`/`poGenJobSearchLoading`/`poGenSelectedJob`, `poGenUserSearch`/`poGenUserResults`/`poGenUserSearchLoading`/`poGenSelectedUser`, `poGenSelectedSupplyHouse`/`poGenSupplyHouseSearch`, `poGenNotes`, `poGenGenerating`, `poGenLedger`, `poGenLedgerLoading`. All four `po-generator` effects (ledger load, 300ms-debounced job search, 300ms-debounced user search, selected-job service-type invalidation) are gated on `activeTab === 'po-generator'` and move with the tab.
- **Cross-tab/shared state:** reads `supplyHouses` (client-side search via the `poGenSupplyHouseResults` memo — the page's only `useMemo`), `selectedServiceTypeId`, `myRole`; uses `showToast` and `setError`.
- **Handlers/loaders:** `loadPoGeneratorLedger` (useCallback; role- and service-type-gated; newest-200 rows via `jobs_ledger!inner` service-type filter), `handlePoGeneratorGenerate` (RPC insert; blocks when the selected job's service type mismatches; toasts the new `po_code`).
- **Supabase tables/RPCs:** `material_po_generator_entries` (SELECT with `jobs_ledger!inner`, `users` ×2 FK-named joins, `supply_houses`), RPC `search_jobs_ledger` (job search — results then filtered client-side by service type via a second `jobs_ledger` SELECT), `users` (ILIKE search, `%`/`_` escaped), RPC `insert_material_po_generator_entry` (allocates the unique shop code, 10000–99999 per GLOSSARY).
- **Sub-components:** none; pickers are inline.
- **External coupling:** ledger codes are what `SupplyHousesTab` invoice PO-number warnings match against (read path only — no shared client state; the coupling is via the DB table).
- **Extraction status:** **Done (v2.1279)** — [`MaterialsPoGeneratorTab`](../src/components/materials/MaterialsPoGeneratorTab.tsx), props `active`/`myRole`/`supplyHouses`/`selectedServiceTypeId`/`onError`, toasts via `useToastContext` inside. **Always mounted** (parent renders it unconditionally; it returns null when inactive) so form state survives tab switches; the former `activeTab === 'po-generator'` effect gates became `active` gates. The `PoGenerator*` types moved with it.

---

## Shared infrastructure

The "API surface" any extracted tab must be handed.

### Role + service-type scope (parent, permanent)

- `myRole` (`loadRole`): page allows `dev`, `master_technician`, assistant-like (`assistant`/`controller` via [`isAssistantLike`](../src/lib/subcontractorLikeRole.ts)), `estimator`, `primary`, `superintendent`; everyone else gets "Access denied".
- Per-role service-type restriction arrays from the `users` row: `estimator_service_type_ids`, `primary_service_type_ids`, `superintendent_service_type_ids` → `visibleServiceTypes` filter (NULL/empty = all).
- `serviceTypes` + `selectedServiceTypeId`: the master scope. The service-type button row is hidden on `supply-houses`. Changing it clears part filters, resets pagination, clears both parts caches, and reloads the six common loaders in parallel (`loadSupplyHouses`, `loadPartTypes`, `loadAssemblyTypes`, `loadMaterialTemplates`, `loadPurchaseOrders`, `loadSupplyHouseStatsByServiceType`) + parts (paged or Load-All).

### Tab gating (verify against the tab-button JSX + the `searchParams` guard effect)

| Tab | dev / master_technician / assistant-like | estimator | primary / superintendent |
|---|---|---|---|
| Parts Book | ✅ | ✅ | ✅ |
| Assembly Book | ✅ | ✅ | ✅ |
| PO Builder (`assemblies-po`) | ✅ | ✅ | ❌ (button hidden + URL redirect) |
| Purchase Orders | ✅ | ✅ | ❌ (button hidden + URL redirect) |
| Supply Houses | ✅ | ❌ (hidden + redirect) | ❌ (hidden + redirect) |
| Job Accounts | ✅ | ❌ (hidden + redirect) | ❌ (hidden + redirect) |
| PO Generator | ✅ | ❌ (hidden + redirect) | ❌ (hidden + redirect) |

The URL guard effect rewrites disallowed `?tab=` values to `parts-book` (`replace: true`) and rewrites the legacy `price-book` slug. `supply-houses`/`po-generator` render gates additionally re-check the role inline.

### URL / navigation router (parent, permanent)

- `?tab=` sync (every tab button writes it; the guard effect reads it).
- `?po=<id>` **or** `location.state.openPOId` → force `purchase-orders`, load the PO + items, set `editingPO` + `selectedPO`, seed it into `draftPOs`/`allPOs` if missing, double-`requestAnimationFrame` scroll to `selectedPODetailRef`, then strip the param/state.
- `?addPart=true` → open `PartFormModal`; `?addAssembly=true` → open the Template Form Modal (both strip the param).
- `location.state.refreshPrices` → `reloadPartsFirstPage()`.

### Seam hook candidates

1. **`useMaterialsCatalog`** (parts + reference data): `parts`, `allParts`, `loadAllMode` + localStorage persistence, pagination state/refs, `loadParts`/`loadAllParts`/`reloadPartsFirstPage`, `partTypes`, `assemblyTypes`, `supplyHouses`, `serviceTypes`/`selectedServiceTypeId`, and the service-type-change master-reload effect. Consumed by every tab; the parent destructures it so downstream references don't change.
2. **`useMaterialsAssemblies`** (assembly cluster): `materialTemplates`, `selectedTemplate`, `templateItems`, `allTemplateItemsForStats`, `partIdToLowestPrice`, shared filters (`templateSearchQuery`, `filterAssemblyTypeIds`, `filterIncludeEmpty`), `loadMaterialTemplates`/`loadTemplateItems`/`loadAllTemplateItemsForStats`, template CRUD. Consumed by `assembly-book` + `assemblies-po` + the Add Item modal.
3. **`useMaterialsPurchaseOrders`** (PO engine): `allPOs`, `draftPOs`, `selectedPO`, `editingPO`, `userNamesMap`, `loadPurchaseOrders`, the `editingPO.id` reload effect, and a shared `loadPOWithItems` lib helper. Consumed by `assemblies-po` + `purchase-orders` + the deep-link router + `handleNavigateToPOFromSupplyHouses`.

### Stage-A pure-logic inventory (extract to `lib/*` + tests before any component moves)

| Candidate | Currently | Target |
|---|---|---|
| `calculateAssemblyCost` (recursive, cycle guard) | **done (v2.1276)** — [`lib/materials/assemblyCost.ts`](../src/lib/materials/assemblyCost.ts); Materials keeps a thin closure wrapper | — |
| `filterPartsByQuery`, `filterTemplatesByQuery` | **done (v2.1276)** — [`lib/materials/materialsFilters.ts`](../src/lib/materials/materialsFilters.ts) | — |
| `displayParts` Load-All filter/sort IIFE | **done (v2.1276)** — `computeLoadAllDisplayParts` in [`lib/materials/materialsFilters.ts`](../src/lib/materials/materialsFilters.ts) | — |
| `fetchPricesForParts` (chunked batch fetch) | **done (v2.1277)** — [`lib/materials/partPrices.ts`](../src/lib/materials/partPrices.ts) (takes supabase; + `fetchPricesForPart`) | — |
| `purchase_order_items` join + `itemsWithDetails` mapping (~10 copies) | **done (v2.1275)** — [`lib/materials/poItemDetails.ts`](../src/lib/materials/poItemDetails.ts) `loadPOItemsWithDetails` (+ `POItemWithDetails`/`PurchaseOrderWithItems` types), 12 call sites migrated | — |
| `printPO` / `printPOForSupplyHouse` HTML builders | **done (v2.1277)** — [`lib/materialsDocuments/poPrint.ts`](../src/lib/materialsDocuments/poPrint.ts); page keeps `openPrintWindow` + the draft price prefetch | — |
| supply-house stats grouping (`loadSupplyHouseStatsByServiceType`) | **done (v2.1277)** — [`lib/materials/supplyHouseStats.ts`](../src/lib/materials/supplyHouseStats.ts) `groupSupplyHouseStats` | — |
| `formatTimeSince`, `formatCurrency` | **done (v2.1277)** — `formatCurrency` was identical to [`lib/format.ts`](../src/lib/format.ts)'s (now imported); `formatTimeSince` → [`lib/formatTimeSinceAgo.ts`](../src/lib/formatTimeSinceAgo.ts) (distinct from dashboard's suffix-less variant) | — |
| `expandTemplate` / `addExpandedPartsToPO` | **done (v2.1277)** — 7 tests added in [`lib/materialPOUtils.test.ts`](../src/lib/materialPOUtils.test.ts) | — |

---

## Preserve-quirks list (odd but load-bearing — do not "fix" during the move)

1. **Load All mode defaults OFF** and is persisted per-user in localStorage (`materials_loadAllMode_${uid}`) — the v2.46 Supabase **disk-IO optimization** (see `RECENT_FEATURES.md` v2.46: "Supabase disk IO optimizations, Materials batching, Load All default off"). Paginated mode is the default precisely to keep IO down; `fetchPricesForParts` batching (500-ID `.in()` chunks + client re-sort, since chunked results aren't globally ordered) and `loadAllTemplateItemsForStats` scoping to the selected service type are part of the same optimization wave. Keep the batch sizes and the default.
2. **`PARTS_PAGE_SIZE = 50` + window-scroll infinite scroll** with a `loadingPartsRef` re-entry guard and a 200px bottom threshold; the effect is gated off in Load All mode. A comment notes virtualization was considered and deliberately skipped ("works well for <5000 parts").
3. **Price-count sort is a special path**: only when `sortByPriceCountAsc` is on AND no part-type/manufacturer filter, `loadParts` calls RPC `get_parts_ordered_by_price_count` for the full ordered ID list and slices pages client-side. With filters active the flag is silently ignored.
4. **`supply_houses` SELECT has a legacy fallback**: on error it retries without `monthly_payment_day` and stubs the column with `null` (schema backward-compat — both here and inside `SupplyHousesTab`). `assembly_types` is queried with `as any` (table missing from generated types).
5. **`partIdsWithNoPrice` is computed from the paginated `parts` cache**, so assembly "unpriced parts" badges/stats only know about pages loaded so far (accurate in Load All mode). Behavior-preserving extraction must keep this data source.
6. **Tax-percent inconsistency**: `viewedPOTaxPercent` defaults to `'8.25'`; the `selectedPO` footer uses `parseFloat(...) || 0` while the all-POs table rows use `parseFloat(...) || 8.25`. Preserve both fallbacks as-is.
7. **`filterAssemblyTypeDropdownRef` + the assembly filter states are rendered in two tabs** (assembly-book AND assemblies-po). Works because only one tab mounts at a time; when splitting, either lift to the shared hook or give each tab its own instance *only if* preserving the carry-over of filter state between the two tabs (current behavior: filters persist across the tab switch).
8. **Add-only PO notes**: `addNotesToFinalizedPO` re-fetches and verifies `status === 'finalized' && notes === null`, then UPDATEs with `.eq('status','finalized').is('notes', null)` as a race guard. Notes are immutable once set.
9. **Price confirmation writes history**: `confirmPOItemPrice` inserts a zero-delta `material_part_price_history` row (`old_price = new_price`, `price_change_percent: 0`, note "Price confirmed via PO: …") in parallel with the item update, and tolerates history-insert failure. `updatePartPriceInBook` treats price `0` as **delete the price row**.
10. **`duplicatePOAsDraft` copies items sequentially** (one INSERT per item), intentionally does NOT copy `price_confirmed_at/by`, deletes the partially-created PO if any item fails, and finishes by switching to `assemblies-po` with the copy as `editingPO`.
11. **Draft `printPO` fires one price query per item** (`Promise.all` of `fetchPricesForPart`) to print the "All prices" column. N+1 by design for drafts; finalized print is single-pass.
12. **Optimistic multi-target writes**: `updatePOItemSupplyHouse` patches up to four state slices (`selectedPO`, `editingPO`, `draftPOs`, `allPOs`) and reverts by server reload on error. `handleNavigateToPOFromSupplyHouses` and the `?po=` router seed `draftPOs`/`allPOs` with the fetched PO before `loadPurchaseOrders` settles.
13. **Double-`requestAnimationFrame` scroll** to `selectedPODetailRef` after PO deep-links (lets the tab switch paint first).
14. **`addItemToTemplate`/`handleAddItemFromModal` merge quantities** when the part already exists in the assembly instead of inserting a duplicate row, and block adding an assembly to itself (direct self-reference only — deeper cycles are handled at cost-calc time by `calculateAssemblyCost`'s `visited` set).
15. **"Go to Projects to Add"** uses `window.location.href = '/projects'` (full page reload, not router navigation).
16. **Parts Book toolbar hosts a legacy Supply House Management Modal** whose CRUD + RPC-stats duplicate `SupplyHousesTab`. The button is visible to every role with Parts Book access, so estimators, primaries, and superintendents (who cannot see the Supply Houses tab) reach supply-house editing through this modal — removing it would be a permissions behavior change, not a refactor.

---

## Recommended extraction order (value ÷ risk)

> **All six steps landed, in this order, as the v2.1275–v2.1293 train** — kept for the record.

1. **Stage A sweep** — the [pure-logic inventory](#stage-a-pure-logic-inventory-extract-to-lib--tests-before-any-component-moves) above, in any order; each is independently shippable. Highest-leverage: `loadPOWithItems` (~10 call sites), `assemblyCost`, `poPrint`.
2. **`po-generator` → `MaterialsPoGeneratorTab`** — self-contained state + 4 gated effects; smallest prop surface; validates the seam.
3. **In-file components to their own files** — `PartPricesManager` and `TemplatePricesManager` are already self-contained; pure file moves.
4. **PO engine seam (`useMaterialsPurchaseOrders`) → extract `purchase-orders` tab** — deep-link router and `handleNavigateToPOFromSupplyHouses` stay in the parent.
5. **Parts-catalog seam (`useMaterialsCatalog`) → extract `parts-book` tab** — the shared modals (`PartFormModal` wiring, Part Prices Modal, Supply House Management Modal) stay in the parent (opened from 3 tabs / URL).
6. **Assembly seam (`useMaterialsAssemblies`) → extract `assembly-book`, then `assemblies-po`** — `selectedTemplate` stays parent-owned as a controlled prop; the Template Form + Add Item modals stay page-level.

Definition of done per tab, verification gates, and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) (typecheck + lint + `npm test` green after every step; behavior-preserving only).
