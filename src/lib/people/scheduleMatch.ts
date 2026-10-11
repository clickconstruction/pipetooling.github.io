/**
 * On the schedule (v2.5223): a pending clock session matches the dispatch
 * schedule when the same person was scheduled on the same job that day and
 * the day's clocked hours on that job land within an hour of the scheduled
 * hours. The approvals queue marks those rows and offers to approve them in
 * one press, leaving the owner only the exceptions. Pure: no React, no Supabase.
 */

export const SCHEDULE_MATCH_TOLERANCE_HOURS = 1

export type ScheduleBlockLite = { assignee_user_id: string; work_date: string; job_id: string | null; time_start: string; time_end: string }

export type ScheduleMatchSession = { id: string; user_id: string; work_date: string; job_ledger_id: string | null; hours: number; flagged?: boolean }

export type ScheduleMatch = {
  /** Hours the schedule had this person on this job that day. */
  scheduledHours: number
  /** The day's pending hours on that job, every session summed. */
  workedHours: number
  /** Within the tolerance: approvable by the rule. */
  within: boolean
}

/** "08:00:00" → 8; "16:30" → 16.5. */
export function clockToHours(t: string): number {
  const parts = t.split(':').map((x) => Number(x))
  const h = parts[0]
  const m = parts[1]
  if (h == null || !Number.isFinite(h)) return 0
  return h + (m != null && Number.isFinite(m) ? m / 60 : 0)
}

export function blockHours(b: Pick<ScheduleBlockLite, 'time_start' | 'time_end'>): number {
  const h = clockToHours(b.time_end) - clockToHours(b.time_start)
  return h > 0 ? h : 0
}

const key = (userId: string, workDate: string, jobId: string): string => `${userId}|${workDate}|${jobId}`

/**
 * One match per session id. A session with no job, or one already flagged
 * (long, tiny) never matches, whatever the schedule says.
 */
export function matchSessionsToSchedule(sessions: ReadonlyArray<ScheduleMatchSession>, blocks: ReadonlyArray<ScheduleBlockLite>, toleranceHours = SCHEDULE_MATCH_TOLERANCE_HOURS): Map<string, ScheduleMatch> {
  const scheduled = new Map<string, number>()
  for (const b of blocks) {
    if (!b.job_id) continue
    const k = key(b.assignee_user_id, b.work_date, b.job_id)
    scheduled.set(k, (scheduled.get(k) ?? 0) + blockHours(b))
  }
  const worked = new Map<string, number>()
  for (const s of sessions) {
    if (!s.job_ledger_id) continue
    const k = key(s.user_id, s.work_date, s.job_ledger_id)
    worked.set(k, (worked.get(k) ?? 0) + (Number.isFinite(s.hours) ? s.hours : 0))
  }
  const out = new Map<string, ScheduleMatch>()
  for (const s of sessions) {
    if (!s.job_ledger_id) continue
    const k = key(s.user_id, s.work_date, s.job_ledger_id)
    const scheduledHours = scheduled.get(k)
    if (scheduledHours == null || scheduledHours <= 0) continue
    const workedHours = worked.get(k) ?? 0
    const within = !s.flagged && Math.abs(workedHours - scheduledHours) <= toleranceHours
    out.set(s.id, { scheduledHours, workedHours, within })
  }
  return out
}

/** The ids the rule would approve, in the order given. */
export function onScheduleIds(sessions: ReadonlyArray<{ id: string }>, matches: ReadonlyMap<string, ScheduleMatch>): string[] {
  return sessions.filter((s) => matches.get(s.id)?.within).map((s) => s.id)
}

const h1 = (n: number): string => (Number.isInteger(n) ? `${n}h` : `${n.toFixed(1)}h`)

export const ON_SCHEDULE_CHIP = 'on the schedule'

/** The chip's title: what the schedule said and what was worked. */
export function scheduleMatchTitle(m: ScheduleMatch): string {
  if (m.within) return `Dispatch had this person on this job that day for ${h1(m.scheduledHours)}; ${h1(m.workedHours)} clocked, within an hour of it.`
  return `Dispatch had this person on this job that day for ${h1(m.scheduledHours)}, but ${h1(m.workedHours)} clocked, more than an hour off, so this one is yours to read.`
}

/** The day's range the blocks read covers: the earliest and latest pending work date. */
export function pendingDateRange(sessions: ReadonlyArray<{ work_date: string }>): { from: string; to: string } | null {
  let from: string | null = null
  let to: string | null = null
  for (const s of sessions) {
    if (from == null || s.work_date < from) from = s.work_date
    if (to == null || s.work_date > to) to = s.work_date
  }
  return from && to ? { from, to } : null
}
