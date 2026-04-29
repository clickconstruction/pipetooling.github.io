import type { UserRole } from '../hooks/useAuth'

/** Roles that share subcontractors routing, RLS, and Clock/Dispatch service-type semantics. */
export type SubcontractorLikeRole = 'subcontractor' | 'helpers'

export function isSubcontractorLikeRole(role: UserRole | null | undefined): boolean {
  return role === 'subcontractor' || role === 'helpers'
}

/** Subcontractors use `subcontractor_service_type_ids`; helpers use `helpers_service_type_ids`. */
export function fieldRoleServiceTypeIdsForUser(
  role: UserRole | null | undefined,
  row: {
    subcontractor_service_type_ids?: string[] | null
    helpers_service_type_ids?: string[] | null
  }
): string[] | null {
  if (role === 'subcontractor') return row.subcontractor_service_type_ids ?? null
  if (role === 'helpers') return row.helpers_service_type_ids ?? null
  return null
}
