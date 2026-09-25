# Jobs Modals Architecture Map

---
file: docs/JOBS_MODALS_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map (per PAGE_DECOMPOSITION_PLAYBOOK.md) for the three large Jobs-area modals — JobsSubLaborFormModal.tsx (2,623 lines), DetailJobModal.tsx (2,711) and JobsCombineSeparateModal.tsx (1,819). Inventories every logical region's state, handlers, supabase tables/RPCs, children, coupling and test coverage so a sub-decomposition can start without re-deriving the strategy. The first two came out of earlier mapped extractions (JOBS_TABS_ARCHITECTURE.md step 4; the app-wide Job Detail modal) and have grown since; the third was extracted from the Pipeline board long ago and never mapped. Each is its own surface.
covers:
  - src/components/jobs/JobsSubLaborFormModal.tsx
  - src/components/jobs/DetailJobModal.tsx
  - src/components/jobs/JobsCombineSeparateModal.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
sections: What this surface is; The shared substrate (or lack of one); Master summary table; Test coverage; JobsSubLaborFormModal dossiers; DetailJobModal dossiers; JobsCombineSeparateModal dossiers; Preserve-quirks list; Stage-A pure-logic inventory; Recommended extraction order
last_updated: 2026-09-25
---

## What this surface is

> **The tabbed Job window (v2.1675).** For roles where [`resolveJobWindowMode`](../src/lib/jobDetailModalRole.ts)`(role) === 'window'` (= `isStaffFullJobLedgerDetailRole`: dev / master_technician / assistant / controller / primary), `JobDetailModalContext` mounts [`JobWindowModal.tsx`](../src/components/jobs/JobWindowModal.tsx) (Job · Edit · Bill · Costs · History, one ✕) and `DetailJobModal` renders inside it as the Job pane: `paneMode` (no own overlay / Esc listener / ✕ / Close), `paneBodyHidden` (hides only the body below the Street View band, so the header icons and their satellite modals stay live on every tab), `externalRefreshKey`, `onEscBlockedChange`, `onRequestTab`, `onJobLoaded`. Superintendent, estimator and the sub-like roles get the standalone read-only `DetailJobModal`. Everything below applies to both renders unless a quirk says otherwise.

Three Jobs-area modal "God components", mapped together because they are the Jobs area's biggest remaining modal files, but **they are independent surfaces** — no shared state, no shared selection pointer. They meet only at the database (`jobs_ledger*` reads; `migrate_job_ledger_costs_and_delete` is also JobFormModal's) and at a few duplicated kernels (see Stage-A inventory).

**Line numbers are as of `a05cef4c4` and rot — search the named symbol; regenerate the fact sheet with `npm run map -- <file>`.** Counts below are the fact sheet's.

| File | Lines | Hook census | Churn | What it is | Mounted by |
|---|---|---|---|---|---|
| [`JobsSubLaborFormModal.tsx`](../src/components/jobs/JobsSubLaborFormModal.tsx) | 2,623 | 45 `useState` · 7 effects (6 `useEffect` + the `useImperativeHandle` at 1151–1173, which the map tool counts) · 1 `useMemo` · 0 `useCallback` · 0 refs · 3 custom hooks | 37 commits / 90 d; last 2026-09-20 | New/Edit Sub Labor form (3-step wizard for New, single scroll for Edit), plus Add Subcontractor and labor-book entry modals. **Always mounted**, driven by a `forwardRef` handle so form state survives open/close. | [`Jobs.tsx`](../src/pages/Jobs.tsx) 2169–2198 via `subLaborFormRef` |
| [`DetailJobModal.tsx`](../src/components/jobs/DetailJobModal.tsx) | 2,711 | 27 `useState` · 11 effects · 20 `useMemo` · 2 `useCallback` · 5 refs · 16 custom hooks; 6 components + 7 module functions in the file | 54 / 90 d; last 2026-09-23 | The app-wide read-mostly **Job Detail** window: two-tier (full/limited) fetch, header action row, Street View band, customer band, journey strips, thread notes + % complete, cost/profit bands, two link dialogs, five satellite modals. | [`JobDetailModalContext`](../src/contexts/JobDetailModalContext.tsx) 214 (standalone) and `JobWindowModal` 312 (pane); `openJobDetail()` callers app-wide. Types imported by `useDashboardBillingInvoices` + `DashboardFieldCollectPaymentQueue` |
| [`JobsCombineSeparateModal.tsx`](../src/components/jobs/JobsCombineSeparateModal.tsx) | 1,819 | 43 `useState` · 9 effects · 3 `useMemo` · 1 `useCallback` · 0 refs · 5 custom hooks | 16 / 90 d; last 2026-08-22 | **Combine / Separate jobs**: Combine = migrate source job's costs + total into a target and delete the source; Separate = split picked Specific Work lines (+ optional clock sessions) into a new job; a duplicate-address finder stages Combine pairs. | [`JobsStagesTab.tsx`](../src/components/jobs/JobsStagesTab.tsx) 4685–4689, opened from the ⋯ menu ([`JobsStagesToolsMenu.tsx`](../src/components/jobs/JobsStagesToolsMenu.tsx) `onOpenCombineSeparate` → `combineSeparateModalOpen`, JobsStagesTab 3089); `onAfterSuccess` → `runJobsStagesSerializedPipeline(loadJobs)` |

None of the three has a URL-driven tab switch. Regions are **logical clusters** (state + handlers + a JSX block) gated by mode flags (`editingLaborJob`, `laborStep`, `fullJob` vs `limitedJob`, `paneMode`, `activeTab`, sub-modal open states). Much of their pure logic and several sections are already in `lib/*` / hooks / child components (noted per dossier); what remains inline is validation, save pipelines, money previews, JSX bands and small stacked modals.

---

## The shared substrate (or lack of one)

