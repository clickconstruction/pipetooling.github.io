import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ScheduleDispatchHubPage } from '../components/schedule/ScheduleDispatchHubPage'
import { ScheduleDispatchJobWeek } from '../components/schedule/ScheduleDispatchJobWeek'
import { CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES as CAN_USE_SCHEDULE_DISPATCH } from '../lib/scheduleDispatchEditRoles'
import { OPEN_BID_EDIT_QUERY } from '../contexts/BidPreviewModalContext'
import { bidOpenPath, scheduleBlockTarget } from '../lib/scheduleBlockTarget'

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

  // `?jobId=bid:<uuid>` is an old bid-block link (J18-F1): there is no job week
  // to grid, so send it to the bid instead of feeding `bid:` into uuid filters.
  const target = scheduleBlockTarget(jobId)
  if (target.kind === 'bid') {
    return <Navigate to={bidOpenPath(target.id, OPEN_BID_EDIT_QUERY) ?? '/schedule-dispatch'} replace />
  }

  return <ScheduleDispatchJobWeek />
}
