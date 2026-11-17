import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))
vi.mock('../../lib/materials/onSiteStore', () => ({ newId: () => 'made-id', loadJob: vi.fn() }))
vi.mock('../../lib/paintedMap/paintedMapIo', () => ({ loadPaintedMap: vi.fn() }))

import type { Place } from '../../lib/materials/onSite'
import { openPlaceWay, paintPlaceWay, takeOffPlaceWay } from './placeWayPaint'

// Every name here is made up.
const place: Place = { id: 'yard', jobId: 'j1', name: 'Laydown yard', createdAt: '' }
const home = { jobId: 'j1', label: 'ZZ Test Job', address: '100 Made-up Way', center: null }
const whole = (lines: number) => ({ ok: true as const, value: { map: { id: 'way-1', name: 'The way to Laydown yard' }, lines: Array.from({ length: lines }, () => ({})), places: [] } })

/** A painting window that opens and hands back its close. */
function paintStub(opens = true) {
  const state: { start: unknown; close: (() => void) | null } = { start: null, close: null }
  const paint = vi.fn((start: unknown, onClosed?: () => void) => { state.start = start; state.close = onClosed ?? null; return opens })
  return { state, paint }
}

describe('paintPlaceWay', () => {
  it('opens the painting window on a new map on the job, named for the place', () => {
    const { state, paint } = paintStub()
    paintPlaceWay(place, home, vi.fn(), { paint: paint as never, loadMap: vi.fn() as never, setWay: vi.fn(), makeId: () => 'way-1' })
    expect(state.start).toEqual({ id: 'way-1', name: 'The way to Laydown yard', words: '', first: 'line', home })
  })

  it('a way that was saved goes onto the place, and the person is told', async () => {
    const { state, paint } = paintStub()
    const say = vi.fn()
    const setWay = vi.fn(async () => {})
    paintPlaceWay(place, home, say, { paint: paint as never, loadMap: vi.fn(async () => whole(1)) as never, setWay, makeId: () => 'way-1' })
    state.close?.()
    await vi.waitFor(() => expect(say).toHaveBeenCalled())
    expect(setWay).toHaveBeenCalledWith('j1', 'yard', 'way-1')
    expect(say).toHaveBeenCalledWith('The way to Laydown yard is saved. A person who looks for a box there can open it.', 'success')
  })

  it('a window closed with nothing painted changes nothing', async () => {
    const { state, paint } = paintStub()
    const say = vi.fn()
    const setWay = vi.fn()
    paintPlaceWay(place, home, say, { paint: paint as never, loadMap: vi.fn(async () => ({ ok: true as const, value: null })) as never, setWay, makeId: () => 'way-1' })
    state.close?.()
    await vi.waitFor(() => expect(say).toHaveBeenCalledWith('Nothing was painted, so Laydown yard has no way yet.', 'info'))
    expect(setWay).not.toHaveBeenCalled()
  })

  it('a map saved that the place refuses says both halves, with the reason', async () => {
    const { state, paint } = paintStub()
    const say = vi.fn()
    paintPlaceWay(place, home, say, { paint: paint as never, loadMap: vi.fn(async () => whole(2)) as never, setWay: vi.fn(async () => { throw { message: 'The way to a place is a map of its own job or of its development.', code: 'P0PWY' } }), makeId: () => 'way-1' })
    state.close?.()
    await vi.waitFor(() => expect(say).toHaveBeenCalledWith('The map is saved, but it did not go onto Laydown yard: The way to a place is a map of its own job or of its development.', 'error'))
  })

  it('says so when no painting window is listening', () => {
    const { paint } = paintStub(false)
    const say = vi.fn()
    paintPlaceWay(place, home, say, { paint: paint as never, loadMap: vi.fn() as never, setWay: vi.fn(), makeId: () => 'way-1' })
    expect(say).toHaveBeenCalledWith('The painting window did not open here. Open the job’s materials from the app and try again.', 'error')
  })
})

describe('openPlaceWay and takeOffPlaceWay', () => {
  it('a place with no way opens nothing', () => {
    const say = vi.fn()
    openPlaceWay(place, null, say)
    expect(say).not.toHaveBeenCalled()
  })

  it('taking the way off keeps the map and says so, or names why it failed', async () => {
    const say = vi.fn()
    await takeOffPlaceWay({ ...place, wayMapId: 'way-1' }, 'j1', say, vi.fn(async () => {}))
    expect(say).toHaveBeenCalledWith('Laydown yard has no way now. The map itself is kept.', 'info')
    await takeOffPlaceWay({ ...place, wayMapId: 'way-1' }, 'j1', say, vi.fn(async () => { throw new Error('no signal') }))
    expect(say).toHaveBeenLastCalledWith('The way did not come off Laydown yard: no signal', 'error')
  })
})
