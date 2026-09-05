# Clock Surfaces Architecture Map

---
file: docs/CLOCK_SURFACES_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map (per PAGE_DECOMPOSITION_PLAYBOOK.md) for the two clock-session UI God components — src/components/DashboardTeamActiveClockStrip.tsx (~2,965 lines) and src/components/ClockInOutButton.tsx (~2,248 lines). Inventories every logical region (state, memos, handlers, supabase tables/RPCs, sub-components, coupling) so extraction can proceed without re-deriving the strategy.
audience: Developers, AI Agents
sections: What this surface is; Shared substrate; Master summary table; DashboardTeamActiveClockStrip regions; ClockInOutButton regions; Stage-A pure-logic inventory; Preserve-quirks list; Recommended extraction order
last_updated: 2026-07-29
---

## What this surface is

Two components (not pages) that together are the clock-session UI:

- [`src/components/DashboardTeamActiveClockStrip.tsx`](../src/components/DashboardTeamActiveClockStrip.tsx) — **2,965 lines**, one exported component `DashboardTeamActiveClockStrip`. The manager/viewer-facing strip: three stacked orange-header tables (**Currently In**, **Clocked in today**, **Jobs worked today**) plus an approve/reject/revoke engine and four attached modals. It is **presentational over parent-fed data**: all row data arrives as props from [`useDashboardMyTeamSectionState`](../src/hooks/useDashboardMyTeamSectionState.ts) (~1,464 lines — the real data engine, already extracted). Hosts (verify with grep): `src/pages/Dashboard.tsx` (two role-gated instances with identical props, lines ~1266 and ~1333), [`src/components/people/PeopleHoursDashboardClockStrip.tsx`](../src/components/people/PeopleHoursDashboardClockStrip.tsx) (People → Hours wrapper, ~512 lines), and [`src/components/quickfill/QuickfillPeopleHoursNewSection.tsx`](../src/components/quickfill/QuickfillPeopleHoursNewSection.tsx).
- [`src/components/ClockInOutButton.tsx`](../src/components/ClockInOutButton.tsx) — **2,248 lines**, default export `ClockInOutButton`. The worker-facing punch surface: the Clock In / Clock Out / Update Focus button row plus three inline modals (Clock In, Update Focus, Clock Out Review), the Tally pre-clock-out gate, the missing-reports nag, and the Job Mode direct-apply bridge. Unlike the strip it **owns its own data fetching** (`fetchSessions`). Hosts: `src/pages/Dashboard.tsx` (~line 1204) and [`src/components/dispatchMode/DispatchModeHome.tsx`](../src/components/dispatchMode/DispatchModeHome.tsx).

Both are high-churn: `DashboardTeamActiveClockStrip` appears in ~43 `RECENT_FEATURES.md` entries (v2.196 through v2.786+), `ClockInOutButton` in ~36 (v2.191 through v2.545+, incl. the Job Mode bridge, the Tally gate, and the toast-loop fix). Because they are components, regions are gated by **state/props**, not an `activeTab` union — each dossier below anchors on the gate condition and symbol names. Line numbers are "as of 2026-07-29" and rot; search the symbol.

Domain context (what `origin`, `salary_segment_index`, synthetic salary rows, and the sync RPC mean): [`SALARY_CLOCK_SESSIONS.md`](./SALARY_CLOCK_SESSIONS.md).

## Shared substrate

**There is no shared selection pointer and no shared client state between the two components.** No `setSharedBid` equivalent exists; the two components never exchange props or context state. Their only coupling is (a) the `clock_sessions` table itself and (b) parent-owned refetch callbacks (`onClockSessionsMutated` on the strip, `onClockInSuccess` on the button — Dashboard wires both into `myTeam.loadPending`). **Consequence: the two components can be decomposed completely independently, in either order** — but each has its own *internal* substrate that must be seamed before its regions move:

