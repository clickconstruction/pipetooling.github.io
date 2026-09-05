import type { JobDayLedger } from './jobDayLedger'
import type { JobSummaryEnrichedRow } from './jobSummaryLedgerView'

/**
 * The Months view kernel (v2.2821): one bar per month — revenue split into
 * labor, subs, parts, overhead, and what's left. Overhead per month is that
 * month's pool from the day ledger (office labor + bid labor + office parts),
 * whole and unallocated included, so the column reconciles to the Overhead tab
 * to the dollar instead of depending on an allocation lens.
 *
 * Two bookings:
 *  - work: each job's revenue and costs are spread over the months it was
 *    worked, by its approved field hours in each (a job with no hours in the
 *    window can't be placed and is counted aside).
 *  - bill: each job books whole to the month its last bill went out; unbilled
 *    jobs, and jobs billed outside the window, are counted aside.
 *
 * Pure.
 */
export type JobSummaryMonthsBookBy = 'work' | 'bill'

export const JOB_SUMMARY_MONTHS_BOOK_OPTIONS: ReadonlyArray<{ key: JobSummaryMonthsBookBy; label: string; title: string }> = [
  { key: 'work', label: 'work month', title: 'Spread each job’s revenue and costs over the months it was worked, by field hours' },
  { key: 'bill', label: 'bill month', title: 'Book each job whole to the month its last bill went out' },
]

export type JobSummaryMonth = {
  /** YYYY-MM */
  ym: string
  /** "Aug 2026" */
  label: string
  /** Jobs touched (work) or billed (bill) in the month. */
  jobs: number
  revenueUsd: number
  laborUsd: number
  subsUsd: number
  partsUsd: number
  /** The month's whole overhead pool; null until the ledger has loaded. */
  overheadUsd: number | null
  /** The part of the pool that fell on days with no field work. */
  unallocatedUsd: number
  fieldHours: number
  trueProfitUsd: number | null
  trueMarginPct: number | null
}

