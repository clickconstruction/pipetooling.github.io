import type { UserRole } from '../hooks/useAuth'

/**
 * Role lens for the guide browser (Settings → Guides + /help): supervising
 * roles can view the guide list exactly as any role BELOW them sees it —
 * "what does my sub's Help page look like?"
 *
 * Rank is the supervision ladder, not permissions: dev > master > controller
 * > assistant > superintendent > estimator/primary > sub/helpers. Only ranks
 * at superintendent and above get a lens (estimators, primaries, subs, and
 * helpers don't supervise anyone).
 */

const ROLE_RANK: Record<UserRole, number> = {
  dev: 7,
  master_technician: 6,
  controller: 5,
  assistant: 4,
  superintendent: 3,
  estimator: 2,
  primary: 2,
  subcontractor: 1,
  helpers: 1,
}

/** Display order for lens chips: highest rank first, stable within a rank. */
const LENS_ORDER: UserRole[] = [
  'master_technician',
  'controller',
  'assistant',
  'superintendent',
  'estimator',
  'primary',
  'subcontractor',
  'helpers',
]

const MIN_SUPERVISING_RANK = 3

export function guideLensRolesFor(role: UserRole | null): UserRole[] {
  if (role === null) return []
  const myRank = ROLE_RANK[role]
  if (myRank === undefined || myRank < MIN_SUPERVISING_RANK) return []
  return LENS_ORDER.filter((r) => ROLE_RANK[r] < myRank)
}

/**
 * Friendly chip label for the lens. `displayLabelForUserRole` deliberately
 * preserves legacy dropdown formatting ("Master_technician"), which reads
 * badly as a chip — these are the GLOSSARY's spoken names.
 */
const LENS_LABEL: Record<UserRole, string> = {
  dev: 'Dev',
  master_technician: 'Master',
  controller: 'Controller',
  assistant: 'Assistant',
  superintendent: 'Superintendent',
  estimator: 'Estimator',
  primary: 'Primary',
  subcontractor: 'Sub',
  helpers: 'Helper',
}

export function guideLensRoleLabel(role: UserRole): string {
  return LENS_LABEL[role] ?? role
}
