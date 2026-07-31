import type { Database } from '../types/database'

export type JobPayloadCustomerRow = Pick<
  Database['public']['Tables']['customers']['Row'],
  'id' | 'name' | 'master_user_id'
>

/**
 * When saving a job, link to the single customer row for this master with the same name
 * (case-insensitive).
 *
 * An explicitly-picked id is kept only when it belongs to `jobMasterUserId` (or isn't in the
 * supplied list, in which case we trust it). If the picked customer is owned by a *different*
 * master — e.g. a project link just forced the job's master to the project owner, or a shared
 * customer was picked — we fall through to re-resolve by name under the job master rather than
 * persist a cross-master link, which Stripe billing rejects ("Customer does not belong to this
 * job master") and the DB invariant now blocks.
 */
export function resolveCustomerIdForJobPayload(
  explicitId: string | null,
  jobMasterUserId: string,
  nameTrimmed: string,
  customers: JobPayloadCustomerRow[],
): string | null {
  if (explicitId) {
    const explicit = customers.find((c) => c.id === explicitId)
    if (!explicit || explicit.master_user_id === jobMasterUserId) return explicitId
  }
  const nameKey = nameTrimmed.trim().toLowerCase()
  if (!nameKey) return null
  const matches = customers.filter(
    (c) => c.master_user_id === jobMasterUserId && (c.name ?? '').trim().toLowerCase() === nameKey,
  )
  const only = matches.length === 1 ? matches[0] : null
  return only?.id ?? null
}

/**
 * Same cross-master protection for the job's GC link (gc_customer_id). Unlike
 * the primary customer there is no name to re-resolve by — the GC is only ever
 * an explicit pick — so a pick owned by a DIFFERENT master simply drops to null
 * (the DB backstop trigger would reject it anyway). A pick not present in the
 * supplied list is trusted, mirroring resolveCustomerIdForJobPayload.
 */
export function resolveGcCustomerIdForJobPayload(
  explicitId: string | null,
  jobMasterUserId: string,
  customers: JobPayloadCustomerRow[],
): string | null {
  if (!explicitId) return null
  const explicit = customers.find((c) => c.id === explicitId)
  if (!explicit || explicit.master_user_id === jobMasterUserId) return explicitId
  return null
}
