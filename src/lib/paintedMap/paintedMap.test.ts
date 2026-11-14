import { describe, expect, it } from 'vitest'
import { fromPlane, type PaintedPoint } from './paintedLine'
import {
  PAINTED_MAP_UNNAMED,
  PAINTED_PLACE_UNNAMED,
  aboutLengthWords,
  cleanPaintedText,
  giveOrTakeWords,
  lineHowWords,
  lineLengthWords,
  mapBounds,
  mapLengthMeters,
  mapStart,
  mapSummaryWords,
  mapsForJob,
  numberedPlaces,
  paintedByWords,
  paintedLineColumns,
  paintedLineFromRow,
  paintedMapFromRow,
  paintedPlaceColumns,
  paintedPlaceFromRow,
  parseMeasuredFeet,
  type PaintedMap,
  type PaintedMapLineRow,
  type PaintedMapPlaceRow,
  type PaintedPlace,
} from './paintedMap'

const ORIGIN: PaintedPoint = { lat: 29.5, lng: -98.2 }
const at = (eastM: number, northM: number): PaintedPoint => fromPlane(ORIGIN, { x: eastM, y: northM })
const FT = 0.3048

const lineRow = (over: Partial<PaintedMapLineRow> = {}): PaintedMapLineRow => ({
  id: 'l1',
  map_id: 'm1',
  label: '',
  how: 'walked',
  points: [[29.5, -98.2], [29.501, -98.201]],
  poor_parts: [],
  fixed_by_hand: false,
  length_m: 147.5,
  margin_m: 12,
  measured_ft: null,
  measured_how: null,
  made_by: 'u1',
  made_at: '2026-11-13T15:00:00Z',
  ...over,
})
const placeRow = (over: Partial<PaintedMapPlaceRow> = {}): PaintedMapPlaceRow => ({
  id: 'p1',
  map_id: 'm1',
  name: 'Truck gate',
  words: 'Chain is looped, not locked.',
  lat: 29.5,
  lng: -98.2,
  accuracy_m: 4,
  photo_path: 'm1/gate.jpg',
  set_by: 'u1',
  set_at: '2026-11-13T15:00:00Z',
  ...over,
})
const map = (over: Partial<PaintedMap>): PaintedMap => ({ id: 'm', name: 'A map', words: '', jobId: null, developmentId: null, createdBy: 'u1', createdAt: '2026-11-13T15:00:00Z', ...over })

describe('rows', () => {
  it('reads a map and gives a nameless one a name', () => {
    const m = paintedMapFromRow({ id: 'm1', name: '  The   way in  ', words: ' Start at the gate. ', job_id: 'j1', development_id: null, created_by: 'u1', created_at: 'x' })
    expect(m.name).toBe('The way in')
    expect(m.words).toBe('Start at the gate.')
    expect(m.jobId).toBe('j1')
    expect(paintedMapFromRow({ id: 'm2', name: '  ', words: '', job_id: null, development_id: null, created_by: null, created_at: 'x' }).name).toBe(PAINTED_MAP_UNNAMED)
  })
  it('reads a line with its faint parts', () => {
    const l = paintedLineFromRow(lineRow({ points: [[29.5, -98.2], [29.5005, -98.2005], [29.501, -98.201]], poor_parts: [[1, 2]], fixed_by_hand: true }))!
    expect(l.points).toHaveLength(3)
    expect(l.poorParts).toEqual([[1, 2]])
    expect(l.fixedByHand).toBe(true)
  })
  it('does not draw a line it cannot read', () => {
    expect(paintedLineFromRow(lineRow({ points: [[29.5, -98.2]] }))).toBeNull()
    expect(paintedLineFromRow(lineRow({ points: 'nope' }))).toBeNull()
    expect(paintedLineFromRow(lineRow({ how: 'flown' }))).toBeNull()
  })
  it('reads a measured length whether the database hands back a number or a string', () => {
    expect(paintedLineFromRow(lineRow({ measured_ft: '462.0', measured_how: 'wheel' }))!.measuredFt).toBe(462)
    expect(paintedLineFromRow(lineRow({ measured_ft: 462.5, measured_how: 'tape' }))!.measuredHow).toBe('tape')
  })
  it('takes no measured length without how it was measured', () => {
    const l = paintedLineFromRow(lineRow({ measured_ft: 462, measured_how: null }))!
    expect(l.measuredFt).toBeNull()
    expect(l.measuredHow).toBeNull()
  })
  it('reads a place, and none when its point is off the globe', () => {
    const p = paintedPlaceFromRow(placeRow())!
    expect(p.name).toBe('Truck gate')
    expect(p.accuracyM).toBe(4)
    expect(paintedPlaceFromRow(placeRow({ name: ' ' }))!.name).toBe(PAINTED_PLACE_UNNAMED)
    expect(paintedPlaceFromRow(placeRow({ lat: 0, lng: 0 }))).toBeNull()
  })
})

