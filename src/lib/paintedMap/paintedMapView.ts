/**
 * Where a painted map's canvas looks (punch list #387): a centre and a zoom, worked out from the
 * points on the map and the size of its box. Pure. The Google canvas reads it, since Google's own
 * fit has no cap on how close it goes, and a short line would open closer than its photograph is
 * sharp. The Leaflet canvas frames by the same numbers through Leaflet's own fit.
 *
 * A view is also what one canvas hands the other when the map under a painted map changes: a
 * painter who has moved in on a spot keeps that spot.
 */
import { boundsOfPoints, type PaintedPoint } from './paintedLine'
import { worldPx } from './paintedMapPicture'

export type PaintedMapView = { center: PaintedPoint; zoom: number }

/** A map that is one point, or the address a new map opens on, is drawn this close. */
export const PAINTED_POINT_ZOOM = 18
/** A fit goes no closer than this: the deepest zoom the photographs are taken at. */
export const PAINTED_FIT_MAX_ZOOM = 19
/** The deepest a canvas goes at all. Past the photograph's own zoom the map only makes the dots bigger. */
export const PAINTED_MAX_ZOOM = 21
/** Room kept around what is framed, on each side, so a dot at the end of a line is not on the edge. */
export const PAINTED_FIT_PAD = 40
/** A map with nothing on it and no address opens on the lower 48: nobody's place, only somewhere to start a drag. */
export const PAINTED_WIDE_VIEW: PaintedMapView = { center: { lat: 39.5, lng: -98.35 }, zoom: 4 }
/** A box that has not been measured yet is taken for this size, so a view can still be worked out. */
export const PAINTED_UNMEASURED_BOX = { width: 640, height: 420 }

const TILE = 256

/** The point at a pixel of the whole world's flat map at a zoom: `worldPx` the other way. */
export function worldPoint(px: { x: number; y: number }, zoom: number): PaintedPoint {
  const scale = TILE * 2 ** zoom
  const lng = (px.x / scale) * 360 - 180
  const n = Math.PI * (1 - (2 * px.y) / scale)
  const lat = (Math.atan(Math.sinh(n)) * 180) / Math.PI
  return { lat, lng }
}

/**
 * The view that holds every point with room around it: the closest whole zoom at which they fit the
 * box, never closer than the photograph is sharp, centred on them. One point, or several on top of
 * each other, is drawn at the point zoom. Nothing is null: there is no view of nothing.
 */
export function paintedFitView(points: ReadonlyArray<PaintedPoint>, box: { width: number; height: number }, pad: number = PAINTED_FIT_PAD): PaintedMapView | null {
  const b = boundsOfPoints(points)
  if (!b) return null
  if (b.south === b.north && b.west === b.east) return { center: { lat: b.south, lng: b.west }, zoom: PAINTED_POINT_ZOOM }
  const size = box.width > 0 && box.height > 0 ? box : PAINTED_UNMEASURED_BOX
  // A box too small for the room around it still frames: the room gives way before the map does.
  const roomX = Math.max(1, size.width - 2 * pad)
  const roomY = Math.max(1, size.height - 2 * pad)
  const sw = { lat: b.south, lng: b.west }
  const ne = { lat: b.north, lng: b.east }
  let zoom = 1
  for (let z = PAINTED_FIT_MAX_ZOOM; z >= 1; z--) {
    const a = worldPx(sw, z)
    const c = worldPx(ne, z)
    if (Math.abs(c.x - a.x) <= roomX && Math.abs(a.y - c.y) <= roomY) {
      zoom = z
      break
    }
  }
  const a = worldPx(sw, zoom)
  const c = worldPx(ne, zoom)
  // The middle on the flat map, not the middle of the two latitudes, so the points sit level in the box.
  return { center: worldPoint({ x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 }, zoom), zoom }
}

/**
 * The view a canvas opens on.
 * - A view carried from the other canvas wins: the painter keeps the spot they were on.
 * - Otherwise everything on the map, framed.
 * - A map with nothing on it opens on its address, close.
 * - With no address either, the country.
 */
export function paintedOpeningView(input: { carried?: PaintedMapView | null; points: ReadonlyArray<PaintedPoint>; start?: PaintedPoint | null; box: { width: number; height: number } }): PaintedMapView {
  if (input.carried) return clampView(input.carried)
  const fit = paintedFitView(input.points, input.box)
  if (fit) return fit
  if (input.start) return { center: { lat: input.start.lat, lng: input.start.lng }, zoom: PAINTED_POINT_ZOOM }
  return PAINTED_WIDE_VIEW
}

/**
 * What a view shows in a box: the ground at the box's four edges. Worked out from the box's own size and not asked of
 * the map, so a box that changed height in this very draw is read as it is now. The panel beside a painted map can grow
 * in the draw that hands in a rough reading (punch list #402), and a map that measured itself before would say it
 * still shows ground that is now hidden.
 */
export function paintedViewBounds(view: PaintedMapView, box: { width: number; height: number }): { south: number; west: number; north: number; east: number } {
  const mid = worldPx(view.center, view.zoom)
  const sw = worldPoint({ x: mid.x - box.width / 2, y: mid.y + box.height / 2 }, view.zoom)
  const ne = worldPoint({ x: mid.x + box.width / 2, y: mid.y - box.height / 2 }, view.zoom)
  return { south: sw.lat, west: sw.lng, north: ne.lat, east: ne.lng }
}

/** A view as either canvas can take it: a whole zoom, within what both can draw. */
export function clampView(view: PaintedMapView): PaintedMapView {
  const zoom = Math.min(PAINTED_MAX_ZOOM, Math.max(1, Math.round(view.zoom)))
  return { center: { lat: view.center.lat, lng: view.center.lng }, zoom }
}
