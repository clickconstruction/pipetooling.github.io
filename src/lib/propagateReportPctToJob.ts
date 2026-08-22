import { supabase } from './supabase'
import { withSupabaseRetry, formatErrorMessage } from '../utils/errorHandling'
import { REPORT_PCT_PROPAGATION_NOTE, reportPctToPropagate } from './reportPctPropagation'

/**
 * Best-effort side-effect after a job report saves (v2.1833): mirror the
 * report's completion percent into jobs_ledger.pct_complete via the
 * set_job_pct_from_field RPC (v2.1805) — which also posts the "N% complete —
 * from field report" thread note, so the Stages % done box, progress-bar dot,
 * My Schedule day deltas, and Job Detail all pick it up through their existing
 * paths. Failures never block the flow (the report is already saved), but they
 * are no longer silent (v2.2063): `pctError` carries the failure so callers
 * can tell the tech their % didn't stick — an invisible mirror failure reads
 * as "the app ignored my 100%" and erodes trust in the report flow.
 *
 * Returns the job's status so callers can reuse it for the Ready-to-Bill
 * prompt without a second fetch; null when the lookup failed.
 */
export async function propagateReportPctToJob(
  jobId: string,
  fieldValues: Record<string, unknown>,
): Promise<{ jobStatus: string | null; pctError: string | null }> {
  try {
    const data = await withSupabaseRetry(
      async () =>
        await supabase.from('jobs_ledger').select('status, pct_complete').eq('id', jobId).maybeSingle(),
      'report pct propagation job lookup',
    )
    const row = data as { status?: string | null; pct_complete?: number | null } | null
    const pct = reportPctToPropagate(fieldValues, row?.pct_complete ?? null)
    if (pct != null) {
      const { data: rpcData, error: rpcError } = await supabase.rpc('set_job_pct_from_field', {
        p_job_id: jobId,
        p_pct: pct,
        p_note: REPORT_PCT_PROPAGATION_NOTE,
      })
      const result = rpcData as { ok?: boolean; error?: string } | null
      if (rpcError || !result?.ok) {
        return {
          jobStatus: row?.status ?? null,
          pctError: rpcError?.message ?? result?.error ?? 'Could not update the job',
        }
      }
    }
    return { jobStatus: row?.status ?? null, pctError: null }
  } catch (e) {
    return { jobStatus: null, pctError: formatErrorMessage(e, 'Could not update the job') }
  }
}
