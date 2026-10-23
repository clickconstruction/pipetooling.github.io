// @vitest-environment jsdom
/**
 * Quickfill's Needs you station reads every office source the Dashboard reads (v2.5771, punch
 * list #146): the contract lines and the clock sessions, which never reached the station before,
 * draw for an assistant with the hooks' numbers; the clock-sessions press expands the People
 * Hours station on the same page; an estimator is not asked.
 */
import type { ReactNode } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { NeedsYouInputs } from '../../lib/dashboardNeedsYou'
import { JobsListCacheProvider } from '../../contexts/JobsListCacheContext'
import { QuickfillNeedsYouSection } from './QuickfillNeedsYouSection'

const auth = { role: 'assistant' }
const seen: NeedsYouInputs[] = []
const navigate = vi.fn()
const openPeopleHours = vi.fn()

const CONTRACTS = { missing: { count: 3, revenueTotal: 48_000 }, stale: { count: 1, oldestDays: 29 } }
const HOURS = { sessions: 23, totalHours: 148, people: 7, oldestAgeDays: 3 }

const section = () => (
  <JobsListCacheProvider>
    <QuickfillNeedsYouSection onOpenPeopleHours={openPeopleHours} />
  </JobsListCacheProvider>
)

vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  return { useAuth: () => makeUseAuthValue({ role: auth.role }), AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</> }
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn(), recordNavClickFromEvent: vi.fn() }))
vi.mock('../../hooks/useJobContractsNudge', () => ({
  useJobContractsNudge: (enabled: boolean) => ({ nudge: enabled ? CONTRACTS : null, reload: () => {} }),
}))
vi.mock('../../hooks/usePendingHoursApprovalsNudge', async (orig) => ({
  ...(await orig<typeof import('../../hooks/usePendingHoursApprovalsNudge')>()),
  usePendingHoursApprovalsNudge: (enabled: boolean) => ({ approvals: enabled ? HOURS : null, reload: () => {} }),
}))
vi.mock('../../lib/dashboardNeedsYou', async () => {
  const actual = await vi.importActual<typeof import('../../lib/dashboardNeedsYou')>('../../lib/dashboardNeedsYou')
  return {
    ...actual,
    buildNeedsYouItems: (inputs: NeedsYouInputs) => {
      seen.push(inputs)
      return actual.buildNeedsYouItems(inputs)
    },
  }
})

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  seen.length = 0
  navigate.mockClear()
  openPeopleHours.mockClear()
})

describe('QuickfillNeedsYouSection · the office lines the Dashboard had (punch list #146)', () => {
  it('an assistant gets the contract lines and the clock sessions with the hooks’ numbers', async () => {
    auth.role = 'assistant'
    renderWithProviders(section())
    await settle()
    const last = seen[seen.length - 1]!
    expect(last.contractNudgeEnabled).toBe(true)
    expect(last.contractNudge).toEqual(CONTRACTS)
    expect(last.hoursApprovalsEnabled).toBe(true)
    expect(last.bankReturnedEnabled).toBe(true)
    expect(last.testReportsEnabled).toBe(true)
    expect(last.gcFollowUpEnabled).toBe(true)
    expect(last.jobAccountGapsEnabled).toBe(true)
    expect(last.statementRoundEnabled).toBe(true)
    // The two stations on this page keep their lines; the three held back stay off.
    expect(last.jobFollowupsEnabled).toBe(false)
    expect(last.gcReviewEnabled).toBe(false)
    expect(last.robotAuditsEnabled).toBe(false)
    expect(last.d22UncodedEnabled).toBe(false)
    expect(last.submittalsEnabled).toBe(false)
    expect(screen.getByText('3 live jobs have no contract on file')).toBeTruthy()
    expect(screen.getByText('A contract has been out for signature a week')).toBeTruthy()
    expect(screen.getByText('23 clock sessions are waiting on approval')).toBeTruthy()
  })

  it('Start the sweep opens the Contract sweep; the clock sessions expand the People Hours station', async () => {
    auth.role = 'controller'
    renderWithProviders(section())
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Start the sweep' }))
    expect(navigate).toHaveBeenCalledWith('/jobs?tab=stages&contractSweep=1')
    fireEvent.click(screen.getAllByRole('button', { name: 'Open approvals' })[0]!)
    expect(openPeopleHours).toHaveBeenCalledTimes(1)
    expect(navigate).not.toHaveBeenCalledWith('/people?tab=hours&approvals=1')
  })

  it('an estimator is not asked for the office lines', async () => {
    auth.role = 'estimator'
    renderWithProviders(section())
    await settle()
    const last = seen[seen.length - 1]!
    expect(last.contractNudgeEnabled).toBe(false)
    expect(last.hoursApprovalsEnabled).toBe(false)
    expect(screen.queryByText(/no contract on file/)).toBeNull()
  })
})
