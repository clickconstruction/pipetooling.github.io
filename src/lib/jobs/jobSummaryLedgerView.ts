import { resolveJobSummaryPercentComplete, jobInvoicesAllPaidWithAmount } from '../jobSummaryPercentComplete'
import type { JobSummaryMonthsBookBy } from './jobSummaryMonths'
import type { JobSummaryScatterColorBy, JobSummaryScatterSizeBy } from './jobSummaryScatter'
import {
  allocateJobOverheadDayShare,
  jobOverheadByMethod,
  unallocatedJobDayOverhead,
  type JobDayLedger,
  type JobOverheadDayLine,
  type JobOverheadMethod,
} from './jobDayLedger'

/**
 * Job Summary ledger view (v2.2692): the pure layer between the page's P&L
 * memo (`jobSummaryData`) and the table. Adds what the tab never had —
 * a status filter that opens on finished (100%) jobs, a "worked in" window,
 * column sorts, margin, hours · days, an overhead share per job, true profit,
 * and totals — without touching the memo's cost math.
 *
 * Revenue rule (owner pick 2026-09-03): finished jobs show the contract
 * (`jobs_ledger.revenue`); in-progress jobs show EARNED revenue = contract ×
 * % complete, so their true profit compares costs-to-date with value-to-date.
 * No % on an open job → assumed 50% and flagged (the Bridge's rule).
 */

export type JobSummaryStatusFilter = 'finished' | 'in_progress' | 'all'
export type JobSummaryWindowKey = '90d' | '6mo' | 'ytd' | '12mo' | 'all'
export type JobSummarySortKey =
  | 'job'
  | 'revenue'
  | 'labor'
  | 'subs'
  | 'parts'
  | 'gross'
  | 'margin'
  | 'hours'
  | 'overhead'
  | 'trueProfit'
  | 'trueMargin'
  | 'revPerHour'
  | 'pct'
export type JobSummarySortDir = 'asc' | 'desc'

/** Cut by (v2.2820): group the Jobs table by one key, subtotal per group, ranked bars beside it. */
export type JobSummaryCutBy = 'none' | 'gc' | 'trade' | 'tech' | 'accountManager' | 'customer' | 'development' | 'billMonth'

export const JOB_SUMMARY_CUT_OPTIONS: ReadonlyArray<{ key: JobSummaryCutBy; label: string; title: string }> = [
  { key: 'none', label: 'none', title: 'One flat table' },
  { key: 'gc', label: 'GC', title: 'Group by the job’s General Contractor' },
  { key: 'trade', label: 'service type', title: 'Group by service type (plumbing, electrical, …)' },
  { key: 'tech', label: 'lead tech', title: 'Group by the job’s master technician' },
  { key: 'accountManager', label: 'account man', title: 'Group by the job’s Account Man' },
  { key: 'customer', label: 'customer', title: 'Group by customer name' },
  { key: 'development', label: 'development', title: 'Group by development (a set of jobs at one site)' },
  { key: 'billMonth', label: 'bill month', title: 'Group by the month the last bill went out (unbilled jobs sit together)' },
]
const CUT_KEYS: readonly JobSummaryCutBy[] = JOB_SUMMARY_CUT_OPTIONS.map((o) => o.key)

/** Jobs = the ledger table; Days = jobs carried per day (v2.2695); Timeline = jobs running at once, over time (v2.2711); Months = the monthly P&L (v2.2821). */
export type JobSummaryViewMode = 'jobs' | 'days' | 'timeline' | 'months' | 'cycle' | 'scatter' | 'capacity' | 'ahead' | 'rework'

/** Timeline coloring (v2.2745): by today's status, by the state on each day, or by run length. */
export type JobSummaryTimelineColorBy = 'status' | 'stateOnDay' | 'runLength'

/** Compare to (v2.2817): run the same view on a second window and show the difference. */
export type JobSummaryCompareTo = 'none' | 'prior' | 'lastYear'

export const JOB_SUMMARY_COMPARE_OPTIONS: ReadonlyArray<{ key: JobSummaryCompareTo; label: string; title: string }> = [
  { key: 'none', label: 'none', title: 'Show this window only' },
  { key: 'prior', label: 'prior period', title: 'The same number of days immediately before this window — every tile shows the change' },
  { key: 'lastYear', label: 'last year', title: 'The same dates one year earlier — every tile shows the change' },
]

