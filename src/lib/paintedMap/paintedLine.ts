/**
 * The shape of a painted line (punch list #345): its length, its corners, the point on it nearest
 * to a finger or a phone. Pure geometry on pairs of numbers: no map, no network, no clock.
 *
 * Distances are worked on the ground in metres. A painted line is a few hundred feet to a few
 * miles, so the earth is flat enough across it: points are laid on a plane around a nearby origin
 * (`toPlane`) for anything that needs a perpendicular, and the haversine is kept for lengths.
 */
import { haversineMeters } from '../jobTravelEstimate'

export type PaintedPoint = { lat: number; lng: number }
/** A stretch of a line by the indexes of its first and last points, both counted. */
export type PaintedPart = readonly [from: number, to: number]

const EARTH_RADIUS_M = 6371000
const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

/** A real point: two finite numbers on the globe, and not the 0,0 a broken reading gives. */
export function isPaintedPoint(p: unknown): p is PaintedPoint {
  if (!p || typeof p !== 'object') return false
  const { lat, lng } = p as { lat?: unknown; lng?: unknown }
  if (typeof lat !== 'number' || typeof lng !== 'number') return false
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false
  return !(lat === 0 && lng === 0)
}

type Flat = { x: number; y: number }

/** A point as metres east and north of an origin. */
export function toPlane(origin: PaintedPoint, p: PaintedPoint): Flat {
  return {
    x: rad(p.lng - origin.lng) * Math.cos(rad(origin.lat)) * EARTH_RADIUS_M,
    y: rad(p.lat - origin.lat) * EARTH_RADIUS_M,
  }
}

/** The way back: metres east and north of an origin as a point. */
export function fromPlane(origin: PaintedPoint, f: Flat): PaintedPoint {
  return {
    lat: origin.lat + deg(f.y / EARTH_RADIUS_M),
    lng: origin.lng + deg(f.x / (EARTH_RADIUS_M * Math.cos(rad(origin.lat)))),
  }
}

/** Is the leg that ends at point `index` inside one of the parts? A leg is in a part when both its ends are. */
function legInParts(index: number, parts: ReadonlyArray<PaintedPart>): boolean {
  return parts.some(([from, to]) => index - 1 >= from && index <= to)
}

/**
 * A line's length in metres. The parts handed in are left out: a stretch the phone was not sure of
 * is drawn, faintly, and never counted, so a length never rests on a guess.
 */
export function lineLengthMeters(points: ReadonlyArray<PaintedPoint>, leaveOut: ReadonlyArray<PaintedPart> = []): number {
  let sum = 0
  for (let i = 1; i < points.length; i++) {
    if (leaveOut.length > 0 && legInParts(i, leaveOut)) continue
    sum += haversineMeters(points[i - 1]!, points[i]!)
  }
  return sum
}

/**
 * A line as the runs a map draws: the stretches the phone was sure of, and the faint ones. Each run
 * is a list of points with its two ends shared with its neighbours, so the line shows no break
 * where a faint part begins.
 */
export function lineRuns(points: ReadonlyArray<PaintedPoint>, poorParts: ReadonlyArray<PaintedPart> = []): { sure: PaintedPoint[][]; poor: PaintedPoint[][] } {
  const sure: PaintedPoint[][] = []
  const poor: PaintedPoint[][] = []
  let run: PaintedPoint[] = []
  let runPoor = false
  for (let i = 1; i < points.length; i++) {
    const legPoor = poorParts.length > 0 && legInParts(i, poorParts)
    if (run.length === 0) {
      run = [points[i - 1]!, points[i]!]
      runPoor = legPoor
    } else if (legPoor === runPoor) {
      run.push(points[i]!)
    } else {
      ;(runPoor ? poor : sure).push(run)
      run = [points[i - 1]!, points[i]!]
      runPoor = legPoor
    }
  }
  if (run.length > 0) (runPoor ? poor : sure).push(run)
  return { sure, poor }
}

/** How much ground one dot of a map covers, in metres, at a zoom and a latitude (the web maps' own scale). */
export function metersPerPixel(zoom: number, lat: number): number {
  return (40075016.686 * Math.cos(rad(lat))) / 2 ** (zoom + 8)
}

/** The length of each leg, in metres: leg `i` runs from point `i` to point `i + 1`. */
export function legLengthsMeters(points: ReadonlyArray<PaintedPoint>): number[] {
  const out: number[] = []
  for (let i = 1; i < points.length; i++) out.push(haversineMeters(points[i - 1]!, points[i]!))
  return out
}

