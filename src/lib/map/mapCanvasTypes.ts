/**
 * The shape both pins canvases draw (v2.3162): `PinsMapCanvas` (Leaflet) and
 * `PinsMapGoogleCanvas` (Google Maps). Kept out of the canvas files so cards
 * can import the types and the fit helper without pulling a map library in.
 */
import type { MapPoint } from './mapPointsBounds'

export type MapCanvasPin = {
  id: string
  lat: number
  lng: number
  /** Fill color (a saturated status / section color). */
  color: string
  /** When set, the pin gets a thick stroke in this color (the Bid Board's due ring). */
  ringColor?: string | null
  title: string
}

export type MapCanvasAnchor = {
  lat: number
  lng: number
  /** Permanent label beside the diamond. */
  label: string
  /** Dashed rings at these distances, in miles. */
  ringMiles?: readonly number[]
}

/** The selected pin's stroke — the app's link blue. */
export const MAP_CANVAS_SELECTED_COLOR = '#1d4ed8'
/** The anchor diamond's fill. */
export const MAP_CANVAS_ANCHOR_COLOR = '#1e3a8a'

export const METERS_PER_MILE = 1609.344

/**
 * What fit-to-all includes: the caller's `fitPoints` when given (the Bid Board's home fit), else
 * the pins plus the anchor when there is one.
 */
export function mapCanvasFitPoints(
  pins: readonly MapPoint[],
  anchor: MapCanvasAnchor | null | undefined,
  fitPoints?: readonly MapPoint[] | null,
): MapPoint[] {
  if (fitPoints && fitPoints.length > 0) return [...fitPoints]
  return anchor ? [...pins, { lat: anchor.lat, lng: anchor.lng }] : [...pins]
}