/** Target true margin (v2.2817), whole percent; 0 = off. */
export const JOB_SUMMARY_TARGET_OPTIONS: ReadonlyArray<{ key: number; label: string; title: string }> = [
  { key: 0, label: 'off', title: 'No target line' },
  { key: 30, label: '30%', title: 'Flag jobs whose true margin is under 30%' },
  { key: 35, label: '35%', title: 'Flag jobs whose true margin is under 35%' },
  { key: 40, label: '40%', title: 'Flag jobs whose true margin is under 40%' },
]
const TARGET_KEYS: readonly number[] = JOB_SUMMARY_TARGET_OPTIONS.map((o) => o.key)
const COMPARE_KEYS: readonly JobSummaryCompareTo[] = ['none', 'prior', 'lastYear']

export type JobSummaryViewPrefs = {
  view: JobSummaryViewMode
  status: JobSummaryStatusFilter
  window: JobSummaryWindowKey
  method: JobOverheadMethod
  sortKey: JobSummarySortKey
  sortDir: JobSummarySortDir
  timelineColorBy: JobSummaryTimelineColorBy
  /** Timeline granularity (v2.2746): one column per day, or one bar per Monday-keyed week. */
  timelineGranularity: 'daily' | 'weekly'
  /** Timeline "As of" slider row shown (v2.2807); the slider position itself always opens on today. */
  timelineAsOf: boolean
  /** Compare to (v2.2817): a second window whose totals sit under every tile as a delta. */
  compareTo: JobSummaryCompareTo
  /** Target true margin in whole percent (v2.2817); 0 = off. Under-target jobs are flagged wherever margin shows. */
  targetTrueMarginPct: number
  /** Cut by (v2.2820): the grouping key for the Jobs table. */
  cutBy: JobSummaryCutBy
  /** Months view booking (v2.2821): spread by work month, or whole by bill month. */
  monthsBookBy: JobSummaryMonthsBookBy
  /** Scatter view (v2.2826): color and bubble size. */
  scatterColorBy: JobSummaryScatterColorBy
  scatterSizeBy: JobSummaryScatterSizeBy
}

export const JOB_SUMMARY_VIEW_STORAGE_KEY = 'jobs_jobSummary_view_v1'

export const JOB_SUMMARY_VIEW_DEFAULTS: JobSummaryViewPrefs = {
  view: 'jobs',
  status: 'finished',
  window: 'ytd',
  method: 'day',
  sortKey: 'trueProfit',
  sortDir: 'desc',
  timelineColorBy: 'status',
  timelineGranularity: 'daily',
  timelineAsOf: false,
  compareTo: 'none',
  targetTrueMarginPct: 0,
  cutBy: 'none',
  monthsBookBy: 'work',
  scatterColorBy: 'trade',
  scatterSizeBy: 'hours',
}

export const JOB_SUMMARY_VIEW_MODE_OPTIONS: ReadonlyArray<{ key: JobSummaryViewMode; label: string; title: string }> = [
  { key: 'jobs', label: 'Jobs', title: 'One row per job — costs, overhead share, true profit' },
  { key: 'days', label: 'Days', title: 'One row per day — how many jobs the crew carried, and what a job-day of overhead cost' },
  { key: 'timeline', label: 'Timeline', title: 'How many jobs were running at once, over time — every job as a bar from start to finish' },
  { key: 'months', label: 'Months', title: 'One bar per month — revenue split into labor, subs, parts, overhead, and true profit' },
  { key: 'cycle', label: 'Cycle', title: 'How long from the last field day to the bill, and from the bill to the money — and which open jobs are sitting idle' },
  { key: 'scatter', label: 'Scatter', title: 'Every job as a bubble — size across, true margin up — so the big jobs with thin margins stand out' },
  { key: 'capacity', label: 'Capacity', title: 'Approved field hours against the roster’s available hours, by week — were we full?' },
  { key: 'ahead', label: 'Ahead', title: 'What’s coming: remaining value on open jobs, won bids not started, and the next eight weeks of field days against capacity' },
  { key: 'rework', label: 'Rework', title: 'Did we have to go back? Return visits to the same address within N days of the first job, by lead tech, service type, or GC' },
]