/** How far a point stands off the straight run between two others, in metres on the plane. */
function offSegmentMeters(p: Flat, a: Flat, b: Flat): { distance: number; t: number } {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  const cx = a.x + t * dx
  const cy = a.y + t * dy
  return { distance: Math.hypot(p.x - cx, p.y - cy), t }
}

/**
 * The same line with fewer corners (Douglas and Peucker's rule): a point is dropped when the line
 * without it passes within `toleranceM` of where it stood. The two ends always stay. A walked line
 * comes off a phone as a point a second; this is what turns it into a shape a finger can fix.
 */
export function simplifyLine(points: ReadonlyArray<PaintedPoint>, toleranceM: number): PaintedPoint[] {
  if (points.length <= 2 || !(toleranceM > 0)) return points.slice()
  const origin = points[0]!
  const flat = points.map((p) => toPlane(origin, p))
  const keep = new Array<boolean>(points.length).fill(false)
  keep[0] = true
  keep[points.length - 1] = true
  // A list of spans to look at, not a function calling itself: a long walk is thousands of points.
  const spans: Array<[number, number]> = [[0, points.length - 1]]
  while (spans.length > 0) {
    const [first, last] = spans.pop()!
    let worst = 0
    let at = -1
    for (let i = first + 1; i < last; i++) {
      const d = offSegmentMeters(flat[i]!, flat[first]!, flat[last]!).distance
      if (d > worst) {
        worst = d
        at = i
      }
    }
    if (at !== -1 && worst > toleranceM) {
      keep[at] = true
      spans.push([first, at], [at, last])
    }
  }
  return points.filter((_, i) => keep[i])
}

export type NearestOnLine = {
  /** The point on the line. */
  point: PaintedPoint
  /** How far the asked point is from it, in metres. */
  distanceM: number
  /** The leg it lies on: from point `leg` to point `leg + 1`. */
  leg: number
  /** How far along that leg, 0 at its start and 1 at its end. */
  t: number
  /** How far along the whole line, in metres from its first point. */
  alongM: number
}

/** The spot on a line nearest to a point: where a finger pressed, or where a reader stands. Null for a line with no leg. */
export function nearestOnLine(points: ReadonlyArray<PaintedPoint>, p: PaintedPoint): NearestOnLine | null {
  if (points.length < 2) return null
  const origin = points[0]!
  const flat = points.map((q) => toPlane(origin, q))
  const pf = toPlane(origin, p)
  let best: { distance: number; t: number; leg: number } | null = null
  for (let i = 0; i < flat.length - 1; i++) {
    const hit = offSegmentMeters(pf, flat[i]!, flat[i + 1]!)
    if (!best || hit.distance < best.distance) best = { ...hit, leg: i }
  }
  if (!best) return null
  const a = flat[best.leg]!
  const b = flat[best.leg + 1]!
  const point = fromPlane(origin, { x: a.x + best.t * (b.x - a.x), y: a.y + best.t * (b.y - a.y) })
  let alongM = 0
  for (let i = 0; i < best.leg; i++) alongM += haversineMeters(points[i]!, points[i + 1]!)
  alongM += haversineMeters(points[best.leg]!, point)
  return { point, distanceM: best.distance, leg: best.leg, t: best.t, alongM }
}

/** The point a given distance along a line, held to its ends. */
export function pointAlongLine(points: ReadonlyArray<PaintedPoint>, alongM: number): PaintedPoint | null {
  if (points.length === 0) return null
  if (points.length === 1 || alongM <= 0) return { ...points[0]! }
  let left = alongM
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    const leg = haversineMeters(a, b)
    if (left <= leg) {
      const t = leg === 0 ? 0 : left / leg
      return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t }
    }
    left -= leg
  }
  return { ...points[points.length - 1]! }
}

/**
 * A line cut to the stretch between two distances along it: what dragging an end does. The usual
 * fault of a walked line is the knot at each end, where the person stood getting ready, and a trim
 * takes it off. The ends land exactly on the cut, so a trimmed line never grows a stray corner.
 */
export function trimLine(points: ReadonlyArray<PaintedPoint>, fromM: number, toM: number): PaintedPoint[] {
  if (points.length < 2) return points.slice()
  const total = lineLengthMeters(points)
  const start = Math.max(0, Math.min(fromM, toM))
  const end = Math.min(total, Math.max(fromM, toM))
  if (end - start <= 0) return points.slice(0, 2)
  const out: PaintedPoint[] = [pointAlongLine(points, start)!]
  let walked = 0
  for (let i = 0; i < points.length - 1; i++) {
    walked += haversineMeters(points[i]!, points[i + 1]!)
    if (walked > start && walked < end) out.push({ ...points[i + 1]! })
  }
  out.push(pointAlongLine(points, end)!)
  return out
}

