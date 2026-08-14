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

/** The supply house(s) the requester wants the job account at (v2.1615, optional). */
export type RequestedSupplyHouse = { id: string; label: string; email: string }

export type OpenFindOwnerRequest = {
  id: string
  created_at: string
  requestedSupplyHouses: RequestedSupplyHouse[]
}

/** pending_payload shape for find_property_owner (kept small and forward-tolerant). */
export function buildFindOwnerPendingPayload(
  supplyHouses: readonly RequestedSupplyHouse[]
): { supply_houses: RequestedSupplyHouse[] } | null {
  const rows = supplyHouses
    .map((s) => ({ id: s.id.trim(), label: s.label.trim(), email: s.email.trim() }))
    .filter((s) => s.id && s.label)
  return rows.length > 0 ? { supply_houses: rows } : null
}

/** Inverse of buildFindOwnerPendingPayload — tolerant of missing/foreign payloads. */
export function parseFindOwnerPendingPayload(payload: unknown): RequestedSupplyHouse[] {
  if (!payload || typeof payload !== 'object') return []
  const list = (payload as { supply_houses?: unknown }).supply_houses
  if (!Array.isArray(list)) return []
  const out: RequestedSupplyHouse[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const s = item as { id?: unknown; label?: unknown; email?: unknown }
    const id = typeof s.id === 'string' ? s.id.trim() : ''
    const label = typeof s.label === 'string' ? s.label.trim() : ''
    if (!id || !label) continue
    out.push({ id, label, email: typeof s.email === 'string' ? s.email.trim() : '' })
  }
  return out
}

/** Request title; names the wanted supply house(s) so the inbox card reads the intent with no card changes. */
export function findOwnerRequestTitle(jobLabel: string, supplyHouses: readonly RequestedSupplyHouse[]): string {
  const base = `Find the property owner for ${jobLabel} (name/company + mailing address), then open Job Detail → Share with supply house and send the job account`
  const labels = supplyHouses.map((s) => s.label.trim()).filter(Boolean)
  return labels.length > 0 ? `${base} to ${labels.join(', ')}.` : `${base}.`
}

/** The open find-owner request for a job, if any (drives the modal's "Dispatch is on it" state). */
export async function fetchOpenFindOwnerRequest(
  jobId: string
): Promise<OpenFindOwnerRequest | null> {
  try {
    const row = await withSupabaseRetry<{ id: string; created_at: string; pending_payload: unknown } | null>(
      async () =>
        supabase
          .from('dispatch_requests')
          .select('id, created_at, pending_payload')
          .eq('job_ledger_id', jobId)
          .eq('pending_action', FIND_PROPERTY_OWNER_ACTION)
          .eq('status', 'open')
          .limit(1)
          .maybeSingle(),
      'check existing find_property_owner dispatch request'
    )
    if (!row) return null
    return {
      id: row.id,
      created_at: row.created_at,
      requestedSupplyHouses: parseFindOwnerPendingPayload(row.pending_payload),
    }
  } catch {
    return null
  }
}

export async function submitFindPropertyOwnerDispatchRequestForJob(
  authUserId: string | null | undefined,
  showToast: ToastFn,
  args: {
    jobId: string
    jobLabel: string
    jobAddress: string | null | undefined
    /** Optional (v2.1615): which supply house(s) the requester wants the account at. */
    supplyHouses?: readonly RequestedSupplyHouse[]
  }
): Promise<OpenFindOwnerRequest | null> {
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
    const wanted = args.supplyHouses ?? []
    const payload = buildFindOwnerPendingPayload(wanted)
    const title = findOwnerRequestTitle(args.jobLabel, wanted)
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
            pending_payload: payload,
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
    return { id: row.id, created_at: row.created_at, requestedSupplyHouses: parseFindOwnerPendingPayload(payload) }
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
