import { useLocation } from 'react-router-dom'
import DispatchModeHome from '../components/dispatchMode/DispatchModeHome'
import DispatchModeSchedule from '../components/dispatchMode/DispatchModeSchedule'
import DispatchModeInbox from '../components/dispatchMode/DispatchModeInbox'
import DispatchModeCustomers from '../components/dispatchMode/DispatchModeCustomers'
import DispatchModePo from '../components/dispatchMode/DispatchModePo'

/** Dispatch Mode tab pages (/dispatch-mode + /schedule /inbox /customers). */

export default function DispatchMode() {
  const { pathname } = useLocation()
  if (pathname.startsWith('/dispatch-mode/schedule')) {
    return <DispatchModeSchedule />
  }
  if (pathname.startsWith('/dispatch-mode/inbox')) {
    return <DispatchModeInbox />
  }
  if (pathname.startsWith('/dispatch-mode/customers')) {
    return <DispatchModeCustomers />
  }
  if (pathname.startsWith('/dispatch-mode/po')) {
    return <DispatchModePo />
  }
  return <DispatchModeHome />
}
