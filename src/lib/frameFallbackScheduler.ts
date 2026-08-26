/**
 * Coalesced "run this soon" scheduler with a timer fallback (v2.2357).
 *
 * `requestAnimationFrame` alone is not a reliable way to defer work: the
 * browser suspends rAF callbacks whenever `document.visibilityState` is
 * `hidden` — background tabs, paused webviews, embedded preview panes. The
 * body-scroll-lock sentinel used to coalesce its recompute through rAF only,
 * so a modal that unmounted while no frames were being produced (the Bid Board
 * preview's "Open in Bids" quick links navigating away) left the page frozen:
 * the release recompute was scheduled but its frame never came.
 *
 * Here every `schedule()` arms both a frame and a timer; whichever fires first
 * runs the callback once and disarms the other. Frames keep the common case
 * batched to the paint cycle; the timer guarantees the run even when frames
 * are suspended entirely.
 */

/** The subset of `window` the scheduler needs — injectable for tests. */
export type FrameFallbackHost = {
  requestAnimationFrame: (cb: () => void) => number
  cancelAnimationFrame: (id: number) => void
  setTimeout: (cb: () => void, ms: number) => number
  clearTimeout: (id: number) => void
}

export type FrameFallbackScheduler = {
  /** Queue one run; further calls before it fires are coalesced into it. */
  schedule: () => void
  /** Disarm a pending run (both the frame and the timer). */
  cancel: () => void
}

export function createFrameFallbackScheduler(
  host: FrameFallbackHost,
  run: () => void,
  fallbackMs = 150,
): FrameFallbackScheduler {
  let frame: number | null = null
  let timer: number | null = null

  const cancel = () => {
    if (frame != null) host.cancelAnimationFrame(frame)
    if (timer != null) host.clearTimeout(timer)
    frame = null
    timer = null
  }

  const fire = () => {
    cancel()
    run()
  }

  const schedule = () => {
    if (frame != null || timer != null) return
    frame = host.requestAnimationFrame(fire)
    timer = host.setTimeout(fire, fallbackMs)
  }

  return { schedule, cancel }
}
