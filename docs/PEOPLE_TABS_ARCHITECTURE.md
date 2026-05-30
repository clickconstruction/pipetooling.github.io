# People Tabs Architecture Map

---
file: docs/PEOPLE_TABS_ARCHITECTURE.md
type: Engineering / Refactor Map
purpose: Inventory what every tab in src/pages/People.tsx touches (state, loaders, handlers, sub-components, supabase tables, cross-tab coupling) to prioritize decomposition of the ~21.4k-line God component.
audience: Developers, AI Agents
last_updated: 2026-05-31
---

## Overview

[`src/pages/People.tsx`](../src/pages/People.tsx) was a ~21,435-line "God component"; decomposition is in progress and it is now **~16,277 lines**. This map is a refactoring aid: for each tab it records what state, derived data, handlers, sub-components, and external systems the tab touches, plus its extraction status and risk. It is **coupling/refactor-oriented**. It mirrors the approach proven on [`BIDS_TABS_ARCHITECTURE.md`](./BIDS_TABS_ARCHITECTURE.md), which took `Bids.tsx` from ~18,800 lines to ~3,650.

### Progress
- **Phase 1 (low/med-coupling tab extractions) — DONE.** `vehicles`, `housing`, `licenses`, `offsets`, `contracts` extracted to `src/components/people/People<Tab>Tab.tsx`; `activity` + `writeups` cleaned up (state/loaders moved into their existing components). With `teams`/`feedback` already thin, the only tabs still inline are `users`, `overhead`, `pay_stubs`, `hours`, `review` (the pay/hours hub).
- **Phase 2 (shared hooks) — IN PROGRESS.** Extracted so far: `usePeopleAccess`, `usePeopleRoster`, `useCrewJobMap` (under `src/hooks/`). Remaining: `usePayConfig`, `usePeopleHoursData` (Realtime), and `useTeamSummaryData` (intricate review-UI orchestration; likely folded into the Phase-3 `review` extraction rather than a standalone hook).
- **Phase 3 (hub tabs)** — not started: `overhead → review → pay_stubs → users → hours` (hours last), consuming the Phase-2 hooks.

Tabs switch on a single `activeTab` state ([`People.tsx:537`](../src/pages/People.tsx)), type `PeopleTab` at [line 417](../src/pages/People.tsx):

```
'review' | 'users' | 'teams' | 'overhead' | 'pay_stubs' | 'hours' | 'offsets'
| 'vehicles' | 'housing' | 'licenses' | 'contracts' | 'writeups' | 'feedback' | 'activity'
```

### How to maintain this doc
- Update the relevant dossier whenever a tab is extracted or its state/handlers change; flip its Status to `extracted` and point at the new file.
- Treat line numbers as approximate anchors — they drift. Search for the symbol (`activeTab === '...'`, the state name, the modal name) when in doubt.

### Key structural difference from Bids
**There is no single shared "person pointer."** Bids has one `setSharedBid` fanning a click out to 8 `selectedBidFor*` selections. People instead gives **each tab its own independent selection pointer**, and identity is keyed by **person name (string)**, not id. The real shared substrate is the `people`/`users` roster plus the `person_name` columns across `people_hours`/`people_pay_config`/`person_offsets`/`person_licenses`/`person_contract_*`. The name↔id bridge is `cascadePersonNameInPayTables` / `resolvePersonIdFromRosterName` (line 67-68). So there is no cross-tab UI selection to lift — only shared *data*.

---

## Master summary table

