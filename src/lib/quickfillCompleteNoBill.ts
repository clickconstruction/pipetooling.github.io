/**
 * Quickfill "Complete, no Total Bill": non-paid jobs resolved 100% complete (same resolution as
 * the Job Summary % column) whose bill is not filled in. Since v2.6750 (punch list #176, decision 4)
 * the hidden Jobs Billing station's three checks live here, on the finished jobs alone: no **Total
 * Bill** (`jobs_ledger.revenue` unset or $0), no **Specific Work** line (a fixture with a name and a
 * count) and no **Other job charges** (a material with an amount). Each row says which it lacks. The
 * first two list a job, since a bill with no total or no work lines cannot go out; the third is a note
 * on a listed row: the walk of 2026-11-08 found 40 finished jobs reading it alone, pre-tests, post
 * tests and service visits with nothing to charge beyond the work, a standing backlog the round does
 * not need. Pure — no React/supabase.
 */
import { jobSummaryPaidInvoiceOpts, resolveJobSummaryPercentComplete } from './jobSummaryPercentComplete'
import { effectiveJobLedgerNumber } from './ledgerDisplayPrefixes'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'

/** What a finished job's bill lacks, worst first: the total, then the work lines, then the charges. */
export type CompleteBillGap = 'total' | 'work' | 'charges'
export const COMPLETE_BILL_GAP_ORDER: readonly CompleteBillGap[] = ['total', 'work', 'charges']
/** The chip on a row, the field's own name. */
export const COMPLETE_BILL_GAP_WORDS: Readonly<Record<CompleteBillGap, string>> = {
  total: 'no Total Bill',
  work: 'no Specific Work',
  charges: 'no Other job charges',
}

/** A gap that puts a finished job on the list; `charges` alone does not. */
export function completeBillListed(gaps: ReadonlyArray<CompleteBillGap>): boolean {
  return gaps.some((g) => g === 'total' || g === 'work')
}

export type QuickfillCompleteNoBillJobShape = {
  id: string
  status: string
  revenue: number | null
  hcp_number: string | null
  /** The Click number a job has when it has no HCP number; the rows sort and read by the one it shows. */
  click_number?: string | null
  pct_complete: number | null
  invoices: Array<{ status: string | null; amount: number | null }>
  /** The Jobs Billing tab's Specific Work lines; the jobs cache fills them once its enrichment lands. */
  fixtures?: Array<{ name: string | null; count: number | string | null }>
  /** The Jobs Billing tab's Other job charges. */
  materials?: Array<{ amount: number | string | null }>
}

export function jobHasNoTotalBill(revenue: number | null | undefined): boolean {
  return revenue == null || Number(revenue) === 0
}

/** A Specific Work line is a fixture with a name and a count above zero, as the Jobs Billing station read it. */
export function jobHasSpecificWork(fixtures: ReadonlyArray<{ name: string | null; count: number | string | null }> | undefined): boolean {
  return (fixtures ?? []).some((f) => (f.name ?? '').trim() !== '' && Number(f.count) > 0)
}

/** An Other job charge is a material line with an amount that is not zero. */
export function jobHasOtherCharges(materials: ReadonlyArray<{ amount: number | string | null }> | undefined): boolean {
  return (materials ?? []).some((m) => {
    const n = Number(m.amount)
    return Number.isFinite(n) && n !== 0
  })
}

/**
 * The three checks on one job, worst first. `billLinesKnown` false means the jobs cache has not laid its
 * fixtures and materials over the rows yet, so only the Total Bill is judged; an empty list then is not a
 * clean bill, it is a bill not yet read.
 */
export function completeBillGaps(job: Pick<QuickfillCompleteNoBillJobShape, 'revenue' | 'fixtures' | 'materials'>, billLinesKnown = true): CompleteBillGap[] {
  const gaps: CompleteBillGap[] = []
  if (jobHasNoTotalBill(job.revenue)) gaps.push('total')
  if (billLinesKnown) {
    if (!jobHasSpecificWork(job.fixtures)) gaps.push('work')
    if (!jobHasOtherCharges(job.materials)) gaps.push('charges')
  }
  return gaps
}

/** Candidates worth resolving a report % for: non-paid, a listing gap on the bill (no Total Bill or no
 * Specific Work), HCP # at or above the org threshold (the `parseInt(hcp_number) >= min` rule the Jobs
 * Billing station set — hides old imports; jobs with a non-numeric HCP # are kept). */
export function quickfillCompleteNoBillCandidates<T extends QuickfillCompleteNoBillJobShape>(
  jobs: T[],
  minHcpNumber: number,
  billLinesKnown = true,
): T[] {
  return jobs.filter((j) => {
    if (j.status === 'paid' || !completeBillListed(completeBillGaps(j, billLinesKnown))) return false
    const hcp = parseInt(j.hcp_number ?? '', 10)
    return !Number.isFinite(hcp) || hcp >= minHcpNumber
  })
}

