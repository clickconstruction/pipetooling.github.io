import { describe, expect, it } from 'vitest'
import { courtAreaDraftProblem, courtAreasByCounty, courtAreaSourceWords, courtCoverage, polygonFromDrawn } from './courtAreasDraft'
import type { CourtArea } from './courtAreas'

const sq = (id: string, county: string, precinct: string, west: number, east: number): CourtArea => ({
  id, county, precinct, label: '', source: 'drawn', sourceNote: '', active: true,
  polygon: { type: 'Polygon', coordinates: [[[west, 29.5], [east, 29.5], [east, 29.6], [west, 29.6], [west, 29.5]]] },
})
const areas = [sq('a2', 'Guadalupe', '2', -98.0, -97.96), sq('a3', 'Guadalupe', '3', -97.96, -97.9), sq('b10', 'Bexar', '10', -98.6, -98.4), sq('b2', 'Bexar', '2', -98.4, -98.3)]

describe('courtAreasDraft (v2.4769)', () => {
  it('reads a drawn feature as a polygon and refuses a line or a triangle short of a ring', () => {
    const feature = { type: 'Feature', properties: {}, geometry: areas[0]!.polygon }
    expect(polygonFromDrawn(feature)).toEqual(areas[0]!.polygon)
    expect(polygonFromDrawn(areas[0]!.polygon)).toEqual(areas[0]!.polygon)
    expect(polygonFromDrawn({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } })).toBeNull()
    expect(polygonFromDrawn({ type: 'Polygon', coordinates: [[[0, 0], [1, 1], [0, 0]]] })).toBeNull()
    expect(polygonFromDrawn(null)).toBeNull()
  })

  it('a draft needs a county and a precinct, and never a precinct drawn twice', () => {
    expect(courtAreaDraftProblem({ county: '', precinct: '2', label: '', sourceNote: '' }, areas)).toBe('Name the county.')
    expect(courtAreaDraftProblem({ county: 'Hays', precinct: ' ', label: '', sourceNote: '' }, areas)).toBe('Name the precinct as the county writes it: 2, 1-2, 3.')
    expect(courtAreaDraftProblem({ county: 'guadalupe', precinct: '2', label: '', sourceNote: '' }, areas)).toContain('Guadalupe precinct 2 is already drawn')
    expect(courtAreaDraftProblem({ county: 'Guadalupe', precinct: '2', label: '', sourceNote: '' }, areas, 'a2', areas.map((a) => a.id))).toBeNull()
    expect(courtAreaDraftProblem({ county: 'Hays', precinct: '1-2', label: '', sourceNote: '' }, areas)).toBeNull()
  })

  it('counts the pins the layer places, the ones outside, and the ones on a line', () => {
    const c = courtCoverage([
      { label: '878 · Seguin', lat: 29.55, lng: -97.98 },
      { label: '879 · on the line', lat: 29.55, lng: -97.96 - 0.0003 },
      { label: '900 · Austin', lat: 30.3, lng: -97.7 },
      { label: 'no point', lat: null, lng: null },
    ], areas)
    expect(c).toEqual({ placed: 2, outside: 1, onLine: 1, outsideLabels: ['900 · Austin'], onLineLabels: ['879 · on the line · 2 or 3 — on the line'] })
  })

  it('words the source and groups by county with precincts in number order', () => {
    expect(courtAreaSourceWords({ source: 'drawn', sourceNote: '' }, '2026-10-07')).toBe('drawn by the office · 2026-10-07')
    expect(courtAreaSourceWords({ source: 'imported', sourceNote: 'Bexar County GIS' }, '2026-10-07')).toBe('imported · Bexar County GIS · 2026-10-07')
    const grouped = courtAreasByCounty(areas)
    expect(grouped.map((g) => [g.county, g.areas.map((a) => a.precinct)])).toEqual([['Bexar', ['2', '10']], ['Guadalupe', ['2', '3']]])
  })
})
