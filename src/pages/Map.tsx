import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { MapPageView } from '../components/map/MapPageView'

export default function Map() {
  const { role, loading } = useAuth()

  if (loading) {
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
