/**
 * The job window's History tab on a phone (v2.3235): one row per day worked
 * instead of the 36 px-a-day Gantt grid. Pure kernel over the same approved
 * clock-session rows the grid aggregates, so the two can never disagree about
 * which days were worked or how many people were there.
 *
 * Newest first; a run of days with no work between two rows becomes a gap
 * count on the newer row, so six months reads as a screen or two. Hours are
 * NOT here — the rows the tab fetches carry no clock-in time; the day detail
 * (tap) has them.
 */

import type { ProjectsJobHistoryClockRow } from '../projectsJobHistoryData'
import { ymdAddDays } from '../../utils/dateUtils'

export type JobHistoryDayRow = {
  ymd: string
  /** Distinct people that day, in first-seen order. */
  userIds: string[]
  people: number
  /** Today, with at least one session not clocked out yet. */
  open: boolean
  /** Days with no work between this row and the next newer one (0 = consecutive). */
  gapBefore: number
  /** Days with no work after this row, down to the range end (only on the newest row, when the job has gone quiet). */
  quietAfter: number
}

export type JobHistoryDayList = {
  rows: JobHistoryDayRow[]
  daysWorked: number
  maxPeople: number
  /** Every distinct person across the listed days. */
  userIds: string[]
}

/** Whole days from `a` to `b` (a < b): daysBetween('2026-09-08', '2026-09-10') = 2. */
export function daysBetweenYmd(a: string, b: string): number {
  if (!a || !b || a >= b) return 0
  let n = 0
  let cur = a
  // Bounded: the history range is capped upstream at 4 years.
  while (cur < b && n < 1500) {
    cur = ymdAddDays(cur, 1)
    n += 1
  }
  return n
}

export function buildJobHistoryDayList(
  rows: ReadonlyArray<ProjectsJobHistoryClockRow>,
  opts: { jobId: string; todayYmd: string; startYmd: string; endYmd: string },
): JobHistoryDayList {
  const byDay = new Map<string, { users: string[]; open: boolean }>()
  for (const r of rows) {
    if (r.job_ledger_id !== opts.jobId) continue
    const ymd = r.work_date
    if (!ymd || ymd < opts.startYmd || ymd > opts.endYmd) continue
    let d = byDay.get(ymd)
    if (!d) {
      d = { users: [], open: false }
      byDay.set(ymd, d)
    }
    if (!d.users.includes(r.user_id)) d.users.push(r.user_id)
    if (!r.clocked_out_at && ymd === opts.todayYmd) d.open = true
  }
  const days = [...byDay.keys()].sort().reverse()
  const rowsOut: JobHistoryDayRow[] = days.map((ymd, i) => {
    const d = byDay.get(ymd)!
    const older = days[i + 1]
    return {
      ymd,
      userIds: d.users,
      people: d.users.length,
      open: d.open,
      gapBefore: older ? Math.max(0, daysBetweenYmd(older, ymd) - 1) : 0,
      quietAfter: 0,
    }
  })
  const newest = rowsOut[0]
  if (newest) {
    const end = opts.endYmd < opts.todayYmd ? opts.endYmd : opts.todayYmd
    newest.quietAfter = Math.max(0, daysBetweenYmd(newest.ymd, end))
  }
  const all: string[] = []
  for (const r of rowsOut) for (const u of r.userIds) if (!all.includes(u)) all.push(u)
  return {
    rows: rowsOut,
    daysWorked: rowsOut.length,
    maxPeople: rowsOut.reduce((m, r) => Math.max(m, r.people), 0),
    userIds: all,
  }
}

/** "6 days worked · 3 people at most" / "1 day worked · 1 person" / "No days worked in this range". */
export function jobHistoryDayListSummary(list: JobHistoryDayList): string {
  if (list.daysWorked === 0) return 'No days worked in this range'
  const days = `${list.daysWorked} day${list.daysWorked === 1 ? '' : 's'} worked`
  const people = list.maxPeople === 1 ? '1 person' : `${list.maxPeople} people at most`
  return `${days} · ${people}`
}

/** "— 11 days without work —" for the gap line above a row; null when consecutive. */
export function jobHistoryGapLabel(days: number): string | null {
  if (days <= 0) return null
  return `${days} day${days === 1 ? '' : 's'} without work`
}
