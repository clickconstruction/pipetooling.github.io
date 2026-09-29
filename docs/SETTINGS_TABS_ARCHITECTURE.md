# Settings Tabs Architecture Map

---
file: docs/SETTINGS_TABS_ARCHITECTURE.md
type: Engineering / Refactor Map
purpose: Step-0 map for the Settings surface (per PAGE_DECOMPOSITION_PLAYBOOK.md) — inventory what is already extracted and what remains in the 1,821-line src/pages/Settings.tsx shell and the 1,643-line src/components/settings/SettingsDashboardTab.tsx (its largest child and the widest membrane of parent-owned state): state, loaders, handlers, supabase tables, role gates, mount semantics, coupling and test coverage, to drive the remaining extraction.
covers:
  - src/pages/Settings.tsx
  - src/components/settings/SettingsDashboardTab.tsx
mapped_at: 871e06336
audience: Developers, AI Agents
last_updated: 2026-09-29
---

> **Line numbers are exact as of `871e06336`** (from `npm run map -- <file>` fact sheets) and rot with the next edit — search the symbol; the range is only a hint. Re-run `npm run map -- src/pages/Settings.tsx` (or the tab file) before trusting a range.

## Overview

| File | Lines | Components | useState | Effects | useMemo | useCallback | useRef | Custom hooks | Last commit | Commits / 90 d |
|---|---|---|---|---|---|---|---|---|---|---|
| [`src/pages/Settings.tsx`](../src/pages/Settings.tsx) | 1,821 | 2 (`SettingsGroup`, `Settings`) | 51 | 14 | 5 | 2 | 1 | 13 | 2026-09-29 `340941456` | **62** |
| [`src/components/settings/SettingsDashboardTab.tsx`](../src/components/settings/SettingsDashboardTab.tsx) | 1,643 | 3 (`SortablePinRow`, `SettingsDashboardTab`, `QuickEstimateToggleSection`) | 4 | 2 | 0 | 0 | 0 | 4 | 2026-09-28 `1dc8e2dbf` | 15 |

Settings is a **decomposed page shell**: the v2.853–v2.859 campaign took it 5,171 → 1,703 lines by moving every tab's engine into `src/hooks/useSettings*.ts`; since then it has grown only by *born-self-contained* blocks (Company, Emails & reports, Usage, What customers see, Digital twins, Test reports, Owner auto-confirm, HCP reconcile, Dev MCP keys, Contracts & terms…) mounted straight into the render. It is still a **hot file** (62 commits / 90 days) — nearly all churn is new blocks added to the render, not engine edits. `src/App.tsx` is the page's only importer; `Settings.tsx` is the tab file's only importer.

**Where the weight is now:** of the parent's **51 `useState`, 37 serve the Your dashboard tab** (incl. the 5 report-modal and 2 mute-modal states), and **8 of its 14 effects** serve it too. The three states and the effect added since the 2026-09-25 census are shell glue: `viewAsOpen` + the `#view-as` effect (the View as… door, v2.4041), `bidCoverLetterOpenSignal` and `contractsOpenEntryId` (the Contracts & terms doors, v2.3977 · v2.4108). `SettingsDashboardTab` receives **109 props** (`SettingsDashboardTabProps`, 37–147) — the largest membrane of parent-owned state; `SettingsCatalogsTab` is wider (118 props) but 115 of them come from one hook. Everything else in the parent is shell, role fork, deep-link glue, or hook-output threading.