1. **Strip — the approve/status engine** (parent-of-strip stays intact; this stays in the strip component or moves to a hook): `optimisticStripApprovedIds` + `stripApproveBusy` + `stripActionsSession`/`stripActionsPayload` + `stripRejectConfirm` and the handlers `handleStripSessionApprove` / `handleStripSessionRevoke` / `performStripSessionReject` / `requestStripSessionReject`. Both the Clocked-in-today rows AND the Jobs-worked-today rows render `ClockSessionStripApproveControl` against this one state cluster, and the *focused-row filter* (`stripRowInFocusedClockedInView` → `clockedInTodayFocusedRows`) reads the same `optimisticStripApprovedIds` so an optimistic approve drops the row from the "missing" view. Any table extraction must consume this engine via props/hook — never duplicate it.
2. **Strip — the external data engine is already extracted**: `useDashboardMyTeamSectionState` supplies `clockedInTodayRows: ClockedInTodayStripRow[]`, `jobsWorkedTodayRows: JobsWorkedTodayStripRow[]`, `sessions: DashboardStripSession[]`, `hoursTodayByUserId`, `clockStripWorkDateYmd`, and the report-key maps. The strip's decomposition does not touch it.
3. **Button — the association-picker substrate**: `selectedAssociation` + `associationChipFromSearch` + `unifiedSearchText`/`unifiedSearchResults` + `serviceTypes`/`enabledBidServiceTypeIds`/`subcontractorServiceTypeIds` + `scheduledDispatchJobs`/`workingBoardBidPicks` + `lastSelectedJobBid` (+ its localStorage persistence) + the refs `assignedJobsShownRef`/`assignedJobsFetchGenRef`/`lastDefaultUnifiedResultsRef`/`unifiedSearchTextRef` + the three loader effects. All three modals AND the Tally gate share this one instance (they can, because only one modal opens at a time — same pattern as Materials' shared filter dropdown). This is the button's `useBidPricingEngine` equivalent: build `useClockAssociationPicker` before any modal moves.
4. **Button — the session core**: `openSession`/`todaySessions`/`totalSecondsToday` + `fetchSessions` + `salaryUiActive` + the 90 s salary-sync interval. Read by the button row, all three modals, the Tally gate, and `applyUpdateFocusDirectImpl`. Stays in the parent component permanently.

---

## Master summary table

| # | Region | Component | Gate / anchor | Lines est. | Coupling | Risk | Status |
|---|---|---|---|---|---|---|---|
| S1 | Module-level pure helpers + style constants | Strip | top of file, before the component (`findTodaySessionInStrip` … `stripTableHost`) | ~640 | none (closure-free) | **low** | inline — **Stage A first** |
| S2 | Approve / reject / revoke engine + actions & reject modals | Strip | `optimisticStripApprovedIds`, `handleStripSessionApprove`, `<ClockSessionStripActionsModal>`, reject dialog JSX | ~330 | high (consumed by S4 + S5 + focused filter) | med | inline — **seam hook** |
| S3 | Currently In table | Strip | `showCurrentlyInTable` (= `!hideCurrentlyInTable && sessions.length > 0`), JSX ~1506–1806 | ~330 | med (modal contexts, dispatch counts, materialize) | low-med | inline |
| S4 | Clocked in today table | Strip | `clockedInTodayRows.length` branch, `id="clocked-in-today-section-panel"`, JSX ~1807–2287 | ~500 | high (S2 engine, expand modes, header chrome) | med-high | inline |
| S5 | Jobs worked today table | Strip | `jobsWorkedTodayRows.length > 0`, `id="jobs-worked-today-section-panel"`, JSX ~2288–2834 | ~550 | high (S2 engine, merged header with S4, report modal) | med-high | inline |
| S6 | Header chrome + scope toggle + expand-mode toggles | Strip | `stripHeaderChromeInner`, `citExpandModeToggle`, `showStripTopRightBar` block | ~260 | highest (writes S4/S5 state; overlays S3/S4/S5 headers via `stripTopRightHeaderReserve`) | high | inline — **stays with parent** |
| S7 | Attached modals (CopyDayJobMix, ScheduleDayEmail, ReportView) | Strip | end of JSX | ~60 | low (already extracted components; strip only holds open-state) | low | components extracted; mounting stays |
| B1 | Session data core + salary sync | Button | `fetchSessions`, `salaryUiActive`, effects ~281–417 | ~260 | highest (everything reads it) | — | **stays in parent** |
| B2 | Association picker substrate | Button | state ~191–229, effects ~471–729, `renderScheduledDispatchPicks` / `renderWorkingBoardBidPicks` / `renderUseLastJobBidShortcut` / `renderUnifiedJobBidSearchRow` + 3 duplicate result dropdowns | ~700 | high (all 3 modals + tally gate) | med | inline — **seam hook + shared component** |
| B3 | Clock In modal | Button | `clockInModalOpen`, JSX ~1678–1839 | ~220 | med (B1 + B2) | low-med | inline |
| B4 | Update Focus modal + Job Mode bridge | Button | `updateFocusModalOpen`, `applyUpdateFocusDirectImpl`, JSX ~1840–1991 | ~330 | med-high (B1 + B2 + `UpdateFocusOpenerBridgeContext` registrations) | med | inline (bridge registration stays in parent) |
| B5 | Clock Out flow (tally gate → review modal → missing reports → feedback) | Button | `handleClockOutClick`, `clockOutReviewOpen`, `tallyPreClockOutOpen`, JSX ~1992–2245 | ~600 | high (B1 + B2 + 4 already-extracted modals) | med-high | inline |
| B6 | Button row + My Time preview | Button | `topRowContent`, `myTimePreviewButton`, ~1548–1674 | ~130 | low (reads B1 busy flags) | low | inline — stays with parent |

---

## DashboardTeamActiveClockStrip — region dossiers

### Props contract (the strip's whole external API — stays as-is)

`sessions: DashboardStripSession[]` (open sessions incl. synthetic salary rows — see `isSyntheticSalaryStripSession` in [`src/types/clockSessions.ts`](../src/types/clockSessions.ts)), `hoursTodayByUserId`, `clockedInTodayRows: ClockedInTodayStripRow[]`, `jobsWorkedTodayRows`, `jobsWorkedTodayReportKeys`/`jobsWorkedTodayReportIdByKey`/`jobsWorkedTodayJobLedgerIdsWithReport`, `showScopeToggle`/`clockStripScope`/`clockStripNarrowScopeLabel`/`clockStripWideScopeLabel`/`onClockStripScopeChange`, `showJobBidColumn`, `onJobBidSaved`/`onJobBidAssignError`, `onApplyScheduleProportionsForSession` (People → Hours only), `onOpenStripMyTimeEditor`, `authUserId`, `canApproveClockSessions`, `onClockSessionsMutated`, `onMaterializeSalarySession`, `hideCurrentlyInTable`, `enableCopyDayJobMix`, `enableScheduleDayEmail`, `clockStripWorkDateYmd`, `showAddClockSession`/`onAddClockSession`, `enableCurrentlyInDispatchIcon`. Contexts consumed: `useAuth` (viewer role for ReportViewModal), `useLedgerPrefixMap`, `useUserReviewModal`, `useJobDetailModal`.

### S1 — Module-level pure helpers + style constants

- **Location:** everything above the component function (~lines 62–695). Closure-free by construction.
- **Pure functions:** `findTodaySessionInStrip`, `stripApproveStatusForSession` (server status ⊕ optimistic-ids merge), `stripSessionIsPendingApprovalMerged`, `stripClockedInTodayDisplayLabel` ("You · Name" for the viewer's own row), `stripRowHasPendingApprovalMerged`, `stripRowHasClosedSalaryScheduleNoOpenSession` (split-salary-day visibility rule), `stripRowInFocusedClockedInView` (the "Needs attention" predicate), `stripActionsPayloadFromSession`, `normalizeStripActionsPayloadFallback`, `personName`, `stripPersonDisplayName`, `shortJobOrBidLabel`, `sessionDurationSeconds` (**duplicates the hook's second-math on purpose** — comment says it aligns with Today totals), `formatDurationFromSeconds`, `formatElapsedOpen`, `formatHoursH`, `stripRowHasUnassignedSession`, `stripRowEligibleForApplyScheduleProportions` (exactly-one closed unassigned session — day-editor v1 parity).
- **localStorage codecs:** `isClockedInTodayExpandMode` / `readClockedInTodayExpandMode` (with legacy `dashboard_clock_strip_clocked_in_today_collapsed` migration) / `persistClockedInTodayExpandMode` / `cycleClockedInTodayExpandMode` for key `dashboard_clock_strip_clocked_in_today_expand_mode`; `readJobsWorkedTodaySectionCollapsed` / `persistJobsWorkedTodaySectionCollapsed` for `dashboard_clock_strip_jobs_worked_today_collapsed`.
- **Components/constants:** `StripClockOverlapBadge`, ~50 `CSSProperties` constants, the z-index ladder (`STRIP_POPOVER_Z` 1100 → `STRIP_ACTIONS_MODAL_Z` 1150 → `STRIP_MODAL_INNER_Z` 1170 → `STRIP_REJECT_MODAL_Z` 1280), `STRIP_SECTION_HEAD_BG = '#ff6600'` (intentional parity with ClockInOutButton's `CLOCK_IN_ACCENT_ORANGE`).
- **Extraction status + risk + approach:** Inline. **Low risk — Stage A first.** Move the predicates/formatters to `src/lib/clockStrip/` with tests (status merge, focused-view predicate, apply-schedule eligibility, duration math); move the localStorage codecs as pure codec + thin IO wrapper. Style constants can go to a colocated `clockStripStyles.ts` when the tables move (they're shared across S3–S6, so move them with the first table extraction, not before).

### S2 — Approve / reject / revoke engine + its modals

- **Location:** state ~879–911, reconcile effects ~963–1003 and ~936–938, handlers ~1005–1145; JSX for `ClockSessionStripActionsModal` ~2837–2855 and the inline reject-confirm dialog ~2856–2933.
- **Owned state:** `stripApproveBusy: ReadonlySet<string>`, `optimisticStripApprovedIds: ReadonlySet<string>`, `stripRejectConfirm: StripRejectClockSessionPayload | null`, `stripActionsSession: ClockSessionStripActionsPayload | null`, `stripRejectTitleId` (useId).
- **Derived memos:** `stripActionsPayload` (re-derives the actions-modal payload from live `clockedInTodayRows`, falls back to `normalizeStripActionsPayloadFallback`, self-closes if session went open), `rejectModalBusy`, `actionsModalBusy`.
- **Effects:** prune `optimisticStripApprovedIds` once refetch delivers real `approved_at`; close actions modal when the session disappears or reverts to open; Escape-key handler for the reject dialog; iOS/WebKit double-`requestAnimationFrame` `getSelection().removeAllRanges()` after long-press opens Session actions.
- **Handlers:** `handleStripSessionApprove` (lib [`approveClockSessions`](../src/lib/approveClockSessions.ts) → RPC, adds to optimistic set, `onClockSessionsMutated`), `handleStripSessionRevoke` (`window.confirm` then RPC `revoke_clock_sessions`), `requestStripSessionReject` / `requestRejectFromActionsModal` / `cancelStripSessionReject` / `performStripSessionReject` (direct UPDATE `clock_sessions` set `rejected_at`, `rejected_by = authUserId`).
- **Supabase:** `clock_sessions` (UPDATE reject), RPC `revoke_clock_sessions`, RPC via `approveClockSessions` lib. Errors surface through `onJobBidAssignError`.
- **Sub-components:** [`ClockSessionStripActionsModal`](../src/components/ClockSessionStripActionsModal.tsx) (**extracted**, 560 lines), [`ClockSessionStripApproveControl`](../src/components/ClockSessionStripApproveControl.tsx) (**extracted**, 360 lines — also exports `deriveClockSessionStripApproveStatus`). The reject-confirm dialog is **inline**.
- **External coupling:** `authUserId`, `canApproveClockSessions`, `onClockSessionsMutated`, `onJobBidAssignError`; consumed by S4 and S5 row rendering AND by the S4 focused-row filter.
- **Extraction status + risk + approach:** Inline. **Medium risk; this is the seam to build first** — `useClockSessionStripApprovals(...)` hook returning `{ optimisticStripApprovedIds, stripApproveBusy, approve, revoke, requestReject, openActions, stripActionsPayload, … }`, destructured by the strip so S4/S5 references don't change. The inline reject dialog can move to its own component verbatim at any time (props: payload, busy, onCancel, onConfirm, titleId, z-index). Modal mounting stays in the strip (opened from two tables).

### S3 — Currently In table

- **Location:** `showCurrentlyInTable` gate (`!hideCurrentlyInTable && sessions.length > 0`), JSX ~1506–1806.
- **Owned local state:** `dispatchJobCounts` + `dispatchCountUserIdsKey` memo + its load effect (gated `enableCurrentlyInDispatchIcon`; SELECT `job_schedule_blocks` `assignee_user_id, job_id` for `clockStripWorkDateResolved`, folded through [`countDistinctJobsPerAssignee`](../src/lib/currentlyInDispatchCounts.ts)); `salaryMaterializeBusyUserId` (Create-session button busy for synthetic salary rows).
- **Cross-region/shared:** `nowMs` (`useIntervalNowMs(45_000)` — shared tick with S4/S5), `prefixMap`, `shortCurrentlyInHeader` (`useMatchMedia('(max-width: 640px)')` — also drives S6 layout), `stripTopRightHeaderReserve` (S6 overlay reserve applied to this table's last header cell), modal-context callbacks `openUserReview` / `openJobDetailFromSessionEmbeds`.
- **Row logic:** synthetic-salary branch (`isSyntheticSalaryStripSession`; `todayH = max(hoursTodayByUserId, live elapsed)`; "Salary schedule" label + `onMaterializeSalarySession` Create-session link; `(s)` suffix via `shouldShowSalaryStripNameSuffix`), dispatch icon Link to `/schedule-dispatch?week=…&focusPerson=…`, name button → user-review modal, Today hours button → `onOpenStripMyTimeEditor`, `StripClockTimeMapButton` clock-in time, Job/bid column (`showJobBidColumn`) with `AssignSessionJobPopover` (unassigned → assign; assigned → change) and job-detail-modal open (v2.447 `buttonAsLinkReset` swap), bid rows still `<Link>` to `/bids?bidId=…&tab=submission-followup`.
- **Supabase:** `job_schedule_blocks` (SELECT only). Everything else via props.
- **Sub-components:** [`AssignSessionJobPopover`](../src/components/clock-sessions/AssignSessionJobPopover.tsx) (**extracted**), [`StripClockTimeMapButton`](../src/components/clock-sessions/StripClockTimeMapButton.tsx) (**extracted**).
- **Extraction status + risk + approach:** Inline. **Low-med risk — first table to extract** (after Stage A): no dependence on the S2 approve engine or the expand-mode state. Props needed: `sessions`, `hoursTodayByUserId`, `nowMs`, `prefixMap`, the modal-context callbacks (or let it consume the contexts directly — they're app-level), `onJobBidSaved`/`onJobBidAssignError`, `onOpenStripMyTimeEditor`, `onMaterializeSalarySession`, `enableCurrentlyInDispatchIcon`, `clockStripWorkDateResolved`, `showJobBidColumn`, `shortCurrentlyInHeader`, and the `stripTopRightHeaderReserve` style (S6 overlay contract). `dispatchJobCounts` + effect move with it.

### S4 — Clocked in today table

- **Location:** the `clockedInTodayRows.length === 0` / else branch, `id="clocked-in-today-section-panel"`, JSX ~1807–2287.
- **Owned local state:** `clockedInTodayTableMode: 'all' | 'missing'` (default `'missing'`), `collapsedClockedInTodayUserIds: Set<string>` (per-person detail collapse; expanded by default), `clockedInTodayExpandMode: 'collapsed' | 'unassignedPeek' | 'full'` (localStorage-persisted, three-way cycle).
- **Derived memos:** `clockedInTodayFocusedRows` (via `stripRowInFocusedClockedInView` + `optimisticStripApprovedIds` — **reads the S2 engine**), `clockedInTodayUnassignedRows`, `clockedInTodayBodyRows` (mode → row set), `clockStripOverlapByUserId` (userId → `hasIntervalOverlapToday`; **also read by S5** for the Overlap badge), `clockedInTodaySectionOpen`, `clockedInTodayVisible`, `showClockedInTodayToggle`.
- **Effects:** the `useLayoutEffect` auto-correction — when the open mode would render zero rows: `unassignedPeek` with no unassigned rows promotes to `full` + `'all'` (so the merged bar doesn't "eat" the click); otherwise snaps to `collapsed` and persists.
- **Row/detail rendering:** person row (expand chevron, user-review name button, `StripClockOverlapBadge`, copy-job-mix icon when `copyDayJobMixMode`, Today-hours `onOpenStripMyTimeEditor` button, first clock-in time) and the expanded per-session inner table: `ClockSessionStripApproveControl` (S2), in/out `StripClockTimeMapButton`s, open-session live elapsed off `nowMs`, `AssignSessionJobPopover` with `showApplyScheduleProportions` (gated `stripRowEligibleForApplyScheduleProportions(row)` + `onApplyScheduleProportionsForSession`), job-detail/bid links, memo cell.
- **Supabase:** none directly (all via S2 handlers and props).
- **External coupling:** header markup swaps under `mergeClockedInHeaderIntoJobs` (**S5 owns the merged header when this section is collapsed and jobs exist**); `citExpandModeToggle`/`citExpandModeTitleButton` (S6) mutate this region's state; `stripTopRightHeaderReserve` applied to its last header/body cells.
- **Extraction status + risk + approach:** Inline. **Med-high risk.** Extract only after the S2 hook exists; receive the engine + `nowMs` + `clockStripOverlapByUserId`… actually `clockStripOverlapByUserId` should move to whichever module both tables import from (it derives purely from `clockedInTodayRows`; Stage-A it). The expand-mode state can move with the table **only if** S5's merged header and S6's toggles receive it as controlled props — simplest is: expand-mode state stays in the strip parent, passed down (it is read by S4, S5, and S6).

### S5 — Jobs worked today table

- **Location:** `jobsWorkedTodayRows.length > 0` gate, `id="jobs-worked-today-section-panel"`, JSX ~2288–2834.
- **Owned local state:** `jobsWorkedTodaySectionCollapsed` (localStorage-persisted, default collapsed), `collapsedJobsWorkedTodayJobLedgerIds: Set<string>`, `stripViewingReport: ReportForView | null`.
- **Handlers:** `openJobsWorkedTodayReport(jobLedgerId, userId)` — looks up `jobsWorkedTodayReportIdByKey`, fetches RPC `list_reports_for_job_ledger`, maps through [`reportForViewFromJobLedgerRow`](../src/lib/reportForViewFromJobLedgerRow.ts), opens `ReportViewModal`.
- **Row/detail rendering:** job row (`JOBS_WORKED_TODAY_UNASSIGNED_ID` aggregate row is plain text, real jobs open `jobDetailModal`; `[ hours • people ]` inline stats; missing-report icon when `jobsWorkedTodayJobLedgerIdsWithReport` is loaded and lacks the job) and expanded per-session flex rows: `ClockSessionStripApproveControl` (S2), per-person report-view icon (`jobsWorkedTodayReportKeys`), Overlap badge via S4's `clockStripOverlapByUserId`, in/out map buttons, duration button → `onOpenStripMyTimeEditor`, memo.
- **The merged-header quirk:** `mergeClockedInHeaderIntoJobs` (= S4 collapsed && both sections have rows) makes **this table's header row also carry the Clocked-in-today title/chevron** (`citExpandModeToggle` / `citExpandModeTitleButton` / `jobsExpandModeTitleButton`, `wrapMergedJobsHeaderTitles` horizontal-scroll wrapper, `tableLayout: 'fixed'` + colgroup). S4 and S5 cannot be extracted as fully independent components without threading this shared header state.
- **Supabase:** RPC `list_reports_for_job_ledger` (SELECT-shaped). 
- **Sub-components:** [`JobsWorkedTodayReportIcon`](../src/components/icons/JobsWorkedTodayReportIcon.tsx) (**extracted**), [`ReportViewModal`](../src/components/ReportViewModal.tsx) (**extracted**; needs `viewerRole` from `useAuth`).
- **Extraction status + risk + approach:** Inline. **Med-high risk**, same order as S4 (after the S2 hook). Treat S4 + S5 as one cluster because of the merged header: extract them together into `clock-sessions/ClockedInTodaySection.tsx` + `clock-sessions/JobsWorkedTodaySection.tsx` with the expand/collapse state lifted to the strip parent and passed as controlled props, or extract one combined `ClockStripTodaySections` component first and split later.

### S6 — Header chrome, scope toggle, expand-mode toggles

- **Location:** `stripHeaderChromeInner` (~1249–1327), `citExpandModeToggle`/`citExpandModeTitleButton`/`jobsExpandModeTitleButton` element constants (~1329–1433), the absolute-positioned top-right bar (~1452–1505), and the `stripTopRightHeaderReserve` / `chromeOverlaysHeaderBar` / `stripTableHostWithTopBar` layout math (~1208–1248).
- **Owned local state:** `copyDayJobMixMode` (+ effect clearing `copyDayJobMixModal` when off), `scheduleDayEmailOpen`.
- **Buttons:** schedule-day-email (needs `authUserId`), copy-job-mix toggle, "Needs attention"/"Show all" (`clockedInTodayTableMode` — S4 state), "+ Add session" (`onAddClockSession`), and the team/company scope pair (`onClockStripScopeChange`).
- **Extraction status + risk + approach:** **Stays in the strip parent.** It writes S4 state, S5-adjacent modal state, and its overlay geometry (`stripTopRightHeaderReserve` clamp values) is threaded into S3, S4, and S5 header cells. Do not extract; it is the strip's equivalent of the URL router in page decompositions.

### S7 — Attached modals

`CopyDayJobMixModal` (opened from S4 rows in copy mode; `copyDayJobMixModal` state; passes `clockedInTodayRows` + `nowMs`), `ScheduleDayEmailModal` (S6; needs `authUserId`), `ReportViewModal` (S5). All three are **already extracted components**; only their open-state and mounting live here. They stay mounted at strip level (opened from table rows / chrome).

---

## ClockInOutButton — region dossiers

### Props contract

`userId`, `userName`, `onOpenMyTimeDayEditor?`, `onClockInSuccess?`, `onFieldReportSaved?`. Contexts: `useAuth` (`authUser`, `role`), `useLedgerDisplayPrefixes`, `useToastContext`, `useDailyGoalsGate` (`notifyFirstClockInOfDay`), `useUpdateFocusOpenerBridge` (`registerUpdateFocusOpener`, `registerUpdateFocusApplyDirect` — the Job Mode bridge).

### B1 — Session data core + salary sync (stays in parent)

- **Location:** state ~163–168 + 223, `fetchSessions` ~287–367, effects ~369–417.
- **State:** `openSession: OpenSession | null`, `todaySessions: TodaySession[]`, `totalSecondsToday`, `loading`, `actionLoading`, `error`, `salaryUiActive`.
- **Handlers/effects:** `fetchSessions` (two parallel `clock_sessions` SELECTs: newest open non-rejected/non-revoked row `.is('clocked_out_at', null).is('rejected_at', null).is('revoked_at', null)`, and all rows for `work_date = denverCalendarDayKey(now)`; partial-failure error join); `salaryUiActive` detection effect (SELECT `people_pay_config.is_salary` by **`person_name = userName`** + `salary_work_schedule_templates` by `user_id` — both must hit); 90 s interval calling [`syncSalaryClockSessionsForUserDay`](../src/lib/salaryScheduleSync.ts) (RPC `sync_salary_clock_sessions_for_user_day`) then `fetchSessions`; 1 s ticker recomputing `totalSecondsToday` via `computeTotalSecondsToday` while anything is open/present.
- **Supabase:** `clock_sessions` (SELECT), `people_pay_config` (SELECT), `salary_work_schedule_templates` (SELECT), RPC via `syncSalaryClockSessionsForUserDay`.
- **Extraction status:** **Stays.** Could later become `useClockSessionCore(userId, userName)` but that is optional; every other region depends on it.

### B2 — Association picker substrate (the seam)

- **Location:** state ~191–229 and 191–212 memos, `parseLastJobBidFromStorage` ~231–279 + restore effect ~281–285, quick-picks effect ~471–562, debounced search effect ~630–675, service-types/role effect ~677–729, render helpers `renderScheduledDispatchPicks` ~1276, `renderWorkingBoardBidPicks` ~1349, `renderUseLastJobBidShortcut` ~1440, `renderUnifiedJobBidSearchRow` ~1496, plus the **three near-identical inline search-result dropdowns** (one per modal, ~45 lines each).
- **State:** `unifiedSearchText`/`unifiedSearchResults`, `selectedAssociation: UnifiedSearchResult | null`, `associationChipFromSearch`, `serviceTypes`, `enabledBidServiceTypeIds`, `subcontractorServiceTypeIds`, `lastSelectedJobBid`, `assignedJobsListLoading`, `scheduledDispatchJobs: DispatchScheduledJobForAssign[]`, `workingBoardBidPicks: WorkingBoardClockBidPick[]`; refs `assignedJobsShownRef`, `assignedJobsFetchGenRef`, `noAssignedJobsInfoToastShownRef`, `unifiedSearchTextRef`, `lastDefaultUnifiedResultsRef`, `showToastRef` (**toast-loop fix: `showToast` deliberately excluded from the quick-picks effect deps — see the in-file comment at ~552**).
- **Derived memos:** `useLastHiddenBySchedule` (hide "Use last" when it's already a dispatch pick), `showUpdateFocusAssociationChip` (chip only for associations not in the pick lists).
- **Effects:** quick-picks loader — gated on any of the four modal flags; generation-counter cancellation; `scheduleYmd` = `openSession.work_date` for clock-out/tally paths else today; `Promise.all` of RPC `list_assigned_jobs_for_dashboard` + [`fetchDispatchScheduledJobsForAssigneeDay`](../src/lib/jobScheduleBlocks.ts) + [`fetchWorkingBoardClockBidPicks`](../src/lib/fetchWorkingBoardClockBidPicks.ts); filters assigned jobs already on the dispatch schedule; one-shot "No quick picks" info toast. 300 ms debounced unified search — RPC `search_jobs_ledger` + RPC `search_bids_for_clock` (params via [`buildClockBidsSearchParams`](../src/lib/clockBidsSearchParams.ts)); on cleared text restores `lastDefaultUnifiedResultsRef` (the `assignedJobsShownRef` dance). Service-types/role loader — `service_types` SELECT + `users` row (`estimator_service_type_ids`, `primary_service_type_ids`, `subcontractor_service_type_ids`, `helpers_service_type_ids` via [`fieldRoleServiceTypeIdsForUser`/`isSubcontractorLikeRole`](../src/lib/subcontractorLikeRole.ts)); keeps prior toggle selections that survive the filter. `openSession` hydration effect (~757–856, fires for update-focus/clock-out): SELECT `jobs_ledger` (with `service_types(name)`) or `bids` (+ `customers.name`) to rebuild `selectedAssociation`.
- **localStorage:** `clock_in_last_job_bid_${userId}` (written on every successful punch that had an association; parsed defensively by `parseLastJobBidFromStorage`).
- **Supabase:** `service_types`, `users`, `jobs_ledger`, `bids`, `customers` (SELECT); RPCs `list_assigned_jobs_for_dashboard`, `search_jobs_ledger`, `search_bids_for_clock`.
- **Sub-components:** [`BidServiceTypeSearchToggles`](../src/components/BidServiceTypeSearchToggles.tsx) (**extracted**); pick lists and dropdowns **inline**.
- **Extraction status + risk + approach:** Inline. **Medium risk, highest value — build this seam first.** `src/hooks/useClockAssociationPicker.ts` owning the state/refs/effects above, plus one shared component `clock-sessions/ClockAssociationPickerPanel.tsx` that renders chip + dispatch picks + bid picks + search row + results dropdown + use-last (styles vary by `useLastLike: 'clockIn' | 'updateFocus' | 'clockOutReview'` — keep that prop). This deletes the three duplicated dropdown blocks (~150 lines) and unblocks B3–B5.

### B3 — Clock In modal

- **Location:** open/reset/focus/scroll-lock effects ~419–461, `handleOpenClockInModal` ~883, `handleCompleteClockIn` ~888–944, JSX ~1678–1839.
- **Owned state:** `clockInModalOpen`, `clockInNotes`, `clockInError`, `clockInNotesRef`; uses shared `actionLoading` (B1).
- **Handler:** `handleCompleteClockIn` — requires notes; INSERT `clock_sessions` (`work_date = denverCalendarDayKey`, job/bid from `selectedAssociation`) wrapped in `withOperationTimeout(…, CLOCK_PUNCH_TIMEOUT_MS = 15000, 'Clock in')`; `scheduleClockInLocationPatch` ([`patchClockPunchSessionLocations`](../src/lib/patchClockPunchSessionLocations.ts) — fire-and-forget geo patch); persists last job/bid; `Promise.all([fetchSessions(), notifyFirstClockInOfDay(workDate, userId)])`; `onClockInSuccess`. Timeout copy: "may or may not have saved" (request not cancelled).
- **Supabase:** `clock_sessions` (INSERT).
- **Extraction status + risk + approach:** Inline. **Low-med risk — first modal out** once B2's panel exists. Props: picker hook slice, `actionLoading`, `onComplete` (or move `handleCompleteClockIn` with it and inject `fetchSessions`/`notifyFirstClockInOfDay`/`onClockInSuccess`). The dedicated body-scroll-lock effect for this modal moves with it (there is a second, separate scroll-lock effect for the other three overlays — keep both as-is).

### B4 — Update Focus modal + Job Mode bridge

- **Location:** effects ~463–469, 731–736; `handleOpenUpdateFocusModal` ~1086; bridge registrations ~1093–1096 and 1200–1203; `applyUpdateFocusDirectImpl` ~1102–1198; `handleUpdateFocus` ~1205–1274; JSX ~1840–1991.
- **Owned state:** `updateFocusModalOpen`, `updateFocusNotes`, `updateFocusError`, `updateFocusLoading`, `updateFocusNotesRef`.
- **Handlers:** `handleUpdateFocus` — salaried: UPDATE job/bid/notes in place on `openSession` (times unchanged); hourly: UPDATE `clocked_out_at` on the open row then INSERT a new row, `scheduleUpdateFocusLocationPatches(closedId, newSessionId)`, `notifyFirstClockInOfDay`, `onClockInSuccess`. `applyUpdateFocusDirectImpl(opts)` — the **no-modal Job Mode variant** (v2.545): clock-in when nothing open / in-place for salaried / close-and-insert for hourly; registered on [`UpdateFocusOpenerBridgeContext`](../src/contexts/UpdateFocusOpenerBridgeContext.tsx) so `DashboardJobModeCard` and Job Detail can drive punches without this component's modals.
- **Supabase:** `clock_sessions` (UPDATE + INSERT).
- **Extraction status + risk + approach:** Inline. **Medium risk.** The modal JSX + its state can move once B2 exists; **the two bridge registrations and `applyUpdateFocusDirectImpl` stay in the parent** (they need B1 and must survive the modal being closed). `UPDATE_FOCUS_OVERLAY_Z_INDEX = 1020` (above DetailJobModal backdrop 1004) moves with the modal.

### B5 — Clock Out flow (tally gate → review → missing reports → feedback)

- **Location:** tally state ~185–190, gate `handleClockOutClick` ~980–1027 + `refreshTallyPreClockOutUnlinked` ~958 + `handleContinueFromTallyPreClockOut` ~975; review `openClockOutReviewModalOnly` ~946, `handleCompleteClockOutReview` ~1029–1084, Escape/focus effects ~738–755; missing-reports effect ~568–628 (+ reset ~564); JSX: `TallyPreClockOutModal` ~1992–2001, review modal ~2002–2217, `AdditionalReportModal` ~2218–2239, `TeamFeedbackWizard` ~2240–2245.
- **Owned state:** `clockOutReviewOpen`, `clockOutReviewNotes`, `clockOutReviewError`, `clockOutSaving`, `clockOutNotesRef`, `tallyPreClockOutOpen`, `clockOutTallyGateLoading`, `tallyPreUnlinkedRows`, `tallyPreRecentJobs`, `tallyPreLinkedDebitCards`, `tallyMinPostedYmdRef`, `clockOutLeaveReportJob`, `scheduledJobsMissingReport`, `missingReportsCheckLoading`, `scheduledMissingReportsNonce`, `missingReportsFetchGenRef`, `teamFeedbackOpen`.
- **Handlers:** `handleClockOutClick` — gate loads `app_settings` (`APP_SETTINGS_KEY_JOB_TALLY_MIN_POSTED_YMD` → [`normalizeJobTallyMinPostedYmd`](../src/lib/appSettingsKeys.ts)), RPC `list_my_linked_mercury_transactions_for_tally` (filtered by [`filterTallyRowsToUnlinkedWithOptionalMinPosted`](../src/lib/mercuryTxRowFromTally.ts)), RPC `list_my_linked_mercury_debit_cards_for_tally`, [`fetchRecentClockJobPicksForUser`](../src/lib/fetchRecentClockJobPicksForUser.ts); unlinked rows → `TallyPreClockOutModal`, else straight to review; on gate failure warns and continues. `handleCompleteClockOutReview` — UPDATE `clock_sessions` (notes, job/bid, `clocked_out_at`) with the 15 s timeout, `scheduleClockOutLocationPatch`, persists last job/bid, then `getTeamFeedbackEligibility(userId)` ([`teamFeedback`](../src/lib/teamFeedback.ts)) → `TeamFeedbackWizard`. Missing-reports effect — gated `canLeaveJobFieldReport(role)`; SELECT `reports` (`created_by_user_id`, `.in('job_ledger_id', dispatch jobIds)`), buckets by `denverCalendarDayKey(created_at)` vs `scheduleYmd` (= `openSession.work_date`), renders red pick buttons that open `AdditionalReportModal`; `scheduledMissingReportsNonce` re-runs it after a save.
- **Supabase:** `clock_sessions` (UPDATE), `app_settings`, `reports` (SELECT); RPCs `list_my_linked_mercury_transactions_for_tally`, `list_my_linked_mercury_debit_cards_for_tally`.
- **Sub-components:** [`TallyPreClockOutModal`](../src/components/tally/TallyPreClockOutModal.tsx), [`AdditionalReportModal`](../src/components/AdditionalReportModal.tsx) (overlayZIndex 1100), [`CrewReviewDeck`](../src/components/team-feedback/CrewReviewDeck.tsx) (v2.2824, was `TeamFeedbackWizard`) — all **extracted**; the review modal is **inline**.
- **External coupling:** `salaryUiActive` short-circuits the whole flow (salaried users have no Clock Out button); `onFieldReportSaved` prop.
- **Extraction status + risk + approach:** Inline. **Med-high risk — extract last** among the button's modals. It touches B1, B2, the schedule snapshot (`scheduledDispatchJobs` from B2 is captured by the missing-reports effect), and four attached modals. Suggested shape: `clock-sessions/ClockOutReviewModal.tsx` (review JSX + missing-reports section + its effect) with the tally-gate orchestration (`handleClockOutClick`) staying in the parent as the entry point.

### B6 — Button row + My Time preview

- **Location:** ~1540–1674 (`loading` early return, `canClockIn`, `myTimePreviewButton`, `topRowContent`).
- **Behavior:** open session → red `formatElapsed(totalSecondsToday) — Clock Out` (hidden when `salaryUiActive`) + blue Update Focus; no session and salaried → only the My Time preview clock icon; otherwise orange Clock In (+ preview icon when `todaySessions` exist). All buttons disable on any of `actionLoading || updateFocusLoading || clockOutSaving || clockOutTallyGateLoading`.
- **Extraction status:** stays with the parent; it is the component.

---

## Stage-A pure-logic inventory (extract to `src/lib/*` + tests before any component moves)

| Candidate | Currently | Target |
|---|---|---|
| `stripApproveStatusForSession` + `stripSessionIsPendingApprovalMerged` + `stripRowHasPendingApprovalMerged` | module-level in strip | `lib/clockStrip/stripApproveStatus.ts` + tests (open/approved/optimistic matrix) |
| `stripRowInFocusedClockedInView` + `stripRowHasUnassignedSession` + `stripRowHasClosedSalaryScheduleNoOpenSession` | module-level in strip | `lib/clockStrip/stripFocusedView.ts` + tests (split-salary-day rule) |
| `stripRowEligibleForApplyScheduleProportions` | module-level in strip | same lib + test (exactly-one closed unassigned) |
| `sessionDurationSeconds` / `formatDurationFromSeconds` / `formatElapsedOpen` / `formatHoursH` | module-level in strip (duplicates hook math intentionally) | `lib/clockStrip/stripDurations.ts` + tests; have the hook import it to end the duplication **without changing the math** |
| `stripActionsPayloadFromSession` + `normalizeStripActionsPayloadFallback` + `findTodaySessionInStrip` | module-level in strip | `lib/clockStrip/stripActionsPayload.ts` + tests (href building, embed fallbacks) |
| expand-mode codec (`isClockedInTodayExpandMode`, `cycleClockedInTodayExpandMode`, legacy-key migration in `readClockedInTodayExpandMode`) | module-level in strip | pure codec in `lib/clockStrip/expandModePersistence.ts` + tests; localStorage IO stays a thin wrapper |
| `clockStripOverlapByUserId` derivation | `useMemo` in strip | pure `overlapByUserId(rows)` (needed by both S4 and S5 after the split) |
| `parseLastJobBidFromStorage` | function **inside** ClockInOutButton body | `lib/clockSessions/parseLastJobBid.ts` + tests (malformed JSON, missing fields, both shapes) |
| `computeTotalSecondsToday` + `formatElapsed` | module-level in button | `lib/clockSessions/clockDurations.ts` + tests |
| `dispatchScheduledJobToUnified` | module-level in button | move alongside `unifiedJobBidSearch` types + test |
| role → service-type filter block (estimator/primary/field branches in the B2 service-types effect) | inline in effect | pure `filterServiceTypesForUser(types, me)` + tests |
| missing-reports bucketing (rows → `jobsWithReportToday` set → filter) | inline in effect | pure `scheduledJobsMissingReportFor(rows, dispatchJobs, scheduleYmd)` + tests |
| Already in `lib/` (verify tests exist, don't re-extract) | — | `approveClockSessions`, `countDistinctJobsPerAssignee`, `reportForViewFromJobLedgerRow`, `buildClockBidsSearchParams`, `filterTallyRowsToUnlinkedWithOptionalMinPosted`, `normalizeJobTallyMinPostedYmd`, `fetchDispatchScheduledJobsForAssigneeDay`, `fetchWorkingBoardClockBidPicks`, `fetchRecentClockJobPicksForUser`, `patchClockPunchSessionLocations`, `salaryScheduleSync`, `canLeaveJobFieldReport`, `getTeamFeedbackEligibility`, and the `types/clockSessions.ts` label formatters |

---

## Preserve-quirks list (odd but load-bearing — do not "fix" during the move)

1. **`showToast` via ref only** in the B2 quick-picks effect — the in-file comment (~line 552) records a render loop when `showToast` was a dep. Keep `showToastRef` and the one-shot `noAssignedJobsInfoToastShownRef`.
2. **Optimistic approve is one source of truth for two behaviors**: `optimisticStripApprovedIds` drives both the approve-badge state AND the "Needs attention" filter (an optimistic approve removes the row). The pruning effect only deletes an id once the refetched row has a real `approved_at` (or vanished).
3. **`useLayoutEffect` expand-mode auto-correction**: `unassignedPeek` with zero unassigned rows promotes to `full` + `clockedInTodayTableMode='all'` (never snaps back to collapsed — "merged bar would eat the click"); other empty-body cases snap to `collapsed` and persist.
4. **Merged header** (`mergeClockedInHeaderIntoJobs`): when Clocked-in-today is collapsed and jobs exist, the Jobs table's header hosts both section titles and only ONE chevron sits in column 1 (whose it is depends on `jobsWorkedTodaySectionCollapsed`). Both `citExpandModeToggle` and `citExpandModeTitleButton` carry `id="clocked-in-today-section-toggle"` — only one renders at a time.
5. **`CLOCK_PUNCH_TIMEOUT_MS = 15000` with non-cancelling timeout**: punch requests are wrapped in `withOperationTimeout` but NOT aborted; error copy must keep saying the punch "may or may not have saved" (v2.1063 hang class).
6. **Two separate body-scroll-lock effects** in the button (one for `clockInModalOpen`, one for the other three overlays) — identical code, deliberate; each moves with its modal.
7. **`salaryUiActive` semantics**: requires BOTH `people_pay_config.is_salary` (matched by **`person_name`**, not user id) AND a `salary_work_schedule_templates` row. When true: no Clock Out button, Update Focus edits the open row in place, and a 90 s `sync_salary_clock_sessions_for_user_day` interval runs. Dashboard duplicates this rule (comment at Dashboard.tsx ~410).
8. **`work_date` is Denver** (`denverCalendarDayKey`) throughout the client while the salary sync cron keys on America/Chicago (see `SALARY_CLOCK_SESSIONS.md`) — do not harmonize during a move.
9. **Clock-out/tally `scheduleYmd` uses `openSession.work_date`**, not today — overnight open sessions must gate against the session's day.
10. **The `assignedJobsShownRef` / `lastDefaultUnifiedResultsRef` dance**: clearing the search box first swallows one debounce tick (quick picks already showing), then restores the cached default quick-pick results. Generation counters (`assignedJobsFetchGenRef`, `missingReportsFetchGenRef`) are incremented in effect cleanup to cancel in-flight loads.
11. **localStorage keys** (do not rename): `dashboard_clock_strip_clocked_in_today_expand_mode` (+ legacy `dashboard_clock_strip_clocked_in_today_collapsed` read-migration), `dashboard_clock_strip_jobs_worked_today_collapsed`, `clock_in_last_job_bid_${userId}`.
12. **Z-index ladders**: strip 1100/1150/1170/1280 (`STRIP_POPOVER_Z`…`STRIP_REJECT_MODAL_Z`); button 1000 (clock-in/clock-out), `UPDATE_FOCUS_OVERLAY_Z_INDEX = 1020` (above DetailJobModal's 1004), AdditionalReportModal 1100.
13. **Sessions may have empty `id`** (synthetic/salary edge rows): row keys fall back to `s.id || \`${s.user_id}-…\`` and `ClockSessionStripApproveControl` renders only when `s.id` is truthy. `ClockSessionStripApproveControl` is passed a no-op `onReject={async () => {}}` — rejection flows only through the actions modal.
14. **`handleStripSessionRevoke` uses `window.confirm`** (not a styled modal); reject uses the styled `STRIP_REJECT_MODAL_Z` dialog.
15. **iOS/WebKit selection-clearing effect** (double `requestAnimationFrame` + `removeAllRanges`) after opening Session actions, plus the `stripSessionActionsRowChromeNoSelect` user-select suppression on dense rows.
16. **Synthetic salary "Today" hours** take `Math.max(hoursTodayByUserId, live elapsed)`; the "Create session" link calls `onMaterializeSalarySession(userId)` and is busy-guarded per user (`salaryMaterializeBusyUserId`).
17. **`#fefcfb` hardcoded background on the Clock In modal** (and literal accent hexes `#ff6600`/`#dc2626`/`#3b82f6`): saturated action colors are exempt from theme tokenization per CLAUDE.md — leave them.
18. **`dispatchCountUserIdsKey`** is a sorted comma-joined user-id string used as the effect dep (set-identity trick) — keep it or replace with an equivalent identity-stable key, not the raw array.

---

## Recommended extraction order (value ÷ risk)

**The two components are independent; interleave freely. What must stay put:** the strip's props contract and its hosts' wiring (Dashboard ×2, `PeopleHoursDashboardClockStrip`, Quickfill) are untouched by all of this; `useDashboardMyTeamSectionState` is out of scope; S6 header chrome, B1 session core, B6 button row, and the `UpdateFocusOpenerBridgeContext` registrations + `applyUpdateFocusDirectImpl` never leave their parents; all shared modals stay mounted at the parent level.

1. **Stage A sweep** ([inventory above](#stage-a-pure-logic-inventory-extract-to-srclib--tests-before-any-component-moves)) — every item independently shippable. Highest leverage: `stripApproveStatus` + `stripFocusedView` (they encode the strip's business rules), `parseLastJobBid`, the service-type role filter.
2. **Strip: reject-confirm dialog → `clock-sessions/StripRejectClockSessionDialog.tsx`** — verbatim move, tiny prop surface, validates the strip's component seam.
3. **Strip: approve engine seam → `src/hooks/useClockSessionStripApprovals.ts`** (S2). Parent destructures; S4/S5 references unchanged.
4. **Strip: Currently In table → `clock-sessions/ClockStripCurrentlyInTable.tsx`** (S3) — no dependence on the approve engine; `dispatchJobCounts` moves with it.
5. **Strip: S4 + S5 as a cluster** — lift expand/collapse state decisions to the parent (or extract combined first, split later); both consume the S2 hook + `nowMs` + `overlapByUserId` via props. This leaves the strip file as: props plumbing + S2 hook call + S6 chrome + section wrappers + modals (~600–800 lines).
6. **Button: association-picker seam → `src/hooks/useClockAssociationPicker.ts` + `clock-sessions/ClockAssociationPickerPanel.tsx`** (B2) — kills the three duplicated dropdowns; the biggest single de-duplication on either file.
7. **Button: Clock In modal → component** (B3), then **Update Focus modal** (B4, bridge stays behind), then **Clock Out review modal** (B5, tally-gate orchestration stays behind).

Verification gates, definition of done, and anti-patterns: [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) (`npm run typecheck && npm run lint && npm test` green after every step; behavior-preserving only).
