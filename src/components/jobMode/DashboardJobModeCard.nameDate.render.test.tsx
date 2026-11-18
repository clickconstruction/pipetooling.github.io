// @vitest-environment jsdom
/**
 * A date typed into a job's name (punch list #384, the look). The Job Mode card draws it as the day of the week
 * and the month and day, in the title and on the day's rail, whether the person is clocked in or ready to start.
 * A name with no date is drawn as it was.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'

const JOB_C = '00000000-0000-0000-0000-00000000cccc'
const scenario: { openSession: Record<string, unknown> | null; role: string; on: boolean; tail: Array<{ direction: string; at: string; body: string }>; jobName: string } = {
  openSession: { id: 'sess-1', job_ledger_id: JOB_C, bid_id: null },
  role: 'primary',
  on: false,
  tail: [],
  jobName: 'ZZ Test Walk Project 2026-11-08',
}

vi.mock('../../lib/supabase', () => {
  function makeBuilder(table: string) {
    let single = false
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'eq', 'neq', 'is', 'in', 'or', 'not', 'order', 'range', 'limit', 'abortSignal', 'filter']) builder[m] = () => builder
    builder.single = () => { single = true; return builder }
    builder.maybeSingle = () => { single = true; return builder }
    const result = () => {
      if (table === 'job_schedule_blocks') return Promise.resolve({ data: [{ id: 'blk-3', job_id: JOB_C, time_start: '14:00', time_end: '17:00', jobs_ledger: { hcp_number: '503', click_number: null, job_name: scenario.jobName, job_address: '3 Test St', service_type_id: null } }], error: null, count: 0 })
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
// The details are their own component with their own tests. Here only where they are drawn matters.
vi.mock('./JobModeDetailsSection', () => ({ default: ({ jobId }: { jobId: string }) => <div data-testid="job-mode-details">{jobId}</div> }))

afterEach(() => {
  cleanup()
  scenario.openSession = { id: 'sess-1', job_ledger_id: JOB_C, bid_id: null }
  scenario.jobName = 'ZZ Test Walk Project 2026-11-08'
})

async function mount(short: boolean) {
  const { renderWithProviders } = await import('../../test/renderSmokeMocks')
  const { UpdateFocusOpenerBridgeProvider } = await import('../../contexts/UpdateFocusOpenerBridgeContext')
  const { LedgerDisplayPrefixProvider } = await import('../../contexts/LedgerDisplayPrefixContext')
  const { default: DashboardJobModeCard } = await import('./DashboardJobModeCard')
  renderWithProviders(
    <UpdateFocusOpenerBridgeProvider>
      <LedgerDisplayPrefixProvider authUserId="u1">
        <DashboardJobModeCard userId="u1" onLeaveReport={() => {}} onTurnaway={() => {}} canClockOut short={short} />
      </LedgerDisplayPrefixProvider>
    </UpdateFocusOpenerBridgeProvider>,
  )
}

// The whole Job Mode card mounts in each case, so each case has 15 s rather than the default 5.
describe('DashboardJobModeCard — a date in the job name', { timeout: 15_000 }, () => {
  it('clocked in: the title and the rail say the day and the month and day', async () => {
    await mount(false)
    await screen.findByLabelText('Leave Report')
    const card = await screen.findByTestId('job-mode-card')
    await waitFor(() => expect(card.textContent).toContain('ZZ Test Walk Project Sun, Nov 8'))
    expect(card.textContent).not.toContain('2026-11-08')
  })

  it('ready to start: the same words on the next stop', async () => {
    scenario.openSession = null
    await mount(true)
    const card = await screen.findByTestId('job-mode-card')
    await waitFor(() => expect(card.textContent).toContain('Ready to start'))
    expect(card.textContent).toContain('ZZ Test Walk Project Sun, Nov 8')
    expect(card.textContent).not.toContain('2026-11-08')
  })

  it('a name with no date is drawn as it was', async () => {
    scenario.jobName = 'Smoke Job 3'
    await mount(false)
    await screen.findByLabelText('Leave Report')
    const card = await screen.findByTestId('job-mode-card')
    await waitFor(() => expect(card.textContent).toContain('Smoke Job 3'))
  })
})
