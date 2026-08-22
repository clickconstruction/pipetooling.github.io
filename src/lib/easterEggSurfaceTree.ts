import type { UserRole } from '../hooks/useAuth'
import { isPathAllowedForRole } from './layoutRouteAccess'

/**
 * The screen tree easter eggs can target (v2.2082). Surface keys are stored in
 * the `easter_eggs_v1` app_settings config:
 *   - `p:<path>`      — a whole page (matches the path and its subpaths)
 *   - `t:/bids:<tab>` — one Bids tab
 * The legacy v2.2074 key `followup` normalizes to the two followup tab keys.
 * Pure module — the Settings picker renders it, `eggActiveFor` matches with it.
 */

export type EggPage = {
  path: string
  label: string
  group: string
  /** In-page gate stricter than the router's role guard (Layout lets staff through, the page redirects). */
  allowedOverride?: (role: UserRole) => boolean
  /** Path to feed the role guard when the page itself is only a prefix (e.g. `/job-mode` → `/job-mode/schedule`). */
  probePath?: string
}

export const EGG_PAGE_GROUPS = ['Every day', 'Sales', 'Work', 'Money', 'Field modes', 'Admin'] as const

const devOnly = (role: UserRole) => role === 'dev'

export const EGG_PAGES: EggPage[] = [
  { path: '/dashboard', label: 'Dashboard', group: 'Every day' },
  { path: '/calendar', label: 'Calendar', group: 'Every day' },
  { path: '/checklist', label: 'Checklist', group: 'Every day' },
  { path: '/tally', label: 'Tally', group: 'Every day' },
  { path: '/help', label: 'Help', group: 'Every day' },
  { path: '/bids', label: 'Bids', group: 'Sales' },
  { path: '/estimates', label: 'Estimates', group: 'Sales' },
  { path: '/prospects', label: 'Prospects', group: 'Sales' },
  { path: '/customers', label: 'Customers', group: 'Sales' },
  { path: '/map', label: 'Map', group: 'Sales' },
  { path: '/projects', label: 'Projects', group: 'Work' },
  { path: '/workflows', label: 'Workflow', group: 'Work', probePath: '/workflows/some-project' },
  { path: '/jobs', label: 'Jobs', group: 'Work' },
  { path: '/schedule-dispatch', label: 'Dispatch', group: 'Work' },
  { path: '/materials', label: 'Materials', group: 'Work' },
  { path: '/documents', label: 'Documents', group: 'Work' },
  { path: '/templates', label: 'Templates', group: 'Work', allowedOverride: devOnly },
  { path: '/banking', label: 'Banking', group: 'Money' },
  { path: '/accounts-receivable', label: 'Accounts Receivable', group: 'Money' },
  { path: '/quickfill', label: 'Quickfill', group: 'Money' },
  { path: '/moneyfill', label: 'Moneyfill', group: 'Money', allowedOverride: (r) => r === 'dev' || r === 'controller' },
  { path: '/partnerships', label: 'Partnerships', group: 'Money', allowedOverride: devOnly },
  { path: '/dispatch-mode', label: 'Dispatch Mode', group: 'Field modes' },
  { path: '/job-mode', label: 'Job Mode', group: 'Field modes', probePath: '/job-mode/schedule' },
  { path: '/people', label: 'People', group: 'Admin' },
  { path: '/settings', label: 'Settings', group: 'Admin' },
  { path: '/duplicates', label: 'Duplicates', group: 'Admin', allowedOverride: devOnly },
]

/**
 * Bids tab keys in the app's own tab-bar order, labeled as the tab bar labels
 * them — the four Followup lenses carry `section: 'Followup'` so the picker
 * can group them under their real home ("By builder", not the internal
 * builder-review). Keys are storage — never rename them; labels are display.
 * `/bids` with no `tab` param shows bid-board.
 */
