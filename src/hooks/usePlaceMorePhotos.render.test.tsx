// @vitest-environment jsdom
/**
 * A place's photos after its first (punch list #413, step 7): the saved ones a person may take off,
 * and the new ones picked on a visit, shrunk on the phone, up to the table's twelve.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const shrink = vi.hoisted(() => ({ fails: false }))
vi.mock('../lib/photos/reportPhotosIo', () => ({ loadReportPhotoSize: () => Promise.resolve('medium') }))
vi.mock('../lib/photos/shrink', () => ({
  shrinkReportPhoto: (file: File) => (shrink.fails ? Promise.reject(new Error('The photo is not a picture.')) : Promise.resolve({ blob: new Blob([new Uint8Array(1000)], { type: 'image/jpeg' }), width: 1600, height: 1200, shrunk: true, original: file })),
}))

import { usePlaceMorePhotos } from './usePlaceMorePhotos'

const SAVED = [{ path: 'm1/open.jpg', at: '2026-11-21T15:01:00Z', by: 'u1' }, { path: 'm1/covered.jpg', at: null, by: null }]
const file = () => new File(['x'], 'p.jpg', { type: 'image/jpeg' })

beforeEach(() => {
  shrink.fails = false
  let n = 0
  URL.createObjectURL = () => `blob:more-${++n}`
  URL.revokeObjectURL = () => undefined
})

describe('usePlaceMorePhotos', () => {
  it('starts on the photos the place keeps, with room for more', () => {
    const { result } = renderHook(() => usePlaceMorePhotos(SAVED))
    expect(result.current.kept).toEqual(SAVED)
    expect(result.current.added).toEqual([])
    expect(result.current.canAdd).toBe(true)
  })

  it('starts empty for a new place', () => {
    const { result } = renderHook(() => usePlaceMorePhotos(null))
    expect(result.current.kept).toEqual([])
  })

  it('shrinks a pick and holds it with a preview until the save', async () => {
    const { result } = renderHook(() => usePlaceMorePhotos(SAVED))
    await act(async () => {
      await result.current.pick(file())
    })
    expect(result.current.added).toHaveLength(1)
    expect(result.current.added[0]!.previewUrl).toBe('blob:more-1')
    expect(result.current.added[0]!.blob.size).toBe(1000)
    expect(result.current.added[0]!.id).toMatch(/.{8,}/)
    expect(result.current.shrinking).toBe(false)
  })

  it('takes a saved photo off, and a picked one', async () => {
    const { result } = renderHook(() => usePlaceMorePhotos(SAVED))
    await act(async () => {
      await result.current.pick(file())
    })
    const id = result.current.added[0]!.id
    act(() => result.current.removeKept('m1/open.jpg'))
    act(() => result.current.removeAdded(id))
    expect(result.current.kept.map((p) => p.path)).toEqual(['m1/covered.jpg'])
    expect(result.current.added).toEqual([])
  })

  it('says why a pick did not read, and keeps what it had', async () => {
    shrink.fails = true
    const { result } = renderHook(() => usePlaceMorePhotos(SAVED))
    await act(async () => {
      await result.current.pick(file())
    })
    await waitFor(() => expect(result.current.error).toBe('The photo is not a picture.'))
    expect(result.current.added).toEqual([])
    expect(result.current.kept).toEqual(SAVED)
  })

  it('has no room past twelve', () => {
    const { result } = renderHook(() => usePlaceMorePhotos(Array.from({ length: 12 }, (_, i) => ({ path: `m1/p${i}.jpg`, at: null, by: null }))))
    expect(result.current.canAdd).toBe(false)
  })
})
