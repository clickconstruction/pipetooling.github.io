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

/** The caller's pending (unsent) scheduled statement sends, soonest first. */
export async function listMyPendingGcStatementSends(): Promise<PendingGcStatementSend[]> {
  const { data, error } = await supabase
    .from('gc_statement_email_requests')
    .select('id, sent_to, group_by, gc_customer_id, development_id, entity_name, include_collections, send_at, repeat_weekly')
    .is('sent_at', null)
    .order('send_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as PendingGcStatementSend[]
}

/** Cancel = delete an unsent request (RLS: creator-only, unsent-only). Ends a weekly chain. */
export async function cancelGcStatementSend(id: string): Promise<void> {
  const { error } = await supabase.from('gc_statement_email_requests').delete().eq('id', id).is('sent_at', null)
  if (error) throw new Error(error.message)
}
