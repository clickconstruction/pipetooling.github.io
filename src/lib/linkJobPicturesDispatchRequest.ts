import { supabase } from './supabase'
import { withSupabaseRetry, formatErrorMessage } from '../utils/errorHandling'
import { notifyDispatchRequestsChanged } from './dispatchRequestHelpers'

type ToastFn = (message: string, type: 'success' | 'info' | 'warning' | 'error') => void

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
    const existing = await withSupabaseRetry<{ id: string } | null>(
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
    )
    if (existing?.id) {
      showToast('Note already sent to dispatch to add a photos link, if you need it sooner call dispatch!', 'info')
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
    showToast('Note sent to dispatch to add a photos link, if you need it sooner call dispatch!', 'success')
  } catch (e) {
    showToast(formatErrorMessage(e, 'Failed to send to Dispatch'), 'error')
  }
}