export type JobSummaryMonthsSeries = {
  bookBy: JobSummaryMonthsBookBy
  months: JobSummaryMonth[]
  totals: Pick<JobSummaryMonth, 'jobs' | 'revenueUsd' | 'laborUsd' | 'subsUsd' | 'partsUsd' | 'overheadUsd' | 'unallocatedUsd' | 'fieldHours' | 'trueProfitUsd' | 'trueMarginPct'>
  /** Best month by true profit (revenue when overhead is unknown). */
  best: JobSummaryMonth | null
  /** Jobs the booking couldn't place: no hours in the window (work) or no bill date in the window (bill). */
  unplacedJobs: number
  unplacedRevenueUsd: number
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function monthLabel(ym: string): string {
  return `${MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym.slice(5, 7)} ${ym.slice(0, 4)}`
}

/** Every YYYY-MM from the start month to the end month, inclusive. */
export function monthsBetween(startYmd: string, endYmd: string): string[] {
  const out: string[] = []
  let y = Number(startYmd.slice(0, 4))
  let m = Number(startYmd.slice(5, 7))
  const endYm = endYmd.slice(0, 7)
  let guard = 0
  while (guard < 240) {
    const ym = `${y}-${String(m).padStart(2, '0')}`
    out.push(ym)
    if (ym >= endYm) break
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
    guard += 1
  }
  return out
}

export function bucketJobSummaryByMonth(args: {
  rows: readonly JobSummaryEnrichedRow[]
  ledger: JobDayLedger | null
  bookBy: JobSummaryMonthsBookBy
  startYmd: string
  endYmd: string
}): JobSummaryMonthsSeries {
  const { rows, ledger, bookBy, startYmd, endYmd } = args
  const yms = monthsBetween(startYmd, endYmd)
  const byYm = new Map<string, JobSummaryMonth>(
    yms.map((ym) => [ym, { ym, label: monthLabel(ym), jobs: 0, revenueUsd: 0, laborUsd: 0, subsUsd: 0, partsUsd: 0, overheadUsd: ledger ? 0 : null, unallocatedUsd: 0, fieldHours: 0, trueProfitUsd: null, trueMarginPct: null }]),
  )
  // Overhead and field hours: straight off the ledger days.
  if (ledger) {
    for (const d of ledger.days) {
      const m = byYm.get(d.ymd.slice(0, 7))
      if (!m) continue
      m.overheadUsd = (m.overheadUsd ?? 0) + d.poolUsd
      m.fieldHours += d.fieldHours
      if (d.poolUsd > 0 && !(d.fieldHours > 0)) m.unallocatedUsd += d.poolUsd
    }
  }
  let unplacedJobs = 0
  let unplacedRevenueUsd = 0
  const add = (m: JobSummaryMonth, r: JobSummaryEnrichedRow, share: number) => {
    m.revenueUsd += r.revenueUsd * share
    m.laborUsd += r.laborUsd * share
    m.subsUsd += r.subsUsd * share
    m.partsUsd += r.partsUsd * share
  }
  for (const r of rows) {
    if (bookBy === 'bill') {
      const ym = r.row.job.last_bill_date?.slice(0, 7) ?? null
      const m = ym ? byYm.get(ym) : undefined
      if (!m) {
        unplacedJobs += 1
        unplacedRevenueUsd += r.revenueUsd
        continue
      }
      m.jobs += 1
      add(m, r, 1)
      continue
    }
    // work: hours per month for this job from the ledger days
    const hoursByYm = new Map<string, number>()
    let total = 0
    if (ledger) {
      for (const d of ledger.days) {
        const h = d.byJob.get(r.row.job.id)?.hours ?? 0
        if (h > 0) {
          const ym = d.ymd.slice(0, 7)
          hoursByYm.set(ym, (hoursByYm.get(ym) ?? 0) + h)
          total += h
        }
      }
    }
    if (!(total > 0)) {
      unplacedJobs += 1
      unplacedRevenueUsd += r.revenueUsd
      continue
    }
    for (const [ym, h] of hoursByYm) {
      const m = byYm.get(ym)
      if (!m) continue
      m.jobs += 1
      add(m, r, h / total)
    }
  }
  const months = yms.map((ym) => byYm.get(ym)!)
  for (const m of months) {
    if (m.overheadUsd != null) {
      m.trueProfitUsd = m.revenueUsd - m.laborUsd - m.subsUsd - m.partsUsd - m.overheadUsd
      m.trueMarginPct = m.revenueUsd > 0 ? (m.trueProfitUsd / m.revenueUsd) * 100 : null
    }
  }
  const sum = (k: 'jobs' | 'revenueUsd' | 'laborUsd' | 'subsUsd' | 'partsUsd' | 'unallocatedUsd' | 'fieldHours') => months.reduce((a, m) => a + m[k], 0)
  const overheadUsd = ledger ? months.reduce((a, m) => a + (m.overheadUsd ?? 0), 0) : null
  const revenueUsd = sum('revenueUsd')
  const trueProfitUsd = overheadUsd == null ? null : revenueUsd - sum('laborUsd') - sum('subsUsd') - sum('partsUsd') - overheadUsd
  const totals: JobSummaryMonthsSeries['totals'] = {
    jobs: sum('jobs'),
    revenueUsd,
    laborUsd: sum('laborUsd'),
    subsUsd: sum('subsUsd'),
    partsUsd: sum('partsUsd'),
    overheadUsd,
    unallocatedUsd: sum('unallocatedUsd'),
    fieldHours: sum('fieldHours'),
    trueProfitUsd,
    trueMarginPct: trueProfitUsd == null || !(revenueUsd > 0) ? null : (trueProfitUsd / revenueUsd) * 100,
  }
  let best: JobSummaryMonth | null = null
  for (const m of months) {
    const v = m.trueProfitUsd ?? m.revenueUsd
    const bv = best ? (best.trueProfitUsd ?? best.revenueUsd) : null
    if (m.revenueUsd > 0 && (bv == null || v > bv)) best = m
  }
  return { bookBy, months, totals, best, unplacedJobs, unplacedRevenueUsd }
}
