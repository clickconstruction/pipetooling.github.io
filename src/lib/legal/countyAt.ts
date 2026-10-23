import type { CountyFeature, CountyFeatureCollection } from './txCountyMap'

/**
 * Which county a point is in (punch list #144): the venue follows the job's address, so a
 * case is placed by its geocode and the county read from the county file, with the
 * property record's county as the fallback when there is no geocode. Ray casting over
 * every outer ring; holes do not occur in the county file.
 */
function inRing(ring: ReadonlyArray<ReadonlyArray<number>>, lon: number, lat: number): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]?.[0] ?? 0
    const yi = ring[i]?.[1] ?? 0
    const xj = ring[j]?.[0] ?? 0
    const yj = ring[j]?.[1] ?? 0
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function outerRings(f: CountyFeature): number[][][] {
  return f.geometry.type === 'Polygon' ? [f.geometry.coordinates[0] ?? []] : f.geometry.coordinates.map((p) => p[0] ?? [])
}

/** The county's `NAME` at a longitude and latitude, or null outside every county. */
export function countyAt(fc: Pick<CountyFeatureCollection, 'features'>, lon: number, lat: number): string | null {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  for (const f of fc.features) {
    for (const ring of outerRings(f)) if (inRing(ring, lon, lat)) return f.properties.NAME
  }
  return null
}