const STATUS_KEYS: readonly JobSummaryStatusFilter[] = ['finished', 'in_progress', 'all']
const WINDOW_KEYS: readonly JobSummaryWindowKey[] = ['90d', '6mo', 'ytd', '12mo', 'all']
const METHOD_KEYS: readonly JobOverheadMethod[] = ['day', 'A', 'B', 'C']
const SORT_KEYS: readonly JobSummarySortKey[] = ['job', 'revenue', 'labor', 'subs', 'parts', 'gross', 'margin', 'hours', 'overhead', 'trueProfit', 'trueMargin', 'revPerHour', 'pct']

export const JOB_SUMMARY_STATUS_OPTIONS: ReadonlyArray<{ key: JobSummaryStatusFilter; label: string; title: string }> = [
  { key: 'finished', label: 'Finished (100%)', title: 'Jobs whose % complete resolves to 100 — paid invoices, the latest report, or the job’s own %' },
  { key: 'in_progress', label: 'In progress', title: 'Everything under 100% (and jobs with no % yet)' },
  { key: 'all', label: 'All', title: 'Every job on the ledger' },
]

export const JOB_SUMMARY_WINDOW_OPTIONS: ReadonlyArray<{ key: JobSummaryWindowKey; label: string; title: string }> = [
  { key: '90d', label: '90d', title: 'Worked in the last 90 days' },
  { key: '6mo', label: '6 mo', title: 'Worked in the last 6 months (182 days)' },
  { key: 'ytd', label: 'This year', title: 'Worked since January 1' },
  { key: '12mo', label: '12 mo', title: 'Worked in the last 12 months' },
  { key: 'all', label: 'All', title: 'Every job — overhead charged from 2025-01-01' },
]

/** Where "All" starts for the overhead day table (the app’s clock history begins here). */
export const JOB_SUMMARY_ALL_TIME_START_YMD = '2025-01-01'

export function readJobSummaryViewPrefs(raw: string | null): JobSummaryViewPrefs {
  if (!raw) return { ...JOB_SUMMARY_VIEW_DEFAULTS }
  try {
    const p = JSON.parse(raw) as Partial<JobSummaryViewPrefs>
    return {
      view: ['days', 'timeline', 'months', 'cycle', 'scatter', 'capacity', 'ahead', 'rework'].includes(p.view as string) ? (p.view as JobSummaryViewMode) : 'jobs',
      status: STATUS_KEYS.includes(p.status as JobSummaryStatusFilter) ? (p.status as JobSummaryStatusFilter) : JOB_SUMMARY_VIEW_DEFAULTS.status,
      window: WINDOW_KEYS.includes(p.window as JobSummaryWindowKey) ? (p.window as JobSummaryWindowKey) : JOB_SUMMARY_VIEW_DEFAULTS.window,
      method: METHOD_KEYS.includes(p.method as JobOverheadMethod) ? (p.method as JobOverheadMethod) : JOB_SUMMARY_VIEW_DEFAULTS.method,
      sortKey: SORT_KEYS.includes(p.sortKey as JobSummarySortKey) ? (p.sortKey as JobSummarySortKey) : JOB_SUMMARY_VIEW_DEFAULTS.sortKey,
      sortDir: p.sortDir === 'asc' || p.sortDir === 'desc' ? p.sortDir : JOB_SUMMARY_VIEW_DEFAULTS.sortDir,
      timelineColorBy: p.timelineColorBy === 'stateOnDay' || p.timelineColorBy === 'runLength' ? p.timelineColorBy : 'status',
      timelineGranularity: p.timelineGranularity === 'weekly' ? 'weekly' : 'daily',
      timelineAsOf: p.timelineAsOf === true,
      compareTo: COMPARE_KEYS.includes(p.compareTo as JobSummaryCompareTo) ? (p.compareTo as JobSummaryCompareTo) : 'none',
      targetTrueMarginPct: TARGET_KEYS.includes(p.targetTrueMarginPct as number) ? (p.targetTrueMarginPct as number) : 0,
      cutBy: CUT_KEYS.includes(p.cutBy as JobSummaryCutBy) ? (p.cutBy as JobSummaryCutBy) : 'none',
      monthsBookBy: p.monthsBookBy === 'bill' ? 'bill' : 'work',
      scatterColorBy: p.scatterColorBy === 'gc' || p.scatterColorBy === 'tech' ? p.scatterColorBy : 'trade',
      scatterSizeBy: p.scatterSizeBy === 'days' || p.scatterSizeBy === 'none' ? p.scatterSizeBy : 'hours',
    }
  } catch {
    return { ...JOB_SUMMARY_VIEW_DEFAULTS }
  }
}

