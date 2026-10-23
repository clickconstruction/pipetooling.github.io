import { describe, expect, it } from 'vitest'
import { projectCounties, type CountyFeatureCollection } from './txCountyMap'

// Two squares side by side at the equator (cos = 1), and one county split in two pieces.
const FC: CountyFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { GEOID: '48001', NAME: 'West' }, geometry: { type: 'Polygon', coordinates: [[[-100, 1], [-99, 1], [-99, 0], [-100, 0], [-100, 1]]] } },
    { type: 'Feature', properties: { GEOID: '48002', NAME: 'East' }, geometry: { type: 'Polygon', coordinates: [[[-99, 1], [-98, 1], [-98, 0], [-99, 0], [-99, 1]]] } },
    {
      type: 'Feature',
      properties: { GEOID: '48003', NAME: 'Islands' },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[[-100, -1], [-99.5, -1], [-99.5, -0.5], [-100, -0.5], [-100, -1]]],
          [[[-99, -1], [-98, -1], [-98, 0], [-99, 0], [-99, -1]]],
        ],
      },
    },
  ],
}

describe('projectCounties', () => {
  it('fits the counties to the width, north up, and keeps the height in proportion', () => {
    const map = projectCounties(FC, 200)
    expect(map.width).toBe(200)
    expect(map.height).toBe(200)
    const west = map.shapes.find((s) => s.name === 'West')!
    expect(west.d).toBe('M0,0L100,0L100,100L0,100L0,0Z')
    expect(west.cx).toBe(50)
    expect(west.cy).toBe(50)
    const east = map.shapes.find((s) => s.name === 'East')!
    expect(east.d.startsWith('M100,0L200,0')).toBe(true)
  })
  it('draws every piece of a split county and labels its largest piece', () => {
    const map = projectCounties(FC, 200)
    const islands = map.shapes.find((s) => s.name === 'Islands')!
    expect(islands.d.split('Z').filter(Boolean)).toHaveLength(2)
    expect(islands.fips).toBe('48003')
    expect(islands.cx).toBe(150)
    expect(islands.cy).toBe(150)
  })
  it('is empty for no features', () => {
    expect(projectCounties({ type: 'FeatureCollection', features: [] })).toEqual({ shapes: [], width: 600, height: 0 })
  })
})
