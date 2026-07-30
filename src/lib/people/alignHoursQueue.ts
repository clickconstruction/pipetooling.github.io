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
  | 'jobs_ledger'
  | 'bids'
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

export type AlignHoursQueueRow<
  S extends AlignHoursSession = AlignHoursSession,
> = {
  session: S
  /** Trimmed display name from the users embed; '—' when missing. */
  personName: string
  durationHours: number
}

export type AlignHoursQueueDay<
  S extends AlignHoursSession = AlignHoursSession,
> = {
  /** en-CA date string (matches `clock_sessions.work_date`). */
  workDate: string
  rows: AlignHoursQueueRow<S>[]
}

export type AlignHoursQueue<S extends AlignHoursSession = AlignHoursSession> = {
  /** Days ascending; rows within a day by person name, then clock-in time. */
  days: AlignHoursQueueDay<S>[]
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
export function buildAlignHoursQueue<S extends AlignHoursSession>(
  sessions: S[],
): AlignHoursQueue<S> {
  const seen = new Set<string>()
  const byDay = new Map<string, AlignHoursQueueRow<S>[]>()
  for (const s of sessions) {
    if (seen.has(s.id)) continue
    seen.add(s.id)
    if (!isAlignHoursCandidate(s)) continue
    const row: AlignHoursQueueRow<S> = {
      session: s,
      personName: alignPersonName(s),
      durationHours: durationHoursOf(s),
    }
    const rows = byDay.get(s.work_date)
    if (rows) rows.push(row)
    else byDay.set(s.work_date, [row])
  }
  const days: AlignHoursQueueDay<S>[] = Array.from(byDay.entries())
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
  queue: AlignHoursQueue<AlignHoursSession>,
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

export type AlignRecentPick = {
  source: 'job' | 'bid'
  /** `jobs_ledger.id` or `bids.id`. */
  id: string
  /** Embeds from the most recent session linked to this job/bid (for labeling). */
  embeds: Pick<ClockSessionRow, 'jobs_ledger' | 'bids'>
}

/**
 * Fallback quick-picks for a queue row with nothing scheduled: the person's most recently
 * worked jobs/bids from the same loaded week (distinct, most recent clock-in first).
 */
export function recentAssignedPicksForUser(
  sessions: AlignHoursSession[],
  userId: string,
  max = 3,
): AlignRecentPick[] {
  const assigned = sessions
    .filter((s) => s.user_id === userId && (s.job_ledger_id || s.bid_id))
    .sort((a, b) => b.clocked_in_at.localeCompare(a.clocked_in_at))
  const picks: AlignRecentPick[] = []
  const seen = new Set<string>()
  for (const s of assigned) {
    const source: AlignRecentPick['source'] = s.job_ledger_id ? 'job' : 'bid'
    const id = s.job_ledger_id ?? s.bid_id
    if (!id) continue
    const key = `${source}:${id}`
    if (seen.has(key)) continue
    seen.add(key)
    picks.push({
      source,
      id,
      embeds: { jobs_ledger: s.jobs_ledger, bids: s.bids },
    })
    if (picks.length >= max) break
  }
  return picks
}