describe('what a save writes', () => {
  it('works the length out from the points it saves', () => {
    const cols = paintedLineColumns({ how: 'drawn', points: [at(0, 0), at(100, 0), at(100, 50)], marginM: 2.123 }, 'm1', 'u1')!
    expect(cols.length_m).toBeCloseTo(150, 0)
    expect(cols.points).toHaveLength(3)
    expect(cols.margin_m).toBe(2.12)
    expect(cols.made_by).toBe('u1')
    expect(cols.fixed_by_hand).toBe(false)
  })
  it('leaves the faint parts out of the length it stores', () => {
    const cols = paintedLineColumns({ how: 'walked', points: [at(0, 0), at(100, 0), at(200, 0), at(300, 0)], poorParts: [[1, 2]], fixedByHand: true }, 'm1', 'u1')!
    expect(cols.length_m).toBeCloseTo(200, 0)
    expect(cols.poor_parts).toEqual([[1, 2]])
    expect(cols.fixed_by_hand).toBe(true)
  })
  it('writes nothing but pairs of numbers for the line: no time rides along', () => {
    const walked = [
      { ...at(0, 0), accuracyM: 5, atMs: 1_700_000_000_000 },
      { ...at(50, 0), accuracyM: 5, atMs: 1_700_000_040_000 },
    ]
    const cols = paintedLineColumns({ how: 'walked', points: walked }, 'm1', 'u1')!
    expect(JSON.stringify(cols)).not.toMatch(/atMs|accuracyM|1700000/)
  })
  it('has nothing to write for a line of one point', () => {
    expect(paintedLineColumns({ how: 'drawn', points: [at(0, 0)] }, 'm1', 'u1')).toBeNull()
  })
  it('never calls a line drawn by hand a line fixed by hand', () => {
    expect(paintedLineColumns({ how: 'drawn', points: [at(0, 0), at(5, 5)], fixedByHand: true }, 'm1', 'u1')!.fixed_by_hand).toBe(false)
  })
  it('writes a place with a whole margin, and none for a dot placed by hand', () => {
    expect(paintedPlaceColumns({ ...at(0, 0), name: ' Meter ', accuracyM: 5.6 }, 'm1', 'u1')!).toMatchObject({ name: 'Meter', accuracy_m: 6, set_by: 'u1', words: '' })
    expect(paintedPlaceColumns({ ...at(0, 0), name: '' }, 'm1', 'u1')!).toMatchObject({ name: PAINTED_PLACE_UNNAMED, accuracy_m: null, photo_path: null })
    expect(paintedPlaceColumns({ lat: 0, lng: 0 }, 'm1', 'u1')).toBeNull()
  })
  it('trims and caps what a person types', () => {
    expect(cleanPaintedText('  a   b  ', 10)).toBe('a b')
    expect(cleanPaintedText('abcdefghij klm', 10)).toBe('abcdefghij')
    expect(cleanPaintedText(null, 10)).toBe('')
  })
})

describe('a length, said honestly', () => {
  it('is always about, and rounded to what it can bear', () => {
    expect(aboutLengthWords(12 * FT)).toBe('about 10 ft')
    expect(aboutLengthWords(48 * FT)).toBe('about 50 ft')
    expect(aboutLengthWords(638.4 * FT)).toBe('about 640 ft')
    expect(aboutLengthWords(1234 * FT)).toBe('about 1,250 ft')
    expect(aboutLengthWords(7400 * FT)).toBe('about 1.4 mi')
    expect(aboutLengthWords(0)).toBe('about 5 ft')
  })
  it('rounds the give or take up, never down', () => {
    expect(giveOrTakeWords(2.12)).toBe('give or take 10 ft')
    expect(giveOrTakeWords(11 * FT)).toBe('give or take 15 ft')
    expect(giveOrTakeWords(41 * FT)).toBe('give or take 45 ft')
    expect(giveOrTakeWords(61 * FT)).toBe('give or take 70 ft')
    expect(giveOrTakeWords(null)).toBeNull()
  })
  it('leads with about and its give or take', () => {
    expect(lineLengthWords({ lengthM: 830 * FT, marginM: 38 * FT, measuredFt: null, measuredHow: null })).toEqual({ lead: 'About 830 ft', tail: 'give or take 40 ft', measured: false })
  })
  it('lets a measured length win, and says how it was measured', () => {
    expect(lineLengthWords({ lengthM: 830 * FT, marginM: 38 * FT, measuredFt: 612, measuredHow: 'wheel' })).toEqual({ lead: '612 ft', tail: 'measured with a wheel', measured: true })
    expect(lineLengthWords({ lengthM: 1, marginM: null, measuredFt: 1250.5, measuredHow: 'tape' }).lead).toBe('1,250.5 ft')
  })
  it('reads a length as typed', () => {
    expect(parseMeasuredFeet('612')).toBe(612)
    expect(parseMeasuredFeet(' 1,250.5 ft ')).toBe(1250.5)
    expect(parseMeasuredFeet("48'")).toBe(48)
    expect(parseMeasuredFeet('0')).toBeNull()
    expect(parseMeasuredFeet('about 600')).toBeNull()
    expect(parseMeasuredFeet('')).toBeNull()
  })
  it('says how a line was made', () => {
    expect(lineHowWords({ how: 'walked', fixedByHand: false })).toBe('walked')
    expect(lineHowWords({ how: 'driven', fixedByHand: true })).toBe('driven, a part drawn by hand')
    expect(lineHowWords({ how: 'drawn', fixedByHand: true })).toBe('drawn by hand')
  })
})

