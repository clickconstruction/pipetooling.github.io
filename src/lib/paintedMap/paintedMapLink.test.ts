import { describe, expect, it } from 'vitest'
import {
  PAINTED_MAP_LINK_ALPHABET,
  linkDayWords,
  linkEndsWords,
  linkOpenedWords,
  mintPaintedMapLinkCode,
  paintedMapHexOf,
  paintedMapLinkCode,
  paintedMapLinkExpiry,
  paintedMapLinkOpen,
  paintedMapLinkUrl,
  sharedLineForCanvas,
  sharedMapIsEmpty,
  sharedPaintedMap,
  sharedPlacesForCanvas,
} from './paintedMapLink'

describe('the link\'s code', () => {
  it('is ten letters with no look-alikes', () => {
    let seed = 7
    const random = (n: number) => Uint8Array.from({ length: n }, () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) & 0xff)
    const code = mintPaintedMapLinkCode(random)
    expect(code).toHaveLength(10)
    for (const ch of code) expect(PAINTED_MAP_LINK_ALPHABET).toContain(ch)
    expect(PAINTED_MAP_LINK_ALPHABET).not.toMatch(/[01ilo]/)
  })
  it('throws away the bytes that would favour a letter', () => {
    const code = mintPaintedMapLinkCode((n) => Uint8Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 250 : 31)))
    expect(code).toBe('2222222222')
  })
  it('gives up on a source that gives nothing usable', () => {
    expect(() => mintPaintedMapLinkCode((n) => new Uint8Array(n).fill(255))).toThrow()
  })
  it('reads a code as tapped, and nothing else', () => {
    expect(paintedMapLinkCode('  Q7M2KD4X9P ')).toBe('q7m2kd4x9p')
    expect(paintedMapLinkCode('q7m2kd4x9')).toBeNull()
    expect(paintedMapLinkCode('q7m2kd4x9o')).toBeNull()
    expect(paintedMapLinkCode(null)).toBeNull()
  })
  it('writes a digest as hex', () => {
    expect(paintedMapHexOf(Uint8Array.from([0, 15, 255]))).toBe('000fff')
  })
  it('opens at /way/<code>', () => {
    expect(paintedMapLinkUrl('https://example.test/', 'q7m2kd4x9p')).toBe('https://example.test/way/q7m2kd4x9p')
  })
})

describe('how long a link lives', () => {
  it('ends by itself after ninety days', () => {
    expect(paintedMapLinkExpiry('2026-11-13T12:00:00.000Z')).toBe('2027-02-11T12:00:00.000Z')
  })
  it('is open until its day or until somebody ends it', () => {
    const link = { expires_at: '2027-02-11T12:00:00.000Z', ended_at: null }
    expect(paintedMapLinkOpen(link, '2026-12-01T00:00:00.000Z')).toBe(true)
    expect(paintedMapLinkOpen(link, '2027-02-11T12:00:00.000Z')).toBe(false)
    expect(paintedMapLinkOpen({ ...link, ended_at: '2026-11-20T00:00:00.000Z' }, '2026-12-01T00:00:00.000Z')).toBe(false)
  })
})

