import type { UserRole } from '../hooks/useAuth'
import { isSubcontractorLikeRole } from './subcontractorLikeRole'

/**
 * Mirrors `Layout.tsx` route guards so in-app links don’t send users to an unexpected redirect
 * (e.g. estimators → `/bids` when opening `/customers`).
 *
 * If you change allowed paths in Layout, update this file the same way.
 */
const SUBCONTRACTOR_PATHS = ['/', '/dashboard', '/calendar', '/checklist', '/settings', '/tally', '/help'] as const

const PRIMARY_PATHS = [
  '/dashboard',
  '/materials',
  '/estimates',
  '/documents',
  '/jobs',
  '/bids',
  '/calendar',
  '/checklist',
  '/settings',
  '/tally',
  '/help',
] as const

const SUPERINTENDENT_PATHS = [
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
] as const

function estimatorAllowedPaths(estimatorProspectsAccess: boolean): string[] {
  return [
    '/dashboard',
    '/map',
    '/materials',
    '/estimates',
    '/documents',
    '/bids',
    '/customers',
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

/**
 * Estimator Layout guard: exact allowed path or a subpath (e.g. `/estimates/:id`, `/customers/.../edit`),
 * plus trailing-slash normalization. Must stay in sync with Layout estimator redirect `useEffect`.
 */
export function isEstimatorPathAllowed(pathname: string, estimatorProspectsAccess: boolean): boolean {
  const p = normalizeAppPathname(pathname)
  if (p === '/') return false
  const allowed = estimatorAllowedPaths(estimatorProspectsAccess)
  return allowed.some((root) => p === root || p.startsWith(`${root}/`))
}

/** Whether `pathname` is allowed for `role` without Layout redirecting away (see Layout `useEffect` on `location.pathname`). */
export function isPathAllowedForRole(
  role: UserRole | null,
  pathname: string,
  estimatorProspectsAccess: boolean,
): boolean {
  if (role == null) return false
  if (role === 'dev' || role === 'master_technician' || role === 'assistant') return true

  if (role && isSubcontractorLikeRole(role)) {
    return (SUBCONTRACTOR_PATHS as readonly string[]).includes(pathname)
  }
  if (role === 'estimator') {
    return isEstimatorPathAllowed(pathname, estimatorProspectsAccess)
  }
  if (role === 'primary') {
    return (
      pathname !== '/' &&
      ((PRIMARY_PATHS as readonly string[]).includes(pathname) || pathname.startsWith('/workflows/'))
    )
  }
  if (role === 'superintendent') {
    return (
      pathname !== '/' &&
      ((SUPERINTENDENT_PATHS as readonly string[]).includes(pathname) || pathname.startsWith('/workflows/'))
    )
  }
  return true
}
