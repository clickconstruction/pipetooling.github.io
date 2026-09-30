/**
 * Vectors by the day (v2.4217, punch list #69) — was each person's day worth it?
 *
 * The Bridge's Vectors panel reads one pay week per person. This kernel reads
 * the same records one DAY per person and folds the days into pay weeks and
 * months, so the owner's three questions — profitable today, this week, this
 * month — are one grid:
 *
 *   earned        Σ field hours × the job's earned rate per hour (contract ÷
 *                 expected hours — `earnedRevenue.ts`, the rate Vectors uses)
 *   labor         Σ field hours × the person's field wage; a SALARIED person's
 *                 day costs the flat workday (`salariedFlatDayHours`, 8 on a
 *                 weekday, 0 on a weekend) whatever the clock says, the same
 *                 reading payroll and People → Review price it by
 *   contribution  earned − field labor; null on a day with no field hours
 *                 (an office or bid day costs a wage and earns nothing here —
 *                 it is drawn grey, never judged)
 *
 * Two readings of time: `approved` counts what payroll paid (Vectors' own
 * rule); `recorded` counts every closed session that is not rejected or
 * revoked, the reading job costing has used since v2.3178, so this week is
 * not blank while approvals catch up. Pending hours counted are reported on
 * the bucket so the panel can dash them.
 *
 * A red day is a job's verdict, not a person's: every hour on a job earns the
 * same rate, so a day goes red only when the job's rate is under the wage —
 * priced low, no contract price, or run past its expected hours. Each bucket
 * keeps its jobs and its red days by job so the panel can say so.
 *
 * The past moves: the rate is contract ÷ (hours to date ÷ % complete), so a
 * new hour or a % update re-prices every day ever worked on that job. Every
 * figure here is as of the rates passed in — today's.
 *
 * Pure: no React, no Supabase.
 */

import { salariedFlatDayHours } from '../salariedEffectiveHours'
import { payWeekStart } from '../payWeekAnchor'
import type { VectorPerson, VectorSession, VectorWage } from './vectors'

export type VectorTimeMode = 'recorded' | 'approved'
export type VectorZoom = 'days' | 'weeks' | 'months'

export type VectorBucketJob = {
  jobId: string
  label: string
  hours: number
  /** Earned $ per hour on the job, null when it has no contract price. */
  ratePerHour: number | null
  /** The job's expected hours are a guess (no % complete → assumed half done). */
  guessed: boolean
  earnedUsd: number
  /** Days in the bucket where this job's hours earned less than they cost. */
  redDays: number
}

export type VectorBucket = {
  start: string
  end: string
  fieldHours: number
  officeBidHours: number
  /** Hours counted that are not yet approved (recorded mode only). */
  pendingHours: number
  earnedUsd: number
  /** Field labor $ — the flat workday for a salaried person whose day had field hours. */
  laborUsd: number
  /** Office / bid labor $ — kept apart so contribution stays field-only, as on Vectors. */
  officeLaborUsd: number
  /** earned − field labor; null when the bucket has no field hours. */
  contributionUsd: number | null
  contributionPerHour: number | null
  guessedEarnedUsd: number
  /** Field hours on jobs with no earned rate (no contract $). */
  unratedHours: number
  /** Days in the bucket with field hours. */
  fieldDays: number
  /** Days in the bucket whose contribution was negative. */
  redDays: number
  jobs: VectorBucketJob[]
}

export type VectorColumn = {
  key: string
  kind: 'day' | 'weekSum' | 'week' | 'month'
  start: string
  end: string
  label: string
  sub: string
  weekend: boolean
  future: boolean
  /** The column's period runs past the range or past today (a week cut by the month's edge, the current month). */
  partial: boolean
}

export type VectorGridRow = {
  userId: string
  name: string
  role: string | null
  isSalary: boolean
  noWage: boolean
  /** The wage the field hours were costed at (field, else office). */
  wage: number | null
  cells: Array<VectorBucket | null>
  total: VectorBucket
  /** Red days by job, most first. */
  redByJob: Array<{ jobId: string; label: string; days: number; noPrice: boolean; guessed: boolean }>
}