export function jobSummaryWindowStartYmd(todayYmd: string, window: JobSummaryWindowKey, addDays: (ymd: string, delta: number) => string): string {
  if (window === '90d') return addDays(todayYmd, -89)
  if (window === '6mo') return addDays(todayYmd, -181)
  if (window === '12mo') return addDays(todayYmd, -364)
  if (window === 'ytd') return `${todayYmd.slice(0, 4)}-01-01`
  return JOB_SUMMARY_ALL_TIME_START_YMD
}

/**
 * The window a Compare to runs on (v2.2817). "prior" is the same number of days
 * ending the day before this window starts; "last year" is the same dates a
 * year earlier (Feb 29 → Feb 28). "All" has no prior, so it compares to nothing.
 */
export function jobSummaryCompareWindow(
  startYmd: string,
  endYmd: string,
  compareTo: JobSummaryCompareTo,
  window: JobSummaryWindowKey,
  addDays: (ymd: string, delta: number) => string,
): { startYmd: string; endYmd: string } | null {
  if (compareTo === 'none' || window === 'all') return null
  if (compareTo === 'prior') {
    const days = Math.round((Date.UTC(+endYmd.slice(0, 4), +endYmd.slice(5, 7) - 1, +endYmd.slice(8, 10)) - Date.UTC(+startYmd.slice(0, 4), +startYmd.slice(5, 7) - 1, +startYmd.slice(8, 10))) / 86_400_000) + 1
    const priorEnd = addDays(startYmd, -1)
    return { startYmd: addDays(priorEnd, -(days - 1)), endYmd: priorEnd }
  }
  const backOneYear = (ymd: string): string => {
    const y = +ymd.slice(0, 4) - 1
    const md = ymd.slice(5)
    return `${y}-${md === '02-29' ? '02-28' : md}`
  }
  return { startYmd: backOneYear(startYmd), endYmd: backOneYear(endYmd) }
}

export type JobSummaryDelta = { now: number | null; prior: number | null; delta: number | null }

export type JobSummaryComparison = {
  jobs: JobSummaryDelta
  revenueUsd: JobSummaryDelta
  grossUsd: JobSummaryDelta
  /** Percentage points. */
  marginPts: JobSummaryDelta
  hours: JobSummaryDelta
  overheadUsd: JobSummaryDelta
  trueProfitUsd: JobSummaryDelta
  /** Percentage points. */
  trueMarginPts: JobSummaryDelta
  truePerHourUsd: JobSummaryDelta
}

const delta = (now: number | null, prior: number | null): JobSummaryDelta => ({ now, prior, delta: now == null || prior == null ? null : now - prior })

/** This window's totals against the compare window's, measure by measure (v2.2817). */
export function compareJobSummaryTotals(now: JobSummaryTotals, prior: JobSummaryTotals): JobSummaryComparison {
  return {
    jobs: delta(now.jobs, prior.jobs),
    revenueUsd: delta(now.revenueUsd, prior.revenueUsd),
    grossUsd: delta(now.grossUsd, prior.grossUsd),
    marginPts: delta(now.marginPct, prior.marginPct),
    hours: delta(now.hours, prior.hours),
    overheadUsd: delta(now.overheadUsd, prior.overheadUsd),
    trueProfitUsd: delta(now.trueProfitUsd, prior.trueProfitUsd),
    trueMarginPts: delta(now.trueMarginPct, prior.trueMarginPct),
    truePerHourUsd: delta(now.truePerHourUsd, prior.truePerHourUsd),
  }
}

/** Under the target when a target is set, the row has a true margin, and it's below (v2.2817). */
export function jobSummaryRowUnderTarget(row: Pick<JobSummaryEnrichedRow, 'trueMarginPct'>, targetTrueMarginPct: number): boolean {
  return targetTrueMarginPct > 0 && row.trueMarginPct != null && row.trueMarginPct < targetTrueMarginPct
}

export function countJobSummaryUnderTarget(rows: readonly Pick<JobSummaryEnrichedRow, 'trueMarginPct'>[], targetTrueMarginPct: number): number {
  return rows.reduce((n, r) => n + (jobSummaryRowUnderTarget(r, targetTrueMarginPct) ? 1 : 0), 0)
}

