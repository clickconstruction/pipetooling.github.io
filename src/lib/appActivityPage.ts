/**
 * Page keys for the app-activity heartbeat's per-page dimension (user_app_activity_page_daily)
 * and their display labels for the People → Activity drilldown. Pure — no React/Supabase.
 *
 * Key shape: `<pageSegment>` or `<pageSegment>:<tab>` (e.g. `bids:pricing`, `people:pay_stubs`,
 * `dashboard`). Bounded cardinality: only the first path segment and the ?tab= param are used,
 * both sanitized; the RPC additionally clips to 80 chars.
 */

const SEGMENT_RE = /[^a-z0-9_-]/g

function sanitizeSegment(raw: string): string {
  return raw.trim().toLowerCase().replace(SEGMENT_RE, '').slice(0, 40)
}

/** Derive the activity page key from a location (e.g. '/bids', '?tab=pricing' -> 'bids:pricing'). */
export function appActivityPageKey(pathname: string, search: string): string {
  const firstSegment = sanitizeSegment((pathname ?? '').split('/').filter(Boolean)[0] ?? '')
  const page = firstSegment || 'home'
  let tab = ''
  try {
    tab = sanitizeSegment(new URLSearchParams(search ?? '').get('tab') ?? '')
  } catch {
    tab = ''
  }
  return tab ? `${page}:${tab}` : page
}

/** 'bids:pricing' -> 'Bids · Pricing'; 'people:pay_stubs' -> 'People · Pay Stubs'. */
export function formatAppActivityPageLabel(key: string): string {
  const pretty = (seg: string) =>
    seg
      .split(/[_-]/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ') || '—'
  const [page, tab] = key.split(':', 2)
  return tab ? `${pretty(page ?? '')} · ${pretty(tab)}` : pretty(page ?? '')
}

export type PersonActivityDailyRow = {
  activity_date: string
  active_seconds: number
  first_seen_at: string | null
  last_seen_at: string | null
}

export type PersonActivityPageRow = {
  activity_date: string
  page: string
  active_seconds: number
}

export type PersonActivityDetail = {
  /** Newest day first; pages within a day by seconds desc. */
  days: Array<{
    date: string
    activeSeconds: number
    firstSeenAt: string | null
    lastSeenAt: string | null
    pages: Array<{ page: string; seconds: number }>
  }>
  /** Window totals per page, seconds desc. */
  pageTotals: Array<{ page: string; seconds: number }>
  totalSeconds: number
}

/** Shape the drilldown: merge daily totals with the per-page rows (page data may be sparse/absent). */
export function buildPersonActivityDetail(
  dailyRows: PersonActivityDailyRow[],
  pageRows: PersonActivityPageRow[],
): PersonActivityDetail {
  const pagesByDate = new Map<string, Array<{ page: string; seconds: number }>>()
  const totalsByPage = new Map<string, number>()
  for (const r of pageRows) {
    const list = pagesByDate.get(r.activity_date)
    const entry = { page: r.page, seconds: r.active_seconds }
    if (list) list.push(entry)
    else pagesByDate.set(r.activity_date, [entry])
    totalsByPage.set(r.page, (totalsByPage.get(r.page) ?? 0) + r.active_seconds)
  }
  const days = [...dailyRows]
    .sort((a, b) => b.activity_date.localeCompare(a.activity_date))
    .map((d) => ({
      date: d.activity_date,
      activeSeconds: d.active_seconds,
      firstSeenAt: d.first_seen_at,
      lastSeenAt: d.last_seen_at,
      pages: (pagesByDate.get(d.activity_date) ?? []).sort((a, b) => b.seconds - a.seconds),
    }))
  const pageTotals = [...totalsByPage.entries()]
    .map(([page, seconds]) => ({ page, seconds }))
    .sort((a, b) => b.seconds - a.seconds)
  return {
    days,
    pageTotals,
    totalSeconds: days.reduce((s, d) => s + d.activeSeconds, 0),
  }
}
