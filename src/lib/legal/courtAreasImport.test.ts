import { describe, expect, it } from 'vitest'
import { COURT_AREA_IMPORT_SOURCES, courtAreaImportUrl, courtAreaRowsFromGeoJson, precinctLabelFromAttribute } from './courtAreasImport'

const sq = (w: number, e: number) => [[[w, 29.5], [e, 29.5], [e, 29.6], [w, 29.6], [w, 29.5]]]

describe('courtAreasImport (v2.4770)', () => {
  it('asks each county layer for GeoJSON in WGS84 and reads the precinct label out of its attribute', () => {
    expect(COURT_AREA_IMPORT_SOURCES.map((s) => s.county)).toEqual(['Bexar', 'Travis', 'Hays'])
    expect(courtAreaImportUrl(COURT_AREA_IMPORT_SOURCES[2]!)).toBe('https://services5.arcgis.com/bVphnK8rPe5MHUSr/arcgis/rest/services/HaysCoJusticeOfPeace/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson')
    expect(precinctLabelFromAttribute('Precinct 2')).toBe('2')
    expect(precinctLabelFromAttribute(4)).toBe('4')
    expect(precinctLabelFromAttribute('JP 1-2')).toBe('1-2')
    expect(precinctLabelFromAttribute(null)).toBe('')
  })

  it('one row per precinct, pieces that share a label folded into one MultiPolygon, the rest skipped', () => {
    const src = COURT_AREA_IMPORT_SOURCES[0]!
    const fc = { type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { Precinct: 'Precinct 2' }, geometry: { type: 'Polygon', coordinates: sq(-98.0, -97.96) } },
      { type: 'Feature', properties: { Precinct: 'Precinct 2' }, geometry: { type: 'Polygon', coordinates: sq(-97.9, -97.8) } },
      { type: 'Feature', properties: { Precinct: 'Precinct 10' }, geometry: { type: 'MultiPolygon', coordinates: [sq(-98.6, -98.4)] } },
      { type: 'Feature', properties: { Precinct: '' }, geometry: { type: 'Polygon', coordinates: sq(0, 1) } },
      { type: 'Feature', properties: { Precinct: '3' }, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } },
    ] }
    const { rows, skipped } = courtAreaRowsFromGeoJson(src, fc, '2026-10-07')
    expect(skipped).toBe(2)
    expect(rows.map((r) => [r.county, r.precinct, r.polygon.type, r.source])).toEqual([['Bexar', '2', 'MultiPolygon', 'imported'], ['Bexar', '10', 'Polygon', 'imported']])
    expect(rows[0]!.source_note).toBe('Bexar County Justice of the Peace Precincts · https://gis-bexar.opendata.arcgis.com/datasets/Bexar::bexar-county-justice-of-the-peace-precincts/about · fetched 2026-10-07')
    expect(courtAreaRowsFromGeoJson(src, null, '2026-10-07')).toEqual({ rows: [], skipped: 0 })
  })
})
