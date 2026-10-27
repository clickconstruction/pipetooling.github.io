// @vitest-environment jsdom
/**
 * Render smoke for Dashboard → My crew (Supervision, PR 3): nothing for a non-supervisor
 * or an empty week; with a payload, the reports owed with the Write it door and the
 * crew's hours without an Approve button.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { OFFLINE_ERROR_MESSAGE } from '../../lib/networkErrorMessage'

type RpcResult = { data: unknown; error: { message?: string; code?: string } | null; status?: number }
const H = vi.hoisted(() => ({ rpc: vi.fn(async (_name?: unknown, _args?: unknown): Promise<RpcResult> => ({ data: null, error: null })) }))
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: H.rpc } }))
// The real reader, once: a lost signal is classed as the app classes it, without the retry backoff's wait.
vi.mock('../../utils/errorHandling', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/errorHandling')>()
  return { ...actual, withSupabaseRetry: ((op: never, name: string) => actual.withSupabaseRetry(op, name, { maxRetries: 0, logRetries: false })) as typeof actual.withSupabaseRetry }
})
// The Retry panel reads the person for its telemetry (v2.5962).
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'master_technician' })
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))

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
    H.rpc.mockImplementation(async (name: unknown) =>
      name === 'get_supervisor_review_deck'
        ? { data: { supervisor: true, month: TODAY.slice(0, 8) + '01', people: [{ user_id: 'bryan', name: 'Bryan Ortiz', role: 'helpers', days: 3, jobs: ['J258 · Oak St'], reviewed: false }] }, error: null }
        : { data: payload(), error: null },
    )
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
    // Rate my crew (PR 4): the month's count and the door.
    expect(screen.getByText('1 to rate')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Rate my crew' })).toBeTruthy()
  })

  it('every job-day reported and nobody clocked: both cards say so as empty states (punch list #184, sweep C)', async () => {
    const day = payload().job_days[0]!
    H.rpc.mockImplementation(async (name: unknown) =>
      name === 'get_supervisor_review_deck'
        ? { data: { supervisor: true, month: TODAY.slice(0, 8) + '01', people: [] }, error: null }
        : { data: payload({ job_days: [{ ...day, report_count: 1, my_report_count: 1 }], sessions: [] }), error: null },
    )
    renderWithProviders(<DashboardSupervisorSection authUserId="u1" role="master_technician" onLeaveReport={() => {}} />)
    await screen.findByRole('region', { name: 'My crew' })
    const empties = [...document.querySelectorAll('[data-empty-state]')].map((el) => el.textContent)
    expect(empties).toEqual(['Every job-day you supervised has a report. 1 filed.', 'Nobody clocked on a job-day you supervised.'])
  })

  it('a lost signal shows the section with the offline sentence and Retry, never "Nothing owed"; Retry reads the week again', async () => {
    let online = false
    H.rpc.mockImplementation(async (name: unknown) =>
      name === 'get_supervisor_review_deck'
        ? { data: null, error: null }
        : online
          ? { data: payload(), error: null }
          : { data: null, error: { message: 'TypeError: Failed to fetch', code: '' }, status: 0 },
    )
    renderWithProviders(<DashboardSupervisorSection authUserId="u1" role="master_technician" onLeaveReport={() => {}} />)
    await screen.findByText(OFFLINE_ERROR_MESSAGE)
    expect(screen.getByRole('region', { name: 'My crew' })).toBeTruthy()
    expect(screen.queryByText('Nothing owed.')).toBeNull()
    online = true
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText('no report yet')
    expect(screen.queryByText(OFFLINE_ERROR_MESSAGE)).toBeNull()
  })

  it('a refused read names its reason under the section, with no Retry', async () => {
    H.rpc.mockImplementation(async (name: unknown) =>
      name === 'get_supervisor_review_deck' ? { data: null, error: null } : { data: null, error: { message: 'permission denied for function get_supervised_days_payload', code: '42501' }, status: 403 },
    )
    renderWithProviders(<DashboardSupervisorSection authUserId="u1" role="helpers" onLeaveReport={() => {}} />)
    await screen.findByText("You don't have access to this crew.")
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })
})
