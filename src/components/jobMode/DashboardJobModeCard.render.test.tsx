// @vitest-environment jsdom
/**
 * Render smokes for the Job Mode card day rail + clock-out states (v2.2558).
 * A routed supabase stub feeds today's schedule blocks, the open session, and
 * the visited-jobs list so the rail / Wrap Up Day / quiet clock-out JSX mounts.
 */
import { describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'

const JOB_A = '00000000-0000-0000-0000-00000000aaaa'
const JOB_B = '00000000-0000-0000-0000-00000000bbbb'
const JOB_C = '00000000-0000-0000-0000-00000000cccc'

type Scenario = {
  blocks: Array<Record<string, unknown>>
  openSession: Record<string, unknown> | null
  visited: Array<{ job_ledger_id: string }>
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
    // Skipped Job 2 wraps back as Next Job (not a dead end).
    expect(getAllByText(/Next\s*Job/).length).toBeGreaterThan(0)
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
    expect(getByText(/Start First\s*Job/)).toBeTruthy()
  })
})
