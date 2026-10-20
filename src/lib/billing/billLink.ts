/**
 * The `{bill}` blank (v2.5628, punch list #124): the pay page of a job's newest billed bill, so a line can say "here is
 * a copy of your last bill" with a link that opens the bill and its Pay button. A bill billed through Stripe has the
 * page (`/pay/<invoice id>`, v2.3754); one billed outside Stripe does not, and the blank is left for the person. The
 * rule is Follow up's (`theyOweUs.ts`): a Stripe id on the bill, and an id the pay page accepts. Pure.
 */
import { isPayLinkId, payLinkUrl } from './payLink'

export interface BillForLink {
  id: string
  status: string | null
  stripe_invoice_id: string | null
  billed_at: string | null
  created_at?: string | null
}

/** The bills still owed, newest billed first (a bill with no billed day sorts by the day it was made, after the dated ones). */
export function billedNewestFirst<T extends BillForLink>(bills: readonly T[]): T[] {
  const when = (b: BillForLink) => b.billed_at ?? ''
  return bills
    .filter((b) => b.status === 'billed')
    .slice()
    .sort((a, b) => (when(b) > when(a) ? 1 : when(b) < when(a) ? -1 : (b.created_at ?? '') > (a.created_at ?? '') ? 1 : -1))
}

/** The newest billed bill's pay page, or null when no billed bill has one. */
export function newestBillLink(bills: readonly BillForLink[]): string | null {
  const bill = billedNewestFirst(bills).find((b) => (b.stripe_invoice_id ?? '').trim() !== '' && isPayLinkId(b.id))
  return bill ? payLinkUrl(bill.id) : null
}
