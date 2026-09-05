import { supabase } from './supabase'
import { GC_STATEMENT_EMAIL_TYPES } from './gcStatementSendDedupe'
import type { GcStatementAppSendRow, GcStatementSendLogRow } from './jobs/gcStatementSendHistory'

/**
 * IO for the per-GC "What went out" list (journey-map #45). Two reads, both
 * fail-soft to empty: the GC's app-sent statement audit rows, then the matching
 * `email_send_log` rows (lane + delivery status) by Resend id — readable to the
 * office for the two statement email types since migration 20260905190000; a
 * client ahead of the push simply sees "App email" with no status.
 */
export async function listGcStatementAppSends(gcCustomerId: string, limit = 60): Promise<GcStatementAppSendRow[]> {
  const { data, error } = await supabase
    .from('gc_statement_emails')
    .select('id, gc_name, group_by, sent_to, subject, total, job_count, sent_by_name, resend_email_id, sent_at, cc_emails')
    .eq('gc_customer_id', gcCustomerId)
    .order('sent_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return (data ?? []) as GcStatementAppSendRow[]
}

export async function listGcStatementSendLog(resendEmailIds: ReadonlyArray<string>): Promise<GcStatementSendLogRow[]> {
  const ids = resendEmailIds.filter((id) => typeof id === 'string' && id.trim())
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('email_send_log')
    .select('resend_email_id, email_type, last_event')
    .in('resend_email_id', ids)
    .in('email_type', [GC_STATEMENT_EMAIL_TYPES.manual, GC_STATEMENT_EMAIL_TYPES.scheduled])
  if (error) return []
  return (data ?? []) as GcStatementSendLogRow[]
}
