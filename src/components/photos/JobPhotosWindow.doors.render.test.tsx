// @vitest-environment jsdom
/**
 * The Job photos window's viewer doors (punch list #244, v2.6439): with a job to open, every photo offers one Open the
 * job, a report photo no mislabeled Open the report, and the press closes the viewer and opens the job; opened where
 * there is no job to open, the viewer offers no Open the job at all.
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

const job = { id: 'job-1', hcp_number: '1077', job_name: 'Cedar Ridge Townhomes Phase 2', job_address: '2208 Live Oak Dr', google_drive_link: null, job_pictures_link: null }

const jobPhoto: UploadedPhotoRow = {
  source: 'job', id: 'n1', job_id: 'job-1', bid_id: null, project_id: null, report_id: null, container_id: null, question_id: null, message_id: null, contact_id: null,
  caption: 'Cracked flange under the second lav', stage_name: 'Rough In', by_user_id: 'someone-else', by_name: 'Carla Nguyen', direction: null, channel: null,
  taken_at: '2026-11-02T15:20:00.000Z', bytes: 310_000, original_bytes: 4_200_000, bucket: 'job-photo-notes', storage_path: null, drive_file_id: 'd-1', filed_at: '2026-11-02T15:25:00.000Z', fail_why: null, status: null,
  job_hcp_number: '1077', job_click_number: null, job_name: 'Cedar Ridge Townhomes Phase 2', customer_name: 'Ridgeway Builders', bid_number: null,
}
const reportPhoto: UploadedPhotoRow = { ...jobPhoto, source: 'report', id: 'r1', report_id: 'rep-1', caption: 'Rough In', by_name: 'Mateo Ruiz', taken_at: '2026-10-29T20:15:00.000Z', drive_file_id: 'd-2', bucket: 'report-photos' }

function makeIo(rows: UploadedPhotoRow[]): JobPhotosWindowIo {
  return {
    rows: () => Promise.resolve(rows),
    drive: { list: () => Promise.resolve({ folder: null, photos: [] }), thumb: () => Promise.resolve(null), full: () => Promise.resolve(null) } as unknown as JobPhotosWindowIo['drive'],
    photos: { list: () => Promise.resolve({ rows: [], more: false }), waiting: () => Promise.resolve(0), thumb: () => Promise.resolve(null), full: () => Promise.resolve(null) },
    shots: { send: () => Promise.resolve({ storagePath: 'job-1/x.jpg' }), discard: () => Promise.resolve() },
    add: () => Promise.resolve({ added: 0, failed: [], failedIds: [] }),
    editWords: () => Promise.resolve(),
    // PR 4's two reads (v2.6368): the folder links when a door hands none over, and the thread's line after a press.
    links: () => Promise.resolve({ google_drive_link: null, job_pictures_link: null }),
    thread: () => Promise.resolve(true),
  } as unknown as JobPhotosWindowIo
}

async function openTile(id: string) {
  fireEvent.click(document.querySelector(`[data-job-photo-tile="${id}"]`)!)
  const dialogs = await screen.findAllByRole('dialog')
  return dialogs[dialogs.length - 1]!
}

describe('JobPhotosWindow — the viewer’s doors', () => {
  beforeEach(() => {
    URL.createObjectURL = () => 'blob:test'
    URL.revokeObjectURL = () => undefined
  })

  it('with a job to open, a report photo offers one Open the job and no Open the report, and the press opens the job', async () => {
    const onOpenJob = vi.fn()
    renderWithProviders(<JobPhotosWindow job={job} onClose={() => {}} onOpenJob={onOpenJob} io={makeIo([jobPhoto, reportPhoto])} />)
    await screen.findByText('Cracked flange under the second lav')
    await settle()
    const viewer = await openTile('r1')
    expect(within(viewer).queryByRole('button', { name: 'Open the report' })).toBeNull()
    const doors = within(viewer).getAllByRole('button', { name: 'Open the job' })
    expect(doors).toHaveLength(1)
    fireEvent.click(doors[0]!)
    expect(onOpenJob).toHaveBeenCalledTimes(1)
  })

  it('with a job to open, a job photo offers Open the job once', async () => {
    renderWithProviders(<JobPhotosWindow job={job} onClose={() => {}} onOpenJob={vi.fn()} io={makeIo([jobPhoto])} />)
    await screen.findByText('Cracked flange under the second lav')
    await settle()
    const viewer = await openTile('n1')
    expect(within(viewer).getAllByRole('button', { name: 'Open the job' })).toHaveLength(1)
  })

  it('opened where there is no job to open, the viewer offers no Open the job', async () => {
    renderWithProviders(<JobPhotosWindow job={job} onClose={() => {}} io={makeIo([jobPhoto, reportPhoto])} />)
    await screen.findByText('Cracked flange under the second lav')
    await settle()
    const viewer = await openTile('n1')
    expect(within(viewer).queryByRole('button', { name: 'Open the job' })).toBeNull()
    expect(within(viewer).queryByRole('button', { name: 'Open the report' })).toBeNull()
  })
})
