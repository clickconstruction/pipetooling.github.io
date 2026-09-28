// The query helpers the Review tab's two big loaders share — the per-person
// panel loader (`loadReviewDataCore` in `PeopleReviewTab.tsx`) and the
// team-wide union loader. Moved here verbatim so either loader can leave the
// component without taking a private copy.

import { supabase } from '../supabase'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../supabasePaging'
import { DatabaseError } from '../../utils/errorHandling'

/**
 * Throws on the first failed result in a wave of Supabase queries. Both big
 * Review loaders (`loadReviewData`, `loadTeamReviewUnion`) used to unwrap
 * every result as `(res.data ?? [])`, so a failed query silently became an
 * empty array — $0 parts, $0 labor, inflated allocation ratios — with no
 * error surface. Stub waves (`Promise.resolve({ data: [] })`) have no
 * `error` key, which this tolerates.
 */
export function throwIfQueryError(
  results: Array<{ data?: unknown; error?: { message: string; code?: string; details?: string } | null }>,
  label: string,
): void {
  for (const r of results) {
    if (r.error) throw new DatabaseError(`Failed to ${label}: ${r.error.message}`, r.error.code, r.error.details)
  }
}

/**
 * Pages a query with {@link fetchAllRows} and wraps the rows back into a
 * `{ data }` result so existing wave destructuring / `.data` reads are
 * unchanged. Company-wide and multi-year fetches in the Review loaders cross
 * PostgREST's silent `max_rows` (1000) cap (people_hours ≈ one row per
 * person per day); un-paged they return an arbitrary subset with no error.
 * `makePage` must build a FRESH query per call with a stable `.order()`.
 * Person-scoped single-period queries stay single-shot.
 */
export function paged<T>(
  makePage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string; code?: string; details?: string } | null }>,
  label: string,
): Promise<{ data: T[]; error: null }> {
  return fetchAllRows<T>(makePage, label).then((rows) => ({ data: rows, error: null }))
}

/**
 * A sheet row's job: its link (`people_labor_jobs.job_ledger_id`, v2.3068). The number is
 * display text — the number fallback was retired once every sheet carried a link.
 */
export function laborRowJobId(r: { job_ledger_id?: string | null }): string | null {
  return r.job_ledger_id || null
}

/** jobs_ledger.status for a set of ids (v2.3360) — the ledger RPCs don't carry it. Chunked and paged; a failure reads as "unknown" (not finished). */
export async function fetchJobStatusesByIds(jobIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (jobIds.length === 0) return out
  try {
    const rows = (await fetchAllRowsChunkedIn(
      jobIds,
      (chunk, f, t) => supabase.from('jobs_ledger').select('id, status').in('id', chunk).order('id').range(f, t),
      'load review job statuses',
    )) as Array<{ id: string; status: string | null }>
    for (const r of rows) if (r.status) out.set(r.id, r.status)
  } catch (e) {
    console.warn('[review] job statuses unavailable — finished jobs will not read as 100%', e)
  }
  return out
}
