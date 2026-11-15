/**
 * A painted map on a task with no place (punch list #345, "A map on a task"): which rows carry
 * one, what the task says about it, where the small picture looks and what How far am I? answers.
 */
import { describe, expect, it } from 'vitest'
import { TASK_MAP_WORDS, taskMapFrame, taskMapHowFarWords, taskMapIdFromRow, taskMapLineParts, taskMapLineWords, taskMapPlaceKey, taskMapStart } from './taskMap'

const line = (points: Array<[number, number]>, madeAt = '2026-11-15T15:00:00Z', lengthM = 253) => ({ points: points.map(([lat, lng]) => ({ lat, lng })), madeAt, lengthM, measuredFt: null })

describe('taskMapIdFromRow', () => {
  it('a row with a map and no place carries the map by itself', () => {
    expect(taskMapIdFromRow({ place_lat: null, place_lng: null, painted_map_id: 'm1' })).toBe('m1')
  })

  it('a row with a place gives none: the map is then the way to that place', () => {
    expect(taskMapIdFromRow({ place_lat: 29.55, place_lng: -98.3, painted_map_id: 'm1' })).toBeNull()
  })

  it('no row, no map and an empty id are all no map', () => {
    expect(taskMapIdFromRow(null)).toBeNull()
    expect(taskMapIdFromRow({ place_lat: null, place_lng: null, painted_map_id: null })).toBeNull()
    expect(taskMapIdFromRow({ painted_map_id: '' })).toBeNull()
  })
})

describe('taskMapLineWords', () => {
  it('names the map, its length and its places', () => {
    expect(taskMapLineWords('The trench', [{ lengthM: 253, measuredFt: null }], 3)).toBe('The trench · about 830 ft · 3 places')
  })

  it('comes in two halves too, so a narrow card can shorten the name and keep the length', () => {
    expect(taskMapLineParts('The trench', [{ lengthM: 253, measuredFt: null }], 3)).toEqual({ name: 'The trench', summary: 'about 830 ft · 3 places' })
    expect(taskMapLineParts(' ', [], 0)).toEqual({ name: 'A painted map', summary: '' })
  })

  it('a map with nothing on it yet is its name alone, and a blank name is a painted map', () => {
    expect(taskMapLineWords('The trench', [], 0)).toBe('The trench')
    expect(taskMapLineWords('  ', [], 0)).toBe('A painted map')
  })
})

describe('taskMapPlaceKey', () => {
  const dot = (id: string, name: string, setAt: string) => ({ id, mapId: 'm', name, words: '', lat: 30, lng: -97, accuracyM: null, photoPath: null, setBy: null, setAt })

  it('names each dot by its number, in the order the dots were set', () => {
    const key = taskMapPlaceKey([dot('b', 'Stub at the house', '2026-11-15T15:02:00Z'), dot('a', 'Meter', '2026-11-15T15:01:00Z')])
    expect(key).toEqual({ named: [{ id: 'a', number: 1, name: 'Meter' }, { id: 'b', number: 2, name: 'Stub at the house' }], more: 0 })
  })

  it('a place nobody named is a place, and past the cap the rest are counted', () => {
    const many = Array.from({ length: 9 }, (_, i) => dot(`p${i}`, i === 0 ? '  ' : `Place ${i}`, `2026-11-15T15:0${i}:00Z`))
    const key = taskMapPlaceKey(many)
    expect(key.named).toHaveLength(6)
    expect(key.named[0]?.name).toBe('A place')
    expect(key.more).toBe(3)
  })
})

describe('taskMapFrame', () => {
  it('looks at the middle of the line', () => {
    const frame = taskMapFrame([line([[30.0, -97.002], [30.002, -97.0]])], [])
    expect(frame?.center.lat).toBeCloseTo(30.001, 6)
    expect(frame?.center.lng).toBeCloseTo(-97.001, 6)
  })

  it('a long line is seen from further off than a short one, and both are inside the limits', () => {
    const short = taskMapFrame([line([[30.0, -97.0], [30.0002, -97.0002]])], [])
    const long = taskMapFrame([line([[30.0, -97.0], [30.05, -97.05]])], [])
    expect(short && long && short.zoom > long.zoom).toBe(true)
    expect(short?.zoom).toBeLessThanOrEqual(19)
    expect(long?.zoom).toBeGreaterThanOrEqual(3)
  })

  it('the whole line fits the picture at the zoom it picks', () => {
    const frame = taskMapFrame([line([[30.0, -97.01], [30.0, -97.0]])], [], { width: 320, height: 150 })
    // 0.01 degrees of longitude at this zoom, in pixels, must be inside the picture's width.
    const pixels = (0.01 / 360) * 256 * 2 ** (frame?.zoom ?? 0)
    expect(pixels).toBeLessThanOrEqual(320)
    expect(pixels * 2).toBeGreaterThan(320 * 0.8)
  })

  it('one place and no line is seen close, and a map with nothing on it has no frame', () => {
    expect(taskMapFrame([], [{ lat: 30, lng: -97 }])).toEqual({ center: { lat: 30, lng: -97 }, zoom: 19 })
    expect(taskMapFrame([], [])).toBeNull()
  })
})

describe('taskMapStart', () => {
  it('is the first point of the oldest line', () => {
    const start = taskMapStart([line([[30.5, -97.5]], '2026-11-15T16:00:00Z'), line([[30.1, -97.1], [30.2, -97.2]], '2026-11-15T15:00:00Z')], [])
    expect(start).toEqual({ lat: 30.1, lng: -97.1 })
  })
})

describe('taskMapHowFarWords', () => {
  it('measures to the start and names the direction', () => {
    const far = taskMapHowFarWords({ lat: 30, lng: -97, accuracyM: 6 }, { lat: 30.001, lng: -97 })
    expect(far.lead).toMatch(/^The start is .+ north of you\.$/)
    expect(far.sure).toMatch(/^Your phone is sure /)
  })

  it('inside what a phone can tell apart, the person is at the start', () => {
    expect(taskMapHowFarWords({ lat: 30, lng: -97 }, { lat: 30.00001, lng: -97 })).toEqual({ lead: 'You are at the start.', sure: null })
  })
})

describe('the words', () => {
  it('the presses read as the design has them', () => {
    expect(TASK_MAP_WORDS.open).toBe('Open the map')
    expect(TASK_MAP_WORDS.directionsToStart).toBe('Directions to the start')
    expect(TASK_MAP_WORDS.howFar).toBe('How far am I?')
  })
})
