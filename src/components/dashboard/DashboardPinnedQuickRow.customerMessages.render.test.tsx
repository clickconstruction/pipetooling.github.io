// @vitest-environment jsdom
/**
 * Wiring for the Customers line on Needs You (residential build, R8 · 14): on since R2 PR 3b (v2.5451), as the flag
 * ships. On, the GC office team gets the line, other roles do not, and its button opens Messages on its customers. With
 * the flag off, nobody reads Follow up's rows for it.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { NeedsYouInputs } from '../../lib/dashboardNeedsYou'
import type { CustomerMessagesCounts } from '../../lib/followUp/customerCounts'
import { DashboardPinnedQuickRow } from './DashboardPinnedQuickRow'

const COUNTS: CustomerMessagesCounts = { needReply: 3, weOwe: 1, toSort: 2 }
// The flag as shipped (`CUSTOMER_MESSAGES_LINE_ON`); a test turns it off.
const flag = vi.hoisted(() => ({ on: true }))
const seen: NeedsYouInputs[] = []
const asked: boolean[] = []
const navigate = vi.fn()

vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'estimator' })
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn(), recordNavClickFromEvent: vi.fn() }))
vi.mock('../../hooks/useCustomerMessagesCounts', () => ({
  useCustomerMessagesCounts: (enabled: boolean) => {
    asked.push(enabled)
    return enabled ? COUNTS : null
  },
}))
vi.mock('../../lib/dashboardNeedsYou', async () => {
  const actual = await vi.importActual<typeof import('../../lib/dashboardNeedsYou')>('../../lib/dashboardNeedsYou')
  return {
    ...actual,
    // The flag as each test sets it, read when the row renders.
    get CUSTOMER_MESSAGES_LINE_ON() {
      return flag.on
    },
    // The real builder over the row's own inputs, so the card draws what they make; every call is kept.
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
  asked.length = 0
  flag.on = true
  navigate.mockClear()
})

const props = {
  authUserId: 'u-1',
  visiblePins: [],
  quickActionDefs: [],
  quickButtonsPlacement: 'top' as const,
  showDashboardQuickButtons: false,
  costMatrixTotal: null,
  billedCount: null,
  billedTotal: null,
  supplyHousesAPTotal: null,
  subLaborDueTotal: null,
  renderModals: false,
  bannersOnly: true,
}

describe('DashboardPinnedQuickRow · the Customers line on Needs You', () => {
  it('with the flag off, nothing reads the counts and nothing draws', async () => {
    flag.on = false
    renderWithProviders(<DashboardPinnedQuickRow {...props} role="assistant" />)
    await settle()
    expect(seen[seen.length - 1]!.customerMessagesEnabled).toBe(false)
    expect(asked.every((enabled) => !enabled)).toBe(true)
    expect(screen.queryByText('Customers')).toBeNull()
  })

  it.each(['dev', 'master_technician', 'assistant', 'controller', 'estimator'] as const)('on, %s gets the line', async (role) => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} role={role} />)
    await settle()
    const last = seen[seen.length - 1]!
    expect(last.customerMessagesEnabled).toBe(true)
    expect(last.customerMessages).toEqual(COUNTS)
    expect(screen.getByText('Customers')).toBeTruthy()
    expect(screen.getByText('3 need a reply, 1 we owe, 2 to sort.')).toBeTruthy()
  })

  it.each(['primary', 'superintendent', 'subcontractor'] as const)('on, %s does not', async (role) => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} role={role} />)
    await settle()
    const last = seen[seen.length - 1]!
    expect(last.customerMessagesEnabled).toBe(false)
    expect(last.customerMessages ?? null).toBeNull()
  })

  it('the line opens Messages on its customers', async () => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} role="assistant" />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /^Messages/ }))
    expect(navigate).toHaveBeenCalledWith('/messages?kind=customer')
  })
})
