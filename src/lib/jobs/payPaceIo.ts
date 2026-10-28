/**
 * The reads behind decision 1's facts (punch list #177): which customers some
 * job names as its GC, and which jobs carry a live pay application. The
 * Collect desk's loader reads them for the pile's jobs; the Stages tab reads
 * them once for the board. Both through here, so the two surfaces read the
 * same facts.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../supabasePaging'
import type { PaceFacts } from './payPace'

type GcRow = { gc_customer_id: string | null }
type PayAppRow = { job_id: string }

/** The facts, with the pay applications on the jobs named, or on every job when none are. */
export async function loadPaceFacts(db: SupabaseClient<Database>, args: { jobIds?: ReadonlyArray<string> } = {}): Promise<PaceFacts> {
  const jobIds = args.jobIds ? [...new Set(args.jobIds)] : null
  const payAppsPage = (chunk: string[] | null) => async (from: number, to: number) => ({
    data: (await withSupabaseRetry(async () => {
      const q = db.from('job_pay_applications').select('job_id').is('deleted_at', null)
      return (chunk ? q.in('job_id', chunk) : q).order('id').range(from, to)
    }, 'pace facts pay applications')) as PayAppRow[] | null,
    error: null,
  })
  const [gcRows, payApps] = await Promise.all([
    fetchAllRows(
      async (from, to) => ({
        data: (await withSupabaseRetry(async () => db.from('jobs_ledger').select('gc_customer_id').not('gc_customer_id', 'is', null).order('id').range(from, to), 'pace facts gc payers')) as GcRow[] | null,
        error: null,
      }),
      'pace facts gc payers',
    ),
    jobIds == null
      ? fetchAllRows(payAppsPage(null), 'pace facts pay applications')
      : jobIds.length
        ? fetchAllRowsChunkedIn<PayAppRow, string>(jobIds, (chunk, from, to) => payAppsPage(chunk)(from, to), 'pace facts pay applications')
        : Promise.resolve([] as PayAppRow[]),
  ])
  const gcPayerIds = new Set<string>()
  for (const r of gcRows) if (r.gc_customer_id) gcPayerIds.add(r.gc_customer_id)
  return { gcPayerIds, payAppJobIds: new Set<string>(payApps.map((r) => r.job_id)) }
}
