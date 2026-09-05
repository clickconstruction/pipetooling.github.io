# Workflow Page Architecture Map

---
file: docs/WORKFLOW_PAGE_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the Workflow.tsx decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md) — inventory what every region of the ~4,782-line src/pages/Workflow.tsx touches (state, loaders, handlers, sub-components, supabase tables/RPCs/edge functions, coupling) so extraction can start without re-deriving the strategy. Sections — What this surface is; Key structural differences from Bids/Materials; Master summary table; Per-region dossiers; Shared infrastructure; Stage-A pure-logic inventory; Preserve-quirks list; Recommended extraction order.
audience: Developers, AI Agents
last_updated: 2026-09-05
---

## What this surface is

[`src/pages/Workflow.tsx`](../src/pages/Workflow.tsx) is a **4,782-line** per-project detail page at `/workflows/:projectId` — the project's stage pipeline (steps), per-stage financial line items, and workflow-level projections. Structure (line numbers are "as of 2026-07-29" and rot — search the symbol):

- ~150 lines of **module-level pure helpers** (`formatDatetime`, `formatDateShort`, `daysOpen`, `daysBetween`, `formatAmount`, `formatLineItemDate`, `ymdFromDateLike`, `formatScheduledDateShort`, `ymdAddDays`, `ymdDaysBetween`, `getStepStatusStyle`). The small `PersonDisplayWithContact` component moved out alongside `StepFormModal` → [`src/components/workflow/PersonDisplayWithContact.tsx`](../src/components/workflow/PersonDisplayWithContact.tsx).
- The main `Workflow()` component (~line 179–4276): **~45 `useState`**, 2 `useRef` (`ensureWorkflowPromises` mutex map, `lastLoadedWorkflowId`), **11 `useEffect`**, **zero `useMemo`/`useCallback`** — every derived value is recomputed inline per render (`buildUnifiedRows`, `calculateLedgerTotal`, `calculateProjectionsTotal`, the `displayItems` IIFE).
- **`StepFormModal`** (~505 lines, ~17 `useState`, 1 `useEffect`, its own supabase loads, and a nested Add Person sub-modal) — formerly a second module-level component at the bottom of the file, now extracted to [`src/components/workflow/StepFormModal.tsx`](../src/components/workflow/StepFormModal.tsx).

This is **not a tab-switched page**. Unlike Bids/Materials/People there is no `activeTab`: every region renders simultaneously in one vertical column, gated by **role** (`canManageStages`, `isDevOrMaster`, `canSeePrivateNotesAndApprove`, `canAssignSuperintendents`) rather than by tab state. The decomposition units are therefore **stacked regions + a modal cluster**, and the playbook's "tab" rules apply per region.

Feature/behavior reference: [`WORKFLOW_FEATURES.md`](./WORKFLOW_FEATURES.md). Access-control detail: [`ACCESS_CONTROL.md`](./ACCESS_CONTROL.md).

**Churn note (grep of `RECENT_FEATURES.md`):** this page is NOT low-churn. The stage-card region gained three features in the v2.551–v2.562 window (assignee contact popup + `PersonDisplayWithContact`, Expected start/end dates modal with next-stage cascade, `percent_complete` Row 2c with `parsePercentCompleteInput`), plus job-thread notes (v2.183/v2.446 via `useJobThreadNotes`), clipboard bulk import of line items (v2.181), Project # header chip (v2.55x), and ~10 `isAssistantLike` gate conversions in the v2.66x controller sweep. The Projects **Forecast** tab (v2.552+) reads the *same* `project_workflow_steps.scheduled_start_date`/`scheduled_end_date`/`percent_complete` columns and mirrors `getStepStatusStyle` in [`src/lib/projectsForecastColors.ts`](../src/lib/projectsForecastColors.ts) — cross-surface consistency is a live constraint.

### Key structural differences from Bids / Materials

