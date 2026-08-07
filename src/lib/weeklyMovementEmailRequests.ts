import { supabase } from './supabase'

/**
 * IO for weekly_movement_email_requests (v2.1438, weekly_movement Report
 * Subscriptions stream). Direct RLS-gated writes; the cron dispatcher
 * (weekly-movement-email-dispatch) does the sending — each send covers the
 * PREVIOUS complete Central week. Mirrors billedReportEmailClient's request
 * functions (internal recipients).
 */

export type PendingWeeklyMovementSend = {
  id: string
  recipient_user_id: string
  send_at: string
  repeat_weekly: boolean
}

export async function scheduleWeeklyMovementSend(input: {
  requestedBy: string
  recipientUserId: string
  sendAtIso: string
  repeatWeekly: boolean
}): Promise<void> {
  const { error } = await supabase.from('weekly_movement_email_requests').insert({
    requested_by: input.requestedBy,
    recipient_user_id: input.recipientUserId,
    send_at: input.sendAtIso,
    repeat_weekly: input.repeatWeekly,
  })
  if (error) throw new Error(error.message)
}

/** The caller's pending (unsent) scheduled sends, soonest first. */
export async function listMyPendingWeeklyMovementSends(): Promise<PendingWeeklyMovementSend[]> {
  const { data, error } = await supabase
    .from('weekly_movement_email_requests')
    .select('id, recipient_user_id, send_at, repeat_weekly')
    .is('sent_at', null)
    .order('send_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as PendingWeeklyMovementSend[]
}

/** Cancel = delete an unsent request (RLS: creator-only, unsent-only). Ends a weekly chain. */
export async function cancelWeeklyMovementSend(id: string): Promise<void> {
  const { error } = await supabase.from('weekly_movement_email_requests').delete().eq('id', id).is('sent_at', null)
  if (error) throw new Error(error.message)
}
