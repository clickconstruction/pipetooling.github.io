# Banking Tabs Architecture Map

---
file: docs/BANKING_TABS_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the Banking surface decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md) — what every tab/region of the 2,269-line src/pages/Banking.tsx touches (state, loaders, handlers, sub-components, supabase tables/RPCs, cross-tab coupling), plus sub-decomposition dossiers for the two oversized extracted tabs (BankingMercuryAccountingTab 2,936 lines, BankingMercuryDragSortTab 1,400) and for the shared split/person editor MercuryTransactionAllocationsModal (1,705 lines, 9 render sites).
covers:
  - src/pages/Banking.tsx
  - src/components/banking/BankingMercuryAccountingTab.tsx
  - src/components/MercuryTransactionAllocationsModal.tsx
  - src/components/banking/BankingMercuryDragSortTab.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-25
---

## What this surface is

[`src/pages/Banking.tsx`](../src/pages/Banking.tsx) (**2,269 lines** — 3,104 before the v2.1304 in-file component moves, 2,180 right after, grown back by later features) is the money-movement hub: a two-level tab switch (`product` × tab) over Mercury bank transactions and Stripe billing. Banking is **already mostly decomposed**: 6 of the 8 Mercury tabs and both Stripe tabs render extracted components. What remains inline in the parent is the **Ledger** tab, the **Sorting (User Sort)** tab, the master data engine (transaction list + relation caches + nickname caches), the URL router, and eight page-level modals. The formerly in-file module components (`BankingMercuryTable` and the two dropdown menus) moved verbatim to `src/components/banking/` in v2.1304.

Three already-extracted files have become God components themselves and are mapped for sub-decomposition. Hook censuses are from `npm run map` at a05cef4c4:

| File | Lines | useState · effects · useMemo · useCallback · refs | Commits (90 d) | Role |
|---|---|---|---|---|
| [`src/pages/Banking.tsx`](../src/pages/Banking.tsx) | 2,269 | 45 · 18 · 21 · 19 · 3 | 19 | parent shell + Ledger + User Sort + data engine + modals |
| [`src/components/banking/BankingMercuryAccountingTab.tsx`](../src/components/banking/BankingMercuryAccountingTab.tsx) | 2,936 | 50 · 16 · 28 · 50 · 8 | 18 | Accounting tab: approvals queue, rules engine, sorting ledger, two org switches, rule-person attribution |
| [`src/components/MercuryTransactionAllocationsModal.tsx`](../src/components/MercuryTransactionAllocationsModal.tsx) | 1,705 | 20 · 7 · 6 · 4 · 1 | 7 | shared "Link to person and jobs" editor: the `replace_mercury_transaction_splits` REPLACE path |
| [`src/components/banking/BankingMercuryDragSortTab.tsx`](../src/components/banking/BankingMercuryDragSortTab.tsx) | 1,400 | 19 · 6 · 7 · 12 · 1 | 4 | Drag Sort tab: dnd-kit label buckets + Quick Sort focus flow |

Other extracted siblings (not re-mapped; `wc -l` at a05cef4c4): `BankingMercuryUserReviewTab` (1,166), `BankingMercuryCategoryReviewTab` (1,073), `BankingMercuryVisualsTab` (898), `BankingMercuryReconciliationTab` (252, zero props), `BankingStripeInvoicesPanel` (191), `BankingStripeWebhookEventsPanel` (119).

View routing (see `parseBankingView`, 138–164, and `mercuryTabFromParam`, 92–108): `?product=mercury|stripe` (dev only; non-devs are forced to Mercury), `?tab=`. `?q=<text>` (any role) pre-fills the search box on mount (v2.2849). `?cards=<id>` / `?cards=1` (v2.2750, the door from Wheels) opens the Debit cards modal on that card, then deletes the param (effect 1053–1066).

```
mercury: 'ledger' | 'sorting' | 'drag_sort' | 'accounting' | 'card_review' | 'category_review' | 'reconciliation' | 'visuals'
// `?tab=user_review` (pre-v2.2899) is read as an alias for `card_review` by `mercuryTabFromParam` and rewritten once in the address bar (effect 457–467); it is never written.
stripe:  'invoices' | 'data'
```

