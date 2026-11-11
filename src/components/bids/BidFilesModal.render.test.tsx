// @vitest-environment jsdom
/**
 * The bid's Files window (punch list #306, PR 5): the photos icon opens it on the photos, read once, with the other
 * four rows under them; a grey link icon opens it on its row with the photos folded away and nothing read for them;
 * a row the bid has opens its link; a row it does not have says what sets it and opens Edit bid on that field; a bid
 * with three sets of plans names each; one photo opened shows alone and comes back to the rows.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, settle, useAuthModuleMock } from '../../test/renderSmokeMocks'
import { bidFileRows, type BidFilesInput } from '../../lib/bids/bidFilesWindow'
import type { BidPhotoRow } from '../../lib/bids/bidPhotoWindow'
import type { BidPhotosRead, BidPhotosWindowIo } from '../../lib/bids/bidPhotosIo'

vi.mock('../../hooks/useAuth', () => useAuthModuleMock({ role: 'estimator', profileName: 'Dana Whitfield' }))
vi.mock('../../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => false }))
vi.mock('../../lib/photos/reportPhotosIo', () => ({
  loadReportPhotoSize: () => Promise.resolve('medium'),
  jobHasDriveFolder: () => Promise.resolve(true),
}))
const opened = vi.hoisted(() => ({ urls: [] as string[] }))
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => void opened.urls.push(url) }))

import { BidFilesModal } from './BidFilesModal'

const bid = { id: '00000000-0000-0000-0000-00000306b005', label: 'b598 Quarry Road Storage Bunker' }

const photo = (over: Partial<BidPhotoRow> = {}): BidPhotoRow => ({
  id: 'p1', name: 'Mechanical room north', by_name: 'Dana Whitfield', by_user_id: 'u1', taken_at: '2026-11-06T18:00:00.000Z', added_at: '2026-11-06T18:01:00.000Z',
  bytes: 310_000, storage_path: null, drive_file_id: 'drive-1', filed_at: '2026-11-06T18:05:00.000Z', fail_why: null, ...over,
})

function makeIo(photos: BidPhotoRow[] = []): BidPhotosWindowIo & { loads: number } {
  const answer: BidPhotosRead = { folder: { kind: 'project', projectName: 'Quarry Road Storage Bunker', projectUrl: 'https://drive.google.com/drive/folders/1Project', photosUrl: null, hold: null }, driveWhy: null, photos, previews: {}, adopted: 0 }
  const io: BidPhotosWindowIo & { loads: number } = {
    loads: 0,
    load: () => {
      io.loads += 1
      return Promise.resolve(answer)
    },
    shots: { send: (input) => Promise.resolve({ storagePath: `${input.jobId}/${input.id}.jpg` }), discard: () => Promise.resolve() },
    add: (writes) => Promise.resolve({ added: writes.length, failed: [], failedIds: [] }),
    thumb: () => Promise.resolve(null),
    full: () => Promise.resolve(null),
  }
  return io
}

const nothing: BidFilesInput = { photoCount: 0, driveLink: null, planSets: [], countLink: null, submissionLink: null }
const full: BidFilesInput = {
  photoCount: 1,
  driveLink: 'https://drive.google.com/drive/folders/1Project',
  planSets: [
    { name: 'Issued for bid', link: 'https://drive.google.com/drive/folders/1Bid', onBid: false },
    { name: 'Addendum 1', link: 'https://drive.google.com/drive/folders/1Add', onBid: false },
    { name: 'Permit set', link: 'https://drive.google.com/drive/folders/1Permit', onBid: false },
  ],
  countLink: 'https://counttooling.com/?t=abc',
  submissionLink: null,
}

const rowOf = (kind: string) => document.querySelector<HTMLElement>(`[data-bid-file-row="${kind}"]`)!

describe('BidFilesModal', () => {
  beforeEach(() => {
    opened.urls = []
    let urls = 0
    URL.createObjectURL = () => `blob:test-${++urls}`
    URL.revokeObjectURL = () => undefined
  })

  it('opens on the photos from the photos icon, with the other four rows under them', async () => {
    const io = makeIo()
    renderWithProviders(<BidFilesModal bid={bid} rows={bidFileRows(nothing)} startOn="photos" onClose={() => undefined} onEditBid={() => undefined} io={io} />)
    await settle()
    expect(screen.getByRole('heading', { name: 'Files' })).toBeTruthy()
    expect(screen.getByText('b598 Quarry Road Storage Bunker')).toBeTruthy()
    expect(io.loads).toBe(1)
    expect(screen.getByText('No photos on this bid yet.')).toBeTruthy()
    expect(screen.getByText(/The first photo makes the folder: Quarry Road Storage Bunker › Team only › Photos/)).toBeTruthy()
    expect([...document.querySelectorAll('[data-bid-file-row]')].map((r) => r.getAttribute('data-bid-file-row'))).toEqual(['photos', 'folder', 'plans', 'count', 'submission'])
    expect([...document.querySelectorAll('[data-bid-file-row]')].every((r) => r.getAttribute('data-there') === 'no')).toBe(true)
    expect(document.querySelector('[data-pressed]')).toBeNull()
  })

  it('opens on a grey link’s row with the photos folded away and nothing read for them', async () => {
    const io = makeIo()
    const edit = vi.fn()
    const close = vi.fn()
    renderWithProviders(<BidFilesModal bid={bid} rows={bidFileRows(nothing)} startOn="count" onClose={close} onEditBid={edit} io={io} />)
    await settle()
    expect(io.loads).toBe(0)
    expect(document.querySelector('[data-bid-photos-window]')).toBeNull()
    expect(rowOf('count').getAttribute('data-pressed')).toBe('yes')
    expect(rowOf('folder').getAttribute('data-pressed')).toBeNull()
    expect(rowOf('count').textContent).toContain('Not linked yet')
    expect(rowOf('count').textContent).toContain('Paste the CountTooling project’s link on the bid, under Files & links.')

    fireEvent.click(rowOf('count').querySelector('[data-bid-file-set="count"]')!)
    expect(close).toHaveBeenCalledTimes(1)
    expect(edit).toHaveBeenCalledWith('countLink')
  })

  it('unfolds the photos on Add photos and reads them then', async () => {
    const io = makeIo()
    renderWithProviders(<BidFilesModal bid={bid} rows={bidFileRows(nothing)} startOn="folder" onClose={() => undefined} onEditBid={() => undefined} io={io} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Add photos' }))
    await waitFor(() => expect(io.loads).toBe(1))
    await waitFor(() => expect(screen.getByText('Drop photos here')).toBeTruthy())
    expect(document.querySelector('[data-bid-files-photos-open]')).toBeNull()
  })

  it('opens what the bid has, names each of three plan sets, and sends a missing one to Edit bid', async () => {
    const edit = vi.fn()
    renderWithProviders(<BidFilesModal bid={bid} rows={bidFileRows(full)} startOn="submission" onClose={() => undefined} onEditBid={edit} io={makeIo([photo()])} />)
    await settle()
    expect(rowOf('photos').textContent).toContain('1 photo')
    expect(screen.getByRole('button', { name: 'Show the photos' })).toBeTruthy()
    expect(rowOf('folder').getAttribute('data-there')).toBe('yes')
    expect(rowOf('folder').textContent).toContain('Linked · Google Drive')
    fireEvent.click(rowOf('folder').querySelector('button')!)
    expect(opened.urls).toEqual(['https://drive.google.com/drive/folders/1Project'])

    expect(rowOf('plans').textContent).toContain('3 sets')
    const sets = rowOf('plans').querySelectorAll('[data-bid-file-open="plans"]')
    expect([...sets].map((s) => s.querySelector('span')?.textContent)).toEqual(['Issued for bid', 'Addendum 1', 'Permit set'])
    fireEvent.click(sets[1]!.querySelector('button')!)
    expect(opened.urls[1]).toBe('https://drive.google.com/drive/folders/1Add')

    expect(rowOf('submission').getAttribute('data-pressed')).toBe('yes')
    expect(rowOf('submission').textContent).toContain('Nothing filed as sent yet')
    fireEvent.click(screen.getByRole('button', { name: 'Set it in Edit bid' }))
    expect(edit).toHaveBeenCalledWith('submissionLink')
  })

  it('shows one opened photo alone and comes back to the rows', async () => {
    renderWithProviders(<BidFilesModal bid={bid} rows={bidFileRows(full)} startOn="photos" onClose={() => undefined} onEditBid={() => undefined} io={makeIo([photo()])} />)
    await settle()
    await waitFor(() => expect(document.querySelector('[data-bid-photo-tile="p1"]')).toBeTruthy())
    fireEvent.click(document.querySelector('[data-bid-photo-tile="p1"]')!)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Mechanical room north' })).toBeTruthy())
    expect(document.querySelector('[data-bid-file-row]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Back to the photos' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Files' })).toBeTruthy())
    expect(document.querySelectorAll('[data-bid-file-row]')).toHaveLength(5)
  })
})
