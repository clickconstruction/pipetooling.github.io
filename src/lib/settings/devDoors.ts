/**
 * Dev doors (v2.5882, punch list #188): the list behind Settings → System → Dev doors → **Only devs and the controller
 * see these**. One row per door only a dev, only a dev and the controller, or only the owner or a dev may open today,
 * each with the link that lands on it, who may open it, one line of what it is, and the code that gates it. The audit
 * that found them, with a recommendation per row for the owner, is `to-dos/dev-gates/README.md`.
 *
 * Pure: no React, no supabase. `devDoors.test.ts` holds every link's path to a route `src/App.tsx` serves (the pattern of
 * `twins/appDirectoryCheck.ts`) and every row's gate to a file that still exists and still holds the quoted text, so a
 * row cannot rot silently when a gate moves or a door opens wider. The card is read-only: it opens doors and changes no
 * gate. When a gate changes, change the row here in the same PR, or the test says which row is stale.
 *
 * A door in a tab that is itself dev-only is one row for the tab, with its blocks named in the line; a dev-only block
 * inside a tab other roles see is a row of its own, since the block is the door.
 */

export type DevDoorWho = 'dev' | 'dev and controller' | 'owner or dev' | 'controller'

export const DEV_DOOR_WHO_LABEL: Readonly<Record<DevDoorWho, string>> = {
  dev: 'dev',
  'dev and controller': 'dev and controller',
  'owner or dev': 'owner or dev',
  controller: 'controller',
}

export const DEV_DOOR_AREAS = [
  'Settings',
  'Header and gear menu',
  'Dashboard',
  'Jobs and the Pipeline',
  'Accounts Receivable',
  'Banking',
  'People',
  'Tally',
  'Bids',
  'GC projects',
  'Messages',
  'Checklist and Roadmap',
  'Quickfill',
  'Other pages',
] as const

export type DevDoorArea = (typeof DEV_DOOR_AREAS)[number]

export type DevDoorGate = {
  /** The file that decides it, repo-relative. The test fails when it is gone. */
  file: string
  /** A short literal the file still holds: the helper's name or the check itself. The test fails when it is gone. */
  text: string
}

export type DevDoor = {
  /** Stable id, the row's key. */
  id: string
  /** The door's name as the screen prints it. */
  label: string
  /** The page the door is on, for grouping. */
  area: DevDoorArea
  /** The link that lands on it: a route with the query or hash that opens the tab, card or window. */
  to: string
  who: DevDoorWho
  /** One line of what it is, in plain words. */
  what: string
  gate: DevDoorGate
}

const d = (row: DevDoor): DevDoor => row

