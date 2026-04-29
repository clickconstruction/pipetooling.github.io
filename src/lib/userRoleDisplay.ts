import type { UserRole } from '../hooks/useAuth'

/**
 * Labels for Settings "Manually add user" and similar dropdowns (`value` stays DB enum slug).
 * Preserves legacy formatting for other roles (`Master_technician`, etc.).
 */
export function displayLabelForUserRole(role: UserRole): string {
  if (role === 'helpers') return 'Helper'
  return role.charAt(0).toUpperCase() + role.slice(1)
}