1. **No selection pointer at all.** There is nothing like Bids' `setSharedBid` or Materials' `selectedTemplate`. The page's only "selection" is the route param `projectId` plus the `#step-<stepId>` URL hash (scroll-to, not state). No `?tab=`, no `?id=`.
2. **The shared substrate is the steps engine** — `project`/`workflow`/`steps` state + `ensureWorkflow` (mutexed create-or-find) + `loadSteps`/`refreshSteps` + `lineItems` + `stepActions` + `userSubscriptions` + the step-lifecycle mutators and their notification fan-out. Every region reads `steps` and most mutations funnel through `refreshSteps()`. See [Shared infrastructure](#shared-infrastructure).
3. **Everything is always mounted.** In tabbed pages only one tab renders at a time, so shared state instances can be "borrowed" across tabs. Here all regions render together, so extracted regions must take real props — no one-at-a-time aliasing tricks exist to preserve.
4. **Extraction has started.** `src/components/workflow/` now holds `StepCommitmentPanel.tsx` (556 lines — sub work orders, v2.1199–1222, rendered inside each stage card), `StepFormModal.tsx`, and `PersonDisplayWithContact.tsx`; `src/lib/workflow/` holds the Stage-A kernels `stepLifecycle.ts`, `stepLifecycleNotifications.ts`, `stepCommitments.ts`, `workOrderNotifications.ts`, `projectSubRoster.ts` (4 with colocated tests). Other already-external pieces: `JobThreadNotesPanel` + `useJobThreadNotes` (shared with Jobs), `EditProjectModalContext`, and the lib helpers `parseWorkflowLineItemPaste`, `parsePercentCompleteInput`, `formatProjectNumberLabel`, `toDatetimeLocal`/`fromDatetimeLocal`, `isAssistantLike`/`isSubcontractorLikeRole`.

### How to read a dossier

Each section lists: render location (anchored by JSX comment/symbol), **owned local state** (moves with the region), **cross-region/shared state** (stays in the parent), **derived values**, **handlers/loaders**, **supabase tables/RPCs/edge functions**, **sub-components** (extracted vs inline), **external coupling**, and **extraction status + risk + approach** with Stage-A pure-logic candidates.

### How to maintain this doc

- Update the relevant dossier whenever a region is extracted or its state/handlers change; flip its Status and point at the new file.
- Prefer symbol names over line numbers; treat any line number here as approximate.

---

> **v2.1200 (RUN_SUBS_PLAN PR 0.1):** the step-lifecycle engine (markStarted/markCompleted/markApproved/submitReject/submitSkip/markReopened) now plans through the shared pure kernel `src/lib/workflow/stepLifecycle.ts` (`planStepTransition`) and fires notifications via `src/lib/workflow/stepLifecycleNotifications.ts` — the page keeps a thin `executeLifecyclePlan` runner plus its own refresh/toast/scroll behavior. `updateStepStatus`, `sendNotification`, and the inline dispatcher body are gone. The Dashboard Projects card consumes the same kernel (it previously sent no notifications and diverged on the reject cascade). These are the first files in `src/lib/workflow/` — the Stage-A direction below.

## Master summary table

| Region | Render anchor | Lines est. | Status | Owned state (approx) | Coupling | Risk | Recommended action |
|---|---|---|---|---|---|---|---|
| Module pure helpers | top of file, before `Workflow()` | ~150 | inline | — | used everywhere in-file; `getStepStatusStyle` mirrored by Forecast | low | **Stage A first** → `src/lib/workflow/*` + tests |
| `StepFormModal` (+ Add Person) | `{stepForm.open && <StepFormModal …/>}` | ~505 | **extracted** → [`src/components/workflow/StepFormModal.tsx`](../src/components/workflow/StepFormModal.tsx) | ~17 (self-contained) | props-only (`steps`, `onSave`, `onCopy`) | **low** | done (verbatim file move) |
| Header & project context | after `return (` — project chip, breadcrumb | ~215 | inline | `oldStagesCollapsed` (shared w/ cards list) | reads `steps`, `project`, `projectMaster`; EditProjectModal context | low-med | extract after jobs/supers strips |
| Superintendents strip | `{canAssignSuperintendents && (` in header | ~55 + handlers | inline | 3 (`projectSuperintendents`, `allSuperintendents`, `projectSuperintendentSaving`) | none beyond `projectId` + role gate | **low** | early extract → `WorkflowSuperintendentsStrip` |
| Jobs chips + thread notes | `Jobs:` row + `JobThreadNotesPanel` | ~60 + hook wiring | inline (panel already extracted) | 1 (`projectJobs`) + `useJobThreadNotes` outputs | none beyond `projectId`/`authUser` | **low** | early extract → `WorkflowJobsStrip` |
| Projections & Ledger panel | `{/* Projections + Ledger - Summary bar and unified table */}` | ~180 + handlers/modal | inline | 3 (`projections`, `editingProjection`, `projectionsLedgerExpanded`) | reads `steps` + `lineItems` (ledger side) | med | extract after Stage-A `buildUnifiedRows` |
| Stage cards list | `steps.length === 0 ? … : (() => {` displayItems loop | ~790 + ~900 handlers | inline | `sectionExpanded`, `rowCollapsed`, per-card modal openers | **highest** — reads/writes the whole steps engine | **high** | last, after `useWorkflowStepsEngine` seam |
| Step lifecycle modals | `rejectStep` / `skipStep` / `setStartStep` / `expectedDatesStep` / `assignPersonStep` / `confirmDeleteStep` blocks | ~370 | inline | 8 modal states | opened only from stage cards; submit via engine | med | move with (or just after) the stage-card extraction |
| Line-item + PO/Invoice modals | `editingLineItem` / `confirmDeleteLineItem` / `addingPOToStep` / `addingInvoiceToStep` / `viewingPO` / `viewingInvoice` blocks | ~330 + loaders | inline | 10 states + `availablePOs`/`availableInvoices` | writes `lineItems` via reload; dev/master-only loaders | med | extractable as a cluster before the cards |
| Contact modal + `PersonDisplayWithContact` | `personContactModal` block; component | ~120 | modal inline / component **extracted** → [`PersonDisplayWithContact.tsx`](../src/components/workflow/PersonDisplayWithContact.tsx) | 1 (`personContactModal`) + `personContacts`, `userNames` | rendered inside every stage card row | low | modal stays page-level |
| Steps engine (parent core) | state block + `ensureWorkflow`…`assignPerson` | ~1,100 | inline | `project`, `workflow`, `steps`, `lineItems`, `stepActions`, `userSubscriptions`, role/roster | is the substrate | — | becomes `useWorkflowStepsEngine` hook; **stays in parent** |

Role gates (defined once, read by every region): `canManageStages` (dev / master_technician / assistant-like / superintendent), `isDevOrMaster`, `canSeePrivateNotesAndApprove` (same set as `canManageStages`), `canAssignSuperintendents` (excludes superintendent).

---

## Per-region dossiers

### Module-level pure helpers + `PersonDisplayWithContact`

- **Render location:** top of file, above `export default function Workflow()`.
- **Contents:** `formatDatetime`, `formatDateShort` (both pin `APP_CALENDAR_TZ`), `daysOpen`, `daysBetween`, `formatAmount` (accounting negatives `($1,234.56)`), `formatLineItemDate` (noon-anchored to dodge TZ shift), `ymdFromDateLike`, `formatScheduledDateShort`, `ymdAddDays`, `ymdDaysBetween`, `getStepStatusStyle`, type `PersonContactInfo`, component `PersonDisplayWithContact` (name-as-button + "(not a user)" suffix; calls `onOpenContact`).
- **Duplication (do not "fix" silently — note in the move):** `ymdAddDays` already exists in [`src/utils/dateUtils.ts`](../src/utils/dateUtils.ts) (Workflow defines its own local copy); `ymdDaysBetween` is **triplicated** — private copies also live in `src/lib/projectsForecastAlignStages.ts` and `src/lib/projectsForecastDragEdit.ts`. `getStepStatusStyle` is deliberately **mirrored** (not imported) by `src/lib/projectsForecastColors.ts` so Forecast colors map 1:1 — extracting it to a shared lib lets Forecast import instead of mirror, but that is a follow-up, not part of the behavior-preserving move.
- **Extraction status + risk + approach:** Inline. **Low risk — the Stage-A opener.** Move formatters to `src/lib/workflow/workflowFormat.ts` + tests; promote the ymd helpers into `src/utils/dateUtils.ts` (or `src/lib/workflow/ymd.ts`) and point the two Forecast libs at them in a later pass. `PersonDisplayWithContact` → **done**, moved verbatim to [`src/components/workflow/PersonDisplayWithContact.tsx`](../src/components/workflow/PersonDisplayWithContact.tsx) (exports `PersonContactInfo`).

### `StepFormModal` — Add/Edit step modal (extracted)

- **Render location:** `{stepForm.open && <StepFormModal …/>}` in the parent; component lives in [`src/components/workflow/StepFormModal.tsx`](../src/components/workflow/StepFormModal.tsx).
- **Owned local state (all self-contained):** `name`, `assigned_to_name`, `started_at`, `ended_at`, `depends_on_step_id`, `insert_after_step_id`, plus the assignee autocomplete cluster — `mastersAndSubs`, `assignedSearch`, `filteredMastersSubs`, `showDropdown` — and the Add Person sub-modal cluster — `showAddPerson`, `newPerson` (`{name,email,phone,notes}`), `savingPerson`, `addPersonError`.
- **Props (already a clean seam):** `viewerRole`, `step`, `dependsOnStepId`, `insertAfterStepId`, `steps`, `onSave`, `onClose`, `onCopy?`, `toDatetimeLocal`, `fromDatetimeLocal`.
- **Handlers:** `loadMastersAndSubs` (superintendents scope the `people` roster to the masters in `master_superintendents` — company-wide since v2.921, so this is every master's `people`; adoption is a **roster scope only** and grants no project access — project rows come through `project_superintendents`, RLS-enforced since v2.2836; others scope `people` to own `master_user_id`; users filtered to `master_technician|subcontractor|helpers|primary`; dedupe case-insensitive by name), `handleAssignedSearchChange`, `handleSelectPerson`, `handleAddNewPersonClick`, `checkDuplicateName` (loads **all** `people` + `users` client-side — quirk), `handleSaveNewPerson` (inserts `people` with `kind: viewerRole === 'helpers' ? 'helper' : 'sub'`), `handleSubmit`.
- **Supabase tables:** `users` (role lookup + roster), `people` (roster + INSERT), `master_superintendents`.
- **Sub-detail:** the "change order:" quick-phrase row — first button is a **no-op label styled as a button**; the phrase buttons append `, <phrase>` to the name. Preserve as-is.
- **Extraction status + risk + approach:** **Extracted** — verbatim move to [`src/components/workflow/StepFormModal.tsx`](../src/components/workflow/StepFormModal.tsx); parent wiring (`stepForm` state, `saveStep`, `copyStep`, `closeStepForm`) unchanged. No Stage-A prerequisite (its logic is IO + trivial filtering).

### Header & project context

- **Render location:** top of the returned JSX: back-link + project chip (opens `EditProjectModalContext.openEditProjectModal(project.id, { onSaved: loadProject, onDeleted: navigate('/projects') })`, label via `formatProjectNumberLabel`), `h1`, Project Master line, then the clickable stage **breadcrumb** (`getStepStatusStyle` colors; click scrolls to `#step-<id>` via `scrollIntoView`), and the "Hide Old Stages" toggle + "Add step" button.
- **Owned local state:** none exclusive — `oldStagesCollapsed` is written here but consumed by the stage-cards `displayItems` builder (shared), and `projectMaster` is loaded by `loadProject`.
- **Cross-region/shared state:** `project`, `projectMaster`, `steps` (breadcrumb + old-stages count), `canManageStages`, `canAssignSuperintendents`.
- **External coupling:** `useEditProjectModal()` context; `useNavigate`; the breadcrumb duplicates the hash-scroll behavior of the `#step-` effect.
- **Extraction status + risk + approach:** Inline. **Low-med risk.** Extract as `WorkflowHeader` after the two strips below come out; `oldStagesCollapsed` stays in the parent (read by the cards list) and is passed as value + toggle callback.

### Superintendents strip

- **Render location:** `{canAssignSuperintendents && (` block inside the header ("Superintendents:" chips + add-select).
- **Owned local state:** `projectSuperintendents`, `allSuperintendents`, `projectSuperintendentSaving`. The load effect (`projectId && canAssignSuperintendents`) moves with it.
- **Handlers:** `loadProjectSuperintendents` (`project_superintendents` → `users` by ids), `loadAllSuperintendents` (`users` where `role='superintendent'`, `archived_at IS NULL`), `addProjectSuperintendent` (INSERT + reload), `removeProjectSuperintendent` (DELETE + local filter).
- **Supabase tables:** `project_superintendents` (SELECT/INSERT/DELETE), `users` (SELECT).
- **Cross-region coupling:** none — only `projectId`, the role gate, and `setError`.
- **Extraction status + risk + approach:** Inline. **Low risk — early extract** → `WorkflowSuperintendentsStrip` with props `projectId`, `canAssignSuperintendents`, `onError`. Fully self-contained state + effect; the page's momentum-builder alongside `StepFormModal`.

### Jobs chips + job-thread notes

- **Render location:** right side of the header: "Jobs:" chip row (links to `/jobs?edit=<id>&tab=stages`), per-job thread-notes expander, "+ Create Job" link (`/jobs?newJob=true&project=<projectId>&tab=stages`), and the expanded `JobThreadNotesPanel`.
- **Owned local state:** `projectJobs` (+ its `projectId` load effect) and the whole `useJobThreadNotes(showToast, authUser?.id, authProfileName)` hook surface — `expandedWorkflowJobThreadId`, `workflowJobThreadActivityByJobId`, `workflowJobThreadNotesLoadingId`, `workflowJobThreadSubmittingId`, `workflowJobThreadDraft`, `submitWorkflowJobThreadNote`, `workflowJobThreadStatsByJobId`, `refreshWorkflowJobThreadStats` (+ the stats-refresh effect keyed on `authUser?.id, projectJobs`).
- **Supabase tables:** `jobs_ledger` (SELECT `id, hcp_number, job_name, status` by `project_id`); thread notes tables/RPC live inside `useJobThreadNotes`.
- **Sub-components:** [`JobThreadNotesPanel`](../src/components/JobThreadNotesPanel.tsx) (**extracted**, shared with Jobs/Estimates; note `jobThreadStampActions` is deliberately omitted here — v2.446).
- **Extraction status + risk + approach:** Inline wiring around extracted pieces. **Low risk — early extract** → `WorkflowJobsStrip` owning `projectJobs` + the hook call; props: `projectId`, `authUser`, `authProfileName`, `authRole`, `showToast`.

### Projections & Ledger panel (financials)

- **Render location:** `{/* Projections + Ledger - Summary bar and unified table */}` behind `(isDevOrMaster || canManageStages)`: summary bar (`Projections:` and `Left:` dev/master-only; `Ledger:` for all `canManageStages`), "+ Add Projection", Details toggle, and the expanded unified table (stage | memo | projections | ledger | actions) + the `editingProjection` modal further down.
- **Owned local state:** `projections`, `editingProjection` (`{item, stage_name, memo, amount}`), `projectionsLedgerExpanded`. The projections load effect (`workflow?.id && isDevOrMaster`, 100ms stagger) moves with it.
- **Cross-region/shared state:** `lineItems` + `steps` (the Ledger half of `buildUnifiedRows` and `calculateLedgerTotal`), `workflow?.id`, role gates, `normalizeUrl` (ledger link icon), `openEditLineItem`-adjacent data (read-only here).
- **Derived values (all recomputed per render, no memos):** `buildUnifiedRows()` (aligns projections and ledger line items by trimmed `stage_name` vs `step.name`, pads to `max` rows, joins memos with `' / '`), `calculateProjectionsTotal()`, `calculateLedgerTotal()`.
- **Handlers:** `loadProjections`, `saveProjection` (re-`ensureWorkflow` fallback when state isn't ready), `deleteProjection`, `openEditProjection`.
- **Supabase tables:** `workflow_projections` (SELECT/INSERT/UPDATE/DELETE).
- **Extraction status + risk + approach:** Inline. **Medium risk.** Stage A first: `buildUnifiedRows(projections, steps, lineItems)` → `src/lib/workflow/unifiedFinancialRows.ts` + tests (stage-name matching, row padding, memo joining), plus the two totals. Then `WorkflowFinancialsPanel` taking `projections` state via props or owning it (only the deep-linked `ensureWorkflow` fallback ties saves to the engine — pass `ensureWorkflowId: () => Promise<string|null>`). `lineItems`/`steps` stay parent-owned (also read by stage cards).

### Stage cards list (the core region)

- **Render location:** from `{steps.length === 0 ? (` (empty state incl. the **create-from-template** card) through the `displayItems.map` loop to the closing arrow divider (~2702–3489). Each card: Row 1 header (chevron, name, status + `daysOpen`, `PersonDisplayWithContact`, Assign, Notify/Action Ledger toggles, collapsed pills), Row 2 action buttons (Technician: Set Start / Mark Complete; Office: Approve / Send Back / Skip), Row 2b Expected dates line, Row 2c Percent complete input, rejected-notice banner, Notify table (ASSIGNED × ME checkboxes + cross-step defaults), approved-by line, Action Ledger list, Notes for Tech textarea, Notes for Office textarea, Line Items For Office table (+ View PO / View Invoice / edit / delete buttons, Add Line Item / Add Supply House Invoice / Add PO buttons), Edit / Delete / Re-open footer.
- **Owned local state:** `sectionExpanded` (keys `${stepId}-notify|actionLedger|notes|privateNotes|lineItems`), `rowCollapsed`, and (shared with header) `oldStagesCollapsed`. Also the empty-state cluster `templates`, `selectedTemplateId`, `creatingFromTemplate` (+ the mount-once templates effect).
- **Cross-region/shared state (the problem):** everything in the steps engine — `steps`, `lineItems`, `stepActions`, `userSubscriptions`, `personContacts`, `userNames`, `currentUserName`, `availablePOs`/`availableInvoices` (button visibility), all four role gates — plus every modal opener: `setStepForm`/`openAddStep`/`openEditStep`, `setRejectStep`, `setSkipStep`, `setSetStartStep`, `setAssignPersonStep`, `openExpectedDates`, `setConfirmDeleteStep`+`setDeleteStepConfirmText`, `openEditLineItem`, `setConfirmDeleteLineItem`, `setAddingPOToStep`, `setAddingInvoiceToStep`, `loadPODetails`, `loadInvoiceDetails`, `setPersonContactModal`.
- **Derived values:** the `displayItems` IIFE (old-stage collapse → single summary row `{count, firstStarted}`; most recent completed stage stays visible), `isRowDefaultCollapsed` (completed/approved/skipped/pending default collapsed), `isStepEmpty` (drives type-to-confirm delete), `isSectionDefaultExpanded` (notify always false; notes/privateNotes only when content; lineItems true), collapsed-pill word counts and line-item totals, per-card `ymdDaysBetween` planned-length label.
- **Handlers used (live in the engine):** `markStarted`, `markCompleted`, `markApproved`, `markReopened`, `updatePercentComplete` (optimistic `setSteps` merge — the page has **no realtime subscription**; Forecast Specific is the other writer of the same column), `updateNotifyAssigned`, `updateCrossStepNotify`, `updateNotifyMe`, `updateNotes` / `updatePrivateNotes` (RPC `update_step_notes` / `update_step_private_notes` with fall-back to direct UPDATE when the RPC is missing), `createFromTemplate`.
- **Supabase tables (via the engine):** `project_workflow_steps`, `project_workflow_step_actions`, `workflow_step_line_items`, `step_subscriptions`, `workflow_templates` + `workflow_template_steps`.
- **Sub-components:** [`PersonDisplayWithContact`](../src/components/workflow/PersonDisplayWithContact.tsx) (extracted) and the 556-line [`StepCommitmentPanel`](../src/components/workflow/StepCommitmentPanel.tsx) (sub work orders, v2.1199–1222 — commitments/work-order rail rendered inside each expanded stage card, gated on `canManageStages`); everything else inline JSX (two inline SVG icon paths for edit/delete/clipboard/link).
- **External coupling:** deep-link **receivers** — Dashboard Assigned/Subscribed Stages and Jobs job-cards link to `/workflows/{project_id}#step-{step_id}` (the hash-scroll effect + `id={'step-'+s.id}` anchors must keep working); `parsePercentCompleteInput` shared with Forecast Specific; `getStepStatusStyle` mirrored by Forecast colors.
- **Extraction status + risk + approach:** Inline. **High risk — extract last.** Prereqs: (1) the `useWorkflowStepsEngine` seam (see below) so the card component consumes `steps`/`lineItems`/mutators via one props object; (2) Stage-A moves of the predicates (`isRowDefaultCollapsed`, `isStepEmpty`, `isSectionDefaultExpanded` — make `isStepEmpty` take a `lineItemCount` arg), the `displayItems`/old-stages bucketing (pure function of `(steps, oldStagesCollapsed)` + tests), and the collapsed-pill word-count/total math. Then move card JSX to `src/components/workflow/WorkflowStageCard.tsx` (one card) or `WorkflowStagesList.tsx` (list + summary row), with all modal openers passed as callbacks. `sectionExpanded`/`rowCollapsed` can move with the list (used nowhere else); `oldStagesCollapsed` stays in the parent (header toggle writes it).

### Step lifecycle modals

- **Render location:** consecutive blocks after the cards list: `confirmDeleteStep` (type-the-name confirm unless `isStepEmpty`), `rejectStep` ("Previous work incomplete" + reason), `skipStep` (reason required, "Not relevant" quick-fill), `setStartStep` (datetime-local, seeded `toDatetimeLocal(now)`), `expectedDatesStep` (start/end/length with two-way auto-compute via `ymdAddDays`/`ymdDaysBetween`, `seededFromPrior` hint, `updateNextStage` cascade checkbox, Clear), `assignPersonStep` (+ `assignPersonFilter`; current user pinned first with "(You)").
- **Owned local state:** the six modal states above + `deleteStepConfirmText`.
- **Submit handlers (engine-owned):** `deleteStep` (deletes `workflow_step_dependencies` both directions, then the step), `submitReject` (sets rejected + reason; **reopens the previous step** to `in_progress` when completed/approved — clearing `approved_*` and stamping `next_step_rejected_notice`/`next_step_rejection_reason` — or just stamps the notice when previous is pending/in_progress; fires reopened notifications), `submitSkip`, `submitSetStart` → `markStarted`, `submitExpectedDates` (single-column UPDATE + optimistic `setSteps`; optional next-stage `scheduled_start_date` cascade), `clearExpectedDates`, `assignPerson` (optimistic with revert; RPC `update_step_assigned_to` with direct-UPDATE fallback).
- **Extraction status + risk + approach:** Inline. **Medium risk.** Each modal is opened from exactly one place (a stage card), so per playbook they move **with** the stage-card extraction (or immediately after, one modal per commit). The expected-dates modal's `handleStartChange`/`handleEndChange`/`handleLengthChange` linkage is a Stage-A pure kernel (`src/lib/workflow/expectedDatesLinkage.ts` + tests: length↔end auto-compute, negative/NaN guards, `endBeforeStart`).

### Line-item + PO/Invoice modals (financial attach/view cluster)

- **Render location:** `editingLineItem` modal (date/link/memo/amount form + clipboard-import icon button in Add mode), `confirmDeleteLineItem`, `{/* Add Purchase Order to Step Modal */}` (`addingPOToStep`), `{/* Add Supply House Invoice to Step Modal */}` (`addingInvoiceToStep` + `invoiceSearchText` client-side filter), `{/* View Purchase Order Details Modal */}` (`viewingPO`), `{/* View Supply House Invoice Details Modal */}` (`viewingInvoice`).
- **Owned local state:** `editingLineItem`, `lineItemPasteImporting`, `confirmDeleteLineItem`, `addingPOToStep`, `availablePOs`, `addingInvoiceToStep`, `availableInvoices`, `invoiceSearchText`, `viewingPO`, `viewingInvoice`. The dev/master-only 200ms-staggered load effect (`loadFinalizedPOs` + `loadSupplyHouseInvoices`) moves with the cluster.
- **Cross-region/shared state:** `lineItems` (writes land via `refreshSteps()` + `loadLineItemsForSteps(...)` reload — both parent-owned), `steps` (reload scope), role gates, `setError`.
- **Handlers:** `saveLineItem` (link validated through `normalizeUrl`; `item_date` sliced to YMD; max `sequence_order`+1), `importLineItemsFromClipboard` → `importLineItemsFromPaste` (all-or-nothing [`parseWorkflowLineItemPaste`](../src/lib/parseWorkflowLineItemPaste.ts), one bulk INSERT), `deleteLineItem`, `openEditLineItem`, `loadFinalizedPOs` (POs `status='finalized'` limit 100 + single batched `purchase_order_items` totals query — N+1 deliberately avoided), `loadSupplyHouseInvoices` (limit 100, `supply_houses(name)` join), `loadPODetails` (`purchase_order_items` + `material_parts(*), supply_houses(*)`), `loadInvoiceDetails`, `addPOToStep` (line item memo `` `PO: ${name} - ${count} items, $${total} total` ``, `purchase_order_id` FK), `addInvoiceToStep` (memo `` `Invoice #… - … - $…` ``, `supply_house_invoice_id` FK).
- **Supabase tables:** `workflow_step_line_items` (all verbs), `purchase_orders`, `purchase_order_items`, `supply_house_invoices`, plus joined `supply_houses`/`material_parts`.
- **External coupling:** POs/invoices originate on the Materials page (`MATERIALS_TABS_ARCHITECTURE.md` PO engine); read-only here plus line-item FK inserts.
- **Extraction status + risk + approach:** Inline. **Medium risk, extractable before the cards** as `WorkflowLineItemModals` (or split: attach modals / view modals). Props: `stepId` targets, `lineItems` read-only, `onSaved` callback that runs the parent's `refreshSteps` + `loadLineItemsForSteps`, role gates, `onError`. Stage A: the invoice search predicate (inline in the modal — memo/supply-house/amount/date/PO#/`paid`/`unpaid` matching) → pure `filterAvailableInvoices(invoices, query)` + tests; `normalizeUrl` → `src/lib/workflow/normalizeUrl.ts` + tests (missing-colon `https//` fixup, `//` prefix, bare host); **add the missing colocated test for `parseWorkflowLineItemPaste.ts`** (none exists today).

### Contact modal

- **Render location:** `{/* Person Contact Info Modal */}` (`personContactModal`) — name, "(not a user)" badge, mailto/tel links.
- **Owned local state:** `personContactModal`.
- **Shared state:** `personContacts` + `userNames` (built in the role/roster effect; also feed `PersonDisplayWithContact` in every card).
- **Extraction status:** trivial; can move to `src/components/workflow/PersonContactModal.tsx` any time. The state stays in the parent only because openers live in every stage card — once cards are extracted it can travel with the list.

---

## Shared infrastructure

The "API surface" any extracted region must be handed. **This is the page's substrate — there is no selection pointer to share, only this engine.**

### Identity, role, and roster (parent, permanent)

- `useAuth()` → `authUser`, `authProfileName`, `authRole`; `useToastContext()` → `showToast`; `useEditProjectModal()`.
- The `authUser?.id` effect loads `users.role/name/email` → `userRole` + `currentUserName`, then builds `roster` (superintendents: `people` scoped to adopted masters via `master_superintendents` — every master since the v2.921 company-wide sync; roster scope only, the project itself is visible only if the superintendent is in `project_superintendents` (v2.2836); others: own `master_user_id`; users list role-dependent), `userNames` (lowercased set) and `personContacts` (people take precedence over users).
- Gates derived per render: `canManageStages`, `isDevOrMaster`, `canSeePrivateNotesAndApprove`, `canAssignSuperintendents`.

### Steps engine (parent, becomes `useWorkflowStepsEngine`)

State: `project`, `projectMaster`, `workflow`, `steps`, `loading`, `error`, `lineItems`, `stepActions`, `userSubscriptions`. Refs: `ensureWorkflowPromises` (per-project promise mutex), `lastLoadedWorkflowId` (skip-redundant-load tracking).

Loaders/mutators: `ensureWorkflow(pid)` (find-or-create `project_workflows` with insert-conflict re-query), `loadProject(pid)` (+ `projectMaster` fetch), `loadSteps(wfId)` (subcontractor-like roles filtered to `assigned_to_name = currentUserName`, empty ⇒ access-denied error; batch-loads `step_subscriptions` for me and the last **100 total** `project_workflow_step_actions`), `loadLineItemsForSteps(stepIds)` (role-gated; swallows RLS/permission errors), `refreshSteps()` (resets `lastLoadedWorkflowId`, re-syncs `workflow` state), `getCurrentUserName()`, `recordAction(stepId, actionType, notes?)`, `updateStepStatus(step, status, extra?)`, `findPreviousStep`/`findNextStep`.

Lifecycle + cascade: `markStarted`, `markCompleted` / `markApproved` (both auto-reopen a rejected **next** step to pending and clear `next_step_rejected_notice`/`next_step_rejection_reason` on self), `markReopened`, `submitReject` (previous-step reopen/notice cascade), `submitSkip`, `saveStep` (edit: update + dependency delete/insert; add: `insertAfterStepId` / `'__beginning__'` with sequential `sequence_order` bumps), `copyStep` (bumps + copy, resets status/timestamps, copies `workflow_step_dependencies`, does **not** copy `private_notes`/`inspection_notes`/`rejection_reason`), `deleteStep`, `createFromTemplate` (sequential inserts from `workflow_template_steps`), `assignPerson`.

Notifications: `sendNotification` invokes edge function **`send-workflow-notification`** with template types `stage_assigned_started|stage_me_started|stage_assigned_complete|stage_me_complete|stage_next_complete_or_approved|stage_prior_rejected|stage_assigned_reopened|stage_me_reopened`, workflow deep link `${origin}/workflows/${project.id}#step-${step.id}`, optional push title/body; `sendWorkflowNotifications(step, actionType)` refetches all steps for next/prev, resolves recipients via `getContactForName` (users first, then people), loops `step_subscriptions` per action type with per-subscriber `users` lookups. All fire-and-forget (`void`), errors logged not surfaced.

Effects: the master load effect (keyed `projectId, userRole, currentUserName, workflow?.id`; skip-if-loaded logic with subcontractor exception; parallel `loadProject` + `ensureWorkflow`), staggered loads (line items 50ms, projections 100ms, POs+invoices 200ms — deliberate DB-load spreading), the `#step-` hash scroll (100ms timeout after steps land), templates mount-load.

Supabase surface: tables `projects`, `project_workflows`, `project_workflow_steps`, `project_workflow_step_actions`, `workflow_step_dependencies`, `workflow_step_line_items`, `workflow_projections`, `workflow_templates`, `workflow_template_steps`, `step_subscriptions`, `purchase_orders`, `purchase_order_items`, `supply_house_invoices`, `project_superintendents`, `master_superintendents`, `jobs_ledger`, `users`, `people` (+ joined `supply_houses`, `material_parts`); RPCs `update_step_notes`, `update_step_private_notes`, `update_step_assigned_to` (each with direct-UPDATE fallback); edge function `send-workflow-notification`; thread-notes tables/RPC inside `useJobThreadNotes`. **No realtime subscriptions anywhere on this page** — optimistic `setSteps` merges + `refreshSteps` reloads are the only refresh paths.

### URL / navigation (parent, permanent)

- Route param `projectId` (`useParams`) — the page's only "selection".
- `#step-<stepId>` hash: scroll-into-view effect after load; every card renders `id={'step-'+s.id}`. Inbound links: Dashboard stages, Jobs in-progress banner, workflow notification emails/pushes. **Stays in the parent.**
- Outbound: `/projects` back-link, `/jobs?edit=<jobId>&tab=stages`, `/jobs?newJob=true&project=<projectId>&tab=stages`.

### Seam hook candidate

**`useWorkflowStepsEngine(projectId, { authUser, userRole, currentUserName, showToast })`** returning the engine object above (state + loaders + lifecycle + notifications). The parent destructures it so downstream references are unchanged; the stage-cards list, lifecycle modals, and financial panel then consume it via props. Smaller optional seams: `useWorkflowLineItemSources` (POs + invoices loaders/state) and `useWorkflowSuperintendents` — but both are small enough to live inside their extracted components.

---

## Stage-A pure-logic inventory (extract to `lib/*` + tests before any component moves)

| Candidate | Currently | Target |
|---|---|---|
| `formatDatetime`, `formatDateShort`, `daysOpen`, `daysBetween`, `formatAmount`, `formatLineItemDate`, `formatScheduledDateShort` | module-level in Workflow.tsx | `src/lib/workflow/workflowFormat.ts` + tests (TZ pinning, accounting negatives, noon-anchor) |
| `ymdFromDateLike`, `ymdAddDays` (dup of `dateUtils`), `ymdDaysBetween` (triplicated w/ two Forecast libs) | module-level local copies | consolidate in `src/utils/dateUtils.ts` (repoint Forecast copies in a later, separate pass) |
| `getStepStatusStyle` | module-level; mirrored by `projectsForecastColors.ts` | `src/lib/workflow/stepStatusStyle.ts` + test (keep the Forecast mirror untouched during the move) |
| `normalizeUrl` | function inside component body | `src/lib/workflow/normalizeUrl.ts` + tests (`https//` missing-colon fixup, `//`, bare host) |
| `buildUnifiedRows` + `calculateLedgerTotal` + `calculateProjectionsTotal` | inside component body | `src/lib/workflow/unifiedFinancialRows.ts` taking `(projections, steps, lineItems)` + tests |
| old-stages `displayItems` bucketing | IIFE in JSX | pure `buildStageDisplayItems(steps, oldStagesCollapsed)` + tests (summary emission, most-recent-completed stays visible) |
| `isRowDefaultCollapsed`, `isStepEmpty`, `isSectionDefaultExpanded` | functions inside component body (`isStepEmpty` closes over `lineItems`) | `src/lib/workflow/stageCardDefaults.ts` with explicit args + tests |
| Expected-dates linkage (`handleStartChange`/`handleEndChange`/`handleLengthChange`, `lengthInvalid`, `endBeforeStart`) | closures inside the modal IIFE | `src/lib/workflow/expectedDatesLinkage.ts` + tests |
| Invoice search predicate (Add Invoice modal) | inline filter IIFE | pure `filterAvailableInvoices(invoices, query)` + tests (`paid`/`unpaid` keywords) |
| `parseWorkflowLineItemPaste` | already in [`src/lib/parseWorkflowLineItemPaste.ts`](../src/lib/parseWorkflowLineItemPaste.ts) but **has no colocated test** | add `parseWorkflowLineItemPaste.test.ts` |
| `parsePercentCompleteInput` | already extracted + tested (14 tests) | none — do not fork; shared with Forecast |

The notification recipient-routing in `sendWorkflowNotifications` is mostly IO (sequential lookups); a pure "who gets which template" decision table is possible but is a redesign — leave for a later pass.

---

## Preserve-quirks list (odd but load-bearing — do not "fix" during the move)

1. **`ensureWorkflow` mutex + insert-conflict retry**: a `useRef` Map of in-flight promises per project prevents concurrent duplicate-workflow creation; on insert failure it re-queries and adopts the winner. The `console.log` calls are part of the debugging trail for a past real bug — keep or strip consciously, not incidentally.
2. **`lastLoadedWorkflowId` skip logic** in the master effect avoids redundant `loadSteps`, with an explicit exception forcing re-run for subcontractor-like roles (their filter depends on `currentUserName` arriving late). `refreshSteps` resets it to force a reload.
3. **Staggered load effects** (50ms line items, 100ms projections, 200ms POs+invoices) deliberately spread concurrent DB load. Keep the timings.
4. **RPC-with-fallback pattern**: `updateNotes`, `updatePrivateNotes`, and `assignPerson` try an RPC first and fall back to a direct table UPDATE when the error message contains `'Could not find the function'`. Schema-drift armor — preserve.
5. **Mixed refresh model**: most mutations do full `refreshSteps()`; `updatePercentComplete`, `submitExpectedDates`, `clearExpectedDates`, and `assignPerson` do optimistic `setSteps` merges (assignPerson also reverts on error). There is **no realtime subscription** — Forecast-side edits only appear after a manual reload. Preserve which handler uses which path.
6. **Reject/complete cascades**: `submitReject` reopens a completed/approved previous step to `in_progress` (clearing approval fields) and stamps `next_step_rejected_notice`/`next_step_rejection_reason`; `markCompleted`/`markApproved` auto-reopen a rejected next step to `pending` and clear the notice on self. Each cascade records actions and fires reopened notifications.
7. **Notifications are best-effort fire-and-forget** (`void sendWorkflowNotifications(...)`), errors logged never surfaced; per-subscriber sequential `users` lookups (N+1 by design); cross-step checkboxes default **on** via `!== false` (null/undefined = checked).
8. **`stepActions` loads at most 100 rows across ALL steps** (`.limit(100)` on the whole `.in('step_id', stepIds)` query, newest first) — not per-step. Busy workflows silently truncate older history.
9. **Subcontractor access model**: `loadSteps` filters to `assigned_to_name = currentUserName` (name-string matching, not user id) and shows an access-denied error when zero rows. Assistants/superintendents are NOT filtered (RLS handles them).
10. **`loadLineItemsForSteps` swallows RLS errors** (skips `setError` for `PGRST116`/message containing `'permission'`) and clears to `{}` — assistants without access degrade silently.
11. **PO/invoice pickers are dev/master-only and capped at 100** (`loadFinalizedPOs` computes totals via one batched `purchase_order_items` query — keep the batching); the Add-PO/Add-Invoice buttons only render when the caches are non-empty, so assistants/superintendents never see them even though they can add manual line items.
12. **Line-item link handling**: `saveLineItem` normalizes via `normalizeUrl` (which repairs `https//` missing-colon typos); the form also shows a soft warning yet submits anyway; ledger-table links `window.open` with `noopener`.
13. **Clipboard import is Add-mode only**, all-or-nothing parse, one bulk INSERT, requires secure context; the icon is hidden when editing an existing item.
14. **`saveStep`/`copyStep` bump `sequence_order` with one UPDATE per following step** (sequential loop, no RPC); `createFromTemplate` inserts sequentially. Slow-but-simple by design — do not batch during the move.
15. **Percent complete**: uncontrolled input re-keyed as `` `pct-workflow-${s.id}-${pct ?? 'null'}` ``; blur commits through shared `parsePercentCompleteInput` (empty/0/non-numeric → `null`); Enter blurs. Must stay keystroke-compatible with the Forecast Specific gutter cell.
16. **Expected dates**: modal start seeds from the **previous** stage's `scheduled_end_date` when unset (`seededFromPrior`), and the save can cascade this stage's end into the next stage's `scheduled_start_date` (checkbox default on when a next stage exists). Forecast's resolver depends on these columns.
17. **Type-name-to-confirm delete** only when `isStepEmpty` is false; step delete removes `workflow_step_dependencies` in **both** directions first. The copy in the modal references the Settings → Recently deleted 90-day restore.
18. **`StepFormModal` quirks**: "change order:" first chip is a non-interactive label styled as a button; `checkDuplicateName` loads the entire `people` + `users` tables client-side; new people default to `kind: 'sub'` (`'helper'` when the viewer is `helpers`); dropdown hides on a 200ms blur timeout.
19. **Old-stages collapse** keeps the most recent completed/approved/skipped stage visible and replaces only the older ones with the summary row; toggle appears only at 2+ finished stages.
20. **`formatLineItemDate` and `formatScheduledDateShort` anchor at `T12:00:00`** to avoid TZ date-shift; `formatDatetime`/`formatDateShort` pin `APP_CALENDAR_TZ`. Keep the anchors.

---

## Recommended extraction order (value ÷ risk)

1. **Stage-A sweep** — the [pure-logic inventory](#stage-a-pure-logic-inventory-extract-to-lib--tests-before-any-component-moves) above; each row independently shippable. Highest-leverage: `workflowFormat.ts`, `unifiedFinancialRows.ts`, `normalizeUrl.ts`, the missing `parseWorkflowLineItemPaste` test.
2. ~~**`StepFormModal` → `src/components/workflow/StepFormModal.tsx`**~~ — **done** (verbatim move of the already-module-level, props-clean component; `PersonDisplayWithContact` moved to its own file in the same wave).
3. **`WorkflowSuperintendentsStrip`** — 3 states + 1 effect + 4 handlers, props `projectId`/`canAssignSuperintendents`/`onError`. Validates the region seam.
4. **`WorkflowJobsStrip`** — `projectJobs` + the `useJobThreadNotes` wiring.
5. **Line-item + PO/Invoice modal cluster → `WorkflowLineItemModals`** — its 10 states + 2 loaders + the 200ms effect; parent keeps `lineItems` and hands down an `onSaved` reload callback.
6. **`WorkflowFinancialsPanel`** — after `unifiedFinancialRows.ts` lands; owns `projections`/`editingProjection`/`projectionsLedgerExpanded`; reads `steps`+`lineItems` via props; gets `ensureWorkflowId` callback for the save fallback.
7. **Steps-engine seam — `src/hooks/useWorkflowStepsEngine.ts`** — move the engine state/refs/loaders/lifecycle/notifications; parent destructures the return so nothing downstream changes.
8. **Stage cards — `WorkflowStagesList` / `WorkflowStageCard` + the step lifecycle modals** — last, against the engine hook. `sectionExpanded`/`rowCollapsed` move with the list; each lifecycle modal moves in its own commit.

### What must STAY in the parent

- The route param `projectId` and the `#step-` hash-scroll effect (deep-link receivers across Dashboard/Jobs/notification emails).
- The role/roster/auth effect and the four role gates (read by every region).
- The `useWorkflowStepsEngine` hook call itself (`steps`, `lineItems`, `refreshSteps`, error/loading — the substrate every region consumes).
- `oldStagesCollapsed` (written by the header toggle, read by the cards list).
- The `EditProjectModalContext` wiring and top-level `loading`/`error`/not-found early returns.

Definition of done per region, verification gates (`npm run typecheck && npm run lint && npm test` after every step), and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md). Behavior-preserving only — the quirks list above is the contract.
