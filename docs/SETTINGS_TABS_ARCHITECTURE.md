# Settings Tabs Architecture Map

---
file: docs/SETTINGS_TABS_ARCHITECTURE.md
type: Engineering / Refactor Map
purpose: Step-0 map for the Settings.tsx decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md) — inventory what is ALREADY extracted (Settings shrank ~12k → ~5.1k lines without a map) and what remains inline in src/pages/Settings.tsx (state, loaders, handlers, supabase tables/RPCs, role gates, coupling), to drive the remaining multi-PR extraction.
audience: Developers, AI Agents
last_updated: 2026-07-21
---

## Overview

[`src/pages/Settings.tsx`](../src/pages/Settings.tsx) is a ~4,564-line "God component" (as of v2.853: ~265 `useState` declarations; was ~5,132 lines / ~282 `useState` at v2.735). It follows the process in [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) and the format of [`BIDS_TABS_ARCHITECTURE.md`](./BIDS_TABS_ARCHITECTURE.md) / [`DASHBOARD_SECTIONS_ARCHITECTURE.md`](./DASHBOARD_SECTIONS_ARCHITECTURE.md).

**Settings is unusual: it was already heavily decomposed — without a map.** Two extraction waves happened:

1. **2026-06-01 (PRs #35–#49):** collapsible sections became tabs, then ten Stage-B JSX moves created `src/components/settings/Settings*Tab.tsx` plus `useSettingsBackupExports`. These were **JSX-only moves**: nearly all state, loaders, and handlers **stayed in the parent** and flow down as enormous prop lists (SettingsDashboardTab takes ~120 props, SettingsCatalogsTab ~110, SettingsTemplatesTab ~85).
2. **June–July feature work:** new sections shipped as **self-contained blocks** (own state via a hook or local `useEffect` + `app_settings` lib fetchers): `ActiveAccountsPanel`, `DeletedRecordsSection`, `BulkDeleteAlertSettingsBlock`, `TripChargeAmountsSettingsBlock`, `MapDefaultViewSettingsBlock`, the invoice/memo dev blocks, `JobBookSettingsSection`, `BidCoverLetterDefaultsSettingsBlock`.

So the remaining ~4.6k lines are **not un-extracted tabs** — they are the *engine rooms* of tabs whose JSX already moved out. The remaining work is mostly **Stage-A/seam work**: push each tab's state + handlers into a hook or into the tab component, collapsing the prop lists. (The last fully-inline JSX section, Sharing & Adoption, was extracted in v2.853.)

It is a **hot file**: 29 commits in the last 10 weeks (controller role v2.662, quick-buttons placement v2.668, theme tokenization, Resend email rebuild, Active Accounts modal, honest-delete v2.707, archive-cover v2.710, employment/cost-matrix retirement v2.672–2.677). Churn-reduction is the value axis for extraction order.

### Key structural facts

1. **Tab switching is pure component state.** `activeSettingsTab: string` holds a group id (`'settings-account'`, `'settings-people'`, …). `getSettingsJumpGroups(myRole)` (module fn, ~line 184) builds the role-filtered tab list; an effect snaps `activeSettingsTab` to the first group when invalid. `SettingsTabBar` (module component, ~146) renders the `role="tablist"` bar using the shared `pageTabStyle` (v2.668 filled-blue selected tabs).
2. **~~There is NO URL sync — `?tab=` and `#anchor` deep links into Settings are inert.~~ FIXED in v2.737.** `DashboardBulkDeleteAlertBanner` links to `/settings?tab=settings-data`, `DashboardClaimDevAttemptsBanner` to `/settings?tab=settings-people`, and `Calendar.tsx` links (×6) to `/settings#settings-time-off` / `/settings#settings-salary-workday`. Settings now reads `location.search`/`location.hash` via [`resolveSettingsDeepLink`](../src/lib/settingsDeepLink.ts): `?tab=` activates the group; a `#settings-*` section anchor activates its owning tab and scrolls the anchor into view (the apply effect retries when the role-filtered groups load and polls for the async-mounted anchor). Broke originally when collapsible sections became tabs (PR #35).
3. **Mixed mount semantics.** Most tabs render inside `SettingsGroup` with `hidden={activeSettingsTab !== id}` → **kept mounted, `display: none`** (child state and self-contained loaders run even when invisible). Two strays render **outside** a SettingsGroup with conditional mount (unmount when inactive): `SettingsAccountSchedulingTab` and `SettingsCatalogsProspectsTab`. `SettingsAdvancedTab` / `SettingsHowItWorksTab` / the Recent-push wrapper take an `active` prop / wrapper div and hide themselves. Preserve each tab's existing semantics during moves.
4. **The default landing tab is "Recent push"** (first entry in `getSettingsJumpGroups` for every role), not "Your account". Refresh always resets to it (no URL state).
5. **File layout:** imports/types 1–87; module components (`SettingsGroup`, `SettingsTabBar`, `getSettingsJumpGroups`) 89–203; state block ~208–675 (with 4 small handlers interleaved); loaders/handlers ~684–3328; effects block ~3330–3767; claim-code/password/merge/team-leader ~3769–4015; JSX 4028–5131.

### How to read a dossier

Each tab lists: render location (symbol anchors; line numbers are "as of v2.735" and rot — search the symbol), **status** (extracted → component + what it still receives from the parent | inline), **parent-resident state/handlers**, **supabase tables + RPCs + edge functions**, **coupling**, **role gate**, and **extraction approach** (Stage A = pure logic → `lib/*` + tests; Stage B = component/hook move).

### How to maintain this doc

- Update the relevant dossier whenever a tab's engine is extracted or its state/handlers move; flip its Status and point at the new file/hook.
- Treat line numbers as approximate anchors — search for the symbol (`loadData`, the section h2 text, the state name) when in doubt.

---

## Master summary table

Tabs in `getSettingsJumpGroups` order. "Engine location" = where the tab's state/loaders/handlers live today.

| # | Tab (group id) | Component(s) | JSX status | Engine location | Parent props | Risk | Recommended action |
|---|---|---|---|---|---|---|---|
| 1 | Recent push (`settings-recent-push`) | `SettingsRecentPushNotifications` | extracted | **self-contained** (own loads) | 1 (`userId`) | — | Done |
| 2 | Your account (`settings-account`) | `SettingsAccountTab` + `SettingsAccountSchedulingTab` + `SettingsAccountBackupTrailing` | extracted | **parent** (~30 state: profile, password, push test, location, self-salaried, dev pay-config) + `useSettingsBackupExports` hook | ~30 + ~20 | low | Extract `useSettingsAccount` hook late (low churn) |
| 3 | Dashboard & alerts (`settings-dashboard`) | `SettingsDashboardTab` (1,985 lines) | extracted | **split**: parent owns loaders (~60 state); child does its own writes | **~120** | high | Split parent residue into hooks (`useSettingsFinancialPins`, `useSettingsMyReports`, `useSettingsTeamLeaderAssignments`) — order #5 |
| 4 | People & accounts (`settings-people`) | `SettingsPeopleTab` (dev) + `SettingsSharingAdoptionSection` + `TeamFeedbackMasterAggregates` | extracted | parent (groups/people/merge ~28 state); `ActiveAccountsPanel` + `SettingsSharingAdoptionSection` self-contained | ~50 | low–med | ~~Order #1~~ **done (v2.853)**. Order #4: people-directory residue |
| 5 | Data & migration (`settings-data`) | `SettingsDataTab` | extracted | `useSettingsBackupExports` (parent hook) + self-contained `DeletedRecordsSection` / `BulkDeleteAlertSettingsBlock` | ~25 (all from one hook) | — | Effectively done; optionally move the hook call into the tab |
| 6 | Jobs & dispatch (`settings-jobs`) | `SettingsJobsTab` + `TripChargeAmountsSettingsBlock` | extracted | parent (~14 state: overrides, reassign, labor rate) | ~24 | low | Fold into order #4 or a small `useSettingsJobsAdmin` hook |
| 7 | Catalogs & trades (`settings-catalogs`) | `SettingsCatalogsTab` + `SettingsCatalogsProspectsTab` | extracted | **parent** (~1,050 lines: 5 type-CRUD engines + counts + orphan prices + prospect/estimate copy) | ~110 + ~35 | med | **Order #3:** `useSettingsCatalogs` hook; move orphan-prices modal into the tab |
| 8 | Templates & testing (`settings-templates`) | `SettingsTemplatesTab` (+ 6 self-contained dev blocks inside) | extracted | **parent** (~550 lines: email/notification template CRUD + 3 test senders + report settings) | ~85 | low–med | **Order #2:** `useSettingsTemplatesEngine` hook; Stage A: defaults map + `replaceTemplateVariables` → `lib/settingsTemplates` |
| 9 | Advanced (`settings-advanced-tools`) | `SettingsAdvancedTab` | extracted | parent (`handleClaimCode`, 3 state) | 8 | low | Move claim-code state/handler into the tab (tiny) |
| 10 | How it works (`settings-how-it-works`) | `SettingsHowItWorksTab` | extracted | stateless | 1 (`active`) | — | Done |
| — | Page shell (banner, header, tab bar, jump groups) | inline | — | parent | — | — | **Stays in parent permanently** |
| — | Cross-tab modals (report view/edit, MyReports, mute) | extracted components, wiring inline | — | parent | — | — | Stays (opened from Dashboard tab, shared `loadMyReportsRef`) |

---

## Role-gating matrix

Nine runtime roles: `dev`, `master_technician`, `assistant`, `controller`, `estimator`, `primary`, `superintendent`, `subcontractor`, `helpers`. Gates: `isAssistantLike` = assistant|controller; `isSubcontractorLikeRole` = subcontractor|helpers. **Quirk:** the local `UserRole` union in Settings.tsx (~line 76) omits `controller` — the runtime value flows through casts; `getSettingsJumpGroups` treats controller as a base role (its `r === 'dev'`/etc. checks all miss), while inner `isAssistantLike` gates still match it.

| Tab / section | dev | master | assistant / controller | estimator | primary | superintendent | sub / helpers |
|---|---|---|---|---|---|---|---|
| Recent push | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Your account (profile/password/push/location) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (name field read-only) |
| ↳ DB-backup trailing header | ✓ | — | — | — | — | — | — |
| ↳ Salaried workday | ✓ (always, incl. "All salaried" editor) | self-salaried only | self-salaried only | self-salaried only | self-salaried only | self-salaried only | self-salaried only |
| ↳ Time off | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Dashboard & alerts (tab) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ↳ Dashboard buttons + placement | ✓ | ✓ (`builder_review` checkbox master-only) | ✓ | — | — | — | — |
| ↳ Dashboard Page Pins | ✓ (+ dev-only financial-pins sub-block) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ↳ Daily goals / Job Book / Team Hours Sharing / Report notifications | ✓ | ✓ | ✓ | — | — | — | — |
| ↳ My Reports (`showMyReports`) | ✓ | ✓ | ✓ | — | ✓ | — | ✓ |
| ↳ My Notification History, Muted Tasks | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ↳ Ignored task types (Dashboard) | ✓ | — | — | — | — | — | — |
| People & accounts (tab in jump list) | ✓ | ✓ | — | — | — | — | — |
| ↳ SettingsPeopleTab (Active Accounts, groups, people, role table) | ✓ | — | — | — | — | — | — |
| ↳ Sharing & Adoption (INLINE) | ✓ (can manage any master's) | ✓ | — | — | — | — | — |
| ↳ TeamFeedbackMasterAggregates | — | ✓ only if in `pay_approved_masters` | — | — | — | — | — |
| Data & migration | ✓ | — | — | — | — | — | — |
| Jobs & dispatch | ✓ | — | — | — | — | — | — |
| Catalogs & trades (tab) | ✓ | — | — | ✓ | — | — | — |
| ↳ Manage Parts, Service Types, Book Names, Counts Quick-add | ✓ | — | — | — | — | — | — |
| ↳ Material Part / Assembly Types | ✓ (delete allowed) | — | — | ✓ (service types filtered to `estimator_service_type_ids`; no delete) | — | — | — |
| ↳ Prospects/estimate copy block (`SettingsCatalogsProspectsTab`) | ✓ | — | — | — | — | — | — |
| Templates & testing | ✓ | — | — | — | — | — | — |
| Advanced (claim-code) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| How it works | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

`controller` sees exactly: Recent push, Your account, Dashboard & alerts (with assistant-like inner sections), Advanced, How it works.

---

## Shared substrate

- **`loadData()` God-loader (~819–1130).** Runs on `authUser.id` change. Loads: own `users` row (role + profile + estimator flags) → role branches: masters/devs get adoptions+shares; dev/master/assistant-like get dashboard buttons, placement, report templates/prefs, goal-picker users, team-leader assignments; dev gets full `users` list, all `people` (split mine/others + creator join), templates, pay-approved masters, an `app_settings` batch (`default_labor_rate`, 6 prospect-copy keys, estimate-CX keys, report windows), estimate catalog, job-owner overrides, job counts RPC, report-enabled users, dispatch/estimator group members; dev|estimator get service types. It is the re-sync callback for children (`onActiveAccountsDataChanged={() => void loadData()}`, `handleClaimCode` success, merge-duplicates). **Dissolve it into per-tab hooks as they form — last step; until then every extracted hook must expose a reload the parent can call where `loadData` did.**
- **`users` list (dev-only) is the widest-shared value:** consumed by Dashboard tab (goal pickers use separate `goalPickerUsers`), People tab, Jobs tab, Templates tab (test-target picker), dev-salaried picker memo. Note `ActiveAccountsPanel` deliberately loads its **own** copy via `useActiveAccountsManagement` and reconciles via `onDataChanged` → `loadData()` — the established pattern for self-contained children.
- **`serviceTypes` is cross-tab:** Catalogs CRUD, estimator visible-types filter (`visibleServiceTypesForMaterials`, computed in render), the estimator default-selection sync effect (~3678), and `reloadLedgerPrefixMap()` from `LedgerDisplayPrefixContext` after service-type saves. Any `useSettingsCatalogs` hook must keep exposing `serviceTypes` to the parent.
- **`app_settings` conventions.** Two patterns coexist: (a) parent batch-select in `loadData` + per-handler `.upsert({ key, value_text|value_num }, { onConflict: 'key' })`; (b) **self-contained blocks own their keys** through `src/lib/appSettingsKeys.ts` constants + per-domain lib fetch/save modules (`mapDefaultViewSettings`, `stripeInvoiceFooter`, `physicalInvoiceIssuer`, `billCustomerMemo…`, bulk-delete-alert keys, trip-charge keys). **Pattern (b) is the seam to follow** for new/moved sections; job-owner overrides additionally use dynamic keys (`job_owner_override_<userId>`, delete-when-empty).
- **Toast/error conventions.** Success → `showToast(…, 'success')` (10 call sites). Failures → per-section error state (`serviceTypeError`, `adoptionError`, …) rendered next to the form. The page-wide `error` state renders **only** in the pre-role early return and inside SettingsPeopleTab's Additional People section — see quirk #4.
- **Proven seam-hook precedents to copy:** `useActiveAccountsManagement` (state+handlers hook, component self-contains), `useSettingsBackupExports` (parent hook, values threaded), `useDeletedRecordsArchive` (fully self-contained single-surface section). Named candidates for the remaining engines: `useMasterAdoptions`, `useSettingsTemplatesEngine`, `useSettingsCatalogs`, `useSettingsPeopleDirectory`, `useSettingsFinancialPins`, `useSettingsMyReports`, `useSettingsTeamLeaderAssignments`, `useSettingsAccount`.

---

## Per-tab dossiers

### 0. Page shell (stays in parent)

- **Render location:** impersonation banner (`impersonating`, `handleBackToMyAccount`) ~4030; header with Sign out / Change password buttons ~4071; `<SettingsTabBar>` ~4088; the `SettingsGroup` wrappers.
- **Owned state:** `myRole`, `activeSettingsTab`, `loading`, `error`, `impersonating`.
- **Supabase:** `handleSignOut` (auth.signOut + `sb-*` localStorage sweep), `handleBackToMyAccount` (restores tokens from `impersonation_original`).
- **Status:** stays permanently — the role fork and tab router live here. The password-change *modal* renders inside `SettingsAccountTab` but is *opened* from the shell header (`openPasswordChange`), so its state stays in the parent.

### 1. Recent push notifications

- **Render:** `display:none` wrapper div gated on `activeSettingsTab === 'settings-recent-push'` (~4090). All roles; first/default tab.
- **Status: extracted + self-contained.** [`SettingsRecentPushNotifications`](../src/components/settings/SettingsRecentPushNotifications.tsx) receives only `userId`; owns its `notification_history` load.
- **Note:** the parent has a *separate* notification-history section (Dashboard tab dossier) using parent state — they query the same table independently.

### 2. Your account

- **Render:** `SettingsGroup id="settings-account"` (~4094) with `titleTrailing=<SettingsAccountBackupTrailing>`; `SettingsAccountTab` inside; `SettingsAccountSchedulingTab` **outside the group, conditional-mount** (~4142).
- **Status: JSX extracted; engine in parent.**
  - [`SettingsAccountTab`](../src/components/settings/SettingsAccountTab.tsx) (345 lines, presentational): profile form, password-change modal, push test, location permission. Parent residue: `myProfile*` state + `saveMyProfile` (duplicate-name check via `checkDuplicateName` across `people`+`users`, then `cascadePersonNameInPayTables` on rename, then `refreshSelfPaySalaryForPayName`), password handlers (`supabase.auth.signInWithPassword` re-verify + `updateUser`), `handleTestNotification` (edge fn `send-checklist-notification` to self, with `refreshSession` first), `handleEnableLocation` + permission effect.
  - [`SettingsAccountSchedulingTab`](../src/components/settings/SettingsAccountSchedulingTab.tsx) (323 lines): renders `SalaryWorkScheduleSettings` (self, gated dev-or-self-salaried) + dev-only "All salaried" picker (parent residue: `devPayConfigForSalaried` open-triggered load from `people_pay_config`, `buildSalariedWorkdayPickerRows` memo — pure lib, already tested) + ungated `TimeOffSettings` (self-contained component). Holds the orphaned `#settings-salary-workday` / `#settings-time-off` anchor ids (quirk #2).
  - [`SettingsAccountBackupTrailing`](../src/components/settings/SettingsAccountBackupTrailing.tsx): dev-only "days since backup" + export-all button; values from `useSettingsBackupExports`.
- **Supabase (parent residue):** `users` (profile update), `people`+`users` (dup check), `people_pay_config` (self-salary flag; dev all-salaried), auth, `send-checklist-notification`.
- **Coupling:** `myProfileName` feeds the salaried-workday self check; `lastFullBackupAtIso`/`exportAllBackup` shared with Data tab (same hook instance).
- **Approach:** late-order `useSettingsAccount` hook (profile+password+push+location) — low churn, low value. Keep `useSettingsBackupExports` a single parent instance while both Account trailing and Data tab consume it.

### 3. Dashboard & alerts

- **Render:** `SettingsGroup id="settings-dashboard"` (~4165) → [`SettingsDashboardTab`](../src/components/settings/SettingsDashboardTab.tsx) (1,985 lines, **~120 props** — the largest prop membrane in the repo).
- **Status: JSX extracted; engine SPLIT.** The child is *not* purely presentational: it performs its own supabase **writes** (`user_dashboard_buttons` upsert, `user_dashboard_preferences` placement, pin reorder via dnd-kit + `reorderPins`, `user_dashboard_goals` CRUD, `team_leader_assignments` insert/update/delete, financial-pin add/remove via `pinnedTabs` lib, `dev_ignored_checklist_items` unignore) while all **loads** stay in the parent.
- **Sections** (anchor = h2/button text): `Dashboard buttons` + placement (dev/master/assistant-like; `builder_review` filter master-only; defaults map in `loadData` sets `builder_review: role === 'master_technician'`); `Dashboard Page Pins` (all roles; `myPins` via `getMergedFilteredPins`, `pipetooling-pins-changed` window-event listener in parent; **dev-only financial-pins sub-block**: Billed / Supply-Houses AP / External Team / Cost Matrix pin toggles with parent loaders `loadBilledTotalAndPinnedUsers`, `loadSupplyHousesAPTotalAndPinnedUsers` (`supply_house_invoices`), `loadExternalTeamTotalAndPinnedUsers` (`fetchSubLaborDueTotal`), `loadCostMatrixPinnedUsers`, plus `useWeeklyTeamLaborTotal(myRole==='dev')`); `Daily goals (clock-in gate)` (open-triggered `user_dashboard_goals` load effect keyed on `dailyGoalsTargetUserId`); [`JobBookSettingsSection`](../src/components/settings/JobBookSettingsSection.tsx) (self-contained wrapper around `JobBookEditorPanel`, shared with `JobBookModal` on Jobs); `Team Hours Sharing` (`team_leader_assignments` + parent memos `sortedTeamLeaderAssignments`/`filteredTeamLeaderAssignments`/`teamHoursMemberPickerUsers`); `Report notifications` (`user_report_notification_preferences` + `report_templates`); `My Reports` (`showMyReports` roles; parent loader via `list_my_reports` RPC + **realtime channel** `settings-my-reports-changes` on `reports`, `loadMyReportsRef` shared with the page-level edit modal `onSaved`); `My Notification History` (open-triggered load + has-any probe + scroll-into-view effect); `Muted Tasks` (`user_checklist_item_mute_preferences` + `checklist_items` titles; mute modal opened here, rendered at page level); `Ignored task types` (dev; `dev_ignored_checklist_items`).
- **Cross-tab/page coupling:** `ReportViewModal`/`ReportEditModal`/`MyReportsModal`/`ChecklistItemMuteModal` render at page level (~5085–5127) and share state with this tab (`selectedReport`, `reportForEdit`, `myReports*`, `muteModal*`). `showMyReports` derived flag gates both.
- **Approach (order #5 — highest churn-reduction, highest coupling):** split parent residue into `useSettingsFinancialPins` (dev cluster: 20 state vars + 4 loaders), `useSettingsMyReports` (loader + realtime + edit-window; keep the modal wiring in the parent, hand it the reload fn), `useSettingsTeamLeaderAssignments` (rows + memos + picker deriveds). Then sub-decompose the 1,985-line child per section. Do this only after the seam pattern is re-proven on orders #1–#3.

### 4. People & accounts

- **Render:** `SettingsGroup id="settings-people"` (~4301). Three blocks:
  1. **`SettingsPeopleTab`** (dev-only, ~4303): [`ActiveAccountsPanel`](../src/components/settings/ActiveAccountsPanel.tsx) `variant="card"` (**self-contained** via [`useActiveAccountsManagement`](../src/hooks/useActiveAccountsManagement.ts): users table with role select, **`read_only` training-mode checkbox**, **`team_prospects_access` + `estimator_prospects_access` grants**, service-type pills, invite (`invite-user`) / manual add (`create-user`) / sign-in email (`send-sign-in-email`) / archive + archive-reassign (`archive-user`, v2.710 cascade) / restore (`restore-user`) / set-password (`set-user-password`) / merge (`merge-users`) — also mounted app-level via `ActiveAccountsModalContext`; syncs back through `onActiveAccountsDataChanged={() => void loadData()}` and `onOpenFindDuplicates`); `Role visibility` static table; `Task Dispatch group` + `Estimator Inbox group` toggles (parent handlers, `dispatch_group_members` / `estimator_group_members`); `Pay Approved Masters` (parent, `pay_approved_masters`); `TeamFeedbackDevSettingsBlock` (self-contained); `Additional People` (parent: `myPeople`/`nonUserPeople` from `loadData`/`loadPeopleForDev`, person edit modal + `cascadePersonNameInPayTables`, delete with 90-day-restore copy, **the only render sites of the shared `error` state** — quirk #4).
  2. **`SettingsSharingAdoptionSection`** (dev|master, **extracted v2.853**): [`SettingsSharingAdoptionSection`](../src/components/settings/SettingsSharingAdoptionSection.tsx) is fully self-contained via [`useMasterAdoptions(authUserId, isDev)`](../src/hooks/useMasterAdoptions.ts) (loads on mount; the parent's `loadData` no longer touches adoption data). Four sub-blocks — Adopt Assistants (`master_assistants`; **assistants list includes controllers**: `.in('role', ['assistant', 'controller' as 'assistant'])`), Adopt Primaries (`master_primaries`), Adopt Superintendents (`master_superintendents`), Share with other Master (`master_shares`). Dev extra: `selectedMasterIdForAdoptions` picker (three identical copies of the same `<select>` — preserved quirk #11) to manage **another master's** adoptions via `adoptionMasterId`; sharing always acts as self. `roleSharingSectionOpen` collapsible state moved into the component (persists across tab switches since the People group keeps children mounted).
  3. **`TeamFeedbackMasterAggregates`** (~4638): master-only, gated on own id ∈ `payApprovedMasterIds`.
- Also parent-resident but rendered later: **merge-duplicates modal** (~4745–4781; `openFindDuplicatesModal` from `people_pay_config` + `findPersonUserDuplicates`/`findNameSimilarDuplicates`, `handleMergeDuplicate` → `mergePersonIntoUser` → `loadData`), opened from ActiveAccountsPanel's callback.
- **Role gate:** tab listed for dev|master; master sees only blocks 2–3.
- **Approach:** ~~Order #1: extract Sharing & Adoption~~ **done v2.853** (−607 parent lines). **Order #4:** move the merge modal + handlers into SettingsPeopleTab, and pull groups/pay-approved/people handlers into `useSettingsPeopleDirectory`.

### 5. Data & migration

- **Render:** `SettingsGroup id="settings-data"` (~4644), dev-only → [`SettingsDataTab`](../src/components/settings/SettingsDataTab.tsx).
- **Status: effectively done.** Backup exporters are props from `useSettingsBackupExports` (parent hook, shared with the Account trailing header). [`DeletedRecordsSection`](../src/components/settings/DeletedRecordsSection.tsx) ("Recently deleted (dev)", preview-gated restore) and [`BulkDeleteAlertSettingsBlock`](../src/components/settings/BulkDeleteAlertSettingsBlock.tsx) (5 `app_settings` keys) are self-contained.
- **Approach:** none required. Optional polish: instantiate the exports hook inside the tab and lift only `lastFullBackupAtIso`/`exportAllBackup`/`exportBackupBusy` for the Account header (or duplicate the hook) — low value.

### 6. Jobs & dispatch

- **Render:** `SettingsGroup id="settings-jobs"` (~4675), dev-only → [`SettingsJobsTab`](../src/components/settings/SettingsJobsTab.tsx) (280 lines).
- **Status: JSX extracted; engine in parent.** Sections: job-creation owner overrides (`app_settings` dynamic keys `job_owner_override_<userId>`, creators = dev|master|assistant|**controller**), bulk job re-assign (`jobs_ledger.master_user_id` update + optimistic `jobCountByUserId` fix-up; counts from RPC `list_job_counts_by_master_for_dev_settings` in `loadData`), default labor rate (`app_settings.default_labor_rate`), plus self-contained [`TripChargeAmountsSettingsBlock`](../src/components/settings/TripChargeAmountsSettingsBlock.tsx).
- **Parent residue:** ~14 state vars + `saveJobOwnerOverrides` / `confirmReassignJobs` / `saveDefaultLaborRate`.
- **Approach:** small; fold into order #4's pass (or a `useSettingsJobsAdmin` hook). Depends on `users` list.

### 7. Catalogs & trades

- **Render:** `SettingsGroup id="settings-catalogs"` (~4873, dev|estimator) → [`SettingsCatalogsTab`](../src/components/settings/SettingsCatalogsTab.tsx) (1,207 lines, ~110 props). Dev-only [`SettingsCatalogsProspectsTab`](../src/components/settings/SettingsCatalogsProspectsTab.tsx) renders **before** it in source, outside the group, conditional-mount (~4706).
- **Status: JSX extracted; the parent's single biggest engine (~1,050 lines, ~2343–3328 + effects).** Five parallel CRUD engines, each with the same shape (list + per-service-type selection + form-open/editing/name/saving/error state + load/save/delete/move handlers):
  - **Service Types** (dev; `service_types`, `sequence_order` swap-move, ledger job/bid prefix validation — max 4 chars, uniqueness vs siblings — then `reloadLedgerPrefixMap()`).
  - **Material Part Types** (dev|estimator; `part_types` + counts from `material_parts`; remove-all-unused).
  - **Material Assembly Types** (dev|estimator; `assembly_types` + counts from `material_templates`; remove-all-unused).
  - **Takeoff/Labor/Price Book Names** (dev; `fixture_types` + three count sources: `price_book_entries`, `labor_book_entries`, and takeoff matching via `takeoff_book_versions`→`takeoff_book_entries` **by lowercase fixture_name/alias_names match** — pure logic, Stage-A candidate; remove-unused uses all three counts).
  - **Counts Quick-add Names** (dev; `counts_fixture_groups` + `counts_fixture_group_items`, nested CRUD + move).
  - Plus **Manage Parts** (dev: link to `/duplicates`, orphan material prices) whose **modal + loaders stay in the parent** (`loadOrphanMaterialPrices` classifying `material_part_prices` joins, delete one/all, modal JSX ~4783–4866).
  - `SettingsCatalogsProspectsTab` engine also parent-resident: prospect copy defaults (6 `app_settings` keys), estimate customer-experience defaults (`ESTIMATE_EXPERIENCE_APP_KEY_LIST`), estimate public terms, estimate line-item catalog (`estimateCatalogApi` replace/fetch).
- **Coupling:** `serviceTypes` shared (see substrate); estimator filtering (`visibleServiceTypesForMaterials`, `canDeleteMaterialTypes = myRole === 'dev'`); estimator default-selection sync effect; several handlers write the mostly-invisible shared `error` (quirk #4). Note the tab is kept **mounted** while hidden, so the per-service-type load effects run regardless of tab visibility.
- **Approach (order #3):** Stage A — extract the takeoff-count fixture-name/alias matching into `src/lib/settingsCatalogs/` (or similar) + test; optionally a generic `swapSequenceOrder` helper (used identically 4×). Stage B — `useSettingsCatalogs` hook returning the five engines + orphan-prices state; move the orphan modal into `SettingsCatalogsTab`; parent keeps only `serviceTypes` exposure + the estimator sync. The prospects block's savers can move into its component in the same pass (they're simple `app_settings` upserts).

### 8. Templates & testing

- **Render:** `SettingsGroup id="settings-templates"` (~4986), dev-only → [`SettingsTemplatesTab`](../src/components/settings/SettingsTemplatesTab.tsx) (1,034 lines, ~85 props).
- **Status: JSX extracted; engine in parent (~550 lines, ~1843–2341 + report settings ~1346–1421).** Sections: `Job Parts Tally` (min-posted-date `app_settings` key + field-dispatch phone — both loaded by dev-gated parent effects ~3601–3651, saved inside the child via lib helpers); `Workflow email (Edge Function)` test (`send-workflow-notification` with `WORKFLOW_FN_TEST_PLACEHOLDER_STEP_ID`); `Notification Templates` (`notification_templates` CRUD + per-template test via `send-checklist-notification` and `substituteNotificationVariables`); `Email Templates` (`email_templates` CRUD; **~45-line inline defaults map** for 12 template types in `openEditTemplate`; `replaceTemplateVariables` — pure; test via `test-email` edge fn with `alert()` success); `Dashboard: Report Review` (report edit-window/sub-visibility `app_settings` + `report_enabled_users` diff-sync — this is the **report_enabled_users management** surface). Six **self-contained** dev blocks render inside the child: `MapDefaultViewSettingsBlock`, `BidCoverLetterDefaultsSettingsBlock`, `BillCustomerMemoDevSettingsBlock`, `PhysicalInvoiceFooterDevSettingsBlock`, `PhysicalInvoiceIssuerDevSettingsBlock`, `StripeInvoiceFooterDevSettingsBlock`.
- **Coupling:** `users` + shared `templateTestTargetUserId` (one picker feeds email test, notification test, and workflow-fn test; default set by effect ~3592). `emailTemplates` is checked by the workflow-fn test (must exist before testing). All test senders `refreshSession()` first and unwrap `FunctionsHttpError` bodies — identical ~25-line boilerplate ×3 (Stage-A/utility candidate).
- **Quirk:** the file's doc comment still lists "delete-all-estimates" — that button was removed in v2.707 (PR #356); update the comment when touching the file.
- **Approach (order #2):** Stage A — move the email-template defaults map + `replaceTemplateVariables` into `src/lib/settingsTemplates.ts` (it already holds the types + `substituteNotificationVariables`) with tests; consider a shared `invokeEdgeWithRefreshedSession` util. Stage B — `useSettingsTemplatesEngine(users, templateTestTargetUserId)` or move state directly into the tab (dev-only, single-surface). ~30 state vars leave the parent.

### 9. Advanced

- **Render:** outside any SettingsGroup, always mounted, `active` prop (~5071); gate `!isSubcontractorLikeRole(myRole)`.
- **Status: extracted;** [`SettingsAdvancedTab`](../src/components/settings/SettingsAdvancedTab.tsx) (92 lines): "Fix app" help + **claim-code form** (dev promotion). Parent residue: `code`/`codeError`/`codeSubmitting` + `handleClaimCode` → edge fn `claim-dev`, success → full `loadData()` (role may have changed). Failed attempts surface on the Dashboard via `DashboardClaimDevAttemptsBanner` (whose `/settings?tab=settings-people` link is inert — quirk #2).
- **Approach:** trivial — move the three state vars + handler into the tab, passing a `onRoleMaybeChanged` reload callback. Bundle with any nearby PR.

### 10. How it works

- **Render:** `<SettingsHowItWorksTab active={...} />` (~5129). All roles. **Done** — stateless static copy.

---

## Preserve-quirks list (do not "fix" during decomposition)

1. **Keep-mounted vs conditional-mount split** (structural fact #3): most tabs stay mounted `display:none` (their self-contained children keep loading/subscribing while hidden); `SettingsAccountSchedulingTab` and `SettingsCatalogsProspectsTab` unmount when inactive (their section-open booleans live in the parent, so open/closed survives remount but internal loads rerun). Preserve each tab's current semantics on any move.
2. **~~Inert deep links~~ FIXED v2.737:** `/settings?tab=…` (2 dashboard banners) and `/settings#settings-time-off` / `#settings-salary-workday` (Calendar ×6) now activate the right tab (and scroll, for the hash anchors) via `resolveSettingsDeepLink`. See quirk #2 above.
3. **`controller` is missing from the local `UserRole` union** (~line 76) yet fully live at runtime: `loadAssistantsAndAdoptions` fetches controllers via `'controller' as 'assistant'`, `saveJobOwnerOverrides` includes `'controller'` in creators, `isAssistantLike` matches it. `getSettingsJumpGroups` intentionally(?) gives controllers only the base tabs. Preserve the casts; unifying on the app-wide `UserRole` (from `useAuth`) is a separate cleanup.
4. **The shared `error` state is mostly invisible.** Handlers across Catalogs/Jobs/Dashboard/People write `setError`, but it only renders (a) as the whole-page early return before `myRole` loads and (b) inside SettingsPeopleTab's dev-only Additional People section. E.g. a service-type FK-delete failure on the Catalogs tab shows nothing where you clicked. Preserve during moves (thread `setError` as today); surfacing it properly is a UX change.
5. **Duplicated effects:** the `selectedServiceTypeForParts` → `loadPartTypes` effect and the `partTypes` → counts effect each appear **twice** verbatim (~3659–3669 and ~3757–3767). Harmless double-fires; keep or delete only in a dedicated no-behavior-change commit with reviewer eyes on it.
6. **Catalog load effects never clear on deselect** (`if (selected…) load…()` with no else) — clearing only happens inside the loaders for counts-fixtures. Stale lists persist if a selection is emptied; preserve.
7. **Two notification-history surfaces** (Recent-push tab self-contained vs Dashboard-tab parent-state section) query the same table independently — keep both.
8. **`SettingsDashboardTab` writes to supabase directly** while its loads live in the parent; when hook-ifying, keep write paths with the section, don't round-trip them through the parent.
9. **Email defaults map** (`openEditTemplate`, ~1982–2027) is product copy inline in code; `sendTestEmail` success uses a blocking `alert()`. Preserve verbatim.
10. **`buildSalariedWorkdayPickerRows`, `getMergedFilteredPins`, merge-duplicate finders are already pure `lib/*` kernels with tests** — reuse, don't re-extract.
11. **Adoption master-picker renders three identical `<select>`s** driving one `selectedMasterIdForAdoptions`; the sharing block always acts as self even when a dev is managing another master's adoptions. Preserve both behaviors.
12. **Default tab is "Recent push"** for every role; a page refresh always returns there (no URL/localStorage persistence).

---

## Recommended extraction order

Value = churn-reduction (hot file: 29 commits / 10 weeks) ÷ risk. Each step: Stage A (pure lib + tests) where named, then Stage B (hook/component move), one PR per step, `npm run typecheck && npm run lint && npm test` green, behavior-preserving.

1. ~~Sharing & Adoption → self-contained section~~ **DONE v2.853**: `SettingsSharingAdoptionSection` + `useMasterAdoptions`. −607 parent lines (5,171 → 4,564), 18 state vars out.
2. **Templates engine → `useSettingsTemplatesEngine` / into the tab.** Dev-only, almost fully isolated (`users` + shared test-target only). Stage A: defaults map + `replaceTemplateVariables` → `lib/settingsTemplates` + tests; optional shared edge-fn-invoke util. ~550 lines + ~30 state vars.
3. **Catalogs engine → `useSettingsCatalogs`** + move the orphan-prices modal into `SettingsCatalogsTab`; prospects-block savers into `SettingsCatalogsProspectsTab`. Stage A: takeoff fixture-name/alias count matching (+ optional `swapSequenceOrder`). Biggest single win (~1,050 lines); medium risk (keep `serviceTypes` exposed for the estimator sync + ledger-prefix reload).
4. **People/Jobs residue → `useSettingsPeopleDirectory` (+ small Jobs hook).** Merge-duplicates modal + handlers into SettingsPeopleTab; groups/pay-approved/person-edit handlers into the hook; Jobs tab's three handlers alongside. Also fold the tiny Advanced claim-code move in here.
5. **Dashboard residue → three hooks** (`useSettingsFinancialPins`, `useSettingsMyReports` — keeps the realtime channel and hands the reload fn to the page-level modals — and `useSettingsTeamLeaderAssignments`), shrinking the ~120-prop membrane; then sub-decompose the 1,985-line `SettingsDashboardTab` per section. Highest coupling; do after the seams above are proven.
6. **Account residue → `useSettingsAccount`** (profile/password/push/location + self-salaried check). Low churn; lowest priority.
7. **Dissolve `loadData`** incrementally into the hooks created above (each hook exposes its own reload; `onActiveAccountsDataChanged` and claim-code success then call only the affected reloads). This is the tail of every step, not its own big-bang PR.

Projected parent after steps 1–6: tab shell + role router + `loadData` remnant + cross-tab modal wiring — roughly 800–1,200 lines, matching the Bids/People end-state.
