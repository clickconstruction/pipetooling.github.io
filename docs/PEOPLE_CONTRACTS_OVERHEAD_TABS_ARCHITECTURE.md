# People Contracts + Overhead Tabs Architecture Map

---
file: docs/PEOPLE_CONTRACTS_OVERHEAD_TABS_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map (per PAGE_DECOMPOSITION_PLAYBOOK.md) for the two largest already-extracted People tabs — src/components/people/PeopleContractsTab.tsx (~2,981 lines) and src/components/people/PeopleOverheadTab.tsx (~2,510 lines). Inventories every region's state, handlers, supabase tables/RPCs, and coupling so their sub-decomposition (Stage-A lib extraction + modal/section component moves) can start without re-deriving the strategy.
audience: Developers, AI Agents
last_updated: 2026-09-05 (v2.2851 quick-send writes at Send)
---

## What this surface is

Both files are **already-extracted tabs** of `src/pages/People.tsx` (see [`PEOPLE_TABS_ARCHITECTURE.md`](./PEOPLE_TABS_ARCHITECTURE.md), rows `contracts` and `overhead` — both marked Done). They kept growing after extraction, the same pattern as `BidsTakeoffTab` and `PeopleReviewTab`, so this map treats each **tab component as the "parent"** and its modals/sections as the extraction units:

- [`src/components/people/PeopleContractsTab.tsx`](../src/components/people/PeopleContractsTab.tsx) — **2,981 lines**. Staff contract tracking: roster table with per-person document status, template management, template assignment, Add/Edit document modal (Upload Signed vs Request Signature), digital-signature send flow, Contract Book library. Props from `People.tsx`: `people`, `users`, `canDeletePeopleContracts`.
- [`src/components/people/PeopleOverheadTab.tsx`](../src/components/people/PeopleOverheadTab.tsx) — **~2,510 lines** (2,038 when this map was written; it has kept growing). Daily overhead cost table (office/bid labor + office materials vs field totals), trailing-average KPIs, per-day breakdown modals, office-job configuration. Props from `People.tsx`: `payConfig`, `authUser`, `setError` (declared but **unused** — see quirks), `canAccessOverheadTab`, `isDev`, `loadPayConfig`.

The two tabs share **nothing with each other** (no common state, tables, or selection). One doc covers both because they are the two remaining oversized People components and their maps are small enough to co-locate.

Line numbers below are as of 2026-07-29 and rot — search the symbol, not the number.

## Shared substrate

There is **no Bids-style cross-tab shared pointer or data engine** between these two components (People.tsx deliberately has none — it keys by `person_name` and gives each tab its own data; see the People map). What exists is one substrate **inside each tab**, which is what any sub-extraction must respect:

- **Contracts:** the four-cache contracts dataset + its loader — `contractTemplates`, `contractTemplateDocuments`, `personContractAssignments`, `personContractDocuments`, all populated by `loadContracts()` (4 parallel SELECTs) and re-fetched wholesale after every mutation — plus the selection pointer `selectedContractsPersonName` (the expanded roster row; the assign modal and Add-document prefill both read it). Every region (roster, all four modals) reads 2+ of these caches, so **the caches + `loadContracts` + `selectedContractsPersonName` + the shared `contractsError` string stay in `PeopleContractsTab`** (or move into a `usePeopleContractsData` hook the component destructures); extracted modals receive them as props + an `onSaved`/`reload` callback.
- **Overhead:** the scope triple `(overheadDateStart, overheadDateEnd, overheadOfficeJobLedgerId)`. Five data effects key off it (office sessions, other-jobs sessions, office parts, other-jobs parts, 90-day averages), and every memo/table/modal derives from the resulting maps. **The scope states + the five caches stay in `PeopleOverheadTab`** (or a `usePeopleOverheadData` hook); the breakdown modal consumes a derived view-model.

Also note two **cross-component data couplings via the DB, not via props** (neither blocks extraction, both must not be "fixed" during a move):

1. `People.tsx` independently loads contract-signing rollups for the Users-tab dots (`rollupContractSigningStatusByPersonName` → `contractSigningStatusByPersonName`, consumed by `PeopleUsersTab`). Saves inside `PeopleContractsTab` do **not** refresh those dots until the parent reloads.
2. `People.tsx` also reads the overhead office job (`fetchOverheadOfficeJobLedgerIdFromAppSettings`) for the Review tab's 90-day overhead-rate calc. Changing the office job inside `PeopleOverheadTab` does **not** propagate to that calc until reload.

## Master summary table

