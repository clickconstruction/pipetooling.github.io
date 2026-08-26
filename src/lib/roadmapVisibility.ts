import type { UserRole } from '../hooks/useAuth'

/**
 * Who sees the Checklist → Roadmap tab (and anything that deep-links into it,
 * like the Dashboard "needs a person" nudge). Dev-only for now (owner request
 * v2.1559) and hidden under Farm Mode; widen here to re-release — every
 * surface that points at the roadmap reads this one function.
 */
export function canSeeRoadmapTab(role: UserRole | null | undefined, farmModeEnabled: boolean): boolean {
  return role === 'dev' && !farmModeEnabled
}
