/**
 * The thread's line for the estimate email we sent (v2.6658, punch list #139's close-out walk). `/messages`' Went out
 * lane and the customer's thread read emails from `messages` (`channel: 'email'`, `direction: 'out'`), the rows the
 * reply box writes — and `send-estimate-to-customer` wrote none, so the lane's Emails door read *Nothing has gone out*
 * minutes after the sheet's receipt said *Email · dana@… · 1:31 PM*. After a send, a resend or a remail that Resend
 * accepted, one row lands on the customer's own thread (`findPageContact`, never made here): the subject the row's
 * words, the letter's plain text its body, the sender's name as who pressed it, the estimate and its job as the tie,
 * and the customer's email channel when the thread has one. Best effort: it logs and never throws, since the send
 * already went and the sheet must hear so.
 */
import { findPageContact } from './gcPortalThread.ts'

// deno-lint-ignore no-explicit-any
type Admin = any

export interface EstimateSentEmailInput {
  estimateId: string
  customerId: string | null | undefined
  jobLedgerId: string | null | undefined
  /** The address the letter went to. */
  to: string
  subject: string
  /** The letter as plain text. */
  body: string
  senderUserId: string
  senderName: string | null | undefined
}

/** The row as the thread keeps an email we sent: the reply box's shape, with the estimate tied on. */
export function estimateSentEmailRow(input: EstimateSentEmailInput, contactId: string, channelId: string | null): Record<string, unknown> {
  return {
    contact_id: contactId,
    channel_id: channelId,
    channel: 'email',
    direction: 'out',
    who_user_id: input.senderUserId,
    who_text: (input.senderName ?? '').trim(),
    subject: input.subject,
    body: input.body,
    estimate_id: input.estimateId,
    jobs_ledger_id: input.jobLedgerId ?? null,
  }
}

export async function writeEstimateSentEmailLine(admin: Admin, input: EstimateSentEmailInput): Promise<void> {
  try {
    if (!input.customerId) return
    const contactId = await findPageContact(admin, input.customerId)
    if (!contactId) return
    const channel = (await admin.from('contact_channels').select('id').eq('contact_id', contactId).eq('kind', 'email').eq('value', input.to).limit(1).maybeSingle()).data as { id: string } | null
    const { error } = await admin.from('messages').insert(estimateSentEmailRow(input, contactId, channel?.id ?? null))
    if (error) console.error('writeEstimateSentEmailLine', JSON.stringify(error))
  } catch (e) {
    console.error('writeEstimateSentEmailLine', e instanceof Error ? e.message : String(e))
  }
}
