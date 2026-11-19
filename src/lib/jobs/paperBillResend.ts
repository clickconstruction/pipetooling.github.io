/**
 * Where a paper bill goes when it is emailed again (v2.7959). The rule is the one `send-physical-invoice-email`
 * enforces, so the address the office is shown, the address the app sends, and the address the function accepts are
 * one address:
 *
 *   1. a bill typed to someone else (`bill_to_email`) goes to that address;
 *   2. a bill to the GC goes to the GC's billing email (`customerBillingEmail` of the GC's customers row);
 *   3. any other bill goes to the job's customer email.
 *
 * Until v2.7959 the resend sent rule 3's address for rule 2's bill. The function refused it, and on a GC job with no
 * customer the press was not drawn at all. Pure.
 */
import { customerBillingEmail, effectiveInvoiceParty, type EffectiveBillParty, type InvoicePartyFields, type JobPartyFields } from './billToParty'

/** The GC's customers row, as far as its billing address goes. */
export type GcBillingRow = { billing_email?: string | null; contact_info?: unknown }

export type PaperBillRecipient = {
  /** Who the bill went to. */
  party: EffectiveBillParty
  /** Their address, or '' when the record holds none. */
  email: string
}

export function paperBillResendRecipient(
  job: (JobPartyFields & { customer_email?: string | null }) | null | undefined,
  inv: InvoicePartyFields | null | undefined,
  gc: GcBillingRow | null | undefined,
): PaperBillRecipient {
  const party = effectiveInvoiceParty(job, inv)
  if (party === 'other') return { party, email: (inv?.bill_to_email ?? '').trim() }
  if (party === 'gc') return { party, email: customerBillingEmail(gc) }
  return { party, email: (job?.customer_email ?? '').trim() }
}

/** What to say when the party has no address on record, with where to add it. */
export function paperBillNoAddressWords(party: EffectiveBillParty): string {
  return party === 'gc'
    ? 'The GC on this job has no billing email. Add it on Edit Job → GC/Builder → Billing email.'
    : 'Job has no customer email; add it on Edit Job.'
}
