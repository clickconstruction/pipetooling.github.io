/** Shared Resend outbound helper (same contract as send-estimate-to-customer). */

import { logEmailSendBestEffort } from './logEmailSend.ts'
import { EMAIL_FROM } from './emailFrom.ts'

export async function sendEmailViaResend(
  to: string,
  subject: string,
  textPlain: string,
  htmlBody: string,
  resendApiKey: string,
  options?: { replyTo?: string; cc?: string[]; attachments?: Array<{ filename: string; content: string; /** Set on an inline image: the HTML loads it as `cid:<content_id>`. */ content_id?: string }>; /** EMAIL_CATALOG id stamped on email_send_log (v2.3359). */ emailType?: string; /** The sender mailbox — `COMPANY_EMAIL_FROM` for a customer-facing email (v2.4127); defaults to `EMAIL_FROM`. */ from?: string },
): Promise<{ success: boolean; error?: string; resendEmailId?: string }> {
  const from = options?.from?.trim() || EMAIL_FROM
  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html: htmlBody,
      text: textPlain,
      ...(options?.replyTo ? { reply_to: options.replyTo } : {}),
      ...(options?.cc && options.cc.length > 0 ? { cc: options.cc } : {}),
      // Resend attachments: base64 content + filename (send-lien-release-email precedent).
      ...(options?.attachments && options.attachments.length > 0 ? { attachments: options.attachments } : {}),
    }),
  })
  if (!resendResponse.ok) {
    const errorData = await resendResponse.json().catch(() => ({} as { message?: string }))
    return { success: false, error: errorData.message || `Resend ${resendResponse.status}` }
  }
  const sent = (await resendResponse.json().catch(() => ({}))) as { id?: string }
  await logEmailSendBestEffort({ resendEmailId: sent.id ?? null, to: [to, ...(options?.cc ?? [])], from, subject, emailType: options?.emailType ?? null })
  return { success: true, resendEmailId: sent.id }
}
