import { supabase } from '../supabase'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import { notifyDispatchRequestsChanged } from '../dispatchRequestHelpers'
import {
  OPEN_JOB_ACCOUNT_ACTION,
  buildOpenJobAccountPayload,
  openJobAccountRequestTitle,
  parseOpenJobAccountPayload,
  type RequestedJobAccountHouse,
} from './jobAccountStrip'

type ToastFn = (message: string, type: 'success' | 'info' | 'warning' | 'error') => void

export type OpenJobAccountRequest = { id: string; created_at: string; houses: RequestedJobAccountHouse[] }

/**
 * The field's one-tap ask (v2.3424): "open a job account at Ferguson for 964,
 * I'm at the counter". Writes a `requested` row per house the job has none
 * at (RLS: any job reader, as themselves), then files ONE dispatch request
 * for the job — an open request for the same job takes the new houses
 * instead of a second card. Best-effort push to the group, toast either way.
 * Mirrors findPropertyOwnerDispatchRequest.
 */
export async function fetchOpenJobAccountRequest(jobId: string): Promise<OpenJobAccountRequest | null> {
  try {
    const row = await withSupabaseRetry<{ id: string; created_at: string; pending_payload: unknown } | null>(
      async () =>
        supabase
          .from('dispatch_requests')
          .select('id, created_at, pending_payload')
          .eq('job_ledger_id', jobId)
          .eq('pending_action', OPEN_JOB_ACCOUNT_ACTION)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      'check existing open_job_account dispatch request',
    )
    if (!row) return null
    return { id: row.id, created_at: row.created_at, houses: parseOpenJobAccountPayload(row.pending_payload).supply_houses }
  } catch {
    return null
  }
}

export async function submitOpenJobAccountRequest(
  authUserId: string | null | undefined,
  showToast: ToastFn,
  args: {
    jobId: string
    jobLabel: string
    jobAddress: string | null | undefined
    houses: readonly RequestedJobAccountHouse[]
    fromCounter: boolean
    note: string
  },
): Promise<OpenJobAccountRequest | null> {
  if (!authUserId) {
    showToast('Sign in to ask the office.', 'error')
    return null
  }
  const jobId = args.jobId.trim()
  const payload = buildOpenJobAccountPayload({ houses: args.houses, fromCounter: args.fromCounter, note: args.note })
  if (!jobId || !payload) {
    showToast('Pick at least one supply house.', 'error')
    return null
  }
  try {
    // 1 · the status on the job: requested, as this user, for every house asked.
    await withSupabaseRetry(
      async () =>
        supabase.from('job_supply_house_accounts').upsert(
          payload.supply_houses.map((h) => ({
            job_id: jobId,
            supply_house_id: h.id,
            status: 'requested',
            requested_by: authUserId,
            requested_from_counter: payload.from_counter,
            note: payload.note,
          })),
          { onConflict: 'job_id,supply_house_id', ignoreDuplicates: true },
        ),
      'insert requested job_supply_house_accounts rows',
    )

    // 2 · the errand — one open card per job; a second ask adds its houses to the first.
    const existing = await fetchOpenJobAccountRequest(jobId)
    if (existing) {
      const merged = [...existing.houses]
      for (const h of payload.supply_houses) if (!merged.some((m) => m.id === h.id)) merged.push(h)
      const mergedPayload = buildOpenJobAccountPayload({ houses: merged, fromCounter: payload.from_counter || false, note: payload.note })
      await withSupabaseRetry(
        async () =>
          supabase
            .from('dispatch_requests')
            .update({ pending_payload: mergedPayload, title: openJobAccountRequestTitle(args.jobLabel, merged, payload.from_counter) })
            .eq('id', existing.id),
        'merge open_job_account dispatch request',
      )
      notifyDispatchRequestsChanged()
      showToast('Dispatch is already on this job — your houses were added to their card.', 'info')
      return { id: existing.id, created_at: existing.created_at, houses: merged }
    }
    const address = (args.jobAddress ?? '').trim()
    const row = await withSupabaseRetry<{ id: string; created_at: string }>(
      async () =>
        supabase
          .from('dispatch_requests')
          .insert({
            from_user_id: authUserId,
            title: openJobAccountRequestTitle(args.jobLabel, payload.supply_houses, payload.from_counter),
            links: [],
            job_ledger_id: jobId,
            bid_id: null,
            reference_summary: address ? `${args.jobLabel} - ${address}` : args.jobLabel,
            pending_action: OPEN_JOB_ACCOUNT_ACTION,
            pending_payload: payload,
          })
          .select('id, created_at')
          .single(),
      'insert open_job_account dispatch request',
    )
    if (!row?.id) {
      showToast('Could not send to Dispatch.', 'error')
      return null
    }
    void supabase.functions.invoke('notify-dispatch-request', { body: { dispatch_request_id: row.id } })
    notifyDispatchRequestsChanged()
    showToast(payload.from_counter ? 'Sent to Dispatch — they know you are at the counter.' : 'Sent to Dispatch — you will get a push when it is open.', 'success')
    return { id: row.id, created_at: row.created_at, houses: payload.supply_houses }
  } catch (e) {
    showToast(formatErrorMessage(e, 'Failed to send to Dispatch'), 'error')
    return null
  }
}

/** The office closes the errand once the account is marked open / not needed (best-effort; the card can be closed by hand too). */
export async function closeOpenJobAccountRequests(jobId: string, authUserId: string, note: string): Promise<void> {
  try {
    await withSupabaseRetry(
      async () =>
        supabase
          .from('dispatch_requests')
          .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by_user_id: authUserId, closed_note: note })
          .eq('job_ledger_id', jobId)
          .eq('pending_action', OPEN_JOB_ACCOUNT_ACTION)
          .eq('status', 'open'),
      'self-close open_job_account dispatch request',
    )
    notifyDispatchRequestsChanged()
  } catch (e) {
    console.warn('self-close open_job_account dispatch request failed', e)
  }
}
