import type { UserRole } from '../hooks/useAuth'
import { isAssistantLike, isSubcontractorLikeRole } from './subcontractorLikeRole'
import { canEditClause, canEditFlows, canOpenGcProjects } from './gc/access'
import { canSeePhoneAndTexts } from './messages/assignRule'
import { isControllerOrDev, isOfficeRole, isOwnerOrDev } from './doorRoles'

/**
 * Zoned Settings groups (v2.2088, reorg mockup A). The tab bar answers the
 * viewer's first question — is this about ME or the COMPANY? — then the
 * company zone is organized by the app page a setting affects, in the same
 * words as the nav. The dev-ish plumbing lives in a fenced System zone, and
 * reference material (guides, release notes) trails in Help.
 *
 * Group IDS ARE LOAD-BEARING: `?tab=` deep links (Dashboard banners), the
 * `#anchor` map in settingsDeepLink.ts, and the search index all key on them,
 * so the reorg renames LABELS and re-zones but keeps every existing id.
 * `settings-company` is the one new id.
 *
 * Content notes for maintainers (what moved where in v2.2088):
 * - Invoice footers/issuer/memo + Job Book → settings-jobs ("Jobs, bills and liens")
 * - Bid cover letter → settings-catalogs ("Bids & materials")
 * - Company documents + office address + map default view → settings-company
 * - Team review cadence → settings-people; Easter eggs → settings-templates
 * - settings-recent-push is labeled honestly: "Activity logs"
 */

export type SettingsZone = 'you' | 'company' | 'system' | 'help'

export type SettingsGroupDef = {
  id: string
  label: string
  zone: SettingsZone
  /** One muted line under the tab title: which app pages this tab's settings touch. */
  pagesHint?: string
}

export const SETTINGS_ZONE_LABELS: Readonly<Record<SettingsZone, string>> = {
  you: 'You',
  company: 'Company',
  system: 'System',
  help: 'Help',
}

/** Settings → What customers see (v2.3507): dev, master and the assistant-like roles. Training-mode users see it too — sample only, nothing there writes. */
export function canSeeWhatCustomersSee(r: UserRole | null): boolean {
  return r === 'dev' || r === 'master_technician' || isAssistantLike(r)
}

/** Settings → How fast a change ships (v2.6399): the office roles, the five of `GC_OFFICE_TEAM`. */
export function canSeeShipPace(r: UserRole | null): boolean {
  return canOpenGcProjects(r)
}

export const SETTINGS_ZONE_ORDER: readonly SettingsZone[] = ['you', 'company', 'system', 'help']

