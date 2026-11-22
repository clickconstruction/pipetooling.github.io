import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PaintedMapAsk } from './paintedMapDoor'

const io = vi.hoisted(() => ({ whole: null as unknown, loadFails: false, saveFails: false, saves: [] as Array<[string, unknown]> }))
vi.mock('./paintedMapIo', () => ({
  loadPaintedMap: async () => (io.loadFails ? { ok: false, error: 'No signal.' } : { ok: true, value: io.whole }),
  savePaintedPlace: async (placeId: string, change: unknown) => {
    io.saves.push([placeId, change])
    return io.saveFails ? { ok: false, error: 'Refused.' } : { ok: true, value: {} }
  },
}))

import { onPaintedMapAsk, onPaintedMapsChanged } from './paintedMapDoor'
import { paintLineForPlace, tiePlaceToNewLine } from './paintedPlaceLineIo'

const asks: PaintedMapAsk[] = []
let changed = 0
const stops: Array<() => void> = []
const listen = () => {
  stops.push(onPaintedMapAsk((a) => asks.push(a)))
  stops.push(onPaintedMapsChanged(() => (changed += 1)))
}
afterEach(() => {
  for (const s of stops.splice(0)) s()
  asks.length = 0
  changed = 0
  io.whole = null
  io.loadFails = false
  io.saveFails = false
  io.saves = []
})

const PLACE = { id: 'p1', name: 'Buried sewer line', lat: 29.5, lng: -98.2 }

describe('tiePlaceToNewLine', () => {
  it('ties the place to the first line of the map just painted, and says the maps changed', async () => {
    listen()
    io.whole = { map: { id: 'm9' }, lines: [{ id: 'l1' }, { id: 'l2' }], places: [] }
    expect(await tiePlaceToNewLine('p1', 'm9')).toBe(true)
    expect(io.saves).toEqual([['p1', { lineId: 'l1' }]])
    expect(changed).toBe(1)
  })
  it('does nothing for a map closed with no line saved, one that is gone, or one that did not load', async () => {
    io.whole = { map: { id: 'm9' }, lines: [], places: [] }
    expect(await tiePlaceToNewLine('p1', 'm9')).toBe(false)
    io.whole = null
    expect(await tiePlaceToNewLine('p1', 'm9')).toBe(false)
    io.loadFails = true
    expect(await tiePlaceToNewLine('p1', 'm9')).toBe(false)
    expect(io.saves).toEqual([])
  })
  it('says no when the place could not be written', async () => {
    io.whole = { map: { id: 'm9' }, lines: [{ id: 'l1' }], places: [] }
    io.saveFails = true
    expect(await tiePlaceToNewLine('p1', 'm9')).toBe(false)
  })
})

describe('paintLineForPlace', () => {
  it('starts a map of its own on the job, named for the place, opening on the place and walking', () => {
    listen()
    expect(paintLineForPlace({ place: PLACE, listId: 'list', jobId: 'j1', jobLabel: 'ZZ Test', address: '1 Made Up Road', first: 'walk' })).toBe(true)
    const ask = asks[0] as Extract<PaintedMapAsk, { kind: 'paint' }>
    expect(ask.kind).toBe('paint')
    expect(ask.start).toMatchObject({ name: 'Buried sewer line', words: '', first: 'walk', home: { jobId: 'j1', developmentId: null, label: 'ZZ Test', address: '1 Made Up Road', center: { lat: 29.5, lng: -98.2 } } })
    expect(ask.start.jobList).toBeUndefined()
  })
  it('when that map closes, ties its line to the place and opens the list again on the place', async () => {
    listen()
    paintLineForPlace({ place: PLACE, listId: 'list', jobId: 'j1', address: '1 Made Up Road', first: 'line' })
    const ask = asks[0] as Extract<PaintedMapAsk, { kind: 'paint' }>
    io.whole = { map: { id: ask.start.id }, lines: [{ id: 'l1' }], places: [] }
    ask.onClosed?.()
    await vi.waitFor(() => expect(asks).toHaveLength(2))
    expect(io.saves).toEqual([['p1', { lineId: 'l1' }]])
    expect(asks[1]).toEqual({ kind: 'open', mapId: 'list', address: '1 Made Up Road', place: 'p1' })
  })
  it('opens the list again all the same when no line was saved', async () => {
    listen()
    paintLineForPlace({ place: PLACE, listId: 'list', jobId: 'j1', first: 'walk' })
    const ask = asks[0] as Extract<PaintedMapAsk, { kind: 'paint' }>
    io.whole = { map: { id: ask.start.id }, lines: [], places: [] }
    ask.onClosed?.()
    await vi.waitFor(() => expect(asks).toHaveLength(2))
    expect(io.saves).toEqual([])
    expect(asks[1]).toMatchObject({ kind: 'open', mapId: 'list', place: 'p1' })
  })
  it('says no when no map window is listening', () => {
    expect(paintLineForPlace({ place: PLACE, listId: 'list', jobId: 'j1', first: 'walk' })).toBe(false)
  })
})
