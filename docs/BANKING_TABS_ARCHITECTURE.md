# Banking Tabs Architecture Map

---
file: docs/BANKING_TABS_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the Banking surface decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md) — inventory what every tab/region of the 2,181-line src/pages/Banking.tsx touches (state, loaders, handlers, sub-components, supabase tables/RPCs, cross-tab coupling), plus sub-decomposition dossiers for its two biggest already-extracted tabs, BankingMercuryAccountingTab (2,304 lines) and BankingMercuryDragSortTab (1,392 lines). MercuryTransactionAllocationsModal (1,540 lines) is noted as external coupling only — it is not mapped here.
audience: Developers, AI Agents
last_updated: 2026-09-05
---

## What this surface is

[`src/pages/Banking.tsx`](../src/pages/Banking.tsx) (**2,181 lines**, down from 3,104 after the v2.1304 in-file component moves) is the money-movement hub: a two-level tab switch (`product` × tab) over Mercury bank transactions and Stripe billing. Unlike Materials or pre-refactor Bids, Banking is **already half-decomposed**: 5 of the 7 Mercury tabs and both Stripe tabs render extracted components. What remains inline in the parent is the **Ledger** tab, the **Sorting (User Sort)** tab, the master data engine (transaction list + allocation/attribution caches + nickname caches), the URL router, and nine page-level modals. The formerly in-file module components (`BankingMercuryTable` and the two dropdown menus) moved verbatim to `src/components/banking/` in v2.1304.

The two biggest extracted tabs have themselves become God components and are mapped for sub-decomposition:

| File | Lines | Role |
|---|---|---|
| [`src/pages/Banking.tsx`](../src/pages/Banking.tsx) | 2,181 | parent shell + Ledger + User Sort + data engine + modals |
| [`src/components/banking/BankingMercuryAccountingTab.tsx`](../src/components/banking/BankingMercuryAccountingTab.tsx) | 2,304 | Accounting tab: rules engine, approvals queue, sorting ledger |
| [`src/components/banking/BankingMercuryDragSortTab.tsx`](../src/components/banking/BankingMercuryDragSortTab.tsx) | 1,392 | Drag Sort tab: dnd-kit label buckets + quick-label focus flow |

Other extracted siblings (not re-mapped; healthy sizes): `BankingMercuryUserReviewTab` (1,098), `BankingMercuryCategoryReviewTab` (1,073), `BankingMercuryReconciliationTab` (233, fully self-contained — zero props), `BankingStripeInvoicesPanel` (191), `BankingStripeWebhookEventsPanel` (119).

View routing (see `parseBankingView`): `?product=mercury|stripe` (dev only; non-devs are forced to Mercury), `?tab=`:

```
mercury: 'ledger' | 'sorting' | 'drag_sort' | 'accounting' | 'user_review' | 'category_review' | 'reconciliation' | 'visuals'
stripe:  'invoices' | 'data'
```

Roles: page allows `dev`, `master_technician`, and assistant-like roles ([`isAssistantLike`](../src/lib/subcontractorLikeRole.ts)); everyone else is redirected to `/dashboard`. **Ledger and the Stripe product are dev-only**; assistants/master techs default to `accounting` and a guard effect rewrites their URL params.

Recent churn (grep `docs/RECENT_FEATURES.md`): the Accounting tab is the highest-churn region of the app's banking code — 50 changelog mentions of `BankingMercuryAccountingTab` vs 23 for `BankingMercuryDragSortTab` and 35 for `Banking.tsx`. The v2.475–v2.590 wave built team notes, the rules engine, apply/approve-by-default automation (v2.580/v2.581), the server-side unlabeled fetch (v2.579), and the Rules modal (v2.578). Expect the Accounting tab to keep moving; stage its seams accordingly.

### How to read a dossier

Each section lists: render location (symbol/JSX anchor — line numbers are "as of v2.1088" and rot; search the symbol), **owned local state** (moves with the region), **cross-tab/shared state** (stays in the parent), **derived memos**, **handlers/loaders**, **supabase tables/RPCs**, **sub-components** (extracted vs inline), **external coupling**, and **extraction status + risk + approach** with Stage-A pure-logic candidates.

### How to maintain this doc

- Update the relevant dossier whenever a region is extracted or its state/handlers change; flip its Status and point at the new file.
- Prefer symbol names over line numbers; treat any line number as approximate.

---

## Master summary table

| Region | Render anchor | Lines est. | Status | Coupling | Risk | Recommended action |
|---|---|---|---|---|---|---|
| `BankingMercuryTable` (+ `SortTh`, `TransactionDetailPanel`) | [`BankingMercuryTable.tsx`](../src/components/banking/BankingMercuryTable.tsx) | ~530 | **extracted** (v2.1304, verbatim file move) | low (props-only; rendered by Ledger + User Sort) | — | Done — `SortKey` + `formatCurrency` exported; the page imports them back |
| `BankingNicknamesMenu`, `BankingLedgerAdvancedMenu` | [`BankingNicknamesMenu.tsx`](../src/components/banking/BankingNicknamesMenu.tsx) / [`BankingLedgerAdvancedMenu.tsx`](../src/components/banking/BankingLedgerAdvancedMenu.tsx) | ~305 | **extracted** (v2.1304, verbatim file moves) | low (props-only) | — | Done |
| `sorting` — User Sort tab | `bankingView.mercuryTab === 'sorting'` panel | ~175 + header tools ~70 | inline | med (shares `rows` engine, `expandedRowId`, search, allocations, org notes) | low-med | Extract → `BankingMercurySortingTab` after the table component moves |
| `ledger` — Ledger tab (dev-only) | `bankingView.mercuryTab === 'ledger'` panel | ~170 | inline | med-high (Advanced menu drives sync/backfill/import/manual-accounts; nickname CRUD) | med | Extract → `BankingMercuryLedgerTab`; sync/backfill/import handlers stay in parent |
| `drag_sort` — Drag Sort tab | thin wrapper → `BankingMercuryDragSortTab` | ~29 (wrapper) / 1,392 (component) | **extracted** | med (16 props off the shared engine) | — | Sub-decompose later (bucket-stats kernel → lib; add-label modal → file) |
| `accounting` — Accounting tab | thin wrapper → `BankingMercuryAccountingTab` | ~33 (wrapper) / 2,304 (component) | **extracted** | high (23 props; lifted prefs; assignment-change callback loop) | — | Sub-decompose: rules-engine hook + approvals hook + section components |
| `user_review` — Card Review tab | thin wrapper → `BankingMercuryUserReviewTab` | ~12 / 1,098 | **extracted** | low (self-sources via `user_review_rows` RPC) | — | Done |
| `category_review` — Category Review tab | thin wrapper → `BankingMercuryCategoryReviewTab` | ~19 / 1,073 | **extracted** | med (reads shared engine) | — | Done |
| `reconciliation` — Reconciliation tab | `<BankingMercuryReconciliationTab />` | ~5 / 233 | **extracted** | none (zero props) | — | Done — the target end-state |
| `visuals` — Visuals tab (v2.1712) | `<BankingMercuryVisualsTab />` | ~5 / ~400 | **born extracted** (Reconciliation mold) | none (zero props; own fetches; dispatcher early-returns like Card Review) | — | Done — Sankey kernels in `src/lib/banking/` (`mercurySankeyLayout`, `mercuryVisualsFlows`), both unit-tested |
| Stripe `invoices` / `data` | `BankingStripeInvoicesPanel` / `BankingStripeWebhookEventsPanel` | ~11 | **extracted** | none | — | Done |
| Parent shell: role gate, URL router, data engine, prefs, modals | `export default function Banking()` | ~1,150 after extractions | permanent parent | — | — | Compress via seam hooks (`useBankingMercuryTransactions`, `useBankingMercuryRelations`, `useBankingNicknames`, `useBankingAccountingPrefs`) |

