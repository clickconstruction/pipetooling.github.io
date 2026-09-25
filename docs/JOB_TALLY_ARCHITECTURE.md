# Job Tally Architecture Map

---
file: docs/JOB_TALLY_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the JobTally.tsx decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md) — inventory what each tab of the 2,403-line src/pages/JobTally.tsx touches (state, loaders, handlers, memos, supabase tables/RPCs, page-level modals, cross-tab coupling, test coverage) so extraction can proceed without re-deriving the strategy.
covers:
  - src/pages/JobTally.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-25
---

## What this surface is

[`src/pages/JobTally.tsx`](../src/pages/JobTally.tsx) is the **Job Parts Tally** page, routed at `/tally` (lazy-loaded in `App.tsx`, `<Route path="tally" element={<JobTally />} />`; `App.tsx` is its only importer). It is a **mobile-first** surface (`maxWidth: 480`, `TOUCH_MIN = 48` touch targets) used by field crews and, for the payroll cluster, by devs and payroll-access users.

> **Line numbers are as of `a05cef4c4`** (the `mapped_at` commit) and drift with every edit — search the symbol named beside each range. Regenerate the fact sheet with `npm run map -- src/pages/JobTally.tsx`.

Current shape: **2,403 lines** (2,330 at the 2026-07-29 map) — one default-export component `JobTally` (223–2403; render 856–2402, 1,547 lines) plus module scope 43–221 (types, 2 mini-components, 5 functions). Hook census (fact sheet): **50 `useState`** (48 in `JobTally` + `hover`/`focus` in `TallyPostedDateOpenButton`), **12 effects, 9 `useMemo`, 6 `useCallback`, 1 `useRef`, 6 custom hooks** (`useAuth`, `useToastContext`, `useSearchParams`, `usePeopleAccess`, `useOrgDefault`, `useTallyUnlinkedCounts`). `JobTally`'s 48 states split **26 Transactions / 14 Materials / 8 parent**. Compared to the repo's other God components this is a *small* one, and much of its pure logic is **already extracted** to `src/lib/*` (see [Stage-A inventory](#stage-a-pure-logic-inventory)) — the remaining work is mostly Stage B, but several extracted kernels that decide the unlinked counts have **no tests** (see [Test coverage](#test-coverage)).

The page is tab-switched on a single `activeTab` state; the type union is `JobTallyTab` (61):

```
'materials-estimate' | 'transactions'
```

URL slugs differ from state keys: `?tab=transactions` ↔ `'transactions'` (the default; any other/missing value is rewritten to it with `replace: true`), `?tab=materials` ↔ `'materials-estimate'`. **Transactions** is the landing tab: sort/allocate linked Mercury debit-card purchases to jobs. **Materials Estimate** is the original tally flow: pick a job, tally fixture parts, "Send to Office" (insert + auto-PO).

**Mobile Sort mode (v2.1542):** for `isSubcontractorLikeRole(role)` the Transactions tab renders [`TallySortModeCardList`](../src/components/tally/TallySortModeCardList.tsx) (1307–1320; props `rows={tallyTxSorted}`, `unlinkedCount`, `jobLabelById`, `onStartSort`, `onOpenAllocations`, `onSaveMyNote={saveTallyUserNoteForCard}`) instead of the table, and [`TallySortPurchaseModal`](../src/components/tally/TallySortPurchaseModal.tsx) (2315–2328; one-purchase-at-a-time sorting: day jobs from `lib/tally/fetchSortModeDayJobs` = clock sessions ∪ schedule blocks posted±1; split math kernel `lib/tally/sortModeSplit`; saves via RPC `replace_mercury_job_splits_for_my_linked_card`). Office/dev keep the table. Both components are Transactions-cluster members and move with the tab.

### Key structural facts

1. **The two tabs are almost fully independent.** No `setSharedX`, no record id is URL-synced (only `?tab=`). The only genuinely shared substrate is the **`jobs` cache** (see [Shared substrate](#shared-substrate)).
2. **Six page-level modal wirings render outside both tab blocks** (2292–2400; not tab-gated — three sit behind `authUser?.id` / `isDevTally` / `canMarkPayroll`), and **all six are opened only from Transactions** (rows, chips, Sort-mode cards) — they are transactions-cluster members, not cross-tab modals, and move with that tab.
3. **A payroll sub-cluster** lives inside the Transactions tab (v2.641) with **two gates** since v2.2946: *Mark payroll* follows `canMarkPayroll` (dev ∪ payroll access); *payroll rules*, auto-apply and the flag merge stay `role === 'dev'`. The split is incomplete — see [gate-split defects](#dev-payroll-sub-cluster-inside-transactions). Its pure kernels are in `lib/` with tests.
4. **External consumers share this page's data path**: `ClockInOutButton`'s pre-clock-out gate calls the same RPCs (`list_my_linked_mercury_transactions_for_tally`, `list_my_linked_mercury_debit_cards_for_tally`), and it and `TallyPreClockOutModal` use the same `lib/mercuryTxRowFromTally.ts` helpers. The Dashboard / Quickfill "purchases need a job" card reads [`useTallyUnlinkedCounts`](../src/hooks/useTallyUnlinkedCounts.ts) (RPCs `count_unlinked_mercury_transactions_for_tally` + `…_stale`), and **since v2.2896 this page reads the same hook** for its header gloss. Extractions keep using the shared lib/hook, never fork them.

### How to read a dossier

Each section lists: render location (lines as of `a05cef4c4` — search the symbol), **owned local state** (moves with the region), **cross-tab/shared state** (stays in the parent), **derived memos**, **handlers/loaders**, **supabase tables/RPCs**, **sub-components** (extracted vs inline), **external coupling**, **tests**, and **extraction status + risk + approach**.

---

## Master summary table

| Region | Anchor (symbol) · lines at a05cef4c4 | Lines | Status | Coupling | Tests | Risk | Recommended action |
|---|---|---|---|---|---|---|---|
| Module-level helpers | types 43–62; `TallyPostedDateOpenButton` 65–113, `formatLinkedCardDisplayLabel` 115–120, `tallyCardFilterChipButtonStyle` 122–139, `tallyJobsSubRowBannerStyle` 141–151, `sortTallyRowsStable` 153–179, `TallySortTh` 181–214, `tabStyle` 216–221 | ~179 | in-file | low (pure + 2 mini-components; all but `tabStyle` are Transactions-only) | none | low | Stage A: `sortTallyRowsStable`, `formatLinkedCardDisplayLabel` → `lib/tally/*` + tests; mini-components + styles ride with Transactions |
| Parent shell (role, auth, URL router, loaders, header, tab bar) | hooks 224–229; effects role 583–589, `?tab=` router 621–640, jobs 642–674, `myJobIds` 676–683, service types 685–701; `role == null` gate 850–852; header 856–892; tab bar 894–932 | ~180 | stays | — | route access only | — | Permanent parent |
| **Transactions tab** | `activeTab === 'transactions'` 934–1827 + logic 230–256, 277–581, 591–615 | ~1,250 (+ ~109 modal wiring) | inline | low external / high internal (26 state + ref, 9-memo pipeline, 6 effects, 5 callbacks, 3 custom hooks) | partial — see [coverage](#test-coverage) | med | Extract as `TallyTransactionsTab` **with its 6 modal wirings**, after Stage A + the row seam |
| ↳ payroll sub-cluster | state 235–249; `canMarkPayroll` 232–233; `useOrgDefault` + effect 251–256; flag merge 347–374; `setTallyPayrollFlag` 386–404; `applyPayrollRules` 406–460; auto-apply 464–475; chips 1039–1051, 1054–1062; row banner 1685–1730; modals 2348–2400 | ~260 (in tab) | inline | two gates (dev / payroll access); kernels in `lib/` | kernels tested; chip Σ + modals untested | med | Moves inside the Transactions tab (R1/R2 fixed v2.3837) |
| ↳ Sort mode (sub-like roles) | state 287–289; `saveTallyUserNoteForCard` 306–328; card list 1307–1320; `TallySortPurchaseModal` 2315–2328 | ~55 (in page) | extracted components, inline wiring | reads `tallyTxSorted`, `tallyJobLabelById`, `tallyUnlinkedCountInScope` | both components render-tested; `sortModeSplit` tested | low | Rides with Transactions |
| **Materials Estimate tab** | `activeTab === 'materials-estimate'` 1829–2290 + state 261–275, `searchParts` 703–732 … `handleSave` 793–848 | ~620 | inline | low (reads parent-held `jobs`/`jobsLoading`/`myJobIds`/`role`/`selectedServiceTypeId`; writes shared `error`; parent writes its `selectedJobId` default + clears `partResults`/`partSearch`) | **none** | low | **Extract first** → `TallyMaterialsEstimateTab`; Stage A the PO-save kernel; keep it mounted across tab switches (quirk 19) |
| Page-level modal wirings | 2292–2400 | ~109 | extracted components, inline wiring | opened only from Transactions | see modal table | low | Move wiring into `TallyTransactionsTab` when it extracts |

---

## Shared substrate

**There is no shared selection pointer and no shared data engine between the two tabs.** No `setSharedX`, no `?id=` deep link, no cross-tab record selection. What the tabs actually share:

- **`jobs` + `jobsLoading`** — loaded once by the `[role]` effect (642–674; RPC `list_jobs_for_tally` for subcontractor-like roles, direct `jobs_ledger` SELECT otherwise). `jobs` is used by the Materials tab's job picker **and** by the Transactions tab's `tallyJobLabelById` memo (482–501), whose map feeds three consumers: the search memo (548), `TallySortModeCardList` (1313) and `MercuryTransactionAllocationsModal` (2337); `jobsLoading` is read only by Materials. (Split-banner labels come from `tallyUniqueJobSplitEntries(row.job_splits)`, not this map.) **This loader and cache stay in the parent**, passed to both tabs.
- **`role` / `isDevTally` / `authUser`** — role gates the jobs-load path, the "Show my jobs only" checkbox, card-vs-table rendering on Transactions, and the dev half of the payroll cluster. `usePeopleAccess(authUser?.id)` (232) feeds only `canMarkPayroll` — Transactions-owned.
- **`activeTab` + the `?tab=` URL router** (parent, permanent). Neither tab is mount-gated today (quirk 19).

Everything else is single-tab. **What this means for extraction:** each tab can come out nearly independently with a thin prop surface (`jobs`, `jobsLoading`, `role`, `authUser?.id`, plus per-tab bits below). No `use<Page><Engine>` seam hook is needed at the parent. The Transactions data engine (`loadTallyTransactions` + `tallyTxRows` + payroll sets + the 9-memo pipeline + `useTallyUnlinkedCounts`) is consumed only by that tab and its modals, so it moves wholesale into `TallyTransactionsTab` rather than becoming a parent hook.

One judgment call: `serviceTypes`/`selectedServiceTypeId` state is parent-level and its `<select>` renders in the **page header** (864–890) — but it is *gated to the Materials tab* and only Materials logic (`searchParts`) reads it; its `onChange` also clears Materials-owned `partResults` + `partSearch`. Recommended: keep state + header select in the parent, pass `selectedServiceTypeId` down, and have the tab clear its part search when the id changes from one non-null value to another. **Do not key the tab by `selectedServiceTypeId`** — a remount also wipes `entries`, `fixtureName` and `selectedJobId`, which the current `onChange` leaves intact.

---

## Per-region dossiers

### Module-level helpers (above the component, 43–221)

- **Types:** `TallyLinkedDebitCardRow` (generated RPC Returns type), `TallyTxSortKey` (`'posted_at' | 'amount' | 'counterparty_name'`), `JobForTally`, `ServiceType`, `MaterialPart`, `TallyEntry` (49–57), `JobTallyTab`, `TallyTxScope` (`'all' | 'unlinked'`); const `TOUCH_MIN` (59).
- **Pure functions:** `formatLinkedCardDisplayLabel(card)` (115–120; nickname, else `Card <first-8>…`), `tallyCardFilterChipButtonStyle(active)` (122–139), `tallyJobsSubRowBannerStyle(allocated)` (141–151), `sortTallyRowsStable(list, sort)` (153–179; comparator per key; counterparty haystack = `counterparty_name + note + tally_user_note` lowercased; **stable tiebreak on `mercury_transaction_id`**), `tabStyle(active)` (216–221; wraps shared `pageTabStyle`). `formatTallyCurrency` / `formatTallyPostedParts` now live in `lib/tally/formatTallyPosted.ts` (v2.1542).
- **Mini-components:** `TallyPostedDateOpenButton` (65–113; `hover`/`focus` state; opens the clock-window allocate modal), `TallySortTh` (181–214; presentational `aria-sort` header cell).
- **Tests:** none.
- **Extraction:** the pure functions are Stage-A candidates (see [inventory](#stage-a-pure-logic-inventory)); the two mini-components and both style helpers are Transactions-only and move into `TallyTransactionsTab` (or a `components/tally/` sibling file). `tabStyle` stays with the parent tab bar.

### Parent shell — role, auth, URL router, header, tab bar (stays)

- **State (8):** `activeTab` 227, `role` 228 (+ derived `isDevTally = role === 'dev'` 229), `serviceTypes` 257, `selectedServiceTypeId` 258, `jobs` 259, `jobsLoading` 260, `error` 273 (see quirk 9), `myJobIds` 276.
- **Hooks:** `useAuth` 224, `useToastContext` 225 (only Transactions calls `showToast` — the tab can read the context itself), `useSearchParams` 226.
- **Effects (5):** role load (`users.role` SELECT by `authUser.id`, 583–589); `?tab=` router (621–640 — normalizes unknown values to `transactions` with `replace: true`); jobs load keyed on `[role]` (642–674 — RPC vs table path, default-selects first job into `selectedJobId`); `myJobIds` load (`jobs_ledger_team_members` SELECT by `user_id`, 676–683); `service_types` load ordered by `sequence_order` with **Plumbing-by-name default**, keeping a still-valid previous id (685–701).
- **Supabase:** `users` (SELECT role), `jobs_ledger` (SELECT id/hcp_number/job_name/job_address), RPC `list_jobs_for_tally`, `jobs_ledger_team_members` (SELECT), `service_types` (SELECT).
- **JSX kept:** `role == null` loading gate (850–852), `selectedJob` (854, render-computed `jobs.find`), page container (857), `← Dashboard` link, `Job Parts Tally` header + Materials-gated service-type `<select>` (858–892; select 864–890), tab-button bar writing `?tab=` (894–932).
- **Tests:** none for the page; `/tally` appears only as a path string in nav/route tests (`layoutRouteAccess.test.ts`, `dashboardPinnedRow.test.ts`, `navClickTelemetry.test.ts`, `pinnedTabs.test.ts`, and `payWeekLinks.test.ts`'s `TALLY_PAYROLL_HREF` = `/tally?tab=transactions`). No e2e spec visits `/tally`; no `JobTally.render.test.tsx`.
- **Note:** the RPCs feeding this page already return the effective ledger number in `hcp_number` (since migration `20260619160000`) — the v2.963 `effectiveJobLedgerNumber` sweep deliberately left JobTally alone. That holds for the sub-like `list_jobs_for_tally` path only; the office/dev path is a direct `jobs_ledger` SELECT of the raw `hcp_number`, so a blank HCP shows `—` in the job picker there (1887, 1943). Don't "fix" the raw `hcp_number || '—'` display sites during extraction.

### `transactions` — Transactions tab

- **Render location:** `activeTab === 'transactions'` block (934–1827): count line (958–1002, incl. the Dashboard-card gloss 990–994) + `Show all`/`Show unlinked` scope chips (1013–1038) + dev `Payroll rules` chip (1039–1051); payroll chip (1054–1062); card-filter chip row (1063–1158); `tallyTxError` (1159–1161); empty-state ladder (1162–1220, 5 messages); search input (1222–1282); search-empty branch (1283–1305); then **either** `TallySortModeCardList` for sub-like roles (1307–1320) **or** the table (1322–1821: `TallySortTh`×3 1331–1337; row map `tallyTxSorted.map` 1339–1818, each row a `<Fragment>` of main row 1408 + optional personal-memo editor row 1533 + job-splits banner row 1646–1815).
- **Owned local state (26 + 1 ref, moves with the tab):** `tallyTxRows`, `linkedDebitCards`, `tallyTxLoading`, `tallyTxError`, `tallyTxSort` (`{key, dir}`, default `posted_at desc`), `tallyAllocModalRow`, `tallyClockAllocateRow`, `tallySortModeOpen`, `tallySortModeStartTxId`, `tallyJobDrilldown` (`{jobId, label} | null`), `tallyDebitCardFilterId`, `tallyTxScope` (default `'unlinked'`), `tallyTxSearchQuery`, `tallyOpenNoteTxId`, `tallyOpenUserNoteTxId`, `tallyUserNoteDraft`, `tallyUserNoteSaving`, `tallyUserNoteError`, `tallyGlobalMinPostedYmd` (277–304); payroll cluster: `payrollFlaggedIds`, `payrollDecidedIds`, `payrollRulesModalOpen`, `pendingPayrollTx`, `payrollMarkBusy`, `payrollRulesSeed`, `payrollAutoApply` (lazy-init from localStorage `jobs-tally-payroll-autoapply`) (235–249), ref `payrollAutoApplySigRef` (464).
- **Owned custom hooks (move in):** `usePeopleAccess(authUser?.id)` → `canMarkPayroll = canMarkTallyPayroll({isDev, canAccessPay})` (232–233); `useOrgDefault('tally.payroll_auto_apply', role, readDeviceString('jobs-tally-payroll-autoapply'))` (251); `useTallyUnlinkedCounts(Boolean(authUser?.id))` → `tallyCardCounts` + `refetchTallyCardCounts` (295–296).
- **Cross-tab/shared state (stays in parent):** `jobs` (via `tallyJobLabelById`), `role`/`isDevTally`, `authUser?.id`, `activeTab` (load-effect gate).
- **Derived memos (9 memos in an 8-stage pipeline, 477–555 — preserve the order):** `tallyTxRowsGlobalFiltered` 477–480 (min-posted-YMD floor via `mercuryRowPassesSortingStartDate`) → `tallyJobLabelById` 482–501 (jobs cache **merged with** job-split entries found on rows, so labels exist for jobs outside the caller's list) → `tallyNicknameByDebitCard` 503–511 / `tallyNicknameByAccount` 513–524 → `tallyTxRowsFiltered` 532–535 (card filter) → `tallyUnlinkedCountInScope` 537–540 (`!tallyRowIsResolved(r)`) → `tallyTxRowsForTable` 542–545 (scope filter) → `tallyTxRowsForSearch` 547–550 (`filterTallyLinkedMercuryRowsBySearchQuery`) → `tallyTxSorted` 552–555 (`sortTallyRowsStable`). Plus the inline payroll-chip IIFE (1056–1060: count + `Σ|amount|` of `is_payroll` rows in `tallyTxRowsFiltered`).
- **Handlers/loaders (5 callbacks + 2 row closures):** `saveTallyUserNoteForCard` (307–328; Sort-mode card memo save, returns an error string, empty clears), `loadTallyTransactions` (330–384; calls `refetchTallyCardCounts()` first; parallel RPC pair; dev-only merge of `mercury_tally_payroll_flags` 347–374 — **whole-table fetch by design**, quirk 1 — mutating `r.is_payroll` onto rows before `setTallyTxRows`), `setTallyPayrollFlag(txId, isPayroll)` (386–404; RPC + reload + toast; never throws), `applyPayrollRules({silent})` (406–460; dev-only; loads enabled `mercury_tally_payroll_rules`, runs `buildTallyPayrollRuleFlagsToInsert` with `decidedTxIds` + `txIdsWithJobSplits`, bulk RPC, reload, toast with skipped-split count), `setTallyTxSortForColumn` (526–530), and the **row-closure** async fns `saveMyNote` (1362–1383) / `clearMyNote` (1384–1405), defined inside `tallyTxSorted.map` — same RPC + optimistic patch as the card callback, but driving the shared draft/saving/error state.
- **Effects (6):** org-default → `payrollAutoApply` (252–256); payroll auto-apply (465–475 — fires `applyPayrollRules({silent:true})` when the sorted-undecided-id signature changes); card-filter self-heal (557–564); load-on-activate (566–569, `activeTab === 'transactions' && authUser?.id`); Escape-closes-note-panels window listener (571–581); `app_settings` min-posted-YMD read-once (591–615 — `APP_SETTINGS_KEY_JOB_TALLY_MIN_POSTED_YMD` + `normalizeJobTallyMinPostedYmd`; removed-listener comment 617–619).
- **Supabase tables/RPCs:** RPC `list_my_linked_mercury_transactions_for_tally`, RPC `list_my_linked_mercury_debit_cards_for_tally`, `mercury_tally_payroll_flags` (SELECT, dev), `mercury_tally_payroll_rules` (SELECT enabled, dev), RPC `set_tally_payroll_flag`, RPC `bulk_apply_tally_payroll_rule_flags`, RPC `upsert_mercury_tally_transaction_note`, `app_settings` (SELECT one key); via `useTallyUnlinkedCounts`: RPCs `count_unlinked_mercury_transactions_for_tally` + `count_unlinked_mercury_transactions_for_tally_stale`. Page loads wrapped in `withSupabaseRetry`.
- **Sub-components:** `TallySortTh`, `TallyPostedDateOpenButton` (module-level, ride along); `MercuryTransactionNoteIcon`, `TallySortModeCardList` (extracted). The table row body (1339–1818, ~480 lines) is a large inline map — the natural inner seam is a `TallyTransactionRow` component.
- **External coupling:** the six page-level modals below; `showToast`; localStorage `jobs-tally-payroll-autoapply` + org-default key `tally.payroll_auto_apply`; `useTallyUnlinkedCounts` (shared with `DashboardPinnedQuickRow` + `QuickfillNeedsYouSection`); `ClockInOutButton` gate uses the same RPCs/lib (DB-level coupling only — no shared client state).
- **Extraction status + risk + approach:** Inline. **Medium risk** — biggest region (the tab alone would be ~1,500 lines with its helpers and modal wiring), but its coupling is internal. Approach: Stage A the remaining pure helpers + tests; extract `TallyTransactionRow` (table path only); then move the whole tab + its six modal wirings + three custom hooks into `src/components/tally/TallyTransactionsTab.tsx`. Props from parent: `authUserId`, `role` (derive `isDevTally` / `isSubcontractorLikeRole` inside), `jobs` (the label memo also reads rows, so build the map inside), and an `active` flag (`activeTab === 'transactions'`) when it stays mounted, since the load-on-activate effect (566–569) reads `activeTab`; `showToast` from context. Keep it mounted while hidden, or accept the filter/search/sort reset on tab switch explicitly (quirk 19).

### Dev payroll sub-cluster (inside Transactions)

Kept as its own dossier entry because it has distinct tables, two gates and test-covered kernels, but it is **not separable** from the Transactions tab — its state feeds `tallyRowIsResolved` display logic and the row banners.

- **UI:** `Payroll rules` chip (1039–1051), `Payroll: N · $X` reconciliation chip (1054–1062), per-row `Mark payroll` button (1685–1705) + `Payroll ✓ / Unmark` banner (1706–1730), `TallyPayrollRulesModal` (2348–2369) + `TallyMarkPayrollConfirmModal` (2370–2400; `onCreateRule` seeds the rules modal via `buildPayrollRuleSeedFromTransaction`).
- **Gates (v2.2946):**

  | Piece | Gate | Lines |
  |---|---|---|
  | Mark payroll button, `Payroll ✓ / Unmark` banner, payroll chip, `TallyMarkPayrollConfirmModal` | `canMarkPayroll` (dev ∪ `canAccessPay`; `lib/people/payWeekLinks.ts`) | 233, 1685, 1706, 1054, 2370 |
  | `Payroll rules` chip, `TallyPayrollRulesModal`, `applyPayrollRules`, auto-apply effect | `isDevTally` / `role === 'dev'` | 1039, 2348, 408, 466 |
  | Flag merge (`payrollFlaggedIds`, `payrollDecidedIds`, `r.is_payroll`) | `role === 'dev'` | 348 |

  Server side, `set_tally_payroll_flag` and the `mercury_tally_payroll_flags` RLS policy moved to `has_payroll_access()` in migration `20260906130000`; rules and `bulk_apply_tally_payroll_rule_flags` stay dev-only.
- **Gate-split defects (found while mapping at a05cef4c4; each fix changes behavior — ship it as its own PR, never inside a move):**
  - **R1 — the flag merge follows `canMarkPayroll` (fixed v2.3837).** It was dev-only (348): for a controller or pay-approved master `is_payroll` never merged, so after *Mark payroll* the row stayed under "Show unlinked" with its button, the `Payroll ✓` banner and payroll chip never rendered, and `N unlinked` ran above the Dashboard card. The loader's deps carry `canMarkPayroll` instead of `role`.
  - **R2 — "Create rule…" is a dev's button (fixed v2.3837).** `TallyMarkPayrollConfirmModal`'s `onCreateRule` is optional and the page passes it only under `isDevTally`; before, the button closed the confirm and opened nothing for non-devs (the rules modal mounts only for a dev, 2348).
- **Invariants (server-enforced, mirrored client-side):** a tx with job splits cannot be marked payroll (`set_tally_payroll_flag` raises; `blockedByJobSplits` routing in the kernel); manual mark/unmark always wins over rules via tombstone rows (`payrollDecidedIds` = every flag row, marked or tombstoned — rules never re-touch decided ids).
- **Auto-apply default (v2.2951):** `payrollAutoApply` lazy-inits from the device key; the org/role default from `useOrgDefault` overrides it only when this device has not chosen (effect 252–256 returns early for `source === 'device' | 'fallback'`). The rules modal's toggle writes the device key (2356–2363).
- **Already-extracted logic + tests:** `buildTallyPayrollRuleFlagsToInsert` + `TallyPayrollRuleForMatch` in [`lib/tallyPayrollRules.ts`](../src/lib/tallyPayrollRules.ts) (`tallyPayrollRules.test.ts`), `buildPayrollRuleSeedFromTransaction` in [`lib/tallyPayrollRuleSeed.ts`](../src/lib/tallyPayrollRuleSeed.ts) (`tallyPayrollRuleSeed.test.ts`), `canMarkTallyPayroll` in [`lib/people/payWeekLinks.ts`](../src/lib/people/payWeekLinks.ts) (`payWeekLinks.test.ts`), `orgDefaultBool` (`orgDefaults.test.ts`). **Untested:** the payroll chip's `Σ|amount|` (money, inline IIFE 1056–1060) and both payroll modals.

### `materials-estimate` — Materials Estimate tab

- **Render location:** `activeTab === 'materials-estimate'` block (1829–2290): `error` banner (1831–1833), `Parts saved.` banner (1835–1851), Step 1 job picker (1853–1962: button + bottom-sheet overlay, `role="dialog" aria-modal` at 1906, "Show my jobs only" checkbox for non-sub-like roles 1951–1960), then under `selectedJob` (1965–2288): Step 2 fixture-name input with "send this item to the office" link (1967), Step 3 part search + results (2009), Step 4 quantity stepper + Add/Cancel (2065), entries list + "Send to Office" save button (2164–2286). Plus the header service-type `<select>` (parent header JSX, gated to this tab).
- **Owned local state (14, moves with the tab):** `selectedJobId`, `fixtureName`, `partSearch`, `partResults`, `partSearching`, `selectedPart`, `quantity`, `entries` (`TallyEntry[]`), `saving`, `saved`, `lastSaveHadPartEntries`, `poCreateError`, `jobPickerOpen`, `showMyJobsOnly` (261–275, minus `error` 273). Caveat: the parent jobs-load effect default-selects into `selectedJobId` (653–655, 669–671) — if the state moves, the default-select moves too (watch `jobs`), noting quirk 7. The header service-type `onChange` (870–875) also clears `partResults` + `partSearch` — the tab takes that over per [Shared substrate](#shared-substrate).
- **Parent-held state (stays in parent):** `jobs` (shared with Transactions); `jobsLoading`, `myJobIds` (read only by this tab, but written by the parent loaders 642–674 / 676–683 — they may move in with those loaders); `role` (job-load path + "Show my jobs only" visibility via `isSubcontractorLikeRole`), `serviceTypes`/`selectedServiceTypeId` (header select; changing it clears `partResults` + `partSearch`), `error`/`setError` (see quirk 9), `authUser?.id`.
- **Derived values:** `selectedJob` (plain `jobs.find`, 854 — used by this tab's JSX; keep parent or recompute in tab), filtered picker list inline (`showMyJobsOnly && myJobIds ? jobs.filter(...) : jobs`).
- **Handlers:** `searchParts(term)` (703–732; useCallback on `[selectedServiceTypeId]`; `material_parts` ILIKE-or across name/manufacturer/notes, `.limit(30)`), 300ms debounce effect (734–737), `addEntry` (739–760; whole-number qty floor 1; resets part-picker state), `removeEntry` (762–764), `adjustEntryQuantity` (766–772; skips `isFixtureSent` rows), `sendFixtureToOffice` (774–791; pushes a part-less entry with `isFixtureSent: true`), `handleSave` (793–848 — the meaty one: bulk INSERT into `jobs_tally_parts` with `sequence_order` = index and `part_id: null` for sent fixtures; then RPC `create_po_from_job_tally` for part entries; back-fills `purchase_order_id` onto the inserted rows by **index-aligning `entries` with the returned `inserted` ids** (825–833); PO failure sets `poCreateError` but the save still succeeds and clears the form).
- **Supabase tables/RPCs:** `material_parts` (SELECT), `jobs_tally_parts` (INSERT + UPDATE `purchase_order_id`), RPC `create_po_from_job_tally`. (Job/service-type loads are parent-owned, above.)
- **Sub-components:** none extracted; job-picker bottom sheet and quantity stepper are inline.
- **External coupling:** none beyond the shared caches. RLS quirks live server-side (subcontractor INSERT policy on `jobs_tally_parts` depends on `jobs_ledger_team_members` SELECT — v2.58 fix).
- **Tests:** **none** — `handleSave` (quantities → PO lines, id alignment), the whole-number floor and `searchParts` are all untested.
- **Extraction status + risk + approach:** Inline. **Low risk — extract first.** Nearly self-contained; the logic has not changed since the 2026-07-29 map (the only edit since is the v2.2188 `role="dialog"` attribute). Props: `jobs`, `jobsLoading`, `myJobIds`, `role`, `selectedServiceTypeId`, `authUserId`, `error` + `onError` (or move `error` in — see quirk 9); service-type reset per [Shared substrate](#shared-substrate) (not by keying). Keep it mounted while Transactions shows (quirk 19) or an unsent tally is lost on tab switch. Stage A first: the `handleSave` row-building + id-alignment kernel (below).

### Page-level modals (2292–2400) — all Transactions-owned

All six render at the bottom (three behind a gate); **every one is opened only from Transactions rows/chips/cards**, so they move with `TallyTransactionsTab`:

| Modal | Lines | Extracted component | Opened by | Tests | Notes |
|---|---|---|---|---|---|
| `TallyJobTransactionsModal` (202 lines) | 2292–2298 | ✅ [`components/tally/TallyJobTransactionsModal.tsx`](../src/components/tally/TallyJobTransactionsModal.tsx) | job-label click in split banner (`tallyJobDrilldown`) | none | receives `rows={tallyTxRowsGlobalFiltered}` — drilldown filters client-side |
| `TallyClockWindowAllocateModal` (472 lines) | 2300–2313 | ✅ [`components/tally/TallyClockWindowAllocateModal.tsx`](../src/components/tally/TallyClockWindowAllocateModal.tsx) | posted-date button (`tallyClockAllocateRow`) | **none — money split** | splits a tx across clock-day jobs (posted/prev/next day, `APP_CALENDAR_TZ` calendar) via `splitSignedAmountEqually` (no direct test; exercised only through `sortModeSplit.test.ts`); `onSaved` reloads |
| `TallySortPurchaseModal` (457 lines) | 2315–2328 (`authUser?.id` gate) | ✅ [`components/tally/TallySortPurchaseModal.tsx`](../src/components/tally/TallySortPurchaseModal.tsx) | Sort-mode card list (`tallySortModeOpen`, `tallySortModeStartTxId`) | `TallySortPurchaseModal.render.test.tsx` (`fetchSortModeDayJobs` mocked) | `rows={tallyTxSorted}`; `onOpenFullAssign` hands off to the allocations modal |
| `MercuryTransactionAllocationsModal` (1,705 lines) | 2330–2347 | ✅ [`components/MercuryTransactionAllocationsModal.tsx`](../src/components/MercuryTransactionAllocationsModal.tsx) | "Assign jobs" button / Sort-mode card (`tallyAllocModalRow`) | kernels only: `mercuryAllocModalSeed.test.ts`, `fetchMercuryRelationsByTxIds.test.ts` | shared with Banking; here in `tallySelfService` mode; fed by `mercuryTxRowFromTallyRpc` + `parseTallyJobSplitsJson` + the three label/nickname maps; `usersOptions={[]}`, `recentPersonPicksStorageKey={null}` |
| `TallyPayrollRulesModal` (305 lines) | 2348–2369 (`isDevTally` gate) | ✅ [`components/tally/TallyPayrollRulesModal.tsx`](../src/components/tally/TallyPayrollRulesModal.tsx) | dev chip / confirm-modal `onCreateRule` | none | owns rules CRUD internally; parent passes `autoApply` + localStorage toggle, `onApplyNow`, `sampleTransactions={tallyTxRows}`, `initialForm={payrollRulesSeed}` |
| `TallyMarkPayrollConfirmModal` (143 lines) | 2370–2400 (`canMarkPayroll` gate) | ✅ [`components/tally/TallyMarkPayrollConfirmModal.tsx`](../src/components/tally/TallyMarkPayrollConfirmModal.tsx) | per-row "Mark payroll" (`pendingPayrollTx`) | none | `onConfirm` drives `payrollMarkBusy` + `setTallyPayrollFlag`; `onCreateRule` (optional, dev-only since v2.3837 — R2) chains to the rules modal |

(`TallyPreClockOutModal` in the same folder is **not** used by this page — it belongs to `ClockInOutButton`.)

---

## Stage-A pure-logic inventory

Already extracted (do not re-inline): `mercuryTxRowFromTallyRpc` / `tallyRowIsResolved` / `tallyUniqueJobSplitEntries` / `filterTallyRowsToUnlinkedWithOptionalMinPosted` ([`lib/mercuryTxRowFromTally.ts`](../src/lib/mercuryTxRowFromTally.ts), **untested**), `parseTallyJobSplitsJson` ([`lib/tallyJobSplits.ts`](../src/lib/tallyJobSplits.ts), **untested**), `filterTallyLinkedMercuryRowsBySearchQuery` ([`lib/tallyTransactionSearch.ts`](../src/lib/tallyTransactionSearch.ts), **untested**), `formatTallyCurrency` / `formatTallyPostedParts` ([`lib/tally/formatTallyPosted.ts`](../src/lib/tally/formatTallyPosted.ts), **untested**), `tallyStaleGloss` ([`lib/tally/tallyStaleGloss.ts`](../src/lib/tally/tallyStaleGloss.ts), tested), `TALLY_STALE_MIN_AGE_DAYS` (a constant; `tallyStaleMinAgeDays.test.ts` covers only its sibling age functions, which this page does not use), `buildTallyPayrollRuleFlagsToInsert` (tested), `buildPayrollRuleSeedFromTransaction` (tested), `canMarkTallyPayroll` (tested), `mercuryBankDescriptionFromRaw` (tested), `mercuryRowPassesSortingStartDate` ([`lib/bankingSortingConfig.ts`](../src/lib/bankingSortingConfig.ts), **untested** — `bankingSortingConfig.test.ts` covers other exports), `normalizeJobTallyMinPostedYmd` ([`lib/appSettingsKeys.ts`](../src/lib/appSettingsKeys.ts), **untested** — `appSettingsKeys.test.ts` covers other parsers), `pageTabStyle`.

Still inline — extract to `src/lib/tally/*` (or shared lib) with colocated tests before Stage B:

| Candidate | Currently | Target + tests |
|---|---|---|
| `sortTallyRowsStable(list, sort)` | module-level 153–179 | `lib/tally/sortTallyRows.ts` — test null `posted_at` → epoch 0, counterparty haystack includes `note` + `tally_user_note`, stable `mercury_transaction_id` tiebreak (always ascending, even under `desc`), asc/desc |
| `formatLinkedCardDisplayLabel(card)` | module-level 115–120 | `lib/tally/cardLabel.ts` — test nickname trim, `Card <8>…` fallback |
| `tallyJobLabelById` builder (jobs + job-split merge loop) | `useMemo` body 482–501 | pure `buildTallyJobLabelById(jobs, rows)` — test hcp·name join, splits filling unknown jobs, no overwrite of known jobs; pin that the `|| id` fallback never fires (`' · '` trims to `'·'`, so empty hcp + name labels as `·`) |
| payroll chip totals (count + `Σ|amount|`) | inline IIFE 1056–1060 | `tallyPayrollChipTotals(rows)` — money; test abs of negative debits, non-numeric amounts → 0 |
| `handleSave` kernel: build `jobs_tally_parts` rows (`sequence_order`, null `part_id` for sent fixtures) + align returned `inserted[i].id` to part entries | inline in `handleSave` 798–833 | `lib/tally/tallyPartsSave.ts` `buildTallyPartRows(entries, jobId, userId)` + `partInsertedIds(entries, inserted)` — test the index alignment (it silently assumes insert-order response; a test pins that contract) and the fixture-sent null path |
| duplicate memo save (`saveMyNote`/`clearMyNote` 1362–1405 vs `saveTallyUserNoteForCard` 307–328) | row closures + a callback | in-file dedupe, not a lib kernel: route the row closures through the callback, keeping the row path's saving/error state and the draft reset on clear (quirk 21) |

Non-candidates (IO, not calc): `loadTallyTransactions`, `searchParts` debounce, `fetchSortModeDayJobs`.

---

## Test coverage

No page-level render smoke and no e2e spec for `/tally`. Per region:

| Region | Covered | Uncovered (risk) |
|---|---|---|
| Module helpers | — | `sortTallyRowsStable`, `formatLinkedCardDisplayLabel` |
| Parent shell | route access (`layoutRouteAccess.test.ts`) | `?tab=` normalization, jobs-load paths, Plumbing default |
| Transactions engine | `mercuryBankDescriptionFromRaw.test.ts`, `tallyStaleGloss.test.ts` | **`tallyRowIsResolved` / `tallyUniqueJobSplitEntries`** (decide `N unlinked`, scope filter, payroll split-block), the min-posted floor (`mercuryRowPassesSortingStartDate`, `normalizeJobTallyMinPostedYmd` — their lib files' tests skip them), `filterTallyLinkedMercuryRowsBySearchQuery`, **`parseTallyJobSplitsJson`** (seeds allocation amounts — money), `formatTallyPosted`, `tallyJobLabelById`, `useTallyUnlinkedCounts` |
| Payroll sub-cluster | `tallyPayrollRules.test.ts`, `tallyPayrollRuleSeed.test.ts`, `payWeekLinks.test.ts`, `orgDefaults.test.ts` | **chip `Σ|amount|`** (money), `TallyPayrollRulesModal` (the confirm modal: `TallyMarkPayrollConfirmModal.render.test.tsx`) |
| Sort mode | `TallySortModeCardList.render.test.tsx`, `TallySortPurchaseModal.render.test.tsx`, `sortModeSplit.test.ts` | `fetchSortModeDayJobs` (mocked in the render test) |
| Materials Estimate | — | **`handleSave`** (PO line quantities, id alignment), qty floor, `searchParts` |
| Modals | `mercuryAllocModalSeed.test.ts`, `fetchMercuryRelationsByTxIds.test.ts` (allocations-modal kernels) | **`TallyClockWindowAllocateModal` split math** (money), `TallyJobTransactionsModal`, both payroll modals |

---

## Preserve-quirks list (odd but load-bearing — do not "fix" during the move)

1. **Payroll flags are fetched as the whole table on purpose.** `.in(<thousands of ids>)` blew the request-URL limit, failed silently, and marked rows reappeared under "Show unlinked" (comment 350–353). Keep the full-table SELECT and the best-effort try/catch (rows render without chips on failure).
2. **`is_payroll` is mutated onto the RPC rows** (`for (const r of rows) r.is_payroll = ...`, 364) before `setTallyTxRows` — display resolved-ness (`tallyRowIsResolved`) depends on the merged field; the RPC does not return it.
3. **Auto-apply signature**: `payrollAutoApplySigRef` stores the sorted comma-joined *undecided* tx ids; a pass that decides transactions shrinks the set so it never re-fires for the same ids. Empty signature (`''`) never fires.
4. **One shared personal-memo draft**: `tallyUserNoteDraft` is a single state reused per open row; `saveMyNote`/`clearMyNote` are closures created inside the row map. Opening another row's editor seeds the draft from that row. Escape closes both memo panels globally.
5. **Default scope is `'unlinked'`; default sort `posted_at desc`**; changing sort column defaults desc only for `posted_at`, asc for the others.
6. **Min-posted floor is read once on mount** — an `app_settings` realtime listener was removed as a no-op (table not in the `supabase_realtime` publication; comment 617–619). A route reload picks up changes; the empty-state copy points devs at Settings → Templates & testing → Job Parts Tally.
7. **Jobs load runs on `[role]` only** (642–674) and reads `selectedJobId` stale (deliberately un-depped); the first job is auto-selected only when nothing is selected at role-resolution time. Two load paths: RPC `list_jobs_for_tally` for `isSubcontractorLikeRole`, else direct `jobs_ledger` ordered `hcp_number desc`.
8. **`handleSave` index-aligns inserted ids to entries** (`entries.map((e, i) => !e.isFixtureSent ? inserted[i]?.id : null)`, 825–827) — it relies on the INSERT returning rows in input order. PO creation failure is non-fatal: rows are saved, `poCreateError` renders inside the green "Parts saved." banner, and the form still clears. The `purchase_order_id` back-fill UPDATE (829–833) is not error-checked — a failure leaves the rows unlinked from the PO silently.
9. **`error` renders only inside the Materials tab JSX** (1831–1833) even though the service-type and jobs loaders (parent) also write it; Transactions has its own `tallyTxError`. A jobs-load error is therefore invisible while on the Transactions tab. Preserve the split (i.e. `error` can move into the Materials tab with `setError` passed to parent loaders, or stay parent — but don't surface it on Transactions "while you're in there").
10. **Quantities are whole numbers** floored at 1 (`Math.max(1, Math.round(...))` in `addEntry`, `adjustEntryQuantity`, and the number input) — the v2.56 change. `adjustEntryQuantity` ignores `isFixtureSent` rows.
11. **Fixture "send to office" rows** are `TallyEntry`s with empty `partId`/`partName` and `isFixtureSent: true`; they insert with `part_id: null` and are excluded from PO creation.
12. **URL slugs `transactions`/`materials` ≠ state keys** (`transactions`/`materials-estimate`); unknown/missing `?tab=` rewrites to `transactions` with `replace: true`.
13. **`localStorage` access is always try/catch-wrapped** (`jobs-tally-payroll-autoapply`) — session-only fallback when unavailable.
14. **`tallyDebitCardFilterId` self-heals** via effect when the filtered card vanishes from `linkedDebitCards`.
15. **Empty-state ladder order matters** (1162–1220): loading → no rows at all → all rows below min-posted floor → card filter empty (`Show all cards` button) → unlinked scope empty (`Show all` button). Search-empty is a separate branch that still hides the table/cards (1283–1305).
16. **`MercuryTransactionAllocationsModal` self-service contract**: `tallySelfService` flag, `usersOptions={[]}`, `initialPersonId`/`initialUserId` null, `recentPersonPicksStorageKey={null}` — do not thread new props during the move.
17. **Payroll RPCs enforce the no-split invariant server-side**; the client's `txIdsWithJobSplits` block is a mirror, not the guard. Marking payroll resolves a tx **without** job allocation so per-job spend never double-counts against clocked labor (v2.641 rationale).
18. **JobTally's `hcp_number` display sites intentionally bypass `effectiveJobLedgerNumber`** — the tally RPCs bake the effective number server-side (v2.963 note); the office/dev jobs path is a raw `jobs_ledger` SELECT and is not covered by that (see Parent shell note).
19. **Neither tab is mount-gated.** All 48 states live in the always-mounted parent, so a half-built Materials tally (`entries`, `fixtureName`, `selectedJobId`) and the Transactions filter/search/sort survive tab switches; `activeTab` gates only the render blocks and the load-on-activate effect (which reloads on every return to Transactions). An extracted tab rendered as `activeTab === … && <Tab />` loses that — keep both mounted (hide the inactive one), and never drop unsent Materials entries.
20. **The header gloss is the Dashboard card's number** (990–994): `tallyStaleGloss(tallyCardCounts.staleUnlinked, TALLY_STALE_MIN_AGE_DAYS)` shows only with no card filter; the count comes from the server RPC via `useTallyUnlinkedCounts`, not from `tallyTxRows`, and `loadTallyTransactions` refetches it first (334) so both numbers refresh together. Don't recompute it client-side.
21. **Two memo-save paths**: table rows use closures + the shared draft/saving/error state; Sort-mode cards use `saveTallyUserNoteForCard` (returns the error string; the card owns its UI state). Both call `upsert_mercury_tally_transaction_note` and patch `tally_user_note` optimistically; clear-from-row also resets the shared draft (1396).
22. **`searchParts` interpolates the raw lowercased term into `.or(...)`** (719) — a comma or parenthesis in the term can break the PostgREST filter and surfaces as the Materials `error`. Pre-existing; escaping it is a behavior change for its own PR.

---

## Recommended extraction order (value ÷ risk)

1. **Stage A sweep + tests for the count-deciding kernels** — first pin the already-extracted but untested kernels (`tallyRowIsResolved` / `tallyUniqueJobSplitEntries` / `mercuryTxRowFromTallyRpc`, `parseTallyJobSplitsJson`, `filterTallyLinkedMercuryRowsBySearchQuery`, `formatTallyPosted`, and the min-posted floor pair `mercuryRowPassesSortingStartDate` / `normalizeJobTallyMinPostedYmd`), then extract the [inventory](#stage-a-pure-logic-inventory) rows. Each is independently shippable with zero UI diff. Highest leverage: `buildTallyJobLabelById` (three consumers now), `sortTallyRowsStable`, the payroll chip total and the `handleSave` alignment kernel (both money / fragile contracts under test).
2. **`materials-estimate` → `src/components/tally/TallyMaterialsEstimateTab.tsx`** — lowest coupling, ~620 lines out, logic untouched since 2026-07-29. Parent keeps: `jobs`/`jobsLoading`/`myJobIds` loaders, `role`, `serviceTypes` loader + header select. Moves: all Step 1–4 state/handlers, the job-picker sheet, `handleSave`, and (with care) `selectedJobId` + its default-select behavior. Keep it mounted (quirk 19). The momentum-builder that validates the prop seam.
3. ✓ **Payroll gate fix (R1, R2)** — done, v2.3837 (a behavior PR, not an extraction).
4. **(Inner seam) `TallyTransactionRow`** — the table path only (1339–1818, ~480 lines; the Sort-mode path already lives in `TallySortModeCardList`); fold the memo-save dedupe in here. Keeps the Stage-B tab diff reviewable.
5. **`transactions` → `src/components/tally/TallyTransactionsTab.tsx`** — moves the tx engine (`loadTallyTransactions`, all `tallyTx*`/payroll/Sort-mode state, the 9-memo pipeline, six effects, `usePeopleAccess` / `useOrgDefault` / `useTallyUnlinkedCounts`) **plus all six modal wirings** and the module-level mini-components/styles. Parent passes `jobs`, `role`, `authUserId` and the `active` flag; keep it mounted (quirk 19). If the tab file lands above ~1,000 lines, split its data engine into a tab-local `useTallyTransactions` hook in the same PR series.
6. **Parent end-state** (~300–350 lines): auth/role wiring, `?tab=` router, header + tab bar, `jobs`/`myJobIds`/`serviceTypes` loaders, two thin `<...Tab />` wrappers.

**What must stay in the parent:** the `?tab=` URL router; `role` load + `role == null` gate; the shared `jobs` cache + both load paths; `myJobIds`; `serviceTypes`/`selectedServiceTypeId` + the header select (renders in shared header JSX). **No shared modals stay** — all six belong to Transactions.

Definition of done per tab, verification gates (`npm run typecheck && npm run lint && npm test` after every step), and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md). Behavior-preserving only.

---

## Recent churn (`git log` on the file + `docs/recent-features/`)

14 commits in the 90 days to a05cef4c4; last touched 2026-09-06 (876e1ae10).

- **v2.2946 / v2.2951 (2026-09-06)** — *Mark payroll* follows payroll access (`canMarkTallyPayroll`, migration `20260906130000`; rules stay dev-only); org/role default for payroll auto-apply (`useOrgDefault`).
- **v2.2896 (2026-09-06)** — the header says the Dashboard card's number (`useTallyUnlinkedCounts` + `tallyStaleGloss`).
- **v2.2188 (2026-08-23)** — dialog-role sweep: `role="dialog" aria-modal` on the job-picker bottom sheet.
- **v2.1542 (2026-08-10)** — mobile Sort mode (cards + one-purchase modal, `saveTallyUserNoteForCard`, `lib/tally/formatTallyPosted.ts`).
- **v2.641 (2026-07-04)** — payroll mark + rules cluster added (tables `mercury_tally_payroll_flags`/`mercury_tally_payroll_rules`, RPCs, `lib/tallyPayrollRules.ts` kernel).
- **v2.5xx** — pre-clock-out gate work moved `mercuryTxRowFromTallyRpc`/`tallyRowHasJobAllocations` (renamed `tallyRowIsResolved` in #57)/`tallyUniqueJobSplitEntries` out to `lib/mercuryTxRowFromTally.ts`; Assign-modal schedule/clock-day context.
- **v2.22x** — Transactions client search (`tallyTransactionSearch.ts`), Mercury note icon, `parseTallyJobSplitsJson`, `TallyJobTransactionsModal`; Dashboard unlinked badge + stale banner (DB-level mirrors of "Show unlinked").
- **Tier-1 realtime cleanup** — removed the dead `app_settings` listener (quirk 6).
- Older: fixture send-to-office (v2.4x-era migrations `20260231000010/11`), "Show my jobs only", whole-number quantities (v2.56), subcontractor RLS fix (v2.58).

Net: the Transactions tab (payroll especially) is still the churn center; the Materials Estimate tab's logic has not changed since the first map — extracting Materials first is both the lowest-risk and lowest-merge-conflict choice.