| Region | Component | Lines est. | Coupling | Risk | Status |
|---|---|---|---|---|---|
| Contracts data engine (`loadContracts` + 4 caches) | Contracts | ~70 | highest (every region) | — | stays in tab (or `usePeopleContractsData`) |
| Pure row/payload builders (`getDocumentsForPerson` etc.) | Contracts | ~330 | reads caches only | low | **Stage A → `lib/peopleContracts/*`** |
| Roster table + search + expanded person docs | Contracts | ~515 | high (opens all modals) | med | extract after modals, or keep in tab |
| Manage templates modal | Contracts | ~190 render + ~190 handlers | med (caches, `canDeletePeopleContracts`) | med | extract → `ContractsManageTemplatesModal` |
| Assign template modal | Contracts | ~215 render + ~150 handlers | med (caches, `selectedContractsPersonName`) | low-med | extract → `ContractsAssignTemplateModal` |
| Add/Edit document modal | Contracts | ~425 render + ~200 shared field memos + ~370 handlers | high (Contract Book pick handoff, send chain) | high | extract last → `ContractDocumentFormModal` |
| Delete-confirm dialog | Contracts | ~85 | low | low | extract with document modal or standalone |
| Send-for-signature modal | Contracts | ~127 + `sendContractForSignature` | low (doc id + reload) | low | **extract first** → `ContractSendForSignatureModal` |
| Signed-record + Contract Book wrappers | Contracts | ~20 | already extracted components | — | wiring stays in tab |
| KPI strip (avg daily cost / per-$100) | Overhead | ~75 render + ~110 effect | med (90d effect duplicates engine) | low-med | Stage A the math; render can stay |
| Scope toolbar (week nav, view toggle, office-job button) | Overhead | ~125 | low (writes scope states) | low | stays with tab (controls the substrate) |
| Overhead data engine (5 fetch effects + bucket effect + memos) | Overhead | ~590 | highest | — | stays in tab (or `usePeopleOverheadData`) |
| Day table + totals footer | Overhead | ~330 | med (reads merged rows, opens modal) | low-med | extract → `OverheadDayTable` (presentational) |
| Breakdown modal (4 scopes) | Overhead | ~458 render + ~100 model memo | med (reads 7 caches via model) | med | **extract first** → model builder to lib, then `OverheadBreakdownModal` |
| Office-job modal + job picker modal | Overhead | ~275 + search effect | low-med (writes `overheadOfficeJobLedgerId`) | low | extract → `OverheadOfficeJobModals` |

---

## PeopleContractsTab — dossiers

### Module level + types (lines ~1–110)

Pure module helpers (already React-free — Stage-A file moves): `formatContractBookLastEditedCalendarDate(iso)` (APP_CALENDAR_TZ date label), `isDeletablePersonContractStatus(status)` (`unsent|sent|signed`), `personContractDocumentHasStaffData(pcd)` (the "empty placeholder" guard used by template-remove and unassign cleanup). Local types `Person`, `UserRow`; component-body types `ContractTemplate`, `ContractTemplateDocument`, `PersonContractAssignment`, `PersonContractDocument`, `PersonContractTableRow` (would move to `lib/peopleContracts/types.ts` with Stage A).

### Contracts data engine (stays in tab)

- **State:** `contractTemplates`, `contractTemplateDocuments`, `personContractAssignments`, `personContractDocuments`, `contractsLoading`, `contractsError` (single shared error string — rendered in the tab header AND inside the Manage-templates, Assign, Document, and Send modals).
- **Loader:** `loadContracts()` — `Promise.all` of 4 SELECTs: `contract_templates` (`id,name,sequence_order,created_at`, ordered), `contract_template_documents` (incl. `book_body_html`, `book_body_format`, `tags`, `canonical_document_url`, `updated_at`), `person_contract_assignments`, `person_contract_documents` (incl. lineage columns `contract_lineage_id`, `lineage_version`, `supersedes_person_contract_document_id`, `applied_contract_template_document_id`, `dashboard_prompt_after_clock_in`). Every mutation handler ends with `loadContracts()` (full refetch, no patching).
- **Effect:** initial load behind an 80 ms `setTimeout` (mount-deferred; preserve).

### Pure row/payload builders (Stage-A cluster)

All plain functions inside the component body that close over the caches only:

- `getDocumentsForPerson(personName)` → `PersonContractTableRow[]` — the core row builder: groups person rows by `contract_lineage_id`, sorts versions descending, resolves each version's "book last edited" date via the inner `bookForVersion` (pinned `applied_contract_template_document_id` wins only if the pinned row still matches the document name AND an assigned template; falls back to max `updated_at` among assigned templates), then appends **placeholder rows** (`version: null`) for template documents with no person row yet.
- `getAggregateStatus(docs)` → `'red'|'yellow'|'green'|null` (any unsent → red, any sent → yellow, else green) and `getAggregateStatusForTemplate(personName, templateId)`.
- `listAppliedContractBookVersionOptions(personName, documentName)` and `resolveAppliedContractTemplateDocIdForSave(...)` (Applied-version picker options + save-time validation).
- `getContractDocumentUpsertPayload()` — form → row payload with the add-tab forcing rules (see quirks 5–6).
- `templateFormBookSourceValidationError(names)` — every new template document must map to a Contract Book source row.

### Roster table (main render, ~1399–1912)