Page-level modals (all stay in the parent unless noted): `BankingAccountNicknamesModal` (dev), `BankingDebitCardsModal (v2.2750; was BankingDebitCardNicknamesModal)`, `BankingDebitCardRecentTxModal` (opened from both nickname and user-card-link modals), `MercuryBackfillModal` (dev), `MercuryImportCsvModal` (dev/master), `ManualAccountsModal` (dev/master), **`MercuryTransactionAllocationsModal`** (external coupling — see below), `BankingSortingConfigModal` (dev), `BankingDebitCardsModal (v2.2750; was BankingUserCardLinkModal)`.

---

## The shared substrate

**There is no shared record pointer.** Nothing like Bids' `setSharedBid` exists: no `?id=` deep link, no cross-tab "selected transaction". The closest analogues are UI-scoped: `expandedRowId` (row expansion, shared by the Ledger and Sorting tables and cleared by an effect when the row leaves the visible set) and `allocModalTx` (the transaction currently open in the allocations modal). Consequence for extraction: tabs don't need controlled selection props — **the substrate is data, not selection** (same shape as Materials), so the seams are data-engine hooks, not a selection lift.

The substrate has four layers, all owned by `Banking()`:

### 1. The transaction list engine (`rows` + the tab-aware loader dispatcher)

