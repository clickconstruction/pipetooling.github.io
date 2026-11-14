/**
 * Painting a walk on a phone (punch list #345): the readings, the screen held on, the pause when
 * the page leaves the screen, and the walk kept on the phone so a reload does not lose it. The
 * rules are `paintedWalk.ts`; this is the browser around them.
 *
 * The phone is read only between `start` or `resume` and the next pause. A page that is not on the
 * screen is given no position by any browser, so there is nothing here that could follow a locked
 * phone, and nothing tries to.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  keptWalkKey,
  startWalk,
  walkFix,
  walkHidden,
  walkPause,
  walkResume,
  walkShown,
  walkTick,
  type WalkState,
} from '../lib/paintedMap/paintedWalk'
import type { WalkRefusal } from '../lib/paintedMap/paintedWalkWords'

type WakeLockSentinelLike = { release: () => Promise<void> }
type WakeLockLike = { request: (kind: 'screen') => Promise<WakeLockSentinelLike> }

export type PaintedWalkHost = {
  state: WalkState | null
  /** The phone gave nothing to paint from, and why. */
  refusal: WalkRefusal | null
  /** `held` while the browser keeps the screen on, `cannot` where it has no way to. */
  awake: 'held' | 'cannot' | 'off'
  /** The clock, moved each second while painting. */
  nowMs: number
  start: () => void
  pause: () => void
  resume: (join: boolean) => void
  /** Takes the walk's state as its own: a walk found on the phone from before. It comes back paused. */
  restore: (state: WalkState) => void
  /** Stops reading and forgets the walk. */
  clear: () => void
}

/** What is kept on the phone beside the walk, by the screen that owns it. */
export function writeKeptWalk(userId: string, kept: { savedAtMs: number; map: unknown; state: WalkState | null } | null): void {
  try {
    if (kept) window.localStorage.setItem(keptWalkKey(userId), JSON.stringify(kept))
    else window.localStorage.removeItem(keptWalkKey(userId))
  } catch {
    // A phone with no room, or a private window: the walk lives in this page alone.
  }
}

export function readKeptWalkRaw(userId: string): string | null {
  try {
    return window.localStorage.getItem(keptWalkKey(userId))
  } catch {
    return null
  }
}

export function usePaintedWalk(): PaintedWalkHost {
  const [state, setState] = useState<WalkState | null>(null)
  const [refusal, setRefusal] = useState<WalkRefusal | null>(null)
  const [awake, setAwake] = useState<'held' | 'cannot' | 'off'>('off')
  const [nowMs, setNowMs] = useState(() => Date.now())
  const watchId = useRef<number | null>(null)
  const lock = useRef<WakeLockSentinelLike | null>(null)
  const painting = state?.status === 'painting'

  const stopWatching = useCallback(() => {
    if (watchId.current != null && typeof navigator !== 'undefined' && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
  }, [])

  const letScreenSleep = useCallback(() => {
    void lock.current?.release().catch(() => {})
    lock.current = null
    setAwake('off')
  }, [])

  const holdScreen = useCallback(() => {
    const wakeLock = (typeof navigator !== 'undefined' ? (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock : undefined) ?? null
    if (!wakeLock) {
      setAwake('cannot')
      return
    }
    wakeLock.request('screen').then(
      (sentinel) => {
        lock.current = sentinel
        setAwake('held')
      },
      // Refused: a low battery, or a browser that will not just now. The person keeps the screen on by hand.
      () => setAwake('cannot'),
    )
  }, [])

  // Reading the phone, for as long as the walk is painting and no longer.
  useEffect(() => {
    if (!painting) {
      stopWatching()
      letScreenSleep()
      return
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setRefusal('none')
      setState((s) => (s ? walkPause(s, Date.now()) : s))
      return
    }
    holdScreen()
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setRefusal(null)
        const now = Date.now()
        setState((s) => (s ? walkFix(s, { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null, atMs: pos.timestamp || now }, now) : s))
      },
      (err) => {
        // A refusal ends the reading. A reading that did not come in time is tried again by the browser itself.
        if (err.code === 1) {
          setRefusal('refused')
          setState((s) => (s ? walkPause(s, Date.now()) : s))
        } else if (err.code === 2) {
          setRefusal('failed')
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    )
    const tick = window.setInterval(() => {
      const now = Date.now()
      setNowMs(now)
      setState((s) => (s ? walkTick(s, now) : s))
    }, 1000)
    return () => {
      window.clearInterval(tick)
      stopWatching()
    }
  }, [painting, holdScreen, letScreenSleep, stopWatching])

  // The page left the screen, or came back. A browser reads nothing for a hidden page, so the walk pauses and says so.
  useEffect(() => {
    const onVisibility = () => {
      const now = Date.now()
      setNowMs(now)
      setState((s) => (s ? (document.visibilityState === 'hidden' ? walkHidden(s, now) : walkShown(s, now)) : s))
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // Leaving the screen that paints ends the reading, whatever state it was in.
  useEffect(
    () => () => {
      stopWatching()
      void lock.current?.release().catch(() => {})
      lock.current = null
    },
    [stopWatching],
  )

  const start = useCallback(() => {
    setRefusal(null)
    const now = Date.now()
    setNowMs(now)
    setState(startWalk(now))
  }, [])
  const pause = useCallback(() => setState((s) => (s ? walkPause(s, Date.now()) : s)), [])
  const resume = useCallback((join: boolean) => {
    setRefusal(null)
    const now = Date.now()
    setNowMs(now)
    setState((s) => (s ? walkResume(s, join, now) : s))
  }, [])
  const restore = useCallback((kept: WalkState) => {
    setRefusal(null)
    setNowMs(Date.now())
    setState(kept)
  }, [])
  const clear = useCallback(() => {
    stopWatching()
    setRefusal(null)
    setState(null)
  }, [stopWatching])

  return { state, refusal, awake, nowMs, start, pause, resume, restore, clear }
}
