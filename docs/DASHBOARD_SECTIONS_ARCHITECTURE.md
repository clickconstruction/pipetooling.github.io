# Dashboard Sections Architecture Map

---
file: docs/DASHBOARD_SECTIONS_ARCHITECTURE.md
type: Engineering / Refactor Map
purpose: Step-0 map for the Dashboard.tsx decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md) — inventory what every role-gated section of src/pages/Dashboard.tsx touches (state, loaders, handlers, sub-components, supabase tables/RPCs, realtime, cross-section coupling), plus the internal regions of the Financials row it mounts (src/components/DashboardFinancialsSection.tsx), to drive the multi-PR extraction.
covers:
  - src/pages/Dashboard.tsx
  - src/components/DashboardFinancialsSection.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-25
---

## Overview

> **Line numbers are as of `a05cef4c4`** (read from `npm run map` fact sheets). They rot on the next commit — search the symbol (state name, const, h2 text) and treat the number as a hint.

[`src/pages/Dashboard.tsx`](../src/pages/Dashboard.tsx) is **1,852 lines** (1 component `Dashboard` 137–1852; 34 `useState`, 17 effects, 11 `useMemo`, 17 `useCallback`, 3 `useRef`, 22 custom-hook calls; 96 local imports; 97 commits in 90 days) — down from the ~8,899-line "God component" (v2.715) this map was first written against; most sections are extracted, tracked in the summary table below. It also covers [`src/components/DashboardFinancialsSection.tsx`](../src/components/DashboardFinancialsSection.tsx) (**1,824 lines**, 4 components, 18 `useState`, 3 effects — [§F](#f-dashboardfinancialssectiontsx-internal-regions)), the Financials row the page mounts and now the page's largest unmapped child. This map follows [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) and the format of [`BIDS_TABS_ARCHITECTURE.md`](./BIDS_TABS_ARCHITECTURE.md) / [`PEOPLE_TABS_ARCHITECTURE.md`](./PEOPLE_TABS_ARCHITECTURE.md). The clock strip component itself is mapped in [`CLOCK_SURFACES_ARCHITECTURE.md`](./CLOCK_SURFACES_ARCHITECTURE.md); the strip's day editor in [`MY_TIME_DAY_EDITOR_MODAL_ARCHITECTURE.md`](./MY_TIME_DAY_EDITOR_MODAL_ARCHITECTURE.md).

### Key structural differences from Bids/People

1. **Dashboard is NOT tab-switched.** There is no `activeTab`, no `?tab=` URL router, and no shared selection pointer. It is a **role-gated stack of sections** rendered top to bottom; every section's render gate is a role/data predicate, and everything mounts at once. Where the playbook says "tab", read "section". (Like People, only *data* is shared — there is no cross-section UI selection to lift.)
2. **Role-variant rendering.** The same section can render in *different positions per role*: `clockActivityStripBlock` (3 positions), `myInboxCard` + `crewDaySection` (3), `DashboardTeamsInboxCard` (2), `DashboardMyTeamPendingBanner` (2). Each is one element/component mounted under mutually exclusive gates (see [quirks](#duplicated-render-quirks-preserve-dont-fix)). The role sets: `assistant`/`controller` (via `isAssistantLike`), `dev`/`master_technician`, `subcontractor`/`helpers` (via `isSubcontractorLikeRole`), `estimator`, `primary`, `superintendent`.
3. **Job Mode replaces the top of the page.** When `useJobModeEnabled(userId, role)` is on — absent key ⇒ ON for sub-like roles, OFF otherwise, stored value wins (v2.2877, `isJobModeEnabled` in `jobModeToggle.ts`) — an early `return` (1146–1236) renders the pinned row (banners hidden), a hidden clock mount, the job card, Your record and My Schedule until the user taps "Show full dashboard" (`jobModeShowFullDashboard`, resets each page load). The full render mounts `DashboardJobModeFirstRunCard` (master/superintendent, nothing stored) above the pinned/quick row.
4. **The page is a slot host now.** The top of the main return is one `DashboardPinnedQuickRow` that receives the clock (`clockSlot`), My Schedule + Your record + Estimate button (`afterJobReportRow`) and Financials (`interstitial`) as slots — the parent builds those elements, the row positions them.
5. **File layout.** Module scope 1–136 (imports; lazy `DashboardMyTeamSection` 118, `DashboardSupervisorSection` 120, `DashboardTrialVerdictSection` 121; `HOURS_DAY_CORRECT_BLOCK_TOAST` 125; `DASHBOARD_MODAL_OVERLAY_STYLE` 128–136). Inside `Dashboard()`: state/effects/handlers 138–1090; render-prep consts `billingPipelineSectionProps` 1029–1051, `pinnedQuickRowSharedProps` 1099–1114, `myScheduleSection` 1119–1138, `crewDaySection` 1141; Job Mode early return 1146–1236; `dockSections` 1240–1279, `myInboxCard` 1281–1294, `clockActivityStripBlock` 1298–1339; main render 1341–1851.

### How to read a dossier

Each section lists: render location (anchored by symbol/heading + line range as of `a05cef4c4`), **owned local state** (moves with the section), **cross-section/shared state** (stays in the parent), **derived memos**, **handlers**, **data dependencies / supabase tables + RPCs / realtime**, **sub-components** (extracted vs inline), **external coupling**, **tests**, and **extraction status + risk + suggested approach** (Stage A = pure logic → `lib/*` + tests first; Stage B = component move).

### How to maintain this doc

- Update the relevant dossier whenever a section is extracted or its state/handlers change; flip its Status and point at the new file.
- Re-read counts and ranges from `npm run map -- src/pages/Dashboard.tsx` (and `-- src/components/DashboardFinancialsSection.tsx`), then bump `mapped_at`. Search the symbol when a number looks off.

---

## Master summary table

Sections in order of first JSX appearance in the main return (Job Mode variant first since it's an early return). Tests = `it`/`test` blocks at `a05cef4c4`; "smoke" = a `*.render.test.tsx`.

| # | Section | Anchor symbol / lines | Status | Owned state (in parent) | Coupling | Risk | Tests | Recommended action |
|---|---|---|---|---|---|---|---|---|
| 0 | Job Mode variant | early return 1146–1236 | mostly extracted (`DashboardJobModeCard`) | 2 (`jobModeShowFullDashboard` 460, `turnawayJob` 448) | low (shares `leaveReportJob`, `pinnedQuickRowSharedProps`, `myScheduleSection`) | low | `jobModeToggle` 16, `jobModeTelemetry` 4; `DashboardJobModeCard` + `DashboardJobModeFirstRunCard` + `useJobModeEnabled` smokes | Stays (page fork); hoist the duplicated elements (quirk #15) |
| 1 | Section dock | `dockSections` 1240–1279 + `SectionDock` 1343–1349 | extracted component; config inline | 0 (derived) + 2 child-reported flags (`myInboxDockVisible` 353, `myBidsDockHasContent` 577) | reads every section's gate | low | `dashboardSectionDock` 8 (active-chip kernel; the config is untested) | Stays in parent permanently |
| 1b | Quick buttons (top placement) + Estimate/Change Order | top row 1351–1359; `QuickEstimateWizard` 1350; button in `afterJobReportRow` 1392–1402 | glue inline; wizard extracted | 4 (`dashboardButtonVisibility` 461, `quickButtonsPlacement` 462, `quickEstimateEnabled` 736, `quickEstimateOpen` 737) | med (`dashboardButtonVisibility.inspections` gates Upcoming inspection — quirk #9) | low | none | `useDashboardButtonPrefs` hook (merges the two `user_dashboard_buttons` reads) |
| 1c | Trial helpers verdict (v2.3650) | lazy `DashboardTrialVerdictSection` 1361–1363 (+1171–1173 in Job Mode) | extracted (born external) | 0 | none | — | none | Done |
| 2 | Financial notifications | `interstitial` slot 1407–1420 → `DashboardFinancialsSection` (+ `DashboardOverheadCard` for dev/master) | mount extracted; the file itself is 1,824 lines with 4 inline components ([§F](#f-dashboardfinancialssectiontsx-internal-regions)) | 0 | none (self-loads `useDashboardFinancials`) | med inside §F (untested modal partition) | kernels only (see §F); no smoke | Decompose §F |
| 3 | Banners + tally + Job Report + pins row | [`DashboardPinnedQuickRow`](../src/components/dashboard/DashboardPinnedQuickRow.tsx) 1374–1421 (+1151 in Job Mode) via `pinnedQuickRowSharedProps` 1099–1114 | **extracted (v2.723)**; now a slot host (`clockSlot`/`afterJobReportRow`/`interstitial`) | pins + financial-pin machinery (`pinnedRoutes` 354, `financialRefreshKey` 635, 1 ref `financialPinsRealtimeTimerRef` 638) — see dossier | low (reads `readyToBillCount` from the billing seam, `dispatchAged` from the dispatch inbox) | low | `dashboardPinnedRow` 15, `dashboardNeedsYou` 70, `pinnedTabs` 18, `dashboardLostBidNudge` 9; `DashboardNeedsYouCard` smoke; no smoke for the row | `useDashboardFinancialPins` hook for the parent-side machinery |
| 3b | Your record (v2.3368) | `DashboardYourRecordCard` in `afterJobReportRow` 1403 (+1181 in Job Mode) | extracted (born external) | 0 (reads `dashboardSelfIsSalary`, `clockDisplayName`) | low | — | `dashboardYourRecord` 4 | Done |
| 4 | Clock-in button + contract prompt + Rate your crew | `ClockInOutButton` as `clockSlot` 1378–1389 (+hidden mount 1158–1169); Rate-your-crew 1422–1450; `DashboardContractSigningPromptModal` 1451–1457 | components extracted; glue inline | 7 (`dashboardSelfIsSalary` 471, `dashboardSalaryScheduleClockActive` 473, `teamFeedbackHomeEnabled`/`WizardOpen` 517–518, `contractSigningPrompt{Open,Rows,OpeningId}` 519–523) + `contractSigningVisitPromptEpochRef` 525 | med (`dashboardSelfIsSalary` feeds ClockInOut ×2, JobModeCard, YourRecord ×2, MyTime) | med | `teamFeedback` 23; prompt glue untested | `useContractSigningPrompt` hook + `DashboardRateYourCrewButton` |
| 5 | Clocked-In strip cluster | `clockActivityStripBlock` 1298–1339 ×3 positions + `DashboardMyTeamPendingBanner` ×2 + `DashboardMyTimeDayEditorModal` 1499–1529 | components extracted; orchestration inline (148–334, 597–629) | 4 (`clockStripScope` 148, `stripSalariedUserIds` 252, `hoursDaysCorrectSet` 279, `stripMyTimeEditor` 297) + 5 memos | **high** (`myTeam` shared with My Team; `hoursDaysCorrectSet` with My Time + clock preview) | high | `salaryPayConfigGate` 3, `notComingInTimeOff` 9; strip memos untested | Stage A `lib/dashboardClockStrip.ts`, then `useDashboardClockStrip` seam — last |
| 5b | Crew Day (v2.2602) | [`DashboardCrewDaySection`](../src/components/dashboard/DashboardCrewDaySection.tsx) via `crewDaySection` 1141, mounted above each My Inbox position (1468, 1550, 1580) | extracted (born external) | 0 (self-loads RPC `get_crew_day_payload`; kernel `lib/crewDay.ts`) | none (`authUserId` + `role` only; self-gates on `isCrewDayRole`) | — | `crewDay` 19; smoke | Done |
| 5c | Where everyone is — the clocked-in map (v2.3756; Travel times v2.3764 via `clockedInMapTravel.ts` → `driving-distance`) | [`ClockedInMapModal`](../src/components/map/ClockedInMapModal.tsx), lazy inside `DashboardTeamActiveClockStrip` from the `Map` button in its Currently In header — so People → Hours and Quickfill get it too | extracted (born external); the two shared pins canvases (`PinsMapGoogleCanvas` / `PinsMapCanvas`, a `label` badge on a pin is the head count); kernel `src/lib/clockedInMap.ts` | 0 in parent (open flag in the strip; selection, provider fallback and coords in the modal via `useAddressGeocodeCoords`, `useOfficeAnchor`, `useOverheadOfficeJobId`) | low (reads the strip's `sessions` prop; `openJobDetailFromSessionEmbeds`; the strip's `AssignSessionJobPopover` for the Not-on-a-job list) | — | `clockedInMap` 9; `ClockedInMapModal` smoke | Done |
| 6 | My Inbox (checklist) | [`DashboardMyInboxCard`](../src/components/dashboard/DashboardMyInboxCard.tsx) via `myInboxCard` 1281–1294, ×3 role positions (1469, 1551, 1581) | **extracted (v2.722)** | 0 beyond `myInboxDockVisible` (today-checklist seed lives in `useDashboardBoot`) | low (boot outputs + `getCurrentUserName`; dock gate reported up via callback) | — | `dashboardMyInbox` 10; no smoke | Done |
| 7 | Teams Inbox | [`DashboardTeamsInboxCard`](../src/components/dashboard/DashboardTeamsInboxCard.tsx) ×2 (1470–1488 assistant-like; 1554–1576 others) | **extracted (v2.719)** | `dispatchDismissedModalOpen` 573, `tripChargeTarget` 574 (modals render once, 1531–1547) | low (parent passes both inbox engines + openers) | — | `dispatchInboxAging` 7; no smoke | Done |
| 7b | Dev rejected notification | `DashboardDevRejectedNotification` 1530 (`isDev`) | extracted | 0 | none | — | none | Done |
| 8 | Billing Pipeline (field queue + Ready to Bill + Billed) | [`DashboardBillingPipelineSection`](../src/components/dashboard/DashboardBillingPipelineSection.tsx) — **one mount** 1646–1651, below Assigned Jobs (v2.784) | **extracted (v2.728)**; seam [`useDashboardBillingInvoices`](../src/hooks/useDashboardBillingInvoices.ts) 397–421 stays in the parent | `sendRecordJobMeta` 466 + `readyForBillingJob`/`Checked1`/`Checked2` 463–465 (Send-to-Billing confirm, opened from job rows) | med (seam outputs feed the section, the pinned row's `readyToBillCount`, the Send-to-Billing confirm and trip-charge refresh) | low | `dashboardBillingInvoiceUnits` 33, `buildReadyToBillDashboardUnits` 13; seam hook + section untested | `SendToBillingConfirmModal` (inline 1780–1844) |
| 9 | My Schedule | [`DashboardMyScheduleSection`](../src/components/dashboard/DashboardMyScheduleSection.tsx) via `myScheduleSection` 1119–1138 in `afterJobReportRow` 1404 (+1182 in Job Mode) | **extracted (v2.724)** | 0 (engine in [`useDashboardSubSchedule`](../src/hooks/useDashboardSubSchedule.ts) 379–392, kept in the parent) | med (hook rows feed the job-row sections' leave-report reminders — quirk #11; shared modal openers) | — | `dashboardSubSchedule` 15, `dashboardScheduleCardLines` 6; smoke | Done |
| 10 | My Bids | [`DashboardMyBidsSection`](../src/components/dashboard/DashboardMyBidsSection.tsx) 1584–1589 | **extracted (v2.718)** | 0 | none (`authUserId` + `role` + `isMobile`; dock gate's data half via callback) | — | `dashboardMyBids` 17; no smoke | Done |
| 11 | Recent Reports | [`DashboardRecentReportsSection`](../src/components/dashboard/DashboardRecentReportsSection.tsx) 1590–1594 | **extracted (v2.717)** | 0 | low (`authUserId` + `role` + `submitLinkJobPicturesDispatchRequest`; `showRecent` stays for the dock) | — | `dashboardRecentReports` 14; primary smoke | Done |
| 12 | Team Ready to Bill (assigned RTB jobs) | [`DashboardTeamReadyToBillSection`](../src/components/dashboard/DashboardTeamReadyToBillSection.tsx) 1597–1609 | **extracted (v2.726)** | 0 (`Expanded` + `collectPaymentJob` moved with it; data in `useDashboardAssignedJobs`) | low (seam outputs + shared modal openers + `reportCountByJobId`) | — | `dashboardJobRowActivity` 19; smoke | Done |
| 12b | Your jobs on a map (v2.3131) | [`DashboardJobsMapCard`](../src/components/dashboard/DashboardJobsMapCard.tsx) 1614–1621 (every role) | extracted (born external); lazy canvases `DashboardJobsMapGoogleCanvas` (when `VITE_GOOGLE_MAPS_BROWSER_KEY` loads, v2.3145) else `DashboardJobsMapCanvas` (Leaflet + OSM) | 0 (hide pref + selection in the card; coords in `useDashboardJobsMapPins`) | low (reads `assignedJobs` + `superintendentJobs`; `openJobDetailFromDashboardJobRow`) | — | `dashboardJobsMap` 13; smoke | Done |
| 13 | Assigned Jobs | [`DashboardAssignedJobsSection`](../src/components/dashboard/DashboardAssignedJobsSection.tsx) 1623–1644 | **extracted (v2.1004)**; data in `useDashboardAssignedJobs` 355–368 (stays in parent) | 2 single-consumer: `assignedJobsSearch` 370 + `filteredAssignedJobs` memo 371–377 | med (writes `readyForBillingJob`; shared modals) | low | `billingTab` 13 (search predicate); smoke | Move the search state into the section |
| 14 | Upcoming inspection | [`DashboardUpcomingInspectionsSection`](../src/components/dashboard/DashboardUpcomingInspectionsSection.tsx) 1653–1657 | **extracted (v2.716)** | 0 | low (`inspectionsButtonVisible` — quirk #9) | — | `dashboardUpcomingInspections` 6 | Done |
| 15 | Superintendent Jobs | [`DashboardSuperintendentJobsSection`](../src/components/dashboard/DashboardSuperintendentJobsSection.tsx) 1659–1673 | **extracted (v2.1004)** | 1 single-consumer: `superintendentJobsExpanded` 378 (controlled prop) | med (dedupes against `assignedJobs`; shared modals) | low | none | Move `superintendentJobsExpanded` into the section |
| 16 | Projects (Assigned + Subscribed Stages) | [`DashboardProjectsCard`](../src/components/dashboard/DashboardProjectsCard.tsx) 1674–1688 | **extracted (v2.721)** | 0 (step data in `useDashboardBoot`) | low (boot outputs + `getCurrentUserName`; gates stay parent-side for the dock) | — | `dashboardProjectsCard` 13 | Done |
| 16a | Partner ledger + partner jobs | `DashboardPartnerLedgerSection` 1692, `DashboardPartnerJobsSection` 1696 | extracted (born external, self-gating, fail-soft) | 0 | none | — | `DashboardPartnerLedgerSection` smoke | Done |
| 16b | Sub money ("Your money" card) | [`DashboardSubMoneySection`](../src/components/dashboard/DashboardSubMoneySection.tsx) 1700 | **extracted from birth (v2.1212)** | 0 (sole prop `visible={isSubcontractorLikeRole(role)}`) | none | — | none | Done |
| 16c | HR report card (v2.2235) | `dash-hr-report` anchor 1705–1707 + `DashboardPersonReportCard` 1708 | extracted (born external) | 0 (`visible` = dev/master) | none | — | none | Done |
| 17 | My Team | lazy `DashboardMyTeamSection` 1710–1719 | extracted | 1: `isPayApprovedMaster` 173 (effect 174–186) → `canApproveHours` derived 187, read only here; hook in parent | high (shares `myTeam` with strip cluster) | n/a | none | Done; `myTeam` hook stays in parent; v2.3616: roster = the crew the viewer supervised this week (`supervisedMembershipEnabled`), `canApprove` gates the approval UI |
| 17b | My crew (v2.3613 Supervision) | lazy [`DashboardSupervisorSection`](../src/components/dashboard/DashboardSupervisorSection.tsx) 1720–1724 | **extracted from birth** | 0 (`setLeaveReportJob` handed in as `onLeaveReport`) | none (own RPC `get_supervised_days_payload`; kernel `lib/people/supervisedDays.ts`) | n/a | smoke | Done |
| 18 | Me / My Time | `dash-me` 1727 + `DashboardMyTimeSection` 1728–1734 (helpers' strip at 1726 sits above it) | extracted | 0 | low (`hoursDaysCorrectSet`, `dashboardSelfIsSalary` props) | n/a | none | Done |
| 18b | My Vehicle (v2.1648) | `DashboardMyVehicleCard` 1737 | extracted (born external) | 0 | none (`userId` only) | n/a | smoke | Done |
| 19 | Modal tail | `ApplyScheduleApprovedConfirmModal` 1739 → overlay 1845–1849 | mixed | (owned by opener sections) | shared modals opened from 2+ sections stay | — | none | Extract the inline Send-to-Billing confirm; openers stay |
| 20 | Report-count badges (engine, no render) | `reportCountByJobId` 428 + `loadDashboardReportCounts` 429–438 (+ mount effect 439–441) | **inline engine** (v2.1547) | 1 | med (feeds My Schedule / Team RTB / Assigned; refreshed from 5 report-save callbacks) | low | none | `useDashboardReportCounts` hook, or a count RPC |

> Status legend: `inline` = rendered directly in `Dashboard.tsx`; `partial` = major children extracted but section state/JSX still inline; `extracted` = section is a thin wrapper around an imported component.

---

## Role-gating model

Cross-checked against [`src/lib/canLeaveJobFieldReport.ts`](../src/lib/canLeaveJobFieldReport.ts), [`src/lib/subcontractorLikeRole.ts`](../src/lib/subcontractorLikeRole.ts) (`isAssistantLike` = `assistant | controller`; `isSubcontractorLikeRole` = `subcontractor | helpers`), and the role path Sets in [`lib/dashboardPinnedRow.ts`](../src/lib/dashboardPinnedRow.ts) (`filterPinnedByRole`, imported at Dashboard 61, applied to `visiblePins` at 630; estimator's path set adds `/prospects` when `estimatorProspectsAccess`).

| Section | dev | master_technician | assistant/controller | estimator | primary | superintendent | subcontractor/helpers |
|---|---|---|---|---|---|---|---|
| Job Mode variant | per-user `useJobModeEnabled(userId, role)` flag — default ON for sub-like, OFF otherwise; any eligible role can turn it on | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Trial helpers verdict (`canEverLeadTrialHelper`) | — | ✓ | — | — | — | — | ✓ (self-gated on a trial helper led today) |
| Financials (`showFinancials` 1061; same gate on Dispatch Mode home) | ✓ | ✓ | ✓ | — | — | — | — |
| Overhead card inside Financials (v2.2676, `DashboardOverheadCard`, self-gating) | ✓ | ✓ only with pay approval (`usePeopleAccess.canAccessPay`) | — | — | — | — | — |
| Quick action buttons (`showDashboardQuickButtons` 1063) | ✓ | ✓ | ✓ (Builder Review button master_technician-only) | — | — | — | — |
| Estimate/Change Order button (`isQuickEstimateRole` + per-user `user_dashboard_buttons.quick_estimate` opt-in, default off) | ✓ | ✓ | — | ✓ | ✓ | ✓ | subcontractor only |
| Banners: AR bank | `canRoleSeeArBankUnallocatedDashboardBanner(role)` | | | | | | |
| Banners: Tally stale (self) / tally icon+Job Report row | any signed-in role (`role != null`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Banners: Tally stale staff / staff follow-up modal | ✓ | ✓ | ✓ | — | — | — | — |
| Banners: Lost bids missing reason | any role with own lost bids (query filters by estimator/AM id) | | | | | | |
| Your record (`DashboardYourRecordCard`) | any signed-in role; renders nothing when the record is clean | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| My Schedule (`myScheduleSection`, loader gate `canLeaveJobFieldReport`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Clocked-In strip (`showClockActivityStrip`) | ✓ (after the contract prompt) | ✓ (same) | ✓ (first, above inboxes) | ✓ | ✓ | ✓ | subcontractor as dev; **helpers just above My Time** (v2.1541). Scope toggle (`showClockStripScopeToggle`) dev/master/assistant-like only; strip My-Time editor also superintendent |
| My Team pending banner | ✓ (below strip) | ✓ (below strip) | ✓ (below strip, assistant branch) | — | — | — | — |
| Crew Day (`isCrewDayRole`, v2.2602) | ✓ (company-wide) | ✓ (company-wide) | ✓ (company-wide) | — | — | ✓ (scoped to assigned projects, server-side) | — |
| My Inbox card (`showMyInboxCard`) | ✓ (+ Recently Completed, dev-only) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (position differs per role branch) |
| Teams Inbox | eligibility-driven: `dispatchInboxEligible` (hook) / `estimatorInboxEligible` (dev or `estimator_group_members`); `HelpFeedbackInboxSection` dev-only | | | | | | |
| Dev rejected notification | ✓ | — | — | — | — | — | — |
| My Bids | ✓ | ✓ | ✓ | ✓ | ✓ | — (loader aligned with the gate in v2.2634 — quirk #8 resolved) | — |
| Recent Reports (`showRecent` = `isDashboardRecentReportsRole`, v2.2599) | ✓ | ✓ | ✓ | — | ✓ | ✓ | — |
| Team Ready to Bill (`isDashboardTeamReadyToBillRole`) | — | — | — | ✓ | ✓ | ✓ | ✓ |
| Assigned Jobs | any role with rows from `list_assigned_jobs_for_dashboard` (RPC scopes rows); "Send to Billing" hidden for subcontractor/helpers (`isSubcontractorLikeRole`, v2.2070) | | | | | | |
| Billing Pipeline (one mount, below Assigned Jobs) | ✓ | ✓ | ✓ | — | — | — | — |
| Upcoming inspection | ✓ | ✓ | ✓ | — | ✓ | — | — (also hidden when the `inspections` quick button is toggled off) |
| Superintendent Jobs | — | — | — | — | — | ✓ | — |
| Projects: Assigned Stages | any role with assigned steps (by user *name*) | | | | | | |
| Projects: Subscribed Stages (`showSubscribed`) | ✓ | ✓ | ✓ | — | — | — | — |
| Partner ledger / partner jobs | any role with a live partnership (self-gated) | | | | | | |
| Sub money | — | — | — | — | — | — | ✓ |
| HR report card | ✓ | ✓ | — | — | — | — | — |
| My Team / My Time sections | any signed-in user | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| My crew (`DashboardSupervisorSection`, v2.3613; parent gate: `master_technician`, `helpers` or `subcontractor`) — job-days the viewer supervised: reports owed, crew hours read-only | — | ✓ if on a job-day they ran | — | — | — | — | ✓ only when the office marked them able to run a job |
| Leave Report buttons (`canLeaveJobFieldReport`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (everyone but role=null) |
| Collect Payment button | — | — | — | — | — | ✓ (v2.2637) | ✓ (Team RTB rows) |

---

## Per-section dossiers

### 0. Job Mode variant (early return)

- **Render location:** 1146–1236, gate `if (jobModeEnabled && !jobModeShowFullDashboard && authUser?.id)`. Renders `<DashboardPinnedQuickRow {...pinnedQuickRowSharedProps} renderModals={false} hideBanners />` (banners live in the Job Mode Inbox tab via `bannersOnly`, v2.917); a **visually-hidden `ClockInOutButton`** (1158–1169 — the card's Clock In / Start First Job run through the `UpdateFocusOpenerBridge`, which exists only while the button is mounted; the wrapper must not be `display:none`); lazy `DashboardTrialVerdictSection`; `DashboardJobModeCard` (`canClockOut={!dashboardSelfIsSalary}`); `DashboardYourRecordCard`; `myScheduleSection`; the "Show full dashboard" button; its own `AdditionalReportModal` (1201–1217, `leaveReportJob`) + `TurnawayModal` (1218–1233, `turnawayJob`).
- **Owned local state:** `jobModeShowFullDashboard` (460, resets each load — the gear-menu toggle is the persistent setting), `turnawayJob` (448 — **only settable/renderable in this branch**, quirk #7).
- **Cross-section/shared state:** `leaveReportJob` (447), `refreshDashboardAssignedJobLists`, `loadDashboardReportCounts`, `pinnedQuickRowSharedProps`, `myScheduleSection`, `dashboardSelfIsSalary`, `clockDisplayName`.
- **Data deps:** `useJobModeEnabled(authUser.id, role)` (451; v2.2877 role default + `'0'` explicit off — see `jobModeToggle.ts`); `DashboardJobModeCard` self-loads. Effect 453–456 records `job_mode_enabled{source}` once per session (`jobModeTelemetry.ts`).
- **First-run card (v2.2877):** `DashboardJobModeFirstRunCard` 1366–1373, top of the **main** return (above `DashboardPinnedQuickRow`); self-gated by `showJobModeFirstRunCard(role, stored, dismissed)` → master_technician / superintendent only; its tap calls `setJobModeEnabled(true, 'card')` and resets `jobModeShowFullDashboard`, so the page flips into this branch without a reload.
- **Tests:** `jobModeToggle` 16, `jobModeTelemetry` 4; `DashboardJobModeCard` + `DashboardJobModeFirstRunCard` smokes; `useJobModeEnabled.render.test.tsx` 5. The branch itself has no smoke (no `Dashboard.render.test.tsx`).
- **Extraction status + approach:** **Stays in the parent** — it is the page-level fork. Four elements are written twice across the two returns (quirk #15); hoist them into consts. Known consequence (accepted): the pinned row is a component, so flipping "Show full dashboard" remounts it and its tally/lost-bids counts reload.

### 1. Section dock

- **Render location:** `dockSections` 1240–1279 + `<SectionDock>` 1343–1349 (renders when >1 entry; `onChipClick` → `recordNavClick(…, 'dock', '#id')`, v2.2334). 14 candidate entries: `dash-my-schedule`, `dash-notifications`, `dash-clocked-in`, `dash-crew-day`, `dash-my-inbox`, `dash-teams-inbox`, `dash-bids`, `dash-reports`, `dash-ready-to-bill`, `dash-assigned-jobs`, `dash-billing`, `dash-projects`, `dash-hr-report`, `dash-me`.
- **Anchors:** the parent keeps five sibling anchor divs with `dockAnchorStyle` (`scrollMarginTop: 8`, 1238) — `dash-notifications` 1410, `dash-clocked-in` 1301 (inside `clockActivityStripBlock`), `dash-billing` 1648, `dash-hr-report` 1706, `dash-me` 1727. The rest are the child components' own `id`s (My Schedule, Crew Day, My Inbox, Teams Inbox, My Bids, Recent Reports, Team RTB, Assigned Jobs, Projects).
- **Owned state:** none — each `visible` mirrors its section's render gate; two are data halves reported up by children (`myInboxDockVisible` 353 via `onVisibleChange`, `myBidsDockHasContent` 577 via `onContentVisibleChange`).
- **Tests:** `dashboardSectionDock` 8 covers the dock's active-chip kernel (`pickActiveDashboardSection`, `clampedCenterScrollLeft`); the entry list/gates are untested.
- **Extraction status + approach:** `SectionDock` is extracted. The config **must stay in the parent** (it reads every gate). Keep anchor `id`s stable across extractions.

### 1b. Quick buttons (top placement) + Estimate/Change Order

- **Render location:** `QuickEstimateWizard` 1350 (always mounted, `open={quickEstimateOpen}`); top-placement quick buttons 1351–1359 (`showDashboardQuickButtons && quickButtonsPlacement === 'top'`); the purple "Estimate/Change Order" button 1392–1402 inside `afterJobReportRow` (v2.2293, renamed v2.2563). The with-pins placement renders inside `DashboardPinnedQuickRow` from the `quickActionDefs` prop.
- **Owned state:** `dashboardButtonVisibility` 461 (effect 713–730, `user_dashboard_buttons` for dev/master/assistant-like; defaults all-true, `builder_review` master-only), `quickButtonsPlacement` 462 (effect 758–786, `user_dashboard_preferences`, default `with_pins`), `quickEstimateEnabled` 736 (effect 738–756 — a **second** `user_dashboard_buttons` read, `button_key = 'quick_estimate'`, default OFF, `isQuickEstimateRole`), `quickEstimateOpen` 737.
- **Derived:** `showDashboardQuickButtons` 1063, `quickActionLinkStyle` 1064–1072, `quickActionDefs` memo 1073–1090.
- **Coupling:** `dashboardButtonVisibility?.inspections` gates Upcoming inspection (quirk #9, 1656); `quickActionDefs`/`quickButtonsPlacement`/`showDashboardQuickButtons` pass into the pinned row.
- **Tests:** none.
- **Approach:** `useDashboardButtonPrefs(authUserId, role)` returning `{ visibility, placement, quickEstimateEnabled }` — one `user_dashboard_buttons` read instead of two; `quickEstimateOpen` + the wizard + button can become a small `DashboardQuickEstimateButton`. Low risk.

### 2. Financial notifications (the mount)

- **Render location:** the pinned row's `interstitial` slot 1407–1420: `showFinancials` → `dash-notifications` anchor + `<DashboardFinancialsSection overheadCard={dev/master ? <DashboardOverheadCard …/> : null} />`. The row renders the slot between the banners and the pins/quick-action row.
- **Owned state:** none in parent. The component's props are only `{ overheadCard?: React.ReactNode }`; it self-loads.
- **Other mount:** `src/components/dispatchMode/DispatchModeHome.tsx:148` (same `showFinancials` gate, no overhead card).
- **Money source (v2.2862):** the AR card's buckets (`useDashboardFinancials` → `buildArBuckets` → `computeBillTruth`) and the parent's Billed pin (`useBilledTotal`) are the bill-truth kernel (`src/lib/billing/billTruth.ts`) — the same `billed` / `collections` / `owed` the Pipeline strip and Quickfill show. The card's detail lines add "N bills on paid or missing jobs excluded ($X)" when the kernel kept bills out of Owed (`arExcluded`); the Stage 2/3 lists' paid-job exclusion (`isDashboardBillOnPaidJob`) reads the same predicate.
- **Extraction status:** mount **done**; the file's own decomposition is [§F](#f-dashboardfinancialssectiontsx-internal-regions).

### 3. Banners + tally icon + Job Report + quick actions + pins row

- **Status: extracted (v2.723)** → [`DashboardPinnedQuickRow.tsx`](../src/components/dashboard/DashboardPinnedQuickRow.tsx) (847 lines), mounted at **both** returns via `pinnedQuickRowSharedProps` (1099–1114): main 1374–1421 (`renderModals jobReportFirst` + slots) and Job Mode 1151 (`renderModals={false} hideBanners`). Also mounted `bannersOnly` by `DispatchModeInbox` and `JobModeInbox`. Stage-A kernel [`dashboardPinnedRow.ts`](../src/lib/dashboardPinnedRow.ts) (15 tests): the role path Sets + `getAllowedPathsForRole`/`filterPinnedByRole` (the parent imports `filterPinnedByRole` from the kernel, the single source), `filterPinsToShow` (the /dashboard + '/' + Materials external-team exclusions — since v2.2902 `/dashboard` is also out of `PINNABLE_PATHS`, so no new self-pin can be created; Layout shows a one-line note on `/dashboard` while Pin Mode is on), the pin chip route/label calc `getPinnedChipDisplay` (Internal Team / Billed Awaiting Payment / Supply Houses / Sub Labor Due live-total labels + the billed→stages and sub-labor→sub_sheet_ledger link rules), and `getTallyLinkAccessibleName`.
- **Slots and props added since v2.723:** `clockSlot` (the embedded `ClockInOutButton`, rendered mid-row as [tally][clock stack][Job Report] — v2.1461), `afterJobReportRow` (Estimate/Change Order button + `DashboardYourRecordCard` + `myScheduleSection`), `interstitial` (Financials), `jobReportFirst` (main return only), `hideBanners` (Job Mode), `bannersOnly` (the two inbox tabs), `dispatchAged` (the parent's `dispatchAged` memo 587–593 over `useDispatchInbox` rows, `summarizeOpenDispatchAging` + `DISPATCH_REQUESTS_MIN_AGE_DAYS`), and `readyToBillCount` (v2.3801 — `readyToBillLoaded && !readyToBillLoading ? readyToBillDashboardUnits.length : null` from the billing seam, written by the Day book's queue recorder as the `billing` kind).
- **What moved (v2.723):** `tallyUnlinkedCount`/`tallyStaleUnlinkedCount` + loaders (RPCs `count_unlinked_mercury_transactions_for_tally[_stale]`) + their initial-load and focus-refresh effects; `tallyStaffFollowUpModalOpen` + `useStaleTallyStaffFollowUp`; `arBankCountEnabled` + `useArBankUnallocatedCount`; the lost-bids missing-reason count; `newReportModalOpen`; the derived `pinsToShow`/`showPinnedRowWithQuickActions`/`tallyLinkAccessibleName` + `pinnedItemLinkStyle`; the block JSX; and the two tail modals `NewReportModal` + `DashboardStaleTallyStaffFollowUpModal` (their only openers are in the block; fixed overlays). The component calls `useNavigate()` itself (its `useToastContext()` call went in v2.2890). **Modals quirk preserved via `renderModals`:** the tail modals never rendered in the Job Mode early return — that mount passes `renderModals={false}`.
- **What stayed in the parent (and why):** `pinnedRoutes` 354 + `refreshPinned` 699–707 + its mount effect 709–711 + the pins-changed/focus/visibility listener effect 802–821 (also bumps `financialRefreshKey`) and `visiblePins` 630 → `has*Pin` flags 631–634, because those flags enable the parent-side financial machinery: `financialRefreshKey` 635 + `financialPinsRealtimeTimerRef` 638 + `scheduleFinancialPinsRefreshFromRealtime` 639–647 (1200 ms coalesce) + the unmount cleanup effect 793–800 + the `dashboard-financial-pins` channel on `jobs_ledger_invoices` 835–847; the **four** financial pin total hooks 648–651 (`useWeeklyTeamLaborTotal`, `useBilledTotal`, `useSupplyHousesAPTotal`, `useSubLaborDueTotal` — the Hours Awaiting Approval chip and its hook left in v2.786), totals passed down as props; and the quick-button cluster ([§1b](#1b-quick-buttons-top-placement--estimatechange-order)).
- **Supabase / realtime:** component-side — RPCs `count_unlinked_mercury_transactions_for_tally[_stale]`, `bids` (lost-reason count), banner hooks' tables; parent-side — `user_dashboard_buttons`, `user_dashboard_preferences`, `user_pinned_tabs` (via `lib/pinnedTabs`), realtime `dashboard-financial-pins`.
- **Sub-components (render inside the card now):** `DashboardNeedsYouCard` (all attention sources as one list — see below), `GcReviewWeekDoneNotice` (green rest-of-Wednesday confirmation, from `DashboardGcReviewWeeklyBanner.tsx`), `NewReportModal`, `DashboardStaleTallyStaffFollowUpModal`, `DashboardLienReleaseQueueModal` (v2.2751 — the `lien-unconditional` action's cleared-releases queue; issues the unconditional follow-up per row via `LienReleaseModal`, also mounted by `QuickfillNeedsYouSection`), `DashboardArDepositsModal` (v2.2890 — the `ar-deposits` "Match deposits" action opens the SAME `BankPaymentsModal` the `/accounts-receivable` page renders, fed by the shared jobs cache, over the card instead of navigating away; also mounted by `QuickfillNeedsYouSection`; the card refetches its unallocated count on close). The `claim-dev` action lands on `/settings?tab=settings-advanced-tools#settings-claim-code` (the code form is on Advanced, not People — v2.2890).
- **Needs You card (v2.2339 → complete v2.2492):** the standalone attention banners are gone — every source renders as an item of [`DashboardNeedsYouCard`](../src/components/dashboard/DashboardNeedsYouCard.tsx) via the pure builder [`dashboardNeedsYou.ts`](../src/lib/dashboardNeedsYou.ts) (`buildNeedsYouItems`, 70 tests), fed by hooks this component owns: `useArBankUnallocatedCount`, the two tally counts, the lost-bids loader, `useTeamReviewsDue` (v2.2488), `useRoadmapNeedsNameNudges` (v2.2489), `useJobFollowupNudge` (v2.2487), `useGcReviewWeekNudge` (v2.2490), `useBulkDeleteNudge` (v2.2491), `useClaimDevAttemptsNudge` (v2.2492). Quickfill's `QuickfillNeedsYouSection` renders the same card from the same hooks (job-followups + GC weekly excluded there — dedicated stations). Aging queues (v2.2895, journey-map #40): `dispatch-requests-aged` reads the `dispatchAged` prop; its action scrolls to `#dash-teams-inbox` (fallback `/dispatch-mode/inbox`). `hr-reports-pending` comes from `usePendingHrReportsNudge` (dev-only) and navigates to `/people?tab=hr`. Quickfill's twin takes `dispatchAged` + `onOpenDispatchInbox` from the page and renders both keys. Quickfill still mounts four of the old per-banner components (`DashboardTallyStaleStaffBanner`, `DashboardJobFollowupsBanner`, `DashboardGcReviewWeeklyBanner`, `DashboardLostBidsMissingReasonBanner`); two more, `DashboardArBankUnallocatedBanner` and `DashboardTallyStaleBanner`, are still in `src/components/` but nothing imports them.
- **Card ↔ destination parity (v2.2896, journey-map Tier-2 #16):** the two tally counts come from one hook, [`useTallyUnlinkedCounts`](../src/hooks/useTallyUnlinkedCounts.ts), shared with `QuickfillNeedsYouSection` and the `/tally` header (which says the card's aged figure beside its own total via `tallyStaleGloss`); a `NeedsYouItem` may carry `destinationFigure`, and `needsYouClickTarget(item)` appends `&dest=<n>` to the `ui_nav_clicks` target so card-vs-page drift is auditable. The Division 22 modal folds names by case like the card's RPC; the lost-bids card names its all-trade scope. Rule: one hook feeds both surfaces, or the destination shows the card's gloss — never a third count.
- **Item kind (v2.2916, journey-map Tier-2 #41):** `NeedsYouItem.kind` is `'company'` (default) or `'roadmap'`; `roadmap-needs-person` is the only roadmap-kind item. `rankNeedsYouItems` groups company items first and roadmap items after (tier + figure within each group), and `buildNeedsYouItems` runs `visibleNeedsYouItems(items, role)` so a non-dev viewer never receives a roadmap-kind item regardless of what the hooks fed in; `useRoadmapNeedsNameNudges` gates on `canSeeRoadmapNeedsYou` (dev, not Farm Mode) so the office does no roadmap reads. The action navigates via `roadmapPath(id, 'plan')` → `/roadmap?roadmap=<id>&view=plan`.
- **Tests:** kernels above; `DashboardNeedsYouCard` + `DashboardLienReleaseQueueModal` smokes; **no smoke for `DashboardPinnedQuickRow`** (the slot host).
- **Next:** `useDashboardFinancialPins(authUserId, role, estimatorProspectsAccess, isDocVisible)` → `{ visiblePins, costMatrixTotal, billedCount, billedTotal, supplyHousesAPTotal, subLaborDueTotal }`; its only consumer is `pinnedQuickRowSharedProps`.

### 3b. Your record (v2.3368)

- **Render location:** `DashboardYourRecordCard` in `afterJobReportRow` 1403 and in the Job Mode return 1181 (props `userId`, `role`, `displayName={clockDisplayName}`, `isSalary={dashboardSelfIsSalary}`).
- **What it is:** up to three things only this person can put right (a past-day clock left running, an open job worked with no % complete, a worked job with no report from them); no money; renders nothing when clean. Owns its own doors (field % modal, leave-report modal, My Time day editor). Reads `clock_sessions`, `jobs_ledger`, `reports`.
- **Tests:** `dashboardYourRecord` 4. **Status:** done (born external).

### 4. Clock-in button + contract-signing prompt + Rate your crew

- **Render location:** `ClockInOutButton` (embedded) as the pinned row's `clockSlot` 1378–1389, plus the hidden Job Mode mount 1158–1169 (same props — quirk #15); **Rate your crew** button 1422–1441 + `CrewReviewDeck` 1442–1450 (v2.2824, `source="home_button"`); `DashboardContractSigningPromptModal` 1451–1457.
- **Owned local state:** `dashboardSelfIsSalary` 471, `dashboardSalaryScheduleClockActive` 473, `teamFeedbackHomeEnabled`/`teamFeedbackWizardOpen` 517–518, `contractSigningPromptOpen`/`Rows`/`OpeningId` 519–523 + `contractSigningVisitPromptEpochRef` 525.
- **Cross-section/shared state:** `clockDisplayName` memo 467–470 (`userName` from `useDashboardBoot` 349, else `displayNameFromAuthUser`); `dashboardSelfIsSalary` also feeds `DashboardJobModeCard.canClockOut`, `DashboardYourRecordCard` ×2 and `DashboardMyTimeSection.disableDayEditor`; `openMyTimePreviewFromClock` 502–516 opens the *shared* strip day editor (`stripMyTimeEditor`, blocked by `hoursDaysCorrectSet`); `onFieldReportSaved` refreshes `refreshDashboardAssignedJobLists` + `loadDashboardReportCounts`.
- **Handlers / effects:** salary probe effect 477–501 (`fetchSelfSalaryClockState` — one id-first RPC `self_salary_clock_state`, name fallback inside the helper, v2.1734); `fetchContractDashboardPromptRows` 527–532 (RPC `list_my_contract_dashboard_prompts`), `runContractSigningPromptFromRpc` 534–544, `handleClockInSuccessContractPrompt` 546–549, salaried-visit prompt effect 551–571 (epoch-guarded against Strict Mode), `openContractSigningPageForDoc` 671–697 (edge fn `get-contract-signing-link-for-self`); team-feedback settings effect 653–669 (`fetchTeamFeedbackSettings`).
- **Sub-components (extracted):** `ClockInOutButton`, `CrewReviewDeck`, `DashboardContractSigningPromptModal`.
- **Tests:** `teamFeedback` 23; the prompt glue and salary probe are untested.
- **Extraction status + risk + approach:** Components extracted; glue inline. **Medium.** Stage B: `useContractSigningPrompt(authUserId, salaryScheduleActive)` (rows/open/openingId + RPC + edge-fn opener + visit effect; outward seam = `handleClockInSuccessContractPrompt` + the modal's props). `teamFeedbackHomeEnabled`/`WizardOpen` + the settings effect + both JSX blocks → a self-contained `DashboardRateYourCrewButton` (zero coupling). The salary pair stays in the parent (6 consumers).

### 5. Clocked-In strip cluster

- **Render location:** one `clockActivityStripBlock` const (1298–1339: `dash-clocked-in` anchor + `DashboardTeamActiveClockStrip`, gate `authUser?.id && showClockActivityStrip`) mounted at **three mutually exclusive positions**: assistant-like 1458, non-assistant non-helpers 1491, helpers 1726 (just above My Time, v2.1541). `DashboardMyTeamPendingBanner` follows at 1459–1465 (assistant-like) and 1492–1498 (dev/master). The shared `DashboardMyTimeDayEditorModal` renders once, 1499–1529 (`stripMyTimeEditor`).
- **Owned local state:** `clockStripScope` 148 (localStorage-backed; `setClockStripScopePersist` 151–158; scope-default effect 159–169), `stripSalariedUserIds` 252 (effect 254–266), `hoursDaysCorrectSet` 279 (effect 281–295), `stripMyTimeEditor` 297 (+ footer-sync effect 327–334); derived flags `showClockStripScopeToggle`/`showStripSubjectMyTimeEditor`/`pendingClockBannerAtMyTeamTop` 143–147, `orgWideStripEnabled` 170.
- **Cross-section/shared state:** **`myTeam` = `useDashboardMyTeamSectionState(authUser?.id, { orgWideStripEnabled, supervisedMembershipEnabled })`** (188) — the page's biggest shared engine (1,467-line hook), also consumed by `DashboardMyTeamSection` and the pending banners; `applySchedule` = `useApplyScheduleProportions` (192–195; `ApplyScheduleApprovedConfirmModal` 1739); `hoursDaysCorrectSet` + `hoursDaysCorrectRange` (memo 268–277) — also read by `openMyTimePreviewFromClock` and passed to `DashboardMyTimeSection`.
- **Derived memos:** `sessionsForStrip` 207–229 (real open sessions + synthetic salary sessions, sorted by name then clock-in), `hoursTodayForStrip` 231–236, `showClockActivityStrip` 238–241, `stripPayGateUserIds` 243–250, `hoursDaysCorrectRange` 268–277.
- **Handlers:** `reloadMyTeamPendingSilent` 189–191, `goToPendingSessionsInMyTeam` 196–206 (scrolls to `dashboard-my-team-pending-sessions`), `openStripMyTimeEditor` 304–325 (blocks on `hoursDaysCorrectSet` with `HOURS_DAY_CORRECT_BLOCK_TOAST`), `openMyTimePreviewFromClock` 502–516, `materializeSalarySessionForStrip` 597–607 (`syncSalaryClockSessionsForUserDay`), `handleStripMarkNotComingIn` 608–629 (`recordNotComingInForUserAsStaff`).
- **Supabase:** via libs — `fetchSalariedUserIdSetFromUserIds` (`users`, `people`, RPC `list_people_pay_flags`), `fetchHoursDaysCorrectWorkDates` (`hours_days_correct`); `clock_sessions` etc. inside `useDashboardMyTeamSectionState`.
- **Sub-components (extracted):** `DashboardTeamActiveClockStrip` (3,087 lines — [CLOCK_SURFACES_ARCHITECTURE.md](./CLOCK_SURFACES_ARCHITECTURE.md)), `DashboardMyTeamPendingBanner`, `DashboardMyTimeDayEditorModal`.
- **External coupling:** localStorage `dashboard_clock_strip_scope` (via `lib/dashboardClockStripScopeStorage`, untested); scroll-anchor into the lazy `DashboardMyTeamSection`.
- **Tests:** `salaryPayConfigGate` 3, `notComingInTimeOff` 9; `sessionsForStrip`, `hoursDaysCorrectRange`, `stripPayGateUserIds` are inline and untested; the two hooks (`useDashboardMyTeamSectionState`, `useApplyScheduleProportions`) have no tests.
- **Extraction status + risk + approach:** Components extracted; ~190 lines of orchestration inline. **High risk** — `myTeam` is shared. The render duplication is already gone (one const). Stage A: `lib/dashboardClockStrip.ts` (`mergeStripSessions`, `hoursDaysCorrectRange`, `stripPayGateUserIds`) + tests. Stage B: `useDashboardClockStrip({ authUserId, role, myTeam, showToast })` returning the strip props, the editor state/openers and `hoursDaysCorrectSet`. **`myTeam`, `applySchedule` and `canApproveHours` stay in the parent.**

### 6. My Inbox (Due Today / Overdue / Recently Completed)

> **Also embedded on Quickfill (v2.816):** [`QuickfillMyInboxSection`](../src/components/quickfill/QuickfillMyInboxSection.tsx) is a thin adapter that mounts this same card on the Quickfill page — no boot seam there, so the card gained a `loadOnMount` prop (self-loads Due Today via its own richer query) and `getCurrentUserName` was extracted to [`src/lib/getCurrentUserName.ts`](../src/lib/getCurrentUserName.ts) for both callers. Behavior on Dashboard is unchanged.

- **Status: extracted (v2.722)** → [`DashboardMyInboxCard.tsx`](../src/components/dashboard/DashboardMyInboxCard.tsx); Stage-A kernel [`dashboardMyInbox.ts`](../src/lib/dashboardMyInbox.ts) (the Overdue "T-days" helpers `getDaysUntilDue`/`formatTDays`, 10 tests; `getDaysUntilDue` takes `today` as a parameter defaulting to `new Date()`).
- **Render location:** `myInboxCard` 1281–1294, mounted at 1469 (assistant-like), 1551 (dev/master), 1581 (everyone else), each right after `crewDaySection`.
- **What moved:** all card-local state — checklist display (`outstandingItems`/`outstandingLoading`, in-flight refs), dev Recently Completed (`completedItems*`, `readInstanceIds`, `ignoredItemIds`, `ignoredSectionOpen`, `ignoringItemId`, `expandedCompleterIds`, `markingReadId`/`markingUnreadId`), and modal state (`muteModalItemId`/`muteModalTitle`, `fwd*`, `sendTaskUsers`) — plus the checklist CRUD engine (`loadTodayChecklist`, `loadOutstanding`, optimistic toggles, `saveFwd`, `sendChecklistCompletionNotifications` — edge fn `send-checklist-notification`, `maybeCreateNextChecklistInstance`, `markCompletedItemAsRead/Unread`, `ignoreTaskType`/`unignoreTaskType`, `isNotificationRecipient`, `openMuteModal`, `openFwd`) with its three load effects, the card JSX (the `dash-my-inbox` anchor is the card's own `id`), the Forward modal and `ChecklistItemMuteModal` wiring. The component calls `useToastContext()` itself and derives `isDev` from `role`. `toLocalDateString` comes from `lib/dailyGoalsGate` (Dashboard's module copy is deleted).
- **What stayed in the parent:** the [`useDashboardBoot`](../src/hooks/useDashboardBoot.ts) seam (337–351) — `todayChecklist` + `setTodayChecklist`, `checklistLoading`, `userLoading`, `setUserError` passed as props (the `{userError && …}` display stays at 1595); `getCurrentUserName` 1053 (also passed into `DashboardProjectsCard`). **Dock-gate seam:** the `showChecklist`/`showRecentlyCompleted`/`showMyInboxCard` derivation lives in the child, reported up via `onVisibleChange` into `myInboxDockVisible` (353, initialized `true`).
- **Quirks preserved:** #4 (one element, three positions, exactly one mounts), #13.
- **Supabase:** `checklist_instances`, `checklist_items`, `checklist_item_assignees`, `checklist_instance_assignees`, `dev_read_completed_items`, `dev_ignored_checklist_items`, `users`; edge fn `send-checklist-notification`; today-checklist boot stays with the hook (`lib/dashboardBootQueries` + `lib/dashboardBootCache`).
- **Tests:** `dashboardMyInbox` 10; no smoke for the card; `useDashboardBoot` untested.

### 7. Teams Inbox

- **Status: extracted (v2.719)** → [`DashboardTeamsInboxCard.tsx`](../src/components/dashboard/DashboardTeamsInboxCard.tsx), rendered at **both** role positions (1470–1488 assistant-like with `showHelpFeedback={false}` and `onCreateTripCharge` always; 1554–1576 non-assistant with `showHelpFeedback={isDev}` and `onCreateTripCharge` dev/master-only). Both also pass `onLinkJobPictures` (`jobFormModal.openEditJob(…, { jobPicturesLinkHighlight: true })`) and `onOpenSupplyHouseShare` (`jobDetailModal.openJobDetail({ jobId, openSupplyHouseShare: true })`). No Stage-A kernel — the win was deduplication.
- **What moved:** the entire inline estimator engine was **deleted and replaced by the existing [`useEstimatorInbox`](../src/hooks/useEstimatorInbox.ts) hook** it duplicated (parity-checked; only channel names differed — `dashboard-estimator-*` vs `checklist-estimator-*`, never co-mounted). The two card JSX copies collapsed into the one component. The card owns `dispatchRequestsOpen`/`estimatorRequestsOpen`.
- **What stayed in the parent:** both engines — `useDispatchInbox` 584 and `useEstimatorInbox` 594 (the dock + card gates read the eligibility flags; `DispatchDismissedItemsModal` needs `fetchDismissedDispatchInboxRows`; `dispatchAged` 587–593 feeds the Needs You card). `dispatchDismissedModalOpen` 573 + `DispatchDismissedItemsModal` 1531–1537 and `tripChargeTarget` 574 + `CreateTripChargeModal` 1538–1547 (rendered once; `onCreated` → `refreshInvoicesRef.current()`).
- **Supabase / realtime (estimator, via the hook):** `estimator_group_members`, `estimator_requests`, `estimator_request_dismissals`, `estimator_request_notes`, RPC `estimator_inbox_note_stats`; realtime `checklist-estimator-requests` + `checklist-estimator-request-notes`.
- **Sub-components:** `DispatchInboxSection`, `EstimatorInboxSection`, `HelpFeedbackInboxSection` (dev-only) inside the card; the two modals parent-side.
- **Tests:** `dispatchInboxAging` 7; no smoke; the two inbox hooks are untested.

### 8. Billing Pipeline (field collect queue + Ready to Bill + Billed Waiting for Payment)

- **Status: extracted (v2.728)** → [`DashboardBillingPipelineSection.tsx`](../src/components/dashboard/DashboardBillingPipelineSection.tsx) (789 lines), now **one mount** at 1646–1651 (gate `isAssistantLike(role) || dev || master`, `dash-billing` anchor 1648), below Assigned Jobs since v2.784 — the two role-branch positions it had at v2.728 are gone (quirk #1). Data engine [`useDashboardBillingInvoices`](../src/hooks/useDashboardBillingInvoices.ts) (461 lines, 397–421 — **kept in the parent**, v2.727 seam; kernels + row types in [`lib/dashboardBillingInvoiceUnits.ts`](../src/lib/dashboardBillingInvoiceUnits.ts), 33 tests).
- **What moved (v2.728):** the `BillingPipelineCard` render — Stage 1 `DashboardFieldCollectPaymentQueue` (`authUserId`-gated), Stage 2 "Ready to Bill (`readyToBillDashboardUnits.length`)" (quirk #5), Stage 3 "Billed Waiting for Payment" — plus `readyToBillExpanded`/`waitingForPaymentExpanded`, `ReadyToBillJobIconToolbar`, and the single-opener modal cluster: `BilledPaymentConfirmationModal` ×2, the send-back invoice confirm (`DELETE_DRAFT_BILL_LABEL`) and send-back job confirm (`sendBack*`), the send-back status-event + explainer-reset effects, and `useSendBackCollectPaymentFlowNotice`. The component calls `useToastContext()` and `useJobFormModal()` itself.
- **What stayed in the parent (and why):** the seam call + destructure (incl. `readyToBillLoaded`, v2.3801, for the pinned row's `readyToBillCount`); `refreshInvoicesRef` 424–425 (render-body assignment, quirk #10); `sendRecordJobMeta` 466 + its job-fetch effect 902–973 (`jobs_ledger` → `billCustomer.openBillCustomer`) + "Loading job…" overlay 1845–1849 (**also opened by `handlePrepareBillFromFieldQueue` 993–1022**, which resolves via the tested `resolveReadyToBillBillCustomerTarget`); `openDashboardBillCustomerInvoice` 975–991; the `readyForBillingJob` Send-to-Billing confirm (463–465 state, inline modal 1780–1844, opened from Assigned/Superintendent rows; runs `moveJobToReadyToBillWithStripePrep`); `openReadyToBillEditJob` 869–874, `openReadyToBillDetailJobModal` 886–900; `setViewReportsJob`. Everything passes via `billingPipelineSectionProps` 1029–1051.
- **Membership rule (v2.2846):** the Stage 2 / Stage 3 unit builders (`buildReadyToBillDashboardUnits`, `buildBilledWaitingDashboardUnits`) drop invoice rows whose parent job is `paid` (`InvoiceForDashboard.job_status`) so the Dashboard counts agree with the Pipeline board; see `docs/BILLING_FLOWS.md` → Surfaces.
- **Supabase / RPCs (via the seam + component):** `jobs_ledger_invoices` (`DASHBOARD_INVOICES_JOBS_LEDGER_SELECT`), `jobs_ledger_payments`, `jobs_ledger`, `job_status_events`; RPCs `get_jobs_ledger_by_status`, `update_job_status`, `delete_billed_invoice_on_send_back`, `delete_ready_to_bill_invoice`; Stripe void/prep via `lib/voidStripeInvoiceForRevert`.
- **Tests:** `dashboardBillingInvoiceUnits` 33, `buildReadyToBillDashboardUnits` 13. **Gaps:** no smoke for the section; `useDashboardBillingInvoices` (money writes: status moves, send-back, delete) has no test; the Send-to-Billing confirm is inline and untested.
- **Next:** `SendToBillingConfirmModal` — lift 1780–1844 with `readyForBillingChecked1/2` inside it (reset on mount); the parent keeps `readyForBillingJob` and passes `jobStatusUpdatingId` + `moveJobToReadyToBillWithStripePrep`; the Assigned/Superintendent sections then drop their two `setReadyForBillingChecked*` props.

### 9. My Schedule (all roles)

- **Status: extracted (v2.724)** → render in [`DashboardMyScheduleSection.tsx`](../src/components/dashboard/DashboardMyScheduleSection.tsx) (782 lines), data engine [`useDashboardSubSchedule.ts`](../src/hooks/useDashboardSubSchedule.ts) (**kept in the parent**, 379–392 — quirk #11); Stage-A kernel [`dashboardSubSchedule.ts`](../src/lib/dashboardSubSchedule.ts) (`dedupeSubScheduleBlocks`, `subScheduleJobLabel`, `partitionSubScheduleBlocksByDay`, `sortSubScheduleBlocksByStart`, `SubScheduleDayPartition`; 15 tests).
- **Render location:** the `myScheduleSection` element 1119–1138, mounted in the pinned row's `afterJobReportRow` slot 1404 (directly below the Job Report row, all roles — v2.805) and in the Job Mode return 1182 (below the job card — v2.916). The root carries the `dash-my-schedule` dock anchor.
- **Props now:** `reportCountByJobId`, `setViewReportsJob`, `role`, `firstAssistantDispatchPhone`, the hook's `subScheduleLoading`/`DayPartition`/`Labels`/`Phones`/`JobMeta`/`leaveReportReminderForJobRow`/`reloadSubSchedule` (self-scheduling, v2.1568), `assignedJobs`, `assignedReadyToBillJobs`, `detailModalAssignedJobsRows` (849–852), `submitLinkJobPicturesDispatchRequest` (876–884), `setLeaveReportJob`.
- **What moved to the hook:** rows/loading, labels, phones, the 60 s `scheduleReminderNow` interval, the schedule-blocks loader (`fetchScheduleBlocksForAssigneeDateRange`), labels + phones effects (`jobs_ledger`), `subScheduleDayPartition` + `leaveReportReminderForJobRow` (via tested `shouldShowLeaveReportScheduleReminder`). The hook calls `useToastContext()` itself.
- **What moved to the component:** the whole render; it calls `useJobDetailModal()` itself.
- **Quirk #11:** the loader gate stays `canLeaveJobFieldReport(role)` — the rows power the leave-report reminder icons on the job-row sections.
- **Relocation note (v2.724):** `DashboardJobPicturesLinkRow` + `DashboardLeaveReportButton` moved verbatim to their own files in [`src/components/dashboard/`](../src/components/dashboard/DashboardJobPicturesLinkRow.tsx); the `DashboardTeamAssignedJobRow` type to [`lib/dashboardTeamAssignedJobRow.ts`](../src/lib/dashboardTeamAssignedJobRow.ts).
- **Supabase:** `job_schedule_blocks` (via lib), `jobs_ledger` (labels + phones) — all via the hook.
- **Tests:** `dashboardSubSchedule` 15, `dashboardScheduleCardLines` 6, `DashboardMyScheduleSection` smoke; the hook is untested.

### 10. My Bids

- **Status: extracted (v2.718)** → [`DashboardMyBidsSection.tsx`](../src/components/dashboard/DashboardMyBidsSection.tsx) 1584–1589; Stage-A kernel [`dashboardMyBids.ts`](../src/lib/dashboardMyBids.ts) (`isMyBidStreamUnread`, `bucketMyBidSubmissionsFromOthers`/`bucketMyBidCustomerContactsFromOthers`, `collectMyBidNoteAuthorIds`, `buildMyBidRows`, `myBidRolesForUser`, formatters, `MY_BID_OTHERS_VISIBLE_STEP`/`MY_BIDS_DASHBOARD_ROW_LIMIT`, `MyBidRow` types — 17 tests; `formatRelativeCompactAgo` takes `now` defaulting to `new Date()`).
- **What moved:** all ~10 state vars (incl. `dashboard_my_bids_hidden_${uid}` localStorage), the loader effect, `hideBid`/`unhideBid`, `markMyBidNotesReadAsViewed` (`upsertBidNotesReadWatermark`), `adjustMyBidOthersLimit`, `toggleMyBidOthersNoteDetails`, `myBidsVisibleCount`, and the render incl. the `dash-bids` anchor. The component calls `useBidPreview()` and `useToastContext()` itself.
- **What stayed in the parent:** the dock entry's role half (1251–1257); its data half comes up via `onContentVisibleChange` into `myBidsDockHasContent` (577). The component self-gates on role.
- **Quirks preserved:** #12. (#8 resolved v2.2634.)
- **Supabase:** `bids` (estimator/AM filter, non-lost, limit 50), `user_bid_notes_read_state`, `bids_submission_entries`, `customer_contacts`, `users`, `service_types` (join).

### 11. Recent Reports

- **Status: extracted (v2.717)** → [`DashboardRecentReportsSection.tsx`](../src/components/dashboard/DashboardRecentReportsSection.tsx) 1590–1594 (props `authUserId`, `role`, `submitLinkJobPicturesDispatchRequest`); Stage-A kernel [`dashboardRecentReports.ts`](../src/lib/dashboardRecentReports.ts) (`recentReportsUnreadCount` + `recentReportsVisibleRows` + `isDashboardRecentReportsRole`; 14 tests).
- **What moved:** all ~11 state vars (incl. `pipetooling_dashboard_hide_on_refresh_ids`), the `report_enabled_users` check, the loader + `loadRecentReportsRef`, the `dashboard-reports-changes` realtime channel, the unread→all auto-switch and persist effects, the render (with the `dash-reports` anchor), and the **dead `ReportEditModal` wiring, moved wholesale unchanged** (quirk #6).
- **What stayed in the parent:** `showRecent` 1060 (the dock reads it). `NewReportModal` lives in the pinned row since v2.723.
- **Supabase / realtime:** RPC `list_reports_with_job_info` (also fetched by the parent's report-count engine — §20), `report_reads`, `report_enabled_users`; realtime `dashboard-reports-changes` on `reports`.
- **Tests:** `dashboardRecentReports` 14; `DashboardRecentReportsSection.primary` smoke.

### 12. Team Ready to Bill (assigned RTB jobs, field roles)

- **Status: extracted (v2.726)** → [`DashboardTeamReadyToBillSection.tsx`](../src/components/dashboard/DashboardTeamReadyToBillSection.tsx) 1597–1609; Stage-A kernel [`dashboardJobRowActivity.ts`](../src/lib/dashboardJobRowActivity.ts) (shared by the job-row family: `formatTimeSince`, `subcontractorAssignedJobStageDisplay`, `subcontractorLastActivityTypeLine`, `subcontractorLastActivityBlock`; 19 tests; `now` defaults to `new Date()`; `formatDatetime` stays in `dashboardProjectsCard.ts`).
- **What moved:** the `isDashboardTeamReadyToBillRole(role)`-gated render — "Ready to Bill (`assignedReadyToBillJobs.length`)" (**quirk #5's second heading**), `assignedReadyToBillExpanded`, job rows, plus `collectPaymentJob` + `CollectPaymentModal` (single opener; `onFlowChanged` → `refreshAssignedReadyToBill`). The `dash-ready-to-bill` anchor (with `collapseStorageKey="dash-ready-to-bill-collapsed"`) is on the section's card.
- **What stayed in the parent (and why):** the [`useDashboardAssignedJobs`](../src/hooks/useDashboardAssignedJobs.ts) seam (355–368) passed as props; `reportCountByJobId` (§20); the shared openers `setViewReportsJob`, `setLeaveReportJob`, `setSubcontractorJobActivityModalJob`; `openJobDetailFromDashboardJobRow` 854–867; `leaveReportReminderForJobRow`; `isMobile`. `submitLinkJobPicturesDispatchRequest` is not a prop here.
- **Supabase:** RPC `list_ready_to_bill_assigned_jobs_for_dashboard` (via the hook).
- **Sub-components:** `DashboardJobPicturesLinkRow`, `DashboardLeaveReportButton`, `CollectPaymentModal`; tested libs `dashboardJobRowActivity`/`subcontractorJobActivityCopy`/`subcontractorLastActivityCompact`.
- **Tests:** kernel 19; `DashboardTeamReadyToBillSection` smoke; `useDashboardAssignedJobs` untested.

### 13. Assigned Jobs

- **Render location:** 1623–1644, gate `assignedJobsLoading || assignedJobs.length > 0` → `DashboardAssignedJobsSection` (its `DashboardGroupCard` carries `id="dash-assigned-jobs"` + `collapseStorageKey="dash-assigned-jobs-collapsed"`).
- **Owned local state (parent, single-consumer):** `assignedJobsSearch` 370 + `filteredAssignedJobs` memo 371–377 (v2.841; `billingJobMatchesSearch` from `lib/jobs/billingTab`, 13 tests). Only this section reads them.
- **Cross-section/shared state:** writes `viewReportsJob`, `leaveReportJob`, `subcontractorJobActivityModalJob`, **`readyForBillingJob` + `readyForBillingChecked1/2`** (Send-to-Billing confirm, shared with Superintendent Jobs); reads `reportCountByJobId`, `jobStatusUpdatingId`, `formatDatetime` (prop); `assignedJobs` is also read by My Schedule, `detailModalAssignedJobsRows`, the jobs map, Superintendent dedupe, and reloaded by `updateJobStatus`/`refreshDashboardAssignedJobLists`.
- **Handlers/loaders:** in `useDashboardAssignedJobs` (v2.725): RPC `list_assigned_jobs_for_dashboard` + `refreshDashboardAssignedJobLists` (all three lists).
- **Sub-components:** shared row pieces in [`dashboardJobRowShared.tsx`](../src/components/dashboard/dashboardJobRowShared.tsx) + `DashboardJobPicturesLinkRow`/`DashboardLeaveReportButton`; "Send to Billing" hidden for sub-like roles (`subcontractor`, `helpers` — v2.2070).
- **Tests:** `DashboardAssignedJobsSection` smoke; `billingTab` 13.
- **Extraction status:** render extracted (v2.1004, verbatim lift); data seam done (v2.725). **Next:** move `assignedJobsSearch` + `filteredAssignedJobs` into the section (tab-local state moves with the tab; the section is conditionally mounted, so the query now resets when the list empties — the list is gone then anyway).

### 14. Upcoming inspection

- **Status: extracted (v2.716)** → [`DashboardUpcomingInspectionsSection.tsx`](../src/components/dashboard/DashboardUpcomingInspectionsSection.tsx) 1653–1657; Stage-A kernel [`dashboardUpcomingInspections.ts`](../src/lib/dashboardUpcomingInspections.ts) (date-line formatting, 6 tests).
- **What stayed in the parent:** only the thin wrapper — `authUserId`, `role`, and `inspectionsButtonVisible` (`dashboardButtonVisibility?.inspections !== false`, quirk #9). The component takes `role` (not a precomputed gate) so the loader's effect deps stay `[authUserId, role]`.
- **Note:** the component imports `toLocalDateString` from `lib/dailyGoalsGate`; Dashboard's module-level copy is gone.
- **Supabase:** `inspections` (today..+2 days).

### 15. Superintendent Jobs

- **Render location:** 1659–1673, rendered unconditionally; the component self-gates on `role === 'superintendent'`, h2 "Superintendent Jobs". Rows are `superintendentJobs` **minus** any id already in `assignedJobs`.
- **Owned local state:** `superintendentJobsExpanded` 378 (parent-owned controlled prop, single consumer); list + loading live in `useDashboardAssignedJobs` (RPC `list_superintendent_jobs_for_dashboard`).
- **Cross-section/shared state:** dedupes against `assignedJobs`; writes `viewReportsJob` + `readyForBillingJob` (+ checked setters); reloaded by `updateJobStatus`/`refreshDashboardAssignedJobLists`.
- **Tests:** none (no smoke).
- **Extraction status:** render extracted (v2.1004); data seam done (v2.725). **Next:** move `superintendentJobsExpanded` into the section.

### 16. Projects (Assigned Stages + Subscribed Stages)

- **Status: extracted (v2.721)** → [`DashboardProjectsCard.tsx`](../src/components/dashboard/DashboardProjectsCard.tsx) 1674–1688 (gate `projectsCardVisible` 1058–1059); Stage-A kernel [`dashboardProjectsCard.ts`](../src/lib/dashboardProjectsCard.ts) (`formatDatetime` / `daysOpen` / `personDisplay`, 13 tests). `formatDatetime` is imported back into `Dashboard.tsx` for the Assigned Jobs prop.
- **What moved:** the `DashboardGroupCard id="dash-projects"` render, the three reject/skip/set-start step modals with their state, the expand toggles + one-shot ref + heuristic effect, the `activeAssignedSteps`/`completedAssignedSteps` memos, and the **workflow-step action engine** (`recordAction`, `findPreviousStep`/`findNextStep`, `markStarted`/`submitSetStart`, `markCompleted`, `markApproved`, `submitReject`, `submitSkip`). The card calls `useToastContext()` and `useEditProjectModal()` itself.
- **What stayed in the parent:** the `useDashboardBoot` seam outputs; the gates `showAssigned` 1055 / `showSubscribed` 1056 / `projectsCardVisible` (dock); `getCurrentUserName`.
- **Quirks preserved:** #14; identity is by user **name** (`get_assigned_steps_*(p_user_name)`, `performed_by`).
- **Supabase / RPCs:** step lists via the boot hook (RPCs `get_assigned_steps_with_projects_for_dashboard` + fallback `get_assigned_steps_for_dashboard`); the engine writes `project_workflow_steps` + `project_workflow_step_actions`, walks `project_workflows`/`projects`.

### 16a–c. Born-external cards (zero parent state)

| Card | Lines | Gate | Reads | Tests |
|---|---|---|---|---|
| `DashboardTrialVerdictSection` (lazy, v2.3650) | 1361–1363, 1171–1173 | `canEverLeadTrialHelper` (master, helpers, subcontractor); nothing until a trial helper led today clocks out | RPC `trial_helpers_i_led_today` (via `useTrialVerdictFeed`); scrolls to `#trial-verdicts` from the push | none |
| `DashboardPartnerLedgerSection` | 1692 | live partnership (self-gated, fail-soft) | `usePartnerLedger` hook | smoke |
| `DashboardPartnerJobsSection` | 1696 | same | RPCs `get_my_partner_jobs` / `get_partner_jobs_as`, `get_my_partner_job_costing` / `get_partner_job_costing_as` | none |
| `DashboardSubMoneySection` (v2.1212) | 1700 | `visible={isSubcontractorLikeRole(role)}` | `people_labor_jobs`, `people_labor_job_items`, `people_labor_job_payments`, `step_commitments`, `project_workflow_steps`; writes via RPC `respond_to_work_order` (accept/decline an offer); fail-soft | none |
| `DashboardPersonReportCard` (v2.2235) | 1705–1708 (`dash-hr-report` anchor 1706) | `visible` = dev/master | `people`, `person_reports` (insert) | none |
| `DashboardDevRejectedNotification` | 1530 | `isDev && authUser?.id` | self | none |
| `DashboardMyVehicleCard` (v2.1648) | 1737 | renders null unless the user holds a vehicle | self | smoke |

### 17. My Team

- **Render location:** lazy `DashboardMyTeamSection` in `Suspense` (fallback `MyTeamSectionSkeleton`) 1710–1719, fed `myTeam` + `showPendingBannerAtTop={pendingClockBannerAtMyTeamTop}` + `onGoToPendingSessions` + `canApprove={canApproveHours}`.
- **Owned local state (parent):** `isPayApprovedMaster` 173 (effect 174–186, `pay_approved_masters`). Its only reader is `canApproveHours` 187, and only this section's `canApprove` prop reads that, so both could move into the section.
- **Extraction status:** **Done.** `useDashboardMyTeamSectionState` stays in the parent (shared with the strip cluster and pending banners).
- **Membership (v2.3616 Supervision):** `team_leader_assignments` is no longer read. With `supervisedMembershipEnabled` (dev / master / assistant-like — `showClockStripScopeToggle`) the roster is the distinct crew of `get_supervised_days_payload(this week)`; otherwise empty (the section hides). `canApprove` (dev, assistant-like, pay-approved master via the `pay_approved_masters` read at 174–186) gates the pending banner, the header chip and the whole `#dashboard-my-team-pending` block; the per-member notify bell is gone.

### 17b. My crew (Supervision, v2.3613)

- **Render location:** lazy `DashboardSupervisorSection` in `Suspense` 1720–1724, right after My Team, gated `role ∈ {master_technician, helpers, subcontractor}` and fed `authUserId`, `role`, `onLeaveReport={setLeaveReportJob}` (the Dashboard's `AdditionalReportModal` door).
- **What it reads:** `get_supervised_days_payload(p_from, p_to)` (SECURITY DEFINER; `supervisor: false` for anyone who cannot run a job) → `buildSupervisedView` (`src/lib/people/supervisedDays.ts`): reports owed, reports filed, the crew's hours by person and day. Renders nothing for a non-supervisor or an empty week. Week pager. No Approve anywhere. **Rate my crew** (v2.3614): this month's count from `get_supervisor_review_deck` and a button opening `RateMyCrewDeck` (`team-feedback/`), which upserts `team_member_reviews` rows with `source = 'supervisor'` (kernel `lib/people/supervisorReviews.ts`).
- **Tests:** `DashboardSupervisorSection` smoke. **Extraction status:** **Done** (born external).

### 18. Me / My Time

- **Render location:** `dash-me` anchor 1727 + `DashboardMyTimeSection` 1728–1734 (`hoursDaysCorrect={hoursDaysCorrectSet}`, `disableDayEditor={dashboardSelfIsSalary}`); the helpers' clock strip mounts at 1726, directly above; `DashboardMyVehicleCard` 1737 below.
- **Extraction status:** **Done.** Parent keeps `hoursDaysCorrectSet` (shared with the strip editors) and `dashboardSelfIsSalary` (shared with the clock wiring).

### 19. Modal tail

Shared modals that stay page-level (opened from 2+ sections) vs single-opener modals that moved with their section:

| Modal | Lines | Opened from | Stays / moves |
|---|---|---|---|
| `QuickEstimateWizard` | 1350 | Estimate/Change Order button | stays until §1b's button component |
| `CrewReviewDeck` | 1442–1450 | Rate your crew button | moves with `DashboardRateYourCrewButton` |
| `DashboardContractSigningPromptModal` | 1451–1457 | clock-in success + salaried-visit effect | moves with `useContractSigningPrompt` (the hook returns its props) |
| `DashboardMyTimeDayEditorModal` (`stripMyTimeEditor`) | 1499–1529 | strip (×3 mounts) + `ClockInOutButton` preview | stays (strip cluster) |
| `DispatchDismissedItemsModal` / `CreateTripChargeModal` | 1531–1537 / 1538–1547 | Teams Inbox ×2 | **stay** |
| `ApplyScheduleApprovedConfirmModal` | 1739 | clock strip (`applySchedule`) | stays (hook-owned) |
| `JobReportsModal` (`viewReportsJob`) | 1741–1753 | Billing, My Schedule, Team RTB, Assigned, Superintendent | **stays** |
| `SubcontractorJobActivityModal` | 1754–1762 | Team RTB + Assigned rows | stays (job-row family) |
| `AdditionalReportModal` (`leaveReportJob`) | 1763–1779 (+ Job Mode copy 1201–1217) | My Schedule, Team RTB, Assigned, My crew, Job Mode card | **stays**; hoist the element (quirk #15) |
| Send-to-Billing confirm (`readyForBillingJob`, inline) | 1780–1844 | Assigned + Superintendent rows | stays as state; **JSX → `SendToBillingConfirmModal`** |
| `sendRecordJobMeta` "Loading job…" overlay | 1845–1849 | billing section + `handlePrepareBillFromFieldQueue` | **stays** |
| `NewReportModal`, `DashboardStaleTallyStaffFollowUpModal` | (moved v2.723) | pinned row | moved into `DashboardPinnedQuickRow` (`renderModals`) |
| `ChecklistItemMuteModal`, Forward modal | (moved v2.722) | My Inbox | moved into `DashboardMyInboxCard` |
| `CollectPaymentModal` | (moved v2.726) | Team RTB rows | moved into `DashboardTeamReadyToBillSection` |
| `BilledPaymentConfirmationModal` ×2, send-back invoice/job confirms | (moved v2.728) | Billing Stages 2+3 | moved into `DashboardBillingPipelineSection` |
| `ReportEditModal` | inside `DashboardRecentReportsSection` 494–505 | **nothing** (dead — quirk #6) | note only |

### 20. Report-count badges (inline engine, v2.1547)

- **Location:** `reportCountByJobId` 428 + `loadDashboardReportCounts` 429–438 (RPC `list_reports_with_job_info`, counted per `job_ledger_id` client-side) + mount effect 439–441.
- **Consumers:** `reportCountByJobId` prop on My Schedule (1121), Team RTB (1598), Assigned Jobs (1625) — the Leave Report corner badges.
- **Refreshers (5):** `ClockInOutButton.onFieldReportSaved` ×2 (1165, 1385), `AdditionalReportModal.onReportSaved` ×2 (1209, 1771), `JobReportsModal.onReportSaved` (1751).
- **Cost:** for Recent-Reports roles the page fetches the full `list_reports_with_job_info` result twice on mount (here and in `DashboardRecentReportsSection` 103) just to count here.
- **Tests:** none. **Approach:** `useDashboardReportCounts(authUserId)` → `{ reportCountByJobId, reload }`; better, a server-side per-job count RPC so the badge stops pulling every visible report row.

### F. `DashboardFinancialsSection.tsx` internal regions

**1,824 lines** · 4 components (`ApBillModal`, `SendToDispatchModal`, `ItemsModal`, exported `DashboardFinancialsSection`) · 18 `useState` · 3 effects · 1 `useMemo` · 0 `useCallback`/`useRef` · 8 custom-hook calls · 28 local imports · 41 commits in 90 days (last `bdfc1297e`, 2026-09-07). Imported by `Dashboard.tsx` (interstitial slot, with `overheadCard`) and `DispatchModeHome.tsx:148` (no overhead card). The totals come from [`useDashboardFinancials`](../src/hooks/useDashboardFinancials.ts) (388 lines; also used by `src/pages/Bridge.tsx` for dev), whose kernels are [`lib/dashboardFinancials.ts`](../src/lib/dashboardFinancials.ts) (`buildArBuckets` → `computeBillTruth`, `buildApBucket`, `buildApBucketFromAggregates`, `mergeUpcomingIntoAp`, `buildUnbilledBucket`, the two redactors; 36 tests in `dashboardFinancials.test.ts`, incl. both `payroll:aggregate` producers — the hook itself is untested).

**Parent contract:** props `{ overheadCard?: React.ReactNode }` (default `null`, rendered as a fourth grid tile after the three cards, 1763). Everything else is self-loaded: `useAuth` (role, user), `useDashboardFinancials(true, undefined, role, authUser?.id)`, `useJobDetailModal`.

**Data:** the hook reads `jobs_ledger`, `jobs_ledger_invoices`, `supply_house_invoices`, `pay_stubs`, `users`, `people_pay_config`, RPC `get_dashboard_payroll_totals` (assistant path), `jobs_ledger_payments`, `pay_stub_payments`, `pay_stub_deductions`, `pay_stub_additional_lines`, `supply_house_invoice_job_allocations`, `jobs_ledger` (allocation labels), plus `fetchSubLaborDueJobRows` and `loadUpcomingClockSessions`. The file itself reads `jobs_ledger_fixtures` (554–577) and three RPCs the fact sheet does not list because they are called `as never`: `get_billed_customer_pay_speeds` (496–508), `list_payment_chase_touches` + `list_job_promised_pay_dates` (522–538, office roles only via `canChase` 518). `SendToDispatchModal` writes via `createDispatchRequest` (`pendingAction: 'bill_out_job'`).

| Region | Lines (size) | State / hooks | Status | Tests |
|---|---|---|---|---|
| Module: `CardKey` 46, `CARD_META` 48–67, `STAGES_SECTION_LINKS` 70–74 (deep links read by Jobs `?stagesSection=`), `shortDate` 76–81, `oldestShortWithAge` 84–90 | 46–90 | — | inline | none (`daysPastDue` is tested in `supplyHouseAging` 16) |
| `ApBillModal` — invoice facts + expandable Google Drive preview; job rows open Job Detail | 93–279 (187) | `expanded` 103; `factRow` 107–112 | inline, zero coupling | none |
| `SendToDispatchModal` — Not-billed "→" composer | 282–407 (126) | `note` 285, `busy` 286; `useAuth`, `useToastContext`; `send` 288–312 | inline, zero coupling | `dispatchRequestHelpers` 3 (`buildUnbilledDispatchTitle` only; `send` untested) |
| `ItemsModal` — the drill-down for AR / AP / Not billed | 409–1577 (1,169) | 12 `useState`, 3 effects, 1 memo, `useIsMobile`/`useAuth`/`useNavigate`, 21 inner functions | inline | see rows below |
| ↳ section partition `sections` (Not billed: Ready to Bill / Working by `sublabel`; AP: Team payroll `stub:` / Sub labor `sublabor:` / Supplies `supply:`; AR: main + Collections) | 442–484 (43) | — | inline money-display logic | **untested** |
| ↳ AR Customers lens (v2.2571/2572): `arView` 494, `arPaySpeeds` 495 + effect 496–508, `arRollup` memo 511–514, `arChaseTouches`/`arPromises`/`arChaseRefresh` 519–521 + effect 522–538, `arViewToggle` 796–806, `arCustomersViewEl` 820–852 | ~120 | 5 state, 2 effects, 1 memo | inline; renders extracted `DashboardArCustomersView` (401 lines) + `DashboardArCallCard` (243) | `arCustomerRollup` 8, `arCustomerChase` 9, `billedExpectedPay` 20, `paymentChase` 18 |
| ↳ line items (v2.1595/1597/2247): `arLinesByJob` 544 + fixtures effect 554–577 (also read by the lens's call card), `collapsedArLineKeys` 546, `toggleArLineKey` 547–553, `arRowExtras` 579–586, `amountContextLine` 610–623, `doneNothingBilledPill` 624–641, `arLineItemsBlock` 654–713, `arBillExtras` 808–819 | ~170 | 2 state, 1 effect | inline | `arModalLineItems` 4, `dashboardFinancialsPctComplete` 3 |
| ↳ payroll rows (v2.1596): `expandedLineKeys` 545 + `toggleLineKey` 587–593 (a person-group's open weeks — read only by the payroll-group rows in both copies), `openPayrollLedger` 597–598 (→ `/people?tab=pay_stubs&payrollSearch=`), `groupAgingItem` 599–607, `payrollLinkStyle` 642–653 | ~55 | 1 state | inline | `apPayrollGroups` 5 |
| ↳ shared drill calc (v2.1483/1484): `drillQuery` 489 (also the lens's `query`) + `drillSort` 490, `agingFilter` 715, `collapsedSections` 720, `drillSections` 729–738 (splices the AP upcoming estimate after Team payroll), `bucketMatches`/`shownSections`/`shownCount`/`shownTotal`/`totalItemCount`/`agingBuckets`/`agingChip` 740–776, `footerTotalLabel` 777–782, `pillStyle` 783–793 | ~80 | 4 state | inline | `dashboardFinanceModalRows` 7 (filter/sort/aging); **`shownTotal`, section splice and footer label untested** |
| ↳ phone sheet (`if (isMobile)` early return) | 857–1157 (~300) | — | inline, parallel copy of the desktop rows | none |
| ↳ desktop dialog (aging strip `agingStripMeta`, `toneColors` 1165–1181, `thStyle` 1182–1190; render 1191–1576) | 1159–1576 (~418) | — | inline | none |
| `DashboardFinancialsSection` (export) | 1581–1824 (244) | `openCard` 1584, `dispatchItem` 1585, `apBill` 1586 | inline | none (no smoke) |
| ↳ `cards` (per-card aging buckets + detail-line copy: invoices/Collections/excluded for AR; Supply·Subs / Team (+ est. payroll) for AP; unbilled job count) | 1594–1657 (64) | — | inline money copy | **untested** (`financeCardAging` 6 covers `financeCardBarSegments`/`financeCardRisk`; `formatMoneyShortK` 5) |
| ↳ render: card grid 1666–1764, `ItemsModal` 1766–1804, `ApBillModal` 1805–1820, `SendToDispatchModal` 1821 | 1659–1823 (165) | — | inline | none |

**Risks / preserve:**
- **Assistant Payroll row (fixed v2.3832):** the AP partition is `partitionApDrillItems` (`lib/apPayrollGroups.ts`, tested) — Team payroll takes `stub:` **and** `payroll:aggregate`, the one line an assistant gets from `buildApBucketFromAggregates` / `redactApPayrollItems`. Before, the aggregate matched no section, so an assistant's drill-down omitted Payroll while the card headline and footer total counted it.
- **Redaction keys on `role === 'assistant'`** (1771, 1788; the hook's `assistantAggregates` 109), not `isAssistantLike`. This is on purpose: controller has dev-level financial reads ([ACCESS_CONTROL.md](./ACCESS_CONTROL.md)). Keep it.
- **Modal stacking:** these modals sit above the Job Detail backdrop (z 1004) — `ItemsModal` at z 1100, `ApBillModal` / `SendToDispatchModal` at 1110 — so every job opener closes them first (1776–1777, 1812–1814).
- The fixtures effect's deps are `[cardKey]` with an exhaustive-deps disable (576): one fetch per open. Keep it.
- The phone sheet and desktop dialog each carry their own copy of the row markup. A fix to one (a pill, a total, a link) has to land in both.

**Extraction order for this file** (merged into the page ranking below): F-A1 partition kernel → F-B1 verbatim moves of `ApBillModal`/`SendToDispatchModal` → F-A2 `buildFinanceCards` → F-B2 `ItemsModal` to its own file, then `useArCustomersLens` + `useFinanceDrillState` and presentational phone/desktop children.

---

## Shared substrate

### Hooks already extracted (consumed by Dashboard)

| Hook | Owns | Consumed by |
|---|---|---|
| [`useDashboardMyTeamSectionState`](../src/hooks/useDashboardMyTeamSectionState.ts) (1,467 lines, 188) | pending/org-wide clock sessions, clocked-in-today rows, jobs-worked-today, synthetic salary sessions, `loadPending`, supervised roster | clock strip (×3 mounts), pending banners ×2, My Team, strip editor callbacks — **the page's `useBidPricingEngine` analog; stays in parent** |
| [`useDashboardBoot`](../src/hooks/useDashboardBoot.ts) (337–351) | user name/`userNames`, today checklist, assigned/subscribed steps, boot cache, `loadAssignedSteps` | My Inbox, Projects, `clockDisplayName` |
| [`useDashboardAssignedJobs`](../src/hooks/useDashboardAssignedJobs.ts) (355–368) | the three job lists + setters + `refreshDashboardAssignedJobLists` + resync ref | Assigned, Team RTB, Superintendent, jobs map, My Schedule, billing seam |
| [`useDashboardSubSchedule`](../src/hooks/useDashboardSubSchedule.ts) (379–392) | schedule rows, labels, phones, job meta, reminders | My Schedule + job-row reminder icons |
| [`useDashboardBillingInvoices`](../src/hooks/useDashboardBillingInvoices.ts) (397–421) | invoices/jobs, loaders, `refreshInvoices`, `updateJobStatus`, revert/delete, locks | Billing section, pinned row (`readyToBillCount`), Send-to-Billing confirm, trip charge, job-edit callbacks |
| [`useDispatchInbox`](../src/hooks/useDispatchInbox.ts) (584) | dispatch requests engine | Teams Inbox ×2, `DispatchDismissedItemsModal`, `dispatchAged` → Needs You |
| [`useEstimatorInbox`](../src/hooks/useEstimatorInbox.ts) (594) | estimator requests engine | Teams Inbox ×2 (adopted v2.719); also `ChecklistReviewInboxes`, `DispatchModeInbox`, `DispatchModeFooter` |
| `useApplyScheduleProportions` (192) | apply-schedule flow + confirm modal state | clock strip |
| `useJobModeEnabled` (451) | job-mode flag | page fork + first-run card |
| `useWeeklyTeamLaborTotal`, `useBilledTotal`, `useSupplyHousesAPTotal`, `useSubLaborDueTotal` (648–651) | financial pin totals (the last three keyed on `financialRefreshKey`) | parent → `DashboardPinnedQuickRow` props |
| `useAuth`, `useIsMobile`, `useDocumentVisibility`, `useFirstAssistantDispatchPhone`, `useRealtimeChannel` | cross-cutting | `useAuth`/`useIsMobile` page-wide; `useDocumentVisibility` (140) + `useRealtimeChannel` (841) only the financial-pins machinery (§3); `useFirstAssistantDispatchPhone` (336) only My Schedule |
| Contexts in the parent: `useToastContext`, `useJobFormModal`, `useJobDetailModal`, `useBillCustomerModal` (596) | app-level modals | billing glue, inbox openers, job rows (children also call `useBidPreview`, `useEditProjectModal` themselves) |

### Data engines

| Engine | Anchor | Feeds | Status / candidate |
|---|---|---|---|
| Billing invoices/jobs | `useDashboardBillingInvoices` (v2.727) | Billing, field queue, Send-to-Billing, trip charge, pinned row | done (seam in parent) |
| Assigned-jobs trio | `useDashboardAssignedJobs` (v2.725) | job-row family, My Schedule, jobs map | done |
| Boot phase-1 | `useDashboardBoot` (v2.720) | My Inbox, Projects | done |
| Estimator inbox | `useEstimatorInbox` (v2.719) | Teams Inbox | done |
| Checklist CRUD | moved into `DashboardMyInboxCard` (v2.722) | My Inbox | done |
| My Bids loader | moved into `DashboardMyBidsSection` (v2.718) | My Bids | done |
| Recent reports loader + realtime + hide-on-refresh | moved into `DashboardRecentReportsSection` (v2.717) | Recent Reports | done |
| Sub-schedule loader | `useDashboardSubSchedule` (v2.724) | My Schedule + reminders | done |
| Workflow-step action engine | moved into `DashboardProjectsCard` (v2.721) | Projects | done |
| Tally / lost-bids loaders | moved into `DashboardPinnedQuickRow` (v2.723) | pinned row | done |
| **Report-count badges** | inline 428–441 | My Schedule, Team RTB, Assigned | `useDashboardReportCounts` (§20) |
| **Pins + financial-pin totals + realtime** | inline 354, 630–651, 699–711, 793–847 | pinned row | `useDashboardFinancialPins` (§3) |
| **Button prefs (visibility, placement, quick estimate)** | inline 461–462, 713–786 | pinned row, top buttons, Upcoming inspection | `useDashboardButtonPrefs` (§1b) |
| **Contract-signing prompt** | inline 519–571, 671–697 | clock-in success, salaried visit | `useContractSigningPrompt` (§4) |
| **Clock-strip orchestration** | inline 148–334, 597–629 | strip ×3, editor modal, My Time, clock preview | `useDashboardClockStrip` (§5) |
| **Financials data** | `useDashboardFinancials` (called inside §F) | Financials cards + drill-downs; Bridge | hook exists; no test |

### Parent-forever glue (no URL router exists)

- **No `?tab=` deep links.** Dashboard only links *out*. The analog is the **SectionDock** anchor registry (stays in parent). One inbound hash: `#trial-verdicts` (handled inside the trial section).
- **localStorage keys:** `dashboard_clock_strip_scope` (strip orchestration, parent); child-owned — `pipetooling_dashboard_hide_on_refresh_ids` (Recent Reports; legacy since v2.1469 — read once to migrate hidden ids into `report_reads.done_at`, then removed), `dashboard_my_bids_hidden_${uid}` (My Bids), `dash-assigned-jobs-collapsed` / `dash-ready-to-bill-collapsed` (`collapseStorageKey`), the day-scoped boot cache (`useDashboardBoot`).
- **Shared modal openers kept in the parent:** `leaveReportJob`, `viewReportsJob`, `subcontractorJobActivityModalJob`, `readyForBillingJob` (+ `Checked1/2` until the confirm extracts), `sendRecordJobMeta`, `tripChargeTarget`, `dispatchDismissedModalOpen`, `stripMyTimeEditor` — each opened from 2+ sections or wired to an engine; passed as callbacks.
- **`myTeam` / `applySchedule` / `hoursDaysCorrectSet` / `stripMyTimeEditor` / `dashboardSelfIsSalary`** — shared across strip, clock, Job Mode, Your record, My Team, My Time. (`canApproveHours` is read only by My Team — [§17](#17-my-team).)

---

## Duplicated-render quirks (preserve, don't fix)

Per the playbook's behavior-preserving rule, note these — do not "clean them up" during extraction:

1. **Billing Pipeline — resolved.** It used to render as two literal ~350-line copies (assistant/controller branch and dev/master branch). v2.728 collapsed them into one `DashboardBillingPipelineSection` mounted at both positions, and v2.784 merged those into a **single mount below Assigned Jobs** (1646–1651).
2. **Teams Inbox renders twice** with real differences: the non-assistant copy adds `HelpFeedbackInboxSection` (dev-only) and gates `onCreateTripCharge` to dev/master, while the assistant copy always passes `onCreateTripCharge`. (**Collapsed as of v2.719**: one `DashboardTeamsInboxCard` at both positions, the differences expressed as props.)
3. **Clock strip — mostly resolved (v2.1541).** One `clockActivityStripBlock` const is mounted at three mutually exclusive positions (1458 assistant-like, 1491 other non-helpers, 1726 helpers above My Time), and the day-editor modal renders once (1499). `DashboardMyTeamPendingBanner` is still written twice with identical props (1459–1465 and 1492–1498).
4. **`myInboxCard` is one JSX const rendered at three role positions** (1469, 1551, 1581, each after `crewDaySection`). The gates are mutually exclusive and exhaustive, so exactly one copy always mounts. That is required: the component's loaders drive the dock gate it reports up.
5. **Two different "Ready to Bill" headings exist**: Billing Stage 2 (invoice units) and the Team Ready to Bill section (`DashboardTeamReadyToBillSection`, assigned-jobs RPC). They are different features that share a name.
6. **Dead wiring: `ReportEditModal`.** Since v2.717 it lives in `DashboardRecentReportsSection`: `editReportModalOpen`/`reportForEdit` (74–75) are declared and rendered (494–505), but **no code ever sets them open**. Keep it during decomposition; delete it in a separate cleanup PR.
7. **`turnawayJob`/`TurnawayModal` exist only in the Job Mode early return.** After "Show full dashboard" there is no turnaway entry point.
8. **My Bids gate vs loader mismatch — RESOLVED (v2.2634).**
9. **Upcoming inspection is hidden by the `inspections` quick-button visibility flag** (`dashboardButtonVisibility?.inspections !== false`, 1656), even though the section is not a button. Keep this through the `useDashboardButtonPrefs` move. Related: the pinned row's tail modals never mounted in the Job Mode early return (`renderModals={false}`).
10. **Render-body ref assignments:** `refreshInvoicesRef.current = refreshInvoices` (424–425, parent) and the resync ref's `.current` (assigned inside `useDashboardBillingInvoices`'s body since v2.727) happen during render, not in effects. Every `refreshInvoicesRef` consumer is parent-side (edit-job/detail `onSaved`, the `sendRecordJobMeta` effect, `CreateTripChargeModal.onCreated`). Neither assignment may be converted to an effect.
11. **`subScheduleRows` loads for every leave-report-capable role.** The rows also drive the leave-report reminder icons on job rows, so the loader stays gated on `canLeaveJobFieldReport(role)` in `useDashboardSubSchedule`, which is called in the parent.
12. **`myBidsSectionExpanded` initializes from `role` at first render** *and* has a primary-collapse effect with a one-shot ref — both exist because `role` can arrive after mount (preserved in `DashboardMyBidsSection`).
13. **Recently Completed corner link only appears when `completedItems.length > 0`.** Its unread count filters out ignored task types first, then counts unread (preserved in `DashboardMyInboxCard`).
14. **The step reject/skip/set-start modals live inside `DashboardProjectsCard`**, whose render the parent wraps in `projectsCardVisible`. They cannot render while that is false, which is safe because they only open from inside the card.
15. **Elements written twice across the two returns** (only one return renders, so hoisting them into consts changes nothing): `ClockInOutButton` (1160–1167 ≡ 1380–1387; only the wrapper differs — hidden div vs `clockSlot`), `AdditionalReportModal` (1201–1217 ≡ 1763–1779), `DashboardTrialVerdictSection` (1171–1173 ≡ 1361–1363), `DashboardYourRecordCard` (1181 ≡ 1403). The hidden Job Mode clock mount itself is load-bearing (see §0).

---

## Recommended extraction order (value ÷ risk)

Verify `npm run typecheck && npm run lint && npm test` after every step; one section (or one Stage) per PR.

**Done (1–13):**
1. `upcoming-inspections` (v2.716)
2. `recent-reports` (v2.717)
3. `my-bids` (v2.718, Stage A `lib/dashboardMyBids.ts`)
4. `teams-inbox` (v2.719, `useEstimatorInbox` adopted)
5. seam `useDashboardBoot` (v2.720)
6. `projects-card` (v2.721)
7. `my-inbox` (v2.722)
8. `banners-pins-quick-actions` → `DashboardPinnedQuickRow` (v2.723)
9. `my-schedule` + `useDashboardSubSchedule` (v2.724)
10. seam `useDashboardAssignedJobs` (v2.725)
11. the job-row family: `lib/dashboardJobRowActivity.ts` + Team RTB (v2.726), then Assigned + Superintendent (v2.1004)
12. seam `useDashboardBillingInvoices` (v2.727)
13. `billing-pipeline` (v2.728; one mount since v2.784)

**Next, ranked on the `a05cef4c4` coupling data:**

14. **F-A1 `buildFinanceModalSections`** (Stage A, §F): lift `sections` 442–484 + the `drillSections` splice 729–738 + `footerTotalLabel` 777–782 into `lib/dashboardFinanceModalRows.ts` with tests, reusing `partitionApDrillItems` (the AP partition, already out and tested since v2.3832). High value, low risk.
15. **Move single-consumer state into the section that uses it**: `assignedJobsSearch` + `filteredAssignedJobs` → `DashboardAssignedJobsSection`; `superintendentJobsExpanded` → `DashboardSuperintendentJobsSection`. About 15 parent lines; nothing else reads them.
16. **Hoist the quirk #15 elements into consts**: no behavior change.
17. **`DashboardRateYourCrewButton`**: 517–518 + 653–669 + 1422–1450 into a self-contained component. Nothing else reads this state.
18. **F-B1 verbatim moves**: `ApBillModal` (93–279) and `SendToDispatchModal` (282–407) to their own files. They share no state with the rest of the file.
19. **`SendToBillingConfirmModal`**: 1780–1844, with `readyForBillingChecked1/2` inside it. Removes 2 parent states and 4 props from the two job-row sections; add a render smoke.
20. **`useContractSigningPrompt`**: 519–571 + 671–697. The outward seam is one callback plus the modal props.
21. **`useDashboardFinancialPins`**: 354, 630–651, 699–711, 793–847, moved with their listeners and the realtime channel intact. Its only consumer is `pinnedQuickRowSharedProps`.
22. **`useDashboardButtonPrefs`**: 461–462, 713–786. It merges the two `user_dashboard_buttons` reads and keeps quirk #9.
23. **`useDashboardReportCounts`** (§20). Better still, a count RPC, which ends the double fetch of `list_reports_with_job_info`.
24. **F-A2 `buildFinanceCards`**: 1594–1657 into a lib with tests (the card detail-line money copy).
25. **F-B2 `ItemsModal` split**: move it to its own file, extract `useArCustomersLens` (494–538 + 796–852; it takes `drillQuery`, `arLinesByJob` and `arBillExtras` as inputs) and `useFinanceDrillState` (489–490, 715–793), and make the phone sheet (857–1157) and desktop dialog (1159–1576) presentational children. It is the biggest line win (1,169 lines) but also the most JSX, so do it after 14 has pinned the partition.
26. **`clock-strip-cluster`**: Stage A `lib/dashboardClockStrip.ts` with tests, then Stage B `useDashboardClockStrip`, with `myTeam` passed in. The render copies are already collapsed. It has the highest coupling (`myTeam`, `hoursDaysCorrectSet`, `stripMyTimeEditor` are shared with My Team, My Time and the clock preview), so it goes last.

> **Coverage gaps worth closing along the way:** `Dashboard.tsx` has no render smoke; neither do `DashboardPinnedQuickRow` (the slot host), `DashboardBillingPipelineSection`, `DashboardFinancialsSection`, `DashboardMyInboxCard`, `DashboardMyBidsSection`, `DashboardTeamsInboxCard`, `DashboardProjectsCard` or `DashboardSuperintendentJobsSection`. None of the page's data hooks (`useDashboardBoot`, `useDashboardAssignedJobs`, `useDashboardSubSchedule`, `useDashboardBillingInvoices`, `useDashboardMyTeamSectionState`, `useDashboardFinancials`) has a test. The billing and financials hooks carry the page's money writes and totals.

> Already thin/extracted: Financials (mount), My Team, My Time, Job Mode card, SectionDock, all banners, the inbox section components, `DashboardFieldCollectPaymentQueue`, `AssignedStageCard`, the skeletons, the born-external cards (§16a–c), and the shared modal components (`JobReportsModal`, `AdditionalReportModal`, `CollectPaymentModal`, `BilledPaymentConfirmationModal`, `CreateTripChargeModal`, `DispatchDismissedItemsModal`, `SubcontractorJobActivityModal`, `ChecklistItemMuteModal`, `NewReportModal`, `ReportEditModal`, `TurnawayModal`, `DashboardContractSigningPromptModal`, `CrewReviewDeck`, `QuickEstimateWizard`). The parent mostly orchestrates state around them.

## v2.1004 job-row-family extraction

Assigned Jobs → `DashboardAssignedJobsSection.tsx`; Superintendent Jobs → `DashboardSuperintendentJobsSection.tsx`; shared row styles/glyphs → `dashboardJobRowShared.tsx`. Verbatim lift, same-named props. Dashboard.tsx went 2,142 → 1,673 lines at v2.1004 (history; 1,852 at `a05cef4c4`).
