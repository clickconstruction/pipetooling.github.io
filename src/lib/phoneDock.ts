/**
 * The phone dock (punch list #30, PR 1): the Dispatch Mode bottom bar's slots follow the
 * role, and a long-press swaps one for any page in the More sheet — per device, like the
 * other per-device switches. Pure: no React, no Supabase.
 *
 * Today's fixed bar (Dashboard · Schedule · Inbox · Customers · PO) stays for every role
 * this file returns `null` for; the assistant's four are ranked by her own page-minutes
 * (Pipeline 64 h, Quickfill 22 h against Customers 1 h and PO 8 min over 90 days).
 */
import type { UserRole } from '../hooks/useAuth'
import { isAssistantLike, isSubcontractorLikeRole } from './subcontractorLikeRole'
import { canAccessBanking } from './bankingAccess'
import { canOpenRoadmap } from './roadmapVisibility'

export type PhoneDockPageKey =
  | 'jobs'
  | 'schedule'
  | 'quickfill'
  | 'inbox'
  | 'dashboard'
  | 'dispatchHome'
  | 'customers'
  | 'po'
  | 'supplyHouses'
  | 'subsPay'
  | 'peopleHours'
  | 'estimates'
  | 'prospects'
  | 'bids'
  | 'projects'
  | 'scheduleHub'
  | 'materials'
  | 'documents'
  | 'ar'
  | 'banking'
  | 'tally'
  | 'calendar'
  | 'map'
  | 'checklist'
  | 'people'
  | 'roadmap'

/** Icon shapes the footer knows how to draw; a page names one, the footer draws it. */
export type PhoneDockIcon =
  | 'jobs'
  | 'calendar'
  | 'bolt'
  | 'inbox'
  | 'gauge'
  | 'person'
  | 'receipt'
  | 'store'
  | 'dollar'
  | 'clock'
  | 'doc'
  | 'list'
  | 'map'
  | 'check'
  | 'people'
  | 'bank'
  | 'flag'
  | 'grid'

export type PhoneDockPage = {
  key: PhoneDockPageKey
  label: string
  to: string
  icon: PhoneDockIcon
  /** Activity page keys (`appActivityPageKey`) whose minutes count toward this page. */
  activity: string[]
  visible: (role: UserRole | null | undefined) => boolean
}

const staff = (role: UserRole | null | undefined) =>
  role === 'dev' || role === 'master_technician' || isAssistantLike(role)
const staffOrSuper = (role: UserRole | null | undefined) => staff(role) || role === 'superintendent'
const office = (role: UserRole | null | undefined) =>
  role != null && !isSubcontractorLikeRole(role) && role !== 'primary' && role !== 'superintendent'
const notField = (role: UserRole | null | undefined) => !isSubcontractorLikeRole(role)

