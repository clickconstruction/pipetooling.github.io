# Job Tally Architecture Map

---
file: docs/JOB_TALLY_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the JobTally.tsx decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md) — inventory what each tab of the ~2,330-line src/pages/JobTally.tsx touches (state, loaders, handlers, memos, supabase tables/RPCs, page-level modals, cross-tab coupling) so extraction can proceed without re-deriving the strategy.
audience: Developers, AI Agents
last_updated: 2026-07-29
---

## What this surface is

[`src/pages/JobTally.tsx`](../src/pages/JobTally.tsx) is the **Job Parts Tally** page, routed at `/tally` (lazy-loaded in `App.tsx`, `<Route path="tally" .../>`). It is a **mobile-first** surface (`maxWidth: 480`, `TOUCH_MIN = 48` touch targets) used by field crews and, for the payroll cluster, by devs.

Current shape (2026-07-29): **2,330 lines** — one default-export component (`JobTally`, starts ~line 230) plus ~195 lines of module-level helpers/mini-components above it. Roughly **60 `useState`**, 11 `useEffect`, 10 `useMemo`/`useCallback`. Compared to the repo's other God components this is a *small* one, and much of its pure logic is **already extracted** to `src/lib/*` (see [Stage-A inventory](#stage-a-pure-logic-inventory)) — the remaining work is mostly Stage B.

The page is tab-switched on a single `activeTab` state; the type union is `JobTallyTab`:

```
'transactions' | 'materials-estimate'
```

URL slugs differ from state keys: `?tab=transactions` ↔ `'transactions'` (the default; any other/missing value is rewritten to it with `replace: true`), `?tab=materials` ↔ `'materials-estimate'`. **Transactions** is the landing tab: sort/allocate linked Mercury debit-card purchases to jobs. **Materials Estimate** is the original tally flow: pick a job, tally fixture parts, "Send to Office" (insert + auto-PO).

### Key structural facts

1. **The two tabs are almost fully independent.** Nothing like Bids' `setSharedBid` exists; no record id is URL-synced (only `?tab=`). The only genuinely shared substrate is the **`jobs` cache** (see [Shared substrate](#shared-substrate)).
2. **Five page-level modals render unconditionally after both tabs** (~2234–2327), but **all five are opened only from Transactions rows** — they are transactions-cluster members, not cross-tab modals, and move with that tab.
3. **A dev-only payroll sub-cluster** lives inside the Transactions tab (v2.641): mark-as-payroll flags + auto-mark rules. Its pure kernel is already in `lib/` with tests.
4. **External consumers share this page's data path**: `ClockInOutButton`'s pre-clock-out gate and `TallyPreClockOutModal` call the same RPCs (`list_my_linked_mercury_transactions_for_tally`, `list_my_linked_mercury_debit_cards_for_tally`) and the same `lib/mercuryTxRowFromTally.ts` helpers; the Dashboard badge RPC `count_unlinked_mercury_transactions_for_tally` mirrors this page's "Show unlinked" rule. Extractions must keep using the shared lib, never fork it.

### How to read a dossier

Each section lists: render location (line numbers are "as of 2026-07-29" and rot — search the symbol), **owned local state** (moves with the region), **cross-tab/shared state** (stays in the parent), **derived memos**, **handlers/loaders**, **supabase tables/RPCs**, **sub-components** (extracted vs inline), **external coupling**, and **extraction status + risk + approach**.

---

## Master summary table

| Region | Render anchor | Lines est. | Status | Coupling | Risk | Recommended action |
|---|---|---|---|---|---|---|
| Module-level helpers | above `export default function JobTally()` (~33–228) | ~195 | in-file | low (pure + 2 mini-components) | low | Stage A: move pure ones to `lib/tally/*`; mini-components ride along with the Transactions tab |
| Parent shell (role, auth, URL router, header, tab bar) | ~230–292, 546–664, 819–895 | ~180 | stays | — | — | Permanent parent: `?tab=` router, `role` load, `jobs` loader, `serviceTypes` loader, header |
| **Transactions tab** | `activeTab === 'transactions'` (~897–1769) + logic ~238–544 | ~1,180 | inline | low external / high internal (payroll cluster, note editor, 8-stage memo pipeline) | med | Extract as `TallyTransactionsTab` **with its 5 modals**; Stage A the sort/format/label builders first |
| ↳ dev payroll sub-cluster | inside Transactions (state 238–252, fns 349–438, chip 1012–1020, banners 1628–1674) | ~180 (counted in tab) | inline | dev-gated; kernel already in `lib/` | low | Moves inside the Transactions tab as-is |
| **Materials Estimate tab** | `activeTab === 'materials-estimate'` (~1771–2232) + logic 253–272, 605–811 | ~670 | inline | low (reads shared `jobs`, `role`, service-type scope) | low | **Extract first** → `TallyMaterialsEstimateTab`; Stage A the PO-save kernel |
| Page-level modals wiring | ~2234–2327 | ~95 | extracted components, inline wiring | opened only from Transactions | low | Move wiring into `TallyTransactionsTab` when it extracts |

