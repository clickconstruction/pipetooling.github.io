import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { indexLandingPath } from '../lib/devBridgeLanding'

/**
 * The bare root `/` (v2.5879): a dev opens on the Bridge, everyone else on the Dashboard (`devBridgeLanding.ts`).
 * Rendered inside `ProtectedRoute`, so auth has settled and the role is read; a role the watchdog left null lands on
 * the Dashboard, as the old `/` → `/dashboard` redirect did.
 */
export function IndexLanding() {
  const { role } = useAuth()
  return <Navigate to={indexLandingPath(role)} replace />
}
