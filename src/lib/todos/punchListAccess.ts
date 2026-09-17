import type { UserRole } from '../../hooks/useAuth'

/**
 * Who can open the Punch list (`/punch-list`): the to-do board, rendered in the app from
 * `src/content/punchList.generated.json`. It is planning material for whoever works the
 * codebase — the owner and the developers — so the door is dev + master, the same pair that
 * sees the Bridge and Review. Everyone else lands on Today (`roleGate.ts`).
 *
 * This function is the one place that decides the door; the gear-menu item, the route and
 * the picks table's RLS all read the same pair.
 */
export function canOpenPunchList(role: UserRole | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician'
}

export const PUNCH_LIST_PATH = '/punch-list'
