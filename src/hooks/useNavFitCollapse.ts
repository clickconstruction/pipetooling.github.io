import { useLayoutEffect, useRef, useState } from 'react'
import {
  NAV_FIT_INITIAL,
  navFitOnCollapsedResize,
  navFitOnDesktopMeasure,
  type NavFitState,
} from '../lib/navFitCollapse'

/**
 * Returns true when the desktop header nav should collapse into the mobile
 * variant because its content doesn't fit the row (see lib/navFitCollapse.ts
 * for the state machine). `desktopRendered` must be false when the caller is
 * already rendering the mobile header for another reason (narrow viewport) —
 * measurements only make sense against the desktop row.
 */
export function useNavFitCollapse(
  navRef: React.RefObject<HTMLElement | null>,
  desktopRendered: boolean
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
      ro?.disconnect()
    }
  }, [navRef, desktopRendered, state.collapsed])

  return state.collapsed
}
