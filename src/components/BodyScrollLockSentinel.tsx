import { useEffect } from 'react'
import { acquireBodyScrollLock } from '../lib/bodyScrollLock'
import { findBlockingOverlays } from '../lib/blockingOverlay'

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
 */
export default function BodyScrollLockSentinel() {
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return
    let release: (() => void) | null = null
    let frame: number | null = null

    const recompute = () => {
      frame = null
      const blocking = findBlockingOverlays(document, window).length > 0
      if (blocking && !release) {
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
        release = acquireBodyScrollLock(document.body, window, scrollbarWidth)
      } else if (!blocking && release) {
        release()
        release = null
      }
    }
    const schedule = () => {
      if (frame != null) return
      frame = window.requestAnimationFrame(recompute)
    }

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
      if (frame != null) window.cancelAnimationFrame(frame)
      release?.()
      release = null
    }
  }, [])
  return null
}
