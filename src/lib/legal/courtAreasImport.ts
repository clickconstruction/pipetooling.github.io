import type { CourtAreaPolygon } from './courtAreas'

/**
 * Importing a county's published justice precinct file into the office's court map
 * (v2.4770, step 4). Each source is an ArcGIS layer the county itself publishes; the
 * script `scripts/import-court-areas.ts` asks it for GeoJSON in WGS84 and writes one
 * `court_areas` row per precinct, retiring the county's earlier import first. Pure:
 * the URL, the reading of the file, and the rows.
 */

export type CourtAreaImportSource = {
  county: string
  /** The county's own name for the layer, for the source note. */
  name: string
  /** The layer's REST URL (…/MapServer/1 or …/FeatureServer/0). */
  layerUrl: string
  /** The attribute that holds the precinct label. */
  precinctField: string
  /** The page a person reads it on. */
  page: string
}

/** The counties that publish their precinct lines (checked 2026-10-07). Guadalupe, Comal and Williamson publish maps to read by eye; they are drawn by hand. */
export const COURT_AREA_IMPORT_SOURCES: ReadonlyArray<CourtAreaImportSource> = [
  { county: 'Bexar', name: 'Bexar County Justice of the Peace Precincts', layerUrl: 'https://maps.bexar.org/arcgis/rest/services/JusticeofthePeace/MapServer/1', precinctField: 'Precinct', page: 'https://gis-bexar.opendata.arcgis.com/datasets/Bexar::bexar-county-justice-of-the-peace-precincts/about' },
  { county: 'Travis', name: 'Travis County Justice of the Peace and Constable Precincts', layerUrl: 'https://gis.traviscountytx.gov/server1/rest/services/Boundaries_and_Jurisdictions/Travis_County_Judge_and_Constable_Precincts/MapServer/0', precinctField: 'PRECINCT', page: 'https://tnr-traviscountytx.opendata.arcgis.com/datasets/TravisCountyTX::justice-of-the-peace-and-constable-precincts/about' },
  { county: 'Hays', name: 'Hays County Justice of the Peace', layerUrl: 'https://services5.arcgis.com/bVphnK8rPe5MHUSr/arcgis/rest/services/HaysCoJusticeOfPeace/FeatureServer/0', precinctField: 'PRECINCT', page: 'https://hays-county-haysgis.hub.arcgis.com/datasets/hays-county-justice-of-the-peace' },
]

/** The query that returns every precinct as GeoJSON in WGS84 ([lng, lat]). */
export function courtAreaImportUrl(src: CourtAreaImportSource): string {
  return `${src.layerUrl}/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`
}

export type CourtAreaImportRow = { county: string; precinct: string; label: string; polygon: CourtAreaPolygon; source: 'imported'; source_note: string }

/** `Precinct 2`, `JP 2`, `2` → `2`; a number → its digits; '' when nothing. */
export function precinctLabelFromAttribute(v: unknown): string {
  if (v == null) return ''
  const s = String(v).trim()
  const m = /(\d+(?:-\d+)?)\s*$/.exec(s)
  return m ? m[1]! : s
}

/**
 * The file's features → one row per precinct. Features that share a label (a precinct
 * in two pieces) become one MultiPolygon. Features with no label or no polygon are
 * counted and left out.
 */
export function courtAreaRowsFromGeoJson(src: CourtAreaImportSource, fc: unknown, fetchedYmd: string): { rows: CourtAreaImportRow[]; skipped: number } {
  const features = fc && typeof fc === 'object' && Array.isArray((fc as { features?: unknown }).features) ? ((fc as { features: unknown[] }).features) : []
  const byLabel = new Map<string, number[][][][]>()
  let skipped = 0
  for (const f of features) {
    const feat = f as { properties?: Record<string, unknown> | null; geometry?: { type?: string; coordinates?: unknown } | null }
    const label = precinctLabelFromAttribute(feat.properties?.[src.precinctField])
    const g = feat.geometry
    if (!label || !g || !Array.isArray(g.coordinates)) {
      skipped += 1
      continue
    }
    const polys = g.type === 'Polygon' ? [g.coordinates as number[][][]] : g.type === 'MultiPolygon' ? (g.coordinates as number[][][][]) : null
    if (!polys) {
      skipped += 1
      continue
    }
    byLabel.set(label, [...(byLabel.get(label) ?? []), ...polys])
  }
  const note = `${src.name} · ${src.page} · fetched ${fetchedYmd}`
  const rows: CourtAreaImportRow[] = [...byLabel.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .map(([precinct, polys]) => ({
      county: src.county,
      precinct,
      label: '',
      polygon: polys.length === 1 ? { type: 'Polygon', coordinates: polys[0]! } : { type: 'MultiPolygon', coordinates: polys },
      source: 'imported',
      source_note: note,
    }))
  return { rows, skipped }
}
