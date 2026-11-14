import { describe, expect, it } from 'vitest'
import { fromPlane, type PaintedPoint } from './paintedLine'
import { wayNearMap, wayNoFixWords, wayWords } from './paintedWay'

const ORIGIN: PaintedPoint = { lat: 29.5, lng: -98.2 }
const at = (eastM: number, northM: number): PaintedPoint => fromPlane(ORIGIN, { x: eastM, y: northM })
const LINES = [{ points: [at(0, 0), at(200, 0), at(200, 150)] }]

describe('where a reader stands against the map', () => {
  it('says they are at the start', () => {
    expect(wayWords({ ...at(8, 5), accuracyM: 5 }, LINES, at(0, 0))).toEqual({ lead: 'You are at the start.', sure: 'Your phone is sure within 20 ft.' })
  })
  it('says they are on the line', () => {
    expect(wayWords(at(120, 12), LINES, at(0, 0)).lead).toBe('You are on the painted line.')
    expect(wayWords(at(210, 90), LINES, at(0, 0)).lead).toBe('You are on the painted line.')
  })
  it('says how far and which way the start is when they are off it', () => {
    const w = wayWords({ ...at(-116, 0), accuracyM: null }, LINES, at(0, 0))
    expect(w.lead).toBe('The start is 380 ft east of you.')
    expect(w.sure).toBeNull()
  })
  it('has words for a map with places and no line', () => {
    expect(wayWords(at(300, 300), [], at(0, 0)).lead).toMatch(/^The start is /)
    expect(wayWords(at(300, 300), [], null).lead).toBe('You are off the map’s line.')
  })
  it('never lets a refusal cost the map or Directions', () => {
    for (const why of ['none', 'refused', 'failed'] as const) expect(wayNoFixWords(why)).toContain('The map and Directions still work.')
  })
})

describe('whether one picture can hold the reader and the map', () => {
  const points = LINES[0]!.points
  it('holds a reader down the road', () => {
    expect(wayNearMap(at(-900, 300), points)).toBe(true)
    expect(wayNearMap(at(200, 2100), points)).toBe(true)
  })
  it('does not hold a reader across town', () => {
    expect(wayNearMap(at(-2100, 0), points)).toBe(false)
    expect(wayNearMap(at(9000, 9000), points)).toBe(false)
  })
  it('holds nobody against a map with nothing on it', () => {
    expect(wayNearMap(at(0, 0), [])).toBe(false)
  })
})
