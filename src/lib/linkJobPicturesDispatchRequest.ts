import { supabase } from './supabase'
import { withSupabaseRetry, formatErrorMessage } from '../utils/errorHandling'
import { notifyDispatchRequestsChanged } from './dispatchRequestHelpers'
import {
  decidePicturesDispatchRequest,
  PICTURES_REQUEST_SELF_HEAL_NOTE,
} from './picturesDispatchRequests'

type ToastFn = (message: string, type: 'success' | 'info' | 'warning' | 'error') => void

/**
 * Close one `link_job_pictures` request that the job's existing pictures link
 * has made redundant. Best-effort: a viewer without UPDATE rights on
 * `dispatch_requests` just leaves the row for Dispatch to close, so failure is
 * logged, never surfaced.
 */
async function closePicturesDispatchRequest(
  requestId: string,
  authUserId: string,
): Promise<void> {
  try {
    await withSupabaseRetry(
      async () =>
        supabase
          .from('dispatch_requests')
          .update({
            status: 'closed',
            closed_at: new Date().toISOString(),
            closed_by_user_id: authUserId,
            closed_note: PICTURES_REQUEST_SELF_HEAL_NOTE,
          })
          .eq('id', requestId)
          .eq('status', 'open'),
      'self-heal link_job_pictures dispatch request',
    )
  } catch (e) {
    console.warn('self-heal link_job_pictures dispatch request failed', e)
  }
}

/**
 * "Send to Dispatch: add a Customer Pictures folder" request (extracted from
 * Dashboard so the Dispatch Mode dashboard's My Schedule can reuse it).
 * Dedupes on an existing open request for the job.
 */
export async function submitLinkJobPicturesDispatchRequestForJob(
  authUserId: string | null | undefined,
  showToast: ToastFn,
  args: {
    jobId: string
    hcpNumber: string | null | undefined
    jobName: string | null | undefined
    jobAddress: string | null | undefined
  },
): Promise<void> {
  if (!authUserId) {
    showToast('Sign in to send to Dispatch.', 'error')
    return
  }
  const jobId = args.jobId.trim()
  if (!jobId) return
  const hcp = (args.hcpNumber ?? '').trim()
  const name = (args.jobName ?? '').trim() || 'Job'
  const address = (args.jobAddress ?? '').trim()
  try {
    const [existing, jobRow] = await Promise.all([
      withSupabaseRetry<{ id: string } | null>(
        async () =>
          supabase
            .from('dispatch_requests')
            .select('id')
            .eq('job_ledger_id', jobId)
            .eq('pending_action', 'link_job_pictures')
            .eq('status', 'open')
            .limit(1)
            .maybeSingle(),
        'check existing link_job_pictures dispatch request',
      ),
      withSupabaseRetry<{ job_pictures_link: string | null } | null>(
        async () =>
          supabase.from('jobs_ledger').select('job_pictures_link').eq('id', jobId).maybeSingle(),
        'read job_pictures_link before dispatch request',
      ),
    ])

    // A request filed against an already-linked job can never auto-close (the
    // auto-close needs a blank→set transition), so refuse to create one — and
    // retire any open request that is already in that unclosable state.
    const decision = decidePicturesDispatchRequest({
      jobPicturesLink: jobRow?.job_pictures_link,
      existingOpenRequestId: existing?.id,
    })
    if (decision.action === 'already-linked') {
      if (decision.orphanedRequestIdToClose) {
        await closePicturesDispatchRequest(decision.orphanedRequestIdToClose, authUserId)
        notifyDispatchRequestsChanged()
      }
      showToast(decision.message, 'info')
      return
    }
    if (decision.action === 'already-open') {
      showToast(decision.message, 'info')
      return
    }
    const titlePrefix = hcp ? `HCP ${hcp} - ` : ''
    const title = `Add a Customer Pictures folder for ${titlePrefix}${name}`
    const referenceSummaryParts = [hcp ? `HCP ${hcp}` : null, name].filter(Boolean) as string[]
    const referenceHead = referenceSummaryParts.join(' | ')
    const referenceSummary = address ? `${referenceHead} - ${address}` : referenceHead
    const row = await withSupabaseRetry<{ id: string }>(
      async () =>
        supabase
          .from('dispatch_requests')
          .insert({
            from_user_id: authUserId,
            title,
            links: [],
            job_ledger_id: jobId,
            bid_id: null,
            reference_summary: referenceSummary || null,
            pending_action: 'link_job_pictures',
          })
          .select('id')
          .single(),
      'insert link_job_pictures dispatch request',
    )
    if (!row?.id) {
      showToast('Could not send to Dispatch.', 'error')
      return
    }
    void supabase.functions.invoke('notify-dispatch-request', {
      body: { dispatch_request_id: row.id },
    })
    notifyDispatchRequestsChanged()
    showToast(decision.message, 'success')
  } catch (e) {
    showToast(formatErrorMessage(e, 'Failed to send to Dispatch'), 'error')
  }
}
