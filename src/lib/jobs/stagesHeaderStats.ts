/**
 * Stages section-header stats from LEAN rows (v2.1821, scoped-load plan PR 1).
 *
 * The plan originally called for a SQL stats RPC, but the header math runs
 * through invoice-bundling rules (`is_primary_rtb_bundle`, cents rounding,
 * merged-shell decisions) that would have to be ported to SQL and kept in
 * lockstep forever. Instead: fetch LEAN rows (a handful of columns, no embeds,
 * no second-round batches) and run the EXISTING kernels over them — parity by
 * construction, no migration. `computeStagesHeaderStats` is the single source
 * for every header figure; the board's own header render switches to it in
 * plan PR 3 so the full-row path and the lean path can never disagree.
 */
import type { JobWithDetails } from '../../types/jobWithDetails'
import {
  buildJobsStagesBoardLists,
  capableToBillTotalFromWorking,
  readyToBillRowsExposureTotal,
} from '../jobsStagesBoard'
import {
  buildBilledAgingBuckets,
  countBilledRowsMissingDates,
  stageRowBilledRemainingAmount,
  type BilledAgingBuckets,
} from './invoiceBilling'
import { addDaysYmd } from '../emailSchedule/emailScheduleWeek'

export type StagesSectionStat = { count: number; total: number }

export type CollectedDayPoint = { dayYmd: string; total: number }

export type StagesHeaderStats = {
  waiting: StagesSectionStat
  working: StagesSectionStat
  readyToBill: StagesSectionStat
  billed: StagesSectionStat
  collections: StagesSectionStat
  paid: { count: number }
  /** "Capable of Being Billed" figure over the Working section. */
  capableToBill: number
  billedAging: BilledAgingBuckets
  /** Payments by day, oldest→newest, last COLLECTED_DAYS days (Pipeline money card). */
  collectedByDay: CollectedDayPoint[]
  /** Billed rows with a positive remainder but no billed_at / est. date (can't age or be chased). */
  billedNoDate: number
}

// v2.2299 (owner call): the collected card reads the last 30 days, not 8
// Monday-start weeks — and only devs + controllers see it.
export const COLLECTED_DAYS = 30

/** Σ payment.amount per day over the trailing COLLECTED_DAYS days incl. today (UTC clock). */
export function collectedByDayFromPayments(
  payments: ReadonlyArray<{ paid_on?: string | null; amount: number | null }>,
  now = new Date(),
): CollectedDayPoint[] {
  const todayYmd = now.toISOString().slice(0, 10)
  const days: CollectedDayPoint[] = []
  const index = new Map<string, number>()
  for (let i = COLLECTED_DAYS - 1; i >= 0; i--) {
    const dayYmd = addDaysYmd(todayYmd, -i)
    index.set(dayYmd, days.length)
    days.push({ dayYmd, total: 0 })
  }
  for (const p of payments) {
    const paidOn = p.paid_on
    if (!paidOn) continue
    const at = index.get(paidOn.slice(0, 10))
    const day = at == null ? undefined : days[at]
    if (!day) continue
    day.total += Number(p.amount ?? 0)
  }
  return days
}

/** collectedByDay over the payments attached to `jobs` (the full-row board path). */
export function collectedByDayFromJobs(jobs: JobWithDetails[], now = new Date()): CollectedDayPoint[] {
  return collectedByDayFromPayments(
    jobs.flatMap((j) => (j.payments ?? []) as Array<{ paid_on?: string | null; amount: number | null }>),
    now,
  )
}

/**
 * The exact header expressions from the Stages board (JobsStagesTab render,
 * v2.1801-era lines): waiting/working = Σ(revenue − payments_made); RTB =
 * row-count + exposure; billed/collections = row-count + Σ remaining.
 */
