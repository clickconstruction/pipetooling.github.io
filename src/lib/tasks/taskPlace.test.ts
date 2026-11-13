/**
 * A task's place (punch list #328, PR 1): what counts as a place, what is written, which places are
 * offered again, and the words for how far, which way and how sure.
 */
import { describe, expect, it } from 'vitest'
import { directionsUrlForPoint } from '../directionsUrl'
import {
  TASK_PLACE_UNNAMED,
  cleanTaskPlaceName,
  isPoorTaskPlaceFix,
  isTaskPlacePoint,
  matchingTaskPlace,
  recentTaskPlaces,
  taskPlaceAccuracyWords,
  taskPlaceColumns,
  taskPlaceDirection,
  taskPlaceDraft,
  taskPlaceDraftChanged,
  taskPlaceSheetAccuracy,
  taskPlaceSheetStart,
  taskPlaceDistanceWords,
  taskPlaceDots,
  taskPlaceFixWords,
  taskPlaceFromRow,
  taskPlaceHowFarWords,
  taskPlaceNoFixWords,
  taskPlacedByWords,
  tasksWithoutPlaceWords,
  type TaskPlace,
} from './taskPlace'

const HERE = { lat: 29.5, lng: -98.3 }
const row = (over: Record<string, unknown> = {}) => ({
  place_name: 'Pump house',
  place_lat: 29.5512,
  place_lng: -98.2874,
  place_accuracy_m: 6,
  place_set_by: 'user-rosa',
  place_set_at: '2026-11-03T15:00:00Z',
  ...over,
})

describe('a place is whole or absent', () => {
  it('takes two finite numbers on the globe', () => {
    expect(isTaskPlacePoint(29.5512, -98.2874)).toBe(true)
    expect(isTaskPlacePoint(-90, 180)).toBe(true)
  })

  it('refuses half a point, a string, a number off the globe and the 0,0 of a broken reading', () => {
    expect(isTaskPlacePoint(29.5, null)).toBe(false)
    expect(isTaskPlacePoint(undefined, -98.2)).toBe(false)
    expect(isTaskPlacePoint('29.5', '-98.2')).toBe(false)
    expect(isTaskPlacePoint(91, 0.5)).toBe(false)
    expect(isTaskPlacePoint(29.5, -181)).toBe(false)
    expect(isTaskPlacePoint(Number.NaN, 1)).toBe(false)
    expect(isTaskPlacePoint(0, 0)).toBe(false)
  })

  it('reads a row into a place, and a row with no point into nothing', () => {
    expect(taskPlaceFromRow(row())).toEqual({ name: 'Pump house', lat: 29.5512, lng: -98.2874, accuracyM: 6, setBy: 'user-rosa', setAt: '2026-11-03T15:00:00Z' })
    expect(taskPlaceFromRow(row({ place_lat: null }))).toBeNull()
    expect(taskPlaceFromRow({})).toBeNull()
    expect(taskPlaceFromRow(null)).toBeNull()
  })

  it('a place nobody named still reads, under a plain name, and a dragged map has no margin', () => {
    const p = taskPlaceFromRow(row({ place_name: '  ', place_accuracy_m: null }))
    expect(p?.name).toBe(TASK_PLACE_UNNAMED)
    expect(p?.accuracyM).toBeNull()
  })

  it('cleans a name to one short line', () => {
    expect(cleanTaskPlaceName('  Pump \n house  ')).toBe('Pump house')
    expect(cleanTaskPlaceName('x'.repeat(60))).toHaveLength(40)
    expect(cleanTaskPlaceName(null)).toBe('')
  })
})

