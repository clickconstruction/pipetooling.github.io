/**
 * The bill share's doors through the company (punch list #125 PR 6, v2.6710). Until this, the share row under a sent
 * Stripe bill (`StripeInvoiceSharePanel`, drawn on the Job window's Bills tab, in View bill and after Bill Customer
 * makes a Stripe bill) handed both sends to the person's own apps: **Open in email app** opened a `mailto:` with the
 * draft, and the text draft's **Copy** left the words to paste into the phone's texts. Nothing landed in the customer's
 * thread and the answer went to that person. Now the email goes through `messages-email` from the draft window
 * (`supabaseReplyIo().sendEmail`, its Reply-To the office's box, the sent copy filed) and the text opens the customer's
 * box on Text (`ContractTextDoor`, PR 5's door) with the bill's words and its pay link filled, where the box's send
 * window is the confirm. This kernel holds the rule for which address the email goes to and the words around the doors.
 */
import { normalizeChannel, type Contact, type ContactChannel } from '../contacts/kernel'

/** The head of the text door: the customer's box with the bill's pay link in it. */
export const BILL_TEXT_DOOR_TITLE = 'Text the pay link'

/** The draft window's send press: the words are on the screen, so the press is the confirm and names the act. */
export const BILL_EMAIL_SEND_LABEL = 'Send the email'
export const BILL_EMAIL_SENDING_LABEL = 'Sending…'

/** Whether the row draws the two doors through the company: it needs the job and its customer, and a caller that hands neither keeps the copy-only row. */
export function billShareDoorsOffered(p: { jobId?: string | null; customerId?: string | null }): boolean {
  return Boolean((p.jobId ?? '').trim() && (p.customerId ?? '').trim())
}

/**
 * The address the bill's email goes to: the contact's email channel that is the job's customer email (compared as the
 * spine compares, in lower case), else the first email on the contact, else null when the contact has none.
 */
export function billEmailChannel(contact: Pick<Contact, 'channels'>, preferred: string | null | undefined): ContactChannel | null {
  const emails = contact.channels.filter((ch) => ch.kind === 'email')
  const key = normalizeChannel('email', preferred ?? '')
  if (key) {
    const same = emails.find((ch) => normalizeChannel('email', ch.value) === key)
    if (same) return same
  }
  return emails[0] ?? null
}

/** The refusal when the contact has no email: the row's own hint says where one is added. */
export function noEmailOnContactWords(first: string): string {
  return `${first}’s contact has no email yet, so the office cannot email the bill. Add one on the Job tab.`
}

/** The toast after the email went: where to read it. */
export function billEmailSentWords(address: string): string {
  return `The bill went to ${address} from the office. It is in their thread and in the job’s activity.`
}
