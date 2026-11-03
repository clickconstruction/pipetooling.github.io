// @vitest-environment jsdom
/**
 * The Job photos window through its lazy door (punch list #244, v2.6449): the press answers at once with *Opening the
 * job’s photos…* while the window's chunk arrives, then the window itself takes its place.
 */
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders, useAuthModuleMock } from '../../test/renderSmokeMocks'
import type { JobPhotosWindowIo } from '../../lib/photos/jobPhotoNotesIo'

vi.mock('../../hooks/useAuth', () => useAuthModuleMock({ role: 'assistant', profileName: 'Carla Nguyen' }))
vi.mock('../../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => false }))
vi.mock('../../hooks/useJobLineProgress', () => ({ useJobLineProgress: () => ({ lines: [] }) }))
vi.mock('../../lib/photos/reportPhotosIo', () => ({
  loadReportPhotoSize: () => Promise.resolve('medium'),
  jobHasDriveFolder: () => Promise.resolve(true),
}))

import { JobPhotosWindowLazy } from './JobPhotosWindowLazy'

const job = { id: 'job-1', hcp_number: '1077', job_name: 'Cedar Ridge Townhomes Phase 2', job_address: '2208 Live Oak Dr', google_drive_link: null, job_pictures_link: null }

const io = {
  rows: () => Promise.resolve([]),
  drive: { list: () => Promise.resolve({ folder: null, photos: [] }), thumb: () => Promise.resolve(null), full: () => Promise.resolve(null) },
  photos: { list: () => Promise.resolve({ rows: [], more: false }), waiting: () => Promise.resolve(0), thumb: () => Promise.resolve(null), full: () => Promise.resolve(null) },
  shots: { send: () => Promise.resolve({ storagePath: 'job-1/x.jpg' }), discard: () => Promise.resolve() },
  add: () => Promise.resolve({ added: 0, failed: [], failedIds: [] }),
  editWords: () => Promise.resolve(),
  links: () => Promise.resolve({ google_drive_link: null, job_pictures_link: null }),
  thread: () => Promise.resolve(true),
} as unknown as JobPhotosWindowIo

describe('JobPhotosWindowLazy', () => {
  it('answers the press with Opening the job’s photos…, then shows the window', async () => {
    renderWithProviders(<JobPhotosWindowLazy job={job} onClose={() => {}} io={io} />)
    expect(screen.getByText('Opening the job’s photos…')).toBeTruthy()
    expect(await screen.findByText('Job photos')).toBeTruthy()
    expect(screen.queryByText('Opening the job’s photos…')).toBeNull()
  })
})
