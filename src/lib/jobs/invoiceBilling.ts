import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { buildBilledStageRows, jobInCollections, stagesMergedBillingInvoiceId, type StageRow } from '../jobsStagesBoard'
import { calendarDaysSinceDateUtc, formatYmdOrIsoDateForPrintDisplay } from './jobFormatting'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/** Per-invoice est. bill date when set; else job-level manual last bill date (`last_bill_date`). */
export function effectiveInvoiceEstBillDate(inv: JobsLedgerInvoice, job: JobWithDetails): string | null {
  return inv.estimated_bill_date ?? job.last_bill_date ?? null
}

export function sumInvoiceAppliedFromJobPayments(job: JobWithDetails, invoiceId: string): number {
  let s = 0
  for (const p of job.payments ?? []) {
    if (p.invoice_id === invoiceId) s += Number(p.amount ?? 0)
  }
  return s
}

export function invoiceOpenRemainingOnJob(inv: JobsLedgerInvoice, job: JobWithDetails): number {
  const applied = sumInvoiceAppliedFromJobPayments(job, inv.id)
  return Math.max(0, Number(inv.amount ?? 0) - applied)
}

/**
 * Dollars invoiced but not yet paid: open remainder summed across this job's
 * SENT invoices (status='billed'). Ready-to-bill drafts are excluded — they're
 * not yet a bill the customer has received (they're the "unallocated" remainder).
 * Feeds the Stages Progress & payment bar's blue "Billed" segment.
 */
export function jobBilledUnpaidDollars(job: JobWithDetails): number {
  let s = 0
  for (const inv of job.invoices ?? []) {
    if (inv.status === 'billed') s += invoiceOpenRemainingOnJob(inv, job)
  }
  return s
}

export function stageRowBilledRemainingAmount(r: StageRow): number {
  if (r.kind === 'job') {
    return Number(r.job.revenue ?? 0) - Number(r.job.payments_made ?? 0)
  }
  return invoiceOpenRemainingOnJob(r.inv, r.job)
}

export function stageRowBilledAgeDays(r: StageRow, now = new Date()): number | null {
  const iso =
    r.kind === 'job'
      ? r.job.last_bill_date ?? null
      : effectiveInvoiceEstBillDate(r.inv, r.job)
  if (!iso) return null
  const days = calendarDaysSinceDateUtc(iso, now)
  if (days < 0) return null
  return days
}

export function stageRowBilledLineLabel(r: StageRow): string {
  const hcp = effectiveJobLedgerNumber(r.job.hcp_number, r.job.click_number) || '—'
  if (r.kind === 'job') return `${hcp} · Job balance`
  if (r.kind === 'job_with_merged_billed') return `${hcp} · Billed line`
  return `${hcp} · Invoice #${r.inv.sequence_order}`
}

export function sortStageRowsForTotalByNameDetail(rows: StageRow[]): StageRow[] {
  return [...rows].sort((a, b) => {
    const da = stageRowBilledAgeDays(a)
    const db = stageRowBilledAgeDays(b)
    if (da != null && db != null && da !== db) return db - da
    if (da != null && db == null) return -1
    if (da == null && db != null) return 1
    return stageRowBilledRemainingAmount(b) - stageRowBilledRemainingAmount(a)
  })
}

