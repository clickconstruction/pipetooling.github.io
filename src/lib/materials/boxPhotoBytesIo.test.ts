/**
 * A box photo's bytes (`readBoxPhotoBytes`): a filed shot comes from the job's folder and this phone's copy of it goes,
 * a shot that waits keeps its bytes for Send now and Share instead, and a thumbnail of this phone's bytes is a small
 * copy, never the shot whole. Every name is made up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PhotoNote } from './photo'

const getPhotoBlob = vi.fn()
const deletePhotoBlob = vi.fn()
const thumbOfPhoto = vi.fn()
const jobPhotoThumb = vi.fn()
const jobPhotoFull = vi.fn()
const download = vi.fn()

vi.mock('../supabase', () => ({ supabase: { storage: { from: () => ({ download: (...a: unknown[]) => download(...a) }) } } }))
vi.mock('./photoBlobs', () => ({ getPhotoBlob: (...a: unknown[]) => getPhotoBlob(...a), deletePhotoBlob: (...a: unknown[]) => deletePhotoBlob(...a) }))
vi.mock('./photoShrink', () => ({ thumbOfPhoto: (...a: unknown[]) => thumbOfPhoto(...a) }))
vi.mock('./photoUpload', () => ({ BOX_PHOTOS_BUCKET: 'box-photos' }))
vi.mock('../photos/jobPhotosIo', () => ({ jobPhotoThumb: (...a: unknown[]) => jobPhotoThumb(...a), jobPhotoFull: (...a: unknown[]) => jobPhotoFull(...a) }))

import { readBoxPhotoBytes } from './boxPhotoBytesIo'

const whole = new Blob(['x'.repeat(4000)], { type: 'image/jpeg' })
const small = new Blob(['x'], { type: 'image/jpeg' })
const filed: PhotoNote = { id: 'p1', jobId: 'j1', containerId: 'a1', fileName: '2026-11-02 Priya · A1 after Count.jpg', byUserId: 'u1', byName: 'Priya Nair', at: '2026-11-02T16:00:00Z', bytes: 4000, width: 1200, height: 1600, status: 'filed', driveFileId: 'drive-1', storagePath: 'j1/p1.jpg' }
const kept: PhotoNote = { ...filed, id: 'p2', status: 'on-phone', driveFileId: null, storagePath: null }
const going: PhotoNote = { ...filed, id: 'p3', status: 'sending', driveFileId: null, storagePath: 'j1/p3.jpg' }
const handed: PhotoNote = { ...filed, id: 'p4', status: 'shared', driveFileId: null, storagePath: null }

/** The blob each object URL was made over. */
let urls: Map<string, Blob>

beforeEach(() => {
  urls = new Map()
  let n = 0
  URL.createObjectURL = vi.fn((b: Blob) => { const u = `blob:${++n}`; urls.set(u, b); return u }) as typeof URL.createObjectURL
  for (const f of [getPhotoBlob, deletePhotoBlob, thumbOfPhoto, jobPhotoThumb, jobPhotoFull, download]) f.mockReset()
  getPhotoBlob.mockResolvedValue(null)
  deletePhotoBlob.mockResolvedValue(undefined)
  thumbOfPhoto.mockResolvedValue(small)
  jobPhotoThumb.mockResolvedValue('blob:drive-thumb')
  jobPhotoFull.mockResolvedValue('blob:drive-full')
})

