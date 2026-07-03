import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

const INTERVAL_MS = 60_000
/** Ignore visible spans shorter than this on hide — a glance records nothing (and avoids flicker spam). */
const MIN_FLUSH_MS = 5_000
/** Throttle the instant "seen" bump so rapid tab switching can't spam the RPC. */
const INSTANT_BUMP_MIN_GAP_MS = 60_000

/**
 * Records approximate active time while this browser tab is visible.
 *
 * - On becoming visible: an instant `bump(0)` updates `last_seen_at` without adding hours
 *   (throttled to once per minute), so short clock-in/out visits register as "seen".
 * - Every 60s of continuous visibility: `bump(60)` adds a minute of active time.
 * - On hide/pagehide: the partial minute since the last bump is flushed (>= 5s), so a
 *   40-second visit adds ~40s instead of the pre-v2.618 zero.
 *
 * Best-effort telemetry: bumps do NOT retry. A missed beat is harmless, and retrying during
 * an outage amplifies load on a struggling origin (the 2026-06-04 522 burst was dominated by
 * this heartbeat retrying every few seconds across every open tab).
 */
export function useAppActivityHeartbeat(userId: string | undefined): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  /** Start (ms) of the current not-yet-flushed visible segment; null while hidden. */
  const segmentStartRef = useRef<number | null>(null)
  const lastInstantBumpRef = useRef(0)

  useEffect(() => {
    if (!userId) return

    const bump = (seconds: number) => {
      void withSupabaseRetry(
        () => supabase.rpc('bump_user_app_activity', { p_seconds: seconds }),
        'bump_user_app_activity',
        { maxRetries: 0, logRetries: false }
      ).catch(() => {
        /* ignore heartbeat errors */
      })
    }

    const clear = () => {
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    const tick = () => {
      bump(60)
      // The minute just flushed; the next partial segment starts now.
      segmentStartRef.current = Date.now()
    }

    const start = () => {
      if (document.visibilityState !== 'visible') return
      clear()
      segmentStartRef.current = Date.now()
      const now = Date.now()
      if (now - lastInstantBumpRef.current >= INSTANT_BUMP_MIN_GAP_MS) {
        lastInstantBumpRef.current = now
        bump(0) // updates last_seen_at without adding active time
      }
      intervalRef.current = setInterval(tick, INTERVAL_MS)
    }

    /** Flush the partial visible segment (called on hide/pagehide/unmount). */
    const flushPartial = () => {
      const startedAt = segmentStartRef.current
      segmentStartRef.current = null
      if (startedAt == null) return
      const elapsedMs = Date.now() - startedAt
      if (elapsedMs < MIN_FLUSH_MS) return
      // Interval granularity keeps a segment under 60s; clamp defensively anyway (the RPC clamps too).
      bump(Math.min(60, Math.round(elapsedMs / 1000)))
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clear()
        flushPartial()
      } else {
        start()
      }
    }

    // pagehide covers mobile Safari / tab close, where visibilitychange may not fire.
    const onPageHide = () => {
      clear()
      flushPartial()
    }

    if (document.visibilityState === 'visible') {
      start()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      clear()
      flushPartial()
    }
  }, [userId])
}
