import { useLayoutEffect, useRef, useState } from 'react'
import {
  NAV_FIT_INITIAL,
  navFitOnCollapsedResize,
  navFitOnDesktopMeasure,
  type NavFitState,
} from '../lib/navFitCollapse'

/**
 * Re-measure delays (ms after a measurement pass is set up). The header keeps
 * growing after mount — `role` flips from null ~0.5s in and brings the extra
 * nav links, the search button and the Job Mode buttons with it — so the mount
 * measurement alone sees a row that still fits.
 */
const NAV_FIT_SETTLE_MS = [0, 400, 1200] as const

/**
 * Returns true when the desktop header nav should collapse into the mobile
 * variant because its content doesn't fit the row (see lib/navFitCollapse.ts
 * for the state machine). `desktopRendered` must be false when the caller is
 * already rendering the mobile header for another reason (narrow viewport) —
 * measurements only make sense against the desktop row.
 *
 * `contentKey` is any value that changes when the header's content changes
 * (role, impersonation, Job Mode): a change re-runs the measurement instead of
 * waiting for an observer to notice the new width.
 */
export function useNavFitCollapse(
  navRef: React.RefObject<HTMLElement | null>,
  desktopRendered: boolean,
  contentKey?: string
): boolean {
  const [state, setState] = useState<NavFitState>(NAV_FIT_INITIAL)
  const stateRef = useRef(state)
  stateRef.current = state

  useLayoutEffect(() => {
    // documentElement.clientWidth, not window.innerWidth: when the header
    // overflows, mobile-emulation layout viewports expand innerWidth to the
    // content width, which would poison the recorded expand threshold.
    const viewportPx = () => document.documentElement.clientWidth
    const measure = () => {
      const s = stateRef.current
      const el = navRef.current
      const next =
        desktopRendered && !s.collapsed && el
          ? navFitOnDesktopMeasure(s, viewportPx(), el.scrollWidth - el.clientWidth)
          : navFitOnCollapsedResize(s, viewportPx())
      if (next !== s) setState(next)
    }
    measure()
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    // Settle passes. The ResizeObserver below is the normal trigger for
    // content that grows after mount, but its callbacks are only delivered on a
    // rendering opportunity: a tab that never renders — opened in the
    // background, an occluded preview pane, a headless capture — gets none of
    // them, and the desktop row it was measuring stays overflowing until
    // something dispatches a resize. Timers still fire there, so re-measure on
    // a short schedule as well; each pass is a no-op once the row fits.
    const timers = NAV_FIT_SETTLE_MS.map((ms) => window.setTimeout(measure, ms))
    // Content changes (role load, impersonation, Job Mode buttons) alter the
    // children's widths without resizing the nav row itself, so observe the
    // direct children too; documentElement covers viewport changes that don't
    // dispatch a window resize event (device emulation).
    let ro: ResizeObserver | null = null
    const el = navRef.current
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure)
      ro.observe(document.documentElement)
      if (el) {
        ro.observe(el)
        for (const child of Array.from(el.children)) ro.observe(child)
      }
    }
    return () => {
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
      for (const t of timers) window.clearTimeout(t)
      ro?.disconnect()
    }
  }, [navRef, desktopRendered, state.collapsed, contentKey])

  return state.collapsed
}
