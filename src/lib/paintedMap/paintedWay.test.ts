import { describe, expect, it } from 'vitest'
import { fromPlane, type PaintedPoint } from './paintedLine'
import { WAY_DEVICE_KEY, WAY_FRAME_METERS, WAY_LENGTH_GUIDE_WORDS, WAY_NAME_KEY, rememberWayName, wayDeviceId, wayIsSeenWords, wayKeptWords, wayLineUnderWords, wayNearMap, wayNoFixWords, wayOpenedAsWords, wayPointIsDue, wayReading, wayRememberedName, wayScreenWords, wayWillSeeWords, wayWords } from './paintedWay'

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
  it('counts as near whatever distance it is told to, for a reader who is an area', () => {
    expect(WAY_FRAME_METERS).toBe(2000)
    expect(wayNearMap(at(-5000, 0), points)).toBe(false)
    expect(wayNearMap(at(-5000, 0), points, 5200)).toBe(true)
    expect(wayNearMap(at(-5000, 0), points, 4999)).toBe(false)
  })
})

describe('what the shared page makes of a reading (#402)', () => {
  const points = LINES[0]!.points
  const me = (eastM: number, northM: number, accuracyM: number | null) => ({ ...at(eastM, northM), accuracyM })

  it('is still finding the reader with no reading', () => {
    expect(wayReading(null, false, points)).toEqual({ kind: 'finding' })
    expect(wayReading(null, true, points)).toEqual({ kind: 'finding' })
  })

  it('takes a sure reading as a spot, held in one picture with the map when it is near', () => {
    const near = me(50, 10, 5)
    expect(wayReading(near, false, points)).toEqual({ kind: 'spot', me: near, weak: false, together: true })
    const far = me(9000, 0, 5)
    expect(wayReading(far, false, points)).toEqual({ kind: 'spot', me: far, weak: false, together: false })
  })

  it('takes a weak reading as a spot too, and says it is weak, at the walk’s own 20 m', () => {
    expect(wayReading(me(50, 10, 20), false, points)).toMatchObject({ kind: 'spot', weak: false })
    expect(wayReading(me(50, 10, 20.01), false, points)).toMatchObject({ kind: 'spot', weak: true })
    expect(wayReading(me(50, 10, 1000), true, points)).toMatchObject({ kind: 'spot', weak: true })
  })

  it('takes a reading with no margin as a spot that claims nothing', () => {
    expect(wayReading(me(50, 10, null), false, points)).toMatchObject({ kind: 'spot', weak: false, together: true })
  })

  it('is still finding the reader on a rough reading the page is waiting on, so nobody is drawn', () => {
    expect(wayReading(me(50, 10, 1000.01), false, points)).toEqual({ kind: 'finding' })
    expect(wayReading(me(50, 10, 3200), false, points)).toEqual({ kind: 'finding' })
  })

  it('takes a rough reading that has stayed rough as an area, marked so the map draws no dot', () => {
    const r = wayReading(me(50, 10, 3200), true, points)
    expect(r).toEqual({ kind: 'area', me: { ...me(50, 10, 3200), area: true }, circle: true })
  })

  it('shows the whole circle when the area’s edge is near the map: the margin is added to how near counts', () => {
    // The middle is 5 km off, past the 2 km a spot gets. Its edge, 3.2 km in, is not.
    expect(wayReading(me(-5000, 0, 3200), true, points)).toMatchObject({ kind: 'area', circle: true })
    expect(wayReading(me(-5200, 0, 3200), true, points)).toMatchObject({ kind: 'area', circle: true })
    expect(wayReading(me(-5300, 0, 3200), true, points)).toMatchObject({ kind: 'area', circle: false })
    // The same middle with a tight margin is a spot across town.
    expect(wayReading(me(-5000, 0, 5), true, points)).toMatchObject({ kind: 'spot', together: false })
  })

  it('never lets the wait turn a reading that is not rough into an area', () => {
    for (const m of [0, 5, 20, 35, 300, 1000, null]) expect(wayReading(me(50, 10, m), true, points).kind).toBe('spot')
  })
})