/** The structural slice of a `JobSummaryRow` the view needs (keeps the kernel free of component types). */
export type JobSummaryLedgerRowInput = {
  job: {
    id: string
    hcp_number: string | null
    click_number?: string | null
    job_name: string | null
    pct_complete: number | null
    invoices?: Array<{ status: string | null; amount: number | null; billed_at?: string | null }> | null
    /** Cycle view (v2.2823). */
    payments?: Array<{ paid_on: string | null; amount: number | null }> | null
    status?: string | null
    last_work_date?: string | null
    created_at?: string | null
    /** Cut by keys (v2.2820) — all optional so tests and older callers stay small. */
    gc_customer_id?: string | null
    gcCustomer?: { id?: string; name: string | null } | null
    serviceType?: { name: string } | null
    service_type_id?: string | null
    master_user_id?: string | null
    account_manager_user_id?: string | null
    account_manager?: { id?: string; name: string | null } | null
    customer_id?: string | null
    customer_name?: string | null
    /** Rework (v2.2831): the address key. */
    customer_address_id?: string | null
    job_address?: string | null
    development_id?: string | null
    development?: { id?: string; name: string | null } | null
    last_bill_date?: string | null
  }
  subLaborCost: number
  teamLaborCost: number
  partsCost: number
  totalBill: number
}

export type JobSummaryRowFlag = 'no-revenue' | 'no-hours' | 'no-pct' | 'assumed-50' | 'prior-hours' | 'earned'

export type JobSummaryEnrichedRow<R extends JobSummaryLedgerRowInput = JobSummaryLedgerRowInput> = {
  row: R
  pct: number | null
  finished: boolean
  /** Contract revenue (`jobs_ledger.revenue`). */
  contractUsd: number
  /** What the Revenue column shows: contract when finished, earned (contract × %) otherwise. */
  revenueUsd: number
  laborUsd: number
  subsUsd: number
  partsUsd: number
  grossUsd: number
  marginPct: number | null
  hoursInWindow: number
  daysInWindow: number
  priorHours: number
  /** Null until the day ledger has loaded (or when the chosen lens has no denominator). */
  overheadUsd: number | null
  overheadLines: JobOverheadDayLine[]
  trueProfitUsd: number | null
  trueMarginPct: number | null
  /** Revenue ÷ approved field hours in the window (v2.2820); null without hours. */
  revenuePerHourUsd: number | null
  lastWorkedYmd: string | null
  flags: JobSummaryRowFlag[]
}

function jobLastWorkedYmd(job: JobSummaryLedgerRowInput['job'], ledger: JobDayLedger | null): string | null {
  const fromLedger = ledger?.jobs.get(job.id)?.lastYmd ?? null
  const fromJob = (job.last_work_date ?? job.created_at ?? '').slice(0, 10) || null
  if (fromLedger && fromJob) return fromLedger > fromJob ? fromLedger : fromJob
  return fromLedger ?? fromJob
}

