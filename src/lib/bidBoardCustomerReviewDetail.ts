/**
 * Pure kernel for the Customer review row-click detail (v2.1382): turns the
 * session rows from RPC list_customer_review_customer_sessions into the
 * contributor leaderboard and the per-bid/per-job session groups the detail
 * view renders. No React, no Supabase.
 */

export type CustomerReviewSessionRow = {
  session_id: string
  user_id: string | null
  user_name: string | null
  kind: string
  target_id: string | null
  target_label: string | null
  bid_number: string | null
  clocked_in_at: string
  clocked_out_at: string | null
  hours: number | string | null
}

export type CustomerReviewDetailSession = {
  sessionId: string
  userName: string
  clockedInAt: string
  clockedOutAt: string | null
  hours: number
}

export type CustomerReviewContributor = {
  userId: string
  name: string
  estimatingHours: number
  jobHours: number
  totalHours: number
  /** 0..1 share of the customer's total hours. */
  share: number
}

export type CustomerReviewTargetGroup = {
  /** Stable group key: `bid:{id}` or `job:{id}`. */
  key: string
  kind: 'bid' | 'job'
  label: string
  bidNumber: string | null
  hours: number
  sessions: CustomerReviewDetailSession[]
}

export type CustomerReviewDetail = {
  totalHours: number
  estimatingHours: number
  jobHours: number
  peopleCount: number
  contributors: CustomerReviewContributor[]
  groups: CustomerReviewTargetGroup[]
}

/** Split a CustomerReviewRow.key (`c:{id}` / `g:{id}` / `none`) into RPC params. */
export function parseCustomerReviewGroupKey(key: string): { customerId: string | null; gcBuilderId: string | null } {
  if (key.startsWith('c:')) return { customerId: key.slice(2), gcBuilderId: null }
  if (key.startsWith('g:')) return { customerId: null, gcBuilderId: key.slice(2) }
  return { customerId: null, gcBuilderId: null }
}

function toFiniteHours(value: number | string | null): number {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0
}

export function buildCustomerReviewDetail(rows: CustomerReviewSessionRow[]): CustomerReviewDetail {
  const contributorsById = new Map<string, CustomerReviewContributor>()
  const groupsByKey = new Map<string, CustomerReviewTargetGroup>()
  let estimatingHours = 0
  let jobHours = 0

  for (const row of rows) {
    if (!row.session_id) continue
    const kind: 'bid' | 'job' = row.kind === 'bid' ? 'bid' : 'job'
    const hours = toFiniteHours(row.hours)
    if (kind === 'bid') estimatingHours += hours
    else jobHours += hours

    const userKey = row.user_id ?? 'unknown'
    let contributor = contributorsById.get(userKey)
    if (!contributor) {
      contributor = {
        userId: userKey,
        name: row.user_name?.trim() || 'Unknown',
        estimatingHours: 0,
        jobHours: 0,
        totalHours: 0,
        share: 0,
      }
      contributorsById.set(userKey, contributor)
    }
    if (kind === 'bid') contributor.estimatingHours += hours
    else contributor.jobHours += hours

    const groupKey = `${kind}:${row.target_id ?? 'unknown'}`
    let group = groupsByKey.get(groupKey)
    if (!group) {
      group = {
        key: groupKey,
        kind,
        label: row.target_label?.trim() || (kind === 'bid' ? 'Untitled bid' : 'Untitled job'),
        bidNumber: row.bid_number?.trim() || null,
        hours: 0,
        sessions: [],
      }
      groupsByKey.set(groupKey, group)
    }
    group.hours += hours
    group.sessions.push({
      sessionId: row.session_id,
      userName: row.user_name?.trim() || 'Unknown',
      clockedInAt: row.clocked_in_at,
      clockedOutAt: row.clocked_out_at,
      hours,
    })
  }

  const totalHours = estimatingHours + jobHours

  const contributors = [...contributorsById.values()]
  for (const c of contributors) {
    c.totalHours = c.estimatingHours + c.jobHours
    c.share = totalHours > 0 ? c.totalHours / totalHours : 0
  }
  contributors.sort(
    (a, b) => b.totalHours - a.totalHours || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  )

  const groups = [...groupsByKey.values()]
  for (const g of groups) {
    g.sessions.sort((a, b) => b.clockedInAt.localeCompare(a.clockedInAt))
  }
  groups.sort(
    (a, b) => b.hours - a.hours || a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
  )

  return { totalHours, estimatingHours, jobHours, peopleCount: contributors.length, contributors, groups }
}

/** Initials for the contributor avatar chip: "Wendi Smith" → "WS", "Malachi" → "MA". */
export function contributorInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const first = words[0]
  if (!first) return '?'
  const last = words[words.length - 1]
  if (words.length === 1 || !last) return first.slice(0, 2).toUpperCase()
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

/** "Mon 7/27" in the viewer's timezone. */
export function formatSessionDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' })
  return `${weekday} ${d.getMonth() + 1}/${d.getDate()}`
}

function formatClockTime(d: Date): string {
  let h = d.getHours()
  const suffix = h < 12 ? 'a' : 'p'
  h = h % 12
  if (h === 0) h = 12
  const m = d.getMinutes()
  return `${h}:${String(m).padStart(2, '0')}${suffix}`
}

/** "7:02a – 3:41p", or "7:02a – open" for a session still running. */
export function formatSessionTimeRange(clockedInAt: string, clockedOutAt: string | null): string {
  const start = new Date(clockedInAt)
  if (Number.isNaN(start.getTime())) return '—'
  const from = formatClockTime(start)
  if (!clockedOutAt) return `${from} – open`
  const end = new Date(clockedOutAt)
  if (Number.isNaN(end.getTime())) return `${from} – ?`
  return `${from} – ${formatClockTime(end)}`
}

/** Whole percent for the contributor share column ("38%"); "<1%" for tiny non-zero shares. */
export function formatContributorShare(share: number): string {
  if (!Number.isFinite(share) || share <= 0) return '—'
  const pct = Math.round(share * 100)
  if (pct === 0) return '<1%'
  return `${pct}%`
}
