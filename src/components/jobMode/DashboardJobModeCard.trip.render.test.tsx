// @vitest-environment jsdom
/**
 * Job Mode's trip (punch list #379, PR 7b), on the whole card: the trip is read once for the job in the card's
 * header and never for a session with no job, the question waits for a clock session, and the card draws its
 * clock presses whether the trip read answers, refuses or fails. Every name here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'

const JOB = '00000000-0000-0000-0000-00000000aaaa'
const TODAY = '2026-10-28'
const scenario: { openSession: Record<string, unknown> | null; tripState: unknown; tripFails: boolean; rpcCalls: Array<{ fn: string; args: unknown }> } = {
  openSession: null,
  tripState: null,
  tripFails: false,
  rpcCalls: [],
}

vi.mock('../../lib/supabase', () => {
  function makeBuilder(table: string) {
    let single = false
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'eq', 'neq', 'is', 'in', 'or', 'not', 'order', 'range', 'limit', 'abortSignal', 'filter']) builder[m] = () => builder
    builder.single = () => { single = true; return builder }
    builder.maybeSingle = () => { single = true; return builder }
    const result = () => {
      if (table === 'job_schedule_blocks') return Promise.resolve({ data: [{ id: 'blk-1', job_id: JOB, time_start: '08:00', time_end: '16:00', jobs_ledger: { hcp_number: '2101', click_number: null, job_name: 'Lift station', job_address: '1 Heron Point Rd', service_type_id: null } }], error: null, count: 0 })
      if (table === 'clock_sessions') return single ? Promise.resolve({ data: scenario.openSession, error: null, count: 0 }) : Promise.resolve({ data: [], error: null, count: 0 })
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
  const rpc = (fn: string, args: unknown) => {
    scenario.rpcCalls.push({ fn, args })
    if (fn === 'trip_phone_state') return Promise.resolve(scenario.tripFails ? { data: null, error: { message: 'Could not find the function public.trip_phone_state', code: 'PGRST202' } } : { data: scenario.tripState, error: null })
    return Promise.resolve({ data: null, error: null })
  }
  return { supabase: { from: (t: string) => makeBuilder(t), channel, removeChannel: () => undefined, rpc, functions: { invoke: () => Promise.resolve({ data: { ok: true }, error: null }) }, auth: { getSession: () => Promise.resolve({ data: { session: null } }) } } }
})
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'helpers', profileName: 'Dana Whitfield' }) }))

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

const tripReads = () => scenario.rpcCalls.filter((c) => c.fn === 'trip_phone_state' || c.fn === 'trip_phone')
const MINE = { trip_id: 't1', trip_number: 5, first_day: '2026-10-26', last_day: TODAY, purpose: '', days: { '2026-10-26': 'road', '2026-10-27': 'site', [TODAY]: 'site' }, with: ['Priya'] }

// The whole Job Mode card mounts in each case, and the first pays for loading it: 30 s rather than the default 5.
describe('DashboardJobModeCard — the trip', { timeout: 30_000 }, () => {
  it('before a clock in, on a site with trips: one read for the job ready to start, the day press up, and nothing asked', async () => {
    Object.assign(scenario, { openSession: null, tripState: { ok: true, development_id: 'd-heron', development_name: 'Heron Point', has_trips: true, mine: null, open: [{ trip_id: 't2', first_day: '2026-10-26', people: ['Luis'] }], today: TODAY }, tripFails: false, rpcCalls: [] })
    await mount()
    await screen.findByLabelText('Leave Report')
    await waitFor(() => expect(screen.getByTestId('job-mode-card').textContent).toContain('Lift station'))
    await waitFor(() => expect(tripReads()).toEqual([{ fn: 'trip_phone_state', args: { p_job_id: JOB } }]))
    await Promise.resolve()
    expect(screen.queryByTestId('trip-phone-ask')).toBeNull()
    expect(screen.queryByTestId('trip-phone-banner')).toBeNull()
    expect(screen.getByLabelText('On my way')).toBeTruthy()
  })

  it('before a clock in, with an open trip of the person’s own: the banner, and no day painted', async () => {
    Object.assign(scenario, { openSession: null, tripState: { ok: true, development_id: 'd-heron', development_name: 'Heron Point', has_trips: true, mine: { ...MINE, last_day: '2026-10-27', days: { '2026-10-26': 'road', '2026-10-27': 'site' } }, open: [], today: TODAY }, tripFails: false, rpcCalls: [] })
    await mount()
    expect((await screen.findByTestId('trip-phone-banner-title')).textContent).toBe('Trip 5 · day 3 at Heron Point')
    await Promise.resolve()
    expect(tripReads()).toEqual([{ fn: 'trip_phone_state', args: { p_job_id: JOB } }])
  })

  it('reads no trip for a clock session with no job', async () => {
    Object.assign(scenario, { openSession: { id: 'sess-0', job_ledger_id: null, bid_id: null }, tripState: null, tripFails: false, rpcCalls: [] })
    await mount()
    await screen.findByLabelText('Leave Report')
    await waitFor(() => expect(screen.getByTestId('job-mode-card').textContent).toContain('Clocked in'))
    expect(tripReads()).toEqual([])
  })

  it('clocked in on a job, reads the trip once for that job and draws the banner above the presses', async () => {
    Object.assign(scenario, { openSession: { id: 'sess-1', job_ledger_id: JOB, bid_id: null }, tripState: { ok: true, development_id: 'd-heron', development_name: 'Heron Point', has_trips: true, mine: MINE, open: [], today: TODAY }, tripFails: false, rpcCalls: [] })
    await mount()
    expect((await screen.findByTestId('trip-phone-banner-title')).textContent).toBe('Trip 5 · day 3 at Heron Point')
    expect(tripReads()).toEqual([{ fn: 'trip_phone_state', args: { p_job_id: JOB } }])
    const banner = screen.getByTestId('trip-phone-banner')
    const leave = screen.getByLabelText('Leave Report')
    expect(banner.compareDocumentPosition(leave) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('On my way and still driving: the card hands the session’s stamps on, and today is painted On the road, not At the site', async () => {
    const unpainted = { ...MINE, last_day: '2026-10-27', days: { '2026-10-26': 'road', '2026-10-27': 'site' } }
    Object.assign(scenario, { openSession: { id: 'sess-2', job_ledger_id: JOB, bid_id: null, travel_started_at: '2026-10-28T12:05:00Z', arrived_at: null }, tripState: { ok: true, development_id: 'd-heron', development_name: 'Heron Point', has_trips: true, mine: unpainted, open: [], today: TODAY }, tripFails: false, rpcCalls: [] })
    await mount()
    await screen.findByTestId('trip-phone-banner')
    await waitFor(() => expect(tripReads().filter((c) => c.fn === 'trip_phone')).toEqual([{ fn: 'trip_phone', args: { p: { action: 'day', job_id: JOB, trip_id: 't1', kind: 'road' } } }]))
    await waitFor(() => expect(screen.getByTestId('trip-phone-home-line').textContent).toBe('Today is marked On the road.'))
  })

  it('a trip read that fails leaves the card as it was: clocked in, its presses up, nothing asked', async () => {
    Object.assign(scenario, { openSession: { id: 'sess-1', job_ledger_id: JOB, bid_id: null }, tripState: null, tripFails: true, rpcCalls: [] })
    await mount()
    await screen.findByLabelText('Leave Report')
    await waitFor(() => expect(tripReads().length).toBe(1))
    expect(screen.getByTestId('job-mode-card').textContent).toContain('Lift station')
    expect(screen.queryByTestId('trip-phone-ask')).toBeNull()
    expect(screen.queryByTestId('trip-phone-banner')).toBeNull()
    expect(screen.queryByTestId('offline-retry-panel')).toBeNull()
  })
})
