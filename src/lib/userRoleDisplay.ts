import type { UserRole } from '../hooks/useAuth'
import { humanRoleLabel } from './roleLabels'

/**
 * Labels for role dropdowns and role lists (`value` stays the DB enum slug).
 * Delegates to the one human-label helper (`roleLabels.ts`) since v2 "the invite
 * moment" — this used to preserve the raw enum ("Master_technician"), which is
 * what the invitation email ended up saying.
 */
export function displayLabelForUserRole(role: UserRole): string {
  return humanRoleLabel(role)
}