describe('a filed shot', () => {
  it('is read from the job’s folder on the phone that took it, and that phone’s copy goes', async () => {
    getPhotoBlob.mockResolvedValue(whole)
    expect(await readBoxPhotoBytes(filed, 'thumb', 44)).toEqual({ url: 'blob:drive-thumb', blob: null, source: 'drive' })
    expect(jobPhotoThumb).toHaveBeenCalledWith('j1', 'drive-1')
    expect(deletePhotoBlob).toHaveBeenCalledWith('p1')
    expect(thumbOfPhoto).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('still opens whole, from the folder', async () => {
    getPhotoBlob.mockResolvedValue(whole)
    expect(await readBoxPhotoBytes(filed, 'full')).toEqual({ url: 'blob:drive-full', blob: null, source: 'drive' })
    expect(jobPhotoFull).toHaveBeenCalledWith('j1', 'drive-1')
  })

  it('draws without waiting on the delete, and a delete that fails costs nothing', async () => {
    getPhotoBlob.mockResolvedValue(whole)
    deletePhotoBlob.mockReturnValue(new Promise(() => undefined))
    expect((await readBoxPhotoBytes(filed, 'thumb', 44))?.url).toBe('blob:drive-thumb')
    deletePhotoBlob.mockRejectedValue(new Error('the store is shut'))
    expect((await readBoxPhotoBytes(filed, 'thumb', 44))?.url).toBe('blob:drive-thumb')
  })

  it('asks for no delete on a phone that holds nothing', async () => {
    expect((await readBoxPhotoBytes(filed, 'thumb', 44))?.source).toBe('drive')
    expect(deletePhotoBlob).not.toHaveBeenCalled()
  })

  it('is an empty square when the folder does not answer: the phone’s copy is not drawn in its place', async () => {
    getPhotoBlob.mockResolvedValue(whole)
    jobPhotoThumb.mockResolvedValue(null)
    expect(await readBoxPhotoBytes(filed, 'thumb', 44)).toBeNull()
  })
})

describe('a shot that waits', () => {
  it.each([kept, going, handed])('keeps this phone’s copy and draws a small one of it ($status)', async (p) => {
    getPhotoBlob.mockResolvedValue(whole)
    const got = await readBoxPhotoBytes(p, 'thumb', 44)
    expect(got?.source).toBe('phone')
    // The square draws the small copy. Send now and Share instead get the shot whole.
    expect(thumbOfPhoto).toHaveBeenCalledWith(whole, 44)
    expect(urls.get(got!.url!)).toBe(small)
    expect(got?.blob).toBe(whole)
    expect(deletePhotoBlob).not.toHaveBeenCalled()
    expect(jobPhotoThumb).not.toHaveBeenCalled()
  })

  it('opens whole from this phone', async () => {
    getPhotoBlob.mockResolvedValue(whole)
    const got = await readBoxPhotoBytes(kept, 'full')
    expect(urls.get(got!.url!)).toBe(whole)
    expect(got?.blob).toBe(whole)
    expect(thumbOfPhoto).not.toHaveBeenCalled()
  })

  it('hands back the bytes with no picture when the small copy cannot be made: never the shot whole in a thumbnail', async () => {
    getPhotoBlob.mockResolvedValue(whole)
    thumbOfPhoto.mockResolvedValue(null)
    expect(await readBoxPhotoBytes(kept, 'thumb', 44)).toEqual({ url: null, blob: whole, source: 'phone' })
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('draws a small copy of the bucket’s bytes on a phone that never held the shot', async () => {
    download.mockResolvedValue({ data: whole, error: null })
    const got = await readBoxPhotoBytes(going, 'thumb', 56)
    expect(got?.source).toBe('bucket')
    expect(download).toHaveBeenCalledWith('j1/p3.jpg')
    expect(thumbOfPhoto).toHaveBeenCalledWith(whole, 56)
    expect(urls.get(got!.url!)).toBe(small)
    const full = await readBoxPhotoBytes(going, 'full')
    expect(urls.get(full!.url!)).toBe(whole)
  })

  it('has nothing to draw where no place holds it, and where the phone’s store cannot be read', async () => {
    expect(await readBoxPhotoBytes(kept, 'thumb', 44)).toBeNull()
    getPhotoBlob.mockRejectedValue(new Error('the store is shut'))
    expect(await readBoxPhotoBytes(handed, 'thumb', 44)).toBeNull()
  })
})