export type VectorGrid = {
  zoom: VectorZoom
  mode: VectorTimeMode
  start: string
  end: string
  todayYmd: string
  columns: VectorColumn[]
  rows: VectorGridRow[]
  company: { cells: Array<VectorBucket | null>; total: VectorBucket }
}

export type VectorDaysInput = {
  zoom: VectorZoom
  /** Any day inside the period to draw: its month for `days` / `months`, its pay week for `weeks`. */
  anchorYmd: string
  todayYmd: string
  mode: VectorTimeMode
  people: ReadonlyArray<VectorPerson>
  wages: ReadonlyArray<VectorWage>
  sessions: ReadonlyArray<VectorSession>
  /** Earned $ per field hour, per job (contract ÷ expected hours). */
  ratePerHourByJob: ReadonlyMap<string, number>
  /** Jobs whose expected hours are a guess (`earnedRevenue.assumedHalfJobs`). */
  assumedHalfJobs?: ReadonlySet<string>
  /** Job labels for the buckets' job lines; a job with no label reads by id. */
  jobLabels?: ReadonlyMap<string, string>
}

export const VECTOR_WEEKS_ZOOM_COUNT = 13
export const VECTOR_MONTHS_ZOOM_COUNT = 12

const num = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// ---- date arithmetic on YYYY-MM-DD strings (UTC noon so no zone can move the civil day) ----

