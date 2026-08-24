/**
 * Client helpers for the payment-forecast-email-dispatch edge function + the
 * payment_forecast_email_requests table (v2.2226) — used by the Payment
 * forecast modal's Email… share modal (PaymentForecastShareModal).
 *
 * Immediate sends and previews go through the edge function (caller JWT,
 * staff gate); SCHEDULED sends are a plain table insert — the pg_cron
 * dispatcher (every 5 min) picks rows up when send_at arrives and rebuilds
 * the forecast at send time. Same shape as billedReportEmailClient.ts.
 */
import { supabase } from './supabase'
import { openHtmlInNewTab } from './paidJobEmailClient'

export { openHtmlInNewTab }

type FnResult = { data: unknown; error: { message?: string } | null }

function fnError(r: FnResult, fallback: string): string | null {
  if (r.error) return r.error.message || fallback
  const d = r.data as { error?: string } | null
  if (d && typeof d.error === 'string' && d.error) return d.error
  return null
}

/**
 * Who may RECEIVE the forecast — office-capable roles (it carries the same AR
 * dollars as the billed report). Keep in sync with RECIPIENT_ROLES in
 * supabase/functions/payment-forecast-email-dispatch/index.ts (the server
 * enforces; this filters the picker so users can't select someone the server
 * rejects).
 */
export function isPaymentForecastRecipientRole(role: string | null | undefined): boolean {
  return (
    role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'controller' || role === 'primary'
  )
}

/** mode 'preview' — the rendered forecast email HTML (throws with a readable message). */
export async function fetchPaymentForecastPreview(): Promise<string> {
  const r = (await supabase.functions.invoke('payment-forecast-email-dispatch', {
    body: { mode: 'preview' },
  })) as FnResult
  const err = fnError(r, 'Preview failed')
  if (err) throw new Error(err)
  const html = (r.data as { html?: string } | null)?.html
  if (!html) throw new Error('Preview returned no HTML')
  return html
}

/** mode 'test_send' — the forecast to the caller's own email, [TEST]-prefixed. */
export async function sendPaymentForecastTest(): Promise<void> {
  const r = (await supabase.functions.invoke('payment-forecast-email-dispatch', {
    body: { mode: 'test_send' },
  })) as FnResult
  const err = fnError(r, 'Test send failed')
  if (err) throw new Error(err)
}

/** mode 'send_now' — REAL email to a chosen office-capable user, immediately. */
export async function sendPaymentForecastNow(recipientUserId: string): Promise<void> {
  const r = (await supabase.functions.invoke('payment-forecast-email-dispatch', {
    body: { mode: 'send_now', recipient_user_id: recipientUserId },
  })) as FnResult
  const err = fnError(r, 'Send failed')
  if (err) throw new Error(err)
}

/** Queue a scheduled send (cron dispatches within ~5 min of send_at). */
export async function schedulePaymentForecastSend(input: {
  requestedBy: string
  recipientUserId: string
  sendAtIso: string
  /** Weekly chain: dispatch re-enqueues +7d on each successful send. */
  repeatWeekly?: boolean
}): Promise<void> {
  const { error } = await supabase.from('payment_forecast_email_requests').insert({
    requested_by: input.requestedBy,
    recipient_user_id: input.recipientUserId,
    send_at: input.sendAtIso,
    repeat_weekly: input.repeatWeekly ?? false,
  })
  if (error) throw new Error(error.message)
}

export type ScheduledPaymentForecastSend = {
  id: string
  recipient_user_id: string
  send_at: string
  sent_at: string | null
  error: string | null
  repeat_weekly: boolean
}

/** The caller's pending (unsent) scheduled sends, soonest first. */
export async function listMyPendingPaymentForecastSends(): Promise<ScheduledPaymentForecastSend[]> {
  const { data, error } = await supabase
    .from('payment_forecast_email_requests')
    .select('id, recipient_user_id, send_at, sent_at, error, repeat_weekly')
    .is('sent_at', null)
    .order('send_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ScheduledPaymentForecastSend[]
}

/** Cancel = delete an unsent request (RLS: creator-only, unsent-only). */
export async function cancelPaymentForecastSend(id: string): Promise<void> {
  const { error } = await supabase.from('payment_forecast_email_requests').delete().eq('id', id).is('sent_at', null)
  if (error) throw new Error(error.message)
}