---

## Shared substrate

**There is no shared selection pointer and no shared data engine between the two tabs.** No `setSharedX`, no `?id=` deep link, no cross-tab record selection. What the tabs actually share:

- **`jobs` + `jobsLoading`** — loaded once by the `[role]` effect (~605–637; RPC `list_jobs_for_tally` for subcontractor-like roles, direct `jobs_ledger` SELECT otherwise). Used by the Materials tab's job picker **and** by the Transactions tab's `tallyJobLabelById` memo (job labels on split banners, search haystack, and props to `TallyJobTransactionsModal` / `MercuryTransactionAllocationsModal`). **This loader and cache stay in the parent**, passed to both tabs.
- **`role` / `isDevTally` / `authUser`** — role gates the jobs-load path, the "Show my jobs only" checkbox, and the entire payroll cluster.
- **`activeTab` + the `?tab=` URL router** (parent, permanent).

Everything else is single-tab. **What this means for extraction:** this page is the easy case — each tab can come out nearly independently with a thin prop surface (`jobs`, `jobsLoading`, `role`, `authUser?.id`, plus per-tab bits below). No `use<Page><Engine>` seam hook is needed. The Transactions tab's data engine (`loadTallyTransactions` + `tallyTxRows` + payroll sets) is consumed only by that tab and its modals, so it moves wholesale into `TallyTransactionsTab` rather than becoming a parent hook.

One judgment call: `serviceTypes`/`selectedServiceTypeId` state is parent-level and its `<select>` renders in the **page header** (~827–854) — but it is *gated to the Materials tab* (`activeTab === 'materials-estimate'`) and only Materials logic (`searchParts`) reads it. Behavior-preserving options: keep the state + header select in the parent and pass `selectedServiceTypeId` down (recommended — the select lives in shared header JSX), or move both and have the tab render its own header row (visual-diff risk). Prefer the former.

---

## Per-region dossiers

### Module-level helpers (above the component, ~33–228)