| Tab key | Render lines | ~Lines | Status | Owned state | Cross-tab coupling | Coupling / risk | Recommended action |
|---|---|---|---|---|---|---|---|
| `users` | 11845-12357 (+person form 20986-21025) | ~513 + tags | inline | ~30 (roster + tag system + notes) | reads `people`/`users`, `contractSigningStatusByPersonName`, push/location | high | Extract tag subsystem, then roster (Phase 3) |
| `teams` | 12359-12361 | ~3 | extracted (`PeopleTeamsTab`) | 0 in parent | `authUser`/`authRole` | low | Done |
| `overhead` | 12363-13633 | ~1,271 | inline | ~28 (`overhead*`) | reads `payConfig`, `crewJobsByDatePerson` | med (dev/master) | Phase 3 (after hooks) |
| `pay_stubs` | 13634-14388 (+calendar 21314-21431) | ~870 | inline | ~35 (`payStub*`, `draftPayroll*`) | reads `payConfig`, `peopleHours`, rosters | high | Phase 3 (after hooks) |
| `hours` | 14391-16725 | ~2,335 | inline | ~45 (`hours*`, `costMatrix*`, clock sessions) | **owns** `payConfig`/`teams`/`crewJobsByDatePerson` | very high | Phase 3 — extract LAST |
| `vehicles` | thin wrapper | ~235 | extracted (`PeopleVehiclesTab`) | 0 in parent | `users` prop | low | Done (PR #19) |
| `housing` | thin wrapper | ~200 | extracted (`PeopleHousingTab`) | 0 in parent | `users` prop | low | Done (PR #20) |
| `offsets` | thin wrapper | ~195 | extracted (`PeopleOffsetsTab`) | 0 in parent | `payStubs`/`loadPayStubs` props | low-med | Done (PR #22) |
| `licenses` | thin wrapper | ~320 | extracted (`PeopleLicensesTab`) | 0 in parent | `people`/`users` props | low | Done (PR #21) |
| `contracts` | thin wrapper | ~1,583 | extracted (`PeopleContractsTab`) | `contractSigningStatusByPersonName` stays in parent | `people`/`users`/`canDeletePeopleContracts` props | med-high lines / low data | Done (PR #23) |
| `writeups` | thin wrapper | ~13 | extracted (`WriteupsContractsSubTab`, self-loads) | 0 | props only | low | Done (PR #24) |
| `review` | 18975-20494 | ~1,520 | inline (dev) | ~35 (`review*`, `teamSummary*`) | reads `payConfig`, `archivedUserNames` | med-high | Phase 3 (after hooks) |
| `feedback` | 20496-20500 | ~5 | thin (`TeamFeedbackDevSettingsBlock`) | 0 | `isDev` | low | Done |
| `activity` | thin wrapper | ~180 | extracted (`PeopleAppActivityPanel`) | `isActivityViewer`/`activityAccessResolved` stay in parent (feed `canSeeActivityTab`) | props only | low | Done (PR #24) |

> Status legend: `inline` = rendered directly in `People.tsx`; `thin` = a few lines delegating to an imported component; `partial` = panel extracted but the tab still owns inline UI/state; `extracted` = fully moved.

---

## Per-tab dossiers

> For the **extracted** tabs (`vehicles`/`housing`/`licenses`/`offsets`/`contracts`/`activity`/`writeups`/`teams`/`feedback`), the dossier below is the **pre-extraction inventory** — a record of what each tab contained before it moved to its `src/components/people/*` component. Current status/owner is in the master summary table above. The remaining inline tabs (`users`/`overhead`/`pay_stubs`/`hours`/`review`) are still accurate as-is. Line numbers are pre-extraction anchors; search by symbol.

### `users` — Roster
- **Render:** [`11845-12357`](../src/pages/People.tsx) (~513); tab button at 11617; person create/edit form modal at 20986-21025; invite-confirm modal at 21026.
- **Owned state (~30):** person form (`formOpen` 518, `editing` 519, `kind` 520, `name`/`email`/`phone`/`notes`/`saving` 521-525), roster actions (`archivingId` 526, `archivedPeople` 527, `archivedSectionOpen` 528, `restoringId` 529, `invitingId` 530, `inviteConfirm` 531, `loggingInAsId` 532), `personProjects` 533, `creatorNames` 536, `editingUserNote`/`userNoteSaving` 832-833. **Tag subsystem (~17 vars, 552-579):** `showUsersTabTags`, `usersTabLabels*`, `usersTabMasterByUserId`, `usersTabTagSignalsByUserId`, `usersTabTags*`, `usersTabSearch`, etc. Push/location: `canSeePushStatus`/`pushEnabledUserIds`/`locationEnabledUserIds` (588-590).
- **Cross-tab/shared:** owns/reads `people`(506)/`users`(498) (the master rosters used by nearly every tab); reads `contractSigningStatusByPersonName`(591) (written by the contracts loader) for the signing traffic light; reads `payConfig` for duplicate detection.
- **Loaders:** `loadPeople`(1591), `loadPersonProjects`(1639), `loadArchivedPeople`(2263), `handleSave`(2196), `handleMergeDuplicate`(2359), push/location loader (2031).
- **Supabase:** `people`, `users`, `project_workflow*`/`projects`, `push_subscriptions`, `person_contract_documents`, label/tag tables.
- **Coupling/risk:** **high** — owns the shared rosters + the person-edit form other tabs implicitly depend on. The tag subsystem is the cleanest sub-extraction. The `people`/`users` loaders must become `usePeopleRoster` first.

### `teams` — Teams
- **Render:** [`12359-12361`](../src/pages/People.tsx) (~3). Thin wrapper around `PeopleTeamsTab` ([`src/components/people/PeopleTeamsTab.tsx`](../src/components/people/PeopleTeamsTab.tsx)). **Done.** Note: the parent still owns `teams`(719) + `loadTeams`(4428) + team CRUD (7351-7381) for the **Hours** cost-matrix, not for this tab.

### `overhead` — Overhead
- **Render:** [`12363-13633`](../src/pages/People.tsx) (~1,271). Dev/master only (`canAccessOverheadTab` 837).
- **Owned state (~28):** `overheadDateStart`/`End` (854/861), `overheadOfficeJob*` (868-885), `overheadSessions`(874), `overheadTableSimpleView`(876), `overheadOfficeParts*` (886-890), `overheadAvgDailyCost`(891), `overheadOtherJobs*` (908-928), `overheadBreakdownModal`(931).
- **Cross-tab/shared:** reads `payConfig`(594), `crewJobsByDatePerson`(940). Load effects 6569-6950.
- **Supabase:** `clock_sessions`, `jobs_ledger*`, `people_pay_config`, `mercury_*`, `app_settings`, `people_crew_jobs`/`people_crew_bids`.
- **Coupling/risk:** **med.** Self-contained data, but shares `payConfig` + `crewJobsByDatePerson` with hours. Extract after `usePayConfig` + `useCrewJobMap`. Dev/master gate → low blast radius.

### `pay_stubs` — Pay Stubs
- **Render:** [`13634-14388`](../src/pages/People.tsx) + modal cluster (PayStubLess/Additional/Delete/Note/MarkPaid 14030-14318, Forecast 14321, DraftPayroll 14330, breakdown 14374) + **calendar modal 21314-21431** (~870 total). `canAccessPay` only.
- **Owned state (~35):** `payStubs`(752), `payStub*ByStubId` (753-755), modal stubs (756-757), `payStubsLoading`(768), period (769/776), calendar (783-786), action flags (787-796), confirm/mark-paid (807-814), `ledgerPersonSearch`(816).
- **Cross-tab/shared:** reads `payConfig`(594), `peopleHours`(643) + `loadPeopleHours`, `hoursDaysCorrect`(717), rosters. `payStubCalendarPerson`(783) is a pay_stubs-local pointer.
- **Loaders:** `loadPayStubs`(3487), `loadPayStubCalendarData`(3578), `generatePayStub`(~3897), print builders (4065-4287), `loadDraftPayrollPendingApprovals`(3385).
- **Sub-components (extracted):** `PayStubLessModal`, `PayStubAdditionalModal`, `DraftPayrollModal`, `PayrollForecastModal`, `DraftPayrollPersonHoursBreakdownModal`. Inline: stub table + mark-paid/note/delete + calendar modals.
- **Supabase:** `pay_stubs`, `pay_stub_payments`/`_deductions`/`_additional_lines`/`_days`, `people_hours`, `people_crew_*`, `people_pay_config`.
- **Coupling/risk:** **high.** Hard-depends on pay-config + people-hours layers. Extract after `usePayConfig` + `usePeopleHoursData`.

### `hours` — Hours / Pay grid (the hub)
- **Render:** [`14391-16725`](../src/pages/People.tsx) (~2,335 — **largest tab**). `canOpenHoursTab` = `canAccessPay || canAccessHours || canViewCostMatrixShared` (550).
- **Owned state (~45):** `peopleHours`(643), clock-session queues (`pendingClockSessions` 644, approved/rejected 653-654, search 655), grid highlight/edit state (695-825), cost-matrix (628-640, 731-734), date range (737/817), various modals (634-635, 941-942), and **shared-owner** state: `payConfig`(594)/`payConfigDraft`(596)/`payConfigSaving`(595), `teams`(719), `crewJobsByDatePerson`(940), `salaryTemplateByPersonName`(608).
- **Cross-tab/shared (OWNS, others read):** `payConfig` (pay_stubs/overhead/review read), `teams` (teams tab + cost-matrix), `crewJobsByDatePerson` (overhead/pay_stubs read).
- **Loaders:** `loadPeopleHours`(3349), clock-session loaders (3363-3454), `loadHoursReviewed`(3339), `loadPayConfig`(3306), cost-matrix loaders (4444-4480), `savePayConfig`(7181/7255), `saveHours`(7279). Big load effect ~1584-4618. **Realtime-subscribed** (484-487, 7083).
- **Sub-components (extracted):** `PersonTimeDetailModal`, `ReviewHoursModal`, `TeamSummaryInline`, `PeoplePayConfigModal`, `SalariedWorkdaysBulkModal`, `PeopleHoursPendingCellPopover`, `PeopleHoursBulkApprovePendingModal`, `ClockSessionEditSplitModal`, `HoursUnassignedModal`, `PeopleHoursDayAuditModal`. Inline: the grid + cost-matrix + approval queues.
- **Supabase:** `clock_sessions`, `people_hours`, `people_pay_config`, `hours_reviewed`, `hours_days_correct`, `people_hours_display_order`, `people_cost_matrix_*`, `people_teams`/`_team_members`, `people_crew_*`, `salary_work_schedule_templates`.
- **Coupling/risk:** **very high.** The central hub. Extract **last**, after the shared hooks exist.

### `vehicles` — Vehicles
- **Render:** table [`16726-16855`](../src/pages/People.tsx) (~130) + form modals 20814-20918 (~105). Total ~235.
- **Owned state (~23):** `vehicles`(945)/Loading/Error, `vehicleFormOpen`(948)/`editingVehicle`(949)/`selectedVehicleId`(950), `odometerEntries`(951)/`replacementValueEntries`(952)/`possessions`(953)/`vehicleAssignees`(954), form fields (955-981).
- **Cross-tab/shared:** reads `users` only (assignee names). `selectedVehicleId`(950) local pointer.
- **Loaders:** `loadVehicles`(4682), `loadOdometerEntries`(4724)/`loadReplacementValueEntries`(4734)/`loadPossessions`(4744); effect 6296.
- **Supabase:** `vehicles`, `vehicle_odometer_entries`, `vehicle_replacement_value_entries`, `vehicle_possessions`, `users`.
- **Coupling/risk:** **low — best first target.** Fully domain-isolated. Establishes the `People<Domain>Tab` prop pattern.

### `housing` — Housing
- **Render:** table [`16856-16989`](../src/pages/People.tsx) (~134) + form modals 20919-20985. Mirror of vehicles.
- **Owned state (~16):** `housingUnits`(984)/Loading/Error, `housingFormOpen`(987)/`editingHousingUnit`(988)/`selectedHousingId`(989), `housingPossessions`(990)/`housingAssignees`(991), form fields (992-998).
- **Loaders:** `loadHousingUnits`(4883)/`loadHousingPossessions`(4926); effect 6302.
- **Supabase:** `housing_units`, `housing_possessions`, `users`.
- **Coupling/risk:** **low — second target** (copy of the vehicles extraction).

### `offsets` — Offsets
- **Render:** [`16990-17163`](../src/pages/People.tsx) (~174) + apply modal 20792; `PersonOffsetFormModal` (imported) opened via `offsetFormOpen`.
- **Owned state (~10):** `offsets`(969)/Loading/Error, `offsetFormOpen`(972)/`offsetFormInitialCreateDraft`(973)/`editingOffset`(974), `offsetApplyModalOpen`(975)/`offsetToApply`(976)/`offsetApplyPayStubId`(977), `offsetsTabSearch`(978).
- **Cross-tab/shared:** reads `payStubs` (apply-offset-to-stub; its effect 6309 also calls `loadPayStubs`), `offsetPersonNameOptions`(509).
- **Loaders:** `loadOffsets`(5039).
- **Supabase:** `person_offsets`.
- **Coupling/risk:** **low-med.** Self-contained except the pay-stub apply linkage — pass `payStubs` (or its loader) as a prop.

### `licenses` — Licenses
- **Render:** [`17164-17376`](../src/pages/People.tsx) (~213) + form modals 20682-20791 (license + cost-line).
- **Owned state (~18):** `licenses`(1002)/Loading/Error/`licensesExpiringSoon`(1005), `selectedLicensePersonName`(1006), `licenseFormOpen`(1007)/`editingLicense`(1008) + fields, `costLineFormOpen`(1013)/`editingCostLine`(1014) + fields, `expandedCostLinesLicenseId`(1019).
- **Loaders:** `loadLicenses`(5099), cost-line CRUD (6192-6287); effect 6319.
- **Supabase:** `person_licenses`, `person_license_cost_lines`.
- **Coupling/risk:** **low — third target.** `canAccessLicenses`-gated.

### `contracts` — Contracts
- **Render:** main table [`17377-17891`](../src/pages/People.tsx) (~515) + **big inline modal cluster 17906-18974** (template 17906, assign 18098, document editor 18314, delete-confirm 18740, signed-record 18828, book 18836, send 18848) (~1,068). Total ~1,583.
- **Owned state (~50):** `contractTemplates`(1062)/`contractTemplateDocuments`(1063)/`personContractAssignments`(1064)/`personContractDocuments`(1065), modal flags (1070-1097), `contractDocumentForm*` (1073-1112), `contractSend*` (1098-1102), `templateForm*` (1118-1125).
- **Cross-tab/shared:** **writes `contractSigningStatusByPersonName`(591)** which the **users** tab reads (the only real cross-tab write). Reads `people` names.
- **Loaders:** `loadContracts`(5116), template/assignment/document CRUD (5542-6140); effects 6328-6341.
- **Sub-components (extracted):** `ContractBookModal`, `PersonContractSignedRecordModal`. Inline: template/assign/document/send modals.
- **External coupling:** `checkGoogleDriveAttachmentUrl`, `hasContractSigningContent`, `buildContractSendEmailPreview`. `canAccessContracts` + `canDeletePeopleContracts`(839).
- **Coupling/risk:** **med-high by line count, low by data-coupling** — only the signing-status write escapes. Biggest cheap win; move the modal cluster into `PeopleContractsTab` and surface `contractSigningStatusByPersonName` as a callback.

### `writeups` — Writeups
- **Render:** [`17892-17904`](../src/pages/People.tsx) (~13). Thin wrapper `WriteupsContractsSubTab`. **Mostly done** — remaining seam: move `loadWriteupsData`(5148) + its 5 rows (`writeupTemplatesRows`/`writeupsRows`/`ncnsRows`/`writeupsLoading`/`writeupsError`, 1126-1130) into the child.

### `review` — Review (dev-only)
- **Render:** [`18975-20494`](../src/pages/People.tsx) (~1,520). Gate `activeTab === 'review' && isDev`.
- **Owned state (~35):** `selectedReviewPersonIndex`(1411), `reviewPeriod`(1412)/range (1415-1416), `reviewLoading`(1417), `reviewLaborJobs`/`reviewCrewJobs`/`reviewAllocated*`/`reviewHours`/`reviewReports`/`reviewTasks*` (1478-1497), `teamSummaryRows`(1530)/Loading/Error + refs (1531-1563), `reviewLaborBreakdownContext`(1577)/`reviewOnlyPaidInFull`(1579).
- **Cross-tab/shared:** reads `payConfig`, `archivedUserNames`; shares `TeamSummaryInline` + `loadTeamSummaryData`(9377) machinery with **hours**. `selectedReviewPersonIndex`(1411) local pointer.
- **Loaders:** `loadReviewData`(7895), `loadTeamReviewUnion`(8721), `loadTeamSummaryData`(9377); effect 6351.
- **Supabase:** `people_labor_job*`, `people_crew_*`, `people_hours`, `checklist_instances`, `app_settings`, `jobs_ledger_materials`, `clock_sessions`.
- **Coupling/risk:** **med-high.** Big analytics block, dev-only (low blast radius) but tangled with the Team-Summary machinery shared with hours. Extract `useTeamSummaryData` first.

### `feedback` — Feedback (dev-only)
- **Render:** [`20496-20500`](../src/pages/People.tsx) (~5). Thin wrapper `TeamFeedbackDevSettingsBlock`. **Done.**

### `activity` — App Activity
- **Render:** [`20502-20681`](../src/pages/People.tsx) (~180). Renders `PeopleAppActivityPanel` at 20676 but keeps inline **grant-management UI** above it.
- **Owned state (6):** `activityAccessResolved`(581)/`isActivityViewer`(582)/`activityViewerGrantSet`(583)/`activityGrantListLoading`(584)/`activityGrantBusyId`(585)/`activityGrantsSectionOpen`(586).
- **Loaders:** access-resolution 1953-1990; grant toggle 20602/20637.
- **Supabase:** `user_app_activity_viewers`, `users`.
- **Coupling/risk:** **low.** Move the inline grant UI + 6 vars into `PeopleAppActivityPanel` (or a `PeopleActivityGrantsSection`).

---

## Shared infrastructure

### Per-tab selection pointers (no shared pointer)
| Pointer | Line | Tab |
|---|---|---|
| `selectedVehicleId` | 950 | vehicles |
| `selectedHousingId` | 989 | housing |
| `selectedLicensePersonName` | 1006 | licenses |
| `selectedContractsPersonName` | 1069 | contracts |
| `payStubCalendarPerson` | 783 | pay_stubs |
| `personTimeDetailModalPerson` | 634 | hours |
| `selectedReviewPersonIndex` | 1411 | review |
| `offsetToApply` | 976 | offsets |

Each is tab-local; keep it that way during extraction.

### Top-level shared state
| Variable | Line | Used by |
|---|---|---|
| `activeTab` | 537 | all tabs (render gate + ~40 effect gates) |
| `users` / `people` (+ refs) | 498/506 | users, hours, pay_stubs, offsets, licenses, contracts, review, vehicles/housing (assignees) |
| `payConfig` / `Draft` | 594/596 | hours (owner); pay_stubs/overhead/review (readers) |
| `peopleHours` | 643 | hours (owner); pay_stubs |
| `crewJobsByDatePerson` | 940 | hours, overhead, review, pay_stubs |
| `teams` | 719 | teams tab + hours cost-matrix |
| Permission flags | 545-551, 835-840, 11372 | every tab (gates) |

### Permission / role flags (loaded once by `loadPayAccess` @1903)
`canAccessPay`(545), `canAccessHours`(546), `canAccessLicenses`(547), `canAccessContracts`(548), `canViewCostMatrixShared`(549), `isDev`(551), `canOpenHoursTab`(550), `canSeeActivityTab`(587), `canAccessTeamsTab`(835), `canAccessOverheadTab`(837), `canDeletePeopleContracts`(839), `canEditUserNotes`(11372). The URL deep-link router (1730-1791) redirects unauthorized `tab=` values back to `users`.

### Shared layers lifted into hooks (the `useBidPricingEngine` analog)
| Hook | Status | Owns | Consumed by |
|---|---|---|---|
| [`usePeopleAccess`](../src/hooks/usePeopleAccess.ts) | **extracted (PR #25)** | `loadPayAccess` + the 7 raw flags (`canAccessPay`/`Hours`/`Licenses`/`Contracts`, `canViewCostMatrixShared`, `isDev`, `canSeePushStatus`). Derived flags (`canOpenHoursTab`, `canSeeActivityTab`, `canAccessTeamsTab`/`Overhead`/`canDeletePeopleContracts`) stay in the parent. | every tab (gates) |
| [`usePeopleRoster`](../src/hooks/usePeopleRoster.ts) | **extracted (PR #26)** | `people`/`users` + refs, `loadPeople`, `loadArchivedPeople`, person create/edit form + `handleSave` (via a 6-field deps ref). `handleMergeDuplicate` stays in the parent (pay/hours-entangled). | nearly all tabs |
| [`useCrewJobMap`](../src/hooks/useCrewJobMap.ts) | **extracted (PR #27)** | `crewJobsByDatePerson` + `loadCrewJobsForHoursRange` + `mergeCrewJobsForDateRange` + refs (input: `hoursDateStart`/`End`). The two orchestration effects stay in the parent. | hours, overhead, review, pay_stubs |
| `usePayConfig` | planned | `payConfig`/`Draft`/`Saving`, `loadPayConfig`, `savePayConfig` | hours (editor), pay_stubs, overhead, review |
| `usePeopleHoursData` | planned (last/highest-risk) | `peopleHours`, clock-session queues, loaders, the Realtime subscription | hours (owner), pay_stubs, review |
| `useTeamSummaryData` | deferred | `teamSummary*` + `loadTeamSummaryData` + drain/modal refs | review (likely folds into the `review` extraction — intricate review-UI orchestration, depends on `payConfig`) |

`payConfig`, `peopleHours`/`clock_sessions`, and `crewJobsByDatePerson` are the People analogs of `bids_count_rows` — the shared sources of truth that resist extraction. Lift the remaining ones into hooks **before** touching hours/pay_stubs/overhead/review.

---

## Cross-tab coupling diagram

```mermaid
graph TD
    subgraph done [Extracted tabs - Phase 1 done]
        VH[vehicles]
        HO[housing]
        LI[licenses]
        OF[offsets]
        CT[contracts]
        TE[teams]
        WR[writeups]
        FB[feedback]
        AC[activity]
    end
    subgraph hub [Pay/Hours hub - still inline]
        US[users]
        HR[hours]
        PS[pay_stubs]
        OV[overhead]
        RV[review]
    end
    subgraph hooks [Shared hooks]
        ROSTER["usePeopleRoster (done)"]
        PERMS["usePeopleAccess (done)"]
        CREW["useCrewJobMap (done)"]
        PAYCFG["usePayConfig (planned)"]
        HOURS["usePeopleHoursData (planned)"]
    end

    US & PS & OV & RV --> ROSTER
    US & HR & PS & OV & RV --> PERMS
    HR --> PAYCFG
    PS & OV & RV --> PAYCFG
    HR & PS --> HOURS
    HR & OV & RV & PS --> CREW
    CT -.contractSigningStatusByPersonName.-> US
    OF -.payStubs apply.-> PS
```

---

## Recommended extraction order (value ÷ risk)

Lowest-coupling, domain-isolated, permission-gated tabs first; the pay/hours hub last.

1. ~~`vehicles`~~ — **DONE (PR #19)**. Established the `People<Domain>Tab` prop pattern (`users` prop).
2. ~~`housing`~~ — **DONE (PR #20)** (twin of vehicles).
3. ~~`licenses`~~ — **DONE (PR #21)**.
4. ~~`offsets`~~ — **DONE (PR #22)** (`payStubs`/`loadPayStubs` passed as props; the record-payment `PersonOffsetFormModal` instance stayed in the parent).
5. ~~`contracts`~~ — **DONE (PR #23)** (`contractSigningStatusByPersonName` + its populate effect kept in the parent for the users-tab traffic light).
6. ~~`activity` + `writeups` cleanup~~ — **DONE (PR #24)**.
7. **Shared-hook prep (refactor, not a move):** `usePeopleAccess` ~~DONE (PR #25)~~, `usePeopleRoster` ~~DONE (PR #26)~~, `useCrewJobMap` ~~DONE (PR #27)~~; **remaining:** `usePayConfig`, then `usePeopleHoursData` (last). `useTeamSummaryData` deferred (note the dependency: it needs `payConfig`, and it's review-UI-centric — likely extracted with the `review` tab).
8. **`overhead`** — after `usePayConfig` + `useCrewJobMap`; dev/master-gated.
9. **`review`** — after `usePayConfig` (+ the team-summary machinery); dev-only.
10. **`pay_stubs`** — after `usePayConfig` + `usePeopleHoursData`.
11. **`users`** — extract the tag subsystem first, then the roster UI; the person-edit form already lives in `usePeopleRoster`.
12. **`hours`** — **last.** The hub; extract once everything it feeds is on the shared hooks.

> Already thin/extracted: `teams` (`PeopleTeamsTab`), `writeups` (`WriteupsContractsSubTab`), `feedback` (`TeamFeedbackDevSettingsBlock`), `activity` panel (`PeopleAppActivityPanel`). Many domain modals are already components (`PayStubLessModal`, `DraftPayrollModal`, `PersonOffsetFormModal`, `ContractBookModal`, `PersonTimeDetailModal`, `ReviewHoursModal`, `TeamSummaryInline`); the parent mostly orchestrates state around them.
