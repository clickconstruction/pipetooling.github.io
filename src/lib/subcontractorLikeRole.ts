import type { UserRole } from '../hooks/useAuth'

/** Roles that share subcontractors routing, RLS, and Clock/Dispatch service-type semantics. */
export type SubcontractorLikeRole = 'subcontractor' | 'helpers'

export function isSubcontractorLikeRole(role: UserRole | null | undefined): boolean {
  return role === 'subcontractor' || role === 'helpers'
}

/**
 * Assistant-LIKE: assistant or controller (v2.662). A controller acts as an assistant
 * everywhere and additionally holds dev-level financial visibility (payroll tab, wages,
 * cost matrix) — mirror of the DB's is_assistant(). Compare `role === 'assistant'`
 * directly only where strictly-assistant semantics matter (labels, pickers, pay redaction).
 */
export function isAssistantLike(role: UserRole | string | null | undefined): boolean {
  return role === 'assistant' || role === 'controller'
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
