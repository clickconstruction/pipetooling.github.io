/**
 * The way to a task's place (punch list #345, step 5): which painted maps are offered for a place,
 * what the card says about the way, and where Directions goes. Made-up points near a made-up site.
 */
import { describe, expect, it } from 'vitest'
import type { PaintedLine, PaintedPlace } from '../paintedMap/paintedMap'
import { taskPlaceColumns, taskPlaceDraft, taskPlaceDraftChanged, taskPlaceFromRow, TASK_PLACE_SELECT } from './taskPlace'
import { mapNearMeters, taskPlaceWayStart, taskPlaceWayWords, wayNearWords, waysNearPlace, TASK_PLACE_WAY_OFFER_MAX } from './taskPlaceWay'

const STUB = { lat: 29.551, lng: -98.287 }
// About 111 m to a thousandth of a degree of latitude here, about 97 m of longitude.
const line = (points: Array<[number, number]>, lengthM = 250, over: Partial<PaintedLine> = {}) =>
  ({ id: 'l', mapId: 'm', label: '', how: 'drawn', points: points.map(([lat, lng]) => ({ lat, lng })), poorParts: [], fixedByHand: false, lengthM, marginM: null, measuredFt: null, measuredHow: null, madeBy: null, madeAt: '2026-11-13T15:00:00Z', ...over }) as PaintedLine
const place = (lat: number, lng: number, name = 'Gate'): PaintedPlace => ({ id: `p-${name}`, mapId: 'm', name, words: '', lat, lng, accuracyM: null, photoPath: null, setBy: null, setAt: '2026-11-13T15:00:00Z' })
const whole = (id: string, name: string, lines: PaintedLine[], places: PaintedPlace[] = []) => ({ map: { id, name }, lines, places })

describe('how near a map comes to a place', () => {
  it('is the nearest spot on a line, not its nearest corner', () => {
    // A long straight leg passes 0.0001 of a degree north of the stub. Both corners are 0.01 of a degree away.
    const passing = whole('m1', 'Passing', [line([[29.5511, -98.297], [29.5511, -98.277]])])
    const near = mapNearMeters(STUB, passing)
    expect(near).not.toBeNull()
    expect(near as number).toBeGreaterThan(8)
    expect(near as number).toBeLessThan(14)
  })

  it('counts a place on the map too, and an empty map comes near nothing', () => {
    expect(mapNearMeters(STUB, whole('m2', 'Dots', [], [place(29.551, -98.287)]))).toBe(0)
    expect(mapNearMeters(STUB, whole('m3', 'Empty', []))).toBeNull()
  })

  it('says a map reaches the place inside what a phone can tell apart, else how near it comes', () => {
    expect(wayNearWords(0)).toBe('Reaches this place')
    expect(wayNearWords(9)).toBe('Reaches this place')
    expect(wayNearWords(36.6)).toBe('Comes within 120 ft')
    expect(wayNearWords(800)).toBe('Comes within 0.5 mi')
  })
})

describe('the maps offered for a place', () => {
  const ending = whole('end', 'The way in for deliveries', [line([[29.548, -98.29], [29.551, -98.287]], 253)], [place(29.548, -98.29), place(29.55, -98.288, 'Yard'), place(29.551, -98.287, 'Stub')])
  const nearby = whole('near', 'Lift station route', [line([[29.553, -98.287], [29.556, -98.287]], 333)])
  const far = whole('far', 'Across town', [line([[29.7, -98.4], [29.71, -98.4]], 1100)])
  const empty = whole('empty', 'Nothing on it', [])

  it('offers the maps within a mile, nearest first, each with its length and how near it comes', () => {
    expect(waysNearPlace(STUB, [far, nearby, empty, ending])).toEqual([
      { id: 'end', name: 'The way in for deliveries', summary: 'about 830 ft · 3 places', nearM: 0, near: 'Reaches this place' },
      expect.objectContaining({ id: 'near', name: 'Lift station route', summary: 'about 1,100 ft', near: 'Comes within 730 ft' }),
    ])
  })

  it('leaves out a map across town and a map with nothing on it', () => {
    const ids = waysNearPlace(STUB, [far, empty]).map((w) => w.id)
    expect(ids).toEqual([])
  })

  it('offers a handful at most, and a name breaks a tie', () => {
    const many = ['d', 'b', 'a', 'c', 'g', 'f', 'e', 'h'].map((n) => whole(n, `Map ${n}`, [], [place(29.551, -98.287)]))
    const offered = waysNearPlace(STUB, many)
    expect(offered).toHaveLength(TASK_PLACE_WAY_OFFER_MAX)
    expect(offered.map((w) => w.name)).toEqual(['Map a', 'Map b', 'Map c', 'Map d', 'Map e', 'Map f'])
  })

  it('gives a map nobody named a plain name', () => {
    expect(waysNearPlace(STUB, [whole('x', '  ', [], [place(29.551, -98.287)])])[0]?.name).toBe('A painted map')
  })
})