export const EGG_BIDS_TABS: { key: string; label: string; section?: 'Followup' }[] = [
  { key: 'bid-board', label: 'Bid Board' },
  { key: 'call-queue', label: 'Call queue', section: 'Followup' },
  { key: 'builder-review', label: 'By builder', section: 'Followup' },
  { key: 'submission-followup', label: 'By status', section: 'Followup' },
  { key: 'why-we-lost', label: 'Why we lost', section: 'Followup' },
  { key: 'waiting-to-hear', label: 'Waiting to hear', section: 'Followup' },
  { key: 'working', label: 'Unsent/Working' },
  { key: 'bid-costs', label: 'Bid Costs' },
  { key: 'estimators', label: 'Estimators' },
  { key: 'counts', label: 'Counts' },
  { key: 'takeoffs', label: 'Takeoffs' },
  { key: 'labor', label: 'Labor' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'cover-letter', label: 'Cover Letter' },
  { key: 'rfi', label: 'RFI' },
  { key: 'change-order', label: 'Change Order' },
  { key: 'lien-release', label: 'Lien Release' },
]

const BIDS_DEFAULT_TAB = 'bid-board'

export function eggSurfaceKeyForPage(path: string): string {
  return `p:${path}`
}

export function eggSurfaceKeyForBidsTab(tab: string): string {
  return `t:/bids:${tab}`
}

const pageByPath = new Map(EGG_PAGES.map((p) => [p.path, p]))
const bidsTabByKey = new Map(EGG_BIDS_TABS.map((t) => [t.key, t]))

function parseSurfaceKey(key: string): { kind: 'page'; page: EggPage } | { kind: 'bids-tab'; tab: string } | null {
  if (key.startsWith('p:')) {
    const page = pageByPath.get(key.slice(2))
    return page ? { kind: 'page', page } : null
  }
  if (key.startsWith('t:/bids:')) {
    const tab = key.slice('t:/bids:'.length)
    return bidsTabByKey.has(tab) ? { kind: 'bids-tab', tab } : null
  }
  return null
}

export function isKnownEggSurface(key: string): boolean {
  return parseSurfaceKey(key) != null
}

/**
 * Legacy `followup` (v2.2074's only surface) → the two followup tab keys;
 * unknown keys drop; order-preserving dedupe.
 */
export function normalizeEggSurfaces(keys: string[]): string[] {
  const out: string[] = []
  for (const key of keys) {
    const expanded =
      key === 'followup'
        ? [eggSurfaceKeyForBidsTab('builder-review'), eggSurfaceKeyForBidsTab('submission-followup')]
        : isKnownEggSurface(key)
          ? [key]
          : []
    for (const k of expanded) if (!out.includes(k)) out.push(k)
  }
  return out
}

/** True when the current location sits on this surface. */
export function eggSurfaceMatches(key: string, pathname: string, tab: string | null): boolean {
  const parsed = parseSurfaceKey(key)
  if (!parsed) return false
  if (parsed.kind === 'page') {
    return pathname === parsed.page.path || pathname.startsWith(`${parsed.page.path}/`)
  }
  return (pathname === '/bids' || pathname.startsWith('/bids/')) && (tab ?? BIDS_DEFAULT_TAB) === parsed.tab
}

/** "Bids · Pricing" (or "Bids · Followup · By builder") for tabs, the page label otherwise; raw key as last resort. */
export function eggSurfaceLabel(key: string): string {
  const parsed = parseSurfaceKey(key)
  if (!parsed) return key
  if (parsed.kind === 'page') return parsed.page.label
  const tab = bidsTabByKey.get(parsed.tab)
  if (!tab) return `Bids · ${parsed.tab}`
  return `Bids · ${tab.section ? `${tab.section} · ` : ''}${tab.label}`
}

/**
 * Whether someone with this role can ever stand on this surface — the router's
 * own guard (`isPathAllowedForRole`) plus the few in-page dev gates. Powers the
 * picker's soft "hidden for …" hints; never blocks a selection (an unreachable
 * surface simply never fires).
 */
export function eggSurfaceVisibleForRole(key: string, role: UserRole | null, estimatorProspectsAccess: boolean): boolean {
  const parsed = parseSurfaceKey(key)
  if (!parsed || role == null) return false
  const page = parsed.kind === 'page' ? parsed.page : pageByPath.get('/bids')!
  if (page.allowedOverride && !page.allowedOverride(role)) return false
  return isPathAllowedForRole(role, page.probePath ?? page.path, estimatorProspectsAccess)
}
