// @vitest-environment jsdom
/**
 * Render smoke for a box's photos (Take from a box, step 1): a photo this phone never held draws its picture from the
 * place that holds it, a photo no place holds keeps the dashed square and says why, and a press on a thumbnail opens
 * the whole picture. Every name is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
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
afterEach(() => cleanup())

describe('BoxPhotos', () => {
  it('draws a photo this phone never held, from the place that holds it', async () => {
    readBoxPhotoBytes.mockResolvedValue({ url: 'blob:thumb-p1', blob: null, source: 'drive' })
    renderWithProviders(<BoxPhotos photos={[filed]} canAct={false} />)
    const img = (await screen.findByAltText(filed.fileName)) as HTMLImageElement
    expect(img.getAttribute('src')).toBe('blob:thumb-p1')
    expect(readBoxPhotoBytes).toHaveBeenCalledWith(filed, 'thumb')
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
