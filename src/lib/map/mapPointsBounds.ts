/**
 * Bounds for a fit-to-all over any set of map points (v2.3162 — shared by the
 * Dashboard jobs map and the Bid Board map). `null` when there is nothing to
 * fit; a single point (or points that coincide) gets a small padded box so the
 * map does not zoom to street level on one pin.
 */
export type MapPoint = { lat: number; lng: number }

export type MapBounds = { south: number; west: number; north: number; east: number }

export function mapPointsBounds(points: readonly MapPoint[]): MapBounds | null {
  if (points.length === 0) return null
  let south = Infinity
  let west = Infinity
  let north = -Infinity
  let east = -Infinity
  for (const p of points) {
    south = Math.min(south, p.lat)
    north = Math.max(north, p.lat)
    west = Math.min(west, p.lng)
    east = Math.max(east, p.lng)
  }
  if (points.length === 1 || (north - south < 1e-6 && east - west < 1e-6)) {
    const pad = 0.01
    return { south: south - pad, west: west - pad, north: north + pad, east: east + pad }
  }
  return { south, west, north, east }
}
