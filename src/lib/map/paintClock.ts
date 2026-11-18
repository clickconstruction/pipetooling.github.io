/**
 * The paint clock of a Google map: how long a loaded Maps API may leave a frame with no map in it
 * before the card gives the map up for OpenStreetMap. Pure; `PinsMapGoogleCanvas` reads it.
 *
 * The clock is there for a rejected key. On 2026-09-08 a bogus key loaded the script, made the
 * markers and left the frame an empty div, with neither the loader's `onError` nor `gm_authFailure`
 * fired, so a frame still empty after eight seconds was the only sign. Google's 3.67 build paints
 * with a bogus key and then calls `gm_authFailure` (2026-11-18), so today the clock is the last
 * door, for a frame that stays empty and says nothing.
 *
 * An empty frame is that sign only while Google could have painted. `new google.maps.Map` waits on
 * its own `IntersectionObserver` before it builds anything, so a map far down a long page has no
 * `.gm-style` however good the key is (read in the API's 3.67 build, 2026-11-18: a margin of
 * 2,500 px around the window on a 4g connection, 3,500 on 3g, 6,000 on 2g, 4,000 when the browser
 * does not say). So the clock counts only the looks at which the frame was in the window, and a
 * card nobody has scrolled to waits as long as it takes.
 *
 * It counts looks, not the wall clock. A browser that slows a page's timers then slows the clock
 * with them, and never runs it out in one late look.
 */

/** How long a frame in the window may stay empty. */
export const PAINT_TIMEOUT_MS = 8000
/** How often the canvas looks. */
export const PAINT_POLL_MS = 500

export type PaintClockLook = {
  /** Google's map is in the frame (`.gm-style`). */
  painted: boolean
  /** The frame is in the window, so Google's own wait is over and it could paint. */
  inView: boolean
}

export type PaintClockVerdict = 'painted' | 'waiting' | 'never-painted'

export type PaintClockStep = {
  /** The time counted so far, to hand to the next look. */
  waitedMs: number
  verdict: PaintClockVerdict
}

/**
 * One look at the frame. `waitedMs` is what the look before it answered, `0` at the first.
 * `painted` and `never-painted` are final: the canvas stops looking at either.
 */
export function paintClockLook(waitedMs: number, look: PaintClockLook, pollMs: number = PAINT_POLL_MS, timeoutMs: number = PAINT_TIMEOUT_MS): PaintClockStep {
  if (look.painted) return { waitedMs, verdict: 'painted' }
  if (!look.inView) return { waitedMs, verdict: 'waiting' }
  const next = waitedMs + pollMs
  return { waitedMs: next, verdict: next >= timeoutMs ? 'never-painted' : 'waiting' }
}
