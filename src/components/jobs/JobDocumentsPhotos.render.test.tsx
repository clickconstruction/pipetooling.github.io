// @vitest-environment jsdom
/**
 * The job window's Documents tab Photos line over a fake io (punch list #232, PR 3): a job with no folder says so and
 * points at the press above; a folder with photos reads the count line as a door that opens the viewer; an empty folder
 * says what fills it; a read that fails says why with Try again. Made-up names only.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JobPhoto, JobPhotosRead } from '../../lib/photos/jobPhotos'
import type { JobPhotosIo } from '../../lib/photos/jobPhotosIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobDocumentsPhotos } from './JobDocumentsPhotos'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const FOLDER = 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUv'
const photo = (id: string, modified: string): JobPhoto => ({ id: `1${id.padEnd(12, 'x')}`, name: `${id}.jpg`, mime: 'image/jpeg', bytes: 300000, modified, from: 'pictures' })

function fakeIo(read: Partial<JobPhotosRead> = {}, over: Partial<JobPhotosIo> = {}): JobPhotosIo {
  const full: JobPhotosRead = { folder: { kind: 'pictures', url: FOLDER }, photos: [photo('a', '2026-11-01T20:00:00Z'), photo('b', '2026-10-24T19:00:00Z')], capped: false, waiting: 1, ...read }
  return { list: vi.fn(async () => full), thumb: vi.fn(async () => null), full: vi.fn(async () => null), ...over }
}

afterEach(() => cleanup())

describe('JobDocumentsPhotos', () => {
  it('says so on a job with no folder link and reads nothing', () => {
    const io = fakeIo()
    renderWithProviders(<JobDocumentsPhotos jobId="job-1" driveLink="" picturesLink={null} io={io} />)
    expect(screen.getByText(/No Drive folder is linked to this job yet\./)).toBeTruthy()
    expect(io.list).not.toHaveBeenCalled()
  })

  it('reads the count line as a door and opens the viewer', async () => {
    renderWithProviders(<JobDocumentsPhotos jobId="job-1" driveLink={FOLDER} picturesLink={null} io={fakeIo()} />)
    const door = await screen.findByRole('button', { name: '2 in Drive · 1 on its way · the newest Nov 1: open the folder’s viewer' })
    fireEvent.click(door)
    await waitFor(() => expect(document.querySelector('[data-job-photos-viewer]')).toBeTruthy())
  })

  it('says what fills an empty folder, and why a read failed with Try again', async () => {
    renderWithProviders(<JobDocumentsPhotos jobId="job-1" driveLink={FOLDER} picturesLink={null} io={fakeIo({ photos: [], waiting: 0 })} />)
    expect(await screen.findByText('No photos in the folder yet. A photo taken in the app saves there.')).toBeTruthy()
    cleanup()
    const io = fakeIo({}, { list: vi.fn().mockRejectedValueOnce(new Error('The job’s photos did not read. This job is not one you can see.')).mockResolvedValue({ folder: { kind: 'pictures', url: FOLDER }, photos: [], capped: false, waiting: 0 }) })
    renderWithProviders(<JobDocumentsPhotos jobId="job-1" driveLink={FOLDER} picturesLink={null} io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('No photos in the folder yet. A photo taken in the app saves there.')).toBeTruthy()
  })
})
