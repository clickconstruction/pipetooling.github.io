import { useCallback, useEffect, useState } from 'react'
import { loadRailFacts, type RailFactsAccess } from '../lib/people/loadRailFacts'
import type { RailFacts } from '../lib/people/deskRailAttention'
import { denverCalendarDayKey } from '../utils/dateUtils'

const EMPTY: RailFacts = { pendingByUserId: {}, unsentDocsByName: {}, expiringByName: {}, expiredByName: {}, portalOnPersonIds: new Set() }

/**
 * The Users tab's row signals (v2.2762): the same facts the Person tab rail
 * shows, loaded once per visit and on window focus. Fails soft to "no chips".
 */
export function useUsersTabSignals(access: RailFactsAccess, enabled: boolean): { facts: RailFacts; loading: boolean; refresh: () => void } {
  const [facts, setFacts] = useState<RailFacts>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const f = await loadRailFacts(access, denverCalendarDayKey(Date.now()))
        if (!cancelled) setFacts(f)
      } catch {
        if (!cancelled) setFacts(EMPTY)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, access.canAccessHours, access.canAccessPay, access.canAccessContracts, access.canAccessLicenses, tick])

  useEffect(() => {
    if (!enabled) return
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [enabled, refresh])

  return { facts, loading, refresh }
}
