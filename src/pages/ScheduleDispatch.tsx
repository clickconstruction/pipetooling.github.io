import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ScheduleDispatchHubPage } from '../components/schedule/ScheduleDispatchHubPage'
import { ScheduleDispatchJobWeek } from '../components/schedule/ScheduleDispatchJobWeek'
import { CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES as CAN_USE_SCHEDULE_DISPATCH } from '../lib/scheduleDispatchEditRoles'

export default function ScheduleDispatch() {
  const { role, loading: authLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const jobId = searchParams.get('jobId')?.trim() ?? ''

  if (authLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  }

  if (role != null && !CAN_USE_SCHEDULE_DISPATCH.has(role)) {
    return <Navigate to="/dashboard" replace />
  }

  if (!jobId) {
    return <ScheduleDispatchHubPage variant="url" />
  }

  return <ScheduleDispatchJobWeek />
}
