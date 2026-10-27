import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../types/database'
/**
 * The Collect desk, PR G (v2.5858): Friday's two reads. The payments recorded
 * since the plan, each filed under the payer its job bills (the GC when the
 * job's bills go to the GC, else the customer), so a payer that paid off and
 * left the sheet still scores; and the lien papers that moved since the plan
 * on the pile's jobs: drafted, signed, mailed, affidavits filed.
 */
import { withSupabaseRetry } from '../../../utils/errorHandling'
import { startOfYmdInAppTzMs } from '../../../utils/dateUtils'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../../supabasePaging'
import type { CollectNoticesSince, CollectPaymentSince } from './collectScorecard'

type PaymentRow = { job_id: string; amount: number | null; paid_on: string | null }
type JobRow = { id: string; bill_to_party: string | null; customer_id: string | null; gc_customer_id: string | null; customer: { name: string | null } | null; gc: { name: string | null } | null }
type DeskItemRow = { job_id: string; kind: string; drafted_at: string | null; approved_at: string | null; sent_at: string | null }
type FilingRow = { job_id: string; kind: string; created_at: string | null }

export type CollectScorecardReads = { payments: CollectPaymentSince[]; notices: CollectNoticesSince }

export async function loadCollectScorecardReads(db: SupabaseClient<Database>, args: { sinceYmd: string; jobIds: ReadonlyArray<string> }): Promise<CollectScorecardReads> {
  const since = args.sinceYmd
  // The call's day starts at midnight Central, not midnight UTC (7 PM Central the evening before): a paper filed or signed
  // that evening is not since the call.
  const startMs = startOfYmdInAppTzMs(since)
  const sinceMs = Number.isFinite(startMs) ? startMs : Date.parse(`${since}T00:00:00Z`)
  const sinceIso = new Date(sinceMs).toISOString()
  const jobIds = [...new Set(args.jobIds)]
  const [payRows, deskItems, filings] = await Promise.all([
    fetchAllRows(
      async (from, to) => ({
        data: (await withSupabaseRetry(async () => db.from('jobs_ledger_payments').select('job_id, amount, paid_on').gte('paid_on', since).order('id').range(from, to), 'collect scorecard payments')) as PaymentRow[] | null,
        error: null,
      }),
      'collect scorecard payments',
    ),
    jobIds.length
      ? fetchAllRowsChunkedIn<DeskItemRow, string>(
          jobIds,
          async (chunk, from, to) => ({
            data: (await withSupabaseRetry(async () => db.from('job_lien_desk_items').select('job_id, kind, drafted_at, approved_at, sent_at').in('job_id', chunk).order('id').range(from, to), 'collect scorecard desk items')) as DeskItemRow[] | null,
            error: null,
          }),
          'collect scorecard desk items',
        )
      : Promise.resolve([] as DeskItemRow[]),
    jobIds.length
      ? fetchAllRowsChunkedIn<FilingRow, string>(
          jobIds,
          async (chunk, from, to) => ({
            data: (await withSupabaseRetry(async () => db.from('job_lien_filings').select('job_id, kind, created_at').in('job_id', chunk).gte('created_at', sinceIso).order('id').range(from, to), 'collect scorecard filings')) as FilingRow[] | null,
            error: null,
          }),
          'collect scorecard filings',
        )
      : Promise.resolve([] as FilingRow[]),
  ])
  const payJobIds = [...new Set(payRows.map((p) => p.job_id))]
  const jobs = payJobIds.length
    ? await fetchAllRowsChunkedIn<JobRow, string>(
        payJobIds,
        async (chunk, from, to) => ({
          data: (await withSupabaseRetry(async () => db.from('jobs_ledger').select('id, bill_to_party, customer_id, gc_customer_id, customer:customers!jobs_ledger_customer_id_fkey(name), gc:customers!jobs_ledger_gc_customer_id_fkey(name)').in('id', chunk).order('id').range(from, to), 'collect scorecard payment jobs')) as unknown as JobRow[] | null,
          error: null,
        }),
        'collect scorecard payment jobs',
      )
    : []
  const jobById = new Map(jobs.map((j) => [j.id, j]))
  const payments: CollectPaymentSince[] = []
  for (const p of payRows) {
    if (!p.paid_on || !(Number(p.amount) > 0)) continue
    const j = jobById.get(p.job_id)
    const toGc = j?.bill_to_party === 'gc' && j.gc_customer_id
    const payerId = toGc ? j!.gc_customer_id : (j?.customer_id ?? null)
    const payerName = (toGc ? j!.gc?.name : j?.customer?.name)?.trim() || 'Unknown payer'
    payments.push({ payerId, payerName, usd: Number(p.amount), paidOn: p.paid_on })
  }
  // Compared as instants: the rows' `+00:00` stamps and `sinceIso`'s `Z` do not sort as strings at the boundary.
  const after = (iso: string | null): boolean => !!iso && Date.parse(iso) >= sinceMs
  const notices: CollectNoticesSince = {
    drafted: deskItems.filter((d) => after(d.drafted_at)).length,
    signed: deskItems.filter((d) => after(d.approved_at)).length,
    mailed: deskItems.filter((d) => after(d.sent_at)).length,
    affidavitsFiled: filings.filter((f) => /affidavit/i.test(f.kind)).length,
  }
  return { payments, notices }
}
