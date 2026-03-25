import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

const INTERVAL_MS = 60_000

/**
 * Records approximate active time while this browser tab is visible: one RPC per minute
 * (no immediate bump; first bump runs after the first 60s interval so each heartbeat aligns
 * with ~60s of visibility).
 */
export function useAppActivityHeartbeat(userId: string | undefined): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!userId) return

    const clear = () => {
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    const tick = () => {
      void withSupabaseRetry(
        async () => supabase.rpc('bump_user_app_activity', { p_seconds: 60 }),
        'bump_user_app_activity'
      ).catch(() => {
        /* ignore heartbeat errors */
      })
    }

    const start = () => {
      if (document.visibilityState !== 'visible') return
      clear()
      intervalRef.current = setInterval(tick, INTERVAL_MS)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clear()
      } else {
        start()
      }
    }

    if (document.visibilityState === 'visible') {
      start()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      clear()
    }
  }, [userId])
}
