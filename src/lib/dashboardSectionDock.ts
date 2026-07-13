/** Scrollspy kernel for the dashboard's floating section dock. */

export type DashboardDockSectionAnchor = { id: string; top: number }

/**
 * Active section = the last anchor at or above the activation line (viewport
 * top + ~1/3 height); before the first anchor, the first section is active.
 */
export function pickActiveDashboardSection(
  anchors: DashboardDockSectionAnchor[],
  activationY: number,
): string | null {
  if (anchors.length === 0) return null
  const sorted = [...anchors].sort((a, b) => a.top - b.top)
  let active = sorted[0]!.id
  for (const a of sorted) {
    if (a.top <= activationY) active = a.id
  }
  return active
}

/**
 * Scroll offset that centers a chip inside the dock's scrollable bar, clamped
 * to [0, contentWidth - viewWidth] — near the list's ends the bar pins flush
 * instead of over-scrolling (the highlight walks to the edge).
 */
export function clampedCenterScrollLeft(
  itemLeft: number,
  itemWidth: number,
  viewWidth: number,
  contentWidth: number,
): number {
  const maxScroll = Math.max(0, contentWidth - viewWidth)
  const ideal = itemLeft + itemWidth / 2 - viewWidth / 2
  return Math.min(maxScroll, Math.max(0, ideal))
}
