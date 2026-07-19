/**
 * Service-type visibility + default-pick for the Job form. Extracted verbatim
 * from JobFormModal. Pure.
 */
import type { UserRole } from '../../hooks/useAuth'
import { fieldRoleServiceTypeIdsForUser, isSubcontractorLikeRole } from '../subcontractorLikeRole'
import type { JobFormServiceType, MeServiceTypeColumns } from './jobFormTypes'

export function visibleServiceTypesForJobForm(
  types: JobFormServiceType[],
  me: MeServiceTypeColumns | null,
): JobFormServiceType[] {
  if (types.length === 0) return []
  const role = me?.role
  if (role === 'estimator' && me?.estimator_service_type_ids && me.estimator_service_type_ids.length > 0) {
    const f = types.filter((st) => me.estimator_service_type_ids!.includes(st.id))
    return f.length > 0 ? f : types
  }
  if (role === 'primary' && me?.primary_service_type_ids && me.primary_service_type_ids.length > 0) {
    const f = types.filter((st) => me.primary_service_type_ids!.includes(st.id))
    return f.length > 0 ? f : types
  }
  if (role === 'superintendent' && me?.superintendent_service_type_ids && me.superintendent_service_type_ids.length > 0) {
    const f = types.filter((st) => me.superintendent_service_type_ids!.includes(st.id))
    return f.length > 0 ? f : types
  }
  if (isSubcontractorLikeRole(role as UserRole)) {
    const fieldIds = fieldRoleServiceTypeIdsForUser(role as UserRole, me ?? {})
    if (fieldIds && fieldIds.length > 0) {
      const f = types.filter((st) => fieldIds.includes(st.id))
      return f.length > 0 ? f : types
    }
  }
  return types
}

export function pickDefaultServiceTypeId(types: { id: string; name: string }[]): string | undefined {
  if (types.length === 0) return undefined
  if (types.length === 1) return types[0]!.id
  const plumb = types.find((st) => st.name === 'Plumbing')
  if (plumb) return plumb.id
  const elec = types.find((st) => st.name === 'Electrical')
  if (elec) return elec.id
  return types[0]!.id
}
