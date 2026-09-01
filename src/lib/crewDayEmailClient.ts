/**
 * Client helpers for the crew-day-email-dispatch edge function + the
 * crew_day_email_requests table (v2.2603) — used by the Crew Day card's
 * email modal (CrewDayEmailModal). Protocol clone of
 * moneyWaitingEmailClient.ts (the reference).
 *
 * Immediate sends and previews go through the edge function (caller JWT,
 * crew-day-eligible gate — superintendents included); SCHEDULED sends are a
 * plain table insert — the pg_cron dispatcher (every 5 min) picks rows up
 * when send_at arrives and rebuilds that RECIPIENT's crew day at send time.
 */
import { supabase } from './supabase'
import { openHtmlInNewTab } from './paidJobEmailClient'
import { isCrewDayRole } from './crewDay'

export { openHtmlInNewTab }

type FnResult = { data: unknown; error: { message?: string } | null }

function fnError(r: FnResult, fallback: string): string | null {
  if (r.error) return r.error.message || fallback
  const d = r.data as { error?: string } | null
  if (d && typeof d.error === 'string' && d.error) return d.error
  return null
}

/**
 * Who may RECEIVE the email — the crew-day set (each email is rebuilt for the
 * recipient's own scope). Keep in sync with RECIPIENT_ROLES in
 * supabase/functions/crew-day-email-dispatch/index.ts (the server enforces;
 * this filters the picker so users can't select someone the server rejects).
 */
export function isCrewDayEmailRecipientRole(role: string | null | undefined): boolean {
  return isCrewDayRole(role)
}

/** mode 'preview' — the rendered Crew Day email HTML for the CALLER's scope (throws with a readable message). */
export async function fetchCrewDayPreview(): Promise<string> {
  const r = (await supabase.functions.invoke('crew-day-email-dispatch', {
    body: { mode: 'preview' },
  })) as FnResult
  const err = fnError(r, 'Preview failed')
  if (err) throw new Error(err)
  const html = (r.data as { html?: string } | null)?.html
  if (!html) throw new Error('Preview returned no HTML')
  return html
}

/** mode 'test_send' — the email to the caller's own address, [TEST]-prefixed. */
export async function sendCrewDayTest(): Promise<void> {
  const r = (await supabase.functions.invoke('crew-day-email-dispatch', {
    body: { mode: 'test_send' },
  })) as FnResult
  const err = fnError(r, 'Test send failed')
  if (err) throw new Error(err)
}

/** mode 'send_now' — REAL email to a chosen eligible user (their scope), immediately. */
export async function sendCrewDayNow(recipientUserId: string): Promise<void> {
  const r = (await supabase.functions.invoke('crew-day-email-dispatch', {
    body: { mode: 'send_now', recipient_user_id: recipientUserId },
  })) as FnResult
  const err = fnError(r, 'Send failed')
  if (err) throw new Error(err)
}

/** Queue a scheduled send (cron dispatches within ~5 min of send_at). */
export async function scheduleCrewDaySend(input: {
  requestedBy: string
  recipientUserId: string
  sendAtIso: string
  /** Weekly chain: dispatch re-enqueues +7d on each successful send. */
  repeatWeekly?: boolean
}): Promise<void> {
  // Table not in generated types yet — house `as never` pattern (dispatchSwimLanes).
  const { error } = await supabase.from('crew_day_email_requests' as never).insert({
    requested_by: input.requestedBy,
    recipient_user_id: input.recipientUserId,
    send_at: input.sendAtIso,
    repeat_weekly: input.repeatWeekly ?? false,
  } as never)
  if (error) throw new Error(error.message)
}

export type ScheduledCrewDaySend = {
  id: string
  recipient_user_id: string
  send_at: string
  sent_at: string | null
  error: string | null
  repeat_weekly: boolean
}

/** The caller's pending (unsent) scheduled sends, soonest first. */
export async function listMyPendingCrewDaySends(): Promise<ScheduledCrewDaySend[]> {
  const { data, error } = await supabase
    .from('crew_day_email_requests' as never)
    .select('id, recipient_user_id, send_at, sent_at, error, repeat_weekly')
    .is('sent_at', null)
    .order('send_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as ScheduledCrewDaySend[]
}

/** Cancel = delete an unsent request (RLS: creator-only, unsent-only). */
export async function cancelCrewDaySend(id: string): Promise<void> {
  const { error } = await supabase.from('crew_day_email_requests' as never).delete().eq('id', id).is('sent_at', null)
  if (error) throw new Error(error.message)
}
