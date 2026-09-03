/**
 * Hours approvals queue kernel (all weeks).
 *
 * Every approval surface before this one was scoped to a single week — the
 * Hours grid banner, its Review & approve modal, the Sessions list, the
 * Dashboard My Team card. A stalled queue (Aug 2026: three weeks, 120
 * sessions, 622h) was therefore never visible as one pile; whoever opened
 * People → Hours saw the current week's 38 and paged back week by week, if at
 * all. This kernel turns the whole pending set into the shape the queue modal
 * renders: person → company-calendar week → sessions, with the flags that
 * deserve a look before a bulk approve (a long day, a near-zero mis-tap, a
 * session with no job or bid), oldest-stall-first ordering, and the roll-ups
 * every Approve button says out loud.
 */

import { LONG_SESSION_HOURS, isLongSession } from '../myTeamApprovals'

/**
 * A closed punch shorter than this reads as a mis-tap (one minute). Not 15 —
 * the office's Update-Focus habit produces real 3–10 minute sessions ("Palmer
 * invoices", "SAWS auto coi") that are fine to approve; the sub-minute ones
 * with blank notes are the double-taps.
 */
export const TINY_SESSION_HOURS = 1 / 60

export { LONG_SESSION_HOURS }

export type ApprovalsQueueSessionInput = {
  id: string
  user_id: string
  clocked_in_at: string
  clocked_out_at: string | null
  work_date: string
  job_ledger_id: string | null
  bid_id: string | null
  users: { name: string | null } | null
}

export type ApprovalsQueueFlags = {
  /** Longer than LONG_SESSION_HOURS — a forgotten clock-out looks exactly like this. */
  long: boolean
  /** Shorter than TINY_SESSION_HOURS (or non-positive) — the approve RPC silently skips zero-length rows, so these need a reject or an edit. */
  tiny: boolean
  /** No job and no bid — approving still pays the hours but no job gets the labor. */
  noJob: boolean
}

export type ApprovalsQueueFlagCounts = { long: number; tiny: number; noJob: number }

export type ApprovalsQueueSession<T extends ApprovalsQueueSessionInput> = {
  id: string
  row: T
  workDate: string
  hours: number
  flags: ApprovalsQueueFlags
  flagged: boolean
}

export type ApprovalsQueueWeek<T extends ApprovalsQueueSessionInput> = {
  /** Sunday, YYYY-MM-DD. */
  weekStart: string
  /** Saturday, YYYY-MM-DD. */
  weekEnd: string
  /** "Aug 16–22" / "Aug 30 – Sep 5". */
  label: string
  sessions: ApprovalsQueueSession<T>[]
  sessionIds: string[]
  count: number
  hours: number
  flagCounts: ApprovalsQueueFlagCounts
}

export type ApprovalsQueuePerson<T extends ApprovalsQueueSessionInput> = {
  userId: string
  name: string
  weeks: ApprovalsQueueWeek<T>[]
  sessionIds: string[]
  count: number
  hours: number
  oldestWorkDate: string
  /** Whole days between today and the oldest pending work date (0 = today). */
  oldestAgeDays: number
  flagCounts: ApprovalsQueueFlagCounts
}

export type ApprovalsQueue<T extends ApprovalsQueueSessionInput> = {
  people: ApprovalsQueuePerson<T>[]
  sessionIds: string[]
  count: number
  hours: number
  peopleCount: number
  weeksCount: number
  oldestWorkDate: string | null
  oldestAgeDays: number
  flagCounts: ApprovalsQueueFlagCounts
}

export type BuildApprovalsQueueOptions = {
  /** Company-calendar today, YYYY-MM-DD. */
  todayYmd: string
  longHours?: number
  tinyHours?: number
}

function ymdToUtcMs(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number]
  return Date.UTC(y, m - 1, d)
}

function utcMsToYmd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** Whole calendar days from `fromYmd` to `toYmd` (negative when `toYmd` is earlier). */
export function daysBetweenYmd(fromYmd: string, toYmd: string): number {
  return Math.round((ymdToUtcMs(toYmd) - ymdToUtcMs(fromYmd)) / 86_400_000)
}

