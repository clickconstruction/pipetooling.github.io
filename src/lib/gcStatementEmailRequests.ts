import { supabase } from './supabase'
import type { GcStatementRequestInsert, PendingGcStatementSend } from './gcStatementSchedule'

/**
 * IO for gc_statement_email_requests (v2.1427, Phase 3 of the gc_statement
 * Report Subscriptions stream). Scheduling and cancelling are direct
 * RLS-gated writes — the cron dispatcher (gc-statement-email-dispatch) does
 * the sending. Mirrors billedReportEmailClient's request functions.
 */

export async function scheduleGcStatementSend(row: GcStatementRequestInsert): Promise<void> {
  const { error } = await supabase.from('gc_statement_email_requests').insert(row)
  if (error) throw new Error(error.message)
}

/**
 * Every pending (unsent) scheduled statement send the caller may read, soonest
 * first. Since journey-map #45 (migration 20260905190000) that is the whole
 * office cohort's view — not just the caller's own rows — so the GC Review box
 * answers "is anything already going out this week?" for whoever runs the
 * round. Cancel remains requester-or-dev (RLS DELETE policy unchanged); use
 * `canCancelStatementRequest` for the button state.
 */
export async function listPendingStatementRequests(): Promise<PendingGcStatementSend[]> {
  const { data, error } = await supabase
    .from('gc_statement_email_requests')
    .select('id, requested_by, sent_to, group_by, gc_customer_id, development_id, entity_name, include_collections, send_at, repeat_weekly')
    .is('sent_at', null)
    .order('send_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as PendingGcStatementSend[]
}

/** Owner-only Cancel (journey-map #45): the requester, or a dev. Mirrors the RLS DELETE policy so the button never promises what the row refuses. */
export function canCancelStatementRequest(
  row: Pick<PendingGcStatementSend, 'requested_by'>,
  viewer: { id: string | null | undefined; isDev: boolean },
): boolean {
  if (viewer.isDev) return true
  return !!viewer.id && row.requested_by === viewer.id
}

/** Cancel = delete an unsent request (RLS: creator-only, unsent-only). Ends a weekly chain. */
export async function cancelGcStatementSend(id: string): Promise<void> {
  const { error } = await supabase.from('gc_statement_email_requests').delete().eq('id', id).is('sent_at', null)
  if (error) throw new Error(error.message)
}