describe('the sentence under a line\'s length', () => {
  it('says how a map\'s only line was made and what its length is worth, in one sentence', () => {
    expect(wayLineUnderWords({ how: 'drawn', fixedByHand: false }, false, true)).toBe('Drawn by hand, so the length is a guide for how far, not a measurement.')
    expect(wayLineUnderWords({ how: 'walked', fixedByHand: true }, false, true)).toBe('Walked, a part drawn by hand, so the length is a guide for how far, not a measurement.')
  })
  it('never calls a measured length a guide', () => {
    expect(wayLineUnderWords({ how: 'walked', fixedByHand: false }, true, true)).toBe('Walked.')
  })
  it('says only how among several lines, and the guide is one sentence for the foot', () => {
    expect(wayLineUnderWords({ how: 'driven', fixedByHand: false }, false, false)).toBe('Driven.')
    expect(WAY_LENGTH_GUIDE_WORDS).toBe('A length here is a guide for how far, not a measurement.')
  })
})

describe('who is looking: what the page keeps on the phone and says', () => {
  const store = () => {
    const kept = new Map<string, string>()
    return { kept, getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) }
  }
  const broken = { getItem: () => { throw new Error('off') }, setItem: () => { throw new Error('off') }, removeItem: () => { throw new Error('off') } }
  const ID = '0b9f2c1e-6a4d-4e7b-9c3a-1f2e3d4c5b6a'

  it('makes a device id once and keeps it', () => {
    const s = store()
    expect(wayDeviceId(s, () => ID)).toBe(ID)
    expect(s.kept.get(WAY_DEVICE_KEY)).toBe(ID)
    expect(wayDeviceId(s, () => 'never-asked')).toBe(ID)
  })

  it('replaces a kept id that is not one, and gives a new one where nothing is kept', () => {
    const s = store()
    s.kept.set(WAY_DEVICE_KEY, 'my phone')
    expect(wayDeviceId(s, () => ID)).toBe(ID)
    expect(wayDeviceId(broken, () => ID)).toBe(ID)
    expect(wayDeviceId(null, () => ID)).toBe(ID)
  })

  it('remembers a name, forgets it, and survives a store that throws', () => {
    const s = store()
    expect(wayRememberedName(s)).toBeNull()
    rememberWayName(s, 'Dana Reyes')
    expect(s.kept.get(WAY_NAME_KEY)).toBe('Dana Reyes')
    expect(wayRememberedName(s)).toBe('Dana Reyes')
    rememberWayName(s, null)
    expect(wayRememberedName(s)).toBeNull()
    expect(wayRememberedName(broken)).toBeNull()
    expect(() => rememberWayName(broken, 'Dana')).not.toThrow()
  })

  it('says the screen as the browser tells it', () => {
    expect(wayScreenWords(390, 844, 3)).toBe('390x844@3')
    expect(wayScreenWords(1440, 900, 1.5)).toBe('1440x900@1.5')
    expect(wayScreenWords(1440, 900, undefined)).toBe('1440x900')
    expect(wayScreenWords(undefined, 900, 2)).toBe('')
  })

  it('sends a place at once and then about once a minute', () => {
    expect(wayPointIsDue(null, 1_000)).toBe(true)
    expect(wayPointIsDue(1_000, 30_000)).toBe(false)
    expect(wayPointIsDue(1_000, 61_000)).toBe(true)
  })

  it('names who keeps what, and falls back when the company has no name', () => {
    expect(wayKeptWords('Made Up Plumbing')).toBe('Made Up Plumbing keeps your name, the phone or computer you are on, and when you open this map. If you press Show where I am, they also see where you are.')
    expect(wayWillSeeWords('  ')).toBe('The company that sent this map will see where you are while this is on.')
    expect(wayIsSeenWords('Made Up Plumbing')).toBe('Made Up Plumbing sees where you are while this is on. Press Hide where I am to stop. Keep this page open and the dot moves with you.')
    expect(wayOpenedAsWords('Dana Reyes')).toBe('You opened this map as Dana Reyes.')
  })
})
