/**
 * How a painted map frames a person by how sure their phone is (punch list #402). A rough reading
 * is an area and not a spot, so the map pulls back until the whole of it shows: the picture of what
 * the phone knows. The first reading that is a spot brings the map in to the person. Between those
 * the view is the person's own, and nothing here moves it.
 *
 * Pure. A canvas says what it last acted on, how far in it is and what it is showing, and is told
 * what to do. Each canvas asks here and does what it is told, so the Leaflet map and any other one
 * frame alike.
 *
 * The canvas counts no time. Its caller hands it an area only once the readings have stayed rough
 * for the wait (`useRoughHeld`), so a first reading off a cell tower never throws the view out and
 * back.
 */
import { boundsOfPoints, fromPlane, isPaintedPoint, type PaintedBounds, type PaintedPoint } from './paintedLine'

/**
 * Where the person is, as a canvas draws it. `area` says the reading is a rough one that has stayed
 * rough: its circle is the whole of what the phone knows, drawn dashed with no dot in its middle.
 */
export type PaintedCanvasMe = PaintedPoint & { accuracyM: number | null; area?: boolean }

/** What the frame last acted on: nothing yet, an area, or a spot. */
export type MarginFramed = 'none' | 'area' | 'spot'

/** The zoom a person is brought in to: the walk's own, where a small margin circle can be seen around the dot. */
export const MARGIN_FRAME_ZOOM = 18
/** Under this, the first spot of all brings the map in: a map that opened on a whole city, or the whole country. */
export const MARGIN_FRAME_FAR_ZOOM = 16
/** The room left around an area, in the screen's dots, on each side. */
export const MARGIN_FRAME_PADDING_PX = 28

export type MarginFrameMove =
  /** Fit the view to this box, with `MARGIN_FRAME_PADDING_PX` around it. */
  | { kind: 'area'; box: PaintedBounds }
  /** Put the view on the person at this zoom. */
  | { kind: 'person'; at: PaintedPoint; zoom: number }

const hasRadius = (m: number | null | undefined): m is number => typeof m === 'number' && Number.isFinite(m) && m > 0

/**
 * The box an area fills: its circle, and with it the map's own lines and places, so the job stays
 * in the picture beside the area the person is somewhere in. Null when the reading is no area.
 */
export function areaBox(me: PaintedCanvasMe, points: ReadonlyArray<PaintedPoint>): PaintedBounds | null {
  if (!isPaintedPoint(me) || !hasRadius(me.accuracyM)) return null
  const r = me.accuracyM
  return boundsOfPoints([...points, fromPlane(me, { x: -r, y: -r }), fromPlane(me, { x: r, y: r })])
}

const isBox = (b: PaintedBounds | null | undefined): b is PaintedBounds => !!b && [b.south, b.west, b.north, b.east].every((n) => typeof n === 'number' && Number.isFinite(n))
const holds = (outer: PaintedBounds, inner: PaintedBounds): boolean => outer.south <= inner.south && outer.north >= inner.north && outer.west <= inner.west && outer.east >= inner.east

/**
 * One reading reaches the frame: what to do with the view, and what the frame has now acted on.
 *
 * - An area is fitted the moment the readings turn rough. A later one, off somewhere else or wider,
 *   is fitted again unless the view already holds it: a person who pulled back further is left there.
 * - A spot brings the map in on the person after an area, or as the first reading of all when the
 *   map is far out. Any other spot moves nothing: sliding to a walker is `follow`'s work.
 *
 * `view` is what the map shows now and `zoom` how far in it is. A canvas that cannot say either
 * hands null, and is then fitted or left by the rest of the rule alone.
 */
export function marginFrameStep(input: {
  framed: MarginFramed
  me: PaintedCanvasMe
  points: ReadonlyArray<PaintedPoint>
  zoom: number | null
  view: PaintedBounds | null
}): { framed: MarginFramed; move: MarginFrameMove | null } {
  const { framed, me, points, zoom, view } = input
  if (!isPaintedPoint(me)) return { framed, move: null }
  if (me.area) {
    const box = areaBox(me, points)
    if (!box) return { framed, move: null }
    if (framed === 'area' && isBox(view) && holds(view, box)) return { framed: 'area', move: null }
    return { framed: 'area', move: { kind: 'area', box } }
  }
  const far = typeof zoom === 'number' && Number.isFinite(zoom) && zoom < MARGIN_FRAME_FAR_ZOOM
  const bringIn = framed === 'area' || (framed === 'none' && far)
  return { framed: 'spot', move: bringIn ? { kind: 'person', at: { lat: me.lat, lng: me.lng }, zoom: MARGIN_FRAME_ZOOM } : null }
}
