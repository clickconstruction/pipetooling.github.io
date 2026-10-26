import { GUIDE_MISSING_CONTROL, GUIDE_OPENED_CONTROL, parseGuideOpenedTarget } from './guideOpenTelemetry'
import { ERROR_SHOWN_CONTROL, parseErrorShownTarget } from './errorShownSink'
/**
 * Settings → Usage (v2.2342): pure shaping for the dev-only usage readout.
 * Inputs are the rows returned by the usage_* RPCs; outputs are ready-to-render
 * panel models (bars carry `frac` 0..1 against the panel max).
 */

export type UsagePageRow = { role: string; page: string; minutes: number; people: number }
export type UsageClickRow = { role: string; control: string; target: string; clicks: number; people: number }
export type UsageCustomerRow = { surface: string; bucket: string; views: number; entities: number }

export type UsageRoleFilter = 'all' | 'office' | 'estimators' | 'field' | 'clients'

export const USAGE_ROLE_FILTERS: ReadonlyArray<{ key: UsageRoleFilter; label: string }> = [
  { key: 'all', label: 'All roles' },
  { key: 'office', label: 'Office' },
  { key: 'estimators', label: 'Estimators' },
  { key: 'field', label: 'Field' },
  { key: 'clients', label: 'Clients' },
]

export function roleInFilter(role: string, filter: UsageRoleFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'office') return role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'controller'
  if (filter === 'estimators') return role === 'estimator'
  if (filter === 'field') return role === 'subcontractor' || role === 'helpers' || role === 'superintendent'
  return role === 'primary'
}

export type BarRow = { label: string; value: number; people: number; frac: number }

/** Top pages by minutes for the role filter; `frac` scales bars against the leader. */
export function topPages(rows: UsagePageRow[], filter: UsageRoleFilter, limit: number): BarRow[] {
  const byPage = new Map<string, { minutes: number; people: number }>()
  for (const r of rows) {
    if (!roleInFilter(r.role, filter)) continue
    const cur = byPage.get(r.page) ?? { minutes: 0, people: 0 }
    // people counts are per-role distinct; summing over-counts a user with two
    // roles' rows — impossible (one role per user), so the sum is exact.
    byPage.set(r.page, { minutes: cur.minutes + r.minutes, people: cur.people + r.people })
  }
  const list = [...byPage.entries()]
    .map(([page, v]) => ({ label: page, value: v.minutes, people: v.people }))
    .sort((a, b) => b.value - a.value)
  const max = list[0]?.value ?? 0
  return list.slice(0, limit).map((r) => ({ ...r, frac: max > 0 ? r.value / max : 0 }))
}

const CONTROL_LABELS: Record<string, string> = {
  'top-nav': 'top nav',
  'bottom-tab': 'bottom tabs',
  'gear-menu': 'gear menu',
  'mobile-menu': 'mobile menu',
  'icon-cluster': 'header icons',
  'needs-you': 'Needs You',
  banner: 'banners',
  pin: 'pins',
  'quick-button': 'quick buttons',
  dock: 'section dock',
}

export function controlLabel(control: string): string {
  return CONTROL_LABELS[control] ?? control
}

/** Clicks by control kind, all roles, sorted; bars scale against the leader. */
export function controlTotals(rows: UsageClickRow[]): BarRow[] {
  const byControl = new Map<string, { clicks: number; people: number }>()
  for (const r of rows) {
    const cur = byControl.get(r.control) ?? { clicks: 0, people: 0 }
    byControl.set(r.control, { clicks: cur.clicks + r.clicks, people: Math.max(cur.people, r.people) })
  }
  const list = [...byControl.entries()]
    .map(([control, v]) => ({ label: controlLabel(control), value: v.clicks, people: v.people }))
    .sort((a, b) => b.value - a.value)
  const max = list[0]?.value ?? 0
  return list.map((r) => ({ ...r, frac: max > 0 ? r.value / max : 0 }))
}