/** Reference date and whole calendar days since, for Billed Awaiting Payment printout. */
export function printBilledRowReferenceDate(
  r: StageRow,
  now = new Date(),
): { display: string; ageDays: number | null } {
  if (r.kind === 'job') {
    const iso = r.job.last_bill_date?.trim() ?? null
    if (!iso) return { display: '—', ageDays: null }
    const days = calendarDaysSinceDateUtc(iso, now)
    if (days < 0) return { display: formatYmdOrIsoDateForPrintDisplay(iso), ageDays: null }
    return { display: formatYmdOrIsoDateForPrintDisplay(iso), ageDays: days }
  }
  const billedAt = r.inv.billed_at?.trim()
  if (billedAt) {
    const datePart = billedAt.length >= 10 ? billedAt.slice(0, 10) : billedAt
    const days = calendarDaysSinceDateUtc(datePart, now)
    const display = formatYmdOrIsoDateForPrintDisplay(datePart)
    if (days < 0) return { display, ageDays: null }
    return { display, ageDays: days }
  }
  const est = effectiveInvoiceEstBillDate(r.inv, r.job)
  if (!est) return { display: '—', ageDays: null }
  const days = calendarDaysSinceDateUtc(est, now)
  const display = `${formatYmdOrIsoDateForPrintDisplay(est)} (est.)`
  if (days < 0) return { display, ageDays: null }
  return { display, ageDays: days }
}

/** Stages jump chips: open RTB / billed billing lines only, same rows as the board. */
export function jobStagesActiveBillingInvoices(job: JobWithDetails): JobsLedgerInvoice[] {
  return (job.invoices ?? [])
    .filter((i) => i.status === 'ready_to_bill' || i.status === 'billed')
    .slice()
    .sort((a, b) => a.sequence_order - b.sequence_order)
}

/** Jump targets: standalone invoice rows only (omit line merged into the job shell on Stages). */
export function jobStagesInvoiceJumpChipTargets(job: JobWithDetails): JobsLedgerInvoice[] {
  const all = jobStagesActiveBillingInvoices(job)
  const merged = stagesMergedBillingInvoiceId(job)
  if (merged == null) return all
  return all.filter((i) => i.id !== merged)
}

/** Stages Last activity: one billed Stripe line with recorded customer email only (skip when ambiguous). */
export function stagesJobLevelStripeEmailedHintInvoice(job: JobWithDetails): JobsLedgerInvoice | undefined {
  const matches = (job.invoices ?? []).filter(
    (i) =>
      i.status === 'billed' &&
      i.external_send_channel === 'stripe' &&
      String(i.stripe_invoice_id ?? '').trim() !== '' &&
      i.sent_to_customer_at != null &&
      String(i.sent_to_customer_at).trim() !== '',
  )
  if (matches.length !== 1) return undefined
  return matches[0]
}

export type BilledAgingBuckets = { count30_90: number; sum30_90: number; count90: number; sum90: number }

/**
 * Billed Awaiting Payment aging chips: 30/90-day buckets over positive
 * remainders (Collections jobs excluded — the chips describe the Billed
 * section only). Extracted verbatim from the Jobs.tsx `billedAgingBuckets`
 * memo (Stage A, step 8 of the decomposition).
 */
export function buildBilledAgingBuckets(stagesFilteredJobs: JobWithDetails[], now = new Date()): BilledAgingBuckets {
  const st = (j: JobWithDetails) => (j.status ?? 'working') as string
  const filtered = stagesFilteredJobs.filter((j) => !jobInCollections(j))
  const billedJobsList = filtered.filter((j) => st(j) === 'billed')
  const billedInvoicesList = filtered.flatMap((j) =>
    (j.invoices ?? []).filter((i) => i.status === 'billed').map((inv) => ({ ...inv, job: j })),
  )
  const billedRowsAging = buildBilledStageRows(billedJobsList, billedInvoicesList)
  let count30_90 = 0
  let sum30_90 = 0
  let count90 = 0
  let sum90 = 0
  for (const r of billedRowsAging) {
    const iso =
      r.kind === 'job' ? r.job.last_bill_date ?? null : effectiveInvoiceEstBillDate(r.inv, r.job)
    if (!iso) continue
    const days = calendarDaysSinceDateUtc(iso, now)
    if (days < 30) continue
    const amount = stageRowBilledRemainingAmount(r)
    if (amount <= 0) continue
    if (days < 90) {
      count30_90++
      sum30_90 += amount
    } else {
      count90++
      sum90 += amount
    }
  }
  return { count30_90, sum30_90, count90, sum90 }
}
