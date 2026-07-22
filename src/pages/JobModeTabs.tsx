import { useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import DispatchModeSchedule from '../components/dispatchMode/DispatchModeSchedule'
import DispatchModeCustomers from '../components/dispatchMode/DispatchModeCustomers'
import JobModeInbox from '../components/jobMode/JobModeInbox'

/** Job Mode footer tabs (/job-mode/schedule /inbox /customers) — everything scoped to the signed-in tech. */
export default function JobModeTabs() {
  const { pathname } = useLocation()
  const { user: authUser } = useAuth()
  if (pathname.startsWith('/job-mode/inbox')) return <JobModeInbox />
  if (pathname.startsWith('/job-mode/customers')) {
    return <DispatchModeCustomers scheduleUserId={authUser?.id ?? undefined} />
  }
  return <DispatchModeSchedule selfUserId={authUser?.id ?? undefined} />
}
