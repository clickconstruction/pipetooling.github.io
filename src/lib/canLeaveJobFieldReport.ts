import type { UserRole } from '../hooks/useAuth'

/** Same rule as Dashboard “Leave Report” / field report flows. */
export function canLeaveJobFieldReport(role: UserRole | string | null | undefined): boolean {
  if (!role) return false
  return (
    role === 'subcontractor' ||
    role === 'helpers' ||
    role === 'dev' ||
    role === 'master_technician' ||
    role === 'assistant' ||
    role === 'primary' ||
    role === 'superintendent' ||
    role === 'estimator'
  )
}
