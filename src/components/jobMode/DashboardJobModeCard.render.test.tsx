// @vitest-environment jsdom
/**
 * Render smokes for the Job Mode card day rail + clock-out states (v2.2558).
 * A routed supabase stub feeds today's schedule blocks, the open session, and
 * the visited-jobs list so the rail / Wrap Up Day / quiet clock-out JSX mounts.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, waitFor } from '@testing-library/react'
import { OFFLINE_ERROR_MESSAGE } from '../../lib/networkErrorMessage'

const JOB_A = '00000000-0000-0000-0000-00000000aaaa'
const JOB_B = '00000000-0000-0000-0000-00000000bbbb'
const JOB_C = '00000000-0000-0000-0000-00000000cccc'

type Scenario = {
  blocks: Array<Record<string, unknown>>
  openSession: Record<string, unknown> | null
  visited: Array<{ job_ledger_id: string }>
  /** Today's schedule read fails with this result error while set (v2.5962). */
  blocksError?: unknown
}

const scenario: Scenario = { blocks: [], openSession: null, visited: [] }

function ledgerJoin(n: number) {
  return {
    hcp_number: `${500 + n}`,
    click_number: null,
    job_name: `Smoke Job ${n}`,
    job_address: `${n} Test St`,
    service_type_id: null,
  }
}

function makeBlocks(): Array<Record<string, unknown>> {
  return [
    { id: 'blk-1', job_id: JOB_A, time_start: '08:00', time_end: '10:00', jobs_ledger: ledgerJoin(1) },
    { id: 'blk-2', job_id: JOB_B, time_start: '10:30', time_end: '13:00', jobs_ledger: ledgerJoin(2) },
    { id: 'blk-3', job_id: JOB_C, time_start: '14:00', time_end: '17:00', jobs_ledger: ledgerJoin(3) },
  ]
}

vi.mock('../../lib/supabase', () => {
  function makeBuilder(table: string) {
    let single = false
    const builder: Record<string, unknown> = {}
    const chainMethods = [
      'select', 'insert', 'update', 'eq', 'neq', 'is', 'in', 'or', 'not',
      'order', 'range', 'limit', 'abortSignal', 'filter',
    ]
    for (const m of chainMethods) builder[m] = () => builder
    builder.single = () => { single = true; return builder }
    builder.maybeSingle = () => { single = true; return builder }
    const result = () => {
      if (table === 'job_schedule_blocks') {
        if (scenario.blocksError) return Promise.resolve({ data: null, error: scenario.blocksError, count: 0, status: 0 })
        return Promise.resolve({ data: scenario.blocks, error: null, count: 0 })
      }
      if (table === 'clock_sessions') {
        return single
          ? Promise.resolve({ data: scenario.openSession, error: null, count: 0 })
          : Promise.resolve({ data: scenario.visited, error: null, count: 0 })
      }
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
    ch.unsubscribe = () => Promise.resolve('ok')
    return ch
  }
  return {
    supabase: {
      from: (table: string) => makeBuilder(table),
      rpc: () => makeBuilder('__rpc__'),
      channel,
      removeChannel: () => {},
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
    },
  }
})

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
// The real reader, once: a lost signal is classed as the app classes it, without the retry backoff's wait.
vi.mock('../../utils/errorHandling', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/errorHandling')>()
  return { ...actual, withSupabaseRetry: ((op: never, name: string) => actual.withSupabaseRetry(op, name, { maxRetries: 0, logRetries: false })) as typeof actual.withSupabaseRetry }
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))

