/**
 * How a painted line is stroked on a Google map (punch list #387). Pure: plain option objects, so
 * the look is tested with no map library loaded.
 *
 * Leaflet dashes a line with `dashArray`. A Google line has no dash of its own: a dashed line is a
 * line that is not drawn, carrying one small drawing repeated along it. The widths and gaps here are
 * the Leaflet canvas's own, so a line reads the same on either map.
 */
import type { PaintedPoint } from './paintedLine'
import type { PaintedLineHow } from './paintedMap'

/** The two colours a line is made of: the dark edge, and the paint over it. */
export type PaintedLineLook = { ink: string; paint: string }

/** One small drawing repeated along a line. `path` is SVG path data in the drawing's own units. */
export type GoogleLineSymbol = { path: string; scale: number; strokeColor?: string; strokeOpacity: number; strokeWeight?: number; fillColor?: string; fillOpacity?: number }
/** One line as Google draws it. With `icons` the line itself is not drawn and the drawings stand for it. */
export type GoogleLineStroke = { strokeColor: string; strokeOpacity: number; strokeWeight: number; zIndex: number; icons?: Array<{ icon: GoogleLineSymbol; offset: string; repeat: string }> }

/** A dash two units long down the line. Scaled by 7 it is the 14 px dash of a line drawn by hand. */
const DASH_PATH = 'M 0,-1 0,1'
/** A disc one unit in radius. Scaled by 2 it is the 4 px dot of a stretch the phone was not sure of. */
const DOT_PATH = 'M -1,0 A 1,1 0 1,1 1,0 A 1,1 0 1,1 -1,0 Z'

/**
 * A stretch the phone was sure of, or that was drawn by hand: the dark edge under, the paint over.
 * A line drawn by hand is dashed, 14 on and 7 off, so it is never taken for one a person walked.
 */
export function sureRunStrokes(how: PaintedLineHow, look: PaintedLineLook): [GoogleLineStroke, GoogleLineStroke] {
  const edge: GoogleLineStroke = { strokeColor: look.ink, strokeOpacity: 0.9, strokeWeight: 8, zIndex: 1 }
  const paint: GoogleLineStroke =
    how === 'drawn'
      ? { strokeColor: look.paint, strokeOpacity: 0, strokeWeight: 5, zIndex: 2, icons: [{ icon: { path: DASH_PATH, scale: 7, strokeColor: look.paint, strokeOpacity: 1, strokeWeight: 5 }, offset: '0', repeat: '21px' }] }
      : { strokeColor: look.paint, strokeOpacity: 1, strokeWeight: 5, zIndex: 2 }
  return [edge, paint]
}

/** A stretch the phone was not sure of: faint dots, 2 on and 9 off, never a solid line. */
export function poorRunStroke(look: PaintedLineLook): GoogleLineStroke {
  return { strokeColor: look.paint, strokeOpacity: 0, strokeWeight: 4, zIndex: 2, icons: [{ icon: { path: DOT_PATH, scale: 2, strokeOpacity: 0, fillColor: look.paint, fillOpacity: 0.85 }, offset: '0', repeat: '11px' }] }
}

/**
 * The edge of a rough reading's area (punch list #402): dashed, 6 on and 6 off, 2 px wide. Google's
 * circle has no dash of its own, so the edge is a line round the circle that carries the dash, and
 * the circle under it is fill alone.
 */
export function areaEdgeStroke(color: string): GoogleLineStroke {
  return { strokeColor: color, strokeOpacity: 0, strokeWeight: 2, zIndex: 3, icons: [{ icon: { path: DASH_PATH, scale: 3, strokeColor: color, strokeOpacity: 1, strokeWeight: 2 }, offset: '0', repeat: '12px' }] }
}

const EARTH_RADIUS_M = 6371000

/**
 * The points of a circle on the ground, closed, for the dashed edge to run along. `steps` points
 * round it and the first one again at the end.
 */
export function circleRing(center: PaintedPoint, radiusM: number, steps: number = 72): PaintedPoint[] {
  const lat1 = (center.lat * Math.PI) / 180
  const lng1 = (center.lng * Math.PI) / 180
  const d = radiusM / EARTH_RADIUS_M
  const ring: PaintedPoint[] = []
  for (let i = 0; i <= steps; i++) {
    const bearing = (2 * Math.PI * (i % steps)) / steps
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing))
    const lng2 = lng1 + Math.atan2(Math.sin(bearing) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2))
    ring.push({ lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI })
  }
  return ring
}
