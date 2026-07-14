import type { UserRole } from '../hooks/useAuth'
import { isAssistantLike } from './subcontractorLikeRole'

/** Same rule as Dashboard “Leave Report” / field report flows. */
export function canLeaveJobFieldReport(role: UserRole | string | null | undefined): boolean {
  if (!role) return false
  return (
    role === 'subcontractor' ||
    role === 'helpers' ||
    role === 'dev' ||
    role === 'master_technician' ||
    isAssistantLike(role) ||
    role === 'primary' ||
    role === 'superintendent' ||
    role === 'estimator'
  )
}
