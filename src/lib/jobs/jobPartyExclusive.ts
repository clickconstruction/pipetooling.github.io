/**
 * A job's customer and GC are never the same party (v2.3403, owner rule
 * 2026-09-14: "I don't think someone should be the homeowner and GC").
 *
 * Picking a GC that is the job's customer MOVES them: the customer link
 * clears and the bills go to the GC. Picking a customer that is the job's
 * GC clears the GC. A job with a GC and no customer is a GC job — the
 * builder is the only party, and every billing reader treats the GC as
 * the payer (`effectiveInvoiceParty`). The database enforces the same
 * rule for every writer (trigger `jobs_ledger_customer_gc_distinct`).
 *
 * Pure kernel; the job form applies the result to its state.
 */

export type JobPartyIds = { customerId: string | null; gcCustomerId: string | null }

export type JobPartyPickResult = JobPartyIds & {
  /** What the pick displaced, when it did: the customer moved to GC, or the GC dropped for the customer. */
  moved: 'customer_to_gc' | 'gc_cleared' | null
}

/** The GC picker chose `gcId` (null = cleared). */
export function pickJobGc(gcId: string | null, current: JobPartyIds): JobPartyPickResult {
  if (gcId && current.customerId && gcId === current.customerId) {
    return { customerId: null, gcCustomerId: gcId, moved: 'customer_to_gc' }
  }
  return { customerId: current.customerId, gcCustomerId: gcId, moved: null }
}

/** The customer picker chose `customerId` (null = cleared). */
export function pickJobCustomer(customerId: string | null, current: JobPartyIds): JobPartyPickResult {
  if (customerId && current.gcCustomerId && customerId === current.gcCustomerId) {
    return { customerId, gcCustomerId: null, moved: 'gc_cleared' }
  }
  return { customerId, gcCustomerId: current.gcCustomerId, moved: null }
}

/** The toast line for a move, or null when nothing moved. */
export function jobPartyMoveNotice(moved: JobPartyPickResult['moved'], name: string | null | undefined): string | null {
  const who = (name ?? '').trim() || 'This customer'
  if (moved === 'customer_to_gc') return `${who} is now the GC on this job, not the customer — a job's customer and GC are never the same party. Bills go to the GC.`
  if (moved === 'gc_cleared') return `${who} is now the customer on this job and no longer its GC — a job's customer and GC are never the same party.`
  return null
}

/** A GC job: the builder is the only party on the job (no customer link). */
export function isGcOnlyJob(job: { customer_id?: string | null; gc_customer_id?: string | null }): boolean {
  return !(job.customer_id ?? '').trim() && Boolean((job.gc_customer_id ?? '').trim())
}

/** Does the job name anyone to bill — a customer, or a GC standing alone? */
export function jobHasBillingParty(job: { customer_id?: string | null; gc_customer_id?: string | null }): boolean {
  return Boolean((job.customer_id ?? '').trim()) || Boolean((job.gc_customer_id ?? '').trim())
}

/**
 * The name a list shows for the party on a job: the customer, else the GC
 * standing alone, else null (the caller's "No customer" fallback).
 */
export function jobPartyName(job: {
  customer_name?: string | null
  gcCustomer?: { name?: string | null } | null
}): string | null {
  const customer = (job.customer_name ?? '').trim()
  if (customer) return customer
  const gc = (job.gcCustomer?.name ?? '').trim()
  return gc || null
}
