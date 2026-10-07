/**
 * Flat geometry for the office's court map (v2.4770): is a point inside a
 * GeoJSON polygon, and how many metres is it from the polygon's nearest edge.
 * No dependencies, so the `court-precinct-nightly` function and the client's
 * Map page read one rule. Positions are GeoJSON `[lng, lat]`.
 */
export type Position = [number, number] | number[]
export type PolygonGeometry = { type: 'Polygon'; coordinates: Position[][] }
export type MultiPolygonGeometry = { type: 'MultiPolygon'; coordinates: Position[][][] }
export type AreaGeometry = PolygonGeometry | MultiPolygonGeometry

/** Ray casting: odd crossings of the ring's edges to the east of the point mean inside. A point on an edge counts as inside. */
export function pointInRing(lng: number, lat: number, ring: ReadonlyArray<Position>): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!, yi = ring[i]![1]!, xj = ring[j]![0]!, yj = ring[j]![1]!
    const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

/** Inside the outer ring and in none of the holes; a MultiPolygon is inside when any of its polygons is. */
export function pointInArea(lng: number, lat: number, g: AreaGeometry): boolean {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  for (const rings of polys) {
    const outer = rings[0]
    if (!outer || outer.length < 3 || !pointInRing(lng, lat, outer)) continue
    if (rings.slice(1).some((hole) => hole.length >= 3 && pointInRing(lng, lat, hole))) continue
    return true
  }
  return false
}

const METRES_PER_DEG_LAT = 111_320

/** Metres from the point to the nearest edge of any ring, on a flat projection around the point (fine at county scale). */
export function metresToAreaEdge(lng: number, lat: number, g: AreaGeometry): number {
  const kx = METRES_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)
  const ky = METRES_PER_DEG_LAT
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  let best = Number.POSITIVE_INFINITY
  for (const rings of polys) {
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const ax = (ring[j]![0]! - lng) * kx, ay = (ring[j]![1]! - lat) * ky
        const bx = (ring[i]![0]! - lng) * kx, by = (ring[i]![1]! - lat) * ky
        const dx = bx - ax, dy = by - ay
        const len2 = dx * dx + dy * dy
        const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2))
        const px = ax + t * dx, py = ay + t * dy
        const d = Math.sqrt(px * px + py * py)
        if (d < best) best = d
      }
    }
  }
  return best
}