/** Sunday on or before the given date — pure calendar math on the YMD string, no time zone. */
export function weekStartYmd(ymd: string): string {
  const ms = ymdToUtcMs(ymd)
  const dow = new Date(ms).getUTCDay()
  return utcMsToYmd(ms - dow * 86_400_000)
}

export function weekEndYmd(weekStart: string): string {
  return utcMsToYmd(ymdToUtcMs(weekStart) + 6 * 86_400_000)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function monthDay(ymd: string): { month: string; day: number } {
  const [, m, d] = ymd.split('-').map(Number) as [number, number, number]
  return { month: MONTHS[m - 1] ?? '', day: d }
}

/** "Aug 16–22" inside one month, "Aug 30 – Sep 5" across two. */
export function formatWeekRangeLabel(weekStart: string, weekEnd: string): string {
  const s = monthDay(weekStart)
  const e = monthDay(weekEnd)
  return s.month === e.month ? `${s.month} ${s.day}–${e.day}` : `${s.month} ${s.day} – ${e.month} ${e.day}`
}

export function sessionHours(s: { clocked_in_at: string; clocked_out_at: string | null }): number {
  if (!s.clocked_out_at) return 0
  const ms = new Date(s.clocked_out_at).getTime() - new Date(s.clocked_in_at).getTime()
  return Number.isFinite(ms) ? ms / 3_600_000 : 0
}

export function sessionFlags(
  s: { hours: number; job_ledger_id: string | null; bid_id: string | null },
  longHours = LONG_SESSION_HOURS,
  tinyHours = TINY_SESSION_HOURS,
): ApprovalsQueueFlags {
  return {
    long: longHours === LONG_SESSION_HOURS ? isLongSession(s.hours) : s.hours > longHours,
    tiny: !(s.hours >= tinyHours),
    noJob: s.job_ledger_id == null && s.bid_id == null,
  }
}

function emptyFlagCounts(): ApprovalsQueueFlagCounts {
  return { long: 0, tiny: 0, noJob: 0 }
}

function addFlags(into: ApprovalsQueueFlagCounts, f: ApprovalsQueueFlags): void {
  if (f.long) into.long += 1
  if (f.tiny) into.tiny += 1
  if (f.noJob) into.noJob += 1
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Person → week → session. Only CLOSED sessions count (an open punch is not
 * approvable). People sort oldest-stall-first (the person whose oldest pending
 * day is furthest back leads), ties by hours descending; weeks ascend; sessions
 * ascend by day then clock-in.
 */
export function buildApprovalsQueue<T extends ApprovalsQueueSessionInput>(
  rows: readonly T[],
  opts: BuildApprovalsQueueOptions,
): ApprovalsQueue<T> {
  const longHours = opts.longHours ?? LONG_SESSION_HOURS
  const tinyHours = opts.tinyHours ?? TINY_SESSION_HOURS
  const byPerson = new Map<string, { name: string; weeks: Map<string, ApprovalsQueueSession<T>[]> }>()

  for (const row of rows) {
    if (row.clocked_out_at == null) continue
    const hours = sessionHours(row)
    const session: ApprovalsQueueSession<T> = {
      id: row.id,
      row,
      workDate: row.work_date,
      hours,
      flags: sessionFlags({ hours, job_ledger_id: row.job_ledger_id, bid_id: row.bid_id }, longHours, tinyHours),
      flagged: false,
    }
    session.flagged = session.flags.long || session.flags.tiny || session.flags.noJob
    let person = byPerson.get(row.user_id)
    if (!person) {
      person = { name: (row.users?.name ?? '').trim() || 'Unknown', weeks: new Map() }
      byPerson.set(row.user_id, person)
    }
    const wk = weekStartYmd(row.work_date)
    const list = person.weeks.get(wk)
    if (list) list.push(session)
    else person.weeks.set(wk, [session])
  }

  const people: ApprovalsQueuePerson<T>[] = []
  const queueFlags = emptyFlagCounts()
  let queueHours = 0
  let queueCount = 0
  let weeksCount = 0
  let oldest: string | null = null
  const allIds: string[] = []

  for (const [userId, p] of byPerson) {
    const weeks: ApprovalsQueueWeek<T>[] = []
    const personFlags = emptyFlagCounts()
    let personHours = 0
    let personCount = 0
    let personOldest: string | null = null
    const personIds: string[] = []
    const weekStarts = Array.from(p.weeks.keys()).sort()
    for (const ws of weekStarts) {
      const sessions = (p.weeks.get(ws) ?? []).sort((a, b) => {
        if (a.workDate !== b.workDate) return a.workDate.localeCompare(b.workDate)
        return a.row.clocked_in_at.localeCompare(b.row.clocked_in_at)
      })
      const weekFlags = emptyFlagCounts()
      let weekHours = 0
      for (const s of sessions) {
        weekHours += s.hours
        addFlags(weekFlags, s.flags)
      }
      const we = weekEndYmd(ws)
      const ids = sessions.map((s) => s.id)
      weeks.push({
        weekStart: ws,
        weekEnd: we,
        label: formatWeekRangeLabel(ws, we),
        sessions,
        sessionIds: ids,
        count: sessions.length,
        hours: round2(weekHours),
        flagCounts: weekFlags,
      })
      personHours += weekHours
      personCount += sessions.length
      personFlags.long += weekFlags.long
      personFlags.tiny += weekFlags.tiny
      personFlags.noJob += weekFlags.noJob
      personIds.push(...ids)
      const first = sessions[0]
      if (first && (personOldest == null || first.workDate < personOldest)) personOldest = first.workDate
    }
    if (weeks.length === 0 || personOldest == null) continue
    people.push({
      userId,
      name: p.name,
      weeks,
      sessionIds: personIds,
      count: personCount,
      hours: round2(personHours),
      oldestWorkDate: personOldest,
      oldestAgeDays: Math.max(0, daysBetweenYmd(personOldest, opts.todayYmd)),
      flagCounts: personFlags,
    })
    queueHours += personHours
    queueCount += personCount
    weeksCount += weeks.length
    queueFlags.long += personFlags.long
    queueFlags.tiny += personFlags.tiny
    queueFlags.noJob += personFlags.noJob
    allIds.push(...personIds)
    if (oldest == null || personOldest < oldest) oldest = personOldest
  }

  people.sort((a, b) => {
    if (a.oldestWorkDate !== b.oldestWorkDate) return a.oldestWorkDate.localeCompare(b.oldestWorkDate)
    if (a.hours !== b.hours) return b.hours - a.hours
    return a.name.localeCompare(b.name)
  })

  return {
    people,
    sessionIds: allIds,
    count: queueCount,
    hours: round2(queueHours),
    peopleCount: people.length,
    weeksCount,
    oldestWorkDate: oldest,
    oldestAgeDays: oldest ? Math.max(0, daysBetweenYmd(oldest, opts.todayYmd)) : 0,
    flagCounts: queueFlags,
  }
}

/** "3 long days · 2 near-zero · 1 no job" — only the non-zero parts; '' when clean. */
export function formatFlagCounts(f: ApprovalsQueueFlagCounts): string {
  const parts: string[] = []
  if (f.long > 0) parts.push(`${f.long} long ${f.long === 1 ? 'day' : 'days'}`)
  if (f.tiny > 0) parts.push(`${f.tiny} near-zero`)
  if (f.noJob > 0) parts.push(`${f.noJob} no job`)
  return parts.join(' · ')
}

/** Rows minus the given ids — the modal's optimistic removal after an approve/reject. */
export function withoutSessionIds<T extends { id: string }>(rows: readonly T[], ids: readonly string[]): T[] {
  if (ids.length === 0) return rows.slice()
  const drop = new Set(ids)
  return rows.filter((r) => !drop.has(r.id))
}

/**
 * The approve RPC returns how many rows it actually approved; zero-length
 * sessions are skipped without an error. This names the gap so the toast can
 * say it instead of claiming everything went through.
 */
export function describeApproveOutcome(requested: number, approved: number): { message: string; variant: 'success' | 'warning' } {
  if (approved >= requested) {
    return { message: `Approved ${approved} session${approved === 1 ? '' : 's'} — added to payroll`, variant: 'success' }
  }
  const skipped = requested - approved
  return {
    message: `Approved ${approved} of ${requested} — ${skipped} zero-length session${skipped === 1 ? ' was' : 's were'} skipped. Reject or fix ${skipped === 1 ? 'it' : 'them'}.`,
    variant: 'warning',
  }
}