/** The dock-section ranking (control='dock', targets '#dash-…'), friendly-labeled. */
export function dockRanking(rows: UsageClickRow[]): Array<{ label: string; clicks: number }> {
  const byTarget = new Map<string, number>()
  for (const r of rows) {
    if (r.control !== 'dock') continue
    byTarget.set(r.target, (byTarget.get(r.target) ?? 0) + r.clicks)
  }
  return [...byTarget.entries()]
    .map(([target, clicks]) => ({
      label: target
        .replace(/^#dash-/, '')
        .replace(/^#/, '')
        .replace(/-/g, ' '),
      clicks,
    }))
    .sort((a, b) => b.clicks - a.clicks)
}

export type NeedsYouStats = {
  actions: Array<{ label: string; clicks: number }>
  skips: number
  modeSwitchesToCards: number
  modeSwitchesToWalk: number
  /** Cards brought back from the *handled this visit* trail (v2.3881). */
  revisits: number
}

const NEEDS_YOU_ACTION_LABELS: Record<string, string> = {
  '#ar-deposits': 'Match deposits',
  '#tally-self': 'Open tally',
  '#tally-team': 'Sort for the team',
  '#lost-bids': 'Start call mode',
  '#bid-followups': 'Open the call queue',
}

export function needsYouStats(rows: UsageClickRow[]): NeedsYouStats {
  const stats: NeedsYouStats = { actions: [], skips: 0, modeSwitchesToCards: 0, modeSwitchesToWalk: 0, revisits: 0 }
  const actionCounts = new Map<string, number>()
  for (const r of rows) {
    if (r.control !== 'needs-you') continue
    if (r.target === '#skip') stats.skips += r.clicks
    else if (r.target === '#revisit') stats.revisits += r.clicks
    else if (r.target === '#mode-cards') stats.modeSwitchesToCards += r.clicks
    else if (r.target === '#mode-walk') stats.modeSwitchesToWalk += r.clicks
    else actionCounts.set(r.target, (actionCounts.get(r.target) ?? 0) + r.clicks)
  }
  stats.actions = [...actionCounts.entries()]
    .map(([target, clicks]) => ({ label: NEEDS_YOU_ACTION_LABELS[target] ?? target.replace(/^#/, ''), clicks }))
    .sort((a, b) => b.clicks - a.clicks)
  return stats
}

/** Pages under `thresholdMinutes` company-wide — the fold-candidate list, quietest first. */
export function quietPages(rows: UsagePageRow[], thresholdMinutes: number): Array<{ page: string; minutes: number }> {
  const byPage = new Map<string, number>()
  for (const r of rows) byPage.set(r.page, (byPage.get(r.page) ?? 0) + r.minutes)
  return [...byPage.entries()]
    .filter(([, minutes]) => minutes < thresholdMinutes)
    .map(([page, minutes]) => ({ page, minutes }))
    .sort((a, b) => a.minutes - b.minutes || a.page.localeCompare(b.page))
}

export type UsageUserRow = { user_name: string; role: string; page: string; minutes: number; active_days: number }

export type UsagePerson = {
  name: string
  minutes: number
  activeDays: number
  frac: number
  topPages: Array<{ page: string; minutes: number; frac: number }>
}

export type UsageRoleGroup = { role: string; minutes: number; people: UsagePerson[] }

/**
 * People view (owner request): role groups sorted by total minutes, each
 * holding its users sorted by minutes (bars scale against the busiest person
 * app-wide), each carrying their top pages (bars scale within the person).
 */
export function peopleBreakdown(rows: UsageUserRow[], topPagesPerPerson: number): UsageRoleGroup[] {
  const byUser = new Map<string, { name: string; role: string; minutes: number; activeDays: number; pages: Map<string, number> }>()
  for (const r of rows) {
    const key = `${r.role} ${r.user_name}`
    const cur = byUser.get(key) ?? { name: r.user_name, role: r.role, minutes: 0, activeDays: 0, pages: new Map<string, number>() }
    cur.minutes += r.minutes
    cur.activeDays = Math.max(cur.activeDays, r.active_days)
    cur.pages.set(r.page, (cur.pages.get(r.page) ?? 0) + r.minutes)
    byUser.set(key, cur)
  }
  const maxPerson = Math.max(0, ...[...byUser.values()].map((u) => u.minutes))
  const byRole = new Map<string, UsagePerson[]>()
  for (const u of byUser.values()) {
    const name = u.name
    const pageList = [...u.pages.entries()].sort((a, b) => b[1] - a[1]).slice(0, topPagesPerPerson)
    const maxPage = pageList[0]?.[1] ?? 0
    const person: UsagePerson = {
      name,
      minutes: u.minutes,
      activeDays: u.activeDays,
      frac: maxPerson > 0 ? u.minutes / maxPerson : 0,
      topPages: pageList.map(([page, minutes]) => ({ page, minutes, frac: maxPage > 0 ? minutes / maxPage : 0 })),
    }
    const list = byRole.get(u.role) ?? []
    list.push(person)
    byRole.set(u.role, list)
  }
  return [...byRole.entries()]
    .map(([role, people]) => ({
      role,
      minutes: people.reduce((s, p) => s + p.minutes, 0),
      people: people.sort((a, b) => b.minutes - a.minutes),
    }))
    .sort((a, b) => b.minutes - a.minutes)
}

export type WeeklySeries = {
  totalViews: number
  totalEntities: number
  weeks: Array<{ bucket: string; views: number; frac: number }>
}

/** One surface's weekly series, oldest→newest, bars scaled against the busiest week. */
export function weeklySeries(rows: UsageCustomerRow[], surface: string): WeeklySeries {
  const mine = rows.filter((r) => r.surface === surface).sort((a, b) => a.bucket.localeCompare(b.bucket))
  const entitySeen = new Map<string, number>()
  for (const r of mine) entitySeen.set(r.bucket, r.entities)
  const max = Math.max(0, ...mine.map((r) => r.views))
  return {
    totalViews: mine.reduce((s, r) => s + r.views, 0),
    // Weekly distincts can overlap across weeks; the max week is the honest floor.
    totalEntities: Math.max(0, ...mine.map((r) => r.entities)),
    weeks: mine.map((r) => ({ bucket: r.bucket, views: r.views, frac: max > 0 ? r.views / max : 0 })),
  }
}

// ---------------------------------------------------------------------------
// Guides (punch list #187 PR 1, v2.5897): the `guide_opened` rows, one per open with the door in the
// hash, read back as which guides open, by role and by door, how many of the registry nobody opened in
// the window, and the `guide_missing` rows, each a link in the wild pointing at a slug no guide answers.
// ---------------------------------------------------------------------------

export type GuideOpenRow = {
  slug: string
  clicks: number
  people: number
  frac: number
  doors: Array<{ door: string; clicks: number }>
  roles: Array<{ role: string; clicks: number }>
}

export type GuideOpens = {
  rows: GuideOpenRow[]
  /** Distinct guides with at least one open in the window. */
  opened: number
  /** `guideCount - opened`, never below zero. */
  neverOpened: number
  totalClicks: number
  byDoor: Array<{ door: string; clicks: number }>
  missing: Array<{ slug: string; clicks: number }>
}

function countsSorted(m: Map<string, number>): Array<{ key: string; clicks: number }> {
  return [...m.entries()].map(([key, clicks]) => ({ key, clicks })).sort((a, b) => b.clicks - a.clicks || a.key.localeCompare(b.key))
}

/** The Guides panel's numbers; `limit` trims the ranked rows, the counts read every row. */
export function guideOpens(rows: UsageClickRow[], guideCount: number, limit = 20): GuideOpens {
  const bySlug = new Map<string, { clicks: number; people: number; doors: Map<string, number>; roles: Map<string, number> }>()
  const byDoor = new Map<string, number>()
  const missing = new Map<string, number>()
  let totalClicks = 0
  for (const r of rows) {
    if (r.control !== GUIDE_OPENED_CONTROL && r.control !== GUIDE_MISSING_CONTROL) continue
    const parsed = parseGuideOpenedTarget(r.target)
    if (!parsed) continue
    if (r.control === GUIDE_MISSING_CONTROL) {
      missing.set(parsed.slug, (missing.get(parsed.slug) ?? 0) + r.clicks)
      continue
    }
    totalClicks += r.clicks
    byDoor.set(parsed.door, (byDoor.get(parsed.door) ?? 0) + r.clicks)
    const cur = bySlug.get(parsed.slug) ?? { clicks: 0, people: 0, doors: new Map(), roles: new Map() }
    cur.clicks += r.clicks
    cur.people += r.people
    cur.doors.set(parsed.door, (cur.doors.get(parsed.door) ?? 0) + r.clicks)
    const role = r.role || 'unknown'
    cur.roles.set(role, (cur.roles.get(role) ?? 0) + r.clicks)
    bySlug.set(parsed.slug, cur)
  }
  const ranked = [...bySlug.entries()].sort((a, b) => b[1].clicks - a[1].clicks || a[0].localeCompare(b[0]))
  const max = ranked[0]?.[1].clicks ?? 0
  const list: GuideOpenRow[] = ranked.slice(0, Math.max(0, limit)).map(([slug, v]) => ({
    slug,
    clicks: v.clicks,
    people: v.people,
    frac: max > 0 ? v.clicks / max : 0,
    doors: countsSorted(v.doors).map((d) => ({ door: d.key, clicks: d.clicks })),
    roles: countsSorted(v.roles).map((d) => ({ role: d.key, clicks: d.clicks })),
  }))
  return {
    rows: list,
    opened: bySlug.size,
    neverOpened: Math.max(0, guideCount - bySlug.size),
    totalClicks,
    byDoor: countsSorted(byDoor).map((d) => ({ door: d.key, clicks: d.clicks })),
    missing: countsSorted(missing).map((d) => ({ slug: d.key, clicks: d.clicks })),
  }
}

// ---------------------------------------------------------------------------
// Errors shown (punch list #187 PR 2): the `error_shown` rows, one per (kind, code, operation) per page
// load, read back as the families people meet most, each with where it was met.
// ---------------------------------------------------------------------------

export type ErrorShownRow = { kind: string; code: string; operation: string; clicks: number; people: number; roles: string[] }

export function errorsShown(rows: UsageClickRow[], limit = 12): ErrorShownRow[] {
  const by = new Map<string, ErrorShownRow>()
  for (const r of rows) {
    if (r.control !== ERROR_SHOWN_CONTROL) continue
    const p = parseErrorShownTarget(r.target)
    if (!p) continue
    const key = `${p.kind}|${p.code}|${p.operation}`
    const cur = by.get(key) ?? { kind: p.kind, code: p.code, operation: p.operation, clicks: 0, people: 0, roles: [] }
    cur.clicks += r.clicks
    cur.people += r.people
    if (r.role && !cur.roles.includes(r.role)) cur.roles.push(r.role)
    by.set(key, cur)
  }
  return [...by.values()].sort((a, b) => b.clicks - a.clicks || a.kind.localeCompare(b.kind)).slice(0, Math.max(0, limit))
}
