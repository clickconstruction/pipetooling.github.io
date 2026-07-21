import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { MapPageView } from '../components/map/MapPageView'

export default function Map() {
  const { user, role, loading } = useAuth()

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  }

  // Signed out: role stays null forever — keep the old bounce.
  if (!user) {
    return <Navigate to="/dashboard" replace />
  }

  // useAuth resolves `loading` before the users-row role fetch lands — treat a
  // null role as still-loading (like ScheduleDispatch) so cold loads don't
  // bounce allowed roles to the dashboard.
  if (role == null) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  }

  if (
    role !== 'dev' &&
    role !== 'master_technician' &&
    !isAssistantLike(role) &&
    role !== 'estimator'
  ) {
    return <Navigate to="/dashboard" replace />
  }

  return <MapPageView />
}
