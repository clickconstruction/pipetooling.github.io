import type { UserRole } from '../hooks/useAuth'
import { isAssistantLike, isSubcontractorLikeRole } from './subcontractorLikeRole'

/**
 * The single source of truth for per-role route access (v2.2325). `Layout.tsx` imports
 * these lists and `isPathAllowedForRole` for both its redirect guard and link-time checks —
 * do not re-declare allowed paths there (the duplicated copies drifted; see ACCESS_CONTROL.md
 * → "Page Access Matrix" for the intended access).
 *
 * Every list matches by root: an entry allows the exact path plus any subpath under it
 * (`/estimates` also allows `/estimates/123`), except `/` which only matches itself.
 */
export const SUBCONTRACTOR_PATHS = ['/', '/dashboard', '/my-statement', '/calendar', '/checklist', '/settings', '/tally', '/help', '/job-mode/schedule', '/job-mode/inbox', '/job-mode/customers'] as const

export const PRIMARY_PATHS = [
  '/dashboard',
  '/my-statement',
  '/materials',
  '/estimates',
  '/documents',
  '/jobs',
  '/bids',
  '/workflows',
  '/calendar',
  '/checklist',
  '/settings',
  '/tally',
  '/help',
  '/job-mode/schedule',
  '/job-mode/inbox',
  '/job-mode/customers',
] as const

export const SUPERINTENDENT_PATHS = [
  '/dashboard',
  '/projects',
  '/workflows',
  '/jobs',
  '/schedule-dispatch',
  '/bids',
  '/materials',
  '/estimates',
  '/documents',
  '/calendar',
  '/checklist',
  '/settings',
  '/tally',
  '/help',
  '/job-mode/schedule',
  '/job-mode/inbox',
  '/job-mode/customers',
] as const

function estimatorAllowedPaths(estimatorProspectsAccess: boolean): string[] {
  return [
    '/dashboard',
    '/my-statement',
    '/map',
    '/materials',
    '/estimates',
    '/documents',
    '/bids',
    '/customers',
    '/job-mode',
    ...(estimatorProspectsAccess ? ['/prospects'] : []),
    '/calendar',
    '/checklist',
    '/people',
    '/settings',
    '/tally',
    '/help',
  ]
}

function normalizeAppPathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname
}

/** Exact root or subpath match (`/estimates` allows `/estimates/123`); `/` only matches itself. */
function matchesAllowedRoot(roots: readonly string[], pathname: string): boolean {
  const p = normalizeAppPathname(pathname)
  return roots.some((root) => (root === '/' ? p === '/' : p === root || p.startsWith(`${root}/`)))
}

/**
 * Estimator Layout guard: exact allowed path or a subpath (e.g. `/estimates/:id`, `/customers/.../edit`),
 * plus trailing-slash normalization.
 */
export function isEstimatorPathAllowed(pathname: string, estimatorProspectsAccess: boolean): boolean {
  if (normalizeAppPathname(pathname) === '/') return false
  return matchesAllowedRoot(estimatorAllowedPaths(estimatorProspectsAccess), pathname)
}

/** Whether `pathname` is allowed for `role` without Layout redirecting away (see Layout `useEffect` on `location.pathname`). */
export function isPathAllowedForRole(
  role: UserRole | null,
  pathname: string,
  estimatorProspectsAccess: boolean,
): boolean {
  if (role == null) return false
  if (role === 'dev' || role === 'master_technician' || isAssistantLike(role)) return true

  if (role && isSubcontractorLikeRole(role)) {
    return matchesAllowedRoot(SUBCONTRACTOR_PATHS, pathname)
  }
  if (role === 'estimator') {
    return isEstimatorPathAllowed(pathname, estimatorProspectsAccess)
  }
  if (role === 'primary') {
    return normalizeAppPathname(pathname) !== '/' && matchesAllowedRoot(PRIMARY_PATHS, pathname)
  }
  if (role === 'superintendent') {
    return normalizeAppPathname(pathname) !== '/' && matchesAllowedRoot(SUPERINTENDENT_PATHS, pathname)
  }
  return true
}
