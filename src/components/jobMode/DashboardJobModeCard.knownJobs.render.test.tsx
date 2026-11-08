// @vitest-environment jsdom
/**
 * Job Mode's visits on a job the reader cannot read (seen 2026-11-08): a superintendent has no read
 * policy on jobs of their own, so a visit on a job they never clocked onto comes back from the
 * schedule read with its job embed empty, and the card drew "J— · —" with no address. The Dashboard
 * hands Job Mode the jobs it already read through definer reads; the visit takes its labels from
 * there. Without them the card still draws the blank, which pins where the words come from.
 * Made-up jobs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, waitFor } from '@testing-library/react'

const JOB_A = '00000000-0000-0000-0000-00000000aaaa'
const JOB_B = '00000000-0000-0000-0000-00000000bbbb'

let blocks: unknown[] = []

vi.mock('../../lib/supabase', () => {
  function makeBuilder(table: string) {
    let single = false
    const builder: Record<string, unknown> = {}
    const chainMethods = ['select', 'insert', 'update', 'eq', 'neq', 'is', 'in', 'or', 'not', 'order', 'range', 'limit', 'abortSignal', 'filter']
    for (const m of chainMethods) builder[m] = () => builder
    builder.single = () => {
      single = true
      return builder
    }
    builder.maybeSingle = () => {
      single = true
      return builder
    }
    const result = (): Promise<unknown> => {
      if (table === 'job_schedule_blocks') return Promise.resolve({ data: blocks, error: null, count: 0, status: 200 })
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
vi.mock('../../utils/errorHandling', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/errorHandling')>()
  return { ...actual, withSupabaseRetry: ((op: never, name: string) => actual.withSupabaseRetry(op, name, { maxRetries: 0, logRetries: false })) as typeof actual.withSupabaseRetry }
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))
vi.mock('../../hooks/useIsDigitalTwin', () => ({ useIsDigitalTwin: () => false }))
vi.mock('../../lib/impersonationSession', () => ({ isImpersonationSessionActive: () => false }))
vi.mock('../../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => false }))
vi.mock('../../lib/keptReadStore', () => ({
  readKeptRead: vi.fn(async () => null),
  writeKeptRead: vi.fn(async () => {}),
  clearKeptReads: vi.fn(async () => {}),
}))

import { renderWithProviders, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import { UpdateFocusOpenerBridgeProvider } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { LedgerDisplayPrefixProvider } from '../../contexts/LedgerDisplayPrefixContext'
import type { ScheduledJobLabelSource } from '../../lib/jobMode/scheduledJobLabels'
import DashboardJobModeCard from './DashboardJobModeCard'
import { CUSTOMER_CONTACT_AFTER_CLOCK_IN_WORDS } from './JobModeDetailsSection'

function renderCard(knownJobs?: ScheduledJobLabelSource[]) {
  return renderWithProviders(
    <UpdateFocusOpenerBridgeProvider>
      <LedgerDisplayPrefixProvider authUserId={SMOKE_AUTH_USER_ID}>
        <DashboardJobModeCard userId={SMOKE_AUTH_USER_ID} onLeaveReport={() => {}} onTurnaway={() => {}} canClockOut {...(knownJobs ? { knownJobs } : {})} />
      </LedgerDisplayPrefixProvider>
    </UpdateFocusOpenerBridgeProvider>,
  )
}

beforeEach(() => {
  // The first visit's job embed came back empty (the reader cannot read that job); the second read fine.
  blocks = [
    { id: 'blk-1', job_id: JOB_A, time_start: '08:00', time_end: '10:00', jobs_ledger: null },
    { id: 'blk-2', job_id: JOB_B, time_start: '10:30', time_end: '13:00', jobs_ledger: { hcp_number: '512', click_number: null, job_name: 'Cedar Row', job_address: '12 Cedar Row', service_type_id: null } },
  ]
})
afterEach(() => {
  cleanup()
})

describe('DashboardJobModeCard, a visit on a job the reader cannot read', () => {
  it('takes the number, the name and the address from the jobs the Dashboard knows', async () => {
    const { getAllByText, container } = renderCard([
      { id: JOB_A, hcp_number: '1113', click_number: '1113', job_name: 'Harbor Lane Offices', job_address: '100 Harbor Ln, San Antonio, TX', service_type_id: null },
    ])
    await waitFor(() => expect(getAllByText(/Harbor Lane Offices/).length).toBeGreaterThan(0))
    expect(getAllByText(/1113/).length).toBeGreaterThan(0)
    expect(getAllByText(/100 Harbor Ln/).length).toBeGreaterThan(0)
    expect(getAllByText(/Cedar Row/).length).toBeGreaterThan(0)
    expect(container.textContent).not.toMatch(/J— · —/)
    // The job's own read gives this reader no row, so the customer line says when it opens instead of Loading… for good.
    await waitFor(() => expect(getAllByText(CUSTOMER_CONTACT_AFTER_CLOCK_IN_WORDS).length).toBe(1))
    expect(container.textContent).not.toMatch(/Customer\s*Loading…/)
  })

  it('without them the visit still draws the blank, so the words come from the Dashboard’s jobs', async () => {
    const { getAllByText, container } = renderCard()
    await waitFor(() => expect(getAllByText(/Cedar Row/).length).toBeGreaterThan(0))
    expect(container.textContent).toMatch(/J?\w*— · —/)
    expect(container.textContent).not.toMatch(/Harbor Lane Offices/)
  })
})
