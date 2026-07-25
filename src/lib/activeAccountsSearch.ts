import type { UserRole } from '../hooks/useAuth'
import { displayLabelForUserRole } from './userRoleDisplay'

export type ActiveAccountsSearchableUser = {
  name: string | null
  email: string
  role: UserRole
}

/**
 * Case-insensitive substring filter for the Active Accounts panel's user lists
 * (active table + archived section share it). Matches name, email, the DB role
 * slug, and the role's display label — so "helper" finds `helpers` rows whether
 * the searcher types the slug or the UI label. Empty / whitespace-only queries
 * pass every row through; result order preserves the incoming order.
 */
export function filterActiveAccountUsers<T extends ActiveAccountsSearchableUser>(
  users: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return users
  return users.filter(
    (u) =>
      (u.name ?? '').toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      displayLabelForUserRole(u.role).toLowerCase().includes(q),
  )
}
