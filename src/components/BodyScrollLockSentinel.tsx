import { useEffect } from 'react'
import { acquireBodyScrollLock } from '../lib/bodyScrollLock'
import { findBlockingOverlays } from '../lib/blockingOverlay'
import { createFrameFallbackScheduler } from '../lib/frameFallbackScheduler'

/**
 * App-wide body scroll lock (v2.2186). Mounted once in Layout. Watches the DOM
 * (MutationObserver, coalesced to one recompute per animation frame) and holds
 * the reference-counted lock from `bodyScrollLock.ts` while any blocking
 * overlay — a fixed layer covering the viewport — is on screen. That covers
 * every existing modal, sheet and confirm dialog without per-modal code, and
 * every one written from now on. Opt a modal out with
 * `data-page-scroll="allow"` on its overlay; opt a non-overlay freeze in with
 * `useBodyScrollLock(true)` as before (the lock is refcounted, so both coexist).
 *
 * The recompute reads a handful of candidates' rects — cheap — and the lock's
 * own body-style mutation re-triggers it once and settles (idempotent).
 *
 * Scheduling goes through `frameFallbackScheduler` (v2.2357): rAF callbacks
 * are suspended while the document is hidden, and an rAF-only recompute left
 * the lock applied forever when a modal unmounted without a frame ever firing
 * (bid preview → "Open in Bids" quick link in a hidden/embedded tab).
 */
/** While the lock is held, re-verify this often even with no DOM mutations (v2.NEXT). */
export const SCROLL_LOCK_WATCHDOG_MS = 3000

export default function BodyScrollLockSentinel() {
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return
    let release: (() => void) | null = null
    let watchdog: number | null = null

    const recompute = () => {
      const blocking = findBlockingOverlays(document, window).length > 0
      if (blocking && !release) {
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
        release = acquireBodyScrollLock(document.body, window, scrollbarWidth)
        // Watchdog (v2.NEXT): a leaked lock froze the Bids/Followup pages until a
        // refresh — an overlay left the DOM without any mutation the observer saw
        // (or the frame never fired). While locked, re-verify on a slow interval
        // so a stale lock always heals itself within a few seconds.
        if (watchdog == null) watchdog = window.setInterval(schedule, SCROLL_LOCK_WATCHDOG_MS)
      } else if (!blocking && release) {
        release()
        release = null
        if (watchdog != null) {
          window.clearInterval(watchdog)
          watchdog = null
        }
      }
    }
    // The instant heal: a scroll attempt (wheel, touch drag, PageDown/space/arrows)
    // while the lock is held re-checks immediately — if the overlay is really gone,
    // the very gesture that hit the freeze releases it.
    const onScrollIntent = () => {
      if (release) schedule()
    }
    const { schedule, cancel } = createFrameFallbackScheduler(
      {
        requestAnimationFrame: (cb) => window.requestAnimationFrame(cb),
        cancelAnimationFrame: (id) => window.cancelAnimationFrame(id),
        setTimeout: (cb, ms) => window.setTimeout(cb, ms),
        clearTimeout: (id) => window.clearTimeout(id),
      },
      recompute,
    )

    const observer = new MutationObserver(schedule)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden', 'role', 'aria-modal', 'data-page-scroll'],
    })
    window.addEventListener('resize', schedule)
    window.addEventListener('wheel', onScrollIntent, { passive: true })
    window.addEventListener('touchmove', onScrollIntent, { passive: true })
    window.addEventListener('keydown', onScrollIntent)
    schedule()

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('wheel', onScrollIntent)
      window.removeEventListener('touchmove', onScrollIntent)
      window.removeEventListener('keydown', onScrollIntent)
      cancel()
      if (watchdog != null) {
        window.clearInterval(watchdog)
        watchdog = null
      }
      release?.()
      release = null
    }
  }, [])
  return null
}
