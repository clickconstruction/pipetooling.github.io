/**
 * A map's office view (v2.8330, the owner's ask of 2026-11-23 for the Dashboard's *Your jobs on a map*): the map
 * opens centred on the office and shows about a hundred miles around it, where it used to fit every pin and let
 * one far job shrink the rest to a blob.
 *
 * *About a hundred miles* is read on the frame's shorter side: the distance from the office to the nearer edge.
 * Both maps zoom in whole steps, and a step doubles the distance, so the view takes the step that lands nearest
 * a hundred miles. A phone's frame is 260 px tall and shows about 86 miles up and down, a desk's is 360 px and
 * shows about 119.
 *
 * Pure. The card hands the answer's `fitPoints` to the shared canvases' own `fitPoints` override, so neither
 * canvas and no other map changes. The points are a box that both canvases' fit lands on this view's zoom for:
 * as large as the frame less their padding allows, so it fits at this zoom and not at the next.
 */
import { val } from '../valuesInPlace'
import { METERS_PER_MILE } from './mapCanvasTypes'
import type { MapBounds, MapPoint } from './mapPointsBounds'

/** The distance the owner asked for, from the office to the nearer edge of the frame. */
export const OFFICE_VIEW_RADIUS_MILES = 100

/** The padding both pins canvases fit with (`PinsMapCanvas`, `PinsMapGoogleCanvas`). `officeView.test.ts` reads it off both. */
export const MAP_FIT_PADDING_PX = 28

const TILE_PX = 256
const EARTH_CIRCUMFERENCE_M = 40075016.686
const MIN_ZOOM = 3
const MAX_ZOOM = 15
/** Web Mercator stops short of the poles. */
const MAX_LAT = 85.05112878

export type OfficeViewFrame = {
  /** The frame's width in px, or null before it is measured: the view is then read as square on the height. */
  width: number | null
  height: number
}

export type OfficeView = {
  center: MapPoint
  /** A whole zoom step, as both maps take. */
  zoom: number
  /** What the frame shows from the office to its nearer edge at that zoom, in miles. */
  radiusMiles: number
  /** The ground the frame shows at that zoom. */
  bounds: MapBounds
  /** What the canvases fit to land on this view. */
  fitPoints: MapPoint[]
}

const clampLat = (lat: number) => Math.max(-MAX_LAT, Math.min(MAX_LAT, lat))
const worldPx = (zoom: number) => TILE_PX * 2 ** zoom

function toPx(p: MapPoint, zoom: number): { x: number; y: number } {
  const world = worldPx(zoom)
  const sin = Math.sin((clampLat(p.lat) * Math.PI) / 180)
  return { x: ((p.lng + 180) / 360) * world, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * world }
}

function fromPx(x: number, y: number, zoom: number): MapPoint {
  const world = worldPx(zoom)
  const n = Math.PI - (2 * Math.PI * y) / world
  return { lat: (180 / Math.PI) * Math.atan(Math.sinh(n)), lng: (x / world) * 360 - 180 }
}

/** Metres of ground one px covers at a latitude and zoom. */
export function metersPerPx(lat: number, zoom: number): number {
  return (EARTH_CIRCUMFERENCE_M * Math.cos((clampLat(lat) * Math.PI) / 180)) / worldPx(zoom)
}

/**
 * The office view for a frame, or null when there is no office to centre on or no frame to size it by. The
 * caller then fits its pins, as it did before.
 */
export function officeView(office: MapPoint | null | undefined, frame: OfficeViewFrame, radiusMiles: number = OFFICE_VIEW_RADIUS_MILES): OfficeView | null {
  if (!office || !Number.isFinite(office.lat) || !Number.isFinite(office.lng)) return null
  const height = frame.height
  const width = frame.width != null && frame.width > 0 ? frame.width : height
  if (!(height > 0) || !(radiusMiles > 0)) return null
  const center = { lat: clampLat(office.lat), lng: office.lng }
  // The shorter side decides: a phone's frame is wider than it is tall, a narrow column's is taller.
  const halfShort = Math.min(width, height) / 2
  const wantedMetersPerPx = (radiusMiles * METERS_PER_MILE) / halfShort
  const exactZoom = Math.log2((EARTH_CIRCUMFERENCE_M * Math.cos((center.lat * Math.PI) / 180)) / (TILE_PX * wantedMetersPerPx))
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(exactZoom)))
  const c = toPx(center, zoom)
  const topLeft = fromPx(c.x - width / 2, c.y - height / 2, zoom)
  const bottomRight = fromPx(c.x + width / 2, c.y + height / 2, zoom)
  // A box the fit lands on this zoom for: a hair inside the frame less the canvases' padding.
  const reach = Math.max(1, (halfShort - MAP_FIT_PADDING_PX) * 0.98)
  const north = fromPx(c.x, c.y - reach, zoom)
  const south = fromPx(c.x, c.y + reach, zoom)
  const west = fromPx(c.x - reach, c.y, zoom)
  const east = fromPx(c.x + reach, c.y, zoom)
  return {
    center,
    zoom,
    radiusMiles: (metersPerPx(center.lat, zoom) * halfShort) / METERS_PER_MILE,
    bounds: { south: bottomRight.lat, west: topLeft.lng, north: topLeft.lat, east: bottomRight.lng },
    fitPoints: [north, south, west, east],
  }
}

/** How many of the points the office view does not show. */
export function countOutsideOfficeView(points: readonly MapPoint[], view: OfficeView | null): number {
  if (!view) return 0
  const b = view.bounds
  return points.filter((p) => p.lat < b.south || p.lat > b.north || p.lng < b.west || p.lng > b.east).length
}

/** What a map of dots is showing: the office view, or every dot. */
export type OfficeViewMode = 'office' | 'all'

/**
 * The line under a map that opens on the office view. It names jobs the view leaves out, so none is lost, and
 * says which press shows them. Null when there is nothing to say: no office view, or all of it in view.
 * The count is marked as a value (`valuesInPlace.ts`).
 */
export function officeViewLine(input: { mode: OfficeViewMode; outside: number; noun?: { one: string; many: string } }): string | null {
  const noun = input.noun ?? { one: 'job', many: 'jobs' }
  if (input.mode === 'all') return `Showing every ${noun.one} on the map.`
  if (input.outside <= 0) return null
  return input.outside === 1
    ? `${val('count', '1')} ${noun.one} is outside the office view.`
    : `${val('count', String(input.outside))} ${noun.many} are outside the office view.`
}

/** The press that leaves the office view for every dot, and the one that comes back. */
export const OFFICE_VIEW_SHOW_ALL = 'Fit all'
export const OFFICE_VIEW_BACK = 'Office view'
