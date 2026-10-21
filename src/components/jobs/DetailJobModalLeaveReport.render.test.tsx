// @vitest-environment jsdom
/**
 * Leave Report from the job window (punch list #135, v2.5688): the ＋ Report chip in the activity header opens the
 * per-job report form over the window, and Escape never closes the window underneath it.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import DetailJobModal from './DetailJobModal'
import { UpdateFocusOpenerBridgeProvider } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const detailJob = makeJob({ id: 'job-1', hcp_number: '1043', job_name: 'Kane', job_address: '162 Forest Drive, Seguin, TX', google_drive_link: null })

vi.mock('../../lib/fetchJobWithDetailsById', () => ({
  fetchJobWithDetailsById: async () => detailJob,
}))

beforeAll(() => {
  vi.stubGlobal('scrollTo', vi.fn())
})

describe('DetailJobModal · ＋ Report in the activity header', () => {
  it('opens the per-job report form over the window; Escape closes the form and leaves the window, as its Close does', async () => {
    const onClose = vi.fn()
    renderWithProviders(
      <UpdateFocusOpenerBridgeProvider>
        <DetailJobModal open onClose={onClose} jobId="job-1" authRole="dev" assignedJobsRows={[]} scheduleContext={null} />
      </UpdateFocusOpenerBridgeProvider>,
    )
    await settle()
    const chip = await screen.findByRole('button', { name: 'Leave Report' })
    expect(chip.textContent).toBe('＋ Report')
    fireEvent.click(chip)
    // The form is the dialog with a Save report button; its title is the job's number and name.
    const formOf = () => screen.getAllByRole('dialog').find((d) => within(d).queryByRole('button', { name: 'Save report' })) ?? null
    await waitFor(() => expect(formOf()).not.toBeNull())
    const form = formOf()!
    expect(within(form).getByRole('heading', { name: '1043 Kane' })).toBeTruthy()

    // Escape anywhere while the form is up peels one layer: the form closes (v2.5691), the window stays.
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(formOf()).toBeNull())
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Leave Report' })).toBeTruthy()

    // Opened again, the form's own Close takes it down the same way; the window is still here.
    fireEvent.click(screen.getByRole('button', { name: 'Leave Report' }))
    await waitFor(() => expect(formOf()).not.toBeNull())
    fireEvent.click(within(formOf()!).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(formOf()).toBeNull())
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Leave Report' })).toBeTruthy()
  })

  it('offers no chip to a viewer who may not leave a job report', async () => {
    renderWithProviders(
      <UpdateFocusOpenerBridgeProvider>
        <DetailJobModal open onClose={vi.fn()} jobId="job-1" authRole={null} assignedJobsRows={[]} scheduleContext={null} />
      </UpdateFocusOpenerBridgeProvider>,
    )
    await settle()
    expect(screen.queryByRole('button', { name: 'Leave Report' })).toBeNull()
  })
})
