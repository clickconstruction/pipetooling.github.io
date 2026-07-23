/**
 * Fit-based collapse for the header nav (Layout.tsx).
 *
 * The desktop header's width varies by role and feature flags (dev shows far
 * more items than a sub), so no single breakpoint can decide when to switch to
 * the mobile hamburger header. Instead: while the desktop header is rendered we
 * measure its real overflow and collapse when it doesn't fit; once collapsed
 * the desktop row no longer exists to measure, so we remember the viewport
 * width it would have needed and expand again only when the window reaches it.
 */

/** Extra width required before re-expanding, so the header doesn't flap at the boundary. */
export const NAV_FIT_HYSTERESIS_PX = 24

export type NavFitState = {
  collapsed: boolean
  /**
   * Minimum viewport width at which expanding back to the desktop header is
   * worth retrying (viewport at collapse time + measured overflow + hysteresis).
   * Null until a collapse has happened. If the nav's content later shrinks
   * (role change, impersonation ends) this can overestimate; the cost is
   * staying collapsed until the window grows past the stale requirement.
   */
  minExpandViewportPx: number | null
}

export const NAV_FIT_INITIAL: NavFitState = { collapsed: false, minExpandViewportPx: null }

/**
 * Apply a measurement taken while the desktop header is rendered.
 * `overflowPx` is `scrollWidth - clientWidth` of the nav row (>0 means the
 * content doesn't fit).
 */
export function navFitOnDesktopMeasure(state: NavFitState, viewportPx: number, overflowPx: number): NavFitState {
  if (overflowPx <= 0) {
    return state.collapsed ? { ...state, collapsed: false } : state
  }
  return { collapsed: true, minExpandViewportPx: viewportPx + overflowPx + NAV_FIT_HYSTERESIS_PX }
}

/** Apply a viewport resize while collapsed — expand once the recorded requirement fits. */
export function navFitOnCollapsedResize(state: NavFitState, viewportPx: number): NavFitState {
  if (!state.collapsed) return state
  if (state.minExpandViewportPx != null && viewportPx >= state.minExpandViewportPx) {
    return { ...state, collapsed: false }
  }
  return state
}