- **Types:** `TallyLinkedDebitCardRow` (from generated RPC Returns type), `TallyTxSortKey` (`'posted_at' | 'amount' | 'counterparty_name'`), `JobForTally`, `ServiceType`, `MaterialPart`, `TallyEntry`, `JobTallyTab`, `TallyTxScope` (`'all' | 'unlinked'`).
- **Pure functions:** `formatTallyCurrency(n)` (Intl USD), `formatTallyPostedParts(iso)` (→ `{date, weekday}` in `APP_CALENDAR_TZ`, null-safe), `formatLinkedCardDisplayLabel(card)` (nickname, else `Card <first-8>…`), `tallyCardFilterChipButtonStyle(active)`, `tallyJobsSubRowBannerStyle(allocated)`, `sortTallyRowsStable(list, sort)` (comparator per key; counterparty haystack = `counterparty_name + note + tally_user_note` lowercased; **stable tiebreak on `mercury_transaction_id`**), `tabStyle(active)` (wraps shared `pageTabStyle` with size overrides — v2.9xx tab-box restyle).
- **Mini-components:** `TallyPostedDateOpenButton` (~72–120; hover/focus state; opens the clock-window allocate modal), `TallySortTh` (~188–221; `aria-sort` header cell).
- **Extraction:** all pure functions are Stage-A candidates (see [inventory](#stage-a-pure-logic-inventory)); the two mini-components and both style helpers are Transactions-only and move into `TallyTransactionsTab` (or a `components/tally/` sibling file).

### Parent shell — role, auth, URL router, header, tab bar (stays)

- **State:** `activeTab`, `role` (+ derived `isDevTally = role === 'dev'`), `error` (see quirk 9), `serviceTypes`, `selectedServiceTypeId`, `jobs`, `jobsLoading`, `myJobIds`.
- **Effects:** role load (`users.role` SELECT by `authUser.id`, ~546–552); `?tab=` router (~584–603 — normalizes unknown values to `transactions` with `replace: true`); jobs load keyed on `[role]` (~605–637 — RPC vs table path, default-selects first job into `selectedJobId`); `myJobIds` load (`jobs_ledger_team_members` SELECT by `user_id`, ~639–646); `service_types` load ordered by `sequence_order` with **Plumbing-by-name default** (~648–664).
- **Supabase:** `users` (SELECT role), `jobs_ledger` (SELECT id/hcp_number/job_name/job_address), RPC `list_jobs_for_tally`, `jobs_ledger_team_members` (SELECT), `service_types` (SELECT).
- **JSX kept:** `role == null` loading gate (~813), page container, `← Dashboard` link, `Job Parts Tally` header + Materials-gated service-type `<select>` (~819–855), tab-button bar writing `?tab=` (~857–895).
- **Note:** the RPCs feeding this page already return the effective ledger number in `hcp_number` (since migration `20260619160000`) — the v2.963 `effectiveJobLedgerNumber` sweep deliberately left JobTally alone. Don't "fix" the raw `hcp_number || '—'` display sites during extraction.

### `transactions` — Transactions tab

- **Render location:** `activeTab === 'transactions'` block (~897–1769): count line + scope chips + payroll chip, card-filter chip row, empty-state ladder (5 distinct messages), search input, and the transactions table (three sortable columns; each row is a `<Fragment>` of main row + optional personal-memo editor row + job-splits banner row).
- **Owned local state (moves with the tab):** `tallyTxRows`, `linkedDebitCards`, `tallyTxLoading`, `tallyTxError`, `tallyTxSort` (`{key, dir}`, default `posted_at desc`), `tallyAllocModalRow`, `tallyClockAllocateRow`, `tallyJobDrilldown` (`{jobId, label} | null`), `tallyDebitCardFilterId`, `tallyTxScope` (default `'unlinked'`), `tallyTxSearchQuery`, `tallyOpenNoteTxId`, `tallyOpenUserNoteTxId`, `tallyUserNoteDraft`, `tallyUserNoteSaving`, `tallyUserNoteError`, `tallyGlobalMinPostedYmd`; payroll cluster: `payrollFlaggedIds`, `payrollDecidedIds`, `payrollRulesModalOpen`, `pendingPayrollTx`, `payrollMarkBusy`, `payrollRulesSeed`, `payrollAutoApply` (lazy-init from localStorage `jobs-tally-payroll-autoapply`), ref `payrollAutoApplySigRef`.
- **Cross-tab/shared state (stays in parent):** `jobs` (via `tallyJobLabelById`), `role`/`isDevTally`, `authUser?.id`, `activeTab` (load-effect gate). `showToast` from `useToastContext`.
- **Derived memos (an 8-stage pipeline — preserve the order):** `tallyTxRowsGlobalFiltered` (min-posted-YMD floor via `mercuryRowPassesSortingStartDate`) → `tallyJobLabelById` (jobs cache **merged with** job-split entries found on rows, so labels exist for jobs outside the caller's list) → `tallyNicknameByDebitCard` / `tallyNicknameByAccount` → `tallyTxRowsFiltered` (card filter) → `tallyUnlinkedCountInScope` (`!tallyRowIsResolved(r)`) → `tallyTxRowsForTable` (scope filter) → `tallyTxRowsForSearch` (`filterTallyLinkedMercuryRowsBySearchQuery`) → `tallyTxSorted` (`sortTallyRowsStable`). Plus the inline payroll-chip IIFE (~1014–1018: count + `Σ|amount|` of `is_payroll` rows in `tallyTxRowsFiltered`).
- **Handlers/loaders:** `loadTallyTransactions` (useCallback; parallel RPC pair; dev-only merge of `mercury_tally_payroll_flags` — **whole-table fetch by design**, see quirk 2 — mutating `r.is_payroll` onto rows before `setTallyTxRows`), `setTallyPayrollFlag(txId, isPayroll)` (RPC + reload + toast; never throws), `applyPayrollRules({silent})` (loads enabled `mercury_tally_payroll_rules`, runs `buildTallyPayrollRuleFlagsToInsert` kernel with `decidedTxIds` + `txIdsWithJobSplits`, bulk RPC, reload, toast with skipped-split count), `setTallyTxSortForColumn` (toggle; new column defaults desc only for `posted_at`), and the **row-closure** async fns `saveMyNote`/`clearMyNote` (~1305–1348, defined inside the `tallyTxSorted.map` — RPC `upsert_mercury_tally_transaction_note` + optimistic `setTallyTxRows` patch).
- **Effects:** card-filter self-heal (clears `tallyDebitCardFilterId` if the card disappears, ~520–527); load-on-activate (`activeTab === 'transactions' && authUser?.id`, ~529–532); Escape-closes-note-panels window listener (~534–544); `app_settings` min-posted-YMD read-once (~554–578 — `APP_SETTINGS_KEY_JOB_TALLY_MIN_POSTED_YMD` + `normalizeJobTallyMinPostedYmd`; a realtime listener was removed as a no-op, see comment ~580–582); payroll auto-apply (~427–438 — fires `applyPayrollRules({silent:true})` when the sorted-undecided-id signature changes; `payrollAutoApplySigRef` prevents refire loops).
- **Supabase tables/RPCs:** RPC `list_my_linked_mercury_transactions_for_tally`, RPC `list_my_linked_mercury_debit_cards_for_tally`, `mercury_tally_payroll_flags` (SELECT, dev), `mercury_tally_payroll_rules` (SELECT enabled, dev), RPC `set_tally_payroll_flag`, RPC `bulk_apply_tally_payroll_rule_flags`, RPC `upsert_mercury_tally_transaction_note`, `app_settings` (SELECT one key). All loads wrapped in `withSupabaseRetry`.
- **Sub-components:** `TallySortTh`, `TallyPostedDateOpenButton` (module-level, ride along); `MercuryTransactionNoteIcon` (extracted). The row body (~1282–1761) is a large inline map — the natural inner seam is a `TallyTransactionRow` component.
- **External coupling:** the five page-level modals below; `showToast`; localStorage `jobs-tally-payroll-autoapply`; Dashboard badge + `ClockInOutButton` gate use the same RPCs/lib (DB-level coupling only — no shared client state).
- **Extraction status + risk + approach:** Inline. **Medium risk** — biggest region, but its coupling is internal. Approach: Stage A the remaining pure helpers; optionally extract `TallyTransactionRow` first (props: `row`, `sort`-independent display data, open/note callbacks, `isDevTally`); then move the whole tab + its five modals into `src/components/tally/TallyTransactionsTab.tsx`. Props needed from parent: `active` (or parent mount-gates), `authUserId`, `role`/`isDevTally`, `jobs` (or the prebuilt label map — but the memo also reads rows, so pass `jobs` and build the map inside), `showToast` comes from context directly. The modals move because no other tab opens them.

### Dev payroll sub-cluster (inside Transactions)

Kept as its own dossier entry because it has distinct tables and a test-covered kernel, but it is **not separable** from the Transactions tab — its state feeds `tallyRowIsResolved` display logic and the row banners.

- **UI:** "Payroll rules" chip button (~997–1009), `Payroll: N · $X` reconciliation chip (~1012–1020), per-row `Mark payroll` button + `Payroll ✓ / Unmark` banner (~1628–1674), `TallyPayrollRulesModal` + `TallyMarkPayrollConfirmModal` wiring (~2275–2327; confirm modal's `onCreateRule` seeds the rules modal via `buildPayrollRuleSeedFromTransaction`).
- **Invariants (server-enforced, mirror client-side):** a tx with job splits cannot be marked payroll (`blockedByJobSplits` routing in the kernel); manual mark/unmark always wins over rules via tombstone rows (`payrollDecidedIds` = every flag row, marked or tombstoned — rules never re-touch decided ids).
- **Already-extracted logic:** `buildTallyPayrollRuleFlagsToInsert` + `TallyPayrollRuleForMatch` in [`lib/tallyPayrollRules.ts`](../src/lib/tallyPayrollRules.ts) (tested), `buildPayrollRuleSeedFromTransaction` in [`lib/tallyPayrollRuleSeed.ts`](../src/lib/tallyPayrollRuleSeed.ts) (tested).

### `materials-estimate` — Materials Estimate tab

- **Render location:** `activeTab === 'materials-estimate'` block (~1771–2232): error + saved banners, Step 1 job picker (button + bottom-sheet overlay + "Show my jobs only" checkbox), Step 2 fixture-name input with "send this item to the office" link, Step 3 part search + results list, Step 4 quantity stepper + Add/Cancel, entries list + "Send to Office" save button. Plus the header service-type `<select>` (parent header JSX, gated to this tab).
- **Owned local state (moves with the tab):** `selectedJobId`, `fixtureName`, `partSearch`, `partResults`, `partSearching`, `selectedPart`, `quantity`, `entries` (`TallyEntry[]`), `saving`, `saved`, `lastSaveHadPartEntries`, `poCreateError`, `jobPickerOpen`, `showMyJobsOnly`. Caveat: the parent jobs-load effect default-selects into `selectedJobId` — if the state moves, the default-select effect moves too (watch `jobs`), noting quirk 8.
- **Cross-tab/shared state (stays in parent):** `jobs`, `jobsLoading`, `myJobIds`, `role` (job-load path + "Show my jobs only" visibility via `isSubcontractorLikeRole`), `serviceTypes`/`selectedServiceTypeId` (header select; changing it clears `partResults` + `partSearch`), `error`/`setError` (see quirk 9), `authUser?.id`.
- **Derived values:** `selectedJob` (plain `jobs.find`, computed in render, ~817 — used by both the header area and this tab's JSX; keep parent or recompute in tab), filtered picker list inline (`showMyJobsOnly && myJobIds ? jobs.filter(...) : jobs`).
- **Handlers:** `searchParts(term)` (useCallback on `[selectedServiceTypeId]`; `material_parts` ILIKE-or across name/manufacturer/notes, `.limit(30)`), 300ms debounce effect (~697–700), `addEntry` (whole-number qty floor 1; resets part-picker state), `removeEntry`, `adjustEntryQuantity` (skips `isFixtureSent` rows), `sendFixtureToOffice` (pushes a part-less entry with `isFixtureSent: true`), `handleSave` (~756–811 — the meaty one: bulk INSERT into `jobs_tally_parts` with `sequence_order` = index and `part_id: null` for sent-fixtures; then RPC `create_po_from_job_tally` for part entries; back-fills `purchase_order_id` onto the inserted tally rows by **index-aligning `entries` with the returned `inserted` ids**; PO failure sets `poCreateError` but the save still succeeds and clears the form).
- **Supabase tables/RPCs:** `material_parts` (SELECT), `jobs_tally_parts` (INSERT + UPDATE `purchase_order_id`), RPC `create_po_from_job_tally`. (Job/service-type loads are parent-owned, above.)
- **Sub-components:** none extracted; job-picker bottom sheet and quantity stepper are inline.
- **External coupling:** none beyond the shared caches. RLS quirks live server-side (subcontractor INSERT policy on `jobs_tally_parts` depends on `jobs_ledger_team_members` SELECT — v2.58 fix).
- **Extraction status + risk + approach:** Inline. **Low risk — extract first.** Nearly self-contained; props: `jobs`, `jobsLoading`, `myJobIds`, `role`, `selectedServiceTypeId`, `authUserId`, `error` + `onError` (or move `error` in — see quirk 9), and the service-type-change reset (parent select's `onChange` clears part search — pass an `onServiceTypeChanged` signal or key the tab by `selectedServiceTypeId`). Stage A first: the `handleSave` row-building + id-alignment kernel (below).

### Page-level modals (~2234–2327) — all Transactions-owned

All five render unconditionally at the bottom; **every one is opened only from Transactions rows/chips**, so they move with `TallyTransactionsTab`:

| Modal | Extracted component | Opened by | Notes |
|---|---|---|---|
| `TallyJobTransactionsModal` (202 lines) | ✅ [`components/tally/TallyJobTransactionsModal.tsx`](../src/components/tally/TallyJobTransactionsModal.tsx) | job-label click in split banner (`tallyJobDrilldown`) | receives `rows={tallyTxRowsGlobalFiltered}` — drilldown filters client-side |
| `TallyClockWindowAllocateModal` (472 lines) | ✅ [`components/tally/TallyClockWindowAllocateModal.tsx`](../src/components/tally/TallyClockWindowAllocateModal.tsx) | posted-date button (`tallyClockAllocateRow`) | splits a tx across clock-day jobs (posted/prev/next day, Chicago calendar); `onSaved` reloads |
| `MercuryTransactionAllocationsModal` (1,540 lines) | ✅ [`components/MercuryTransactionAllocationsModal.tsx`](../src/components/MercuryTransactionAllocationsModal.tsx) | "Assign jobs" button (`tallyAllocModalRow`) | shared with Banking; here in `tallySelfService` mode; fed by `mercuryTxRowFromTallyRpc` + `parseTallyJobSplitsJson` + the three label/nickname maps; `usersOptions={[]}`, `recentPersonPicksStorageKey={null}` |
| `TallyPayrollRulesModal` (305 lines) | ✅ [`components/tally/TallyPayrollRulesModal.tsx`](../src/components/tally/TallyPayrollRulesModal.tsx) | dev chip / confirm-modal `onCreateRule` | owns rules CRUD internally; parent passes `autoApply` + localStorage toggle, `onApplyNow`, `sampleTransactions={tallyTxRows}`, `initialForm={payrollRulesSeed}` |
| `TallyMarkPayrollConfirmModal` (143 lines) | ✅ [`components/tally/TallyMarkPayrollConfirmModal.tsx`](../src/components/tally/TallyMarkPayrollConfirmModal.tsx) | per-row "Mark payroll" (`pendingPayrollTx`) | `onConfirm` drives `payrollMarkBusy` + `setTallyPayrollFlag`; `onCreateRule` chains to the rules modal |

(`TallyPreClockOutModal` in the same folder is **not** used by this page — it belongs to `ClockInOutButton`.)

---

## Stage-A pure-logic inventory

Already extracted (do not re-inline; add tests only where missing): `mercuryTxRowFromTallyRpc` / `tallyRowIsResolved` / `tallyUniqueJobSplitEntries` / `filterTallyRowsToUnlinkedWithOptionalMinPosted` ([`lib/mercuryTxRowFromTally.ts`](../src/lib/mercuryTxRowFromTally.ts)), `parseTallyJobSplitsJson` ([`lib/tallyJobSplits.ts`](../src/lib/tallyJobSplits.ts)), `filterTallyLinkedMercuryRowsBySearchQuery` ([`lib/tallyTransactionSearch.ts`](../src/lib/tallyTransactionSearch.ts)), `buildTallyPayrollRuleFlagsToInsert` (tested), `buildPayrollRuleSeedFromTransaction` (tested), `mercuryBankDescriptionFromRaw`, `mercuryRowPassesSortingStartDate` ([`lib/bankingSortingConfig.ts`](../src/lib/bankingSortingConfig.ts)), `normalizeJobTallyMinPostedYmd` ([`lib/appSettingsKeys.ts`](../src/lib/appSettingsKeys.ts)), `pageTabStyle`.

Still inline — extract to `src/lib/tally/*` (or shared lib) with colocated tests before Stage B:

| Candidate | Currently | Target + tests |
|---|---|---|
| `sortTallyRowsStable(list, sort)` | module-level in JobTally.tsx | `lib/tally/sortTallyRows.ts` — test null `posted_at` → epoch 0, counterparty haystack includes `note` + `tally_user_note`, stable `mercury_transaction_id` tiebreak, asc/desc |
| `formatTallyPostedParts(iso)` | module-level | `lib/tally/formatTallyPosted.ts` — test invalid iso → null, `APP_CALENDAR_TZ` weekday/date parts |
| `formatLinkedCardDisplayLabel(card)` | module-level | same file or `lib/tally/cardLabel.ts` — test nickname trim, `Card <8>…` fallback |
| `formatTallyCurrency(n)` | module-level | check for an existing shared currency formatter first; otherwise move alongside |
| `tallyJobLabelById` builder (jobs + job-split merge loop) | `useMemo` body (~445–464) | pure `buildTallyJobLabelById(jobs, rows)` — test hcp·name join, fallback to id, splits filling unknown jobs, no overwrite of known jobs |
| payroll chip totals (count + `Σ|amount|`) | inline IIFE (~1014–1018) | trivial pure fn — optional, fold into the tab move if skipped |
| `handleSave` kernel: build `jobs_tally_parts` rows (`sequence_order`, null `part_id` for sent fixtures) + align returned `inserted[i].id` to part entries | inline in `handleSave` (~761–796) | `lib/tally/tallyPartsSave.ts` `buildTallyPartRows(entries, jobId, userId)` + `partInsertedIds(entries, inserted)` — test the index alignment (it silently assumes insert-order response; a test pins that contract) and the fixture-sent null path |

Non-candidates (IO, not calc): `loadTallyTransactions`, `searchParts` debounce, `saveMyNote`/`clearMyNote`.

---

## Preserve-quirks list (odd but load-bearing — do not "fix" during the move)

1. **Payroll flags are fetched as the whole table on purpose.** `.in(<thousands of ids>)` blew the request-URL limit, failed silently, and marked rows reappeared under "Show unlinked" (comment ~313–316). Keep the full-table SELECT and the best-effort try/catch (rows render without chips on failure).
2. **`is_payroll` is mutated onto the RPC rows** (`for (const r of rows) r.is_payroll = ...`) before `setTallyTxRows` — display resolved-ness (`tallyRowIsResolved`) depends on the merged field.
3. **Auto-apply signature**: `payrollAutoApplySigRef` stores the sorted comma-joined *undecided* tx ids; a pass that decides transactions shrinks the set so it never re-fires for the same ids. Empty signature (`''`) never fires.
4. **One shared personal-memo draft**: `tallyUserNoteDraft` is a single state reused per open row; `saveMyNote`/`clearMyNote` are closures created inside the row map. Opening another row's editor seeds the draft from that row. Escape closes both memo panels globally.
5. **Default scope is `'unlinked'`; default sort `posted_at desc`**; changing sort column defaults desc only for `posted_at`, asc for the others.
6. **Min-posted floor is read once on mount** — an `app_settings` realtime listener was removed as a no-op (table not in the `supabase_realtime` publication; comment ~580–582). A route reload picks up changes; the empty-state copy points devs at Settings → Templates & testing → Job Parts Tally.
7. **Jobs load runs on `[role]` only** (~605–637) and reads `selectedJobId` stale (deliberately un-depped); the first job is auto-selected only when nothing is selected at role-resolution time. Two load paths: RPC `list_jobs_for_tally` for `isSubcontractorLikeRole`, else direct `jobs_ledger` ordered `hcp_number desc`.
8. **`handleSave` index-aligns inserted ids to entries** (`entries.map((e, i) => !e.isFixtureSent ? inserted[i]?.id : null)`) — it relies on the INSERT returning rows in input order. PO creation failure is non-fatal: rows are saved, `poCreateError` renders inside the green "Parts saved." banner, and the form still clears.
9. **`error` renders only inside the Materials tab JSX** (~1773–1775) even though the service-type and jobs loaders (parent) also write it; Transactions has its own `tallyTxError`. A jobs-load error is therefore invisible while on the Transactions tab. Preserve the split (i.e. `error` can move into the Materials tab with `setError` passed to parent loaders, or stay parent — but don't surface it on Transactions "while you're in there").
10. **Quantities are whole numbers** floored at 1 (`Math.max(1, Math.round(...))` in `addEntry`, `adjustEntryQuantity`, and the number input) — the v2.56 change. `adjustEntryQuantity` ignores `isFixtureSent` rows.
11. **Fixture "send to office" rows** are `TallyEntry`s with empty `partId`/`partName` and `isFixtureSent: true`; they insert with `part_id: null` and are excluded from PO creation.
12. **URL slugs `transactions`/`materials` ≠ state keys** (`transactions`/`materials-estimate`); unknown/missing `?tab=` rewrites to `transactions` with `replace: true`.
13. **`localStorage` access is always try/catch-wrapped** (`jobs-tally-payroll-autoapply`) — session-only fallback when unavailable.
14. **`tallyDebitCardFilterId` self-heals** via effect when the filtered card vanishes from `linkedDebitCards`.
15. **Empty-state ladder order matters** (~1120–1177): loading → no rows at all → all rows below min-posted floor → card filter empty → unlinked scope empty (each with its own escape-hatch button). Search-empty is a separate branch that still hides the table (~1241–1263).
16. **`MercuryTransactionAllocationsModal` self-service contract**: `tallySelfService` flag, `usersOptions={[]}`, `initialPersonId`/`initialUserId` null, `recentPersonPicksStorageKey={null}` — do not thread new props during the move.
17. **Payroll RPCs enforce the no-split invariant server-side**; the client's `txIdsWithJobSplits` block is a mirror, not the guard. Marking payroll resolves a tx **without** job allocation so per-job spend never double-counts against clocked labor (v2.641 rationale).
18. **JobTally's `hcp_number` display sites intentionally bypass `effectiveJobLedgerNumber`** — the tally RPCs bake the effective number server-side (v2.963 note).

---

## Recommended extraction order (value ÷ risk)

1. **Stage A sweep** — the [inventory](#stage-a-pure-logic-inventory) above; each independently shippable. Highest leverage: `sortTallyRowsStable`, `buildTallyJobLabelById`, the `handleSave` alignment kernel (pins a fragile contract under test).
2. **`materials-estimate` → `src/components/tally/TallyMaterialsEstimateTab.tsx`** — lowest coupling, ~670 lines out. Parent keeps: `jobs`/`jobsLoading`/`myJobIds` loaders, `role`, `serviceTypes` loader + header select. Moves: all Step 1–4 state/handlers, the job-picker sheet, `handleSave`, and (with care) `selectedJobId` + its default-select behavior. The momentum-builder that validates the prop seam.
3. **(Optional inner seam) `TallyTransactionRow`** — shrinks the row map (~480 lines) before the tab move; keeps the Stage-B tab diff reviewable.
4. **`transactions` → `src/components/tally/TallyTransactionsTab.tsx`** — moves the tx engine (`loadTallyTransactions`, all `tallyTx*`/payroll state, the 8-memo pipeline, min-posted effect, Escape listener) **plus all five modal wirings** and the module-level mini-components/styles. Parent passes `jobs`, `role`/`isDevTally`, `authUserId`, and mount-gates on `activeTab`.
5. **Parent end-state** (~350–400 lines): auth/role/toast wiring, `?tab=` router, header + tab bar, `jobs`/`myJobIds`/`serviceTypes` loaders, two thin `<...Tab />` wrappers.

**What must stay in the parent:** the `?tab=` URL router; `role` load + `role == null` gate; the shared `jobs` cache + both load paths; `myJobIds`; `serviceTypes`/`selectedServiceTypeId` + the header select (renders in shared header JSX). **No shared modals stay** — all five belong to Transactions.

Definition of done per tab, verification gates (`npm run typecheck && npm run lint && npm test` after every step), and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md). Behavior-preserving only.

---

## Recent churn (grep of `docs/RECENT_FEATURES.md`)

- **v2.641 (2026-07-04)** — payroll mark + rules cluster added (new tables `mercury_tally_payroll_flags`/`mercury_tally_payroll_rules`, RPCs, `lib/tallyPayrollRules.ts` kernel). The newest and most active region.
- **v2.5xx** — pre-clock-out gate work moved `mercuryTxRowFromTallyRpc`/`tallyRowHasJobAllocations`/`tallyUniqueJobSplitEntries` out to `lib/mercuryTxRowFromTally.ts`; Assign-modal schedule/clock-day context.
- **v2.22x** — Transactions client search (`tallyTransactionSearch.ts`), Mercury note icon, `parseTallyJobSplitsJson`, `TallyJobTransactionsModal`; Dashboard unlinked badge + stale banner (DB-level mirrors of "Show unlinked").
- **Tier-1 realtime cleanup** — removed the dead `app_settings` listener (quirk 6).
- Older: fixture send-to-office (v2.4x-era migrations `20260231000010/11`), "Show my jobs only", whole-number quantities (v2.56), subcontractor RLS fix (v2.58).

Net: the Transactions tab (especially payroll) is the churn center; the Materials Estimate tab has been stable for months — extracting Materials first is both the lowest-risk and lowest-merge-conflict choice.
