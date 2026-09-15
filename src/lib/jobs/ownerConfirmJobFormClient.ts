/**
 * Owner of record — the job form's reads (PR 2 of the train). The pure rules
 * live in `ownerConfirm.ts`; the write is `confirmOwnerForProperty` in
 * `ownerConfirmWrite.ts`. This file holds the three small reads the Property
 * record row and the after-create prompt need, each cached for the session:
 *
 * - is this customer a builder (the GC on other jobs)? — one head count;
 * - the roll's answer for an address — `lookupPropertyRecord`, once per
 *   property key, never on every render;
 * - every job at the property, so one Use links them all (the list gets
 *   these from the RPC; the form has one job and asks the ledger).
 */
import { supabase } from '../supabase'
import { withRetry, withSupabaseRetry } from '../../utils/errorHandling'
import { lookupPropertyRecord, type PropertyLookupOutcome } from '../customers/propertyLookupClient'
import { addressStreetKey } from '../customers/propertyRecord'
import { isBuilderCustomer, propertyKey, type OwnerToConfirmRow } from './ownerConfirm'
import type { CustomerAddressRow } from './lienProperty'

/** Customers the ledger has seen in `gc_customer_id` (and, as false, those it has not). */
const BUILDER_CACHE = new Map<string, boolean>()
const LOOKUP_CACHE = new Map<string, PropertyLookupOutcome>()

/** Test seam: forget every cached answer. */
export function resetOwnerConfirmJobFormCaches(): void {
  BUILDER_CACHE.clear()
  LOOKUP_CACHE.clear()
}

/** Is the customer a builder — the GC on at least one other job? A failed read answers false and is not cached. */
export async function fetchIsBuilderCustomer(customerId: string | null | undefined): Promise<boolean> {
  if (!customerId) return false
  const hit = BUILDER_CACHE.get(customerId)
  if (hit !== undefined) return hit
  try {
    const count = await withRetry(async () => {
      const { count, error } = await supabase.from('jobs_ledger').select('id', { count: 'exact', head: true }).eq('gc_customer_id', customerId)
      if (error) throw error
      return typeof count === 'number' ? count : 0
    })
    const known = count > 0 ? [customerId] : []
    const builder = isBuilderCustomer(customerId, known)
    BUILDER_CACHE.set(customerId, builder)
    return builder
  } catch {
    return false
  }
}

/** The roll's answer for an address, once per property for the session (a network error is not remembered — it retries next time). */
export async function lookupPropertyRecordCached(address: string): Promise<PropertyLookupOutcome> {
  const key = propertyKey(address)
  const hit = LOOKUP_CACHE.get(key)
  if (hit) return hit
  const res = await lookupPropertyRecord(address)
  if (res.ok) LOOKUP_CACHE.set(key, res)
  return res
}

export type JobAtProperty = Pick<OwnerToConfirmRow, 'jobId' | 'customerId' | 'gcCustomerId' | 'customerAddressId'>

/**
 * Every job at the property (same street number + street as `address`), the
 * form's own job first with the form's current parties. A failed read still
 * returns the job itself — Use then covers this job alone.
 */
export async function fetchJobsAtProperty(address: string, self: JobAtProperty): Promise<JobAtProperty[]> {
  const key = addressStreetKey(address)
  if (!key) return [self]
  try {
    const rows = await withSupabaseRetry(
      async () =>
        await supabase
          .from('jobs_ledger')
          .select('id, job_address, customer_id, gc_customer_id, customer_address_id')
          .ilike('job_address', `%${key}%`)
          .limit(200),
      'load jobs at the property',
    )
    const wanted = propertyKey(address)
    const others: JobAtProperty[] = []
    for (const r of (rows ?? []) as { id: string; job_address: string | null; customer_id: string | null; gc_customer_id: string | null; customer_address_id: string | null }[]) {
      if (r.id === self.jobId) continue
      if (propertyKey(r.job_address ?? '') !== wanted) continue
      others.push({ jobId: r.id, customerId: r.customer_id, gcCustomerId: r.gc_customer_id, customerAddressId: r.customer_address_id })
    }
    return [self, ...others]
  } catch {
    return [self]
  }
}

/** One `customer_addresses` row, whole — what the form links after Use. */
export async function fetchCustomerAddressRow(id: string): Promise<CustomerAddressRow | null> {
  try {
    const row = await withSupabaseRetry(async () => await supabase.from('customer_addresses').select('*').eq('id', id).maybeSingle(), 'load property record')
    return (row as CustomerAddressRow | null) ?? null
  } catch {
    return null
  }
}
