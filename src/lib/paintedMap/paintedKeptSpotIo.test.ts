// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { KeptPhotosStore } from '../offline/keptPhotos'
import type { KeptSpot } from './paintedKeptSpot'

const io = vi.hoisted(() => ({
  calls: [] as Array<{ fn: string; args: unknown[] }>,
  map: null as string | null,
  upload: null as string | null,
  place: null as string | null,
}))
vi.mock('./paintedMapIo', () => ({
  createPaintedMap: async (input: unknown) => {
    io.calls.push({ fn: 'createPaintedMap', args: [input] })
    return io.map ? { ok: false, error: io.map } : { ok: true, value: {} }
  },
  uploadPaintedPlacePhoto: async (mapId: string, photoId: string) => {
    io.calls.push({ fn: 'uploadPaintedPlacePhoto', args: [mapId, photoId] })
    return io.upload ? { ok: false, error: io.upload } : { ok: true, value: `${mapId}/${photoId}.jpg` }
  },
  addPaintedPlace: async (mapId: string, place: unknown, by: string) => {
    io.calls.push({ fn: 'addPaintedPlace', args: [mapId, place, by] })
    return io.place ? { ok: false, error: io.place } : { ok: true, value: {} }
  },
}))
vi.mock('../offline/keptPhotos', () => ({ keptPhotos: {} }))

import { onPaintedMapsChanged } from './paintedMapDoor'
import { keepSpot, readKeptSpots, sendKeptSpot, sendKeptSpots } from './paintedKeptSpotIo'

const M = '11111111-1111-4111-8111-111111111111'
const NOW = Date.now()
const spot = (over: Partial<KeptSpot> = {}): KeptSpot => ({
  id: 'p1',
  userId: 'u1',
  savedAtMs: NOW - 60_000,
  map: { id: M, jobId: 'j1', developmentId: null, name: 'Places on this job', words: '', jobList: true, saved: false },
  place: { name: 'Cleanout', words: '4 ft off the front walk.', kind: 'cleanout', lat: 29.5, lng: -98.2, accuracyM: 6 },
  photoId: 'ph1',
  moreIds: [],
  ...over,
})
/** The phone's photo store, stood in for. `full` refuses the next keep. */
const makeStore = () => {
  const held = new Map<string, Blob>()
  const state = { full: false }
  const store: KeptPhotosStore = {
    keep: async (id, blob) => {
      if (state.full) return false
      held.set(id, blob)
      return true
    },
    read: async (id) => held.get(id) ?? null,
    drop: async (ids) => {
      for (const id of ids) held.delete(id)
    },
    sweep: async () => undefined,
  }
  return { store, held, state }
}
const names = () => io.calls.map((c) => c.fn)

afterEach(() => {
  window.localStorage.clear()
  io.calls = []
  io.map = null
  io.upload = null
  io.place = null
})

describe('keeping a place on the phone', () => {
  it('holds the photo’s bytes and the record, and reads the record back', async () => {
    const { store, held } = makeStore()
    expect(await keepSpot(spot(), [{ id: 'ph1', blob: new Blob(['x']) }], store)).toBe(true)
    expect([...held.keys()]).toEqual(['ph1'])
    expect(readKeptSpots('u1', NOW, store)).toEqual([spot()])
    expect(readKeptSpots('u2', NOW, store)).toEqual([])
  })
  it('keeps a second place beside the first, and the same place once', async () => {
    const { store } = makeStore()
    await keepSpot(spot(), [], store)
    await keepSpot(spot({ id: 'p2', savedAtMs: NOW - 1000 }), [], store)
    await keepSpot(spot(), [], store)
    expect(readKeptSpots('u1', NOW, store).map((s) => s.id).sort()).toEqual(['p1', 'p2'])
  })
  it('says no and leaves nothing behind when the phone cannot hold a photo', async () => {
    const { store, held, state } = makeStore()
    state.full = true
    expect(await keepSpot(spot(), [{ id: 'ph1', blob: new Blob(['x']) }], store)).toBe(false)
    expect(held.size).toBe(0)
    expect(readKeptSpots('u1', NOW, store)).toEqual([])
  })
  it('drops a place more than seven days old when it is read, with its bytes', async () => {
    const { store, held } = makeStore()
    const old = spot({ id: 'old', savedAtMs: NOW - 8 * 24 * 60 * 60 * 1000, photoId: 'old-ph' })
    held.set('old-ph', new Blob(['x']))
    window.localStorage.setItem('pt.paintedMap.keptSpots.u1', JSON.stringify([old, spot()]))
    expect(readKeptSpots('u1', NOW, store).map((s) => s.id)).toEqual(['p1'])
    await Promise.resolve()
    expect(held.has('old-ph')).toBe(false)
    expect(JSON.parse(window.localStorage.getItem('pt.paintedMap.keptSpots.u1') ?? '[]')).toHaveLength(1)
  })
})

