import type { JobDayLedger } from './jobDayLedger'
import { ymdToDayNumber } from './jobRunningTimeline'
import type { JobSummaryEnrichedRow, JobSummaryLedgerRowInput } from './jobSummaryLedgerView'

/**
 * The Cycle view kernel (v2.2823): how long after the last field day the bill
 * went out (work → bill), how long after that it was paid (bill → paid), and
 * who is sitting open with nobody on the job (stale open). Dates come from
 * what's already on the job: the ledger's last approved field day (else the
 * job's last_work_date), the earliest invoice `billed_at`, and the latest
 * payment `paid_on` once the job is paid. Pure.
 */
export type JobCycleRow = {
  jobId: string
  number: string
  name: string
  gcLabel: string
  lastWorkYmd: string | null
  billYmd: string | null
  paidYmd: string | null
  /** Calendar days, never negative (a bill dated before the last field day reads 0). */
  workToBillDays: number | null
  billToPaidDays: number | null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ymd = (v: string | null | undefined): string | null => (v ? v.slice(0, 10) : null)
const daysBetween = (a: string, b: string): number => Math.max(0, ymdToDayNumber(b) - ymdToDayNumber(a))

export function jobNumberLabel(job: Pick<JobSummaryLedgerRowInput['job'], 'id' | 'hcp_number' | 'click_number'>): string {
  return (job.hcp_number ?? '').trim() || (job.click_number ?? '').trim() || job.id.slice(0, 8)
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

export function jobCycleRow(row: JobSummaryEnrichedRow, ledger: JobDayLedger | null): JobCycleRow {
  const job = row.row.job
  const lastWorkYmd = ledger?.jobs.get(job.id)?.lastYmd ?? ymd(job.last_work_date)
  const billed = (job.invoices ?? []).map((i) => ymd(i.billed_at)).filter((d): d is string => d != null).sort()
  const billYmd = billed[0] ?? null
  const paid = (job.payments ?? []).map((p) => ymd(p.paid_on)).filter((d): d is string => d != null).sort()
  const invoiced = (job.invoices ?? []).reduce((a, i) => a + (i.amount ?? 0), 0)
  const paidUsd = (job.payments ?? []).reduce((a, p) => a + (p.amount ?? 0), 0)
  const isPaid = job.status === 'paid' || (invoiced > 0 && paidUsd >= invoiced - 0.005)
  const paidYmd = isPaid ? (paid[paid.length - 1] ?? null) : null
  return {
    jobId: job.id,
    number: jobNumberLabel(job),
    name: (job.job_name ?? '').trim(),
    gcLabel: (job.gcCustomer?.name ?? '').trim() || (job.customer_name ?? '').trim() || 'Direct',
    lastWorkYmd,
    billYmd,
    paidYmd,
    workToBillDays: lastWorkYmd && billYmd ? daysBetween(lastWorkYmd, billYmd) : null,
    billToPaidDays: billYmd && paidYmd ? daysBetween(billYmd, paidYmd) : null,
  }
}

export function jobCycleRows(rows: readonly JobSummaryEnrichedRow[], ledger: JobDayLedger | null): JobCycleRow[] {
  return rows.map((r) => jobCycleRow(r, ledger))
}

export type JobCycleMonth = {
  ym: string
  label: string
  /** Jobs billed in the month. */
  billed: number
  medianWorkToBill: number | null
  /** Of those, paid by now. */
  paid: number
  medianBillToPaid: number | null
}

/** Medians by the month the bill went out, every month in the window. */
export function bucketJobCycleByMonth(rows: readonly JobCycleRow[], startYmd: string, endYmd: string): JobCycleMonth[] {
  const out: JobCycleMonth[] = []
  let y = Number(startYmd.slice(0, 4))
  let m = Number(startYmd.slice(5, 7))
  const endYm = endYmd.slice(0, 7)
  let guard = 0
  while (guard++ < 240) {
    const ym = `${y}-${String(m).padStart(2, '0')}`
    const inMonth = rows.filter((r) => r.billYmd?.slice(0, 7) === ym)
    out.push({
      ym,
      label: `${MONTHS[m - 1]} ${y}`,
      billed: inMonth.length,
      medianWorkToBill: median(inMonth.map((r) => r.workToBillDays).filter((d): d is number => d != null)),
      paid: inMonth.filter((r) => r.billToPaidDays != null).length,
      medianBillToPaid: median(inMonth.map((r) => r.billToPaidDays).filter((d): d is number => d != null)),
    })
    if (ym >= endYm) break
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

export type JobCycleSummary = {
  billedJobs: number
  paidJobs: number
  medianWorkToBill: number | null
  medianBillToPaid: number | null
  /** Median of last field day → paid, over jobs with both. */
  medianCycle: number | null
  slowestPayer: { label: string; medianDays: number; jobs: number } | null
  fastestPayer: { label: string; medianDays: number; jobs: number } | null
}

export function summarizeJobCycle(rows: readonly JobCycleRow[]): JobCycleSummary {
  const wtb = rows.map((r) => r.workToBillDays).filter((d): d is number => d != null)
  const btp = rows.map((r) => r.billToPaidDays).filter((d): d is number => d != null)
  const cycle = rows.filter((r) => r.lastWorkYmd && r.paidYmd).map((r) => daysBetween(r.lastWorkYmd!, r.paidYmd!))
  const byPayer = new Map<string, number[]>()
  for (const r of rows) if (r.billToPaidDays != null) (byPayer.get(r.gcLabel) ?? byPayer.set(r.gcLabel, []).get(r.gcLabel)!).push(r.billToPaidDays)
  const payers = [...byPayer.entries()]
    .filter(([, v]) => v.length >= 2)
    .map(([label, v]) => ({ label, medianDays: median(v)!, jobs: v.length }))
    .sort((a, b) => b.medianDays - a.medianDays)
  return {
    billedJobs: rows.filter((r) => r.billYmd != null).length,
    paidJobs: rows.filter((r) => r.paidYmd != null).length,
    medianWorkToBill: median(wtb),
    medianBillToPaid: median(btp),
    medianCycle: median(cycle),
    slowestPayer: payers[0] ?? null,
    fastestPayer: payers.length > 1 ? payers[payers.length - 1]! : null,
  }
}

export type StaleOpenJobInput = {
  id: string
  hcp_number: string | null
  click_number?: string | null
  job_name: string | null
  status: string | null
  last_work_date?: string | null
  created_at?: string | null
  revenue?: number | null
  master_user_id?: string | null
  gcCustomer?: { name: string | null } | null
  customer_name?: string | null
}

export type StaleOpenJob = {
  jobId: string
  number: string
  name: string
  gcLabel: string
  masterUserId: string | null
  lastWorkYmd: string | null
  idleDays: number
  contractUsd: number
}

export const STALE_OPEN_DAY_OPTIONS: ReadonlyArray<{ key: number; label: string; title: string }> = [
  { key: 14, label: '14 d', title: 'Open jobs with no field work for 14 days or more' },
  { key: 21, label: '21 d', title: 'Open jobs with no field work for 21 days or more' },
  { key: 30, label: '30 d', title: 'Open jobs with no field work for 30 days or more' },
]

/**
 * Open (not billed, not paid) jobs idle at least `minIdleDays`: today minus the
 * ledger's last approved field day, else the job's last_work_date, else its
 * creation date. Longest idle first.
 */
export function staleOpenJobs(jobs: readonly StaleOpenJobInput[], todayYmd: string, minIdleDays: number, ledger: JobDayLedger | null): StaleOpenJob[] {
  const out: StaleOpenJob[] = []
  for (const j of jobs) {
    if (j.status === 'billed' || j.status === 'paid') continue
    const lastWorkYmd = ledger?.jobs.get(j.id)?.lastYmd ?? ymd(j.last_work_date) ?? ymd(j.created_at)
    if (!lastWorkYmd) continue
    const idleDays = daysBetween(lastWorkYmd, todayYmd)
    if (idleDays < minIdleDays) continue
    out.push({
      jobId: j.id,
      number: jobNumberLabel(j),
      name: (j.job_name ?? '').trim(),
      gcLabel: (j.gcCustomer?.name ?? '').trim() || (j.customer_name ?? '').trim() || 'Direct',
      masterUserId: j.master_user_id ?? null,
      lastWorkYmd,
      idleDays,
      contractUsd: j.revenue ?? 0,
    })
  }
  return out.sort((a, b) => b.idleDays - a.idleDays || b.contractUsd - a.contractUsd)
}