/**
 * A line with one stretch redrawn: the points from `from` to `to` give way to the ones pressed out
 * by hand, and the corners on each side of them stay where they were so the line stays whole.
 */
export function replaceStretch(points: ReadonlyArray<PaintedPoint>, from: number, to: number, drawn: ReadonlyArray<PaintedPoint>): PaintedPoint[] {
  const a = Math.max(0, Math.min(from, to))
  const b = Math.min(points.length - 1, Math.max(from, to))
  const inner = drawn.filter(isPaintedPoint)
  return [...points.slice(0, a + 1), ...inner, ...points.slice(b)]
}

/** Where every part lands once a stretch has been replaced: a part the redraw covered is gone, and the ones after it shift. */
export function partsAfterReplace(parts: ReadonlyArray<PaintedPart>, from: number, to: number, drawnCount: number): PaintedPart[] {
  const a = Math.min(from, to)
  const b = Math.max(from, to)
  const shift = drawnCount - (b - a - 1)
  const out: PaintedPart[] = []
  for (const [pf, pt] of parts) {
    if (pt <= a) out.push([pf, pt])
    else if (pf >= b) out.push([pf + shift, pt + shift])
    // A part that overlaps the redrawn stretch was the reason for the redraw. It is no longer a guess.
  }
  return out
}

export type SnapTarget = PaintedPoint & { id: string; label: string }

/**
 * What a dragged corner catches: the nearest target inside the reach, or nothing. Targets are the
 * places on the map and the ends of the other lines, so a line can really end at the gate and two
 * strokes can really meet.
 */
export function snapTarget(p: PaintedPoint, targets: ReadonlyArray<SnapTarget>, reachM: number): SnapTarget | null {
  let best: SnapTarget | null = null
  let bestD = Infinity
  for (const t of targets) {
    const d = haversineMeters(p, t)
    if (d <= reachM && d < bestD) {
      best = t
      bestD = d
    }
  }
  return best
}

export type PaintedBounds = { south: number; west: number; north: number; east: number }

/** The box that holds every point handed in, or null for none. What a map frames when it opens. */
export function boundsOfPoints(points: ReadonlyArray<PaintedPoint>): PaintedBounds | null {
  let b: PaintedBounds | null = null
  for (const p of points) {
    if (!isPaintedPoint(p)) continue
    if (!b) b = { south: p.lat, north: p.lat, west: p.lng, east: p.lng }
    else {
      b.south = Math.min(b.south, p.lat)
      b.north = Math.max(b.north, p.lat)
      b.west = Math.min(b.west, p.lng)
      b.east = Math.max(b.east, p.lng)
    }
  }
  return b
}

/** Six decimals: about four inches on the ground, finer than anything here can know. */
const round6 = (n: number) => Math.round(n * 1e6) / 1e6

/**
 * A line as the database holds it: a list of `[latitude, longitude]` pairs and nothing else. This
 * is the one door a line leaves the phone through, and it is where a reading's time, speed and
 * margin are dropped for good. A saved line cannot say when anyone was anywhere.
 */
export function pointsToJson(points: ReadonlyArray<PaintedPoint>): Array<[number, number]> {
  return points.filter(isPaintedPoint).map((p) => [round6(p.lat), round6(p.lng)])
}

/** A stored line back as points. Anything that is not a pair of numbers on the globe is skipped, never guessed at. */
export function pointsFromJson(json: unknown): PaintedPoint[] {
  if (!Array.isArray(json)) return []
  const out: PaintedPoint[] = []
  for (const pair of json) {
    if (!Array.isArray(pair) || pair.length < 2) continue
    const p = { lat: pair[0] as number, lng: pair[1] as number }
    if (isPaintedPoint(p)) out.push(p)
  }
  return out
}

/** Stored parts back as parts: pairs of whole indexes inside the line, in order, the second not before the first. */
export function partsFromJson(json: unknown, pointCount: number): PaintedPart[] {
  if (!Array.isArray(json)) return []
  const out: PaintedPart[] = []
  for (const pair of json) {
    if (!Array.isArray(pair) || pair.length < 2) continue
    const from = pair[0]
    const to = pair[1]
    if (!Number.isInteger(from) || !Number.isInteger(to)) continue
    if (from < 0 || to >= pointCount || to <= from) continue
    out.push([from, to])
  }
  return out.sort((x, y) => x[0] - y[0])
}