export type CompleteNoBillRow<T> = { job: T; gaps: CompleteBillGap[] }

/** The number the row shows: the HCP number, else the Click number (`effectiveJobLedgerNumber`). */
export function completeNoBillJobNumber(job: Pick<QuickfillCompleteNoBillJobShape, 'hcp_number' | 'click_number'>): string {
  return effectiveJobLedgerNumber(job.hcp_number, job.click_number)
}

function numberOrder(a: Pick<QuickfillCompleteNoBillJobShape, 'hcp_number' | 'click_number'>, b: Pick<QuickfillCompleteNoBillJobShape, 'hcp_number' | 'click_number'>): number {
  return completeNoBillJobNumber(a).localeCompare(completeNoBillJobNumber(b), undefined, { numeric: true })
}

/**
 * The station's rows: candidates whose resolved percent is 100, each with what its bill lacks (the
 * charges note included); a job with no Total Bill first, then the lowest number as the row shows it. A
 * candidate with no Total Bill keeps the paid-invoices branch's old "fully collected ⇒ done" meaning —
 * there is no contract to cover.
 */
export function completeNoBillRows<T extends QuickfillCompleteNoBillJobShape>(
  jobs: T[],
  reportPctByJobId: Map<string, number>,
  minHcpNumber: number,
  billLinesKnown = true,
): CompleteNoBillRow<T>[] {
  return quickfillCompleteNoBillCandidates(jobs, minHcpNumber, billLinesKnown)
    .filter((j) => resolveJobSummaryPercentComplete(reportPctByJobId.get(j.id) ?? null, j.pct_complete, jobSummaryPaidInvoiceOpts(j.invoices, j.revenue)) === 100)
    .map((job) => ({ job, gaps: completeBillGaps(job, billLinesKnown) }))
    .sort((a, b) => COMPLETE_BILL_GAP_ORDER.indexOf(a.gaps[0]!) - COMPLETE_BILL_GAP_ORDER.indexOf(b.gaps[0]!) || numberOrder(a.job, b.job))
}

/** The rows' jobs alone, in the rows' order. */
export function buildQuickfillCompleteNoBillList<T extends QuickfillCompleteNoBillJobShape>(
  jobs: T[],
  reportPctByJobId: Map<string, number>,
  minHcpNumber: number,
  billLinesKnown = true,
): T[] {
  return completeNoBillRows(jobs, reportPctByJobId, minHcpNumber, billLinesKnown).map((r) => r.job)
}

/** Per-job clock rollup for the section's inline rows. */
export type QuickfillJobClockSummary = {
  /** Earliest clock-in on the job — the "started" date. */
  firstClockInAt: string | null
  sessionCount: number
  /** Closed sessions only. */
  totalHours: number
  /** Distinct YYYY-MM-DD work dates, ascending (work_date, else the clock-in date). */
  workDates: string[]
  hasOpenSession: boolean
}

/** Roll multi-job `clock_sessions` rows (non-rejected, non-revoked) into per-job summaries. */
export function buildJobClockSummaries(
  rows: Array<{
    job_ledger_id: string | null
    clocked_in_at: string | null
    clocked_out_at: string | null
    work_date: string | null
  }>,
): Map<string, QuickfillJobClockSummary> {
  const byJob = new Map<string, QuickfillJobClockSummary & { dateSet: Set<string> }>()
  for (const r of rows) {
    if (!r.job_ledger_id) continue
    let s = byJob.get(r.job_ledger_id)
    if (!s) {
      s = {
        firstClockInAt: null,
        sessionCount: 0,
        totalHours: 0,
        workDates: [],
        hasOpenSession: false,
        dateSet: new Set<string>(),
      }
      byJob.set(r.job_ledger_id, s)
    }
    s.sessionCount += 1
    if (r.clocked_in_at && (!s.firstClockInAt || r.clocked_in_at < s.firstClockInAt)) {
      s.firstClockInAt = r.clocked_in_at
    }
    if (r.clocked_in_at && r.clocked_out_at) {
      const ms = Date.parse(r.clocked_out_at) - Date.parse(r.clocked_in_at)
      if (Number.isFinite(ms) && ms > 0) s.totalHours += ms / 3_600_000
    } else if (r.clocked_in_at && !r.clocked_out_at) {
      s.hasOpenSession = true
    }
    const d = (r.work_date ?? '').slice(0, 10) || calendarYmdInAppTzFromIso(r.clocked_in_at ?? '')
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) s.dateSet.add(d)
  }
  const out = new Map<string, QuickfillJobClockSummary>()
  for (const [jobId, s] of byJob) {
    const { dateSet, ...summary } = s
    out.set(jobId, { ...summary, workDates: [...dateSet].sort() })
  }
  return out
}