describe('sending a kept place', () => {
  it('makes the job’s list, sends the photo, then writes the place under the id made on the phone', async () => {
    const { store, held } = makeStore()
    held.set('ph1', new Blob(['x']))
    expect(await sendKeptSpot(spot(), store)).toEqual({ ok: true })
    expect(names()).toEqual(['createPaintedMap', 'uploadPaintedPlacePhoto', 'addPaintedPlace'])
    expect(io.calls[0]!.args[0]).toMatchObject({ id: M, name: 'Places on this job', jobId: 'j1', jobList: true, by: 'u1' })
    expect(io.calls[2]!.args).toEqual([M, { id: 'p1', lat: 29.5, lng: -98.2, name: 'Cleanout', words: '4 ft off the front walk.', accuracyM: 6, photoPath: `${M}/ph1.jpg`, kind: 'cleanout' }, 'u1'])
  })
  it('makes no map for a place on a list that was already saved', async () => {
    const { store } = makeStore()
    await sendKeptSpot(spot({ map: { ...spot().map, saved: true }, photoId: null }), store)
    expect(names()).toEqual(['addPaintedPlace'])
  })
  it('takes a map, bytes and a row already there for an earlier try that landed', async () => {
    const { store, held } = makeStore()
    held.set('ph1', new Blob(['x']))
    io.map = 'duplicate key value violates unique constraint "painted_maps_pkey"'
    io.upload = 'The resource already exists'
    io.place = 'duplicate key value violates unique constraint "painted_map_places_pkey"'
    expect(await sendKeptSpot(spot(), store)).toEqual({ ok: true })
    expect((io.calls[2]!.args[1] as { photoPath: string }).photoPath).toBe(`${M}/ph1.jpg`)
  })
  it('sends the place with no photo when its bytes are gone from the phone', async () => {
    const { store } = makeStore()
    expect(await sendKeptSpot(spot(), store)).toEqual({ ok: true })
    expect(names()).toEqual(['createPaintedMap', 'addPaintedPlace'])
    expect((io.calls[1]!.args[1] as { photoPath: string | null }).photoPath).toBeNull()
  })
  it('sends the photos after the first, as the place’s other photos', async () => {
    const { store, held } = makeStore()
    for (const id of ['ph1', 'ph2', 'ph3']) held.set(id, new Blob(['x']))
    await sendKeptSpot(spot({ moreIds: ['ph2', 'ph3'] }), store)
    const place = io.calls.find((c) => c.fn === 'addPaintedPlace')!.args[1] as { morePhotos: Array<{ path: string; by: string }> }
    expect(place.morePhotos.map((m) => m.path)).toEqual([`${M}/ph2.jpg`, `${M}/ph3.jpg`])
    expect(place.morePhotos.every((m) => m.by === 'u1')).toBe(true)
  })
  it('stops and says why when a step is refused', async () => {
    const { store, held } = makeStore()
    held.set('ph1', new Blob(['x']))
    io.upload = 'Failed to fetch'
    expect(await sendKeptSpot(spot(), store)).toEqual({ ok: false, error: 'Failed to fetch' })
    expect(names()).not.toContain('addPaintedPlace')
  })
})

describe('sending every place that waits', () => {
  it('sends them oldest first, takes each off the phone with its bytes, and says the maps changed once', async () => {
    const { store, held } = makeStore()
    let changed = 0
    const stop = onPaintedMapsChanged(() => (changed += 1))
    try {
      await keepSpot(spot({ id: 'second', savedAtMs: NOW - 1000, photoId: 'b' }), [{ id: 'b', blob: new Blob(['x']) }], store)
      await keepSpot(spot({ id: 'first', savedAtMs: NOW - 9000, photoId: 'a' }), [{ id: 'a', blob: new Blob(['x']) }], store)
      expect(await sendKeptSpots('u1', store)).toEqual({ sent: 2, waiting: 0, error: null })
      expect(io.calls.filter((c) => c.fn === 'addPaintedPlace').map((c) => (c.args[1] as { id: string }).id)).toEqual(['first', 'second'])
      expect(readKeptSpots('u1', NOW, store)).toEqual([])
      await Promise.resolve()
      expect(held.size).toBe(0)
      expect(changed).toBe(1)
    } finally {
      stop()
    }
  })
  it('stops at the first that does not go, and keeps it and the rest', async () => {
    const { store } = makeStore()
    await keepSpot(spot({ id: 'first', savedAtMs: NOW - 9000, photoId: null }), [], store)
    await keepSpot(spot({ id: 'second', savedAtMs: NOW - 1000, photoId: null }), [], store)
    io.place = 'Failed to fetch'
    expect(await sendKeptSpots('u1', store)).toEqual({ sent: 0, waiting: 2, error: 'Failed to fetch' })
    expect(io.calls.filter((c) => c.fn === 'addPaintedPlace')).toHaveLength(1)
    expect(readKeptSpots('u1', NOW, store).map((s) => s.id)).toEqual(['first', 'second'])
  })
  it('does nothing with nothing waiting', async () => {
    const { store } = makeStore()
    expect(await sendKeptSpots('u1', store)).toEqual({ sent: 0, waiting: 0, error: null })
    expect(io.calls).toEqual([])
  })
})