import { renderWithProviders, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import { UpdateFocusOpenerBridgeProvider } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { LedgerDisplayPrefixProvider } from '../../contexts/LedgerDisplayPrefixContext'
import DashboardJobModeCard from './DashboardJobModeCard'

function renderCard(canClockOut = true) {
  return renderWithProviders(
    <UpdateFocusOpenerBridgeProvider>
      <LedgerDisplayPrefixProvider authUserId={SMOKE_AUTH_USER_ID}>
        <DashboardJobModeCard
          userId={SMOKE_AUTH_USER_ID}
          onLeaveReport={() => {}}
          onTurnaway={() => {}}
          canClockOut={canClockOut}
        />
      </LedgerDisplayPrefixProvider>
    </UpdateFocusOpenerBridgeProvider>,
  )
}

describe('DashboardJobModeCard day rail', () => {
  it('renders the rail with done ✓, NOW, and STILL OPEN rows for a scrambled day', async () => {
    scenario.blocks = makeBlocks()
    scenario.openSession = { id: 'sess-1', job_ledger_id: JOB_C, bid_id: null }
    scenario.visited = [{ job_ledger_id: JOB_A }]
    const { getByText, getAllByText } = renderCard()
    await waitFor(() => {
      expect(getByText(/Today · 1 of 3 done/)).toBeTruthy()
    })
    expect(getByText('NOW')).toBeTruthy()
    expect(getByText('STILL OPEN')).toBeTruthy()
    // Skipped Job 2 wraps back as the next press, On my way (v2.5573), not a dead end.
    expect(getAllByText(/On my\s*way/).length).toBeGreaterThan(0)
    // Quiet clock-out link present while clocked in.
    expect(getByText('Clock out')).toBeTruthy()
  })

  it('shows Wrap Up Day when every other job is visited, and hides it for salaried users', async () => {
    scenario.blocks = makeBlocks()
    scenario.openSession = { id: 'sess-1', job_ledger_id: JOB_C, bid_id: null }
    scenario.visited = [{ job_ledger_id: JOB_A }, { job_ledger_id: JOB_B }]
    const first = renderCard(true)
    await waitFor(() => {
      expect(first.getByText(/Wrap Up\s*Day/)).toBeTruthy()
    })
    first.unmount()

    const salaried = renderCard(false)
    await waitFor(() => {
      expect(salaried.getByText(/Last job\s*of the day/)).toBeTruthy()
    })
    expect(salaried.queryByText('Clock out')).toBeNull()
  })

  it('not clocked in mid-day: Ready to start aims at the first unvisited job', async () => {
    scenario.blocks = makeBlocks()
    scenario.openSession = null
    scenario.visited = [{ job_ledger_id: JOB_A }]
    const { getByText, getAllByText } = renderCard()
    await waitFor(() => {
      expect(getByText('Ready to start')).toBeTruthy()
    })
    // Job 2 (first unvisited), not the visited Job 1 — header + rail row.
    expect(getAllByText(/Smoke Job 2/).length).toBeGreaterThan(1)
    expect(getByText(/On my\s*way/)).toBeTruthy()
  })
})

describe('DashboardJobModeCard when the day will not read (v2.5962)', () => {
  it('a lost signal reads the offline sentence with Retry; Retry reads the day and the rail draws', async () => {
    scenario.blocks = makeBlocks()
    scenario.openSession = null
    scenario.visited = []
    scenario.blocksError = { message: 'TypeError: Load failed', details: '', hint: '', code: '' }
    const { getByText, getByRole } = renderCard()
    await waitFor(() => expect(getByText(OFFLINE_ERROR_MESSAGE)).toBeTruthy())
    scenario.blocksError = undefined
    fireEvent.click(getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(getByText(/Today · 0 of 3 done/)).toBeTruthy())
  })

  it('a refused read names what it could not read, with no Retry', async () => {
    scenario.blocks = []
    scenario.blocksError = { message: 'permission denied for table job_schedule_blocks', code: '42501', details: null, hint: null }
    const { getByText, queryByRole } = renderCard()
    await waitFor(() => expect(getByText("You don't have access to this schedule.")).toBeTruthy())
    expect(queryByRole('button', { name: 'Retry' })).toBeNull()
    scenario.blocksError = undefined
  })
})

describe('DashboardJobModeCard manual Clock In (v2.3193)', () => {
  it('no schedule and nothing running: the right button is Clock In in the clock-in orange', async () => {
    scenario.blocks = []
    scenario.openSession = null
    scenario.visited = []
    const { getByText, getByRole } = renderCard()
    await waitFor(() => {
      expect(getByText('No schedule for today')).toBeTruthy()
    })
    const clockIn = getByRole('button', { name: 'Clock In' })
    // White words on the clock-in orange's deep shade (v2.6186): white on #ff6600 read 2.94:1.
    expect(clockIn.style.background).toBe('rgb(199, 80, 0)')
    expect(clockIn.style.color).toBe('rgb(255, 255, 255)')
    // The advance / wrap-up styles are not in play here.
    expect(clockIn.style.background).not.toBe('rgb(22, 163, 74)')
  })
})
