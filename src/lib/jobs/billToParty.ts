/**
 * Who pays the bill (v2.3345) — client kernel. The resolution rule lives in
 * the shared Deno module so the edge functions and the UI can never
 * disagree; this file re-exports it and adds the client-only pieces: the
 * payer recipient built from a customers row, the Bill Customer overlay,
 * and the option list for the job's "Bills go to" control.
 */
import type { EffectiveBillParty, InvoicePartyFields, JobBillToParty, JobPartyFields } from '../../../supabase/functions/_shared/billToParty'
import { customerBillingEmail, customerContactPhone, effectiveInvoiceParty, payerCustomerId } from '../../../supabase/functions/_shared/billToParty'

export {
  JOB_BILL_TO_PARTIES,
  billPartyLabel,
  customerBillingEmail,
  customerContactPhone,
  effectiveInvoiceParty,
  parseInvoiceBillToParty,
  parseJobBillToParty,
  payerCustomerId,
} from '../../../supabase/functions/_shared/billToParty'
export type {
  EffectiveBillParty,
  InvoiceBillToParty,
  InvoicePartyFields,
  JobBillToParty,
  JobPartyFields,
} from '../../../supabase/functions/_shared/billToParty'

/** The party Bill Customer addresses: a customers row billed at its billing email. */
export type PayerRecipient = {
  customerId: string
  name: string
  email: string
  phone: string
}

export type PayerCustomerRow = {
  id: string
  name: string | null
  billing_email?: string | null
  contact_info?: unknown
}

export function payerRecipientFromCustomer(row: PayerCustomerRow | null | undefined): PayerRecipient | null {
  if (!row) return null
  return {
    customerId: row.id,
    name: (row.name ?? '').trim(),
    email: customerBillingEmail(row),
    phone: customerContactPhone(row),
  }
}

/**
 * Overlay the payer onto a job billing context so every downstream consumer
 * (Stripe preview/create payloads, physical email prefill + PDF "Bill to",
 * share panels) bills that party — the same mechanic as the tenant
 * bill-to overlay (`applyBillToToJobBillingContext`), plus the customer id
 * the edge functions key their Stripe customer on.
 */
export function applyPayerToJobBillingContext<
  T extends { customer_id: string | null; customer_name: string | null; customer_email: string | null; customer_phone?: string | null },
>(job: T, payer: PayerRecipient | null): T {
  if (!payer) return job
  return {
    ...job,
    customer_id: payer.customerId,
    customer_name: payer.name || job.customer_name,
    customer_email: payer.email,
    customer_phone: payer.phone || job.customer_phone || null,
  }
}

export type JobBillToPartyOption = {
  value: JobBillToParty
  label: string
  hint: string
}

/**
 * The "Bills go to" choices for one job. The GC choice needs a GC that is
 * not the customer row itself (the 72 jobs entered with the GC as customer
 * already bill the GC — offering "GC" there would be a no-op).
 */
export function jobBillToPartyOptions(job: {
  gcCustomerId: string | null
  customerId: string | null
  gcName: string | null
}): JobBillToPartyOption[] {
  const gcDistinct = Boolean(job.gcCustomerId) && job.gcCustomerId !== job.customerId
  const out: JobBillToPartyOption[] = [
    { value: 'customer', label: 'This customer', hint: 'Bills, the statement and the portal address the job customer.' },
  ]
  if (gcDistinct) {
    out.push({
      value: 'gc',
      label: `GC · ${(job.gcName ?? '').trim() || 'the GC'}`,
      hint: 'Bills, the GC statement and the portal address the GC at its billing email.',
    })
  }
  out.push({ value: 'split', label: 'Split by line', hint: 'Each draft invoice picks its payer — Customer, GC, or someone else.' })
  return out
}

/** The chip wording on an invoice row: who this one bills. */
export function invoicePartyChip(party: EffectiveBillParty, names: { customer: string | null; gc: string | null; other: string | null }): string {
  if (party === 'gc') return (names.gc ?? '').trim() || 'GC'
  if (party === 'other') return (names.other ?? '').trim() || 'Someone else'
  return (names.customer ?? '').trim() || 'Customer'
}

/**
 * The customers row that pays a Stages-board row (v2.3346): invoice rows use
 * the invoice's pick, job rows the job's rule. Null when a typed recipient
 * (someone else) pays, or the job names nobody.
 */
export function stageRowPayerCustomerId(row: { kind: string; job: JobPartyFields; inv?: InvoicePartyFields }): string | null {
  const inv = row.kind === 'job' ? null : row.inv ?? null
  return payerCustomerId(row.job, effectiveInvoiceParty(row.job, inv))
}

/**
 * A standing rule on the GC (v2.3353): when the customer picked as a job's GC
 * carries `gc_pays_by_default`, a job that still sits on the default rule
 * flips to GC pays — once, when the GC is picked, never over a deliberate
 * choice, and never when the GC is the job customer row itself.
 */
export function shouldDefaultBillsToGc(args: {
  gc: { id: string; gc_pays_by_default?: boolean | null } | null | undefined
  customerId: string | null
  current: JobBillToParty
}): boolean {
  const { gc, customerId, current } = args
  if (!gc || gc.gc_pays_by_default !== true) return false
  if (customerId && gc.id === customerId) return false
  return current === 'customer'
}