No substrate spans the modals. Each has its own, and for the first two the selection pointer already lives *outside* the file (the playbook's rule is already satisfied).

### JobsSubLaborFormModal's substrate (owned by `Jobs.tsx`)

- **Selection pointer:** `editingLaborJob` / `setEditingLaborJob` — parent-owned controlled props (`JobsSubLaborFormModalProps` 95–134). It doubles as the open gate (`laborModalOpen || editingLaborJob`, 1249). It stays in `Jobs.tsx` because [`useSubLaborLedger`](../src/hooks/useSubLaborLedger.ts)'s `onLaborJobsReloaded` callback re-syncs the open record (Jobs.tsx 317–323). The `?editLabor=` router never sets it: it calls the handle (Jobs.tsx 1186–1196 — sheet id wins over number → `openEdit` / `openNewWithJobNumber`), and the modal writes the parent state through the `setEditingLaborJob` prop (`openEditLaborJob`, 866).
- **Data engine:** `useSubLaborLedger` (parent-side) supplies `loadLaborJobs`, `deleteLaborJob` (owns the delete `confirmDialog`), `laborJobDeletingId`, `setLaborJobs`, `restoreLaborJobPayment`, and the payment mutations behind the sibling [`SubLaborPaymentModals`](../src/components/jobs/SubLaborPaymentModals.tsx) + [`SubLaborPaymentMoveRemoveModals`](../src/components/jobs/SubLaborPaymentMoveRemoveModals.tsx). The modal never queries the ledger; it writes `people_labor_jobs` / `people_labor_job_items` / `people_labor_job_assignees` directly, then calls `loadLaborJobs()`.
- **Job cache:** `jobs` (for the picker and edit resolution) + `ensurePaidJobsLoaded` / `paidJobsLoading` (the board cache holds non-paid scopes; the form merges the paid scope in on open, effect 1117–1119).
- **Roster substrate:** `users`, `people`, `loadRoster` are parent props; the modal only partitions them (S2).
- **Page-global `error`:** the one `error`/`setError` pair every Jobs tab shares (quirk #7 in `JOBS_TABS_ARCHITECTURE.md`), rendered twice in this file (quirk #12).

**Consequence:** any internal split keeps `editingLaborJob`, the imperative handle, the step machine and the save/close orchestration in the shell; extracted sections receive controlled props one level down.

### DetailJobModal's substrate (owned by `JobDetailModalContext` / `JobWindowModal`)

- **Selection pointer:** the `jobId` + `open` props. The context owns them app-wide (`openJobDetail`/`closeJobDetail`, `instanceKey` remounts, `assignedJobsRows` defaulted from `JobsListCache`); the window passes them through. The modal owns **no selection**.
- **Data engine (internal):** `fullJob` / `limitedJob` / `loading` / `error` + `loadDetail` (694–747) + `detailFetchIdRef` (race guard) + `lastLoadedJobIdRef` (same-job refresh keeps data) + `materialsCostRefreshKey`. Every band reads `fullJob ?? limitedJob`; `loadDetail` re-runs from the link saves, the % commit, Edit-Job `onSaved`, and the window's `externalRefreshKey`. Any body extraction receives it as props — never re-fetches.
- **Eight data hooks hang off the pointer,** each gated by a boolean so disabled roles never fetch: `useJobMaterialsCostSnapshot` (856), `useJobDetailSubLaborCost` (868), `useJobDetailTeamLabor` (880), `useJobDetailScheduleAndSessions` (930), `useJobClockSessionBounds` (940), `useJobAccountShares` (1080), `useJobAccountStrips` (1083), `useJobThreadNotesForModal` (1174). Their outputs feed the D4 cost-engine memos.

### JobsCombineSeparateModal's substrate (owned by itself)

- **No parent selection.** Props are only `open`, `onClose`, `onAfterSuccess` (68–72). The Pipeline board renders it unconditionally; it returns `null` when closed and `resetAll` (174–219, run by the effect at 221–223 when `open` goes false) wipes all 43 states.
- **Internal tab key** `activeTab` (`'combine' | 'separate'`, 108) — not in the URL.
- **Cross-tab state (stays in the shell on any split):** `activeTab`; `searchEvidence` (fed by all three candidate lists, 540–569); `sSplitFollowUpJobId` (Separate's success view, but `combineCanSubmit` 493–496 reads it too); the busy pair behind `overlayBusy` (`cMigrateBusy || sSplitBusy`, 728).
- **Role gate lives upstream** — the ⋯ menu item renders only under `gates.officeTools` in `JobsStagesToolsMenu.tsx`; the modal makes no role check of its own. `useAuth().role` is used only for the search-evidence mode.

---

## Master summary table

Regions in file order. Anchors are symbol + line range at `a05cef4c4`.

| # | Region | Anchor | Coupling | Risk | Status | Tests |
|---|---|---|---|---|---|---|
| S1 | Shell: state, validation, dual save, step wizard, reset/close, handle, footers | `laborMissingFields` 241–263 · `saveLaborJob` 677–803 · `resetLaborForm` 831–850 · `closeLaborModal` 852–860 · `openEditLaborJob` 862–905 · `saveEditedLaborJob` 945–1061 · handle 1151–1173 · `editSummary` 1194–1212 · form 1253–1286 · footers 2275–2442 | high | high | inline — **stays as the shell** | handle contract + hydrate (render test); **save pipelines and validation messages untested** |
| S1b | Job field + job picker | `persistPickedJobForEdit` 1078–1094 · `applyPickedLaborJob` 1097–1107 · effect 1124–1129 · JSX 1287–1440 · picker 2444–2470 | med | med | inline; picker + `subLaborJobPicker` kernels extracted | kernels (8) + render (pick known/unknown, edit pick persists) |
| S2 | Crew picker (External / Internal Subs / Office Team) | roster fns 318–413 · derived 415–422 · effect 1131–1136 · `renderLaborCrewChip` 1220–1245 · JSX 1441–1589 | med | low-med | inline | render (bench filter); `filterLaborCrewNames` tested; roster fns untested |
| S3 | Fixture rows editor (simple ⇄ itemized) | row fns 653–675 · `handleLaborFixtureEntryModeToggle` 805–829 · IIFE 1591–1962 (S3's part 1591–1869; S4 fills the rest) | med | med | inline | **money math: `lineLaborCost` no direct test; toggle conversion untested** |
| S4 | Invoice link | `saveLaborInvoiceLinkDraft` 907–931 · `cancelLaborInvoiceLinkDraft` 933–936 · JSX 1870–1959 | low-med | low | inline | `resolvedLaborInvoiceLink` tested |
| S5 | Edit-only panels (portal fields, work order, assembler) | `onLaborJobStageSaved` 1177–1190 · `sheetJobForAssembler` 205–210 · JSX 1964–2016 | low | — | **extracted** (3 components); mounts stay | `subSheetStage` tests |
| S6 | Payments (edit only) | `paymentMenuId` 170 · `sheetsByIdForTrace` 171 · JSX 2017–2129 | low | low | inline | render (two-line row); `subPaymentTraceLines` (3 of `subPaymentMoveRemove`'s 12); totals IIFE untested |
| S7 | Labor book + entry form modal | state 177–192 · loaders 436–473 · fixture types 475–512 · `applyLaborBookHoursToPeople` 514–554 · entry CRUD 556–651 · effects 1138–1149 · JSX 2130–2273 · modal 2550–2610 | low-med | low | inline — **best first big extraction** | none |
| S8 | Add Subcontractor modal | `checkDuplicateName` 265–275 · `handleSaveAddSubcontractor` 277–316 · JSX 2475–2548 | low | low | inline — trivial | none |
| D1 | Module helpers + presentational components | 148–635 | none | low | in-file — Stage A / file moves | `DetailJobModalCustomerPanel` render (2); pure fns untested |
| D2 | Data core | state 655–674 · names effect 675–690 · `loadDetail` 694–747 · open effect 749–762 · resets 764–782 · `detailJob` 839–842 | high | high | inline — **stays as the shell** | context + window render tests drive it (mocked fetch) |
| D3 | Identity memos | `modalTitleParts` 786–795 · `paneJobNumber` 806–810 · `mapsAddressLine` 812–816 · `accountManDisplay` 818–827 · `shareFields` 829–837 | high (read everywhere) | low | inline | kernels tested (`accountMan`) |
| D4 | Cost engine (gates, hooks, money memos) | 844–958 | high (D10, D11, header) | med | hooks extracted; memos inline | `jobProfitSummary` (4), `jobCostsSummaryCard` (4), role gates (7); **inline parts-total sum untested** |
| D5 | Header: title + action row + account-man chip | JSX 1373–1733 · handlers 1073–1118, 1212–1310 | med | med | inline (children extracted) | window render (header persists, no ⚙) |
| D6 | Street View band | effect 998–1054 · `openMapsAddress`/`openStreetView` 1056–1068 · JSX 1738–1875 | low | low | inline — good early extraction | none |
| D7 | Top band (customer, link icons, phone tiles, account strip, schedule) | JSX 1881–1957 | low-med | low | inline | customer panel only |
| D8 | Their journey | `theirJourneyOpen` 1072 · JSX 1962–1998 | low | low | inline (strips extracted) | none |
| D9 | Thread notes + % complete | 1174–1210 · JSX 2000–2032 | med | med | mostly extracted | `stagesPctNote` tested |
| D10 | Full-job body | JSX 2039–2378 | med | med | inline — extract as `JobDetailFullBody` | none direct |
| D11 | Limited-job body | JSX 2380–2457 | low | low | inline — with D10 | none |
| D12 | Add-link + stacked Customer-Files dialogs | 1119–1173 · JSX 2486–2645 | low | low | inline — trivial | none |
| D13 | Close row + satellite mounts | JSX 2459–2482, 2646–2708 | low | — | **extracted** (5 components); mounts stay | `DetailJobModalStackedClicks` (3) |
| C1 | Shell: tab strip, reset, overlay, split-success view | 103–224 · 721–857 | high | med | inline — **stays as the shell** | none |
| C2 | Combine pickers (source/target search) | effects 226–300 · JSX 907–1046 | med | low-med | inline | none |
| C3 | Combine preview + confirm | `loadCostPreview` 339–370 · effects 145–149, 373–420 · `combineCanSubmit` 493–496 · `runCombineMigrate` 646–681 · JSX 1047–1267 | med | **high** (irreversible RPC; money preview) | inline | **none — money preview untested** |
| C4 | Separate tab | effects 303–337, 423–491 · `separateCanSubmit` 506–530 · `projectedSplitRevenue` 532–537 · `runSeparateSplit` 683–719 · JSX 1268–1577 | med | high | inline | none |
| C5 | Duplicate-address finder | `openDupFinder` 583–627 · `stageDupPair` 630–644 · JSX 1581–1816 | low | low | inline — **best first extraction** | `duplicateJobAddressGroups` (6) |
| C6 | Search-candidate evidence rail | effect 540–569 · `renderCandidateBody` 572–581 | low | low | inline (row component extracted) | `jobSearchEvidence` (mode) |

---

## Test coverage

| File under map | Render tests | Kernel tests behind it | Gaps (risk) |
|---|---|---|---|
| JobsSubLaborFormModal | [`JobsSubLaborFormModal.render.test.tsx`](../src/components/jobs/JobsSubLaborFormModal.render.test.tsx) (312 lines): closed → nothing; bench filter; `openNew` empty form + picker; paid scope requested on open/edit; `openEdit` hydrate + link; `openNewWithJobNumber` known/unknown; `openWithBillingPrefill`; two-line payment row; edit pick persists + toast; bare `open()` vs `openNew()`; Date-of-Labor affordance ×4 | `subLaborJobPicker` (8), `subPaymentMoveRemove` (12), `assigneePersonIds`, `jobAddressUrls`, `subLaborSheet` (print HTML), `jobFormatting` (`filterLaborCrewNames`), `combinePeople`, `subSheetStage`; `laborItemsSubtotal` only indirectly (`subLaborCost` / `subLaborOutstanding` tests) | **Both save pipelines, all validation messages, the item payload, the mode-toggle dollar conversion, `lineLaborCost` (no direct test), labor-book apply, Add Sub, invoice-link save** |
| DetailJobModal | [`DetailJobModalStackedClicks.render.test.tsx`](../src/components/jobs/DetailJobModalStackedClicks.render.test.tsx) (backdrop vs satellites, 3), [`DetailJobModalCustomerPanel.render.test.tsx`](../src/components/jobs/DetailJobModalCustomerPanel.render.test.tsx) (portal globe, 2); also rendered by `JobWindowModal.render.test.tsx` (pane header, no ⚙) and `JobDetailModalContext.render.test.tsx` (window vs read-only by role) | `jobDetailModalRole` (7), `jobProfitSummary` (4), `jobCostsSummaryCard` (4), `jobWindowBar` (5), `editJobBillingBar`, `moneyStoryDoor`, `accountMan`, `jobAccountStrip`, `stagesPctNote`, `stagesJobReferenceDates`, `jobScheduleChicago`, `formatClockSessionTimestamp`, `fetchJobMaterialsCostSnapshot` (line totals), `settingsGroups`, `checklistJobPreset`, `supplyHouseJobAccountsLedger` | **Inline parts-total and billed-materials sums (D4)**; module pure fns; `mergeLimitedFromAssignedAndLedger`; `buildServiceTypeTradePill` (no test); full/limited bodies; Esc gap (quirk #34) |
| JobsCombineSeparateModal | **none** | `duplicateJobAddressGroups` (6: groups, enrichments, `formatDaysAgoShort`, `revenueDollarsFromFixtures` indirectly), `jobSearchEvidence` (mode), `fetchJobMaterialsCostSnapshot`, `teamLabor`, `ledgerDisplayPrefixes`, `scheduleDispatchHub` (`jobPickerStatusChip`) | **The whole modal: combine preview money math (`loadCostPreview`, the New column), both submit gates, split payload; `useJobStatusPctPair` + `JobCombineStatusNotice` untested** |

---

## JobsSubLaborFormModal dossiers

Component `JobsSubLaborFormModalInner` (136–2613), wrapped `forwardRef` as `JobsSubLaborFormModal` (2621). Custom hooks: `useIsMobile` (169), `useConfirmDialog` (172), `useToastContext` (173). One memo (`sheetsByIdForTrace`, 171); every other derived value is recomputed per render — preserve. Handle `JobsSubLaborFormModalHandle` (84–93): `open` / `openNew` / `openEdit` / `openNewWithJobNumber` / `openWithBillingPrefill`.

### S1 — Shell (form core, validation, saves, wizard, handle)

- **Render:** gate `{(laborModalOpen || editingLaborJob) && …}` 1249–2473 (overlay zIndex 50, card `min(400px, …)`); title "New Sub Labor"/"Edit Sub Labor" 1252; `<form onSubmit>` 1253–1266 (Edit → `saveEditedLaborJob`; New → advance a step unless `laborStepNextBlocked`, save on step 3); page-global `error` 1267; Edit summary line (`editSummary`: contractor · total · due) vs New's 3-segment step bar 1268–1286; New-mode wizard footer 2275–2347 (Cancel/Back · Next or Print + Save "Needs: …"); Edit footer 2348–2442 (quiet Delete left → parent `deleteLaborJob`; Cancel; Print → parent `printJobSubSheet(editingLaborJob)`; Save; missing-field list).
- **Owned state (11):** `laborModalOpen`, `laborSaving`, `laborStep` (`1|2|3`, v2.1617), `laborDate` (`todayYmdInAppTz()`), `laborDistance` (no input any more — quirk #16), `laborAssignedTo`, `laborAddress`, `laborJobNumber`, `laborPickedJobId` (the three written by S1b; `laborAssignedTo` by S2/S8 and by S1b's New-mode crew pre-check), `serviceTypes`, `selectedServiceTypeId` (loaded on open by `loadServiceTypes` 424–434, which keeps a still-valid selection; scopes S7).
- **Derived (per render):** `laborMissingFields` / `laborCanSubmit` 241–263; `laborStepVisible` 1192 (Edit shows every step); `LABOR_STEP_TITLES` + `laborStepNextBlocked` 1213–1217; `editSummary` 1194–1212 (a copy of the S6 totals math).
- **Handlers:** `saveLaborJob` (errors → one `setError`; INSERT `people_labor_jobs` with `job_ledger_id: laborPickedJobId`, then `upsertAssigneeJunction` 331–340, then sequential per-row INSERT `people_labor_job_items`, abort on first error; resets, `setActiveTab('subs')`, `closeLaborModal()`, `loadLaborJobs()`), `saveEditedLaborJob` (UPDATE — `job_ledger_id` only when picked — then junction upsert, DELETE all items, sequential re-INSERT), `openNewLaborJob` 938–943, `openEditLaborJob` (hydrate rows, mode detection, picked-job resolution), `resetLaborForm`, `closeLaborModal` (also `onClearEditPayment()`), `printLaborSubSheet` 1063–1071 (unsaved form via `buildLaborFormSubSheetHtml` + `openHtmlPrintWindow`).
- **Effects:** service types on open (1109–1111); paid-scope merge on open (1117–1119); the handle (1151–1173).
- **Handle:** `open()` = bare `setLaborModalOpen(true)` (quirk #1); `openNew()`; `openEdit(job)`; `openNewWithJobNumber(n)` (resolves via `resolveSubLaborJobByNumber` → `applyPickedLaborJob`, else keeps the typed number); `openWithBillingPrefill(seed)` (reset, resolve or seed number/address, roster-intersect `teamMemberNames`) — **no production caller** (quirk #18).
- **Tables:** `people_labor_jobs` (INSERT/UPDATE), `people_labor_job_items` (INSERT/DELETE), `people_labor_job_assignees` (UPSERT, best-effort), `service_types` (SELECT, cast `as any`).
- **External coupling:** the parent's `?newJob=` / `?editLabor=` router effects call the handle and MUST gate on `laborJobsLoadedOnce` (quirk #15).
- **Status:** **the shell — does not move.** Shrink it by extracting S1b–S8 around it and Stage-A'ing validation / payload / rate parsing so the two saves become thin IO over tested kernels.

### S1b — Job field + job picker (wizard step 1)

- **Render:** Job button 1287–1358 (picked label + read-only job address; amber "No job with this number" for an unmatched legacy number in Edit); row 1359–1440 — typed Address only in Edit with no linked job (1361–1372), Date of Labor (Edit: native input; New: MM/DD/YY text over an invisible input, `.subLaborDateBox`), Service type select when `serviceTypes.length > 1` (1426–1439); [`ScheduleDispatchAssignJobPickerModal`](../src/components/schedule/ScheduleDispatchAssignJobPickerModal.tsx) mount 2444–2470 (rows from `subLaborAssignPickerRows`).
- **Owned state:** `laborJobPickerOpen`, `laborJobPickerSearch`, `laborJobPickerNumberQuery`.
- **Handlers:** `applyPickedLaborJob(job, { keepAssigned })` fills id / number (`subLaborJobNumberForStorage`) / address and, for New, pre-checks the job's crew intersected with the roster; `persistPickedJobForEdit` (Edit: instant UPDATE of `job_number` / `job_ledger_id` / `address` + toast + `loadLaborJobs`); late-link effect 1124–1129 (fills an empty pick once `jobs` arrives: `job_ledger_id` first, else the typed number — unlike `openEditLaborJob`, a linked sheet whose job is not in the cache also falls back to the number, despite the code comment).
- **Status:** inline, medium risk (writes four shell states; the handle calls `applyPickedLaborJob`). Extract as a controlled `SubLaborJobField`; `applyPickedLaborJob` stays in the shell as its `onPick`.

### S2 — Crew picker (wizard step 2)

- **Render:** 1441–1589 — picked chips, crew search, "No crew match", External Subs box, `+ Add Sub` (opens S8) + collapsed toggles, expanded Internal Subs (1520–1553) and Office Team (1554–1586). Chips via `renderLaborCrewChip` (toggle in `laborAssignedTo`).
- **Owned state:** `laborCrewSearch`, `laborModalInternalSubsOpen`, `laborModalOfficeTeamOpen` (search auto-expands both, effect 1131–1136).
- **Helpers (pure over props):** `isAlreadyUser` 318–322, `byKind` 342–357 (`KIND_TO_USER_ROLE` 51–59; `isAssistantLike` for assistants; **bench filter** v2.3618 — benched subs dropped by roster row, linked account and email), `rosterNamesSubcontractors` 359–367, `rosterSubcontractorsWithAccount` 369–379, `rosterSubcontractorsWithoutAccount` 381–387, `rosterNamesEveryoneElse` 389–413 (kinds in order + dev users, first-seen wins). Derived lists 415–422 filtered by [`filterLaborCrewNames`](../src/lib/jobs/jobFormatting.ts). `applyPickedLaborJob` and `openWithBillingPrefill` also call the `rosterNames*` pair.
- **Tables:** none.
- **Status:** inline, low-med. Stage A: roster partition → `lib/jobs/subLaborRoster.ts` + tests (bench, dedupe order, dev append, email match). Stage B: controlled `SubLaborCrewPicker` (`users`, `people`, `assignedNames`, `onToggleName`, `onAddSub`); its three UI states may move with it — the JSX sits inside the open gate, so the picker unmounts on close, which is safe only because every close already resets them (`resetLaborForm`); `openEditLaborJob` also clears them, so key the picker by sheet id.

### S3 — Fixture rows editor (wizard step 3)

- **Render:** IIFE 1591–1962 inside the step-3 block 1590–1963. Top locals 1592–1629: `laborModalLineFallbackRate`, `laborModalLinesSubtotal` (reduce over `lineLaborCost`), the "Itemize hours and rate" toggle, `laborModalTotalHrs`. Tables 1633–1815 (simple: Specific Work + Cost with total row; itemized: Count / hrs-per-unit / fixed / Labor Hours / Rate / Cost with totals). Remove-last (New only, 1827–1850) + Add line item 1851–1869; then S4's row.
- **Owned state:** `laborFixtureRows` (`LaborFixtureRow` 66–74), `laborFixtureEntryMode`.
- **Cross-region:** rows read by S1 (validation, saves, print, `editSummary`), S6 totals, S7's apply button; written by S7 (`applyLaborBookHoursToPeople`).
- **Handlers:** `addLaborFixtureRow` 653–667 (rate from the default-rate parse), `removeLaborFixtureRow` (floor of 1), `updateLaborFixtureRow`, `handleLaborFixtureEntryModeToggle` 805–829 (quirk #6).
- **Status:** inline, medium risk (mode semantics leak into S1's validation and payload). Stage A first, then a controlled `SubLaborFixtureRowsEditor` (`rows`, `mode`, `fallbackRate`, `onRowsChange`, `onModeToggle`); S4 renders inside this IIFE — extract S4 first or lift its JSX out.

### S4 — Invoice link

- **Render:** Link Invoice button + "Linked" chip 1870–1901; draft panel 1903–1959.
- **Owned state:** `laborInvoiceLinkExpanded`, `laborInvoiceLinkDraft`, `laborInvoiceLinkCommitted`, `laborInvoiceLinkSaving`.
- **Handlers:** `saveLaborInvoiceLinkDraft` — normalizes via [`resolvedLaborInvoiceLink`](../src/lib/jobs/jobAddressUrls.ts); Edit: immediate UPDATE `people_labor_jobs.invoice_link` + optimistic `setEditingLaborJob` / `setLaborJobs` patch, revert on error; New: local commit, rides the INSERT. `cancelLaborInvoiceLinkDraft` restores committed.
- **Status:** inline, low risk; dual-mode must be kept (quirk #14).

### S5 — Edit-only panels (already extracted)

- [`SubSheetPortalFieldsBox`](../src/components/jobs/SubSheetPortalFieldsBox.tsx) 1964–1981 — stage / payable-after / hold reason; `onLaborJobStageSaved` 1177–1190 patches `setLaborJobs` + `setEditingLaborJob` with the office stage stamp.
- [`SubSheetWorkOrderPanel`](../src/components/jobs/SubSheetWorkOrderPanel.tsx) 1982–2006 — sheet total/open from `editSummary`, default service type from the picked/linked job; `onOpenAssembler` only when `sheetJobForAssembler` (205–210) resolves in the cache.
- [`WorkOrderAssemblerModal`](../src/components/jobs/WorkOrderAssemblerModal.tsx) 2007–2016, driven by `assemblerInitial` (204) — S5's one owned state: set by the panel's `onOpenAssembler`, cleared by the modal's `onClose`, touched nowhere else.
- **Status:** components done; mounts and the two parent-cache patches stay in the shell.

### S6 — Payments (edit only)

- **Render:** `{editingLaborJob && …}` 2017–2129: totals IIFE 2020–2033 (`laborItemsSubtotal` with the fallback-rate chain; paid / backcharges / total fallback / balance), two-line payment rows (v2.3625) with Edit + Move/Remove (phone: ⋯ menu via `paymentMenuId`, `useIsMobile`), trace lines from `subPaymentTraceLines(payment_events, …, sheetsByIdForTrace, laborJobNamesForTrace, now)` with Undo → `restoreLaborJobPayment`, Payment / Backcharge buttons 2121–2126.
- **Handlers:** none of its own — the opener props `onOpenEditPayment` / `onOpenMakePayment` (balance seed) / `onOpenBackcharge` / `onOpenMovePayment` / `onOpenRemovePayment`, routed by the parent to the two sibling handle components.
- **Status:** inline, low risk. Stage A: the totals are [`subLaborJobBalance`](../src/lib/subLaborOutstanding.ts) (tested) over unsaved rows — adapt, but prove the rate fallback matches first (quirk #8). Stage B: presentational `SubLaborSheetPayments`.

### S7 — Labor book + entry form modal

- **Render:** collapsible section 2130–2273 (step 3 only): Version select + "Apply matching Labor Hours" (disabled in simple mode / no names) + 3 s message; version chips (select the entries table); entries table with ✎; Add entry. Entry modal `{laborEntryFormOpen && laborBookEntriesVersionId && …}` 2550–2610 (zIndex 50, renders after the main modal).
- **Owned state (16):** `fixtureTypes`, `laborBookVersions`, `selectedLaborBookVersionId` (apply source), `laborBookSectionOpen`, `laborBookEntriesVersionId` (entries table — distinct from the apply select), `laborBookEntries`, `applyingLaborBookHours`, `laborBookApplyMessage`, `laborEntryFormOpen`, `editingLaborEntry`, `laborEntryFixtureName`, `laborEntryAliasNames`, `laborEntryRoughIn`, `laborEntryTopOut`, `laborEntryTrimSet`, `savingLaborEntry`.
- **Loaders/handlers:** `loadFixtureTypes` 436–440, `loadLaborBookVersions` 442–454 (v2.3597: non-archived only, robot first, defaults to `is_robot`), `loadLaborBookEntries` 456–473 (`fixture_types(name)` join), `getFixtureTypeIdByName` / `getOrCreateFixtureTypeId` 475–512 (quirk #11), `applyLaborBookHoursToPeople` 514–554 (fetch the apply book, lowercase name + alias → total hours, first match wins; writes `hrs_per_unit`, nulls `direct_labor_amount`), entry CRUD 556–651 (`deleteLaborEntry` via `confirmDialog`). **Version CRUD is gone** (v2.3597, one book per trade).
- **Effects:** service-type change clears `laborBookEntriesVersionId` and reloads types + versions (1138–1144); entries follow `laborBookEntriesVersionId` (1146–1149).
- **Tables:** `labor_book_versions` (SELECT), `labor_book_entries` (SELECT/INSERT/UPDATE/DELETE), `fixture_types` (SELECT/INSERT). (D4's `useJobDetailSubLaborCost` reads the sheets S1 writes — `people_labor_jobs` / `people_labor_job_items` + `app_settings` — not these books.)
- **Status:** inline, low-med — **the best first big extraction**: self-contained cluster whose only inward write is the rows apply. `SubLaborLaborBookSection` (section + entry modal) taking `selectedServiceTypeId`, `entryMode`, `rows` (or `hasNames`), `onApplyHours(updater)`, `setError`. Stage A: `buildLaborBookHoursIndex` + `applyLaborBookHoursToRows` + tests.

### S8 — Add Subcontractor modal

- **Render:** `{showAddSubcontractorModal && …}` 2475–2548 (zIndex 60).
- **Owned state:** `showAddSubcontractorModal`, `newSubcontractor`, `addSubcontractorError` (modal-local), `savingAddSubcontractor`.
- **Handlers:** `checkDuplicateName` (parallel SELECT non-archived `people` + `users`), `handleSaveAddSubcontractor` (INSERT `people` `kind: 'sub'`, `master_user_id: authUserId`; `loadRoster()`; auto-checks the name into `laborAssignedTo`).
- **Status:** inline, low — trivial. `AddSubcontractorModal` with `open`, `onClose`, `authUserId`, `loadRoster`, `onCreated(name)`.

---

## DetailJobModal dossiers

Default export `DetailJobModal` (637–2711). Renders `null` when `!open` (1314). Contexts/hooks: `useJobFormModal`, `useToastContext`, `useUpdateFocusOpenerBridge`, `useChecklistAddModal`, `useAuth`, `useNavigate`, `useNarrowViewport640`, `useBodyScrollLock` + the eight data hooks. Refs: `streetViewBlobUrlRef` 663, `detailFetchIdRef` 664, `lastLoadedJobIdRef` 666, `onJobLoadedRef` 692, `supplyShareAutoOpenedRef` 1088.

### D1 — Module-level helpers + presentational components (148–635)

- **Types (exported):** `DetailJobScheduleContext` 89–94, `DetailJobModalAssignedJobRow` 97–107, `JobDetailAddLinkTarget` 445–448; `Props` 109–145.
- **Pure:** `splitScheduleDetailRowLabel` 148–157 (exported; first ` · ` only), `formatJobDetailModalTitleParts` 160–167 (name-first title + number chip), `googleMapsSearchUrlForAddress` 169–171, `formatCurrency` 173–175 (local Intl copy — quirk #25), `jobDetailBillingHoverTitle` 177–187, `mergeLimitedFromAssignedAndLedger` 557–583.
- **IO:** `fetchLimitedLedgerRow` 585–635 (`jobs_ledger` column SELECT + service-type join, `withSupabaseRetry`, `null` on failure).
- **Presentational:** `StackedClockSessionTimestamp` 200–222, `DetailRow` 224–276, `DetailJobModalCustomerPanel` 289–432 (exported; tel/mailto chips, portal globe, GC hard-hat + development icons), `JobDetailLinkIcons` 455–528, `DetailJobModalFilesPlansRow` 530–555; style consts `detailRowSoftBoxStyle`, `customerPanel*Style`, `detailJobFilesPlansButtonStyle`.
- **Status:** low risk, pure moves. Pure fns → `src/lib/jobs/jobDetailModalPresentation.ts` + tests; merge + fetch → `src/lib/jobs/limitedJobDetail.ts`; components → `jobDetailModalParts.tsx`. Move `DetailRow` / `StackedClockSessionTimestamp` before D10/D11.

### D2 — Data core

- **Owned state:** `loading`, `error` (modal-local), `fullJob`, `limitedJob`, `materialsCostRefreshKey`, `teamMemberNameFallback`.
- **Logic:** `loadDetail` — bumps `detailFetchIdRef`; clears data only on a job switch (`lastLoadedJobIdRef`, v2.1757); `isStaffFullJobLedgerDetailRole` → [`fetchJobWithDetailsById`](../src/lib/fetchJobWithDetailsById.ts) (+ `onJobLoadedRef.current?.(data)` for the window's phone bar), else `assignedJobsRows.find` + `fetchLimitedLedgerRow` merged (ledger wins). Open effect 749–762 re-runs on `externalRefreshKey`; closing bumps the guard and clears. Names effect 675–690 resolves null team names via `fetchUserNamesForIds` (RPC `list_user_display_names`). Five reset effects 764–782.
- **Callers of `loadDetail`:** open effect, `saveAddLink`, `saveStackedFilesLink`, `commitPctWithNote`, Edit-Job `onSaved`.
- **Status:** **the shell — stays.** Optional later: `useJobDetailData(open, jobId, authRole, assignedJobsRows, externalRefreshKey, onJobLoaded)` keeping both refs.

### D3 — Identity memos (786–837)

`modalTitleParts` (loaded → error → `prefillRowLabel` split → "Job Detail") + plain `modalTitle` 797–799 for child dialogs; `paneJobNumber` (HCP else C#); `mapsAddressLine` (job address else `prefillAddress`); `accountManDisplay` ([`buildAccountManDisplay`](../src/lib/jobs/accountMan.ts)); `shareFields` (for `ShareJobButton`). Read by the header, D6, D7, D12 and the satellites — stay in the shell.

### D4 — Cost engine: gates, hooks, money memos (844–958)

- **Gates:** `showMaterialsCostSection` 844–854 (`canExpandJobDetailMaterials` + full job, or limited for superintendent/estimator), `showProfitSection` 864–867 (`showJobDetailProfitSection`: dev / master / controller + full job), `showTeamLaborRow` 876–879 (`showJobCostBreakdownTeamLabor`: dev / master / controller). All in [`jobDetailModalRole.ts`](../src/lib/jobDetailModalRole.ts) (tested: `showJobDetailProfitSection`, `showJobCostBreakdownTeamLabor`, `resolveJobWindowMode` / `isStaffFullJobLedgerDetailRole`; **`canExpandJobDetailMaterials` and `showJobDetailJobTotal` have no test**).
- **Money memos:** `profitSummary` 881–898 ([`buildJobProfitSummary`](../src/lib/jobs/jobProfitSummary.ts); `null` on any snapshot `*Failed` flag — never a fake $0; `otherChargesTotal` is an inline reduce over `fullJob.materials`); `costsCardModel` 902–927 (pane mode only; **inline parts total** = supply + `mercuryCardTotalFromLines` + `tallyPartsTotalFromLines` + the same billed-materials reduce, then [`buildJobCostsSummaryCard`](../src/lib/jobs/jobCostsSummaryCard.ts)).
- **Other derived:** schedule-sessions hook gated on `scheduleTimeSectionOpen` (929–937); clock bounds + `jobStartParts` / `lastWorkParts` (939–953); `fullJobRecordedBilling` ([`deriveRecordedBillingActivityDetail`](../src/lib/stagesJobReferenceDates.ts), 955–958); `narrowViewport` / `phonePane` (960–963); band style memos 965–993; `topBandLeftActive` / `showTopBand` 995–996.
- **Status:** hooks extracted; memos inline. Stage A: the parts-total sum → shared kernel (cross-surface, see inventory). Optional Stage B seam: `useJobDetailCostEngine` returning gates + hook outputs + the two money memos, consumed by D10/D11.

### D5 — Header: title, action row, account-man chip (JSX 1373–1733)

- **Render:** `<h2>` 1384–1433 (number chip when not pane 1397–1413; phone-pane status chip 1415–1432 from `JOB_STEPPER_LABELS` / "Collections"); action row 1434–1729: trade pill 1452–1476 (→ `/jobs?tab=stages&stagesJob=` unless sub-like), money-story door 1478–1500 (`canOpenMoneyStory`), pane spacer, supply-house share 1504–1533 (teal when `jobAccountOnFile`), paid-email ✉ 1536–1590 (dev/master), calendar 1592–1625 (`showWeekDispatchButton`), send-as-task 1626–1661 (disabled until the record lands), ⚙ Edit 1662–1699 (`showEditJobButton`), `ShareJobButton` 1701, ✕ 1702–1728 (not in pane). Account-man chip 1731–1733 (`renderAccountManChip`); an `'only'` variant also paints the card's red top/bottom border (1354).
- **Owned state:** `paidEmailModalOpen`, `supplyHouseShareOpen`, `jobCalendarOpen` (satellite open states the header icons set); `detailScheduleModalOpen`, `detailScheduleInitialDate` (set only by `JobCalendarModal`'s `onOpenSchedule`, D13); `jobAccountSharesKey` (not an open state — the refresh key of `useJobAccountShares` / `useJobAccountStrips`, bumped when `SupplyHouseShareModal` closes).
- **Handlers:** supply-house share + one-shot auto-open effect 1089–1094; `openSendJobAsTask` 1099–1118 (`checklistJobModalPreset`); `handleOpenWeekDispatch` 1222–1227 (onClose + `/schedule-dispatch?jobId=&week=`); Esc effects 1239–1249 / 1254–1258 (quirk #34); `handleEditJobClick` 1272–1287 (window roles only; replaces, not stacks — quirk #23); `handleTradePillClick` 1304–1308.
- **Status:** inline, medium risk (navigation + self-close choreography). Extract last or never — it is orchestration the shell owns.

### D6 — Street View band (effect 998–1054; JSX 1738–1875)

- **State:** `streetViewImgUrl`, `streetViewLatLng`, `streetViewLoading`, `streetViewShown` (phone pane folds the image behind "street view ▸", 1834); `streetViewBlobUrlRef`.
- **Logic:** [`fetchStreetViewMeta`](../src/lib/fetchStreetViewPreview.ts) → `fetchStreetViewImageBlob` → object URL, with cancellation + revoke (quirk #27); `openMapsAddress`, `openStreetView` (pano when coords exist, else Maps search). Falls back to a plain 📍 map-link row.
- **Status:** inline, low risk — good early extraction: `JobDetailStreetViewBand` (`mapsAddressLine`, `open`, `phonePane`), taking the effect + four states.

### D7 — Top band (JSX 1881–1957)

Inside the `paneBodyHidden` wrapper (1880). `DetailJobModalCustomerPanel` over `detailJob` (1884–1897); `JobDetailLinkIcons` (`canEditJobLinks` = non-sub-like; grey icon → D12); phone-pane tiles 1910–1921 (`jobWindowTiles(buildEditJobBillingBar(...))`, gated by `showJobDetailJobTotal`); [`JobAccountsStrip`](../src/components/jobs/JobAccountsStrip.tsx) 1922–1930; `scheduleContext` block 1931–1955 ([`jobScheduleChicago`](../src/lib/jobScheduleChicago.ts) formatters). **Status:** inline, low — `JobDetailTopBand` taking `detailJob`, `fullJob`, `scheduleContext`, strip entries, `onAddLink`.

### D8 — Their journey (JSX 1962–1998)

Office roles (`canSeeWhatCustomersSee`) with a customer id: collapsed header + "Every job →" link; [`PersonJourneyStrips`](../src/components/journeys/PersonJourneyStrips.tsx) mounts only when opened (v2.3615 — no loader fan-out on every open). Owns `theirJourneyOpen`. **Status:** inline, trivial extraction with its state.

### D9 — Thread notes + % complete (1174–1210; JSX 2000–2032)

- `threadNotes` = [`useJobThreadNotesForModal`](../src/hooks/useJobThreadNotesForModal.ts); `canEditJobPctComplete` 1183–1190 (dev / master / assistant-like / primary); `pctSaving`; `commitPctWithNote` 1192–1210 (quirk #24; UPDATE `jobs_ledger.pct_complete`, toast, `loadDetail`). Leaving stamp → `requestOpenUpdateFocus()`; in pane mode Arrived/Leaving only when `viewerOnCrew(...)` (v2.3779).
- Renders [`JobThreadNotesPanel`](../src/components/JobThreadNotesPanel.tsx) (827 lines, extracted) with chrome-light props.
- **Status:** mostly done; `commitPctWithNote` + the role memo could move into the hook. Low value.

### D10 — Full-job body (JSX 2039–2378)

- **Gate:** `!loading && !error && fullJob`.
- **Sections:** Workflow link 2041–2059; date band (Last work date / Last bill date from `fullJobRecordedBilling` 2060–2078); Status via [`JobLedgerStatusPipeline`](../src/components/jobs/JobLedgerStatusPipeline.tsx) 2080–2082; files/plans row; **Assigned Team** 2089 (embedded name → `teamMemberNameFallback` → `…`); Job Start / Last Work bounds 2104–2109 + Reports button (`setReportsModalOpen`) + latest-report line 2139–2150; collapsible **Schedule and recorded time** 2182–2216 ([`JobDetailScheduleSessionsSection`](../src/components/jobs/JobDetailScheduleSessionsSection.tsx)); costs 2219–2232 — pane: [`JobDetailCostsSummaryCard`](../src/components/jobs/JobDetailCostsSummaryCard.tsx) (`onOpenCosts` → `onRequestTab('costs')`); standalone: [`JobDetailMaterialsCostSection`](../src/components/jobs/JobDetailMaterialsCostSection.tsx) (+ team-labor row) + [`JobChargesTimelineStandalone`](../src/components/jobs/JobChargesTimelineStandalone.tsx); [`JobDetailProfitSection`](../src/components/jobs/JobDetailProfitSection.tsx) 2234–2245 (standalone only); [`PartnerJobSplitPanel`](../src/components/partnerships/PartnerJobSplitPanel.tsx) 2248 (dev); Specific Work 2250–2311 (credit lines render `−`); Job Total 2316; Payments 2322–2350; Invoices 2353–2375.
- **Owned state:** `scheduleTimeSectionOpen`, `jobDetailScheduleSessionsFilter` (+ their reset effects); `reportsModalOpen` is opened here but mounted in D13. Reads D2's `teamMemberNameFallback`. `scheduleTimeSectionOpen` is also read by the shell: `scheduleSessionsEnabled` (929) gates the `useJobDetailScheduleAndSessions` call (930).
- **Status:** inline, medium risk (~15 inputs). `JobDetailFullBody` receiving `fullJob`, `authRole`, D4's outputs, clock parts, `teamMemberNameFallback`, schedule-sessions bundle, `onOpenReports`, `onRequestTab`; `jobDetailScheduleSessionsFilter` moves with it, but `scheduleTimeSectionOpen` stays in the shell (controlled open + toggle props) while the schedule hook's call site stays there. Do D1's component moves first.

### D11 — Limited-job body (JSX 2380–2457)

Workflow link, date band (Last bill date hardcoded `—` — quirk #26), status, files/plans, materials section (superintendent/estimator, `billedMaterials={[]}`), role-gated Job Total, the "not shown in this view" / "You are assigned on this job." footer. **Status:** low — `JobDetailLimitedBody` alongside D10.

### D12 — Add-link + stacked Customer-Files dialogs (1119–1173; JSX 2486–2645)

- **State:** `addLinkTarget`, `addLinkUrl`, `addLinkSaving`; stacked `stackedAddFilesOpen`, `stackedFilesUrl`, `stackedFilesSaving`.
- **Handlers:** `saveAddLink` / `saveStackedFilesLink` — `/^https?:\/\/\S+$/i` toast, `withSupabaseRetry` UPDATE `jobs_ledger` (`google_drive_link` / `job_pictures_link`), toast, `loadDetail()`. Photos footer (2516–2563): **Company** (hardcoded Drive folder — quirk #28) and **Customer** (the job's `google_drive_link`, else the stacked dialog, zIndex 1007).
- **Status:** low — `JobDetailAddLinkModals` (`jobId`, `target`/`onCloseTarget`, current drive link, `onSaved: loadDetail`, `showToast`); name the Drive URL as a const. `stackedAddFilesOpen` is also read by the shell's `detailEscBlocked` (1237–1238), so keep it shell-side (or report it up) — moving it inside silently lets Esc close Job Detail under the stacked dialog.

### D13 — Close row + satellite mounts (JSX 2459–2482, 2646–2708)

Close row (hidden in pane). Mounts: [`JobCalendarModal`](../src/components/jobs/JobCalendarModal.tsx) 2646–2660 (`onOpenSchedule` seeds `detailScheduleInitialDate`; `onOpenWeekDispatch`), [`ScheduleJobModal`](../src/components/jobs/ScheduleJobModal.tsx) 2661–2677, [`JobReportsModal`](../src/components/JobReportsModal.tsx) 2678–2690 (`zIndex={1100}`), [`PaidJobEmailSendModal`](../src/components/jobs/PaidJobEmailSendModal.tsx) 2691–2698, [`SupplyHouseShareModal`](../src/components/jobs/SupplyHouseShareModal.tsx) 2699–2708 (close bumps `jobAccountSharesKey`). **Status:** all components; mounts + open states stay in the shell.

---

## JobsCombineSeparateModal dossiers

Default export `JobsCombineSeparateModal` (103–1819). Hooks: `useToastContext`, `useAuth` (role → evidence mode), `useJobFormModal` (split follow-up), `useLedgerPrefixMap`, [`useJobStatusPctPair`](../src/components/jobs/useJobStatusPctPair.ts) (499–502). Module scope: `JOBS_COMBINE_SEPARATE_MODAL_Z_INDEX` = 1050 (dup finder +10), `formatCurrency` 46–48, `fixtureLineRevenue` 50–54, `fetchMaterialsBilledTotal` 56–66, `CombinePreview` 81–89, `COMBINE_LINE_DETAIL_OPEN_MAX` = 8, `dupFinderOpenedLabel` 96–101.

### C1 — Shell: tab strip, reset, overlay, split-success view

- **State:** `activeTab`; `resetAll` 174–219 (useCallback) + reset-on-close effect 221–223; `overlayBusy` 728.
- **Render:** overlay 730–746 (backdrop click ignored while busy), dialog + title 747–766; **split-success view** 767–810 when `sSplitFollowUpJobId` (Close, or **Edit new job** → `jobFormModalCtx.openEditJob(id, { onSaved: onAfterSuccess })` then close); tab strip 811–857.
- **Handlers:** `dismissSplitSuccess` 721–724.
- **Status:** **the shell — stays.**

### C2 — Combine pickers

- **State (10):** `cSourceSearch`, `cSourceCandidates`, `cSourceSearchLoading`, `cSourceId`, `cSourceRow`, and the five `cTarget*` twins.
- **Effects:** debounced `search_jobs_ledger` for source 226–260 and target 263–300 (target list drops the picked source) — quirk #39.
- **Render:** header row with **Find duplicates…** + ⓘ explainer toggle (`cInfoOpen`, 858–906); source search + list 907–977; target 978–1046. Candidate rows via `renderCandidateBody` → [`UnifiedSearchResultRow`](../src/components/search/UnifiedSearchResultRow.tsx).

### C3 — Combine preview + confirm

- **State:** `cSourcePreview`/`Loading`, `cTargetPreview`/`Loading`, `cMigrateBusy`, `cInfoOpen`, `cLineDetailOpen`.
- **Logic:** `loadCostPreview(jobId)` 339–370 — `Promise.all` of `fetchJobMaterialsCostSnapshot`, `fetchMaterialsBilledTotal` (`jobs_ledger_materials`), company-wide `loadTeamLaborData(supabase)` (quirk #40), `jobs_ledger_fixtures`; `partsStyle` = supply + tally + Mercury; line revenue via `revenueDollarsFromFixtures`. Preview effects 373–395 / 398–420; auto-open line detail 145–149. `combineCanSubmit` 493–496; status/% pair → [`JobCombineStatusNotice`](../src/components/jobs/JobCombineStatusNotice.tsx) 1226–1228.
- **Render:** Summary table 1047–1125 (Line items / Parts-style / Billed materials / Team labor × Source · Target · **New**), line-items `<details>` 1126–1224, Cancel + red **Confirm migrate and delete source** 1230–1267.
- **Handler:** `runCombineMigrate` 646–681 — RPC `migrate_job_ledger_costs_and_delete(p_from, p_to)`; `{ ok, error, note_body }` payload; toast; `onAfterSuccess()` + `onClose()`.
- **Status:** inline, **high risk** (irreversible; money preview untested). Stage A before any move.

### C4 — Separate tab

- **State (18):** `sJobSearch`, `sJobCandidates`, `sJobSearchLoading`, `sSourceId`, `sSourceRow`, `sFixtures`, `sFixturesLoading`, `sFixturePick`, `sSessions`, `sSessionNames`, `sSessionsLoading`, `sSessionsOpen`, `sSessionPick`, `sNewHcp`, `sNewName`, `sNewAddress`, `sSplitBusy`, `sSplitFollowUpJobId` (shell-shared).
- **Effects:** debounced search 303–337; source load 423–491 (`jobs_ledger_fixtures` by `sequence_order`, `clock_sessions` by `job_ledger_id` limit 250, `users` names; clears the picks whenever the source is unset or the tab is hidden).
- **Derived:** `sPickCount`, `sMovingAllFixtures` 504–505; `separateCanSubmit` 506–530; `projectedSplitRevenue` 532–537.
- **Render:** 1268–1577 — intro, source search 1291–1358, Specific Work checklist 1359–1432 (all-lines warning 1421, projected revenue 1430), clock sessions `<details>` 1434–1485, new job HCP / name / address 1486–1537, **Create new job and move lines** 1561–1573.
- **Handler:** `runSeparateSplit` 683–719 — RPC `split_job_ledger_fixtures_to_new_job(p_source_job_id, p_fixture_ids, p_new_hcp, p_new_job_name, p_new_job_address, p_clock_session_ids)`; on `new_job_id` shows the follow-up view instead of closing.
- **Status:** inline, high risk (creates a job; moves lines). `sSplitFollowUpJobId` + a busy callback stay in the shell.

### C5 — Duplicate-address finder

- **State (6):** `dupOpen`, `dupLoading`, `dupError`, `dupGroups`, `dupKeep`, `dupEnrich`.
- **Handlers:** `openDupFinder` 583–627 (`fetchJobsLedgerForScheduleDispatchHub` → `buildDuplicateJobAddressGroups`; evidence pass over `jobs_ledger_fixtures` + `jobs_ledger_payments` → `buildDupJobEnrichments`, failure-silent); `stageDupPair(target, source)` 630–644 writes the four Combine selection states and closes.
- **Render:** overlay 1581–1816 (zIndex 1060), groups with keep-radio, "opened …", line items, "Last paid …" (`formatDaysAgoShort`).
- **Status:** inline, low — **best first extraction**: `DuplicateAddressFinderModal` with `open`, `onClose`, `onStagePair(target, source)`. Kernels already tested.

### C6 — Search-candidate evidence rail

`searchEvidence` (140) accumulated per job id from all three candidate lists by the debounced effect 540–569 (`fetchJobSearchEvidence` + `jobSearchEvidenceModeForRole(role)`, failure-silent); `renderCandidateBody` 572–581. Shared by C2 and C4 → a `useJobSearchEvidence(ids, role)` hook seam, or leave in the shell.

---

## Preserve-quirks list (odd but load-bearing — do not "fix" during a move)

### JobsSubLaborFormModal

1. **Bare `open()` performs NO form reset** (the `?newJob=` deep link, Jobs.tsx 934). `openNew()` resets. The render test pins both.
2. **Always mounted; state survives close.** Any extraction that conditionally mounts a section holding form state changes behavior.
3. **Validation exists in three near-copies that now diverge:** render `laborMissingFields` 241–263 (labels Job / Assigned / Address / Fixtures; "Job" only for an unpicked New; its itemized rule does not fail fixed rows with negative hrs), `saveLaborJob` 683–743 (adds "Pick the job this labor belongs to."), `saveEditedLaborJob` 952–1009 (no job check). Consolidate **without changing any branch's messages or outcomes**.
4. **Item write shape is mode-dependent:** simple persists `count: 1, hrs_per_unit: 0, is_fixed: false, labor_rate: null` + `direct_labor_amount`; itemized persists real values + `direct_labor_amount: null`. Job-level `labor_rate` = the first valid row's rate.
5. **Edit save is UPDATE → assignee-junction upsert (best-effort, errors ignored) → delete-all items → sequential re-INSERT**, aborting on first error — no transaction; a mid-loop failure leaves partial items.
6. **Itemized→simple converts** each row's dollar cost into `direct_labor_amount` via `lineLaborCost` with fallback `editingLaborJob?.labor_rate ?? laborFixtureRows[0]?.labor_rate ?? 20` (row 0 — not the first non-zero row the render chain uses); simple→itemized nulls the amounts (hours not reconstructed).
7. **The literal `20`:** the default-rate parse `trim() !== '' && !isNaN(parseFloat(v)) ? parseFloat(v) || 20 : 20` appears 4× (654, 794, 839, 894); the chain `editingLaborJob?.labor_rate ?? first non-zero row rate ?? 20` 3× per render (`editSummary` 1196, S3 1592, S6 2020).
8. **Payments totals fallback:** computed labor total 0 but money moved → `totalCost = paid + backcharges`. Computed twice (`editSummary`, S6) over **unsaved** rows; `subLaborJobBalance` has the same rule over saved items with fallback `labor_rate ?? 0`. S3's subtotal uses `reduce(lineLaborCost)`, S6's `laborItemsSubtotal` — same intent, two paths.
9. **Dates:** `laborDate` defaults to `todayYmdInAppTz()`; New shows MM/DD/YY text over an invisible native input (render-tested), Edit a plain native input. No `job_number` length cap (v2.3435).
10. **`openEditLaborJob`:** `'simple'` only when the sheet has at least one item and every item has a finite `direct_labor_amount` (an itemless sheet opens itemized); missing per-line rates fall back to the job's `labor_rate`; the pick resolves `job_ledger_id` first, the typed number only for a sheet with no link.
11. **`getOrCreateFixtureTypeId` silently creates fixture types** (`category: 'Other'`, next `sequence_order`); failure logs and aborts the entry save.
12. **Page-global `error` renders in two places** (1267 and the entry modal) and is shared with every Jobs tab; the loaders write it too. Keep the single state.
13. **`closeLaborModal` calls `onClearEditPayment()`** — the parent clears both payment-modal handles.
14. **Instant-save fields in Edit:** the invoice link (S4) and the job pick (`persistPickedJobForEdit`) write immediately; everything else waits for Save.
15. **Handle-gating:** parent router effects calling the ref must gate on `laborJobsLoadedOnce` (Jobs.tsx 928–934) — an ungated cold-load call no-ops while stripping the param.
16. **No Distance input exists** (retired v2.1617), yet both saves validate `laborDistance` and write `distance_miles` — New saves 0, Edit round-trips the stored miles.
17. **Wizard steps hide with `display: none`** (`laborStepVisible`), never unmount — hidden steps keep state; Enter advances unless `laborStepNextBlocked`.
18. **`openWithBillingPrefill` has no production caller** (render test only). Removing it is its own PR.
19. **Bench filter (v2.3618)** drops benched subs from new picks only; names already on a sheet stay.
20. **One labor book per trade (v2.3597):** no version CRUD; `selectedLaborBookVersionId` defaults to the robot book; the entries table's version (`laborBookEntriesVersionId`) is separate from the apply select.

### DetailJobModal

21. **Two-tier fetch by role:** `isStaffFullJobLedgerDetailRole` (dev / master_technician / assistant / controller / primary) → full fetch; everyone else the limited ledger row merged over `assignedJobsRows` (ledger wins; the stub hardcodes `status: 'working'`, null customer fields). The same predicate (via `resolveJobWindowMode`) picks window vs standalone and gates the ⚙ — the tiers and surfaces must never disagree, or the edit form mounts for a role whose fetch returns null and self-closes.
22. **`detailFetchIdRef` race guard + `lastLoadedJobIdRef`:** stale fetches drop; a same-job refresh keeps data on screen (clearing blipped `mapsAddressLine` and re-fetched Street View on every autosave, v2.1757). Keep both in any hook extraction.
23. **Edit Job replaces (not stacks on) Job Detail** — `handleEditJobClick` opens the singleton then `onClose()`s; only for window roles; hidden in pane mode (the Edit tab replaced it).
24. **`commitPctWithNote` posts the note first and bails silently if it fails** — `pct_complete` is never written without its note.
25. **Local `formatCurrency`** (Intl currency, `$`) — distinct from `lib/jobs/jobFormatting`'s and from the Combine modal's (no `$`). Consolidate only with output-format proof.
26. **Limited body's "Last bill date" is always `—`**; the full body's is derived activity (`deriveRecordedBillingActivityDetail`).
27. **Street View blob-URL lifecycle:** revoked on address change, close, unmount, error; the phone pane only hides it (`streetViewShown`). Moving the effect keeps every revoke path.
28. **Hardcoded Company-Customers Drive folder URL** 3× here (2521, 2535, 2618); the same literal is in `EditCustomerForm.tsx` and `JobFormCustomerSection.tsx`.
29. **Stacking:** standalone backdrop zIndex 1004 is a stacking context holding every satellite (add-link 1006, stacked files 1007, paid email 1020, reports 1100, supply house 1300, calendar 60, schedule 1002 — ordered among siblings only); the window overlay is 1010. Backdrop close fires only when `target === currentTarget` (v2.1167) because satellites render inside it.
30. **`useBodyScrollLock(open && narrowViewport)`** — lock only on narrow viewports.
31. **`materialsCostRefreshKey`** re-runs `useJobMaterialsCostSnapshot`, `useJobDetailTeamLabor` and `useJobClockSessionBounds`; bumped only by Edit-Job `onSaved`.
32. **Per-open resets:** `scheduleTimeSectionOpen`, `jobDetailScheduleSessionsFilter`, `reportsModalOpen` reset via five separate effects; schedule sessions fetch only while the section is open.
33. **`teamMemberNameFallback`** exists because `users` RLS hides archived rows — embedded name → RPC → `…`.
34. **Esc gap (known, not a move fix):** `detailEscBlocked` (1237–1238) covers paid-email / reports / calendar / schedule / stacked-files but **not `addLinkTarget` or `supplyHouseShareOpen`** — Esc under those two dialogs closes Job Detail beneath them. Fix in its own PR.
35. **Pane-mode forks:** `costsCardModel` replaces materials + timeline + profit; `phonePane` adds the status chip, tiles and folded Street View; Arrived/Leaving need `viewerOnCrew` in pane mode only.
36. **Supply-house auto-open fires once** (`supplyShareAutoOpenedRef`) after the full job lands.

### JobsCombineSeparateModal

37. **Mounted always, `null` when closed; everything resets on close** (effect 221–223) — reopening always starts on Combine with nothing picked.
38. **Tab switches keep the job selections, not Separate's line picks:** the search/preview effects clear candidates and previews when their tab is hidden but keep `cSourceId`/`cTargetId`/`sSourceId` (and the new-job HCP/name/address); previews refetch on return. The Separate source-load effect (423–433) also empties `sFixturePick`/`sSessionPick` while its tab is hidden, so returning reloads the lines with nothing ticked. A Stage-B split must reproduce exactly that (display-toggle the tabs or keep selections in the shell).
39. **Three copies of the debounced search** (280 ms, ≥2 chars, top 30, cancelled flag) over `search_jobs_ledger`; the target list excludes the picked source.
40. **`loadCostPreview` loads company-wide team labor** (`loadTeamLaborData(supabase)`) per side and keeps one row — same pattern as `useJobMigrate`. Preserve until a per-job loader exists.
41. **The "New" column is a plain source + target sum** (a preview; the RPC does the merge). Line detail auto-opens only when combined lines ≤ `COMBINE_LINE_DETAIL_OPEN_MAX` (8).
42. **Confirm is one red click — no second dialog.** Irreversible except that a dev can restore the deleted source for 90 days (explainer 897–905). Backdrop click and Cancel are ignored while busy.
43. **Split rules:** ≥1 Specific Work line must stay (`sMovingAllFixtures`), HCP + name + address required, sessions optional; success switches to the follow-up view (not close), and `combineCanSubmit` is false while it shows.
44. **The dup finder only stages** (keep = target, other = source) and closes — never merges; its evidence fetch is failure-silent.

---

## Stage-A pure-logic inventory (extract to `src/lib/*` + tests before any component moves)

Already lib'd (do NOT re-extract): `lineLaborCost` / `laborItemsSubtotal` (`_shared/peopleLaborJobItemLineCost` — **no direct test**; subtotal covered only through `subLaborCost` / `subLaborOutstanding`), `subLaborJobBalance` (tested), `filterLaborCrewNames`, `resolvedLaborInvoiceLink`, `buildLaborFormSubSheetHtml`, `subLaborJobPicker` kernels, `subPaymentTraceLines`, `assigneePersonIdsForNames`, `LABOR_ASSIGNED_DELIMITER`, `composePctCompleteNoteBody`, `buildJobProfitSummary`, `buildJobCostsSummaryCard`, `jobWindowTiles` / `buildEditJobBillingBar`, `jobDetailModalRole` gates, `formatJobDetailModalDateYmd` (indirect test), `serviceTypeTradePill` (**untested**), `stagesJobReferenceDates`, `jobScheduleChicago`, `formatClockSessionTimestamp`, `mercuryCardTotalFromLines` / `tallyPartsTotalFromLines`, `buildDuplicateJobAddressGroups` / `buildDupJobEnrichments`, `revenueDollarsFromFixtures` (indirect test), `jobSearchEvidenceModeForRole`.

| Candidate | Currently | Target |
|---|---|---|
| **Direct tests for `lineLaborCost`** (every sub-labor total here rests on it) | shared kernel, untested directly | add `peopleLaborJobItemLineCost` cases (fixed vs count, `direct_labor_amount` precedence, fallback rate) — before any S3/S6 move |
| Sub-labor validation (quirk #3's three copies) | inline ×3 | `lib/jobs/subLaborFormValidation.ts` — `subLaborMissingFields(...)` + `subLaborSaveErrors(..., { isNew })` returning the exact strings; tests per mode/branch. **Biggest win in the file.** |
| Valid-row filter + item INSERT payload | inline ×2 (saves) | `lib/jobs/subLaborItemPayload.ts` — `filterValidLaborRows(rows, mode)` + `buildLaborJobItemInserts(rows, mode, jobId)` + tests |
| Default-rate parse (4 copies) + fallback-rate chain (3 copies + the toggle's row-0 variant) | inline | `parseDefaultLaborRate(v)` + `subLaborFallbackRate(job, rows)` beside the validation lib; keep the toggle's variant distinct (quirk #6) |
| Sheet totals (`editSummary` + S6 IIFE) | inline ×2 | adapter over `subLaborJobBalance` — first prove equal output for form rows (rate fallback differs, quirk #8) |
| Roster partition (`byKind` + bench filter, `isAlreadyUser`, `rosterNames*`, `KIND_TO_USER_ROLE`) | component body | `lib/jobs/subLaborRoster.ts` (pure over `(users, people)`) + tests. Note the canonical `KIND_TO_USER_ROLE` is exported from `components/people/peopleUsersTabShared.ts` (imported by `People.tsx`, `PeopleUsersTab.tsx`, `lib/people/hireWrites.ts`) and has a `controller` kind this local copy (51–59) lacks — reuse it only with that difference pinned |
| Labor-book hours apply | inline in `applyLaborBookHoursToPeople` | `lib/jobs/laborBookHours.ts` — `buildLaborBookHoursIndex(entries)` + `applyLaborBookHoursToRows(rows, index)` + tests (alias precedence, first match, `direct_labor_amount: null`) |
| **Parts total from a materials snapshot** | inline in DetailJobModal 906–911 (+ billed materials), JobsCombineSeparateModal 351–352 (without), JobFormModal 1559 | `jobPartsTotalFromSnapshot(snap, billedMaterials?)` in `supabase/functions/_shared/jobMaterialsCostLines.ts` (shared with dev-mcp) + `src/lib/jobs/jobMaterialsCostLines.test.ts` — money |
| Billed-materials sum | inline ×2 in DetailJobModal (890–893, 911) | fold into the parts-total kernel's second argument |
| **Combine preview model** (`partsStyle`, line revenue/count, lines, the New column) | `loadCostPreview` + the Summary table's `combined` fns | `lib/jobs/combinePreview.ts` — `buildCombinePreview(snap, billedTotal, teamRow, fixtures)` + `sumCombinePreviews(s, t)` + tests — money |
| Split readiness (`separateCanSubmit`, `sMovingAllFixtures`) | memo | `separateSplitReady({...})` + tests (all-lines block, blanks, busy) |
| Debounced ledger search (×3 here; 22 other non-test files name `search_jobs_ledger`, `types/database.ts` aside) | effects | `useDebouncedJobsLedgerSearch(query, { enabled, excludeId, limit })` hook seam |
| `formatJobDetailModalTitleParts`, `jobDetailBillingHoverTitle`, `googleMapsSearchUrlForAddress`, `splitScheduleDetailRowLabel` | module scope in DetailJobModal | `lib/jobs/jobDetailModalPresentation.ts` + tests (re-export `splitScheduleDetailRowLabel`) |
| `mergeLimitedFromAssignedAndLedger` (pure) + `fetchLimitedLedgerRow` (IO) | module scope in DetailJobModal | `lib/jobs/limitedJobDetail.ts`; the merge gets tests |

---

## Recommended extraction order (value ÷ risk)

Each step independently shippable; `npm run typecheck && npm run lint && npm test` green after each; behavior-preserving only. Coupling data: S7 has 16 owned states and one inward write; C5 six states and one outward callback; D6 four states and one effect — the three cheapest big wins.

### JobsSubLaborFormModal

1. **Stage A** — `lineLaborCost` tests first, then the validation kernel (documents quirk #3), item payload, rate parse/fallback, totals adapter, roster partition, labor-book hours.
2. **S7 `SubLaborLaborBookSection`** (+ entry modal) — ~420 lines out (logic 436–651, section 2130–2273, modal 2550–2610); smaller since version CRUD left (v2.3597).
3. **S8 `AddSubcontractorModal`** — trivial; validates the intra-modal prop seam.
4. **S6 `SubLaborSheetPayments`** — presentational over the totals adapter + trace kernel.
5. **S1b `SubLaborJobField`** — picker states move; `applyPickedLaborJob` stays in the shell (the handle calls it).
6. **S2 `SubLaborCrewPicker`** — after the roster lib (S1b and the handle need roster names without the component).
7. **S4 + S3** last — rows/mode stay shell-owned (S1, S6, S7 all touch them).

Separately (not a move): drop `openWithBillingPrefill` if still uncalled. **Stays in the shell:** open gating, the handle, step machine, `resetLaborForm` / `closeLaborModal`, both saves (thin over kernels), `serviceTypes` / `selectedServiceTypeId`, multi-region state (`laborAssignedTo`, `laborFixtureRows`, `laborFixtureEntryMode`, the job trio), S5 mounts, the page-global `error` pass-through. **Stays in `Jobs.tsx`:** `editingLaborJob`, the `?editLabor=` / `?newJob=` router with `laborJobsLoadedOnce` gating, `useSubLaborLedger`, both payment-modal siblings, `printJobSubSheet`, roster loaders.

### DetailJobModal

1. **Stage A / file moves** — D1 pure fns + `limitedJobDetail.ts`; the shared parts-total kernel (lands for JobFormModal and Combine too); move D1's five components to component files.
2. **D12 `JobDetailAddLinkModals`** — two tiny UPDATE handlers.
3. **D6 `JobDetailStreetViewBand`** — effect + four states + blob ref move together.
4. **D8 `JobDetailTheirJourney`** — owns its one state.
5. **D10 `JobDetailFullBody` + D11 `JobDetailLimitedBody`** — the big JSX win (~420 lines); D4 outputs and gates as props; the sessions filter + its reset moves with D10; `scheduleTimeSectionOpen` stays (it gates the shell's schedule hook) and so does `reportsModalOpen` (D13 mount).
6. **D7 `JobDetailTopBand`.**
7. **(Optional)** `useJobDetailCostEngine` (D4), `useJobDetailData` (D2); **D5 header** only if the shell is still too large.

**Stays in the shell:** `open` / `jobId` / `onClose` and every pane prop, `loadDetail` + both refs + `materialsCostRefreshKey`, the eight hook call sites and gate memos (several bands read them), D3 identity memos, all satellite open states + mounts, `scheduleTimeSectionOpen` and `stackedAddFilesOpen` (read by the hook gate / `detailEscBlocked`), the Esc effects, `handleEditJobClick` / `handleOpenWeekDispatch` / `handleTradePillClick`, the context wiring. **Stays in `JobDetailModalContext` / `JobWindowModal`:** the open-state machine, `instanceKey` remounts, `assignedJobsRows` defaulting, window-vs-standalone choice, `externalRefreshKey` bumps.

### JobsCombineSeparateModal

1. **Stage A** — `combinePreview` kernel + tests (money, currently zero coverage), `separateSplitReady`; add a render smoke for the modal (open, tab switch keeps both job selections and clears Separate's line picks, confirm disabled until both picked).
2. **C5 `DuplicateAddressFinderModal`** — `onStagePair(target, source)` is the whole seam.
3. **C4 `JobsSeparateTab`** — 17 of its 18 states move; `sSplitFollowUpJobId` and a busy callback stay in the shell; keep `sSourceId` across tab switches while the line/session picks reset as today (quirk #38).
4. **C2 + C3 `JobsCombineTab`** — after the preview kernel; `searchEvidence` becomes a hook or stays in the shell. `cSourceId` / `cSourceRow` / `cTargetId` / `cTargetRow` are also written by C5's `stageDupPair`, so they stay shell-side (or the finder mounts inside the tab).

**Stays in the shell:** `activeTab`, the reset-on-close contract, `overlayBusy`, the split-success view, `searchEvidence`, the three props. **Stays upstream:** the open state and `onAfterSuccess` → serialized reload (`JobsStagesTab`), the `gates.officeTools` menu gate (`JobsStagesToolsMenu`).

---

Definition of done per step, verification gates, and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md). `JobsSubLaborFormModal.render.test.tsx` pins the handle contract and must stay green through every step; the DetailJobModal tests above guard its backdrop and pane header; the Combine / Separate modal has **no render test** — add one before its first move.