export function getZonedSettingsGroups(myRole: UserRole | null): SettingsGroupDef[] {
  if (myRole == null) return []
  const r = myRole
  const groups: SettingsGroupDef[] = []
  // You — first group is the default landing tab.
  groups.push({ id: 'settings-account', label: 'Your account', zone: 'you', pagesHint: 'Just you: profile, notifications, your schedule and email times.' })
  groups.push({ id: 'settings-dashboard', label: 'Your dashboard', zone: 'you', pagesHint: 'Shows on: your Dashboard — buttons, pins, goals, and report alerts.' })
  // Company — by page
  // Job Book was master/assistant-visible before the reorg — the tab keeps
  // that reach; the dev-only engines inside it gate themselves.
  if (r === 'dev' || r === 'master_technician' || isAssistantLike(r)) {
    groups.push({ id: 'settings-jobs', label: 'Jobs, bills and liens', zone: 'company', pagesHint: 'Shows on: Pipeline, job windows, and the bills you send customers.' })
  }
  if (r === 'dev' || r === 'estimator') {
    groups.push({ id: 'settings-catalogs', label: 'Bids & materials', zone: 'company', pagesHint: 'Shows on: Bids, Takeoff, and Materials — trades, part types, and the books.' })
  }
  // People & teams (punch list #188 rows 8–13 and 22, v2.6755): the office's tab — Additional People is the office's filing, the sub
  // pay schedule the controller's; the owner holds the groups and the switches, a dev the pay approvals and the role map.
  if (isOfficeRole(r)) {
    groups.push({ id: 'settings-people', label: 'People & teams', zone: 'company', pagesHint: 'Shows on: People — accounts, teams, and review cadence.' })
  }
  // Training (punch list #111, v2.5569): the courses the crew must take and how long a pass is good for. A dev's.
  if (r === 'dev') {
    groups.push({ id: 'settings-training', label: 'Training', zone: 'company', pagesHint: 'Shows on: the Dashboard under My Time, and People. Which courses each role must take, how long a pass is good for, and where everyone stands.' })
  }
  // Emails & reports (punch list #188 row 5, v2.6753): who gets which stream is the owner's call, so the owner reads it with a dev.
  if (isOwnerOrDev(r)) {
    groups.push({ id: 'settings-emails', label: 'Emails & reports', zone: 'company', pagesHint: 'The scheduled email streams the office receives.' })
  }
  // v2.3507: the office sends these pages every day — dev, master and the assistant-like roles see them from the customer's side.
  if (canSeeWhatCustomersSee(r)) {
    groups.push({ id: 'settings-what-customers-see', label: 'What customers see', zone: 'company', pagesHint: 'Every email and page anyone outside the company gets — customers, GCs, subs, supply houses and the collections firm — rendered live with sample data, in the order they meet them.' })
  }
  // v2.4142 (punch list #60): the other side of the mail — every email the team receives, as one person's week.
  // Punch list #188 row 4 (v2.6753): read-only samples, so the owner reads them with a dev; the open call of v2.4142 answered.
  if (isOwnerOrDev(r)) {
    groups.push({ id: 'settings-what-the-team-sees', label: 'What the team sees', zone: 'company', pagesHint: 'Every email the app sends someone on the team — digests, notices, sign-in — as one person\u2019s week, with sample data.' })
  }
  if (r === 'dev') {
    // Punch list #194: every screen, as every role, in every state, drawn live by the real app in sealed frames.
    groups.push({ id: 'settings-what-everyone-sees', label: 'What everyone sees', zone: 'company', pagesHint: 'Every screen of the app, as every role and in every state, drawn live by the real app on an invented company.' })
  }
  // Contracts & terms: the same people, by the document instead of by the journey.
  if (canSeeWhatCustomersSee(r)) {
    groups.push({ id: 'settings-contracts', label: 'Contracts & terms', zone: 'company', pagesHint: 'Every contract a customer accepts or signs, and every notice they receive — the wording side by side, where it is edited, and where the customer meets it.' })
  }
  // Contracts and clauses (Messages, cut 4c, v2.5285): the papers built from clauses. The office edits, a controller or a dev approves.
  if (canEditClause(r)) {
    groups.push({ id: 'settings-clauses', label: 'Contracts and clauses', zone: 'company', pagesHint: 'The papers our trade partners sign, clause by clause. The office changes them and a controller or a dev approves.' })
  }
  // Phone and texts (Messages, cut 2's screens, v2.5311): who gets a new message first. The office reads it, the owner
  // and a dev set the seats; Quo's rows (cut 5) join the same group.
  if (canSeePhoneAndTexts(r)) {
    groups.push({ id: 'settings-phone-texts', label: 'Phone and texts', zone: 'company', pagesHint: 'Shows on: GC projects, in Follow up and each thread. Who gets a new text, call or email first.' })
  }
  // Flows (Messages, cut 4): the steps each kind of person goes through. The office edits them.
  if (canEditFlows(r)) {
    groups.push({ id: 'settings-flows', label: 'Flows', zone: 'company', pagesHint: 'The steps each customer, trade partner and architect goes through. The office changes them.' })
  }
  if (r === 'dev' || r === 'master_technician' || isAssistantLike(r) || r === 'estimator') {
    groups.push({ id: 'settings-company', label: 'Company', zone: 'company', pagesHint: 'Company documents, the office address, and the Map.' })
  }
  // System
  if (r === 'dev') {
    // Dev doors (v2.5882, punch list #188): the map of every door only a dev or the controller may open today, each a link.
    groups.push({ id: 'settings-dev-doors', label: 'Dev doors', zone: 'system', pagesHint: 'Every page, window and switch only a dev or the controller can open today. Each one is a link.' })
    groups.push({ id: 'settings-usage', label: 'Usage', zone: 'system', pagesHint: 'How the company actually uses the app — pages, clicks, and customer opens.' })
  }
  // Data & recovery: a dev's backups and Recently deleted; since v2.6756 (punch list #188 row 25) the controller opens it for HCP reconcile.
  if (isControllerOrDev(r)) {
    groups.push({ id: 'settings-data', label: 'Data & recovery', zone: 'system', pagesHint: 'Backups, exports and Recently deleted for a dev; HCP reconcile for the controller.' })
  }
  if (r === 'dev') {
    groups.push({ id: 'settings-templates', label: 'Email templates & testing', zone: 'system', pagesHint: 'The emails the app sends, test tools, and easter eggs.' })
    groups.push({ id: 'settings-digital-twins', label: 'Digital twins & samples', zone: 'system', pagesHint: 'Fleet admin: mint twins, issue keys, safety rungs, endpoints, who the robots calibrate to — and the View-as sample accounts. Running and watching the robots is on Bids → Robots → Console.' })
  }
  if (!isSubcontractorLikeRole(r)) {
    groups.push({ id: 'settings-advanced-tools', label: 'Advanced', zone: 'system' })
  }
  groups.push({ id: 'settings-recent-push', label: 'Activity logs', zone: 'system', pagesHint: 'What the app recently sent you — not settings, just the record.' })
  // Help
  groups.push({ id: 'settings-guides', label: 'Guides', zone: 'help' })
  groups.push({ id: 'settings-release-notes', label: 'Release notes', zone: 'help' })
  // How fast a change ships (v2.6399): the office's answer to "can I have X", beside the notes of what shipped.
  if (canSeeShipPace(r)) {
    groups.push({ id: 'settings-ship-pace', label: 'How fast a change ships', zone: 'help', pagesHint: 'How long a change takes from its pull request opening to the app, from the last three days.' })
  }
  return groups
}
