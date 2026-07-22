import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import DispatchModeHome from '../components/dispatchMode/DispatchModeHome'
import DispatchModeSchedule from '../components/dispatchMode/DispatchModeSchedule'
import DispatchModeInbox from '../components/dispatchMode/DispatchModeInbox'

/**
 * Dispatch Mode tab pages (/dispatch-mode + /schedule /inbox /customers).
 * PR 1 scaffold: each tab renders a placeholder; the real screens land in
 * their own PRs (Dashboard tab, Schedule, Inbox, Customers).
 */

function Placeholder({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <h1 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-strong)' }}>{title}</h1>
      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>{children}</p>
    </div>
  )
}

export default function DispatchMode() {
  const { pathname } = useLocation()
  if (pathname.startsWith('/dispatch-mode/schedule')) {
    return <DispatchModeSchedule />
  }
  if (pathname.startsWith('/dispatch-mode/inbox')) {
    return <DispatchModeInbox />
  }
  if (pathname.startsWith('/dispatch-mode/customers')) {
    return <Placeholder title="Customers">The Dispatch Mode customer list is coming soon.</Placeholder>
  }
  return <DispatchModeHome />
}
