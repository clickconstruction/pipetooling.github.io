// @vitest-environment jsdom
/**
 * The Job Mode card's `short` prop (punch list #384, the short Job Mode page). Without it the card is as it was:
 * the Materials on site link and the job's details under the rail. With it the lower half sits behind one row,
 * **Open this job**, a fold in place over the same pieces, and the rail and the press bar do not move.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

const JOB_C = '00000000-0000-0000-0000-00000000cccc'
const scenario: { openSession: Record<string, unknown> | null; role: string; on: boolean; tail: Array<{ direction: string; at: string; body: string }> } = {
  openSession: { id: 'sess-1', job_ledger_id: JOB_C, bid_id: null },
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
// The details are their own component with their own tests. Here only where they are drawn matters.
vi.mock('./JobModeDetailsSection', () => ({ default: ({ jobId }: { jobId: string }) => <div data-testid="job-mode-details">{jobId}</div> }))

afterEach(cleanup)

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
describe('DashboardJobModeCard — short', { timeout: 15_000 }, () => {
  it('without short the card is as it was: the Materials link and the details under the rail, and no fold', async () => {
    await mount(false)
    await screen.findByLabelText('Leave Report')
    expect(await screen.findByTestId('job-mode-details')).toBeTruthy()
    expect(screen.getByTestId('job-mode-materials-on-site')).toBeTruthy()
    expect(screen.queryByTestId('job-mode-short-open-job')).toBeNull()
  })

  it('with short the lower half sits behind Open this job, and the press bar stays', async () => {
    await mount(true)
    await screen.findByLabelText('Leave Report')
    const row = await screen.findByTestId('job-mode-short-open-job')
    expect(row.textContent).toContain('Open this job')
    expect(row.textContent).toContain('Customer, photos, notes, checklists and materials.')
    expect(row.getAttribute('aria-expanded')).toBe('false')
    // Folded: neither the details nor the Materials link is drawn.
    expect(screen.queryByTestId('job-mode-details')).toBeNull()
    expect(screen.queryByTestId('job-mode-materials-on-site')).toBeNull()
    // The card's top is untouched: the day's press and Turnaway are still there.
    expect(screen.getByLabelText('Leave Report')).toBeTruthy()
  })

  it('a press opens the same pieces in place, and a second press folds them', async () => {
    await mount(true)
    const row = await screen.findByTestId('job-mode-short-open-job')
    fireEvent.click(row)
    await waitFor(() => expect(screen.getByTestId('job-mode-short-open-job').getAttribute('aria-expanded')).toBe('true'))
    expect(screen.getByTestId('job-mode-details').textContent).toBe(JOB_C)
    expect(screen.getByTestId('job-mode-materials-on-site')).toBeTruthy()
    expect(screen.getByTestId('job-mode-short-open-job').textContent).toContain('This job')
    expect(screen.getByTestId('job-mode-short-open-job').textContent).toContain('Tap to fold it away.')
    fireEvent.click(screen.getByTestId('job-mode-short-open-job'))
    await waitFor(() => expect(screen.queryByTestId('job-mode-details')).toBeNull())
    expect(screen.queryByTestId('job-mode-materials-on-site')).toBeNull()
  })

  it('with short and no job on the card, the Materials link stays where it was', async () => {
    scenario.openSession = null
    try {
      await mount(true)
      await waitFor(() => expect(screen.queryByText('Loading Job Mode…')).toBeNull())
      const open = screen.queryByTestId('job-mode-short-open-job')
      // A scheduled next stop gives the row a job to open. With none, the link is the only way to Materials.
      if (!open) expect(screen.getByTestId('job-mode-materials-on-site')).toBeTruthy()
      else expect(screen.queryByTestId('job-mode-materials-on-site')).toBeNull()
    } finally {
      scenario.openSession = { id: 'sess-1', job_ledger_id: JOB_C, bid_id: null }
    }
  })
})
