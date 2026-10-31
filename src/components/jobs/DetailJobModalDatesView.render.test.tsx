// @vitest-environment jsdom
/**
 * Dates · Words | Track on the Job tab (v2.6139, punch list #217, jobs-pipeline-6): the window
 * opens on Words, the two date bands as they have always read; Track draws the job's days as one
 * strip in their place, with one last-work line, and remembers the choice in this browser.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import DetailJobModal from './DetailJobModal'
import { UpdateFocusOpenerBridgeProvider } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { makeInvoice, makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { setJobDatesView } from '../../hooks/useJobDatesView'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../contexts/JobFormModalContext', () => ({
  useJobFormModal: () => ({ isOpen: false, openNewJob: vi.fn(), openEditJob: vi.fn(), closeJobForm: vi.fn() }),
}))
const detailJob = makeJob({
  id: 'job-1',
  hcp_number: '9001',
  job_name: 'Kitchen rough-in',
  last_work_date: '2026-10-12',
  invoices: [makeInvoice({ id: 'inv-1', job_id: 'job-1', status: 'billed', billed_at: '2026-10-09T18:00:00Z', amount: 1200 })],
})
vi.mock('../../lib/fetchJobWithDetailsById', () => ({
  fetchJobWithDetailsById: async () => detailJob,
}))
// The strip reads the job's clock sessions, the Schedule and recorded time section's own read.
vi.mock('../../lib/fetchClockSessionsForJobLedger', () => ({
  fetchClockSessionsForJobLedger: async () => ({
    data: [
      { id: 'cs-1', user_id: 'u1', clocked_in_at: '2026-09-16T13:00:00Z', clocked_out_at: '2026-09-16T21:00:00Z', work_date: '2026-09-16', notes: null, approved_at: '2026-09-16T22:00:00Z', rejected_at: null, users: { name: 'Pat' } },
      { id: 'cs-2', user_id: 'u1', clocked_in_at: '2026-10-12T13:00:00Z', clocked_out_at: '2026-10-12T21:00:00Z', work_date: '2026-10-12', notes: null, approved_at: '2026-10-12T22:00:00Z', rejected_at: null, users: { name: 'Pat' } },
    ],
    error: null,
  }),
  fetchApprovedClosedClockSessionsForJobLedger: async () => ({ data: [], error: null, truncated: false }),
}))
beforeAll(() => {
  vi.stubGlobal('scrollTo', vi.fn())
})
afterEach(() => {
  setJobDatesView('words')
  window.history.replaceState({}, '', '/')
})

describe('DetailJobModal · Dates · Words | Track (v2.6139)', () => {
  it('opens on Words with the two bands, and Track draws the job’s days as one strip with one last work', async () => {
    window.localStorage.removeItem('jobDatesView')
    renderWithProviders(
      <UpdateFocusOpenerBridgeProvider>
        <DetailJobModal open onClose={vi.fn()} jobId="job-1" authRole="master_technician" assignedJobsRows={[]} scheduleContext={null} />
      </UpdateFocusOpenerBridgeProvider>,
    )
    await settle()
    expect(await screen.findByText('Last work date')).toBeTruthy()
    expect(screen.getByText('Last bill date')).toBeTruthy()
    expect(screen.getByText('Job Start')).toBeTruthy()
    expect(screen.queryByTestId('job-days-strip')).toBeNull()
    expect(screen.getByRole('button', { name: 'Words' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Track' }))
    expect(window.localStorage.getItem('jobDatesView')).toBe('track')
    const strip = await screen.findByTestId('job-days-strip')
    expect(screen.queryByText('Last work date')).toBeNull()
    expect(screen.queryByText('Job Start')).toBeNull()
    // The Reports door stays.
    expect(screen.getByRole('button', { name: 'Open reports for this job' })).toBeTruthy()
    // The sessions load into the strip: the first day, the approved days, the bill's tick, and last work said once with its source.
    await waitFor(() => expect(strip.querySelector('[data-job-strip-day="2026-09-16"] [data-job-strip-dot="start"]')).toBeTruthy())
    expect(strip.querySelector('[data-job-strip-day="2026-10-12"]')?.getAttribute('data-field')).toBe('approved')
    expect(strip.querySelector('[data-job-strip-day="2026-10-09"] [data-job-strip-dot="bill"]')).toBeTruthy()
    expect(screen.getByTestId('job-days-last-work').textContent).toBe('last work · approved Oct 12 ↗')
    expect(strip.querySelector('[data-today="yes"]')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Words' }))
    expect(await screen.findByText('Last work date')).toBeTruthy()
    expect(screen.queryByTestId('job-days-strip')).toBeNull()
  })

  it('a dev on ?sbs=1 sees the two bands over the strip on the same job, with no switch', async () => {
    window.history.replaceState({}, '', '/jobs?edit=job-1&sbs=1')
    renderWithProviders(
      <UpdateFocusOpenerBridgeProvider>
        <DetailJobModal open onClose={vi.fn()} jobId="job-1" authRole="dev" assignedJobsRows={[]} scheduleContext={null} />
      </UpdateFocusOpenerBridgeProvider>,
    )
    await settle()
    const sbs = await screen.findByTestId('job-dates-sbs')
    expect(sbs.textContent).toContain('Today')
    expect(sbs.textContent).toContain('With the strip')
    expect(screen.getByText('Last work date')).toBeTruthy()
    expect(screen.getByText('Job Start')).toBeTruthy()
    expect(screen.queryByTestId('job-dates-view-switch')).toBeNull()
    const strip = await screen.findByTestId('job-days-strip')
    await waitFor(() => expect(strip.querySelector('[data-job-strip-day="2026-10-12"]')?.getAttribute('data-field')).toBe('approved'))
  })
})
