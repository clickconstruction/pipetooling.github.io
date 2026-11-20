/**
 * The doors a Google canvas falls back through, shared by every canvas that draws on Google: the
 * pins canvas (`PinsMapGoogleCanvas`) and a painted map's (punch list #387). Each door ends in the
 * caller's `onUnavailable`, which the screen treats as "draw on Leaflet for the rest of this page".
 *
 * - The script never arrives: the load timeout.
 * - Google refuses the key: its own word, `gm_authFailure` (`googleAuthFailure.ts`).
 * - The script arrives and the frame stays empty: the paint clock (`paintClock.ts`), which counts
 *   only while the frame is in the window, since Google builds no map off screen (v2.7876).
 *
 * Two more are each canvas's own: the loader's `onError`, handed to `APIProvider`, and an exception
 * while the canvas draws, caught by `GoogleCanvasBoundary`.
 * Moved here from the pins canvas as they were, so one fix reaches every Google map.
 */
import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react'
import { onGoogleAuthFailure } from '../lib/map/googleAuthFailure'
import { PAINT_POLL_MS, paintClockLook } from '../lib/map/paintClock'

/** How long the Maps script may take before the screen gives up on it. */
export const GOOGLE_LOAD_TIMEOUT_MS = 10000

/**
 * Whether the map's frame is in the window, for the paint clock (`paintClock.ts`). Google builds no
 * map until its own observer sees the div, so the clock must not run before ours does. Ours has no
 * margin and Google's has 2,500 px at the least, so whenever this says yes Google's wait is over.
 * A browser with no `IntersectionObserver` gets no wait from Google either, and always reads yes.
 * A ref, not state: only the clock reads it, and a scroll must not redraw the map.
 */
export function useFrameInView(frameRef: RefObject<HTMLDivElement | null>): MutableRefObject<boolean> {
  const inView = useRef(typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const frame = frameRef.current
    if (!frame || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1]
      if (last) inView.current = last.isIntersecting
    })
    obs.observe(frame)
    return () => obs.disconnect()
  }, [frameRef])
  return inView
}

/** The app's stamped theme (`<html data-theme>`), followed as it changes, for Google's own colour scheme. */
export function useStampedTheme(): string | null {
  const [theme, setTheme] = useState<string | null>(() =>
    typeof document === 'undefined' ? null : (document.documentElement.dataset.theme ?? null),
  )
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return
    const obs = new MutationObserver(() => setTheme(document.documentElement.dataset.theme ?? null))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return theme
}

/**
 * The paint clock, the load timeout and Google's own word, for one canvas. `frameRef` is the div the
 * map is in, and `loaded` turns true when the loader says the script is in.
 */
export function useGoogleCanvasDoors({ frameRef, loaded, onUnavailable }: { frameRef: RefObject<HTMLDivElement | null>; loaded: boolean; onUnavailable: (reason: string) => void }): void {
  const frameInView = useFrameInView(frameRef)
  // Paint watchdog: once the script has loaded, the map must materialise in the frame. Its clock runs
  // only while the frame is in the window.
  useEffect(() => {
    if (!loaded) return
    let waitedMs = 0
    const tick = window.setInterval(() => {
      const step = paintClockLook(waitedMs, { painted: !!frameRef.current?.querySelector('.gm-style'), inView: frameInView.current })
      waitedMs = step.waitedMs
      if (step.verdict === 'waiting') return
      window.clearInterval(tick)
      if (step.verdict === 'never-painted') onUnavailable('render: the Maps API loaded but never painted a map (key rejected or blocked?)')
    }, PAINT_POLL_MS)
    return () => window.clearInterval(tick)
  }, [loaded, onUnavailable, frameInView, frameRef])
  useEffect(() => {
    if (loaded) return
    const t = window.setTimeout(() => onUnavailable('timeout: Maps JavaScript API did not load'), GOOGLE_LOAD_TIMEOUT_MS)
    return () => window.clearTimeout(t)
  }, [loaded, onUnavailable])
  // A rejected key (invalid, referrer-blocked, API not enabled, billing off) does NOT fail the
  // script load: the API paints a grey map and says so through one global, which every canvas hears.
  useEffect(() => onGoogleAuthFailure(() => onUnavailable('auth: Google rejected the browser key for this page')), [onUnavailable])
}
