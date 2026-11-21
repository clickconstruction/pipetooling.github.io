/**
 * Keeping a reader and the painted map in the picture together (punch list #387, step 4). Pure.
 *
 * The public page asks for it: a reader who pressed **Show where I am** wants to see the line and
 * their own dot at once, to walk to it. The Leaflet canvas has done it since the page was built
 * (`FrameMe` in `PaintedMapCanvas`), through Leaflet's own bounds and fit. Google's map has no fit
 * that stops where the photograph is sharp, so its canvas asks here, and the rule is the Leaflet
 * canvas's own, number for number:
 *
 * - The first reading frames everything on the map with the reader.
 * - After that the view is the reader's own. It is framed again only when their dot comes within
 *   the outer 8% of what the map shows, or leaves it.
 * - A reader standing on a map that is one point is drawn at the point zoom.
 */
import type { PaintedPoint } from './paintedLine'
import { PAINTED_FIT_PAD, paintedFitView, paintedViewBounds, type PaintedMapView } from './paintedMapView'

/** How much of what the map shows, on each side, counts as its edge. Leaflet's `pad(-0.08)`. */
export const FRAME_ME_EDGE = 0.08

export type FrameMeAsk = {
  /** The canvas has framed the reader once already. */
  framed: boolean
  me: PaintedPoint
  /** Everything on the map: each line's points and each place. */
  points: ReadonlyArray<PaintedPoint>
  /** What the map is on now. Null for a map that has not settled, which cannot say what it shows. */
  view: PaintedMapView | null
  /** The size of the map's box, as it is now. */
  box: { width: number; height: number }
}

/** Whether the reader's dot is well inside what the map shows: not in its outer edge on any side. */
export function meIsWellInside(me: PaintedPoint, view: PaintedMapView, box: { width: number; height: number }): boolean {
  if (!(box.width > 0 && box.height > 0)) return false
  const shown = paintedViewBounds(view, box)
  const tall = (shown.north - shown.south) * FRAME_ME_EDGE
  const wide = (shown.east - shown.west) * FRAME_ME_EDGE
  return me.lat >= shown.south + tall && me.lat <= shown.north - tall && me.lng >= shown.west + wide && me.lng <= shown.east - wide
}

/**
 * What the canvas does with a reading: the view to move to, or null to leave the map as the reader
 * has it. It has framed once it has asked, whatever the answer.
 */
export function frameMeStep(ask: FrameMeAsk): { framed: true; move: PaintedMapView | null } {
  if (ask.framed && ask.view && meIsWellInside(ask.me, ask.view, ask.box)) return { framed: true, move: null }
  return { framed: true, move: paintedFitView([...ask.points, { lat: ask.me.lat, lng: ask.me.lng }], ask.box, PAINTED_FIT_PAD) }
}
