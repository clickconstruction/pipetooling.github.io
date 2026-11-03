// @vitest-environment jsdom
/**
 * The photo viewer's doors (punch list #244, v2.6439): a job photo or a checklist photo whose own door opens the job
 * shows Open the job once; a report photo keeps Open the report beside Open the job; a job photo with no door of its
 * own takes the job door; and a caller with no job to open draws no Open the job at all.
 */
import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { UploadedPhotoRow } from '../../lib/photos/uploadedPhotos'
import type { UploadedPhotosIo } from '../../lib/photos/uploadedPhotosIo'
import { UploadedPhotoViewer } from './UploadedPhotoViewer'

const io: UploadedPhotosIo = {
  list: () => Promise.resolve({ rows: [], more: false }),
  waiting: () => Promise.resolve(0),
  thumb: () => Promise.resolve(null),
  full: () => Promise.resolve(null),
}

const jobPhoto: UploadedPhotoRow = {
  source: 'job', id: 'n1', job_id: 'job-1', bid_id: null, project_id: null, report_id: null, container_id: null, question_id: null, message_id: null, contact_id: null,
  caption: 'Cracked flange under the second lav', stage_name: 'Rough In', by_user_id: 'u-1', by_name: 'Carla Nguyen', direction: null, channel: null,
  taken_at: '2026-11-02T15:20:00.000Z', bytes: 310_000, original_bytes: 4_200_000, bucket: 'job-photo-notes', storage_path: null, drive_file_id: 'd-1', filed_at: '2026-11-02T15:25:00.000Z', fail_why: null, status: null,
  job_hcp_number: '1077', job_click_number: null, job_name: 'Cedar Ridge Townhomes Phase 2', customer_name: 'Ridgeway Builders', bid_number: null,
}
const checklistPhoto: UploadedPhotoRow = { ...jobPhoto, source: 'checklist', id: 'c1', question_id: 'q-1', bucket: 'stage-checklist-photos' }
const reportPhoto: UploadedPhotoRow = { ...jobPhoto, source: 'report', id: 'r1', report_id: 'rep-1', caption: 'Rough In', bucket: 'report-photos' }

type Door = ((row: UploadedPhotoRow) => void) | null

async function show(row: UploadedPhotoRow, doors: { onJob: Door; onSource: Door }) {
  renderWithProviders(
    <UploadedPhotoViewer rows={[row]} index={0} io={io} onIndex={() => {}} onClose={() => {}} onJob={doors.onJob} onSource={doors.onSource} onPerson={() => {}} />,
  )
  const dialogs = await screen.findAllByRole('dialog')
  return dialogs[dialogs.length - 1]!
}

describe('UploadedPhotoViewer — the doors', () => {
  it('a job photo with its own door shows Open the job once, and the press is the photo’s own door', async () => {
    const onJob = vi.fn()
    const onSource = vi.fn()
    const viewer = await show(jobPhoto, { onJob, onSource })
    const doors = within(viewer).getAllByRole('button', { name: 'Open the job' })
    expect(doors).toHaveLength(1)
    fireEvent.click(doors[0]!)
    expect(onSource).toHaveBeenCalledWith(jobPhoto)
    expect(onJob).not.toHaveBeenCalled()
  })

  it('a checklist photo with its own door shows Open the job once', async () => {
    const viewer = await show(checklistPhoto, { onJob: vi.fn(), onSource: vi.fn() })
    expect(within(viewer).getAllByRole('button', { name: 'Open the job' })).toHaveLength(1)
  })

  it('a report photo keeps Open the report beside one Open the job, each its own press', async () => {
    const onJob = vi.fn()
    const onSource = vi.fn()
    const viewer = await show(reportPhoto, { onJob, onSource })
    fireEvent.click(within(viewer).getByRole('button', { name: 'Open the report' }))
    expect(onSource).toHaveBeenCalledWith(reportPhoto)
    const doors = within(viewer).getAllByRole('button', { name: 'Open the job' })
    expect(doors).toHaveLength(1)
    fireEvent.click(doors[0]!)
    expect(onJob).toHaveBeenCalledWith(reportPhoto)
  })

  it('a job photo with no door of its own takes the job door', async () => {
    const onJob = vi.fn()
    const viewer = await show(jobPhoto, { onJob, onSource: null })
    const doors = within(viewer).getAllByRole('button', { name: 'Open the job' })
    expect(doors).toHaveLength(1)
    fireEvent.click(doors[0]!)
    expect(onJob).toHaveBeenCalledWith(jobPhoto)
  })

  it('a caller with no job to open draws no Open the job', async () => {
    const viewer = await show(jobPhoto, { onJob: null, onSource: null })
    expect(within(viewer).queryByRole('button', { name: 'Open the job' })).toBeNull()
    expect(within(viewer).getAllByRole('button', { name: 'Close' }).length).toBeGreaterThan(0)
  })
})