describe('what the card says, and where Directions goes', () => {
  it('names the map and its length', () => {
    expect(taskPlaceWayWords('The way in for deliveries', [line([[29.548, -98.29], [29.551, -98.287]], 253)])).toBe('The way in is painted: The way in for deliveries, about 830 ft.')
    expect(taskPlaceWayWords('Three dots', [])).toBe('The way in is painted: Three dots.')
    expect(taskPlaceWayWords('', [])).toBe('The way in is painted: A painted map.')
  })

  it('a typed length is the one it says', () => {
    expect(taskPlaceWayWords('Trench', [line([[29.548, -98.29], [29.551, -98.287]], 253, { measuredFt: 612, measuredHow: 'wheel' })])).toBe('The way in is painted: Trench, about 610 ft.')
  })

  it('Directions goes to the first point of the oldest line, or the first place of a map with no line', () => {
    const later = line([[29.56, -98.28], [29.561, -98.28]], 100, { madeAt: '2026-11-14T15:00:00Z' })
    const first = line([[29.548, -98.29], [29.551, -98.287]], 253)
    expect(taskPlaceWayStart([later, first], [])).toEqual({ lat: 29.548, lng: -98.29 })
    expect(taskPlaceWayStart([], [place(29.55, -98.288)])).toEqual({ lat: 29.55, lng: -98.288 })
    expect(taskPlaceWayStart([], [])).toBeNull()
  })
})

describe('the map rides with the place', () => {
  const ROW = { place_name: 'Water stub', place_lat: 29.551, place_lng: -98.287, place_accuracy_m: null, place_set_by: 'u1', place_set_at: '2026-11-15T15:00:00Z' }

  it('a read asks for the pointer and a row hands it to the place', () => {
    expect(TASK_PLACE_SELECT.split(',')).toContain('painted_map_id')
    expect(taskPlaceFromRow({ ...ROW, painted_map_id: 'map-1' })?.mapId).toBe('map-1')
    expect(taskPlaceFromRow({ ...ROW, painted_map_id: null })?.mapId).toBeNull()
    expect(taskPlaceFromRow(ROW)?.mapId).toBeNull()
  })

  it('a save writes the pointer with the place, and null with no map or no place', () => {
    expect(taskPlaceColumns({ lat: 29.551, lng: -98.287, name: 'Water stub', mapId: 'map-1' }, 'u1', '2026-11-15T15:00:00Z').painted_map_id).toBe('map-1')
    expect(taskPlaceColumns({ lat: 29.551, lng: -98.287, name: 'Water stub' }, 'u1', '2026-11-15T15:00:00Z').painted_map_id).toBeNull()
    expect(taskPlaceColumns({ lat: 29.551, lng: -98.287, name: 'Water stub', mapId: '  ' }, 'u1', '2026-11-15T15:00:00Z').painted_map_id).toBeNull()
    expect(taskPlaceColumns(null, 'u1', '2026-11-15T15:00:00Z').painted_map_id).toBeNull()
  })

  it('the Edit window gets the pointer back, and a changed way is a changed place', () => {
    const draft = taskPlaceDraft(taskPlaceFromRow({ ...ROW, painted_map_id: 'map-1' }))
    expect(draft?.mapId).toBe('map-1')
    expect(taskPlaceDraftChanged(draft, draft ? { ...draft } : null)).toBe(false)
    expect(taskPlaceDraftChanged(draft, draft ? { ...draft, mapId: 'map-2' } : null)).toBe(true)
    expect(taskPlaceDraftChanged(draft, draft ? { ...draft, mapId: null } : null)).toBe(true)
    // A name known only to the window is not a change.
    expect(taskPlaceDraftChanged(draft, draft ? { ...draft, mapName: 'The way in' } : null)).toBe(false)
    // A draft from before the pointer and a draft with none are the same place.
    expect(taskPlaceDraftChanged({ lat: 1, lng: 2, name: 'A', accuracyM: null }, { lat: 1, lng: 2, name: 'A', accuracyM: null, mapId: null })).toBe(false)
  })
})
