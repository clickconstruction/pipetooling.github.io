// @vitest-environment jsdom
/**
 * Render smoke for the box photo strip (punch list #297, the finish line, v2.6927): nothing drawn when nothing is due,
 * the count while files move, a held file named with its reason, and the Try again press for a role that may ask.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const role = vi.hoisted(() => ({ value: 'assistant' as string | null }))
const io = vi.hoisted(() => ({
  state: { marks: [] as { id: string; fileName: string; dueAt: string; failWhy: string | null }[], seenMost: 0, asking: false },
  refreshRefileMarks: vi.fn(async () => []),
  runBoxPhotoRefile: vi.fn(async () => {}),
}))

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ role: role.value }) }))
vi.mock('../../hooks/useOnSiteStore', () => ({ useOnSiteStoreVersion: () => 0 }))
vi.mock('../../lib/materials/onSiteStore', () => ({ listPhotos: () => Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, driveFileId: `d${i}` })) }))
vi.mock('../../lib/materials/boxPhotoRefileIo', () => ({
  subscribeRefile: () => () => {},
  refileVersion: () => 0,
  refileJobState: () => io.state,
  refreshRefileMarks: io.refreshRefileMarks,
  runBoxPhotoRefile: io.runBoxPhotoRefile,
}))

import BoxPhotoRefileStrip from './BoxPhotoRefileStrip'

const mark = (n: number, failWhy: string | null = null) => ({ id: `p${n}`, fileName: `A${n} after Count.jpg`, dueAt: '2026-11-11T15:00:00.000Z', failWhy })

beforeEach(() => {
  role.value = 'assistant'
  io.state = { marks: [], seenMost: 0, asking: false }
  io.refreshRefileMarks.mockClear()
  io.runBoxPhotoRefile.mockClear()
})
afterEach(cleanup)

describe('BoxPhotoRefileStrip', () => {
  it('draws nothing when nothing is due, and reads the job’s marks once', () => {
    const { container } = render(<BoxPhotoRefileStrip jobId="job-1" onToast={vi.fn()} />)
    expect(container.firstChild).toBeNull()
    expect(io.refreshRefileMarks).toHaveBeenCalledWith('job-1')
  })

  it('shows the count while files move, with no press', () => {
    io.state = { marks: [mark(1), mark(2), mark(3), mark(4), mark(5), mark(6), mark(7)], seenMost: 12, asking: false }
    render(<BoxPhotoRefileStrip jobId="job-1" onToast={vi.fn()} />)
    expect(screen.getByRole('status').textContent).toContain('7 box photos are moving to this job’s Drive folder')
    expect(screen.getByRole('status').textContent).toContain('5 of 12 moved.')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('names a held file and tries it again on the press', async () => {
    io.state = { marks: [mark(4, 'That file is in Drive’s trash. Restore it there, then ask again.')], seenMost: 12, asking: false }
    render(<BoxPhotoRefileStrip jobId="job-1" onToast={vi.fn()} />)
    expect(screen.getByRole('status').textContent).toContain('11 of 12 box photos are in this job’s Drive folder')
    expect(screen.getByRole('status').textContent).toContain('A4 after Count.jpg: That file is in Drive’s trash.')
    fireEvent.click(screen.getByRole('button', { name: 'Try 1 held file again' }))
    await waitFor(() => expect(io.runBoxPhotoRefile).toHaveBeenCalledWith('job-1'))
  })

  it('a refusal is said in its own words', async () => {
    io.state = { marks: [mark(4, 'held')], seenMost: 1, asking: false }
    io.runBoxPhotoRefile.mockRejectedValueOnce(new Error('Drive did not let the app in: timeout'))
    const onToast = vi.fn()
    render(<BoxPhotoRefileStrip jobId="job-1" onToast={onToast} />)
    fireEvent.click(screen.getByRole('button', { name: 'Try 1 held file again' }))
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Drive did not let the app in: timeout', 'error'))
  })

  it('a role that may not ask reads the strip and gets no press', () => {
    role.value = 'helpers'
    io.state = { marks: [mark(4, 'held')], seenMost: 1, asking: false }
    render(<BoxPhotoRefileStrip jobId="job-1" onToast={vi.fn()} />)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
