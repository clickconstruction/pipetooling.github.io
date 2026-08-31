/**
 * Derived lateness (v2.2550, "The Late Chip" design review): compare a person's
 * FIRST clock-in of a day against their EARLIEST scheduled block start and
 * report how late they actually were. Computed, never filed — the board chip,
 * its tooltip receipt, and the People-side attendance ledger are all renderings
 * of this one kernel. NCNS and write-ups remain the only records anyone creates.
 *
 * Rules (per the design review):
 *  - scheduled start = earliest `job_schedule_blocks.time_start` that work_date
 *    (wall clock, APP_CALENDAR_TZ);
 *  - arrival = first non-rejected/non-revoked `clock_sessions.clocked_in_at`
 *    with the same work_date;
 *  - a 15-minute grace: inside it, no entry at all;
 *  - no clock-in → no entry (that's the NCNS / call-out decision, not lateness);
 *  - labels round to 5 minutes; the receipt keeps the exact figure.
 *
 * Salaried people's sessions are auto-created at schedule time, so they simply
 * never produce an entry — an honest limitation, documented in the review.
 */

import { supabase } from './supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'

export const LATE_GRACE_MINUTES = 15

export type LatenessBlockRow = {
  assignee_user_id: string
  work_date: string
  /** Wall-clock 'HH:MM:SS' (or 'HH:MM') in APP_CALENDAR_TZ. */
  time_start: string
  /** Optional short job label for the receipt (e.g. 'J996'). */
  job_label?: string | null
}

export type LatenessSessionRow = {
  user_id: string
  work_date: string
  clocked_in_at: string
  rejected_at?: string | null
  revoked_at?: string | null
}

export type PersonDayLateness = {
  /** Exact minutes past the scheduled start (always > LATE_GRACE_MINUTES). */
  minutesLate: number
  /** Chip text, rounded to 5 minutes: 'Late 2h 15m', 'Late 35m'. */
  label: string
  /** The receipt (tooltip): scheduled vs actual, exact figure, grace rule. */
  title: string
}

const wallMinutesFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_CALENDAR_TZ,
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
})

/** Minutes since midnight, wall clock in APP_CALENDAR_TZ, for an ISO instant. */
function instantToWallMinutes(iso: string): number | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const parts = wallMinutesFmt.formatToParts(d)
  const h = Number(parts.find((p) => p.type === 'hour')?.value)
  const m = Number(parts.find((p) => p.type === 'minute')?.value)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  // hour12:false can yield '24' for midnight in some engines; normalize.
  return ((h % 24) * 60 + m) % 1440
}

/** 'HH:MM[:SS]' → minutes since midnight, or null when malformed. */
function timeStrToMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

