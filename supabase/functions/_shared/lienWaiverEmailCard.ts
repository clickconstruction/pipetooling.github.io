/**
 * The waiver email's account card (v2.4304): a signed lien waiver emailed to the GC (or the
 * customer on a direct job) ends with the same "Your account, any time" card the bill emails
 * carry — the QR code beside the short address — when the recipient has a portal. Pure; the
 * function (`send-lien-release-email`) reads the links and attaches the code. Tested from
 * vitest (`src/lib/jobs/lienWaiverEmailCard.test.ts`).
 */
import { portalAccountCardHtml } from './portalAccountCard.ts'
import { GC_CUSTOMER_EMAIL_FROM_NAME } from './gcCustomerEmails.ts'
import { PORTAL_COMPANY } from './portalCompany.ts'

/**
 * The name the waiver email is from. GC mode's billing job (`jobs_ledger.billing_only`) sends as our GC
 * entity, as every GC customer email does. Every other job sends as the company, a sub job that bills a
 * GC (`gc_customer_id`) included.
 */
export function waiverEmailFromName(billingOnly: boolean): string {
  return billingOnly ? GC_CUSTOMER_EMAIL_FROM_NAME : PORTAL_COMPANY.name
}

/** The sentence under the address: the waiver email's own. */
export const WAIVER_EMAIL_CARD_BLURB = 'Every lien waiver and bill for your jobs, with no login.'

/**
 * Whose portal the card points at: the customer row the email goes to. The GC when the
 * recipient is the GC's billing email; the job's customer when it is the job's email.
 * Null when neither matches (the function has already refused that send).
 */
export function waiverEmailRecipientCustomerId(args: {
  recipientEmail: string
  jobCustomerId: string | null
  jobCustomerEmail: string | null
  gcCustomerId: string | null
  gcBillingEmail: string | null
}): string | null {
  const to = args.recipientEmail.trim().toLowerCase()
  if (!to) return null
  if (args.gcCustomerId && (args.gcBillingEmail ?? '').trim().toLowerCase() === to) return args.gcCustomerId
  if (args.jobCustomerId && (args.jobCustomerEmail ?? '').trim().toLowerCase() === to) return args.jobCustomerId
  return null
}

/** The email's HTML and text with the card added; unchanged without a portal. */
export function withWaiverAccountCard(
  bodies: { html: string; text: string },
  portalUrl: string | null,
  qrImgSrc: string | null,
): { html: string; text: string } {
  const url = (portalUrl ?? '').trim()
  if (!url) return bodies
  const card = portalAccountCardHtml(url, qrImgSrc, { blurb: WAIVER_EMAIL_CARD_BLURB })
  return {
    html: `${bodies.html}${card}`,
    text: `${bodies.text}\n\nYour account, any time: ${url}\n${WAIVER_EMAIL_CARD_BLURB}`,
  }
}
