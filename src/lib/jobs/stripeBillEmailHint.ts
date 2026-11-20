/**
 * What the Send Email invoice window may name before the press (v2.7972). `send-stripe-invoice` sends a Stripe bill
 * to the email Stripe holds for the invoice's own customer. The window is handed an address by its host, and three
 * hosts handed it the job's customer email. On a bill that went to the GC that named the wrong person: the email
 * went to the GC all the same.
 *
 * So the host hands over an address only when the app's own record says whose it is: the typed recipient's on a bill
 * to someone else, the job's customer's on a bill to the customer. On a bill to the GC the job does not carry the
 * GC's address, so the window says who gets it and that the address is the one on the Stripe invoice. Pure.
 */
import { effectiveInvoiceParty, type EffectiveBillParty, type InvoicePartyFields, type JobPartyFields } from './billToParty'

export type StripeBillEmailHint = {
  /** Who the bill went to. */
  payer: EffectiveBillParty
  /** The address the window may name, or null when the job does not hold the payer's. */
  email: string | null
}

export function stripeBillEmailHint(
  job: (JobPartyFields & { customer_email?: string | null }) | null | undefined,
  inv: InvoicePartyFields | null | undefined,
): StripeBillEmailHint {
  const payer = effectiveInvoiceParty(job, inv)
  if (payer === 'other') return { payer, email: (inv?.bill_to_email ?? '').trim() || null }
  if (payer === 'gc') return { payer, email: null }
  return { payer, email: (job?.customer_email ?? '').trim() || null }
}

/** The window's words where it has no address to name: always true, since the send reads Stripe's own. */
export function stripeBillAddressWords(payer: EffectiveBillParty | null | undefined): string {
  return payer === 'gc' ? 'the GC, at the address on the Stripe invoice' : 'the address on the Stripe invoice'
}
