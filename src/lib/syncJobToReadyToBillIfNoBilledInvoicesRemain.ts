import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

type JobsLedgerStatusPick = Pick<Database['public']['Tables']['jobs_ledger']['Row'], 'status'>

export type SyncJobToReadyToBillIfNoBilledInvoicesRemainResult =
  | { ok: true }
  | { ok: false; message: string }

/**
 * After reverting a billed invoice to Ready to Bill: if no `billed` invoice rows
 * remain for the job and the job is still `billed`, move the job to `ready_to_bill`
 * via `update_job_status`.
 */
export async function syncJobToReadyToBillIfNoBilledInvoicesRemain(
  supabase: SupabaseClient<Database>,
  jobId: string,
): Promise<SyncJobToReadyToBillIfNoBilledInvoicesRemainResult> {
  try {
    const billedCount = await withSupabaseRetry(
      async () => {
        const r = await supabase
          .from('jobs_ledger_invoices')
          .select('id', { count: 'exact', head: true })
          .eq('job_id', jobId)
          .eq('status', 'billed')
        if (r.error) {
          return { data: null as unknown as number, error: r.error }
        }
        return { data: r.count ?? 0, error: null }
      },
      'count billed invoices for job',
    )

    if (billedCount > 0) {
      return { ok: true }
    }

    const jobRow = await withSupabaseRetry<JobsLedgerStatusPick | null>(
      async () => supabase.from('jobs_ledger').select('status').eq('id', jobId).maybeSingle(),
      'fetch job status for invoice revert sync',
    )

    if (jobRow?.status !== 'billed') {
      return { ok: true }
    }

    const rpcData = await withSupabaseRetry(
      async () =>
        supabase.rpc('update_job_status', { p_job_id: jobId, p_to_status: 'ready_to_bill' }),
      'update_job_status after last billed invoice reverted',
    )

    const result = rpcData as { error?: string } | null
    if (result?.error) {
      return { ok: false, message: result.error }
    }

    return { ok: true }
  } catch (e: unknown) {
    return { ok: false, message: formatErrorMessage(e, 'Could not sync job status') }
  }
}