export function enrichJobSummaryRows<R extends JobSummaryLedgerRowInput>(args: {
  rows: readonly R[]
  reportPctByJobId: ReadonlyMap<string, number>
  ledger: JobDayLedger | null
  method: JobOverheadMethod
}): JobSummaryEnrichedRow<R>[] {
  const { rows, reportPctByJobId, ledger, method } = args
  return rows.map((row) => {
    const job = row.job
    const pct = resolveJobSummaryPercentComplete(reportPctByJobId.get(job.id) ?? null, job.pct_complete, {
      invoicesAllPaidWithAmount: jobInvoicesAllPaidWithAmount(job.invoices),
    })
    const finished = pct === 100
    const contractUsd = row.totalBill
    const flags: JobSummaryRowFlag[] = []
    let revenueUsd = contractUsd
    if (!finished) {
      if (pct == null) {
        revenueUsd = contractUsd * 0.5
        flags.push('assumed-50')
      } else revenueUsd = contractUsd * (pct / 100)
      if (contractUsd > 0) flags.push('earned')
    }
    if (pct == null) flags.push('no-pct')
    if (!(contractUsd > 0)) flags.push('no-revenue')
    const laborUsd = row.teamLaborCost
    const subsUsd = row.subLaborCost
    const partsUsd = row.partsCost
    const grossUsd = revenueUsd - laborUsd - subsUsd - partsUsd
    const marginPct = revenueUsd > 0 ? (grossUsd / revenueUsd) * 100 : null
    let hoursInWindow = 0
    let daysInWindow = 0
    let priorHours = 0
    let overheadUsd: number | null = null
    let overheadLines: JobOverheadDayLine[] = []
    if (ledger) {
      const share = allocateJobOverheadDayShare(ledger, job.id)
      hoursInWindow = share.hoursInWindow
      daysInWindow = share.daysInWindow
      overheadLines = share.lines
      priorHours = ledger.priorHoursByJob.get(job.id) ?? 0
      overheadUsd = method === 'day' ? share.overheadUsd : jobOverheadByMethod(ledger, job.id, method, { revenueUsd })
      if (!(hoursInWindow > 0)) flags.push('no-hours')
      if (priorHours > 0) flags.push('prior-hours')
    }
    const trueProfitUsd = overheadUsd == null ? null : grossUsd - overheadUsd
    const trueMarginPct = trueProfitUsd == null || !(revenueUsd > 0) ? null : (trueProfitUsd / revenueUsd) * 100
    return {
      row,
      pct,
      finished,
      contractUsd,
      revenueUsd,
      laborUsd,
      subsUsd,
      partsUsd,
      grossUsd,
      marginPct,
      hoursInWindow,
      daysInWindow,
      priorHours,
      overheadUsd,
      overheadLines,
      trueProfitUsd,
      trueMarginPct,
      revenuePerHourUsd: hoursInWindow > 0 ? revenueUsd / hoursInWindow : null,
      lastWorkedYmd: jobLastWorkedYmd(job, ledger),
      flags,
    }
  })
}

export function jobSummaryRowMatchesSearch(job: JobSummaryLedgerRowInput['job'] & { job_address?: string | null }, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [job.hcp_number, job.click_number, job.job_name, job.job_address].some((v) => (v ?? '').toLowerCase().includes(q))
}

export function jobSummaryRowInStatus(row: JobSummaryEnrichedRow, status: JobSummaryStatusFilter): boolean {
  if (status === 'all') return true
  return status === 'finished' ? row.finished : !row.finished
}

/** In the window when it has approved hours there, or its last work / creation date falls inside it. */
export function jobSummaryRowInWindow(row: JobSummaryEnrichedRow, window: JobSummaryWindowKey, startYmd: string, endYmd: string): boolean {
  if (window === 'all') return true
  if (row.hoursInWindow > 0) return true
  const d = row.lastWorkedYmd
  return d != null && d >= startYmd && d <= endYmd
}

function hcpSortValue(job: JobSummaryLedgerRowInput['job']): string {
  return (job.hcp_number ?? '').trim()
}

function sortValue(row: JobSummaryEnrichedRow, key: JobSummarySortKey): number | null {
  switch (key) {
    case 'revenue':
      return row.revenueUsd
    case 'labor':
      return row.laborUsd
    case 'subs':
      return row.subsUsd
    case 'parts':
      return row.partsUsd
    case 'gross':
      return row.grossUsd
    case 'margin':
      return row.marginPct
    case 'hours':
      return row.hoursInWindow
    case 'overhead':
      return row.overheadUsd
    case 'trueProfit':
      return row.trueProfitUsd
    case 'trueMargin':
      return row.trueMarginPct
    case 'revPerHour':
      return row.revenuePerHourUsd
    case 'pct':
      return row.pct
    default:
      return null
  }
}

/** Nulls sink to the bottom in either direction; 'job' is numeric-aware on the HCP #, blank HCPs first (the memo's original rule). */
export function sortJobSummaryRows<R extends JobSummaryLedgerRowInput>(
  rows: readonly JobSummaryEnrichedRow<R>[],
  sortKey: JobSummarySortKey,
  sortDir: JobSummarySortDir,
): JobSummaryEnrichedRow<R>[] {
  const dir = sortDir === 'asc' ? 1 : -1
  const out = [...rows]
  if (sortKey === 'job') {
    out.sort((a, b) => {
      const ha = hcpSortValue(a.row.job)
      const hb = hcpSortValue(b.row.job)
      if (!ha !== !hb) return !ha ? -1 : 1
      return dir * ha.localeCompare(hb, undefined, { numeric: true })
    })
    return out
  }
  out.sort((a, b) => {
    const va = sortValue(a, sortKey)
    const vb = sortValue(b, sortKey)
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    if (va === vb) return -hcpSortValue(a.row.job).localeCompare(hcpSortValue(b.row.job), undefined, { numeric: true })
    return dir * (va - vb)
  })
  return out
}

