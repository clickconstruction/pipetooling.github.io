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
export default function BodyScrollLockSentinel() {
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return
    let release: (() => void) | null = null

    const recompute = () => {
      const blocking = findBlockingOverlays(document, window).length > 0
      if (blocking && !release) {
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
        release = acquireBodyScrollLock(document.body, window, scrollbarWidth)
      } else if (!blocking && release) {
        release()
        release = null
      }
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
    schedule()

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', schedule)
      cancel()
      release?.()
      release = null
    }
  }, [])
  return null
}