export const DEV_DOORS: readonly DevDoor[] = [
  // Settings
  d({ id: 'settings-training', label: 'Training', area: 'Settings', to: '/settings?tab=settings-training', who: 'dev', what: 'Which courses each role must take, how long a pass is good for, and where everyone stands.', gate: { file: 'src/lib/settingsGroups.ts', text: "id: 'settings-training'" } }),
  d({ id: 'settings-emails', label: 'Emails & reports', area: 'Settings', to: '/settings?tab=settings-emails', who: 'dev', what: 'The scheduled email streams the office receives and who is on each one.', gate: { file: 'src/lib/settingsGroups.ts', text: "id: 'settings-emails'" } }),
  d({ id: 'settings-what-the-team-sees', label: 'What the team sees', area: 'Settings', to: '/settings?tab=settings-what-the-team-sees', who: 'dev', what: 'Every email the app sends someone on the team, as one person’s week, with sample data.', gate: { file: 'src/lib/settingsGroups.ts', text: "id: 'settings-what-the-team-sees'" } }),
  d({ id: 'settings-what-everyone-sees', label: 'What everyone sees', area: 'Settings', to: '/settings?tab=settings-what-everyone-sees', who: 'dev', what: 'Every screen of the app, as every role and in every state, drawn live on an invented company.', gate: { file: 'src/lib/settingsGroups.ts', text: "id: 'settings-what-everyone-sees'" } }),
  d({ id: 'settings-usage', label: 'Usage', area: 'Settings', to: '/settings?tab=settings-usage', who: 'dev', what: 'How the company uses the app: pages, clicks and customer opens.', gate: { file: 'src/lib/settingsGroups.ts', text: "id: 'settings-usage'" } }),
  d({ id: 'settings-data', label: 'Data & recovery', area: 'Settings', to: '/settings?tab=settings-data', who: 'dev', what: 'JSON backups, Draft bills on paid jobs, ZZ test jobs and Recently deleted. Also the bulk-deletion alert and Link jobs to their bids.', gate: { file: 'src/lib/settingsGroups.ts', text: "id: 'settings-data'" } }),
  d({ id: 'settings-templates', label: 'Email templates & testing', area: 'Settings', to: '/settings?tab=settings-templates', who: 'dev', what: 'The emails the app sends, the notification templates, test sends, the report review and the easter eggs.', gate: { file: 'src/lib/settingsGroups.ts', text: "id: 'settings-templates'" } }),
  d({ id: 'settings-digital-twins', label: 'Digital twins & samples', area: 'Settings', to: '/settings?tab=settings-digital-twins', who: 'dev', what: 'Mint robot twins and their keys, the safety rungs, the sample accounts and the walk tester.', gate: { file: 'src/lib/settingsGroups.ts', text: "id: 'settings-digital-twins'" } }),
  d({ id: 'settings-people', label: 'People & teams', area: 'Settings', to: '/settings?tab=settings-people', who: 'owner or dev', what: 'The owner sees the tab, but every block in it is a dev’s. Pay approved leaders, the dispatch and estimator groups, quick time add and the typed hours switch. Also the bulk hours alert, additional people and the review cadence.', gate: { file: 'src/pages/Settings.tsx', text: "{myRole === 'dev' && (\n        <SettingsPeopleTab" } }),
  d({ id: 'settings-view-as', label: 'View as…', area: 'Settings', to: '/settings#view-as', who: 'dev', what: 'Open the app as a role’s sample account or as a person. Exit brings you back.', gate: { file: 'src/lib/settingsRailDoors.ts', text: "role === 'dev' && !opts.impersonating" } }),
  d({ id: 'settings-dev-mcp-keys', label: 'Dev MCP keys', area: 'Settings', to: '/settings#settings-dev-mcp-keys', who: 'dev', what: 'Keys that let a coding agent read the app as you.', gate: { file: 'src/pages/Settings.tsx', text: "myRole === 'dev' && <DevMcpKeysCard />" } }),
  d({ id: 'settings-lien-sign-code', label: 'Your signing code', area: 'Settings', to: '/settings#settings-lien-sign-code', who: 'owner or dev', what: 'The code the Lien desk takes on anyone’s screen to sign a notice.', gate: { file: 'src/pages/Settings.tsx', text: "(myRole === 'dev' || myRole === 'master_technician') && <LienSignCodeCard />" } }),
  d({ id: 'settings-backup-trailing', label: 'Export all backup', area: 'Settings', to: '/settings?tab=settings-account', who: 'dev', what: 'The time since the last manual backup and the one-press export, at the top of Your account.', gate: { file: 'src/components/settings/SettingsAccountBackupTrailing.tsx', text: "'dev'" } }),
  d({ id: 'settings-financial-pins', label: 'Pin money cards for others', area: 'Settings', to: '/settings?tab=settings-dashboard#settings-page-pins', who: 'dev', what: 'Pin Billed, Internal team labor, Supply houses AP and Sub labor due to other people’s dashboards.', gate: { file: 'src/components/settings/SettingsDashboardTab.tsx', text: "myRole === 'dev'" } }),
  d({ id: 'settings-org-defaults', label: 'Defaults for everyone', area: 'Settings', to: '/settings?tab=settings-company', who: 'owner or dev', what: 'The org-wide defaults a new device starts from, and the bank transfer details customers pay to.', gate: { file: 'src/pages/Settings.tsx', text: "<SettingsOrgDefaultsSection" } }),
  d({ id: 'settings-office-address', label: 'Office address and Map default view', area: 'Settings', to: '/settings?tab=settings-company', who: 'dev', what: 'The shop’s address the bid distances measure from, and where the Map opens.', gate: { file: 'src/pages/Settings.tsx', text: "<OfficeAddressSettingsBlock" } }),
  d({ id: 'settings-company-documents-manage', label: 'Manage company documents', area: 'Settings', to: '/settings?tab=settings-company', who: 'dev', what: 'Add or replace the company’s own papers, the W-9 and the insurance certificate.', gate: { file: 'src/components/settings/SettingsCompanyDocumentsSection.tsx', text: 'showManage' } }),
  d({ id: 'settings-jobs-admin', label: 'Jobs & billing: the dev blocks', area: 'Settings', to: '/settings?tab=settings-jobs', who: 'dev', what: 'The company owner account, Re-assign jobs, the HCP field and the sub portal pay day. Also the uncollectible list, the labor rate, trip charges, city line breaks, county suggestions and developments.', gate: { file: 'src/pages/Settings.tsx', text: '<SettingsJobsTab' } }),
  d({ id: 'settings-legal-firm', label: 'Collections law firms', area: 'Settings', to: '/settings?tab=settings-jobs#settings-legal-firm', who: 'dev', what: 'Each collections firm, its people and fee model, and the Texas counties it covers.', gate: { file: 'src/components/settings/LegalFirmSettingsBlock.tsx', text: "role !== 'dev'" } }),
  d({ id: 'settings-invoice-identity', label: 'Invoice footers, issuer and memo', area: 'Settings', to: '/settings?tab=settings-jobs&focus=issuer.companyName', who: 'dev', what: 'The company on paper bills, the Stripe and paper footers, and the Bill Customer memo presets.', gate: { file: 'src/pages/Settings.tsx', text: '<PhysicalInvoiceIssuerDevSettingsBlock' } }),
  d({ id: 'settings-docsmit', label: 'Docsmit, certified mail from the app', area: 'Settings', to: '/settings?tab=settings-jobs', who: 'dev', what: 'The certified mail connection, its secrets in Vault, its switches and Poll now.', gate: { file: 'src/components/settings/DocsmitDevSettingsBlock.tsx', text: "'dev'" } }),
  d({ id: 'settings-hcp-reconcile', label: 'HCP reconcile', area: 'Settings', to: '/settings?tab=settings-jobs', who: 'dev', what: 'Reconcile Housecall Pro against the books.', gate: { file: 'src/pages/Settings.tsx', text: "myRole === 'dev' && <SettingsHcpReconcileSection />" } }),
  d({ id: 'settings-owner-switches', label: 'Owner of record, GC pay by card and the GC notices', area: 'Settings', to: '/settings?tab=settings-jobs', who: 'owner or dev', what: 'Save owners from the appraisal roll, let GC jobs pay by card, and the office and customer notices.', gate: { file: 'src/pages/Settings.tsx', text: '<OwnerAutoConfirmSettingsBlock' } }),
  d({ id: 'settings-catalogs-dev', label: 'Bids & materials: the dev blocks', area: 'Settings', to: '/settings?tab=settings-catalogs', who: 'dev', what: 'Prospect copy, estimate defaults, the line item catalog and the public terms. Also service types, book names, counts quick-add names, deleting part types, cover letter defaults and the Bid Board value rule.', gate: { file: 'src/pages/Settings.tsx', text: "activeSettingsTab === 'settings-catalogs' && myRole === 'dev'" } }),
  d({ id: 'settings-phone-texts-send-texts', label: 'Send texts', area: 'Settings', to: '/settings?tab=settings-phone-texts#settings-phone-texts-send-texts', who: 'owner or dev', what: 'The switch every text from the company number waits on.', gate: { file: 'src/lib/quo/textsSwitch.ts', text: 'export function canSwitchTexts' } }),
  d({ id: 'settings-phone-texts-who-gets-it', label: 'Who gets a new message', area: 'Settings', to: '/settings?tab=settings-phone-texts#settings-phone-texts-who-gets-it', who: 'owner or dev', what: 'Set the seats a new text, call or email goes to first. The office reads them.', gate: { file: 'src/lib/messages/assignRule.ts', text: 'export function canSetAssignSeats' } }),
  d({ id: 'settings-phone-texts-quo', label: 'Quo connection', area: 'Settings', to: '/settings?tab=settings-phone-texts#settings-phone-texts-quo', who: 'owner or dev', what: 'Paste Quo’s API key once, so the seats and inboxes pick from Quo’s own lists.', gate: { file: 'src/components/settings/QuoConnectionCard.tsx', text: 'canSetAssignSeats' } }),
  d({ id: 'settings-phone-texts-quo-seats', label: 'Company phone seats', area: 'Settings', to: '/settings?tab=settings-phone-texts#settings-phone-texts-quo-seats', who: 'owner or dev', what: 'Which of Quo’s workspace users is which of ours.', gate: { file: 'src/components/settings/QuoSeatsSettingsSection.tsx', text: 'canSetAssignSeats' } }),
  d({ id: 'settings-phone-texts-boxes', label: 'Inboxes', area: 'Settings', to: '/settings?tab=settings-phone-texts#settings-phone-texts-boxes', who: 'owner or dev', what: 'The team inbox and the bids inbox, each with its address and number.', gate: { file: 'src/components/settings/BoxesSettingsCard.tsx', text: 'canSetAssignSeats' } }),
  d({ id: 'settings-phone-texts-read-bids', label: 'Read bids@', area: 'Settings', to: '/settings?tab=settings-phone-texts#settings-phone-texts-read-bids', who: 'owner or dev', what: 'The switch that lets the app read the bids inbox.', gate: { file: 'src/lib/messages/emailReader.ts', text: 'export function canSwitchReader' } }),
  d({ id: 'settings-phone-texts-email-count', label: 'Mail the app counts', area: 'Settings', to: '/settings?tab=settings-phone-texts', who: 'owner or dev', what: 'The shared boxes and people whose Gmail labels Quickfill’s Email station counts.', gate: { file: 'src/lib/emailIn/countCard.ts', text: 'export function canSetEmailCount' } }),
  d({ id: 'settings-phone-texts-reply-push', label: 'Reply push', area: 'Settings', to: '/settings?tab=settings-phone-texts#settings-phone-texts-reply-push', who: 'owner or dev', what: 'The switch that pushes a customer’s reply to whoever has it within a minute.', gate: { file: 'src/lib/messages/replyPushSwitch.ts', text: 'export function canSwitchReplyPush' } }),
  d({ id: 'settings-phone-texts-hours', label: 'Office hours', area: 'Settings', to: '/settings?tab=settings-phone-texts#settings-phone-texts-hours', who: 'owner or dev', what: 'The days and the open and close that decide when a reply waits for the morning.', gate: { file: 'src/components/settings/OfficeHoursSettingsCard.tsx', text: 'isOwnerOrDev' } }),
  d({ id: 'settings-phone-texts-reminders', label: 'Reminders the app offers', area: 'Settings', to: '/settings?tab=settings-phone-texts#settings-phone-texts-reminders', who: 'owner or dev', what: 'Each reminder the app can text, set to Off, Offers or Sends.', gate: { file: 'src/components/settings/RemindersSettingsCard.tsx', text: 'isOwnerOrDev' } }),
  d({ id: 'settings-flows-app-sends', label: 'Flows: a step’s app reminder', area: 'Settings', to: '/settings?tab=settings-flows', who: 'owner or dev', what: 'On each step of a flow, whether the app stays Off, Offers the reminder or Sends it.', gate: { file: 'src/lib/flows/appSends.ts', text: 'export function canSetAppSends' } }),
  d({ id: 'settings-clauses-approve', label: 'Approve or decline a clause', area: 'Settings', to: '/settings?tab=settings-clauses', who: 'dev and controller', what: 'Publish or turn down an office edit to a contract clause. The office edits, you approve.', gate: { file: 'src/lib/gc/access.ts', text: 'GC_CLAUSE_APPROVE_TEAM' } }),
  d({ id: 'settings-recent-emails', label: 'Most recent emails sent', area: 'Settings', to: '/settings?tab=settings-recent-push', who: 'dev', what: 'Every email the app sent, 25 at a time, with delivery status.', gate: { file: 'src/pages/Settings.tsx', text: '<SettingsRecentEmailsSent' } }),
  d({ id: 'settings-dmarc', label: 'Email domain monitoring', area: 'Settings', to: '/settings?tab=settings-advanced-tools', who: 'dev', what: 'The DMARC links for the sending domain, under Advanced.', gate: { file: 'src/components/settings/SettingsAdvancedTab.tsx', text: 'isDev' } }),
  // Header and gear menu
  d({ id: 'header-review', label: 'Review', area: 'Header and gear menu', to: '/people?tab=review', who: 'dev', what: 'The header icon to People → Review. The phone menu shows it to the owner too, but the tab is a dev’s.', gate: { file: 'src/pages/People.tsx', text: 'review: isDev' } }),
  d({ id: 'header-global-reload', label: 'Global reload', area: 'Header and gear menu', to: '/dashboard', who: 'dev', what: 'In the gear menu: make every open copy of the app reload after a deploy.', gate: { file: 'src/components/Layout.tsx', text: 'forceEveryoneToReload' } }),
  d({ id: 'header-pin-for-someone', label: 'Pin for someone', area: 'Header and gear menu', to: '/dashboard', who: 'dev', what: 'In the pin footer: pin a page to another person’s dashboard.', gate: { file: 'src/components/Layout.tsx', text: "role === 'dev' && pinForUsers.length > 0" } }),
  // Dashboard
  d({ id: 'dashboard-rejected-sessions', label: 'Rejected sessions, all users', area: 'Dashboard', to: '/dashboard', who: 'dev', what: 'Every rejected clock session in the company, to review or delete.', gate: { file: 'src/pages/Dashboard.tsx', text: "const isDev = role === 'dev'" } }),
  d({ id: 'dashboard-help-feedback', label: 'Help feedback inbox', area: 'Dashboard', to: '/dashboard', who: 'dev', what: 'What people said about the guides, on the Teams inbox card.', gate: { file: 'src/hooks/useHelpFeedbackInbox.ts', text: "role === 'dev'" } }),
  d({ id: 'dashboard-hr-report', label: 'HR report card', area: 'Dashboard', to: '/dashboard#dash-hr-report', who: 'owner or dev', what: 'Write an HR report on a person from the Dashboard.', gate: { file: 'src/pages/Dashboard.tsx', text: "{ id: 'dash-hr-report', label: 'HR', visible: role === 'dev' || role === 'master_technician' }" } }),
  d({ id: 'dashboard-email-schedule-anyone', label: 'Email schedule to another person', area: 'Dashboard', to: '/dashboard', who: 'dev', what: 'Queue the day’s dispatch schedule email for anyone, not only yourself.', gate: { file: 'src/components/ScheduleDayEmailModal.tsx', text: "const isDev = role === 'dev'" } }),
  d({ id: 'dashboard-needs-you-dev', label: 'Needs you: the dev-only cards', area: 'Dashboard', to: '/dashboard', who: 'dev', what: 'HR reports pending, robots with work waiting, Collections accounts awaiting review, claim-dev attempts and bulk deletes.', gate: { file: 'src/lib/needsYouSources.ts', text: "return role === 'dev'" } }),
  d({ id: 'dashboard-needs-you-owner', label: 'Needs you: the owner-or-dev cards', area: 'Dashboard', to: '/dashboard', who: 'owner or dev', what: 'Lien waivers waiting for your signature, lien notices to approve and sign, and robots that made no round.', gate: { file: 'src/lib/needsYouSources.ts', text: "return role === 'dev' || role === 'master_technician'" } }),
  d({ id: 'dashboard-roadmap-needs-you', label: 'Needs you: roadmap tasks need a person', area: 'Dashboard', to: '/roadmap', who: 'dev', what: 'The card that says roadmap tasks have nobody on them. The page itself is the office’s.', gate: { file: 'src/lib/roadmapVisibility.ts', text: 'export function canSeeRoadmapNeedsYou' } }),
  // Jobs and the Pipeline
  d({ id: 'jobs-crew-pnl', label: 'Crew P&L', area: 'Jobs and the Pipeline', to: '/jobs?tab=teams-summary', who: 'dev', what: 'Labor against billing, per person. The refusal toast already says it is for the owner.', gate: { file: 'src/lib/roleGate.ts', text: "'crew-pnl': { subject: 'Crew P&L', audience: 'the owner' }" } }),
  d({ id: 'jobs-overhead-dials', label: 'Job Summary overhead dials', area: 'Jobs and the Pipeline', to: '/jobs?tab=job-summary', who: 'dev', what: 'The smoothing window, carry share and idle cap the Job Summary charges overhead from, and Use for everyone.', gate: { file: 'src/pages/Jobs.tsx', text: "canEditOverheadDials={authRole === 'dev'}" } }),
  d({ id: 'jobs-weekly-money', label: 'Weekly money movement', area: 'Jobs and the Pipeline', to: '/jobs?tab=stages&stagesMoney=1', who: 'dev and controller', what: 'The week’s money in and out, from the Pipeline’s Section tools menu.', gate: { file: 'src/lib/jobs/stagesSectionToolsMenu.ts', text: "const canOpenWeeklyMoney = authRole === 'dev' || authRole === 'controller'" } }),
  d({ id: 'jobs-money-charts', label: 'Billed aging and paid profit charts', area: 'Jobs and the Pipeline', to: '/jobs?tab=stages', who: 'dev and controller', what: 'The Chart buttons on Billed and Paid in Full, and the overview’s Collected door. Wage-derived.', gate: { file: 'src/lib/jobs/stagesRoleGates.ts', text: 'export function canSeeStagesMoneyCharts' } }),
  d({ id: 'jobs-billing-notifications', label: 'Ready to Bill, Paid and Paid in Full notifications', area: 'Jobs and the Pipeline', to: '/jobs?tab=stages', who: 'owner or dev', what: 'Who gets the board’s billing emails. Inside each window only a dev edits the recipients.', gate: { file: 'src/lib/jobs/stagesRoleGates.ts', text: 'export function isStagesOwnerRole' } }),
  d({ id: 'jobs-gc-review-standing-copies', label: 'GC Review: standing copies', area: 'Jobs and the Pipeline', to: '/jobs?tab=stages&gcReview=1', who: 'dev', what: 'The people who get a copy of every GC statement.', gate: { file: 'src/components/jobs/JobsStagesTab.tsx', text: "isDev={authRole === 'dev'}" } }),
  d({ id: 'jobs-pay-speed-data-health', label: 'Pay speeds: data health and exclusions', area: 'Jobs and the Pipeline', to: '/jobs?tab=stages', who: 'owner or dev', what: 'Exclude a payment from the pay-speed math. The No Count Date setting inside is a dev’s.', gate: { file: 'src/components/jobs/StagesBilledMoneyModals.tsx', text: 'canExcludePayments' } }),
  d({ id: 'jobs-contract-coverage', label: 'Contract coverage floor', area: 'Jobs and the Pipeline', to: '/jobs?tab=stages', who: 'dev', what: 'Change the dollar floor under which a job is not counted on the contract coverage card.', gate: { file: 'src/components/jobs/PipelineContractCoverageCard.tsx', text: "const canEdit = role === 'dev'" } }),
  d({ id: 'jobs-zz-test-switch', label: 'ZZ test jobs switch', area: 'Jobs and the Pipeline', to: '/jobs?tab=stages', who: 'dev', what: 'Show or hide the ZZ test jobs on the Pipeline.', gate: { file: 'src/lib/jobs/zzTestJobSwitch.ts', text: "role === 'dev'" } }),
  d({ id: 'jobs-report-delete', label: 'Delete a report', area: 'Jobs and the Pipeline', to: '/jobs?tab=reports', who: 'dev', what: 'Delete a submitted field report. The row lands in Recently deleted.', gate: { file: 'src/components/jobs/JobsReportsTab.tsx', text: "'dev'" } }),
  d({ id: 'jobs-recurring-report-scope', label: 'Recurring email reports for any leader', area: 'Jobs and the Pipeline', to: '/jobs?tab=reports', who: 'dev', what: 'Schedule a recurring report on any leader’s scope, not only your own.', gate: { file: 'src/hooks/useRecurringReportScopeMasters.ts', text: "authRole === 'dev'" } }),
  d({ id: 'jobs-estimate-accepted-notify', label: 'Estimate accepted notifications', area: 'Jobs and the Pipeline', to: '/estimates', who: 'owner or dev', what: 'Who gets the email when a customer accepts an estimate. Only a dev edits the recipients.', gate: { file: 'src/components/estimates/EstimateAcceptedNotifySettingsModal.tsx', text: "const canEditRecipients = authRole === 'dev'" } }),
  d({ id: 'jobs-stripe-dashboard', label: 'Open in Stripe Dashboard', area: 'Jobs and the Pipeline', to: '/jobs?tab=stages', who: 'dev', what: 'The link from a Stripe bill to the same invoice on Stripe.', gate: { file: 'src/components/jobs/CollectPaymentModal.tsx', text: "const showStripeDashDevLink = role === 'dev' || impersonatingUi" } }),
  d({ id: 'jobs-partner-split', label: 'Partner split panel', area: 'Jobs and the Pipeline', to: '/jobs?tab=stages', who: 'dev', what: 'A job’s partner profit share, in the Job window.', gate: { file: 'src/components/jobs/DetailJobModal.tsx', text: "authRole === 'dev' && jobId ? <PartnerJobSplitPanel" } }),
  d({ id: 'jobs-workflow-projections', label: 'Workflow projections', area: 'Jobs and the Pipeline', to: '/projects', who: 'owner or dev', what: 'Add, edit or delete a project’s money projections on its workflow.', gate: { file: 'src/pages/Workflow.tsx', text: "const isDevOrMaster = userRole === 'dev' || userRole === 'master_technician'" } }),
  d({ id: 'jobs-supply-house-delete', label: 'Delete a supply house', area: 'Jobs and the Pipeline', to: '/materials', who: 'dev', what: 'Delete a supply house from Materials.', gate: { file: 'src/components/SupplyHouseForm.tsx', text: "'dev'" } }),
  d({ id: 'jobs-dispatch-travel-hints', label: 'Dispatch settings: travel hints', area: 'Jobs and the Pipeline', to: '/schedule-dispatch', who: 'dev', what: 'The travel hints the dispatch board draws between jobs.', gate: { file: 'src/components/schedule/DispatchSettingsModal.tsx', text: "const isDev = role === 'dev'" } }),
  // Legal desk, its own page since punch list #182 (the gates moved from the Pipeline's mount to the page's)
  d({ id: 'legal-mark-attorney-ready', label: 'Legal desk: mark attorney-ready', area: 'Jobs and the Pipeline', to: '/legal-desk', who: 'dev', what: 'Release a Collections account to the law firm, or pull it back with a reason.', gate: { file: 'src/pages/LegalDeskPage.tsx', text: "canMarkReady={role === 'dev'}" } }),
  d({ id: 'legal-firms-window', label: 'Legal desk: Firms…', area: 'Jobs and the Pipeline', to: '/legal-desk', who: 'dev', what: 'Add a collections firm without leaving the desk.', gate: { file: 'src/pages/LegalDeskPage.tsx', text: "canEditFirm={role === 'dev'}" } }),
  d({ id: 'lien-desk-leader', label: 'Lien desk: the leader’s acts', area: 'Jobs and the Pipeline', to: '/jobs?tab=stages', who: 'owner or dev', what: 'Sign and approve a notice, hold one, set a standing rule for a GC, the affidavit and retainage panes.', gate: { file: 'src/lib/jobs/lienDesk.ts', text: 'export function isLienLeader' } }),
  // Accounts Receivable
  d({ id: 'ar-mercury-filter', label: 'Mercury filter and kind badges', area: 'Accounts Receivable', to: '/accounts-receivable', who: 'dev', what: 'The sorting window that decides which bank rows count as customer payments, and the badge editor.', gate: { file: 'src/components/jobs/BankPaymentsModal.tsx', text: "enableKindBadgeEditor={authRole === 'dev'}" } }),
  // Banking
  d({ id: 'banking-stripe', label: 'Banking: Stripe', area: 'Banking', to: '/banking?product=stripe&tab=invoices', who: 'dev', what: 'The Stripe invoices and data segment.', gate: { file: 'src/pages/Banking.tsx', text: "if (productRaw === 'stripe')" } }),
  d({ id: 'banking-ledger', label: 'Banking: Ledger and Configuration', area: 'Banking', to: '/banking?tab=ledger', who: 'dev', what: 'The raw Mercury ledger, the sorting configuration, Sync and Backfill from Mercury.', gate: { file: 'src/lib/bankingAccess.ts', text: 'export function isStaffBankingRole' } }),
  d({ id: 'banking-account-nicknames', label: 'Banking: Account nicknames', area: 'Banking', to: '/banking', who: 'dev', what: 'Say what each Mercury account is. The nudge under the strip lists the unnamed ones.', gate: { file: 'src/pages/Banking.tsx', text: 'showAccount={isDevBanking}' } }),
  d({ id: 'banking-import-manual', label: 'Banking: Import CSV and manual accounts', area: 'Banking', to: '/banking?tab=ledger', who: 'owner or dev', what: 'Import a bank CSV and keep accounts Mercury does not hold.', gate: { file: 'src/pages/Banking.tsx', text: "myRole === 'dev' || myRole === 'master_technician'" } }),
  d({ id: 'banking-accounting-switches', label: 'Banking: the Accounting switches', area: 'Banking', to: '/banking?tab=accounting', who: 'owner or dev', what: 'Rule matches approve themselves, and AR deposits count as income.', gate: { file: 'src/components/banking/BankingMercuryAccountingTab.tsx', text: 'canFlipAutoApprove' } }),
  // People
  d({ id: 'people-hr', label: 'People: HR', area: 'People', to: '/people?tab=hr', who: 'dev', what: 'Each person’s HR file: the summary, the narrative and the raw log.', gate: { file: 'src/hooks/usePeopleAccess.ts', text: "if (role === 'dev') {" } }),
  d({ id: 'people-review', label: 'People: Review', area: 'People', to: '/people?tab=review', who: 'dev', what: 'The team summary and the person reports.', gate: { file: 'src/pages/People.tsx', text: 'review: isDev' } }),
  d({ id: 'people-scoreboard', label: 'People: Scoreboard', area: 'People', to: '/people?tab=scoreboard', who: 'dev', what: 'The crew scoreboard.', gate: { file: 'src/pages/People.tsx', text: 'scoreboard: isDev' } }),
  d({ id: 'people-feedback', label: 'People: Feedback', area: 'People', to: '/people?tab=feedback', who: 'dev', what: 'The team feedback admin. Crew ratings are anonymous to everyone but a dev.', gate: { file: 'src/pages/People.tsx', text: 'feedback: isDev' } }),
  d({ id: 'people-day-book', label: 'People: Day book', area: 'People', to: '/people?tab=day_book', who: 'dev and controller', what: 'Each person’s day, as the clock and the schedule tell it. Also the Crew Day line and Bids → Day book.', gate: { file: 'src/lib/people/dayBookAccess.ts', text: "return role === 'dev' || role === 'controller'" } }),
  d({ id: 'people-payroll-views', label: 'Payroll: the Balances and Payments views', area: 'People', to: '/people?tab=pay_stubs&view=ledger', who: 'dev', what: 'The ledger view of payroll and the payments view. Payroll itself is for the controller and pay approved leaders too.', gate: { file: 'src/pages/People.tsx', text: 'canAccessPay && isDev' } }),
  d({ id: 'people-overhead-office-job', label: 'Overhead: choose the office job', area: 'People', to: '/people?tab=overhead', who: 'dev', what: 'Which job the office’s clock labor lands on.', gate: { file: 'src/components/people/PeopleOverheadTab.tsx', text: '{isDev ? (' } }),
  d({ id: 'people-invite', label: 'Invite as user', area: 'People', to: '/people?tab=users', who: 'dev', what: 'Make a login for a person on the roster. The invite function refuses anyone else.', gate: { file: 'src/components/people/PeopleUsersTab.tsx', text: "'dev'" } }),
  d({ id: 'people-imitate', label: 'Imitate', area: 'People', to: '/people?tab=users', who: 'dev', what: 'Open the app as this person, from a Users row or the person desk.', gate: { file: 'src/lib/people/personDeskGates.ts', text: 'export function canImitate' } }),
  d({ id: 'people-account-rows', label: 'Person desk: the account rows and Merge', area: 'People', to: '/people?tab=users', who: 'dev', what: 'Role, sign-in email, password, access flags, the HR records row and Merge a duplicate.', gate: { file: 'src/lib/people/personDeskGates.ts', text: 'canEditAccount' } }),
  d({ id: 'people-tags', label: 'Users: tags', area: 'People', to: '/people?tab=users', who: 'dev', what: 'The tags switch and the tag org panel on Users.', gate: { file: 'src/components/people/PeopleUsersTab.tsx', text: 'isDev' } }),
  d({ id: 'people-activity-grants', label: 'App activity: who may see it', area: 'People', to: '/people?tab=activity', who: 'dev', what: 'Grant another person the Activity tab.', gate: { file: 'src/hooks/usePeopleAccess.ts', text: 'canSeeActivityTab' } }),
  d({ id: 'people-vehicles-dev', label: 'Vehicles: check-in settings and Wheels', area: 'People', to: '/people?tab=vehicles', who: 'dev', what: 'The vehicle check-in rules and the Wheels section.', gate: { file: 'src/components/people/PeopleVehiclesTab.tsx', text: "role === 'dev'" } }),
  d({ id: 'people-writeups-delete', label: 'Write-ups: delete a submitted one', area: 'People', to: '/people?tab=writeups', who: 'dev', what: 'Delete a submitted write-up. Submitted rows are otherwise immutable.', gate: { file: 'src/components/writeups/WriteupsContractsSubTab.tsx', text: "if (r.status === 'submitted' && !isDev)" } }),
  d({ id: 'people-form-studio', label: 'Contract library: Forms', area: 'People', to: '/people?tab=contracts', who: 'dev', what: 'Upload a PDF form people fill on the sign page, and set its boxes.', gate: { file: 'src/components/contracts/ContractLibraryModal.tsx', text: 'isDev = false' } }),
  d({ id: 'people-onboarding-settings', label: 'Hiring: onboarding settings', area: 'People', to: '/prospects?tab=team', who: 'dev', what: 'The onboarding items a hire works through, and the review weights.', gate: { file: 'src/components/prospects/TeamProspectsTab.tsx', text: 'isDev' } }),
  // Tally
  d({ id: 'tally-payroll-rules', label: 'Tally: payroll rules', area: 'Tally', to: '/tally?tab=transactions', who: 'dev', what: 'The rules that decide which card charges count as payroll. The pay bar itself is payroll access.', gate: { file: 'src/pages/JobTally.tsx', text: "const isDevTally = role === 'dev'" } }),
  // Bids
  d({ id: 'bids-robot-queue', label: 'Robots: Queue and Console', area: 'Bids', to: '/bids?tab=robot-console', who: 'dev', what: 'The robots’ queue and the Console with the rounds, the keys and Stop the rounds.', gate: { file: 'src/lib/bids/bidsTabAccess.ts', text: "'robot-console'" } }),
  d({ id: 'bids-envelope', label: 'The envelope door', area: 'Bids', to: '/bids?envelope=1', who: 'dev', what: 'Open a bid’s robot envelope by its number, for support and testing.', gate: { file: 'src/pages/Bids.tsx', text: "'dev'" } }),
  d({ id: 'bids-estimators-cost-mode', label: 'Estimators: cost mode', area: 'Bids', to: '/bids?tab=estimators', who: 'dev', what: 'Show the cost of estimating beside the hours, on the Estimators tab.', gate: { file: 'src/components/bids/BidsEstimatorsTab.tsx', text: "const showCostModeToggle = viewerRole === 'dev'" } }),
  d({ id: 'bids-board-health-labor', label: 'Bid board health: estimator labor', area: 'Bids', to: '/bids?tab=bid-board', who: 'dev', what: 'The estimator labor table and the sent share in the board’s health section.', gate: { file: 'src/components/bids/BidBoardEstimatingHealthSection.tsx', text: '{isDev && (' } }),
  d({ id: 'bids-reply-book-any', label: 'Reply book: change anyone’s reply', area: 'Bids', to: '/bids?tab=bid-board', who: 'dev', what: 'Change or delete a reply someone else wrote in the Reply book.', gate: { file: 'src/lib/bids/bidReplyBook.ts', text: "if (viewer.role === 'dev') return true" } }),
  d({ id: 'bids-labor-book-reset', label: 'Labor book: reset any override and Set', area: 'Bids', to: '/bids?tab=labor', who: 'owner or dev', what: 'Reset anyone’s override to the robot’s number, and set the book against the jobs.', gate: { file: 'src/lib/bids/laborEntryProvenance.ts', text: "if (role === 'dev' || role === 'master_technician') return { read: true, edit: true, resetAny: true, calibrate: 'set' }" } }),
  d({ id: 'bids-lost-labor', label: 'Lost summary: labor', area: 'Bids', to: '/bids?tab=bid-board', who: 'owner or dev', what: 'The labor spent on the bids we lost, in the lost summary window.', gate: { file: 'src/pages/Bids.tsx', text: 'showLostModalLabor' } }),
  // GC projects
  d({ id: 'gc-award', label: 'Award and draft the statement of work', area: 'GC projects', to: '/gc', who: 'dev', what: 'In Compare quotes: award a trade and draft its statement of work. The function refuses anyone else.', gate: { file: 'src/pages/GcProjects.tsx', text: "...(role === 'dev'" } }),
  d({ id: 'gc-start', label: 'Get started', area: 'GC projects', to: '/gc', who: 'dev', what: 'Start a won project, with its start date.', gate: { file: 'src/pages/GcProjects.tsx', text: "start: role === 'dev' && Boolean(board)" } }),
  d({ id: 'gc-trade-email', label: 'Email a trade partner', area: 'GC projects', to: '/gc', who: 'dev', what: 'The invitations, the answers, the statement of work email and the draw and closeout emails.', gate: { file: 'src/lib/gc/access.ts', text: 'GC_TRADE_EMAIL_TEAM' } }),
  d({ id: 'gc-their-portal', label: 'Their portal', area: 'GC projects', to: '/gc', who: 'dev', what: 'Make, rotate or revoke a trade partner’s portal link, in the company window.', gate: { file: 'src/pages/GcProjects.tsx', text: "portal={role === 'dev' ? <GcTheirPortal" } }),
  d({ id: 'gc-board-writes', label: 'Papers, the customer window and the contract', area: 'GC projects', to: '/gc', who: 'dev', what: 'Send a company its papers, record its insurance, open the customer window and send our contract.', gate: { file: 'src/lib/gc/access.ts', text: 'GC_BOARD_WRITE_TEAM' } }),
  d({ id: 'gc-building', label: 'Building: the windows', area: 'GC projects', to: '/gc', who: 'dev', what: 'Daily log, Punch list, Submittals, RFIs, Draws, Closeout and the schedule’s Pull work in, while Building is built.', gate: { file: 'src/lib/gc/access.ts', text: 'GC_BUILDING_TEAM' } }),
  d({ id: 'gc-owner-contract-file', label: 'Open the contract file', area: 'GC projects', to: '/gc', who: 'dev', what: 'Open the signed owner contract from the customer window.', gate: { file: 'src/lib/gc/access.ts', text: 'export function canOpenOwnerContractFile' } }),
  // Messages
  d({ id: 'messages-finish-switching', label: 'Finish switching Messages on', area: 'Messages', to: '/messages', who: 'owner or dev', what: 'The card at the top of Messages with the switches left to set.', gate: { file: 'src/pages/Messages.tsx', text: 'isOwnerOrDev' } }),
  d({ id: 'messages-file-paper', label: 'File a paper from an email', area: 'Messages', to: '/messages?kind=trade', who: 'dev', what: 'File a certificate or a signed paper that came with a trade partner’s email.', gate: { file: 'src/components/gc/messages/PaperOffers.tsx', text: 'canUseGcBoardWrites' } }),
  // Checklist and Roadmap
  d({ id: 'checklist-today-dev', label: 'Today: forward and Upcoming', area: 'Checklist and Roadmap', to: '/checklist?tab=today', who: 'dev', what: 'Forward a task and the Upcoming section on Today.', gate: { file: 'src/pages/Checklist.tsx', text: "isDev={role === 'dev'}" } }),
  d({ id: 'checklist-history-edit', label: 'History: edit mode', area: 'Checklist and Roadmap', to: '/checklist?tab=history', who: 'dev', what: 'Change what the checklist history says.', gate: { file: 'src/pages/Checklist.tsx', text: "canEditHistory={role === 'dev'}" } }),
  d({ id: 'checklist-task-costs', label: 'Task cost lens', area: 'Checklist and Roadmap', to: '/checklist?tab=review', who: 'dev and controller', what: 'The cost chips and totals on the review tab and the Roadmap. Wage-derived.', gate: { file: 'src/lib/checklistCostEstimate.ts', text: "return role === 'dev' || role === 'controller'" } }),
  // Quickfill
  d({ id: 'quickfill-active-sections', label: 'Active sections', area: 'Quickfill', to: '/quickfill', who: 'dev', what: 'Hide or reorder Quickfill’s stations for everyone, and the edit modes on Office, Difficult people and Assistant Dailys.', gate: { file: 'src/pages/Quickfill.tsx', text: "{role === 'dev' && (" } }),
  d({ id: 'quickfill-close-week', label: 'Close week', area: 'Quickfill', to: '/moneyfill', who: 'dev and controller', what: 'The chip on four stations that opens Moneyfill on the week. Everyone else sees an inert line.', gate: { file: 'src/lib/quickfill/closeWeekChip.ts', text: "return role === 'dev' || role === 'controller'" } }),
  // Other pages
  d({ id: 'page-bridge', label: 'The Bridge', area: 'Other pages', to: '/bridge', who: 'dev', what: 'The owner’s chart table: the weakest link, the piles and the week’s call.', gate: { file: 'src/pages/Bridge.tsx', text: "(r) => r === 'dev'" } }),
  d({ id: 'page-moneyfill', label: 'Moneyfill', area: 'Other pages', to: '/moneyfill', who: 'dev and controller', what: 'The controller’s money page: the queues that close a week.', gate: { file: 'src/pages/Moneyfill.tsx', text: "role !== 'dev' && role !== 'controller'" } }),
  d({ id: 'page-partnerships', label: 'Partnerships', area: 'Other pages', to: '/partnerships', who: 'dev', what: 'Partner deals as settings, and their statements.', gate: { file: 'src/pages/Partnerships.tsx', text: "role !== 'dev'" } }),
  d({ id: 'page-templates', label: 'Templates', area: 'Other pages', to: '/templates', who: 'dev', what: 'The project workflow templates.', gate: { file: 'src/pages/Templates.tsx', text: "role !== 'dev'" } }),
  d({ id: 'page-duplicates', label: 'Duplicate materials', area: 'Other pages', to: '/duplicates', who: 'dev', what: 'Find and merge duplicate parts in the catalog.', gate: { file: 'src/pages/Duplicates.tsx', text: "myRole !== 'dev'" } }),
  d({ id: 'page-punch-list', label: 'Punch list', area: 'Other pages', to: '/punch-list', who: 'owner or dev', what: 'The to-do board, rendered from the repo.', gate: { file: 'src/lib/todos/punchListAccess.ts', text: 'export function canOpenPunchList' } }),
  d({ id: 'page-training-preview', label: 'Read a course that is off', area: 'Other pages', to: '/training/osha-30', who: 'dev', what: 'Open a training course as a preview before it is switched on.', gate: { file: 'src/pages/Training.tsx', text: "const isDev = role === 'dev'" } }),
]

