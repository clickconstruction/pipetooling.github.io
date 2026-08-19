/**
 * Client helpers for the paid-job-email edge function (v2.970): preview/test/
 * ad-hoc sends shared by the Stages "Paid notifications" gear modal and the
 * Job Detail ✉ modal, so the two surfaces can't drift.
 */
import { supabase } from './supabase'

/** Open rendered email HTML in a new tab (popup-blocked fallback: Blob URL). */
export function openHtmlInNewTab(html: string): void {
  const w = window.open('', '_blank')
  if (w) {
    w.document.write(html)
    w.document.close()
    return
  }
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

type FnResult = { data: unknown; error: { message?: string } | null }

function fnError(r: FnResult, fallback: string): string | null {
  if (r.error) return r.error.message || fallback
  const d = r.data as { error?: string } | null
  if (d && typeof d.error === 'string' && d.error) return d.error
  return null
}

/**
 * mode 'preview' — returns the rendered HTML (throws with a readable message on
 * failure). `kind: 'ready_to_bill'` renders the Ready to Bill template instead
 * of the paid one (v2.1836); omitted = paid/payment (shared template).
 */
export async function fetchPaidJobEmailPreview(
  jobId: string,
  variant: 'detailed' | 'summary',
  kind?: 'ready_to_bill',
): Promise<string> {
  const r = (await supabase.functions.invoke('paid-job-email', {
    body: { mode: 'preview', job_id: jobId, variant, ...(kind ? { kind } : {}) },
  })) as FnResult
  const err = fnError(r, 'Preview failed')
  if (err) throw new Error(err)
  const html = (r.data as { html?: string } | null)?.html
  if (!html) throw new Error('Preview returned no HTML')
  return html
}

/** mode 'test_send' — the detailed variant to the caller's own email, [TEST]-prefixed. */
export async function sendPaidJobEmailTest(jobId: string, kind?: 'ready_to_bill'): Promise<void> {
  const r = (await supabase.functions.invoke('paid-job-email', {
    body: { mode: 'test_send', job_id: jobId, ...(kind ? { kind } : {}) },
  })) as FnResult
  const err = fnError(r, 'Test send failed')
  if (err) throw new Error(err)
}

/**
 * mode 'test_push' — a Ready to Bill web-push to the CALLER's own devices only
 * (v2.1836). Resolves to how many devices were reached (0 = none subscribed).
 */
export async function sendReadyToBillPushTest(jobId: string): Promise<number> {
  const r = (await supabase.functions.invoke('paid-job-email', {
    body: { mode: 'test_push', job_id: jobId },
  })) as FnResult
  const err = fnError(r, 'Test push failed')
  if (err) throw new Error(err)
  const sent = (r.data as { push_sent?: number } | null)?.push_sent
  return typeof sent === 'number' ? sent : 0
}

/** mode 'send_to' — REAL email to a chosen user; the recipient's role picks the variant. */
export async function sendPaidJobEmailTo(jobId: string, recipientUserId: string): Promise<'detailed' | 'summary'> {
  const r = (await supabase.functions.invoke('paid-job-email', {
    body: { mode: 'send_to', job_id: jobId, recipient_user_id: recipientUserId },
  })) as FnResult
  const err = fnError(r, 'Send failed')
  if (err) throw new Error(err)
  return (r.data as { variant?: string } | null)?.variant === 'summary' ? 'summary' : 'detailed'
}
