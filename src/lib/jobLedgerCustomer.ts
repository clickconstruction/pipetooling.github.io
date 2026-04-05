import type { Database } from '../types/database'

export type JobPayloadCustomerRow = Pick<
  Database['public']['Tables']['customers']['Row'],
  'id' | 'name' | 'master_user_id'
>

/** When saving a job, link to the single customer row for this master with the same name (case-insensitive). */
export function resolveCustomerIdForJobPayload(
  explicitId: string | null,
  jobMasterUserId: string,
  nameTrimmed: string,
  customers: JobPayloadCustomerRow[],
): string | null {
  if (explicitId) return explicitId
  const nameKey = nameTrimmed.trim().toLowerCase()
  if (!nameKey) return null
  const matches = customers.filter(
    (c) => c.master_user_id === jobMasterUserId && (c.name ?? '').trim().toLowerCase() === nameKey,
  )
  const only = matches.length === 1 ? matches[0] : null
  return only?.id ?? null
}
