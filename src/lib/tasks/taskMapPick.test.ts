/**
 * The giver's side of a painted map on a task (punch list #345, step 7): which map the window
 * holds as the place comes and goes, what a save writes, which maps are offered and in what order,
 * and the bar's sentence.
 */
import { describe, expect, it } from 'vitest'
import {
  TASK_MAP_PICK_WORDS,
  mapsForTask,
  sentenceWithMap,
  taskMapAfterPlace,
  taskMapChanged,
  taskMapColumn,
  taskMapDraftFromSaved,
  taskMapFromPainted,
  taskMapNearWords,
  taskMapNewName,
  taskMapOfferWords,
  taskPlaceForRow,
} from './taskMapPick'
import type { TaskPlaceDraft } from './taskPlace'

const place = (name: string, extra: Partial<TaskPlaceDraft> = {}): TaskPlaceDraft => ({ lat: 29.551, lng: -98.287, name, accuracyM: null, ...extra })
const whole = (id: string, name: string, madeAt: string, points: Array<[number, number]>, places = 0) => ({
  map: { id, name, createdAt: madeAt },
  lines: points.length > 0 ? [{ points: points.map(([lat, lng]) => ({ lat, lng })), lengthM: 253, measuredFt: null }] : [],
  places: Array.from({ length: places }, (_, i) => ({ lat: points[0]?.[0] ?? 29.5, lng: (points[0]?.[1] ?? -98.3) + i * 0.0001 })),
})

describe('taskMapDraftFromSaved', () => {
  it('a saved place with a map gives the map as that place\'s way in', () => {
    expect(taskMapDraftFromSaved({ mapId: 'm1' }, null)).toEqual({ id: 'm1', name: null, withPlace: true })
  })

  it('a saved map with no place is the task\'s own map', () => {
    expect(taskMapDraftFromSaved(null, 'm1')).toEqual({ id: 'm1', name: null })
  })

  it('a place with no map, and a task with neither, hold no map', () => {
    expect(taskMapDraftFromSaved({ mapId: null }, null)).toBeNull()
    expect(taskMapDraftFromSaved(null, null)).toBeNull()
  })
})

describe('taskMapAfterPlace', () => {
  it('a place that brings a way in makes it the task\'s map', () => {
    expect(taskMapAfterPlace(null, place('Pump house', { mapId: 'm1', mapName: 'The way in' }))).toEqual({ id: 'm1', name: 'The way in', withPlace: true })
  })

  it('a chip knows the id and not the name: the name already read for that map is kept', () => {
    expect(taskMapAfterPlace({ id: 'm1', name: 'The way in', withPlace: true }, place('Pump house', { mapId: 'm1' }))).toEqual({ id: 'm1', name: 'The way in', withPlace: true })
  })

  it('a map that came with the place leaves when the place leaves or changes to one with no way in', () => {
    const map = { id: 'm1', name: 'The way in', withPlace: true }
    expect(taskMapAfterPlace(map, null)).toBeNull()
    expect(taskMapAfterPlace(map, place('Shop bay 2'))).toBeNull()
  })

  it('a map the giver picked by itself stays through any change of place', () => {
    const map = { id: 'm9', name: 'The trench' }
    expect(taskMapAfterPlace(map, null)).toBe(map)
    expect(taskMapAfterPlace(map, place('Shop bay 2'))).toBe(map)
  })

  it('a place with its own way in replaces a map the giver picked by itself', () => {
    expect(taskMapAfterPlace({ id: 'm9', name: 'The trench' }, place('Pump house', { mapId: 'm1' }))).toEqual({ id: 'm1', name: null, withPlace: true })
  })
})

describe('taskPlaceForRow', () => {
  it('the chip carries the map only when the map is the way to that place', () => {
    expect(taskPlaceForRow(place('Pump house'), { id: 'm1', name: 'The way in', withPlace: true })).toMatchObject({ mapId: 'm1', mapName: 'The way in' })
    const bare = taskPlaceForRow(place('Pump house', { mapId: 'old' }), { id: 'm9', name: 'The trench' })
    expect(bare).toEqual({ lat: 29.551, lng: -98.287, name: 'Pump house', accuracyM: null })
  })

  it('no place is no place, whatever the map', () => {
    expect(taskPlaceForRow(null, { id: 'm9', name: 'The trench' })).toBeNull()
  })
})

describe('what a save writes', () => {
  it('the map\'s id, or null with no map', () => {
    expect(taskMapColumn({ id: 'm1', name: null })).toEqual({ painted_map_id: 'm1' })
    expect(taskMapColumn(null)).toEqual({ painted_map_id: null })
  })

  it('a change is a different map, a new map or a map taken off', () => {
    expect(taskMapChanged(null, null)).toBe(false)
    expect(taskMapChanged({ id: 'm1', name: null }, { id: 'm1', name: 'Read since', withPlace: true })).toBe(false)
    expect(taskMapChanged({ id: 'm1', name: null }, { id: 'm2', name: null })).toBe(true)
    expect(taskMapChanged(null, { id: 'm1', name: null })).toBe(true)
    expect(taskMapChanged({ id: 'm1', name: null }, null)).toBe(true)
  })
})

