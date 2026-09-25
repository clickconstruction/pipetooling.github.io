# Workflow Page Architecture Map

---
file: docs/WORKFLOW_PAGE_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the Workflow.tsx decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md) — inventory what every region of the 4,354-line src/pages/Workflow.tsx touches (state, loaders, handlers, sub-components, supabase tables/RPCs, coupling, test coverage) so extraction can start without re-deriving the strategy. Sections — What this surface is; Key structural differences from Bids/Materials; Master summary table; Per-region dossiers; Shared infrastructure; Stage-A pure-logic inventory; Test coverage; Preserve-quirks list; Recommended extraction order.
covers:
  - src/pages/Workflow.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-25
---

> **Line numbers are exact as of `a05cef4c4`** (from the `npm run map -- src/pages/Workflow.tsx` fact sheet) and rot with the next edit — search the symbol named beside each range; the range is only a hint. Re-run `npm run map` before trusting one.

## What this surface is

| File | Lines | Components | useState | Effects | useMemo | useCallback | useRef | Custom hooks | Handlers / inner fns | Last commit | Commits / 90 d |
|---|---|---|---|---|---|---|---|---|---|---|---|
| [`src/pages/Workflow.tsx`](../src/pages/Workflow.tsx) | 4,354 | 1 (+12 module fns) | 51 | 10 | 1 | 0 | 2 | 6 | 63 | 2026-09-17 `5315a7a46` | 27 |

[`src/pages/Workflow.tsx`](../src/pages/Workflow.tsx) is the per-project detail page at `/workflows/:projectId` (`App.tsx` is its only importer) — the project's step pipeline, per-step financial line items and sub work orders, and workflow-level projections. It was 4,782 lines at the 2026-07-29 map, 4,288 after `StepFormModal` left (v2.1303), 4,354 now. Structure:

- **Module scope 29–144:** 11 row-type aliases (29–39) and 12 pure helpers — `formatDatetime` 41–47, `formatDateShort` 49–52, `daysOpen` 54–60, `daysBetween` 62–68, `formatAmount` 70–79, `formatLineItemDate` 81–87, `ymdFromDateLike` 89–92, `formatScheduledDateShort` 94–100, `expectedDueState` 107–114, `ymdAddDays` 116–125, `ymdDaysBetween` 127–137, `getStepStatusStyle` 139–144.
- **`Workflow()` 146–4354 (4,209 lines):** 51 `useState` (153–227), 2 `useRef` (`ensureWorkflowPromises` 259 — per-project mutex map; `lastLoadedWorkflowId` 262), 10 effects, **1 `useMemo`** (`projectSubRoster` 2078–2081), 0 `useCallback`, 6 custom hooks (`useParams`, `useNavigate`, `useEditProjectModal`, `useAuth`, `useToastContext`, `useJobDetailModal`), 63 handlers/inner functions (236–2076). All money derivations are still recomputed inline per render (`buildUnifiedRows`, `calculateProjectionsTotal`, `calculateLedgerTotal`, and the displayItems/money-flow/ledger-rail IIFE).
- **Render 2087–4353 (2,267 lines)** after three early returns (2083 loading, 2084 **error — replaces the whole page**, 2085 not found).
- **Already extracted children:** [`StepFormModal`](../src/components/workflow/StepFormModal.tsx) (542 lines, 15 `useState`, 1 effect), [`StepCommitmentPanel`](../src/components/workflow/StepCommitmentPanel.tsx) (632 lines, 7 `useState`, 0 effects), [`PersonDisplayWithContact`](../src/components/workflow/PersonDisplayWithContact.tsx) (66 lines). The fact sheet's render children: `Link`×2, `PersonDisplayWithContact`, `StepCommitmentPanel`, `StepFormModal`.

This is **not a tab-switched page**. Unlike Bids/Materials/People there is no `activeTab`: every region renders simultaneously in one vertical column, gated by **role** (`canManageStages`, `isDevOrMaster`, `canSeePrivateNotesAndApprove`, `canAssignSuperintendents`, `canCreateJobs`) rather than by tab state. The decomposition units are therefore **stacked regions + a modal cluster**, and the playbook's "tab" rules apply per region.

Feature/behavior reference: [`WORKFLOW_FEATURES.md`](./WORKFLOW_FEATURES.md). Access-control detail: [`ACCESS_CONTROL.md`](./ACCESS_CONTROL.md).

**Churn note:** not low-churn — 27 commits in 90 days. Shape-changing work since the first map: job chips open Job Detail in place and the thread-notes expander is gone (v2.1193 — `useJobThreadNotes` / `JobThreadNotesPanel` no longer appear on this page), projections anchor to steps as inline money markers + a per-step Money drawer (v2.1194), a left ledger rail with a sticky margin/balance card (v2.1195), the Subs header strip (v2.1207), the sub work-order panel + commitments loader (v2.1209–1220), person-id assignment through `update_step_assignment` (v2.1733), the Create Job gate (v2.2848), expected-date aging pills (v2.2895), one roster read for every viewer (v2.2900), the supply-credit refusal on Add Invoice (v2.3501). **Cross-surface consistency is a live constraint:** the Projects **Forecast** tab reads the same `project_workflow_steps.scheduled_start_date`/`scheduled_end_date`/`percent_complete` columns, mirrors `getStepStatusStyle` in [`src/lib/projectsForecastColors.ts`](../src/lib/projectsForecastColors.ts), mirrors this page's line-item cluster in [`src/lib/projectsForecastStageLineItems.ts`](../src/lib/projectsForecastStageLineItems.ts) and its expected-dates linkage in `ProjectsForecastSpecificStageModal.tsx`; the Dashboard Projects card runs the same lifecycle kernel.

### Key structural differences from Bids / Materials