/** The route part of a door's link: `/jobs?tab=stages&stagesMoney=1` reads as `/jobs`. */
export function devDoorPath(to: string): string {
  return to.replace(/[?#].*$/, '').replace(/\/+$/, '') || '/'
}

/** The doors grouped by area, in `DEV_DOOR_AREAS` order; an area with no door is left out. */
export function devDoorsByArea(doors: readonly DevDoor[] = DEV_DOORS): Array<{ area: DevDoorArea; doors: DevDoor[] }> {
  return DEV_DOOR_AREAS.map((area) => ({ area, doors: doors.filter((x) => x.area === area) })).filter((g) => g.doors.length > 0)
}

/** How many doors each audience has. */
export function devDoorCounts(doors: readonly DevDoor[] = DEV_DOORS): Record<DevDoorWho, number> {
  const counts: Record<DevDoorWho, number> = { dev: 0, 'dev and controller': 0, 'owner or dev': 0, controller: 0 }
  for (const x of doors) counts[x.who] += 1
  return counts
}

/** "N doors today: a for a dev alone, b for a dev and the controller, c for the owner or a dev." */
export function devDoorsHeadLine(counts: Record<DevDoorWho, number>): string {
  const total = counts.dev + counts['dev and controller'] + counts['owner or dev'] + counts.controller
  const parts = [`${counts.dev} for a dev alone`, `${counts['dev and controller']} for a dev and the controller`, `${counts['owner or dev']} for the owner or a dev`]
  if (counts.controller > 0) parts.push(`${counts.controller} for the controller alone`)
  return `${total} doors today: ${parts.join(', ')}.`
}
