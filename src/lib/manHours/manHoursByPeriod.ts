/**
 * Man hours (People → Overhead): the office against the field, by pay week,
 * month, quarter and year.
 *
 * The Overhead day table already prints office hours and field hours for each
 * day of one week. This kernel folds the same clock sessions into longer
 * periods, by the day table's own three rules, so a week here equals that week
 * there (`manHoursByPeriod.test.ts` holds the two together):
 *
 *   what counts   `isRecordedClockSession` — closed, not rejected or revoked,
 *                 approved or still waiting
 *   how long      `approvedClosedSessionHours` — clock out − clock in
 *   which side    `overheadBucketForSession` — the Office job is office, a bid
 *                 is bid; any other job is field
 *
 * Two things the day table leaves out are counted here so the total ties to
 * the Hours grid: time on no job and no bid (`unassigned`), and how much of a
 * period is still waiting for approval (`pendingHours`).
 *
 * One difference: a session carrying BOTH a field job and a bid is in both of
 * the day table's columns. Here it is field, once. None exist as of 2026-10.
 *
 * Pure: no React, no Supabase.
 */

import { ymdAddDays, ymdDaysBetween } from '../../utils/dateUtils'
import { payWeekStart } from '../payWeekAnchor'
import {
  approvedClosedSessionHours,
  isRecordedClockSession,
  overheadBucketForSession,
  type OverheadClockSessionRow,
} from '../overheadDailyLabor'

export type ManHoursZoom = 'week' | 'month' | 'quarter' | 'year'

/** The switch, in order. `periods` is how many the card shows, newest last; null = every one on record. */
export const MAN_HOURS_ZOOMS: ReadonlyArray<{ key: ManHoursZoom; label: string; periods: number | null }> = [
  { key: 'week', label: 'Week', periods: 13 },
  { key: 'month', label: 'Month', periods: 12 },
  { key: 'quarter', label: 'Quarter', periods: 8 },
  { key: 'year', label: 'Year', periods: null },
]

export type ManHoursSide = 'field' | 'office' | 'bid' | 'unassigned'

export type ManHoursSession = Pick<
  OverheadClockSessionRow,
  'user_id' | 'work_date' | 'clocked_in_at' | 'clocked_out_at' | 'job_ledger_id' | 'bid_id' | 'approved_at' | 'rejected_at' | 'revoked_at'
>

/** One counted session, reduced to what the fold needs. */
export type ManHoursEntry = { workDate: string; userId: string; side: ManHoursSide; hours: number; pending: boolean }

export type ManHoursPeriod = {
  /** The period's first calendar day; unique within a zoom. */
  key: string
  start: string
  end: string
  fieldHours: number
  officeHours: number
  bidHours: number
  /** Time on no job and no bid. In the total, out of the office share. */
  unassignedHours: number
  totalHours: number
  /** Recorded and not yet approved (any side). Already inside the hours above. */
  pendingHours: number
  /** (office + bid) ÷ (office + bid + field); null when the period has none of the three. */
  officeShare: number | null
  /** People with at least one counted session in the period. */
  people: number
  /** Today is inside the period, so it is not finished. */
  soFar: boolean
  /** The clock's first day falls after the period's first day, so the period is not whole. */
  fromFirstDay: boolean
  /** Days of the period on record: clipped to the clock's first day and to today. */
  coveredDays: number
  /** Total hours ÷ the weeks on record, so a part period reads against a whole one; null with no days. */
  hoursPerWeek: number | null
}

export type ManHoursView = {
  zoom: ManHoursZoom
  /** The first day with a counted session; null when there are none. */
  firstDay: string | null
  /** Oldest first, no gaps: a period with no hours is a row of zeros. */
  periods: ManHoursPeriod[]
}

/** Which side a session's time is on. The Office job wins, then any other job, then a bid. */
export function manHoursSide(
  officeJobLedgerId: string | null | undefined,
  jobLedgerId: string | null | undefined,
  bidId: string | null | undefined,
): ManHoursSide {
  const bucket = overheadBucketForSession(officeJobLedgerId, jobLedgerId, bidId)
  if (bucket === 'office') return 'office'
  if (jobLedgerId) return 'field'
  if (bucket === 'bid') return 'bid'
  return 'unassigned'
}

