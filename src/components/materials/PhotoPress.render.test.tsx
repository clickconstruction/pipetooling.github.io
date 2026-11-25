// @vitest-environment jsdom
/**
 * Render smoke for a box's photos (Take from a box, step 1): a photo this phone never held draws its picture from the
 * place that holds it, a photo no place holds keeps the dashed square and says why, and a press on a thumbnail opens
 * the whole picture. A square reads its picture only once it is near the screen, and a kept shot whose small copy
 * could not be made still sends. Every name is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { PhotoNote } from '../../lib/materials/photo'

const readBoxPhotoBytes = vi.fn()
vi.mock('../../lib/materials/boxPhotoBytesIo', () => ({ readBoxPhotoBytes: (...a: unknown[]) => readBoxPhotoBytes(...a) }))
vi.mock('../../lib/materials/onSiteStore', () => ({ addPhoto: vi.fn(), newId: () => 'new-id', updatePhoto: vi.fn() }))
vi.mock('../../lib/materials/photoUpload', () => ({ sendBoxPhoto: vi.fn(), BoxPhotoNotKeptError: class extends Error {} }))

import { BoxPhotos } from './PhotoPress'

const filed: PhotoNote = { id: 'p1', jobId: 'j1', containerId: 'a1', fileName: '2026-11-02 Priya · A1 after Count.jpg', byUserId: 'u1', byName: 'Priya Nair', at: '2026-11-02T16:00:00Z', bytes: 412_000, width: 1200, height: 1600, status: 'filed', driveFileId: 'drive-1', storagePath: 'j1/p1.jpg', words: 'A1 after Count' }
const elsewhere: PhotoNote = { ...filed, id: 'p2', status: 'on-phone', driveFileId: null, storagePath: null, words: 'A1' }

beforeEach(() => {
  readBoxPhotoBytes.mockReset()
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** A stand-in for the browser's observer: the test says which squares have come near the screen. */
function standInObserver() {
  const watched = new Set<Element>()
  let tell: (entries: Array<{ isIntersecting: boolean; target: Element }>) => void = () => undefined
  vi.stubGlobal('IntersectionObserver', class {
    constructor(cb: typeof tell, public opts?: { rootMargin?: string }) { tell = cb }
    observe(el: Element) { watched.add(el) }
    unobserve(el: Element) { watched.delete(el) }
    disconnect() { watched.clear() }
  })
  return {
    watched,
    near: (id: string) => act(() => { tell([...watched].map((el) => ({ isIntersecting: (el as HTMLElement).dataset.photoId === id, target: el }))) }),
  }
}