function minutesToClock(mins: number): string {
  const h24 = Math.floor(mins / 60) % 24
  const m = mins % 60
  const ampm = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function durationLabel(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function latenessCellKey(userId: string, workDateYmd: string): string {
  return `${userId}\t${workDateYmd}`
}

/** Flat ledger entry (the People-side attendance timeline, v2.2551). */
export type LatenessLedgerEntry = PersonDayLateness & {
  user_id: string
  work_date: string
}

/** The per-cell map flattened for timeline rendering, newest work_date first. */
export function latenessLedgerEntries(
  blocks: readonly LatenessBlockRow[],
  sessions: readonly LatenessSessionRow[],
  graceMinutes: number = LATE_GRACE_MINUTES,
): LatenessLedgerEntry[] {
  const out: LatenessLedgerEntry[] = []
  for (const [key, info] of computeLatenessByCell(blocks, sessions, graceMinutes)) {
    const [user_id, work_date] = key.split('\t')
    if (!user_id || !work_date) continue
    out.push({ user_id, work_date, ...info })
  }
  out.sort((a, b) => (a.work_date < b.work_date ? 1 : a.work_date > b.work_date ? -1 : 0))
  return out
}

export type AttendanceSummary = {
  /** Distinct work_dates with at least one scheduled block. */
  scheduledDays: number
  /** Scheduled days where the person clocked in at all. */
  clockInDays: number
  /** Scheduled days where the first clock-in beat the grace window. */
  onTimeDays: number
  lateDays: number
  medianLateMinutes: number | null
}

/** The 90-day picture for one person (the summary card, v2.2551). */
export function computeAttendanceSummaryForUser(
  blocks: readonly LatenessBlockRow[],
  sessions: readonly LatenessSessionRow[],
  userId: string,
  graceMinutes: number = LATE_GRACE_MINUTES,
): AttendanceSummary {
  const myBlocks = blocks.filter((b) => b.assignee_user_id === userId)
  const mySessions = sessions.filter((s) => s.user_id === userId)
  const scheduledDates = new Set(myBlocks.map((b) => b.work_date))
  const late = computeLatenessByCell(myBlocks, mySessions, graceMinutes)
  const clockInDates = new Set(
    mySessions.filter((s) => !s.rejected_at && !s.revoked_at).map((s) => s.work_date),
  )
  let clockInDays = 0
  for (const d of scheduledDates) if (clockInDates.has(d)) clockInDays += 1
  const lateMinutes = [...late.values()].map((l) => l.minutesLate).sort((a, b) => a - b)
  const lateDays = lateMinutes.length
  const mid = Math.floor(lateMinutes.length / 2)
  const medianLateMinutes =
    lateMinutes.length === 0
      ? null
      : lateMinutes.length % 2 === 1
        ? lateMinutes[mid]!
        : Math.round((lateMinutes[mid - 1]! + lateMinutes[mid]!) / 2)
  return {
    scheduledDays: scheduledDates.size,
    clockInDays,
    onTimeDays: clockInDays - lateDays,
    lateDays,
    medianLateMinutes,
  }
}

/** Fetch schedule blocks for a date range (all visible users; RLS-filtered). */
export async function fetchScheduleBlocksForRange(
  startYmd: string,
  endYmd: string,
): Promise<{ data: LatenessBlockRow[]; error: string | null }> {
  if (!startYmd || !endYmd) return { data: [], error: null }
  try {
    const data = await withSupabaseRetry(
      async () =>
        await supabase
          .from('job_schedule_blocks')
          .select('assignee_user_id, work_date, time_start')
          .gte('work_date', startYmd)
          .lte('work_date', endYmd),
      'fetchScheduleBlocksForRange',
    )
    return { data: (data ?? []) as LatenessBlockRow[], error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e, 'Failed to load schedule blocks') }
  }
}

/**
 * Fetch the clock-in rows the kernel needs for a set of users over a date
 * range (RLS-filtered: viewers who can't read someone's sessions simply get
 * no chip for them — same graceful degradation as the job-history modal).
 */
export async function fetchClockInsForUsersInRange(
  userIds: string[],
  startYmd: string,
  endYmd: string,
): Promise<{ data: LatenessSessionRow[]; error: string | null }> {
  if (userIds.length === 0 || !startYmd || !endYmd) return { data: [], error: null }
  try {
    const data = await withSupabaseRetry(
      async () =>
        await supabase
          .from('clock_sessions')
          .select('user_id, work_date, clocked_in_at, rejected_at, revoked_at')
          .in('user_id', userIds)
          .gte('work_date', startYmd)
          .lte('work_date', endYmd),
      'fetchClockInsForUsersInRange',
    )
    return { data: (data ?? []) as LatenessSessionRow[], error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e, 'Failed to load clock-ins') }
  }
}

/**
 * Build the per-cell lateness map, keyed `${userId}\t${workDateYmd}` (the
 * userTimeOffByCell key shape). Days with no qualifying session, no blocks, or
 * an arrival inside the grace window are simply absent.
 */
export function computeLatenessByCell(
  blocks: readonly LatenessBlockRow[],
  sessions: readonly LatenessSessionRow[],
  graceMinutes: number = LATE_GRACE_MINUTES,
): Map<string, PersonDayLateness> {
  // Earliest scheduled start (and its job label) per person-day.
  const startByCell = new Map<string, { mins: number; jobLabel: string | null }>()
  for (const b of blocks) {
    const mins = timeStrToMinutes(b.time_start)
    if (mins == null) continue
    const key = latenessCellKey(b.assignee_user_id, b.work_date)
    const cur = startByCell.get(key)
    if (!cur || mins < cur.mins) {
      startByCell.set(key, { mins, jobLabel: (b.job_label ?? '').trim() || null })
    }
  }

  // First qualifying clock-in per person-day.
  const clockInByCell = new Map<string, number>()
  for (const s of sessions) {
    if (s.rejected_at || s.revoked_at) continue
    const mins = instantToWallMinutes(s.clocked_in_at)
    if (mins == null) continue
    const key = latenessCellKey(s.user_id, s.work_date)
    const cur = clockInByCell.get(key)
    if (cur == null || mins < cur) clockInByCell.set(key, mins)
  }

  const out = new Map<string, PersonDayLateness>()
  for (const [key, start] of startByCell) {
    const clockIn = clockInByCell.get(key)
    if (clockIn == null) continue
    const minutesLate = clockIn - start.mins
    if (minutesLate <= graceMinutes) continue
    const rounded = Math.round(minutesLate / 5) * 5
    out.set(key, {
      minutesLate,
      label: `Late ${durationLabel(rounded)}`,
      title:
        `Scheduled ${minutesToClock(start.mins)}${start.jobLabel ? ` (${start.jobLabel})` : ''}` +
        ` · First clock-in ${minutesToClock(clockIn)}` +
        ` · ${durationLabel(minutesLate)} late (shown after ${graceMinutes}m grace)`,
    })
  }
  return out
}
