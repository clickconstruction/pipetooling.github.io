/**
 * Lean fetch feeding `computeStagesHeaderStats` (v2.1821, plan PR 1): three
 * no-embed selects — jobs (8 columns), invoices (7), payments (3) — instead of
 * the board's full 8-embed rows + second-round batches. RLS scopes every
 * select to the caller's visibility, so stats always match the board that
 * role would see. With a customer filter, invoice/payment rows for other
 * customers are fetched-and-dropped in assembly (the filter is a rare path;
 * one broad lean select beats chunked `.in()` round trips).
 */
import { supabase } from '../supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import {
  assembleLeanStatsJobs,
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
  | { ok: true; stats: StagesHeaderStats }
  | { ok: false; error: string }

export async function fetchStagesHeaderStats(
  customerFilter: string | null,
  now = new Date(),
): Promise<FetchStagesHeaderStatsResult> {
  try {
    let jobsQ = supabase.from('jobs_ledger').select(LEAN_STATS_JOB_COLUMNS)
    if (customerFilter) jobsQ = jobsQ.eq('customer_id', customerFilter)
    const [jobRows, invoiceRows, paymentRows] = await Promise.all([
      withSupabaseRetry(async () => jobsQ, 'stages header stats: jobs'),
      withSupabaseRetry(
        async () => supabase.from('jobs_ledger_invoices').select(LEAN_STATS_INVOICE_COLUMNS),
        'stages header stats: invoices',
      ),
      withSupabaseRetry(
        async () => supabase.from('jobs_ledger_payments').select(LEAN_STATS_PAYMENT_COLUMNS),
        'stages header stats: payments',
      ),
    ])
    const jobs = assembleLeanStatsJobs(
      (jobRows ?? []) as unknown as LeanStatsJobRow[],
      (invoiceRows ?? []) as unknown as LeanStatsInvoiceRow[],
      (paymentRows ?? []) as unknown as LeanStatsPaymentRow[],
    )
    return { ok: true, stats: computeStagesHeaderStats(jobs, now) }
  } catch (e) {
    return { ok: false, error: formatErrorMessage(e, 'Could not load board stats') }
  }
}
