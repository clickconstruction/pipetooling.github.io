// @vitest-environment jsdom
/**
 * Write up a change in the Job window (v2.4057): the header icon shows only when the person's
 * opt-in is on, and opens the wizard over the window on this job.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
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
let doorOn = true
vi.mock('../../hooks/useQuickEstimateDoor', () => ({ useQuickEstimateDoor: () => doorOn }))
const detailJob = makeJob({ id: 'job-1', hcp_number: '9001', job_name: 'Kitchen rough-in' })
vi.mock('../../lib/fetchJobWithDetailsById', () => ({
  fetchJobWithDetailsById: async () => detailJob,
}))
beforeAll(() => {
  vi.stubGlobal('scrollTo', vi.fn())
})

function renderModal() {
  renderWithProviders(
    <UpdateFocusOpenerBridgeProvider>
      <DetailJobModal open onClose={() => {}} jobId="job-1" authRole="master_technician" assignedJobsRows={[]} scheduleContext={null} />
    </UpdateFocusOpenerBridgeProvider>,
  )
}

describe('DetailJobModal Write up a change (v2.4057)', () => {
  it('the header icon opens the wizard on this job', async () => {
    doorOn = true
    renderModal()
    await settle()
    fireEvent.click(screen.getByLabelText('Write up a change'))
    expect(screen.getByRole('dialog', { name: 'Write up a change' })).toBeTruthy()
  })

  it('no icon when the person has not switched the door on', async () => {
    doorOn = false
    renderModal()
    await settle()
    expect(screen.queryByLabelText('Write up a change')).toBeNull()
  })
})
