# Jobs Modals Architecture Map

---
file: docs/JOBS_MODALS_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map (per PAGE_DECOMPOSITION_PLAYBOOK.md) for the two remaining large Jobs-area modals — JobsSubLaborFormModal.tsx (~2,154 lines) and DetailJobModal.tsx (~2,035 lines). Inventories every logical region's state, handlers, supabase tables, sub-components, and coupling so a future sub-decomposition can start without re-deriving the strategy. Both files were themselves produced by earlier mapped extractions (JOBS_TABS_ARCHITECTURE.md step 4a; the app-wide Job Detail modal) and have since grown; this map treats each as its own surface.
audience: Developers, AI Agents
sections: What this surface is; The shared substrate (or lack of one); Master summary table; JobsSubLaborFormModal dossiers; DetailJobModal dossiers; Preserve-quirks list; Stage-A pure-logic inventory; Recommended extraction order
last_updated: 2026-08-01
---

## What this surface is

> **v2.1675 — the tabbed Job window.** `DetailJobModal` and `JobFormModal` now usually render inside [`JobWindowModal.tsx`](../src/components/jobs/JobWindowModal.tsx) (Job · Edit · Bill tabs, one ✕) for roles in `isStaffFullJobLedgerDetailRole` (dev / master / assistant / primary — [`resolveJobWindowMode`](../src/lib/jobDetailModalRole.ts), v2.2848; superintendent, estimator, controller and the sub-like roles get the standalone read-only `DetailJobModal`, because the window's embedded edit form runs the full-ledger fetch that RLS refuses them and closed the window on null): the detail modal gains a `paneMode` (no own overlay/Esc/✕, ⚙ → tab switch, `externalRefreshKey`, `onEscBlockedChange`), the form gains `embeddedRegion`/`registerRequestClose`/`externalEscBlocked`. Both keep their standalone renders (non-editor roles, New Job, fallback paths), so everything in this map still applies — the window is chrome around unchanged internals.

Two Jobs-area modal "God components", mapped together because they are the Jobs area's two biggest remaining files after the page-level decompositions, but **they are independent surfaces** — they share no state, no selection pointer, and no supabase tables beyond the app-wide `jobs_ledger`/`users` reads. Line counts at 2026-07-29:

| File | Lines | What it is | Mounted by |
|---|---|---|---|
| [`src/components/jobs/JobsSubLaborFormModal.tsx`](../src/components/jobs/JobsSubLaborFormModal.tsx) | 2,154 | The New/Edit Sub Labor form modal + Add Subcontractor modal + labor-book version/entry form modals. Extracted verbatim from `Jobs.tsx` in v2.823 (step 4a of [`JOBS_TABS_ARCHITECTURE.md`](./JOBS_TABS_ARCHITECTURE.md)); **always mounted** by `Jobs.tsx`, driven by a `forwardRef` imperative handle so form state survives open/close. | [`Jobs.tsx`](../src/pages/Jobs.tsx) via `subLaborFormRef` |
| [`src/components/jobs/DetailJobModal.tsx`](../src/components/jobs/DetailJobModal.tsx) | 2,035 | The app-wide read-mostly **Job Detail** window: two-tier (full/limited) job fetch, header action cluster, address/Street-View/customer band, thread-notes + % complete, cost/profit bands, and four satellite modals. | [`JobDetailModalContext`](../src/contexts/JobDetailModalContext.tsx) (singleton under `App.tsx`); opened via `openJobDetail()` from Dashboard, Jobs (`?jobDetail=` deep link), header global search, Schedule Dispatch hub, `ClockInOutButton`, Job Mode, the Billing Pipeline section, and the Pipeline board tables |

Unlike the tab-switched pages this playbook usually targets, neither file has an `activeTab` switch. The regions below are **logical clusters** (state + handlers + a JSX block), gated by mode flags (`editingLaborJob`, `laborBookSectionOpen`, `fullJob` vs `limitedJob`, sub-modal open states) rather than tab keys. Line numbers are "as of 2026-07-29" and rot — always search the named symbol.

Both components are already the *product* of Stage A/B extraction waves, so much of their pure logic and several sections are already in `lib/*`/hooks/sub-components (noted per dossier). What remains inline is the connective tissue: validation, save pipelines, JSX bands, and small stacked modals.

---

## The shared substrate (or lack of one)

There is **no Bids-style shared substrate spanning the two modals** — no common selection pointer, no common data engine. Each modal has its own, and in both cases the pointer already lives *outside* the file (the playbook's rule is already satisfied):

### JobsSubLaborFormModal's substrate (owned by `Jobs.tsx`)

- **Selection pointer:** `editingLaborJob` / `setEditingLaborJob` — **parent-owned controlled props**. It doubles as an open-gate: the modal renders when `laborModalOpen || editingLaborJob`. It must stay in `Jobs.tsx` because (a) the `?editLabor=<hcp>` deep-link router sets it, and (b) [`useSubLaborLedger`](../src/hooks/useSubLaborLedger.ts)'s `onLaborJobsReloaded` callback re-syncs the open edit record after every ledger reload.
- **Data engine:** [`useSubLaborLedger`](../src/hooks/useSubLaborLedger.ts) (parent-side, v2.822) supplies `loadLaborJobs`, `deleteLaborJob`, `laborJobDeletingId`, `setLaborJobs`, and the payment mutations consumed by the sibling [`SubLaborPaymentModals`](../src/components/jobs/SubLaborPaymentModals.tsx). The modal never queries the ledger itself — it writes `people_labor_jobs`/`people_labor_job_items` directly and then calls `loadLaborJobs()`.
- **Roster substrate:** `jobs`, `users`, `people`, `loadRoster` are parent props (roster is shared with Pipeline assigned-edit). The modal only *partitions* them (`byKind`, `rosterNames*`).
- **Page-global `error`:** the single `error`/`setError` pair shared by every Jobs tab (quirk #7 in `JOBS_TABS_ARCHITECTURE.md`) is threaded in as props and rendered in **two places** inside this file (main form + labor-book entry modal).

**Consequence for extraction:** any internal split of this modal keeps `editingLaborJob`, the imperative handle, and the save/close orchestration in the (current) component shell; extracted sections receive controlled props exactly as the page-level playbook prescribes — one level down.

### DetailJobModal's substrate (owned by `JobDetailModalContext`)

- **Selection pointer:** the `jobId` + `open` props. `JobDetailModalContext` owns them app-wide (`openJobDetail`/`closeJobDetail`, keyed remounts via `instanceKey`, `assignedJobsRows` defaulted from `JobsListCache`). The modal itself owns **no selection**.
- **Data engine (internal):** the `fullJob` / `limitedJob` pair + `loadDetail` + `detailFetchIdRef` (race guard) + `materialsCostRefreshKey` (post-Edit-Job refetch key). Every band and satellite modal reads `fullJob ?? limitedJob`; `loadDetail` is re-invoked by the add-link saves, the % complete commit, and the Edit-Job `onSaved` callback. **This quartet is the modal's own "pricing engine"** — any body extraction must receive it as props, never re-fetch.
- Five already-extracted **read hooks** hang off the pointer: `useJobMaterialsCostSnapshot`, `useJobDetailSubLaborCost`, `useJobDetailScheduleAndSessions`, `useJobClockSessionBounds`, `useJobThreadNotesForModal` — each gated by a `show*`/`enabled` boolean so disabled roles never fetch.

---

## Master summary table

Regions ordered as they appear in each file. "Lines est." = inline lines including the region's JSX.

| # | Region | File | Lines est. | Coupling | Risk | Status |
|---|---|---|---|---|---|---|
| S1 | Form core: fields, validation, save/edit pipeline, open/reset/close, imperative handle | JobsSubLaborFormModal | ~450 (logic) + ~100 (header JSX) | high (everything reads its state) | high | inline — **stays as the shell** |
| S2 | Crew picker (External/Internal Subs, Office Team, search) | JobsSubLaborFormModal | ~230 (helpers ~80 + JSX ~150) | med (`laborAssignedTo` controlled; reads `users`/`people` props) | low-med | inline — extract as controlled component |
| S3 | Fixture rows editor (simple ⇄ itemized tables) | JobsSubLaborFormModal | ~360 | med (`laborFixtureRows`/`laborFixtureEntryMode` controlled; labor book writes into rows) | med | inline — extract after Stage A |
| S4 | Invoice-link cluster | JobsSubLaborFormModal | ~130 | low-med (edit-mode save patches `setLaborJobs` + `setEditingLaborJob`) | low | inline |
| S5 | Payments section (edit mode) | JobsSubLaborFormModal | ~60 | low (renders `editingLaborJob.payments`; opens the parent-side payment trio via 3 opener props) | low | inline |
| S6 | Labor book section + version/entry form modals | JobsSubLaborFormModal | ~600 (state/CRUD ~280 + JSX ~320) | low-med (only touchpoint into the form: `applyLaborBookHoursToPeople` writes `laborFixtureRows`) | low | inline — **best first component extraction** |
| S7 | Add Subcontractor modal | JobsSubLaborFormModal | ~130 | low (needs `authUserId`, `loadRoster`, appends to `laborAssignedTo`) | low | inline — trivial extraction |
| D1 | Module-level helpers + presentational components | DetailJobModal | ~420 | none (pure / props-only) | low | in-file — Stage A / file moves |
| D2 | Data core: two-tier `loadDetail`, race guard, name-fallback RPC | DetailJobModal | ~120 | high (every band reads it) | high | inline — **stays as the shell** |
| D3 | Header action cluster (title, trade pill, calendar, paid-email, edit-job, close) | DetailJobModal | ~210 | med (opens 2 satellite modals + `jobFormModal`; `handleEditJobClick` closes self) | med | inline |
| D4 | Top band: link icons, address→Maps, schedule block, customer panel, Street View | DetailJobModal | ~230 (+ street-view effect ~60) | low-med | low | inline — good early extraction |
| D5 | Thread notes + % complete | DetailJobModal | ~90 | med (hook + `loadDetail` + opener bridge) | med | mostly extracted already (hook + `JobThreadNotesPanel`) |
| D6 | Full-job body (dates band → invoices list) | DetailJobModal | ~300 | med (reads 4 hooks' outputs + `fullJob`) | med | inline — extract as `JobDetailFullBody` |
| D7 | Limited-job body | DetailJobModal | ~85 | low | low | inline — extract with/after D6 |
| D8 | Add-link modal + stacked Customer-Files modal | DetailJobModal | ~170 | low (writes `jobs_ledger`, calls `loadDetail`) | low | inline — trivial extraction |
| D9 | Satellite modal mounts (`JobCalendarModal`, `ScheduleJobModal`, `JobReportsModal`, `PaidJobEmailSendModal`) | DetailJobModal | ~55 | low (all already extracted components) | — | **already extracted**; mounts stay in the shell |

---

## JobsSubLaborFormModal dossiers

Component: `JobsSubLaborFormModalInner`, wrapped `forwardRef` as `JobsSubLaborFormModal`. ~42 `useState`, 4 `useEffect`, 0 `useMemo` (derived values are recomputed every render — preserve), 1 `useImperativeHandle`. Props type `JobsSubLaborFormModalProps`; handle type `JobsSubLaborFormModalHandle` (`open` / `openNew` / `openEdit` / `openNewWithJobNumber` / `openWithBillingPrefill`).

### S1 — Form core (fields, validation, save pipeline, handle)

- **Render location:** the gate `{(laborModalOpen || editingLaborJob) && (…)}` (~line 1064) wraps the whole main modal; the header field row (HCP + `fillLaborFromBilling` "fill" button, Address, Distance, Date of Labor, Service type select) is ~1081–1159; the footer button row (Cancel / Print / Save / required-list / Delete) is ~1875–1965. Handlers/effects live at ~629–1060.
- **Owned local state:** `laborModalOpen`, `laborAssignedTo` (written by S2/S7, read by save/print), `laborAddress`, `laborDistance` (string, default `'0'`), `laborJobNumber` (HCP, max 10 chars), `laborDate` (default `new Date().toLocaleDateString('en-CA')`), `laborSaving`, plus `serviceTypes`/`selectedServiceTypeId` (loaded on open; feeds S6's fixture-type scope).
- **Cross-component/shared state (stays in `Jobs.tsx`):** `editingLaborJob`/`setEditingLaborJob` (controlled pointer + open gate), `error`/`setError` (page-global), `defaultLaborRateValue` (Default Labor Rate setting; its modal is parent-side), `jobs` (for `fillLaborFromBilling` HCP match), `laborJobDeletingId`, `setLaborJobs`.
- **Derived values (per-render, unmemoized):** `laborMissingFields` / `laborCanSubmit` (~173–195) — the render-time copy of the validation (see quirk #3).
- **Handlers:** `saveLaborJob` (INSERT `people_labor_jobs` then sequential per-row INSERT `people_labor_job_items`, abort on first item error; job-level `labor_rate` = first valid row's rate; on success resets the form, `setActiveTab('sub_sheet_ledger')`, `closeLaborModal()`, `loadLaborJobs()`), `saveEditedLaborJob` (UPDATE job → DELETE all items → sequential re-INSERT — full item replacement, see quirk #5), `openNewLaborJob`, `openEditLaborJob` (hydrates rows from `job.items`; entry-mode detection `allDirect` → `'simple'`), `resetLaborForm`, `closeLaborModal` (also clears the parent-side edit-payment state via `onClearEditPayment()`), `fillLaborFromBilling` (HCP → `jobs` match → address + roster-intersected team names), `printLaborSubSheet` (unsaved-form print via `buildLaborFormSubSheetHtml` + `openHtmlPrintWindow`; the saved-job Print button calls the parent's `printJobSubSheet(editingLaborJob)` instead), `loadServiceTypes`.
- **Effects:** load service types when `(laborModalOpen || editingLaborJob) && authUserId`; crew-search auto-expands S2's collapsed groups; service-type change reloads fixture types + labor-book versions (S6); `laborBookEntriesVersionId` change loads entries (S6).
- **Imperative handle (~1044–1060):** `open()` = bare `setLaborModalOpen(true)` **with no form reset** (preserves the old `?newJob=` deep-link behavior — quirk #1); `openNew()`; `openEdit(job)`; `openNewWithJobNumber(jobNumber)` (the `?editLabor=` no-match fallback); `openWithBillingPrefill(seed)` (Billing tab "Add Labor" — reset, seed HCP/address, roster-intersect `teamMemberNames`).
- **Supabase tables:** `people_labor_jobs` (INSERT/UPDATE), `people_labor_job_items` (INSERT/DELETE), `service_types` (SELECT, cast `as any`).
- **External coupling:** the parent's `?editLabor=` / `?newJob=` router effects call the handle and MUST gate on `laborJobsLoadedOnce` (the v2.835 handle-gating rule in `JOBS_TABS_ARCHITECTURE.md`); `JobsSubLaborFormModal.render.test.tsx` pins the handle contract (bare `open()` preserves state, `openNew()` resets).
- **Extraction status + risk + approach:** **This is the shell — it does not move.** High risk to touch: the always-mounted + state-survives-close contract, the dual save pipelines, and the triplicated validation. Approach: shrink it by extracting S2–S7 around it and by Stage-A'ing the validation/payload builders (below) so `saveLaborJob`/`saveEditedLaborJob` become thin IO wrappers over tested kernels.

### S2 — Crew picker (External Subs / Internal Subs / Office Team)

- **Render location:** the "Subcontractors" block ~1160–1310 (search input, "No crew match" empty state, External Subs checkbox panel + **Add Sub** button, collapsible Internal Subs, collapsible Office Team). Helper functions ~250–326.
- **Owned local state:** `laborCrewSearch`, `laborModalInternalSubsOpen`, `laborModalOfficeTeamOpen`.
- **Cross-component state:** `laborAssignedTo` (S1-owned; the checkboxes toggle names in it), `showAddSubcontractorModal` (opens S7), props `users`/`people`.
- **Derived values (per-render):** `laborModalExternalSubsAll/Shown`, `laborModalInternalSubsAll/Shown`, `laborModalOfficeTeamAll/Shown` — built from `rosterSubcontractorsWithoutAccount()` / `rosterSubcontractorsWithAccount()` / `rosterNamesEveryoneElse()` filtered by [`filterLaborCrewNames`](../src/lib/jobs/jobFormatting.ts) (already lib'd).
- **Handlers/helpers:** `byKind(k)` (merges `users` by role — `KIND_TO_USER_ROLE` map, `isAssistantLike` for assistants — with non-user `people` by kind, deduped by `isAlreadyUser(email)`), `rosterNamesSubcontractors` (subs + primaries), `rosterSubcontractorsWithAccount` (source `'user'` only), `rosterSubcontractorsWithoutAccount` (source `'people'` subs only), `rosterNamesEveryoneElse` (master_technician/assistant/estimator/primary/superintendent + dev users, first-kind-wins dedupe). Note `rosterNames*` are also called by `fillLaborFromBilling` and `openWithBillingPrefill` (S1) for the roster-name intersection.
- **Supabase tables:** none (pure over props).
- **Extraction status + risk + approach:** Inline, **low-med risk**. Stage A first: move `byKind`/`rosterNames*`/`isAlreadyUser` + `KIND_TO_USER_ROLE` to `src/lib/jobs/subLaborRoster.ts` with tests (pure over `(users, people)`), which also unblocks S1's prefill intersection without a component dependency. Stage B: a controlled `SubLaborCrewPicker` taking `users`, `people`, `assignedNames` + `onToggleName`, `onAddSub` — it keeps `laborCrewSearch` and the two collapse booleans as its own state **only if** the always-mounted shell keeps it mounted (state persistence contract); otherwise lift those three into the shell too.

### S3 — Fixture rows editor (simple ⇄ itemized)

- **Render location:** the IIFE block ~1311–1656: `laborModalLineFallbackRate` + `laborModalLinesSubtotal` computed at the top, `itemizeTotalsFirstCell` (the "Itemize hours and rate" toggle cell shared by both tables), then either the **simple** table (Line item + Cost) or the **itemized** table (Count / hrs-per-unit / fixed / Labor Hours / Rate / Cost), the Link Invoice + "Add line item" button row, and the "Total labor cost" footer (~1645–1656).
- **Owned local state:** `laborFixtureRows` (row shape `LaborFixtureRow`: `id` (crypto.randomUUID), `fixture`, `count`, `hrs_per_unit`, `is_fixed`, `labor_rate`, `direct_labor_amount`), `laborFixtureEntryMode` (`'simple' | 'itemized'`).
- **Cross-component state:** rows are read by S1 (save/validation/print) and written by S6 (`applyLaborBookHoursToPeople`); `editingLaborJob?.labor_rate` and the parent's `defaultLaborRateValue` feed rate fallbacks.
- **Derived values:** fallback-rate chain `editingLaborJob?.labor_rate ?? first non-zero row rate ?? 20` (computed **three separate times** in the file — S3 table, total-cost footer, S5 payments); per-line cost via [`lineLaborCost`](../src/lib/peopleLaborJobItemLineCost.ts) and subtotal via `laborItemsSubtotal` (both already lib'd + tested).
- **Handlers:** `addLaborFixtureRow` (rate seeded from `defaultLaborRateValue` else 20), `removeLaborFixtureRow` (floor of 1 row), `updateLaborFixtureRow`, `handleLaborFixtureEntryModeToggle` (itemized→simple **converts each row's dollar total into `direct_labor_amount`** via `lineLaborCost`; simple→itemized nulls `direct_labor_amount` — quirk #6).
- **Supabase tables:** none (rows persist via S1's save pipeline).
- **Extraction status + risk + approach:** Inline, **medium risk** (mode semantics leak into S1's validation and item-INSERT payload shaping). Stage A first: `parseDefaultLaborRate` and the validation/payload kernels (see inventory). Stage B: a controlled `SubLaborFixtureRowsEditor` with `rows`, `mode`, `fallbackRate`, `onRowsChange`, `onModeToggle` — the invoice-link row (S4) currently renders *inside* this IIFE's footer; extract S4 first or move that JSX out of the IIFE.

### S4 — Invoice-link cluster

- **Render location:** "Link Invoice" button + "Linked" chip in the S3 footer row (~1534–1565); the expanded draft panel ~1585–1641.
- **Owned local state:** `laborInvoiceLinkExpanded`, `laborInvoiceLinkDraft`, `laborInvoiceLinkCommitted`, `laborInvoiceLinkSaving`.
- **Handlers:** `saveLaborInvoiceLinkDraft` — normalizes via [`resolvedLaborInvoiceLink`](../src/lib/jobs/jobAddressUrls.ts) (lib'd + tested); in **edit mode** it UPDATEs `people_labor_jobs.invoice_link` immediately and optimistically patches `setEditingLaborJob` + `setLaborJobs` (parent cache), reverting the local strings on error; in **new mode** it only commits locally and the link rides along in `saveLaborJob`'s INSERT. `cancelLaborInvoiceLinkDraft` restores the committed value.
- **Supabase tables:** `people_labor_jobs` (UPDATE, edit mode only).
- **Extraction status + risk + approach:** Inline, **low risk** but dual-mode (immediate-write vs deferred) must be preserved. Extract as a small controlled component or fold into the S3 extraction; the `setLaborJobs`/`setEditingLaborJob` patches stay wired to parent props.

### S5 — Payments section (edit mode only)

- **Render location:** `{editingLaborJob && (…)}` "Payments" block ~1658–1715: totals line, payments table (Date/Type/Amount/Memo/Edit), Payment + Backcharge buttons.
- **Owned local state:** none — pure render over `editingLaborJob.payments`.
- **Derived values (inline IIFE):** `laborTotal` via `laborItemsSubtotal`, `paid` (amounts ≥ 0), `backcharges` (abs of negatives), `totalCost` fallback `paid + backcharges` when the computed total is 0 (quirk #8), `balance`.
- **Handlers:** none of its own — calls the three opener props `onOpenEditPayment` / `onOpenMakePayment` (seeded with the outstanding balance) / `onOpenBackcharge`, which the parent routes to [`SubLaborPaymentModals`](../src/components/jobs/SubLaborPaymentModals.tsx)' imperative handle (v2.824 — the trio stays a parent-side sibling because the Sub Labor tab's ledger rows open it too).
- **Supabase tables:** none.
- **Extraction status + risk + approach:** Inline, **low risk**. Stage A: `summarizeSubLaborPayments(rows, laborTotal)` pure kernel + tests (check `lib/jobs/subLaborCost` / `buildSubLaborOutstandingByPerson` for an existing equivalent first). Stage B: trivial presentational component taking `laborJob`, `laborTotal`, and the three openers.

### S6 — Labor book section + version/entry form modals

- **Render location:** collapsible "Labor book" section ~1716–1874 (version select + "Apply matching Labor Hours" + apply message; version chips with ✎; entries table with ✎; Add version / Add entry buttons). Its two stacked form modals render after the main modal: version form `{laborVersionFormOpen && …}` ~2046–2079, entry form `{laborEntryFormOpen && laborBookEntriesVersionId && …}` ~2081–2141. State + CRUD ~130–149 and ~328–603.
- **Owned local state (~20 vars):** `fixtureTypes`, `laborBookVersions`, `selectedLaborBookVersionId` (apply-source version), `laborBookSectionOpen`, `laborBookEntriesVersionId` (which version's entries table is open — distinct from the apply select), `laborBookEntries`, `applyingLaborBookHours`, `laborBookApplyMessage` (3s auto-clear timeout), `laborVersionFormOpen`, `editingLaborVersion`, `laborVersionNameInput`, `savingLaborVersion`, `laborEntryFormOpen`, `editingLaborEntry`, `laborEntryFixtureName`, `laborEntryAliasNames`, `laborEntryRoughIn/TopOut/TrimSet`, `savingLaborEntry`.
- **Cross-component state:** `selectedServiceTypeId` (S1 — scopes fixture types and versions; the reload effect also clears `laborBookEntriesVersionId`), `laborFixtureRows` + `laborFixtureEntryMode` (S3 — `applyLaborBookHoursToPeople` writes matched rows' `hrs_per_unit` and nulls `direct_labor_amount`; the apply button is disabled in simple mode), page-global `error` (rendered inside the entry form modal too — quirk #12).
- **Handlers/loaders:** `loadFixtureTypes`, `loadLaborBookVersions` (auto-selects the version named `'Default'` else first), `loadLaborBookEntries(versionId)` (with `fixture_types(name)` join), `applyLaborBookHoursToPeople` (fetches the apply-version's entries, builds a lowercase name→total-hours map over primary fixture names **and** `alias_names`, first-match-wins), `getFixtureTypeIdByName` / `getOrCreateFixtureTypeId` (auto-creates missing fixture types with `category: 'Other'`, `sequence_order` = max+1 — quirk #11), version CRUD (`openNewLaborVersion`/`openEditLaborVersion`/`closeLaborVersionForm`/`saveLaborVersion`/`deleteLaborVersion` — browser `confirm()`, 'Default' has no delete button), entry CRUD (`openNewLaborEntry`/`openEditLaborEntry`/`closeLaborEntryForm`/`saveLaborEntry` — `sequence_order` = max+1, alias names comma-split/`parseFloat || 0` hours/`deleteLaborEntry` with `confirm()`).
- **Supabase tables:** `labor_book_versions` (SELECT/INSERT/UPDATE/DELETE), `labor_book_entries` (SELECT/INSERT/UPDATE/DELETE), `fixture_types` (SELECT/INSERT).
- **External coupling:** none beyond the form. (The same `labor_book_*` tables are read by `useJobDetailSubLaborCost` for DetailJobModal's profit band — DB-level coupling only.)
- **Extraction status + risk + approach:** Inline, **low-med risk — the best first component extraction** in this file: a large self-contained state cluster whose only inward touch is the row-apply write. Extract `SubLaborLaborBookSection` (section + both stacked modals) taking `selectedServiceTypeId`, `entryMode`, `fixtureRowsHaveNames` (or the rows), `onApplyHours(rowsUpdater | index)`, `error`/`onError` — keep the two "which version" states separate. Stage A first: `buildLaborBookHoursIndex(entries)` + `applyLaborBookHoursToRows(rows, index)` pure kernels with tests (alias precedence, first-match-wins, `direct_labor_amount: null` reset).

### S7 — Add Subcontractor modal

- **Render location:** `{showAddSubcontractorModal && …}` ~1971–2044 (zIndex 60, above the main modal's 50). Handlers ~197–248.
- **Owned local state:** `showAddSubcontractorModal`, `newSubcontractor` (`{name,email,phone,notes}`), `addSubcontractorError` (modal-local, NOT the page-global `error`), `savingAddSubcontractor`.
- **Handlers:** `checkDuplicateName` (parallel SELECTs over non-archived `people` + all `users`, case-insensitive name match), `handleSaveAddSubcontractor` (INSERT `people` with `kind: 'sub'`, `master_user_id: authUserId`; then `loadRoster()` and auto-checks the new name into `laborAssignedTo`).
- **Supabase tables:** `people` (SELECT/INSERT), `users` (SELECT).
- **External coupling:** `loadRoster` prop (parent roster refresh); opened only from S2's "Add Sub" button.
- **Extraction status + risk + approach:** Inline, **low risk — trivial**. Extract `AddSubcontractorModal` with `open`, `onClose`, `authUserId`, `loadRoster`, `onCreated(name)` (the parent shell appends to `laborAssignedTo`). Stage A: none needed (`checkDuplicateName` is IO; could move to lib taking supabase if desired).

---

## DetailJobModal dossiers

Component: default-export function `DetailJobModal`. ~25 `useState`, 10 `useEffect`, ~14 `useMemo`/`useCallback`, 2 refs, 5 data hooks, 3 contexts (`useJobFormModal`, `useToastContext`, `useUpdateFocusOpenerBridge`) + `useAuth` + `useNavigate`. Renders `null` when `!open`. Overlay zIndex 1004 (Edit Job's 1010 stacks above; add-link 1006, stacked files 1007, reports 1100).

### D1 — Module-level helpers + presentational components (~99–517)

- **Pure functions:** `splitScheduleDetailRowLabel` (exported; first-` · `-only split), `formatJobDetailModalTitle`, `googleMapsSearchUrlForAddress`, `formatCurrency` (a **local duplicate** of the lib formatter — preserve output format if moved), `jobDetailBillingHoverTitle`, `mergeLimitedFromAssignedAndLedger` (assigned-row → `LimitedJobDetailSnapshot` stub with `status: 'working'`).
- **IO helper:** `fetchLimitedLedgerRow(jobId)` — `jobs_ledger` column-only SELECT with `service_types:service_type_id(name)` join, `withSupabaseRetry`, returns `null` on any failure.
- **Presentational components:** `StackedClockSessionTimestamp`, `DetailRow` (label/value with `noBottomMargin`/`centered`/`softBox`), `DetailJobModalCustomerPanel` (tel:/mailto: via `openInExternalBrowser`, `[missing …]` placeholders), `JobDetailLinkIcons` (Customer Files / Customer Photos icon pair; blue=open, grey=add-for-editors/inert-for-subs), `DetailJobModalFilesPlansRow` (Job Plans button; omitted when empty). Shared style consts `detailRowSoftBoxStyle`, `linkLikeValueStyle`, `customerPanel*Style`, `detailJobFilesPlansButtonStyle`.
- **Extraction status + risk + approach:** **Low risk, pure file moves.** Stage A: the pure functions → `src/lib/jobs/jobDetailModalPresentation.ts` (or split) + tests; `fetchLimitedLedgerRow` + `mergeLimitedFromAssignedAndLedger` → `src/lib/jobs/limitedJobDetail.ts`. The presentational components can move verbatim to `src/components/jobs/jobDetailModalParts.tsx` (or individual files); `DetailRow`/`StackedClockSessionTimestamp` are used across D6/D7 so move them before the body extraction.

### D2 — Data core (two-tier fetch + race guard)

- **Location:** `loadDetail` useCallback (~565–601) + the open/jobId reset effect + the `teamMemberNameFallback` effect (~548–563) + per-open reset effects for `scheduleTimeSectionOpen`, `jobDetailScheduleSessionsFilter`, `reportsModalOpen`.
- **Owned state:** `loading`, `error` (modal-local — NOT Jobs' page-global error), `fullJob: JobWithDetails | null`, `limitedJob: LimitedJobDetailSnapshot | null`, `detailFetchIdRef` (monotonic race guard: every load bumps it; stale responses are dropped), `materialsCostRefreshKey`, `teamMemberNameFallback` (Map from RPC `list_user_display_names` via [`fetchUserNamesForIds`](../src/lib/scheduleDispatchHub.ts) — resolves archived users the `users` RLS hides).
- **Logic:** `isStaffFullJobLedgerDetailRole(authRole)` → full path [`fetchJobWithDetailsById`](../src/lib/fetchJobWithDetailsById.ts); otherwise limited path = `assignedJobsRows.find` + `fetchLimitedLedgerRow` merged by `mergeLimitedFromAssignedAndLedger` (ledger row wins).
- **Callers of `loadDetail` besides the open effect:** `saveAddLink`, `saveStackedFilesLink`, `commitPctWithNote`, Edit-Job `onSaved` (which also bumps `materialsCostRefreshKey`).
- **Extraction status + risk + approach:** **This is the shell — stays.** If desired later, the quartet (`fullJob`/`limitedJob`/`loading`/`error` + `loadDetail` + race guard) can become `useJobDetailData(open, jobId, authRole, assignedJobsRows)` — a clean hook seam since nothing else owns state it needs — but it is not required for the body extractions.

### D3 — Header action cluster (~1037–1210)

- **State/derived:** `modalTitle` memo (loaded job → error → `prefillRowLabel` split → fallback), `headerTradePill` / `headerTradePillTitleText` memos ([`buildServiceTypeTradePill`](../src/lib/serviceTypeTradePill.ts)), `tradePillOpensStages`, `showWeekDispatchButton` (dev/master/assistant-like/superintendent + `fullJob` — mirrors Jobs.tsx `canOpenJobScheduleModal`), `showEditJobButton`, `showDetailHeaderRightCluster`, `paidEmailModalOpen`, `jobCalendarOpen`.
- **Handlers:** `handleTradePillClick` (onClose + `navigate('/jobs?tab=stages&stagesJob=…')`), calendar button → `setJobCalendarOpen(true)`, ✉ paid-email button (dev/master only) → `setPaidEmailModalOpen(true)`, `handleEditJobClick` (**replaces, not stacks**: `jobFormModal.openEditJob(jobId, { initialJob, onSaved })` then `onClose()` — Edit Job's footer reopens Job Detail via the opener bridge), `handleOpenWeekDispatch(selectedYmd)` (onClose + navigate to `/schedule-dispatch?jobId=…&week=…` using `companyWeekStartSundayContaining`/`getDefaultWeekRange`), close button. **Escape** also closes (v2.1104): a window listener gated by `detailEscBlocked` (OR of the four satellite open flags + `stackedAddFilesOpen`) so Esc never closes Job Detail under a stacked modal; `JobCalendarModal` and `PaidJobEmailSendModal` close themselves on Esc (the latter with `preventDefault`).
- **Supabase tables:** none directly.
- **Extraction status + risk + approach:** Inline, **medium risk** (navigation + self-close choreography + the Edit-Job replace contract). Extract `JobDetailHeader` last among the D extractions, or leave it in the shell — it is only ~210 lines and everything it does is orchestration the shell owns anyway.

### D4 — Top band + Street View (~1212–1366; effect ~765–835)

- **State:** `streetViewImgUrl`, `streetViewLatLng`, `streetViewLoading`, `streetViewBlobUrlRef` (blob-URL lifecycle: revoked on address change/close/unmount), `addLinkTarget`/`addLinkUrl` seeds (opened from `JobDetailLinkIcons`).
- **Derived:** `mapsAddressLine` memo (job address else `prefillAddress`), `topBandLeftActive`, `showTopBand`, `detailJob` memo (`fullJob ?? limitedJob`, only when `!loading && !error`).
- **Handlers/effects:** the Street View effect ([`fetchStreetViewMeta`](../src/lib/fetchStreetViewPreview.ts) then `fetchStreetViewImageBlob` → object URL; cancellation flag + revoke), `openMapsAddress`, `openStreetView` (pano URL when coords exist, else Maps search).
- **Renders:** `JobDetailLinkIcons` (canEdit = `canEditJobLinks` = non-subcontractor-like), address link, `scheduleContext` block (`scheduleFormatWeekdayOnly` / `scheduleFormatDateLongNoWeekday` / `scheduleFormatWindow` from [`jobScheduleChicago`](../src/lib/jobScheduleChicago.ts)), `DetailJobModalCustomerPanel`, Street View thumbnail.
- **Extraction status + risk + approach:** Inline, **low risk — good early extraction**. `JobDetailTopBand` taking `mapsAddressLine`, `scheduleContext`, `detailJob`, `canEditJobLinks`, `onAddLink`; the Street View effect + its three states move with it (fully self-contained per-address lifecycle).

### D5 — Thread notes + % complete (~894–930, JSX ~1368–1400)

- **State:** `pctSaving`; everything else lives in [`useJobThreadNotesForModal`](../src/hooks/useJobThreadNotesForModal.ts) (already extracted).
- **Derived:** `canEditJobPctComplete` (dev / master / assistant-like / primary — same roles as Pipeline).
- **Handlers:** `commitPctWithNote(value, note)` — posts the thread note first via `threadNotes.submitNoteWithBody(composePctCompleteNoteBody(value, note), 'draft')` (**bails silently if the note post fails — no pct write**), then UPDATEs `jobs_ledger.pct_complete`, toasts, `loadDetail()`. Arrived/Leaving stamps via `threadNotes.submitStamp`; a successful "leaving" also calls `requestOpenUpdateFocus()` (opener-bridge context).
- **Renders:** [`JobThreadNotesPanel`](../src/components/JobThreadNotesPanel.tsx) (extracted, 939 lines) with chrome-light props.
- **Supabase tables:** `jobs_ledger` (UPDATE `pct_complete`); notes tables inside the hook.
- **Extraction status:** **mostly done** — only `commitPctWithNote` + the role memo are inline; they can move into the hook or stay in the shell. Low value to extract further.

### D6 — Full-job body (~1407–1708)

- **Render gate:** `{!loading && !error && fullJob}`.
- **Sections in order:** Workflow project link (`showWorkflowLink && fullJob.project_id`); the three-date band (`jobDetailDateBandStyle` memo — grid on wide, column on `useNarrowViewport640`): Last work date, Last bill date (from `fullJobRecordedBilling` = [`deriveRecordedBillingActivityDetail`](../src/lib/stagesJobReferenceDates.ts) memo — invoice/payment activity; the manual `last_bill_date` row retired in v2.1154); Status via [`JobLedgerStatusPipeline`](../src/components/jobs/JobLedgerStatusPipeline.tsx); `DetailJobModalFilesPlansRow`; **Assigned Team** list (embedded name → `teamMemberNameFallback` → `…`); Job Start / Last Work clock-bounds band (`jobStartParts`/`lastWorkParts` memos over [`useJobClockSessionBounds`](../src/hooks/useJobClockSessionBounds.ts) + [`formatClockSessionTimestampPartsChicago`](../src/lib/formatClockSessionTimestamp.ts)) + the **Reports** soft-box button (`setReportsModalOpen`); the collapsible **Schedule and recorded time** section (`scheduleTimeSectionOpen`, `jobDetailScheduleSessionsFilter` search input, [`JobDetailScheduleSessionsSection`](../src/components/jobs/JobDetailScheduleSessionsSection.tsx) fed by [`useJobDetailScheduleAndSessions`](../src/hooks/useJobDetailScheduleAndSessions.ts) — fetch gated on the section being open); materials cost ([`JobDetailMaterialsCostSection`](../src/components/jobs/JobDetailMaterialsCostSection.tsx) over [`useJobMaterialsCostSnapshot`](../src/hooks/useJobMaterialsCostSnapshot.ts)) + [`JobChargesTimelineStandalone`](../src/components/jobs/JobChargesTimelineStandalone.tsx) (`includeTeamLabor={showJobCostBreakdownTeamLabor(authRole)}` — dev/master only, wage-privacy gate); profit band ([`JobDetailProfitSection`](../src/components/jobs/JobDetailProfitSection.tsx) over `profitSummary` memo = [`buildJobProfitSummary`](../src/lib/jobs/jobProfitSummary.ts) joining [`useJobDetailSubLaborCost`](../src/hooks/useJobDetailSubLaborCost.ts) + `tallyPartsTotalFromLines(materialsSnapshot.tallyPartLines)` — null on `tallyFetchFailed`, never a fake $0); numbered **Specific Work** fixtures list (`@ $… ea.` unit price, description second line); **Job Total** (`showJobDetailJobTotal(authRole)`); **Payments** list; **Invoices** list.
- **Role gates (all in [`jobDetailModalRole.ts`](../src/lib/jobDetailModalRole.ts), tested):** `showMaterialsCostSection` memo (`canExpandJobDetailMaterials` + full job, or limited for superintendent/estimator), `showProfitSection` (`showJobDetailProfitSection` — dev/master + full job), `showJobDetailJobTotal`, `showJobCostBreakdownTeamLabor`.
- **Supabase tables:** none directly (all via hooks/libs).
- **Extraction status + risk + approach:** Inline, **medium risk** (large prop surface, ~15 inputs). Extract `JobDetailFullBody` receiving `fullJob`, `authRole`, the hook outputs (`materialsSnapshot*`, `profit*`, `clockSessionBounds`/parts memos, schedule-sessions bundle), the two section-open states + setters (or own them, since the reset-on-jobId effects would move too), and `onOpenReports`. Do D1's `DetailRow`/`StackedClockSessionTimestamp` moves first.

### D7 — Limited-job body (~1710–1792)

- **Render gate:** `{!loading && !error && limitedJob}`.
- **Sections:** Workflow link, the date band (**Last bill date is hardcoded `—`** — invoices/payments aren't loaded on the limited fetch), status pipeline, files/plans row, materials section (superintendent/estimator only, `billedMaterials={[]}`), Job Total (role-gated), and the muted "Payments and invoices are not shown in this view." / "You are assigned on this job." footer.
- **Extraction status + risk + approach:** Inline, **low risk** — extract as `JobDetailLimitedBody` alongside D6 (shares `DetailRow`, the band styles, and the materials props).

### D8 — Add-link modal + stacked Customer-Files modal (~840–893 state/handlers; JSX ~1820–1979)

- **State:** `addLinkTarget: JobDetailAddLinkTarget | null` (field = `google_drive_link` | `job_pictures_link`), `addLinkUrl`, `addLinkSaving`; stacked: `stackedAddFilesOpen`, `stackedFilesUrl`, `stackedFilesSaving`.
- **Handlers:** `saveAddLink` / `saveStackedFilesLink` — `/^https?:\/\/\S+$/i` validation toast, `withSupabaseRetry` UPDATE on `jobs_ledger`, success toast, `loadDetail()`. The photos variant's footer has **Company** (hardcoded Company-Customers Drive folder URL — appears 3× in the file) and **Customer** (opens the job's `google_drive_link`, else opens the stacked Add-Customer-Files dialog at zIndex 1007).
- **Supabase tables:** `jobs_ledger` (UPDATE `google_drive_link` / `job_pictures_link`).
- **Extraction status + risk + approach:** Inline, **low risk — trivial**. Extract `JobDetailAddLinkModals` with `jobId`, `target`/`onCloseTarget`, current `google_drive_link`, `onSaved: loadDetail`, `showToast`. Keep the hardcoded Drive URL as a named const (behavior-preserving).

### D9 — Satellite modal mounts (~1980–2032)

- `JobCalendarModal` (extracted, 421 lines; `onOpenSchedule` → seeds `detailScheduleInitialDate` + opens `ScheduleJobModal`; `onOpenWeekDispatch` → `handleOpenWeekDispatch`), `ScheduleJobModal` (extracted, 808 lines; keyed by `fullJob.id`), `JobReportsModal` (extracted, zIndex 1100), `PaidJobEmailSendModal` (extracted; preview-first since v2.1099 — renders the email inline in a sandboxed iframe with a Detailed|Summary toggle, "Send to me" ([TEST]) + "Send to someone…" picker in the header; the header ✉ trigger is now a 20px SVG matching the calendar/edit icons).
- **Status:** all four are already components; their mount conditions + the tiny open states (`jobCalendarOpen`, `detailScheduleModalOpen`, `detailScheduleInitialDate`, `reportsModalOpen`, `paidEmailModalOpen`) stay in the shell (opened from both header and body).

---

## Preserve-quirks list (odd but load-bearing — do not "fix" during a move)

### JobsSubLaborFormModal

1. **Bare `open()` performs NO form reset** — it exists solely to preserve the pre-extraction `?newJob=` deep-link behavior (`setLaborModalOpen(true)` only). `openNew()` resets. [`JobsSubLaborFormModal.render.test.tsx`](../src/components/jobs/JobsSubLaborFormModal.render.test.tsx) asserts both.
2. **Always mounted; state survives close.** The component's whole contract (v2.823). Any extraction that conditionally mounts a sub-section holding form state changes behavior.
3. **The validation logic exists in three near-copies**: render-time `laborMissingFields` (~173–195), `saveLaborJob` (~636–692), `saveEditedLaborJob` (~890–946). The save-time copies are identical to each other; the render-time itemized rule differs subtly (it does not fail fixed rows with negative hrs — save-time does). Stage A must consolidate **without changing any branch's messages or outcomes**.
4. **Item write shape is mode-dependent:** simple mode persists `count: 1, hrs_per_unit: 0, is_fixed: false, labor_rate: null` + `direct_labor_amount`; itemized persists real values + `direct_labor_amount: null`. Job-level `labor_rate` = the **first valid row's** rate (both modes).
5. **Edit save is delete-all-then-reinsert** on `people_labor_job_items`, with sequential INSERTs aborting on first error — a failure mid-loop leaves the job with partial items (no transaction). Preserve.
6. **Itemized→simple mode toggle converts** each row's computed dollar cost into `direct_labor_amount` via `lineLaborCost` with fallback `editingLaborJob?.labor_rate ?? row0.labor_rate ?? 20`; simple→itemized nulls the amounts (hours are NOT reconstructed).
7. **The literal `20` default rate** and the `parseFloat(defaultLaborRateValue) || 20` pattern appear ~5×; the fallback-rate chain `editingLaborJob?.labor_rate ?? first non-zero row rate ?? 20` is computed 3× per render.
8. **Payments totals fallback:** when the computed labor total is 0 but payments/backcharges exist, `totalCost = paid + backcharges` (so the balance reads $0 due rather than negative).
9. **`laborDate` default `new Date().toLocaleDateString('en-CA')`** — local-timezone YYYY-MM-DD. `job_number` is truncated `.slice(0, 10)`.
10. **`openEditLaborJob` mode detection:** `'simple'` only when the job has items AND every item has a finite `direct_labor_amount`; otherwise `'itemized'` (rows' missing per-line rate falls back to the job's `labor_rate`).
11. **`getOrCreateFixtureTypeId` silently creates fixture types** (`category: 'Other'`, next `sequence_order`) when a labor-book entry names an unknown fixture; failure logs to console and aborts the entry save with a message.
12. **Page-global `error` renders in two places** in this file (main form top + labor-book entry modal) and is shared with every Jobs tab — a labor error can appear on Pipeline and vice versa. Keep the single state.
13. **`closeLaborModal` calls `onClearEditPayment()`** — closing the form also clears the parent-side SubLaborPaymentModals edit target.
14. **Invoice-link save is dual-mode** (immediate UPDATE + optimistic parent-cache patch in edit mode; deferred to the job INSERT in new mode) — see S4.
15. **Handle-gating rule:** parent router effects that call this modal's ref must gate on `useSubLaborLedger`'s `laborJobsLoadedOnce` (v2.835) — an ungated cold-load call no-ops while stripping the URL param.

### DetailJobModal

16. **Two-tier fetch by role:** `isStaffFullJobLedgerDetailRole` → full `fetchJobWithDetailsById`; everyone else gets the limited `jobs_ledger` row merged over the `assignedJobsRows` prop (ledger wins; the assigned-row stub hardcodes `status: 'working'` and null customer fields). Since v2.2848 the same predicate (via `resolveJobWindowMode`) decides window vs. standalone pane in `JobDetailModalContext`, and gates the standalone ⚙ Edit gear — the two tiers and the two surfaces must never disagree, or the edit form mounts for a role whose fetch returns null and self-closes.
17. **`detailFetchIdRef` race guard** — every open/close/jobId change bumps it; stale fetches are dropped. Preserve in any `useJobDetailData` hook extraction.
18. **Edit Job replaces (not stacks on) Job Detail** — `handleEditJobClick` opens the singleton Edit Job and then `onClose()`es itself; Edit Job's footer reopens Job Detail via the opener bridge. Closing/saving Edit lands on whatever was under Job Detail.
19. **`commitPctWithNote` posts the thread note first and bails silently if it fails** — `pct_complete` is never written without its note.
20. **Local `formatCurrency` duplicate** (module-level in this file) — distinct from `lib/jobs/jobFormatting`'s. Consolidate only in a dedicated pass with output-format proof.
21. **Limited body's "Last bill date" is always `—`** (derived billing needs invoices/payments, which the limited fetch omits); the full body's "Last bill date" is *derived activity* (`deriveRecordedBillingActivityDetail`). The raw `last_bill_date` column and its "Last manual bill date" row retired in v2.1154.
22. **Street View blob-URL lifecycle:** object URL held in `streetViewBlobUrlRef`, revoked on address change, close, unmount, and error. Moving the effect must keep every revoke path.
23. **Hardcoded Company-Customers Drive folder URL** appears 3× (add-link + stacked modals).
24. **zIndex ladder:** backdrop 1004 < Edit Job 1010; add-link 1006 < stacked files 1007; reports 1100. Sub-labor modal uses 50/60 (it lives under Jobs' stacking context).
25. **`useBodyScrollLock(open && narrowViewport)`** — scroll lock only on narrow viewports.
26. **`materialsCostRefreshKey`** re-runs BOTH `useJobMaterialsCostSnapshot` and `useJobClockSessionBounds`; it is bumped only by Edit-Job `onSaved`.
27. **Per-open resets:** `scheduleTimeSectionOpen`, `jobDetailScheduleSessionsFilter`, `reportsModalOpen` each reset on `open`/`jobId` change via separate effects; the schedule-sessions fetch runs only while the section is open.
28. **`teamMemberNameFallback`** exists because the `users` RLS hides archived rows from non-devs — team members render embedded name → RPC fallback (`list_user_display_names`) → `…`.

---

## Stage-A pure-logic inventory (extract to `src/lib/*` + tests before any component moves)

Already lib'd + tested (do NOT re-extract): `lineLaborCost`/`laborItemsSubtotal`, `filterLaborCrewNames`, `formatCurrency` (lib copy), `resolvedLaborInvoiceLink`, `buildLaborFormSubSheetHtml`, `composePctCompleteNoteBody`, `buildJobProfitSummary`, `jobDetailModalRole` gates, `formatJobDetailModalDateYmd`, `serviceTypeTradePill`, `stagesJobReferenceDates`, `jobScheduleChicago`, `formatClockSessionTimestamp`, `combinePeople` (`LABOR_ASSIGNED_DELIMITER`).

| Candidate | Currently | Target |
|---|---|---|
| Sub-labor form validation (the three near-copies: `laborMissingFields`, `saveLaborJob` errors, `saveEditedLaborJob` errors) | inline ×3 in `JobsSubLaborFormModal.tsx` | `lib/jobs/subLaborFormValidation.ts` — `subLaborMissingFields(...)` + `subLaborSaveErrors(...)` returning the exact message strings; tests per mode/branch. **Biggest win in the file.** |
| Valid-row filter + item INSERT payload shaping (mode-dependent, duplicated in both save paths) | inline ×2 | `lib/jobs/subLaborItemPayload.ts` — `filterValidLaborRows(rows, mode)` + `buildLaborJobItemInserts(rows, mode)` + tests |
| Roster partitioning: `byKind`, `isAlreadyUser`, `rosterNamesSubcontractors`, `rosterSubcontractorsWithAccount`, `rosterSubcontractorsWithoutAccount`, `rosterNamesEveryoneElse`, `KIND_TO_USER_ROLE` | inline in component body | `lib/jobs/subLaborRoster.ts` (pure over `(users, people)`) + tests (dedupe order, dev append, email match) |
| Labor-book hours apply: alias-map build + row mapping inside `applyLaborBookHoursToPeople` | inline | `lib/jobs/laborBookHours.ts` — `buildLaborBookHoursIndex(entries)` + `applyLaborBookHoursToRows(rows, index)` + tests (alias precedence, first-match-wins, `direct_labor_amount` reset) |
| Default-rate parse `defaultLaborRateValue.trim() !== '' && !isNaN(parseFloat(v)) ? parseFloat(v) || 20 : 20` (~5 copies) | inline | `parseDefaultLaborRate(value: string): number` in `lib/jobs/subLaborFormValidation.ts` (or jobFormatting) + test |
| Payments summary (paid / backcharges / totalCost-fallback / balance) | inline IIFE in S5 | `lib/jobs/subLaborPaymentsSummary.ts` + tests — **check `lib/jobs/subLaborCost` / `buildSubLaborOutstandingByPerson` for an existing equivalent first** |
| Fallback-rate chain (`editingJob?.labor_rate ?? first non-zero row rate ?? 20`, 3 render copies) | inline ×3 | `subLaborFallbackRate(job, rows)` alongside the validation lib |
| `formatJobDetailModalTitle`, `jobDetailBillingHoverTitle`, `googleMapsSearchUrlForAddress`, local `formatCurrency` | module-level in `DetailJobModal.tsx` | `lib/jobs/jobDetailModalPresentation.ts` + tests (`splitScheduleDetailRowLabel` is already exported — move it with them and re-export) |
| `mergeLimitedFromAssignedAndLedger` (pure) + `fetchLimitedLedgerRow` (IO) | module-level in `DetailJobModal.tsx` | `lib/jobs/limitedJobDetail.ts` — pure merge gets a test; the fetch takes supabase implicitly as today |

---

## Recommended extraction order (value ÷ risk)

Each step independently shippable; `npm run typecheck && npm run lint && npm test` green after every one; behavior-preserving only.

### JobsSubLaborFormModal (sub-decomposition of the modal)

1. **Stage A sweep** — validation kernel first (it also documents the 3-copy divergence, quirk #3), then item-payload, roster partition, labor-book hours, default-rate/fallback-rate, payments summary.
2. **S7 `AddSubcontractorModal`** — smallest, fully self-contained; validates the intra-modal prop seam.
3. **S6 `SubLaborLaborBookSection`** (+ its two stacked form modals) — the big self-contained cluster (~20 states, 3 tables); only inward touch is the rows-apply callback.
4. **S5 payments section + S4 invoice-link** — small presentational/controlled pieces over the Stage-A kernels.
5. **S2 `SubLaborCrewPicker`** — after the roster lib exists (S1's prefill intersection must not depend on the component).
6. **S3 `SubLaborFixtureRowsEditor`** — last; rows/mode stay shell-owned controlled props because S1 (save/validation/print) and S6 (apply) both touch them.

**Stays in the shell (the current file):** `laborModalOpen` + `editingLaborJob` gating, the imperative handle and all five entries, `resetLaborForm`/`closeLaborModal`, `saveLaborJob`/`saveEditedLaborJob` orchestration (thin over the kernels), `serviceTypes`/`selectedServiceTypeId`, `laborAssignedTo`/`laborFixtureRows`/`laborFixtureEntryMode` (multi-region state), and the page-global `error` pass-through. **Stays in `Jobs.tsx` (unchanged):** `editingLaborJob` ownership, the `?editLabor=`/`?newJob=` router with `laborJobsLoadedOnce` gating, `useSubLaborLedger`, `SubLaborPaymentModals`, the Drive Settings / Default Labor Rate modals, `printJobSubSheet`, roster loaders.

### DetailJobModal (sub-decomposition of the modal)

1. **Stage A / file moves** — D1 pure functions + `limitedJobDetail.ts`; move `DetailRow`/`StackedClockSessionTimestamp`/`DetailJobModalCustomerPanel`/`JobDetailLinkIcons`/`DetailJobModalFilesPlansRow` to component files.
2. **D8 `JobDetailAddLinkModals`** — self-contained, two tiny UPDATE handlers.
3. **D4 `JobDetailTopBand`** — takes the Street View effect + states with it.
4. **D6 `JobDetailFullBody` + D7 `JobDetailLimitedBody`** — the big JSX win (~385 lines); hook outputs and role gates passed as props; section-open states move with D6 (their reset effects too).
5. **(Optional) `useJobDetailData` hook** for D2's quartet, and **D3 `JobDetailHeader`** — only if the shell is still uncomfortably large afterwards.

**Stays in the shell:** `open`/`jobId`/`onClose` (context-owned selection — never moves), `loadDetail` + race guard + `materialsCostRefreshKey`, the five data-hook call sites and role-gate memos (multiple bands consume them), all satellite-modal open states + mounts (opened from header AND body), `handleEditJobClick`/`handleOpenWeekDispatch`/`handleTradePillClick` (navigation + self-close choreography), and the context wiring (`useJobFormModal`, toast, opener bridges, `useAuth`). **Stays in `JobDetailModalContext` (unchanged):** the open-state machine, `instanceKey` remounts, `assignedJobsRows` defaulting from `JobsListCache`, the opener-bridge registration.

---

Definition of done per step, verification gates, and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md). Note the render-test harness now exists (`*.render.test.tsx`, v2.833) — `JobsSubLaborFormModal.render.test.tsx` already pins the handle contract and must stay green through every step; adding a DetailJobModal render smoke before its body extraction is cheap insurance.
