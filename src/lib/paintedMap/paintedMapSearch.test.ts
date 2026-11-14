import { describe, expect, it } from 'vitest'
import { searchDoors } from '../search/doors'
import { paintedMapAskFromSearch, paintedMapDoors, paintedMapLink, paintedMapWhereWords, withoutPaintedMapAsk, PAINT_A_MAP_LINK, type PaintedMapSearchRow } from './paintedMapSearch'

const ID = '11111111-1111-4111-8111-111111111111'
const ROWS: PaintedMapSearchRow[] = [
  { id: ID, name: 'The way in for deliveries', words: 'Start at the truck gate.', jobLabel: 'J523 · Mission Flats', developmentLabel: null, hasHome: true },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Truck route', words: '', jobLabel: null, developmentLabel: 'Dry Creek Ridge', hasHome: true },
  { id: '33333333-3333-4333-8333-333333333333', name: 'Back gate', words: '', jobLabel: null, developmentLabel: null, hasHome: false },
  { id: '44444444-4444-4444-8444-444444444444', name: 'Side door', words: '', jobLabel: null, developmentLabel: null, hasHome: true },
]

describe('what an address asks the painted map host for', () => {
  it('opens the start sheet', () => {
    expect(PAINT_A_MAP_LINK).toBe('/dashboard?paintMap=1')
    expect(paintedMapAskFromSearch(new URLSearchParams('paintMap=1'))).toEqual({ kind: 'start' })
  })
  it('opens one map by its id', () => {
    expect(paintedMapLink(ID)).toBe(`/dashboard?paintedMap=${ID}`)
    expect(paintedMapAskFromSearch(new URLSearchParams(`paintedMap=${ID}`))).toEqual({ kind: 'open', mapId: ID })
  })
  it('asks for nothing with an id that is not an id, or with neither key', () => {
    expect(paintedMapAskFromSearch(new URLSearchParams('paintedMap=../../x'))).toBeNull()
    expect(paintedMapAskFromSearch(new URLSearchParams('tab=stages'))).toBeNull()
  })
  it('takes its keys off the address and leaves the rest', () => {
    expect(withoutPaintedMapAsk(new URLSearchParams(`tab=stages&paintedMap=${ID}&paintMap=1`)).toString()).toBe('tab=stages')
  })
})

describe('a painted map as a door in the search', () => {
  it('says where the map is, when the reader can see where', () => {
    expect(ROWS.map(paintedMapWhereWords)).toEqual(['J523 · Mission Flats', 'Dry Creek Ridge, every lot', 'On no job yet', 'A painted map'])
  })
  it('is one door a map, under Painted maps, opening that map', () => {
    const doors = paintedMapDoors(ROWS)
    expect(doors.map((d) => d.id)).toEqual(ROWS.map((r) => `painted-map:${r.id}`))
    expect(doors[0]).toMatchObject({ kind: 'map', label: 'The way in for deliveries', where: 'J523 · Mission Flats · Start at the truck gate.', to: `/dashboard?paintedMap=${ID}` })
    expect(new Set(doors.map((d) => d.id)).size).toBe(doors.length)
  })
  it('is found by its name, by its words and by its job', () => {
    const doors = paintedMapDoors(ROWS)
    const found = (q: string) => searchDoors(q, doors).flatMap((g) => g.doors.map((d) => d.label))
    expect(found('deliveries')).toEqual(['The way in for deliveries'])
    expect(found('truck gate')).toContain('The way in for deliveries')
    expect(found('mission flats')).toEqual(['The way in for deliveries'])
    expect(found('dry creek')).toEqual(['Truck route'])
    expect(searchDoors('back gate', doors)[0]).toMatchObject({ key: 'map', label: 'Painted maps' })
  })
})
