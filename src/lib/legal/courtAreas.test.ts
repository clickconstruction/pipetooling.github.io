import { describe, expect, it } from 'vitest'
import { classifyCourtPoint, courtAreaFromRow, courtClassificationWords, courtCoverageWords, metresToAreaEdge, type CourtArea } from './courtAreas'

// Two squares side by side near Seguin, TX, sharing the line at lng -97.96; a third in another county.
const square = (id: string, county: string, precinct: string, west: number, east: number): CourtArea => ({
  id, county, precinct, label: `${county} ${precinct}`, source: 'drawn', sourceNote: 'test', active: true,
  polygon: { type: 'Polygon', coordinates: [[[west, 29.5], [east, 29.5], [east, 29.6], [west, 29.6], [west, 29.5]]] },
})
const areas = [square('a2', 'Guadalupe', '2', -98.0, -97.96), square('a3', 'Guadalupe', '3', -97.96, -97.9), square('b1', 'Bexar', '1', -98.6, -98.4)]

describe('courtAreas (v2.4765)', () => {
  it('puts a point in its precinct, and a point on the line in both', () => {
    const inside = classifyCourtPoint({ lat: 29.55, lng: -97.98 }, areas)
    expect(inside).toMatchObject({ county: 'Guadalupe', precinct: '2', near: ['2'], onLine: false, note: '', areaId: 'a2' })
    expect(courtClassificationWords(inside)).toBe('Guadalupe · JP Pct 2')
    // 30 m west of the shared line: in 2, with 3 within 100 m.
    const edge = classifyCourtPoint({ lat: 29.55, lng: -97.96 - 0.0003 }, areas)
    expect(edge.precinct).toBe('2')
    expect(edge.near).toEqual(['2', '3'])
    expect(edge.onLine).toBe(true)
    expect(edge.note).toBe('2 or 3 — on the line')
    expect(courtClassificationWords(edge)).toBe('Guadalupe · JP Pct 2 or 3 — on the line')
  })

  it('a point outside every area, and a county filter that keeps other counties out of the near list', () => {
    const out = classifyCourtPoint({ lat: 30.3, lng: -97.7 }, areas)
    expect(out).toMatchObject({ county: '', precinct: '', near: [], onLine: false, areaId: null })
    expect(courtClassificationWords(out)).toBe('outside every drawn area')
    // Inside Bexar 1; the Guadalupe squares are far, and the filter would hide them anyway.
    expect(classifyCourtPoint({ lat: 29.55, lng: -98.5 }, areas, { county: 'Bexar' }).precinct).toBe('1')
    expect(classifyCourtPoint({ lat: 29.55, lng: -98.5 }, areas, { county: 'Guadalupe' }).precinct).toBe('')
    expect(metresToAreaEdge({ lat: 29.55, lng: -97.96 }, areas[0]!)).toBeLessThan(1)
  })

  it('reads a row, refuses a row with no polygon, and words the coverage', () => {
    expect(courtAreaFromRow({ id: 'x', county: ' Hays ', precinct: '1-2', polygon: areas[0]!.polygon, source: 'imported', source_note: 'hays hub 2024-02-14', active: null })).toMatchObject({ county: 'Hays', precinct: '1-2', source: 'imported', active: true })
    expect(courtAreaFromRow({ id: 'x', county: 'Hays', precinct: '1', polygon: { type: 'Point', coordinates: [0, 0] } })).toBeNull()
    expect(courtAreaFromRow({ id: 'x', county: 'Hays', precinct: '1', polygon: null })).toBeNull()
    expect(courtCoverageWords(40, 6, 2)).toBe('40 of 46 addresses inside a drawn area · 6 outside every area · 2 on a line to settle')
    expect(courtCoverageWords(1, 0, 0)).toBe('1 of 1 address inside a drawn area')
  })
})
