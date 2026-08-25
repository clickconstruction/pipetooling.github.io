/**
 * Lean fetch feeding `computeStagesHeaderStats` (v2.1821, plan PR 1; bounded
 * v2.1917): no-embed selects filtered to the rows the header formulas actually
 * read — active-cohort jobs (paid arrives as a bare head-count), open billing
 * lines, and payments that are either invoice-linked (billed remainders) or
 * inside the trailing collected-by-week window. History (paid jobs' rows, paid
 * invoices, old unlinked payments) never ships: stats cost scales with
 * work-in-flight, not company age. RLS scopes every select to the caller's
 * visibility, so stats always match the board that role would see. With a
 * customer filter, invoice/payment rows for other customers are
 * fetched-and-dropped in assembly (the filter is a rare path; one broad lean
 * select beats chunked `.in()` round trips).
 *
 * Two stats bypass job attachment: `paid.count` (head-count) and
 * `collectedByDay` (from the raw payment rows) — both would otherwise need
 * paid jobs' rows, which is most of the table and none of the other math.
 *
 * Known delta vs the pre-bound fetch: a `billed` invoice left hanging on a
 * `paid` job no longer surfaces in the stats (its job row isn't fetched, and
 * assembly drops orphan invoices). That combination is a billing-state bug
 * when it exists — verified empty in prod at cutover.
 */
import { supabase } from '../supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { addDaysYmd } from '../emailSchedule/emailScheduleWeek'
import { buildJobsStagesBoardLists, type StageRow } from '../jobsStagesBoard'
import {
  assembleLeanStatsJobs,
  COLLECTED_DAYS,
  collectedByDayFromPayments,
  computeStagesHeaderStats,
  LEAN_STATS_INVOICE_COLUMNS,
  LEAN_STATS_JOB_COLUMNS,
  LEAN_STATS_PAYMENT_COLUMNS,
  type LeanStatsInvoiceRow,
  type LeanStatsJobRow,
  type LeanStatsPaymentRow,
  type StagesHeaderStats,
} from './stagesHeaderStats'

export type FetchStagesHeaderStatsResult =
  | { ok: true; stats: StagesHeaderStats; leanBilledRows: StageRow[] }
  | { ok: false; error: string }

/**
 * Job statuses whose rows any header formula reads. `paid` is deliberately
 * absent (count-only, via head request); NULL status rides along because the
 * kernel coalesces it to 'working'. "Collections" is not a status — it's
 * `billed` + `collections_at`, so billed covers it.
 */
export const LEAN_STATS_ACTIVE_JOB_STATUSES = ['waiting', 'working', 'ready_to_bill', 'billed'] as const

/** Invoice statuses any formula reads — `paid` invoices are ignored by every header expression. */
export const LEAN_STATS_ACTIVE_INVOICE_STATUSES = ['ready_to_bill', 'billed'] as const

/** First day of the trailing collected window (payments fetch bound). */
export function collectedWindowStartYmd(now = new Date()): string {
  return addDaysYmd(now.toISOString().slice(0, 10), -(COLLECTED_DAYS - 1))
}

export async function fetchStagesHeaderStats(
  customerFilter: string | null,
  now = new Date(),
): Promise<FetchStagesHeaderStatsResult> {
  try {
    let jobsQ = supabase
      .from('jobs_ledger')
      .select(LEAN_STATS_JOB_COLUMNS)
      .or(`status.in.(${LEAN_STATS_ACTIVE_JOB_STATUSES.join(',')}),status.is.null`)
    if (customerFilter) jobsQ = jobsQ.eq('customer_id', customerFilter)
    let paidQ = supabase.from('jobs_ledger').select('id', { count: 'exact', head: true }).eq('status', 'paid')
    if (customerFilter) paidQ = paidQ.eq('customer_id', customerFilter)
    const [jobRows, paidCount, invoiceRows, paymentRows] = await Promise.all([
      withSupabaseRetry(async () => jobsQ, 'stages header stats: jobs'),
      withSupabaseRetry(async () => {
        const { count, error } = await paidQ
        return { data: count ?? 0, error }
      }, 'stages header stats: paid count'),
      withSupabaseRetry(
        async () =>
          supabase
            .from('jobs_ledger_invoices')
            .select(LEAN_STATS_INVOICE_COLUMNS)
            .in('status', [...LEAN_STATS_ACTIVE_INVOICE_STATUSES]),
        'stages header stats: invoices',
      ),
      withSupabaseRetry(
        async () =>
          supabase
            .from('jobs_ledger_payments')
            .select(LEAN_STATS_PAYMENT_COLUMNS)
            .or(`invoice_id.not.is.null,paid_on.gte.${collectedWindowStartYmd(now)}`),
        'stages header stats: payments',
      ),
    ])
    const payments = (paymentRows ?? []) as unknown as LeanStatsPaymentRow[]
    const jobs = assembleLeanStatsJobs(
      (jobRows ?? []) as unknown as LeanStatsJobRow[],
      (invoiceRows ?? []) as unknown as LeanStatsInvoiceRow[],
      payments,
    )
    const stats = computeStagesHeaderStats(jobs, now)
    return {
      ok: true,
      stats: {
        ...stats,
        paid: { count: paidCount },
        collectedByDay: collectedByDayFromPayments(payments, now),
      },
      // Lean billed rows for the chase-queue card (v2.2025): the same
      // assembled jobs the stats ran over, shaped by the board kernel. Lean
      // rows lack names — the call-mode modal re-derives from full rows.
      leanBilledRows: buildJobsStagesBoardLists(jobs, '').billedActiveRows,
    }
  } catch (e) {
    return { ok: false, error: formatErrorMessage(e, 'Could not load board stats') }
  }
}