describe('mapsForTask', () => {
  const NEAR = whole('near', 'The way in for deliveries', '2026-11-10T15:00:00Z', [[29.548, -98.29], [29.551, -98.287]], 3)
  const FAR = whole('far', 'Across town', '2026-11-14T15:00:00Z', [[29.7, -98.4], [29.71, -98.4]])
  const OLD = whole('old', 'The old drive', '2026-11-01T15:00:00Z', [[29.5512, -98.2871], [29.552, -98.286]])
  const EMPTY = whole('empty', 'Nothing yet', '2026-11-15T15:00:00Z', [])

  it('with no place the newest come first, and a map with nothing on it is left out', () => {
    expect(mapsForTask(null, [NEAR, FAR, OLD, EMPTY]).map((o) => o.id)).toEqual(['far', 'near', 'old'])
    expect(mapsForTask(null, [NEAR])[0]?.near).toBeNull()
  })

  it('with a place the nearest come first, and a far map is still offered with its distance', () => {
    const offers = mapsForTask({ lat: 29.551, lng: -98.287 }, [FAR, OLD, NEAR])
    expect(offers.map((o) => o.id)).toEqual(['near', 'old', 'far'])
    expect(offers[0]?.near).toBe('Reaches this place')
    expect(offers[2]?.near).toMatch(/ mi from the place$/)
  })

  it('each offer says its length, its places and where it hangs', () => {
    const [offer] = mapsForTask(null, [NEAR], () => 'J523 · Mission Flats')
    expect(offer).toMatchObject({ name: 'The way in for deliveries', summary: 'about 830 ft · 3 places', where: 'J523 · Mission Flats' })
    expect(taskMapOfferWords(offer!)).toBe('about 830 ft · 3 places · J523 · Mission Flats')
  })

  it('find narrows by the map\'s name or by its job, whatever the case', () => {
    const whereOf = (id: string) => (id === 'far' ? 'J523 · Mission Flats' : null)
    expect(mapsForTask(null, [NEAR, FAR, OLD], whereOf, 'DRIVE').map((o) => o.id)).toEqual(['old'])
    expect(mapsForTask(null, [NEAR, FAR, OLD], whereOf, 'mission').map((o) => o.id)).toEqual(['far'])
    expect(mapsForTask(null, [NEAR, FAR, OLD], whereOf, 'zzz')).toEqual([])
  })

  it('the list stops at its cap', () => {
    const many = Array.from({ length: 40 }, (_, i) => whole(`m${i}`, `Map ${i}`, `2026-11-${String((i % 28) + 1).padStart(2, '0')}T15:00:00Z`, [[29.5, -98.3], [29.51, -98.3]]))
    expect(mapsForTask(null, many)).toHaveLength(30)
    expect(mapsForTask(null, many, () => null, '', 5)).toHaveLength(5)
  })

  it('past a mile the words are a distance, not a way in', () => {
    expect(taskMapNearWords(5)).toBe('Reaches this place')
    expect(taskMapNearWords(40)).toMatch(/^Comes within /)
    expect(taskMapNearWords(5000)).toMatch(/ from the place$/)
  })
})

describe('a map painted from the task', () => {
  it('starts with the task\'s words as its name, without the link marks, cut to a map\'s name', () => {
    expect(taskMapNewName('Dig the trench from the meter to the house')).toBe('Dig the trench from the meter to the house')
    expect(taskMapNewName('Read [1] then run the camera {{2:down the main}}')).toBe('Read then run the camera down the main')
    expect(taskMapNewName('x'.repeat(90))).toHaveLength(60)
  })

  it('a task with no words yet still gives the map a name', () => {
    expect(taskMapNewName('')).toBe('A map for a task')
    expect(taskMapNewName('  [1] ')).toBe('A map for a task')
    expect(taskMapNewName(null)).toBe('A map for a task')
  })

  it('what was saved goes on the task, and nothing saved or an empty map does not', () => {
    expect(taskMapFromPainted({ map: { id: 'm1', name: 'The trench' }, lines: [{}], places: [] })).toEqual({ id: 'm1', name: 'The trench' })
    expect(taskMapFromPainted({ map: { id: 'm1', name: ' ' }, lines: [], places: [{}] })).toEqual({ id: 'm1', name: 'A painted map' })
    expect(taskMapFromPainted({ map: { id: 'm1', name: 'The trench' }, lines: [], places: [] })).toBeNull()
    expect(taskMapFromPainted(null)).toBeNull()
  })
})

describe('sentenceWithMap', () => {
  it('the first sentence says the task comes with a map, and the rest stands', () => {
    expect(sentenceWithMap('Marcus gets it today. It stays until it is done.', true)).toBe('Marcus gets it today, with a map. It stays until it is done.')
  })

  it('with no map the sentence is untouched, and a sentence with no full stop is left alone', () => {
    expect(sentenceWithMap('Marcus gets it today.', false)).toBe('Marcus gets it today.')
    expect(sentenceWithMap('Type the task first', true)).toBe('Type the task first')
  })
})

describe('the words', () => {
  it('the press and the window read as the design has them', () => {
    expect(TASK_MAP_PICK_WORDS.press).toBe('Map')
    expect(TASK_MAP_PICK_WORDS.head).toBe('A map for this task')
  })
})
