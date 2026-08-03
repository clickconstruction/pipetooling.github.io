/**
 * Client helpers for the billed-report-email edge function + the
 * billed_report_email_requests table (v2.1316) — used by the Stages
 * "Share / Print" modal (BilledReportShareModal).
 *
 * Immediate sends and previews go through the edge function (caller JWT,
 * staff gate); SCHEDULED sends are a plain table insert — the pg_cron
 * dispatcher (every 5 min) picks rows up when send_at arrives and rebuilds the
 * report at send time.
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
 * Who may RECEIVE the report — office-capable roles (the report carries AR
 * dollars). Keep in sync with RECIPIENT_ROLES in
 * supabase/functions/billed-report-email/index.ts (the server enforces;
 * this filters the picker so users can't select someone the server rejects).
 */
export function isBilledReportRecipientRole(role: string | null | undefined): boolean {
  return (
    role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'controller' || role === 'primary'
  )
}

/** mode 'preview' — the rendered report HTML (throws with a readable message). */
export async function fetchBilledReportPreview(): Promise<string> {
  const r = (await supabase.functions.invoke('billed-report-email', { body: { mode: 'preview' } })) as FnResult
  const err = fnError(r, 'Preview failed')
  if (err) throw new Error(err)
  const html = (r.data as { html?: string } | null)?.html
  if (!html) throw new Error('Preview returned no HTML')
  return html
}

/** mode 'test_send' — the report to the caller's own email, [TEST]-prefixed. */
export async function sendBilledReportTest(): Promise<void> {
  const r = (await supabase.functions.invoke('billed-report-email', { body: { mode: 'test_send' } })) as FnResult
  const err = fnError(r, 'Test send failed')
  if (err) throw new Error(err)
}

/** mode 'send_now' — REAL email to a chosen office-capable user, immediately. */
export async function sendBilledReportNow(recipientUserId: string): Promise<void> {
  const r = (await supabase.functions.invoke('billed-report-email', {
    body: { mode: 'send_now', recipient_user_id: recipientUserId },
  })) as FnResult
  const err = fnError(r, 'Send failed')
  if (err) throw new Error(err)
}

/** Queue a scheduled send (cron dispatches within ~5 min of send_at). */
export async function scheduleBilledReportSend(input: {
  requestedBy: string
  recipientUserId: string
  sendAtIso: string
  /** Weekly chain (v2.1323): dispatch re-enqueues +7d on each successful send. */
  repeatWeekly?: boolean
}): Promise<void> {
  const { error } = await supabase.from('billed_report_email_requests').insert({
    requested_by: input.requestedBy,
    recipient_user_id: input.recipientUserId,
    send_at: input.sendAtIso,
    repeat_weekly: input.repeatWeekly ?? false,
  })
  if (error) throw new Error(error.message)
}

export type ScheduledBilledReportSend = {
  id: string
  recipient_user_id: string
  send_at: string
  sent_at: string | null
  error: string | null
  repeat_weekly: boolean
}

/** The caller's pending (unsent) scheduled sends, soonest first. */
export async function listMyPendingBilledReportSends(): Promise<ScheduledBilledReportSend[]> {
  const { data, error } = await supabase
    .from('billed_report_email_requests')
    .select('id, recipient_user_id, send_at, sent_at, error, repeat_weekly')
    .is('sent_at', null)
    .order('send_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ScheduledBilledReportSend[]
}

/** Cancel = delete an unsent request (RLS: creator-only, unsent-only). */
export async function cancelBilledReportSend(id: string): Promise<void> {
  const { error } = await supabase.from('billed_report_email_requests').delete().eq('id', id).is('sent_at', null)
  if (error) throw new Error(error.message)
}