/** The sessions that count, each with its side and hours. Order is not kept. */
export function buildManHoursEntries(sessions: readonly ManHoursSession[], officeJobLedgerId: string | null): ManHoursEntry[] {
  const out: ManHoursEntry[] = []
  for (const s of sessions) {
    if (!isRecordedClockSession(s)) continue
    const hours = approvedClosedSessionHours(s)
    if (hours == null || hours <= 0) continue
    out.push({
      workDate: s.work_date,
      userId: s.user_id,
      side: manHoursSide(officeJobLedgerId, s.job_ledger_id, s.bid_id),
      hours,
      pending: s.approved_at == null,
    })
  }
  return out
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** The calendar bounds of the period holding `ymd`. A week is the Sun–Sat pay week. */
export function manHoursPeriodBounds(ymd: string, zoom: ManHoursZoom): { start: string; end: string } {
  if (zoom === 'week') {
    const start = payWeekStart(ymd)
    return { start, end: ymdAddDays(start, 6) }
  }
  const year = Number(ymd.slice(0, 4))
  const month = Number(ymd.slice(5, 7))
  if (zoom === 'year') return { start: `${year}-01-01`, end: `${year}-12-31` }
  const firstMonth = zoom === 'month' ? month : Math.floor((month - 1) / 3) * 3 + 1
  const months = zoom === 'month' ? 1 : 3
  const nextMonth = firstMonth + months
  const nextStart = nextMonth > 12 ? `${year + 1}-${pad2(nextMonth - 12)}-01` : `${year}-${pad2(nextMonth)}-01`
  return { start: `${year}-${pad2(firstMonth)}-01`, end: ymdAddDays(nextStart, -1) }
}

function emptyPeriod(start: string, end: string): ManHoursPeriod {
  return {
    key: start,
    start,
    end,
    fieldHours: 0,
    officeHours: 0,
    bidHours: 0,
    unassignedHours: 0,
    totalHours: 0,
    pendingHours: 0,
    officeShare: null,
    people: 0,
    soFar: false,
    fromFirstDay: false,
    coveredDays: 0,
    hoursPerWeek: null,
  }
}

/**
 * Folds the entries into periods: every period from the clock's first day to
 * today, oldest first, then the newest `maxPeriods` of them (null = all).
 */
export function buildManHoursPeriods(args: {
  entries: readonly ManHoursEntry[]
  zoom: ManHoursZoom
  todayYmd: string
  maxPeriods?: number | null
}): ManHoursView {
  const { entries, zoom, todayYmd, maxPeriods } = args
  let firstDay: string | null = null
  let lastDay = todayYmd
  for (const e of entries) {
    if (firstDay == null || e.workDate < firstDay) firstDay = e.workDate
    if (e.workDate > lastDay) lastDay = e.workDate
  }
  if (firstDay == null) return { zoom, firstDay: null, periods: [] }

  const byKey = new Map<string, ManHoursPeriod>()
  const peopleByKey = new Map<string, Set<string>>()
  const periods: ManHoursPeriod[] = []
  for (let b = manHoursPeriodBounds(firstDay, zoom); b.start <= lastDay; b = manHoursPeriodBounds(ymdAddDays(b.end, 1), zoom)) {
    const p = emptyPeriod(b.start, b.end)
    byKey.set(p.key, p)
    peopleByKey.set(p.key, new Set())
    periods.push(p)
  }

  for (const e of entries) {
    const key = manHoursPeriodBounds(e.workDate, zoom).start
    const p = byKey.get(key)
    if (!p) continue
    if (e.side === 'field') p.fieldHours += e.hours
    else if (e.side === 'office') p.officeHours += e.hours
    else if (e.side === 'bid') p.bidHours += e.hours
    else p.unassignedHours += e.hours
    if (e.pending) p.pendingHours += e.hours
    peopleByKey.get(key)?.add(e.userId)
  }

  for (const p of periods) {
    const worked = p.fieldHours + p.officeHours + p.bidHours
    p.totalHours = worked + p.unassignedHours
    p.officeShare = worked > 0 ? (p.officeHours + p.bidHours) / worked : null
    p.people = peopleByKey.get(p.key)?.size ?? 0
    p.soFar = todayYmd >= p.start && todayYmd <= p.end
    p.fromFirstDay = firstDay > p.start
    const from = firstDay > p.start ? firstDay : p.start
    const to = todayYmd < p.end ? todayYmd : p.end
    p.coveredDays = Math.max(0, (ymdDaysBetween(from, to) ?? -1) + 1)
    p.hoursPerWeek = p.coveredDays > 0 ? p.totalHours / (p.coveredDays / 7) : null
  }

  const shown = maxPeriods != null && maxPeriods > 0 && periods.length > maxPeriods ? periods.slice(periods.length - maxPeriods) : periods
  return { zoom, firstDay, periods: shown }
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const

/** "Mar 12" for a civil day. */
export function manHoursDayLabel(ymd: string): string {
  const month = MONTHS[Number(ymd.slice(5, 7)) - 1] ?? ''
  return `${month.slice(0, 3)} ${Number(ymd.slice(8, 10))}`
}

/** "Week of Sep 27" · "September 2026" · "Q3 2026" · "2026". */
export function manHoursPeriodLabel(period: Pick<ManHoursPeriod, 'start'>, zoom: ManHoursZoom): string {
  const year = period.start.slice(0, 4)
  const month = Number(period.start.slice(5, 7))
  if (zoom === 'week') return `Week of ${manHoursDayLabel(period.start)}`
  if (zoom === 'month') return `${MONTHS[month - 1] ?? ''} ${year}`
  if (zoom === 'quarter') return `Q${Math.floor((month - 1) / 3) + 1} ${year}`
  return year
}

/** The same period on a chart axis: "Sep 27" · "Sep" · "Q3" · "2026". */
export function manHoursPeriodShortLabel(period: Pick<ManHoursPeriod, 'start'>, zoom: ManHoursZoom): string {
  const month = Number(period.start.slice(5, 7))
  if (zoom === 'week') return manHoursDayLabel(period.start)
  if (zoom === 'month') return (MONTHS[month - 1] ?? '').slice(0, 3)
  if (zoom === 'quarter') return `Q${Math.floor((month - 1) / 3) + 1}`
  return period.start.slice(0, 4)
}