export function filterAndSortJobSummaryRows<R extends JobSummaryLedgerRowInput & { job: { job_address?: string | null } }>(args: {
  rows: readonly JobSummaryEnrichedRow<R>[]
  prefs: JobSummaryViewPrefs
  search: string
  startYmd: string
  endYmd: string
}): JobSummaryEnrichedRow<R>[] {
  const { rows, prefs, search, startYmd, endYmd } = args
  const visible = rows.filter(
    (r) => jobSummaryRowMatchesSearch(r.row.job, search) && jobSummaryRowInStatus(r, prefs.status) && jobSummaryRowInWindow(r, prefs.window, startYmd, endYmd),
  )
  return sortJobSummaryRows(visible, prefs.sortKey, prefs.sortDir)
}

export type JobSummaryTotals = {
  jobs: number
  revenueUsd: number
  laborUsd: number
  subsUsd: number
  partsUsd: number
  grossUsd: number
  marginPct: number | null
  hours: number
  /** Null until every visible row has an overhead figure. */
  overheadUsd: number | null
  trueProfitUsd: number | null
  trueMarginPct: number | null
  truePerHourUsd: number | null
  /** Revenue ÷ field hours over the rows (v2.2820). */
  revenuePerHourUsd: number | null
  noRevenueJobs: number
  noPctJobs: number
  noHoursJobs: number
  priorHoursJobs: number
  earnedRows: number
}

export function summarizeJobSummaryRows(rows: readonly JobSummaryEnrichedRow[]): JobSummaryTotals {
  let revenueUsd = 0
  let laborUsd = 0
  let subsUsd = 0
  let partsUsd = 0
  let grossUsd = 0
  let hours = 0
  let overheadUsd = 0
  let overheadKnown = true
  let noRevenueJobs = 0
  let noPctJobs = 0
  let noHoursJobs = 0
  let priorHoursJobs = 0
  let earnedRows = 0
  for (const r of rows) {
    revenueUsd += r.revenueUsd
    laborUsd += r.laborUsd
    subsUsd += r.subsUsd
    partsUsd += r.partsUsd
    grossUsd += r.grossUsd
    hours += r.hoursInWindow
    if (r.overheadUsd == null) overheadKnown = false
    else overheadUsd += r.overheadUsd
    if (r.flags.includes('no-revenue')) noRevenueJobs += 1
    if (r.flags.includes('no-pct')) noPctJobs += 1
    if (r.flags.includes('no-hours')) noHoursJobs += 1
    if (r.flags.includes('prior-hours')) priorHoursJobs += 1
    if (r.flags.includes('earned')) earnedRows += 1
  }
  const trueProfitUsd = overheadKnown && rows.length > 0 ? grossUsd - overheadUsd : null
  return {
    jobs: rows.length,
    revenueUsd,
    laborUsd,
    subsUsd,
    partsUsd,
    grossUsd,
    marginPct: revenueUsd > 0 ? (grossUsd / revenueUsd) * 100 : null,
    hours,
    overheadUsd: overheadKnown && rows.length > 0 ? overheadUsd : null,
    trueProfitUsd,
    trueMarginPct: trueProfitUsd == null || !(revenueUsd > 0) ? null : (trueProfitUsd / revenueUsd) * 100,
    truePerHourUsd: trueProfitUsd == null || !(hours > 0) ? null : trueProfitUsd / hours,
    revenuePerHourUsd: hours > 0 ? revenueUsd / hours : null,
    noRevenueJobs,
    noPctJobs,
    noHoursJobs,
    priorHoursJobs,
    earnedRows,
  }
}

export type JobSummaryHygiene = {
  unallocatedUsd: number
  unallocatedDays: number
  pendingFieldSessions: number
  pendingFieldHours: number
}

export function jobSummaryHygiene(ledger: JobDayLedger | null): JobSummaryHygiene | null {
  if (!ledger) return null
  const un = unallocatedJobDayOverhead(ledger)
  return { unallocatedUsd: un.usd, unallocatedDays: un.days, pendingFieldSessions: ledger.pendingFieldSessions, pendingFieldHours: ledger.pendingFieldHours }
}

