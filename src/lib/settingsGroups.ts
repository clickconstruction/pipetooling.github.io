import type { UserRole } from '../hooks/useAuth'
import { isAssistantLike, isSubcontractorLikeRole } from './subcontractorLikeRole'

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
 * - Invoice footers/issuer/memo + Job Book → settings-jobs ("Jobs & billing")
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
  company: 'Company — by page',
  system: 'System',
  help: 'Help',
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
    groups.push({ id: 'settings-jobs', label: 'Jobs & billing', zone: 'company', pagesHint: 'Shows on: Pipeline, job windows, and the bills you send customers.' })
  }
  if (r === 'dev' || r === 'estimator') {
    groups.push({ id: 'settings-catalogs', label: 'Bids & materials', zone: 'company', pagesHint: 'Shows on: Bids, Takeoff, and Materials — trades, part types, and the books.' })
  }
  if (r === 'dev' || r === 'master_technician') {
    groups.push({ id: 'settings-people', label: 'People & teams', zone: 'company', pagesHint: 'Shows on: People — accounts, teams, and review cadence.' })
  }
  if (r === 'dev') {
    groups.push({ id: 'settings-emails', label: 'Emails & reports', zone: 'company', pagesHint: 'The scheduled email streams the office receives.' })
  }
  if (r === 'dev') {
    groups.push({ id: 'settings-what-customers-see', label: 'What customers see', zone: 'company', pagesHint: 'Every email and page a customer, GC or sub gets — rendered live with sample data, in the order they meet them.' })
  }
  if (r === 'dev' || r === 'master_technician' || isAssistantLike(r) || r === 'estimator') {
    groups.push({ id: 'settings-company', label: 'Company', zone: 'company', pagesHint: 'Company documents, the office address, and the Map.' })
  }
  // System
  if (r === 'dev') {
    groups.push({ id: 'settings-usage', label: 'Usage', zone: 'system', pagesHint: 'How the company actually uses the app — pages, clicks, and customer opens.' })
    groups.push({ id: 'settings-data', label: 'Data & recovery', zone: 'system', pagesHint: 'Backups, exports, and Recently deleted.' })
    groups.push({ id: 'settings-templates', label: 'Email templates & testing', zone: 'system', pagesHint: 'The emails the app sends, test tools, and easter eggs.' })
    groups.push({ id: 'settings-digital-twins', label: 'Digital twins', zone: 'system', pagesHint: 'The agent fleet: mint twins, issue tokens, safety rungs, endpoints, and the run ledger.' })
  }
  if (!isSubcontractorLikeRole(r)) {
    groups.push({ id: 'settings-advanced-tools', label: 'Advanced', zone: 'system' })
  }
  groups.push({ id: 'settings-recent-push', label: 'Activity logs', zone: 'system', pagesHint: 'What the app recently sent you — not settings, just the record.' })
  // Help
  groups.push({ id: 'settings-guides', label: 'Guides', zone: 'help' })
  groups.push({ id: 'settings-release-notes', label: 'Release notes', zone: 'help' })
  return groups
}
