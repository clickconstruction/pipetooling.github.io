import { supabase } from './supabase'
import { toastForUpdateJobStatusFailure } from './updateJobStatusClientFeedback'

export type MarkJobReadyToBillResult = {
  ok: boolean
  /** Toast copy: success message when ok, friendly failure copy otherwise. */
  message: string
  /** Toast variant to use when !ok. */
  variant: 'error' | 'warning'
}

/**
 * Moves a job from Working → Ready to bill via the `update_job_status` RPC.
 *
 * Used by the "report says 100% complete → move to Ready to bill?" prompt. The RPC enforces
 * authorization (any job team member incl. helpers, office roles, or assigned superintendent) and
 * records a `job_status_events` row. No Stripe/billed-invoice prep is needed for a Working job.
 */
export async function markJobReadyToBill(jobId: string): Promise<MarkJobReadyToBillResult> {
  const { data, error } = await supabase.rpc('update_job_status', {
    p_job_id: jobId,
    p_to_status: 'ready_to_bill',
  })
  if (error) {
    const t = toastForUpdateJobStatusFailure(error.message)
    return { ok: false, message: t.text, variant: t.variant }
  }
  const rpcError = (data as { error?: string } | null)?.error
  if (rpcError) {
    const t = toastForUpdateJobStatusFailure(rpcError)
    return { ok: false, message: t.text, variant: t.variant }
  }
  return { ok: true, message: 'Job moved to Ready to Bill.', variant: 'error' }
}
