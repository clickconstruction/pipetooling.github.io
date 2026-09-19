// @vitest-environment jsdom
/**
 * Render smoke for Dashboard → My crew (Supervision, PR 3): nothing for a non-supervisor
 * or an empty week; with a payload, the reports owed with the Write it door and the
 * crew's hours without an Approve button.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

type RpcResult = { data: unknown; error: { message?: string } | null }
const H = vi.hoisted(() => ({ rpc: vi.fn(async (): Promise<RpcResult> => ({ data: null, error: null })) }))
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: H.rpc } }))

import DashboardSupervisorSection from './DashboardSupervisorSection'
import { todayYmdInAppTz } from '../../utils/dateUtils'

const TODAY = todayYmdInAppTz()
const payload = (over: Record<string, unknown> = {}) => ({
  supervisor: true,
  from: TODAY,
  to: TODAY,
  job_days: [
    { job_id: 'oak', work_date: TODAY, hcp_number: '258', click_number: null, job_name: 'Oak St', customer_name: 'Ramirez', job_address: '1408 Oak St', report_count: 0, my_report_count: 0, crew: [{ user_id: 'bryan', name: 'Bryan Ortiz', role: 'helpers' }] },
  ],
  sessions: [{ id: 's1', user_id: 'bryan', name: 'Bryan Ortiz', job_id: 'oak', work_date: TODAY, clocked_in_at: `${TODAY}T12:00:00Z`, clocked_out_at: `${TODAY}T16:00:00Z`, notes: null, approved: false }],
  ...over,
})

describe('DashboardSupervisorSection', () => {
  beforeEach(() => {
    H.rpc.mockReset()
  })
  afterEach(() => cleanup())

  it('renders nothing for a role without the switch, and never calls the RPC', async () => {
    const { container } = renderWithProviders(<DashboardSupervisorSection authUserId="u1" role="assistant" onLeaveReport={() => {}} />)
    await waitFor(() => expect(container.textContent).toBe(''))
    expect(H.rpc).not.toHaveBeenCalled()
  })

  it('renders nothing for a helper the RPC says is not a supervisor', async () => {
    H.rpc.mockResolvedValue({ data: { supervisor: false, from: TODAY, to: TODAY, job_days: [], sessions: [] }, error: null })
    const { container } = renderWithProviders(<DashboardSupervisorSection authUserId="u1" role="helpers" onLeaveReport={() => {}} />)
    await waitFor(() => expect(H.rpc).toHaveBeenCalled())
    await waitFor(() => expect(container.textContent).toBe(''))
  })

  it('shows the report owed with a Write it door and the crew hours without Approve', async () => {
    H.rpc.mockResolvedValue({ data: payload(), error: null })
    const onLeaveReport = vi.fn()
    renderWithProviders(<DashboardSupervisorSection authUserId="u1" role="master_technician" onLeaveReport={onLeaveReport} />)
    await screen.findByRole('region', { name: 'My crew' })
    expect(screen.getAllByText(/258 · Oak St/).length).toBeGreaterThan(0)
    expect(screen.getByText('no report yet')).toBeTruthy()
    screen.getByRole('button', { name: 'Write it' }).click()
    expect(onLeaveReport).toHaveBeenCalledWith({ id: 'oak', hcpNumber: '258', jobName: 'Oak St', jobAddress: '1408 Oak St' })
    expect(screen.getAllByText('4.00h').length).toBe(2)
    expect(screen.queryByRole('button', { name: /approve/i })).toBeNull()
    expect(screen.getByText(/approval stays with the office/)).toBeTruthy()
  })
})