History (kept, compressed): 2026-06-01 collapsible sections → tabs + JSX-only moves (PRs #35–#49); v2.853–v2.859 engine campaign (see [Recommended extraction order](#recommended-extraction-order)); v2.2088 zoned reorg (You / Company / System / Help; group data moved to [`lib/settingsGroups.ts`](../src/lib/settingsGroups.ts); all group ids kept, `settings-company` added); v2.3539 the rail ([`SettingsRail`](../src/components/settings/SettingsRail.tsx) replaced the tab bar; last-opened tab remembered per device via [`lib/settingsRail.ts`](../src/lib/settingsRail.ts), key `settings_recent_tabs_v1`).

### Key structural facts

1. **Tab switching is component state + URL + device memory.** `activeSettingsTab` (176) holds a group id. `settingsJumpGroups = getZonedSettingsGroups(myRole)` (963) is the role-filtered list; `settingsGroupMeta`/`settingsGroupTitle`/`settingsGroupHint` (967–969) feed each `SettingsGroup` its label + `pagesHint`. Landing precedence (effect 1035–1042): valid current tab → `landingTab(groups, readRecentTabs(localStorage))` → first group (`settings-account`). Effect 1045–1049 records the visit (`rememberTab`) into `recentTabs` (178) for the rail's chips.
2. **Deep links** (effect 994–1026, guarded by `appliedDeepLinkRef` 991): [`resolveSettingsDeepLink`](../src/lib/settingsDeepLink.ts) maps `?tab=<group-id>` and `#<anchor>` (`SETTINGS_HASH_ANCHOR_TO_TAB`: `settings-time-off`, `settings-salary-workday`, `settings-dev-mcp-keys` → account; `settings-recently-deleted` → data; `settings-page-pins` → dashboard, and it opens `financialPinsSectionOpen`; `settings-claim-code` → advanced; `settings-estimate-public-terms`, `settings-estimate-cx-defaults`, `settings-bid-cover-letter-defaults` → catalogs, each opening its collapsed editor through `openContractEditorSection`; any `settings-contract-<id>` → contracts, one card — since v2.4108 the tab's `openEntryId` prop opens that row, set through `contractsOpenEntryId` (976) by What customers see's `onOpenContract` as well); the anchor is polled ~5 s then scrolled. `#view-as` (v2.4041) is its own effect (1029–1033): a dev who is not imitating gets `ViewAsPanel`, and the hash is dropped so a reload does not reopen it. `settingsFocus = settingsFocusParam(location.search)` (993, v2.3697) passes `?focus=issuer.<field>` to `PhysicalInvoiceIssuerDevSettingsBlock` (1548). Inbound: `DashboardPinnedQuickRow` + `QuickfillNeedsYouSection` (recently-deleted, claim-code), `BidsBidCostsTab` (`#settings-bid-job-backfill` with `?tab=`), `BidsRobotConsoleTab` (digital twins), `BankTransferDetailsPanel` (company), `JobsStagesTab` (`?tab=settings-jobs&focus=issuer.*`), `CustomerDetail` (`?tab=settings-what-customers-see&who=…`), `Calendar.tsx` ×4 (3 × `#settings-salary-workday`, 1 × `#settings-time-off`). (The kernel's header comment still names `DashboardBulkDeleteAlertBanner` / `DashboardClaimDevAttemptsBanner` as sources — neither file exists any more.) Search picks (`SettingsSearchBar` `onPick`, 1134–1145) route guide hits through `settingsSearchGuideQuery` → `?tab=settings-guides&g=<slug>` and poll-scroll anchors via `pollScrollToSettingsAnchor`.
3. **Mixed mount semantics.** `SettingsGroup` (91–146) hides with `display:none` → **kept mounted** (children load/subscribe while invisible): Account, Company, Dashboard, People, Data, Jobs & billing, Bids & materials, Templates, Digital twins, Release notes, and the Activity-logs wrapper div (1161–1170). **Conditional-mount** (unmount when inactive): `SettingsAccountSchedulingTab`, `SettingsMyEmailScheduleSection`, `DevMcpKeysCard` (1242–1255, outside the group), `SettingsCatalogsProspectsTab` (1556–1593, outside the group), `SettingsEmailStreamsSection`, `SettingsUsageTab`, `SettingsWhatCustomersSeeTab`, `SettingsContractsTab` (inside their groups, gated on `activeSettingsTab === id`), `GuideBrowser` (1804–1808, no group). `SettingsAdvancedTab` is always mounted and hides itself via `active`. Preserve each on any move.
4. **Role fork.** `loadData` (655–750) sets `myRole`; until it lands the page shows `Loading…` (1052) or the shared `error` (1053). Every tab's gate is `myRole`-based JSX; group visibility comes from `getZonedSettingsGroups`.
5. **Parent layout** — see the [region map](#settingstsx-region-map) below.

### How to read a dossier

Each tab lists render location (symbol + line range), **status** (self-contained | hook-backed + props | inline), **parent-resident state/handlers**, **supabase tables / RPCs / edge functions**, **coupling**, **role gate**, **tests**, and **approach** (Stage A = pure logic → `lib/*` + tests; Stage B = component/hook move).

### How to maintain this doc

- When a tab's engine moves, flip its Status in the master table and dossier and point at the new file/hook; update `covers` if a new big file joins the surface.
- Re-run `npm run map` and refresh line ranges + the census row; search the symbol when a range looks off.

---

## Settings.tsx region map

| Lines | Symbol | Role |
|---|---|---|
| 1–78 | imports | 72 local imports (every tab component, `ViewAsPanel`, 8 `useSettings*` hooks, `settingsGroups` / `settingsRail` / `settingsRailDoors` / `settingsSearch` / `settingsDeepLink` / `customerContractCatalog` kernels) |
| 80–88 | `UserRole` (local) | omits `controller` — quirk #3 |
| 91–146 | `SettingsGroup` | presentational `<section>` wrapper; `hidden` → `display:none` |
| 148–157 | (dead comments) | the removed tab bar's JSDoc + an orphan "Whole elapsed days" JSDoc (a third orphan, "Personal Salaried workday", sits at 193) — cleanup candidate |
| 159–1821 | `Settings` | page component |
| 160–174 | auth + impersonation memos (161–172), `usePushNotifications`, `useToastContext` | shell |
| 175–188 | `myRole`, `activeSettingsTab`, `recentTabs`, `viewAsOpen` (180, v2.4041), `emailStreamFocus`, `myEstimatorProspectsAccess`, `estimatorServiceTypeIds`, `users`, `loading`, `error` | shell / cross-tab |
| 189–214 | pins (189–192), dashboard buttons (194–207), goals (208–211), section-open flags (212–214) | **Dashboard tab** |
| 215 | `dataBackupSectionOpen` | Data tab (pass-through) |
| 222–339 | `useSettingsCatalogs({ setError })` destructure | Bids & materials |
| 342–366 | `useSettingsJobsAdmin({ enabled: dev, users, setError })` | Jobs & billing |
| 371–406 | `useSettingsProspectsCatalog({ enabled: dev, setError })` | Bids & materials (prospects block) |
| 409–465 | `useSettingsPeopleDirectory({ …, onDataChanged: loadData })` | People & teams |
| 468–512 | `useSettingsFinancialPins(myRole === 'dev')` | **Dashboard tab** |
| 514–528 | `showMyReports` + `useSettingsMyReports` | **Dashboard tab** + page modals |
| 531–570 | `useSettingsAccount({ authUser, myRole })` | Your account (+ `loadData`, rail footer) |
| 572–580 | `handleSignOut` | shell (rail footer) |
| 582–597 | notification-history / muted / ignored / mute-modal state | **Dashboard tab** |
| 598–622 | `useSettingsBackupExports(authUser?.id)` | Data tab + Account trailing header |
| 623–630 | report-notification (623–625) + report-modal (626–630) state | **Dashboard tab** + page modals |
| 631–652 | `impersonating`, `handleBackToMyAccount` | shell (banner) |
| 655–750 | `loadData` | role fork + Dashboard loads + dev `users` + `loadServiceTypes` |
| 752–783 | `saveReportNotificationPreferences`, `toggleReportNotificationTemplate` | **Dashboard tab** |
| 785–787 | effect → `loadData` on `authUser?.id` | shell |
| 789–928 | 6 effects + `loadMutedTasks` (849–873) + `loadIgnoredTaskTypes` (881–915) | **Dashboard tab** |
| 930–952 | `loadMyPins` (useCallback) + load effect + `pipetooling-pins-changed` listener | **Dashboard tab** |
| 955–961 | estimator service-type sync effect | Bids & materials |
| 963–969 | `settingsJumpGroups`, `settingsDoors` (965, `settingsRailDoors(myRole, { impersonating })`), `settingsGroupMeta`, title/hint helpers | shell |
| 971–984 | `bidCoverLetterOpenSignal`, `contractsOpenEntryId`, `openContractEditorSection` | shell → Contracts & terms doors (v2.3977 · v2.4108) |
| 989–1049 | deep-link glue (`useLocation`/`useNavigate` 989–990, `appliedDeepLinkRef` 991, `settingsFocus` 993, 4 effects: deep link 994–1026, `#view-as` 1029–1033, landing 1035–1042, recent tabs 1045–1049) | shell |
| 1052–1059 | early returns; `visibleServiceTypesForMaterials`, `canDeleteMaterialTypes` | shell / Bids & materials |
| 1062–1820 | render (759 lines; `SettingsGroup` ×14) | see master table |

---

## Master summary table

Tabs in `getZonedSettingsGroups` order (a dev's view). "Engine" = where the tab's state/loaders/handlers live today.

| # | Tab (group id) · zone | Render (lines) | Component(s) (lines) | Mount | Engine | Parent props | Risk | Next action |
|---|---|---|---|---|---|---|---|---|
| 1 | Your account (`settings-account`) · You | 1177–1223, 1242–1255 | `SettingsAccountTab` (345), `SettingsAccountBackupTrailing` (83), `SettingsAccountSchedulingTab` (100), `SettingsMyEmailScheduleSection` (331), `DevMcpKeysCard` (190) | group kept; last three conditional | `useSettingsAccount` (parent, 531–570) + `useSettingsBackupExports`; the other two self-contained | 31 + 4 + 7 + 0 + 0 | low | Stays: `loadData` and the rail footer read the hook |
| 2 | Your dashboard (`settings-dashboard`) · You | 1257–1369 | [`SettingsDashboardTab`](#settingsdashboardtabtsx-dossier) (1,643) | kept | **split**: 37 parent `useState` + 8 effects + `useSettingsFinancialPins` + `useSettingsMyReports`; child does the writes | **109** | high | Order #1–#7 |
| 3 | Jobs & billing (`settings-jobs`) · Company | 1506–1554 | `SettingsJobsTab` (314; 7 self-contained blocks inside), `JobBookSettingsSection`, `TestReportSettingsBlock`, `OwnerAutoConfirmSettingsBlock`, 4 invoice dev blocks, `SettingsHcpReconcileSection` (439) | kept | `useSettingsJobsAdmin` (parent, 342–366); rest self-contained | 24 (+ `onDbError`, `focusField`) | low | Order #5: hook into the tab |
| 4 | Bids & materials (`settings-catalogs`) · Company | 1556–1593, 1602–1732 | `SettingsCatalogsProspectsTab` (482), `SettingsCatalogsTab` (1,359), `BidCoverLetterDefaultsSettingsBlock`, `BidBoardValueRuleSettingsBlock` | catalogs kept; prospects conditional (outside group) | `useSettingsCatalogs` (222–339) + `useSettingsProspectsCatalog` (371–406), both parent | 118 + 34 | med | Order #5: catalogs hook into the tab; prospects stays |
| 5 | People & teams (`settings-people`) · Company | 1371–1434 | `SettingsPeopleTab` (746), `TeamReviewCadenceSettingsBlock` (84) | kept | `useSettingsPeopleDirectory` (parent, 409–465) | 52 | low–med | Order #5: hook into the tab |
| 6 | Emails & reports (`settings-emails`) · Company | 1172–1176 | `SettingsEmailStreamsSection` (900) | conditional | self-contained; focus set from Activity logs via `emailStreamFocus` (183) | 1 | — | Done |
| 7 | What customers see (`settings-what-customers-see`) · Company | 1440–1451 | `SettingsWhatCustomersSeeTab` (421) | conditional | self-contained; its `onOpenContract` sets the shell's `contractsOpenEntryId` and switches the tab (v2.4108) | 1 | — | Done |
| 7b | Contracts & terms (`settings-contracts`) · Company | 1452–1473 | `SettingsContractsTab` (675), `ContractReaderModal` (178), `ContractCardHistory` (85), `ContractCardReview` (79) | conditional | self-contained; kernels in `src/lib/contracts/` (`customerContractCatalog` the registry, `contractLastSent` v2.3992, `contractTextHistory` v2.3994); two callbacks from the shell (`onOpenEditor`, `onOpenStep`); `ContractReaderModal` (v2.4098) reads a card on the customer's sample page, `src/lib/contracts/contractReader.ts`; v2.4108 the tab is an index — area sections in journey order, one line per contract opening into its card, a lens and a find box, `src/lib/contracts/contractsIndex.ts`; `openEntryId` from the shell opens a row on arrival | 4 (`role`, `openEntryId`, the two callbacks) | — | Done |
| 8 | Company (`settings-company`) · Company | 1225–1240 | `SettingsCompanyDocumentsSection` (278), `SettingsOrgDefaultsSection` (111), `BankTransferDetailsSettingsBlock`, `OfficeAddressSettingsBlock`, `MapDefaultViewSettingsBlock` | kept | self-contained | 1 (`isDev`) | — | Done |
| 9 | Usage (`settings-usage`) · System | 1436–1438 | `SettingsUsageTab` (354) | conditional | self-contained (`usage_*` RPCs) | 0 | — | Done |
| 10 | Data & recovery (`settings-data`) · System | 1475–1504 | `SettingsDataTab` (185; `DeletedRecordsSection`, `BulkDeleteAlertSettingsBlock`, `BidJobBackfillSettingsBlock`, `StaleDraftBillsOnPaidJobsSection`) | kept | `useSettingsBackupExports` (parent; shared with Account trailing) + `dataBackupSectionOpen` (215) | 24 | — | Effectively done |
| 11 | Email templates & testing (`settings-templates`) · System | 1734–1743 | `SettingsTemplatesTab` (1,180), `EasterEggsSettingsBlock` (317) | kept | `useSettingsTemplatesEngine` inside the tab | 3 + 1 | — | Done |
| 12 | Digital twins & samples (`settings-digital-twins`) · System | 1745–1747 | `DigitalTwinsPanel` (669; `SampleAccountsCard`, `TwinFreshKeyPanel`) | kept | self-contained | 0 | — | Done |
| 13 | Advanced (`settings-advanced-tools`) · System | 1749–1755 | `SettingsAdvancedTab` (163) | always mounted, `active` hides | self-contained (claim-code, `claim-dev` fn) | 3 | — | Done |
| 14 | Activity logs (`settings-recent-push`) · System | 1161–1170 | `SettingsRecentEmailsSent` (200, dev), `SettingsRecentPushNotifications` (138) | wrapper div, kept | self-contained | 2 + 1 | — | Done |
| 15 | Guides (`settings-guides`) · Help | 1804–1808 | `GuideBrowser` (291) | conditional, no group | self-contained | 0 | — | Done |
| 16 | Release notes (`settings-release-notes`) · Help | 1810–1816 | `SettingsReleaseNotesSection` (111) | kept | self-contained | 1 (`role`) | — | Done |
| — | Page shell | 1064–1158 | impersonation banner (1064–1104), `SettingsRail` (111) + `SettingsSearchBar` (166) + the doors row (Job Parts Tally / View as… / Punch list from `lib/settingsRailDoors.ts`, v2.4041 · v2.4061; `ViewAsPanel` mounts here, `#view-as` opens it) + Sign out / Change password footer | — | parent | 8 (rail) + 2 (search) | — | **Stays** |
| — | Page-level modals | 1757–1799 | `ReportViewModal`, `ReportEditModal`, `MyReportsModal` (all three gated `showMyReports`), `ChecklistItemMuteModal` | — | parent state 592–593, 626–630 | — | low | Opened only from Your dashboard — order #3 / #7 |

---

## Role-gating matrix

Nine runtime roles. `isAssistantLike` = assistant | controller; `isSubcontractorLikeRole` = subcontractor | helpers. Tab visibility = [`getZonedSettingsGroups`](../src/lib/settingsGroups.ts) (app-wide `UserRole`, so **controller gets every assistant-like tab**); inner gates are JSX in the parent or the child.

| Tab / section | dev | master | assistant / controller | estimator | primary | superintendent | sub / helpers |
|---|---|---|---|---|---|---|---|
| Your account (profile / password / push / location, my email schedule) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ↳ DB-backup trailing header, Dev MCP keys | ✓ | — | — | — | — | — | — |
| ↳ Salaried workday | ✓ | self-salaried | self-salaried | self-salaried | self-salaried | self-salaried | self-salaried |
| Your dashboard (tab) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ↳ Dashboard buttons + placement | ✓ | ✓ (+ `builder_review`) | ✓ | — | — | — | — |
| ↳ Estimate/Change Order button (`QUICK_ESTIMATE_ROLES`) | ✓ | ✓ | — | ✓ | ✓ | ✓ | sub only |
| ↳ Page pins | ✓ (+ 4 financial pin rosters) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ↳ Daily goals, Team-leads pointer, Report notifications | ✓ | ✓ | ✓ | — | — | — | — |
| ↳ My Reports (`showMyReports`) | ✓ | ✓ | ✓ | — | ✓ | — | ✓ |
| ↳ My Notification History (when any exist), Muted Tasks | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ↳ Ignored task types | ✓ | — | — | — | — | — | — |
| Jobs & billing (tab) | ✓ | ✓ | ✓ | — | — | — | — |
| ↳ `SettingsJobsTab`, invoice footer/issuer/memo blocks, HCP reconcile | ✓ | — | — | — | — | — | — |
| ↳ Job Book, Test reports | ✓ | ✓ | ✓ | — | — | — | — |
| ↳ Owner auto-confirm | ✓ | ✓ | — | — | — | — | — |
| Bids & materials (tab) | ✓ | — | — | ✓ | — | — | — |
| ↳ Part / Assembly types | ✓ (delete) | — | — | ✓ (own service types, no delete) | — | — | — |
| ↳ Service types, book names, counts quick-add, Manage Parts, prospects block, bid cover letter, Board value rule | ✓ | — | — | — | — | — | — |
| People & teams (tab) | ✓ | ✓ (empty — every block is dev-only) | — | — | — | — | — |
| Emails & reports, Usage, Data & recovery, Email templates & testing, Digital twins & samples | ✓ | — | — | — | — | — | — |
| What customers see | ✓ | ✓ | ✓ | — | — | — | — |
| Contracts & terms (the doors to the editors on Bids & materials: dev only) | ✓ | ✓ | ✓ | — | — | — | — |
| Company (tab; company documents) | ✓ | ✓ | ✓ | ✓ | — | — | — |
| ↳ Org defaults, bank transfer details | ✓ | ✓ | — | — | — | — | — |
| ↳ Office address, Map default view | ✓ | — | — | — | — | — | — |
| Advanced (claim-code) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Activity logs (recent push; "Most recent emails sent" dev-only), Guides, Release notes | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## Shared substrate

- **`loadData()` (655–750) — the role fork.** Loads the own `users` row (role, estimator flags, name/email/phone → `applyProfileRow`) then `refreshSelfPaySalaryForPayName`; for dev | master | assistant-like: `user_dashboard_buttons` + `user_dashboard_preferences` (699–713), `report_templates` + `user_report_notification_preferences` (715–721), goal-picker `users` (723–728); for dev: the full `users` list (733–741); for dev | estimator: `loadServiceTypes()` (746–748). Callers: effect 785–787, `SettingsPeopleTab onActiveAccountsDataChanged` (1426), `useSettingsPeopleDirectory onDataChanged` (464), `SettingsAdvancedTab onRoleMaybeChanged` (1753). **Its whole middle branch is Dashboard-tab data** — it dissolves as order #2/#4 land.
- **`users` (186, dev-only list)** feeds `useSettingsJobsAdmin` (typed but never read — quirk #14), `useSettingsPeopleDirectory`, `SettingsDashboardTab` (the four financial-pin rosters only), `SettingsPeopleTab`, `SettingsJobsTab`, `SettingsTemplatesTab`, `EasterEggsSettingsBlock`. `ActiveAccountsPanel` loads its own copy (app-level modal) and reconciles via `onActiveAccountsDataChanged → loadData`.
- **`serviceTypes`** (from `useSettingsCatalogs`) is the only cross-tab datum outside the shell: estimator sync effect (955–961), `visibleServiceTypesForMaterials` (1056–1058), and `loadData`'s `loadServiceTypes` call.
- **`financialPinsSectionOpen`** lives in `useSettingsFinancialPins` but is the **Page pins** collapse for every role; the deep-link effect (1010) and the search pick (1143) open it.
- **`app_settings`**: new blocks own their keys via `src/lib/appSettingsKeys.ts` + per-domain lib fetch/save modules — **the seam to follow**; the parent itself no longer touches `app_settings` (hooks do: JobsAdmin, ProspectsCatalog, MyReports, the tab-instantiated TemplatesEngine; BackupExports reads the whole table for the settings export).
- **Toasts / errors.** `showToast` success: 1 call in the parent (`saveReportNotificationPreferences`), 1 in the Dashboard child. Failures write the page-wide `error` (quirk #4).
- **Seam-hook precedents** (all `src/hooks/`, none unit-tested): parent-instantiated `useSettingsCatalogs` (1,359 lines), `useSettingsJobsAdmin` (168), `useSettingsProspectsCatalog` (223), `useSettingsPeopleDirectory` (373), `useSettingsFinancialPins` (139), `useSettingsMyReports` (92), `useSettingsAccount` (331), `useSettingsBackupExports` (650); tab-instantiated `useSettingsTemplatesEngine` (729). Self-contained-section precedent: `useActiveAccountsManagement`, `useDeletedRecordsArchive`.

---

## Per-tab dossiers

### 0. Page shell (stays in parent)

- **Render:** impersonation banner 1064–1104 (`impersonating` 631; `handleBackToMyAccount` 636–652 restores the stash and returns to `impersonationReturnPath`, v2.3606); `ViewAsPanel` 1105 while `viewAsOpen`; `<div className="settingsShell">` 1107 → `SettingsRail` 1108–1158 (`groups`, `activeId`, `onSelect`, `doors` 1112–1128 — one `Link` per door with a `to`, the View as… button setting `viewAsOpen`; v2.4041 · v2.4061 —, `recent`, `hiddenNote`, `search`, `footer`); content column 1159.
- **Owned state:** `myRole`, `activeSettingsTab`, `recentTabs`, `viewAsOpen`, `loading`, `error`, `impersonating`; ref `appliedDeepLinkRef`. The `#view-as` effect (1029–1033) opens the panel for a dev who is not imitating and drops the hash.
- **Supabase:** `handleSignOut` (572–580: `auth.signOut` + `sb-*` localStorage sweep), `handleBackToMyAccount` (`auth.setSession`).
- **Coupling:** the rail footer's *Change password* calls `openPasswordChange` from `useSettingsAccount`; the search pick calls `setFinancialPinsSectionOpen`. `handleBackToMyAccount` re-implements the exit that `Layout.tsx` (469–485) also runs over the same `impersonationSession` kernel.
- **Tests:** `settingsGroups.test.ts` (11 cases, incl. parity with `e2e/settings-tabs.spec.ts` `TABS`), `settingsRail.test.ts` (5), `settingsRailDoors.test.ts`, `settingsDeepLink.test.ts` (7, `resolveSettingsDeepLink` only — `settingsFocusParam` untested), `settingsSearch.test.ts` (9), `impersonationSession.test.ts`, `impersonationUiLabels.test.ts`. The four glue effects (994–1049) have no unit test; the Playwright smoke (`e2e/settings-tabs.spec.ts`: every dev tab's marker, one `?tab=settings-data` deep link, one catalogs case) is not a PR gate.

### 1. Your account

- **Render:** `SettingsGroup id="settings-account"` 1177–1223 with `titleTrailing=<SettingsAccountBackupTrailing>` (dev-only content); `SettingsAccountTab` 1190–1222 (31 props: 29 from `useSettingsAccount` + `pushNotifications`, `myRole`). Outside the group, conditional on the active tab: `SettingsAccountSchedulingTab` 1242–1252 (7 props; holds `#settings-salary-workday`; since v2.3705 a pointer to People → Users → Pay replaces the dev "All salaried" picker), `SettingsMyEmailScheduleSection` 1253 (self-contained; includes `SettingsJobWatchesSection`), `DevMcpKeysCard` 1255 (dev; `#settings-dev-mcp-keys`, v2.3643).
- **Engine:** `useSettingsAccount` (531–570): profile save (dup-name check across `people` + `users`, name cascade, self-salary refresh), password re-verify + update, push test (`send-checklist-notification`), location permission. Tables: `users`, `people`, `people_pay_config`.
- **Coupling:** `applyProfileRow` + `refreshSelfPaySalaryForPayName` are called by `loadData` (686, 696); `openPasswordChange` by the rail footer; `selfIsSalariedInPayConfig` / `setSelfPaySalaryLoaded` written by `loadData`. `exportAllBackup` / `exportBackupBusy` shared with the Data tab (one `useSettingsBackupExports` instance); `lastFullBackupAtIso` feeds only the trailing header.
- **Tests:** `DevMcpKeysCard.render.test.tsx`; `buildSalariedWorkdayPickerRows.test.ts` (now used by People, not here). Hook untested.
- **Approach:** none — parent-owned by design.

### 2. Your dashboard → see the [SettingsDashboardTab.tsx dossier](#settingsdashboardtabtsx-dossier)

- **Render:** `SettingsGroup id="settings-dashboard"` 1257–1369 → `SettingsDashboardTab` 1258–1368 (**109 props**). Page-level modals it opens: 1757–1799.

### 3. Jobs & billing

- **Render:** `SettingsGroup id="settings-jobs"` 1506–1554. Dev: `SettingsJobsTab` 1507–1534 (24 props: 23 from `useSettingsJobsAdmin` + `users` — company owner account `app_settings.company_owner_user_id` (one-company v2.2972, replaced per-user `job_owner_override_<userId>`), re-assign jobs (`jobs_ledger.master_user_id` + RPC `list_job_counts_by_master_for_dev_settings`), default labor rate; plus self-contained `HideHcpFieldSettingsBlock`, `SubPortalPaySettingsBlock`, `LegalFirmSettingsBlock`, `TripChargeAmountsSettingsBlock`, `JobAddressCityListSettingsBlock`, `TxCountyMapSettingsBlock`, `DevelopmentsSettingsBlock`). Dev | master | assistant-like: `JobBookSettingsSection` 1538–1540 (`onDbError → setError`), `TestReportSettingsBlock` 1542 (v2.3298). Dev | master: `OwnerAutoConfirmSettingsBlock` 1544 (v2.3450). Dev: `StripeInvoiceFooterDevSettingsBlock`, `PhysicalInvoiceIssuerDevSettingsBlock` (`focusField` from `settingsFocus`), `PhysicalInvoiceFooterDevSettingsBlock`, `BillCustomerMemoDevSettingsBlock` 1545–1552; `SettingsHcpReconcileSection` 1553.
- **Tests:** `companyOwner.test.ts`, `SettingsHcpReconcileSection.render.test.tsx` + `lib/settings/hcpReconcile.test.ts`, `txCountySettings.test.ts`. Hook untested.
- **Approach (order #5):** instantiate `useSettingsJobsAdmin` inside `SettingsJobsTab` (tab is kept-mounted and dev-gated → identical load timing); drop the unread `users` param in a separate no-behavior commit.

### 4. Bids & materials

- **Render:** dev-only `SettingsCatalogsProspectsTab` 1556–1593 (**before** the group, outside it, conditional-mount; 34 props from `useSettingsProspectsCatalog`: prospect copy defaults, estimate customer-experience defaults, public terms, line-item catalog). `SettingsGroup id="settings-catalogs"` 1602–1732: `SettingsCatalogsTab` 1603–1724 (dev | estimator; 118 props — 115 from `useSettingsCatalogs` (every returned name but `loadServiceTypes`) plus `visibleServiceTypesForMaterials` / `canDeleteMaterialTypes` computed at 1056–1059, and `myRole`); dev: `BidCoverLetterDefaultsSettingsBlock` (its `openSignal` is `bidCoverLetterOpenSignal`, the Contracts & terms door) + `BidBoardValueRuleSettingsBlock` 1726–1731.
- **Engine:** `useSettingsCatalogs` — five CRUD engines (service types with ledger-prefix validation, part types, assembly types, fixture/book names with three count sources, counts quick-add groups/items) + orphan material prices. Tables: `service_types`, `part_types`, `material_parts`, `assembly_types`, `material_templates`, `fixture_types`, `price_book_entries`, `labor_book_entries`, `takeoff_book_versions` / `takeoff_book_entries`, `counts_fixture_groups` / `_items`, `material_part_prices`.
- **Coupling:** `serviceTypes` (substrate); estimator sync effect 955–961 writes `setSelectedServiceTypeForParts/Assemblies`; `loadData` calls `loadServiceTypes` (746–748). Prospects hook must stay in the parent (conditional mount — unsaved edits survive tab switches, quirk #1).
- **Tests:** `settingsCatalogs.test.ts` (Stage-A kernels), e2e catalogs case. Hook untested.
- **Approach (order #5):** move the estimator sync + `visibleServiceTypesForMaterials` / `canDeleteMaterialTypes` into `useSettingsCatalogs` (pass `myRole`, `estimatorServiceTypeIds`), let the hook load on enable, then instantiate it inside `SettingsCatalogsTab` — membrane 118 → ~2 props, −~240 parent lines (destructure 222–339 + JSX 1604–1723).

### 5. People & teams

- **Render:** `SettingsGroup id="settings-people"` 1371–1434; dev: `SettingsPeopleTab` 1372–1428 (52 props: 49 from `useSettingsPeopleDirectory` + `users`, `error`, `onActiveAccountsDataChanged`), `TeamReviewCadenceSettingsBlock` 1432. The tab holds the accounts pointer (People → Users → Account, *Manage accounts…* opens the app-level `ActiveAccountsModal`, *Find duplicates…* the merge modal), role-visibility table, Task Dispatch / Estimator Inbox groups, Pay Approved Masters, `AssistantHoursWindowSettingsBlock`, `QuickAddSettingsBlock`, `TeamFeedbackDevSettingsBlock` (pointer), Additional People (the only render sites of `error`, 497 / 564 of the child).
- **Engine:** `useSettingsPeopleDirectory` — tables `people`, `users`, `people_pay_config`, `dispatch_group_members`, `estimator_group_members`, `pay_approved_masters`; `onDataChanged → loadData`.
- **Role gate:** tab for dev | master; every block is dev-only, so a master sees an empty tab.
- **Tests:** `mergePersonUserDuplicates.test.ts`, `QuickAddSettingsBlock.render.test.tsx`. Hook untested.
- **Approach (order #5):** instantiate the hook inside `SettingsPeopleTab`; keep `users`, `error`, and the `loadData` callback as props.

### 6–9, 12, 14–16. Self-contained tabs (done)

Emails & reports (`SettingsEmailStreamsSection`, `focus` prop from `emailStreamFocus`, set when an Activity-logs email row is clicked, 1164–1167), What customers see (`SettingsWhatCustomersSeeTab`, gate `canSeeWhatCustomersSee`; reads `?step=`; `onOpenContract` from the shell), Contracts & terms (`SettingsContractsTab`, the same gate; `openEntryId` from the shell; tests `SettingsContractsTab.render.test.tsx` (11), `ContractReaderModal.render.test.tsx`, and the kernels' `customerContractCatalog`, `contractsIndex`, `contractReader`, `contractLastSent`, `contractTextHistory` tests), Company (1225–1240; five blocks; tests `SettingsOrgDefaultsSection.render.test.tsx`, `officeAddressSettings.test.ts`, `mapDefaultViewSettings.test.ts`), Usage (`SettingsUsageTab`, `usageDashboard.ts` kernel), Digital twins & samples (`DigitalTwinsPanel`; `TwinFreshKeyPanel.render.test.tsx`), Activity logs (`SettingsRecentEmailsSent` → `email_send_log` + `sync-resend-emails`; `SettingsRecentPushNotifications` → `notification_history` — the second, independent history surface, quirk #7), Guides (`GuideBrowser`, `HELP_GUIDE_URL_PARAM`), Release notes (`SettingsReleaseNotesSection`, `SettingsReleaseNotesSection.render.test.tsx`). No parent state beyond `emailStreamFocus`.

### 10. Data & recovery

- **Render:** 1475–1504, dev → `SettingsDataTab` (24 props: 22 from `useSettingsBackupExports` + `dataBackupSectionOpen`/setter from the parent, 215). Self-contained inside: `DeletedRecordsSection` (`#settings-recently-deleted`), `BulkDeleteAlertSettingsBlock` (`appSettingsBulkDeleteAlert.test.ts`), `BidJobBackfillSettingsBlock` (`#settings-bid-job-backfill`), `StaleDraftBillsOnPaidJobsSection`.
- **Approach:** optional — move `dataBackupSectionOpen` into the tab (pure tab-local state); keep the exports hook single-instance while the Account header shares it.

### 11. Email templates & testing

- **Render:** 1734–1743, dev → `SettingsTemplatesTab` (`authUser`, `users`, `setError`) + `EasterEggsSettingsBlock` (`users`). Self-contained via `useSettingsTemplatesEngine`; `EMAIL_TEMPLATE_DEFAULTS` / `replaceTemplateVariables` in `lib/settingsTemplates.ts` (`settingsTemplates.test.ts`). The child's header comment still lists "invoice/map dev blocks" (moved to Jobs & billing / Company in v2.2088).

### 13. Advanced

- **Render:** 1749–1755, gate `!isSubcontractorLikeRole(myRole)`; props `active`, `isDev`, `onRoleMaybeChanged → loadData`. Self-contained claim-code form (`#settings-claim-code`, `claim-dev` fn) + "Fix app" help.

---

## SettingsDashboardTab.tsx dossier

**Absorbed into this map 2026-09-25** (it had no map of its own). 1,643 lines; header comment still claims "Presentational; all state/handlers live in the parent" — false (quirk #8).

**Module scope:** `NotificationHistoryRow` 35 · `SettingsDashboardTabProps` 37–147 (109 props) · `pinKeyOf` 149–151 · `pinLabel` 152–154 · `SortablePinRow` 157–207 (presentational dnd-kit row) · `SettingsDashboardTab` 209–1564 (render 339–1563) · `QuickEstimateToggleSection` 1573–1643.

**Component-local:** `useToastContext` 320, `useConfirmDialog` 321, `orderedPins` 324 (mirror of `myPins`, re-synced by effect 325–327), `useSensors` 328 (8 px activation), `handlePinDragEnd` 329–338 (`arrayMove` → `reorderPins`).

### Section regions

| Child lines | Section (anchor text) | Gate | Props (count) | Parent-resident state / loaders (Settings.tsx) | Child writes | Tests |
|---|---|---|---|---|---|---|
| 342–449 (open 366–447) | Dashboard buttons + quick-buttons placement | dev · master · assistant-like; `builder_review` master-only | `dashboardButtons*`, `dashboardQuickButtonsPlacement*` + 5 setters (10) + `setError` | state 194–207, 212; load in `loadData` 699–713 (defaults map, `builder_review: role === 'master_technician'`) | `user_dashboard_buttons` upsert (~381–390), `user_dashboard_preferences` upsert ×2 (409–438) | none |
| 451 → 1573–1643 | Estimate/Change Order button (*Write up a change from the field*, v2.4047) | `isQuickEstimateRole` | `authUserId`, `myRole` | — (**self-contained**: 3 state, load effect 1584–1601) | `user_dashboard_buttons` `quick_estimate` upsert (1620–1629) | none |
| 453–980 (open 477–978) | Page pins (`#settings-page-pins` 454) — list, clear all, drag reorder, remove | all roles (`myRole != null`) | `myPins`, `pinsLoading`, `pinRemovingId`, `pinsClearSuccess`, 2 setters, `financialPinsSectionOpen` + setter (8) | state 189–192 (`pinRemovingId` / `pinsClearSuccess` are written **only by the child**, through the passed setters); `loadMyPins` 930–940 (`getMergedFilteredPins`, needs `myEstimatorProspectsAccess` 184 from `loadData`); effects 942–952 (`pipetooling-pins-changed`); `financialPinsSectionOpen` from the hook, opened by deep link 1010 / search 1143 | `clearPinned` + `clearPinnedInSupabase` (~491–495), `removePin` (~522–525), `reorderPins` (337) | `pinnedTabs.test.ts` covers pure helpers only (`computeReorderedSort`, `pinKey`, `filterPinnedByRole`, `isPinnedIn`); I/O + dnd untested |
| 537–975 | ↳ financial pin rosters: **Billed** 539–646 (`/jobs` · `billed`), **Internal Team labor** 648–753 (`/people` · `hours`, `costMatrix*` names), **Supply Houses AP** 755–860 (`/materials` · `supply-houses`), **Sub Labor Due** 862–973 (`/jobs` · `sub_sheet_ledger`; Unpin All also clears `/materials` · `external-team`) | dev | 41 from `useSettingsFinancialPins` (4 rosters × 8 state/setters + 4 totals/count + 4 loaders + `billedCount`) + `users` | `useSettingsFinancialPins` 468–512 (tables `jobs_ledger`, `jobs_ledger_invoices`, `supply_house_invoices`; `fetchSubLaborDueTotal`, `useWeeklyTeamLaborTotal`) | `addPinForUser` per selected master, `deletePinForPathAndTab` | **none — untested money** (see below) |
| 982–1086 (open 1006–1084) | Daily goals (clock-in gate) | dev · master · assistant-like | `dailyGoals*` (4) + 3 setters + `goalPickerUsers` (8) + `setError` | state 208–211, 213; goal-picker `users` in `loadData` 723–728; load effect 789–814 keyed on `dailyGoalsTargetUserId` | `user_dashboard_goals` update / delete (confirm) / insert (1038–1073) | none |
| 1088–1094 | Team leads pointer (Job Book moved out, v2.2088 comment) — stale copy: v2.3616 retired the People → Users → Team leads it points at | dev · master · assistant-like | — | — | — | — |
| 1096–1152 (open 1120–1150) | Report notifications | dev · master · assistant-like | 7 (`reportTemplates`, `reportNotificationTemplateIds`, saving, open + setter, `saveReportNotificationPreferences`, `toggleReportNotificationTemplate`) | state 214, 623–625; load in `loadData` 715–721; handlers 752–783 (diff-sync inserts/deletes on `user_report_notification_preferences`) | none (submit calls the parent) | none (renders raw `t.name`) |
| 1155–1257 (expanded 1200–1255) | My Reports | `showMyReports` (514–519) | 11 (`myReports*` ×4, `setMyReportsExpanded`, `showMyReports`, 5 modal setters) | `useSettingsMyReports` 521–528 (`list_my_reports` RPC, realtime `settings-my-reports-changes`, `app_settings` edit window, `loadMyReportsRef`); modal state 626–630; modals 1757–1791 | none | `reportTemplateDisplayName.test.ts` (row label at 1230 only) |
| 1259–1351 (open 1291–1349) | My Notification History (`#notification-history-content`) | `hasNotificationHistory === true` | 6 | state 582, 594–597; effects 816–827 (has-any probe), 829–847 (open-triggered load, 100 rows), 923–928 (scroll into view) | none | none |
| 1353–1449 (open 1385–1447) | Muted Tasks | `authUser?.id` | 7 (`mutedTasks*` ×3, setter, `loadMutedTasks`, `setMuteModalItemId`, `setMuteModalTitle`) | state 583–585, 592–593; `loadMutedTasks` 849–873 (`user_checklist_item_mute_preferences` + `checklist_items`); effect 875–879; `ChecklistItemMuteModal` 1792–1799 (`onSaved → loadMutedTasks`) | unmute delete (~1427–1434) | none |
| 1451–1560 (open 1482–1558) | Ignored task types (Dashboard) | dev | 7 + `setError` | state 586–591; `loadIgnoredTaskTypes` 881–915 (`dev_ignored_checklist_items` + `checklist_items`, `withSupabaseRetry`); effect 917–921 | unignore delete + toast (~1519–1535) | none |

Prop tally: 4 shared (`authUser`, `myRole`, `users`, `setError`) + 10 buttons + 8 pins + 41 rosters + 8 goals + 7 report notifications + 11 My Reports + 6 history + 7 muted + 7 ignored = **109**.

**Untested money math (risk flag).** `useSettingsFinancialPins.loadBilledTotalAndPinnedUsers` sums `revenue − payments_made` over `jobs_ledger.status = 'billed'` **plus** `jobs_ledger_invoices.amount` where `status = 'billed'`; `loadSupplyHousesAPTotalAndPinnedUsers` sums unpaid `supply_house_invoices.amount`. Neither shares a kernel with the boards those pins point at, and the child builds the four dollar labels inline in three formats (581 two-decimal with count, 689 and 796 rounded, 903 two-decimal). No test covers any of it, nor `fetchSubLaborDueTotal` / `useWeeklyTeamLaborTotal`. A pinned label can silently disagree with its destination page.

**Tabs / surfaces this child couples to:** page-level report + mute modals (setters flow up); the deep link + search (Page pins collapse); People → Users → Team leads (pointer text only, and a dead one since v2.3616). Outside Settings: `Dashboard.tsx` reads `user_dashboard_buttons` / `user_dashboard_preferences`, `lib/dailyGoalsGate.ts` reads `user_dashboard_goals` (the clock-in gate these goals feed), and `DashboardMyInboxCard` writes the `dev_ignored_checklist_items` rows this tab lists and un-ignores.

---

## Test coverage summary

| Region | Covered by | Gap |
|---|---|---|
| Tab list, zones, role gates | `settingsGroups.test.ts` | — |
| Landing / recent tabs | `settingsRail.test.ts` | effect wiring (1035–1049) |
| Deep links / search | `settingsDeepLink.test.ts`, `settingsSearch.test.ts`, e2e smoke (not a gate) | `settingsFocusParam`, `pollScrollToSettingsAnchor`, apply effect 994–1026 |
| `loadData` role fork | — | no unit or render test |
| Dashboard tab (all sections) | pure pin helpers + the My Reports row label only | no render smoke for `SettingsDashboardTab`; **financial totals + pin labels untested** |
| Catalogs / Templates / People / Jobs engines | their Stage-A kernel tests | all 9 `useSettings*` hooks untested |
| Self-contained blocks | 9 `*.render.test.tsx` in `components/settings/` + domain lib tests | — |
| `Settings.tsx` page | — | no `Settings.render.test.tsx` |

---

## Preserve-quirks list (do not "fix" during decomposition)

1. **Keep-mounted vs conditional-mount split** (structural fact #3). Kept-mounted children load while hidden (e.g. `QuickEstimateToggleSection`'s fetch); the parent hooks load on page open whatever the tab (e.g. `useSettingsFinancialPins`' four loads for a dev). Conditional children re-run loads on each visit; their open/edit state lives in the parent where it must survive (`useSettingsProspectsCatalog`, `salaryWorkdaySectionOpen`).
2. **Group ids are load-bearing:** `?tab=` links, `SETTINGS_HASH_ANCHOR_TO_TAB`, the search index, the e2e `TABS` list, and `settings_recent_tabs_v1` in localStorage all key on them. Anchors not in the hash map (`settings-bid-job-backfill`, `settings-legal-firm`, `settings-quick-add`, `settings-org-defaults`) only work when the link also carries `?tab=`.
3. **`controller` is missing from the local `UserRole` union** (80–88); `loadData` casts `me.role`. The groups kernel uses the app-wide union and `isAssistantLike`, so controllers do get Jobs & billing, What customers see and Company. Unifying on `useAuth`'s `UserRole` is a separate cleanup.
4. **The shared `error` is mostly invisible.** Written by `loadData`, the goals effect, `loadIgnoredTaskTypes`, `JobBookSettingsSection onDbError`, `SettingsTemplatesTab` (`setError` → `useSettingsTemplatesEngine` `onSharedError`), four parent hooks and six child sites in `SettingsDashboardTab` (418, 438, 1042, 1052, 1073, 1535); rendered only by the pre-role early return (1053) and `SettingsPeopleTab`'s dev-only Additional People. A failed goal save on Your dashboard shows nothing. Thread `setError` as today.
5. **Duplicated catalog effects** (now in `useSettingsCatalogs.ts`: `selectedServiceTypeForParts → loadPartTypes` at 1182 and 1221; `partTypes → loadPartTypePartCounts` at 1189 and 1228). Harmless double-fires; remove only in a dedicated no-behavior commit.
6. **Catalog load effects never clear on deselect** (`if (selected…) load…()` with no else — all but the counts-groups effect at 585, which clears both lists). Preserve.
7. **Two notification-history surfaces** (Activity logs `SettingsRecentPushNotifications` vs Dashboard *My Notification History*) query `notification_history` independently. Keep both.
8. **`SettingsDashboardTab` writes to supabase directly** while its loads live in the parent; when hook-ifying, keep each write with its section. Fix the stale "Presentational" header comment when touching the file.
9. **`financialPinsSectionOpen` is the all-roles Page pins collapse** despite living in the dev-only financial-pins hook (the hook is called with `enabled = dev`, but its `useState` runs for everyone). Lift it before moving the hook.
10. **Report and mute modals render at page level, outside every `SettingsGroup`** (1757–1799). If they move into a Dashboard section, keep them out of `display:none` ancestors (portal) and keep `loadMyReportsRef` / `loadMutedTasks` as their reload hooks.
11. **Already-pure kernels — reuse, don't re-extract:** `buildSalariedWorkdayPickerRows`, `mergePersonUserDuplicates`, `pinnedTabs` pure helpers, `settingsCatalogs`, `settingsTemplates`, `settingsRail`, `settingsGroups`, `settingsDeepLink`.
12. **Landing tab** is URL → last tab on this device → `settings-account`; a refresh with no URL returns to the last tab, not a fixed default.
13. **`dashboardButtons` defaults exist twice**: the `useState` initializer (194–204, `builder_review: true`) and `loadData`'s map (705, `builder_review: role === 'master_technician'`). The loader wins; keep both until the section owns its load. `Dashboard.tsx` (723) carries the loader's map verbatim — a shared `dashboardButtonDefaults(role)` kernel is the Stage-A half of order #4.
14. **`useSettingsJobsAdmin` is passed `users` but never reads it** (its destructure takes only `enabled`, `setError`).

---

## Recommended extraction order

**Done (v2.853–v2.859): `Settings.tsx` 5,171 → 1,703 lines (−67%).** Sharing & Adoption (v2.853; section later removed v2.922), `useSettingsTemplatesEngine` (v2.854), `useSettingsCatalogs` + Stage-A `settingsCatalogs.ts` (v2.855), `SettingsAdvancedTab` self-contained + `useSettingsJobsAdmin` + `useSettingsProspectsCatalog` (v2.856), `useSettingsPeopleDirectory` + merge modal into `SettingsPeopleTab` (v2.857), `useSettingsFinancialPins` / `useSettingsMyReports` / team-leader assignments (v2.858; the latter since rehomed to People → Users → Team leads as `useTeamLeaderAssignments`, then deleted with Team leads in v2.3616), `useSettingsAccount` (v2.859). Since then the file grew back to 1,821 through self-contained blocks and the Contracts & terms door glue only.

**Remaining**, ranked by value (membrane + parent-state reduction, money-risk closure) ÷ risk. One PR per step; `npm run typecheck && npm run lint && npm test` green; behavior-preserving; add a `SettingsDashboardTab.render.test.tsx` smoke (via `renderWithProviders`) in step 2 and extend it per step.

1. **Stage A — financial pin money kernel.** New `src/lib/settingsFinancialPins.ts`: `billedAwaitingTotals(jobs, invoices)` and `unpaidApTotal(rows)` (from `useSettingsFinancialPins`), and `financialPinItem(kind, { count, total })` for the four path/tab/label builders (child 581–582, 689, 796, 903–904), with tests. Pure move; closes the untested money math this surface owns (the Sub Labor Due / Internal Team totals come from the shared `fetchSubLaborDueTotal` / `useWeeklyTeamLaborTotal`, still untested). The totals half is the playbook's cross-cutting item #29 (one AP / billed kernel for the boards and the pins, [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md)): once Materials' SupplyHousesTab Stage A lands `buildSupplyHouseSummary` ([`MATERIALS_TABS_ARCHITECTURE.md`](./MATERIALS_TABS_ARCHITECTURE.md)), prove the two AP sums agree and reuse it rather than keep a Settings-only copy.
2. **Four zero-coupling Dashboard sections become self-contained** (own state + loads, like the born-self-contained blocks): *My Notification History* (582, 594–597; effects 816–847, 923–928), *Ignored task types* (586–591; 881–921), *Daily goals* (208–211, 213; 789–814; goal-picker load leaves `loadData` 723–728), *Report notifications* (214, 623–625; `loadData` 715–721; 752–783). −28 props, −18 parent `useState`, −5 effects. Keep `setError` threaded (quirk #4). Risk: low.
3. **Muted Tasks + `ChecklistItemMuteModal` together** (583–585, 592–593, 849–879, modal 1792–1799): −7 props, −5 state, −1 effect. Mind quirk #10 (modal stays out of the hidden group).
4. **Dashboard buttons section** (194–207, 212; `loadData` 699–713): −10 props, −5 state; with step 2 this empties `loadData`'s dev | master | assistant-like branch. Resolve quirk #13 by keeping the loader's defaults.
5. **Move three parent hooks into their kept-mounted tabs** — `useSettingsJobsAdmin` → `SettingsJobsTab` (membrane 24 → 1, `users`), `useSettingsPeopleDirectory` → `SettingsPeopleTab` (52 → 3: `users`, `error`, the `loadData` callback; the hook also takes `authUserId`, so the tab calls `useAuth` or that is a 4th), `useSettingsCatalogs` → `SettingsCatalogsTab` (118 → ~2) after the estimator sync (955–961) and `visibleServiceTypesForMaterials` / `canDeleteMaterialTypes` (1056–1059) move into the hook and it loads on enable (drops `loadData` 746–748). Mount timing unchanged. `useSettingsProspectsCatalog` stays (conditional mount). Risk: low–med (Catalogs is the largest diff).
6. **Page pins + financial rosters** (highest coupling): first lift `financialPinsSectionOpen` into the parent (quirk #9); then `SettingsPagePinsSection` owns `myPins` / `pinsLoading` / `pinRemovingId` / `pinsClearSuccess` (189–192), `loadMyPins` + the `pipetooling-pins-changed` listener (930–952), `orderedPins` / dnd, taking `myEstimatorProspectsAccess` as a prop; one `FinancialPinRosterCard` replaces the four ~106–112-line near-copies (539–973) using step 1's kernel, with `useSettingsFinancialPins` instantiated inside the section. −47 props, −4 state, −2 effects.
7. **My Reports + the three report modals** (514–528, 626–630, 1757–1791): only this tab opens them; −11 props, −5 state; low value, portal caveat (quirk #10). Last.
8. **`loadData` remnant** → own-user row (role, estimator flags, profile hydration) + dev `users` only.

End state after 1–7: `SettingsDashboardTab` 109 → ~7 props (`authUser`, `myRole`, `users`, `setError`, `financialPinsSectionOpen` + setter, `myEstimatorProspectsAccess`); parent `useState` 51 → 14 (the 37 Dashboard states leave); `Settings.tsx` roughly halves (estimate) to shell + role fork + deep-link glue + Account/Data/Prospects hook threading.
