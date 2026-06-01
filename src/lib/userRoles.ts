/** Canonical ordered list of assignable user roles, shared across Settings tabs
 * (People role dropdowns, Catalogs access pickers). */
import type { UserRole } from '../hooks/useAuth'

export const ROLES: UserRole[] = [
  'dev',
  'master_technician',
  'assistant',
  'subcontractor',
  'helpers',
  'estimator',
  'primary',
  'superintendent',
]