/** Every page the More sheet can offer, in the order the sheet lists them. */
export const PHONE_DOCK_PAGES: PhoneDockPage[] = [
  { key: 'jobs', label: 'Jobs', to: '/jobs?tab=stages', icon: 'jobs', activity: ['jobs:stages', 'jobs'], visible: staffOrSuper },
  { key: 'schedule', label: 'Schedule', to: '/dispatch-mode/schedule', icon: 'calendar', activity: [], visible: staff },
  { key: 'quickfill', label: 'Quickfill', to: '/quickfill', icon: 'bolt', activity: ['quickfill'], visible: staff },
  { key: 'inbox', label: 'Inbox', to: '/dispatch-mode/inbox', icon: 'inbox', activity: [], visible: staff },
  { key: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: 'gauge', activity: ['dashboard', 'home'], visible: () => true },
  { key: 'dispatchHome', label: 'Dispatch home', to: '/dispatch-mode', icon: 'gauge', activity: ['dispatch-mode'], visible: staff },
  { key: 'customers', label: 'Customers', to: '/dispatch-mode/customers', icon: 'person', activity: ['customers'], visible: office },
  { key: 'po', label: 'PO', to: '/dispatch-mode/po', icon: 'receipt', activity: [], visible: staff },
  { key: 'supplyHouses', label: 'Supply houses', to: '/materials?tab=supply-houses', icon: 'store', activity: ['materials:supply-houses'], visible: notField },
  { key: 'subsPay', label: 'Subs · Pay', to: '/jobs?tab=subs&view=pay', icon: 'dollar', activity: ['jobs:subs'], visible: staffOrSuper },
  { key: 'peopleHours', label: 'People · Hours', to: '/people?tab=hours', icon: 'clock', activity: ['people:hours'], visible: (r) => office(r) && r !== 'estimator' },
  { key: 'estimates', label: 'Estimates', to: '/estimates', icon: 'doc', activity: ['estimates'], visible: (r) => staffOrSuper(r) || r === 'estimator' || r === 'primary' },
  { key: 'prospects', label: 'Prospects', to: '/prospects', icon: 'people', activity: ['prospects'], visible: staff },
  { key: 'bids', label: 'Bids', to: '/bids', icon: 'list', activity: ['bids'], visible: (r) => staffOrSuper(r) || r === 'estimator' || r === 'primary' },
  { key: 'projects', label: 'Projects', to: '/projects', icon: 'grid', activity: ['projects'], visible: staffOrSuper },
  { key: 'scheduleHub', label: 'Schedule hub', to: '/schedule-dispatch', icon: 'calendar', activity: ['schedule-dispatch'], visible: staffOrSuper },
  { key: 'materials', label: 'Materials', to: '/materials', icon: 'store', activity: ['materials'], visible: notField },
  { key: 'documents', label: 'Documents', to: '/documents', icon: 'doc', activity: ['documents'], visible: notField },
  { key: 'ar', label: 'AR', to: '/accounts-receivable', icon: 'dollar', activity: ['accounts-receivable'], visible: staff },
  { key: 'banking', label: 'Banking', to: '/banking', icon: 'bank', activity: ['banking'], visible: canAccessBanking },
  { key: 'tally', label: 'Tally', to: '/tally', icon: 'list', activity: ['tally'], visible: notField },
  { key: 'calendar', label: 'Calendar', to: '/calendar', icon: 'calendar', activity: ['calendar'], visible: () => true },
  { key: 'map', label: 'Map', to: '/map', icon: 'map', activity: ['map'], visible: (r) => staff(r) || r === 'estimator' },
  { key: 'checklist', label: 'Checklist', to: '/checklist', icon: 'check', activity: ['checklist'], visible: () => true },
  { key: 'people', label: 'People', to: '/people', icon: 'people', activity: ['people'], visible: (r) => office(r) && r !== 'estimator' },
  { key: 'roadmap', label: 'Roadmap', to: '/roadmap', icon: 'flag', activity: ['roadmap'], visible: (r) => canOpenRoadmap(r, false) },
]

const BY_KEY: ReadonlyMap<PhoneDockPageKey, PhoneDockPage> = new Map(PHONE_DOCK_PAGES.map((p) => [p.key, p]))

export function phoneDockPage(key: PhoneDockPageKey): PhoneDockPage {
  const page = BY_KEY.get(key)
  if (!page) throw new Error(`phoneDock: unknown page ${key}`)
  return page
}

export function isPhoneDockPageKey(raw: unknown): raw is PhoneDockPageKey {
  return typeof raw === 'string' && BY_KEY.has(raw as PhoneDockPageKey)
}

export const PHONE_DOCK_SLOT_COUNT = 4

/**
 * The role's four. `null` = this role keeps the fixed Dispatch Mode bar (the owner's call on
 * 2026-09-23: assistants only for PR 1; other roles' sets are a later decision).
 */
export function roleDockDefault(role: UserRole | null | undefined): PhoneDockPageKey[] | null {
  if (isAssistantLike(role)) return ['jobs', 'schedule', 'quickfill', 'inbox']
  return null
}

/** Pages the More sheet offers this role, in registry order. */
export function phoneDockPagesFor(role: UserRole | null | undefined): PhoneDockPage[] {
  return PHONE_DOCK_PAGES.filter((p) => p.visible(role))
}

/**
 * A stored per-device choice, or `null` when there is none or it no longer parses (a page
 * renamed away, a role change that hides one, a hand-edited value) — the caller falls back to
 * the role default rather than rendering a dead slot.
 */
export function parseStoredDockSlots(raw: string | null | undefined, role: UserRole | null | undefined): PhoneDockPageKey[] | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(parsed) || parsed.length !== PHONE_DOCK_SLOT_COUNT) return null
  const keys: PhoneDockPageKey[] = []
  for (const k of parsed) {
    if (!isPhoneDockPageKey(k) || keys.includes(k) || !phoneDockPage(k).visible(role)) return null
    keys.push(k)
  }
  return keys
}

export function resolveDockSlots(role: UserRole | null | undefined, raw: string | null | undefined): PhoneDockPageKey[] | null {
  const fallback = roleDockDefault(role)
  if (!fallback) return null
  return parseStoredDockSlots(raw, role) ?? fallback
}

/** Put `key` in slot `index`; if it already sits in another slot the two trade places. */
export function swapDockSlot(slots: PhoneDockPageKey[], index: number, key: PhoneDockPageKey): PhoneDockPageKey[] {
  if (index < 0 || index >= slots.length) return slots
  const next = [...slots]
  const already = next.indexOf(key)
  if (already === index) return slots
  if (already >= 0) next[already] = slots[index]!
  next[index] = key
  return next
}

