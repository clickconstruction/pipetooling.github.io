/**
 * A row that scrolls sideways and what is cut off at each end (v2.4441). A tab row wider than a
 * phone hid its last tabs with nothing to say they were there; the cut end fades instead, and
 * the fade goes when that end is in view.
 */

export interface ScrollEdges {
  /** Something is scrolled out of view past the left end. */
  left: boolean
  /** Something is still out of view past the right end. */
  right: boolean
}

export const NO_SCROLL_EDGES: ScrollEdges = { left: false, right: false }

/** Under this many pixels an end counts as in view (sub-pixel widths and rounding). */
const SLACK_PX = 4

export function scrollEdges(el: { scrollLeft: number; scrollWidth: number; clientWidth: number }): ScrollEdges {
  return {
    left: el.scrollLeft > SLACK_PX,
    right: el.scrollWidth - el.clientWidth - el.scrollLeft > SLACK_PX,
  }
}

/** The CSS mask that fades the cut ends; null when both ends are in view. */
export function scrollEdgeMask(edges: ScrollEdges, fadePx = 28): string | null {
  if (!edges.left && !edges.right) return null
  const stops = [
    edges.left ? 'transparent' : '#000',
    ...(edges.left ? [`#000 ${fadePx}px`] : []),
    ...(edges.right ? [`#000 calc(100% - ${fadePx}px)`] : []),
    edges.right ? 'transparent' : '#000',
  ]
  return `linear-gradient(to right, ${stops.join(', ')})`
}