- `rows: MercuryTxRow[]` — the master in-memory list, **paged** (v2.2841: `fetchAllRows` + `.range()` under `posted_at desc, id desc`, 1000/page) up to the hard ceiling `MERCURY_TRANSACTIONS_BANKING_LIST_LIMIT = 15000` (`fetchAllRows`'s `maxRows`; `rowsTruncated` = hit the ceiling). Before v2.2841 the loaders were a bare `.limit(15000)`, which PostgREST's `max_rows` silently cut to 1,000 (J33-N1) — never reintroduce an un-ranged read here. **What `rows` contains depends on the active view**:
  - Ledger / User Sort / Drag Sort / Category Review → `loadAllRows` (paged `mercury_transactions` select, newest-first, `MERCURY_TRANSACTIONS_BANKING_LIST_COLUMNS` — raw omitted, hydrated lazily).
  - Accounting + Hide labeled **on** (the default) → `loadUnlabeledRows` (RPC `list_unlabeled_mercury_transactions`, a server-side anti-join against `mercury_transaction_drag_sort_assignments`; paged with `.range()` on the RPC result — the function's `ORDER BY posted_at desc nulls last, id desc` makes that stable).
  - Accounting + Hide labeled **off** → `loadLabeledFirstPage` / `loadLabeledNextPage` (RPC `list_mercury_transactions_keyset`, `ACCOUNTING_LABELED_PAGE_SIZE = 500` pages; cursor = `labeledCursor {postedAt, id}`, flags `labeledHasMore`/`labeledLoadingMore`, refs `labeledLoadingMoreRef` re-entry guard + `labeledLoadedCountRef` silent-refresh depth).
  - Card Review → **no fetch** (the tab self-sources via its own `user_review_rows` RPC; the dispatcher `loadRowsForActiveView` early-returns).
- `listLoadSeqRef` — monotonic token; every fresh load bumps it and in-flight responses with a stale token are discarded. **Any seam extraction must preserve this token discipline.**
- Raw hydration effects: three `useEffect`s lazily fetch the `raw` JSON column via `fetchMercuryTransactionRawById`/`ByIds` + `applyMercuryRawPatch` — (a) when Drag Sort or Accounting is active, (b) when the debit-card recent-tx modal opens, (c) when a row expands.

### 2. The relations caches (`loadMercuryAllocations`)

`allocationsByTxId: Map<string, MercuryJobSplit[]>`, `personIdByTxId`, `userIdByTxId`, `personNameById`, `userNameById`, `jobLabelByIdBanking` — rebuilt whenever `rows` changes via [`fetchAllJobAllocations` / `fetchAllAttributions`](../src/lib/fetchMercuryRelationsByTxIds.ts) (two **paged** whole-table reads — deliberately not chunked by id, since the master list is the whole table; v2.2841 replaced the un-ranged `.limit(100000)` that PostgREST cut to 1,000 rows) grouped by the pure kernel [`buildMercuryRelationMaps`](../src/lib/mercuryRelationMaps.ts), plus `jobs_ledger` / `people` / `users` name lookups. Consumed by: Ledger, Sorting, Drag Sort, Accounting, Category Review, the allocations modal, and search enrichment. Refreshed by callbacks from the allocations modal (`onSaved`), User Review + Category Review (`onAttributionChanged`), and the user-card-link modal (`onSaved`).

### 3. Nickname caches

`nicknameByAccount` / `nicknameByDebitCard` (+ `loadNicknames` / `loadDebitCardNicknames`, CRUD `persistNickname` / `clearNicknameRow` / `persistDebitCardNickname` / `clearDebitCardNicknameRow`, per-row busy ids `savingNicknameId` / `savingDebitCardNicknameId`, `nicknameDrafts`). Tables `mercury_account_nicknames`, `mercury_debit_card_nicknames` (debit ids normalized `.toLowerCase()`). Consumed by every Mercury tab, both nickname modals, sorting config, user-card-link, and search haystacks.

### 4. Org team notes

`useMercuryOrgNotesByTxId(bankingOrgNoteFetchIds)` — already a hook; the parent feeds it the visible-row ids of the active tab (User Sort → `sortingFilteredSorted`; Ledger/Drag Sort/Accounting → `filteredSorted`; otherwise the stable `NO_MERCURY_TX_IDS_FOR_BANKING_NOTES` constant). `onOrgNoteUpdated` patches locally via `updateOrgNoteLocal`.

### Accounting prefs cluster (lifted from the child, stays in parent)

`hideLabeledTransactions` (drives which loader the dispatcher picks — this is *why* it lives in the parent), `applyRulesByDefault`, `approveByDefault`, `autoApplyResetTick` (monotonic counter bumped by `handleSync`/`handleBackfill` so a sync re-fires one auto-apply pass), `accountingPrefsHydrated` (gates the first fetch until the per-user value is read — prevents the default-vs-stored double fetch). Persistence is dual-write: localStorage helpers in [`bankingDragSortStorage.ts`](../src/lib/bankingDragSortStorage.ts) for instant reads + the `banking_user_prefs` row via [`bankingUserPrefs.ts`](../src/lib/bankingUserPrefs.ts) (`fetchAccountingPrefs` / `saveBankingPref`) for cross-device sync (`syncPrefAcrossDevices`); a server value found on load is mirrored back into localStorage.

### Seam hook candidates

1. **`useBankingMercuryTransactions`** — `rows`, `loading`, `error`, `rowsTruncated`, the four loaders + `loadRowsForActiveView` dispatcher, `listLoadSeqRef`, the keyset-cursor cluster, and the three raw-hydration effects. Inputs: `myRole`, `bankingView`, `hideLabeledTransactions`, `accountingPrefsHydrated`, `showToast`.
2. **`useBankingMercuryRelations`** — the six relation caches + `loadMercuryAllocations`. Input: `rows`, `canAccessBanking`.
3. **`useBankingNicknames`** — both caches + loaders + CRUD + busy/draft state.
4. **`useBankingAccountingPrefs`** — the three toggles + tick + hydration flag + dual-write handlers.

The parent destructures each hook so downstream references (and the ~23-prop Accounting wrapper) don't change.

---

## Per-region dossiers — Banking.tsx

### Parent shell: role gate, URL router, prefs (permanent)

- **Render location:** top of `Banking()` (~1098–1426) plus the header/tab-bar JSX (~2252–2522).
- **State:** `myRole` (fetched from `users.role`), `bankingView` (memo over `searchParams` via `parseBankingView`), `sortingConfig`, prefs cluster (above), menu-open flags (`nicknamesMenuOpen`, `ledgerAdvancedMenuOpen`), all modal-open flags.
- **Handlers:** `setMercurySubTab` / `setStripeSubTab` / `setBankingProduct` (all `setSearchParams` with `{replace: true}`), `handleSortingConfigSave` (dev-only; `saveBankingSortingConfig` localStorage).
- **Effects:** role fetch; redirect non-banking roles to `/dashboard`; the master-tech/assistant URL-normalization effect (rewrites missing/disallowed `?product`/`?tab` to `mercury`/`accounting`); close menus on view change; close sorting-config/user-card-link modals when leaving the Sorting tab; sorting-config hydration (dev gets per-user `loadBankingSortingConfig(user.id)`, master-tech/assistants always get `defaultBankingSortingConfig()`).
- **Supabase:** `users` (role).
- **Stays in the parent forever:** the URL router, role gating, and every modal opened from 2+ tabs.

### In-file module components (extracted — v2.1304 pure file moves)

| Component | Now at | ~Lines | Notes |
|---|---|---|---|
| `BankingNicknamesMenu` | [`BankingNicknamesMenu.tsx`](../src/components/banking/BankingNicknamesMenu.tsx) | 120 | click-outside/Escape dropdown; rendered in the User Sort header tools AND the Ledger toolbar |
| `BankingLedgerAdvancedMenu` | [`BankingLedgerAdvancedMenu.tsx`](../src/components/banking/BankingLedgerAdvancedMenu.tsx) | 183 | Ledger's Advanced dropdown (Refresh / Backfill / Import CSV / Manual accounts / Reload); role-gated items via optional-prop presence |
| `SortTh` | private in `BankingMercuryTable.tsx` | 30 | sortable `<th>` with `aria-sort` |
| `TransactionDetailPanel` | private in `BankingMercuryTable.tsx` | 96 | expanded-row detail grid + raw JSON `<pre>` |
| `BankingMercuryTable` | [`BankingMercuryTable.tsx`](../src/components/banking/BankingMercuryTable.tsx) | 402 | the shared Ledger/User Sort table: expandable rows, notes preview/editor sub-rows (via `MercuryTxNotesDisclosure` pieces + `bankingMercuryNotesSubRowColSpans`), allocation Person/Jobs cells, excluded-duplicate strike-through badge, and 4 layout-variant flags (`allocationsAfterCounterparty`, `hideKindColumn`, `debitAndAccountAfterAmount`, `counterpartyNoteCombined`). Owns only `notesExpandedTxId` locally. |

All were props-only (no parent closure), so the moves were verbatim cut/paste (~830 lines off `Banking.tsx`, 3,104 → 2,181). `SortKey`, `formatCurrency`, and the private `formatDate`/`formatDateTime`/`formatMercuryCategory` helpers moved with the table (`SortKey` + `formatCurrency` are exported; the page imports them back, same pattern as the Takeoff T3 move). `sortMercuryRowsStable` and `parseBankingView` stayed in the page for their own Stage-A pass.

### Module-level pure helpers (Stage-A residue in Banking.tsx)

`sortMercuryRowsStable(list, {key, dir})` (stable 3-key sort, NaN-date handling, id tiebreak) and `parseBankingView(params, role)`. Both pure, both untested. (`formatCurrency`/`formatDate`/`formatDateTime`/`formatMercuryCategory` moved with the table to `BankingMercuryTable.tsx` in v2.1304 — still Stage-A consolidation candidates.) See [Stage-A inventory](#stage-a-pure-logic-inventory).

### `ledger` — Ledger tab (dev-only, inline)

- **Render location:** `role="tabpanel" id="banking-panel-mercury-ledger"` behind `bankingView.mercuryTab === 'ledger' && isDevBanking` (~2801–2968).
- **Owned local state:** `accountFilter`, `kindFilter` (⚠ also passed into Drag Sort — see cross-tab), `sort` (+ `setSortForColumn`), `ledgerAdvancedMenuOpen`.
- **Cross-tab/shared state:** `rows`/`loading`/`error` engine, `bankingSearchText` (**shared with the User Sort tab's search box and Drag Sort's** — one string state feeds all three), `expandedRowId` (shared with Sorting), nickname caches + both nickname modals, allocations caches, org notes, `rowsTruncated`.
- **Derived memos:** `filteredSorted` (accountFilter + kindFilter + search over `buildMercuryTxSearchHaystackWithJobPerson` → `sortMercuryRowsStable`), `booksFilteredSorted` (drops `duplicate_of_transaction_id` rows — feeds totals AND the Drag Sort/Accounting/Category Review wrappers), `totalAmount`, `accountOptions`, `kindOptions`, `nicknameManageIds`, `debitCardIdsFromRows`, `debitCardManageIds`.
- **Handlers:** `handleSync` (edge fn `sync-mercury-transactions`, hardcoded `lookback_days: 90`, bumps `autoApplyResetTick`), `handleBackfill` (same fn with `{start, end}`), `handleImportCsv` (edge fn `import-manual-transactions`), nickname CRUD (see substrate §3).
- **Supabase:** `mercury_transactions` (via engine), `mercury_account_nicknames`, `mercury_debit_card_nicknames`; edge functions `sync-mercury-transactions`, `import-manual-transactions`.
- **Sub-components:** `BankingMercuryTable`, `BankingLedgerAdvancedMenu`, `BankingNicknamesMenu` (all extracted, v2.1304); modals `MercuryBackfillModal`, `MercuryImportCsvModal`, `ManualAccountsModal` (all extracted).
- **External coupling:** none inbound (no deep links carry ids).
- **Extraction status + risk + approach:** Inline. **Medium risk.** The tab's JSX is thin once `BankingMercuryTable` is its own file; the weight is that its toolbar owns the page's sync/backfill/import entry points and the nickname CRUD, all of which mutate parent-owned caches. Approach: extract `BankingMercuryLedgerTab` receiving `filteredSorted`, filters + setters, sort + setter, the shared table props, and callbacks (`onSync`, `onOpenBackfill`, `onOpenImportCsv`, `onOpenManualAccounts`, `onReload`); `handleSync`/`handleBackfill`/`handleImportCsv` and the modals **stay in the parent** (backfill/import completion must call `loadRowsForActiveView` + bump `autoApplyResetTick`, which are parent concerns). Stage A: `sortMercuryRowsStable` → lib + tests first.

### `sorting` — User Sort tab (inline)

- **Render location:** `role="tabpanel" id="banking-panel-mercury-sorting"` (~2524–2696) plus the header tools region (`aria-label="Banking User Sort tools"`, ~2452–2520: Configuration [dev], User Card Link, Nicknames menu).
- **Owned local state:** `sortingSort` (+ `setSortingSortForColumn`), `sortingConfigModalOpen`, `userCardLinkModalOpen` (both force-closed by an effect when leaving this tab).
- **Cross-tab/shared state:** `sortingConfig` (dev-configurable slice definition, hydrated in the shell), `bankingSearchText` (shared), `expandedRowId` (shared), `rows` engine, allocations caches, nicknames, org notes.
- **Derived memos:** `sortingFiltered` ([`filterMercuryRowsForSorting`](../src/lib/bankingSortingCounts.ts) applies the config slice), `sortingAfterSearch`, `sortingFilteredSorted`, `booksSortingFilteredSorted` (duplicate-excluded), `sortingTotalAmount`, `sortingUnmatchedCounts` ([`countSortingUnmatched`](../src/lib/bankingSortingCounts.ts) — "Without person" / "Not split to jobs" chips).
- **Handlers:** none exclusive beyond the sort toggler; Refresh/Reload buttons reuse `handleSync` / `loadRowsForActiveView`.
- **Supabase:** none beyond the shared engine (its config lives in localStorage via [`bankingSortingConfig.ts`](../src/lib/bankingSortingConfig.ts)).
- **Sub-components:** `BankingMercuryTable` with all four layout flags on (`allocationsAfterCounterparty`, `hideKindColumn`, `debitAndAccountAfterAmount`, `counterpartyNoteCombined`); modals `BankingSortingConfigModal`, `BankingDebitCardsModal (v2.2750; was BankingUserCardLinkModal)` (extracted).
- **External coupling:** none.
- **Extraction status + risk + approach:** Inline. **Low-medium risk — best first tab extraction.** All filtering/counting logic is already in tested libs; the tab is mostly layout. Extract `BankingMercurySortingTab` receiving the memoized row slices (or the inputs to recompute them), `sortingSort` state can move in, `sortingConfig` stays parent-owned (hydration is role-dependent), the two modals can move with the tab **if** the "close on tab leave" effect becomes unmount-natural (it does — the modals only open from this tab's header). The header-tools region currently renders in the page header outside the panel; move it into the tab or pass a `renderHeaderTools` slot — decide at extraction time, preserve placement.

### `drag_sort` — Drag Sort (extracted; see sub-decomposition dossier below)

- **Render location:** thin wrapper behind `bankingView.mercuryTab === 'drag_sort' && canAccessBanking && user?.id` (~2698–2726).
- **Props from parent (16):** `userId`, `filteredTransactions={booksFilteredSorted}` (⚠ the *Ledger's* filter/search state shapes this list), `loading`, `accountFilter`/`setAccountFilter`, `kindFilter`/`setKindFilter`, `bankingSearchText`/`setBankingSearchText`, `accountOptions`, `kindOptions`, both nickname maps, `loadError`, the five relation caches + `jobLabelById`, `onEditAllocations={openAllocModalForMercuryRow}`, `orgNotesByTxId`/`onOrgNoteUpdated`.
- **Status:** extracted; its dossier is below.

### `accounting` — Accounting (extracted; see sub-decomposition dossier below)

- **Render location:** thin wrapper behind `bankingView.mercuryTab === 'accounting' && canAccessBanking && user?.id` (~2728–2760).
- **Props from parent (23):** everything Drag Sort gets (minus the account/kind filter pair) plus `mercurySearchNicknameCtx`, `mercurySearchEnrich`, the lifted prefs (`hideLabeledTransactions`/`onHideLabeledTransactionsChange`, `applyRulesByDefault`/`onApplyRulesByDefaultChange`, `autoApplyResetTick`, `approveByDefault`/`onApproveByDefaultChange`), `onAfterAssignmentChange={() => loadRowsForActiveView({silent: true})}` (the label⇄list feedback loop), and the keyset trio `labeledHasMore` (gated by `isAccountingLabeledView`), `labeledLoadingMore`, `onLoadMoreLabeled`.
- **Status:** extracted; its dossier is below.

### `user_review` — Card Review (extracted, done; key `user_review`, tab label renamed from "User Review" in v2.1262 — the Dashboard clock-strip "User Review" modal kept its name)

- Wrapper (~2762–2773) passes only `mercurySearchNicknameCtx`, `attributionOptions` (memo: [`buildBankingAttributionOptions`](../src/lib/bankingAttributionOptions.ts) merging `usersSelectOptions` + `peopleAttribRows` with `u:`/`p:` prefixed values), `recentPersonPicksStorageKey`, and `onAttributionChanged={loadMercuryAllocations}`. The tab **self-sources** its rows from the `user_review_rows` RPC — the parent dispatcher deliberately skips the master fetch when this tab is active. The attribution option sources are loaded page-level via RPCs `list_users_for_banking_attribution` and `list_people_with_kind_for_banking_attribution` (the latter cast `as unknown as` — not yet in generated types).

### `category_review` — Category Review (extracted, done)

- Wrapper (~2775–2793) passes `filteredTransactions={booksFilteredSorted}`, `loading`, `loadError`, `mercurySearchNicknameCtx`, the four attribution caches, `attributionOptions`, `recentPersonPicksStorageKey`, `onAttributionChanged={loadMercuryAllocations}`. Rides the master 15k fetch.

### `reconciliation` — Reconciliation (extracted, done)

- `<BankingMercuryReconciliationTab />` (~2795–2799) — **zero props**; entirely self-contained (its own fetch via [`fetchMercuryReconciliation.ts`](../src/lib/fetchMercuryReconciliation.ts)). The target end-state for every tab.

### Stripe product (`invoices` / `data`, dev-only, extracted, done)

- `BankingStripeInvoicesPanel` / `BankingStripeWebhookEventsPanel` render prop-less behind `bankingView.product === 'stripe'` (~2970–2980).

### Page-level modals (~2982–3101)

| Modal | Opened from | Key wiring |
|---|---|---|
| `BankingAccountNicknamesModal` (dev) | Nicknames menu (User Sort header + Ledger toolbar) | `nicknameManageIds`, drafts + CRUD callbacks |
| `BankingDebitCardsModal (v2.2750; was BankingDebitCardNicknamesModal)` | Nicknames menu (both) | `debitCardManageIds`, CRUD callbacks, `onOpenRecentTransactions` |
| `BankingDebitCardRecentTxModal` | debit-card nicknames modal AND user-card-link modal | `recentTxDebitCardId`, `rows`, `DEBIT_CARD_RECENT_TX_CAP = 50`; triggers a raw-hydration effect |
| `MercuryBackfillModal` (dev) | Ledger Advanced menu | `onSubmit={handleBackfill}` |
| `MercuryImportCsvModal` (dev/master) | Ledger Advanced menu | `onSubmit={handleImportCsv}` |
| `ManualAccountsModal` (dev/master) | Ledger Advanced menu | `onChanged` → full reload trio |
| **`MercuryTransactionAllocationsModal`** | Ledger, User Sort, Drag Sort, Accounting (all via `onEditAllocations` → `openAllocModalForMercuryRow`) | see external coupling below |
| `BankingSortingConfigModal` (dev) | User Sort header tools | `initialConfig={sortingConfig}`, kind/account/debit choices, `onSave={handleSortingConfigSave}` |
| `BankingDebitCardsModal (v2.2750; was BankingUserCardLinkModal)` | User Sort header tools | `debitCardManageIds`, `usersOptions`, `onSaved={loadMercuryAllocations}`, `onOpenRecentTransactions` |

**All of these stay in the parent** (each is opened from 2+ tabs or from the shared header) — except `MercuryBackfillModal`/`MercuryImportCsvModal`/`ManualAccountsModal`, which are Ledger-only but whose completion callbacks touch parent loaders, so keep them parent-owned too (open via callback from the extracted Ledger tab).

### External coupling: `MercuryTransactionAllocationsModal` (NOT mapped here)

[`src/components/MercuryTransactionAllocationsModal.tsx`](../src/components/MercuryTransactionAllocationsModal.tsx) (1,540 lines) is a shared org-wide modal (also used outside Banking, e.g. Jobs' Mercury-allocation flows) that owns person/user attribution + job-split editing for one transaction. Banking's contract with it: `openAllocModalForMercuryRow(r)` hydrates `raw` if needed (`mercuryRowNeedsRawHydration` → `fetchMercuryTransactionRawById`, patching the row back into `rows`) then sets `allocModalTx`; the modal receives `initialAllocations`/`initialPersonId`/`initialUserId` from the relation caches **as placeholders only** — since v2.2841 it re-reads the transaction's splits + attribution by id when it opens (staff paths; `tallySelfService` keeps the props), disables Save until that read lands, and re-reads again right before `replace_mercury_transaction_splits`, refusing with a Reload banner if the DB changed in between ([`mercuryAllocModalSeed.ts`](../src/lib/mercuryAllocModalSeed.ts) `decideSplitSaveGuard`) — plus `legacyPersonDisplayName`, `jobLabelById`, `usersOptions`, both nickname maps, `recentPersonPicksStorageKey`; `onSaved` → `loadMercuryAllocations()`. Its exported types `MercuryJobSplit` / `MercuryAllocSavedDetail` are load-bearing across the Banking tabs. Any Banking decomposition must keep this modal + `openAllocModalForMercuryRow` + the relation caches co-located in the parent.

---

## Sub-decomposition dossier — `BankingMercuryAccountingTab.tsx` (2,304 lines)

Three logical regions share one component: the **Approvals queue**, the **Rules engine**, and the **Sorting Ledger**. They are coupled through `assignmentLabelByTxId` (the tx→label map) and the `loadPending`/`loadRulesAndUsage` loaders.

### Module-level helpers (top of file, ~200–284)

Constants `TEST_PREVIEW_LIMIT = 40`, `APPLY_RULES_PER_CLICK_CAP = 500`, `APPLY_RULES_CONFIRM_THRESHOLD = 200`, `APPROVALS_PAGE_SIZE = 50`, `ACCOUNTING_PENDING_ID_IN_CHUNK_SIZE = 200` (chunked `.in()` — unchunked URLs blew HTTP/2 header limits, `ERR_HTTP2_PROTOCOL_ERROR`); chunked fetchers `fetchAccountingPendingRuleNames`, `fetchAccountingPendingLabelNames`, `fetchAccountingPendingTxsByIds`; `criteriaToJson`. The fetchers are lib-shaped (move to `src/lib/` alongside [`fetchMercuryRelationsByTxIds.ts`](../src/lib/fetchMercuryRelationsByTxIds.ts)).

### Region A — Approvals queue

- **Render location:** `<section>` with `<h2>Approvals</h2>` (~1651–1887).
- **Owned local state:** `pendingApprovals: PendingApproval[]` (+ mirror `pendingApprovalsRef` for memo-stable card callbacks), `pendingLoading`, `pendingLoadSeqRef` (stale-response token), `pendingSearch`, `groupByLabel` (persisted per-user via `readAccountingApprovalsGroupByLabel`/`write…`), `expandedGroupIds`, `groupVisibleCount`, `approvalsVisibleCount` (+ `prevPendingLenRef` 0→N reset), `approveAllBusy`.
- **Cross-region/shared:** `assignmentLabelByTxId` (writes on approve), `ruleUsageApproved` (increments), `labels`/`labelById`, `allocationsByTxId` (conflict detection), `conflictSuggestionIds` memo (Internal Transfers × job-splits mutual exclusion — shared by bulk approvers, the auto-approve gate, and group badges), parent's `approveByDefault` + `onAfterAssignmentChange`.
- **Derived memos:** `pendingApprovalItems` (projection for the pure kernel), `filteredApprovalItems` ([`filterApprovalItems`](../src/lib/accountingApprovalGroups.ts)), `filteredSuggestionIds`, `pendingFilteredApprovals`, `approvalGroups` ([`groupApprovalItemsByLabel`](../src/lib/accountingApprovalGroups.ts)), `pendingByLabel`, `approvableFilteredCount`/`conflictFilteredCount`, `autoApprovablePending` (conflict-free list feeding the auto-approve signature).
- **Handlers:** `loadPending` (pending select + chunked rule/label/tx name hydration), `handleApprove` (upsert assignment + suggestion UPDATE `status:'approved'`, `final_label_id`, `resolved_at/by`), `rejectPendingItems` (chunked DELETE, `REJECT_CHUNK = 500`), `approvePendingItems` (chunked RPC `bulk_approve_accounting_label_suggestions`, `APPROVE_CHUNK = 500`, conflict split + optimistic assignment write), `handleApproveAll` (search-filtered set), `handleApproveGroup`/`handleRejectGroup` (`GROUP_BULK_CONFIRM_THRESHOLD = 25` → `window.confirm`), stable card callbacks `handleApproveCard`/`handleRejectCard`/`handleLabelChangeCard` (resolve rows via `pendingApprovalsRef` so `React.memo` on `AccountingApprovalCard` holds), auto-approve effect ([`buildApproveByDefaultSignature` / `shouldAutoApproveAccountingSuggestions`](../src/lib/accountingApproveByDefaultAutoTrigger.ts) + `lastAutoApprovedSignatureRef`; **approves the full approvable set, ignoring the manual search filter**).
- **Supabase:** `mercury_accounting_label_suggestions` (SELECT/UPDATE/DELETE), `mercury_accounting_label_rules` + `mercury_drag_sort_labels` + `mercury_transactions` (chunked name/tx hydration), RPC `bulk_approve_accounting_label_suggestions`.
- **Sub-components:** `AccountingApprovalCard` (extracted, memoized), `AccountingApprovalGroupHeader` (extracted).
- **Extraction approach:** `useAccountingApprovals` hook (state + loaders + approve/reject cores + auto-approve effect) + an `AccountingApprovalsSection` component. **Medium risk** — the optimistic-write/rollback pairs and the ref-based card-callback stability must move intact.

### Region B — Rules engine

- **Render location:** the `Rules (N)` trigger button (~1889–1907) + modals (~2164–2301); logic ~1202–1628.
- **Owned local state:** `rules`, `rulesLoading`, `ruleUsageApproved`, `applyRulesBusy`, `applyRulesConfirm: ApplyRulesPreflight | null`, rule-form modal cluster (`ruleModalOpen`, `ruleModalMountKey`, `ruleModalInitial`, `editingRuleId`), test-preview cluster (`testModalOpen`, `testRows`, `testTotal`, `testOtherMatchingRulesByTxId`), overlaps cluster (`overlapsModalOpen`, `auditPendingReopenAfterRuleModalRef`, `ruleModalOpenPrevRef`), rules-table cluster (`rulesModalOpen`, `rulesTableSearchText`, `rulesTableSort`).
- **Cross-region/shared:** `assignmentLabelByTxId` (preflight excludes assigned txs), `filteredTransactions` (the match universe — **Banking-filtered rows only**, deliberately not the Accounting search / More filters / Hide-labeled slice), `labels`, parent's `applyRulesByDefault` + `autoApplyResetTick`.
- **Derived memos:** `ruleById`, `overlapReport` ([`buildAccountingRuleOverlapReport`](../src/lib/accountingRuleOverlap.ts), computed only while the modal is open), `overlapTxByIdMap`, `rulesFilteredForTable`/`rulesSortedForTable` ([`accountingRulesTableSearch.ts`](../src/lib/accountingRulesTableSearch.ts)).
- **Handlers:** `loadRulesAndUsage`, `computeApplyRulesPreflight` (pending-id server hop + [`buildAccountingRulesToInsert`](../src/lib/applyAccountingRulesPreflight.ts)), `executeApplyRules` (cap slice + `INSERT_CHUNK = 2000` via RPC `bulk_insert_accounting_label_suggestions`), `applyRulesWithSnapshot` (>200 matches → confirm modal), `applyRules`, `runAutoApply` (bypasses the confirm modal; keeps the 500 cap), the auto-apply effect ([`accountingApplyRulesAutoTrigger.ts`](../src/lib/accountingApplyRulesAutoTrigger.ts) + `lastAutoAppliedSignatureRef`, reset by `autoApplyResetTick`), `openNewRuleModal` / `openNewRuleFromCounterparty` (prefills via `suggestedRuleNameFromCounterparty`) / `openEditRuleModal` / `openEditRuleById` / `openEditRuleByIdFromOverlaps` (the z-index reopen dance — see quirks), `runTestFromCriteria` ([`matchAccountingLabelRuleCriteria`](../src/lib/accountingLabelRuleMatch.ts) over `filteredTransactions` + other-rules overlap annotation), `saveRuleDraft` / `saveRuleDraftAndApply` (⚠ near-duplicate INSERT/UPDATE blocks), `deleteRuleCore` / `deleteRule`.
- **Supabase:** `mercury_accounting_label_rules` (CRUD), `mercury_accounting_label_suggestions` (usage SELECT, pending-ids SELECT), RPC `bulk_insert_accounting_label_suggestions`.
- **Sub-components (all extracted):** `AccountingRuleFormModal`, `BankingMercuryAccountingRulesModal`, `BankingMercuryAccountingOverlapsModal`, `BankingMercuryAccountingApplyRulesConfirmModal`. The **Test results modal is still inline** (~2193–2255) — extract it.
- **Extraction approach:** `useAccountingRulesEngine` hook. **Medium-high risk** — the auto-apply signature/reset protocol spans parent (`autoApplyResetTick`) and child; `saveRuleDraftAndApply` chains save → `loadRulesAndUsage` → `applyRulesWithSnapshot(fresh)` and must keep using the *fresh* rules list, not state.

### Region C — Sorting Ledger

- **Render location:** `<section>` with `<h2>Sorting Ledger (n)</h2>` (~1909–2122) + filter/frequency/quick-assign modals (~2124–2162).
- **Owned local state:** `accountingSearchText`, `ledgerFiltersApplied`/`ledgerFilterDraft`/`ledgerFilterModalOpen` (persisted per-user via [`bankingAccountingLedgerFilters.ts`](../src/lib/bankingAccountingLedgerFilters.ts) parse/serialize + `bankingDragSortStorage` raw read/write), `ledgerSort` ([`bankingMercuryLedgerTableSort.ts`](../src/lib/bankingMercuryLedgerTableSort.ts), persisted), `counterpartyFrequencyModalOpen`, `notesExpandedTxId`, quick-assign cluster (`quickAssignTxId`, `quickAssignBusy`), `labels`/`labelsLoading`/`labelAssignmentCountById`, `assignmentLabelByTxId`/`assignmentsLoading`/`assignmentsLoadSeqRef`.
- **Cross-region/shared:** `assignmentLabelByTxId` is the bridge to both other regions; `inputIsUnlabeledOnly` (= parent's `hideLabeledTransactions`) short-circuits the assignment sweep AND the client-side hide filter; keyset props (`labeledHasMore`/`labeledLoadingMore`/`onLoadMoreLabeled`) drive the window-scroll infinite-scroll effect (400px threshold, fires once on mount for short pages).
- **Derived memos:** `afterAccountingSearch` → `afterLedgerFilters` ([`filterRowsByAccountingLedgerFilters`](../src/lib/bankingAccountingLedgerFilters.ts)) → `displayTransactions` (hide-labeled) → `sortedDisplayTransactions` (`compareMercuryLedgerRows`); `counterpartyFrequencyByKey` / `counterpartyFrequencyRows` ([`bankingMercuryCounterpartyFrequency.ts`](../src/lib/bankingMercuryCounterpartyFrequency.ts)); `accountingKindOptions`; `quickAssignTransactionSummary`.
- **Handlers:** `loadLabels` (via `ensureDragSortDefaultLabels` + RPC `list_mercury_drag_sort_label_assignment_counts`), `loadAssignmentsForList` (**one unfiltered select, `.limit(100000)`** — contrast Drag Sort's 400-id chunks), `upsertDragAssignment` / `removeAssignment` / `clearRowDragSortLabel` (per-row optimistic rollback), `handleQuickAssignLabel` (Internal-Transfers guard), ledger-filter modal open/apply/cancel/clear (`withLedgerFilterKindsNormalizedIfAllSelected` on apply).
- **Supabase:** `mercury_drag_sort_labels`, `mercury_transaction_drag_sort_assignments` (SELECT/UPSERT/DELETE), RPC `list_mercury_drag_sort_label_assignment_counts`.
- **Sub-components (all extracted):** the `bankingMercuryDragSortLedger.tsx` row/thead/notes family (shared with Drag Sort), `BankingMercuryAccountingLedgerFilterModal`, `MercuryCounterpartyFrequencyModal`, `AccountingLabelQuickAssignModal`, `BankingMercuryDuplicatesPanel` (renders above Approvals; `onAfterChange` → parent reload).
- **Extraction approach:** an `AccountingSortingLedgerSection` component once labels/assignments move to a shared `useAccountingLabelsAndAssignments` hook that Regions A and B also read. **This hook is the cluster seam** — extract it before splitting any region out.

---

## Sub-decomposition dossier — `BankingMercuryDragSortTab.tsx` (1,392 lines)

- **Render location:** whole file; one `DndContext` wrapping a left ledger column and a sticky right sidebar of label buckets, plus the Quick Sort focus modal.
- **Module-level pure helpers (~60–145):** `DragSortBucketStats`, `emptyBucketStats`, `buildBucketStats`, `cloneBucketStats`, `subtractFromLabeled`, `addToLabeled`, `applyAssignmentDelta` — the optimistic count/sum bucket math. **Pure, untested, top Stage-A candidate.**
- **Module-level components:** `DragSortTransactionPreview` (memoized drag overlay card), `LabelDropZone` (`useDroppable` wrapper over extracted `DragSortLabelBucketCard`), `InboxDropZone` (`INBOX_DROP_ID` clear-label target).
- **Owned local state:** `labels`/`labelsLoading`, `assignmentLabelByTxId`, `bucketStats`, `assignmentsLoading`, `hideLabeledTransactions` (**tab-local here** — persisted via `readDragSortHideLabeledTransactions`, distinct from the Accounting tab's lifted toggle), `labelsCardsExpanded` (persisted), `activeDragTxId`, add-label modal cluster (`addLabelModalOpen`, `newLabelName`, `newLabelScheduleCLine`, `newLabelDescription`; caps `DRAG_SORT_LABEL_NAME_MAX = 120`, `…SCHEDULE_C_LINE_MAX = 32`, `…DESCRIPTION_MAX = 2000`), `detailLabel` (CategoryDetailModal), `counterpartyFrequencyModalOpen`, `dragSortHelpOpen`, `quickLabelModalOpen`, `labelsSidebarSearchText`, `quickLabelUndoStack` (+ ref; **capped at last 2** via `.slice(-2)`), `notesExpandedTxId`.
- **Cross-tab/shared state (props):** `filteredTransactions={booksFilteredSorted}` (⚠ shaped by the Ledger tab's `accountFilter`/`kindFilter`/`bankingSearchText`, whose setters this tab also renders — the filter row here mutates parent state shared with Ledger), the relation caches, nicknames, org notes, `onEditAllocations`.
- **Derived memos:** `labelById`, `filteredLabelsForSidebar` (sidebar search over name + schedule_c_line), `displayTransactions` (hide-labeled client filter), `counterpartyFrequencyRows`, `dragSortQuickLabelQueue` (unlabeled rows in ledger order; `[0]` is the Quick Sort front card), `txById`, `activeOverlayRow`.
- **Handlers:** `loadLabels` (`ensureDragSortDefaultLabels` then select), `loadAssignmentsForList` (**chunked 400-id `.in()` batches** — no seq token here, unlike the Accounting twin), `upsertAssignment`/`deleteAssignment`, `applyDragSortAssignment` (the core: Internal-Transfers guard, optimistic map + `bucketStats` delta, per-row rollback via `fail`), `handleQuickLabelPick`/`handleQuickLabelUndo`, `handleDragEnd` (inbox vs `label:` prefix routing), `clearRowDragSortLabel`, `addLabel` (validation + `sort_order` max+1 insert), `removeLabel` (blocks `is_system_default`; `window.confirm`; clears affected assignments locally then reloads), `onDragStart`. Sensors: `PointerSensor` `activationConstraint: {distance: 4}`; collision `pointerWithin` (comment: cheaper than `closestCenter`; try `rectIntersection` if drops misfire).
- **Supabase:** `mercury_drag_sort_labels` (SELECT/INSERT/DELETE), `mercury_transaction_drag_sort_assignments` (SELECT/UPSERT/DELETE).
- **Sub-components:** extracted — `bankingMercuryDragSortLedger.tsx` row family, `DragSortLabelBucketCard`, `CategoryDetailModal`, `MercuryCounterpartyFrequencyModal`, `BankingMercuryDragSortFocusModal` (Quick Sort). Inline — the **Add Accounting Label modal** (~1190–1351, self-contained, easy file move).
- **External coupling:** none beyond the parent props; labels + assignments tables are shared org-wide with the Accounting tab (DB-level coupling; no shared client state — the two tabs each load their own copies and can go stale against each other until reload).
- **Extraction status + risk + approach:** Already extracted from the page; internally healthy but improvable. Stage A: bucket-stats kernel → `src/lib/bankingDragSortBucketStats.ts` + tests (delta math, clone semantics, unlabeled transitions). Stage B (optional): Add-label modal → own file; consider adopting the Accounting tab's `assignmentsLoadSeqRef` token to guard `loadAssignmentsForList` against stale responses (behavior-affecting — do as its own reviewed change, not during a move).

---

## Stage-A pure-logic inventory

Extract to `src/lib/*` + colocated tests **before** any component moves. Note: Banking is unusually far along — most calc already lives in tested libs (`bankingMercurySearch`, `bankingSortingCounts`, `bankingAccountingLedgerFilters`, `accountingApprovalGroups`, `applyAccountingRulesPreflight`, `accountingLabelRuleMatch`, `accountingRuleOverlap`, both auto-trigger modules, `bankingMercuryCounterpartyFrequency`, `bankingMercuryLedgerTableSort`, `bankingMercuryNotesSubRowColSpan`, `bankingAttributionOptions`). What's left:

| Candidate | Currently | Target |
|---|---|---|
| `sortMercuryRowsStable` (3-key stable sort, NaN-date ordering, id tiebreak) | module-level in `Banking.tsx` | `lib/bankingMercuryRowSort.ts` + tests |
| `parseBankingView(params, role)` (role-dependent URL → view) | module-level in `Banking.tsx` | `lib/bankingViewRouting.ts` + tests (per-role defaults, legacy `invoices`/`data` → `ledger` fallback) |
| `formatCurrency` / `formatDate` / `formatDateTime` / `formatMercuryCategory` | module-level in [`BankingMercuryTable.tsx`](../src/components/banking/BankingMercuryTable.tsx) (moved with the table in v2.1304; `formatCurrency` exported — the page imports it back) | shared lib — **check first**: `formatUsd` / `formatBankingDate` already exist in [`bankingMercuryDragSortLedger.tsx`](../src/components/banking/bankingMercuryDragSortLedger.tsx); consolidate rather than duplicate |
| Bucket-stats kernel (`buildBucketStats`, `cloneBucketStats`, `applyAssignmentDelta`, `addToLabeled`, `subtractFromLabeled`) | module-level in `BankingMercuryDragSortTab.tsx` | `lib/bankingDragSortBucketStats.ts` + tests |
| `fetchAccountingPendingRuleNames` / `…LabelNames` / `…TxsByIds` (200-id chunked fetchers) | module-level in `BankingMercuryAccountingTab.tsx` | `lib/fetchAccountingPendingRelations.ts` (IO helpers; test the chunk math) |
| "Other matching rules" annotation inside `runTestFromCriteria` (sort by `sort_order, id`; exclude editing rule; clause-count filter) | closure in `BankingMercuryAccountingTab.tsx` | pure function + test (a parity test `matchingAccountingRulesForTx.test.ts` already exists — align with it) |
| `saveRuleDraft` / `saveRuleDraftAndApply` shared INSERT/UPDATE block | duplicated inline | one `persistAccountingRuleDraft` helper (de-dup, not a move — do alongside Stage B of the rules engine) |

---

## Preserve-quirks list (odd but load-bearing — do not "fix" during the move)

1. **`rows` means different things per view** (master 15k / unlabeled-only / keyset page window). Every consumer of `rows` must keep working under all three shapes; `inputIsUnlabeledOnly` in the Accounting tab exists to skip redundant work when the parent pre-narrowed.
2. **`listLoadSeqRef` token discipline** — every loader bumps-then-checks; `loadLabeledNextPage` snapshots (doesn't bump) so a first-page refresh cancels in-flight appends. The Accounting tab mirrors this with `assignmentsLoadSeqRef` / `pendingLoadSeqRef`; **Drag Sort's `loadAssignmentsForList` has no token** (known asymmetry).
3. **`accountingPrefsHydrated` gate** — the initial data-load effect waits for per-user pref hydration so the dispatcher picks the right loader exactly once (no default-vs-stored flash / double fetch). `user` resolves async, so a lazy `useState` read is impossible.
4. **Prefs dual-write protocol** — localStorage write is synchronous truth for this device; `banking_user_prefs` row syncs cross-device; server values found on load are mirrored back into localStorage. Failure toasts "Saved here, but could not sync…".
5. **Silent realtime refresh preserves scroll depth** — `loadLabeledFirstPage({silent: true})` requests `max(500, labeledLoadedCountRef.current)` rows so a background sync doesn't yank the user to page 1.
6. **Excluded duplicates**: the Ledger *shows* `duplicate_of_transaction_id` rows struck-through for audit; `booksFilteredSorted` / `booksSortingFilteredSorted` exclude them from totals and from what Drag Sort / Accounting / Category Review receive.
7. **One `bankingSearchText` feeds three tabs** (Ledger, User Sort, Drag Sort) and `accountFilter`/`kindFilter` are shared between Ledger and Drag Sort — typed state carries across tab switches by design.
8. **Card Review skips the master fetch** — `loadRowsForActiveView` early-returns (and clears `loading`) when it's the active tab; toggling to another tab pulls the 15k list.
9. **Auto-apply/auto-approve signature protocol** — `lastAutoAppliedSignatureRef` reset only by `autoApplyResetTick` (bumped after sync/backfill); auto-approve's signature is built from the **conflict-pre-filtered** list so a conflict-only residue quiets the effect without toast spam; auto-approve commits the full approvable set **ignoring the user's search filter** (deliberate).
10. **Caps are behavioral, not just perf**: `APPLY_RULES_PER_CLICK_CAP = 500` (forces review-then-iterate cadence), `APPLY_RULES_CONFIRM_THRESHOLD = 200`, `APPROVALS_PAGE_SIZE = 50`, `GROUP_BULK_CONFIRM_THRESHOLD = 25`, `ACCOUNTING_PENDING_ID_IN_CHUNK_SIZE = 200` (HTTP/2 header-limit fix), `DEBIT_CARD_RECENT_TX_CAP = 50`, quick-label undo stack depth 2.
11. **Internal Transfers × job splits are mutually exclusive**, enforced in four places: `handleQuickAssignLabel`, `handleApprove`, `approvePendingItems` (skip + toast), and Drag Sort's `applyDragSortAssignment`. Keep all four.
12. **Two assignment-load strategies for the same table**: Accounting does one **paged** whole-table read (`fetchAllRows`, ordered by `mercury_transaction_id`; v2.2841 — the old un-ranged `.limit(100000)` returned 1,000 of ~11k rows); Drag Sort chunks 400-id `.in()` batches. Both intentional at their respective row scales — don't unify during a move.
13. **Per-row optimistic rollback** (not snapshot restore) in `clearRowDragSortLabel` / `applyDragSortAssignment` — a failed request restores only that tx so concurrent edits survive.
14. **Apply rules / rule test scan Banking-filtered rows only** — not the Accounting search, More filters, or Hide-labeled slice (comments in `computeApplyRulesPreflight` and `runTestFromCriteria`).
15. **Overlaps↔Edit-rule z-index dance** — audit modal (z 1250) hides itself before opening Edit Rule (z 1200, which spawns Test results at 1250); `auditPendingReopenAfterRuleModalRef` + a `ruleModalOpen` watcher effect reopen the audit on any close path.
16. **`ledgerShowDrag = false`** hardcoded in the Accounting tab — the shared `bankingMercuryDragSortLedger` row family renders without drag handles there, with them (`true`) in Drag Sort.
17. **`list_people_with_kind_for_banking_attribution` RPC is cast** `as unknown as 'list_users_for_banking_attribution'` — regenerate types before touching.
18. **Sorting config is role-forked**: dev loads a per-user saved config (`loadBankingSortingConfig`); master-tech/assistants always get `defaultBankingSortingConfig()` fresh.
19. **`handleSync` hardcodes `lookback_days: 90`**; the 1-year+ path is the Backfill modal.
20. **`ruleModalMountKey`** — the rule form remounts (`key` bump) on every open so stale draft state can't leak between rules.
21. **Debit-card nickname keys are lowercased** on read and write (`String(id).toLowerCase()`).

---

## Recommended extraction order (value ÷ risk)

1. **Stage-A sweep** — the [inventory](#stage-a-pure-logic-inventory) above; each independently shippable. Highest leverage: `sortMercuryRowsStable`, `parseBankingView`, the Drag Sort bucket-stats kernel.
2. ~~**In-file component file moves**~~ — **done (v2.1304)**: `BankingMercuryTable` (+ `SortTh` + `TransactionDetailPanel`) → [`src/components/banking/BankingMercuryTable.tsx`](../src/components/banking/BankingMercuryTable.tsx); `BankingNicknamesMenu` + `BankingLedgerAdvancedMenu` → own files. Verbatim moves, ~830 lines off `Banking.tsx` (3,104 → 2,181), zero state relocation.
3. **Extract `sorting` → `BankingMercurySortingTab`** — lowest-coupling inline tab; validates the prop seam (like `po-generator` did for Materials / `bid-costs` for Bids).
4. **Extract `ledger` → `BankingMercuryLedgerTab`** — after (2); sync/backfill/import handlers + their modals stay parent-owned, opened via callbacks.
5. **Seam hooks in the parent** — `useBankingMercuryTransactions`, `useBankingMercuryRelations`, `useBankingNicknames`, `useBankingAccountingPrefs`. Parent destructures; child props unchanged. This is compression, not relocation — the hooks stay mounted in `Banking()`.
6. **Sub-decompose `BankingMercuryAccountingTab`** — first the cluster seam `useAccountingLabelsAndAssignments` (labels + assignment map + loaders + mutators), then `useAccountingRulesEngine`, then `useAccountingApprovals` + `AccountingApprovalsSection` / `AccountingSortingLedgerSection` components; extract the inline Test-results modal. Do this **last** — it's the highest-churn file (50 changelog mentions) and the auto-apply/auto-approve protocols span the parent boundary.
7. **Optional Drag Sort cleanups** — Add-label modal → own file; seq-token adoption for `loadAssignmentsForList` as a separate reviewed change.

### What must STAY in the parent (`Banking.tsx`)

- The **URL router**: `parseBankingView`, `setMercurySubTab`/`setStripeSubTab`/`setBankingProduct`, the role-based param-normalization + `/dashboard` redirect effects.
- The **data engine + relation + nickname caches** (as hooks per step 5) — consumed by 4+ tabs and 6 modals.
- The **accounting prefs cluster** incl. `hideLabeledTransactions` (it selects the parent's loader) and `autoApplyResetTick` (bumped by parent sync handlers, consumed by the child effect).
- `handleSync` / `handleBackfill` / `handleImportCsv` and their modals (completion must reload parent caches + bump the tick).
- **All shared modals**, especially `MercuryTransactionAllocationsModal` + `openAllocModalForMercuryRow` (opened from four tabs) and `BankingDebitCardRecentTxModal` (opened from two other modals).
- `expandedRowId` (shared by Ledger + User Sort tables) and the shared filter/search state (`bankingSearchText`, `accountFilter`, `kindFilter`).

Definition of done per region, verification gates, and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) (`npm run typecheck && npm run lint && npm test` green after every step; behavior-preserving only).
