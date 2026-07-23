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

/** mode 'preview' — returns the rendered HTML (throws with a readable message on failure). */
export async function fetchPaidJobEmailPreview(jobId: string, variant: 'detailed' | 'summary'): Promise<string> {
  const r = (await supabase.functions.invoke('paid-job-email', {
    body: { mode: 'preview', job_id: jobId, variant },
  })) as FnResult
  const err = fnError(r, 'Preview failed')
  if (err) throw new Error(err)
  const html = (r.data as { html?: string } | null)?.html
  if (!html) throw new Error('Preview returned no HTML')
  return html
}

/** mode 'test_send' — the detailed variant to the caller's own email, [TEST]-prefixed. */
export async function sendPaidJobEmailTest(jobId: string): Promise<void> {
  const r = (await supabase.functions.invoke('paid-job-email', {
    body: { mode: 'test_send', job_id: jobId },
  })) as FnResult
  const err = fnError(r, 'Test send failed')
  if (err) throw new Error(err)
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
