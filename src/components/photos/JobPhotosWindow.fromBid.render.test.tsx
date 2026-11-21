// @vitest-environment jsdom
/**
 * The Job photos window on a job won from a bid (punch list #306, PR 9): the bid's photos are listed with the job's,
 * each marked *From the bid*, with a chip and the foot's count; one opens the viewer as a bid's photo, with no *Edit
 * the words*; a read of the bid's photos that fails leaves the job's own standing; and a window handed no such read
 * draws the job's photos as before.
 */
import { fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, settle, useAuthModuleMock } from '../../test/renderSmokeMocks'
import type { UploadedPhotoRow } from '../../lib/photos/uploadedPhotos'

vi.mock('../../hooks/useAuth', () => useAuthModuleMock({ role: 'assistant', profileName: 'Carla Nguyen' }))
vi.mock('../../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => false }))
vi.mock('../../hooks/useJobLineProgress', () => ({ useJobLineProgress: () => ({ lines: [] }) }))
vi.mock('../../lib/photos/reportPhotosIo', () => ({
  loadReportPhotoSize: () => Promise.resolve('medium'),
  jobHasDriveFolder: () => Promise.resolve(true),
}))

import { JobPhotosWindow, type JobPhotosWindowIo } from './JobPhotosWindow'

const job = { id: 'job-1', hcp_number: '1077', job_name: 'Cedar Ridge Townhomes Phase 2', job_address: '2208 Live Oak Dr', google_drive_link: 'https://drive.google.com/drive/folders/1JobFolderIdAbCdEfGhIj', job_pictures_link: null }

const own: UploadedPhotoRow = {
  source: 'job', id: 'n1', job_id: 'job-1', bid_id: null, project_id: null, report_id: null, container_id: null, question_id: null, message_id: null, contact_id: null,
  caption: 'Cracked flange under the second lav', stage_name: 'Rough In', by_user_id: 'u1', by_name: 'Carla Nguyen', direction: null, channel: null,
  taken_at: new Date().toISOString(), bytes: 310_000, original_bytes: 4_200_000, bucket: 'job-photo-notes', storage_path: null, drive_file_id: 'd-1', filed_at: new Date().toISOString(), fail_why: null, status: null,
  job_hcp_number: '1077', job_click_number: null, job_name: 'Cedar Ridge Townhomes Phase 2', customer_name: 'Ridgeway Builders', bid_number: null,
}
const fromBid: UploadedPhotoRow = {
  ...own, source: 'bid', id: 'b1', job_id: null, bid_id: 'bid-9', caption: 'Gas meter at the north wall', stage_name: '', by_user_id: 'u2', by_name: 'Dana Reyes',
  taken_at: '2026-10-02T16:00:00.000Z', bucket: 'bid-photos', drive_file_id: 'd-7', job_hcp_number: null, job_name: 'Cedar Ridge Townhomes', bid_number: '556',
}
const adopted: UploadedPhotoRow = { ...fromBid, id: 'b2', caption: '2026-10-01 Priya Raman · Mechanical room', by_user_id: null, by_name: '', drive_file_id: 'd-8', taken_at: '2026-10-01T16:00:00.000Z' }

function makeIo(over: Partial<JobPhotosWindowIo> = {}): JobPhotosWindowIo {
  return {
    rows: () => Promise.resolve([own]),
    bidRows: () => Promise.resolve([fromBid, adopted]),
    drive: {
      // The job's photo folder is the bid's Team only › Photos: Drive lists the bid's filed pictures as well.
      list: () =>
        Promise.resolve({
          folder: { kind: 'photos' as const, url: 'https://drive.google.com/drive/folders/1Photos' },
          photos: [{ id: 'd-7', name: '2026-10-02 Dana Reyes · Gas meter at the north wall.jpg', mime: 'image/jpeg', bytes: 2_000_000, modified: '2026-10-02T16:01:00.000Z' }],
          capped: false,
          waiting: 0,
        }),
      thumb: () => Promise.resolve(null),
      full: () => Promise.resolve(null),
    } as unknown as JobPhotosWindowIo['drive'],
    photos: { list: () => Promise.resolve({ rows: [], more: false }), waiting: () => Promise.resolve(0), thumb: () => Promise.resolve(null), full: () => Promise.resolve(null) },
    shots: { send: () => Promise.resolve({ storagePath: 'job-1/x.jpg' }), discard: () => Promise.resolve() },
    add: () => Promise.resolve({ added: 0, failed: [], failedIds: [] }),
    editWords: () => Promise.resolve(),
    links: () => Promise.resolve({ google_drive_link: job.google_drive_link, job_pictures_link: null }),
    thread: () => Promise.resolve(true),
    ...over,
  }
}

describe('JobPhotosWindow, a job won from a bid', () => {
  beforeEach(() => {
    URL.createObjectURL = () => 'blob:test'
    URL.revokeObjectURL = () => undefined
  })

  it('lists the bid’s photos as From the bid, once each, with a chip and the foot’s count', async () => {
    renderWithProviders(<JobPhotosWindow job={job} onClose={() => {}} io={makeIo()} />)
    expect(await screen.findByText('Gas meter at the north wall')).toBeTruthy()
    expect(screen.getByText('Cracked flange under the second lav')).toBeTruthy()
    // The picture the app filed reads as its caption, with its sender as who.
    expect(screen.getByText('Mechanical room')).toBeTruthy()
    expect(screen.getByText(/^From the bid · Dana Reyes/)).toBeTruthy()
    expect(screen.getByText(/^From the bid · Priya Raman/)).toBeTruthy()
    // Drive listed the bid's filed picture too; it is not drawn a second time as a hand-added file.
    expect(document.querySelectorAll('[data-job-photo-tile]').length).toBe(3)
    expect(screen.queryByText(/Added in Drive/)).toBeNull()
    const chips = screen.getByRole('group', { name: 'Which photos' })
    expect(within(chips).getByText('All · 3')).toBeTruthy()
    expect(within(chips).getByText('Job photos · 1')).toBeTruthy()
    expect(within(chips).getByText('Bid photos · 2')).toBeTruthy()
    expect(screen.getByText(/3 photos · In Drive: Team only › Photos · 2 are from the bid/)).toBeTruthy()
    fireEvent.click(within(chips).getByText('Bid photos · 2'))
    expect(screen.queryByText('Cracked flange under the second lav')).toBeNull()
    expect(screen.getByText('Gas meter at the north wall')).toBeTruthy()
  })

  it('a bid’s photo opens as a bid’s photo, and its words are not edited here', async () => {
    renderWithProviders(<JobPhotosWindow job={job} onClose={() => {}} onOpenJob={() => {}} io={makeIo()} />)
    await screen.findByText('Gas meter at the north wall')
    await settle()
    fireEvent.click(document.querySelector('[data-job-photo-tile="b1"]')!)
    const dialogs = await screen.findAllByRole('dialog')
    const viewer = dialogs[dialogs.length - 1]!
    expect(within(viewer).getByText('Bid 556 · Cedar Ridge Townhomes · Ridgeway Builders')).toBeTruthy()
    expect(within(viewer).getByText(/^Bid photo · Dana Reyes/)).toBeTruthy()
    expect(within(viewer).getByRole('button', { name: 'Open in Drive' })).toBeTruthy()
    expect(within(viewer).queryByRole('button', { name: 'Edit the words' })).toBeNull()
    expect(within(viewer).queryByRole('button', { name: 'Open the job' })).toBeNull()
  })

  it('a read of the bid’s photos that fails leaves the job’s own photos standing', async () => {
    renderWithProviders(<JobPhotosWindow job={job} onClose={() => {}} io={makeIo({ bidRows: () => Promise.reject(new Error('The bid’s photos did not read.')) })} />)
    expect(await screen.findByText('Cracked flange under the second lav')).toBeTruthy()
    expect(screen.queryByText(/From the bid/)).toBeNull()
    // The bid's filed picture is then only a file in the folder, read by its name, as before this change.
    expect(screen.getByText(/Added in Drive/)).toBeTruthy()
  })

  it('a window handed no read of the bid’s photos draws the job’s alone', async () => {
    renderWithProviders(<JobPhotosWindow job={job} onClose={() => {}} io={makeIo({ bidRows: undefined })} />)
    expect(await screen.findByText('Cracked flange under the second lav')).toBeTruthy()
    expect(screen.queryByText(/From the bid/)).toBeNull()
  })
})
