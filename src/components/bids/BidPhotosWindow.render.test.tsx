// @vitest-environment jsdom
/**
 * The bid's Photos window (punch list #306, PR 3): an empty bid names the press and where the first photo will go; two
 * picked files become tiles, the press names the folder it makes with its count and writes each name; a video in the
 * pick is left out with its reason; the grid draws what the bid has, with a photo Drive does not hold yet marked; a
 * held folder says the photos are safe and why; a read that fails offers Retry; a training account sees the photos
 * and no way to add one.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, settle, useAuthModuleMock } from '../../test/renderSmokeMocks'
import type { BidPhotoFolderState } from '../../lib/bids/bidPhotos'
import type { BidPhotoRow } from '../../lib/bids/bidPhotoWindow'
import type { BidPhotosRead, BidPhotosWindowIo } from '../../lib/bids/bidPhotosIo'

const auth = vi.hoisted(() => ({ readOnly: false }))
vi.mock('../../hooks/useAuth', () => {
  const made = useAuthModuleMock({ role: 'estimator', profileName: 'Dana Whitfield' })
  return { ...made, useAuth: () => ({ ...made.useAuth(), readOnly: auth.readOnly }) }
})
vi.mock('../../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => false }))
vi.mock('../../lib/photos/reportPhotosIo', () => ({
  loadReportPhotoSize: () => Promise.resolve('medium'),
  jobHasDriveFolder: () => Promise.resolve(true),
}))
vi.mock('../../lib/photos/shrink', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/photos/shrink')>()
  return {
    ...real,
    shrinkReportPhoto: (file: File) => Promise.resolve({ blob: new Blob([new Uint8Array(310_000)], { type: 'image/jpeg' }), width: 1600, height: 1200, shrunk: true, original: file }),
  }
})

import { BidPhotosWindow } from './BidPhotosWindow'

const bid = { id: '00000000-0000-0000-0000-00000306b001', label: 'b598 Quarry Road Storage Bunker' }

const folder = (kind: BidPhotoFolderState['kind'], hold: string | null = null): BidPhotoFolderState => ({
  kind,
  projectName: 'Quarry Road Storage Bunker',
  projectUrl: kind === 'none' ? null : 'https://drive.google.com/drive/folders/1Project',
  photosUrl: kind === 'ready' ? 'https://drive.google.com/drive/folders/1Photos' : null,
  hold,
})

const row = (over: Partial<BidPhotoRow> = {}): BidPhotoRow => ({
  id: 'p1', name: 'Mechanical room north', by_name: 'Dana Whitfield', by_user_id: 'u1', taken_at: '2026-11-06T18:00:00.000Z', added_at: '2026-11-06T18:01:00.000Z',
  bytes: 310_000, storage_path: null, drive_file_id: 'drive-1', filed_at: '2026-11-06T18:05:00.000Z', fail_why: null, ...over,
})

function makeIo(start: Partial<BidPhotosRead> | Error): BidPhotosWindowIo & { added: unknown[]; sent: string[]; loads: number } {
  let answer: BidPhotosRead | Error = start instanceof Error ? start : { folder: folder('project'), driveWhy: null, photos: [], previews: {}, adopted: 0, ...start }
  const io: BidPhotosWindowIo & { added: unknown[]; sent: string[]; loads: number } = {
    added: [],
    sent: [],
    loads: 0,
    load: () => {
      io.loads += 1
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer)
    },
    shots: {
      send: (input) => {
        io.sent.push(input.id)
        return Promise.resolve({ storagePath: `${input.jobId}/${input.id}.jpg` })
      },
      discard: () => Promise.resolve(),
    },
    add: (writes) => {
      io.added.push(...writes)
      if (!(answer instanceof Error)) {
        answer = { ...answer, folder: folder('ready'), photos: [...answer.photos, ...writes.map((w) => row({ id: w.id, name: w.name, drive_file_id: null, filed_at: null, storage_path: `${bid.id}/${w.id}.jpg` }))] }
      }
      return Promise.resolve({ added: writes.length, failed: [], failedIds: [] })
    },
    thumb: () => Promise.resolve(null),
    full: () => Promise.resolve(null),
  }
  return io
}

function pick(files: File[]) {
  fireEvent.change(screen.getByTestId('bid-photos-pick'), { target: { files } })
}

const jpg = (name: string) => new File([new Uint8Array(4_000)], name, { type: 'image/jpeg', lastModified: Date.parse('2026-11-10T15:00:00Z') })

describe('BidPhotosWindow', () => {
  beforeEach(() => {
    auth.readOnly = false
    let urls = 0
    URL.createObjectURL = () => `blob:test-${++urls}`
    URL.revokeObjectURL = () => undefined
  })

  it('names the press on an empty bid and where the first photo will go', async () => {
    renderWithProviders(<BidPhotosWindow bid={bid} onClose={() => undefined} io={makeIo({})} />)
    await settle()
    expect(screen.getByText('b598 Quarry Road Storage Bunker')).toBeTruthy()
    expect(screen.getByText('No photos on this bid yet.')).toBeTruthy()
    expect(screen.getByText('Drop photos here')).toBeTruthy()
    expect(screen.getByText(/The first photo makes the folder: Quarry Road Storage Bunker › Team only › Photos/)).toBeTruthy()
  })

  it('turns a pick into tiles, names the folder on the press, and writes each name', async () => {
    const io = makeIo({})
    const changed = vi.fn()
    renderWithProviders(<BidPhotosWindow bid={bid} onClose={() => undefined} onChanged={changed} io={io} />)
    await settle()
    pick([jpg('a.jpg'), jpg('b.jpg'), new File([new Uint8Array(10)], 'site-walk.mov', { type: 'video/quicktime' })])
    await waitFor(() => expect(io.sent).toHaveLength(2))
    await waitFor(() => expect(document.querySelectorAll('[data-shot-tile="sent"]')).toHaveLength(2))
    expect(screen.getByText('1 file was left out: site-walk.mov. A video. Photos only for now.')).toBeTruthy()
    expect(screen.getByText('This makes the bid’s photo folder and puts the photos in it:')).toBeTruthy()

    const names = document.querySelectorAll<HTMLInputElement>('[data-shot-name]')
    fireEvent.change(names[0]!, { target: { value: '  Mechanical room north ' } })
    const press = screen.getByRole('button', { name: 'Make the folder and add 2 photos' })
    expect(press.getAttribute('data-bid-photos-add')).toBe('live')
    fireEvent.click(press)
    await waitFor(() => expect(io.added).toHaveLength(2))
    expect(io.added[0]).toEqual({ id: io.sent[0], name: 'Mechanical room north' })
    expect(io.added[1]).toEqual({ id: io.sent[1], name: '' })
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1))
    // The read ran again, the tiles left, and the grid draws both with the one Drive does not hold yet marked.
    await waitFor(() => expect(document.querySelectorAll('[data-bid-photo-tile]')).toHaveLength(2))
    expect(document.querySelectorAll('[data-shot-tile]')).toHaveLength(0)
    expect(screen.getByText('2 photos · 2 not in Drive yet')).toBeTruthy()
    expect(screen.getAllByText('Not in Drive yet')).toHaveLength(2)
  })

  it('draws what the bid has and opens one', async () => {
    const io = makeIo({ folder: folder('ready'), photos: [row(), row({ id: 'p2', name: '', by_name: 'Priya Raman', taken_at: '2026-11-03T18:00:00.000Z' })] })
    renderWithProviders(<BidPhotosWindow bid={bid} onClose={() => undefined} io={io} />)
    await settle()
    expect(screen.getByText('2 photos')).toBeTruthy()
    expect(screen.getByText('Mechanical room north')).toBeTruthy()
    expect(screen.getByText('Photo')).toBeTruthy()
    expect(screen.getByText('Priya Raman · Nov 3')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add photos' })).toBeTruthy()
    fireEvent.click(document.querySelector('[data-bid-photo-tile="p1"]')!)
    await waitFor(() => expect(document.querySelector('[data-bid-photo-open="p1"]')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Back to the photos' })).toBeTruthy()
  })

  it('reads a picture the app filed by its caption, tells the board when the read took pictures on, and says so in plain words when Drive is silent', async () => {
    const changed = vi.fn()
    const io = makeIo({ folder: null, driveWhy: 'Failed to send a request to the Edge Function', adopted: 2, photos: [row({ id: 'a1', name: '2026-11-01 Priya Raman · Gas meter', by_name: '' }), row({ id: 'a2', name: '2026-11-01 Priya Raman · Floor sink', by_name: '' })] })
    renderWithProviders(<BidPhotosWindow bid={bid} onClose={() => undefined} onChanged={changed} io={io} />)
    await settle()
    expect(screen.getByText('Gas meter')).toBeTruthy()
    expect(screen.getByText('Floor sink')).toBeTruthy()
    expect(screen.getAllByText('Priya Raman · Nov 6')).toHaveLength(2)
    expect(changed).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-bid-photos-drive-silent]')?.textContent).toBe('Drive could not be reached just now. The bid’s photos still show. Its folder does not.')
  })

  it('says the photos are safe and why, when the folder holds them up', async () => {
    const why = 'This bid’s project folder is in a personal Drive, where the app can make folders but cannot save a file. Move the folder into the company’s shared Drive. The photos are safe in the app and file themselves once it is fixed.'
    const io = makeIo({ folder: folder('project', why), photos: [row({ drive_file_id: null, filed_at: null, storage_path: 'x/p1.jpg', fail_why: why })] })
    renderWithProviders(<BidPhotosWindow bid={bid} onClose={() => undefined} io={io} />)
    await settle()
    expect(screen.getByText('The photos are safe in the app. They are not in Drive yet.')).toBeTruthy()
    expect(document.querySelector('[data-bid-photos-hold]')?.textContent).toContain('Move the folder into the company’s shared Drive.')
  })

  it('offers Retry when the read fails', async () => {
    const io = makeIo(new Error('permission denied for table bid_photos'))
    renderWithProviders(<BidPhotosWindow bid={bid} onClose={() => undefined} io={io} />)
    await settle()
    expect(screen.getByText(/permission denied for table bid_photos/)).toBeTruthy()
  })

  it('shows a training account the photos and no way to add one', async () => {
    auth.readOnly = true
    const io = makeIo({ folder: folder('ready'), photos: [row()] })
    renderWithProviders(<BidPhotosWindow bid={bid} onClose={() => undefined} io={io} />)
    await settle()
    expect(screen.getByText('Mechanical room north')).toBeTruthy()
    const add = screen.getByRole('button', { name: 'Add photos' }) as HTMLButtonElement
    expect(add.disabled).toBe(true)
    expect(add.getAttribute('title')).toBe('A training account can look at a bid’s photos and cannot add one.')
  })
})
