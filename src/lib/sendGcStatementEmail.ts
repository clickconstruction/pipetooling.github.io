/**
 * The GC Review Email… dialog's transport (v2.1416): invoke
 * `send-gc-statement-email` with the dialog's payload and read its answer.
 * Moved out of the Stages tab in v2.5099 (the Stages map's step 7); the tab
 * keeps the toast and the last-sent re-read.
 */

import { supabase } from './supabase'
import type { SendGcStatementPayload } from '../components/jobs/JobsGcReviewModal'

/** `replyTo` is what the function echoes: undefined from a function older than "Replies go to" (punch list #49). */
export type SendGcStatementResult =
  | { ok: true; replyTo: string | null | undefined }
  | { ok: false; error: string }

/** The function's body. The QR copy rides only with the portal it opens. */
export function sendGcStatementRequestBody(p: SendGcStatementPayload): Record<string, unknown> {
  return {
    gc_customer_id: p.gcCustomerId,
    gc_name: p.gcName,
    group_by: p.groupBy,
    to_email: p.toEmail,
    cc_emails: p.ccEmails ?? [],
    subject: p.subject,
    email_html: p.emailHtml,
    ...(p.emailHtmlQr && p.portalUrl ? { email_html_qr: p.emailHtmlQr, portal_url: p.portalUrl } : {}),
    email_text: p.emailText,
    total: p.total,
    job_count: p.jobCount,
    reply_to_user_id: p.replyTo?.id ?? null,
  }
}

/** The function's own refusal wins over the transport's error. */
export function readSendGcStatementResponse(data: unknown, fnErr: { message?: string } | null): SendGcStatementResult {
  const resp = data as { success?: boolean; error?: string; reply_to?: string | null } | null
  if (resp && typeof resp.error === 'string' && resp.error.length > 0) {
    return { ok: false, error: resp.error }
  }
  if (fnErr) {
    return { ok: false, error: fnErr.message || 'Send failed' }
  }
  return { ok: true, replyTo: resp?.reply_to }
}

export async function sendGcStatementEmail(p: SendGcStatementPayload): Promise<SendGcStatementResult> {
  try {
    const { data, error } = await supabase.functions.invoke('send-gc-statement-email', { body: sendGcStatementRequestBody(p) })
    return readSendGcStatementResponse(data, error)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Send failed' }
  }
}
