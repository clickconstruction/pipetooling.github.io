/**
 * Who pays the bill (v2.3345) — the one rule every billing reader shares.
 *
 * A job says who its bills go to (`jobs_ledger.bill_to_party`): the job
 * customer, the job's GC, or "split" (each invoice picks). An invoice may
 * carry its own pick (`jobs_ledger_invoices.bill_to_party`), and the older
 * typed-email override (`bill_to_email`, v2.1084 — a tenant paying one fee)
 * still wins over both. This module resolves those three layers into one
 * effective party, and picks the address a customer row is billed at.
 *
 * Dependency-free Deno module shared by the Stripe / physical-invoice edge
 * functions and re-exported to the client kernel
 * (`src/lib/jobs/billToParty.ts`); unit-tested from vitest
 * (`src/lib/jobs/billToParty.test.ts`).
 */

export type JobBillToParty = 'customer' | 'gc' | 'split'
export type InvoiceBillToParty = 'customer' | 'gc'
/** Who an invoice actually bills once every layer is applied. */
export type EffectiveBillParty = 'customer' | 'gc' | 'other'

export const JOB_BILL_TO_PARTIES: readonly JobBillToParty[] = ['customer', 'gc', 'split']

export function parseJobBillToParty(value: unknown): JobBillToParty {
  return value === 'gc' || value === 'split' ? value : 'customer'
}

export function parseInvoiceBillToParty(value: unknown): InvoiceBillToParty | null {
  return value === 'gc' || value === 'customer' ? value : null
}

export type JobPartyFields = {
  bill_to_party?: string | null
  gc_customer_id?: string | null
  customer_id?: string | null
}

export type InvoicePartyFields = {
  bill_to_party?: string | null
  bill_to_email?: string | null
}

/**
 * The party this invoice bills.
 *
 *   1. a typed `bill_to_email` on the invoice → `other` (someone else)
 *   2. the invoice's own pick, when the job can honor it (`gc` needs a GC)
 *   3. the job's rule: `gc` (with a GC set) → gc; `customer` / `split` → customer
 *
 * A `gc` pick on a job with no GC falls back to the customer rather than
 * billing nobody — the picker never offers it, but a GC cleared later must
 * not strand the invoice.
 */
export function effectiveInvoiceParty(
  job: JobPartyFields | null | undefined,
  invoice: InvoicePartyFields | null | undefined,
): EffectiveBillParty {
  if ((invoice?.bill_to_email ?? '').trim()) return 'other'
  const hasGc = Boolean((job?.gc_customer_id ?? '').trim())
  const invoicePick = parseInvoiceBillToParty(invoice?.bill_to_party)
  if (invoicePick === 'gc') return hasGc ? 'gc' : 'customer'
  if (invoicePick === 'customer') return 'customer'
  return parseJobBillToParty(job?.bill_to_party) === 'gc' && hasGc ? 'gc' : 'customer'
}

/** The customers row id that pays this invoice (null for `other`). */
export function payerCustomerId(job: JobPartyFields | null | undefined, party: EffectiveBillParty): string | null {
  if (party === 'gc') return (job?.gc_customer_id ?? '').trim() || null
  if (party === 'customer') return (job?.customer_id ?? '').trim() || null
  return null
}

export type CustomerBillingFields = {
  billing_email?: string | null
  contact_info?: unknown
}

function contactInfoField(ci: unknown, key: 'email' | 'phone'): string {
  if (!ci || typeof ci !== 'object' || Array.isArray(ci)) return ''
  const v = (ci as Record<string, unknown>)[key]
  return typeof v === 'string' ? v.trim() : ''
}

/** The address a customer row is billed at: `billing_email`, else the contact email. */
export function customerBillingEmail(customer: CustomerBillingFields | null | undefined): string {
  const explicit = (customer?.billing_email ?? '').trim()
  return explicit || contactInfoField(customer?.contact_info, 'email')
}

export function customerContactPhone(customer: CustomerBillingFields | null | undefined): string {
  return contactInfoField(customer?.contact_info, 'phone')
}

/** Short labels for chips and menus. */
export function billPartyLabel(party: EffectiveBillParty | JobBillToParty): string {
  switch (party) {
    case 'gc':
      return 'GC'
    case 'other':
      return 'Someone else'
    case 'split':
      return 'Split by line'
    default:
      return 'Customer'
  }
}
