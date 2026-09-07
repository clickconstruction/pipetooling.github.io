import type { Database } from '../types/database'

export type JobPayloadCustomerRow = Pick<
  Database['public']['Tables']['customers']['Row'],
  'id' | 'name' | 'master_user_id'
>

/**
 * When saving a job, link to the single customer row with the same name
 * (case-insensitive) when no explicit pick was made.
 *
 * An explicitly-picked id is always kept. Until v2.2972 a pick "owned by a
 * different master" was dropped and re-resolved under the job master (Stripe
 * billing and a DB trigger refused cross-master links); one company retired both
 * walls, so `_jobMasterUserId` is accepted for the callers' sake and ignored.
 */
export function resolveCustomerIdForJobPayload(
  explicitId: string | null,
  _jobMasterUserId: string,
  nameTrimmed: string,
  customers: JobPayloadCustomerRow[],
): string | null {
  if (explicitId) return explicitId
  const nameKey = nameTrimmed.trim().toLowerCase()
  if (!nameKey) return null
  const matches = customers.filter((c) => (c.name ?? '').trim().toLowerCase() === nameKey)
  const only = matches.length === 1 ? matches[0] : null
  return only?.id ?? null
}

/**
 * The job's GC link (gc_customer_id): an explicit pick is kept as picked. The
 * cross-master drop it used to apply is gone with one company (v2.2972).
 */
export function resolveGcCustomerIdForJobPayload(
  explicitId: string | null,
  _jobMasterUserId: string,
  _customers: JobPayloadCustomerRow[],
): string | null {
  return explicitId || null
}
