/**
 * My Time as a card of its own, for Job Mode, which shows no My Time section: the same picture of the time added
 * up, by day and by week, and the same quiet line at its foot as the Dashboard's. A person with working hours reads
 * them (punch list #429), and an hourly person with none is asked the hours they can work. It feeds Job Mode's
 * This week square, so the week is read once, and reads again when the clock changes.
 */
import { useCallback, useEffect, useState } from 'react'
import { useSessionChanges } from '../../contexts/UpdateFocusOpenerBridgeContext'
import type { AvailabilityIo } from '../../lib/people/availabilityIo'
import type { MyTimeWeek } from '../../lib/dashboard/myTimeWeeks'
import { fetchMyTimeWeeks, myTimeThisWeekHours, type MyTimeWeeksRead } from '../../lib/dashboard/myTimeWeeksIo'
import { DashboardCardHead, DashboardCardTitle } from './DashboardCardTitle'
import { DashboardMyTimePicture } from './DashboardMyTimePicture'
import { MyTimeCanWorkLine } from './MyTimeCanWorkLine'

export const MY_TIME_CARD_ANCHOR = 'dash-my-hours'

export function DashboardMyTimeCard({
  userId,
  displayName,
  isSalary,
  onWeek,
  read = fetchMyTimeWeeks,
  io,
}: {
  userId: string
  displayName: string
  /** A salaried person's week is on pay, so they are told their working hours and never asked for a week. */
  isSalary: boolean
  /** Job Mode's top row reads this week's hours from this card's own read. `null` when the read failed. */
  onWeek?: (workedHours: number | null) => void
  read?: MyTimeWeeksRead
  io?: AvailabilityIo
}) {
  const [weeks, setWeeks] = useState<MyTimeWeek[] | null | undefined>(undefined)
  const [chosen, setChosen] = useState<number | null>(null)
  const load = useCallback(async () => {
    try {
      setWeeks(await read(userId))
    } catch {
      setWeeks(null)
    }
  }, [read, userId])
  useEffect(() => {
    void load()
  }, [load])
  // A punch changes this week's time. Without this read the picture, and Job Mode's This week square with it,
  // kept the time from when the page was opened: a day's work short after clocking out on the same page.
  const subscribeSessionChanges = useSessionChanges()
  useEffect(() => subscribeSessionChanges(() => void load()), [subscribeSessionChanges, load])
  useEffect(() => {
    if (weeks === undefined) return
    onWeek?.(weeks ? myTimeThisWeekHours(weeks) : null)
  }, [weeks, onWeek])
  if (!weeks) return null
  const current = weeks.findIndex((w) => w.current)
  const selected = chosen != null && chosen >= 0 && chosen < weeks.length ? chosen : current
  return (
    <div id={MY_TIME_CARD_ANCHOR} data-testid="my-time-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', marginTop: '0.75rem' }}>
      <DashboardCardHead card={{ top: '0.7rem', side: '0.9rem', radius: 8 }} below="0.5rem">
        <DashboardCardTitle nowrap>My Time</DashboardCardTitle>
      </DashboardCardHead>
      <DashboardMyTimePicture weeks={weeks} selected={selected} onSelect={setChosen}>
        <MyTimeCanWorkLine userId={userId} displayName={displayName} asks={!isSalary} io={io} />
      </DashboardMyTimePicture>
    </div>
  )
}
