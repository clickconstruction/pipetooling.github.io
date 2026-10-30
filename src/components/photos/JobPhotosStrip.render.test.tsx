// @vitest-environment jsdom
/**
 * The job window's photo strip over a fake io (punch list #164, PR 5). A job with no folder link says so with the door
 * to set it, or says to ask the office; a folder with photos draws the three newest and the + N tile under Photos · N,
 * and the door opens the viewer; an empty folder says what fills it and counts the photos on their way; a read that
 * fails says why with Try again. Made-up names only.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JobPhoto, JobPhotosRead } from '../../lib/photos/jobPhotos'
import type { JobPhotosIo } from '../../lib/photos/jobPhotosIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobPhotosStrip } from './JobPhotosStrip'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const FOLDER = 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUv'
const photo = (id: string, modified: string, name = `${id}.jpg`): JobPhoto => ({ id: `1${id.padEnd(12, 'x')}`, name, mime: 'image/jpeg', bytes: 300000, modified, from: 'pictures' })
const PHOTOS = [photo('a', '2026-10-24T20:00:00Z', 'slab-rough-east.jpg'), photo('b', '2026-10-24T19:00:00Z'), photo('c', '2026-10-22T20:00:00Z'), photo('d', '2026-10-21T20:00:00Z'), photo('e', '2026-10-20T20:00:00Z')]

function fakeIo(read: Partial<JobPhotosRead> = {}, over: Partial<JobPhotosIo> = {}): JobPhotosIo {
  const full: JobPhotosRead = { folder: { kind: 'pictures', url: FOLDER }, photos: PHOTOS, capped: false, waiting: 0, ...read }
  return { list: vi.fn(async () => full), thumb: vi.fn(async () => null), full: vi.fn(async () => null), ...over }
}

afterEach(() => cleanup())

describe('JobPhotosStrip', () => {
  it('says so on a job with no folder link, with the door to set it, or the office to ask', () => {
    const io = fakeIo()
    const onSetFolder = vi.fn()
    renderWithProviders(<JobPhotosStrip jobId="job-1" driveLink="" picturesLink={null} onSetFolder={onSetFolder} io={io} />)
    expect(screen.getByText('No Drive folder is linked to this job yet.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Set the folder' }))
    expect(onSetFolder).toHaveBeenCalled()
    expect(io.list).not.toHaveBeenCalled()
    cleanup()
    renderWithProviders(<JobPhotosStrip jobId="job-1" driveLink="https://example.com/not-a-folder" picturesLink={null} io={io} />)
    expect(screen.getByText('Ask the office to set the job’s Drive folder.')).toBeTruthy()
  })

  it('draws the three newest and the + N tile under Photos · N, and the door opens the viewer', async () => {
    const io = fakeIo()
    renderWithProviders(<JobPhotosStrip jobId="job-1" driveLink={FOLDER} picturesLink={null} io={io} />)
    expect(await screen.findByRole('button', { name: "Photos · 5: open the folder's viewer" })).toBeTruthy()
    const tiles = screen.getAllByRole('listitem')
    expect(tiles.map((t) => t.getAttribute('aria-label'))).toEqual(['Open slab-rough-east.jpg', 'Open b.jpg', 'Open c.jpg', "2 more photos: open the folder's viewer"])
    expect(screen.getByText(/From the customer’s Drive folder/).textContent).toContain('never copied out')
    await waitFor(() => expect(io.thumb).toHaveBeenCalledTimes(3))
    fireEvent.click(screen.getByRole('button', { name: "Photos · 5: open the folder's viewer" }))
    expect(await screen.findByText('5 photos')).toBeTruthy()
    expect(document.querySelector('[data-job-photos-viewer]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open c.jpg' }))
    await waitFor(() => expect(io.full).toHaveBeenCalledWith('job-1', PHOTOS[2]!.id))
    expect(screen.getByRole('button', { name: 'Open in Drive' })).toBeTruthy()
  })

  it('says what fills an empty folder and counts the photos on their way', async () => {
    renderWithProviders(<JobPhotosStrip jobId="job-1" driveLink={FOLDER} picturesLink={null} io={fakeIo({ photos: [], waiting: 1 })} />)
    expect(await screen.findByText('1 photo on its way to the folder. Nothing is in the folder yet.')).toBeTruthy()
    expect(screen.getByText('Photos · 0')).toBeTruthy()
  })

  it('says why a read failed, with Try again', async () => {
    const io = fakeIo({}, { list: vi.fn(async () => { throw new Error('This job is not one you can see.') }) })
    renderWithProviders(<JobPhotosStrip jobId="job-1" driveLink={FOLDER} picturesLink={null} io={io} />)
    expect(await screen.findByText(/The photos did not read\. This job is not one you can see\./)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(io.list).toHaveBeenCalledTimes(2))
  })
})
