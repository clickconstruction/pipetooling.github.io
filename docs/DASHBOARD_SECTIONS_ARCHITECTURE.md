# Dashboard Sections Architecture Map

---
file: docs/DASHBOARD_SECTIONS_ARCHITECTURE.md
type: Engineering / Refactor Map
purpose: Step-0 map for the Dashboard.tsx decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md) — inventory what every role-gated section of src/pages/Dashboard.tsx touches (state, loaders, handlers, sub-components, supabase tables/RPCs, realtime, cross-section coupling) to drive the multi-PR extraction.
audience: Developers, AI Agents
last_updated: 2026-07-17
---

## Overview

[`src/pages/Dashboard.tsx`](../src/pages/Dashboard.tsx) is an ~8,899-line "God component" (as of v2.715: 132 `useState` mentions / ~57 state declarations, 47 `useEffect`, 21 `useMemo`, 28 `useCallback`). This map follows the process in [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) and the format of [`BIDS_TABS_ARCHITECTURE.md`](./BIDS_TABS_ARCHITECTURE.md) / [`PEOPLE_TABS_ARCHITECTURE.md`](./PEOPLE_TABS_ARCHITECTURE.md).

### Key structural differences from Bids/People

1. **Dashboard is NOT tab-switched.** There is no `activeTab`, no `?tab=` URL router, and no shared selection pointer. It is a **role-gated stack of sections** rendered top to bottom; every section's render gate is a role/data predicate, and everything mounts at once. Where the playbook says "tab", read "section". (Like People, only *data* is shared — there is no cross-section UI selection to lift.)
2. **Role-variant rendering.** The same section can render in *different positions per role*, and two big blocks are **literal duplicated copies** per role branch (see [Duplicated-render quirks](#duplicated-render-quirks-preserve-dont-fix)). The role sets: `assistant`/`controller` (via `isAssistantLike`), `dev`/`master_technician`, `subcontractor`/`helpers` (via `isSubcontractorLikeRole`), `estimator`, `primary`, `superintendent`.
3. **Job Mode replaces the top of the page.** When `useJobModeEnabled` is on, an early `return` renders only the banner/pins block + `DashboardJobModeCard` until the user taps "Show full dashboard" (`jobModeShowFullDashboard`, resets each page load).
4. **The file layout is loader-block then JSX-block.** Module helpers at lines ~165–870; all state/effects/handlers inside `Dashboard()` at ~872–4395; JSX from `quickActionDefs` (~4397) to the end. No state is declared below ~1500 except via hooks.

### How to read a dossier

Each section lists: render location (anchored by symbol/heading — line numbers are "as of v2.715" and rot), **owned local state** (moves with the section), **cross-section/shared state** (stays in the parent), **derived memos**, **handlers**, **data dependencies / supabase tables + RPCs / realtime**, **sub-components** (extracted vs inline), **external coupling**, and **extraction status + risk + suggested approach** (Stage A = pure logic → `lib/*` + tests first; Stage B = component move).

### How to maintain this doc

- Update the relevant dossier whenever a section is extracted or its state/handlers change; flip its Status and point at the new file.
- Treat line numbers as approximate anchors — search for the symbol (`showMyInboxCard`, the h2 text, the state name) when in doubt.

---

## Master summary table

Sections in order of first JSX appearance in the main return (Job Mode variant first since it's an early return).

| # | Section | Anchor symbol / heading | Status | Owned state | Coupling | Risk | Recommended action |
|---|---|---|---|---|---|---|---|
| 0 | Job Mode variant | `jobModeEnabled && !jobModeShowFullDashboard` early return (~4591) | mostly extracted (`DashboardJobModeCard`) | 2 (`jobModeShowFullDashboard`, `turnawayJob`) | low (shares `leaveReportJob`, banners block) | low | Leave in parent; it's the page-level role fork |
| 1 | Section dock | `dockSections` / `SectionDock` (~4657/5204) | extracted component; config inline | 0 (derived array) | reads every section's visibility gate | low | Stays in parent permanently (spans sections) |
| 2 | Financial notifications | `DashboardFinancialsSection` (~5206) | extracted | 0 | none | none | Done |
| 3 | Banners + tally + quick actions + pins | [`DashboardPinnedQuickRow`](../src/components/dashboard/DashboardPinnedQuickRow.tsx) (×2 positions) | **extracted (v2.723)** | 0 in parent beyond `pinnedRoutes` + quick-button state (both shared — see dossier) | low (parent passes visiblePins + quickActionDefs + financial totals; `renderModals={false}` at the Job Mode mount) | — | Done (tally counts, lost-bids count, banner hooks, NewReportModal + staff follow-up modal moved with the block) |
| 4 | Clock-in button + contract prompt + team feedback | `ClockInOutButton` (~5217) | components extracted; glue inline | ~7 | med (`hoursDaysCorrectSet`, `stripMyTimeEditor`, salary flags) | med | Extract contract-prompt glue into a hook; keep button wiring in parent |
| 5 | Clocked-In strip cluster | `DashboardTeamActiveClockStrip` (×2, ~5266/5716) + `DashboardMyTeamPendingBanner` (×2) + `DashboardMyTimeDayEditorModal` (~5758) | components extracted; orchestration inline | ~5 + 6 memos | **high** (`myTeam` hook shared with My Team section; `hoursDaysCorrectSet` shared with My Time/ClockInOut) | high | Extract `DashboardClockStripCluster` taking `myTeam` as prop; `myTeam` stays in parent |
| 6 | My Inbox (checklist) | [`DashboardMyInboxCard`](../src/components/dashboard/DashboardMyInboxCard.tsx) (one element, ×3 role positions) | **extracted (v2.722)** | 0 in parent beyond `myInboxDockVisible` (today-checklist seed lives in `useDashboardBoot`) | low (parent passes boot outputs + `getCurrentUserName`; dock gate reported up via callback) | — | Done (checklist CRUD engine + fwd/mute modals moved with the card) |
| 7 | Teams Inbox | [`DashboardTeamsInboxCard`](../src/components/dashboard/DashboardTeamsInboxCard.tsx) (×2 positions) | **extracted (v2.719)** | 0 in parent beyond `dispatchDismissedModalOpen`/`tripChargeTarget` (modals render once, outside the branches) | low (parent passes both inbox engines + modal openers) | — | Done (inline estimator engine replaced by `useEstimatorInbox`; duplicate render collapsed) |
| 8 | Billing Pipeline (field queue + Ready to Bill + Billed) | `BillingPipelineCard` (×2, ~5362/5867); h2 "Ready to Bill" ~5381/5886; h2 "Billed Waiting for Payment" ~5597/6102 | inline ×2 (~350 lines each, duplicated) | ~18 | **very high** (invoice engine feeds field queue, modals, assigned-jobs resync) | high | Build `useDashboardBillingInvoices` seam first; then one `DashboardBillingPipelineSection` rendered in both role branches |
| 9 | My Schedule | h2 "My Schedule" (~6238) | inline (~250 lines) | ~6 | med (reads `assignedJobs`/`assignedReadyToBillJobs` for labels; shared leave-report/detail modals) | med | Stage A `dedupeSubScheduleBlocks` (module) + partition → lib; Stage B component with callbacks |
| 10 | My Bids | [`DashboardMyBidsSection`](../src/components/dashboard/DashboardMyBidsSection.tsx) | **extracted (v2.718)** | 0 | none (parent passes `authUserId` + `role` + `isMobile`; dock gate's data half reported up via callback) | — | Done |
| 11 | Recent Reports | [`DashboardRecentReportsSection`](../src/components/dashboard/DashboardRecentReportsSection.tsx) | **extracted (v2.717)** | 0 | none (parent passes `authUserId` + `role`; `showRecent` stays in parent for the dock) | — | Done |
| 12 | Team Ready to Bill (assigned RTB jobs) | h2 "Ready to Bill (`assignedReadyToBillJobs.length`)" (~7490) | inline (~295 lines) | ~4 | med (job-row family; shared modals) | med | Extract with the job-row family (Stage A row helpers first) |
| 13 | Assigned Jobs | `DashboardGroupCard title="Assigned Jobs"` (~7779) | inline (~260 lines) | 2 | med (writes `readyForBillingJob`; shared modals; `updateJobStatus` refreshes it) | med | Extract with the job-row family |
| 14 | Upcoming inspection | [`DashboardUpcomingInspectionsSection`](../src/components/dashboard/DashboardUpcomingInspectionsSection.tsx) | **extracted (v2.716)** | 0 | none (parent passes `role` + `inspectionsButtonVisible`) | — | Done |
| 15 | Superintendent Jobs | h2 "Superintendent Jobs" (~8108) | inline (~150 lines) | 3 | med (dedupes against `assignedJobs`; shared modals) | med | Extract with the job-row family |
| 16 | Projects (Assigned + Subscribed Stages) | [`DashboardProjectsCard`](../src/components/dashboard/DashboardProjectsCard.tsx) | **extracted (v2.721)** | 0 in parent (step data lives in `useDashboardBoot`) | low (parent passes boot outputs + `getCurrentUserName`; visibility gates stay parent-side for the dock) | — | Done (action engine + 3 step modals moved with the card) |
| 17 | My Team | `DashboardMyTeamSection` (lazy, ~8515) | extracted | 0 (hook in parent) | high (shares `myTeam` with strip cluster) | n/a | Done; `myTeam` hook stays in parent |
| 18 | Me / My Time | `id="dash-me"` / `DashboardMyTimeSection` (~8525) | extracted | 0 | low (`hoursDaysCorrectSet`, `dashboardSelfIsSalary` props) | n/a | Done |
| 19 | Modal tail | `ApplyScheduleApprovedConfirmModal` → send-back job modal (~8532–8896) | mixed | (owned by opener sections) | shared modals opened from 2+ sections stay | — | Inline confirm modals (Send to Billing, send-back ×2, fwd; reject/skip/set-start moved with the Projects card v2.721) extract as components; openers stay in parent |

> Status legend: `inline` = rendered directly in `Dashboard.tsx`; `partial` = major children extracted but section state/JSX still inline; `extracted` = section is a thin wrapper around an imported component.

---

## Role-gating model

Cross-checked against [`src/lib/canLeaveJobFieldReport.ts`](../src/lib/canLeaveJobFieldReport.ts), [`src/lib/subcontractorLikeRole.ts`](../src/lib/subcontractorLikeRole.ts) (`isAssistantLike` = `assistant | controller`; `isSubcontractorLikeRole` = `subcontractor | helpers`), and the role path Sets at the module top (`SUBCONTRACTOR_PATHS` / `PRIMARY_PATHS` / `SUPERINTENDENT_PATHS`, ~753–755, used only by `filterPinnedByRole` — estimator's path set is built inline in `getAllowedPathsForRole` and adds `/prospects` when `estimatorProspectsAccess`).

| Section | dev | master_technician | assistant/controller | estimator | primary | superintendent | subcontractor/helpers |
|---|---|---|---|---|---|---|---|
| Job Mode variant | per-user `useJobModeEnabled` flag (any role) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Financials (`showFinancials`) | ✓ | ✓ | ✓ | — | — | — | — |
| Quick action buttons (`showDashboardQuickButtons`) | ✓ | ✓ | ✓ (Builder Review button master_technician-only) | — | — | — | — |
| Banners: AR bank | `canRoleSeeArBankUnallocatedDashboardBanner(role)` | | | | | | |
| Banners: Tally stale (self) / tally icon+Job Report row | any signed-in role (`role != null`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Banners: Tally stale staff / staff follow-up modal | ✓ | ✓ | ✓ | — | — | — | — |
| Banners: Lost bids missing reason | any role with own lost bids (query filters by estimator/AM id) | | | | | | |
| Clocked-In strip | any role when `showClockActivityStrip`; scope toggle (`showClockStripScopeToggle`) dev/master/assistant-like only; strip My-Time editor also superintendent | | | | | | |
| My Team pending banner | ✓ (below strip) | ✓ (below strip) | ✓ (below strip, assistant branch) | — | — | — | — |
| My Inbox card (`showMyInboxCard`) | ✓ (+ Recently Completed, dev-only) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (position differs per role branch) |
| Teams Inbox | eligibility-driven: `dispatchInboxEligible` (hook) / `estimatorInboxEligible` (dev or `estimator_group_members`); `HelpFeedbackInboxSection` dev-only | | | | | | |
| Billing Pipeline | ✓ (copy 2) | ✓ (copy 2) | ✓ (copy 1) | — | — | — | — |
| My Schedule | — | — | — | — | — | — | ✓ |
| My Bids | ✓ | ✓ | ✓ | ✓ | ✓ | — (gate excludes superintendent despite loader including it — see quirks) | — |
| Recent Reports (`showRecent`) | ✓ | ✓ | ✓ | — | ✓ | — | — |
| Team Ready to Bill (`isDashboardTeamReadyToBillRole`) | — | — | — | ✓ | ✓ | ✓ | ✓ |
| Assigned Jobs | any role with rows from `list_assigned_jobs_for_dashboard` (RPC scopes rows); "Send to Billing" hidden for helpers | | | | | | |
| Upcoming inspection | ✓ | ✓ | ✓ | — | ✓ | — | — (also hidden when the `inspections` quick button is toggled off) |
| Superintendent Jobs | — | — | — | — | — | ✓ | — |
| Projects: Assigned Stages | any role with assigned steps (by user *name*) | | | | | | |
| Projects: Subscribed Stages (`showSubscribed`) | ✓ | ✓ | ✓ | — | — | — | — |
| My Team / My Time sections | any signed-in user | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Leave Report buttons (`canLeaveJobFieldReport`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (everyone but role=null) |
| Collect Payment button | — | — | — | — | — | — | ✓ (Team RTB rows) |

---

## Per-section dossiers

### 0. Job Mode variant (early return)

- **Render location:** gate `if (jobModeEnabled && !jobModeShowFullDashboard && authUser?.id)` (~4591–4653). Renders `tallyAndPinnedBlock` + `DashboardJobModeCard` + "Show full dashboard" button + its own `AdditionalReportModal` (`leaveReportJob`) + `TurnawayModal` (`turnawayJob`).
- **Owned local state:** `jobModeShowFullDashboard` (~1186, resets each load — the gear-menu toggle is the persistent setting), `turnawayJob` (~1181 — **only settable/renderable in this branch**).
- **Cross-section/shared state:** `leaveReportJob` (shared with My Schedule / job-row sections), `refreshDashboardAssignedJobLists`, the whole `tallyAndPinnedBlock`.
- **Data deps / supabase:** `useJobModeEnabled(authUser.id)`; `DashboardJobModeCard` self-loads its data.
- **Sub-components:** `DashboardJobModeCard`, `TurnawayModal`, `AdditionalReportModal` (all extracted).
- **Extraction status + approach:** Mostly extracted already. **Stays in the parent** — it is the page-level fork. As of v2.723 the branch renders `<DashboardPinnedQuickRow {...pinnedQuickRowSharedProps} renderModals={false} />` instead of the old `tallyAndPinnedBlock` const (~60 lines total). Note: because the block is now a component, flipping "Show full dashboard" remounts it (its tally/lost-bids counts reload); previously those counts lived in the parent and survived the toggle.

### 1. Section dock

- **Render location:** `dockSections` array (~4657–4681) + `<SectionDock>` (~5204). Anchor divs (`dash-notifications`, `dash-clocked-in`, `dash-my-inbox`, `dash-teams-inbox`, `dash-billing`, `dash-bids`, `dash-reports`, `dash-projects`, `dash-me`) are sprinkled through the JSX with `dockAnchorStyle` (`scrollMarginTop: 8`).
- **Owned state:** none — each entry's `visible` mirrors its section's render gate (`showFinancials`, `showClockActivityStrip`, `showMyInboxCard`, inbox eligibility, billing role gate, My Bids gate, `showRecent`, `projectsCardVisible`, `authUser`).
- **Extraction status + approach:** `SectionDock` is extracted. The config **must stay in the parent** (it reads every gate). As sections extract, keep the anchor `id`s stable — several live *inside* what will become child components (`dash-bids`, `dash-reports` are on the section's own wrapper div; the rest are sibling anchor divs the parent keeps).

### 2. Financial notifications

- **Render location:** `{showFinancials && <DashboardFinancialsSection />}` (~5206).
- **Owned state:** none in parent. Fully self-contained component.
- **Extraction status:** **Done.**

### 3. Banners + tally icon + Job Report + quick actions + pins row

- **Status: extracted (v2.723)** → [`DashboardPinnedQuickRow.tsx`](../src/components/dashboard/DashboardPinnedQuickRow.tsx), mounted at **both** positions the old `tallyAndPinnedBlock` const rendered (the Job Mode early return and the main return — via a shared `pinnedQuickRowSharedProps` object); Stage-A kernel [`dashboardPinnedRow.ts`](../src/lib/dashboardPinnedRow.ts) (18 tests): the role path Sets + `getAllowedPathsForRole`/`filterPinnedByRole` (moved from Dashboard's module scope — the parent now imports `filterPinnedByRole` from the kernel, the single source), `filterPinsToShow` (the /dashboard + '/' + Materials external-team exclusions), the pin chip route/label calc `getPinnedChipDisplay` (Internal Team / Billed Awaiting Payment / Supply Houses / Sub Labor Due live-total labels + the billed→stages and sub-labor→sub_sheet_ledger link rules), and `getTallyLinkAccessibleName`.
- **What moved:** `tallyUnlinkedCount`/`tallyStaleUnlinkedCount` + `loadTallyUnlinkedCount`/`loadTallyStaleUnlinkedCount` (RPCs `count_unlinked_mercury_transactions_for_tally[_stale]`) + their initial-load and focus-refresh effects; `tallyStaffFollowUpModalOpen` + `useStaleTallyStaffFollowUp`; `arBankCountEnabled` + `useArBankUnallocatedCount`; the lost-bids missing-reason count state + loader effect; `newReportModalOpen`; the derived `pinsToShow`/`showPinnedRowWithQuickActions`/`tallyLinkAccessibleName` + `pinnedItemLinkStyle`; the whole block JSX (six banners, tally icon + badge, "Job Report" button, with-pins quick chips, pins row); and the two tail modals `NewReportModal` + `DashboardStaleTallyStaffFollowUpModal` (their only openers are in the block; both are fixed overlays so the earlier DOM position is inert). The component calls `useNavigate()` and `useToastContext()` itself. **Modals quirk preserved via `renderModals` prop:** the tail modals never rendered in the Job Mode early return (the Job Report button and staff-banner opener were inert there) — the Job Mode mount passes `renderModals={false}`.
- **What stayed in the parent (and why):** `pinnedRoutes` + `refreshPinned` + the pins-changed/focus/visibility listener effect (it also bumps `financialRefreshKey`) and the `visiblePins` derivation, because the `has*Pin` flags derived from `visiblePins` enable the parent-side financial machinery; `financialRefreshKey` + `financialPinsRealtimeTimerRef` + `scheduleFinancialPinsRefreshFromRealtime` + the `dashboard-financial-pins` realtime channel on `jobs_ledger_invoices`; the five financial pin total hooks (`useWeeklyTeamLaborTotal`, `useBilledTotal`, `useHoursAwaitingApprovalCount`, `useSupplyHousesAPTotal`, `useSubLaborDueTotal`) — their totals pass down as props; and the whole quick-button state cluster — `dashboardButtonVisibility` + its `user_dashboard_buttons` loader, `quickButtonsPlacement` + its `user_dashboard_preferences` loader, `showDashboardQuickButtons`, `quickActionDefs`, `quickActionLinkStyle`, and the top-placement quick-buttons render (it sits between Financials and ClockInOutButton, outside the block) — because `dashboardButtonVisibility?.inspections` also gates the **Upcoming inspection** section (quirk #9, untouched) and the top placement renders at a different page position. `quickActionDefs`/`quickButtonsPlacement`/`showDashboardQuickButtons` pass down as props.
- **Supabase / realtime:** component-side — RPCs `count_unlinked_mercury_transactions_for_tally[_stale]`, `bids` (lost-reason count), banner hooks' tables; parent-side — `user_dashboard_buttons`, `user_dashboard_preferences`, `user_pinned_tabs` (via lib), realtime `dashboard-financial-pins`.
- **Sub-components (render inside the card now):** `DashboardArBankUnallocatedBanner`, `DashboardTallyStaleBanner`, `DashboardTallyStaleStaffBanner`, `DashboardLostBidsMissingReasonBanner`, `DashboardBulkDeleteAlertBanner` (self-gating), `DashboardClaimDevAttemptsBanner` (self-gating), `NewReportModal`, `DashboardStaleTallyStaffFollowUpModal`.
- **Known consequence (accepted):** the block is now a component, so toggling Job Mode's "Show full dashboard" remounts it and its counts reload; previously the counts lived in the parent and survived the toggle.

### 4. Clock-in button + contract-signing prompt + team feedback

- **Render location:** `ClockInOutButton` (~5217), quick-feedback button + `TeamFeedbackWizard` (~5226–5254), `DashboardContractSigningPromptModal` (~5255).
- **Owned local state:** `userName` (~1215, also feeds `clockDisplayName` memo), `dashboardSelfIsSalary` (~1220), `dashboardSalaryScheduleClockActive` (~1222), `teamFeedbackHomeEnabled`/`teamFeedbackWizardOpen` (~1294–1295), `contractSigningPromptOpen`/`Rows`/`OpeningId` + `contractSigningVisitPromptEpochRef` (~1296–1302).
- **Cross-section/shared state:** `clockDisplayName` (userName from the boot loader); `hoursDaysCorrectSet` + `stripSalariedUserIds` + `setStripMyTimeEditor` (strip cluster) — `openMyTimePreviewFromClock` (~1279) opens the *shared* day-editor modal; `dashboardSelfIsSalary` also passed to `DashboardMyTimeSection`; `refreshDashboardAssignedJobLists` on field-report save.
- **Handlers:** `fetchContractDashboardPromptRows` (RPC `list_my_contract_dashboard_prompts`), `runContractSigningPromptFromRpc`, `handleClockInSuccessContractPrompt`, `openContractSigningPageForDoc` (edge fn `get-contract-signing-link-for-self`), salaried-visit prompt effect (~1328, epoch-guarded against Strict Mode).
- **Supabase:** `people_pay_config` (self is_salary ×2), `salary_work_schedule_templates`; `fetchTeamFeedbackSettings` lib.
- **Sub-components (extracted):** `ClockInOutButton`, `TeamFeedbackWizard`, `DashboardContractSigningPromptModal`.
- **Extraction status + risk + approach:** Components extracted; glue inline. **Medium.** Stage A: none needed. Stage B: a `useContractSigningPrompt` hook (rows/open/openingId + the RPC + edge-fn opener + visit-prompt effect) is the clean seam; team-feedback state can move into a tiny wrapper. `ClockInOutButton` wiring stays in the parent (touches strip + assigned-jobs refresh).

### 5. Clocked-In strip cluster

- **Render location:** rendered **twice** with identical props: assistant branch (~5262–5306) and non-assistant branch (~5712–5756); `DashboardMyTeamPendingBanner` follows each (assistant-like, then dev/master). The shared `DashboardMyTimeDayEditorModal` (`stripMyTimeEditor`) at ~5757–5787.
- **Owned local state:** `clockStripScope` (~886, localStorage-backed), `stripSalariedUserIds` (~973), `stripMyTimeEditor` (~1018), plus derived flags `showClockStripScopeToggle`/`showStripSubjectMyTimeEditor`/`pendingClockBannerAtMyTeamTop`/`orgWideStripEnabled` (~881–908).
- **Cross-section/shared state:** **`myTeam` = `useDashboardMyTeamSectionState(...)`** (~909) — the page's biggest shared engine (1,464-line hook), also consumed by `DashboardMyTeamSection` (~8515) and the pending banners; `applySchedule` = `useApplyScheduleProportions` (+ `ApplyScheduleApprovedConfirmModal` in the tail); `hoursDaysCorrectSet` + `hoursDaysCorrectRange` (~989–1016, `fetchHoursDaysCorrectWorkDates`) — also read by `openMyTimePreviewFromClock` and passed to `DashboardMyTimeSection`.
- **Derived memos:** `sessionsForStrip` (~928, merges real open sessions + synthetic salary sessions, sorted by name), `hoursTodayForStrip` (~952), `showClockActivityStrip` (~959), `stripPayGateUserIds` (~964).
- **Handlers:** `setClockStripScopePersist` (~889), scope-default effect (~897), `openStripMyTimeEditor` (~1025, blocks on `hoursDaysCorrectSet` with `HOURS_DAY_CORRECT_BLOCK_TOAST`), `openMyTimePreviewFromClock` (~1279), `materializeSalarySessionForStrip` (~1451, `syncSalaryClockSessionsForUserDay`), `handleStripMarkNotComingIn` (~1462, `recordNotComingInForUserAsStaff`), `goToPendingSessionsInMyTeam` (~917, scrolls to `dashboard-my-team-pending-sessions`), `reloadMyTeamPendingSilent`.
- **Supabase:** via libs/hook — `clock_sessions` etc. inside `useDashboardMyTeamSectionState`; `fetchSalariedUserIdSetFromUserIds` (`people_pay_config`); `hours_days_correct` via `fetchHoursDaysCorrectWorkDates`.
- **Sub-components (extracted):** `DashboardTeamActiveClockStrip` (2,865 lines), `DashboardMyTeamPendingBanner`, `DashboardMyTimeDayEditorModal`.
- **External coupling:** localStorage `dashboard_clock_strip_scope` (via `lib/dashboardClockStripScopeStorage`); scroll-anchor into the lazy `DashboardMyTeamSection`.
- **Extraction status + risk + approach:** Components extracted; ~250 lines of orchestration inline. **High risk** — `myTeam` is shared. Approach: extract a `DashboardClockStripCluster` component that receives `myTeam`, `applySchedule.requestApply`, and the correctness/salary sets as props (the two role-branch renders collapse into one component used twice, or one render once the branch ordering is unified — preserve ordering for now). **`myTeam`, `applySchedule`, `hoursDaysCorrectSet`, and `stripMyTimeEditor` stay in the parent** (`stripMyTimeEditor` is also opened by `ClockInOutButton`'s preview).

### 6. My Inbox (Due Today / Overdue / Recently Completed)

- **Status: extracted (v2.722)** → [`DashboardMyInboxCard.tsx`](../src/components/dashboard/DashboardMyInboxCard.tsx); Stage-A kernel [`dashboardMyInbox.ts`](../src/lib/dashboardMyInbox.ts) (the Overdue "T-days" helpers `getDaysUntilDue`/`formatTDays`, 10 tests; `getDaysUntilDue` takes `today` as a parameter defaulting to `new Date()` so tests are deterministic and the call site is unchanged).
- **What moved:** all card-local state — checklist display (`outstandingItems`/`outstandingLoading`, in-flight refs `checklistToggleInFlightRef`/`outstandingToggleInFlightRef`), dev Recently Completed (`completedItemsOpen`/`completedItems`/`completedItemsLoading`/`completedItemsUserMap`, `readInstanceIds`, `ignoredItemIds`, `ignoredSectionOpen`, `ignoringItemId`, `expandedCompleterIds`, `markingReadId`/`markingUnreadId`), and modal state (`muteModalItemId`/`muteModalTitle`, `fwdInstance`/`fwdTitle`/`fwdAssigneeId`/`fwdSaving`, `sendTaskUsers`) — plus the checklist CRUD engine (`loadTodayChecklist`, `loadOutstanding`, optimistic `toggleChecklistComplete`/`toggleOutstandingComplete`, `saveFwd`, `sendChecklistCompletionNotifications` — edge fn `send-checklist-notification`, `maybeCreateNextChecklistInstance` — days_after_completion repeat, `markCompletedItemAsRead/Unread`, `ignoreTaskType`/`unignoreTaskType`, `isNotificationRecipient`, `openMuteModal`, `openFwd`) with its three load effects, the whole card JSX (the `dash-my-inbox` dock anchor is the card's own `id`), the Forward modal JSX, and the `ChecklistItemMuteModal` wiring (both modals — previously in the page tail — now render from the component; both are fixed overlays, so DOM position is inert). The component calls `useToastContext()` itself and derives `isDev` from the `role` prop (effect deps unchanged). Imports that moved with it: `ChecklistTitleWithLinks`, `ChecklistSkeleton`, `getNextDisplayOrders`; `toLocalDateString` now comes from `lib/dailyGoalsGate` (byte-identical to the module copy the move orphaned in `Dashboard.tsx`, since deleted — same source the boot hook and inspections section use).
- **What stayed in the parent:** the [`useDashboardBoot`](../src/hooks/useDashboardBoot.ts) seam — `todayChecklist` + `setTodayChecklist`, `checklistLoading`, `userLoading`, `setUserError` are destructured in the parent and passed as props (the CRUD engine mutates via the setters; the `{userError && …}` display stays at its old spot in the parent flow); `getCurrentUserName` (also passed into `DashboardProjectsCard`) passed down as a prop for the completion notifications; `isDev`/role usages elsewhere on the page. **Dock-gate seam:** the whole `showChecklist`/`showRecentlyCompleted`/`showMyInboxCard` derivation moved into the child (its outstanding/completed halves are child state; its boot half comes in as props) — the child self-gates the card render on it and reports it up via `onVisibleChange` into parent state `myInboxDockVisible` (initialized `true`, matching the gate's loading-state first paint), which the SectionDock entry reads. Same pattern as `DashboardMyBidsSection.onContentVisibleChange`, minus a parent-side role half (My Inbox shows for every role).
- **Quirks preserved:** #4 — the parent still builds ONE `myInboxCard` element (now `<DashboardMyInboxCard/>`) and mounts it at the same three role positions; the gates are mutually exclusive and exhaustive, so exactly one copy always mounts (the component must always mount for its loaders to drive the dock gate). #13 — Recently Completed corner link only when `completedItems.length > 0`; its unread count filters ignored task types first, then unread.
- **Supabase:** `checklist_instances`, `checklist_items`, `checklist_item_assignees` (display order), `checklist_instance_assignees`, `dev_read_completed_items`, `dev_ignored_checklist_items`, `users`; edge fn `send-checklist-notification`; today-checklist boot stays with the hook (`lib/dashboardBootQueries` + `lib/dashboardBootCache`).

### 7. Teams Inbox

- **Status: extracted (v2.719)** → [`DashboardTeamsInboxCard.tsx`](../src/components/dashboard/DashboardTeamsInboxCard.tsx), rendered at **both** role positions (assistant branch and non-assistant branch — quirk #2's positions preserved; the mutually exclusive role gates mean only one copy mounts). No Stage-A kernel — the win was deduplication, not new pure logic.
- **What moved:** the entire inline estimator engine (~10 state vars + ref, eligibility effect, `loadEstimatorRequests`/`loadEstimatorNotesForRequest`, expand/submit/submit-and-close/dismiss handlers, both realtime channels) was **deleted and replaced by the existing [`useEstimatorInbox`](../src/hooks/useEstimatorInbox.ts) hook** it duplicated — a line-by-line parity check found it byte-identical to the hook except channel names (`dashboard-estimator-*` vs the hook's `checklist-estimator-*` — client-side identifiers; Dashboard and Checklist are separate routes so the names never coexist) and comments. The two ~50-line card JSX copies collapsed into the one component, parameterized by the branches' two real differences: `showHelpFeedback` (`false` at the assistant position, `isDev` at the non-assistant one) and `onCreateTripCharge` (always passed at the assistant position; gated to dev/master at the non-assistant one). The card owns the two section open/closed toggles (`dispatchRequestsOpen`, `estimatorRequestsOpen` — single-consumer).
- **What stayed in the parent:** both engines — `useDispatchInbox` and `useEstimatorInbox` are called in `Dashboard.tsx` (the SectionDock entry + the card render gates read the eligibility flags; `DispatchDismissedItemsModal` needs `fetchDismissedDispatchInboxRows`) and passed down whole as `dispatchInbox`/`estimatorInbox` props. `dispatchDismissedModalOpen` + `DispatchDismissedItemsModal` and `tripChargeTarget` + `CreateTripChargeModal` also stay (rendered once, outside both branch positions); the card receives `onOpenDismissedArchive`/`onCreateTripCharge` openers. Cross-section couplings `jobFormModal` (link-job-pictures) and `refreshInvoicesRef` (trip charge created → billing refresh) stay as before, wired through callbacks/the modal's `onCreated`.
- **Supabase / realtime (estimator, now via the hook):** `estimator_group_members`, `estimator_requests`, `estimator_request_dismissals`, `estimator_request_notes`, RPC `estimator_inbox_note_stats`; realtime channels `checklist-estimator-requests` + `checklist-estimator-request-notes` (shared names with `ChecklistReviewInboxes`, never co-mounted).
- **Sub-components:** `DispatchInboxSection`, `EstimatorInboxSection`, `HelpFeedbackInboxSection` (self-contained, dev-only) now render inside the card; `DispatchDismissedItemsModal`, `CreateTripChargeModal` remain parent-side.

### 8. Billing Pipeline (field collect queue + Ready to Bill + Billed Waiting for Payment)

- **Render location:** **two literal copies** of the whole `BillingPipelineCard`: assistant branch (~5362–5709) and dev/master branch (~5866–6214). Stage 1 = `DashboardFieldCollectPaymentQueue` (embedded, self-loading); Stage 2 = h2 "Ready to Bill (`readyToBillDashboardUnits.length`)" (~5381 / ~5886); Stage 3 = h2 "Billed Waiting for Payment" (~5597 / ~6102).
- **Owned local state (~18):** `readyToBillInvoices`/`readyToBillJobs`/`readyToBillLoading` (~1137–1139), `waitingForPaymentInvoices`/`Jobs`/`Loading` (~1144–1146), `readyToBillExpanded`/`waitingForPaymentExpanded` (~1117–1118), `invoiceStatusUpdatingId`/`jobStatusUpdatingId` (~1167–1168), mutation-lock refs (`dashboardInvoiceMutationLockRef`, `dashboardJobStatusMutationLockRef`, `dashboardInvoiceSendBackConfirmLockRef`, `resyncDashboardAfterUpdateJobStatusFailureRef`), modal states `sendRecordJobMeta`, `markPaidJob`, `markPaidInvoice`, `sendBackJob`, `sendBackInvoice`, `sendBackChecked`, `sendBackStatusEventLine`, `sendBackInvoiceStripeExplainerAfterFailure`.
- **Cross-section/shared state:** `viewReportsJob` (also written by Team RTB/Assigned/Superintendent rows); `readyForBillingJob` confirm modal reuses `moveJobToReadyToBillWithStripePrep`/`updateJobStatus` but is *opened* from the Assigned/Superintendent sections; `updateJobStatus` reloads the three assigned-job lists; `shouldShowPrepareBillForFieldQueue`/`handlePrepareBillFromFieldQueue` feed the field queue; `refreshInvoicesRef` is called by trip-charge, job-edit-saved, and detail-modal callbacks.
- **Derived memos:** `readyToBillDashboardUnits` (~1140, via tested lib [`buildReadyToBillDashboardUnits`](../src/lib/buildReadyToBillDashboardUnits.ts)), `billedWaitingDashboardUnits` (~1147, via **inline** `buildBilledWaitingDashboardUnits` ~406), `fieldQueueCombinedBillInvoices` (~1151), `readyToBillDetailModalAssignedRows` (~2857).
- **Handlers:** `updateJobStatus` (~2971, RPC `update_job_status`, optimistic prune + 3-RPC reload), `moveJobToReadyToBillWithStripePrep` (~3018), `refreshInvoices` (~3036), `openReadyToBillEditJob` (~3088), `openReadyToBillDetailJobModal` (~3169), `openDashboardBillCustomerInvoice` (~3258), `handlePrepareBillFromFieldQueue` (~3276), `revertBilledDashboardInvoiceToReadyToBill` (~3307), `deleteInvoice` (~3379), send-back status-event effect (~3407), `sendRecordJobMeta` job-fetch effect (~3185).
- **Supabase / RPCs:** `jobs_ledger_invoices` (via `DASHBOARD_INVOICES_JOBS_LEDGER_SELECT` ~267), `jobs_ledger_payments`, `jobs_ledger`, `job_status_events`; RPCs `get_jobs_ledger_by_status`, `update_job_status`, `delete_billed_invoice_on_send_back`, `delete_ready_to_bill_invoice`. Edge/stripe via `lib/voidStripeInvoiceForRevert` (`invokeVoidStripeInvoiceForRevert`, `prepareBilledInvoicesBeforeJobRevertToReadyToBill`, `ensureLedgerInvoiceRemovedAfterStripeSendBack`, `invoiceNeedsStripeVoidForRevert`, `stripeModeForBillingFromRole`) + `syncJobToReadyToBillIfNoBilledInvoicesRemain`, `wouldEnsureNothingLeftToBillForJob`, `updateJobStatusClientFeedback`.
- **Sub-components:** `BillingPipelineCard`/`BillingPipelineStage`, `DashboardFieldCollectPaymentQueue` (947 lines, self-loading), `ReadyToBillJobIconToolbar` (module-level, ~803), `BilledPaymentConfirmationModal` ×2 (tail); the card rows are inline JSX (duplicated).
- **External coupling:** `useBillCustomerModal`, `useJobFormModal`, `useJobDetailModal`, `useSendBackCollectPaymentFlowNotice` (extracted hook feeding the send-back modal notice).
- **Extraction status + risk + approach:** Inline ×2. **Highest coupling on the page — extract last.** Stage A first: move `buildBilledWaitingDashboardUnits`, `buildPaymentsByInvoiceIdMap`, `mapJoinedInvoiceToDashboard`, `dashboardBilledInvoiceAmounts`, `dashboardInvoiceToPaymentModal`, `jobBillingFromDashboardInvoice`, `countDashboardRtbDraftsForJob`, `dashboardJobHasCustomerForBilling` (~270–430, all pure) into `lib/dashboard/billingInvoiceUnits.ts` + tests. Then build the **`useDashboardBillingInvoices` seam** (invoices/jobs state + loaders + `refreshInvoices` + `updateJobStatus` + delete/revert + locks + updating ids), leaving send-back/mark-paid modal state in the parent (opened from both copies). Finally one `DashboardBillingPipelineSection` component rendered in both role branches (preserve position/order per branch).

### 9. My Schedule (subcontractor-like)

- **Render location:** gate `isSubcontractorLikeRole(role)`, h2 "My Schedule" (~6238), block ~6218–6466.
- **Owned local state:** `subScheduleRows`/`subScheduleLoading` (~1132–1133), `subScheduleLabels` (~1134), `subSchedulePhones` (~1135), `scheduleReminderNow` (~1136, 60s interval effect ~2665).
- **Cross-section/shared state:** reads `assignedJobs` + `assignedReadyToBillJobs` (labels, pictures link, leave-report reminder); writes `leaveReportJob` (shared modal); `submitLinkJobPicturesDispatchRequest` (~3095, also used by Team RTB rows via `DashboardJobPicturesLinkRow`); `jobDetailModal` + `detailModalAssignedJobsRows` (~2837); `firstAssistantDispatchPhone` hook (call-dispatch links).
- **Derived memos:** `subScheduleDayPartition` (~2796, today/tomorrow buckets), `leaveReportReminderForJobRow` (~2807, via tested lib `shouldShowLeaveReportScheduleReminder` — **also used by Assigned Jobs + Team RTB rows**).
- **Handlers/loaders:** schedule-blocks effect (~2670, `fetchScheduleBlocksForAssigneeDateRange` from `lib/jobScheduleBlocks` — gate is `canLeaveJobFieldReport(role)` but loading-spinner + rendering only for subcontractor-like; the rows also power the leave-report reminder for other roles), labels effect (~2702), phones effect (~2763).
- **Supabase:** `job_schedule_blocks` (via lib), `jobs_ledger` (labels + phones).
- **Sub-components:** `DashboardJobPicturesLinkRow` + `DashboardLeaveReportButton` (module-level, ~533/~457); rest inline.
- **Extraction status + risk + approach:** Inline. **Medium.** Note the subtlety: `subScheduleRows` is loaded for *every* `canLeaveJobFieldReport` role because `leaveReportReminderForJobRow` (used by the job-row sections) depends on it — so the **loader stays in the parent** (or moves to a `useDashboardSubSchedule` hook), while the *render* extracts to `DashboardMyScheduleSection`. Stage A: `dedupeSubScheduleBlocks` (~785, pure module fn) → lib + test when touched.

### 10. My Bids

- **Status: extracted (v2.718)** → [`DashboardMyBidsSection.tsx`](../src/components/dashboard/DashboardMyBidsSection.tsx); Stage-A kernel [`dashboardMyBids.ts`](../src/lib/dashboardMyBids.ts) (unread-flag computation `isMyBidStreamUnread`, "from others" bucketing/sorting `bucketMyBidSubmissionsFromOthers`/`bucketMyBidCustomerContactsFromOthers`, `collectMyBidNoteAuthorIds`, `buildMyBidRows`, `myBidRolesForUser`, formatters `formatRelativeCompactAgo`/`formatMyBidPreviewDate`/`truncateMyBidNotePreview`, and the `MY_BID_OTHERS_VISIBLE_STEP`/`MY_BIDS_DASHBOARD_ROW_LIMIT` consts + `MyBidRow` types — 17 tests; `formatRelativeCompactAgo` takes `now` as a parameter for determinism, defaulting to `new Date()`).
- **What moved:** all ~10 state vars (`myBids`/`myBidsLoading`, `hiddenBidIds` + the `dashboard_my_bids_hidden_${uid}` localStorage hydration, `hiddenBidsExpanded`, `sentBidsExpanded`, `myBidsSectionExpanded` + `myBidsPrimaryCollapseAppliedRef` + the primary-collapse effect, `myBidOthersVisibleLimits` + prune effect, `myBidOthersNoteDetailsOpen`), the big loader effect (bids + read-state + submission entries + customer contacts + author names), `hideBid`/`unhideBid`, `markMyBidNotesReadAsViewed` (`upsertBidNotesReadWatermark`), `adjustMyBidOthersLimit`, `toggleMyBidOthersNoteDetails`, the `myBidsVisibleCount` memo, and the ~680-line render block including the `dash-bids` dock-anchor wrapper. The component calls `useBidPreview()` and `useToastContext()` itself (both were single-consumer in the parent for this section).
- **What stayed in the parent:** the SectionDock entry — its role half is derived in the parent as before; its data half (`myBidsLoading || myBids.some(not hidden)`) now lives in the child and is reported up via the `onContentVisibleChange` callback into parent state `myBidsDockHasContent`. Parent renders `<DashboardMyBidsSection authUserId role isMobile onContentVisibleChange />` unconditionally; the component self-gates on role.
- **Quirks preserved:** the loader's access check includes `superintendent` while the render gate and dock entry exclude it (superintendents fetch bids that never display); `myBidsSectionExpanded` initializes from `role` at first render AND keeps the one-shot primary-collapse effect.
- **Supabase:** `bids` (estimator/AM filter, non-lost, `MY_BIDS_DASHBOARD_ROW_LIMIT` 50), `user_bid_notes_read_state`, `bids_submission_entries`, `customer_contacts`, `users`, `service_types` (join).

### 11. Recent Reports

- **Status: extracted (v2.717)** → [`DashboardRecentReportsSection.tsx`](../src/components/dashboard/DashboardRecentReportsSection.tsx); Stage-A kernel [`dashboardRecentReports.ts`](../src/lib/dashboardRecentReports.ts) (`recentReportsUnreadCount` + `recentReportsVisibleRows`, 8 tests — the three overlapping inline filter expressions now share one definition).
- **What moved:** all ~11 state vars (incl. the hide-on-refresh localStorage hydration + `pipetooling_dashboard_hide_on_refresh_ids` key), the `report_enabled_users` check, the loader + `loadRecentReportsRef`, the `dashboard-reports-changes` realtime channel, the unread→all auto-switch and persist effects, the render block (with the `dash-reports` dock anchor on its wrapper), and the **dead `ReportEditModal` wiring, moved wholesale unchanged** (quirk #6 — still openable by nothing).
- **What stayed in the parent:** `newReportModalOpen` + `NewReportModal` (opened from the banner block's "Job Report" button) and the `showRecent` derivation (the SectionDock entry reads it). Parent renders `<DashboardRecentReportsSection authUserId role />` unconditionally; the component self-gates on role.
- **Supabase / realtime:** RPC `list_reports_with_job_info`, `report_reads`, `report_enabled_users`; realtime `dashboard-reports-changes` on `reports`.

### 12. Team Ready to Bill (assigned RTB jobs, field roles)

- **Render location:** gate `isDashboardTeamReadyToBillRole(role)` (module fn ~603: subcontractor/helpers/primary/superintendent/estimator), h2 "Ready to Bill (`assignedReadyToBillJobs.length`)" (~7490), block ~7481–7775. **This is a third, distinct "Ready to Bill"** — team-assigned jobs via RPC, not the billing-invoice pipeline.
- **Owned local state:** `assignedReadyToBillJobs`/`Loading`/`Expanded` (~1121–1123), `collectPaymentJob` (~1187, modal in tail).
- **Cross-section/shared state:** writes `viewReportsJob`, `leaveReportJob`, `subcontractorJobActivityModalJob`; `openJobDetailFromDashboardJobRow` (~2842) + `detailModalAssignedJobsRows`; `leaveReportReminderForJobRow` (needs `subScheduleRows`); `submitLinkJobPicturesDispatchRequest`; `refreshAssignedReadyToBill` (~2897, also called by `CollectPaymentModal.onFlowChanged`); rows feed My Schedule labels.
- **Handlers/loaders:** loader effect (~2870, RPC `list_ready_to_bill_assigned_jobs_for_dashboard`), `refreshAssignedReadyToBill`.
- **Supabase:** RPC `list_ready_to_bill_assigned_jobs_for_dashboard`; `dispatch_requests` insert + edge `notify-dispatch-request` (via the shared pictures-request helper).
- **Sub-components:** module-level `DashboardJobPicturesLinkRow`, `DashboardLeaveReportButton`; `CollectPaymentModal` (tail, subcontractor-like only opener); pure helpers `subcontractorLastActivityBlock`/`TypeLine`/`subcontractorAssignedJobStageDisplay` (~517–695) + tested libs `subcontractorJobActivityCopy`/`subcontractorLastActivityCompact`.
- **Extraction status + risk + approach:** Inline. **Medium.** Extract together with Assigned Jobs + Superintendent Jobs (the "job-row family") after Stage A of the row helpers (`formatTimeSince`, `subcontractorLastActivity*` → `lib/dashboard/jobRowActivity.ts` + tests). Shared modal openers stay in the parent as callbacks.

### 13. Assigned Jobs

- **Render location:** `DashboardGroupCard title="Assigned Jobs (…)"` (~7779), block ~7778–8037.
- **Owned local state:** `assignedJobs`/`assignedJobsLoading` (~1119–1120).
- **Cross-section/shared state:** writes `viewReportsJob`, `leaveReportJob`, `subcontractorJobActivityModalJob`, **`readyForBillingJob` + `readyForBillingChecked1/2`** (Send-to-Billing confirm modal, shared with Superintendent Jobs; confirm runs `moveJobToReadyToBillWithStripePrep` from the billing engine); `assignedJobs` is read by My Schedule (labels/reminders), `detailModalAssignedJobsRows`, Superintendent-Jobs dedupe, and reloaded by `updateJobStatus`/`refreshDashboardAssignedJobLists`/`resyncDashboardAfterUpdateJobStatusFailureRef`.
- **Handlers/loaders:** loader effect (~2653, RPC `list_assigned_jobs_for_dashboard`), `refreshDashboardAssignedJobLists` (~2819, reloads all three job lists; also triggered by report modals + ClockInOutButton field-report save).
- **Supabase:** RPC `list_assigned_jobs_for_dashboard`.
- **Sub-components:** row family helpers as in section 12; "Send to Billing" hidden for `helpers`.
- **Extraction status + risk + approach:** Inline. **Medium.** The *data* (list + loaders) should live in a `useDashboardAssignedJobs` hook (all three lists + `refreshDashboardAssignedJobLists` + the resync ref) because the billing engine mutates them; the *render* then extracts cleanly.

### 14. Upcoming inspection

- **Status: extracted (v2.716)** → [`DashboardUpcomingInspectionsSection.tsx`](../src/components/dashboard/DashboardUpcomingInspectionsSection.tsx); Stage-A kernel [`dashboardUpcomingInspections.ts`](../src/lib/dashboardUpcomingInspections.ts) (date-line formatting, 6 tests).
- **What stayed in the parent:** only the thin wrapper — parent passes `authUserId`, `role`, and `inspectionsButtonVisible` (`dashboardButtonVisibility?.inspections !== false`, the hidden coupling with section 3). The component takes `role` (not a precomputed gate) so the loader's effect deps stay `[authUserId, role]`, preserving the quirk that the loader runs on role alone while the button flag gates render only.
- **Note:** the component imports `toLocalDateString` from `lib/dailyGoalsGate` (byte-identical to Dashboard's module-level copy, which remains for its 3 other call sites — dedupe candidate when the banner block extracts).
- **Supabase:** `inspections` (today..+2 days).

### 15. Superintendent Jobs

- **Render location:** gate `role === 'superintendent'`, h2 "Superintendent Jobs" (~8108), block ~8099–8251. Rows are `superintendentJobs` **minus** any id already in `assignedJobs`.
- **Owned local state:** `superintendentJobs`/`Loading`/`Expanded` (~1124–1126).
- **Cross-section/shared state:** dedupes against `assignedJobs`; writes `viewReportsJob` + `readyForBillingJob`; reloaded by `updateJobStatus`/`refreshDashboardAssignedJobLists`.
- **Handlers/loaders:** loader effect (~2906, RPC `list_superintendent_jobs_for_dashboard`).
- **Extraction status + risk + approach:** Inline. **Medium**, part of the job-row family; goes into `useDashboardAssignedJobs` + a row component.

### 16. Projects (Assigned Stages + Subscribed Stages)

- **Status: extracted (v2.721)** → [`DashboardProjectsCard.tsx`](../src/components/dashboard/DashboardProjectsCard.tsx); Stage-A kernel [`dashboardProjectsCard.ts`](../src/lib/dashboardProjectsCard.ts) (`formatDatetime` / `daysOpen` / `personDisplay`, 13 tests). `formatDatetime` is shared with the subcontractor last-activity job-row helpers, so `Dashboard.tsx` imports it back from the kernel; `daysOpen`/`personDisplay` were single-consumer and left the parent entirely.
- **What moved:** the whole `DashboardGroupCard id="dash-projects"` render (h3 "Assigned Stages" + `AssignedStageCard` list + Complete sub-list + h3 "Subscribed Stages" + subscribed list, incl. the `dash-projects` dock anchor on the card itself), the three reject/skip/set-start step modals with their state (`rejectStep`/`skipStep`/`setStartStep`), the expand toggles (`assignedStagesExpanded`/`assignedStagesCompleteExpanded`/`subscribedStagesExpanded`) + `assignedStagesExpandedDefaultAppliedRef` + the one-time expand-heuristic effect, the `activeAssignedSteps`/`completedAssignedSteps` memos, and the **workflow-step action engine** (`recordAction`, `findPreviousStep`/`findNextStep`, `markStarted`/`submitSetStart`, `markCompleted` — reopens rejected next step, `markApproved`, `submitReject` — reopens/notices previous step, `submitSkip`). The card calls `useToastContext()` and `useEditProjectModal()` itself (both single-consumer for this section; the parent no longer uses `useEditProjectModal`). `AssignedStageCard`, `AssignedSkeleton`/`SubscribedSkeleton`, `toDatetimeLocal`/`fromDatetimeLocal`, and `formatProjectNumberLabel` imports moved with it.
- **What stayed in the parent:** the [`useDashboardBoot`](../src/hooks/useDashboardBoot.ts) seam — `assignedSteps`/`subscribedSteps`/`assignedLoading`/`subscribedLoading`/`userLoading`/`userNames`/`loadAssignedSteps` are destructured in the parent and passed down as props; the gates `showAssigned`/`showSubscribed`/`projectsCardVisible` (the SectionDock entry reads `projectsCardVisible`; the parent wraps the card render in it and passes `showAssigned`/`showSubscribed`/`userLoading` down); `getCurrentUserName` (also used by the My Inbox checklist-completion notifications) passed down as a prop — the engine's `performed_by`/`approved_by` writes still go through it.
- **Quirks preserved:** the step modals render inside the card's conditional (quirk #14 — now internal to the component, still unrenderable when `projectsCardVisible` is false); identity is by user **name** (`get_assigned_steps_*(p_user_name)`, `performed_by`); the expand heuristic keeps its one-shot ref mechanism.
- **Supabase / RPCs:** step lists via the boot hook (RPCs `get_assigned_steps_with_projects_for_dashboard` + fallback `get_assigned_steps_for_dashboard`); the engine writes `project_workflow_steps` + `project_workflow_step_actions` and walks `project_workflows`/`projects` for prev/next-step context; `users` via the parent's `getCurrentUserName`.

### 17. My Team

- **Render location:** lazy `DashboardMyTeamSection` in `Suspense` (~8513–8521), fed `myTeam` + `pendingClockBannerAtMyTeamTop` + `goToPendingSessionsInMyTeam`.
- **Extraction status:** **Done.** The `useDashboardMyTeamSectionState` hook stays in the parent (shared with the clock strip cluster and pending banners).

### 18. Me / My Time

- **Render location:** `id="dash-me"` anchor + `DashboardMyTimeSection` (~8523–8530), props `hoursDaysCorrect={hoursDaysCorrectSet}` and `disableDayEditor={dashboardSelfIsSalary}`.
- **Extraction status:** **Done.** Parent keeps `hoursDaysCorrectSet` (shared with the strip editors) and `dashboardSelfIsSalary` (shared with ClockInOutButton wiring).

### 19. Modal tail (~8532–8896)

Shared modals that stay page-level (opened from 2+ sections) vs single-opener modals that can move with their section:

| Modal | Anchor | Opened from | Stays / moves |
|---|---|---|---|
| `ApplyScheduleApprovedConfirmModal` | ~8532 | clock strip (`applySchedule`) | stays (hook-owned) |
| `NewReportModal` | (moved v2.723) | banner block "Job Report" button | moved into `DashboardPinnedQuickRow` (`renderModals` prop) |
| `DashboardStaleTallyStaffFollowUpModal` | (moved v2.723) | staff tally banner | moved into `DashboardPinnedQuickRow` (`renderModals` prop) |
| `ReportEditModal` | ~8549 | **nothing** (dead — see quirks) | note only |
| `ChecklistItemMuteModal` | (moved v2.722) | My Inbox | moved into `DashboardMyInboxCard` |
| `JobReportsModal` (`viewReportsJob`) | ~8570 | Billing ×2, Team RTB, Assigned, Superintendent | **stays** |
| `SubcontractorJobActivityModal` | ~8583 | Team RTB + Assigned rows | stays (job-row family) |
| `AdditionalReportModal` (`leaveReportJob`) | ~8591 | My Schedule, Team RTB, Assigned, Job Mode | **stays** |
| `CollectPaymentModal` | ~8609 | Team RTB rows | stays until job-row family extracts together |
| Send-to-Billing confirm (`readyForBillingJob`, inline) | h2 "Send to Billing" ~8629 | Assigned + Superintendent rows | **stays** (uses billing engine) |
| `sendRecordJobMeta` loading overlay | ~8691 | billing + field queue | stays with billing engine |
| `BilledPaymentConfirmationModal` ×2 (job / invoice) | ~8696 / ~8718 | Billing Stage 3 | moves with billing section |
| Send-back invoice confirm (inline) | `DELETE_DRAFT_BILL_LABEL` h2 ~8733 | Billing Stages 2+3 | moves with billing section |
| Send-back job confirm (inline) | h2 "Job: Send Job Back" ~8806 | Billing Stages 2+3 | moves with billing section |

---

## Shared substrate

### Hooks already extracted (consumed by Dashboard)

| Hook | Owns | Consumed by |
|---|---|---|
| [`useDashboardMyTeamSectionState`](../src/hooks/useDashboardMyTeamSectionState.ts) (1,464 lines) | pending/org-wide clock sessions, clocked-in-today rows, jobs-worked-today, synthetic salary sessions, `loadPending` | clock strip ×2, pending banners, My Team section, strip editor callbacks — **the page's `useBidPricingEngine` analog; stays in parent** |
| [`useDispatchInbox`](../src/hooks/useDispatchInbox.ts) | dispatch requests engine (load/notes/dismiss/realtime) | `DashboardTeamsInboxCard` (via parent) + `DispatchDismissedItemsModal` |
| [`useEstimatorInbox`](../src/hooks/useEstimatorInbox.ts) | estimator requests engine | `DashboardTeamsInboxCard` (via parent, **adopted v2.719** — inline duplicate deleted) + `ChecklistReviewInboxes` |
| `useApplyScheduleProportions` | apply-schedule flow + confirm modal state | clock strip |
| `useJobModeEnabled` | job-mode flag | page fork |
| `useSendBackCollectPaymentFlowNotice` | send-back modal notice line | send-back job modal |
| `useWeeklyTeamLaborTotal`, `useBilledTotal`, `useHoursAwaitingApprovalCount`, `useSupplyHousesAPTotal`, `useSubLaborDueTotal` | financial pin totals (keyed on `financialRefreshKey`) | called in the parent (enable flags come from `visiblePins`); totals passed into `DashboardPinnedQuickRow` |
| `useStaleTallyStaffFollowUp`, `useArBankUnallocatedCount` | banner counts | `DashboardPinnedQuickRow` (moved v2.723) |
| `useAuth`, `useIsMobile`, `useNarrowViewport660`, `useDocumentVisibility`, `useFirstAssistantDispatchPhone`, `useRealtimeChannel` | cross-cutting | everywhere |
| Contexts: `useToastContext`, `useJobFormModal`, `useBidPreview`, `useJobDetailModal`, `useEditProjectModal`, `useBillCustomerModal` | app-level modals | billing, bids, job rows |

### Data engines still inline (seam candidates)

| Inline engine | Anchor | Feeds | Candidate hook |
|---|---|---|---|
| Billing invoices/jobs (RTB + billed loaders, `refreshInvoices`, `updateJobStatus`, delete/revert, locks) | ~2918–3405 | Billing ×2, field queue, send-back/mark-paid modals, Send-to-Billing confirm, trip charge, job-edit callbacks | **`useDashboardBillingInvoices`** — required before Stage B of section 8 |
| Assigned-jobs trio (3 RPC lists + `refreshDashboardAssignedJobLists` + resync ref) | ~2653/2870/2906/2819/3071 | Assigned, Team RTB, Superintendent, My Schedule labels, detail modals, `updateJobStatus` reload | **`useDashboardAssignedJobs`** — required before the job-row family moves |
| Boot phase-1 (user name, `userNames`, today checklist + subscribed/assigned steps, sessionStorage boot cache) | **extracted (v2.720)** → [`useDashboardBoot`](../src/hooks/useDashboardBoot.ts) (types in [`lib/dashboardBootTypes.ts`](../src/lib/dashboardBootTypes.ts)); parent destructures value+setter pairs; also owns `loadAssignedSteps` | My Inbox + Projects | done — unblocks sections 6/16 |
| Estimator inbox engine | **replaced (v2.719)** by the existing `useEstimatorInbox` hook (called in the parent, passed into `DashboardTeamsInboxCard`) | Teams Inbox | done |
| Checklist CRUD (today/outstanding/completed loaders + toggles + fwd + notifications) | **moved (v2.722)** into [`DashboardMyInboxCard`](../src/components/dashboard/DashboardMyInboxCard.tsx) (mutates the boot seam's today checklist via the parent-passed setter) | My Inbox | done |
| My Bids loader + unread computation | **moved (v2.718)** into `DashboardMyBidsSection` (pure core in `lib/dashboardMyBids.ts`) | My Bids only | done |
| Recent reports loader + realtime + hide-on-refresh | ~1935–2428 | Recent Reports only | move with the section |
| Sub-schedule blocks loader (+labels/phones) | ~2670–2794 | My Schedule render + `leaveReportReminderForJobRow` (job-row family) | `useDashboardSubSchedule` (loader stays shared; render extracts) |
| Workflow-step action engine | **moved (v2.721)** into [`DashboardProjectsCard`](../src/components/dashboard/DashboardProjectsCard.tsx) (calls the parent-passed `getCurrentUserName` + hook-owned `loadAssignedSteps`) | Projects card | done |
| Tally counts / pins / button-visibility loaders | tally + lost-bids loaders **moved (v2.723)** into [`DashboardPinnedQuickRow`](../src/components/dashboard/DashboardPinnedQuickRow.tsx); pins (`refreshPinned`) + button-visibility/placement loaders + `financialRefreshKey` realtime stay in the parent (see dossier §3) | banner/pins block | done |

### Parent-forever glue (no URL router exists)

- **No `?tab=` deep links.** Dashboard only links *out* (to `/bids?...`, `/jobs?...`, etc.). There is no URL state to keep in the parent — the analog is the **SectionDock** scroll-anchor registry (stays in parent).
- **localStorage keys:** `pipetooling_dashboard_hide_on_refresh_ids` (Recent Reports; moves with that section — single consumer), `dashboard_clock_strip_scope` (via `lib/dashboardClockStripScopeStorage`; stays with the strip cluster orchestration in the parent), `dashboard_my_bids_hidden_${uid}` (moves with My Bids), day-scoped boot cache (via `lib/dashboardBootCache`; stays with `useDashboardBoot`).
- **Shared modal openers** (`leaveReportJob`, `viewReportsJob`, `collectPaymentJob`, `subcontractorJobActivityModalJob`, `readyForBillingJob`, `sendBack*`, `markPaid*`) — each opened from 2+ sections or wired to the billing engine; stay in the parent, passed as callbacks.
- **`myTeam` / `applySchedule` / `hoursDaysCorrectSet` / `stripMyTimeEditor` / `dashboardSelfIsSalary`** — shared across strip, ClockInOut, My Team, My Time.

---

## Duplicated-render quirks (preserve, don't fix)

Per the playbook's behavior-preserving rule, note these — do not "clean them up" during extraction:

1. **The Billing Pipeline renders twice, as two literal ~350-line copies** — assistant/controller branch (~5362–5709) and dev/master branch (~5866–6214). Only one mounts for a given user (mutually exclusive role gates); they differ only in *position within the page flow* (assistants see inboxes+billing *before* the clock strip; dev/master after). Same state, handlers, keys. Extraction should produce **one component rendered in both branches at their current positions** — do not unify the ordering.
2. **Teams Inbox renders twice** with real differences: the dev/master/non-assistant copy adds `HelpFeedbackInboxSection` (dev-only) and gates `onCreateTripCharge` to dev/master, while the assistant copy always passes `onCreateTripCharge`. (**Collapsed as of v2.719**: one `DashboardTeamsInboxCard` rendered at both positions, the differences expressed as `showHelpFeedback`/`onCreateTripCharge` props — positions and per-branch behavior unchanged.)
3. **The clock strip + day-editor cluster renders twice** (~5266 vs ~5716) with *identical* props — pure position fork on `isAssistantLike(role)`.
4. **`myInboxCard` is one JSX const rendered at three role positions** — already single-sourced; only the mount position varies. (**Preserved as of v2.722**: the const now holds one `<DashboardMyInboxCard/>` element mounted at the same three positions; the role gates are mutually exclusive and exhaustive, so exactly one copy always mounts — required, since the component's loaders drive the dock gate it reports up.)
5. **Three different "Ready to Bill" headings exist**: Billing Stage 2 (×2 copies, invoice units) and the Team Ready to Bill section (~7490, assigned-jobs RPC). They are different features that share a name.
6. **Dead wiring: `ReportEditModal`** (~8549) — `editReportModalOpen`/`reportForEdit` (~1113–1114) are declared and rendered but **no code ever sets them open** (only the modal's own `onClose` resets them). Dead state; note for a separate cleanup PR, keep during decomposition.
7. **`turnawayJob`/`TurnawayModal` exist only in the Job Mode early return** — after "Show full dashboard" there is no turnaway entry point.
8. **My Bids gate vs loader mismatch:** the loader includes `superintendent` in `hasBidsAccess`, the render gate and dock entry do not — superintendents fetch bids that never display. (Preserved verbatim in `DashboardMyBidsSection` as of v2.718.)
9. **Upcoming inspection is hidden by the `inspections` quick-button visibility flag** (`dashboardButtonVisibility?.inspections !== false`) even though the section is not a button. (**Seam as of v2.723:** `dashboardButtonVisibility` + its loader stayed in the parent when the pins/quick-actions block extracted — the parent passes `quickActionDefs` down to `DashboardPinnedQuickRow` and keeps passing `inspectionsButtonVisible` to `DashboardUpcomingInspectionsSection` unchanged.) Related quirk preserved by the same extraction: the block's tail modals (`NewReportModal`, staff tally follow-up) never mounted in the Job Mode early return, so their openers are inert there — kept via `renderModals={false}` at that mount.
10. **Render-body ref assignments:** `refreshInvoicesRef.current = refreshInvoices` (~3086) and `resyncDashboardAfterUpdateJobStatusFailureRef.current = …` (~3071) are assigned during render, not in effects. Preserve the pattern when the engine moves into a hook.
11. **`subScheduleRows` loads for every leave-report-capable role** (~2670) though the My Schedule section renders only for subcontractor-like roles — the rows also drive the leave-report reminder icons on job rows.
12. **`myBidsSectionExpanded` initializes from `role` at first render** *and* has a primary-collapse effect with a one-shot ref — both exist because `role` can arrive after mount. (Both mechanisms preserved in `DashboardMyBidsSection` as of v2.718.)
13. **Recently Completed corner link only appears when `completedItems.length > 0`** (`showRecentlyCompleted`); its unread count filters out ignored task types first, then unread — v2.683 behavior, keep as-is. (Preserved verbatim in `DashboardMyInboxCard` as of v2.722.)
14. The **step reject/skip/set-start modals live inside the Projects group card conditional** — they cannot render if `projectsCardVisible` is false (safe today: only openable from within the card). (**As of v2.721** the modals live inside `DashboardProjectsCard`, whose render the parent still wraps in `projectsCardVisible` — same conditional, now component-internal.)

---

## Recommended extraction order (value ÷ risk)

Lowest-coupling, self-contained sections first; the billing engine and its dependents last, after their hook seams exist. Verify `npm run typecheck && npm run lint && npm test` after every step; one section (or one Stage) per PR.

1. **`upcoming-inspections`** → `DashboardUpcomingInspectionsSection`. Trivial, zero coupling; validates the pattern (People's `vehicles` analog).
2. **`recent-reports`** → `DashboardRecentReportsSection`. Self-contained loader + realtime + localStorage; carries its hide-on-refresh key. Leave the dead `ReportEditModal` wiring exactly as-is (or move it wholesale).
3. **`my-bids`** — Stage A `lib/dashboard/myBidsUnread.ts` (+tests) for the unread/others computation and compact-time formatters, then Stage B `DashboardMyBidsSection`. Biggest single line-count win (~900 lines incl. loader) at low risk.
4. **`teams-inbox`** — swap the inline estimator engine for the existing `useEstimatorInbox` (behavior-parity check), then one `DashboardTeamsInboxCard` rendered in both branches (kills duplication #2).
5. **Seam: `useDashboardBoot`** — **done (v2.720)**: phase-1 boot + cache + `loadAssignedSteps` out of the parent (refactor, no behavior change); unblocks 6 and 7.
6. **`projects-card`** — **done (v2.721)**: `DashboardProjectsCard` (+ workflow-step action engine + 3 step modals; Stage-A kernel `lib/dashboardProjectsCard.ts`). Isolated data domain, name-keyed like People.
7. **`my-inbox`** — **done (v2.722)**: `DashboardMyInboxCard` (+ checklist CRUD engine + fwd/mute modal wiring; Stage-A kernel `lib/dashboardMyInbox.ts` for the T-days helpers). Dock gate reported up via `onVisibleChange`.
8. **`banners-pins-quick-actions`** — **done (v2.723)**: `DashboardPinnedQuickRow` mounted at both positions (+ tally/lost-bids loaders, banner hooks, `NewReportModal`/staff-tally modals; Stage-A kernel `lib/dashboardPinnedRow.ts`). Shrank the Job Mode branch; pins + quick-button state + financial machinery stay parent-side.
9. **`my-schedule`** — `useDashboardSubSchedule` seam (loader shared with job-row reminders), then `DashboardMyScheduleSection`.
10. **Seam: `useDashboardAssignedJobs`** — the three RPC lists + refreshers + resync ref.
11. **Job-row family** — Stage A `lib/dashboard/jobRowActivity.ts` (`formatTimeSince`, `subcontractorLastActivity*`, stage-display helpers, +tests), then extract **Team Ready to Bill**, **Assigned Jobs**, **Superintendent Jobs** (one PR each) with shared row pieces; shared modals stay parent-side as callbacks.
12. **Seam: `useDashboardBillingInvoices`** — invoices/jobs/loaders/`refreshInvoices`/`updateJobStatus`/delete/revert/locks. Stage A first: `lib/dashboard/billingInvoiceUnits.ts` for the pure invoice mapping/bucketing helpers (`buildBilledWaitingDashboardUnits` etc., +tests).
13. **`billing-pipeline`** (last) — one `DashboardBillingPipelineSection` rendered in both role branches, with the send-back/mark-paid modal cluster; kills duplication #1 (~350 duplicated lines).
14. **`clock-strip-cluster`** — `DashboardClockStripCluster` consuming `myTeam` via props (kills duplication #3). Can slot anywhere after 4; listed late because `myTeam` prop-threading is wide and the strip component itself is already extracted.

> Already thin/extracted: Financials, My Team, My Time, Job Mode card, SectionDock, all banners, the inbox section components, `DashboardFieldCollectPaymentQueue`, `AssignedStageCard`, the skeletons, and the shared modal components (`JobReportsModal`, `AdditionalReportModal`, `CollectPaymentModal`, `BilledPaymentConfirmationModal`, `CreateTripChargeModal`, `DispatchDismissedItemsModal`, `SubcontractorJobActivityModal`, `ChecklistItemMuteModal`, `NewReportModal`, `ReportEditModal`, `TurnawayModal`, `DashboardContractSigningPromptModal`, `TeamFeedbackWizard`). The parent mostly orchestrates state around them.
