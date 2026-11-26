import { useEffect, useState, useSyncExternalStore } from 'react'
import { SUPABASE_QUIET_MS, subscribeSupabaseInFlight, supabaseInFlightCount } from '../lib/supabaseInFlight'

/**
 * True once the Supabase client has had nothing in flight for `quietMs` (punch list #365, v2.8616): the moment a page
 * may call its reads in, since a read is a request through the client. False again the moment a request starts, so a
 * page that must not take its numbers away once drawn keeps its own *settled*, as the short Dashboard does
 * (`shortDashboardCountsRead`). Every request counts, the schedule's and Training's with the Needs you card's, so the
 * word comes a moment after the last of them, and a page that needs it sooner keeps a cap.
 */
export function useSupabaseQuiet(quietMs: number = SUPABASE_QUIET_MS): boolean {
  const inFlight = useSyncExternalStore(subscribeSupabaseInFlight, supabaseInFlightCount, () => 0)
  const [quiet, setQuiet] = useState(false)
  useEffect(() => {
    if (inFlight > 0) {
      setQuiet(false)
      return
    }
    const t = window.setTimeout(() => setQuiet(true), quietMs)
    return () => window.clearTimeout(t)
  }, [inFlight, quietMs])
  return quiet
}
