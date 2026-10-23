/**
 * The Texas county map's geometry (punch list #144, v2.5756): GeoJSON county features
 * (`public/geo/tx-counties.json`, docs/TX_COUNTY_MAP.md) projected to SVG paths. A
 * plate-carrée projection scaled by the cosine of the state's middle latitude: Texas spans
 * ten degrees of latitude, so the distortion is a few percent at the edges, nothing a
 * picker notices. Pure, so the projection is tested without a browser.
 */

export type CountyFeature = {
  type: 'Feature'
  properties: { GEOID: string; NAME: string }
  geometry: { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] }
}

export type CountyFeatureCollection = { type: 'FeatureCollection'; features: CountyFeature[] }

export type CountyShape = {
  name: string
  fips: string
  /** The SVG path, every ring of every polygon. */
  d: string
  /** Where a label or a pin for the county goes: the middle of its largest polygon's box. */
  cx: number
  cy: number
}

export type CountyMap = {
  shapes: CountyShape[]
  width: number
  height: number
  /** A longitude and latitude as a point in the map's units, the same projection the shapes use (for a case's dot). */
  project: (lon: number, lat: number) => [number, number]
}

function rings(f: CountyFeature): number[][][] {
  return f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat()
}

function outerRings(f: CountyFeature): number[][][] {
  return f.geometry.type === 'Polygon' ? [f.geometry.coordinates[0] ?? []] : f.geometry.coordinates.map((p) => p[0] ?? [])
}

const r1 = (n: number) => Math.round(n * 10) / 10
/** A GeoJSON position as [lon, lat]; a short one (never in a real file) reads as 0. */
const pt = (p: number[]): [number, number] => [p[0] ?? 0, p[1] ?? 0]

/** Projects every county into a box `width` wide; the height follows the state's shape. */
export function projectCounties(fc: CountyFeatureCollection, width = 600): CountyMap {
  let minLon = Infinity
  let maxLon = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  for (const f of fc.features) {
    for (const ring of rings(f)) {
      for (const p of ring) {
        const [lon, lat] = pt(p)
        if (lon < minLon) minLon = lon
        if (lon > maxLon) maxLon = lon
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      }
    }
  }
  if (!Number.isFinite(minLon)) return { shapes: [], width, height: 0, project: () => [0, 0] }
  const cosLat = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180)
  const k = width / ((maxLon - minLon) * cosLat)
  const height = r1((maxLat - minLat) * k)
  const px = (lon: number) => r1((lon - minLon) * cosLat * k)
  const py = (lat: number) => r1((maxLat - lat) * k)

  const shapes = fc.features.map((f): CountyShape => {
    const d = rings(f)
      .map((ring) => ring.map((p, i) => {
        const [lon, lat] = pt(p)
        return `${i === 0 ? 'M' : 'L'}${px(lon)},${py(lat)}`
      }).join('') + 'Z')
      .join('')
    // The largest outer ring by its box decides where the label goes.
    let best: { area: number; cx: number; cy: number } = { area: -1, cx: 0, cy: 0 }
    for (const ring of outerRings(f)) {
      let a = Infinity
      let b = -Infinity
      let c = Infinity
      let e = -Infinity
      for (const p of ring) {
        const [lon, lat] = pt(p)
        if (lon < a) a = lon
        if (lon > b) b = lon
        if (lat < c) c = lat
        if (lat > e) e = lat
      }
      const area = (b - a) * (e - c)
      if (area > best.area) best = { area, cx: r1((px(a) + px(b)) / 2), cy: r1((py(c) + py(e)) / 2) }
    }
    return { name: f.properties.NAME, fips: f.properties.GEOID, d, cx: best.cx, cy: best.cy }
  })
  return { shapes, width, height, project: (lon, lat) => [px(lon), py(lat)] }
}
