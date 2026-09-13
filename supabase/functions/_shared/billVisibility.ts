/**
 * Share this bill (v2.3375) — who ELSE sees a bill on their statement.
 *
 * Who pays (`billToParty.ts`) decides the party a bill is addressed to. This
 * module decides whether the other party on the job — the GC on an
 * owner-paid bill, the owner on a GC-paid bill — sees it on their portal
 * statement, listed for their records with no Pay button and never in their
 * balance. The office decides per bill (`jobs_ledger_invoices.shown_to_party`,
 * stamped by Bill Customer's tick and changed from the Bill tab); the job
 * remembers a default for its next bills (`jobs_ledger.show_bills_to_other_party`)
 * and answers for a billed job's invoice-less shell remainder. Nothing is
 * shared unless someone ticked it.
 *
 * Dependency-free Deno module shared by the customer-portal edge function
 * and re-exported to the client kernel (`src/lib/jobs/billVisibility.ts`);
 * unit-tested from vitest (`src/lib/jobs/billVisibility.test.ts`).
 */

import { effectiveInvoiceParty, payerCustomerId, type EffectiveBillParty, type InvoicePartyFields, type JobPartyFields } from './billToParty.ts'

/** The non-paying party a bill is shown to. */
export type ShownToParty = 'customer' | 'gc'

export function parseShownToParty(value: unknown): ShownToParty | null {
  return value === 'gc' || value === 'customer' ? value : null
}

export type JobVisibilityFields = JobPartyFields & {
  show_bills_to_other_party?: boolean | null
}

export type InvoiceVisibilityFields = InvoicePartyFields & {
  shown_to_party?: string | null
}

/**
 * The other party on the job relative to `party`, when the job names two
 * distinct parties. A GC entered as the customer row has no other party;
 * a typed "someone else" recipient has no default either — the office picks.
 */
export function otherPartyOf(job: JobPartyFields | null | undefined, party: EffectiveBillParty): ShownToParty | null {
  const gc = (job?.gc_customer_id ?? '').trim()
  const cust = (job?.customer_id ?? '').trim()
  if (!gc || !cust || gc === cust) return null
  if (party === 'customer') return 'gc'
  if (party === 'gc') return 'customer'
  return null
}

/**
 * The non-paying party this bill is shown to, or null.
 *
 * An invoice row answers with its stamp and nothing else — a job whose memory
 * is switched on later shares its NEXT bills, never the ones already sent.
 * A shell remainder (a billed job with no invoice row) has no stamp, so the
 * job's memory decides, relative to the party the job rule bills.
 */
export function shownToPartyFor(job: JobVisibilityFields | null | undefined, invoice: InvoiceVisibilityFields | null | undefined): ShownToParty | null {
  if (invoice) return parseShownToParty(invoice.shown_to_party)
  if (job?.show_bills_to_other_party !== true) return null
  return otherPartyOf(job, effectiveInvoiceParty(job, null))
}

/** How a bill lands on one viewer's statement. */
export type StatementRole = 'owed' | 'shared' | 'hidden'

/**
 * `owed` when the viewer's customers row pays the bill (the ledger, the
 * balance, Pay); `shared` when the bill is stamped for the party that is the
 * viewer (the shared card, no Pay, not in the balance); otherwise `hidden`
 * — dropped on the server, never in the payload.
 */
export function statementRoleFor(
  job: JobVisibilityFields,
  invoice: InvoiceVisibilityFields | null,
  viewerCustomerId: string,
): StatementRole {
  const party = effectiveInvoiceParty(job, invoice)
  if (payerCustomerId(job, party) === viewerCustomerId) return 'owed'
  const shownTo = shownToPartyFor(job, invoice)
  if (shownTo && payerCustomerId(job, shownTo) === viewerCustomerId) return 'shared'
  return 'hidden'
}

/** Whether Bill Customer's tick starts on: the job remembers, and there is an other party to show. */
export function defaultShowOtherParty(job: { show_bills_to_other_party?: boolean | null } | null | undefined, otherParty: ShownToParty | null): boolean {
  return job?.show_bills_to_other_party === true && otherParty != null
}
