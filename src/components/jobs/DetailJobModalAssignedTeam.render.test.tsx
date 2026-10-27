// @vitest-environment jsdom
/**
 * The Assigned Team with nobody on it (punch list #184, sweep C): the empty state names Edit job,
 * the header gear's own press, for a role that can edit the job; the press opens Edit Job on it.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import DetailJobModal from './DetailJobModal'
import { UpdateFocusOpenerBridgeProvider } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'

const openEditJob = vi.fn()
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../contexts/JobFormModalContext', () => ({
  useJobFormModal: () => ({ isOpen: false, openNewJob: vi.fn(), openEditJob, closeJobForm: vi.fn() }),
}))
const detailJob = makeJob({ id: 'job-1', hcp_number: '9001', job_name: 'Kitchen rough-in', team_members: [] })
vi.mock('../../lib/fetchJobWithDetailsById', () => ({
  fetchJobWithDetailsById: async () => detailJob,
}))
beforeAll(() => {
  vi.stubGlobal('scrollTo', vi.fn())
})

describe('DetailJobModal · an empty Assigned Team (#184)', () => {
  it('names Edit job, and the press opens Edit Job on this job', async () => {
    const onClose = vi.fn()
    renderWithProviders(
      <UpdateFocusOpenerBridgeProvider>
        <DetailJobModal open onClose={onClose} jobId="job-1" authRole="master_technician" assignedJobsRows={[]} scheduleContext={null} />
      </UpdateFocusOpenerBridgeProvider>,
    )
    await settle()
    const empty = (await screen.findByText('Assigned Team')).parentElement!.querySelector('[data-empty-state]') as HTMLElement
    expect(empty.textContent).toBe('No team members yet. Edit job adds them.')
    fireEvent.click(within(empty).getByRole('button', { name: 'Edit job' }))
    expect(openEditJob).toHaveBeenCalledWith('job-1', expect.anything())
    expect(onClose).toHaveBeenCalled()
  })
})
