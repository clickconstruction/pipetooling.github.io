/**
 * The link a customer gets for a Stripe bill in a text, a Copy link press or the share row's email draft (punch list
 * #290, v2.6768). Stripe's own hosted link (`hosted_invoice_url`) is about 160 characters and expires 30 days after the
 * bill's due date; the app's `/pay/<bill id>` page (v2.3754) asks Stripe for the current link each time it is opened, so
 * a link on it never expires. The text carries that page on the short host (`BILL_SHORT_ORIGIN`,
 * `my.clickplumbing.com/pay/<bill id>`, 69 characters), and only a caller with no bill id at hand falls back to Stripe's
 * link. The office's own *Customer pay page* press keeps Stripe's link: it opens Stripe, not a page for the customer.
 * Since v2.6769 the bill's ten-letter code (`bill_pay_code`, `billPayCodeIo.ts`) comes first: the same page at 43
 * characters, `my.clickplumbing.com/pay/<code>`.
 */
import { billShortUrl } from '../portal/portalShortOrigin'
import { isPayCode, isPayLinkId } from './payLink'

export type BillTextLinkInput = {
  /** `jobs_ledger_invoices.id`; absent or not a UUID → Stripe's own link. */
  invoiceId?: string | null
  /** The bill's ten-letter code when it has been asked for (v2.6769); absent, null or not a code → the id's link. */
  payCode?: string | null
  /** Stripe's `hosted_invoice_url`, the fallback. */
  hostedInvoiceUrl: string
}

/** The customer's link for the bill: the short pay page by code, else by the bill's id, else Stripe's own link. */
export function billTextLink(p: BillTextLinkInput): string {
  const code = (p.payCode ?? '').trim().toLowerCase()
  if (isPayCode(code)) return billShortUrl(code)
  const id = (p.invoiceId ?? '').trim()
  if (isPayLinkId(id)) return billShortUrl(id)
  return p.hostedInvoiceUrl.trim()
}
