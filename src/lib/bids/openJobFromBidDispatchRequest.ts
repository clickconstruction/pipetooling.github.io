/**
 * Won → Dispatch opens the job (v2.3143): the writes behind the kernel in
 * `wonDispatchHandoff.ts` — file the to-do, and retire it once a job carries
 * the bid. Both are best-effort for the caller's role: RLS lets only devs and
 * dispatch members close rows, so a close that matches nothing is left for
 * the inbox's own sweep.
 */
import { supabase } from '../supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { createDispatchRequest, notifyDispatchRequestsChanged } from '../dispatchRequestHelpers'
import { notifyDispatchRequestClosure } from '../dispatchRequestClosure'
import {
  bidHandoffLabel,
  decideWonHandoff,
  OPEN_JOB_FROM_BID_ACTION,
  wonHandoffClosedNote,
  wonHandoffReference,
  wonHandoffSentMessage,
  wonHandoffTitle,
} from './wonDispatchHandoff'

type ToastFn = (message: string, type: 'success' | 'info' | 'warning' | 'error') => void

type BidForHandoff = {
  id: string
  bid_number: string | null
  project_name: string | null
  address: string | null
  customers: { name: string } | null
}

export type AskDispatchOutcome = 'created' | 'already-asked' | 'has-job' | 'failed'

/**
 * File the "Open the job for B… — won with …" to-do for a bid. Dedupes on an
 * open to-do for the same bid, and refuses when a job already carries the bid.
 * `silent` skips the toasts (the automatic send after a primary marks Won).
 */
export async function askDispatchToOpenJob(
  authUserId: string | null | undefined,
  showToast: ToastFn,
  bidId: string,
  opts?: { silent?: boolean },
): Promise<AskDispatchOutcome> {
  const say = (message: string, type: 'success' | 'info' | 'error') => {
    if (!opts?.silent) showToast(message, type)
  }
  if (!authUserId) {
    say('Sign in to send to Dispatch.', 'error')
    return 'failed'
  }
  try {
    const [bid, existing, job] = await Promise.all([
      withSupabaseRetry<BidForHandoff | null>(
        async () => supabase.from('bids').select('id, bid_number, project_name, address, customers(name)').eq('id', bidId).maybeSingle(),
        'read bid for dispatch hand-off',
      ),
      withSupabaseRetry<{ id: string } | null>(
        async () =>
          supabase
            .from('dispatch_requests')
            .select('id')
            .eq('bid_id', bidId)
            .eq('pending_action', OPEN_JOB_FROM_BID_ACTION)
            .eq('status', 'open')
            .limit(1)
            .maybeSingle(),
        'check existing open_job_from_bid dispatch request',
      ),
      withSupabaseRetry<{ hcp_number: string | null } | null>(
        async () => supabase.from('jobs_ledger').select('hcp_number').eq('bid_id', bidId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        'check job already opened from bid',
      ),
    ])
    if (!bid) {
      say('Bid not found.', 'error')
      return 'failed'
    }
    const label = bidHandoffLabel({ bidNumber: bid.bid_number, projectName: bid.project_name })
    const decision = decideWonHandoff({ existingJobHcp: job?.hcp_number, existingOpenRequestId: existing?.id, bidLabel: label })
    if (decision.action !== 'send') {
      say(decision.message, 'info')
      return decision.action
    }
    await createDispatchRequest({
      fromUserId: authUserId,
      title: wonHandoffTitle({ bidNumber: bid.bid_number, projectName: bid.project_name, gcName: bid.customers?.name ?? null }),
      bidId: bid.id,
      referenceSummary: wonHandoffReference({ bidNumber: bid.bid_number, projectName: bid.project_name, address: bid.address }),
      pendingAction: OPEN_JOB_FROM_BID_ACTION,
    })
    say(wonHandoffSentMessage(label), 'success')
    return 'created'
  } catch (e) {
    say(formatErrorMessage(e, 'Failed to send to Dispatch'), 'error')
    return 'failed'
  }
}

/**
 * Close every open "open the job" to-do for a bid now that a job carries it,
 * and tell each requester. Returns how many rows actually closed (zero for a
 * role RLS keeps from updating — the inbox sweep closes those later).
 */
export async function closeOpenJobFromBidRequests(args: {
  bidId: string
  hcpNumber: string | null | undefined
  userId: string | null | undefined
  role: string | null | undefined
  /** The inbox found the job rather than the button making it. */
  elsewhere: boolean
}): Promise<number> {
  if (!args.userId) return 0
  try {
    const bid = await withSupabaseRetry<{ bid_number: string | null; project_name: string | null } | null>(
      async () => supabase.from('bids').select('bid_number, project_name').eq('id', args.bidId).maybeSingle(),
      'read bid label for dispatch close',
    )
    const note = wonHandoffClosedNote({
      hcpNumber: args.hcpNumber,
      bidLabel: bidHandoffLabel({ bidNumber: bid?.bid_number, projectName: bid?.project_name }),
      elsewhere: args.elsewhere,
    })
    const closed = await withSupabaseRetry<Array<{ id: string; from_user_id: string; title: string }>>(
      async () =>
        supabase
          .from('dispatch_requests')
          .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by_user_id: args.userId, closed_note: note })
          .eq('bid_id', args.bidId)
          .eq('pending_action', OPEN_JOB_FROM_BID_ACTION)
          .eq('status', 'open')
          .select('id, from_user_id, title'),
      'close open_job_from_bid dispatch requests',
    )
    const rows = closed ?? []
    if (rows.length > 0) {
      notifyDispatchRequestsChanged()
      for (const row of rows) void notifyDispatchRequestClosure({ request: row, note, mode: 'closed', userId: args.userId, role: args.role })
    }
    return rows.length
  } catch (e) {
    console.warn('close open_job_from_bid dispatch requests failed', e)
    return 0
  }
}