describe('BoxPhotos', () => {
  it('draws a photo this phone never held, from the place that holds it', async () => {
    readBoxPhotoBytes.mockResolvedValue({ url: 'blob:thumb-p1', blob: null, source: 'drive' })
    renderWithProviders(<BoxPhotos photos={[filed]} canAct={false} />)
    const img = (await screen.findByAltText(filed.fileName)) as HTMLImageElement
    expect(img.getAttribute('src')).toBe('blob:thumb-p1')
    // The square's own size goes with the ask: a small copy of this phone's bytes is made for it.
    expect(readBoxPhotoBytes).toHaveBeenCalledWith(filed, 'thumb', 56)
    expect(screen.queryByTestId('box-photo-none')).toBeNull()
  })

  it('keeps the dashed square, with the reason, when no place holds the picture', async () => {
    readBoxPhotoBytes.mockResolvedValue(null)
    renderWithProviders(<BoxPhotos photos={[elsewhere]} canAct />)
    await waitFor(() => expect(screen.getByTestId('box-photo-none').getAttribute('title')).toBe('The picture is still on the phone that took it.'))
    expect(screen.queryByAltText(elsewhere.fileName)).toBeNull()
    // No bytes on this phone: there is nothing here to send or share.
    expect((screen.getByRole('button', { name: 'Send now' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Share instead' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('a filed photo whose file is gone says why under its words, where a phone can read it (punch list #398)', async () => {
    readBoxPhotoBytes.mockResolvedValue(null)
    const gone: PhotoNote = { ...filed, failWhy: 'The file is in the folder’s trash.' }
    renderWithProviders(<BoxPhotos photos={[gone]} canAct={false} />)
    // The frame is empty and dashed, and the reason is words on the screen, not a title a thumb never sees.
    await waitFor(() => expect(screen.getByTestId('box-photo-reason').textContent).toBe('The file is in the folder’s trash.'))
    expect(screen.getByTestId('box-photo-none')).toBeTruthy()
    cleanup()
    // With no reason kept, the frame's own words stand in.
    renderWithProviders(<BoxPhotos photos={[{ ...filed, failWhy: null }]} canAct={false} />)
    await waitFor(() => expect(screen.getByTestId('box-photo-reason').textContent).toBe('The picture did not open from the job’s folder.'))
  })

  it('a filed photo whose picture draws says no reason, and none while the picture is still being read', async () => {
    let land: (v: unknown) => void = () => {}
    readBoxPhotoBytes.mockReturnValue(new Promise((res) => { land = res }))
    renderWithProviders(<BoxPhotos photos={[{ ...filed, failWhy: 'The file is in the folder’s trash.' }]} canAct={false} />)
    await waitFor(() => expect(readBoxPhotoBytes).toHaveBeenCalled())
    expect(screen.queryByTestId('box-photo-reason')).toBeNull()
    await act(async () => { land({ url: 'blob:thumb-p1', blob: null, source: 'drive' }) })
    await screen.findByAltText(filed.fileName)
    expect(screen.queryByTestId('box-photo-reason')).toBeNull()
  })

  it('reads a square’s picture only once the square is near the screen', async () => {
    const obs = standInObserver()
    const far: PhotoNote = { ...filed, id: 'p9', driveFileId: 'drive-9', fileName: '2026-11-02 Priya · G40.jpg', words: 'G40' }
    readBoxPhotoBytes.mockImplementation(async (p: PhotoNote) => ({ url: `blob:thumb-${p.id}`, blob: null, source: 'drive' }))
    renderWithProviders(<BoxPhotos photos={[filed, far]} canAct={false} size={44} />)
    expect(obs.watched.size).toBe(2)
    // Nothing is read for a square the screen is nowhere near.
    expect(readBoxPhotoBytes).not.toHaveBeenCalled()
    expect(screen.getAllByTestId('box-photo-none')).toHaveLength(2)
    obs.near('p1')
    expect(((await screen.findByAltText(filed.fileName)) as HTMLImageElement).getAttribute('src')).toBe('blob:thumb-p1')
    expect(readBoxPhotoBytes).toHaveBeenCalledTimes(1)
    expect(readBoxPhotoBytes).toHaveBeenCalledWith(filed, 'thumb', 44)
    expect(screen.queryByAltText(far.fileName)).toBeNull()
    obs.near('p9')
    expect(((await screen.findByAltText(far.fileName)) as HTMLImageElement).getAttribute('src')).toBe('blob:thumb-p9')
    expect(readBoxPhotoBytes).toHaveBeenCalledTimes(2)
  })

  it('reads a shot again once the sweep has filed it, and keeps its picture up until the new one lands', async () => {
    const kept: PhotoNote = { ...filed, status: 'sending', driveFileId: null }
    readBoxPhotoBytes.mockResolvedValueOnce({ url: 'blob:small-p1', blob: new Blob(['shot']), source: 'phone' })
    const view = renderWithProviders(<BoxPhotos photos={[kept]} canAct={false} />)
    expect(((await screen.findByAltText(filed.fileName)) as HTMLImageElement).getAttribute('src')).toBe('blob:small-p1')
    let land: (v: unknown) => void = () => undefined
    readBoxPhotoBytes.mockReturnValueOnce(new Promise((r) => { land = r }))
    view.rerender(<BoxPhotos photos={[filed]} canAct={false} />)
    await waitFor(() => expect(readBoxPhotoBytes).toHaveBeenCalledTimes(2))
    expect((screen.getByAltText(filed.fileName) as HTMLImageElement).getAttribute('src')).toBe('blob:small-p1')
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    await act(async () => { land({ url: 'blob:drive-p1', blob: null, source: 'drive' }) })
    expect((screen.getByAltText(filed.fileName) as HTMLImageElement).getAttribute('src')).toBe('blob:drive-p1')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:small-p1')
  })

  it('still offers Send now and Share instead for a kept shot whose small copy could not be made', async () => {
    // The phone holds the bytes and the browser could not draw them small: no picture, and the shot still sends.
    readBoxPhotoBytes.mockResolvedValue({ url: null, blob: new Blob(['shot'], { type: 'image/jpeg' }), source: 'phone' })
    renderWithProviders(<BoxPhotos photos={[elsewhere]} canAct />)
    await waitFor(() => expect((screen.getByRole('button', { name: 'Send now' }) as HTMLButtonElement).disabled).toBe(false))
    expect((screen.getByRole('button', { name: 'Share instead' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByTestId('box-photo-none')).toBeTruthy()
    expect(screen.queryByAltText(elsewhere.fileName)).toBeNull()
  })

  it('opens the whole picture on a press and closes it again', async () => {
    readBoxPhotoBytes.mockImplementation(async (_p: PhotoNote, size: string) => ({ url: `blob:${size}-p1`, blob: null, source: 'drive' }))
    renderWithProviders(<BoxPhotos photos={[filed]} canAct={false} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Open the photo of A1 after Count' }))
    const dialog = await screen.findByRole('dialog', { name: 'Photo of A1 after Count' })
    await waitFor(() => expect(dialog.querySelector('img')?.getAttribute('src')).toBe('blob:full-p1'))
    expect(dialog.textContent).toContain('A1 after Count · Priya Nair')
    fireEvent.click(screen.getByRole('button', { name: 'Close the photo' }))
    expect(screen.queryByRole('dialog', { name: 'Photo of A1 after Count' })).toBeNull()
  })
})
