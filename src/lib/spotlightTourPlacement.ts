/**
 * Pure placement math for the SpotlightTour caption card: where the card sits
 * relative to the highlighted anchor, clamped to the viewport. Kept DOM-free so
 * the flip/clamp rules are unit-testable.
 */

export type TourRect = { top: number; left: number; width: number; height: number }

export type TourCardPlacement = {
  top: number
  left: number
  /** Which side of the anchor the card landed on (below preferred). */
  side: 'below' | 'above'
}

const EDGE = 8

/**
 * Place the caption card below the anchor when it fits, else above; when it
 * fits on neither side (tall anchor on a short viewport), pin it to the bottom
 * edge. Horizontally centered on the anchor, clamped to the viewport.
 */
export function placeTourCard(
  anchor: TourRect,
  viewport: { width: number; height: number },
  card: { width: number; height: number },
  gap = 12,
): TourCardPlacement {
  const left = Math.min(
    Math.max(anchor.left + anchor.width / 2 - card.width / 2, EDGE),
    Math.max(viewport.width - card.width - EDGE, EDGE),
  )
  const belowTop = anchor.top + anchor.height + gap
  if (belowTop + card.height + EDGE <= viewport.height) {
    return { top: belowTop, left, side: 'below' }
  }
  const aboveTop = anchor.top - gap - card.height
  if (aboveTop >= EDGE) {
    return { top: aboveTop, left, side: 'above' }
  }
  return { top: Math.max(viewport.height - card.height - EDGE, EDGE), left, side: 'below' }
}

/** The spotlight hole: the anchor rect plus breathing room, clamped to the viewport. */
export function spotlightHole(anchor: TourRect, viewport: { width: number; height: number }, pad = 6): TourRect {
  const top = Math.max(anchor.top - pad, 0)
  const left = Math.max(anchor.left - pad, 0)
  return {
    top,
    left,
    width: Math.min(anchor.width + pad * 2, viewport.width - left),
    height: Math.min(anchor.height + pad * 2, viewport.height - top),
  }
}
