// @vitest-environment jsdom
/**
 * Hand the phone to the customer (v2.4159): on the clocked-in job, a master sees the door until
 * the job's agreement is signed; a helper never does; a tap asks the kernel for the in-person link.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

const JOB_C = '00000000-0000-0000-0000-00000000cccc'
const scenario: { openSession: Record<string, unknown> | null; contracts: Array<{ status: string; voided_at: string | null }>; role: string } = { openSession: null, contracts: [], role: 'master_technician' }

vi.mock('../../lib/supabase', () => {
  function makeBuilder(table: string) {
    let single = false
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'eq', 'neq', 'is', 'in', 'or', 'not', 'order', 'range', 'limit', 'abortSignal', 'filter']) builder[m] = () => builder
    builder.single = () => { single = true; return builder }
    builder.maybeSingle = () => { single = true; return builder }
    const result = () => {
      if (table === 'job_schedule_blocks') return Promise.resolve({ data: [{ id: 'blk-3', job_id: JOB_C, time_start: '14:00', time_end: '17:00', jobs_ledger: { hcp_number: '503', click_number: null, job_name: 'Smoke Job 3', job_address: '3 Test St', service_type_id: null } }], error: null, count: 0 })
      if (table === 'clock_sessions') return single ? Promise.resolve({ data: scenario.openSession, error: null, count: 0 }) : Promise.resolve({ data: [], error: null, count: 0 })
      if (table === 'job_contracts') return Promise.resolve({ data: scenario.contracts, error: null, count: 0 })
      return Promise.resolve({ data: single ? null : [], error: null, count: 0 })
    }
    builder.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) => result().then(f, r)
    builder.catch = (r?: (e: unknown) => unknown) => result().catch(r)
    builder.finally = (f?: () => void) => result().finally(f)
    return builder
  }
  const channel = () => {
    const ch: Record<string, unknown> = {}
    ch.on = () => ch
    ch.subscribe = () => ch
    return ch
  }
  return { supabase: { from: (t: string) => makeBuilder(t), channel, removeChannel: () => undefined, rpc: () => Promise.resolve({ data: null, error: null }), functions: { invoke: () => Promise.resolve({ data: { ok: true }, error: null }) }, auth: { getSession: () => Promise.resolve({ data: { session: null } }) } } }
})
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: scenario.role, profileName: 'Malachi' }) }))
const goSpy = vi.fn((_url: string) => undefined)
const openSpy = vi.fn((_input: { jobId: string }) => Promise.resolve({ ok: true as const, url: 'https://x.test/contract/sign?t=abc&inperson=1' }))
vi.mock('../../lib/jobs/jobContractInPerson', async () => {
  const actual = await vi.importActual<typeof import('../../lib/jobs/jobContractInPerson')>('../../lib/jobs/jobContractInPerson')
  return { ...actual, openInPersonSigning: (i: { jobId: string }) => openSpy(i), goToSigningPage: (u: string) => goSpy(u) }
})

afterEach(cleanup)

async function mount() {
  const { renderWithProviders } = await import('../../test/renderSmokeMocks')
  const { UpdateFocusOpenerBridgeProvider } = await import('../../contexts/UpdateFocusOpenerBridgeContext')
  const { LedgerDisplayPrefixProvider } = await import('../../contexts/LedgerDisplayPrefixContext')
  const { default: DashboardJobModeCard } = await import('./DashboardJobModeCard')
  renderWithProviders(
    <UpdateFocusOpenerBridgeProvider>
      <LedgerDisplayPrefixProvider authUserId="u1">
        <DashboardJobModeCard userId="u1" onLeaveReport={() => {}} onTurnaway={() => {}} canClockOut />
      </LedgerDisplayPrefixProvider>
    </UpdateFocusOpenerBridgeProvider>,
  )
}

describe('DashboardJobModeCard — hand the phone', () => {
  it('clocked in on a job with no agreement: the master sees the door, and a tap asks for the in-person link', async () => {
    scenario.openSession = { id: 'sess-1', job_ledger_id: JOB_C, bid_id: null }
    scenario.contracts = []
    scenario.role = 'master_technician'
    await mount()
    const door = await screen.findByTestId('job-mode-hand-phone')
    expect(door.textContent).toContain('Hand the phone to the customer to sign')
    fireEvent.click(door)
    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1))
    expect(openSpy.mock.calls[0]![0].jobId).toBe(JOB_C)
    await waitFor(() => expect(goSpy).toHaveBeenCalledWith('https://x.test/contract/sign?t=abc&inperson=1'))
  })

  it('a signed agreement hides the door; a helper never sees it', async () => {
    scenario.openSession = { id: 'sess-1', job_ledger_id: JOB_C, bid_id: null }
    scenario.contracts = [{ status: 'signed', voided_at: null }]
    scenario.role = 'master_technician'
    await mount()
    await screen.findAllByText(/Smoke Job 3/)
    await new Promise((r) => setTimeout(r, 60))
    expect(screen.queryByTestId('job-mode-hand-phone')).toBeNull()
    cleanup()
    scenario.contracts = []
    scenario.role = 'helpers'
    await mount()
    await screen.findAllByText(/Smoke Job 3/)
    await new Promise((r) => setTimeout(r, 60))
    expect(screen.queryByTestId('job-mode-hand-phone')).toBeNull()
  })
})
