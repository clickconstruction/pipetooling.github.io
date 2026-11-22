/**
 * Keeping a walker in view while a walk is painted (punch list #387, step 3). Pure.
 *
 * The Leaflet canvas has slid the map to the walker since walks were built (`Follow` in
 * `PaintedMapCanvas`): it leaves the map alone while they are in the middle of it and slides to them
 * when they near its edge. Google's canvas asks here, so the two follow alike, number for number.
 *
 * The middle is the box less a quarter of its shorter side all round. An area is never slid to: the
 * caller hands no reading for one.
 */
import type { PaintedPoint } from './paintedLine'
import { worldPx } from './paintedMapPicture'
import type { PaintedMapView } from './paintedMapView'

/** How much of the box's shorter side, on each side, is its edge for a walker. */
export const FOLLOW_EDGE = 0.25

/** Where the walker's dot is in the map's box, in the screen's dots from its top left. */
export function pointInBox(at: PaintedPoint, view: PaintedMapView, box: { width: number; height: number }): { x: number; y: number } {
  const mid = worldPx(view.center, view.zoom)
  const px = worldPx(at, view.zoom)
  return { x: px.x - mid.x + box.width / 2, y: px.y - mid.y + box.height / 2 }
}

/**
 * Where to slide the map: to the walker when they are out of its middle, or null to leave it. A map
 * that has not settled, or a box with no size, cannot say where they are, and slides to them.
 */
export function followStep(ask: { me: PaintedPoint; view: PaintedMapView | null; box: { width: number; height: number } }): PaintedPoint | null {
  const to = { lat: ask.me.lat, lng: ask.me.lng }
  if (!ask.view || !(ask.box.width > 0 && ask.box.height > 0)) return to
  const at = pointInBox(ask.me, ask.view, ask.box)
  const margin = Math.min(ask.box.width, ask.box.height) * FOLLOW_EDGE
  const inside = at.x > margin && at.x < ask.box.width - margin && at.y > margin && at.y < ask.box.height - margin
  return inside ? null : to
}
