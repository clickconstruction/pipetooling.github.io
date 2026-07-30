import type { ClockSessionRow } from '../../types/clockSessions'
import { isDraftPeopleHoursSessionId } from '../peopleHoursManualDraftSession'

/** Minimal session shape the Align Hours queue needs (subset of ClockSessionRow). */
export type AlignHoursSession = Pick<
  ClockSessionRow,
  | 'id'
  | 'user_id'
  | 'clocked_in_at'
  | 'clocked_out_at'
  | 'work_date'
  | 'notes'
  | 'origin'
  | 'job_ledger_id'
  | 'bid_id'
  | 'approved_at'
  | 'rejected_at'
  | 'revoked_at'
  | 'users'
>

/**
 * A session belongs in the Align Hours queue when it is closed, has neither a job nor a bid,
 * and is still countable (not rejected/revoked). Approved sessions stay in — assigning a job
 * to an approved session is allowed (same as the day editor); splitting one is the caller's
 * concern (Apply Schedule % has its own re-approval confirm). Local People-Hours drafts are
 * excluded — they have no DB row to update until their editor saves.
 */
export function isAlignHoursCandidate(s: AlignHoursSession): boolean {
  if (isDraftPeopleHoursSessionId(s.id)) return false
  if (s.job_ledger_id || s.bid_id) return false
  if (!s.clocked_out_at) return false
  if (s.rejected_at || s.revoked_at) return false
  return true
}

export type AlignHoursQueueRow = {
  session: AlignHoursSession
  /** Trimmed display name from the users embed; '—' when missing. */
  personName: string
  durationHours: number
}

export type AlignHoursQueueDay = {
  /** en-CA date string (matches `clock_sessions.work_date`). */
  workDate: string
  rows: AlignHoursQueueRow[]
}

export type AlignHoursQueue = {
  /** Days ascending; rows within a day by person name, then clock-in time. */
  days: AlignHoursQueueDay[]
  totalSessions: number
}

function alignPersonName(s: AlignHoursSession): string {
  return (s.users?.name ?? '').trim() || '—'
}

function durationHoursOf(s: AlignHoursSession): number {
  if (!s.clocked_out_at) return 0
  const ms =
    new Date(s.clocked_out_at).getTime() - new Date(s.clocked_in_at).getTime()
  return ms > 0 ? ms / 3_600_000 : 0
}

/**
 * Build the Align Hours queue from already-loaded week sessions (pending + approved lists may
 * overlap after a mid-modal refresh, so rows are deduped by id first).
 */
export function buildAlignHoursQueue(
  sessions: AlignHoursSession[],
): AlignHoursQueue {
  const seen = new Set<string>()
  const byDay = new Map<string, AlignHoursQueueRow[]>()
  for (const s of sessions) {
    if (seen.has(s.id)) continue
    seen.add(s.id)
    if (!isAlignHoursCandidate(s)) continue
    const row: AlignHoursQueueRow = {
      session: s,
      personName: alignPersonName(s),
      durationHours: durationHoursOf(s),
    }
    const rows = byDay.get(s.work_date)
    if (rows) rows.push(row)
    else byDay.set(s.work_date, [row])
  }
  const days: AlignHoursQueueDay[] = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([workDate, rows]) => ({
      workDate,
      rows: rows.sort((a, b) => {
        const c = a.personName.localeCompare(b.personName, undefined, {
          sensitivity: 'base',
        })
        if (c !== 0) return c
        return a.session.clocked_in_at.localeCompare(b.session.clocked_in_at)
      }),
    }))
  return { days, totalSessions: days.reduce((n, d) => n + d.rows.length, 0) }
}

/** Distinct assignee user ids per day — the batched `job_schedule_blocks` fetch plan. */
export function alignQueueUserIdsByDay(
  queue: AlignHoursQueue,
): Array<{ workDate: string; userIds: string[] }> {
  return queue.days.map((d) => ({
    workDate: d.workDate,
    userIds: Array.from(new Set(d.rows.map((r) => r.session.user_id))),
  }))
}

/** One-decimal hours label for queue rows, e.g. "8.6 h". */
export function formatAlignDurationHours(durationHours: number): string {
  return `${(Math.round(durationHours * 10) / 10).toFixed(1)} h`
}
