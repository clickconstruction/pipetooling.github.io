// @vitest-environment jsdom
/**
 * Job Mode's Message the customer (residential R5): on the clocked-in job, the door shows only through
 * jobModeMessagesOffered, which is switched off until quo-send takes a tech's text. Switched on, a primary sees it,
 * with the orange dot when the customer answered; a master never does.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'

const JOB_C = '00000000-0000-0000-0000-00000000cccc'
const scenario: { openSession: Record<string, unknown> | null; role: string; on: boolean; tail: Array<{ direction: string; at: string; body: string }> } = {
  openSession: null,
  role: 'primary',
  on: false,
  tail: [],
}

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
      if (table === 'job_contracts') return Promise.resolve({ data: [], error: null, count: 0 })
      if (table === 'jobs_ledger') return Promise.resolve({ data: single ? { customer_id: 'cust-dana' } : [], error: null, count: 0 })
      if (table === 'customers') return Promise.resolve({ data: single ? { name: 'Dana Whitfield' } : [], error: null, count: 0 })
      if (table === 'contacts') return Promise.resolve({ data: [{ id: 'contact-dana' }], error: null, count: 0 })
      if (table === 'messages') return Promise.resolve({ data: scenario.tail, error: null, count: 0 })
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
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: scenario.role, profileName: 'Luis Ortega' }) }))
vi.mock('../../lib/messages/jobBox', async () => {
  const actual = await vi.importActual<typeof import('../../lib/messages/jobBox')>('../../lib/messages/jobBox')
  return { ...actual, jobModeMessagesOffered: (role: Parameters<typeof actual.jobModeMessagesOffered>[0]) => actual.jobModeMessagesOffered(role, scenario.on) }
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

describe('DashboardJobModeCard — Message the customer', () => {
  it('stays hidden while the switch is off, even for a primary on the job', async () => {
    Object.assign(scenario, { openSession: { id: 'sess-1', job_ledger_id: JOB_C, bid_id: null }, role: 'primary', on: false, tail: [] })
    await mount()
    await screen.findByLabelText('Leave Report')
    await waitFor(() => expect(screen.queryByTestId('job-mode-message-door')).toBeNull())
  })

  it('switched on, a primary on the job sees the door, with the dot when the customer answered', async () => {
    Object.assign(scenario, {
      openSession: { id: 'sess-1', job_ledger_id: JOB_C, bid_id: null },
      role: 'primary',
      on: true,
      tail: [
        { direction: 'in', at: '2026-10-13T14:05:00Z', body: 'Thanks, the gate code is 4412.' },
        { direction: 'out', at: '2026-10-13T14:02:00Z', body: 'Dana, I am on my way.' },
      ],
    })
    await mount()
    const door = await screen.findByTestId('job-mode-message-door')
    await waitFor(() => expect(door.getAttribute('aria-label')).toBe('Message the customer. They answered.'))
    expect(screen.getByTestId('job-mode-message-dot')).toBeTruthy()
  })

  it('switched on, a master never sees it', async () => {
    Object.assign(scenario, { openSession: { id: 'sess-1', job_ledger_id: JOB_C, bid_id: null }, role: 'master_technician', on: true, tail: [] })
    await mount()
    await screen.findByLabelText('Leave Report')
    await waitFor(() => expect(screen.queryByTestId('job-mode-message-door')).toBeNull())
  })
})