function pathAndTab(to: string): { path: string; tab: string | null; view: string | null } {
  const [path, query = ''] = to.split('?', 2)
  const params = new URLSearchParams(query)
  return { path: path ?? '', tab: params.get('tab'), view: params.get('view') }
}

/**
 * Which slot lights up for a location: the page whose path is the location's path (or a
 * parent of it) and whose `?tab=` — when it names one — is the location's tab or absent.
 * The most specific match wins, so `/jobs?tab=subs&view=pay` lights Subs · Pay over Jobs.
 * `null` outside every slot's page, as the fixed bar does.
 */
export function activeDockKey(pathname: string, search: string, slots: PhoneDockPageKey[]): PhoneDockPageKey | null {
  const here = new URLSearchParams(search ?? '')
  const hereTab = here.get('tab')
  const hereView = here.get('view')
  let best: { key: PhoneDockPageKey; score: number } | null = null
  for (const key of slots) {
    const page = phoneDockPage(key)
    const { path, tab, view } = pathAndTab(page.to)
    const pathHit = pathname === path || pathname.startsWith(`${path}/`)
    if (!pathHit) continue
    if (tab && hereTab && hereTab !== tab) continue
    if (view && hereView !== view) continue
    const score = path.length + (tab && hereTab === tab ? 1000 : 0) + (view ? 1000 : 0)
    if (!best || score > best.score) best = { key, score }
  }
  return best?.key ?? null
}

export type ActivityMinutesRow = { page: string; active_seconds: number }

/**
 * "Suggested for you": the pages outside the dock this person spends the most time on, from
 * their own `user_app_activity_page_daily` rows (own rows are readable under RLS). A tabbed
 * page claims its exact key (`jobs:subs` → Subs · Pay); a plain page takes the rest of its
 * segment (`jobs`, `jobs:billing` → Jobs). A page under a minute is not suggested — a "0 min"
 * tile is noise, not a suggestion.
 */
export function suggestedDockPages(
  rows: ActivityMinutesRow[],
  slots: PhoneDockPageKey[],
  role: UserRole | null | undefined,
  limit = 3,
): Array<{ page: PhoneDockPage; minutes: number }> {
  const candidates = phoneDockPagesFor(role).filter((p) => !slots.includes(p.key) && p.activity.length > 0)
  const exact = new Map<string, PhoneDockPage>()
  const bySegment = new Map<string, PhoneDockPage>()
  for (const p of candidates) {
    for (const a of p.activity) {
      if (a.includes(':')) exact.set(a, p)
      else if (!bySegment.has(a)) bySegment.set(a, p)
    }
  }
  // A slot page's exact keys must not leak to a plain page: `jobs:stages` is the dock's Jobs,
  // not a suggestion for Subs · Pay's neighbour.
  const claimed = new Set<string>()
  for (const key of slots) for (const a of phoneDockPage(key).activity) claimed.add(a)
  const seconds = new Map<PhoneDockPageKey, number>()
  for (const r of rows) {
    if (!r || typeof r.page !== 'string') continue
    if (claimed.has(r.page)) continue
    const segment = r.page.split(':', 1)[0] ?? ''
    const page = exact.get(r.page) ?? bySegment.get(segment)
    if (!page) continue
    seconds.set(page.key, (seconds.get(page.key) ?? 0) + Math.max(0, Number(r.active_seconds) || 0))
  }
  return [...seconds.entries()]
    .filter(([, s]) => s >= 60)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, s]) => ({ page: phoneDockPage(key), minutes: Math.round(s / 60) }))
}

// ---- per-device storage (mirrors dispatchModeToggle.ts) ----

const PREFIX = 'phone_dock_slots'
export const PHONE_DOCK_CHANGED_EVENT = 'phone_dock_changed'

export function phoneDockStorageKey(userId: string): string {
  return `${PREFIX}_${userId}`
}

export function readPhoneDockSlotsRaw(userId: string | null | undefined): string | null {
  if (!userId) return null
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(phoneDockStorageKey(userId))
  } catch {
    return null
  }
}

/** `null` clears the device's choice (back to the role default). */
export function writePhoneDockSlots(userId: string | null | undefined, slots: PhoneDockPageKey[] | null): void {
  if (!userId) return
  try {
    if (typeof localStorage === 'undefined') return
    if (slots) localStorage.setItem(phoneDockStorageKey(userId), JSON.stringify(slots))
    else localStorage.removeItem(phoneDockStorageKey(userId))
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new Event(PHONE_DOCK_CHANGED_EVENT))
  } catch {
    // ignore
  }
}
