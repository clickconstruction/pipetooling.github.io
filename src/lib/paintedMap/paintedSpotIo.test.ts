// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PaintedMapAsk } from './paintedMapDoor'

const io = vi.hoisted(() => ({ answer: { ok: true, value: [] as unknown[] } as { ok: true; value: unknown[] } | { ok: false; error: string }, asked: [] as unknown[] }))
vi.mock('./paintedMapIo', () => ({
  loadPaintedMapsFor: async (home: unknown) => {
    io.asked.push(home)
    return io.answer
  },
}))

import { onPaintedMapAsk } from './paintedMapDoor'
import { openSpotOnJob, spotFileFromPreview } from './paintedSpotIo'

const file = new File(['x'], 'spot.jpg', { type: 'image/jpeg' })
const spot = () => ({ file, reading: Promise.resolve({ ok: false as const, why: 'none' as const }), takenMs: null })
const map = (id: string, jobList: boolean, createdAt: string) => ({ map: { id, name: jobList ? 'Places on this job' : 'The way in', words: '', jobId: 'j1', developmentId: null, jobList, createdBy: 'u1', createdAt }, lines: [], places: [] })
const JOB = { jobId: 'j1', label: 'ZZ Test 4127', address: '418 Made Up Run' }

const asks: PaintedMapAsk[] = []
let stop: (() => void) | null = null
afterEach(() => {
  stop?.()
  stop = null
  asks.length = 0
  io.answer = { ok: true, value: [] }
  io.asked = []
  vi.unstubAllGlobals()
})
const listen = () => {
  stop = onPaintedMapAsk((a) => asks.push(a))
}

describe('openSpotOnJob', () => {
  it('opens the job’s list already adding a place, the older of two', async () => {
    listen()
    io.answer = { ok: true, value: [map('way', false, '2026-11-13T15:00:00Z'), map('newer', true, '2026-11-20T15:00:00Z'), map('older', true, '2026-11-18T15:00:00Z')] }
    const s = spot()
    expect(await openSpotOnJob(JOB, s)).toEqual({ ok: true })
    expect(io.asked).toEqual([{ jobId: 'j1' }])
    expect(asks).toEqual([{ kind: 'open', mapId: 'older', address: '418 Made Up Run', add: 'place', spot: s }])
  })

  it('starts a list that is saved with this first place when the job has none', async () => {
    listen()
    io.answer = { ok: true, value: [map('way', false, '2026-11-13T15:00:00Z')] }
    const s = spot()
    expect(await openSpotOnJob(JOB, s)).toEqual({ ok: true })
    const ask = asks[0] as Extract<PaintedMapAsk, { kind: 'paint' }>
    expect(ask.kind).toBe('paint')
    expect(ask.start).toMatchObject({ name: 'Places on this job', words: '', first: 'place', jobList: true, home: { jobId: 'j1', developmentId: null, label: 'ZZ Test 4127', address: '418 Made Up Run' } })
    expect(ask.start.spot).toBe(s)
    expect(ask.start.id).toMatch(/[0-9a-f-]{10,}/)
  })

  it('says why when the job’s maps did not load, and opens nothing', async () => {
    listen()
    io.answer = { ok: false, error: 'No signal. The maps did not load.' }
    expect(await openSpotOnJob(JOB, spot())).toEqual({ ok: false, error: 'No signal. The maps did not load.' })
    expect(asks).toHaveLength(0)
  })

  it('says so when no map window is listening on this screen', async () => {
    expect(await openSpotOnJob(JOB, spot())).toEqual({ ok: false, error: 'The map could not open from this screen. Open the job and press Photo of a spot.' })
  })
})

describe('spotFileFromPreview', () => {
  it('reads the photo back from its preview, dated by the photo’s own time', async () => {
    vi.stubGlobal('fetch', async () => ({ blob: async () => new Blob(['abc'], { type: 'image/jpeg' }) }))
    const f = await spotFileFromPreview('blob:one', '2026-11-21T18:00:00.000Z')
    expect(f.name).toBe('spot.jpg')
    expect(f.type).toBe('image/jpeg')
    expect(f.size).toBe(3)
    expect(f.lastModified).toBe(Date.parse('2026-11-21T18:00:00.000Z'))
  })

  it('dates it now when the screen read no time', async () => {
    vi.stubGlobal('fetch', async () => ({ blob: async () => new Blob(['abc']) }))
    const before = Date.now()
    const f = await spotFileFromPreview('blob:one', null)
    expect(f.type).toBe('image/jpeg')
    expect(f.lastModified).toBeGreaterThanOrEqual(before)
  })
})
