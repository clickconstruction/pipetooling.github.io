import type { UserRole } from '../hooks/useAuth'

/**
 * Mirrors `Layout.tsx` route guards so in-app links don’t send users to an unexpected redirect
 * (e.g. estimators → `/bids` when opening `/customers`).
 *
 * If you change allowed paths in Layout, update this file the same way.
 */
const SUBCONTRACTOR_PATHS = ['/', '/dashboard', '/calendar', '/checklist', '/settings', '/tally'] as const

const PRIMARY_PATHS = [
  '/dashboard',
  '/materials',
  '/estimates',
  '/jobs',
  '/bids',
  '/calendar',
  '/checklist',
  '/settings',
  '/tally',
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
  '/calendar',
  '/checklist',
  '/settings',
  '/tally',
] as const

function estimatorAllowedPaths(estimatorProspectsAccess: boolean): string[] {
  return [
    '/dashboard',
    '/materials',
    '/estimates',
    '/bids',
    ...(estimatorProspectsAccess ? ['/prospects'] : []),
    '/calendar',
    '/checklist',
    '/people',
    '/settings',
    '/tally',
  ]
}

/** Whether `pathname` is allowed for `role` without Layout redirecting away (see Layout `useEffect` on `location.pathname`). */
export function isPathAllowedForRole(
  role: UserRole | null,
  pathname: string,
  estimatorProspectsAccess: boolean,
): boolean {
  if (role == null) return false
  if (role === 'dev' || role === 'master_technician' || role === 'assistant') return true

  if (role === 'subcontractor') {
    return (SUBCONTRACTOR_PATHS as readonly string[]).includes(pathname)
  }
  if (role === 'estimator') {
    return pathname !== '/' && estimatorAllowedPaths(estimatorProspectsAccess).includes(pathname)
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
