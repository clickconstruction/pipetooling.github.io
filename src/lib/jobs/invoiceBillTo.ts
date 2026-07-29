/**
 * Per-invoice "Bill to" override (v2.1086): an invoice can bill an ALTERNATE
 * recipient — e.g. the customer's tenant pays the hazmat fee while the
 * customer pays everything else. The override lives on the invoice row
 * (`jobs_ledger_invoices.bill_to_name/email/phone`) and is ACTIVE only when
 * the email is set (every send channel needs an email). The edge functions
 * read the row server-side (v2.1085); these kernels are the client mirror for
 * display, validation, and the Bill Customer recipient overlay.
 */

export type InvoiceBillTo = {
  name: string | null
  email: string
  phone: string | null
}

export type InvoiceBillToRowFields = {
  bill_to_name?: string | null
  bill_to_email?: string | null
  bill_to_phone?: string | null
}

/** Row → override, or null when inactive (no bill_to_email). */
export function invoiceBillToFromRow(row: InvoiceBillToRowFields | null | undefined): InvoiceBillTo | null {
  const email = (row?.bill_to_email ?? '').trim()
  if (!email) return null
  const name = (row?.bill_to_name ?? '').trim()
  const phone = (row?.bill_to_phone ?? '').trim()
  return { name: name || null, email, phone: phone || null }
}

/** "Jane Tenant (jane@x.com)" or just the email when no name. */
export function billToDisplayLabel(billTo: InvoiceBillTo): string {
  return billTo.name ? `${billTo.name} (${billTo.email})` : billTo.email
}

/**
 * Overlay the override onto a job billing context so every downstream
 * consumer (Stripe preview/create payloads, physical email prefill + PDF,
 * share panels, notice email) sees the alternate recipient — the same
 * mechanic as the modal's inline email-fix overlay.
 */
export function applyBillToToJobBillingContext<
  T extends { customer_name: string | null; customer_email: string | null; customer_phone?: string | null },
>(job: T, billTo: InvoiceBillTo | null): T {
  if (!billTo) return job
  return {
    ...job,
    customer_name: billTo.name ?? job.customer_name,
    customer_email: billTo.email,
    customer_phone: billTo.phone ?? job.customer_phone ?? null,
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Validate the editor draft. Returns an error message, or null when valid.
 * An all-blank draft is valid — it means "clear the override".
 */
export function validateBillToDraft(draft: { name: string; email: string; phone: string }): string | null {
  const email = draft.email.trim()
  const hasAny = Boolean(draft.name.trim() || email || draft.phone.trim())
  if (!hasAny) return null
  if (!email) return 'An email is required — it is how the invoice reaches this person.'
  if (!EMAIL_REGEX.test(email)) return 'Enter a valid email address.'
  return null
}

/**
 * Editor draft → UPDATE payload for `jobs_ledger_invoices`. A blank email
 * clears the whole override (including the per-invoice Stripe customer, so a
 * later re-add starts fresh).
 */
export function billToUpdatePayload(draft: { name: string; email: string; phone: string }): {
  bill_to_name: string | null
  bill_to_email: string | null
  bill_to_phone: string | null
  bill_to_stripe_customer_id?: null
} {
  const email = draft.email.trim()
  if (!email) {
    return { bill_to_name: null, bill_to_email: null, bill_to_phone: null, bill_to_stripe_customer_id: null }
  }
  return {
    bill_to_name: draft.name.trim() || null,
    bill_to_email: email,
    bill_to_phone: draft.phone.trim() || null,
  }
}