describe('what the page is told', () => {
  const MAP = { id: 'map-id', name: ' The way in ', words: 'Start at the truck gate.', job_id: 'job-id', development_id: null, created_by: 'dana-id', created_at: '2026-11-13T15:00:00Z' }
  const LINES = [
    { id: 'l2', map_id: 'map-id', how: 'drawn', points: [[29.5, -98.2], [29.501, -98.2]], poor_parts: [], fixed_by_hand: false, length_m: 111, margin_m: 2.1, measured_ft: '364.0', measured_how: 'wheel', made_by: 'priya-id', made_at: '2026-11-13T16:00:00Z' },
    { id: 'l1', map_id: 'map-id', how: 'walked', points: [[29.5, -98.2], [29.5005, -98.2005], [29.501, -98.201]], poor_parts: [[1, 2], [5, 9]], fixed_by_hand: true, length_m: 80, margin_m: 12, measured_ft: null, measured_how: null, made_by: 'dana-id', made_at: '2026-11-13T15:05:00Z' },
    { id: 'bad', how: 'walked', points: [[29.5, -98.2]], made_at: '2026-11-13T17:00:00Z' },
  ]
  const PLACES = [
    { id: 'p2', map_id: 'map-id', name: 'Meter', words: '', lat: 29.5004, lng: -98.2003, accuracy_m: 6, photo_path: null, set_by: 'dana-id', set_at: '2026-11-13T15:06:00Z' },
    { id: 'p1', map_id: 'map-id', name: 'Truck gate', words: 'Close it behind you.', lat: 29.5, lng: -98.2, accuracy_m: 4, photo_path: 'map-id/gate.jpg', set_by: 'dana-id', set_at: '2026-11-13T15:02:00Z' },
  ]
  const shared = sharedPaintedMap(MAP, LINES, PLACES)

  it('is the name, the lines and the places, oldest first', () => {
    expect(shared.name).toBe('The way in')
    expect(shared.words).toBe('Start at the truck gate.')
    expect(shared.lines.map((l) => l.how)).toEqual(['walked', 'drawn'])
    expect(shared.lines[0]!.poorParts).toEqual([[1, 2]])
    expect(shared.lines[0]!.fixedByHand).toBe(true)
    expect(shared.lines[1]!).toMatchObject({ measuredFt: 364, measuredHow: 'wheel' })
    expect(shared.places.map((p) => `${p.number} ${p.name} ${p.photo}`)).toEqual(['1 Truck gate true', '2 Meter false'])
  })
  it('names nobody, no job, no day, and no file', () => {
    const wire = JSON.stringify(shared)
    expect(wire).not.toMatch(/dana-id|priya-id|job-id|map-id\/gate|created|made_|set_|accuracy|2026-/)
    expect(wire).not.toContain('"map-id"')
  })
  it('keeps a place\'s number when one before it cannot be drawn', () => {
    const out = sharedPaintedMap(MAP, [], [{ id: 'a', name: 'Off the globe', lat: 0, lng: 0, set_at: '1' }, { id: 'b', name: 'Gate', lat: 29.5, lng: -98.2, set_at: '2' }])
    expect(out.places.map((p) => `${p.number} ${p.name}`)).toEqual(['2 Gate'])
  })
  it('knows a map with nothing to show', () => {
    expect(sharedMapIsEmpty(sharedPaintedMap({ name: 'Empty' }, [], []))).toBe(true)
    expect(sharedMapIsEmpty(shared)).toBe(false)
  })
  it('hands the map\'s canvas its own shapes', () => {
    expect(sharedLineForCanvas(shared.lines[0]!, 0)).toMatchObject({ id: 'shared-0', how: 'walked', points: [{ lat: 29.5, lng: -98.2 }, { lat: 29.5005, lng: -98.2005 }, { lat: 29.501, lng: -98.201 }], poorParts: [[1, 2]] })
    expect(sharedPlacesForCanvas(shared).map((p) => `${p.number} ${p.name}`)).toEqual(['1 Truck gate', '2 Meter'])
  })
})

describe('the sheet\'s words', () => {
  it('says the day a link ends, from the day the function hands back', () => {
    expect(linkDayWords('2027-02-11')).toBe('Feb 11')
    expect(linkEndsWords('2027-02-11')).toBe('The link ends by itself on Feb 11.')
    expect(linkDayWords('soon')).toBeNull()
    expect(linkEndsWords(null)).toBeNull()
  })
  it('says how often a link was opened', () => {
    expect(linkOpenedWords(0)).toBe('Not opened yet')
    expect(linkOpenedWords(1)).toBe('Opened once')
    expect(linkOpenedWords(3)).toBe('Opened 3 times')
  })
})
