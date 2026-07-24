import { useEffect } from 'react'
import { acquireBodyScrollLock } from '../lib/bodyScrollLock'

/**
 * Locks document scroll behind an open modal (iOS-friendly fixed body, scroll
 * offset restored on close). No-op when `locked` is false.
 *
 * The lock is reference-counted in `bodyScrollLock.ts`, so stacked modals are
 * safe: the page stays frozen until the last one closes.
 */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return
    // Width of the scrollbar the fixed body is about to remove — 0 on touch.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    return acquireBodyScrollLock(document.body, window, scrollbarWidth)
  }, [locked])
}
