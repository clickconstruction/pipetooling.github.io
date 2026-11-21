// @vitest-environment jsdom
/**
 * Job pace for the next stop (punch list #406, the walk as a real superintendent). The Job Mode card drew the
 * pace card only for a job of its own. A superintendent clocked in with no job linked had none, so the card went
 * away with his first stop still ahead. It now draws for that stop and says whose pace it is.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'

const JOB_C = '00000000-0000-0000-0000-00000000cccc'
const scenario: { openSession: Record<string, unknown> | null; role: string } = {
  openSession: { id: 'sess-1', job_ledger_id: null, bid_id: null },
  role: 'superintendent',
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
      if (table === 'job_containers') return Promise.resolve({ data: null, error: null, count: 0 })
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
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: scenario.role, profileName: 'Sam Reyes' }) }))
// The pace card and the details are their own components with their own tests. Here only what is drawn, and for which job, matters.
vi.mock('./SuperintendentCard', () => ({ default: ({ jobId, nextStop }: { jobId: string; nextStop?: string }) => <div data-testid="pace-card-stub" data-job={jobId} data-next-stop={nextStop ?? ''} /> }))
vi.mock('./JobModeDetailsSection', () => ({ default: ({ jobId }: { jobId: string }) => <div data-testid="job-mode-details">{jobId}</div> }))

afterEach(() => {
  cleanup()
  scenario.openSession = { id: 'sess-1', job_ledger_id: null, bid_id: null }
  scenario.role = 'superintendent'
})

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
  await waitFor(() => expect(screen.queryByText('Loading Job Mode…')).toBeNull())
}

// The whole Job Mode card mounts in each case, so each case has 15 s rather than the default 5.
describe('DashboardJobModeCard — Job pace for the next stop', { timeout: 15_000 }, () => {
  it('clocked in with no job linked: the pace card draws for the next stop, and names it', async () => {
    await mount()
    expect(screen.getByText('No job or bid linked yet')).toBeTruthy()
    const card = await screen.findByTestId('pace-card-stub')
    expect(card.dataset.job).toBe(JOB_C)
    expect(card.dataset.nextStop).toContain('Smoke Job 3')
    // The card has no job of its own, so it draws no job details: only the pace of the stop ahead.
    expect(screen.queryByTestId('job-mode-details')).toBeNull()
  })

  it('clocked onto the job itself: the job’s own pace card, with no Next stop line', async () => {
    scenario.openSession = { id: 'sess-1', job_ledger_id: JOB_C, bid_id: null }
    await mount()
    const card = await screen.findByTestId('pace-card-stub')
    expect(card.dataset.job).toBe(JOB_C)
    expect(card.dataset.nextStop).toBe('')
    expect(screen.getByTestId('job-mode-details')).toBeTruthy()
  })

  it('is the superintendent’s card alone: another role clocked in with no job sees none', async () => {
    scenario.role = 'primary'
    await mount()
    expect(screen.getByText('No job or bid linked yet')).toBeTruthy()
    expect(screen.queryByTestId('pace-card-stub')).toBeNull()
  })
})
