import { supabase } from './supabase'
import { withSupabaseRetry, formatErrorMessage } from '../utils/errorHandling'
import { notifyDispatchRequestsChanged } from './dispatchRequestHelpers'

type ToastFn = (message: string, type: 'success' | 'info' | 'warning' | 'error') => void

/**
 * "Send to Dispatch: find the property owner" (v2.1610) — filed from the
 * Share-with-supply-house modal when the owner (name/company + mailing
 * address) is unknown and the send is therefore blocked. Mirrors
 * addJobPhoneDispatchRequest: dedupe on an open request for the job,
 * best-effort push, toast either way. The inbox renders a one-click
 * "Open Share with supply house" action, and a successful send auto-closes
 * any open request (the errand completes itself).
 */

export const FIND_PROPERTY_OWNER_ACTION = 'find_property_owner'

const SELF_CLOSE_NOTE = 'Job account sent to the supply house — owner info filled.'

/** The open find-owner request for a job, if any (drives the modal's "Dispatch is on it" state). */
export async function fetchOpenFindOwnerRequest(
  jobId: string
): Promise<{ id: string; created_at: string } | null> {
  try {
    const row = await withSupabaseRetry<{ id: string; created_at: string } | null>(
      async () =>
        supabase
          .from('dispatch_requests')
          .select('id, created_at')
          .eq('job_ledger_id', jobId)
          .eq('pending_action', FIND_PROPERTY_OWNER_ACTION)
          .eq('status', 'open')
          .limit(1)
          .maybeSingle(),
      'check existing find_property_owner dispatch request'
    )
    return row ?? null
  } catch {
    return null
  }
}

export async function submitFindPropertyOwnerDispatchRequestForJob(
  authUserId: string | null | undefined,
  showToast: ToastFn,
  args: { jobId: string; jobLabel: string; jobAddress: string | null | undefined }
): Promise<{ id: string; created_at: string } | null> {
  if (!authUserId) {
    showToast('Sign in to send to Dispatch.', 'error')
    return null
  }
  const jobId = args.jobId.trim()
  if (!jobId) return null
  try {
    const existing = await fetchOpenFindOwnerRequest(jobId)
    if (existing) {
      showToast('Dispatch is already on this one — the request is in their inbox.', 'info')
      return existing
    }
    const address = (args.jobAddress ?? '').trim()
    const title = `Find the property owner for ${args.jobLabel} (name/company + mailing address), then open Job Detail → Share with supply house and send the job account.`
    const row = await withSupabaseRetry<{ id: string; created_at: string }>(
      async () =>
        supabase
          .from('dispatch_requests')
          .insert({
            from_user_id: authUserId,
            title,
            links: [],
            job_ledger_id: jobId,
            bid_id: null,
            reference_summary: address ? `${args.jobLabel} - ${address}` : args.jobLabel,
            pending_action: FIND_PROPERTY_OWNER_ACTION,
          })
          .select('id, created_at')
          .single(),
      'insert find_property_owner dispatch request'
    )
    if (!row?.id) {
      showToast('Could not send to Dispatch.', 'error')
      return null
    }
    void supabase.functions.invoke('notify-dispatch-request', {
      body: { dispatch_request_id: row.id },
    })
    notifyDispatchRequestsChanged()
    showToast('Sent to Dispatch — they can open this screen from their inbox.', 'success')
    return row
  } catch (e) {
    showToast(formatErrorMessage(e, 'Failed to send to Dispatch'), 'error')
    return null
  }
}

/**
 * Auto-close open find-owner requests after a successful supply house send —
 * best-effort (a viewer without UPDATE rights just leaves the row for
 * Dispatch to close by hand).
 */
export async function closeOpenFindOwnerRequestsAfterSend(jobId: string, authUserId: string): Promise<void> {
  try {
    await withSupabaseRetry(
      async () =>
        supabase
          .from('dispatch_requests')
          .update({
            status: 'closed',
            closed_at: new Date().toISOString(),
            closed_by_user_id: authUserId,
            closed_note: SELF_CLOSE_NOTE,
          })
          .eq('job_ledger_id', jobId)
          .eq('pending_action', FIND_PROPERTY_OWNER_ACTION)
          .eq('status', 'open'),
      'self-close find_property_owner dispatch request'
    )
    notifyDispatchRequestsChanged()
  } catch (e) {
    console.warn('self-close find_property_owner dispatch request failed', e)
  }
}