Roles (v2.3305): the page admits `dev`, `master_technician` and `controller` ([`canAccessBanking`](../src/lib/bankingAccess.ts), mirror of the DB's `is_banking_staff()`); plain assistants lost Banking, and everyone else is redirected to `/dashboard` (effect 448–452). **Ledger and the Stripe product are dev-only**; staff roles ([`isStaffBankingRole`](../src/lib/bankingAccess.ts): master_technician, controller) default to `accounting`, and a guard effect (469–496) rewrites their URL params. Inside the Accounting tab only `dev`/`master_technician` may flip the two org switches (`canFlipAutoApprove`); controllers see their state.

Churn: the Accounting tab stays the hottest region of the banking code (18 commits in 90 days, vs 19 for the whole page and 4 for Drag Sort). The v2.475–v2.590 wave built team notes, the rules engine, apply-by-default automation (v2.580; the v2.581 per-user approve-by-default became the org-wide server-side switch in v2.2889), the server-side unlabeled fetch (v2.579) and the Rules modal (v2.578); people-in-rules (v2.1725–v2.1742), category tags (v2.2718) and the **Deposits applied in Accounts Receivable count as Income** switch (v2.3514, +149 lines) followed. Stage its seams accordingly.

### How to read a dossier

Each section lists: render location, **owned local state** (moves with the region), **cross-tab/shared state** (stays in the parent), **derived memos**, **handlers/loaders**, **supabase tables/RPCs**, **sub-components** (extracted vs inline), **external coupling**, **tests**, and **extraction status + risk + approach** with Stage-A candidates. **Line numbers are exact as of a05cef4c4** (read from `npm run map -- <file>` fact sheets); they rot with every edit, so search the symbol name and treat the range as a hint.

### How to maintain this doc

- Update the relevant dossier whenever a region is extracted or its state/handlers change; flip its Status and point at the new file.
- On a refresh, regenerate the fact sheets (`npm run map -- <file>` for each `covers:` path), re-anchor the ranges, and bump `mapped_at`.

---

## Master summary table

| Region | Render anchor (a05cef4c4) | Lines | Status | Coupling | Risk | Recommended action |
|---|---|---|---|---|---|---|
| `BankingMercuryTable` (+ `SortTh`, `TransactionDetailPanel`) | [`BankingMercuryTable.tsx`](../src/components/banking/BankingMercuryTable.tsx) | 627 (file) | **extracted** (v2.1304, verbatim file move) | low (props-only; rendered by Ledger 2111–2137 + User Sort 1817–1849) | — | Done — `SortKey` + `formatCurrency` exported; the page imports them back |
| `BankingNicknamesMenu`, `BankingLedgerAdvancedMenu` | [`BankingNicknamesMenu.tsx`](../src/components/banking/BankingNicknamesMenu.tsx) / [`BankingLedgerAdvancedMenu.tsx`](../src/components/banking/BankingLedgerAdvancedMenu.tsx) | 128 + 191 | **extracted** (v2.1304) | low (props-only) | — | Done |
| `sorting` — User Sort tab | panel `mercuryTab === 'sorting'` 1679–1851 + header tools 1582–1633 | 173 + 52 | inline | med (reads the `rows` engine, `expandedRowId`, shared search, relation caches, org notes; writes the shared `bankingSearchText` + `expandedRowId` (setter prop, 1825) and its own `sortingSort`; the header tools write `sortingConfigModalOpen`, `nicknamesMenuOpen` and both nickname-modal flags) | low-med | Extract → `BankingMercurySortingTab` (next tab move) |
| `ledger` — Ledger tab (dev-only) | panel `mercuryTab === 'ledger'` 1972–2139 | 168 | inline | med-high (writes 5 modal-open flags + both menus; `handleSync`; nickname CRUD) | med | Extract → `BankingMercuryLedgerTab`; sync/backfill/import handlers stay in parent |
| `drag_sort` — Drag Sort tab | wrapper 1853–1881 → `BankingMercuryDragSortTab` | 29 / 1,400 | **extracted** | med (23 props, incl. 3 setter pairs shared with Ledger) | — | Stage-A bucket-stats kernel; add-label modal → file |
| `accounting` — Accounting tab | wrapper 1883–1925 → `BankingMercuryAccountingTab` | 43 / 2,936 | **extracted** | high (28 props; lifted prefs; `onAfterAssignmentChange` reload loop; `onAttributionChange` writes 4 parent relation setters) | — | Sub-decompose: org switches → labels/assignments seam → people → rules → approvals |
| `card_review` — Card Review tab (key was `user_review` until v2.2899) | wrapper 1927–1938 → `BankingMercuryUserReviewTab` | 12 / 1,166 | **extracted** | low (4 props; self-sources via `user_review_rows` RPC) | — | Done |
| `category_review` — Category Review tab | wrapper 1940–1958 → `BankingMercuryCategoryReviewTab` | 19 / 1,073 | **extracted** | med (11 props off the shared engine) | — | Done |
| `reconciliation` — Reconciliation tab | `<BankingMercuryReconciliationTab />` 1960–1964 | 5 / 252 | **extracted** | none (zero props) | — | Done — the target end-state |
| `visuals` — Visuals tab (v2.1712) | `<BankingMercuryVisualsTab />` 1966–1970 | 5 / 898 | **born extracted** (Reconciliation mold) | none (zero props; own fetches; dispatcher early-returns at 710–714) | — | Done — Sankey kernels in `src/lib/banking/` (`mercurySankeyLayout`, `mercuryVisualsFlows`), both unit-tested |
| Stripe `invoices` / `data` | `BankingStripeInvoicesPanel` / `BankingStripeWebhookEventsPanel` 2141–2151 | 11 | **extracted** | none | — | Done |
| `MercuryTransactionAllocationsModal` (shared) | Banking 2225–2251 + 8 other render sites | 27 / 1,705 | **extracted, shared** | high (9 render sites; 3 save RPCs incl. a DELETE+INSERT REPLACE) | — | Stage A first: import `mercurySplitMath`, save-kernel extraction; then tally-day-context hook |
| Parent shell: role gate, URL router, data engine, prefs, modals | `export default function Banking()` — logic 192–1347, header 1349–1677, modals 2153–2265 | ~1,160 + ~330 + ~115 | permanent parent | — | — | Compress via seam hooks (`useBankingMercuryTransactions`, `useBankingMercuryRelations`, `useBankingNicknames`, `useBankingAccountingPrefs`) |

**Strip furniture (v2.2899, B13):** a caption row under the Mercury tab strip (`MERCURY_TAB_CAPTIONS`, 111–117, rendered 1544–1566: "User Sort — who spent it · Drag Sort — what kind · Accounting — rules & approvals · Reviews — read-only · Reconciliation — against bank statements, read-only · Jobs are sorted in Job Parts Tally; labels live here"), the active tab's caption bolded. Below the strip, **dev only**, an amber nudge (1637–1677) lists Mercury accounts present in the loaded rows that have no `mercury_account_nicknames` row (they render as raw UUIDs in every account filter) with a **Name accounts…** button into `BankingAccountNicknamesModal`; `unnamedAccountIds` memo 985–988 over the kernel [`bankingAccountNicknameNudge.ts`](../src/lib/bankingAccountNicknameNudge.ts). The nudge targets dev because that table is dev-write only (RLS).

Page-level modals (all stay in the parent unless noted; table below): `BankingAccountNicknamesModal` (dev), `BankingDebitCardsModal` (v2.2750 — replaced both the old debit-card nicknames modal and the user-card-link modal), `BankingDebitCardRecentTxModal`, `MercuryBackfillModal` (dev), `MercuryImportCsvModal` (dev/master), `ManualAccountsModal` (dev/master), **`MercuryTransactionAllocationsModal`** (own dossier below), `BankingSortingConfigModal` (dev).

---

## The shared substrate

**There is no shared record pointer.** Nothing like Bids' `setSharedBid` exists: no `?id=` deep link, no cross-tab "selected transaction". The closest analogues are UI-scoped: `expandedRowId` (209; row expansion shared by the Ledger and Sorting tables, cleared by effect 1149–1158 when the row leaves the visible set) and `allocModalTx` (239; the transaction open in the allocations modal). Consequence for extraction: tabs don't need controlled selection props — **the substrate is data, not selection** (same shape as Materials), so the seams are data-engine hooks, not a selection lift.

The substrate has four layers, all owned by `Banking()`:

### 1. The transaction list engine (`rows` + the tab-aware loader dispatcher)

- `rows: MercuryTxRow[]` (200) — the master in-memory list, **paged** (v2.2841: `fetchAllRows` + `.range()` under `posted_at desc, id desc`, 1000/page) up to the hard ceiling `MERCURY_TRANSACTIONS_BANKING_LIST_LIMIT = 15000` (83; `rowsTruncated`, 273, = hit the ceiling). Before v2.2841 the loaders were a bare `.limit(15000)`, which PostgREST's `max_rows` silently cut to 1,000 (J33-N1) — never reintroduce an un-ranged read here. **What `rows` contains depends on the active view** (dispatcher `loadRowsForActiveView`, 698–718):
  - Ledger / User Sort / Drag Sort / Category Review → `loadAllRows` (498–543; paged `mercury_transactions` select, newest-first, `MERCURY_TRANSACTIONS_BANKING_LIST_COLUMNS` — raw omitted, hydrated lazily).
  - Accounting + Hide labeled **on** (the default) → `loadUnlabeledRows` (552–594; RPC `list_unlabeled_mercury_transactions`, a server-side anti-join against `mercury_transaction_drag_sort_assignments`; paged with `.range()` on the RPC result).
  - Accounting + Hide labeled **off** (`isAccountingLabeledView`, 694) → `loadLabeledFirstPage` (599–643) / `loadLabeledNextPage` (647–687) (RPC `list_mercury_transactions_keyset`, `ACCOUNTING_LABELED_PAGE_SIZE = 500` pages; cursor `labeledCursor {postedAt, id}` (256), flags `labeledHasMore`/`labeledLoadingMore` (257–258), refs `labeledLoadingMoreRef` (261) re-entry guard + `labeledLoadedCountRef` (265) silent-refresh depth).
  - Card Review and Visuals → **no fetch** (both self-source; the dispatcher early-returns at 706–714 and clears `loading`).
- `listLoadSeqRef` (270) — monotonic token; every fresh load bumps it and in-flight responses with a stale token are discarded. **Any seam extraction must preserve this token discipline.**
- Initial load (771–777) waits on `accountingPrefsHydrated`, then runs the dispatcher + both nickname loaders.
- Raw hydration effects lazily fetch the `raw` JSON column via `fetchMercuryTransactionRawById`/`ByIds` + `applyMercuryRawPatch` — (a) 779–800 when Drag Sort or Accounting is active, (b) 802–821 when the debit-card recent-tx modal opens, (c) 823–844 when a row expands; plus `openAllocModalForMercuryRow` (746–763) hydrates one row before opening the allocations modal.

### 2. The relation caches (`loadMercuryAllocations`)

`allocationsByTxId`, `personIdByTxId`, `userIdByTxId`, `personNameById`, `userNameById`, `jobLabelByIdBanking` (231–236) — rebuilt by `loadMercuryAllocations` (846–922; effect 924–926 re-runs it on every `rows` change) via [`fetchAllJobAllocations` / `fetchAllAttributions`](../src/lib/fetchMercuryRelationsByTxIds.ts) (two **paged** whole-table reads — deliberately not chunked by id, since the master list is the whole table; v2.2841 replaced the un-ranged `.limit(100000)` that PostgREST cut to 1,000 rows) grouped by the pure kernel [`buildMercuryRelationMaps`](../src/lib/mercuryRelationMaps.ts), plus `jobs_ledger` / `people` / `users` name lookups. Consumed by Ledger, Sorting, Drag Sort, Accounting, Category Review, the allocations modal, and search enrichment (`bankingMercurySearchJobPersonEnrich`, 998–1015).

Writers: the full reload is triggered by the allocations modal (`onSaved`), Card + Category Review (`onAttributionChanged`) and the Debit cards modal (`onLinksChanged`). **One in-place writer:** the Accounting wrapper's inline `onAttributionChange` closure (1910–1919, quick-assign person, v2.1742) patches `personIdByTxId` / `userIdByTxId` / `personNameById` / `userNameById` without a reload.

Attribution option sources (page-level effect 928–961, RPCs `list_users_for_banking_attribution` + `list_people_with_kind_for_banking_attribution`) feed `usersSelectOptions` (237) and `peopleAttribRows` (238) → `attributionOptions` memo (966–969, [`buildBankingAttributionOptions`](../src/lib/bankingAttributionOptions.ts), `u:`/`p:` prefixed values) for Card Review, Category Review and Accounting.

### 3. Nickname caches

`nicknameByAccount` (210) / `nicknameByDebitCard` (214) + `roleByDebitCard` (218; person's card vs company card, v2.2750). Loaders `loadNicknames` (720–733, `mercury_account_nicknames`) and `loadDebitCardNicknames` (735–744, via `loadDebitCardDirectory()` in [`lib/banking/debitCards.ts`](../src/lib/banking/debitCards.ts)); CRUD `persistNickname` (1241–1272) / `clearNicknameRow` (1274–1292) / `persistDebitCardNickname` (1294–1322) / `clearDebitCardNicknameRow` (1324–1339); per-row busy ids `savingNicknameId` / `savingDebitCardNicknameId`, `nicknameDrafts`. Debit ids normalized `.toLowerCase()`. Consumed by every Mercury tab except the zero-prop Reconciliation and Visuals, both nickname modals, sorting config, and search haystacks (`nicknameCtx`, 993–996).

### 4. Org team notes

`useMercuryOrgNotesByTxId(bankingOrgNoteFetchIds)` (1102) — already a hook; `bankingOrgNoteFetchIds` (1094–1100) feeds it the visible-row ids of the active tab (User Sort → `sortingFilteredSorted`; Ledger/Drag Sort/Accounting → `filteredSorted`; otherwise the stable `NO_MERCURY_TX_IDS_FOR_BANKING_NOTES` constant). `onOrgNoteUpdated` (1104–1109) patches locally via `updateOrgNoteLocal`.

### Accounting prefs cluster (lifted from the child, stays in parent)

`hideLabeledTransactions` (244; drives which loader the dispatcher picks — this is *why* it lives in the parent), `applyRulesByDefault` (278), `autoApplyResetTick` (283; monotonic counter bumped by `handleSync`/`handleBackfill` so a sync re-fires one auto-apply pass), `accountingPrefsHydrated` (251; gates the first fetch until the per-user value is read). Persistence is dual-write: localStorage helpers in [`bankingDragSortStorage.ts`](../src/lib/bankingDragSortStorage.ts) (effects 378–383, 406–409) for instant reads + the `banking_user_prefs` row via [`bankingUserPrefs.ts`](../src/lib/bankingUserPrefs.ts) (`fetchAccountingPrefs` in effect 423–446 / `saveBankingPref` in `syncPrefAcrossDevices` 387–395) for cross-device sync; a server value found on load is mirrored back into localStorage. Setters: `onHideLabeledTransactionsChange` (397–404), `onApplyRulesByDefaultChange` (411–418). The comment at 284–287 still describes the retired v2.581 "Approve by default" state — no state follows it.

### Seam hook candidates

1. **`useBankingMercuryTransactions`** — `rows`, `loading`, `error`, `syncing`, `rowsTruncated`, the four loaders + dispatcher, `listLoadSeqRef`, the keyset-cursor cluster, the three raw-hydration effects and `openAllocModalForMercuryRow`'s row patch. Inputs: `myRole`, `bankingView`, `hideLabeledTransactions`, `accountingPrefsHydrated`, `showToast`.
2. **`useBankingMercuryRelations`** — the six relation caches + `loadMercuryAllocations` + the attribution-option sources, **and a `patchAttribution(txId, patch)` method** replacing the inline closure at 1910–1919 so the Accounting prop stays one callback. Input: `rows`, `canAccessBanking`.
3. **`useBankingNicknames`** — both caches + `roleByDebitCard` + loaders + CRUD + busy/draft state.
4. **`useBankingAccountingPrefs`** — the toggles + tick + hydration flag + dual-write handlers.

The parent destructures each hook so downstream references (and the 28-prop Accounting wrapper) don't change.

---

## Per-region dossiers — Banking.tsx

### Parent shell: role gate, URL router, prefs (permanent)

- **Render location:** logic 192–1347 (state 197–283; guards `myRole === null` 1341–1343, `!canAccessBanking` 1345–1347); header + both tab strips 1349–1677 (dev product tablist 1358–1413; section tablist 1433–1541; captions 1544–1566; non-dev `<h1>` 1568–1581).
- **State:** `myRole` (197, `BankingPageRole` incl. `controller`; fetched from `users.role` by effect 368–376), `bankingView` (memo 292 over `searchParams` via `parseBankingView`), `sortingConfig` (228), prefs cluster (above), menu-open flags (`nicknamesMenuOpen` 221, written by the User Sort header tools and the Ledger toolbar; `ledgerAdvancedMenuOpen` 222 is Ledger-only, see its dossier), all modal-open flags, `highlightDebitCardId` (220), `recentTxDebitCardId` (226; which card `BankingDebitCardRecentTxModal` shows, set from the Debit cards modal).
- **Handlers:** `setMercurySubTab` (294–307) / `setStripeSubTab` (309–322) / `setBankingProduct` (324–344) (all `setSearchParams` with `{replace: true}`), `handleSortingConfigSave` (1140–1147; dev-only; `saveBankingSortingConfig` localStorage).
- **Effects:** close menus on view change (346–349); close the sorting-config modal when leaving the Sorting tab (351–355); sorting-config hydration (357–366: dev gets per-user `loadBankingSortingConfig(user.id)`, staff always get `defaultBankingSortingConfig()`); role fetch (368–376); `/dashboard` redirect (448–452); legacy `?tab=user_review` rewrite (457–467); staff URL normalization (469–496, rewrites missing/disallowed `?product`/`?tab` to `mercury`/`accounting`); `?cards=` door (1053–1066).
- **Supabase:** `users` (role).
- **Tests:** role predicates in `bankingAccess.test.ts`; `parseBankingView` / `mercuryTabFromParam` untested; **no render test for `Banking.tsx`** (and no e2e spec touches `/banking`).
- **Stays in the parent forever:** the URL router, role gating, and every modal opened from 2+ tabs.

### In-file module components (extracted — v2.1304 pure file moves)

| Component | Now at | Lines (a05cef4c4) | Notes |
|---|---|---|---|
| `BankingNicknamesMenu` | [`BankingNicknamesMenu.tsx`](../src/components/banking/BankingNicknamesMenu.tsx) | 128 | click-outside/Escape dropdown; rendered in the User Sort header tools (1622–1629) AND the Ledger toolbar |
| `BankingLedgerAdvancedMenu` | [`BankingLedgerAdvancedMenu.tsx`](../src/components/banking/BankingLedgerAdvancedMenu.tsx) | 191 | Ledger's Advanced dropdown (Refresh / Backfill / Import CSV / Manual accounts / Reload); role-gated items via optional-prop presence |
| `SortTh` | private in `BankingMercuryTable.tsx` (97–127) | 31 | sortable `<th>` with `aria-sort` |
| `TransactionDetailPanel` | private in `BankingMercuryTable.tsx` (129–224) | 96 | expanded-row detail grid + raw JSON `<pre>` (the table's props type follows at 226–253) |
| `BankingMercuryTable` | [`BankingMercuryTable.tsx`](../src/components/banking/BankingMercuryTable.tsx) (255–627) | 373 | the shared Ledger/User Sort table: expandable rows, notes preview/editor sub-rows (via `MercuryTxNotesDisclosure` pieces + `bankingMercuryNotesSubRowColSpans`), allocation Person/Jobs cells, excluded-duplicate strike-through badge, and 4 layout-variant flags (`allocationsAfterCounterparty`, `hideKindColumn`, `debitAndAccountAfterAmount`, `counterpartyNoteCombined`). Owns only `notesExpandedTxId` locally. |

All were props-only (no parent closure), so the moves were verbatim cut/paste (~924 lines off `Banking.tsx`, 3,104 → 2,180). `SortKey`, `formatCurrency`, and the private `formatDate`/`formatDateTime`/`formatMercuryCategory` helpers moved with the table (`SortKey` + `formatCurrency` are exported; the page imports them back). `sortMercuryRowsStable` and `parseBankingView` stayed in the page for their own Stage-A pass.

### Module-level pure helpers (Stage-A residue in Banking.tsx)

`mercuryTabFromParam` (92–108; legacy-alias fold), `parseBankingView(params, role)` (138–164; role-dependent URL → view) and `sortMercuryRowsStable(list, {key, dir})` (166–190; stable 3-key sort, NaN-date handling, id tiebreak). All pure, all untested. See [Stage-A inventory](#stage-a-pure-logic-inventory).

### `ledger` — Ledger tab (dev-only, inline)

- **Render location:** `role="tabpanel" id="banking-panel-mercury-ledger"` behind `bankingView.mercuryTab === 'ledger' && isDevBanking` (1972–2139; error 2026–2039; table 2111–2137).
- **Owned local state:** `ledgerAdvancedMenuOpen` (222) only. Three more look Ledger-local but stay parent-owned: `accountFilter` (204) / `kindFilter` (205) — the Drag Sort wrapper passes both **with their setters** (1859–1862), so Drag Sort's filter row writes them too — and `sort` (227, + `setSortForColumn` 971–975; it also orders `filteredSorted` → `booksFilteredSorted`, the list Drag Sort / Accounting / Category Review receive, and `bankingOrgNoteFetchIds`).
- **Cross-tab/shared state:** `accountFilter` / `kindFilter` (shared with Drag Sort), `rows`/`loading`/`error`/`syncing` engine, `bankingSearchText` (208; **shared with the User Sort tab's search box and Drag Sort's** — one string state feeds all three), `expandedRowId` (shared with Sorting), nickname caches + both nickname modals, relation caches, org notes, `rowsTruncated`.
- **Derived memos:** `filteredSorted` (1017–1036; accountFilter + kindFilter + search over `buildMercuryTxSearchHaystackWithJobPerson` → `sortMercuryRowsStable`), `booksFilteredSorted` (1114–1117; drops `duplicate_of_transaction_id` rows — feeds totals AND the Drag Sort/Accounting/Category Review wrappers), `totalAmount` (1123), `accountOptions` (977–981), `kindOptions` (1073–1077), `nicknameManageIds` (1038–1041), `debitCardIdsFromRows` (1043–1050), `debitCardManageIds` (1068–1071), `searchQueryNorm` (991).
- **Handlers:** `handleSync` (1160–1187; edge fn `sync-mercury-transactions`, hardcoded `lookback_days: 90`, bumps `autoApplyResetTick`), `handleBackfill` (1189–1213; same fn with `{start, end}`, bumps the tick), `handleImportCsv` (1215–1239; edge fn `import-manual-transactions`), nickname CRUD (substrate §3). The panel writes `nicknamesModalOpen`, `debitCardNicknamesModalOpen`, `backfillModalOpen`, `importCsvModalOpen`, `manualAccountsModalOpen` and both menu flags.
- **Supabase:** `mercury_transactions` (via engine), `mercury_account_nicknames`, `mercury_debit_card_nicknames`; edge functions `sync-mercury-transactions`, `import-manual-transactions`.
- **Sub-components:** `BankingMercuryTable`, `BankingLedgerAdvancedMenu`, `BankingNicknamesMenu` (all extracted); modals `MercuryBackfillModal`, `MercuryImportCsvModal`, `ManualAccountsModal` (all extracted, parent-rendered).
- **External coupling:** no deep links carry ids. `?q=<text>` seeds `bankingSearchText` once on mount (Moneyfill's card-charges queue opens `/banking?tab=sorting&q=<counterparty>`, v2.2849); read-once, not synced back.
- **Tests:** search (`bankingMercurySearch.test.ts`), paging (`supabasePaging.test.ts`); the loaders, `sortMercuryRowsStable` and the `totalAmount` reduce are untested.
- **Extraction status + risk + approach:** Inline. **Medium risk.** The JSX is thin; the weight is that its toolbar owns the page's sync/backfill/import entry points and the nickname CRUD, all of which mutate parent-owned caches. Extract `BankingMercuryLedgerTab` receiving `filteredSorted`, filters + setters, sort + setter, the shared table props, and callbacks (`onSync`, `onOpenBackfill`, `onOpenImportCsv`, `onOpenManualAccounts`, `onReload`); `handleSync`/`handleBackfill`/`handleImportCsv` and the modals **stay in the parent** (completion must call `loadRowsForActiveView` + bump `autoApplyResetTick`). Stage A: `sortMercuryRowsStable` → lib + tests first.

### `sorting` — User Sort tab (inline)

- **Render location:** `role="tabpanel" id="banking-panel-mercury-sorting"` (1679–1851; non-dev caption 1681–1693, dev Refresh → `handleSync` 1733–1750, error 1770–1783, table 1817–1849) plus the header tools region (`aria-label="Banking User Sort tools"`, 1582–1633: Configuration [dev] 1601–1619, `BankingNicknamesMenu` 1620–1631). The pre-v2.2750 User Card Link button is gone — card links live in the Debit cards modal, reached from the Nicknames menu.
- **Owned local state:** `sortingSort` (230, + `setSortingSortForColumn` 1134–1138; ⚠ the list it orders, `sortingFilteredSorted`, is also read in the parent by `bankingOrgNoteFetchIds` (1094–1100) and the expanded-row clear effect (1149–1158) — both need only the id set, so repoint them at `sortingAfterSearch` when `sortingSort` moves in), `sortingConfigModalOpen` (229; force-closed by effect 351–355 when leaving this tab).
- **Cross-tab/shared state:** `sortingConfig` (dev-configurable slice definition, hydrated in the shell), `bankingSearchText` (shared), `expandedRowId` (shared), `rows` engine, relation caches, nicknames, org notes.
- **Derived memos:** `sortingFiltered` (1079, [`filterMercuryRowsForSorting`](../src/lib/bankingSortingCounts.ts) applies the config slice), `sortingAfterSearch` (1081–1087), `sortingFilteredSorted` (1089–1092), `booksSortingFilteredSorted` (1118–1121, duplicate-excluded), `sortingTotalAmount` (1124–1127), `sortingUnmatchedCounts` (1129–1132, [`countSortingUnmatched`](../src/lib/bankingSortingCounts.ts) — "Without person" / "Not split to jobs" chips).
- **Handlers:** none exclusive beyond the sort toggler and `handleSortingConfigSave`; Refresh reuses `handleSync`; Reload (1751–1765, any role) calls the reload trio (`loadRowsForActiveView`, `loadNicknames`, `loadDebitCardNicknames`); the table's `setExpandedRowId` / `onEditAllocations` write parent state.
- **Supabase:** none beyond the shared engine (config lives in localStorage via [`bankingSortingConfig.ts`](../src/lib/bankingSortingConfig.ts)).
- **Sub-components:** `BankingMercuryTable` with all four layout flags on; modal `BankingSortingConfigModal` (extracted, 682 lines).
- **External coupling:** `?q=` lands here (Moneyfill).
- **Tests:** `bankingSortingCounts.test.ts`, `bankingSortingConfig.test.ts`, `bankingMercurySearch.test.ts`; `sortingTotalAmount` reduce untested.
- **Extraction status + risk + approach:** Inline. **Low-medium risk — best first tab extraction.** All filtering/counting logic is already in tested libs; the tab is mostly layout. Extract `BankingMercurySortingTab` receiving the memoized row slices (or their inputs), `sortingSort` moves in, `sortingConfig` stays parent-owned (hydration is role-dependent). Only `BankingSortingConfigModal` can travel with the tab (its "close on tab leave" effect becomes unmount-natural); the Debit cards modal is page-level (also opened from the Ledger and `?cards=`). The header-tools region renders in the page header outside the panel; move it into the tab or pass a `renderHeaderTools` slot — decide at extraction time, preserve placement.

### `drag_sort` — Drag Sort (extracted; see sub-decomposition dossier below)

- **Render location:** thin wrapper behind `bankingView.mercuryTab === 'drag_sort' && canAccessBanking && user?.id` (1853–1881).
- **Props from parent (23):** `userId`, `filteredTransactions={booksFilteredSorted}` (⚠ the *Ledger's* filter/search state shapes this list), `loading`, `accountFilter`/`setAccountFilter`, `kindFilter`/`setKindFilter`, `bankingSearchText`/`setBankingSearchText`, `accountOptions`, `kindOptions`, both nickname maps, `loadError`, the five relation caches + `jobLabelById`, `onEditAllocations` (→ `openAllocModalForMercuryRow`), `orgNotesByTxId`/`onOrgNoteUpdated`.

### `accounting` — Accounting (extracted; see sub-decomposition dossier below)

- **Render location:** thin wrapper behind `bankingView.mercuryTab === 'accounting' && canAccessBanking && user?.id` (1883–1925).
- **Props from parent (28, type `BankingMercuryAccountingTabProps` 135–212):** `userId`, `attributionOptions`, `filteredTransactions={booksFilteredSorted}`, `loading`, `loadError`, `mercurySearchNicknameCtx`, `mercurySearchEnrich`, the five relation caches + `jobLabelById`, `nicknameByDebitCard`, `onEditAllocations`, `orgNotesByTxId`/`onOrgNoteUpdated`, the lifted prefs (`hideLabeledTransactions`/`onHideLabeledTransactionsChange`, `applyRulesByDefault`/`onApplyRulesByDefaultChange`, `autoApplyResetTick`), `myRole` (gates both org switches + tags telemetry), `onAfterAssignmentChange={() => loadRowsForActiveView({silent: true})}` (the label⇄list feedback loop), **`onAttributionChange`** (inline closure 1910–1919 writing 4 parent relation setters), and the keyset trio `labeledHasMore` (gated by `isAccountingLabeledView`), `labeledLoadingMore`, `onLoadMoreLabeled`.

### `card_review` — Card Review (extracted, done; key renamed from `user_review` in v2.2899 — the tab label had been "Card Review" since v2.1262; the Dashboard clock-strip "User Review" modal is a different feature and kept its name)

- Wrapper (1927–1938) passes only `mercurySearchNicknameCtx`, `attributionOptions`, `recentPersonPicksStorageKey`, and `onAttributionChanged={loadMercuryAllocations}`. The tab **self-sources** its rows from the `user_review_rows` RPC — the dispatcher skips the master fetch when it is active.
- **Kind filter (v2.2899, J33-adj-2):** the RPC returns every non-duplicate tx in the window regardless of `kind`, so the pinned Unassigned row counted transfers/payouts/fees. A `Kind` select (All kinds · Card charges only · each kind present) narrows the rows *before* `buildUserReviewPivot`; kernel [`bankingCardReviewPrefs.ts`](../src/lib/bankingCardReviewPrefs.ts) (`buildCardReviewKindOptions` / `filterCardReviewRowsByKind` / `normalizeCardReviewKindFilter`), unit-tested. Default stays All kinds so nobody's totals move silently.
- **Device prefs** (`hide empty`, `time window`, `chart view`, `kind filter`) live under `banking_mercury_card_review_*_v1`; `readMigratedStorageItem` moves a value found under the old `banking_mercury_user_review_*_v1` key on first read.

### `category_review` — Category Review (extracted, done)

- Wrapper (1940–1958) passes `filteredTransactions={booksFilteredSorted}`, `loading`, `loadError`, `mercurySearchNicknameCtx`, the four attribution caches, `attributionOptions`, `recentPersonPicksStorageKey`, `onAttributionChanged={loadMercuryAllocations}` (11 props). Rides the master fetch.

### `reconciliation` / `visuals` (extracted, done)

- `<BankingMercuryReconciliationTab />` (1960–1964) and `<BankingMercuryVisualsTab />` (1966–1970) — **zero props**; each self-sources (Reconciliation via [`fetchMercuryReconciliation.ts`](../src/lib/fetchMercuryReconciliation.ts)). The target end-state for every tab.

### Stripe product (`invoices` / `data`, dev-only, extracted, done)

- `BankingStripeInvoicesPanel` / `BankingStripeWebhookEventsPanel` render prop-less behind `bankingView.product === 'stripe' && isDevBanking` (2141–2151).

### Page-level modals (2153–2265)

| Modal | Lines | Opened from | Key wiring |
|---|---|---|---|
| `BankingAccountNicknamesModal` (dev) | 2153–2165 | Nicknames menu (User Sort tools + Ledger toolbar); nudge's **Name accounts…** | `nicknameManageIds`, drafts + `persistNickname` / `clearNicknameRow` |
| `BankingDebitCardsModal` (v2.2750) | 2167–2191 | Nicknames menu (both); `?cards=` door | `debitCardManageIds`, `nicknameByDebitCard`, `roleByDebitCard`, nickname CRUD, `onDirectoryChanged={loadDebitCardNicknames}`, `usersOptions`, `onLinksChanged` → `loadMercuryAllocations`, `onOpenRecentTransactions`, `highlightCardId`; its `onClose` also clears `recentTxDebitCardId` + `highlightDebitCardId` |
| `BankingDebitCardRecentTxModal` | 2193–2199 | the Debit cards modal | `recentTxDebitCardId`, `rows`, `DEBIT_CARD_RECENT_TX_CAP = 50`; triggers raw-hydration effect 802–821 |
| `MercuryBackfillModal` (dev) | 2201–2207 | Ledger Advanced menu | `onSubmit={handleBackfill}` |
| `MercuryImportCsvModal` (dev/master) | 2209–2215 | Ledger Advanced menu | `onSubmit={handleImportCsv}` |
| `ManualAccountsModal` (dev/master) | 2217–2223 | Ledger Advanced menu | `onChanged` → reload trio (`loadRowsForActiveView`, `loadNicknames`, `loadDebitCardNicknames`) |
| **`MercuryTransactionAllocationsModal`** | 2225–2251 | User Sort (1841), Drag Sort (1876), Accounting (1900), Ledger (2133) — all `onEditAllocations` → `openAllocModalForMercuryRow` | see the contract below + its dossier |
| `BankingSortingConfigModal` (dev) | 2253–2265 | User Sort header tools | `initialConfig={sortingConfig}`, kind/account/debit choices, `onSave={handleSortingConfigSave}` |

**All of these stay in the parent** (each is opened from 2+ tabs, the shared header, a URL door, or another modal) — except `MercuryBackfillModal`/`MercuryImportCsvModal`/`ManualAccountsModal`, which are Ledger-only but whose completion callbacks touch parent loaders, so keep them parent-owned too (open via callback from the extracted Ledger tab).

### Banking's contract with `MercuryTransactionAllocationsModal`

`openAllocModalForMercuryRow(r)` (746–763) hydrates `raw` if needed (`mercuryRowNeedsRawHydration` → `fetchMercuryTransactionRawById`, patching the row back into `rows`) then sets `allocModalTx`. The modal receives `initialAllocations`/`initialPersonId`/`initialUserId` from the relation caches **as placeholders only** (it re-reads by id on staff paths — see its dossier), plus `legacyPersonDisplayName` (person-only seed → `personNameById`), `jobLabelById`, `usersOptions` (user-only options, not `attributionOptions`), both nickname maps, `recentPersonPicksStorageKey`; `onSaved` ignores its `MercuryAllocSavedDetail` and reloads the whole relation cache via `loadMercuryAllocations()`. Its exported types `MercuryJobSplit` / `MercuryAllocSavedDetail` are load-bearing across the Banking tabs. Any Banking decomposition must keep this modal + `openAllocModalForMercuryRow` + the relation caches co-located in the parent.

---

## Sub-decomposition dossier — `BankingMercuryAccountingTab.tsx` (2,936 lines)

Five logical regions share one component (309–2936): the **Approvals queue** (A), the **Rules engine** (B), the **Sorting Ledger** (C), the **Org switches** (D) and **People in rules** (E). A–C are coupled through `assignmentLabelByTxId` (512, the tx→label map), `labels` (509) and the `loadPending` / `loadRulesAndUsage` loaders; D and E hang off the side. Hooks: `useToastContext` (339), `useConfirmDialog` (340), `useCategoryTags` (522), `useIsNarrowScreen` (546).

### Module-level helpers (121–307)

Types 121–222 (props 135–212, `PendingApproval` 214–222), `criteriaToJson` (224–226), constants `TEST_PREVIEW_LIMIT = 40` (228), `APPLY_RULES_PER_CLICK_CAP = 500` (236), `APPLY_RULES_CONFIRM_THRESHOLD = 200` (243), `APPROVALS_PAGE_SIZE = 50` (250), `ACCOUNTING_PENDING_ID_IN_CHUNK_SIZE = 200` (265; chunked `.in()` — unchunked URLs blew HTTP/2 header limits, `ERR_HTTP2_PROTOCOL_ERROR`); chunked fetchers `fetchAccountingPendingRuleNames` (267–278), `fetchAccountingPendingLabelNames` (280–291), `fetchAccountingPendingTxsByIds` (293–307). The fetchers are lib-shaped (move to `src/lib/` alongside [`fetchMercuryRelationsByTxIds.ts`](../src/lib/fetchMercuryRelationsByTxIds.ts)); untested.

### Region A — Approvals queue

- **Render location:** `<section>` 2111–2452 — header with **Rules (N)** / **Tags (N)** / **Approve all** buttons (2111–2191), search + Group-by-label + org switches + explainer when not idle (2192–2301), cards (2302–2449). `BankingMercuryDuplicatesPanel` renders just above it (2109).
- **Owned local state:** `pendingApprovals` (526, + mirror `pendingApprovalsRef` 542 synced by effect 588–590 for memo-stable card callbacks), `pendingLoading` (527), `pendingLoadSeqRef` (518), `pendingSearch` (535), `groupByLabel` (536; per-user, hydrated by effect 607–609, written by `handleGroupByLabelChange` 611–617), `expandedGroupIds` (537) / `groupVisibleCount` (538) (`toggleGroupExpanded` 619–627), `approvalsVisibleCount` (531, + `prevPendingLenRef` 595 and effect 596–601 for the 0→N reset), `approveAllBusy` (529).
- **Cross-region/shared:** `assignmentLabelByTxId` (writes on approve), `ruleUsageApproved` (increments), `rulesLoading` (passed to every card, 2333 / 2382), `labels`/`labelById`, `ruleById` (rule-person upsert), `allocationsByTxId` (conflict detection), `autoApproveOrgOn` (explainer copy, Region D), parent's `onAfterAssignmentChange`.
- **Derived memos:** `approvalsIdle` (1282, v2.1747 collapse-to-header), `conflictSuggestionIds` (1299–1315; decided by the shared [`shouldAutoApproveSuggestion`](../src/lib/accountingLabelAutoApprove.ts) kernel so it matches what the server auto-approver leaves pending), `pendingApprovalItems` (1318–1330), `filteredApprovalItems` (1331–1334, [`filterApprovalItems`](../src/lib/accountingApprovalGroups.ts)), `filteredSuggestionIds` (1335–1338), `pendingFilteredApprovals` (1340–1346), `approvalGroups` (1347–1350, [`groupApprovalItemsByLabel`](../src/lib/accountingApprovalGroups.ts)), `pendingByLabel` (1353–1361), `approvableFilteredCount` (1362–1365) / `conflictFilteredCount` (1366).
- **Handlers:** `loadPending` (815–876; paged `fetchAllRows` + chunked rule/label/tx hydration; effect 878–880), `handleApprove` (1368–1441; upsert assignment + suggestion UPDATE `status:'approved'`, `final_label_id`, `resolved_at/by`, then — v2.1725 — the rule's person via `mercury_transaction_attributions` upsert with `ignoreDuplicates`), `rejectPendingItems` (1446–1470, chunked DELETE, `REJECT_CHUNK = 500`), `approvePendingItems` (1478–1557, chunked RPC `bulk_approve_accounting_label_suggestions`, `APPROVE_CHUNK = 500`, conflict split + optimistic assignment write), `handleReject` (1559–1564), `handleApproveAll` (1568–1570, search-filtered set), `handleApproveGroup` (1574–1592) / `handleRejectGroup` (1594–1615) (`GROUP_BULK_CONFIRM_THRESHOLD = 25` → `confirmDialog`), stable card callbacks `handleApproveCard` / `handleRejectCard` / `handleLabelChangeCard` (1622–1655; resolve rows via `pendingApprovalsRef` so `React.memo` on `AccountingApprovalCard` holds). Approvals record `label_suggestion_approved` `#by:user` via `recordNavClick`.
- **Supabase:** `mercury_accounting_label_suggestions` (SELECT/UPDATE/DELETE), `mercury_accounting_label_rules` + `mercury_drag_sort_labels` + `mercury_transactions` (chunked hydration), `mercury_transaction_attributions` (upsert), `mercury_transaction_drag_sort_assignments` (UPSERT via Region C's `upsertDragAssignment` in `handleApprove`), RPC `bulk_approve_accounting_label_suggestions`.
- **Sub-components:** `AccountingApprovalCard` (197 lines, memoized), `AccountingApprovalGroupHeader` (116) — both extracted.
- **Tests:** `accountingApprovalGroups.test.ts`, `accountingLabelAutoApprove.test.ts` + `accountingLabelAutoApproveSharedParity.test.ts`; approve/reject cores (IO + optimistic rollback) untested.
- **Extraction approach:** `useAccountingApprovals` hook (state + loaders + approve/reject cores) + an `AccountingApprovalsSection` component. **Medium risk** — the optimistic-write/rollback pairs and the ref-based card-callback stability must move intact.

### Region B — Rules engine (+ category tags)

- **Render location:** the **Rules (N)** button (2132–2148) and **Tags (N)** button (2149–2165) in the Approvals header; modals 2777–2933; logic 1694–2088 plus `loadRulesAndUsage` (767–809, effect 811–813).
- **Owned local state:** `rules` (519), `rulesLoading` (524), `ruleUsageApproved` (525), `applyRulesBusy` (528), `applyRulesConfirm` (530), rule-form cluster (`ruleModalOpen` 561, `ruleModalMountKey` 562, `ruleModalInitial` 563, `editingRuleId` 564), test-preview cluster (`testModalOpen` 565, `testRows` 566, `testTotal` 567, `testOtherMatchingRulesByTxId` 568), overlaps cluster (`overlapsModalOpen` 571, `auditPendingReopenAfterRuleModalRef` 579, `ruleModalOpenPrevRef` 580, watcher effect 1917–1924), rules-table cluster (`rulesModalOpen` 581, `rulesTableSearchText` 582, `rulesTableSort` 583), category tags (`useCategoryTags(true)` 522 — v2.2718, one load shared by the tags manager, the rule form's tag picker and the rules list — + `tagsModalOpen` 523).
- **Cross-region/shared:** `assignmentLabelByTxId` (preflight excludes assigned txs), `filteredTransactions` (the match universe — **Banking-filtered rows only**, deliberately not the Accounting search / More filters / Hide-labeled slice), `labels` / `labelsLoading` / `labelAssignmentCountById` (rule-form props, 2782–2784), `assignmentsLoading` (gates the auto-apply effect), `autoApproveOrgOn` (toast copy in `executeApplyRules`), parent's `applyRulesByDefault` + `autoApplyResetTick`, Region E's `ruleAttributionNameById` / `createPersonFromRuleForm` / `maybeOfferAttributionBackfill`.
- **Derived memos:** `ruleById` (888–892), `overlapReport` (1038–1051, [`buildAccountingRuleOverlapReport`](../src/lib/accountingRuleOverlap.ts), computed only while the modal is open), `overlapTxByIdMap` (1053–1058), `rulesSearchNorm` (1060), `rulesFilteredForTable` (1062–1068) / `rulesSortedForTable` (1070–1078) ([`accountingRulesTableSearch.ts`](../src/lib/accountingRulesTableSearch.ts)), `onRulesSortHeaderClick` (1080–1087).
- **Handlers:** `computeApplyRulesPreflight` (1694–1734; pending-id server hop + [`buildAccountingRulesToInsert`](../src/lib/applyAccountingRulesPreflight.ts)), `executeApplyRules` (1741–1780; cap slice + `INSERT_CHUNK = 2000` via RPC `bulk_insert_accounting_label_suggestions`), `applyRulesWithSnapshot` (1782–1795; >200 matches → confirm modal), `applyRules` (1797–1799), `runAutoApply` (1809–1813; bypasses the confirm modal, keeps the 500 cap), `lastAutoAppliedSignatureRef` (1819) + reset effect (1821–1823) + auto-apply effect (1825–1849, [`accountingApplyRulesAutoTrigger.ts`](../src/lib/accountingApplyRulesAutoTrigger.ts)), `cancelApplyRulesConfirm` / `confirmApplyRulesAfterModal` (1851–1860), `openNewRuleModal` (1862–1867) / `openNewRuleFromCounterparty` (1869–1884, prefills via `suggestedRuleNameFromCounterparty`) / `openEditRuleModal` (1886–1894) / `openEditRuleById` (1896–1906) / `openEditRuleByIdFromOverlaps` (1908–1915, the z-index reopen dance), `runTestFromCriteria` (1926–1959; [`matchAccountingLabelRuleCriteria`](../src/lib/accountingLabelRuleMatch.ts) over `filteredTransactions` + other-rules overlap annotation), `saveRuleDraft` (1961–2003) / `saveRuleDraftAndApply` (2005–2050) (⚠ near-duplicate INSERT/UPDATE blocks, both writing `attributed_person_id`/`attributed_user_id` and offering the Region-E backfill on edits), `closeRuleModal` (2052), `deleteRuleCore` (2054–2069) / `deleteRule` (2071–2088, `confirmDialog` danger).
- **Supabase:** `mercury_accounting_label_rules` (CRUD), `mercury_accounting_label_suggestions` (usage SELECT paged; pending-ids SELECT **un-ranged**, 1705–1707), RPC `bulk_insert_accounting_label_suggestions`.
- **Sub-components (extracted):** `AccountingRuleFormModal` (869 lines, 2777–2808), `BankingMercuryAccountingRulesModal` (473, 2896–2921), `BankingMercuryAccountingOverlapsModal` (270, 2874–2885), `BankingMercuryAccountingApplyRulesConfirmModal` (145, 2887–2894), `BankingMercuryCategoryTagsModal` (423, 2922–2933, z 1150). **Inline:** the Test results modal (2810–2872, 63 lines) — extract it.
- **Tests:** `applyAccountingRulesPreflight.test.ts`, `accountingLabelRuleMatch.test.ts` + `accountingLabelRuleMatchSharedParity.test.ts`, `accountingRuleOverlap.test.ts`, `accountingApplyRulesAutoTrigger.test.ts`, `accountingRulesTableSearch.test.ts`, `matchingAccountingRulesForTx.test.ts`, `banking/categoryTagsData.test.ts`; the other-matching-rules annotation in `runTestFromCriteria` and the save blocks are untested.
- **Extraction approach:** `useAccountingRulesEngine` hook. **Medium-high risk** — the auto-apply signature/reset protocol spans parent (`autoApplyResetTick`) and child; `saveRuleDraftAndApply` chains save → `loadRulesAndUsage` → `applyRulesWithSnapshot(fresh)` and must keep using the *fresh* rules list, not state.

### Region C — Sorting Ledger

- **Render location:** `<section>` 2454–2694 (toolbar: search, **Hide labeled transactions** + **Apply rules by default** checkboxes wired to the parent-lifted prefs, More filters; active-filter chips 2507–2522; table 2525–2693) + modals 2696–2738 (ledger filter 2696–2706, counterparty frequency 2708–2723, quick assign 2725–2738).
- **Owned local state:** `accountingSearchText` (341), `ledgerFiltersApplied` (551) / `ledgerFilterModalOpen` (554) / `ledgerFilterDraft` (556) (persisted per-user via [`bankingAccountingLedgerFilters.ts`](../src/lib/bankingAccountingLedgerFilters.ts) parse/serialize + `bankingDragSortStorage`; hydrate effect 603–605), `ledgerSort` (559, [`bankingMercuryLedgerTableSort.ts`](../src/lib/bankingMercuryLedgerTableSort.ts), hydrate effect 629–631), `counterpartyFrequencyModalOpen` (555), `notesExpandedTxId` (543), `isNarrowScreen` (546; v2.1749 full-bleed table on phones), quick-assign cluster (`quickAssignTxId` 547, `quickAssignMode` 548 — `assign` or `person-only`, `quickAssignBusy` 549), `labels` (509) / `labelsLoading` (510) / `labelAssignmentCountById` (511), `assignmentLabelByTxId` (512) / `assignmentsLoading` (513) / `assignmentsLoadSeqRef` (517) — these last six are C's to load but **not C's alone**: A reads `labels` and writes the assignment map on approve, B's rule form takes the three label states and B's auto-apply effect gates on `assignmentsLoading`, so they move to the `useAccountingLabelsAndAssignments` seam below, not with C.
- **Cross-region/shared:** `assignmentLabelByTxId` is the bridge to A and B; `inputIsUnlabeledOnly` (508, = parent's `hideLabeledTransactions`) short-circuits the assignment sweep AND the client-side hide filter; keyset props (`labeledHasMore`/`labeledLoadingMore`/`onLoadMoreLabeled`) drive the window-scroll infinite-scroll effect (1106–1118; 400 px threshold, fires once on mount for short pages).
- **Derived memos:** `accountingSearchNorm` (633), `accountingKindOptions` (635–639), `ledgerFilterCtx` (641–644), `ledgerFiltersActiveCount` (646–649), `afterAccountingSearch` (651–661) → `afterLedgerFilters` (663–666, [`filterRowsByAccountingLedgerFilters`](../src/lib/bankingAccountingLedgerFilters.ts)) → `displayTransactions` (1089–1094, hide-labeled) → `sortedDisplayTransactions` (1096–1100, `compareMercuryLedgerRows`); `counterpartyFrequencyByKey` (1120–1123) / `counterpartyFrequencyRows` (1125–1128) ([`bankingMercuryCounterpartyFrequency.ts`](../src/lib/bankingMercuryCounterpartyFrequency.ts)); `labelById` (882–886); `quickAssignTransactionSummary` (1284–1292).
- **Handlers:** `loadLabels` (668–702; `ensureDragSortDefaultLabels` + RPC `list_mercury_drag_sort_label_assignment_counts`; effect 704–706), `loadAssignmentsForList` (708–761; **one paged whole-table read** via `fetchAllRows` ordered by `mercury_transaction_id`, filtered to the visible set, seq-token guarded — contrast Drag Sort's 400-id chunks; effect 763–765), `upsertDragAssignment` (1130–1136) / `removeAssignment` (1138–1142) / `clearRowDragSortLabel` (1144–1168, per-row optimistic rollback), `closeQuickAssign` (1170–1173), `handleQuickAssignLabel` (1201–1256; Internal-Transfers guard, optional person via Region E's `writeQuickAttribution`), `handleQuickAssignPerson` (1259–1275; person-only), ledger-filter modal open/apply/cancel/clear (1657–1683; `withLedgerFilterKindsNormalizedIfAllSelected` on apply).
- **Supabase:** `mercury_drag_sort_labels`, `mercury_transaction_drag_sort_assignments` (SELECT/UPSERT/DELETE), RPC `list_mercury_drag_sort_label_assignment_counts`.
- **Sub-components (all extracted):** the `bankingMercuryDragSortLedger.tsx` row/thead/notes family (855 lines, shared with Drag Sort), `BankingMercuryAccountingLedgerFilterModal` (349), `MercuryCounterpartyFrequencyModal` (207), `AccountingLabelQuickAssignModal` (430), `BankingMercuryDuplicatesPanel` (302; `onAfterChange` → parent reload).
- **Tests:** `bankingAccountingLedgerFilters.test.ts`, `bankingMercuryLedgerTableSort.test.ts`, `bankingMercuryCounterpartyFrequency.test.ts`, `dragSortDefaultLabels.test.ts`; the mutators untested.
- **Extraction approach:** an `AccountingSortingLedgerSection` component once labels/assignments move to a shared `useAccountingLabelsAndAssignments` hook that Regions A and B also read. **This hook is the cluster seam** — extract it before splitting A, B or C out.

### Region D — Org switches (v2.2889 auto-approve, v2.3514 AR-applied-means-Income)

- **Render location:** two checkboxes + notes inside the Approvals section (~2229–2301; auto-approve label ~2229–2255, AR-income label ~2256–2284, explainer 2286–2290, `data-testid="ar-income-switch-note"` 2291–2301); logic 343–502 (341 above it is Region C's `accountingSearchText`).
- **Owned local state:** `autoApproveOrgOn` (348), `autoApproveSaving` (349), `arIncomeOrgOn` (404), `arIncomeSaving` (405), `arIncomePreview` (406), `arIncomeResult` (407), `arIncomeNotLive` (408). `canFlipAutoApprove` (347; `dev || master_technician`) gates both.
- **Effects / handlers:** read `app_settings.accounting_label_auto_approve_rule_matches` (350–369); `handleAutoApproveOrgChange` (370–399); read `app_settings.ar_applied_deposits_count_as_income` (409–435; no row → `arIncomeNotLive`, switch shown disabled); dry-run preview while off (437–459; RPC `backfill_ar_applied_income_labels` `p_dry_run: true`; `isMissingRpcError` → not live); `handleArIncomeOrgChange` (460–502; optimistic flip + rollback, **UPDATE not upsert** — the row is migration-seeded and the master_technician policy is UPDATE-only on that key; turning it on runs the backfill once with `p_dry_run: false`; telemetry `ar_income_switch`).
- **Cross-region:** `autoApproveOrgOn` is read by `executeApplyRules` (Region B toast) and the Approvals explainer. The AR key is also read by `src/components/jobs/BankPaymentsModal.tsx` (same `AR_APPLIED_INCOME_SETTING_KEY`); the labelling itself is a DB trigger on `jobs_ledger_payments`.
- **Supabase:** `app_settings` (SELECT/UPDATE), RPC `backfill_ar_applied_income_labels`.
- **Tests:** parse kernels only — `parseAutoApproveSettingValue` (`accountingLabelAutoApprove.test.ts`), `parseArIncomeSettingValue` (`jobs/arBankLabel.test.ts`); the flip handlers and preview are untested.
- **Extraction approach:** the two clusters are the same read/optimistic-flip/rollback shape → one `useOrgSettingSwitch(key, parse)` hook + an `AccountingOrgSwitches` component (AR preview/backfill as an optional add-on). Touches no label/assignment state, so it is the **lowest-coupling peel in the file**; low-medium risk. (Turning AR on labels deposits server-side but reloads nothing client-side — assignments stay stale until the next load; preserve, don't fix in the move.)

### Region E — People in rules (v2.1725–v2.1742)

- **Render location:** the "Tag prior transactions?" prompt, inline (2740–2775, z 1300); the rule form's and quick-assign modal's person pickers (props `attributionOptions` + `onCreatePerson`).
- **Owned local state / refs:** `backfillPrompt` (919), `backfillBusy` (926), `mintedPersonNameByValueRef` (972; names minted this session, since the parent's options only refresh on reload).
- **Derived memos:** `attributionNameByValue` (895–901, from the parent's `attributionOptions`), `ruleAttributionNameById` (904–915 → Rules modal).
- **Handlers:** `maybeOfferAttributionBackfill` (928–967; after saving an **edit** of a rule that names a person, paged read of that rule's approved suggestions → prompt), `createPersonFromRuleForm` (975–995; inserts a `people` row `kind: 'sub'`), `runAttributionBackfill` (997–1036; [`planAttributionBackfill` / `chunkIds`](../src/lib/banking/ruleAttributionBackfill.ts), upsert `ignoreDuplicates` — a hand-set person is never changed), `writeQuickAttribution` (1181–1199; **full** upsert — a quick-assign pick overwrites a rule-set person — then `onAttributionChange` to patch the parent maps).
- **Supabase:** `people` (INSERT), `mercury_transaction_attributions` (SELECT/UPSERT), `mercury_accounting_label_suggestions` (SELECT).
- **Tests:** `banking/ruleAttributionBackfill.test.ts`, `bankingAttributionOptions.test.ts` (`parseBankingAttributionValue`, `bankingPersonKindTag`).
- **Extraction approach:** `useRulePersonAttribution` hook (+ the prompt as its own component). Low-medium risk; it reads `attributionOptions`, `userId`, `onAttributionChange` and nothing from A–C beyond being called from B's save and C's quick-assign.

---

## Dossier — `MercuryTransactionAllocationsModal.tsx` (1,705 lines)

The shared "Link to person and jobs" editor (staff) / "Assign to jobs" (tally) for one Mercury transaction: job split lines in dollars or percent, person/user attribution (staff only), a "choose invoices" link into the nested `MercuryTransactionInvoiceLinkModal` (366 lines), and — in tally mode — the day's Dispatch schedule and clock sessions as quick picks. Component 293–1705; render 1026–1704 (dialog z 1150).

**Call sites (9 JSX renders; 19 files import it, mostly for the `MercuryJobSplit` / `MercuryAllocSavedDetail` types):** `src/pages/Banking.tsx` 2226, `src/pages/Jobs.tsx` 2247, `src/pages/JobTally.tsx` 2330 (tally), `src/components/tally/TallyPreClockOutModal.tsx` 324 (tally), `src/components/DashboardStaleTallyStaffFollowUpModal.tsx` 726 (tally + `tallyActAsUserId`), `src/components/banking/BankingMercuryTxDetailModal.tsx` 582, `src/components/quickfill/BankingSortingSnapshotSection.tsx` 600, `src/components/quickfill/QuickfillNoncardAttributionSection.tsx` 384, `src/components/userReview/UserMercuryWindowSection.tsx` 595.

**Three modes** from the props (`MercuryTransactionAllocationsModalProps`, 60–95): **staff** (default — attribution picker, DB re-read seed, `replace_mercury_transaction_splits`), **tally self-service** (`tallySelfService` — no attribution, prop seed, `replace_mercury_job_splits_for_my_linked_card`, scoped job search), **tally on behalf** (`tallySelfService` + `tallyActAsUserId` — `replace_mercury_job_splits_for_linked_card_as_staff`, `search_jobs_for_tally_mercury_assign_as_user`).

| Region | Lines (a05cef4c4) | State / hooks | Data | Tests |
|---|---|---|---|---|
| Module helpers: `formatCurrency` 107–109, `formatPostedDate` 112–126, `dispatchScheduledJobToSearchRow` 128–137, `round2` 139–141, `tallySchedulePossessiveName` 144–147, `lineDisplayDollars` 149–157, `redistributeEqualSplit` 160–209, `sumEpsilon` 211; style consts 213–291 | 107–291 | — | — | ⚠ split math is a private copy of [`src/lib/mercurySplitMath.ts`](../src/lib/mercurySplitMath.ts) (same logic at a05cef4c4, tested by `mercurySplitMath.test.ts`, used by `TransactionDetailModal`); the modal's copy is untested |
| Prop seed | effect 426–447 | `lines` 314, `userId` 315, `seedPersonId` 319 / `seedUserId` 320, `stripAttribution` 316, `jobSearch`, `jobResults` | — | — |
| DB seed + retry (staff) | effect 457–516; retry banner 1086–1130 | `serverSeed` 322, `seedStatus` 323 (`idle`/`loading`/`ready`/`failed`/`changed`), `seedRetryTick` 324, `jobLabelByIdRef` 325 | `fetchJobAllocationsByMercuryTxIds` + `fetchAttributionsByMercuryTxIds` by id; `jobs_ledger` label backfill | `mercuryAllocModalSeed.test.ts` (`seedStateFromRows`), `fetchMercuryRelationsByTxIds.test.ts` |
| Job search | effect 518–553 (300 ms debounce, >2 chars); `jobResultsUnified` 329–332; `useJobBidSearchEvidence` 333; results 1253–1289 | `jobSearch` 327, `jobResults` 328, `jobSearchLoading` 334 | RPC `search_jobs_ledger` (staff) / `search_jobs_for_tally_mercury_assign` / `search_jobs_for_tally_mercury_assign_as_user` | — |
| Recent person chips | effect 555–561; `recentChipsOrdered` 798–802 | `recentPersonIds` 336 | localStorage `mercury.alloc.recentPersonUserIds.<operator id>` via [`mercuryAllocRecentPersonUserIds.ts`](../src/lib/mercuryAllocRecentPersonUserIds.ts) | untested |
| Internal Transfers lock | effect 568–599; banner 1063–1084 | `internalTransfersLabelLocked` 349 | `mercury_transaction_drag_sort_assignments` + label `default_key` embed | `dragSortDefaultLabels.test.ts` (key only) |
| Tally day context | effect 601–770; `tallyScheduleHeadings` 369–422; render 1382–1506 | `staffDayScheduleJobs` / `staffDaySessionJobs` / `staffDaySessionBids` / `staffDayContextLoading` / `staffDayContextError` (337–341) | `fetchDispatchScheduledJobsForAssigneeDay`, `clock_sessions`, `jobs_ledger`, `bids` | `jobScheduleBlocks.test.ts` (fetch helper); headings untested |
| Live split math | `allocationSum` 772–780, `remainder` 782–785, `canSave` 787–796, `addJobLine` 804–832, `removeLine` 834–840, `updateLine` 842–844, `fillRemainder` 846–864 | `lines` | — | **untested money math** (only the lib twin of `lineDisplayDollars`/`redistributeEqualSplit` is tested) |
| Attribution picker (staff) | render 1298–1380 (recent chips 1310–1349, legacy person hint 1365–1378) | `userId`, `stripAttribution`, seed ids | `usersOptions` prop | — |
| Save | `handleSave` 866–998 | `saving` 317, `seedStatus` | pre-save re-read + `decideSplitSaveGuard`; RPCs above | guard tested (`mercuryAllocModalSeed.test.ts`); **attribution ladder 902–921 and signed `p_rows` 888–901 untested** |
| Escape + invoice link | effect 1000–1010; invoice button 1221–1249; nested modal 1687–1702 | `invoiceModalOpen` 335 | `MercuryTransactionInvoiceLinkModal` | no render test |

**Load-bearing behaviors (preserve):**
- **The DB is the staff seed of record.** Effect 457–516 re-reads splits + attribution by id on open; `canSave` (791) stays false until `seedStatus === 'ready'`; `handleSave` re-reads again right before the REPLACE and refuses on `decideSplitSaveGuard !== 'ok'` ('changed' → Reload banner, nothing written). Tally paths keep the prop seed — their roles read `[]` from the relation tables under RLS.
- The prop-seed effect (426–447) deliberately depends only on `[open, transaction?.id, initialUserId]` — parent array/object churn must not wipe in-progress edits.
- Lines hold `|amount|`; Save writes `round2(allocationSign * displayD)` so debit transactions store negative splits. Zero-amount transactions cannot be split (`canSave` 793).
- Attribution precedence at Save (902–921): strip → both null; picked user → user only (person cleared); seed had a user but the picker was cleared → both null; person-only legacy seed → keep the person; else both null.
- Internal Transfers lock blocks `addJobLine`, Save and the invoice link.
- The invoice-link save calls `onSaved` with empty allocations, then closes both.
- `onSaved` returns a `MercuryAllocSavedDetail`; Banking ignores it and reloads the whole relation cache.

**Extraction status + risk + approach:** extracted and shared; internally one component. **Medium-high risk** — Save is a DELETE+INSERT on the books across 9 callers. Stage A: (1) delete the private `round2`/`lineDisplayDollars`/`redistributeEqualSplit`/`sumEpsilon` (139–211) and import them from `mercurySplitMath` (dedup, zero behavior change); (2) `resolveAllocationAttribution(...)` (the 902–921 ladder) + `buildReplaceSplitRows(lines, displayTotal, sign)` (888–901) + the `canSave`/`fillRemainder` arithmetic → `src/lib/mercuryAllocSave.ts` + tests; (3) `tallyScheduleHeadings` → pure function. Stage B: `useTallyDayContext` hook (601–770) + a `MercuryAllocTallyDayContext` panel (1382–1506), mounted only when `showTallyDayContext`; then `useMercuryAllocSeed` (426–516 + `seedRetryTick`) with the save guard kept beside `handleSave`.

---

## Sub-decomposition dossier — `BankingMercuryDragSortTab.tsx` (1,400 lines)

Line numbers from `npm run map` (source identical to a05cef4c4; last commit 2026-08-20). The file is in `covers:`, so a refresh regenerates its fact sheet with the other three.

- **Render location:** whole file; component 279–1400, render 706–1399 — one `DndContext` wrapping a left ledger column (944–1039) and a sticky right sidebar of label buckets (1120–1156), plus the help panel (900–942), the Quick Sort focus modal and the inline add-label modal (1198–1359).
- **Module-level pure helpers (61–146):** `DragSortBucketStats` (61–65), `emptyBucketStats` (67–73), `buildBucketStats` (75–96), `cloneBucketStats` (98–108), `subtractFromLabeled` (110–120), `addToLabeled` (122–127), `applyAssignmentDelta` (129–146) — the optimistic count/sum bucket math. **Pure, untested money sums, top Stage-A candidate.**
- **Module-level components:** `DragSortTransactionPreview` (148–186, drag overlay card), `LabelDropZone` (188–230, `useDroppable` wrapper over extracted `DragSortLabelBucketCard`), `InboxDropZone` (232–251, `INBOX_DROP_ID` clear-label target). Props type 253–277.
- **Owned local state (19, 306–328):** `labels` / `labelsLoading`, `assignmentLabelByTxId`, `bucketStats`, `assignmentsLoading`, `hideLabeledTransactions` (**tab-local here** — `readDragSortHideLabeledTransactions`, effect 330–332; distinct from the Accounting tab's lifted toggle), `labelsCardsExpanded` (effect 334–336), `activeDragTxId`, add-label cluster (`addLabelModalOpen`, `newLabelName`, `newLabelScheduleCLine`, `newLabelDescription`; caps `DRAG_SORT_LABEL_NAME_MAX = 120`, `…SCHEDULE_C_LINE_MAX = 32`, `…DESCRIPTION_MAX = 2000` at 56–58; Escape effect 342–349), `detailLabel` (CategoryDetailModal), `counterpartyFrequencyModalOpen`, `dragSortHelpOpen`, `quickLabelModalOpen`, `labelsSidebarSearchText`, `quickLabelUndoStack` (+ `quickLabelUndoStackRef` 326; **capped at the last 2** via `.slice(-2)` at 571; cleared when Quick Sort closes, effect 338–340), `notesExpandedTxId`.
- **Cross-tab/shared state (props):** `filteredTransactions={booksFilteredSorted}` (⚠ shaped by the Ledger tab's `accountFilter`/`kindFilter`/`bankingSearchText`, whose setters this tab also renders — the filter row here mutates parent state shared with Ledger), the relation caches, nicknames, org notes, `onEditAllocations`.
- **Derived memos:** `labelById` (357–361), `labelsSidebarSearchNorm` (363), `filteredLabelsForSidebar` (365–372), `displayTransactions` (439–442), `counterpartyFrequencyRows` (444–447), `dragSortQuickLabelQueue` (450–453; `[0]` is the Quick Sort front card), `txById` (455–458); plus the plain const `activeOverlayRow` (460).
- **Handlers:** `loadLabels` (374–392; `ensureDragSortDefaultLabels` then select; effect 394–396), `loadAssignmentsForList` (398–433; **chunked 400-id `.in()` batches**, no seq token; effect 435–437), `upsertAssignment` (462–472) / `deleteAssignment` (474–481), `applyDragSortAssignment` (483–566; Internal-Transfers guard, optimistic map + `bucketStats` delta, per-row rollback), `handleQuickLabelPick` (568–575) / `handleQuickLabelUndo` (577–586), `handleDragEnd` (588–603; inbox vs `label:` prefix routing), `clearRowDragSortLabel` (605–610), `addLabel` (612–659; validation + `sort_order` max+1 insert), `removeLabel` (661–697; blocks `is_system_default`; `confirmDialog` danger; clears affected assignments locally, rebuilds `bucketStats`, then reloads), `onDragStart` (699–701). Sensors (351–355): `PointerSensor` `activationConstraint: {distance: 4}`; collision `pointerWithin` (705–710; comment: cheaper than `closestCenter`; try `rectIntersection` if drops misfire).
- **Supabase:** `mercury_drag_sort_labels` (SELECT/INSERT/DELETE), `mercury_transaction_drag_sort_assignments` (SELECT/UPSERT/DELETE).
- **Sub-components:** extracted — `bankingMercuryDragSortLedger.tsx` row family, `DragSortLabelBucketCard`, `CategoryDetailModal`, `MercuryCounterpartyFrequencyModal`, `BankingMercuryDragSortFocusModal` (Quick Sort, 504 lines). Inline — the **Add Accounting Label modal** (1198–1359, 162 lines, self-contained, easy file move).
- **External coupling:** none beyond the parent props; labels + assignments tables are shared org-wide with the Accounting tab (DB-level coupling; no shared client state — the two tabs each load their own copies and can go stale against each other until reload).
- **Tests:** `bankingDragSortStorage.test.ts`, `bankingMercuryCounterpartyFrequency.test.ts`, `dragSortDefaultLabels.test.ts`; bucket stats and the assignment core untested; no render test.
- **Extraction status + risk + approach:** Already extracted from the page; internally healthy but improvable. Stage A: bucket-stats kernel → `src/lib/bankingDragSortBucketStats.ts` + tests (delta math, clone semantics, unlabeled transitions). Stage B (optional): Add-label modal → own file; consider adopting the Accounting tab's `assignmentsLoadSeqRef` token to guard `loadAssignmentsForList` against stale responses (behavior-affecting — its own reviewed change, not during a move).

---

## Test coverage by region

No component in this map has a render test (`*.render.test.tsx`) and no e2e spec opens `/banking`; coverage is all kernel-level. **Untested money math is flagged ⚠.**

| Region | Tested kernels | Untested inline logic |
|---|---|---|
| Banking router + roles | `bankingAccess.test.ts` | `parseBankingView`, `mercuryTabFromParam` |
| Banking data engine | `supabasePaging.test.ts` | the four loaders + dispatcher; `fetchMercuryTransactionRaws` has no test |
| Banking relations | `fetchMercuryRelationsByTxIds.test.ts`, `mercuryRelationMaps.test.ts`, `bankingAttributionOptions.test.ts` | `loadMercuryAllocations`, the 1910–1919 patch closure |
| Banking nicknames / cards | `banking/debitCards.test.ts`, `bankingAccountNicknameNudge.test.ts` | nickname CRUD |
| Banking prefs | `bankingDragSortStorage.test.ts` | `bankingUserPrefs` (no test), dual-write effects |
| Ledger / User Sort | `bankingMercurySearch.test.ts`, `bankingSortingCounts.test.ts`, `bankingSortingConfig.test.ts` | `sortMercuryRowsStable`; ⚠ `totalAmount` / `sortingTotalAmount` reduces (1123–1127) |
| Accounting A — Approvals | `accountingApprovalGroups.test.ts`, `accountingLabelAutoApprove*.test.ts` | approve/reject cores, chunk loops; module fetchers 267–307 (called only by `loadPending`) |
| Accounting B — Rules | `applyAccountingRulesPreflight`, `accountingLabelRuleMatch*`, `accountingRuleOverlap`, `accountingApplyRulesAutoTrigger`, `accountingRulesTableSearch`, `matchingAccountingRulesForTx`, `banking/categoryTagsData` (all `.test.ts`) | other-matching-rules annotation; duplicated save blocks |
| Accounting C — Ledger | `bankingAccountingLedgerFilters`, `bankingMercuryLedgerTableSort`, `bankingMercuryCounterpartyFrequency`, `dragSortDefaultLabels` | mutators + rollback |
| Accounting D — Org switches | `accountingLabelAutoApprove.test.ts`, `jobs/arBankLabel.test.ts` (parse only) | flip / rollback / backfill handlers |
| Accounting E — People | `banking/ruleAttributionBackfill.test.ts`, `bankingAttributionOptions.test.ts` | `writeQuickAttribution`, `createPersonFromRuleForm` |
| Allocations modal | `mercuryAllocModalSeed.test.ts`, `mercurySplitMath.test.ts` (lib twin only), `jobScheduleBlocks.test.ts`, `ledgerDisplayPrefixes.test.ts` | ⚠ `allocationSum` / `remainder` / `canSave` / `fillRemainder`; ⚠ signed `p_rows` build; attribution ladder; ⚠ the private split-math copy; recent-chip storage |
| Drag Sort | `bankingDragSortStorage`, `bankingMercuryCounterpartyFrequency`, `dragSortDefaultLabels` | ⚠ bucket-stats kernel (61–146); `applyDragSortAssignment` |

---

## Stage-A pure-logic inventory

Extract to `src/lib/*` + colocated tests **before** any component moves. Banking is unusually far along — most calc already lives in tested libs (see the coverage table). What's left:

| Candidate | Currently | Target |
|---|---|---|
| Split math `round2` / `lineDisplayDollars` / `redistributeEqualSplit` / `sumEpsilon` | private copy in `MercuryTransactionAllocationsModal.tsx` 139–211 | **delete and import** from [`src/lib/mercurySplitMath.ts`](../src/lib/mercurySplitMath.ts) (already tested; identical logic at a05cef4c4) — a dedup, not a move |
| Save kernel: attribution precedence (902–921) + signed `p_rows` (888–901) + `canSave` / `fillRemainder` arithmetic (787–796, 846–864) | inline in `MercuryTransactionAllocationsModal.tsx` | `lib/mercuryAllocSave.ts` + tests (money + REPLACE semantics) |
| `sortMercuryRowsStable` (3-key stable sort, NaN-date ordering, id tiebreak) | module-level in `Banking.tsx` 166–190 | `lib/bankingMercuryRowSort.ts` + tests |
| `parseBankingView(params, role)` + `mercuryTabFromParam` | module-level in `Banking.tsx` 92–108, 138–164 | `lib/bankingViewRouting.ts` + tests (per-role defaults via `isStaffBankingRole`, legacy `invoices`/`data` → `ledger`, `user_review` alias) |
| Bucket-stats kernel (`buildBucketStats`, `cloneBucketStats`, `applyAssignmentDelta`, `addToLabeled`, `subtractFromLabeled`) | module-level in `BankingMercuryDragSortTab.tsx` 61–146 | `lib/bankingDragSortBucketStats.ts` + tests |
| `formatCurrency` / `formatDate` / `formatDateTime` / `formatMercuryCategory` | `BankingMercuryTable.tsx` (exported `formatCurrency`); private `formatCurrency` copies also in `MercuryTransactionAllocationsModal.tsx` 107–109, `MercuryTransactionInvoiceLinkModal.tsx`, `TransactionDetailModal.tsx` | shared lib — **check first**: `formatUsd` / `formatBankingDate` already exist in [`bankingMercuryDragSortLedger.tsx`](../src/components/banking/bankingMercuryDragSortLedger.tsx); consolidate rather than duplicate |
| `fetchAccountingPendingRuleNames` / `…LabelNames` / `…TxsByIds` (200-id chunked fetchers) | module-level in `BankingMercuryAccountingTab.tsx` 267–307 | `lib/fetchAccountingPendingRelations.ts` (IO helpers; test the chunk math) |
| "Other matching rules" annotation inside `runTestFromCriteria` (sort by `sort_order, id`; exclude editing rule; clause-count filter) | closure in `BankingMercuryAccountingTab.tsx` 1938–1951 | pure function + test (align with the existing `matchingAccountingRulesForTx.test.ts` parity test) |
| `saveRuleDraft` / `saveRuleDraftAndApply` shared INSERT/UPDATE block | duplicated inline 1961–2003 / 2005–2050 | one `persistAccountingRuleDraft` helper (de-dup, not a move — do alongside Stage B of the rules engine) |
| `tallyScheduleHeadings` (possessive / today-vs-that-day titles) | memo in `MercuryTransactionAllocationsModal.tsx` 369–422 | pure function + test |

---

## Preserve-quirks list (odd but load-bearing — do not "fix" during the move)

1. **`rows` means different things per view** (master list / unlabeled-only / keyset page window; nothing on Card Review and Visuals). Every consumer of `rows` must keep working under all shapes; `inputIsUnlabeledOnly` in the Accounting tab exists to skip redundant work when the parent pre-narrowed.
2. **`listLoadSeqRef` token discipline** — every loader bumps-then-checks; `loadLabeledNextPage` snapshots (doesn't bump) so a first-page refresh cancels in-flight appends. The Accounting tab mirrors this with `assignmentsLoadSeqRef` / `pendingLoadSeqRef`; **Drag Sort's `loadAssignmentsForList` has no token** (known asymmetry).
3. **`accountingPrefsHydrated` gate** — flips true after the localStorage read (378–383) so the dispatcher's first fetch uses the stored value, not the default. `user` resolves async, so a lazy `useState` read is impossible. When the server row (423–446) disagrees with the device, `hideLabeledTransactions` flips once more and the load effect (771–777) re-fires.
4. **Prefs dual-write protocol** — localStorage write is synchronous truth for this device; `banking_user_prefs` syncs cross-device; server values found on load are mirrored back into localStorage. Failure toasts "Saved here, but could not sync…".
5. **Silent refresh preserves scroll depth** — `loadLabeledFirstPage({silent: true})` requests `max(500, labeledLoadedCountRef.current)` rows (609) so a background refresh doesn't yank the user to page 1. The comments say "realtime", but no channel is subscribed in `Banking.tsx`; silent refreshes come from the Accounting tab's `onAfterAssignmentChange`. That keyset call passes `p_limit` without `.range()`, so past 1,000 loaded rows PostgREST's `max_rows` would plausibly cut it (the page's own comment at 547–551 says un-ranged RPCs are capped too).
6. **Excluded duplicates**: the Ledger *shows* `duplicate_of_transaction_id` rows struck-through for audit; `booksFilteredSorted` / `booksSortingFilteredSorted` exclude them from totals and from what Drag Sort / Accounting / Category Review receive.
7. **One `bankingSearchText` feeds three tabs** (Ledger, User Sort, Drag Sort), and `accountFilter`/`kindFilter` are shared between Ledger and Drag Sort — typed state carries across tab switches by design.
8. **Card Review and Visuals skip the master fetch** — `loadRowsForActiveView` early-returns (and clears `loading`) at 706–714; toggling to another tab pulls the full list.
9. **Auto-apply signature protocol** — `lastAutoAppliedSignatureRef` reset only by `autoApplyResetTick` (bumped after sync/backfill). The auto-*approve* protocol retired in v2.2889 — approval is server-side behind the org switch (`auto_approve_pending_accounting_label_suggestions`, called by `bulk_insert_accounting_label_suggestions` and `mercury-webhook`); the tab only reads/flips the switch.
10. **Caps are behavioral, not just perf**: `APPLY_RULES_PER_CLICK_CAP = 500`, `APPLY_RULES_CONFIRM_THRESHOLD = 200`, `APPROVALS_PAGE_SIZE = 50`, `GROUP_BULK_CONFIRM_THRESHOLD = 25` (via `confirmDialog`, not `window.confirm`), `REJECT_CHUNK` / `APPROVE_CHUNK = 500`, `INSERT_CHUNK = 2000` (the RPC raises above 2000), `ACCOUNTING_PENDING_ID_IN_CHUNK_SIZE = 200` (HTTP/2 header-limit fix), `DEBIT_CARD_RECENT_TX_CAP = 50`, Drag Sort assignment batches of 400, quick-label undo depth 2.
11. **Internal Transfers × job splits are mutually exclusive**, enforced in five places: `handleQuickAssignLabel` (1206), `handleApprove` (1373), `approvePendingItems` via `conflictSuggestionIds` (same kernel as the server auto-approver), Drag Sort's `applyDragSortAssignment`, and the allocations modal's lock probe (568–599; blocks add, Save and the invoice link). Keep all five.
12. **Two assignment-load strategies for the same table**: Accounting (and Visuals) each do one **paged** whole-table read (`fetchAllRows`, ordered by `mercury_transaction_id`); Drag Sort chunks 400-id `.in()` batches. Both intentional at their row scales — don't unify during a move. Never reintroduce a bare `.limit(N)` on these tables. One un-ranged read remains: `computeApplyRulesPreflight`'s pending-id select (1705–1707). Writes stay correct (the insert RPC has `ON CONFLICT (mercury_transaction_id) WHERE status = 'pending' DO NOTHING`), but past 1,000 pending rows the preflight count, confirm threshold and 500 cap can be spent on rows that are already pending.
13. **Per-row optimistic rollback** (not snapshot restore) in `clearRowDragSortLabel` / `applyDragSortAssignment` — a failed request restores only that tx so concurrent edits survive.
14. **Apply rules / rule test scan Banking-filtered rows only** — not the Accounting search, More filters, or Hide-labeled slice (comments at 1719 and 1929).
15. **Overlaps↔Edit-rule z-index dance** — audit modal (z 1250) hides itself before opening Edit Rule (z 1200, which spawns Test results at 1250); `auditPendingReopenAfterRuleModalRef` + the `ruleModalOpen` watcher effect (1917–1924) reopen the audit on any close path. Other layers: category tags 1150, backfill prompt 1300, allocations modal 1150.
16. **`ledgerShowDrag = false`** (2090) hardcoded in the Accounting tab — the shared `bankingMercuryDragSortLedger` row family renders without drag handles there, with them in Drag Sort.
17. **Org switches are UPDATE-only on migration-seeded `app_settings` rows**; a missing AR row means "not live" (switch shown disabled); flips are optimistic with rollback; only dev / master_technician flip them.
18. **Sorting config is role-forked**: dev loads a per-user saved config (`loadBankingSortingConfig`); staff always get `defaultBankingSortingConfig()` fresh (357–366).
19. **`handleSync` hardcodes `lookback_days: 90`**; the 1-year+ path is the Backfill modal.
20. **`ruleModalMountKey`** — the rule form remounts (`key` bump) on every open so stale draft state can't leak between rules.
21. **Debit-card keys are lowercased** on read and write (`String(id).toLowerCase()`), including the `?cards=` value (1056).
22. **Attribution precedence differs by writer, on purpose**: a rule's person (approve 1400–1412, backfill 997–1036) uses `ignoreDuplicates` so a hand-set person wins; quick-assign (`writeQuickAttribution`) and the allocations modal overwrite.
23. **The allocations modal re-seeds from the DB and guards Save** on staff paths (dossier above); tally paths keep the prop seed. Never feed its REPLACE from the parent's page maps.
24. **One Escape closes two layers**: the allocations modal (document listener, 1000–1010) and the nested `MercuryTransactionInvoiceLinkModal` (window listener) both close on the same keypress — neither has the one-layer guard. Fix as its own change, not during a move.
25. **`runAttributionBackfill` doesn't patch the parent** (no `onAttributionChange`, no reload) — the Person column stays stale until the next `loadMercuryAllocations` (any `rows` change or reload).

---

## Recommended extraction order (value ÷ risk)

1. **Stage-A sweep** — the [inventory](#stage-a-pure-logic-inventory) above; each independently shippable. Highest leverage now: (a) point the allocations modal at `mercurySplitMath` (deletes ~70 lines of untested money math in favour of the tested twin, zero behavior change); (b) the modal's save kernel (attribution ladder + signed rows) with tests; (c) `sortMercuryRowsStable` + `parseBankingView`/`mercuryTabFromParam`; (d) the Drag Sort bucket-stats kernel.
2. ~~**In-file component file moves**~~ — **done (v2.1304)**: `BankingMercuryTable` (+ `SortTh` + `TransactionDetailPanel`) → [`src/components/banking/BankingMercuryTable.tsx`](../src/components/banking/BankingMercuryTable.tsx); `BankingNicknamesMenu` + `BankingLedgerAdvancedMenu` → own files. Verbatim moves, ~924 lines off `Banking.tsx` (3,104 → 2,180), zero state relocation.
3. **Extract `sorting` → `BankingMercurySortingTab`** — lowest-coupling inline tab (writes two shared states, `bankingSearchText` and `expandedRowId`; everything else goes through callbacks); simpler since v2.2750 (no card-link modal to carry). Validates the prop seam (like `po-generator` did for Materials / `bid-costs` for Bids).
4. **Extract `ledger` → `BankingMercuryLedgerTab`** — sync/backfill/import handlers + their modals stay parent-owned, opened via callbacks.
5. **Peel Accounting Region D (org switches)** → `useOrgSettingSwitch` + `AccountingOrgSwitches` — ~160 logic lines that touch no label/assignment state, in the file's newest and hottest code (v2.3514). Also lift the inline Test-results modal (2810–2872) and backfill prompt (2740–2775) to files — pure JSX moves.
6. **Seam hooks in the parent** — `useBankingMercuryTransactions`, `useBankingMercuryRelations` (with `patchAttribution`), `useBankingNicknames`, `useBankingAccountingPrefs`. Parent destructures; child props unchanged. Compression, not relocation — the hooks stay mounted in `Banking()`.
7. **Allocations modal Stage B** — `useTallyDayContext` + panel, then `useMercuryAllocSeed`; after step 1(a)/(b) so the money math is tested first. Nine callers: verify each mode (staff, tally, tally-on-behalf) by hand.
8. **Sub-decompose the rest of `BankingMercuryAccountingTab`** — first the cluster seam `useAccountingLabelsAndAssignments` (labels + assignment map + loaders + mutators), then `useRulePersonAttribution` (Region E), then `useAccountingRulesEngine`, then `useAccountingApprovals` + `AccountingApprovalsSection` / `AccountingSortingLedgerSection`. Do this **last** — highest-churn file (18 commits in 90 days), and the auto-apply protocol plus the `onAfterAssignmentChange` / `onAttributionChange` callbacks span the parent boundary.
9. **Optional Drag Sort cleanups** — add-label modal → own file; seq-token adoption for `loadAssignmentsForList` as a separate reviewed change.

### What must STAY in the parent (`Banking.tsx`)

- The **URL router**: `parseBankingView`, `setMercurySubTab`/`setStripeSubTab`/`setBankingProduct`, the role redirect + staff param normalization + legacy-alias rewrite + `?cards=` door effects.
- The **data engine + relation + nickname caches** (as hooks per step 6) — consumed by 6 tabs (all but Reconciliation and Visuals) and 5 page modals, and patched in place by the Accounting tab's `onAttributionChange`.
- The **accounting prefs cluster**, including `hideLabeledTransactions` (it selects the parent's loader) and `autoApplyResetTick` (bumped by parent sync handlers, consumed by the child effect).
- `handleSync` / `handleBackfill` / `handleImportCsv` and their modals (completion must reload parent caches + bump the tick).
- **All shared modals**, especially `MercuryTransactionAllocationsModal` + `openAllocModalForMercuryRow` (opened from four tabs) and the Debit cards modal + `BankingDebitCardRecentTxModal` (opened from both nickname menus and the `?cards=` door; the recent-tx modal reads `rows`).
- `expandedRowId` (shared by Ledger + User Sort tables) and the shared filter/search state (`bankingSearchText`, `accountFilter`, `kindFilter`).

Definition of done per region, verification gates, and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) (`npm run typecheck && npm run lint && npm test` green after every step; behavior-preserving only).