- **Owned local state:** `contractsSearchQuery`, `selectedContractsPersonName` (expanded row — the tab's selection pointer), `contractsDocumentActionsMenuOpenId` (⋯ menu; has a `mousedown` click-outside effect keyed on `data-contract-doc-menu-wrap`), `contractDashboardPromptSavingId`, `contractSignedRecordModalDocId`. `useId`s: `contractsTabSearchInputId`.
- **Derived memos:** `contractsPersonNamesSorted` (union of `people[].name` + `users[].name`, deduped/sorted — persons are **name-keyed strings**, not ids), `contractsSearchNormalized`, `contractsPersonNamesFiltered` (person-name OR document-name match), `contractDocumentSearchLines` (flat "person — document — status" match list shown above the table).
- **Handlers:** `toggleContractDashboardPrompt(docId, next)` (UPDATE `dashboard_prompt_after_clock_in`), row expand/collapse, and openers for every modal (assign, add document with full form reset, edit via `openContractDocumentEditModal`, send, delete confirm, signed record).
- **Supabase:** `person_contract_documents` UPDATE (dashboard toggle) — everything else reads the caches.
- **Extraction:** medium risk. The table itself is presentational once the row builders are in `lib/*`, but it opens all five modals, so extract it **after** the modals (or accept a wide callback-prop surface: `onAssign`, `onAddDocument`, `onEditDocument`, `onSend`, `onDelete`, `onViewSigned`, `onToggleDashboard`).

### Manage templates modal (`contractsTemplateModalOpen`, ~1914–2104)

- **Owned local state:** `editingContractTemplate`, `templateFormName`, `templateFormDocumentNames`, `templateFormDocumentSourceByName` (picker-added name → source `contract_template_documents.id`), `templateBookPickerValue`, `templateFormSaving`, `templateFormMode` (`none|create|edit`). Memo `templateBookPickerOptions` (library entries not yet attached, labeled `"<template> — <doc>"`). `useId`: `templateBookPickerLabelId`.
- **Handlers:** `openTemplateForm(template?)`, `closeTemplateForm()`, `saveTemplate()` (create: INSERT `contract_templates` then sequential per-doc INSERT `contract_template_documents` copying book body/format/tags/canonical URL from the source row; edit: UPDATE name, diff `toAdd`/`toRemove`; removals delete empty-placeholder `person_contract_documents` per assignee (`personContractDocumentHasStaffData` guard) then the template doc; additions insert the template doc AND backfill an `unsent` person row per current assignee — all sequential awaits, N+1 by design), `deleteContractTemplate(template)` (`window.confirm`, gated by `canDeletePeopleContracts`; removing docs on edit also requires that flag).
- **Supabase:** `contract_templates` (INSERT/UPDATE/DELETE), `contract_template_documents` (INSERT/DELETE), `person_contract_documents` (INSERT backfill / DELETE placeholders).
- **Extraction:** medium risk, self-contained UI. Props needed: the 4 caches, `canDeletePeopleContracts`, `contractsError`+setter (or local error), `onSaved=loadContracts`. Stage A first: `templateFormBookSourceValidationError` and the add/remove diffing are pure.

### Assign template modal (`contractsAssignModalOpen`, ~2106–2320)

- **Owned local state (declared mid-file ~1244–1247):** `assignTemplateSelectedId`, `assignTemplateSearchQuery`, `assignTemplateSaving`, `assignTemplateUnassigningTemplateId`. Memo `filteredAssignContractTemplates` + an effect clearing the selection when it falls out of the filtered list. `useId`s: `assignTemplateSearchInputId`, `assignTemplateRadioGroupLabelId`.
- **Cross-region state:** reads `selectedContractsPersonName` (stays in tab, controlled prop).
- **Handlers:** `assignTemplateToPerson()` — INSERT `person_contract_assignments`, then per template doc: if a person row for that document name exists, UPDATE the **latest lineage version** (copy canonical URL + pin `applied_contract_template_document_id`; also copy book body/format only when the existing row has no signing body); else INSERT a fresh `unsent` row (new `crypto.randomUUID()` lineage, version 1). `unassignTemplateFromPerson(templateId)` — DELETE the assignment, bulk-clear applied pins pointing at that template's docs (`.in('applied_contract_template_document_id', ids)`), delete empty-placeholder person rows only; gated by `canDeletePeopleContracts`.
- **Supabase:** `person_contract_assignments` (INSERT/DELETE), `person_contract_documents` (INSERT/UPDATE/DELETE).
- **Extraction:** low-medium risk. Props: caches, `personName` (controlled), `canDeletePeopleContracts`, `onSaved`.

### Add/Edit document modal (`contractDocumentModalOpen`, ~2322–2746 + shared field memos ~236–435)

- **Owned local state:** `editingContractDocument` (null = add mode), the `contractDocumentForm*` cluster (`PersonName`, `DocumentName`, `Url`, `Status`, `SignedAt`, `Note`, `SigningBodyHtml`, `SigningBodyFormat`, `CanonicalUrl`, `AppliedTemplateDocId` — empty string = automatic, `DashboardPrompt`, `Saving`), `contractDocumentAddTab` (`'upload_signed' | 'request_signature'` — aria tablist with ArrowLeft/ArrowRight via `handleContractAddTabKeyDown` + `contractAddDocTabBaseId`), collapse states `contractEditModalContractTextExpanded`/`contractEditModalCanonicalExpanded` (reset effect on open/doc change), canonical-URL check cluster (`canonicalUrlCheckStatus`, `canonicalUrlCheckMessage`, `canonicalUrlIsCheckable` memo, `checkCanonicalDocumentUrl` callback → [`checkGoogleDriveAttachmentUrl`](../src/lib/checkGoogleDriveAttachmentUrl.ts), reset effect on URL change).
- **Shared JSX memos:** `contractDocModalContractTextField` (format buttons + Contract Book button + textarea) and `contractDocModalCanonicalUrlField` — rendered by BOTH the edit-mode accordions and the Request Signature panel. `contractBodyFormatBtn` (style fn, recreated per render and listed as a memo dep — the memos effectively recompute every render; preserve).
- **Handlers:** `openContractDocumentEditModal(person, docName, row)` (full form hydrate incl. pin validation), `saveContractDocument()` (edit → UPDATE by id; add → INSERT with fresh lineage id, `lineage_version: 1`), `saveContractDocumentAndOpenSend()` (add + Request Signature only; requires `hasContractSigningContent`, INSERTs then chains into the Send modal with the new row id), `handlePickContractFromBook(entry)` (Contract Book pick → fills body/format, fills name + canonical URL only if empty, pins applied id) gated by the predicate `contractBookPickFromDocumentModal`.
- **Supabase / external:** `person_contract_documents` (INSERT/UPDATE); [`ContractBookModal`](../src/components/contracts/ContractBookModal.tsx) (extracted) is opened from the tab header AND from inside this modal — its `onPickEntry` is passed only when `contractBookPickFromDocumentModal` is true. Contract Book saves fire `onSaved={loadContracts}`; the DB function `create_pending_contract_versions_after_book_save` (see `docs/MIGRATIONS.md`, v2.365) is what mints `lineage_version > 1` rows — the UI never does.
- **Extraction:** **highest risk in the Contracts file — extract last.** It shares the two field memos, chains into the Send modal, and co-owns the ContractBookModal pick handoff. Approach: keep `ContractBookModal` rendering + the pick predicate in the tab; extracted `ContractDocumentFormModal` receives `onOpenContractBook`, `onSaved`, `onSavedAndSend(docId)`, the caches (for the Applied-version options), and `canDeletePeopleContracts`. Move the two field memos into the new component (they are only used here).

### Delete-confirm dialog (`contractDocumentDeleteConfirmOpen`, ~2748–2832)

`contractDocumentDeleteTarget`, `contractDocumentDeleting`; `deleteContractDocument()` — DELETE `person_contract_documents` by id, gated by `canDeletePeopleContracts` + `isDeletablePersonContractStatus`; closes the edit modal if it was showing the deleted row. Opened from both the row ⋯ menu and the edit modal. Low risk; extract standalone or fold into the document modal move.

### Send-for-signature modal (`contractSendModalOpen`, ~2852–2978)

- **Owned local state:** `contractSendDocId`, `contractSendEmail`, `contractSendSubject`, `contractSendIntro`, `contractSendSaving`. Memo `contractSendEmailPreview` (live preview via tested [`buildContractSendEmailPreview`](../src/lib/contractSendEmailPreview.ts); origin-based link placeholder).
- **Handler:** `sendContractForSignature()` — inline email regex validation, then a **raw `fetch`** to edge function `send-contract-for-signature` (`VITE_SUPABASE_URL` + JWT from `supabase.auth.getSession()` + `VITE_SUPABASE_ANON_KEY` apikey header; optional `email_subject`/`email_intro_plain`), toast on `emailed`/`accept_url` variants, then `loadContracts()`.
- **Extraction:** **low risk — extract first.** Props: `docId`, `documentName`/`personName` (or the doc row), `onClose`, `onSent=loadContracts`. Only coupling is the shared `contractsError` (give it local error state passed back via `onError`, or thread the setter).

### Already-extracted wrappers

`PersonContractSignedRecordModal` (open by `contractSignedRecordModalDocId`) and `ContractBookModal` (open by `contractBookModalOpen`; `canDeleteLibraryEntries={canDeletePeopleContracts}`) — thin wiring only; stays in the tab.

---

## PeopleOverheadTab — dossiers

Stage A is **largely already done** for this tab — the calc core lives in tested libs: [`overheadDailyLabor.ts`](../src/lib/overheadDailyLabor.ts) (`buildOverheadDailyLabor`, `buildOtherJobsLaborByDay`, `mergeOverheadDayTableRows`, `overheadFactorTotalOverOtherJobs`, `filterOverheadDetailLines`, `aggregateOverheadDetailByPerson[TotalScope]`, `aggregateOtherJobsLaborByPerson`, `buildOverheadWageLookup` + `buildOverheadWageLookupByPersonId`/`overheadWageRatesForSession` — the C1 person-id-first wage join with name fallback), [`fetchOverheadOfficePartsByDay.ts`](../src/lib/fetchOverheadOfficePartsByDay.ts) (`fetchOverheadOfficePartsByDay`, `fetchOtherJobsPartsByDay` — both now REJECT on source failure instead of swallowing into empty maps), [`overheadPartsAccountingBuckets.ts`](../src/lib/overheadPartsAccountingBuckets.ts) (`bucketOverheadPartsLinesByAccountingLabel`, `sumMaterialsTotalUsdExcludingInternalTransfer`, `overheadPartsAccountingBucketFromDefaultKey`), [`overheadAvgDailyCost.ts`](../src/lib/overheadAvgDailyCost.ts) (`computeOverheadTrailingAverages`, `bucketInvoiceRevenueByAppTzDay`), [`overheadRateMethods.ts`](../src/lib/overheadRateMethods.ts) (`computeOverheadRateMethods` — shared with the Review tab), [`overheadOfficeJobSettings.ts`](../src/lib/overheadOfficeJobSettings.ts) (app_settings key `overhead_office_job_ledger_id_v1`), [`overheadTableViewStorage.ts`](../src/lib/overheadTableViewStorage.ts) (localStorage `people_overhead_table_simple_view_v1`). What remains inline is orchestration + render.

### Scope + settings (stays in tab)

- **State:** `overheadDateStart`/`overheadDateEnd` (initialized to the current Sun–Sat week via local `Date` + `toLocaleDateString('en-CA')`), `overheadOfficeJobLedgerId`, `overheadOfficeJobLabel` (`{hcp_number, job_name}` via `effectiveJobLedgerNumber`), `overheadSettingsLoading`, `overheadTableSimpleView` (lazy-init from localStorage).
- **Handlers:** `shiftOverheadWeek(deltaWeeks)` (noon-anchored ±7-day date math), Simple/Advanced toggle writes `writeOverheadTableSimpleViewToStorage`.
- **Effects:** office-job setting load (`fetchOverheadOfficeJobLedgerIdFromAppSettings` + `jobs_ledger` label lookup by id, `maybeSingle`), and a `loadPayConfig()` kick on `canAccessOverheadTab`.
- **Supabase:** `app_settings` (via lib), `jobs_ledger` SELECT.

### Data engine (5 fetch effects + bucket effect + memos — stays in tab / hook candidate)

- **Effects, all gated `canAccessOverheadTab && authUser?.id` with `cancelled` cleanup:**
  1. **Office sessions** → `overheadSessions`: `clock_sessions` SELECT (with `users!clock_sessions_user_id_fkey(name)` join) in the date window, `.or(`job_ledger_id.eq.${officeJobId},bid_id.not.is.null`)` when an office job is set, else bid-only (`.not('bid_id','is',null)`).
  2. **Other-jobs sessions** → `overheadOtherJobsSessions`: same select, `.not('job_ledger_id','is',null)` + `.neq('job_ledger_id', officeJobId)`.
  3. **Office parts** → `overheadOfficePartsDetailByDay` via `fetchOverheadOfficePartsByDay` (cleared when no office job; the per-day $ map is a derived memo with Internal Transfers excluded).
  4. **Other-jobs parts** → `overheadOtherJobsPartsDetailByDay` via `fetchOtherJobsPartsByDay`.
  5. **Accounting buckets** → `overheadPartsAccountingBucketByTxId` (one symmetric map for office AND field Mercury lines): collects tx ids from both detail maps, two-step query — `mercury_transaction_drag_sort_assignments` `.in(txIds)` then `mercury_drag_sort_labels` `.in(labelIds)` → `overheadPartsAccountingBucketFromDefaultKey`. Recomputed per detail-map change (not per modal open) so day flips inside the modal are instant.
  6. **Person links** → `overheadPersonIdByUserId`: `people` (`id`, `account_user_id`, unarchived) for the C1 person-id-first wage join; degrades to the name-fallback join (empty map) on failure.
- **Error surfacing:** the session/parts effects report failures into `overheadLoadErrorBySource` (per-source keyed, rendered as a red banner atop the tab) AND forward to the page-level `setError` prop — a failed fetch no longer masquerades as "No rows in this range".
- **`useMercuryLedgerNicknames({ enabled: true })`** → `overheadMercuryNicknameByDebitCard` (role-gated inside the hook; the fetch is effectively gated by conditional mounting — People.tsx only mounts the tab while active) for "· on <card>" labels in the office-materials list.
- **Memos:** `overheadWageLookup` (name- + person-id-keyed rates, memoized on a JSON content key so identity survives pay-config refetches), `overheadLabor` (= `buildOverheadDailyLabor`), `overheadOtherJobsLabor` (= `buildOtherJobsLaborByDay`), the two Internal-Transfer-excluded per-day parts $ memos, `overheadMergedByDay` (= `mergeOverheadDayTableRows` of the five per-day inputs), `overheadTableTotals` (column sums for the `<tfoot>`), `overheadTableColCount` (4 simple / 7 advanced).
- **Modal lifecycle:** the day-breakdown modal auto-closes whenever `overheadDateStart`/`End` change (week shift or manual edit) — it previously stayed open showing an out-of-range empty state.
- **Supabase:** `clock_sessions`, plus (inside the libs) mercury allocations / supply invoices / tally parts tables.

### KPI strip — averages

- **State:** `overheadAvgDailyCost` (`avg7/30/90`, `per100_7/30/90`, `loading`).
- **Effect:** independent 90-day fetch — `clock_sessions` for `[today-89, today]` (`today` = Chicago company-calendar day via `denverCalendarDayKey`, NOT browser-local — same anchor in the Review tab's 90-day rates effect; same office-or-bid `.or()` shape, paged) PLUS field sessions (non-office jobs-ledger, for the three-lenses denominators — same fetch pass), `loadOfficePartsUsdByDayExcludingInternalTransfer` ([`lib/overheadPartsBucketLoader.ts`](../src/lib/overheadPartsBucketLoader.ts)) over the same range (fetch + bucket + per-day sum with Internal Transfers excluded via the symmetric bucket rule; bucket-fetch failure degrades to everything-counted — shared with the Review tab's 90-day pool so the two cannot drift), rebuilds labor via the same lib fns, merges with `mergeOverheadDayTableRows(labor.byDay, partsByDay, empty, empty, empty)` (other-jobs slots deliberately empty), then `jobs_ledger_invoices` (fetched a day wide, re-bucketed by `bucketInvoiceRevenueByAppTzDay`; Stripe test-mode rows excluded via `.or('stripe_mode.is.null,stripe_mode.neq.test')` — NULL means non-Stripe/legacy real revenue, so a bare `.neq` would drop it; the Review tab's invoice fetch carries the same filter and sums the same kernel's buckets) → `computeOverheadTrailingAverages` (`lib/overheadAvgDailyCost.ts`; cost/n calendar average incl. zero days; per-$100 = cost/revenue×100, null when revenue ≤ 0). **Single-run gating:** the effect waits for `overheadPayConfigLoaded` (set when the mount `loadPayConfig()` settles) AND the `overheadPersonIdByUserId` link map, and its wage lookup is memoized on a JSON content key — a pay-config refetch with identical content no longer re-runs the whole 90-day scan.
- **Extraction:** Stage A done — `sumWindow` + revenue bucketing live in `lib/overheadAvgDailyCost.ts` with tests. The render block is presentational.

### Three-lenses rate strip (Methods A/B/C)

- **What it is:** three reference overhead rates from the ONE 90-day pool (office labor + bid labor + office parts): **A** = pool ÷ billable field hours ($/hr, headline), **B** = pool ÷ invoices sent (fraction of revenue), **C** = pool ÷ direct field labor $ (multiplier per $1). Rendered directly below the two KPI cards.
- **State:** `overheadRateLenses` (`methodA/B/C`, `windowStart/End`, `loading`) — filled by the SAME 90-day KPI effect (no second fetch pass; the effect's extra field-session query feeds hours via `buildOtherJobsLaborByDay` — field wage, id-first join, hours count even when wage is missing).
- **Kernel:** [`overheadRateMethods.ts`](../src/lib/overheadRateMethods.ts) `computeOverheadRateMethods({ overheadPoolUsd, fieldHours, invoicedRevenueUsd, fieldLaborUsd })` → nulls on non-positive/invalid denominators. **Shared with `PeopleReviewTab`'s 90-day rate decomposition** (its Methods-table caption points here) — the same class of duplication that caused the paging/timezone drift PR #983 fixed, closed at the source.
- **Render:** header "Overhead rate — three lenses" + subtitle, `repeat(auto-fit, minmax(190px,1fr))` card grid — small colored method label (blue/green/amber), big rate figure (`$16.40/hr` · `11.8% of revenue` · `$0.62 / $1 labor`; `…` loading, `—` null), one-line formula caption, fixed blurb copy (Method C interpolates the live cents value), and a full formula + window + session-inclusion-rule `title` per card. Footer: reference rates only — Team Summary's "Profit (after overhead)" uses the split model.

### Maintenance-hygiene strip (v2.1320)

- **What it is:** an amber attention strip directly below the three lenses, one card per dirty indicator (count + hours + rule tooltip + where-to-fix hint), hidden entirely when all three are clean: **pending approvals** (no `approved_at`/`rejected_at`/`revoked_at`; closed vs still-open split), **unpriced hours** (per-person aggregation of the builders' `missingWage` detail lines — hours count, dollars price $0), **unassigned salary time** (`origin='salary_schedule'` with `job_ledger_id` AND `bid_id` NULL — invisible to the pool regardless of approval).
- **State/data:** `overheadHygiene` (`summary`, `loading`) — filled by the SAME 90-day KPI effect. Indicators 1–2 reuse the effect's two session arrays and builder outputs (zero extra fetches); indicator 3 adds one paged fetch in the same `Promise.all` that fails soft per-source (`reportOverheadLoadError('unassigned salary time')` → `unassignedSalary: null`, indicator hides) without nulling the KPIs/lenses.
- **Kernel:** [`overheadHygiene.ts`](../src/lib/overheadHygiene.ts) `buildOverheadHygieneSummary` (+ the three classifiers and `formatOverheadHygienePersonNames` name-capping, 14 tests) — dedupes sessions/lines by id across the office-or-bid and field arrays (a field-job-with-bid session appears in both).

### Day table + totals footer (~969–1298)

Presentational over `overheadMergedByDay` + `overheadTableTotals`: Advanced columns (Date, Bid labor $, Office labor $, Office parts $, Office Total $/h, Overhead %, Field Total $/h) vs Simple (Date, Overhead %, Office Total, Field Total — different column ORDER between views; preserve). Every $ cell is a button opening `setOverheadBreakdownModal({ workDate, scope })` with scopes `'bid'|'office'|'officeParts'|'total'|'otherJobs'`. Footer `Overhead %` re-uses `overheadFactorTotalOverOtherJobs` on the period sums (weighted ratio, not an average of daily percentages — comment in file). The whole table hides behind a single combined loading gate (all four loading flags). Extraction: low-medium — `OverheadDayTable` taking `rows`, `totals`, `simpleView`, `onOpenBreakdown`; `formatOverheadTabWorkDateLabel` (module-level pure) moves to lib.

### Breakdown modal (~1301–1758, model memo ~649–746)

- **State:** `overheadBreakdownModal` (`{workDate, scope} | null`).
- **View-model memo `overheadBreakdownModalModel`:** per-scope discriminated object — `officeParts` (sorted part lines + total), `otherJobs` (labor person rows via `aggregateOtherJobsLaborByPerson`, sorted sessions, parts re-bucketed by `bucketOverheadPartsLinesByAccountingLabel` + Materials total **recomputed excluding Internal Transfers** via `sumMaterialsTotalUsdExcludingInternalTransfer` — so the modal's Combined can differ from the upstream column when legacy internal-transfer splits exist; deliberate), `total` (person rows via `aggregateOverheadDetailByPersonTotalScope` + labor sessions + office materials), `office`/`bid` (filtered via `filterOverheadDetailLines` + `aggregateOverheadDetailByPerson`).
- **Render:** header stats per scope, person tables, `<details open>` session/materials lists, Internal Transfers section with slate accent + "not counted in Materials" hint, Mercury card labels via nickname map with `formatMercuryDebitCardIdCompact` fallback.
- **Extraction:** **the biggest single win in this file (~560 lines).** Stage A: move the model memo body to `lib/overheadBreakdownModel.ts` (pure — takes the maps + scope + bucket map) + tests. Then `OverheadBreakdownModal` takes `model`, `nicknameByDebitCard`, `officeJobConfigured` (for the field-materials summary label), `onClose`.

### Office-job modal + job picker (~1760–2035, search effect ~549–568)

- **State:** `overheadOfficeJobModalOpen` (explainer + current job + dev-only Change/Clear), `overheadJobPickerOpen`, `overheadJobSearch`, `overheadJobResults`, `overheadJobSaving`.
- **Effect:** 300 ms-debounced RPC `search_jobs_ledger` while the picker is open (clears on close).
- **Handlers (inline in JSX):** save via `upsertOverheadOfficeJobLedgerId(j.id)` then set id + label locally; clear via `deleteOverheadOfficeJobLedgerIdSetting()`. Both toast; both gated `isDev`. Office-job modal contains the long methodology explainer paragraph (the tab's de-facto documentation — moves verbatim).
- **Supabase/RPC:** `app_settings` (via lib), RPC `search_jobs_ledger`. Links to `/jobs?edit=<id>` (react-router `Link`).
- **Extraction:** low risk. `OverheadOfficeJobModals` with props `officeJobLedgerId`, `officeJobLabel`, `settingsLoading`, `isDev`, `onChanged(id,label|null)` — the parent keeps the id state because the entire data engine keys off it.

---

## Stage-A candidates (pure logic → `src/lib/*` + tests, before any component moves)

| Candidate | Currently | Target |
|---|---|---|
| `getDocumentsForPerson` (+ inner `bookForVersion`), `getAggregateStatus`, `getAggregateStatusForTemplate` | closures in `PeopleContractsTab` body | `lib/peopleContracts/personContractRows.ts` — explicit args `(personName, assignments, templates, templateDocuments, personDocuments)`; tests: lineage sort, placeholder rows, pin fallback rules |
| `listAppliedContractBookVersionOptions`, `resolveAppliedContractTemplateDocIdForSave` | closures in component body | `lib/peopleContracts/appliedVersionOptions.ts` + tests |
| `getContractDocumentUpsertPayload` | closure over ~12 form states | `lib/peopleContracts/contractDocumentPayload.ts` taking an explicit form-values object; tests for the Upload-Signed / Request-Signature forcing matrix |
| `templateFormBookSourceValidationError` | closure over source map + docs | same lib, explicit args + test |
| `formatContractBookLastEditedCalendarDate`, `isDeletablePersonContractStatus`, `personContractDocumentHasStaffData` | module-level in the tab file | verbatim move to `lib/peopleContracts/` (already pure) |
| signer-email regex validation in `sendContractForSignature` | inline | reuse/centralize an existing email validator if one exists; otherwise leave (behavior-preserving) |
| 90-day `sumWindow` + invoice `revenueByDay` bucketing | **DONE** — `lib/overheadAvgDailyCost.ts` (`computeOverheadTrailingAverages`, `bucketInvoiceRevenueByAppTzDay`) + tests (zero-day inclusion, revenue-0 → null, Chicago bucketing + window clamp) | — |
| `overheadBreakdownModalModel` builder | ~100-line `useMemo` | `lib/overheadBreakdownModel.ts` — `buildOverheadBreakdownModel(scope, workDate, { laborDetailByDay, officePartsUsdByDay, officePartsDetailByDay, otherJobsLabor, otherJobsPartsDetailByDay, bucketByTxId })` + tests (esp. Internal-Transfer exclusion + Combined) |
| `formatOverheadTabWorkDateLabel`, `shiftOverheadWeek` date math | module-level / component fn | `utils/dateUtils` or `lib/overhead*` (preserve the noon-anchor + `en-CA` quirks) |

Already extracted with tests (do not re-do): `contractBodyFormat`, `contractSigningContent`, `contractSendEmailPreview`, `overheadDailyLabor`, `overheadPartsAccountingBuckets`, `fetchOverheadOfficePartsByDay`, `overheadPartsBucketLoader` (`collectMercuryTxIds`, `fetchAccountingBucketByTxId`, `loadOfficePartsUsdByDayExcludingInternalTransfer` — moved out of the tab), `overheadOfficeJobSettings`, `overheadTableViewStorage`, `overheadAvgDailyCost`, `overheadRateMethods`.

## Recommended extraction order (value ÷ risk)

1. **Stage-A sweep** — the table above; each independently shippable. Highest leverage: `personContractRows`, `contractDocumentPayload`, `overheadBreakdownModel`.
2. **`ContractSendForSignatureModal`** — smallest prop surface, self-contained state, validates the seam.
3. **`OverheadBreakdownModal`** (after its model builder is in lib) — biggest single line-count win (~560 lines).
4. **`OverheadOfficeJobModals`** (office-job modal + picker + debounced search effect + save/clear handlers).
5. **`ContractsAssignTemplateModal`**, then **`ContractsManageTemplatesModal`**.
6. **`OverheadDayTable`** (presentational; optional — the remaining file is small by then).
7. **`ContractDocumentFormModal`** + delete-confirm — last (shared field memos, ContractBook pick handoff, save-and-send chain into the Send modal).
8. Optional seams if the files keep growing: `usePeopleContractsData` (4 caches + `loadContracts` + `contractsError`) and `usePeopleOverheadData` (scope triple + 5 caches + bucket map + merged memos).

### What must STAY in the parents

- **In `People.tsx` (unchanged by this work):** the `?tab=` deep-link router + role guards (`canAccessOverheadTab`, `canAccessContracts` redirects), role flags (`canDeletePeopleContracts`), the `people`/`users` roster, `payConfig`/`loadPayConfig` (shared with the Hours tab via `usePayConfig`), `authUser`, and the Users-tab `contractSigningStatusByPersonName` rollup.
- **In `PeopleContractsTab`:** the four caches + `loadContracts`, `selectedContractsPersonName`, `contractsError` (until per-modal errors are threaded), and the `ContractBookModal` render + `contractBookPickFromDocumentModal` predicate (opened from two places).
- **In `PeopleOverheadTab`:** `overheadDateStart`/`End`, `overheadOfficeJobLedgerId`/label, `overheadTableSimpleView`, all five data caches + their effects, the bucket map, and `overheadBreakdownModal` open-state (the table and modal are siblings).

## Preserve-quirks list (odd but load-bearing)

1. **Persons are `person_name` strings**, the union of `people` + `users` names — the People-page convention. Renames orphan contract rows; do not introduce an id key during a move.
2. **80 ms `setTimeout`** before the initial `loadContracts()`.
3. **UI inserts are always `lineage_version: 1`** with a fresh `crypto.randomUUID()` lineage id; `lineage_version > 1` rows are minted only by the DB function `create_pending_contract_versions_after_book_save` after Contract Book saves. The roster shows **every** version as its own row, newest first.
   - **Quick-send writes at Send, not at pick** (v2.2851, decision 17): `openQuickSendForPerson` computes a `QuickSendPlan` (`quickSendPlan` in `src/lib/contractsQuickSend.ts` → `reuse | fill | insert | no-content`) and opens the Send modal with `contractSendQuickSend = { personName, documentName, plan }`; `contractSendDocId` stays null for `fill`/`insert`. `sendContractForSignature` calls `materializeQuickSendRow` (the UPDATE/INSERT) immediately before the `send-contract-for-signature` POST, pins the id, and flips the plan to `reuse` so a failed send retries the same row. The modal's preview/portal/subject read `contractSendTarget` (row or pending pick). Cancel resets state only — by design there is nothing to delete. Add document → Save/Send now still saves on purpose before opening the modal.
4. **Applied-version pin fallback:** a pin only counts if the pinned book row still matches the document name AND a currently-assigned template; otherwise the max `updated_at` among assigned templates is shown.
5. **Add-tab forcing matrix** (`getContractDocumentUpsertPayload`): Request Signature save forces `status='unsent'` and nulls `url`/`signed_at`/`note`; Upload Signed forces `status='signed'`, nulls signing body + canonical URL, forces `signing_body_format='html'` and dashboard prompt false. Edit mode keeps the chosen status; dashboard prompt is forced false whenever status is `signed`.
6. **Empty-placeholder deletion guard:** template-remove and unassign delete a person row only when `personContractDocumentHasStaffData` is false (no url/signature/note/body/canonical URL) — signed or in-progress documents always survive.
7. **Sequential N+1 writes by design** in `saveTemplate`, `assignTemplateToPerson`, `unassignTemplateFromPerson` (one await per doc/assignee) — no batching during the move.
8. **`sendContractForSignature` uses raw `fetch`** with `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` + session JWT, not `supabase.functions.invoke`.
9. **Single shared `contractsError`** rendered in the header and in 3 modals; `deleteContractTemplate` uses `window.confirm` while document delete has a styled dialog.
10. **JSX-in-`useMemo` field blocks** (`contractDocModalContractTextField`/`CanonicalUrlField`) depend on `contractBodyFormatBtn`, a per-render style function — the memos recompute every render; harmless, preserve.
11. **Overhead `setError` prop is passed by `People.tsx` but never destructured/used** inside `PeopleOverheadTab` — errors are swallowed into empty-state resets or toasts. Do not "fix" silently; note it if removing the prop.
12. **Week defaults + `shiftOverheadWeek` use device-local `Date` + `toLocaleDateString('en-CA')`** (noon-anchored to dodge DST) while table labels use `APP_CALENDAR_TZ` — a deliberate mismatch to preserve.
13. **Office scope query shape:** `.or(`job_ledger_id.eq.${id},bid_id.not.is.null`)` (string-interpolated); with no office job configured, office scope = bid-only sessions and other-jobs = ALL jobs-ledger sessions (the modal heading switches to "Materials (all jobs)").
14. **Office-job-wins rule** (session with both `job_ledger_id` = office job and `bid_id` counts as office) lives in `overheadDailyLabor` — the component must not re-implement it.
15. **Internal Transfers (symmetric exclusion):** every Materials figure on the tab — the Office parts ($) column, Office Total ($), both sides of Overhead % (office numerator AND field-materials denominator), the KPI averages' office-parts input, and all three Materials-bearing breakdown modals (officeParts / total / otherJobs) — is computed from bucketed accounting sections with the `internal_transfer` bucket excluded (`sumPartsUsdByDayExcludingInternalTransfer` per day, `sumMaterialsTotalUsdExcludingInternalTransfer` in the modals). Columns and modals therefore always agree; the old modal-vs-column asymmetry (modal excluded, column didn't) is resolved. Excluded transfers still render inside the modals' sections list with the slate accent + "not counted in Materials".
16. **Bucket map is precomputed per detail-map change**, not per modal open; unassigned tx ids default to the `'other'` bucket at render via `bucketForOverheadPartsLine`.
17. **90-day averages divide by the fixed window length** (calendar-day average including zero-activity days); per-$100 is null when window revenue is ≤ 0; the KPI tooltip warns recent days underreport until sessions are approved.
18. **Single combined loading gate** hides the whole day table until all four loads (both session sets + both parts sets) settle.
19. **Persistence keys:** localStorage `people_overhead_table_simple_view_v1` (default Advanced), app_settings `overhead_office_job_ledger_id_v1` — the latter is also read independently by `People.tsx` for the Review tab's overhead-rate calc (change here does not propagate until reload).
20. **Simple vs Advanced views order columns differently** (Simple: Overhead % before Office Total; Advanced: Office Total before Overhead %) — preserve both layouts and the `borderLeft` group separators.

## Recent churn (from `docs/RECENT_FEATURES.md`, grep-verified)

- **Contracts:** heavy feature waves v2.34x–v2.365 (signing flow, Contract Book, Upload Signed / Request Signature tabs, send-email preview + subject/intro, lineage + applied-version pin) and v2.464 (assistant delete removal, `canDeleteLibraryEntries`). Component filename never appears in RECENT_FEATURES (features landed pre-extraction under `People.tsx`).
- **Overhead:** rapid build-out v2.456–v2.466 (office job setting, breakdown modals, office parts, field totals, hours columns, Simple/Advanced toggle), Overhead % label v2.501–v2.502, and the recent Internal Transfers wave (`sumMaterialsTotalUsdExcludingInternalTransfer`, 4-bucket accounting sections). Higher ongoing churn than Contracts — extract the breakdown modal sooner rather than later.

Definition of done per extraction, verification gates (`npm run typecheck && npm run lint && npm test` after every step), and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md). Behavior-preserving only.