1. **No selection pointer at all.** There is nothing like Bids' `setSharedBid` or Materials' `selectedTemplate`. The page's only "selection" is the route param `projectId` plus the `#step-<stepId>` URL hash (scroll-to, not state). No `?tab=`, no `?id=`.
2. **The shared substrate is the steps engine** — `project`/`workflow`/`steps` state + `ensureWorkflow` (mutexed create-or-find) + `loadSteps`/`refreshSteps` + `lineItems` + `stepActions` + `userSubscriptions` + the commitments pair + the step-lifecycle runner (`executeLifecyclePlan`) and its notification fan-out, plus the role/roster effect. Every region reads `steps`; most mutations funnel through `refreshSteps()`. Since v2.1194 **`projections` is shared too** (summary panel *and* the in-list money markers). See [Shared infrastructure](#shared-infrastructure).
3. **Everything is always mounted.** In tabbed pages only one tab renders at a time, so shared state instances can be "borrowed" across tabs. Here all regions render together, so extracted regions must take real props — no one-at-a-time aliasing tricks exist to preserve.
4. **Extraction has started.** `src/components/workflow/` holds `StepFormModal.tsx`, `StepCommitmentPanel.tsx`, `PersonDisplayWithContact.tsx`; `src/lib/workflow/` holds six Stage-A kernels, **all with colocated tests** — `stepLifecycle.ts`, `stepLifecycleNotifications.ts`, `stepAssignment.ts`, `stepCommitments.ts`, `workOrderNotifications.ts`, `projectSubRoster.ts` — and [`src/lib/workflowMoneyFlow.ts`](../src/lib/workflowMoneyFlow.ts) (tested) drives the money markers. Other external pieces: `EditProjectModalContext`, `JobDetailModalContext`, and the lib helpers `parseWorkflowLineItemPaste`, `parsePercentCompleteInput`, `formatProjectNumberLabel`, `toDatetimeLocal`/`fromDatetimeLocal`, `isAssistantLike`/`isSubcontractorLikeRole`, `canCreateJobsLedgerRow`, `dueState`/`ageChipStyle`, `isSupplyCredit`/`SUPPLY_CREDIT_NOT_ON_STEP`, `telHrefFor`.

### How to read a dossier

Each section lists: render location (line range + JSX comment/symbol), **owned local state** (moves with the region), **cross-region/shared state** (stays in the parent), **derived values**, **handlers/loaders**, **supabase tables/RPCs/edge functions**, **sub-components** (extracted vs inline), **external coupling**, **tests**, and **extraction status + risk + approach** with Stage-A pure-logic candidates.

### How to maintain this doc

- Update the relevant dossier whenever a region is extracted or its state/handlers change; flip its Status and point at the new file.
- Regenerate the fact sheet (`npm run map -- src/pages/Workflow.tsx`) and bump `mapped_at` when you refresh line ranges; anchor by symbol first.

---

> **v2.1200 (RUN_SUBS_PLAN PR 0.1):** the step-lifecycle engine (markStarted/markCompleted/markApproved/submitReject/submitSkip/markReopened) plans through the shared pure kernel `src/lib/workflow/stepLifecycle.ts` (`planStepTransition`) and fires notifications via `src/lib/workflow/stepLifecycleNotifications.ts` — the page keeps a thin `executeLifecyclePlan` runner (1295–1311) plus its own refresh/toast/scroll behavior. `updateStepStatus`, `sendNotification`, and the inline dispatcher body are gone. The Dashboard Projects card (`DashboardProjectsCard.tsx`) consumes the same kernel.

## Master summary table

| Region | Lines (a05cef4c4) | Status | Owned state | Coupling | Tests | Risk | Recommended action |
|---|---|---|---|---|---|---|---|
| Module pure helpers | 41–144 | inline | — | used everywhere in-file; `getStepStatusStyle` mirrored by Forecast; `formatLineItemDate`/`ymd*` duplicated elsewhere | only `dueState` (inside `expectedDueState`) is tested; `formatAmount` (money display) untested | low | **Stage A** → `src/lib/workflow/*` + tests |
| `StepFormModal` (+ Add Person) | mount 3530–3543 | **extracted** → [`StepFormModal.tsx`](../src/components/workflow/StepFormModal.tsx) | 15 (self-contained) | props-only (`steps`, `onSave`, `onCopy`) | none (roster kernel `stepAssignment` tested) | low | done |
| Header & project context | 2089–2123, 2241–2294 | inline | — (`oldStagesCollapsed` shared w/ cards list) | `project`, `steps`; `EditProjectModalContext` | `formatProjectNumberLabel` tested | low-med | extract after the strips |
| Superintendents strip | 2124–2178 (+ 351–366, 381–418, effect 893–901) | inline | 3 | none beyond `projectId` + gate + `setError` | none | **low** | first Stage-B extract → `WorkflowSuperintendentsStrip` |
| Jobs chips | 2181–2214 (+ 368–379, effect 903–909) | inline | 1 (`projectJobs`) | `JobDetailModalContext`, `canCreateJobs` | `canCreateJobsLedgerRow` tested | **low** | early extract → `WorkflowJobsStrip` |
| Subs strip | 2215–2240 (+ memo 2078–2081) | inline (kernel extracted) | — | reads `projectSubRoster` memo (`steps` + `subIdentity` from roster effect) | `buildProjectSubRoster` tested | **low** | presentational extract; memo stays in parent |
| Projections & Ledger panel | 2298–2475 (+ modal 4002–4095, handlers 911–1011, 1183–1235, effect 872–879) | inline | 1 (`projectionsLedgerExpanded`) | `projections` + `editingProjection` now shared with the cards list; reads `steps` + `lineItems` | **none — untested money math** (`buildUnifiedRows`, totals, "Left") | med | Stage A `unifiedFinancialRows.ts` first; `useWorkflowProjections` hook before the panel moves |
| Stage cards list | 2477–3528 (conditional 2478–3526, 1,049 lines) | inline | `sectionExpanded`, `rowCollapsed` (also written by `markApproved`), `expandedProjectionIds`, `wideForLedger` (+ effect 215–219), templates ×3 (+ effect 1028–1033) | **highest** — reads/writes the whole engine + projections + commitments | `buildWorkflowMoneyFlow`, `parsePercentCompleteInput`, `dueState` tested; **ledger-rail margin/balance + pill totals untested** | **high** | last, after the engine seam |
| `StepCommitmentPanel` (sub work orders) | mount 3321–3339; loader 740–771 | **extracted** → [`StepCommitmentPanel.tsx`](../src/components/workflow/StepCommitmentPanel.tsx) | 7 (inside the component) | parent owns `commitmentsByStep`, `commitmentPaymentsByLaborJobId`, the loader, `roster` | `stepCommitments` (incl. `commitmentBalance`) + `workOrderNotifications` tested; no render test | med | loader joins the engine hook |
| Step lifecycle modals | 3579–3898 | inline | 8 | opened only from stage cards; submit via engine | `planStepTransition` tested; expected-dates linkage untested (and duplicated in Forecast) | med | move with (or just after) the cards |
| Line-item + PO/Invoice modals | 3545–3577, 3900–4000, 4098–4294 (+ handlers 505–736, 1826–1962, effect 882–890) | inline | 10 (only 2 cluster-only; 8 opened or read by the cards' Line Items section) | writes `lineItems` via reload; dev/master-only pickers | `parseWorkflowLineItemPaste` **no test**; `isSupplyCredit` tested; Forecast twin lib tested but not used here | med | adopt `projectsForecastStageLineItems.ts` IO, then extract as a cluster before the cards |
| Contact modal | 4297–4351 | modal inline / `PersonDisplayWithContact` **extracted** | 1 (`personContactModal` — set by the cards: `onOpenContact={setPersonContactModal}` 2782) | the modal reads only its own state; the cards' `PersonDisplayWithContact` reads `personContacts`/`userNames` (roster effect) | `telHrefFor` tested | low | any time |
| Steps engine (parent core) | state 153–227 subset; 264–349, 420–503, 773–858, 1129–1153, 1237–1325, 1327–2076 | inline | `project`, `workflow`, `steps`, `lineItems`, `stepActions`, `userSubscriptions`, commitments pair, role/roster | is the substrate | kernels tested; runner + `saveStep`/`copyStep`/`deleteStep`/`createFromTemplate` IO untested | — | becomes `useWorkflowStepsEngine`; **stays in parent** |

Role gates (229–234, derived per render, read by every region): `canManageStages` (dev / master_technician / assistant-like / superintendent), `isDevOrMaster`, `canSeePrivateNotesAndApprove` (same set as `canManageStages`), `canAssignSuperintendents` (excludes superintendent), `canCreateJobs = canCreateJobsLedgerRow(userRole)` (v2.2848 — the `jobs_ledger` INSERT policy refuses superintendents).

State by region (51): engine 8 (`project`, `workflow`, `steps`, `loading`, `error`, `lineItems`, `stepActions`, `userSubscriptions`) · roster/role 6 (`userRole`, `currentUserName`, `roster`, `userNames`, `personContacts`, `subIdentity` — all six written only by the 1035–1127 effect) · commitments 2 · superintendents 3 · jobs 1 · projections 3 (`projections`, `editingProjection`, `projectionsLedgerExpanded`) · cards list 8 (`sectionExpanded`, `rowCollapsed`, `oldStagesCollapsed`, `expandedProjectionIds`, `wideForLedger`, `templates`, `selectedTemplateId`, `creatingFromTemplate`) · step form 1 · lifecycle modals 8 · line-item cluster 10 · contact modal 1.

---

## Per-region dossiers

### Module-level pure helpers

- **Render location:** 41–144, above `export default function Workflow()` (146).
- **Contents:** `formatDatetime`, `formatDateShort` (both pin `APP_CALENDAR_TZ`), `daysOpen`, `daysBetween`, `formatAmount` (accounting negatives `($1,234.56)`), `formatLineItemDate` (noon-anchored to dodge TZ shift), `ymdFromDateLike`, `formatScheduledDateShort` (noon-anchored), `expectedDueState` (v2.2895 — pending/in-progress only; wraps `dueState` from [`src/lib/ageState.ts`](../src/lib/ageState.ts) with today in `APP_CALENDAR_TZ`), `ymdAddDays`, `ymdDaysBetween`, `getStepStatusStyle`. `PersonDisplayWithContact` + type `PersonContactInfo` live in [`src/components/workflow/PersonDisplayWithContact.tsx`](../src/components/workflow/PersonDisplayWithContact.tsx) (renders **"Unassigned"** for a null name since v2.2900).
- **Duplication (do not "fix" silently — note in the move):** `ymdAddDays` is exported by [`src/utils/dateUtils.ts`](../src/utils/dateUtils.ts) (line 132) and privately copied in `src/lib/jobs/billedExpectedPay.ts`, `lienDeadlines.ts`, `lienTimeline.ts`, `src/lib/people/personMoneyLedger.ts`; `ymdDaysBetween` has private copies in `src/lib/projectsForecastAlignStages.ts`, `src/lib/projectsForecastDragEdit.ts` and `src/components/projects/ProjectsForecastSpecificStageModal.tsx` (which also copies `ymdFromDateLike`). `formatLineItemDate` is exported, identical, from `src/lib/projectsForecastStageLineItems.ts`; that file's `formatAmount` prints `-$1,234.56`, **not** the accounting parentheses — not interchangeable. `getStepStatusStyle` is deliberately **mirrored** (not imported) by `src/lib/projectsForecastColors.ts` so Forecast colors map 1:1.
- **Tests:** none for the helpers themselves; `dueState` is covered by `ageState.test.ts`.
- **Extraction status + risk + approach:** Inline. **Low risk — the Stage-A opener.** Formatters + `expectedDueState` → `src/lib/workflow/workflowFormat.ts` + tests; ymd helpers → `src/utils/dateUtils.ts` (repoint the Forecast/jobs copies in a later, separate pass); `getStepStatusStyle` → `src/lib/workflow/stepStatusStyle.ts` (leave the Forecast mirror untouched during the move).

### `StepFormModal` — Add/Edit step modal (extracted)

- **Render location:** `{stepForm.open && <StepFormModal …/>}` 3530–3543; component in [`src/components/workflow/StepFormModal.tsx`](../src/components/workflow/StepFormModal.tsx) (542 lines).
- **Owned local state (all self-contained, 15):** the step fields (`name`, `assigned_to_name`, `assignedPersonId`, `started_at`, `ended_at`, `depends_on_step_id`, `insert_after_step_id`), the assignee autocomplete cluster (`mastersAndSubs`, `assignedSearch`, `filteredMastersSubs`, `showDropdown`) and the Add Person sub-modal cluster (`showAddPerson`, `newPerson`, `savingPerson`, `addPersonError`).
- **Props:** `viewerRole`, `step`, `dependsOnStepId`, `insertAfterStepId`, `steps`, `onSave` (= `saveStep`), `onClose` (= `closeStepForm`), `onCopy?` (= `copyStep`, edit mode only), `toDatetimeLocal`, `fromDatetimeLocal`.
- **Handlers:** `loadMastersAndSubs` (superintendents scope `people` to masters in `master_superintendents` — a **roster scope only**, project rows come through `project_superintendents` under RLS since v2.2836; others scope to own `master_user_id`; users read with `WORKFLOW_ASSIGNABLE_USER_ROLES` and narrowed by `buildWorkflowUserRoster`), `handleAssignedSearchChange`, `handleSelectPerson`, `handleAddNewPersonClick`, `checkDuplicateName` (loads **all** `people` + `users` client-side — quirk), `handleSaveNewPerson` (inserts `people` with `kind: viewerRole === 'helpers' ? 'helper' : 'sub'`), `handleSubmit`.
- **Supabase tables:** `users`, `people` (+ INSERT), `master_superintendents`.
- **Sub-detail:** the "change order:" quick-phrase row — first button is a **no-op label styled as a button**; the phrase buttons append `, <phrase>` to the name. Preserve as-is.
- **Tests:** no render test; `stepAssignment.test.ts` covers the roster kernel.
- **Status:** **Extracted** (v2.1303, verbatim move). Parent wiring (`stepForm` state 159, `openAddStep` 1313–1315, `openEditStep` 1317–1321 — reads `workflow_step_dependencies`, `closeStepForm` 1323–1325, `saveStep` 1451–1576, `copyStep` 1377–1449) unchanged.

### Header & project context

- **Render location:** 2089–2119 back-link + project chip (a button: `editProjectModal?.openEditProjectModal(project.id, { onSaved: loadProject, onDeleted: navigate('/projects') })`, label via `formatProjectNumberLabel`), 2123 `h1` "`<name>` – Workflow", 2241–2257 the old-steps toggle ("Hide Old Steps"/"Show Old Steps", shown only at 2+ finished steps) + "Add step" (both `canManageStages`), 2260–2294 the clickable step **breadcrumb** (`getStepStatusStyle` colors; click `scrollIntoView`s `#step-<id>`). The Project Master line and `projectMaster` state are gone (v2.1272).
- **Owned local state:** none exclusive — `oldStagesCollapsed` (222) is written here and by the summary row but consumed by the cards list's `displayItems`.
- **Cross-region/shared state:** `project`, `steps` (breadcrumb + finished-step count), `canManageStages`.
- **External coupling:** `useEditProjectModal()`; `useNavigate`; the breadcrumb duplicates the hash-scroll behavior of the `#step-` effect.
- **Tests:** `formatProjectNumberLabel` (`projectNumberLabel.test.ts`); nothing else.
- **Extraction status + risk + approach:** Inline. **Low-med risk.** Extract as `WorkflowHeader` after the three strips; `oldStagesCollapsed` stays in the parent and is passed as value + toggle callback.

### Superintendents strip

- **Render location:** 2124–2178, `{canAssignSuperintendents && (` under the `h1` ("Superintendents:" chips with × + an add-select).
- **Owned local state:** `projectSuperintendents` (223), `allSuperintendents` (224), `projectSuperintendentSaving` (225); effect 893–901 (`[projectId, canAssignSuperintendents]`).
- **Handlers:** `loadProjectSuperintendents` 351–366 (`project_superintendents` → `users` by ids), `loadAllSuperintendents` 381–394 (`users` where `role='superintendent'`, `archived_at IS NULL`), `addProjectSuperintendent` 396–406 (INSERT + reload), `removeProjectSuperintendent` 408–418 (DELETE + local filter).
- **Supabase tables:** `project_superintendents` (SELECT/INSERT/DELETE), `users` (SELECT).
- **Cross-region coupling:** none — only `projectId`, the gate, and `setError` (which blanks the page — see quirk 21).
- **Tests:** none.
- **Extraction status + risk + approach:** Inline. **Low risk — first Stage-B extract** → `WorkflowSuperintendentsStrip` with props `projectId`, `canAssignSuperintendents`, `onError`. Fully self-contained state + effect.

### Jobs chips

- **Render location:** 2181–2214, right header column: "Jobs:" chip row — each chip is a button calling `jobDetailModal?.openJobDetail({ jobId })` (v2.1193; the old `/jobs?edit=` link and ▶ thread-notes expander are gone, so the `useJobThreadNotes` wiring and its stats effect no longer exist here) — and "+ Create Job" (`/jobs?newJob=true&project=<projectId>&tab=stages`) behind `canCreateJobs` (2206–2213).
- **Owned local state:** `projectJobs` (227) + effect 903–909 (`[projectId]`); loader `loadProjectJobs` 368–379.
- **Supabase tables:** `jobs_ledger` (SELECT `id, hcp_number, job_name, status` by `project_id`).
- **External coupling:** `useJobDetailModal()` context; `canCreateJobsLedgerRow`.
- **Tests:** `jobsLedgerCreateRole.test.ts` (the gate); nothing for the strip.
- **Extraction status + risk + approach:** Inline. **Low risk — early extract** → `WorkflowJobsStrip` (props `projectId`, `canCreateJobs`; calls `useJobDetailModal` itself).

### Subs strip

- **Render location:** 2215–2240, `{canManageStages && projectSubRoster.length > 0 && (` — "Subs:" pills (🔧 name · N open; tooltip names the current step).
- **Owned local state:** none. Reads the memo `projectSubRoster` 2078–2081 = `buildProjectSubRoster(steps, subIdentity.ids, subIdentity.namesLower)`; `subIdentity` (166) is built at the tail of the roster effect (1112–1125: `people.kind='sub'` ids + names, `users.role='subcontractor'` names).
- **Tests:** `projectSubRoster.test.ts` (kernel).
- **Extraction status + risk + approach:** Inline around an extracted kernel. **Low risk** → presentational `WorkflowSubsStrip({ entries })`; the memo stays in the parent (it reads `steps`).

### Projections & Ledger panel (financials)

- **Render location:** `{/* Projections + Ledger - Summary bar and unified table */}` 2298–2475 behind `(isDevOrMaster || canManageStages)`: summary bar 2301–2350 (`Projections:` dev/master; `Ledger:` for `canManageStages`; `Left:` = projections − ledger, dev/master, 2315–2331; "+ Add Projection" dev/master; Details toggle), expanded unified table 2353–2473 (stage | memo | projections | ledger | actions, ledger links `window.open(..., 'noopener,noreferrer')`). The `editingProjection` modal 4002–4095 carries Label / Memo / Amount plus (v2.1194) **"Attach to step (optional)"** and a before/after placement radio (4028–4061).
- **Owned local state:** `projectionsLedgerExpanded` (226) only.
- **Cross-region/shared state:** `projections` (202 — also read by the cards list's `buildWorkflowMoneyFlow`), `editingProjection` (210 — opened from the panel 2335/2366/2433, the money markers 2695 and the Money drawer 3298/3308), `lineItems` + `steps` (ledger side), `workflow?.id`, gates, `normalizeUrl`.
- **Derived values (per render, no memos):** `buildUnifiedRows()` 1203–1235 (+ `UnifiedRow` type 1193–1201 — aligns projections and ledger line items by trimmed `stage_name` vs `step.name`, pads to `max` rows, joins memos with `' / '`), `calculateProjectionsTotal()` 1005–1011, `calculateLedgerTotal()` 1183–1191.
- **Handlers:** `loadProjections` 911–925 (dev/master only), `saveProjection` 927–978 (anchor `{step_id, placement}` — empty step ⇒ both null; re-`ensureWorkflow` fallback when state isn't ready), `deleteProjection` 980–992 (same fallback; delete error not checked), `openEditProjection` 994–1003 (seed `{step_id, placement}` from the drawer). Effect 872–879 (`[workflow?.id, userRole]`, 100ms stagger, dev/master; else clears).
- **Supabase tables:** `workflow_projections` (SELECT/INSERT/UPDATE/DELETE).
- **Tests:** **none — untested money math** (row alignment, both totals, "Left").
- **Extraction status + risk + approach:** Inline. **Medium risk.** Stage A first: `buildUnifiedRows(projections, steps, lineItems)` + both totals → `src/lib/workflow/unifiedFinancialRows.ts` + tests (stage-name matching, row padding, memo joining, negative totals). Because the list now reads `projections` and opens the modal, projection state + CRUD + the modal become a parent-owned `useWorkflowProjections(workflowId, userRole, ensureWorkflow)` seam; `WorkflowFinancialsPanel` then takes `projections`/`lineItems`/`steps` + callbacks as props. The edit modal stays page-level (openers in both regions).

### Stage cards list (the core region)

- **Render location:** 2477–3528; the conditional 2478–3526 (1,049 lines):
  - **Empty state** 2480–2516 — create-from-template card (`templates` / `selectedTemplateId` / `creatingFromTemplate`, `createFromTemplate` 1327–1375) or "No steps assigned to you".
  - **List IIFE setup** 2518–2702 — `displayItems` bucketing 2519–2544; money flow 2545–2555 (`orderedStepIds`, `itemsTotalByStepId`, `moneyFlow = buildWorkflowMoneyFlow(...)` for dev/master); **ledger rail** 2556–2640 (`projectionsTotal`, `ledgerTotal`, `showLedgerRail = isDevOrMaster && wideForLedger && totals ≠ 0`, `RAIL_W`, `railAmount`, `balanceColor`, `railGutter` 2566–2589, `railRow` 2590–2609, `marginPct`/`balanceNow`, `stickyLedgerCard` 2612–2640); `renderMoneyMarker` 2641–2702 (projection pill with "projected to here" / "spent" running totals, expandable Edit/Delete).
  - **Loop** 2705–3524 — old-steps summary row 2706–2727; per card 2733–3522 (`` id={`step-${s.id}`} `` at 2735): before-markers 2744–2746; Row 1 2763–2869 (chevron, name, status + `daysOpen`, `PersonDisplayWithContact`, Assign, Notify / Action Ledger toggles 2787–2826, collapsed pills 2827–2868 — date range, `Exp:` pill aged via `expectedDueState`/`ageChipStyle`, line-item count + total, notes/office word counts); Row 2 actions 2870–2910 (Technician: Set Start / Mark Complete; Office: Approve / Send Back / Skip); Row 2b Expected dates 2911–2978; Row 2c Percent complete 2979–3036; expanded body 3037–3511 — Notify table 3058–3165, approved-by line 3166–3170, Action Ledger 3171–3192, Notes for Tech 3193–3225, Notes for Office 3226–3260, **Money drawer** 3262–3319 (dev/master: anchored projections, actual items total, "+ Add projection here"), **`StepCommitmentPanel`** 3321–3339, Line Items For Office 3341–3496 (View PO / View Invoice / edit / delete; "+ Add Line Item", "+ Add Supply House Invoice" and "+ Add PO" 3463–3486), footer Edit / Delete / Re-open 3497–3509; after-markers 3517–3519; arrow divider 3520–3521.
- **Owned local state:** `sectionExpanded` (220; keys `${stepId}-notify|actionLedger|notes|privateNotes|money|lineItems`), `rowCollapsed` (221 — **also written by `markApproved`** 1744–1748), `expandedProjectionIds` (212), `wideForLedger` (214 + resize effect 215–219, ≥1100px), templates cluster (185–187 + mount effect 1028–1033 — but `createFromTemplate`, listed with the engine, reads `selectedTemplateId` and writes `creatingFromTemplate`, so it moves with the cluster or takes the template id and reports progress). `oldStagesCollapsed` (222) is shared with the header.
- **Cross-region/shared state (the problem):** the whole engine — `steps`, `lineItems`, `stepActions`, `userSubscriptions`, `personContacts`, `userNames`, `currentUserName`, `roster`, `commitmentsByStep`, `commitmentPaymentsByLaborJobId`, `projections`, `availablePOs`/`availableInvoices` (button visibility), `project`, `userRole`, all gates — plus every opener: `openAddStep`/`openEditStep`, `setRejectStep`, `setSkipStep`, `setSetStartStep`, `setAssignPersonStep`, `openExpectedDates`, `setConfirmDeleteStep`+`setDeleteStepConfirmText`, `openEditLineItem`, `setConfirmDeleteLineItem`, `setAddingPOToStep`, `setAddingInvoiceToStep`, `loadPODetails`, `loadInvoiceDetails`, `setPersonContactModal`, `openEditProjection`, `deleteProjection`.
- **Derived values:** `displayItems` (old-step collapse → one summary row `{count, firstStarted}`; the most recent finished step stays visible), `isRowDefaultCollapsed` 236–238, `isStepEmpty` 240–248 (closes over `lineItems`; drives type-to-confirm delete), `isSectionDefaultExpanded` 250–256 (notify false; notes/privateNotes only with content; lineItems true; money/actionLedger default false inline), pill word counts / line-item totals, per-card `ymdDaysBetween` planned length (2916), the money-flow and ledger-rail numbers above.
- **Handlers used (engine-owned):** `markStarted` 1590–1599, `markCompleted` 1715–1722, `markApproved` 1724–1755, `markReopened` 1757–1761, `updatePercentComplete` 1633–1645 (UPDATE, then a local `setSteps` merge on success — no refetch, **no realtime**; the column's other writers are Forecast Specific's gutter cell (`ProjectsForecastSpecificTab.tsx`) and stage-modal header (`savePercent`, `ProjectsForecastSpecificStageModal.tsx`), plus the `submit-sub-portal` edge function for step-anchored sheets), `updateNotifyAssigned` 1763–1770, `updateCrossStepNotify` 1772–1779, `updateNotifyMe` 1781–1797, `updateNotes` 1799–1810 / `updatePrivateNotes` 1812–1823 (RPC `update_step_notes` / `update_step_private_notes` with direct-UPDATE fallback), `createFromTemplate`, `openExpectedDates` 1607–1626.
- **Supabase tables (via the engine):** `project_workflow_steps`, `project_workflow_step_actions`, `workflow_step_line_items`, `step_subscriptions`, `workflow_templates` + `workflow_template_steps`, `step_commitments` + `people_labor_job_payments` (panel data).
- **Sub-components:** [`PersonDisplayWithContact`](../src/components/workflow/PersonDisplayWithContact.tsx) and [`StepCommitmentPanel`](../src/components/workflow/StepCommitmentPanel.tsx) (both extracted); everything else inline JSX (inline SVG icon paths for edit/delete/clipboard/link).
- **External coupling:** deep-link **receivers** — `/workflows/{project_id}#step-{step_id}` links are built in 11 component files (e.g. `AssignedStageCard.tsx`, `DashboardProjectsCard.tsx`, `DashboardAssignedJobsSection.tsx`, `JobsSubLaborTab.tsx`, `ProjectsForecastAllStagesTab.tsx`; `DetailJobModal.tsx`/`JobFormLinksSection.tsx` link the bare `/workflows/{project_id}`) plus notification emails/pushes (`stepLifecycleNotifications.ts`, `workOrderNotifications.ts`), so the hash-scroll effect and the `` id={`step-${s.id}`} `` anchors (2735) must keep working; `parsePercentCompleteInput` shared with Forecast Specific; `getStepStatusStyle` mirrored by Forecast colors.
- **Tests:** `workflowMoneyFlow.test.ts` (markers), `parsePercentCompleteInput.test.ts`, `ageState.test.ts`; **untested:** the ledger-rail totals, `marginPct`/`balanceNow`, `railAmount` rounding, per-step `itemsTotalByStepId`, the collapsed-pill total, `displayItems`, the three predicates. No render smoke.
- **Extraction status + risk + approach:** Inline. **High risk — extract last.** Prereqs: (1) the `useWorkflowStepsEngine` seam (below) with an `onApproved(step, nextStep)` callback so `rowCollapsed` can live in the list; (2) `useWorkflowProjections`; (3) Stage-A moves — predicates (`isStepEmpty` taking a `lineItemCount` arg), `buildStageDisplayItems(steps, oldStagesCollapsed)`, the shared `workflowMoneyTotals` kernel + rail helpers next to `buildWorkflowMoneyFlow`, the pill math. Then move card JSX to `src/components/workflow/WorkflowStageCard.tsx` (one card, incl. the Money drawer) and `WorkflowStagesList.tsx` (list + summary row + markers + rail), all openers as callbacks. `sectionExpanded`, `expandedProjectionIds`, `wideForLedger`, templates move with the list; `oldStagesCollapsed` stays in the parent.

### `StepCommitmentPanel` — sub work orders (extracted)

- **Render location:** 3321–3339 inside each expanded card, `{canManageStages && <StepCommitmentPanel …/>}`; component in [`src/components/workflow/StepCommitmentPanel.tsx`](../src/components/workflow/StepCommitmentPanel.tsx) (632 lines, 7 `useState`, no effect).
- **Props:** `stepId`, `stepStatus`, `stepName`, `stepScheduledStart`/`End`, `projectId`, `projectName`, `offeredByName` (`currentUserName ?? 'The office'`), `commitments` (`commitmentsByStep[s.id]`), `paymentsByLaborJobId`, `roster` (person-id entries only), `isSuperintendentOnly`, `onChanged` (reloads commitments for **all** steps), `onError` (`setError` — blanks the page).
- **Parent-owned data:** `commitmentsByStep` (167), `commitmentPaymentsByLaborJobId` (168), `loadCommitmentsForSteps` 740–771 (`step_commitments` by `step_id`, then `people_labor_job_payments` by `job_id` in the rows' `labor_job_id`s; returns silently on error; skips sheet-anchored rows with null `step_id`, v2.2785; gated `canManageStages`), called from the 50ms effect 861–869 alongside line items.
- **Component data:** tables `step_commitments`, `person_contract_documents`, `people`, `users`; RPC `settle_step_commitment`; kernels `stepCommitments` (`commitmentRail`, `commitmentBalance`, `nextCommitmentActions`), `workOrderNotifications` (invokes `send-workflow-notification` with `labor_job_id`), `people/subCompliance`.
- **Tests:** `stepCommitments.test.ts` (covers `commitmentBalance` money), `workOrderNotifications.test.ts`; no render test.
- **Status:** **Extracted.** Remaining move: the loader + state join the engine hook (or a `useStepCommitments(stepIds, canManageStages)` seam).

### Step lifecycle modals

- **Render location:** `confirmDeleteStep` 3579–3618 (type-the-name confirm 3583–3598 unless `isStepEmpty`; copy points at Settings → Data & migration → Recently deleted, 90 days), `rejectStep` 3620–3638 ("Previous work incomplete" + reason), `skipStep` 3640–3665 (reason required, "Not relevant" quick-fill), `setStartStep` 3667–3685 (datetime-local, seeded `toDatetimeLocal(now)`), `expectedDatesStep` 3687–3829 (start/end/length with two-way auto-compute — `handleStartChange`/`handleEndChange`/`handleLengthChange` 3692–3729, `lengthInvalid` 3730, `endBeforeStart` 3731; `seededFromPrior` hint, `updateNextStage` cascade checkbox, Clear), `assignPersonStep` 3831–3898 (+ `assignPersonFilter`; current user pinned first with "(You)"; empty-roster branch 3853–3890).
- **Owned local state:** the six modal states (160–163, 175, 200 `confirmDeleteStep`) + `assignPersonFilter` (164) + `deleteStepConfirmText` (201). Not self-contained: the cards open them (Row 1 Assign 2785; Row 2 set-start/reject/skip 2877/2892/2895; Row 2b `openExpectedDates` 2937/2951; footer Delete sets the delete pair 3501) and the engine-listed handlers close or seed them (`submitReject`, `submitSkip`, `submitSetStart`, `submitExpectedDates`, `clearExpectedDates`, `assignPerson` clear their state; `openExpectedDates` seeds `expectedDatesStep`) — when those handlers join the engine hook, the close moves to the modal's caller.
- **Submit handlers (engine-owned):** `deleteStep` 1994–2032 (deletes `workflow_step_dependencies` both directions, then the step), `submitReject` 1964–1979 and `submitSkip` 1981–1992 (plan via `planStepTransition` → `executeLifecyclePlan`), `submitSetStart` 1601–1605 → `markStarted`, `submitExpectedDates` 1647–1692 (one UPDATE of both date columns, then a local `setSteps` merge on success; optional next-step `scheduled_start_date` cascade), `clearExpectedDates` 1694–1713, `assignPerson` 2034–2076 (optimistic with revert; RPC `update_step_assignment` → legacy `update_step_assigned_to` → direct UPDATE; then best-effort `notifyAssignedDefaultsOnAssign` patch; then `refreshSteps()` unawaited).
- **Tests:** `stepLifecycle.test.ts` (cascades), `stepAssignment.test.ts` (notify defaults); the expected-dates linkage and `openExpectedDates` seeding are untested.
- **Extraction status + risk + approach:** Inline. **Medium risk.** Each modal is opened from exactly one place (a stage card), so per playbook they move **with** the stage-card extraction (or immediately after, one modal per commit). The expected-dates linkage + seeding is a two-consumer Stage-A kernel (`src/lib/workflow/expectedDatesLinkage.ts` + tests) — `ProjectsForecastSpecificStageModal.tsx` 282–353 carries its own copy of the linkage (`lengthInvalid`/`endBeforeStart` + `handleStartChange`/`handleEndChange`/`handleLengthChange`), but not the seeding: it seeds from the step's own dates and its next-stage push (`alsoPushNext`) defaults off.

### Line-item + PO/Invoice modals (financial attach/view cluster)

- **Render location:** `confirmDeleteLineItem` 3545–3577, `editingLineItem` 3900–4000 (date/link/memo/amount; clipboard-import button 3905–3926 in Add mode only), `{/* Add Purchase Order to Step Modal */}` 4098–4138, `{/* Add Supply House Invoice to Step Modal */}` 4141–4215 (search predicate 4158–4167), `{/* View Purchase Order Details Modal */}` 4218–4265, `{/* View Supply House Invoice Details Modal */}` 4268–4294.
- **Local state (10):** `editingLineItem` (190), `lineItemPasteImporting` (198), `confirmDeleteLineItem` (199), `viewingPO` (203), `addingPOToStep` (204), `availablePOs` (205), `addingInvoiceToStep` (206), `availableInvoices` (207), `invoiceSearchText` (208), `viewingInvoice` (209). Only `lineItemPasteImporting` and `invoiceSearchText` are cluster-only: the cards' Line Items section (3415–3483) writes `editingLineItem` (via `openEditLineItem`), `confirmDeleteLineItem`, `addingPOToStep`, `addingInvoiceToStep`, sets `viewingPO`/`viewingInvoice` through `loadPODetails`/`loadInvoiceDetails`, and reads `availablePOs`/`availableInvoices` for button visibility — so before the cards move, those 8 stay parent-owned (or the cluster exposes openers). The dev/master-only 200ms effect 882–890 (`loadFinalizedPOs` + `loadSupplyHouseInvoices`) fills `availablePOs`/`availableInvoices`, so it stays beside them until the cards move.
- **Cross-region/shared state:** `lineItems` (writes land via `refreshSteps()` + `loadLineItemsForSteps(...)` — both parent-owned), `steps` (reload scope), gates, `setError`.
- **Handlers:** `loadFinalizedPOs` 505–540 (`status='finalized'`, limit 100, one batched `purchase_order_items` totals query), `loadSupplyHouseInvoices` 542–586 (limit 100, `supply_houses(name)` join), `loadPODetails` 588–622, `loadInvoiceDetails` 624–644, `addPOToStep` 646–688 (memo `` `PO: ${name} - ${count} items, $${total} total` ``, `purchase_order_id` FK), `addInvoiceToStep` 690–736 (**refuses credit memos** 707–710 via `isSupplyCredit` → `SUPPLY_CREDIT_NOT_ON_STEP`, v2.3501; memo `` `Invoice #… - … - $…` ``, `supply_house_invoice_id` FK), `saveLineItem` 1826–1886 (link through `normalizeUrl`; `item_date` sliced to YMD; max `sequence_order`+1), `importLineItemsFromPaste` 1888–1916 (all-or-nothing [`parseWorkflowLineItemPaste`](../src/lib/parseWorkflowLineItemPaste.ts), one bulk INSERT), `importLineItemsFromClipboard` 1918–1934, `deleteLineItem` 1936–1951, `openEditLineItem` 1953–1962.
- **Supabase tables:** `workflow_step_line_items` (all verbs), `purchase_orders`, `purchase_order_items`, `supply_house_invoices` (+ joined `supply_houses`/`material_parts`).
- **External coupling:** POs/invoices originate on the Materials page (`MATERIALS_TABS_ARCHITECTURE.md`); read-only here plus FK inserts. **Twin data layer:** [`src/lib/projectsForecastStageLineItems.ts`](../src/lib/projectsForecastStageLineItems.ts) (377 lines, header says it mirrors this page) exports `saveLineItem`, `deleteLineItemRow`, `addPOToStep`, `addInvoiceToStep` (same credit guard), `loadFinalizedPOOptions`, `loadSupplyHouseInvoiceOptions`, `loadPODetail`, `loadInvoiceDetail`, `normalizeUrl`, `formatLineItemDate`. `addPOToStep`/`addInvoiceToStep` write identical rows; `saveLineItem` differs only in the insert-error copy (page "Failed to insert line item" vs lib "Failed to add line item"). A rule change (like v2.3501) must land in both until the page adopts the lib.
- **Tests:** `parseWorkflowLineItemPaste` — **no test** (it builds money rows for a bulk insert); `supplyHouseDocument.test.ts` covers `isSupplyCredit`; the twin lib is covered by `projectsForecastStageLineItems.test.ts` (20 cases); the page's own handlers, the invoice search predicate and the PO total math are untested here.
- **Extraction status + risk + approach:** Inline. **Medium risk, extractable before the cards** as `WorkflowLineItemModals` (or split attach/view). Stage A: repoint the IO handlers at the tested twin lib (each a thin `setError` + reload wrapper); pure `filterAvailableInvoices(invoices, query)` + tests; add `parseWorkflowLineItemPaste.test.ts`. Props: target step ids, `lineItems` read-only, `onSaved` (parent's `refreshSteps` + `loadLineItemsForSteps`), gates, `onError`.

### Contact modal

- **Render location:** `{/* Person Contact Info Modal */}` 4297–4351 (`personContactModal`, 174) — name, "(not a user)" badge, `mailto:` and `telHrefFor(phone)` links (v2.3571).
- **Shared state:** none read by the modal (it renders `personContactModal` alone). `personContacts` + `userNames` (built in the roster effect) feed `PersonDisplayWithContact` in every card (2782), which opens the modal through the passed-down setter `onOpenContact={setPersonContactModal}`.
- **Tests:** `phoneContact.test.ts` (`telHrefFor`).
- **Extraction status:** trivial; can move to `src/components/workflow/PersonContactModal.tsx` any time. The state stays in the parent only because openers live in every card — once cards are extracted it can travel with the list.

---

## Shared infrastructure

The "API surface" any extracted region must be handed. **This is the page's substrate — there is no selection pointer to share, only this engine.**

### Identity, role, and roster (parent, permanent)

- `useAuth()` → `{ user: authUser }`; `useToastContext()` → `showToast`; `useEditProjectModal()`; `useJobDetailModal()`.
- The roster effect 1035–1127 (`[authUser?.id]`) reads `users.role/name/email` → `userRole` + `currentUserName`, then in parallel `people` (superintendent: scoped to adopted masters via `master_superintendents` 1063–1074 — every master since the v2.921 company-wide sync, **roster scope only**; others: own `master_user_id` 1076–1079) and **one** `users` read for every viewer (`.in('role', WORKFLOW_ASSIGNABLE_USER_ROLES)`, v2.2900), split by `buildWorkflowUserRoster` into the picker `roster` (active accounts + people carrying `personId`) and `userNames` (every readable account, lowercased); `personContacts` (people take precedence over users); `subIdentity` (1112–1125). `assignPerson` and `saveStep` apply `notifyAssignedDefaultsOnAssign` / `NOTIFY_ASSIGNED_ALL_ON`: the first assignee turns the three `notify_assigned_when_*` toggles on; new steps insert with them on.
- Gates derived per render (229–234): `canManageStages`, `isDevOrMaster`, `canSeePrivateNotesAndApprove`, `canAssignSuperintendents`, `canCreateJobs`.
- **Who can read steps at all** is decided by the `project_workflow_steps` SELECT policy, not by this page: the `/workflows` route left `PRIMARY_PATHS` in v2.2836; the role sweep (v2.2920, migration `20260906010000_role_sweep_predicates`) added the policy's primary branch so a primary's Dashboard **Assigned Stages** fills while the route stays off. [ACCESS_CONTROL.md](./ACCESS_CONTROL.md) → Page Access Matrix (Workflow row) is authoritative; this file only documents the client.

### Steps engine (parent, becomes `useWorkflowStepsEngine`)

State: `project`, `workflow`, `steps`, `loading`, `error`, `lineItems`, `stepActions`, `userSubscriptions`, `commitmentsByStep`, `commitmentPaymentsByLaborJobId`. Refs: `ensureWorkflowPromises` (259), `lastLoadedWorkflowId` (262).

Loaders/mutators: `ensureWorkflow(pid)` 264–332 (find-or-create `project_workflows` with insert-conflict re-query), `loadProject(pid)` 334–349, `loadSteps(wfId)` 420–503 (subcontractor-like roles filtered to `assigned_to_name = currentUserName`, empty ⇒ access-denied error; batch-loads my `step_subscriptions` and the last **100 total** `project_workflow_step_actions`), `loadLineItemsForSteps(stepIds)` 773–816 (role-gated; swallows RLS/permission errors), `loadCommitmentsForSteps` 740–771, `refreshSteps()` 1129–1153 (resets `lastLoadedWorkflowId`, re-syncs `workflow`), `getCurrentUserName()` 1237–1248 (a `users` read per call), `recordAction(stepId, actionType, notes?)` 1250–1274, `executeLifecyclePlan(plan, stepsById)` 1295–1311 (sequential column updates — first failure aborts — then action rows, then fire-and-forget notifications), `findPreviousStep` 1578–1582 / `findNextStep` 1584–1588.

Lifecycle: `markStarted`, `markCompleted`, `markApproved` (+ v2.1189 collapse/advance/scroll), `markReopened`, `submitReject`, `submitSkip` — cascade rules live in `planStepTransition`. Structure: `saveStep` 1451–1576 (edit: update + dependency delete/insert; add: `insertAfterStepId` / `'__beginning__'` with sequential `sequence_order` bumps), `copyStep` 1377–1449 (bumps + copy, resets status/timestamps, copies `workflow_step_dependencies`, keeps `assigned_person_id`, does **not** copy `private_notes`/`inspection_notes`/`rejection_reason`), `deleteStep`, `createFromTemplate` 1327–1375 (sequential inserts from `workflow_template_steps`), `assignPerson`.

Notifications: `sendWorkflowNotifications` 1278–1290 is a thin wrapper (project/workflow guard + session identity) around `sendStepLifecycleNotifications` in [`src/lib/workflow/stepLifecycleNotifications.ts`](../src/lib/workflow/stepLifecycleNotifications.ts), which invokes edge function **`send-workflow-notification`**; recipients resolve `assigned_person_id`-first (v2.1733) with the name path as fallback. All fire-and-forget (`void`), errors logged not surfaced. The page itself invokes no edge function (fact sheet: edge fns —).

Effects (10): 215–219 `wideForLedger` resize listener · 818–858 master load (`[projectId, userRole, currentUserName, workflow?.id]`; skip-if-loaded with a subcontractor exception; parallel `loadProject` + `ensureWorkflow`) · 861–869 line items **+ commitments** (50ms) · 872–879 projections (100ms) · 882–890 POs + invoices (200ms) · 893–901 superintendents · 903–909 project jobs · 1014–1026 `#step-` hash scroll (100ms after steps land) · 1028–1033 templates mount-load · 1035–1127 role/roster.

Supabase surface (fact sheet): tables `project_workflows`, `projects`, `project_superintendents`, `users`, `jobs_ledger`, `project_workflow_steps`, `step_subscriptions`, `project_workflow_step_actions`, `purchase_orders`, `purchase_order_items`, `supply_house_invoices`, `workflow_step_line_items`, `step_commitments`, `people_labor_job_payments`, `workflow_projections`, `workflow_templates`, `master_superintendents`, `people`, `workflow_step_dependencies`, `workflow_template_steps` (+ joined `supply_houses`, `material_parts`); RPCs `update_step_notes`, `update_step_private_notes`, `update_step_assignment`, `update_step_assigned_to` (each with a fallback); edge function only through the lib. **No realtime subscriptions anywhere on this page** — local `setSteps` merges + `refreshSteps` reloads are the only refresh paths.

### URL / navigation (parent, permanent)

- Route param `projectId` (`useParams`) — the page's only "selection".
- `#step-<stepId>` hash: scroll-into-view effect 1014–1026; every card renders `` id={`step-${s.id}`} `` (2735). Inbound: the 11 link-building components named in the cards dossier + workflow notification emails/pushes. **Stays in the parent.**
- Outbound: `/projects` back-link and delete redirect, `/jobs?newJob=true&project=<projectId>&tab=stages` (gated). Job chips open the Job Detail modal in place (no navigation).

### Seam hook candidates

- **`useWorkflowStepsEngine(projectId, { authUser, userRole, currentUserName, showToast, onApproved })`** returning the engine above (state + loaders + lifecycle + notifications + commitments). `onApproved(step, nextStep)` replaces `markApproved`'s direct `setRowCollapsed` so the list can own `rowCollapsed`. The parent destructures it so downstream references are unchanged.
- **`useWorkflowProjections(workflowId, userRole, ensureWorkflow)`** — `projections`, `editingProjection`, load/save/delete/open; needed now that the panel and the list both read projections.
- **`useWorkflowRoster(authUser)`** — the 1035–1127 effect's outputs (`userRole`, `currentUserName`, `roster`, `userNames`, `personContacts`, `subIdentity`).
- Smaller: `useWorkflowLineItemSources` (POs + invoices; can wrap the twin lib's loaders) and the superintendents cluster — both small enough to live inside their extracted components.

---

## Stage-A pure-logic inventory (extract to `lib/*` + tests before any component moves)

| Candidate | Currently | Target |
|---|---|---|
| `formatDatetime`, `formatDateShort`, `daysOpen`, `daysBetween`, `formatAmount`, `formatLineItemDate`, `formatScheduledDateShort`, `expectedDueState` | module-level 41–114 | `src/lib/workflow/workflowFormat.ts` + tests (TZ pinning, accounting negatives, noon-anchor); keep `formatAmount`'s parentheses — the Forecast lib's minus-sign copy is not a drop-in |
| `ymdFromDateLike`, `ymdAddDays` (exported in `dateUtils`), `ymdDaysBetween` (3 private copies in Forecast files) | module-level 89–92, 116–137 | consolidate in `src/utils/dateUtils.ts` (repoint the other copies in a later, separate pass) |
| `getStepStatusStyle` | module-level 139–144; mirrored by `projectsForecastColors.ts` | `src/lib/workflow/stepStatusStyle.ts` + test (Forecast mirror untouched during the move) |
| `normalizeUrl` | inner function 1156–1180 | **already exported and tested** (identical branches) in `src/lib/projectsForecastStageLineItems.ts` — import it, or lift both to a neutral lib |
| `buildUnifiedRows` + `calculateLedgerTotal` + `calculateProjectionsTotal` + "Left" | inner functions 1005–1011, 1183–1235; "Left" inline 2323/2328 | `src/lib/workflow/unifiedFinancialRows.ts` taking `(projections, steps, lineItems)` + tests — **untested money math** |
| Ledger-rail summary: `itemsTotalByStepId`, `projectionsTotal`, `ledgerTotal`, `marginPct`, `balanceNow`, `railAmount` (whole-dollar rounding), `balanceColor` (±0.004 dead band) | list IIFE 2548–2565, 2610–2611 | totals, margin % and balance → the two-consumer `src/lib/workflowMoneyTotals.ts` that [`PROJECTS_FORECAST_TABS_ARCHITECTURE.md`](./PROJECTS_FORECAST_TABS_ARCHITECTURE.md) and the playbook plan (the Forecast Specific tab repeats them at `ProjectsForecastSpecificTab.tsx` 364–365, 1503, 1518, summing `Number(p.amount ?? 0)` where this page sums `p.amount \|\| 0` — pin the difference first); `itemsTotalByStepId`/`railAmount`/`balanceColor` as a rail helper beside `buildWorkflowMoneyFlow`; tests for both — **untested money math (margin %)** |
| Collapsed-pill math (line-item count/total, word counts, day prefix) | card IIFE 2830–2836 | `src/lib/workflow/stageCardPills.ts` + tests |
| old-steps `displayItems` bucketing | list IIFE 2519–2544 | pure `buildStageDisplayItems(steps, oldStagesCollapsed)` + tests (summary emission, most-recent-finished stays visible) |
| `isRowDefaultCollapsed`, `isStepEmpty`, `isSectionDefaultExpanded` | inner functions 236–256 (`isStepEmpty` closes over `lineItems`) | `src/lib/workflow/stageCardDefaults.ts` with explicit args + tests |
| Expected-dates seeding + linkage (`openExpectedDates` 1607–1626; `handleStartChange`/`handleEndChange`/`handleLengthChange`, `lengthInvalid`, `endBeforeStart` 3692–3731) | handler + closures in the modal IIFE; the linkage (not the prior-step seeding) is **copied** in `ProjectsForecastSpecificStageModal.tsx` 282–353 | `src/lib/workflow/expectedDatesLinkage.ts` + tests; two consumers |
| Invoice search predicate (Add Invoice modal) | inline IIFE 4158–4167 | pure `filterAvailableInvoices(invoices, query)` + tests (`paid`/`unpaid` keywords — exact `q === 'paid'` here; the Documents supply search's `includes('paid')` twin lets `unpaid` match every invoice, and the playbook plans one predicate for both: [`DOCUMENTS_PAGE_ARCHITECTURE.md`](./DOCUMENTS_PAGE_ARCHITECTURE.md) quirk 3) |
| `parseWorkflowLineItemPaste` | extracted (73 lines) but **has no test** | add `parseWorkflowLineItemPaste.test.ts` |
| Already done (tested): `parsePercentCompleteInput`, `planStepTransition`, `sendStepLifecycleNotifications`, `buildWorkflowUserRoster`/`notifyAssignedDefaultsOnAssign`, `buildProjectSubRoster`, `buildWorkflowMoneyFlow`, `commitmentRail`/`commitmentBalance`/`nextCommitmentActions` | `src/lib/workflow/*`, `src/lib/workflowMoneyFlow.ts`, `src/lib/parsePercentCompleteInput.ts` | none — do not fork |

---

## Test coverage

Test cases counted as `it(`/`test(` lines. **No render smoke exists for `Workflow.tsx` or any `src/components/workflow/*` component, and no e2e spec visits `/workflows`.**

| Region | Covered by | Gaps (risk) |
|---|---|---|
| Module helpers | `ageState.test.ts` (15 + 1 `it.each`; 4 cases on `dueState`) | all formatters incl. `formatAmount` (money display), ymd helpers, `getStepStatusStyle` |
| Header / Jobs / Subs strips | `projectNumberLabel.test.ts` (11), `jobsLedgerCreateRole.test.ts` (2), `projectSubRoster.test.ts` (4) | superintendents strip IO |
| Projections & Ledger panel | — | **`buildUnifiedRows`, both totals, "Left" — untested money math** |
| Stage cards list | `workflowMoneyFlow.test.ts` (5), `parsePercentCompleteInput.test.ts` (14) | **ledger-rail totals / margin % / balance — untested money math**; pill totals; `displayItems`; predicates |
| `StepCommitmentPanel` | `stepCommitments.test.ts` (7, incl. `commitmentBalance`), `workOrderNotifications.test.ts` (2) | no render test; loader fail-soft path |
| Lifecycle modals + engine | `stepLifecycle.test.ts` (11), `stepLifecycleNotifications.test.ts` (14), `stepAssignment.test.ts` (10), `datetimeLocal.test.ts` (8) | `executeLifecyclePlan`, `saveStep`/`copyStep` sequence bumps, `deleteStep`, expected-dates linkage |
| Line-item cluster | `supplyHouseDocument.test.ts` (4); twin lib `projectsForecastStageLineItems.test.ts` (20) — not exercised by this page | **`parseWorkflowLineItemPaste` (bulk money insert)**, PO total math, invoice search, page handlers |
| Contact modal | `phoneContact.test.ts` (5) | — |

---

## Preserve-quirks list (odd but load-bearing — do not "fix" during the move)

1. **`ensureWorkflow` mutex + insert-conflict retry**: a `useRef` Map of in-flight promises per project prevents concurrent duplicate-workflow creation; on insert failure it re-queries and adopts the winner. The `console.log` calls are part of the debugging trail for a past real bug — keep or strip consciously, not incidentally.
2. **`lastLoadedWorkflowId` skip logic** in the master effect avoids redundant `loadSteps`, with an explicit exception forcing re-run for subcontractor-like roles (their filter depends on `currentUserName` arriving late). `refreshSteps` resets it to force a reload.
3. **Staggered load effects** (50ms line items + commitments, 100ms projections, 200ms POs+invoices) deliberately spread concurrent DB load. Keep the timings.
4. **RPC-with-fallback pattern**: `updateNotes` and `updatePrivateNotes` try an RPC then a direct UPDATE; `assignPerson` tries `update_step_assignment` (3-arg, writes `assigned_person_id`) → legacy `update_step_assigned_to` → direct UPDATE, each step only when the error contains `'Could not find the function'`. Schema-drift armor — preserve.
5. **Mixed refresh model**: most mutations do full `refreshSteps()`; `updatePercentComplete`, `submitExpectedDates` and `clearExpectedDates` await their UPDATE and then merge into `steps` locally (no refetch; errors go to `showToast`, not `setError`); `assignPerson` alone merges optimistically before its RPC, reverts on error, then calls `refreshSteps()` unawaited. There is **no realtime subscription** — Forecast-side edits only appear after a reload. Preserve which handler uses which path.
6. **Reject/complete cascades** (owned by `planStepTransition`): reject reopens a completed/approved previous step to `in_progress` (clearing approval fields) and stamps `next_step_rejected_notice`/`next_step_rejection_reason`; complete/approve auto-reopen a rejected next step to `pending` and clear the notice on self. Each cascade records actions and fires reopened notifications.
7. **Notifications are best-effort fire-and-forget** (`void sendWorkflowNotifications(...)` from `executeLifecyclePlan`), errors logged never surfaced; recipient lookups are sequential per subscriber inside the lib; cross-step checkboxes default **on** via `!== false` (null/undefined = checked).
8. **`stepActions` loads at most 100 rows across ALL steps** (`.limit(100)` on the whole `.in('step_id', stepIds)` query, newest first) — not per-step. Busy workflows silently truncate older history.
9. **Subcontractor access model**: `loadSteps` filters to `assigned_to_name = currentUserName` (name-string matching, not user id) and shows an access-denied error when zero rows. Assistants/superintendents are NOT filtered (RLS handles them).
10. **`loadLineItemsForSteps` swallows RLS errors** (skips `setError` for `PGRST116`/message containing `'permission'`) and clears to `{}` — assistants without access degrade silently.
11. **PO/invoice pickers are dev/master-only and capped at 100** (`loadFinalizedPOs` computes totals via one batched `purchase_order_items` query — keep the batching); "+ Add Supply House Invoice"/"+ Add PO" (3471–3486) only render when the caches are non-empty, so assistants/superintendents never see them even though they can add manual line items.
12. **Line-item link handling**: `saveLineItem` normalizes via `normalizeUrl` (which repairs `https//` missing-colon typos), but the Link input is `type="url"` with `pattern="https?://.*"` inside a `<form>` without `noValidate`, so the browser blocks Save until the link carries a scheme (the red "Link should start with http:// or https://" hint shows meanwhile); display paths also run `normalizeUrl`; ledger links open with `noopener,noreferrer`.
13. **Clipboard import is Add-mode only**, all-or-nothing parse, one bulk INSERT, needs a secure context for `navigator.clipboard.readText`; the icon is hidden when editing an existing item.
14. **`saveStep`/`copyStep` bump `sequence_order` with one UPDATE per following step** (sequential loop, no RPC); `createFromTemplate` inserts sequentially. Slow-but-simple by design — do not batch during the move.
15. **Percent complete**: uncontrolled input re-keyed as `` `pct-workflow-${s.id}-${pct ?? 'null'}` ``; edit gate `canManageStages || assignee` (2984); blur commits through shared `parsePercentCompleteInput` (empty/0/non-numeric → `null`); Enter blurs. Must stay keystroke-compatible with the Forecast Specific gutter cell.
16. **Expected dates**: modal start seeds from the **previous** step's `scheduled_end_date` when unset (`seededFromPrior`), and the save can cascade this step's end into the next step's `scheduled_start_date` (checkbox default on when a next step exists). Forecast's resolver depends on these columns. The collapsed `Exp:` pill and Row 2b turn red/amber via `expectedDueState` only for pending/in-progress steps.
17. **Type-name-to-confirm delete** only when `isStepEmpty` is false; step delete removes `workflow_step_dependencies` in **both** directions first. The modal copy references the Settings → Data & migration → Recently deleted 90-day restore.
18. **`StepFormModal` quirks**: "change order:" first chip is a non-interactive label styled as a button; `checkDuplicateName` loads the entire `people` + `users` tables client-side; new people default to `kind: 'sub'` (`'helper'` when the viewer is `helpers`); dropdown hides on a 200ms blur timeout.
19. **Old-steps collapse** keeps the most recent completed/approved/skipped step visible and replaces only the older ones with the summary row; toggle appears only at 2+ finished steps.
20. **`formatLineItemDate` and `formatScheduledDateShort` anchor at `T12:00:00`** to avoid TZ date-shift; `formatDatetime`/`formatDateShort` pin `APP_CALENDAR_TZ`. Keep the anchors.
21. **Any `setError` blanks the whole page**: the early return `if (error) return <p style={…}>{error}</p>` (2084) replaces everything, so a refused credit invoice, a failed line-item save, a commitment-panel `onError` or a superintendent add failure all leave only the message until reload. Behavior change, not a move — keep it during extraction and fix separately.
22. **`markApproved` UI side effects** (v2.1189): after the refresh it forces the approved card collapsed, the next card expanded, and scrolls to it after 120ms — the engine writes list state (`rowCollapsed`).
23. **Money markers, Money drawer and ledger rail are dev/master only**; the rail also needs `window.innerWidth ≥ 1100` and a non-zero projections or ledger total. Rail figures round to whole dollars with a `+`/`-` sign (`railAmount`) while the panel, markers, drawer, pills, line-item rows and View Invoice use `formatAmount` (cents, parentheses) — two formats on one screen by design. A third, raw `$${n.toFixed(2)}` (no thousands separator), prints in the Add PO / Add Invoice pickers and the View PO modal (4121, 4189, 4239–4248).
24. **Projections panel for non-dev/master managers**: the panel renders for `canManageStages`, but projections load only for dev/master, so assistants/superintendents see `Ledger:` alone. `deleteProjection` ignores the delete error.
25. **Commitments load is fail-soft and step-scoped**: a `step_commitments` select error returns silently (the panel just shows nothing), and sheet-anchored work orders (null `step_id`, v2.2785) never appear here.
26. **Credit memos never become step line items** (v2.3501): `addInvoiceToStep` refuses a negative invoice with `SUPPLY_CREDIT_NOT_ON_STEP`; the Forecast twin lib enforces the same rule — keep both in sync.

---

## Recommended extraction order (value ÷ risk)

Re-ranked at `a05cef4c4`: money math without tests moves up; projections are now shared, so the financials panel needs a hook first; `rowCollapsed` is written by the engine.

1. **Stage-A money kernels + tests** — `unifiedFinancialRows.ts` (panel rows, totals, "Left") and `workflowMoneyTotals.ts` (totals, margin %, balance — shared with the Forecast Specific tab) with the rail helpers (per-step items total, `railAmount`) beside `buildWorkflowMoneyFlow`, plus `parseWorkflowLineItemPaste.test.ts`. Highest value: all three are untested money paths.
2. **Zero-risk dedupe** — import the tested `normalizeUrl` (and `formatLineItemDate`) from `projectsForecastStageLineItems.ts` instead of the inline copies.
3. **Rest of the Stage-A sweep** — `workflowFormat.ts`, `stepStatusStyle.ts`, ymd consolidation, `stageCardDefaults.ts`, `buildStageDisplayItems`, pill math, `filterAvailableInvoices`, and `expectedDatesLinkage.ts` (two consumers — the Forecast modal can adopt it in a follow-up). Each row independently shippable.
4. ~~**`StepFormModal`**~~ — **done** (v2.1303); `PersonDisplayWithContact` and `StepCommitmentPanel` are out too.
5. **`WorkflowSuperintendentsStrip`** — 3 states + 1 effect + 4 handlers, props `projectId`/`canAssignSuperintendents`/`onError`. Validates the region seam.
6. **`WorkflowJobsStrip` + `WorkflowSubsStrip`** — 1 state + 1 effect + the Job Detail context; the Subs strip is presentational over the parent memo.
7. **Line-item + PO/Invoice cluster → `WorkflowLineItemModals`** — first repoint its IO at the twin lib (Stage A), then move the modal JSX, its 2 cluster-only states (`lineItemPasteImporting`, `invoiceSearchText`); the 8 opener/visibility states the cards touch, and the 200ms effect that fills `availablePOs`/`availableInvoices`, stay in the parent (passed as props) until step 10; parent keeps `lineItems` and hands down an `onSaved` reload.
8. **`useWorkflowProjections` seam, then `WorkflowFinancialsPanel`** — the hook owns `projections`/`editingProjection`/CRUD in the parent (the list reads them); the panel takes them as props and owns only `projectionsLedgerExpanded`; the edit modal stays page-level.
9. **Engine seams — `useWorkflowRoster` and `src/hooks/useWorkflowStepsEngine.ts`** — move roster/role, engine state/refs/loaders/lifecycle/notifications/commitments; add the `onApproved` callback; parent destructures so nothing downstream changes.
10. **Stage cards — `WorkflowStagesList` / `WorkflowStageCard` + the step lifecycle modals + money markers/ledger rail** — last, against the hooks. `sectionExpanded`/`rowCollapsed`/`expandedProjectionIds`/`wideForLedger`/templates move with the list; each lifecycle modal moves in its own commit. The contact modal can ride along any time.

### What must STAY in the parent

- The route param `projectId` and the `#step-` hash-scroll effect (deep-link receivers across Dashboard/Jobs/notification emails).
- The roster/role effect (or its hook call) and the five role gates (read by every region).
- The `useWorkflowStepsEngine` and `useWorkflowProjections` hook calls (`steps`, `lineItems`, `projections`, `refreshSteps`, error/loading — the substrate every region consumes), and the `projectSubRoster` memo.
- `oldStagesCollapsed` (written by the header toggle, read by the cards list); `rowCollapsed` until `markApproved` routes through `onApproved`.
- The page-level projection edit modal (openers in the panel and the list), the `EditProjectModalContext`/`JobDetailModalContext` wiring, and the top-level `loading`/`error`/not-found early returns.

Definition of done per region, verification gates (`npm run typecheck && npm run lint && npm test` after every step), and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md). Behavior-preserving only — the quirks list above is the contract.
