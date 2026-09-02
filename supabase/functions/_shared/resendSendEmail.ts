/** Shared Resend outbound helper (same contract as send-estimate-to-customer). */

import { logEmailSendBestEffort } from './logEmailSend.ts'
import { EMAIL_FROM } from './emailFrom.ts'

const PIPETOOLING_FROM = EMAIL_FROM

export async function sendEmailViaResend(
  to: string,
  subject: string,
  textPlain: string,
  htmlBody: string,
  resendApiKey: string,
  options?: { replyTo?: string },
): Promise<{ success: boolean; error?: string; resendEmailId?: string }> {
  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: PIPETOOLING_FROM,
      to: [to],
      subject,
      html: htmlBody,
      text: textPlain,
      ...(options?.replyTo ? { reply_to: options.replyTo } : {}),
    }),
  })
  if (!resendResponse.ok) {
    const errorData = await resendResponse.json().catch(() => ({} as { message?: string }))
    return { success: false, error: errorData.message || `Resend ${resendResponse.status}` }
  }
  const sent = (await resendResponse.json().catch(() => ({}))) as { id?: string }
  await logEmailSendBestEffort({ resendEmailId: sent.id ?? null, to: [to], from: PIPETOOLING_FROM, subject })
  return { success: true, resendEmailId: sent.id }
}
