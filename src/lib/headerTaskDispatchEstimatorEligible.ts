import type { UserRole } from '../hooks/useAuth'
import { isAssistantLike, isSubcontractorLikeRole } from './subcontractorLikeRole'

/** Header Task Dispatch icon (send dispatch request). */
export function showTaskDispatchButton(role: UserRole | null): boolean {
  if (!role) return false
  return (
    role === 'dev' ||
    role === 'master_technician' ||
    isAssistantLike(role) ||
    role === 'estimator' ||
    isSubcontractorLikeRole(role)
  )
}

/** Header Estimator Inbox icon (send estimator request). */
export function showEstimatorInboxButton(role: UserRole | null): boolean {
  return showTaskDispatchButton(role)
}

/** Header Task icon (add checklist item modal). */
export function showHeaderTaskChecklistButton(role: UserRole | null): boolean {
  if (!role) return false
  return (
    role === 'dev' ||
    role === 'master_technician' ||
    isAssistantLike(role) ||
    role === 'primary' ||
    role === 'estimator' ||
    isSubcontractorLikeRole(role)
  )
}