export function computeStagesHeaderStats(jobs: JobWithDetails[], now = new Date()): StagesHeaderStats {
  const l = buildJobsStagesBoardLists(jobs, '')
  const jobNet = (j: JobWithDetails) => Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)
  return {
    waiting: { count: l.waiting.length, total: l.waiting.reduce((s, j) => s + jobNet(j), 0) },
    working: { count: l.working.length, total: l.working.reduce((s, j) => s + jobNet(j), 0) },
    readyToBill: {
      count: l.readyToBillRows.length,
      total: readyToBillRowsExposureTotal(l.readyToBillRows),
    },
    billed: {
      count: l.billedActiveRows.length,
      total: l.billedActiveRows.reduce((s, r) => s + stageRowBilledRemainingAmount(r), 0),
    },
    collections: {
      count: l.collectionsRows.length,
      total: l.collectionsRows.reduce((s, r) => s + stageRowBilledRemainingAmount(r), 0),
    },
    paid: { count: l.paid.length },
    capableToBill: capableToBillTotalFromWorking(l.working),
    billedAging: buildBilledAgingBuckets(l.filtered, now),
    collectedByDay: collectedByDayFromJobs(jobs, now),
    billedNoDate: countBilledRowsMissingDates(l.filtered),
  }
}

/**
 * Every column any header formula reads. The board-lists builder additionally
 * touches hcp_number/click_number (sort order — irrelevant to sums, but the
 * sort comparator dereferences them).
 */
export const LEAN_STATS_JOB_COLUMNS =
  'id, status, revenue, payments_made, pct_complete, collections_at, hcp_number, click_number, customer_id, gc_customer_id'
export const LEAN_STATS_INVOICE_COLUMNS =
  'id, job_id, amount, status, sequence_order, is_primary_rtb_bundle, estimated_bill_date, billed_at'
export const LEAN_STATS_PAYMENT_COLUMNS = 'job_id, invoice_id, amount, paid_on'

export type LeanStatsJobRow = {
  id: string
  status: string | null
  revenue: number | null
  payments_made: number | null
  pct_complete: number | null
  collections_at: string | null
  hcp_number: string | null
  click_number: string | null
  /** Chase-queue grouping key (v2.2025) — the header math itself never reads it. */
  customer_id: string | null
  /** Statement-round grouping key (v2.2072) — header math never reads it either. */
  gc_customer_id: string | null
}
export type LeanStatsInvoiceRow = {
  id: string
  job_id: string
  amount: number | null
  status: string | null
  sequence_order: number
  is_primary_rtb_bundle: boolean | null
  estimated_bill_date: string | null
  billed_at: string | null
}
export type LeanStatsPaymentRow = {
  job_id: string
  invoice_id: string | null
  amount: number | null
  paid_on: string | null
}

/**
 * Shape lean rows into the `JobWithDetails` surface the kernels consume. Only
 * the fields the header math reads are real; everything else is absent. The
 * cast is safe BECAUSE the parity test pins lean-assembled output to
 * full-object output over fixtures that exercise every branch — any kernel
 * change that starts reading a new field breaks that test, not prod headers.
 */
export function assembleLeanStatsJobs(
  jobRows: LeanStatsJobRow[],
  invoiceRows: LeanStatsInvoiceRow[],
  paymentRows: LeanStatsPaymentRow[],
): JobWithDetails[] {
  const invByJob = new Map<string, LeanStatsInvoiceRow[]>()
  for (const inv of invoiceRows) {
    const list = invByJob.get(inv.job_id)
    if (list) list.push(inv)
    else invByJob.set(inv.job_id, [inv])
  }
  const payByJob = new Map<string, LeanStatsPaymentRow[]>()
  for (const p of paymentRows) {
    const list = payByJob.get(p.job_id)
    if (list) list.push(p)
    else payByJob.set(p.job_id, [p])
  }
  return jobRows.map(
    (j) =>
      ({
        ...j,
        invoices: invByJob.get(j.id) ?? [],
        payments: payByJob.get(j.id) ?? [],
        materials: [],
        fixtures: [],
        team_members: [],
        // Statement-round grouping (v2.2072): id-only GC stub so the GC Review
        // rollup can group lean rows; the name backfills once full rows merge.
        gcCustomer: j.gc_customer_id ? { id: j.gc_customer_id, name: '' } : null,
      }) as unknown as JobWithDetails,
  )
}
