import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

const INTERVAL_MS = 60_000
/** Ignore visible spans shorter than this on flush — a glance records nothing (and avoids flicker spam). */
const MIN_FLUSH_MS = 5_000
/** Throttle the instant "seen" bump so rapid tab switching / navigation can't spam the RPC. */
const INSTANT_BUMP_MIN_GAP_MS = 60_000

/** Best-effort, non-retrying bump (the 2026-06-04 522 burst was dominated by this heartbeat retrying). */
function bumpActivity(seconds: number, page: string | null): void {
  void withSupabaseRetry(
    () =>
      supabase.rpc(
        'bump_user_app_activity',
        page === null ? { p_seconds: seconds } : { p_seconds: seconds, p_page: page },
      ),
    'bump_user_app_activity',
    { maxRetries: 0, logRetries: false }
  ).catch(() => {
    /* ignore heartbeat errors */
  })
}

/**
 * Records approximate active time while this browser tab is visible, attributed to `pageKey`
 * (see appActivityPageKey — e.g. `bids:pricing`).
 *
 * - On becoming visible: an instant `bump(0)` updates `last_seen_at` without adding hours
 *   (throttled to once per minute), so short clock-in/out visits register as "seen".
 * - Every 60s of continuous visibility on one page: `bump(60, page)` adds a minute to that
 *   page's daily bucket.
 * - The effect is keyed on `pageKey`, so in-app navigation flushes the old page's partial
 *   segment (>= 5s) via cleanup and restarts the clock on the new page — mid-minute navigation
 *   attributes time correctly. Hide / pagehide / unmount flush the same way.
 */
export function useAppActivityHeartbeat(userId: string | undefined, pageKey: string): void {
  const lastInstantBumpRef = useRef(0)

  useEffect(() => {
    if (!userId) return

    let intervalId: ReturnType<typeof setInterval> | null = null
    /** Start (ms) of the current not-yet-flushed visible segment on this page; null while hidden. */
    let segmentStart: number | null = null

    const clear = () => {
      if (intervalId != null) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    const tick = () => {
      bumpActivity(60, pageKey)
      // The minute just flushed; the next partial segment starts now.
      segmentStart = Date.now()
    }

    const start = () => {
      if (document.visibilityState !== 'visible') return
      clear()
      segmentStart = Date.now()
      const now = Date.now()
      if (now - lastInstantBumpRef.current >= INSTANT_BUMP_MIN_GAP_MS) {
        lastInstantBumpRef.current = now
        bumpActivity(0, null) // updates last_seen_at without adding active time
      }
      intervalId = setInterval(tick, INTERVAL_MS)
    }

    /** Flush the partial visible segment to this effect's page (hide / pagehide / nav-away / unmount). */
    const flushPartial = () => {
      const startedAt = segmentStart
      segmentStart = null
      if (startedAt == null) return
      const elapsedMs = Date.now() - startedAt
      if (elapsedMs < MIN_FLUSH_MS) return
      // Interval granularity keeps a segment under 60s; clamp defensively anyway (the RPC clamps too).
      bumpActivity(Math.min(60, Math.round(elapsedMs / 1000)), pageKey)
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
  }, [userId, pageKey])
}
