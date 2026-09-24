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
 * A `billed` invoice left hanging on a `paid` (or deleted) job never surfaces
 * in the stats — its job row isn't fetched, and the bill-truth kernel files
 * it under `billTruth.orphans` / `excludedOwed` instead of Owed (journey
 * J4-1/2: the $488 "Unknown job" the AR card used to sum). Surfaces may show
 * that count as an excluded-bills hint; nothing sums it.
 *
 * This fetch is the SPINE (journey Tier-1 #2(c)): the Pipeline strip, the
 * Dashboard AR card, the Billed pin and Quickfill's "who owes what" all read
 * `computeBillTruth` over rows shaped like these — see `lib/billing/billTruth.ts`.
 */
import { supabase } from '../supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../supabasePaging'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { fetchWorkingStagePlanInputs } from './fetchWorkingStagePlanInputs'
import type { WorkingStageInputs } from './capableToBillPlan'
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
import { computeBillTruth, type BillTruth } from '../billing/billTruth'

export type FetchStagesHeaderStatsResult =
  | { ok: true; stats: StagesHeaderStats; leanBilledRows: StageRow[]; billTruth: BillTruth }
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
    // Paged (Phase 4 #3(c)): these are bounded-but-unranged company-wide reads; the
    // invoice-linked payments clause grows with company age and an un-ranged read is
    // silently cut at PostgREST's 1,000 rows — the header's billed/collected numbers
    // would drift with no error. Fresh builder per page; `.order('id')` keeps pages stable.
    const makeJobsQ = () => {
      let q = supabase
        .from('jobs_ledger')
        .select(LEAN_STATS_JOB_COLUMNS)
        .or(`status.in.(${LEAN_STATS_ACTIVE_JOB_STATUSES.join(',')}),status.is.null`)
      if (customerFilter) q = q.eq('customer_id', customerFilter)
      return q.order('id')
    }
    let paidQ = supabase.from('jobs_ledger').select('id', { count: 'exact', head: true }).eq('status', 'paid')
    if (customerFilter) paidQ = paidQ.eq('customer_id', customerFilter)
    const [jobRows, paidCount, invoiceRows, paymentRows] = await Promise.all([
      fetchAllRows(
        async (from, to) => ({
          data: (await withSupabaseRetry(async () => makeJobsQ().range(from, to), 'stages header stats: jobs')) as unknown as
            | LeanStatsJobRow[]
            | null,
          error: null,
        }),
        'stages header stats: jobs',
      ),
      withSupabaseRetry(async () => {
        const { count, error } = await paidQ
        return { data: count ?? 0, error }
      }, 'stages header stats: paid count'),
      fetchAllRows(
        async (from, to) => ({
          data: (await withSupabaseRetry(
            async () =>
              supabase
                .from('jobs_ledger_invoices')
                .select(LEAN_STATS_INVOICE_COLUMNS)
                .in('status', [...LEAN_STATS_ACTIVE_INVOICE_STATUSES])
                .order('id')
                .range(from, to),
            'stages header stats: invoices',
          )) as unknown as LeanStatsInvoiceRow[] | null,
          error: null,
        }),
        'stages header stats: invoices',
      ),
      fetchAllRows(
        async (from, to) => ({
          data: (await withSupabaseRetry(
            async () =>
              supabase
                .from('jobs_ledger_payments')
                .select(LEAN_STATS_PAYMENT_COLUMNS)
                .or(`invoice_id.not.is.null,paid_on.gte.${collectedWindowStartYmd(now)}`)
                .order('id')
                .range(from, to),
            'stages header stats: payments',
          )) as unknown as LeanStatsPaymentRow[] | null,
          error: null,
        }),
        'stages header stats: payments',
      ),
    ])
    const payments = (paymentRows ?? []) as unknown as LeanStatsPaymentRow[]
    const jobs = assembleLeanStatsJobs(
      (jobRows ?? []) as unknown as LeanStatsJobRow[],
      (invoiceRows ?? []) as unknown as LeanStatsInvoiceRow[],
      payments,
    )
    // v2.3809: the Working jobs' line items and stage-plan inputs, so a job
    // split into Order stages reads its plan for *capable to bill* exactly as
    // the Capable list does (Taunya, 2026-09-24: "$400 capable" over an empty
    // list — J1031's plan had nothing billable while the formula said $400).
    const plan = await loadWorkingStagePlanForStats(jobs)
    const stats = computeStagesHeaderStats(plan ? plan.jobs : jobs, now, plan ? plan.inputs : null)
    // Orphans (bills whose job the bound fetch never ships) are visible only
    // from the flat rows — the assembled jobs dropped them already.
    const billTruth = computeBillTruth({
      jobs: (jobRows ?? []) as unknown as LeanStatsJobRow[],
      invoices: (invoiceRows ?? []) as unknown as LeanStatsInvoiceRow[],
      payments,
    })
    return {
      ok: true,
      stats: {
        ...stats,
        paid: { count: paidCount },
        collectedByDay: collectedByDayFromPayments(payments, now),
        billTruth,
      },
      billTruth,
      // Lean billed rows for the chase-queue card (v2.2025): the same
      // assembled jobs the stats ran over, shaped by the board kernel. Lean
      // rows lack names — the call-mode modal re-derives from full rows.
      leanBilledRows: buildJobsStagesBoardLists(jobs, '').billedActiveRows,
    }
  } catch (e) {
    return { ok: false, error: formatErrorMessage(e, 'Could not load board stats') }
  }
}

/** The fixture columns the stage-plan kernel reads (`readFixtureRow` + `fixtureStageFields`). */
export const LEAN_STATS_FIXTURE_COLUMNS =
  'id, job_id, name, count, line_unit_price, sequence_order, invoice_id, line_kind, discount_pct, discount_basis_positions, progress_pct, stage_kind, shared_with_gc'

type LeanStatsFixtureRow = { id: string; job_id: string }

/**
 * The Working jobs with their fixtures attached, plus the stage-plan inputs
 * (windows, orders, sheets). Null when there is no Working job or a read
 * fails — the stats then keep the formula figure, as the Pipeline header does
 * while its own inputs are out.
 */
async function loadWorkingStagePlanForStats(jobs: JobWithDetails[]): Promise<{ jobs: JobWithDetails[]; inputs: WorkingStageInputs } | null> {
  const workingIds = jobs.filter((j) => j.status === 'working').map((j) => j.id)
  if (workingIds.length === 0) return null
  try {
    const [fixtures, inputs] = await Promise.all([
      fetchAllRowsChunkedIn<LeanStatsFixtureRow, string>(
        workingIds,
        (chunk, from, to) => supabase.from('jobs_ledger_fixtures').select(LEAN_STATS_FIXTURE_COLUMNS).in('job_id', chunk).order('id').range(from, to),
        'stages header stats: fixtures',
      ),
      fetchWorkingStagePlanInputs(workingIds),
    ])
    const byJob = new Map<string, LeanStatsFixtureRow[]>()
    for (const f of fixtures) {
      const list = byJob.get(f.job_id)
      if (list) list.push(f)
      else byJob.set(f.job_id, [f])
    }
    return {
      jobs: jobs.map((j) => (j.status === 'working' ? { ...j, fixtures: (byJob.get(j.id) ?? []) as unknown as JobWithDetails['fixtures'] } : j)),
      inputs,
    }
  } catch (e) {
    console.warn('[fetchStagesHeaderStats] stage plan inputs unavailable — capable to bill keeps its formula figure', e)
    return null
  }
}