describe('what a save writes', () => {
  it('a place writes all six columns, with the margin as whole metres', () => {
    expect(taskPlaceColumns({ lat: 29.5512, lng: -98.2874, name: ' Pump house ', accuracyM: 6.4 }, 'user-rosa', '2026-11-12T18:00:00Z')).toEqual({
      place_name: 'Pump house',
      place_lat: 29.5512,
      place_lng: -98.2874,
      place_accuracy_m: 6,
      place_set_by: 'user-rosa',
      place_set_at: '2026-11-12T18:00:00Z',
    })
  })

  it('no place, or half of one, writes six nulls, so a name is never left without its point', () => {
    const none = { place_name: null, place_lat: null, place_lng: null, place_accuracy_m: null, place_set_by: null, place_set_at: null }
    expect(taskPlaceColumns(null, 'user-rosa', '2026-11-12T18:00:00Z')).toEqual(none)
    expect(taskPlaceColumns({ lat: 29.5, lng: Number.NaN, name: 'Gate' }, 'user-rosa', '2026-11-12T18:00:00Z')).toEqual(none)
  })

  it('a dragged map writes no margin, and an empty name writes null', () => {
    const cols = taskPlaceColumns({ lat: 29.5, lng: -98.3, name: '' }, null, '2026-11-12T18:00:00Z')
    expect(cols.place_accuracy_m).toBeNull()
    expect(cols.place_name).toBeNull()
    expect(cols.place_lat).toBe(29.5)
  })
})

describe('the places offered again', () => {
  const rows = [
    row({ place_name: 'Pump house', place_set_at: '2026-11-03T15:00:00Z' }),
    row({ place_name: 'North gate', place_lat: 29.56, place_lng: -98.29, place_set_at: '2026-11-10T15:00:00Z' }),
    row({ place_name: 'pump house', place_lat: 29.5513, place_lng: -98.2875, place_set_at: '2026-11-11T15:00:00Z' }),
    row({ place_name: null, place_lat: 29.57, place_lng: -98.28, place_set_at: '2026-11-12T15:00:00Z' }),
    row({ place_lat: null, place_lng: null, place_name: null, place_accuracy_m: null, place_set_by: null, place_set_at: null }),
  ]

  it('one chip a name, newest first, the newer point winning, and no chip for a place nobody named', () => {
    const offered = recentTaskPlaces(rows)
    expect(offered.map((p) => p.name)).toEqual(['pump house', 'North gate'])
    expect(offered[0]?.lat).toBe(29.5513)
  })

  it('keeps to the limit', () => {
    expect(recentTaskPlaces(rows, 1).map((p) => p.name)).toEqual(['pump house'])
    expect(recentTaskPlaces(rows, 0)).toEqual([])
  })

  it('lights the chip a task already has: the same name within a few yards', () => {
    const offered = recentTaskPlaces(rows)
    const mine = taskPlaceFromRow(row({ place_name: 'Pump House', place_lat: 29.55131, place_lng: -98.28751 }))
    expect(matchingTaskPlace(mine, offered)?.name).toBe('pump house')
    const moved = taskPlaceFromRow(row({ place_name: 'Pump house', place_lat: 29.6, place_lng: -98.2 }))
    expect(matchingTaskPlace(moved, offered)).toBeNull()
    expect(matchingTaskPlace(null, offered)).toBeNull()
  })
})

