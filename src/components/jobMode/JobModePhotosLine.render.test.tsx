// @vitest-environment jsdom
/**
 * The Job Mode card's Photos line (punch list #244, PR 4): the count from one read, the first-photo words with none,
 * and the press opening the Job photos window on that job.
 */
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders, useAuthModuleMock } from '../../test/renderSmokeMocks'
import type { JobPhotosWindowIo } from '../../lib/photos/jobPhotoNotesIo'

vi.mock('../../hooks/useAuth', () => useAuthModuleMock({ role: 'helpers', profileName: 'Mateo Ruiz' }))
vi.mock('../../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => true }))
vi.mock('../../hooks/useJobLineProgress', () => ({ useJobLineProgress: () => ({ lines: [] }) }))
vi.mock('../../lib/photos/reportPhotosIo', () => ({ loadReportPhotoSize: () => Promise.resolve('medium'), jobHasDriveFolder: () => Promise.resolve(true) }))

import { JobModePhotosLine } from './JobModePhotosLine'

const windowIo: JobPhotosWindowIo = {
  rows: () => Promise.resolve([]),
  drive: { list: () => Promise.resolve({ folder: { kind: 'none', url: null }, photos: [], capped: false, waiting: 0 }), thumb: () => Promise.resolve(null), full: () => Promise.resolve(null) } as unknown as JobPhotosWindowIo['drive'],
  photos: { list: () => Promise.resolve({ rows: [], more: false }), waiting: () => Promise.resolve(0), thumb: () => Promise.resolve(null), full: () => Promise.resolve(null) },
  shots: { send: () => Promise.resolve({ storagePath: 'x' }), discard: () => Promise.resolve() },
  add: () => Promise.resolve({ added: 0, failed: [], failedIds: [] }),
  editWords: () => Promise.resolve(),
  links: () => Promise.resolve({ google_drive_link: null, job_pictures_link: null }),
  thread: () => Promise.resolve(true),
}

describe('JobModePhotosLine', () => {
  it('counts the job’s photos and opens the window, the camera’s words first on a phone', async () => {
    renderWithProviders(<JobModePhotosLine jobId="job-1" hcpNumber="1077" jobName="Cedar Ridge Townhomes Phase 2" jobAddress="2208 Live Oak Dr" countIo={() => Promise.resolve(14)} windowIo={windowIo} />)
    const door = await screen.findByRole('button', { name: 'Photos · 14: open the job’s photos' })
    fireEvent.click(door)
    expect(await screen.findByText('Job photos')).toBeTruthy()
    expect(await screen.findByText('No photos on this job yet.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Take a photo' })).toBeTruthy()
    expect(screen.getByText(/1077/)).toBeTruthy()
  })

  it('names the first photo with none, and reads Photos alone when the count cannot be read', async () => {
    const { unmount } = renderWithProviders(<JobModePhotosLine jobId="job-1" countIo={() => Promise.resolve(0)} windowIo={windowIo} />)
    expect(await screen.findByRole('button', { name: 'Photos · add the first: open the job’s photos' })).toBeTruthy()
    unmount()
    renderWithProviders(<JobModePhotosLine jobId="job-1" countIo={() => Promise.resolve(null)} windowIo={windowIo} />)
    expect(await screen.findByRole('button', { name: 'Photos: open the job’s photos' })).toBeTruthy()
  })
})
