/**
 * Placing by hand on a painted map (punch list #387, step 3): the numbers and the small rules a
 * finger's press follows, shared by the Leaflet canvas and Google's so a corner or a dot lands the
 * same on either. Pure.
 *
 * - **The catch.** A dragged point lands on a target it is near on the screen: a place, or the end
 *   of another line. Near is 14 px, never less than the painted map's own snap and never more than
 *   15 m, so a wide view cannot catch a gate from across a field.
 * - **The move in hand.** What a finger is doing right now, laid over the line's corners, so the
 *   line follows the finger before the caller is told.
 * - **The glass.** A fingertip hides the spot it is placing. The glass shows that spot two zoom
 *   steps in and rides above the finger, or to a side when the top of the map is too near.
 * - **A box and the ground.** Where a spot is in the map's box and what spot a press is on, worked
 *   out from the view and the box's size with no map library.
 */
import { snapTarget, metersPerPixel, type PaintedPoint, type SnapTarget } from './paintedLine'
import { PAINTED_SNAP_METERS } from './paintedMap'
import { worldPx } from './paintedMapPicture'
import { worldPoint, type PaintedMapView } from './paintedMapView'

/** A dragged point catches a target this near on the screen. */
export const SNAP_PX = 14
/** However wide the view, a catch reaches no further than this on the ground. */
export const SNAP_MAX_METERS = 15
/** How long a press is held still before it becomes a placing press. */
export const HOLD_MS = 380
/** A press that moves this far before then is a drag of the map. */
export const HOLD_SLOP_PX = 10
/** The glass, corner to corner. */
export const GLASS_SIZE = 132
/** How many zoom steps in the glass looks. */
export const GLASS_ZOOM_IN = 2
/** The room between a fingertip and the glass's nearest edge. */
export const GLASS_GAP = 34

/** What a finger is doing right now: moving a corner, making one in a leg, adding one at the end, or placing a dot. */
export type PaintedLive =
  | { kind: 'move'; index: number; point: PaintedPoint; caught: SnapTarget | null }
  | { kind: 'insert'; after: number; point: PaintedPoint; caught: SnapTarget | null }
  | { kind: 'add'; point: PaintedPoint; caught: SnapTarget | null }
  | { kind: 'dot'; point: PaintedPoint; caught: SnapTarget | null }

/** How far a catch reaches on the ground at a zoom and a latitude. */
export function snapReachMeters(zoom: number, lat: number): number {
  return Math.min(SNAP_MAX_METERS, Math.max(PAINTED_SNAP_METERS, SNAP_PX * metersPerPixel(zoom, lat)))
}

/** Where a dragged point lands: on the target it is near on the screen, or where the finger is. */
export function settlePoint(p: PaintedPoint, targets: ReadonlyArray<SnapTarget>, zoom: number): { point: PaintedPoint; caught: SnapTarget | null } {
  const caught = snapTarget(p, targets, snapReachMeters(zoom, p.lat))
  return { point: caught ? { lat: caught.lat, lng: caught.lng } : p, caught }
}

/** The draft's corners with the move a finger is making right now laid over them. */
export function withLive(points: ReadonlyArray<PaintedPoint>, live: PaintedLive | null): PaintedPoint[] {
  if (!live || live.kind === 'dot') return points.slice()
  if (live.kind === 'move') return points.map((p, i) => (i === live.index ? live.point : p))
  if (live.kind === 'insert') return [...points.slice(0, live.after + 1), live.point, ...points.slice(live.after + 1)]
  return [...points, live.point]
}

/**
 * Where the glass's middle sits in the map's box: above the finger, or to whichever side has more
 * of the map when the top is too near, and always whole inside the box.
 */
export function glassSpot(finger: { x: number; y: number }, box: { width: number; height: number }): { x: number; y: number } {
  const half = GLASS_SIZE / 2
  let x = finger.x
  let y = finger.y - GLASS_GAP - half
  if (y - half < 4) {
    y = Math.max(half + 4, finger.y - 10)
    x = finger.x > box.width / 2 ? finger.x - GLASS_GAP - half - 24 : finger.x + GLASS_GAP + half + 24
  }
  x = Math.min(box.width - half - 4, Math.max(half + 4, x))
  y = Math.min(box.height - half - 4, Math.max(half + 4, y))
  return { x, y }
}

/** The spot under a press in the map's box: `pointInBox` (`followMe.ts`) the other way. */
export function spotAtBox(at: { x: number; y: number }, view: PaintedMapView, box: { width: number; height: number }): PaintedPoint {
  const mid = worldPx(view.center, view.zoom)
  return worldPoint({ x: mid.x + at.x - box.width / 2, y: mid.y + at.y - box.height / 2 }, view.zoom)
}

/** The view the glass looks through: the spot under the finger, two zoom steps in. */
export function glassView(point: PaintedPoint, mapZoom: number): PaintedMapView {
  return { center: { lat: point.lat, lng: point.lng }, zoom: mapZoom + GLASS_ZOOM_IN }
}

/**
 * A glass whose picture is a map of its own asks that map for the view it looks through. A map of
 * photographs gives a zoom no deeper than its photograph goes at the spot. On ground it has not
 * drawn before it learns that depth a moment after it is asked, and says the zoom it truly took
 * only when it is asked again. While the finger rests the glass asks again this long after. An ask
 * the map has already answered moves nothing and fetches nothing.
 */
export const GLASS_ASK_AGAIN_MS: ReadonlyArray<number> = [150, 600, 1500]

/**
 * How much larger the glass draws its own map's picture: only the zoom steps that map could not
 * give. One when the map gave the view asked for, which is a sharp picture. A map that cannot say
 * its zoom is taken at its word.
 */
export function glassPictureScale(askedZoom: number, gaveZoom: number | null | undefined): number {
  if (gaveZoom == null || !Number.isFinite(gaveZoom)) return 1
  return 2 ** Math.max(0, askedZoom - gaveZoom)
}