describe('how far, which way, how sure', () => {
  it('reads feet to the nearest ten across a yard and miles past a fifth of a mile', () => {
    expect(taskPlaceDistanceWords(15.24)).toBe('50 ft')
    expect(taskPlaceDistanceWords(76.2)).toBe('250 ft')
    expect(taskPlaceDistanceWords(152.4)).toBe('500 ft')
    expect(taskPlaceDistanceWords(320)).toBe('1,050 ft')
    expect(taskPlaceDistanceWords(483)).toBe('0.3 mi')
    expect(taskPlaceDistanceWords(19312)).toBe('12 mi')
    expect(taskPlaceDistanceWords(0)).toBe('10 ft')
  })

  it('names the way to the place on each of the eight directions', () => {
    const at = (dLat: number, dLng: number) => taskPlaceDirection(HERE, { lat: HERE.lat + dLat, lng: HERE.lng + dLng })
    expect(at(0.1, 0)).toBe('north')
    expect(at(0.1, 0.1)).toBe('north-east')
    expect(at(0, 0.1)).toBe('east')
    expect(at(-0.1, 0.1)).toBe('south-east')
    expect(at(-0.1, 0)).toBe('south')
    expect(at(-0.1, -0.1)).toBe('south-west')
    expect(at(0, -0.1)).toBe('west')
    expect(at(0.1, -0.1)).toBe('north-west')
  })

  it('says how sure, rounded up so the words never claim more than the phone did', () => {
    expect(taskPlaceAccuracyWords(6)).toBe('within 20 ft')
    expect(taskPlaceAccuracyWords(9)).toBe('within 30 ft')
    expect(taskPlaceAccuracyWords(46)).toBe('within 160 ft')
    expect(taskPlaceAccuracyWords(121)).toBe('within 400 ft')
    expect(taskPlaceAccuracyWords(null)).toBeNull()
    expect(taskPlaceAccuracyWords(-1)).toBeNull()
  })

  it('a wide reading is poor, a missing margin is not', () => {
    expect(isPoorTaskPlaceFix(6)).toBe(false)
    expect(isPoorTaskPlaceFix(46)).toBe(false)
    expect(isPoorTaskPlaceFix(47)).toBe(true)
    expect(isPoorTaskPlaceFix(null)).toBe(false)
  })

  it('the sheet says what the phone found, or asks for the ring on a wide guess', () => {
    expect(taskPlaceFixWords(6)).toEqual({ poor: false, words: 'Found you. Your phone is sure within 20 ft.' })
    expect(taskPlaceFixWords(null)).toEqual({ poor: false, words: 'Found you.' })
    expect(taskPlaceFixWords(121)).toEqual({ poor: true, words: 'Your phone is only sure within 400 ft. Drag the map until the ring is on the spot.' })
  })

  it('answers How far am I? with the distance and the way, and says when the person is there', () => {
    // About 76 m north-east: 54 m north and 54 m east of where the person stands.
    const place = { lat: HERE.lat + 54 / 111195, lng: HERE.lng + 54 / (111195 * Math.cos((HERE.lat * Math.PI) / 180)) }
    expect(taskPlaceHowFarWords({ ...HERE, accuracyM: 9 }, place)).toEqual({ lead: '250 ft north-east of you.', sure: 'Your phone is sure within 30 ft.' })
    expect(taskPlaceHowFarWords(HERE, place)).toEqual({ lead: '250 ft north-east of you.', sure: null })
    expect(taskPlaceHowFarWords(HERE, { lat: HERE.lat + 0.00003, lng: HERE.lng })).toEqual({ lead: 'You are at the place.', sure: null })
  })
})

describe('the dots on a map of tasks', () => {
  const place = (name: string, lat: number): TaskPlace => ({ name, lat, lng: -98.3, accuracyM: null, setBy: null, setAt: null })
  const tasks = [
    { id: 'gate', place: place('North gate', 29.56), overdue: true },
    { id: 'clamps', place: null },
    { id: 'pump', place: place('Pump house', 29.55) },
    { id: 'creek', place: place('Creek crossing', 29.54) },
    { id: 'call', place: null },
  ]

  it('numbers the tasks that have a place in the list order, and counts the rest', () => {
    const { dots, numberById, withoutPlace } = taskPlaceDots(tasks)
    expect(dots.map((d) => [d.number, d.id, d.name, d.overdue])).toEqual([
      [1, 'gate', 'North gate', true],
      [2, 'pump', 'Pump house', false],
      [3, 'creek', 'Creek crossing', false],
    ])
    expect(numberById.get('pump')).toBe(2)
    expect(numberById.has('clamps')).toBe(false)
    expect(withoutPlace).toBe(2)
  })

  it('no task with a place gives no dot, and every task is still counted', () => {
    expect(taskPlaceDots([{ id: 'a', place: null }, { id: 'b', place: null }])).toMatchObject({ dots: [], withoutPlace: 2 })
    expect(taskPlaceDots([])).toMatchObject({ dots: [], withoutPlace: 0 })
  })

  it('says how many tasks the map cannot show, never hides them', () => {
    expect(tasksWithoutPlaceWords(2, 3)).toBe('2 more tasks have no place. They are in the list below.')
    expect(tasksWithoutPlaceWords(1, 3)).toBe('1 more task has no place. It is in the list below.')
    expect(tasksWithoutPlaceWords(4, 0)).toBe('4 tasks have no place. They are in the list below.')
    expect(tasksWithoutPlaceWords(0, 3)).toBeNull()
  })
})

