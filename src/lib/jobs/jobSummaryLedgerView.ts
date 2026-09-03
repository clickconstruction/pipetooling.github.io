import { resolveJobSummaryPercentComplete, jobInvoicesAllPaidWithAmount } from '../jobSummaryPercentComplete'
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
  | 'pct'
export type JobSummarySortDir = 'asc' | 'desc'

/** Jobs = the ledger table; Days = jobs carried per day (v2.2695); Timeline = jobs running at once, over time (v2.2711). */
export type JobSummaryViewMode = 'jobs' | 'days' | 'timeline'

export type JobSummaryViewPrefs = {
  view: JobSummaryViewMode
  status: JobSummaryStatusFilter
  window: JobSummaryWindowKey
  method: JobOverheadMethod
  sortKey: JobSummarySortKey
  sortDir: JobSummarySortDir
}

export const JOB_SUMMARY_VIEW_STORAGE_KEY = 'jobs_jobSummary_view_v1'

export const JOB_SUMMARY_VIEW_DEFAULTS: JobSummaryViewPrefs = {
  view: 'jobs',
  status: 'finished',
  window: 'ytd',
  method: 'day',
  sortKey: 'trueProfit',
  sortDir: 'desc',
}

export const JOB_SUMMARY_VIEW_MODE_OPTIONS: ReadonlyArray<{ key: JobSummaryViewMode; label: string; title: string }> = [
  { key: 'jobs', label: 'Jobs', title: 'One row per job — costs, overhead share, true profit' },
  { key: 'days', label: 'Days', title: 'One row per day — how many jobs the crew carried, and what a job-day of overhead cost' },
  { key: 'timeline', label: 'Timeline', title: 'How many jobs were running at once, over time — every job as a bar from start to finish' },
]

const STATUS_KEYS: readonly JobSummaryStatusFilter[] = ['finished', 'in_progress', 'all']
const WINDOW_KEYS: readonly JobSummaryWindowKey[] = ['90d', '6mo', 'ytd', '12mo', 'all']
const METHOD_KEYS: readonly JobOverheadMethod[] = ['day', 'A', 'B', 'C']
const SORT_KEYS: readonly JobSummarySortKey[] = ['job', 'revenue', 'labor', 'subs', 'parts', 'gross', 'margin', 'hours', 'overhead', 'trueProfit', 'trueMargin', 'pct']

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
      view: p.view === 'days' || p.view === 'timeline' ? p.view : 'jobs',
      status: STATUS_KEYS.includes(p.status as JobSummaryStatusFilter) ? (p.status as JobSummaryStatusFilter) : JOB_SUMMARY_VIEW_DEFAULTS.status,
      window: WINDOW_KEYS.includes(p.window as JobSummaryWindowKey) ? (p.window as JobSummaryWindowKey) : JOB_SUMMARY_VIEW_DEFAULTS.window,
      method: METHOD_KEYS.includes(p.method as JobOverheadMethod) ? (p.method as JobOverheadMethod) : JOB_SUMMARY_VIEW_DEFAULTS.method,
      sortKey: SORT_KEYS.includes(p.sortKey as JobSummarySortKey) ? (p.sortKey as JobSummarySortKey) : JOB_SUMMARY_VIEW_DEFAULTS.sortKey,
      sortDir: p.sortDir === 'asc' || p.sortDir === 'desc' ? p.sortDir : JOB_SUMMARY_VIEW_DEFAULTS.sortDir,
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

/** The structural slice of a `JobSummaryRow` the view needs (keeps the kernel free of component types). */
export type JobSummaryLedgerRowInput = {
  job: {
    id: string
    hcp_number: string | null
    click_number?: string | null
    job_name: string | null
    pct_complete: number | null
    invoices?: Array<{ status: string | null; amount: number | null }> | null
    last_work_date?: string | null
    created_at?: string | null
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
