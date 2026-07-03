/**
 * Client helpers for creating Task Dispatch inbox items (dispatch_requests) — the insert +
 * notify-dispatch-request push pattern extracted from Dashboard's link-job-pictures flow.
 */

import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { formatCurrency } from './format'

/** dispatch_requests.title max length (DB check constraint). */
const TITLE_MAX = 2000

/** Title for a "bill this job out" dispatch request; the title IS the inbox message. */
export function buildUnbilledDispatchTitle(label: string, amount: number, note: string): string {
  const base = `Not billed out: ${label} — $${formatCurrency(amount)}`
  const trimmedNote = note.trim()
  const full = trimmedNote ? `${base}. ${trimmedNote}` : base
  return full.length > TITLE_MAX ? `${full.slice(0, TITLE_MAX - 1)}…` : full
}

export type CreateDispatchRequestResult =
  | { outcome: 'created'; id: string }
  | { outcome: 'duplicate' }

/**
 * Insert a dispatch request and fire the Web Push to Dispatch members (fire-and-forget —
 * the task exists even if the push fails). When `pendingAction` is set, an open request with
 * the same action + job is treated as a duplicate and no new row is created.
 */
export async function createDispatchRequest(args: {
  fromUserId: string
  title: string
  jobId?: string | null
  bidId?: string | null
  referenceSummary?: string | null
  pendingAction?: string | null
}): Promise<CreateDispatchRequestResult> {
  const title = args.title.trim()
  if (!title) throw new Error('Title is required')

  if (args.pendingAction && args.jobId) {
    const existing = await withSupabaseRetry<{ id: string } | null>(
      async () =>
        supabase
          .from('dispatch_requests')
          .select('id')
          .eq('job_ledger_id', args.jobId as string)
          .eq('pending_action', args.pendingAction as string)
          .eq('status', 'open')
          .limit(1)
          .maybeSingle(),
      'check existing dispatch request',
    )
    if (existing?.id) return { outcome: 'duplicate' }
  }

  const row = await withSupabaseRetry<{ id: string }>(
    async () =>
      supabase
        .from('dispatch_requests')
        .insert({
          from_user_id: args.fromUserId,
          title,
          links: [],
          job_ledger_id: args.jobId ?? null,
          bid_id: args.bidId ?? null,
          reference_summary: args.referenceSummary?.trim() || null,
          pending_action: args.pendingAction ?? null,
        })
        .select('id')
        .single(),
    'insert dispatch request',
  )
  if (!row?.id) throw new Error('Could not create the dispatch request')

  void supabase.functions.invoke('notify-dispatch-request', {
    body: { dispatch_request_id: row.id },
  })

  return { outcome: 'created', id: row.id }
}
