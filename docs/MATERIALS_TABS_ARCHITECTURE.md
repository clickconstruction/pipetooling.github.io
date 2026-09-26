# Materials Tabs Architecture Map

---
file: docs/MATERIALS_TABS_ARCHITECTURE.md
type: Engineering / Refactor Map
purpose: Map of the Materials page after its decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md) — what src/pages/Materials.tsx still owns (parent regions, each tab's parent seam and prop bag, the inline modals, the URL router, the three seam hooks) and a region map of the largest file left on the page, src/components/SupplyHousesTab.tsx (the office Supply houses tab, also mounted by Quickfill), with test coverage per region and the next extraction order.
covers:
  - src/pages/Materials.tsx
  - src/components/SupplyHousesTab.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-25
---

## Overview

[`src/pages/Materials.tsx`](../src/pages/Materials.tsx) is a **2,012-line** orchestration shell — one component `Materials` (56–2012) whose render is 1352–2011 (660 lines) — down from ~6,935 lines / ~144 `useState` when this map was first written. The 12-PR train (v2.1275–v2.1293) extracted every tab into [`src/components/materials/`](../src/components/materials/); since then two tab bodies were **born extracted** (Held for suppliers v2.2652, the estimator's Directory-only Supply houses v2.3167) and **no tab moved back inline**. What the parent still holds: the three seam-hook destructures, 69 `useState` of cross-tab and PO Builder working state, the handlers that write them (R13–R14, ~645 lines), the URL router, three inline modals, and the tab strip.

[`src/components/SupplyHousesTab.tsx`](../src/components/SupplyHousesTab.tsx) is **1,898 lines** (`SupplyHousesTab` 156–1898, render 825–1897 = 1,073 lines), up from ~1,367 — now the largest file on the page. It holds the Directory pane (extracted child) above the Accounts payable pane (aging heat map, summary table, expanded house detail), the Add/Edit Invoice form (a 428-line render block) and Apply Payment. Largest adds since 2026-09-01 (`git log --numstat`): invoice form rebuilt around the paper (74af85436, +320/−231), credits form (v2.3503, +113/−19), on-job-account flag (v2.2669, +98), job-account flag defaulting (0695307fa, +91/−31), PO codes stated need (v2.3599, +65/−10), aging job-account share (660226ec1, +49/−5), Directory pane split (8c6132147, +41/−160), form scroll-in-panel fix (052e7779d, +39/−23), summary sort (v2.3604, +38/−8), PO codes by job (v2.3724, +34/−1). Churn: 34 commits in 90 days (Materials.tsx: 36).

This map is coupling/refactor-oriented and follows [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md); for feature/workflow behavior see [`PROJECT_DOCUMENTATION.md`](./PROJECT_DOCUMENTATION.md) §Materials Management and the Materials System section of [`GLOSSARY.md`](./GLOSSARY.md).

> **Line numbers are as of `a05cef4c4`** (the `mapped_at` commit) and drift with every edit — search the symbol named beside each range. Regenerate the fact sheets with `npm run map -- src/pages/Materials.tsx` / `npm run map -- src/components/SupplyHousesTab.tsx`.

**Hook census (fact sheets @ a05cef4c4):**

| File | Lines | `useState` | `useReducer` | effects | `useMemo` | `useCallback` | `useRef` | custom hooks | handlers | local imports |
|---|---|---|---|---|---|---|---|---|---|---|
| `Materials.tsx` | 2,012 | 69 | 0 | 11 | 0 | 0 | 4 | 8 | 35 | 23 |
| `SupplyHousesTab.tsx` | 1,898 | 44 | 0 | 11 | 3 | 0 | 1 | 9 | 20 | 30 |

**Data, parent:** `users`, `service_types`, `purchase_orders`, `material_templates`, `material_template_items`, `purchase_order_items`, `material_part_prices`; RPC `get_supply_house_stats_by_service_type` (called `as any` at 331 — the fact sheet's RPC column misses it). **Data, SupplyHousesTab:** `supply_houses`, `supply_house_contacts`, `job_supply_house_accounts`, `service_types`, `supply_house_invoices`, `supply_house_invoice_job_allocations`, `purchase_orders`, `purchase_order_items`, `material_po_generator_entries`; RPCs `search_jobs_ledger`, `get_jobs_ledger_by_ids`. No realtime subscriptions, no edge functions in either file.

The page is tab-switched on one `activeTab` state (63–65, the seven keys spelled literally rather than as the kernel's `MaterialsTab` type); the canonical list is `MATERIALS_TABS` in [`lib/materials/materialsTabs.ts`](../src/lib/materials/materialsTabs.ts):

```
'parts-book' | 'assembly-book' | 'assemblies-po' | 'purchase-orders' | 'supply-houses' | 'job-accounts' | 'po-generator'
```

Labels differ from keys: `parts-book` is **Parts Book** (the GLOSSARY's "Price Book"; the `?tab=` guard effect rewrites the legacy `price-book` slug, 368–377), `assemblies-po` is **PO Builder** (the key was `templates-po` until v2.1258; rewritten at 380–389; the label read "Assemblies & Purchase Orders" until v2.1260), `po-generator` is **PO Generator**, `job-accounts` is **Held for suppliers** (v2.3641; it read *Job Accounts* until a job account came to mean the account at the supply house), `supply-houses` is **Supply houses**. Pill order: Supply houses | Held for suppliers | PO Generator ‖ Parts Book | Assembly Book | PO Builder | Purchase Orders. The three PO-named tabs each open with a one-line [`MaterialsPoLaneSignpost`](../src/components/materials/MaterialsPoLaneSignpost.tsx) (v2.2903): PO Generator mints the **counter code**; PO Builder → Purchase Orders is the **line-item** lane (and feeds bid cost estimates via `cost_estimates.purchase_order_id_*`), so neither tab may be hidden — the signpost is the disambiguation.

### Key structural differences from Bids

1. **No shared record pointer.** Nothing like `?id=` is URL-synced. The URL-driven selections are `?tab=`, `?po=<id>` / `location.state.openPOId` (opens a PO on `purchase-orders`), `?addPart=true`, `?addAssembly=true`, and `location.state.refreshPrices`.
2. **The shared substrate is data, not selection**: the service-type scope (`selectedServiceTypeId`) plus the caches the three seam hooks hold — parts/`allParts`, `partTypes`, `assemblyTypes`, `supplyHouses` (catalog); `materialTemplates`, `templateItems`, stats caches (assemblies); `allPOs`/`draftPOs` (POs). See [Shared infrastructure](#shared-infrastructure).
3. **Two tabs share one selection anyway**: `selectedTemplate` + `templateItems` are read/written by BOTH `assembly-book` and `assemblies-po`, and `editingPO`/`selectedPO` are shared between `assemblies-po` and `purchase-orders`. These two pairs are the real coupling clusters.
4. **Every tab is extracted; `supply-houses` has two bodies by role** — the office gets [`SupplyHousesTab`](../src/components/SupplyHousesTab.tsx) (Directory + Accounts payable), the estimator gets [`MaterialsSupplyHouseDirectoryTab`](../src/components/materials/MaterialsSupplyHouseDirectoryTab.tsx) (54 lines, Directory only), switched by `supplyHousesPaneFor(myRole)`.

### How to read a dossier

Each tab section lists: **parent JSX** (range + prop count), **parent-owned state/handlers** for the tab (stay or move per the playbook), **inside the child** (what already lives in the extracted file), **data**, **external coupling**, and **status**. Only the two covered files carry line numbers; child files are named, not ranged.

### How to maintain this doc

- Refresh with `npm run map` on both covered files and bump `mapped_at`; anchor every range by symbol.
- When a region leaves the parent (or SupplyHousesTab), flip its row in the region map and its line in [Recommended extraction order](#recommended-extraction-order-value--risk).

---

## Parent region map (`Materials.tsx`)

| # | Region (search symbol) | Lines | Size | Holds | Status |
|---|---|---|---|---|---|
| R0 | Imports + module scope — type aliases (30–35), `ServiceType` (37–45), "now lives in …" relocation comments (48–53) | 1–55 | 55 | 23 local imports | — |
| R1 | Page hooks + role/scope — `useAuth`…`useSearchParams` (57–61), `myRole`, `activeTab`, `supplyHouseToAutoOpen` (67), `loading`, `error`, `serviceTypes`, `selectedServiceTypeId`, three `*ServiceTypeIds` (74–76) | 56–76 | 21 | 10 `useState` | inline (by design) |
| R2 | `useMaterialsCatalog` destructure (31 bindings; inputs `activeTab`, `authUserId`, `selectedServiceTypeId`, `setError`) | 78–117 | 40 | | seam (done) |
| R3 | Part/shared-modal state — `editingPart`, `partFormOpen`, `partFormInitialName`, `viewingPartPrices`, `expandedPartId`, `editingItemQuantityId/Value`, `supplyHouseStatsByServiceType` (127–140), `viewingSupplyHouses` (145) | 119–145 | 27 | 9 `useState` | inline |
| R4 | `useMaterialsAssemblies` destructure (19 bindings) + `draftPOSearch` (175) | 147–175 | 29 | 1 `useState` | seam (done) |
| R5 | Template-form + PO Builder working state — template form (178–183, 6), add-item form + PO-create flags + draft-item editing (184–202, 19), price-edit cluster (203–210, 8), draft supply-house options (211–213, 3), PO name edit (214–215, 2) | 176–215 | 40 | 38 `useState` | inline — **largest state block** |
| R6 | Add Item modal state (218–228, 11) + refs `templatePartPickerRef`, `templateItemsSectionRef`, `editingPODetailRef`, `selectedPODetailRef` (230–233) | 217–233 | 17 | 11 `useState`, 4 refs | inline |
| R7 | `useMaterialsPurchaseOrders` destructure (11 bindings) | 235–249 | 15 | | seam (done) |
| R8 | Loaders — `loadRole` (253–293, `users`), `loadServiceTypes` (295–326, `service_types`), `loadSupplyHouseStatsByServiceType` (329–340, RPC), `handleNavigateToPOFromSupplyHouses` (342–359, `purchase_orders` + `loadPOItemsWithDetails`) | 253–359 | 107 | | inline |
| R9 | Effects (11) — role load (361–363), `?tab=` guard (365–414), `?addPart` (416–427), `?addAssembly` (429–442), initial load (444–458), service-type master reload (462–487), `refreshPrices` (489–493), selected-template items (497–501), stats gate (503–507), **`?po=`/`openPOId` router (512–558, `purchase_orders`)**, template-part picker outside-click (561–570) | 361–570 | 210 | | inline (router by design) |
| R10 | Early returns — `loading`, `canAccessMaterials` | 575–581 | 7 | | inline |
| R11 | Derived assembly stats — `templateIdsWithItems` (588), `filteredTemplates` (591–607), `partIdsWithNoPrice` + `templateStats*` (610–617), `calculateAssemblyCost` wrapper over the kernel (622–628) | 583–628 | 46 | | inline — Stage A candidate |
| R12 | Openers — `openAddPart`/`openAddPartWithName`/`openEditPart` (631–649), `handlePartSaved` (651–662), `handlePartSavedAndAddAnother` (665–671), `canOpenPoGenerator`/`openPoGeneratorTab` (675–685), `openSupplyHousesModal` (688–691) | 630–691 | 62 | | inline |
| R13 | Assembly actions — `openAddTemplate`/`openEditTemplate`/`closeTemplateForm` (694–714), `saveTemplate` (716–757), `deleteTemplate` (759–777), `updateItemQuantity` (779–799), `addItemToTemplate` (801–879), `closeAddItemModal` (881–891), `handleAddItemFromModal` (893–959), `removeItemFromTemplate` (961–975) | 693–975 | 283 | `material_templates`, `material_template_items` | inline |
| R14 | PO actions — `createPOFromTemplate` (979–1015), `createEmptyPO` (1017–1050), `addTemplateToPO` (1052–1082), `updatePOItem` (1084–1105), `removePOItem` (1107–1127), `loadAvailablePricesForPart` (1129–1154), `loadSupplyHouseOptionsForPart` (1156–1180), `updatePartPriceInBook` (1182–1201), `addPartPriceFromPOModal` (1203–1221), `updatePOItemSupplyHouse` (1223–1284), `updatePOName` (1285–1328), `startEditPOName`/`cancelEditPOName` (1330–1338) | 977–1338 | 362 | `purchase_orders`, `purchase_order_items`, `material_part_prices` | inline — **largest handler block** |
| R15 | `visibleTabs` (1341), `visibleServiceTypes` (1344–1350) | 1341–1350 | 10 | | inline |
| R16 | Render (below) | 1352–2011 | 660 | | mixed |

### Render blocks

| Block | Lines | Size | Children / status |
|---|---|---|---|
| Error banner | 1354–1358 | 5 | inline |
| Service-type row (hidden on `supply-houses` and `job-accounts`) | 1361–1382 | 22 | inline |
| Tab strip — office group (1388–1440, behind `visibleTabs.some(isOfficeMaterialsTab)`), Parts Book (1441–1454), Assembly Book (1455–1468), PO group (1469–1500) | 1384–1503 | 120 | **inline** — 7 identical `setActiveTab` + `setSearchParams` buttons |
| `MaterialsPartsBookTab` | 1506–1537 | 32 | extracted, 30 props |
| `PartFormModal` | 1540–1551 | 12 | extracted, 10 props |
| Part Prices modal shell — overlay around `PartPricesManager`; `onPricesUpdated` patches `parts`/`allParts`/`templateItems` | 1555–1589 | 35 | **inline shell** |
| Price coverage modal (`viewingSupplyHouses`) — stats table; link to Supply houses behind `canOpenMaterialsTab` (1660–1678) | 1592–1683 | 92 | **inline** |
| `MaterialsAssemblyBookTab` (+ its Add Item modal) | 1687–1747 | 61 | extracted, 59 props |
| `MaterialsPoBuilderTab` | 1750–1844 | 95 | extracted, **93 props** |
| Template Form modal (`templateFormOpen`; delete branch 1885–1898) | 1847–1919 | 73 | **inline** |
| `MaterialsPurchaseOrdersTab` | 1923–1961 | 39 | extracted, 37 props |
| `MaterialsPoGeneratorTab` | 1964–1970 | 7 | extracted, 5 props |
| `MaterialsJobAccountsTab` (`onOpenSupplyHouse` inline arrow) | 1973–1985 | 13 | extracted, 3 props |
| `SupplyHousesTab` (office pane) | 1988–1998 | 11 | extracted, 7 props — [region map](#supplyhousestab-region-map) |
| `MaterialsSupplyHouseDirectoryTab` (estimator pane) | 2001–2009 | 9 | extracted, 5 props |

### Parent state by consumer (coupling data, from the prop bags)

| Cluster | `useState` | Read/written by | Can move? |
|---|---|---|---|
| Role/scope/router (R1) | 10 | parent chrome, every tab via props | no — parent-permanent |
| Part form + prices + expansion (`editingPart`, `partFormOpen`, `partFormInitialName`, `viewingPartPrices`, `expandedPartId`) | 5 | openers passed to Parts Book, Assembly Book, PO Builder (Assembly Book also gets the raw `setEditingPart`/`setPartFormOpen`); `setExpandedPartId` to Parts Book + Assembly Book; `?addPart` | no — shared modals |
| Price coverage (`viewingSupplyHouses`, `supplyHouseStatsByServiceType`) | 2 | Parts Book opener; stats reloaded by the master reload | into a modal component (open flag stays) |
| Template form (178–183) | 6 | Assembly Book (`openAddTemplate`/`openEditTemplate` props), `?addAssembly` — not in PO Builder's bag | into a modal component (open flag stays) |
| Assembly Book only (`editingItemQuantityId/Value`) | 2 | Assembly Book | yes |
| Add Item modal (218–228) | 11 | Assembly Book; **`handlePartSaved` writes 3** | stays until `handlePartSaved` gets a callback |
| **PO Builder only** (`draftPOSearch`, 184–202, 214–215) | 22 | PO Builder only (+ 3 refs, effect 561–570) | **yes — tab-local** |
| Price-edit cluster (203–210) | 8 | Purchase Orders only, **but written by shared `updatePOItemSupplyHouse`** | stays until that handler is split |
| Draft supply-house options (211–213) | 3 | PO Builder + Purchase Orders | stays (shared) |

---

## Master summary table

| Tab key | Label | Parent JSX | Status | Parent-owned state | Cross-tab coupling | Next move |
|---|---|---|---|---|---|---|
| `supply-houses` | Supply houses | 1988–1998 (office) / 2001–2009 (estimator) | **extracted** — [`SupplyHousesTab`](../src/components/SupplyHousesTab.tsx) (1,898 lines, [region map](#supplyhousestab-region-map)) / [`MaterialsSupplyHouseDirectoryTab`](../src/components/materials/MaterialsSupplyHouseDirectoryTab.tsx) (54) | `supplyHouseToAutoOpen` | low (`handleNavigateToPOFromSupplyHouses` writes PO state) | decompose SupplyHousesTab (steps 1, 3, 5–7) |
| `po-generator` | PO Generator | 1964–1970 | **extracted (v2.1279)** — [`MaterialsPoGeneratorTab`](../src/components/materials/MaterialsPoGeneratorTab.tsx) (793) | none | low (`supplyHouses`, `selectedServiceTypeId`, `myRole`, `onError`) | — |
| `job-accounts` | Held for suppliers | 1973–1985 | **born extracted (v2.2652)** — [`MaterialsJobAccountsTab`](../src/components/materials/MaterialsJobAccountsTab.tsx) (827); kernel [`jobAccountsFlow.ts`](../src/lib/materials/jobAccountsFlow.ts) | none | low (`onOpenSupplyHouse` writes `supplyHouseToAutoOpen` + switches tab) | — |
| `purchase-orders` | Purchase Orders | 1923–1961 | **extracted (v2.1281)** — [`MaterialsPurchaseOrdersTab`](../src/components/materials/MaterialsPurchaseOrdersTab.tsx) (1,091); engine [`useMaterialsPurchaseOrders`](../src/hooks/useMaterialsPurchaseOrders.ts) (117) | price-edit cluster (8) + draft SH options (3); handlers R14 | shared `updatePOItemSupplyHouse`; deep-link router + `selectedPODetailRef` | split `updatePOItemSupplyHouse` (step 8) |
| `parts-book` | Parts Book | 1506–1537 | **extracted (v2.1286)** — [`MaterialsPartsBookTab`](../src/components/materials/MaterialsPartsBookTab.tsx) (358); engine [`useMaterialsCatalog`](../src/hooks/useMaterialsCatalog.ts) (434) | shared modals + `expandedPartId` | caches read by 3 other tabs | Price coverage modal out (step 6) |
| `assembly-book` | Assembly Book | 1687–1747 | **extracted (v2.1290)** — [`MaterialsAssemblyBookTab`](../src/components/materials/MaterialsAssemblyBookTab.tsx) (997); engine [`useMaterialsAssemblies`](../src/hooks/useMaterialsAssemblies.ts) (202) | `editingItemQuantity*` (2) + Add Item modal (11) + R13 handlers | `selectedTemplate`/`templateItems` shared with PO Builder | — |
| `assemblies-po` | PO Builder | 1750–1844 | **extracted (v2.1293)** — [`MaterialsPoBuilderTab`](../src/components/materials/MaterialsPoBuilderTab.tsx) (1,196); pure JSX consumer | 22 tab-local `useState` + 3 refs + R14 handlers | intersection of assembly + PO clusters | move tab-local state in (step 4) |

Page-level modals: `PartFormModal` (extracted; opened from Parts Book, Assembly Book, PO Builder, `?addPart=true`), Part Prices modal (inline shell around extracted [`PartPricesManager`](../src/components/materials/PartPricesManager.tsx); opened from the same three tabs), Price coverage modal (inline, stats only since v2.3168; opened from the Parts Book toolbar), Template Form modal (inline; opened from Assembly Book and `?addAssembly=true`), Add Item to Assembly modal (renders inside `MaterialsAssemblyBookTab`, state page-owned).

---

## Per-tab dossiers

### `parts-book` — Parts Book (the Price Book)

- **Parent JSX:** `<MaterialsPartsBookTab active={…}>` 1506–1537 (30 props), always mounted (returns null when inactive). `PartFormModal` 1540–1551, Part Prices shell 1555–1589 and Price coverage modal 1592–1683 render after it.
- **Parent-owned:** `expandedPartId` (**shared with assembly-book**), part-form trio, `viewingPartPrices`, `viewingSupplyHouses` + `supplyHouseStatsByServiceType`; handlers `openAddPart`/`openEditPart`/`handlePartSaved`/`handlePartSavedAndAddAnother` (R12), `openSupplyHousesModal` (688–691) → `loadSupplyHouseStatsByServiceType` (329–340, RPC `get_supply_house_stats_by_service_type` → `groupSupplyHouseStats`).
- **Inside `useMaterialsCatalog`:** `parts`/`allParts`, search/filter/sort state, `PARTS_PAGE_SIZE = 50`, `loadingPartsRef`, window-scroll infinite scroll (200px), 300ms debounced search, Load-All localStorage (`materials_loadAllMode_${uid}`), `loadParts`/`loadAllParts` (plain functions), `reloadPartsFirstPage` (`useCallback`), `loadPartTypes`, `loadAssemblyTypes` (`assembly_types as any`), `loadSupplyHouses` (legacy-column fallback). Data: `part_types`, `assembly_types`, `supply_houses`, `material_parts`, RPC `get_parts_ordered_by_price_count`; prices via [`partPrices.ts`](../src/lib/materials/partPrices.ts), pages via [`partsCatalog.ts`](../src/lib/materials/partsCatalog.ts).
- **Inside the tab:** display pipeline via `computeLoadAllDisplayParts` + `manufacturerFacetOptions` ([`materialsFilters.ts`](../src/lib/materials/materialsFilters.ts)).
- **External coupling:** `location.state.refreshPrices` → `reloadPartsFirstPage` (489–493); `?addPart=true` (416–427). `PartPricesManager.onPricesUpdated` patches `parts`/`allParts`/`templateItems` in the parent (1566–1585).
- **Status:** Done (v2.1286). The Price coverage modal (92 inline lines + 2 states + 1 loader) is the one piece left to lift.

### `assembly-book` — Assembly Book

- **Parent JSX:** `<MaterialsAssemblyBookTab active={…}>` 1687–1747 (59 props); the Add Item modal renders inside it independent of `active`.
- **Parent-owned:** `editingItemQuantityId/Value`; the Add Item modal cluster (218–228) + `closeAddItemModal`/`handleAddItemFromModal` (881–959; merges quantity into an existing part row); `updateItemQuantity` (779–799), `removeItemFromTemplate` (961–975, also PO Builder); template CRUD (694–777; the openers go to this tab only, save/delete live in the page's Template Form modal); derived `filteredTemplates`/`calculateAssemblyCost` (R11). `handlePartSaved` (651–662) writes `addItemModalPartId`/`SearchQuery`/`DropdownOpen` when the part form was opened from the Add Item modal — why the cluster stays page-owned. The tab also writes shared state through raw setters: `setEditingPart`/`setPartFormOpen` (its part rows open the form directly, not via `openEditPart`), `setViewingPartPrices`, `setExpandedPartId` and `setActiveTab` (→ `parts-book`).
- **Inside `useMaterialsAssemblies`:** `materialTemplates`, `selectedTemplate`, `templateItems`, shared filters (`templateSearchQuery`, `filterAssemblyTypeIds`, `filterIncludeEmpty`, dropdown open + ref — rendered by both assembly tabs), `allTemplateItemsForStats`, `partIdToLowestPrice`, `loadMaterialTemplates`/`loadTemplateItems`/`loadAllTemplateItemsForStats`. Data: `material_templates`, `material_template_items`, `material_parts`, `material_part_prices`. The parent triggers `loadTemplateItems` on `selectedTemplate` (497–501) and stats on `assemblies-po || assembly-book` (503–507).
- **Inside the tab:** [`TemplatePricesManager`](../src/components/materials/TemplatePricesManager.tsx) (bundle prices, `material_template_prices`; also rendered by PO Builder); pickers via `filterPartsByQuery`/`filterTemplatesByQuery`.
- **External coupling:** `?addAssembly=true` (429–442). Bundle prices feed Bids takeoffs.
- **Status:** Done (v2.1290). Stage A landed (`assemblyCost.ts`, `materialsFilters.ts`, v2.1276); the page-level `filteredTemplates` (empty/type filter + search incl. type name, no limit) is still inline (591–607).

### `assemblies-po` — PO Builder

- **Parent JSX:** `<MaterialsPoBuilderTab active={…}>` 1750–1844 — **93 props**, the widest bag on the page; returns null when inactive.
- **Parent-owned, tab-local (22 `useState`, read by no other child):** `draftPOSearch` (175); `addingItemToTemplate`, `newItemType`, `newItemPartId`, `templatePartSearchQuery`, `templatePartDropdownOpen`, `newItemTemplateId`, `newItemTemplateSearchQuery`, `newItemTemplateDropdownOpen`, `newItemFilterAssemblyTypeId`, `newItemQuantity`, `newItemNotes` (184–194); `creatingPOFromTemplate`, `addingTemplateToPO` (195–196); `editingPOItem`, `editingPOItemQuantity`, `editingPOItemSupplyHouse`, `editingPOItemPrice`, `editingPOItemNotesId`, `editingPOItemNotesValue` (197–202); `editingPOName`, `editingPONameValue` (214–215); refs `templatePartPickerRef`, `templateItemsSectionRef`, `editingPODetailRef`; the outside-click effect (561–570).
- **Parent-owned, shared:** `selectedTemplate`/`templateItems`/filters (assemblies hook), `editingPO`/`selectedPO`/`draftPOs` (PO hook), draft SH options (211–213), `setViewingPartPrices`, `openAddPartWithName`, `openEditPart`, `removeItemFromTemplate`, `openPoGeneratorTab`.
- **Handlers (parent, R14):** `addItemToTemplate` (801–879: quantity-merge for an existing part, self-reference guard, `sequence_order` = max+1), `createPOFromTemplate` (979–1015 — expands via [`expandTemplate`/`addExpandedPartsToPO`](../src/lib/materialPOUtils.ts), then **switches to `purchase-orders`**), `createEmptyPO` (1017–1050), `addTemplateToPO` (1052–1082), `updatePOItem`, `removePOItem`, `updatePOName`/`start…`/`cancel…`, `loadSupplyHouseOptionsForPart`, `updatePOItemSupplyHouse` (shared).
- **Inside the tab:** `MaterialsPoLaneSignpost`, `TemplatePricesManager`, inline part/assembly pickers (near-duplicates of the Add Item modal's).
- **External coupling:** `duplicatePOAsDraft` (Purchase Orders) lands here with the copy as `editingPO`.
- **Status:** Done (v2.1293) as a pure JSX consumer. With the coupling data above, the 22 tab-local atoms can move in (playbook: tab-local state moves with the tab) — see step 4.

### `purchase-orders` — Purchase Orders

- **Parent JSX:** `<MaterialsPurchaseOrdersTab active={…}>` 1923–1961 (37 props); returns null when inactive.
- **Parent-owned:** price-edit cluster (203–210: `editingPOItemSupplyHouseView`, `availablePricesForItem`, `loadingAvailablePrices`, `editingPricesByPriceId`, `updatingPriceId`, `addPriceSupplyHouseId`, `addPriceValue`, `addingNewPrice`) — read only by this tab but written by shared `updatePOItemSupplyHouse` (1223–1284: optimistic 4-way write to `selectedPO`/`editingPO`/`draftPOs`/`allPOs`, reload-revert via `loadPOItemsWithDetails`); `loadAvailablePricesForPart` (1129–1154), `updatePartPriceInBook` (1182–1201, price 0 ⇒ DELETE), `addPartPriceFromPOModal` (1203–1221); `selectedPODetailRef`; the `?po=` router (512–558) and `handleNavigateToPOFromSupplyHouses` (342–359).
- **Inside `useMaterialsPurchaseOrders`:** `allPOs`, `draftPOs`, `selectedPO`, `editingPO`, `userNamesMap`, `loadPurchaseOrders` (`purchase_orders` + `users` names), the reload-on-`editingPO.id` effect.
- **Inside the tab:** `poStatusFilter`, `poSearchQuery`, `viewedPOTaxPercent`, notes/duplicate/confirm state; `finalizePO`, `addNotesToFinalizedPO`, `deletePO`, `duplicatePOAsDraft`, `printPO`/`printPOForSupplyHouse` (builders in [`poPrint.ts`](../src/lib/materialsDocuments/poPrint.ts)), `confirmPOItemPrice`/`unconfirmPOItemPrice`, `formatTimeSinceAgo` ([`formatTimeSinceAgo.ts`](../src/lib/formatTimeSinceAgo.ts)); `MaterialsPoLaneSignpost`, `SupplyHouseWebsiteLink`.
- **External coupling:** deep-link senders [`JobsPartsTab`](../src/components/jobs/JobsPartsTab.tsx) (`?tab=purchase-orders&po=<id>`), [`BidsTakeoffTab`](../src/components/bids/BidsTakeoffTab.tsx) (`state: { openPOId }`), `SupplyHousesTab` (prop callback; `navigate('/materials', { state: { openPOId } })` fallback in Quickfill). "Go to Projects to Add" is a raw `window.location.href` reload.
- **Status:** Done (v2.1281).

### `supply-houses` — Supply houses (extracted, two bodies)

- **Parent JSX:** office `activeTab === 'supply-houses' && supplyHousesPaneFor(myRole) === 'office'` → `SupplyHousesTab` with `supplyHouses`, `onSupplyHousesChange={loadSupplyHouses}`, `myRole`, `selectedServiceTypeId`, `onNavigateToPO={handleNavigateToPOFromSupplyHouses}`, `autoOpenHouseId={supplyHouseToAutoOpen}`, `onAutoOpenHouseHandled` (1988–1998). Estimator `… === 'directory'` → `MaterialsSupplyHouseDirectoryTab` with `supplyHouses`, `onSupplyHousesChange`, `myRole`, `selectedServiceTypeId`, `defaultTradeIds={estimatorServiceTypeIds}` (2001–2009). Both are conditionally mounted (state resets on tab switch).
- **Second mount:** Quickfill renders [`SupplyHousesSection`](../src/components/quickfill/SupplyHousesSection.tsx) → `<SupplyHousesTab showTitle={false} />` with **no data props** — the tab self-loads houses, takes the role from `useAuth`, loads the first service type for Create PO, and reports the "60+ past due" metric via `useReportQuickfillSectionMetric`. [`QUICKFILL_ARCHITECTURE.md`](./QUICKFILL_ARCHITECTURE.md) maps the station's wrapper (a Close-week money station), not this body.
- **Panes:** **Directory** — [`SupplyHouseDirectory`](../src/components/materials/SupplyHouseDirectory.tsx) (kernel [`supplyHouseDirectory.ts`](../src/lib/materials/supplyHouseDirectory.ts)); house add/edit/delete is the shared [`useSupplyHouseEditor`](../src/components/materials/useSupplyHouseEditor.tsx) hook (both bodies). **Accounts payable** (office only) — aging heat map, summary table, expanded house (job-accounts roster [`SupplyHouseJobAccountsRoster`](../src/components/materials/SupplyHouseJobAccountsRoster.tsx), invoices, POs), then [`SupplyHouseJobAccountsSection`](../src/components/materials/SupplyHouseJobAccountsSection.tsx) (*Job account packets sent*), the invoice form and Apply Payment. Invoice **Purchase Order #** fields are read against the PO Generator ledger (`material_po_generator_entries`) with [`parsePoGeneratorCodeFromPurchaseOrderName`](../src/lib/parsePoGeneratorCodeFromPurchaseOrderName.ts) and the [`supplyHouseInvoiceForm.ts`](../src/lib/materials/supplyHouseInvoiceForm.ts) kernels (exact-code card v2.3599, codes-for-this-job window + mismatch line v2.3724).
- **Gates:** the kernel decides the pane; `SupplyHousesTab` also re-checks office roles with literals (`canAccess`, 551 → `return null` at 601).
- **Status:** extracted; internally the largest undecomposed surface — [region map below](#supplyhousestab-region-map).

### `job-accounts` — Held for suppliers (born extracted, v2.2652)

- **Parent JSX:** always-mounted `<MaterialsJobAccountsTab active myRole onOpenSupplyHouse>` 1973–1985; returns null when inactive or for non-office roles (literal role check).
- **What it is:** per-job money flow — `jobs_ledger.revenue`/`payments_made` against `supply_house_invoice_job_allocations` × `supply_house_invoices`; "holding for suppliers" = unpaid supplier balances on jobs the customer has paid.
- **Inside the tab:** all state; loads on first activation via `fetchAllRows`/`fetchAllRowsChunkedIn` + `withSupabaseRetry`; kernel `buildJobAccountsView`/`classifyJobAccount` (tested); Open job via `useJobFormModal().openEditJob`.
- **External coupling:** `onOpenSupplyHouse(houseId)` → parent sets `supplyHouseToAutoOpen`, switches to `supply-houses`; `SupplyHousesTab` auto-opens the house once its list has it (effect 517–524). The service-type row is hidden on this tab (1361).

### `po-generator` — PO Generator

- **Parent JSX:** always-mounted `<MaterialsPoGeneratorTab active myRole supplyHouses selectedServiceTypeId onError>` 1964–1970; returns null when inactive or for non-office roles.
- **Inside the tab:** the `poGen*` cluster, ledger load, debounced job/user searches; data `material_po_generator_entries`, `jobs_ledger`, `users`, RPCs `search_jobs_ledger`, `insert_material_po_generator_entry`, `set_material_po_generator_stated_need` (via [`setPoCodeStatedNeed.ts`](../src/lib/materials/setPoCodeStatedNeed.ts) and the shared [`StatedNeedEditor`](../src/components/materials/StatedNeedEditor.tsx)); [`JobAccountPoLine`](../src/components/materials/JobAccountPoLine.tsx) under the supply-house pick.
- **External coupling:** ledger codes are what `SupplyHousesTab`'s invoice PO checks read (DB-level only).
- **Status:** Done (v2.1279); render-tested.

---

## `SupplyHousesTab` region map

Props (`SupplyHousesTabProps`, 144–154): `supplyHouses?`, `onSupplyHousesChange?`, `myRole?`, `showTitle?`, `selectedServiceTypeId?`, `onNavigateToPO?`, `autoOpenHouseId?`, `onAutoOpenHouseHandled?` — every prop optional so Quickfill can mount it bare.

| # | Region (search symbol) | Lines | Size | Holds | Status |
|---|---|---|---|---|---|
| S0 | Module scope — row types (66–89, incl. a local `POItemWithDetails`/`PurchaseOrderWithItems` copy at 75–80), `formatYmdLocal` (95–98), `INVOICE_*_STYLE` (100–101), `InvoiceFormSection` (104–111, presentational), `REMEMBERED_TOGGLE_PREFIX` + `readRememberedToggle`/`writeRememberedToggle` (114–129), `JOB_ACCOUNT_LINE_*` (132–133), `AGING_CELL_STYLES` (135–142) | 1–155 | 155 | 30 local imports | inline |
| S1 | Props, page hooks, house list — `myRole` = prop ?? `useAuth` role (169), `supplyHousesInternal` + `supplyHousesList` (171–172, prop wins), `error`, `directoryReloadKey` | 156–176 | 21 | 3 `useState` | inline |
| S2 | AP summary state — `supplyHouseSummary`, `supplyHouseSummaryLoading`, `agingUnpaidInvoices` | 178–182 | 5 | 3 `useState` | inline |
| S3 | Selected-house detail — `selectedSupplyHouseForDetail`, `supplyHouseInvoices`, `supplyHousePOs`, `poGeneratorEntriesForSelectedHouse` + memo `poGeneratorCodesForSelectedHouse` (189), `supplyHouseDetailLoading`, `supplyHouseJobDetailsMap` (268) | 183–190, 268 | 9 | 6 `useState`, 1 memo | inline — hook candidate |
| S4 | **Invoice form state** — 15 field/flag states (191–208), `useLedgerPrefixMap` (209), memo `invoiceJobResultsUnified` (210–213), `useJobBidSearchEvidence` (214), `invoiceSingleAllocatedJobId` (217–218), `invoiceJobAccount`/`Key`/`Reps`/`invoiceMarkOpenedOpen` (224–227), ref `invoiceOnJobAccountTouchedRef` (229), job-account lookup effect (230–266, `job_supply_house_accounts` + `supply_house_contacts`), `invoiceJobDetailsMap` (267), `savingInvoice` (269) | 191–269 | 79 | 21 `useState`, 1 memo, 1 ref, 1 effect | inline — **tab-local, extract** |
| S5 | Apply payment (270–274) + Create PO (`creatingPOForSupplyHouse`, `firstServiceTypeId`, 275–276) | 270–276 | 7 | 7 `useState` | inline |
| S6 | View prefs — `showPaidInvoices`/`showLastPayment` (279–280), `summarySort` (282–288) + persist (289–295), memo `sortedSupplyHouseSummary` (296), `summaryHeader` render helper (297–311), `markJobAccountInvoices` (313), 3 persist effects (314–316), `serviceTypeId` (318) | 277–318 | 42 | 4 `useState`, 4 effects, 1 memo | inline |
| S7 | Loaders — `loadSupplyHousesInternal` (320–329), `loadSupplyHouses` (331–337), `loadFirstServiceType` (339–343), `formatOrdinal` (345–350), **`loadSupplyHouseSummary` (352–403, aggregation inline)**, **`loadSupplyHouseDetail` (405–501: 4 parallel reads, allocation grouping 429–438, N+1 PO items 453–469, ledger-entry mapping 474–498)** | 320–501 | 182 | `supply_houses`, `supply_house_invoices`, `purchase_orders`, `purchase_order_items`, `supply_house_invoice_job_allocations`, `material_po_generator_entries`, `service_types`, RPC `get_jobs_ledger_by_ids` | inline — **Stage A + hook seam** |
| S8 | Data effects — first service type (503–505), mount (507–510), prop sync (512–514), auto-open house (517–524), invoice job search 300ms (526–537, RPC `search_jobs_ledger`), allocated-job details (539–549, RPC `get_jobs_ledger_by_ids`) | 503–549 | 47 | 6 effects | inline |
| S9 | Derived + late hooks + gate — `canAccess` (551), `agingMatrix` (553–557), `agingHasCredits`, `invoiceWords`, `invoiceCreditJobLabel` IIFE (563–568), `creditEffect` (569–573), `useNarrowViewport640`, `useBodyScrollLock(invoiceFormOpen)`, `housesPastDue60`, `useSupplyHouseEditor` (581–593), `useReportQuickfillSectionMetric` (595–599), `if (!canAccess) return null` (601) | 551–601 | 51 | | inline |
| S10 | Actions — `handleNavigateToPO` (603–609), `createBlankPOForSupplyHouse` (611–636, `purchase_orders`), `openAddInvoice` (638–658), `openEditInvoice` (660–678), `closeInvoiceForm` (680–684), `open/closeApplyPaymentForm` (686–698), `applyPayment` (700–716), **`saveInvoice` (718–793)**, `toggleInvoicePaid` (795–804), `deleteInvoice` (806–816), `openHouseFromAging` (819–823) | 603–823 | 221 | `supply_house_invoices`, `supply_house_invoice_job_allocations` | inline |
| S11 | Render (below) | 825–1897 | 1,073 | | mixed |

### Render blocks (`SupplyHousesTab`)

| Block | Lines | Size | Children / status |
|---|---|---|---|
| Title (`showTitle`) | 827–842 | 16 | **dead** — neither caller passes `true` |
| Error lines (tab + `houseEditor.error`) | 843–844 | 2 | inline |
| Pane 1 — Directory | 846–859 | 14 | `SupplyHouseDirectory` (extracted) |
| Pane 2 header | 861–865 | 5 | inline |
| AP section (`supplyHouseSummaryLoading` ternary 867–1381): total + three toggles + caption (~870–912; header total is an inline `reduce` at 874) | 866–1382 | 517 | inline |
| ↳ Aging heat map — phone cards vs desktop table (`narrowAging`) | 913–1063 | 151 | **inline** — presentational, reads `agingMatrix` |
| ↳ Summary table (`summaryHeader` ×5, rows 1077+) | 1065–1380 | 316 | inline |
| ↳↳ Expanded house detail (`isExpanded && selectedSupplyHouseForDetail`; its Edit button is a separate same-condition block in the summary row, 1115–1127): address/phone/website (1138–1149), `SupplyHouseJobAccountsRoster` (1151–1156), Invoices table (1157–1312; PO-code warning via `parsePoGeneratorCodeFromPurchaseOrderName` 1207–1211, `daysPastDue` 1235, credit display 1254–1256), Purchase Orders (1313–1372, Create PO + `handleNavigateToPO`) | 1130–1374 | 245 | **inline** |
| `SupplyHouseJobAccountsSection` | 1384 | 1 | extracted |
| `houseEditor.modal` | 1386 | 1 | extracted hook |
| **Invoice form modal** (IIFE: derived hints 1389–1405) — ⓪ kind (1420–1455), ① fields + PO check + ledger card (1456–1523; card 1498–1521), ③ job search (1524–1622; results 1544–1576, pct 1596–1610), ④ job account on the job card (1623–1673), ③b codes for this job (1674–1698), `MarkJobAccountOpenedModal` (1700–1717), ⑤ status/paid (1719–1759), ⑥ paperwork (1760–1773), ⑧ credit effect (1774–1794), ⑦ sticky footer (1795–1815) | 1388–1815 | 428 | **inline — largest block**; uses `InvoiceFormSection` ×5, `UnifiedSearchResultRow`, `MarkJobAccountOpenedModal` |
| Apply Payment modal | 1817–1894 | 78 | **inline** |

---

## Shared infrastructure

The "API surface" any extracted tab is handed.

### Role + service-type scope (parent, permanent)

- `myRole` (`loadRole`, 253–293): the page admits the roles `canAccessMaterials(role)` admits — `dev`, `master_technician`, assistant-like (`assistant`/`controller` via [`isAssistantLike`](../src/lib/subcontractorLikeRole.ts)), `estimator`, `primary`, `superintendent`; everyone else gets "Access denied" (579–581).
- Per-role service-type restriction arrays from the `users` row (`estimator_`/`primary_`/`superintendent_service_type_ids`) filter the trade row **twice, written differently**: `loadServiceTypes` (309–317) picks the first non-empty array without checking the role to seed `selectedServiceTypeId`; `visibleServiceTypes` (1344–1350) checks the role. They agree only because `loadRole` (273–287) stores each array for its own role alone (the other two stay `null`). NULL/empty = all.
- `serviceTypes` + `selectedServiceTypeId`: the master scope. Changing it (effect 462–487, also on `loadAllMode`) clears part filters, resets pagination, clears both parts caches, and reloads six loaders in parallel (`loadSupplyHouses`, `loadPartTypes`, `loadAssemblyTypes`, `loadMaterialTemplates`, `loadPurchaseOrders`, `loadSupplyHouseStatsByServiceType`) + parts (paged or Load-All).

### Tab gating

**The kernel [`materialsTabsFor(role)`](../src/lib/materials/materialsTabs.ts) is the table** (since v2.3166) — the pills, the `?tab=` guard (`resolveMaterialsTab`), `canAccessMaterials`, and the Supply houses body (`supplyHousesPaneFor`) all read it; `materialsTabs.test.ts` pins every row. Change the kernel, not the JSX, when a role gains or loses a tab (and keep the RLS on `supply_houses` / `supply_house_contacts` in step). Three tab bodies still re-check office roles with literals instead of the kernel: `MaterialsPoGeneratorTab`, `MaterialsJobAccountsTab`, `SupplyHousesTab` (`canAccess`, 551).

| Tab | dev / master_technician / assistant-like | estimator | primary / superintendent |
|---|---|---|---|
| Parts Book | ✅ | ✅ | ✅ |
| Assembly Book | ✅ | ✅ | ✅ |
| PO Builder (`assemblies-po`) | ✅ | ✅ | ❌ (hidden + URL redirect) |
| Purchase Orders | ✅ | ✅ | ❌ (hidden + URL redirect) |
| Supply houses | ✅ (Directory + Accounts payable) | ✅ **Directory pane only** (`supplyHousesPaneFor` = `directory`) | ❌ (hidden + redirect) |
| Held for suppliers | ✅ | ❌ (hidden + redirect) | ❌ (hidden + redirect) |
| PO Generator | ✅ | ❌ (hidden + redirect) | ❌ (hidden + redirect) |

The guard effect (365–414) rewrites disallowed `?tab=` values to `parts-book` (`replace: true`), writes `parts-book` when `?tab=` is missing, and rewrites the legacy `price-book` / `templates-po` slugs; while the role is still loading it honours a known slug and decides nothing about access.

### URL / navigation router (parent, permanent)

- `?tab=` sync (every pill writes it; the guard effect reads it).
- `?po=<id>` **or** `location.state.openPOId` (512–558) → force `purchase-orders`, load the PO + items, set `editingPO` + `selectedPO`, seed `draftPOs`/`allPOs` if missing, double-`requestAnimationFrame` scroll to `selectedPODetailRef`, strip the param/state. The same seed-and-scroll body is written three times: the router's two branches (523–534, 536–545) and `handleNavigateToPOFromSupplyHouses` (342–359, which also awaits `loadPurchaseOrders`).
- `?addPart=true` → `PartFormModal` (416–427); `?addAssembly=true` → Template Form (429–442); both strip the param.
- `location.state.refreshPrices` → `reloadPartsFirstPage()` (489–493).
- Held for suppliers → `supplyHouseToAutoOpen` → `SupplyHousesTab.autoOpenHouseId` (1976–1984 → effect 517–524).

### Seam hooks (landed)

| Hook | Lines | Owns | Consumed by | Tests |
|---|---|---|---|---|
| [`useMaterialsCatalog`](../src/hooks/useMaterialsCatalog.ts) (v2.1282) | 434 | parts caches, pagination/infinite scroll, Load-All persistence, `partTypes`, `assemblyTypes`, `supplyHouses`, 3 effects | every tab (parent destructures 31 bindings) | none of its own (kernels `partsCatalog`, `partPrices` tested) |
| [`useMaterialsAssemblies`](../src/hooks/useMaterialsAssemblies.ts) (v2.1288) | 202 | templates, `selectedTemplate`, `templateItems`, shared filters + dropdown ref, stats caches | Assembly Book, PO Builder, Add Item modal | none of its own |
| [`useMaterialsPurchaseOrders`](../src/hooks/useMaterialsPurchaseOrders.ts) (v2.1281) | 117 | `allPOs`, `draftPOs`, `selectedPO`, `editingPO`, `userNamesMap`, `loadPurchaseOrders`, reload-on-`editingPO.id` | PO Builder, Purchase Orders, router, `handleNavigateToPOFromSupplyHouses` | none of its own (`poItemDetails` tested) |

### Stage-A pure-logic inventory

Landed with the train (kept for the record): `calculateAssemblyCost` → [`assemblyCost.ts`](../src/lib/materials/assemblyCost.ts); `filterPartsByQuery`/`filterTemplatesByQuery`/`computeLoadAllDisplayParts` → [`materialsFilters.ts`](../src/lib/materials/materialsFilters.ts) (v2.1276); `fetchPricesForParts`/`fetchPricesForPart` → [`partPrices.ts`](../src/lib/materials/partPrices.ts); print builders → [`poPrint.ts`](../src/lib/materialsDocuments/poPrint.ts); `groupSupplyHouseStats` → [`supplyHouseStats.ts`](../src/lib/materials/supplyHouseStats.ts); `formatTimeSince` → `formatTimeSinceAgo` in [`formatTimeSinceAgo.ts`](../src/lib/formatTimeSinceAgo.ts); `formatCurrency` → [`lib/format.ts`](../src/lib/format.ts) (all v2.1277); `purchase_order_items` join → `loadPOItemsWithDetails` in [`poItemDetails.ts`](../src/lib/materials/poItemDetails.ts) (v2.1275, 12 call sites); `expandTemplate`/`addExpandedPartsToPO` tests (v2.1277). SupplyHousesTab's invoice logic already lives in [`supplyHouseInvoiceForm.ts`](../src/lib/materials/supplyHouseInvoiceForm.ts), aging in [`supplyHouseAging.ts`](../src/lib/supplyHouseAging.ts), sort in [`supplyHouseSummarySort.ts`](../src/lib/materials/supplyHouseSummarySort.ts).

Open candidates at a05cef4c4:

| Candidate | Currently | Target | Money? |
|---|---|---|---|
| Summary aggregation — outstanding per house (credits included), last updated, last paid, the unpaid list for aging | `loadSupplyHouseSummary` 352–403 + header total `reduce` 874 | `buildSupplyHouseSummary(houses, invoices)` in `lib/materials/` + tests | **yes, untested** |
| Invoice → allocations grouping | `loadSupplyHouseDetail` 429–438 | `groupAllocationsByInvoice` | yes (pct) |
| PO Generator row → `PoLedgerEntry` mapping | `loadSupplyHouseDetail` 474–498 | `poLedgerEntriesFromRows` beside `poLedgerCodes` in `supplyHouseInvoiceForm.ts` | no (feeds the PO checks) |
| 13th copy of the `purchase_order_items` join + local types | `loadSupplyHouseDetail` 453–469, types 75–80 | `loadPOItemsWithDetails` (already tested) | no |
| `formatOrdinal` | 345–350 | delete — `ordinalDay` in `supplyHouseInvoiceForm.ts` is the same function, tested | no |
| `formatYmdLocal`, remembered-toggle read/write | 95–98, 114–129 | `lib/` date util + a tiny storage helper | no |
| Invoice save payload — single-job flag rule, change-only `on_job_account`, trimmed nulls | `saveInvoice` 735–754 | `invoiceSavePayload(...)` beside `signedAmountForSave`/`paidAtPayload` | **yes, untested** |
| `filteredTemplates` (empty/type/search) + template no-price stats | Materials 588–617 | `filterAssemblyList` + `templatePriceCoverage` in `materialsFilters.ts` | no |
| Trade-row visibility (two copies written differently; they agree only through `loadRole`'s per-role storage) | `loadServiceTypes` 309–317, `visibleServiceTypes` 1344–1350 | `visibleServiceTypesFor(role, ids, types)` | no |
| PO open-and-seed body (×3) | 342–359, 523–534, 536–545 | one `openPOInPurchaseOrders(poId)` in the parent | no |

---

## Test coverage per region

| Region | Tests | Gap |
|---|---|---|
| Materials R1/R9 role + `?tab=` guard | [`Materials.render.test.tsx`](../src/pages/Materials.render.test.tsx) — 13 cases: dev mounts 6 of 7 tabs, legacy `price-book`, estimator/primary/technician gating, estimator Directory-only; [`materialsTabs.test.ts`](../src/lib/materials/materialsTabs.test.ts) (11) | `templates-po` rewrite; **Held for suppliers never mounted** (only its pill's absence for the estimator is asserted; dev's pill is not) |
| R9 `?po=`/`openPOId` router, `?addPart`, `?addAssembly`, `refreshPrices`; R8 `handleNavigateToPOFromSupplyHouses` | none | all |
| R11 derived stats | `assemblyCost.test.ts` (7) covers the kernel | `filteredTemplates`, template stats inline |
| R13 template CRUD, `addItemToTemplate` qty-merge, `handleAddItemFromModal` | none | all |
| R14 PO actions | `materialPOUtils.test.ts` (7), `poItemDetails.test.ts` (9), `poPrint.test.ts` (9) | **`updatePartPriceInBook` (0 ⇒ DELETE), `addPartPriceFromPOModal`, `updatePOItemSupplyHouse` optimistic 4-way write — untested price writes** |
| Price coverage stats | `supplyHouseStats.test.ts` (3) | the render test asserts the opener button; the modal is never opened |
| Children | `MaterialsPoGeneratorTab.render.test.tsx`, `StatedNeedEditor.render.test.tsx`; kernels `materialsFilters` (13), `partPrices` (5), `partsCatalog` (9), `jobAccountsFlow` (22), `supplyHouseDirectory` (13) | the other 6 tab components and the 3 seam hooks have no own tests (page smoke only) |
| SupplyHousesTab mount | Materials render test (dev: Directory + Accounts payable headings; estimator: Directory alone) | **Quickfill mount (`SupplyHousesSection`) — none** |
| S7 summary aggregation + header total | none | **money math, untested** |
| Aging map, sort | `supplyHouseAging.test.ts` (16, incl. credits + job-account share), `supplyHouseSummarySort.test.ts` (6) | render |
| S7 detail loader (grouping, ledger mapping, PO items) | none (the join it duplicates is tested) | all |
| S4/S10 invoice form | `supplyHouseInvoiceForm.test.ts` (50: PO hint/card/job matches/mismatch, due hint, paid-on, allocations, sign/kind, credit sentence), `supplyHouseDocument.test.ts` (4), `parsePoGeneratorCodeFromPurchaseOrderName.test.ts` (3), `jobSupplyHouseAccounts.test.ts` (9) | **`saveInvoice` payload assembly + delete-then-insert allocations — untested money path**; job-account default effect |
| S10 `applyPayment`, `toggleInvoicePaid`, `createBlankPOForSupplyHouse` | `applyPayment`'s payload: `applyPaymentUpdate` in `supplyHouseInvoiceForm.test.ts` (quirk 21, v2.3830 / v2.3843) | `toggleInvoicePaid`, `createBlankPOForSupplyHouse` |
| e2e | [`e2e/viewport-smoke.spec.ts`](../e2e/viewport-smoke.spec.ts) visits `/materials` | — |

---

## Preserve-quirks list (odd but load-bearing — do not "fix" during a move)

1. **Load All mode defaults OFF** and is persisted per user in localStorage (`materials_loadAllMode_${uid}`, in `useMaterialsCatalog`) — the v2.46 Supabase disk-IO optimization. `fetchPricesForParts` batching (500-ID `.in()` chunks + client re-sort) and `loadAllTemplateItemsForStats` scoping to the selected service type are the same wave. Keep the batch sizes and the default.
2. **`PARTS_PAGE_SIZE = 50` + window-scroll infinite scroll** with a `loadingPartsRef` re-entry guard and a 200px bottom threshold, gated off in Load All mode (in `useMaterialsCatalog`). Virtualization was deliberately skipped.
3. **Price-count sort is a special path**: only with `sortByPriceCountAsc` on AND no part-type/manufacturer filter does `loadParts` call RPC `get_parts_ordered_by_price_count` and slice pages client-side; with filters the flag is silently ignored.
4. **`supply_houses` SELECT has a legacy fallback**: on error it retries without `monthly_payment_day` and stubs `null` — in `useMaterialsCatalog` and three times in `SupplyHousesTab` (320–329, 352–362, 408–411). `assembly_types` is queried `as any`.
5. **`partIdsWithNoPrice` is computed from the paginated `parts` cache** (610), so "unpriced parts" badges/stats know only the pages loaded so far (accurate in Load All mode). Keep this data source.
6. **Tax-percent inconsistency** (in `MaterialsPurchaseOrdersTab`): `viewedPOTaxPercent` defaults to `'8.25'`; the `selectedPO` footer uses `parseFloat(...) || 0`, the all-POs rows `parseFloat(...) || 8.25`. Preserve both.
7. **The assembly filter states + `filterAssemblyTypeDropdownRef` are rendered by two tabs** (Assembly Book and PO Builder, both always mounted). Legal because each renders its body only when `active`; filters carry over between the two tabs by design.
8. **Add-only PO notes**: `addNotesToFinalizedPO` re-verifies `status === 'finalized' && notes === null`, then UPDATEs with `.eq('status','finalized').is('notes', null)` as a race guard.
9. **Price confirmation writes history**: `confirmPOItemPrice` inserts a zero-delta `material_part_price_history` row ("Price confirmed via PO: …") and tolerates its failure. `updatePartPriceInBook` (1182–1201) treats price `0` as **delete the price row**.
10. **`duplicatePOAsDraft` copies items sequentially**, does NOT copy `price_confirmed_at/by`, deletes the partial PO on any item failure, and lands on `assemblies-po` with the copy as `editingPO`.
11. **Draft `printPO` fires one price query per item** (`Promise.all` of `fetchPricesForPart`) for the "All prices" column; finalized print is single-pass.
12. **Optimistic multi-target writes**: `updatePOItemSupplyHouse` (1223–1284) patches up to four slices (`selectedPO`, `editingPO`, `draftPOs`, `allPOs`) and reverts by server reload on error. `handleNavigateToPOFromSupplyHouses` and the `?po=` router seed `draftPOs`/`allPOs` before `loadPurchaseOrders` settles.
13. **Double-`requestAnimationFrame` scroll** to `selectedPODetailRef` after PO deep-links (lets the tab switch paint first).
14. **`addItemToTemplate`/`handleAddItemFromModal` merge quantities** for a part already in the assembly and block adding an assembly to itself (direct self-reference only — deeper cycles are handled by `calculateAssemblyCost`'s `visited` set). `deleteTemplate` (759–777) deletes the items, then the template — not atomic.
15. **"Go to Projects to Add"** uses `window.location.href = '/projects'` (full reload).
16. **Closed (v2.3168).** The Price coverage modal lost its second copy of supply-house CRUD; house editing is `useSupplyHouseEditor` behind both Supply houses bodies.
17. **`SupplyHousesTab` has two mount contracts.** Materials passes data + callbacks; Quickfill passes nothing, so the tab self-loads houses (`loadSupplyHousesInternal`), reads the role from `useAuth`, loads the first service type for Create PO (503–505), and falls back to `navigate('/materials', { state: { openPOId } })` (603–609). Every prop stays optional.
18. **Hooks run above the access gate** (`useReportQuickfillSectionMetric` 595–599 before `return null` at 601) so the Quickfill metric reports; it no-ops outside the Quickfill provider.
19. **The invoice sign comes from the document kind** (`signedAmountForSave`), never the typed amount; `on_job_account` is **sent only when it changed** (the merge-to-db-push window) and forced off unless exactly one job is allocated; `paidAtPayload` sends `paid_at` only when the typed day differs — the DB trigger stamps `now()` on the flip to paid.
20. **Allocations save delete-then-insert** (774–785), not atomic; rows with pct ≤ 0 are dropped; an edited invoice with no allocations deletes all.
21. **Apply Payment never writes `link`** — `applyPaymentUpdate` (`lib/materials/supplyHouseInvoiceForm.ts`, tested) marks the bills paid and files a typed link in `payment_link` (v2.3843, shown as **Receipt** beside **View**). `link` is the invoice scan: a blank box used to null it (fixed v2.3830) and a typed one replaced it.
22. **`loadSupplyHouseDetail` reads the whole `supply_house_invoice_job_allocations` table** (416, no filter) and fetches job details for every allocated job on each house open; PO items load one query per PO (453–469). Scope/batch in a behavior PR, not a move.
23. **The job-account flag defaults itself** (effect 230–266): a new invoice on exactly one job whose account at this house is `open` turns the flag on, unless the user touched the box (`invoiceOnJobAccountTouchedRef`); editing an invoice never defaults.
24. **Remembered toggles are per device**: localStorage keys `supplyHouses.accountsPayable.{show-paid-invoices, show-last-payment, mark-job-account-invoices, summary-sort}`, every access in try/catch.
25. **Summary rows sort twice**: `loadSupplyHouseSummary` sorts by outstanding (400), then the `sortedSupplyHouseSummary` memo applies the remembered pick.

---

## Recommended extraction order (value ÷ risk)

The first plan's six steps all landed, in order, as the v2.1275–v2.1293 train (Stage A sweep → PO Generator → in-file managers → PO engine + Purchase Orders → catalog + Parts Book → assemblies + Assembly Book → PO Builder). The next order, ranked with the coupling data above:

| # | Move | Regions | Value | Risk | Notes |
|---|---|---|---|---|---|
| 1 | **SupplyHousesTab Stage A** — `buildSupplyHouseSummary`, `groupAllocationsByInvoice`, `poLedgerEntriesFromRows`, `invoiceSavePayload` (+ tests); swap in `loadPOItemsWithDetails` and `ordinalDay`, delete the local types | S0, S7, S10 | high — puts tests under untested AP money math | low | behavior-preserving; each kernel ships alone. The per-house sum skips unpaid invoices whose house is not in the list (379), while the Settings AP pin (`useSettingsFinancialPins`) and the Dashboard pin (`useSupplyHousesAPTotal`) sum every unpaid invoice — prove the totals agree and share one tested sum (playbook cross-cutting #34) |
| 2 | **Materials Stage A** — `openPOInPurchaseOrders` (×3 → 1), `visibleServiceTypesFor`, `filterAssemblyList` + template stats | R8, R9, R11, R15 | medium | low | the two trade-row copies agree today only because `loadRole` stores one array per role — the kernel takes the role so it keeps agreeing |
| 3 | **Invoice form → `SupplyHouseInvoiceFormModal` + `useSupplyHouseInvoiceForm`** — the 21 S4 states, ref, 3 effects (230–266, 526–537, 539–549), memo, S9's invoice derivations (`invoiceWords`, `invoiceCreditJobLabel`, `creditEffect`, `useBodyScrollLock(invoiceFormOpen)`), `open/closeInvoiceForm`, `saveInvoice`, `deleteInvoice`; render 1388–1815 | S4, S9, S10, S11 | high — ~600 lines out, all tab-local | medium (money save path) | parent keeps `openAddInvoice/openEditInvoice` triggers; props `house`, `poLedgerEntries`, `editingInvoice`, `onSaved` (→ detail + summary reload); after step 1 |
| 4 | **PO Builder tab-local state into `MaterialsPoBuilderTab`** — 22 `useState`, 3 refs, effect 561–570, plus `addItemToTemplate`/`create*`/`addTemplateToPO`/`updatePOItem`/`removePOItem`/`updatePOName*` via a `usePoBuilderActions` hook fed the engines | R5, R6, R9, R14 | high — parent −22 state, bag 93 → ~50 props | medium | shared: `editingPO`, `selectedTemplate`, draft SH options, `updatePOItemSupplyHouse`, `setActiveTab` stay props |
| 5 | **AP data seam `useSupplyHouseAccountsPayable`** — S1–S3 state, S7 loaders, S8 data effects 503–524 (the two invoice effects go with step 3), auto-open | S1–S3, S7, S8 | high — one engine for Materials + Quickfill | medium | keep both mount contracts (quirk 17); `useSupplyHouseEditor`'s `onSaved` (581–593) writes `directoryReloadKey`, `selectedSupplyHouseForDetail` and `poGeneratorEntriesForSelectedHouse`, and S1's `error` is also written by `saveInvoice`/`createBlankPOForSupplyHouse` — the hook exposes those writes; the allocations scope fix (quirk 22) is a separate PR after it |
| 6 | **Small inline pieces out** — Apply Payment modal (S5's 270–274 + 700–716 + 1817–1894; S5's Create PO pair stays), aging heat map (913–1063, presentational), Price coverage modal (1592–1683 + 2 states + loader), Template Form modal (1847–1919 + 694–777; open flag stays in the parent), tab strip → `visibleTabs.map` with labels in `materialsTabs.ts`, delete the dead `showTitle` block (827–842) | S5, S11, R3, R13, R16 | medium each | low | independently shippable |
| 7 | **Expanded house detail → `SupplyHouseDetailPanel`** (1130–1374: invoices + POs tables) | S11 | medium | low after step 5 | reads the step-5 hook's detail state; S6's `showPaidInvoices`/`showLastPayment` and S5's `creatingPOForSupplyHouse` come in as props |
| 8 | **Split `updatePOItemSupplyHouse`** so its Purchase-Orders-only writes (price-edit cluster, 203–210) move into `MaterialsPurchaseOrdersTab` | R5, R14 | low–medium | medium (optimistic 4-way write) | last; only when that tab is next touched |

Definition of done per step, verification gates, and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) (typecheck + lint + `npm test` green after every step; behavior-preserving only).