describe('a map as a whole', () => {
  it('sums its lines, a typed length in place of a read one', () => {
    const lines = [
      { lengthM: 830 * FT, measuredFt: null },
      { lengthM: 400 * FT, measuredFt: 420 },
    ]
    expect(mapLengthMeters(lines) / FT).toBeCloseTo(1250, 0)
    expect(mapSummaryWords(lines, 3)).toBe('about 1,250 ft · 3 places')
    expect(mapSummaryWords([], 1)).toBe('1 place')
    expect(mapSummaryWords([], 0)).toBe('')
  })
  it('says who painted it and when', () => {
    expect(paintedByWords('Dana Whitlock', 'Nov 13')).toBe('Painted by Dana Whitlock on Nov 13.')
    expect(paintedByWords('', 'Nov 13')).toBe('Painted on Nov 13.')
    expect(paintedByWords(null, null)).toBeNull()
  })
  it('shows a job its own maps first, then its development\'s, newest first', () => {
    const maps = [
      map({ id: 'old', jobId: 'j1', createdAt: '2026-11-01T00:00:00Z' }),
      map({ id: 'new', jobId: 'j1', createdAt: '2026-11-10T00:00:00Z' }),
      map({ id: 'dev', developmentId: 'd1', createdAt: '2026-11-12T00:00:00Z' }),
      map({ id: 'other', jobId: 'j2' }),
      map({ id: 'otherDev', developmentId: 'd2' }),
    ]
    expect(mapsForJob(maps, 'j1', 'd1').map((m) => `${m.id}${m.fromDevelopment ? '*' : ''}`)).toEqual(['new', 'old', 'dev*'])
    expect(mapsForJob(maps, 'j1', null).map((m) => m.id)).toEqual(['new', 'old'])
  })
  it('numbers places in the order they were set, so a number never moves', () => {
    const place = (id: string, setAt: string): PaintedPlace => ({ id, mapId: 'm', name: id, words: '', ...at(0, 0), accuracyM: null, photoPath: null, setBy: null, setAt })
    const numbered = numberedPlaces([place('yard', '2026-11-13T15:05:00Z'), place('gate', '2026-11-13T15:00:00Z'), place('stub', '2026-11-13T15:09:00Z')])
    expect(numbered.map((p) => `${p.number} ${p.id}`)).toEqual(['1 gate', '2 yard', '3 stub'])
  })
  it('starts at the first point of its oldest line, or at its first place', () => {
    const place: PaintedPlace = { id: 'gate', mapId: 'm', name: 'Gate', words: '', ...at(7, 7), accuracyM: null, photoPath: null, setBy: null, setAt: 'a' }
    const lines = [
      { points: [at(50, 50), at(60, 60)], madeAt: '2026-11-13T16:00:00Z' },
      { points: [at(0, 0), at(10, 0)], madeAt: '2026-11-13T15:00:00Z' },
    ]
    expect(mapStart(lines, [place])).toEqual(at(0, 0))
    expect(mapStart([], [place])).toEqual(at(7, 7))
    expect(mapStart([], [])).toBeNull()
  })
  it('frames every line and every place', () => {
    const b = mapBounds([{ points: [at(0, 0), at(100, 0)] }], [at(50, 80)])!
    expect(b.north).toBeGreaterThan(ORIGIN.lat)
    expect(b.east).toBeGreaterThan(b.west)
    expect(mapBounds([], [])).toBeNull()
  })
})
