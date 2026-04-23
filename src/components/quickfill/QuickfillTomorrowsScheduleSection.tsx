import { useMemo, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ScheduleDispatchHubPage } from '../schedule/ScheduleDispatchHubPage'
import { companyWeekStartSundayContaining, denverCalendarDayKey, ymdAddDays } from '../../utils/dateUtils'

const linkBoxStyle: CSSProperties = {
  marginBottom: '0.75rem',
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: '0.35rem 0.5rem',
}

const linkStyle: CSSProperties = {
  fontSize: '0.875rem',
  color: '#2563eb',
  fontWeight: 600,
}

const hintStyle: CSSProperties = {
  color: '#6b7280',
  fontSize: '0.8125rem',
}

/** Dispatch hub for the week that contains calendar tomorrow; one day column, no week nav, no Expected Manpower. */
export function QuickfillTomorrowsScheduleSection() {
  const tomorrowYmd = useMemo(() => ymdAddDays(denverCalendarDayKey(Date.now()), 1), [])
  const weekForTomorrow = useMemo(
    () => companyWeekStartSundayContaining(tomorrowYmd) ?? '',
    [tomorrowYmd],
  )
  const fullDispatchHref = useMemo(() => {
    const p = new URLSearchParams()
    if (weekForTomorrow) p.set('week', weekForTomorrow)
    p.set('day', tomorrowYmd)
    return `/schedule-dispatch?${p.toString()}`
  }, [weekForTomorrow, tomorrowYmd])

  return (
    <div>
      <div style={linkBoxStyle}>
        <Link to={fullDispatchHref} style={linkStyle}>
          Open full Schedule Dispatch
        </Link>
        <span style={hintStyle}>Full week, change columns, and Day tab tools.</span>
      </div>
      <ScheduleDispatchHubPage variant="tomorrow" />
    </div>
  )
}