export function ymdParts(ymd: string): { y: number; m: number; d: number } {
  return { y: Number(ymd.slice(0, 4)), m: Number(ymd.slice(5, 7)), d: Number(ymd.slice(8, 10)) }
}
const pad = (n: number): string => String(n).padStart(2, '0')
export function ymdOf(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`
}
export function ymdAddDays(ymd: string, delta: number): string {
  const { y, m, d } = ymdParts(ymd)
  const t = new Date(Date.UTC(y, m - 1, d + delta, 12))
  return ymdOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}
export function ymdWeekday(ymd: string): number {
  const { y, m, d } = ymdParts(ymd)
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()
}
export function monthStartOf(ymd: string): string {
  const { y, m } = ymdParts(ymd)
  return ymdOf(y, m, 1)
}
export function monthEndOf(ymd: string): string {
  const { y, m } = ymdParts(ymd)
  const last = new Date(Date.UTC(y, m, 0, 12)).getUTCDate()
  return ymdOf(y, m, last)
}
export function addMonths(ymd: string, delta: number): string {
  const { y, m, d } = ymdParts(ymd)
  const t = new Date(Date.UTC(y, m - 1 + delta, 1, 12))
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0, 12)).getUTCDate()
  return ymdOf(t.getUTCFullYear(), t.getUTCMonth() + 1, Math.min(d, last))
}
/** "Sep 2026". */
export function monthLabel(ymd: string): string {
  const { y, m } = ymdParts(ymd)
  return `${MONTHS[m - 1]} ${y}`
}
/** "Sep 27". */
export function monthDayLabel(ymd: string): string {
  const { m, d } = ymdParts(ymd)
  return `${MONTHS[m - 1]} ${d}`
}

/** The period a zoom draws around an anchor day. */
export function vectorRangeFor(zoom: VectorZoom, anchorYmd: string): { start: string; end: string } {
  if (zoom === 'days') return { start: monthStartOf(anchorYmd), end: monthEndOf(anchorYmd) }
  if (zoom === 'weeks') {
    const lastStart = payWeekStart(anchorYmd)
    return { start: ymdAddDays(lastStart, -7 * (VECTOR_WEEKS_ZOOM_COUNT - 1)), end: ymdAddDays(lastStart, 6) }
  }
  const lastStart = monthStartOf(anchorYmd)
  return { start: addMonths(lastStart, -(VECTOR_MONTHS_ZOOM_COUNT - 1)), end: monthEndOf(lastStart) }
}

/** Step the anchor one period back or forward for a zoom. */
export function vectorAnchorStep(zoom: VectorZoom, anchorYmd: string, delta: -1 | 1): string {
  if (zoom === 'days') return addMonths(monthStartOf(anchorYmd), delta)
  if (zoom === 'weeks') return ymdAddDays(payWeekStart(anchorYmd), 7 * VECTOR_WEEKS_ZOOM_COUNT * delta)
  return addMonths(monthStartOf(anchorYmd), VECTOR_MONTHS_ZOOM_COUNT * delta)
}

/** "September 2026" for the Days zoom, "Jul 5 – Oct 3" for Weeks, "Oct 2025 – Sep 2026" for Months. */
export function vectorRangeLabel(zoom: VectorZoom, range: { start: string; end: string }): string {
  if (zoom === 'days') {
    const { y, m } = ymdParts(range.start)
    const long = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    return `${long[m - 1]} ${y}`
  }
  if (zoom === 'weeks') return `${monthDayLabel(range.start)} – ${monthDayLabel(range.end)}`
  return `${monthLabel(range.start)} – ${monthLabel(range.end)}`
}

// ---- buckets ----

export function emptyBucket(start: string, end: string): VectorBucket {
  return { start, end, fieldHours: 0, officeBidHours: 0, pendingHours: 0, earnedUsd: 0, laborUsd: 0, officeLaborUsd: 0, contributionUsd: null, contributionPerHour: null, guessedEarnedUsd: 0, unratedHours: 0, fieldDays: 0, redDays: 0, jobs: [] }
}

function closeBucket(b: VectorBucket): VectorBucket {
  if (b.fieldHours > 0) {
    b.contributionUsd = b.earnedUsd - b.laborUsd
    b.contributionPerHour = b.contributionUsd / b.fieldHours
  } else {
    b.contributionUsd = null
    b.contributionPerHour = null
  }
  b.jobs.sort((a, c) => c.hours - a.hours || a.label.localeCompare(c.label))
  return b
}

/** Sum buckets into one over [start, end]; jobs merge by id, red days add up. */
export function foldBuckets(list: ReadonlyArray<VectorBucket | null | undefined>, start: string, end: string): VectorBucket {
  const out = emptyBucket(start, end)
  const jobs = new Map<string, VectorBucketJob>()
  for (const b of list) {
    if (!b) continue
    out.fieldHours += b.fieldHours
    out.officeBidHours += b.officeBidHours
    out.pendingHours += b.pendingHours
    out.earnedUsd += b.earnedUsd
    out.laborUsd += b.laborUsd
    out.officeLaborUsd += b.officeLaborUsd
    out.guessedEarnedUsd += b.guessedEarnedUsd
    out.unratedHours += b.unratedHours
    out.fieldDays += b.fieldDays
    out.redDays += b.redDays
    for (const j of b.jobs) {
      const cur = jobs.get(j.jobId)
      if (cur) {
        cur.hours += j.hours
        cur.earnedUsd += j.earnedUsd
        cur.redDays += j.redDays
        cur.guessed = cur.guessed || j.guessed
      } else jobs.set(j.jobId, { ...j })
    }
  }
  out.jobs = [...jobs.values()]
  return closeBucket(out)
}

/**
 * One bucket per person per day with hours, from the sessions in [start, end].
 * A person's day exists only when they clocked something that day.
 */
export function buildVectorDayCells(input: {
  start: string
  end: string
  mode: VectorTimeMode
  wages: ReadonlyArray<VectorWage>
  sessions: ReadonlyArray<VectorSession>
  ratePerHourByJob: ReadonlyMap<string, number>
  assumedHalfJobs?: ReadonlySet<string>
  jobLabels?: ReadonlyMap<string, string>
}): Map<string, Map<string, VectorBucket>> {
  const wageByUser = new Map(input.wages.map((w) => [w.userId, w]))
  const byUser = new Map<string, Map<string, VectorBucket>>()
  for (const s of input.sessions) {
    if (s.workDate < input.start || s.workDate > input.end) continue
    const h = num(s.hours)
    if (h <= 0) continue
    const counts = s.approved || (input.mode === 'recorded' && s.pending)
    if (!counts) continue
    let days = byUser.get(s.userId)
    if (!days) {
      days = new Map()
      byUser.set(s.userId, days)
    }
    let cell = days.get(s.workDate)
    if (!cell) {
      cell = emptyBucket(s.workDate, s.workDate)
      days.set(s.workDate, cell)
    }
    const w = wageByUser.get(s.userId)
    const salaried = w?.isSalary ?? false
    if (s.pending) cell.pendingHours += h
    if (s.onBid || s.officeJob || !s.jobId) {
      cell.officeBidHours += h
      if (!salaried) cell.officeLaborUsd += h * num(w?.officeWage ?? w?.fieldWage)
      continue
    }
    cell.fieldHours += h
    if (!salaried) cell.laborUsd += h * num(w?.fieldWage)
    const rate = input.ratePerHourByJob.get(s.jobId)
    const guessed = input.assumedHalfJobs?.has(s.jobId) ?? false
    let earned = 0
    if (rate == null) cell.unratedHours += h
    else {
      earned = h * rate
      cell.earnedUsd += earned
      if (guessed) cell.guessedEarnedUsd += earned
    }
    const job = cell.jobs.find((j) => j.jobId === s.jobId)
    if (job) {
      job.hours += h
      job.earnedUsd += earned
    } else cell.jobs.push({ jobId: s.jobId, label: input.jobLabels?.get(s.jobId) ?? s.jobId, hours: h, ratePerHour: rate ?? null, guessed, earnedUsd: earned, redDays: 0 })
  }
  // Close every day: the salaried flat day, the day's verdict, its red jobs.
  for (const [userId, days] of byUser) {
    const w = wageByUser.get(userId)
    for (const cell of days.values()) {
      if (w?.isSalary) {
        const flat = salariedFlatDayHours(cell.start) * num(w.fieldWage ?? w.officeWage)
        if (cell.fieldHours > 0) {
          cell.laborUsd = flat
          cell.officeLaborUsd = 0
        } else {
          cell.laborUsd = 0
          cell.officeLaborUsd = flat
        }
      }
      if (cell.fieldHours > 0) {
        cell.fieldDays = 1
        const wagePerHour = cell.laborUsd / cell.fieldHours
        for (const j of cell.jobs) if ((j.ratePerHour ?? 0) < wagePerHour) j.redDays = 1
      }
      closeBucket(cell)
      if (cell.contributionUsd != null && cell.contributionUsd < 0) cell.redDays = 1
    }
  }
  return byUser
}

// ---- columns ----

/** The columns a zoom draws over its range: days with a week sum after every Saturday (and the month's last day), or pay weeks, or months. */
export function vectorColumnsFor(zoom: VectorZoom, range: { start: string; end: string }, todayYmd: string): VectorColumn[] {
  const cols: VectorColumn[] = []
  if (zoom === 'days') {
    let weekFrom = range.start
    for (let d = range.start; d <= range.end; d = ymdAddDays(d, 1)) {
      const dow = ymdWeekday(d)
      cols.push({ key: d, kind: 'day', start: d, end: d, label: String(ymdParts(d).d), sub: DOW[dow] ?? '', weekend: dow === 0 || dow === 6, future: d > todayYmd, partial: false })
      if (dow === 6 || d === range.end) {
        const wholeWeek = ymdWeekday(weekFrom) === 0 && dow === 6
        cols.push({ key: `wk:${weekFrom}`, kind: 'weekSum', start: weekFrom, end: d, label: 'wk', sub: d > todayYmd && weekFrom <= todayYmd ? 'so far' : wholeWeek ? '' : 'part', weekend: false, future: weekFrom > todayYmd, partial: !wholeWeek || d > todayYmd })
        weekFrom = ymdAddDays(d, 1)
      }
    }
    return cols
  }
  if (zoom === 'weeks') {
    for (let s = range.start; s <= range.end; s = ymdAddDays(s, 7)) {
      const e = ymdAddDays(s, 6)
      cols.push({ key: s, kind: 'week', start: s, end: e, label: monthDayLabel(s), sub: e > todayYmd && s <= todayYmd ? 'so far' : '', weekend: false, future: s > todayYmd, partial: e > todayYmd })
    }
    return cols
  }
  for (let s = range.start; s <= range.end; s = addMonths(s, 1)) {
    const e = monthEndOf(s)
    const { y, m } = ymdParts(s)
    cols.push({ key: s, kind: 'month', start: s, end: e, label: m === 1 || s === range.start ? `${MONTHS[m - 1] ?? ''} ${String(y).slice(2)}` : (MONTHS[m - 1] ?? ''), sub: e > todayYmd && s <= todayYmd ? 'so far' : '', weekend: false, future: s > todayYmd, partial: e > todayYmd })
  }
  return cols
}

// ---- the grid ----

function bucketForColumn(days: ReadonlyMap<string, VectorBucket>, col: VectorColumn): VectorBucket | null {
  if (col.kind === 'day') return days.get(col.start) ?? null
  const inCol: VectorBucket[] = []
  for (const [ymd, b] of days) if (ymd >= col.start && ymd <= col.end) inCol.push(b)
  if (inCol.length === 0) return null
  return foldBuckets(inCol, col.start, col.end)
}

export function compareVectorGridRows(a: VectorGridRow, b: VectorGridRow): number {
  const ac = a.total.contributionUsd
  const bc = b.total.contributionUsd
  if (ac != null && bc != null && ac !== bc) return bc - ac
  if (ac != null && bc == null) return -1
  if (ac == null && bc != null) return 1
  return a.name.localeCompare(b.name)
}

/** The whole grid for a zoom around an anchor: one row per person who had field hours (or field hours waiting) in the range. */
export function buildVectorGrid(input: VectorDaysInput): VectorGrid {
  const range = vectorRangeFor(input.zoom, input.anchorYmd)
  const columns = vectorColumnsFor(input.zoom, range, input.todayYmd)
  const cellsByUser = buildVectorDayCells({ start: range.start, end: range.end, mode: input.mode, wages: input.wages, sessions: input.sessions, ratePerHourByJob: input.ratePerHourByJob, assumedHalfJobs: input.assumedHalfJobs, jobLabels: input.jobLabels })
  const wageByUser = new Map(input.wages.map((w) => [w.userId, w]))
  const personById = new Map(input.people.map((p) => [p.userId, p]))
  const rows: VectorGridRow[] = []
  for (const [userId, days] of cellsByUser) {
    const total = foldBuckets([...days.values()], range.start, range.end)
    if (total.fieldHours <= 0) continue
    const p = personById.get(userId)
    const w = wageByUser.get(userId)
    const redByJob = total.jobs
      .filter((j) => j.redDays > 0)
      .map((j) => ({ jobId: j.jobId, label: j.label, days: j.redDays, noPrice: j.ratePerHour == null, guessed: j.guessed }))
      .sort((a, b) => b.days - a.days || a.label.localeCompare(b.label))
    rows.push({
      userId,
      name: p?.name ?? 'Unnamed',
      role: p?.role ?? null,
      isSalary: w?.isSalary ?? false,
      noWage: !w || (w.fieldWage == null && w.officeWage == null),
      wage: w?.fieldWage ?? w?.officeWage ?? null,
      cells: columns.map((c) => bucketForColumn(days, c)),
      total,
      redByJob,
    })
  }
  rows.sort(compareVectorGridRows)
  const companyCells = columns.map((c, i) => {
    const inCol = rows.map((r) => r.cells[i]).filter((b): b is VectorBucket => !!b)
    return inCol.length === 0 ? null : foldBuckets(inCol, c.start, c.end)
  })
  const companyTotal = foldBuckets(
    rows.map((r) => r.total),
    range.start,
    range.end,
  )
  return { zoom: input.zoom, mode: input.mode, start: range.start, end: range.end, todayYmd: input.todayYmd, columns, rows, company: { cells: companyCells, total: companyTotal } }
}
