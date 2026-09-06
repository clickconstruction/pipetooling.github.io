/**
 * Sub-portal visit trail (v2.2922): did the sub look, and did we? Reads the
 * `sub_portal_visit_summary` / `sub_portal_visits` RPC rows and words them
 * for the pay run's Who's owed line, the sheet story's Portal cell, the
 * globe's gear and the visits modal. Pure: no React, no Supabase.
 */

export type SubPortalViewer = 'outside' | 'staff' | 'preview'

export type SubPortalVisitSummary = {
  personId: string
  outsideOpens: number
  firstOutsideAt: string | null
  lastOutsideAt: string | null
  staffLooks: number
  lastStaffAt: string | null
  lastStaffUserId: string | null
  lastStaffName: string | null
}

export type SubPortalVisit = {
  occurredAt: string
  viewer: SubPortalViewer
  via: 'token' | 'slug' | null
  staffUserId: string | null
  staffName: string | null
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
const int = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)

export function parseVisitSummaryRow(raw: unknown): SubPortalVisitSummary | null {
  if (raw == null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const personId = str(r.person_id)
  if (!personId) return null
  return {
    personId,
    outsideOpens: int(r.outside_opens),
    firstOutsideAt: str(r.first_outside_at),
    lastOutsideAt: str(r.last_outside_at),
    staffLooks: int(r.staff_looks),
    lastStaffAt: str(r.last_staff_at),
    lastStaffUserId: str(r.last_staff_user_id),
    lastStaffName: str(r.last_staff_name),
  }
}

export function parseVisitRow(raw: unknown): SubPortalVisit | null {
  if (raw == null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const occurredAt = str(r.occurred_at)
  if (!occurredAt || Number.isNaN(Date.parse(occurredAt))) return null
  const viewer = r.viewer === 'staff' || r.viewer === 'preview' ? r.viewer : 'outside'
  const via = r.via === 'token' || r.via === 'slug' ? r.via : null
  return { occurredAt, viewer, via, staffUserId: str(r.staff_user_id), staffName: str(r.staff_name) }
}

/** "today" · "yesterday" · "Sep 4" · "Sep 4, 2025" */
export function whenWord(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  if (d.toDateString() === now.toDateString()) return 'today'
  const y = new Date(now)
  y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'yesterday'
  return d.toLocaleDateString('en-US', d.getFullYear() === now.getFullYear() ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "4:40 pm" */
export function timeWord(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()
}

export function firstName(name: string | null | undefined): string | null {
  const n = (name ?? '').trim().split(/\s+/)[0]
  return n || null
}

export type VisitLine = {
  /** "Opened their page Sep 4 · 6 times" · "Never opened" · "Link not shared yet" */
  outside: string
  tone: 'green' | 'amber' | 'gray'
  /** "Taunya looked Sep 5" · null when nobody on the team has. */
  team: string | null
}

/**
 * The one line under a sub's name. `hasLink === false` (no live portal link) reads
 * "Link not shared yet" instead of the accusing "Never opened".
 */
export function visitLine(s: SubPortalVisitSummary | null | undefined, opts: { now?: Date; hasLink?: boolean } = {}): VisitLine | null {
  if (!s) return null
  const now = opts.now ?? new Date()
  const team = s.staffLooks > 0 && s.lastStaffAt ? `${firstName(s.lastStaffName) ?? 'Team'} looked ${whenWord(s.lastStaffAt, now)}` : null
  if (s.outsideOpens > 0 && s.lastOutsideAt) {
    const times = s.outsideOpens === 1 ? 'once' : s.outsideOpens === 2 ? 'twice' : `${s.outsideOpens} times`
    return { outside: `Opened their page ${whenWord(s.lastOutsideAt, now)} · ${times}`, tone: 'green', team }
  }
  if (opts.hasLink === false) return { outside: 'Link not shared yet', tone: 'gray', team }
  return { outside: 'Never opened', tone: 'amber', team }
}

export function visitHow(v: Pick<SubPortalVisit, 'via'>): string {
  return v.via === 'slug' ? 'short address' : v.via === 'token' ? 'direct link' : '—'
}

/** Newest first, grouped by calendar day: "Today" · "Yesterday" · "Sep 4". */
export function groupVisitsByDay(visits: readonly SubPortalVisit[], now: Date = new Date()): Array<{ day: string; rows: SubPortalVisit[] }> {
  const sorted = [...visits].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  const out: Array<{ day: string; key: string; rows: SubPortalVisit[] }> = []
  for (const v of sorted) {
    const key = new Date(v.occurredAt).toDateString()
    const last = out[out.length - 1]
    if (last && last.key === key) last.rows.push(v)
    else {
      const w = whenWord(v.occurredAt, now)
      out.push({ day: w === 'today' ? 'Today' : w === 'yesterday' ? 'Yesterday' : w, key, rows: [v] })
    }
  }
  return out.map(({ day, rows }) => ({ day, rows }))
}

export type VisitFilter = 'all' | 'outside' | 'staff'
export function visitMatches(filter: VisitFilter, v: SubPortalVisit): boolean {
  return filter === 'all' ? v.viewer !== 'preview' : v.viewer === filter
}
