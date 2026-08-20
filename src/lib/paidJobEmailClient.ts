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

type FnResult = { data: unknown; error: { message?: string; context?: unknown } | null }

/**
 * Extract the function's REAL error text (v2.1867). On a non-2xx response,
 * supabase-js raises FunctionsHttpError whose .message is the useless generic
 * "Edge Function returned a non-2xx status code" — the actual reason lives in
 * the response body ({ error: "…" }), reachable via error.context (a Response).
 */
async function fnError(r: FnResult, fallback: string): Promise<string | null> {
  if (r.error) {
    const ctx = r.error.context
    if (ctx instanceof Response) {
      try {
        const body = (await ctx.clone().json()) as { error?: string } | null
        if (body && typeof body.error === 'string' && body.error) return body.error
      } catch {
        // unreadable body — fall through to the generic message
      }
    }
    return r.error.message || fallback
  }
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
  const err = await fnError(r, 'Preview failed')
  if (err) throw new Error(err)
  const html = (r.data as { html?: string } | null)?.html
  if (!html) throw new Error('Preview returned no HTML')
  return html
}

/**
 * mode 'test_send' — a [TEST]-prefixed email. Default: the detailed variant to
 * the caller's own address. With `recipientUserId` (ready_to_bill only,
 * v2.1844) it goes to that user instead, variant picked by THEIR role — a
 * tester can never mail financials to a summary-tier teammate.
 */
export async function sendPaidJobEmailTest(
  jobId: string,
  kind?: 'ready_to_bill',
  recipientUserId?: string,
): Promise<void> {
  const r = (await supabase.functions.invoke('paid-job-email', {
    body: {
      mode: 'test_send',
      job_id: jobId,
      ...(kind ? { kind } : {}),
      ...(recipientUserId ? { recipient_user_id: recipientUserId } : {}),
    },
  })) as FnResult
  const err = await fnError(r, 'Test send failed')
  if (err) throw new Error(err)
}

/**
 * mode 'test_push' — a [TEST]-prefixed Ready to Bill web-push (v2.1836).
 * Default: the caller's own devices; with `recipientUserId` (v2.1844), that
 * user's devices. Resolves to how many devices were reached (0 = none
 * subscribed).
 */
export async function sendReadyToBillPushTest(jobId: string, recipientUserId?: string): Promise<number> {
  const r = (await supabase.functions.invoke('paid-job-email', {
    body: {
      mode: 'test_push',
      job_id: jobId,
      ...(recipientUserId ? { recipient_user_id: recipientUserId } : {}),
    },
  })) as FnResult
  const err = await fnError(r, 'Test push failed')
  if (err) throw new Error(err)
  const sent = (r.data as { push_sent?: number } | null)?.push_sent
  return typeof sent === 'number' ? sent : 0
}

/** mode 'send_to' — REAL email to a chosen user; the recipient's role picks the variant. */
export async function sendPaidJobEmailTo(jobId: string, recipientUserId: string): Promise<'detailed' | 'summary'> {
  const r = (await supabase.functions.invoke('paid-job-email', {
    body: { mode: 'send_to', job_id: jobId, recipient_user_id: recipientUserId },
  })) as FnResult
  const err = await fnError(r, 'Send failed')
  if (err) throw new Error(err)
  return (r.data as { variant?: string } | null)?.variant === 'summary' ? 'summary' : 'detailed'
}
