import { describe, expect, it } from 'vitest'
import {
  PAINTED_MAP_LINK_ALPHABET,
  PAINTED_MAP_LINK_WORDS,
  linkDayWords,
  linkEndsWords,
  linkMadeDayWords,
  linkOpenedWords,
  mintPaintedMapLinkCode,
  paintedMapHexOf,
  paintedMapLinkCode,
  paintedMapLinkExpiry,
  paintedMapLinkOpen,
  paintedMapLinkReopenable,
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
  it('hands on a place\'s kind as the table keeps it, and no kind for anything else (#393)', () => {
    const at = { lat: 29.5, lng: -98.2 }
    const out = sharedPaintedMap(MAP, [], [
      { id: 'a', name: 'Open trench', ...at, kind: 'hazard', set_at: '1' },
      { id: 'b', name: 'Hydrant', ...at, kind: 'fire_hydrant', set_at: '2' },
      { id: 'c', name: 'The slab', ...at, kind: null, set_at: '3' },
      { id: 'd', name: 'From before the column', ...at, set_at: '4' },
      { id: 'e', name: 'Not a word', ...at, kind: 'Truck Gate!', set_at: '5' },
      { id: 'f', name: 'Not text', ...at, kind: 7, set_at: '6' },
    ])
    // A word the page may not know yet is still handed on: the page draws it as the plain dot.
    expect(out.places.map((p) => p.kind)).toEqual(['hazard', 'fire_hydrant', null, null, null, null])
    // The map's own canvas takes only a kind this app knows.
    expect(sharedPlacesForCanvas(out).map((p) => p.kind)).toEqual(['hazard', null, null, null, null, null])
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
  it('says the day a link was made on the company\'s calendar, not the day in UTC', () => {
    expect(linkMadeDayWords('2026-11-16T05:03:16Z')).toBe('Nov 15')
    expect(linkMadeDayWords('2026-11-13T16:00:00Z')).toBe('Nov 13')
    expect(linkMadeDayWords('2026-07-01T04:59:00Z')).toBe('Jun 30')
    expect(linkMadeDayWords('2026-07-01T05:00:00Z')).toBe('Jul 1')
    expect(linkMadeDayWords('soon')).toBeNull()
    expect(linkMadeDayWords(null)).toBeNull()
  })
  it('says how often a link was opened', () => {
    expect(linkOpenedWords(0)).toBe('Not opened yet')
    expect(linkOpenedWords(1)).toBe('Opened once')
    expect(linkOpenedWords(3)).toBe('Opened 3 times')
  })
})

describe('who is looking at a shared map', () => {
  it('keeps a name as typed, tidied, and refuses what nobody could be called', async () => {
    const { paintedMapVisitorName } = await import('./paintedMapLink')
    expect(paintedMapVisitorName('  Dana   Reyes\n')).toBe('Dana Reyes')
    expect(paintedMapVisitorName('x'.repeat(200))).toHaveLength(80)
    expect(paintedMapVisitorName('José 2')).toBe('José 2')
    expect(paintedMapVisitorName('   ')).toBeNull()
    expect(paintedMapVisitorName('...')).toBeNull()
    expect(paintedMapVisitorName(42)).toBeNull()
  })

  it('takes a device id of one shape only', async () => {
    const { paintedMapDeviceId } = await import('./paintedMapLink')
    expect(paintedMapDeviceId(' 0B9F2C1E-6A4D-4E7B-9C3A-1F2E3D4C5B6A ')).toBe('0b9f2c1e-6a4d-4e7b-9c3a-1f2e3d4c5b6a')
    expect(paintedMapDeviceId('my phone')).toBeNull()
    expect(paintedMapDeviceId(null)).toBeNull()
  })

  it('says a device in two words', async () => {
    const { paintedMapDeviceWords } = await import('./paintedMapLink')
    expect(paintedMapDeviceWords('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1')).toBe('iPhone · Safari')
    expect(paintedMapDeviceWords('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36')).toBe('Android phone · Chrome')
    expect(paintedMapDeviceWords('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0')).toBe('Windows · Edge')
    expect(paintedMapDeviceWords('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0')).toBe('Mac · Firefox')
    expect(paintedMapDeviceWords('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1')).toBe('iPhone · Chrome')
    expect(paintedMapDeviceWords('')).toBe('A phone or computer')
    expect(paintedMapDeviceWords(null)).toBe('A phone or computer')
  })

  it('takes a point on the globe and nothing else', async () => {
    const { paintedMapVisitPoint } = await import('./paintedMapLink')
    expect(paintedMapVisitPoint(30.35, -97.75, 12.4)).toEqual({ lat: 30.35, lng: -97.75, accuracyM: 12.4 })
    expect(paintedMapVisitPoint(30.35, -97.75, undefined)).toEqual({ lat: 30.35, lng: -97.75, accuracyM: null })
    expect(paintedMapVisitPoint(130, -97.75, 5)).toBeNull()
    expect(paintedMapVisitPoint(0, 0, 5)).toBeNull()
    expect(paintedMapVisitPoint('30.35', -97.75, 5)).toBeNull()
    expect(paintedMapVisitPoint(Number.NaN, -97.75, 5)).toBeNull()
  })

  it('keeps the first point once and then the latest, never more often than the gap', async () => {
    const { paintedMapVisitPointColumns } = await import('./paintedMapLink')
    const point = { lat: 30.35, lng: -97.75, accuracyM: 9 }
    expect(paintedMapVisitPointColumns({ first_located_at: null, last_located_at: null }, point, '2026-11-15T18:00:00.000Z')).toEqual({ first_lat: 30.35, first_lng: -97.75, first_accuracy_m: 9, first_located_at: '2026-11-15T18:00:00.000Z' })
    expect(paintedMapVisitPointColumns({ first_located_at: '2026-11-15T18:00:00.000Z', last_located_at: null }, point, '2026-11-15T18:00:05.000Z')).toBeNull()
    expect(paintedMapVisitPointColumns({ first_located_at: '2026-11-15T18:00:00.000Z', last_located_at: null }, point, '2026-11-15T18:01:00.000Z')).toEqual({ last_lat: 30.35, last_lng: -97.75, last_accuracy_m: 9, last_located_at: '2026-11-15T18:01:00.000Z' })
    expect(paintedMapVisitPointColumns({ first_located_at: '2026-11-15T18:00:00.000Z', last_located_at: '2026-11-15T18:01:00.000Z' }, point, '2026-11-15T18:01:10.000Z')).toBeNull()
  })
})

describe('a visit as the share sheet says it', () => {
  const whenOf = (iso: string) => (iso.startsWith('2026-11-15T21:02') ? 'Nov 15, 3:02 PM' : iso.startsWith('2026-11-15T21:05') ? 'Nov 15, 3:05 PM' : null)
  const row = { id: 'v1', visitor_name: 'Dana Reyes', user_id: null, device_words: 'iPhone · Safari', last_opened_at: '2026-11-15T21:02:00Z', open_count: 2, first_lat: null, first_lng: null, first_located_at: null, last_lat: null, last_lng: null, last_located_at: null }

  it('says who, on what, when and how often', async () => {
    const { visitLine } = await import('./paintedMapLink')
    expect(visitLine(row, whenOf)).toEqual({ id: 'v1', name: 'Dana Reyes', teammate: false, detail: 'iPhone · Safari · opened Nov 15, 3:02 PM · 2 times', where: null, whereUrl: null })
    expect(visitLine({ ...row, open_count: 1, device_words: '', user_id: 'u1' }, whenOf)).toMatchObject({ teammate: true, detail: 'opened Nov 15, 3:02 PM' })
  })

  it('says a reader showed where they were, at the latest place kept', async () => {
    const { visitLine } = await import('./paintedMapLink')
    const first = { ...row, first_lat: 30.35, first_lng: -97.75, first_located_at: '2026-11-15T21:02:30Z' }
    expect(visitLine(first, whenOf)).toMatchObject({ where: 'Showed where they were, Nov 15, 3:02 PM.', whereUrl: 'https://www.google.com/maps/search/?api=1&query=30.350000,-97.750000' })
    const moved = { ...first, last_lat: 30.3512, last_lng: -97.7521, last_located_at: '2026-11-15T21:05:00Z' }
    expect(visitLine(moved, whenOf)).toMatchObject({ where: 'Showed where they were, Nov 15, 3:05 PM.', whereUrl: 'https://www.google.com/maps/search/?api=1&query=30.351200,-97.752100' })
  })

  it('says a reader showed only an area, and hands the office no pin on its middle (v2.8105)', async () => {
    const { visitLine } = await import('./paintedMapLink')
    // A phone with Precise Location off: the point is the middle of an area two miles to a side.
    const area = { ...row, first_lat: 30.35, first_lng: -97.75, first_located_at: '2026-11-15T21:02:30Z', first_accuracy_m: 3200 }
    expect(visitLine(area, whenOf)).toMatchObject({ where: 'Showed only the area they were in, 4 miles across, Nov 15, 3:02 PM.', whereUrl: null })
    // Exactly 1,000 m is a weak spot and not an area: the edge is the walk's own.
    expect(visitLine({ ...area, first_accuracy_m: 1000 }, whenOf)).toMatchObject({ where: 'Showed where they were, Nov 15, 3:02 PM.', whereUrl: 'https://www.google.com/maps/search/?api=1&query=30.350000,-97.750000' })
    // A row read with no margin, or kept before the phone said one, is taken as a spot, as it always was.
    expect(visitLine({ ...area, first_accuracy_m: null }, whenOf).whereUrl).toBe('https://www.google.com/maps/search/?api=1&query=30.350000,-97.750000')
  })

  it('speaks of a spot when either kept point is one, the latest first, and of an area only when neither is', async () => {
    const { visitLine, visitPoint } = await import('./paintedMapLink')
    const both = { ...row, first_lat: 30.35, first_lng: -97.75, first_located_at: '2026-11-15T21:02:30Z', first_accuracy_m: 8, last_lat: 30.4, last_lng: -97.8, last_located_at: '2026-11-15T21:05:00Z', last_accuracy_m: 5000 }
    // The latest is an area, the first was a spot: the spot is where they were, at its own time.
    expect(visitLine(both, whenOf)).toMatchObject({ where: 'Showed where they were, Nov 15, 3:02 PM.', whereUrl: 'https://www.google.com/maps/search/?api=1&query=30.350000,-97.750000' })
    // The first was an area off a cell tower, the latest is a spot: the latest.
    expect(visitPoint({ ...both, first_accuracy_m: 1414, last_accuracy_m: 6 })).toMatchObject({ lat: 30.4, at: '2026-11-15T21:05:00Z' })
    // Both are areas: the latest one, and no pin.
    expect(visitLine({ ...both, first_accuracy_m: 3200 }, whenOf)).toMatchObject({ where: 'Showed only the area they were in, 7 miles across, Nov 15, 3:05 PM.', whereUrl: null })
    expect(visitPoint(row)).toBeNull()
  })
})

describe('paintedMapLinkReopenable (punch list #443, row 14)', () => {
  const now = '2026-11-26T03:00:00Z'
  it('an ended link not past its day may come back; an open link and a link past its day may not', () => {
    expect(paintedMapLinkReopenable({ ended_at: '2026-11-25T18:00:00Z', expires_at: '2027-02-18T05:59:59Z' }, now)).toBe(true)
    expect(paintedMapLinkReopenable({ ended_at: null, expires_at: '2027-02-18T05:59:59Z' }, now)).toBe(false)
    expect(paintedMapLinkReopenable({ ended_at: '2026-11-25T18:00:00Z', expires_at: '2026-11-26T03:00:00Z' }, now)).toBe(false)
    expect(paintedMapLinkReopenable({ ended_at: '2026-11-25T18:00:00Z', expires_at: '2026-11-20T05:59:59Z' }, now)).toBe(false)
  })
  it('the four refusals have their words, which the sheet says before the call', () => {
    expect(PAINTED_MAP_LINK_WORDS.reopenNotDev).toBe('Only a developer can reopen an ended link.')
    expect(PAINTED_MAP_LINK_WORDS.reopenNotTest).toBe('Only a link of a test map can be reopened. The map’s name must start with ZZ.')
    expect(PAINTED_MAP_LINK_WORDS.reopenNotEnded).toBe('This link is still open.')
    expect(PAINTED_MAP_LINK_WORDS.reopenPastDay).toBe('This link is past its day. Make a new one.')
  })
})