describe('the giver\'s hands (PR 2)', () => {
  it('a saved place comes back as a draft, and a place nobody named comes back with an empty name box', () => {
    expect(taskPlaceDraft(taskPlaceFromRow(row()))).toEqual({ lat: 29.5512, lng: -98.2874, name: 'Pump house', accuracyM: 6 })
    expect(taskPlaceDraft(taskPlaceFromRow(row({ place_name: null })))?.name).toBe('')
    expect(taskPlaceDraft(null)).toBeNull()
  })

  it('knows when the giver changed the place, so an edit to the title leaves who placed it alone', () => {
    const a = { lat: 29.5, lng: -98.3, name: 'Pump house', accuracyM: 6 }
    expect(taskPlaceDraftChanged(a, { ...a })).toBe(false)
    expect(taskPlaceDraftChanged(a, { ...a, name: ' Pump  house ' })).toBe(false)
    expect(taskPlaceDraftChanged(a, { ...a, name: 'Pump shed' })).toBe(true)
    expect(taskPlaceDraftChanged(a, { ...a, lat: 29.5001 })).toBe(true)
    expect(taskPlaceDraftChanged(a, null)).toBe(true)
    expect(taskPlaceDraftChanged(null, a)).toBe(true)
    expect(taskPlaceDraftChanged(null, null)).toBe(false)
  })

  it('keeps the phone\'s margin while the ring sits on the reading, and drops it once the ring is dragged', () => {
    const fix = { ...HERE, accuracyM: 6 }
    expect(taskPlaceSheetAccuracy(fix, HERE)).toBe(6)
    expect(taskPlaceSheetAccuracy(fix, { lat: HERE.lat + 0.00001, lng: HERE.lng })).toBe(6)
    expect(taskPlaceSheetAccuracy(fix, { lat: HERE.lat + 0.0001, lng: HERE.lng })).toBeNull()
    expect(taskPlaceSheetAccuracy(null, HERE)).toBeNull()
    expect(taskPlaceSheetAccuracy({ ...HERE, accuracyM: null }, HERE)).toBeNull()
  })

  it('opens the sheet on the place being moved, else the last place set, else the office', () => {
    const office = { lat: 29.4, lng: -98.5 }
    const last = { lat: 29.56, lng: -98.29 }
    expect(taskPlaceSheetStart(HERE, [last], office)).toEqual(HERE)
    expect(taskPlaceSheetStart(null, [last], office)).toEqual(last)
    expect(taskPlaceSheetStart(null, [], office)).toEqual(office)
    expect(taskPlaceSheetStart(null, [], null)).toBeNull()
  })
})

describe('the doer\'s words (PR 3)', () => {
  it('says who placed it and when, with whatever of the two is known', () => {
    expect(taskPlacedByWords('Rosa', 'Nov 3')).toBe('Placed by Rosa on Nov 3.')
    expect(taskPlacedByWords('Rosa', null)).toBe('Placed by Rosa.')
    expect(taskPlacedByWords(null, 'Nov 3')).toBe('Placed on Nov 3.')
    expect(taskPlacedByWords(' ', '')).toBeNull()
  })

  it('a reading that did not come says what still works', () => {
    expect(taskPlaceNoFixWords('refused')).toBe('Location is off for this app. The map and Directions still work. To see how far you are, allow location in the phone’s settings.')
    expect(taskPlaceNoFixWords('none')).toBe('This device gives no location. The map and Directions still work.')
    expect(taskPlaceNoFixWords('failed')).toBe('Could not find you. Try again in the open, or use Directions.')
  })
})

describe('directions to a point', () => {
  it('routes to the point, six places, and refuses half a point or one off the globe', () => {
    expect(directionsUrlForPoint(29.5512, -98.2874)).toBe('https://www.google.com/maps/dir/?api=1&destination=29.551200,-98.287400')
    expect(directionsUrlForPoint(null, -98.2874)).toBeNull()
    expect(directionsUrlForPoint(95, -98.2874)).toBeNull()
    expect(directionsUrlForPoint(Number.NaN, 1)).toBeNull()
  })
})
