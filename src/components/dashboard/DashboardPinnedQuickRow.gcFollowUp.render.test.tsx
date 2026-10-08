// @vitest-environment jsdom
/**
 * Wiring for GC mode's Follow up on Needs You (v2.4941): the GC office team gets the line, other
 * roles do not, and its button opens Follow up on the GC projects page.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { NeedsYouInputs } from '../../lib/dashboardNeedsYou'
import type { GcFollowUpNeeds } from '../../lib/gc/followUpNeeds'
import { DashboardPinnedQuickRow } from './DashboardPinnedQuickRow'

const NEEDS: GcFollowUpNeeds = {
  count: 2,
  late: true,
  title: '2 calls to make about quotes',
  detail: 'Alamo Concrete is 2 days past the day it gave for its quote. Pecan Valley Electric promised its quote today. Next: call them from Follow up.',
}
const seen: NeedsYouInputs[] = []
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
vi.mock('../../hooks/useGcFollowUpNeeds', () => ({
  useGcFollowUpNeeds: (enabled: boolean) => (enabled ? NEEDS : null),
}))
vi.mock('../../lib/dashboardNeedsYou', async () => {
  const actual = await vi.importActual<typeof import('../../lib/dashboardNeedsYou')>('../../lib/dashboardNeedsYou')
  return {
    ...actual,
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

describe('DashboardPinnedQuickRow · GC Follow up on Needs You', () => {
  it.each(['dev', 'master_technician', 'assistant', 'controller', 'estimator'] as const)('%s gets the calls to make', async (role) => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} role={role} />)
    await settle()
    const last = seen[seen.length - 1]!
    expect(last.gcFollowUpEnabled).toBe(true)
    expect(last.gcFollowUp).toEqual(NEEDS)
    expect(screen.getByText('2 calls to make about quotes')).toBeTruthy()
  })

  it.each(['primary', 'superintendent', 'subcontractor'] as const)('%s does not', async (role) => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} role={role} />)
    await settle()
    const last = seen[seen.length - 1]!
    expect(last.gcFollowUpEnabled).toBe(false)
    expect(last.gcFollowUp ?? null).toBeNull()
  })

  it('the line opens Follow up on GC projects', async () => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} role="estimator" />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /Follow up/ }))
    expect(navigate).toHaveBeenCalledWith('/gc?view=followUp')
  })
})
