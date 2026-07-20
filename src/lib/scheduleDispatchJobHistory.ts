/**
 * Pure kernel for the Dispatch job view's "Work history" section
 * (`/schedule-dispatch?jobId=` → ScheduleDispatchJobWeekHistory): buckets a
 * job's clock sessions into company (Sunday-start) calendar weeks, aggregates
 * who worked and how many hours per week, and surfaces open "on the job now"
 * sessions. No React / Supabase — the component fetches rows and calls these.
 *
 * Hour rules (matches every other surface — Projects Gantt, Job Detail, payroll
 * views): only APPROVED + CLOSED sessions count toward hours
 * (`approved_at IS NOT NULL AND rejected_at IS NULL AND revoked_at IS NULL AND
 * clocked_out_at IS NOT NULL`). Open sessions (no clock-out, not
 * rejected/revoked, any approval state) drive only the live chip.
 */
import { companyWeekStartSundayContaining, ymdAddDays } from '../utils/dateUtils'

/** Raw row shape from clock_sessions with the users(name) embed. */
export type JobHistorySessionRow = {
  id: string
  user_id: string
  work_date: string | null
  clocked_in_at: string | null
  clocked_out_at: string | null
  approved_at: string | null
  rejected_at: string | null
  revoked_at: string | null
  notes: string | null
  users?: { name: string | null } | null
}

export type JobHistorySession = {
  id: string
  workDateYmd: string
  clockedInAt: string
  clockedOutAt: string
  hours: number
  note: string | null
}

export type JobHistoryPerson = {
  userId: string
  name: string
  hours: number
  sessions: JobHistorySession[]
}

export type JobHistoryWeek = {
  /** Sunday, YYYY-MM-DD (companyWeekStartSundayContaining). */
  weekStartYmd: string
  /** Saturday, YYYY-MM-DD. */
  weekEndYmd: string
  totalHours: number
  people: JobHistoryPerson[]
}

export type JobHistorySummary = {
  totalHours: number
  peopleCount: number
  firstWorkDateYmd: string | null
  lastWorkDateYmd: string | null
  weekCount: number
}

export type JobOpenSession = {
  userId: string
  name: string
  clockedInAt: string
}

function displayName(row: JobHistorySessionRow): string {
  return (row.users?.name ?? '').trim() || 'Unknown'
}

/** Approved + closed + dated — the only sessions that count toward hours. */
export function isCountableJobHistorySession(row: JobHistorySessionRow): boolean {
  return (
    row.approved_at != null &&
    row.rejected_at == null &&
    row.revoked_at == null &&
    row.clocked_in_at != null &&
    row.clocked_out_at != null &&
    (row.work_date ?? '').trim().length > 0
  )
}

/** Duration in decimal hours; malformed or negative spans clamp to 0. */
export function jobHistorySessionHours(row: JobHistorySessionRow): number {
  if (!row.clocked_in_at || !row.clocked_out_at) return 0
  const inMs = Date.parse(row.clocked_in_at)
  const outMs = Date.parse(row.clocked_out_at)
  if (!Number.isFinite(inMs) || !Number.isFinite(outMs)) return 0
  return Math.max(0, (outMs - inMs) / 3_600_000)
}

/**
 * Bucket countable sessions into Sunday-start weeks, newest week first.
 * People within a week sort hours-desc (name asc tie-break); sessions within a
 * person sort work-date asc then clock-in asc.
 */
export function buildJobHistoryWeeks(rows: JobHistorySessionRow[]): JobHistoryWeek[] {
  type PersonAcc = { userId: string; name: string; hours: number; sessions: JobHistorySession[] }
  const weeks = new Map<string, Map<string, PersonAcc>>()

  for (const row of rows) {
    if (!isCountableJobHistorySession(row)) continue
    const weekStart = companyWeekStartSundayContaining((row.work_date ?? '').trim())
    if (!weekStart) continue
    const hours = jobHistorySessionHours(row)
    let people = weeks.get(weekStart)
    if (!people) {
      people = new Map()
      weeks.set(weekStart, people)
    }
    let person = people.get(row.user_id)
    if (!person) {
      person = { userId: row.user_id, name: displayName(row), hours: 0, sessions: [] }
      people.set(row.user_id, person)
    }
    person.hours += hours
    person.sessions.push({
      id: row.id,
      workDateYmd: (row.work_date ?? '').trim(),
      clockedInAt: row.clocked_in_at as string,
      clockedOutAt: row.clocked_out_at as string,
      hours,
      note: (row.notes ?? '').trim() || null,
    })
  }

  return [...weeks.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([weekStartYmd, people]) => {
      const peopleSorted = [...people.values()]
        .map((p) => ({
          ...p,
          sessions: [...p.sessions].sort((s1, s2) => {
            if (s1.workDateYmd !== s2.workDateYmd) return s1.workDateYmd < s2.workDateYmd ? -1 : 1
            return s1.clockedInAt < s2.clockedInAt ? -1 : s1.clockedInAt > s2.clockedInAt ? 1 : 0
          }),
        }))
        .sort((p1, p2) => {
          if (p2.hours !== p1.hours) return p2.hours - p1.hours
          return p1.name.localeCompare(p2.name)
        })
      return {
        weekStartYmd,
        weekEndYmd: ymdAddDays(weekStartYmd, 6),
        totalHours: peopleSorted.reduce((s, p) => s + p.hours, 0),
        people: peopleSorted,
      }
    })
}

/** All-time roll-up across the built weeks. */
export function buildJobHistorySummary(weeks: JobHistoryWeek[]): JobHistorySummary {
  let totalHours = 0
  const people = new Set<string>()
  let first: string | null = null
  let last: string | null = null
  for (const w of weeks) {
    totalHours += w.totalHours
    for (const p of w.people) {
      people.add(p.userId)
      for (const s of p.sessions) {
        if (first == null || s.workDateYmd < first) first = s.workDateYmd
        if (last == null || s.workDateYmd > last) last = s.workDateYmd
      }
    }
  }
  return { totalHours, peopleCount: people.size, firstWorkDateYmd: first, lastWorkDateYmd: last, weekCount: weeks.length }
}

/**
 * Open sessions — clocked in, no clock-out, not rejected/revoked (approval
 * state irrelevant: an in-progress session is rarely approved yet). One entry
 * per user (earliest open clock-in wins), sorted by clock-in asc.
 */
export function findJobOpenSessions(rows: JobHistorySessionRow[]): JobOpenSession[] {
  const byUser = new Map<string, JobOpenSession>()
  for (const row of rows) {
    if (row.clocked_in_at == null || row.clocked_out_at != null) continue
    if (row.rejected_at != null || row.revoked_at != null) continue
    const existing = byUser.get(row.user_id)
    if (!existing || row.clocked_in_at < existing.clockedInAt) {
      byUser.set(row.user_id, { userId: row.user_id, name: displayName(row), clockedInAt: row.clocked_in_at })
    }
  }
  return [...byUser.values()].sort((a, b) => (a.clockedInAt < b.clockedInAt ? -1 : a.clockedInAt > b.clockedInAt ? 1 : 0))
}
