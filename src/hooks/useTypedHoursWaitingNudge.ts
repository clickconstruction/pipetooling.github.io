import { useCallback, useEffect, useState } from 'react'
import { loadTypedHoursWaiting } from '../lib/clock/loadTypedHoursWaiting'
import { summarizeTypedWaiting, type TypedWaitingSummary } from '../lib/clock/typedHours'

/**
 * Hours typed by hand that are waiting on the viewer's second look, for the Needs You card
 * (v2.4254). All gating lives in list_typed_hours_waiting() — a caller who does not approve hours
 * gets nothing — so this hook has no role logic. Refetches on window focus like the neighbouring
 * nudges; a failed poll shows nothing this round.
 */
export function useTypedHoursWaitingNudge(enabled: boolean): {
  typedHours: TypedWaitingSummary | null
  refresh: () => void
} {
  const [refreshKey, setRefreshKey] = useState(0)
  const [typedHours, setTypedHours] = useState<TypedWaitingSummary | null>(null)
  const bump = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    if (!enabled) {
      setTypedHours(null)
      return
    }
    let cancelled = false
    void loadTypedHoursWaiting().then((rows) => {
      if (cancelled) return
      const summary = summarizeTypedWaiting(rows)
      setTypedHours(summary.count > 0 ? summary : null)
    })
    return () => {
      cancelled = true
    }
  }, [enabled, refreshKey])

  useEffect(() => {
    if (!enabled) return
    const onFocus = () => bump()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [enabled, bump])

  return { typedHours, refresh: bump }
}
