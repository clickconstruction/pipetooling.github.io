import { describe, expect, it } from 'vitest'
import type { PaintedLine, PaintedPlace } from './paintedMap'
import { paintedLayerCount, paintedLayerLineWords, paintedLayerMaps, paintedLayerPoints } from './paintedMapLayer'

const LINE = (over: Partial<PaintedLine> = {}): PaintedLine => ({ id: 'l1', mapId: 'm1', label: '', how: 'walked', points: [{ lat: 29.5, lng: -98.2 }, { lat: 29.501, lng: -98.2 }], poorParts: [[0, 1]], fixedByHand: false, lengthM: 265, marginM: 9, measuredFt: null, measuredHow: null, madeBy: 'me', madeAt: '2026-11-13T15:05:00Z', ...over })
const PLACE = (over: Partial<PaintedPlace> = {}): PaintedPlace => ({ id: 'p1', mapId: 'm1', name: 'Truck gate', words: 'Close it.', lat: 29.5, lng: -98.2, accuracyM: null, photoPath: null, setBy: 'me', setAt: '2026-11-13T15:10:00Z', ...over })

describe('painted maps as a layer', () => {
  it('draws a map as its lines and its numbered places, and says what it is', () => {
    const [m] = paintedLayerMaps([{ map: { id: 'm1', name: 'The way in' }, lines: [LINE()], places: [PLACE(), PLACE({ id: 'p2', name: 'Meter', setAt: '2026-11-13T15:20:00Z', lat: 29.5005 })] }])
    expect(m).toMatchObject({ id: 'm1', name: 'The way in', tip: 'The way in · about 870 ft · 2 places' })
    expect(m!.lines).toEqual([{ id: 'l1', points: [{ lat: 29.5, lng: -98.2 }, { lat: 29.501, lng: -98.2 }], poorParts: [[0, 1]] }])
    expect(m!.places.map((p) => `${p.number} ${p.name}`)).toEqual(['1 Truck gate', '2 Meter'])
  })
  it('leaves out a map with nothing on it', () => {
    const maps = paintedLayerMaps([{ map: { id: 'm0', name: 'Empty' }, lines: [], places: [] }, { map: { id: 'm1', name: 'Dots' }, lines: [], places: [PLACE()] }])
    expect(maps.map((m) => m.id)).toEqual(['m1'])
    expect(maps[0]!.tip).toBe('Dots · 1 place')
    expect(paintedLayerCount(maps)).toBe(1)
  })
  it('hands over every point it draws', () => {
    const maps = paintedLayerMaps([{ map: { id: 'm1', name: 'A' }, lines: [LINE()], places: [PLACE({ lat: 29.6, lng: -98.3 })] }])
    expect(paintedLayerPoints(maps)).toEqual([{ lat: 29.5, lng: -98.2 }, { lat: 29.501, lng: -98.2 }, { lat: 29.6, lng: -98.3 }])
  })
  it('says a length with its give or take, and a measured one as measured', () => {
    expect(paintedLayerLineWords(LINE())).toBe('About 870 ft, give or take 30 ft')
    expect(paintedLayerLineWords(LINE({ measuredFt: 612, measuredHow: 'wheel' }))).toMatch(/^612 ft, /)
  })
})