// ---- Cut by (v2.2820) ----

export type JobSummaryCutContext = {
  /** master_user_id → display name (the page's users list). */
  userNameById?: ReadonlyMap<string, string | null | undefined>
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The group a row falls in for the chosen cut: a stable key and a label to show. */
export function jobSummaryCutKey(job: JobSummaryLedgerRowInput['job'], cutBy: JobSummaryCutBy, ctx: JobSummaryCutContext = {}): { key: string; label: string } {
  const named = (id: string | null | undefined, name: string | null | undefined, none: string) =>
    id || name ? { key: id ?? `name:${name}`, label: (name ?? '').trim() || '(unnamed)' } : { key: '__none', label: none }
  switch (cutBy) {
    case 'gc':
      return named(job.gc_customer_id, job.gcCustomer?.name, 'No GC (direct)')
    case 'trade':
      return named(job.service_type_id, job.serviceType?.name, 'No service type')
    case 'tech': {
      const id = job.master_user_id ?? null
      return named(id, id ? ctx.userNameById?.get(id) ?? id.slice(0, 8) : null, 'No lead tech')
    }
    case 'accountManager':
      return named(job.account_manager_user_id, job.account_manager?.name, 'No Account Man')
    case 'customer':
      return named(job.customer_id ?? (job.customer_name ? null : undefined), job.customer_name, 'No customer')
    case 'development':
      return named(job.development_id, job.development?.name, 'No development')
    case 'billMonth': {
      const d = job.last_bill_date?.slice(0, 10)
      if (!d) return { key: '__none', label: 'Not billed yet' }
      return { key: d.slice(0, 7), label: `${MONTHS[Number(d.slice(5, 7)) - 1] ?? d.slice(5, 7)} ${d.slice(0, 4)}` }
    }
    default:
      return { key: '__all', label: 'All jobs' }
  }
}

export type JobSummaryGroup<R extends JobSummaryLedgerRowInput = JobSummaryLedgerRowInput> = {
  key: string
  label: string
  rows: JobSummaryEnrichedRow<R>[]
  totals: JobSummaryTotals
}

/**
 * Rows grouped by the cut, each group subtotaled, groups ranked by true profit
 * (unknown last, then revenue). The "none" bucket sorts with the rest — a set
 * of jobs with no GC is a finding, not a footnote. Rows inside keep their order.
 */
export function groupJobSummaryRows<R extends JobSummaryLedgerRowInput>(rows: readonly JobSummaryEnrichedRow<R>[], cutBy: JobSummaryCutBy, ctx: JobSummaryCutContext = {}): JobSummaryGroup<R>[] {
  if (cutBy === 'none') return []
  const byKey = new Map<string, { label: string; rows: JobSummaryEnrichedRow<R>[] }>()
  for (const r of rows) {
    const { key, label } = jobSummaryCutKey(r.row.job, cutBy, ctx)
    const g = byKey.get(key) ?? byKey.set(key, { label, rows: [] }).get(key)!
    g.rows.push(r)
  }
  const groups: JobSummaryGroup<R>[] = [...byKey.entries()].map(([key, g]) => ({ key, label: g.label, rows: g.rows, totals: summarizeJobSummaryRows(g.rows) }))
  groups.sort((a, b) => {
    const ta = a.totals.trueProfitUsd
    const tb = b.totals.trueProfitUsd
    if (ta == null && tb == null) return b.totals.revenueUsd - a.totals.revenueUsd
    if (ta == null) return 1
    if (tb == null) return -1
    return tb - ta || b.totals.revenueUsd - a.totals.revenueUsd
  })
  return groups
}

export type JobSummaryConcentration = { top: number; sharePct: number | null; labels: string[] }

/** What share of the window's positive true profit the top N groups hold (v2.2820). */
export function jobSummaryConcentration(groups: readonly JobSummaryGroup[], top = 3): JobSummaryConcentration {
  const positives = groups.map((g) => Math.max(0, g.totals.trueProfitUsd ?? 0))
  const total = positives.reduce((a, b) => a + b, 0)
  const head = groups.slice(0, top)
  const headSum = head.reduce((a, g) => a + Math.max(0, g.totals.trueProfitUsd ?? 0), 0)
  return { top: head.length, sharePct: total > 0 && groups.length > top ? (headSum / total) * 100 : null, labels: head.map((g) => g.label) }
}
