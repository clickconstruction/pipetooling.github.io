// @vitest-environment jsdom
/**
 * The job window's header carries the job's kind beside its name (punch list #238), and a press on the Edit tab, which
 * bumps the pane's refresh key, moves the chip without a reload.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'

const db = vi.hoisted(() => ({ job: null as unknown }))

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: async () => db.job }))

import DetailJobModal from './DetailJobModal'
import { UpdateFocusOpenerBridgeProvider } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'

afterEach(cleanup)

function pane(refreshKey: number) {
  return (
    <UpdateFocusOpenerBridgeProvider>
      <DetailJobModal open paneMode externalRefreshKey={refreshKey} onClose={() => {}} jobId="job-1" authRole="dev" assignedJobsRows={[]} scheduleContext={null} />
    </UpdateFocusOpenerBridgeProvider>
  )
}

describe('DetailJobModal · the job window header', () => {
  it('reads the signals until the office presses, and the chip moves on the refresh a press sends', async () => {
    db.job = makeJob({ id: 'job-1', hcp_number: '9057', job_name: 'ZZ Test Water Heater', first_work_date: '2026-09-01' })
    const { rerender } = renderWithProviders(pane(0))
    await settle()
    const heading = await screen.findByRole('heading', { name: /ZZ Test Water Heater/ })
    expect(within(heading).getByTestId('job-kind-chip').textContent).toBe('Service call')

    db.job = makeJob({ id: 'job-1', hcp_number: '9057', job_name: 'ZZ Test Water Heater', first_work_date: '2026-09-01', kind: 'project' })
    rerender(pane(1))
    await waitFor(() => expect(within(screen.getByRole('heading', { name: /ZZ Test Water Heater/ })).getByTestId('job-kind-chip').textContent).toBe('Project'))
  })
})
