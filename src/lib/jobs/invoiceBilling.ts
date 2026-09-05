import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { buildBilledStageRows, jobInCollections, stagesMergedBillingInvoiceId, type StageRow } from '../jobsStagesBoard'
import { calendarDaysSinceDateUtc, formatYmdOrIsoDateForPrintDisplay } from './jobFormatting'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { billOnOpenJob, openRemainder } from '../billing/billTruth'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/** Per-invoice est. bill date when set (the manual job-level fallback retired in v2.1154). */
export function effectiveInvoiceEstBillDate(inv: JobsLedgerInvoice): string | null {
  return inv.estimated_bill_date ?? null
}

export function sumInvoiceAppliedFromJobPayments(job: JobWithDetails, invoiceId: string): number {
  let s = 0
  for (const p of job.payments ?? []) {
    if (p.invoice_id === invoiceId) s += Number(p.amount ?? 0)
  }
  return s
}

export function invoiceOpenRemainingOnJob(inv: JobsLedgerInvoice, job: JobWithDetails): number {
  return openRemainder(inv.amount, sumInvoiceAppliedFromJobPayments(job, inv.id))
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

/**
 * Open remainder on one Billed row — the bill-truth kernel's clamp
 * (`openRemainder`, v2.2862): shell rows are `max(0, revenue −
 * payments_made)`, invoice rows net their linked payments. Before this the
 * shell arm here was UNCLAMPED while `jobsStagesBoard.billedStageRowRemainingAmount`
 * clamped, so an over-paid billed shell lowered the strip total but not the
 * AR card (BILLING_FLOWS "Optimization candidates" #1, journey J34-N6).
 */
export function stageRowBilledRemainingAmount(r: StageRow): number {
  if (r.kind === 'job') {
    return openRemainder(r.job.revenue, r.job.payments_made)
  }
  return invoiceOpenRemainingOnJob(r.inv, r.job)
}

/**
 * The Billed aging clock's reference date (v2.2130). Two sources, one rule:
 * a hand-set est. bill date wins (it exists to correct the date — bills
 * entered after the fact, backdated lines), otherwise the `billed_at` the DB
 * trigger stamped when the line became billed (its Chicago calendar day).
 * Job-shell rows (billed job, no bill line) have neither and can't age.
 * Every age on the board — Who owes what, the 30+/90+ chips, the money card's
 * age bar, the "Chase the 90+ tail" move — reads this one function.
 */
export function stageRowBilledAgeReference(r: StageRow): { ymd: string; handSet: boolean } | null {
  if (r.kind === 'job') return null
  const est = effectiveInvoiceEstBillDate(r.inv)
  if (est) return { ymd: est, handSet: true }
  const billedAt = r.inv.billed_at?.trim()
  if (!billedAt) return null
  const ymd = calendarYmdInAppTzFromIso(billedAt)
  return ymd ? { ymd, handSet: false } : null
}

export function stageRowBilledAgeDays(r: StageRow, now = new Date()): number | null {
  const ref = stageRowBilledAgeReference(r)
  if (!ref) return null
  const days = calendarDaysSinceDateUtc(ref.ymd, now)
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
  if (r.kind === 'job') return { display: '—', ageDays: null }
  const billedAt = r.inv.billed_at?.trim()
  if (billedAt) {
    const datePart = billedAt.length >= 10 ? billedAt.slice(0, 10) : billedAt
    const days = calendarDaysSinceDateUtc(datePart, now)
    const display = formatYmdOrIsoDateForPrintDisplay(datePart)
    if (days < 0) return { display, ageDays: null }
    return { display, ageDays: days }
  }
  const est = effectiveInvoiceEstBillDate(r.inv)
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

export type BilledAgingBucketKey = '30_90' | '90'

/**
 * Which aging bucket a billed stage row belongs to, or null when it doesn't
 * age (job-shell rows without an invoice date, rows under 30 days, or rows
 * with nothing left to pay). Single source of truth for BOTH the header
 * chips' totals and the chip-click section filter (v2.1311) — the exact rule
 * the buildBilledAgingBuckets loop has always applied.
 */
export function billedStageRowAgingBucket(row: StageRow, now = new Date()): BilledAgingBucketKey | null {
  const days = stageRowBilledAgeDays(row, now)
  if (days == null || days < 30) return null
  if (stageRowBilledRemainingAmount(row) <= 0) return null
  return days < 90 ? '30_90' : '90'
}

/**
 * Billed Awaiting Payment aging chips: 30/90-day buckets over positive
 * remainders (Collections jobs excluded — the chips describe the Billed
 * section only). Extracted verbatim from the Jobs.tsx `billedAgingBuckets`
 * memo (Stage A, step 8 of the decomposition).
 */
/**
 * Billed rows that can never age or be chased: positive remainder but no
 * billed_at and no est. bill date (job-shell rows included). Feeds the
 * Pipeline money card's "fix dates" money move; Collections excluded to match
 * the aging chips' cohort.
 */
/**
 * Row-level "can never age or be chased" rule: open money on a job-shell row
 * (a billed job with NO billed invoice line — in practice all of them: the
 * billed_at trigger keeps invoice rows dated) or on an invoice row missing
 * both billed_at and an est. bill date. Callers filter out zero-open rows
 * themselves where that matters.
 */
export function billedStageRowHasNoBillLine(r: StageRow): boolean {
  if (r.kind === 'job') return true
  return !r.inv.billed_at?.trim() && effectiveInvoiceEstBillDate(r.inv) == null
}

/** Count + open dollars of the no-bill-line cohort among the board's billed rows (the "No line" chip). */
export function buildBilledNoLineBucket(rows: StageRow[]): { count: number; sum: number } {
  let count = 0
  let sum = 0
  for (const r of rows) {
    const open = stageRowBilledRemainingAmount(r)
    if (open <= 0) continue
    if (!billedStageRowHasNoBillLine(r)) continue
    count++
    sum += open
  }
  return { count, sum }
}

export function countBilledRowsMissingDates(stagesFilteredJobs: JobWithDetails[]): number {
  const st = (j: JobWithDetails) => (j.status ?? 'working') as string
  // bill-truth membership: a billed line on a paid job is not an open bill
  const filtered = stagesFilteredJobs.filter((j) => !jobInCollections(j) && billOnOpenJob(j.status))
  const billedJobsList = filtered.filter((j) => st(j) === 'billed')
  const billedInvoicesList = filtered.flatMap((j) =>
    (j.invoices ?? []).filter((i) => i.status === 'billed').map((inv) => ({ ...inv, job: j })),
  )
  return buildBilledNoLineBucket(buildBilledStageRows(billedJobsList, billedInvoicesList)).count
}

export function buildBilledAgingBuckets(stagesFilteredJobs: JobWithDetails[], now = new Date()): BilledAgingBuckets {
  const st = (j: JobWithDetails) => (j.status ?? 'working') as string
  // bill-truth membership: a billed line on a paid job is not an open bill
  const filtered = stagesFilteredJobs.filter((j) => !jobInCollections(j) && billOnOpenJob(j.status))
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
    const bucket = billedStageRowAgingBucket(r, now)
    if (bucket == null) continue
    const amount = stageRowBilledRemainingAmount(r)
    if (bucket === '30_90') {
      count30_90++
      sum30_90 += amount
    } else {
      count90++
      sum90 += amount
    }
  }
  return { count30_90, sum30_90, count90, sum90 }
}
