import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Answer = { data: unknown; error: unknown }
const bench = vi.hoisted(() => ({ uploads: [] as Array<{ path: string; upsert: boolean }>, answer: null as null | (() => Promise<Answer>), keeps: [] as string[], keepFails: false }))

vi.mock('../supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (path: string, _blob: Blob, opts: { upsert: boolean }) => {
          bench.uploads.push({ path, upsert: opts.upsert })
          return bench.answer ? bench.answer() : Promise.resolve({ data: { path }, error: null })
        },
      }),
    },
  },
}))
vi.mock('./photoBlobs', () => ({
  putPhotoBlob: (id: string) => {
    if (bench.keepFails) return Promise.reject(new Error('QuotaExceededError'))
    bench.keeps.push(id)
    return Promise.resolve()
  },
}))

import { BoxPhotoNotKeptError, boxPhotoPath, sendBoxPhoto } from './photoUpload'

const shot = { id: 'f1', jobId: 'j1', containerId: 'a1', blob: new Blob(['x'], { type: 'image/jpeg' }), fileName: 'a1.jpg' }
// The project's own answers, read on it on 2026-11-13 (punch list #338).
const ALREADY_THERE = { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' }
const REFUSED = { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' }

beforeEach(() => {
  bench.uploads.length = 0
  bench.keeps.length = 0
  bench.answer = null
  bench.keepFails = false
  vi.stubGlobal('navigator', { onLine: true })
})
afterEach(() => vi.unstubAllGlobals())

describe('sendBoxPhoto', () => {
  it('keeps the shot on the phone, then sends it under its own id, never as an upsert', async () => {
    expect(await sendBoxPhoto(shot)).toEqual({ storagePath: 'j1/f1.jpg' })
    expect(bench.keeps).toEqual(['f1'])
    expect(bench.uploads).toEqual([{ path: boxPhotoPath('j1', 'f1'), upsert: false }])
  })

  it('a send that meets its own file landed before: it is a landing, so the row can follow', async () => {
    bench.answer = () => Promise.resolve({ data: null, error: ALREADY_THERE })
    expect(await sendBoxPhoto(shot)).toEqual({ storagePath: 'j1/f1.jpg' })
  })

  it('any other no is thrown with its reason, and the shot stays kept', async () => {
    bench.answer = () => Promise.resolve({ data: null, error: REFUSED })
    const thrown = await sendBoxPhoto(shot).catch((e: unknown) => e)
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown).not.toBeInstanceOf(BoxPhotoNotKeptError)
    expect(bench.keeps).toEqual(['f1'])
  })

  it('with no signal nothing is sent, and the shot is kept', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const thrown = (await sendBoxPhoto(shot).catch((e: unknown) => e)) as Error
    expect(thrown.message).toBe('The phone has no signal.')
    expect(thrown).not.toBeInstanceOf(BoxPhotoNotKeptError)
    expect(bench.uploads).toEqual([])
    expect(bench.keeps).toEqual(['f1'])
  })

  it('a phone that cannot keep the shot still sends it', async () => {
    bench.keepFails = true
    expect(await sendBoxPhoto(shot)).toEqual({ storagePath: 'j1/f1.jpg' })
    expect(bench.uploads).toHaveLength(1)
  })

  it('a shot that neither sent nor could be kept is said as that, never as kept', async () => {
    bench.keepFails = true
    bench.answer = () => Promise.resolve({ data: null, error: REFUSED })
    expect(await sendBoxPhoto(shot).catch((e: unknown) => e)).toBeInstanceOf(BoxPhotoNotKeptError)
    vi.stubGlobal('navigator', { onLine: false })
    expect(await sendBoxPhoto(shot).catch((e: unknown) => e)).toBeInstanceOf(BoxPhotoNotKeptError)
  })

  it('a send that never answers runs out of time, and the shot is kept for Send now', async () => {
    vi.useFakeTimers()
    try {
      bench.answer = () => new Promise<Answer>(() => {})
      const pending = sendBoxPhoto(shot).catch((e: unknown) => e)
      await vi.advanceTimersByTimeAsync(31_000)
      const thrown = await pending
      expect(thrown).toBeInstanceOf(Error)
      expect(thrown).not.toBeInstanceOf(BoxPhotoNotKeptError)
      expect(bench.keeps).toEqual(['f1'])
    } finally {
      vi.useRealTimers()
    }
  })
})
